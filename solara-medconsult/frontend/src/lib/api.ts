import {
  SECOES_ORIENTACOES,
  SECOES_PROPEDEUTICA,
  ehSecao,
  type DefSecao,
  type Fonte,
  type ItemSecao,
  type ItemSugerido,
  type Secao,
} from "@/lib/sugestoes";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Limite de imagem (o servidor valida de novo). */
export const MAX_IMAGEM_BYTES = 10 * 1024 * 1024;

export interface HealthResponse {
  status: string;
  service: string;
  checks: Record<string, string>;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao consultar /health: ${res.status}`);
  }
  return res.json();
}

/** `true` se o backend responde (mesmo "degraded"). Nunca lança. */
export async function checkHealth(): Promise<boolean> {
  try {
    await getHealth();
    return true;
  } catch {
    return false;
  }
}

export interface ImagemApi {
  image_id: string;
  url: string;
  /** AAAA-MM-DD ou null quando a data da foto não foi identificada. */
  data_classificada: string | null;
  data_origem: "exif" | "manual" | "aproximada" | null;
  descricao: string | null;
  gerada_por_ia: boolean;
  avisos: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function mensagemDeErro(res: Response): Promise<string> {
  try {
    const corpo = await res.json();
    if (typeof corpo?.detail === "string") return corpo.detail;
  } catch {
    // sem corpo JSON
  }
  return `Erro ${res.status}`;
}

async function pedir(input: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new ApiError("Servidor indisponível.", null);
  }
  if (!res.ok) throw new ApiError(await mensagemDeErro(res), res.status);
  return res;
}

/** O servidor devolve o endereço da imagem relativo a ele; aqui vira absoluto (abre também no iPad). */
const imagemComUrl = (i: ImagemApi): ImagemApi => ({
  ...i,
  url: i.url.startsWith("/") ? `${API_URL}${i.url}` : i.url,
});

export async function uploadImage(
  sessionId: string,
  file: File,
  dataManual?: string,
): Promise<ImagemApi> {
  if (file.size > MAX_IMAGEM_BYTES) throw new ApiError("Imagem maior que 10 MB.", 413);
  const form = new FormData();
  form.append("file", file);
  if (dataManual) form.append("data_manual", dataManual); // foto tirada agora: data de hoje
  const res = await pedir(`${API_URL}/session/${sessionId}/images`, { method: "POST", body: form });
  return imagemComUrl(await res.json());
}

const MAX_LAUDO_BYTES = 15 * 1024 * 1024;

/** Anexa um laudo (PDF ou foto) à consulta. O arquivo não é lido pela IA. */
export async function uploadLaudo(sessionId: string, file: File): Promise<LaudoApi> {
  if (file.size > MAX_LAUDO_BYTES) throw new ApiError("Laudo maior que 15 MB.", 413);
  const form = new FormData();
  form.append("arquivo", file);
  const res = await pedir(`${API_URL}/session/${sessionId}/laudos`, { method: "POST", body: form });
  return res.json();
}

export async function removerLaudo(sessionId: string, laudoId: string): Promise<void> {
  await pedir(`${API_URL}/session/${sessionId}/laudos/${laudoId}`, { method: "DELETE" });
}

export const urlLaudo = (id: string) => `${API_URL}/laudos/${id}/arquivo`;

export async function listImages(sessionId: string): Promise<ImagemApi[]> {
  const res = await pedir(`${API_URL}/session/${sessionId}/images`, { cache: "no-store" });
  return ((await res.json()) as ImagemApi[]).map(imagemComUrl);
}

export async function deleteImage(sessionId: string, imageId: string): Promise<void> {
  await pedir(`${API_URL}/session/${sessionId}/images/${imageId}`, { method: "DELETE" });
}

/** http://host -> ws://host (https -> wss). */
export function wsUrl(path: string): string {
  return `${API_URL.replace(/^http/, "ws")}${path}`;
}

// ---------------------------------------------------------------------------- sugestões

const TEMPO_SUGESTAO_MS = 180_000; // busca no acervo, reordenação por IA e busca web podem levar um tempo

async function postarJson<T>(caminho: string, corpo: unknown): Promise<T> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_SUGESTAO_MS);
  try {
    const res = await pedir(`${API_URL}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
    return (await res.json()) as T;
  } finally {
    clearTimeout(relogio);
  }
}

/** Tamanho máximo do caso aceito pelo servidor. */
export const MAX_CASO_CHARS = 6000;

export interface DiagnosticosSugeridos {
  nomes: string[];
  /** Estimativa da IA em %, na mesma ordem de `nomes` (-1 quando faltar). */
  probabilidades: number[];
  /** Código CID-11, na mesma ordem de `nomes` ("" quando faltar). */
  cid11: string[];
}

/** Diagnósticos possíveis para o caso, do mais para o menos provável, com a estimativa em % e o CID-11. */
export async function sugerirDiagnosticos(
  caso: string,
  fontes: Fonte[],
  colado = "",
): Promise<DiagnosticosSugeridos> {
  const r = await postarJson<{ diagnosticos?: unknown; probabilidades?: unknown; cid11?: unknown }>(
    "/diagnostico/sugerir",
    { caso: caso.slice(0, MAX_CASO_CHARS), fontes, colado },
  );
  const brutos = Array.isArray(r.diagnosticos) ? r.diagnosticos : [];
  const pcts = Array.isArray(r.probabilidades) ? r.probabilidades : [];
  const cids = Array.isArray(r.cid11) ? r.cid11 : [];
  const nomes: string[] = [];
  const probabilidades: number[] = [];
  const cid11: string[] = [];
  brutos.forEach((d, i) => {
    if (typeof d !== "string" || d.trim() === "") return;
    nomes.push(d);
    const p = typeof pcts[i] === "number" ? (pcts[i] as number) : Number.NaN;
    probabilidades.push(Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : -1);
    cid11.push(typeof cids[i] === "string" ? (cids[i] as string) : "");
  });
  return { nomes, probabilidades, cid11 };
}

/** História clínica escrita a partir do registro da Captura. O médico revisa antes de salvar. */
export async function gerarHistoria(registro: string): Promise<string> {
  const r = await postarJson<{ historia?: unknown }>("/historia/gerar", { registro });
  return typeof r.historia === "string" ? r.historia.trim() : "";
}

async function gerarTexto(
  caminho: string,
  diagnostico: string,
  fontes: Fonte[],
  colado: string,
): Promise<string> {
  const r = await postarJson<{ texto?: unknown }>(caminho, { diagnostico, fontes, colado });
  return typeof r.texto === "string" ? r.texto.trim() : "";
}

/** Conduta: plano clínico geral e orientações de manejo, a partir do diagnóstico, em texto corrido. */
export const gerarConduta = (diagnostico: string, fontes: Fonte[], colado = "") =>
  gerarTexto("/conduta/gerar", diagnostico, fontes, colado);

/** Propedêutica/Investigação: exames, biópsia, parecer de especialista — mais dados para o diagnóstico. */
export const gerarInvestigacao = (diagnostico: string, fontes: Fonte[], colado = "") =>
  gerarTexto("/investigacao/gerar", diagnostico, fontes, colado);

/** Tratamento: medicamento, dose e duração (ou conduta cirúrgica), em texto corrido. */
export const gerarTratamento = (diagnostico: string, fontes: Fonte[], colado = "") =>
  gerarTexto("/tratamento/gerar", diagnostico, fontes, colado);

/** Orientações gerais ao paciente a partir do diagnóstico, em texto corrido. */
export const gerarOrientacoesTexto = (diagnostico: string, fontes: Fonte[], colado = "") =>
  gerarTexto("/orientacoes/gerar", diagnostico, fontes, colado);

export interface TopicoPendente {
  topico: string;
  pergunta_sugerida: string;
}

export type EstadoRedFlag = "presente" | "ausente" | "nao_verificado";

export interface RedFlagAvaliado {
  sinal: string;
  estado: EstadoRedFlag;
}

export interface Pendencias {
  pendentes: TopicoPendente[];
  red_flags: RedFlagAvaliado[];
}

/** O que falta na anamnese (tópicos essenciais e sinais de alarme), a partir do registro já
 * capturado até agora. Nunca inventa; o médico decide o que fazer com cada item. */
export async function verificarPendencias(registro: string): Promise<Pendencias> {
  return postarJson<Pendencias>("/anamnese/pendencias", { registro });
}

async function sugerirLista<S extends Secao>(
  caminho: string,
  defs: DefSecao<S>[],
  diagnostico: string,
  fontes: Fonte[],
): Promise<ItemSecao<S>[]> {
  const r = await postarJson<{ itens?: unknown }>(caminho, { diagnostico, fontes });
  return limparItens(r.itens).flatMap((i) =>
    ehSecao(defs, (i as { secao?: unknown }).secao) ? [i as ItemSecao<S>] : [],
  );
}

/** Propedêutica: tratamento + investigação + acompanhamento do diagnóstico escolhido. */
export const sugerirPropedeutica = (diagnostico: string, fontes: Fonte[]) =>
  sugerirLista("/propedeutica/sugerir", SECOES_PROPEDEUTICA, diagnostico, fontes);

/** Orientações gerais: cuidados com a pele, fotoproteção, higiene e ambiente. */
export const sugerirOrientacoes = (diagnostico: string, fontes: Fonte[]) =>
  sugerirLista("/orientacoes/sugerir", SECOES_ORIENTACOES, diagnostico, fontes);

/** Aceita só itens bem formados (termo de texto). Nunca guarda a origem do item. */
function limparItens(bruto: unknown): ItemSugerido[] {
  if (!Array.isArray(bruto)) return [];
  const saida: ItemSugerido[] = [];
  for (const b of bruto) {
    const termo = typeof b?.termo === "string" ? b.termo.trim() : "";
    if (!termo) continue;
    saida.push({ termo, ...(typeof b?.secao === "string" ? { secao: b.secao } : {}) } as ItemSugerido);
  }
  return saida;
}


// ---------------------------------------------------------------------------- prontuários

export interface ProntuarioResumo {
  id: string;
  paciente: string;
  paciente_id?: string | null;
  modo: string;
  tipo?: "nova" | "retorno";
  criado_em: string;
}

export interface LaudoApi {
  id: string;
  nome: string;
  tipo: "pdf" | "imagem";
  criado_em: string;
}

export interface ProntuarioCompleto extends ProntuarioResumo {
  texto: string;
  laudos?: LaudoApi[];
}

/** Guarda o prontuário (texto + PDF) no servidor, para reabrir depois. */
export async function registrarProntuario(d: {
  texto: string;
  paciente: string;
  modo: string;
  sessionId: string | null;
  pacienteId?: string | null;
  tipo?: "nova" | "retorno";
  retornoDe?: string | null;
  pdf: Blob;
  nomePdf: string;
}): Promise<ProntuarioResumo> {
  const form = new FormData();
  form.append("texto", d.texto);
  form.append("paciente", d.paciente);
  form.append("modo", d.modo);
  if (d.sessionId) form.append("session_id", d.sessionId);
  if (d.pacienteId) form.append("paciente_id", d.pacienteId);
  form.append("tipo", d.tipo ?? "nova");
  if (d.retornoDe) form.append("retorno_de", d.retornoDe);
  form.append("pdf", d.pdf, d.nomePdf);
  const res = await pedir(`${API_URL}/prontuarios`, { method: "POST", body: form });
  return res.json();
}

export async function listarProntuarios(): Promise<ProntuarioResumo[]> {
  const res = await pedir(`${API_URL}/prontuarios`, { cache: "no-store" });
  return res.json();
}

export async function obterProntuario(id: string): Promise<ProntuarioCompleto> {
  const res = await pedir(`${API_URL}/prontuarios/${id}`, { cache: "no-store" });
  return res.json();
}

/** Endereço do PDF guardado (o servidor entrega o arquivo, em qualquer aparelho). */
export const urlPdfProntuario = (id: string) => `${API_URL}/prontuarios/${id}/pdf`;

export async function baixarPdfProntuario(id: string): Promise<Blob> {
  const res = await pedir(urlPdfProntuario(id), { cache: "no-store" });
  return res.blob();
}

/** Correção de erros pelo médico: troca o texto e o PDF; o resto do registro não muda. */
export async function corrigirProntuario(
  id: string,
  d: { texto: string; pdf: Blob; nomePdf: string },
): Promise<ProntuarioResumo> {
  const form = new FormData();
  form.append("texto", d.texto);
  form.append("pdf", d.pdf, d.nomePdf);
  const res = await pedir(`${API_URL}/prontuarios/${id}`, { method: "PUT", body: form });
  return res.json();
}

export interface RegistroProntuario {
  id: string;
  rotulo: string; // "Consulta 1", "Retorno 1"...
  tipo: "nova" | "retorno";
  modo: string;
  criado_em: string;
  corrigido_em: string | null;
  texto: string;
  laudos?: LaudoApi[];
}

export interface ProntuarioDoPaciente {
  paciente: PacienteDetalhe;
  registros: RegistroProntuario[]; // do mais antigo para o mais recente
}

export async function obterProntuarioDoPaciente(id: string): Promise<ProntuarioDoPaciente> {
  const res = await pedir(`${API_URL}/pacientes/${id}/prontuario`, { cache: "no-store" });
  return res.json();
}

export async function excluirProntuario(id: string): Promise<void> {
  await pedir(`${API_URL}/prontuarios/${id}`, { method: "DELETE" });
}


// ---------------------------------------------------------------------------- pacientes

export interface Paciente {
  id: string;
  nome: string;
  nascimento: string | null;
  n_prontuarios: number;
  ultima_consulta: string | null;
}

export interface ConsultaResumo {
  id: string;
  modo: string;
  tipo: "nova" | "retorno";
  criado_em: string;
}

export interface PacienteDetalhe extends Paciente {
  consultas: ConsultaResumo[];
  cpf: string | null;
  sexo: string | null;
  contato: string | null;
  profissao: string | null;
  moradia: string | null;
  plano_saude: string | null;
  historico_familiar: string | null;
  medicacoes_uso: string | null;
  alergias: string | null;
}

/** Lista de pacientes; `total` e `truncado` vêm da API quando a lista foi cortada no limite. */
export type ListaPacientes = Paciente[] & { total?: number; truncado?: boolean };

export async function listarPacientes(q = ""): Promise<ListaPacientes> {
  const sufixo = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const res = await pedir(`${API_URL}/pacientes${sufixo}`, { cache: "no-store" });
  const itens: Paciente[] = await res.json();
  const total = Number(res.headers?.get("X-Total-Count"));
  return Object.assign(itens, {
    total: Number.isFinite(total) && total > 0 ? total : itens.length,
    truncado: res.headers?.get("X-Truncado") === "true",
  });
}

/** Cadastro do paciente: só o nome é obrigatório. Fica no banco local; nunca vai à IA. */
export interface FichaPaciente {
  nome: string;
  nascimento: string;
  cpf: string;
  sexo: string;
  contato: string;
  profissao: string;
  moradia: string;
  plano_saude: string;
  historico_familiar: string;
  medicacoes_uso: string;
  alergias: string;
}

export const FICHA_VAZIA: FichaPaciente = {
  nome: "",
  nascimento: "",
  cpf: "",
  sexo: "",
  contato: "",
  profissao: "",
  moradia: "",
  plano_saude: "",
  historico_familiar: "",
  medicacoes_uso: "",
  alergias: "",
};

function corpoDaFicha(ficha: FichaPaciente): string {
  const corpo: Record<string, string | null> = {};
  for (const [campo, valor] of Object.entries(ficha)) corpo[campo] = valor.trim() || null;
  corpo.nome = ficha.nome.trim();
  return JSON.stringify(corpo);
}

export async function cadastrarPaciente(ficha: FichaPaciente): Promise<Paciente> {
  const res = await pedir(`${API_URL}/pacientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpoDaFicha(ficha),
  });
  return res.json();
}

export async function corrigirPaciente(id: string, ficha: FichaPaciente): Promise<Paciente> {
  const res = await pedir(`${API_URL}/pacientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: corpoDaFicha(ficha),
  });
  return res.json();
}

export async function obterPaciente(id: string): Promise<PacienteDetalhe> {
  const res = await pedir(`${API_URL}/pacientes/${id}`, { cache: "no-store" });
  return res.json();
}

// ------------------------------------------------------------------ receitas

export interface ItemReceitaApi {
  medicamento: string;
  posologia: string;
  duracao: string;
  quantidade: string;
}

export interface ReceitaApi {
  id: string;
  paciente_id: string | null;
  paciente: string;
  itens: ItemReceitaApi[];
  observacoes: string;
  medico_nome: string;
  medico_crm: string;
  criado_em: string;
}

/** Guarda a receita (itens + PDF) ligada ao paciente. Receita não se edita: corrigir é emitir outra. */
export async function emitirReceita(d: {
  pacienteId: string;
  itens: ItemReceitaApi[];
  observacoes: string;
  medicoNome: string;
  medicoCrm: string;
  pdf: Blob;
  nomePdf: string;
}): Promise<ReceitaApi> {
  const form = new FormData();
  form.append("paciente_id", d.pacienteId);
  form.append("itens", JSON.stringify(d.itens));
  form.append("observacoes", d.observacoes);
  form.append("medico_nome", d.medicoNome);
  form.append("medico_crm", d.medicoCrm);
  form.append("pdf", d.pdf, d.nomePdf);
  const res = await pedir(`${API_URL}/receitas`, { method: "POST", body: form });
  return res.json();
}

export async function listarReceitas(pacienteId: string): Promise<ReceitaApi[]> {
  const res = await pedir(`${API_URL}/pacientes/${pacienteId}/receitas`, { cache: "no-store" });
  return res.json();
}

export const urlPdfReceita = (id: string) => `${API_URL}/receitas/${id}/pdf`;

// ------------------------------------------------------------------ atestados e declarações

export interface AtestadoApi {
  id: string;
  paciente_id: string | null;
  paciente: string;
  conteudo: { dias_afastamento: number; data_inicial: string; cidade: string; cid: string | null };
  medico_nome: string;
  medico_crm: string;
  criado_em: string;
}

/** Guarda o atestado (PDF). Atestado não se edita: corrigir é emitir outro. */
export async function emitirAtestado(d: {
  pacienteId: string;
  sessionId: string | null;
  diasAfastamento: number;
  dataInicial: string;
  cidade: string;
  cid: string;
  medicoNome: string;
  medicoCrm: string;
  pdf: Blob;
  nomePdf: string;
}): Promise<AtestadoApi> {
  const form = new FormData();
  form.append("paciente_id", d.pacienteId);
  if (d.sessionId) form.append("session_id", d.sessionId);
  form.append("dias_afastamento", String(d.diasAfastamento));
  form.append("data_inicial", d.dataInicial);
  form.append("cidade", d.cidade);
  form.append("cid", d.cid);
  form.append("medico_nome", d.medicoNome);
  form.append("medico_crm", d.medicoCrm);
  form.append("pdf", d.pdf, d.nomePdf);
  const res = await pedir(`${API_URL}/atestados`, { method: "POST", body: form });
  return res.json();
}

export async function listarAtestados(pacienteId: string): Promise<AtestadoApi[]> {
  const res = await pedir(`${API_URL}/pacientes/${pacienteId}/atestados`, { cache: "no-store" });
  return res.json();
}

export interface DeclaracaoApi {
  id: string;
  paciente_id: string | null;
  paciente: string;
  conteudo: { data: string; hora_inicio: string; hora_fim: string; cidade: string };
  medico_nome: string;
  medico_crm: string;
  criado_em: string;
}

/** Guarda a declaração de comparecimento (PDF). Não se edita: corrigir é emitir outra. */
export async function emitirDeclaracao(d: {
  pacienteId: string;
  sessionId: string | null;
  data: string;
  horaInicio: string;
  horaFim: string;
  cidade: string;
  medicoNome: string;
  medicoCrm: string;
  pdf: Blob;
  nomePdf: string;
}): Promise<DeclaracaoApi> {
  const form = new FormData();
  form.append("paciente_id", d.pacienteId);
  if (d.sessionId) form.append("session_id", d.sessionId);
  form.append("data", d.data);
  form.append("hora_inicio", d.horaInicio);
  form.append("hora_fim", d.horaFim);
  form.append("cidade", d.cidade);
  form.append("medico_nome", d.medicoNome);
  form.append("medico_crm", d.medicoCrm);
  form.append("pdf", d.pdf, d.nomePdf);
  const res = await pedir(`${API_URL}/declaracoes`, { method: "POST", body: form });
  return res.json();
}

export async function listarDeclaracoes(pacienteId: string): Promise<DeclaracaoApi[]> {
  const res = await pedir(`${API_URL}/pacientes/${pacienteId}/declaracoes`, { cache: "no-store" });
  return res.json();
}

export const urlPdfDocumento = (id: string) => `${API_URL}/documentos/${id}/pdf`;

// ------------------------------------------------------------------ pré-consulta (dermatologia)

export interface PreConsultaQueixa {
  queixa_principal: string;
  duracao_queixa: "dias" | "semanas" | "meses" | "anos";
  ja_tratou_antes: boolean;
  tratamento_anterior: string;
  categorias: string[];
}

export interface PreConsultaHistorico {
  exposicao_solar: boolean;
  tipo_exposicao: "trabalho" | "lazer" | "ambos" | null;
  queimadura_solar_infancia: boolean;
  uso_camara_bronzeamento: boolean;
  frequencia_protetor_solar: "nunca" | "as_vezes" | "todo_dia";
  fps_habitual: number | null;
  fototipo_fitzpatrick: number;
  historico_familiar_cancer_pele: boolean;
  quem_historico_familiar: string;
  melanoma_familiar: boolean;
  outras_doencas_familia: string[];
}

export interface PreConsultaSaude {
  alergias: boolean;
  tipos_alergia: string[];
  descricao_alergia: string;
  medicamentos_uso_continuo: boolean;
  lista_medicamentos: string;
  comorbidades: string[];
  tabagismo: "nunca" | "ex_fumante" | "fumante";
  etilismo: "nunca" | "social" | "frequente";
  atividade_fisica: "nenhuma" | "leve" | "moderada" | "intensa";
  gestante: boolean | null;
  amamentando: boolean | null;
  uso_anticoncepcional: boolean | null;
}

export interface PreConsultaEstetica {
  procedimentos_anteriores: string[];
  tempo_ultimo_procedimento: string;
  teve_complicacao: boolean;
  descricao_complicacao: string;
  usa_acidos: boolean;
  produtos_skincare: string;
  tratamento_em_andamento: boolean;
}

export interface PreConsultaSeguranca {
  historico_herpes_simples: boolean;
  tendencia_queloide: boolean;
  possui_marcapasso_ou_implante_metalico: boolean;
  quimica_capilar_recente: boolean;
  alergia_anestesico: boolean;
  usa_anticoagulante: boolean;
}

export interface PreConsultaConsentimento {
  aceite_informacoes_verdadeiras: boolean;
  autoriza_imagens_prontuario: boolean;
  autoriza_imagens_cientificas: boolean;
  aceite_lgpd: boolean;
  nome_assinatura: string;
}

export interface PreConsultaDermatologiaIn {
  queixa: PreConsultaQueixa;
  historico: PreConsultaHistorico;
  saude: PreConsultaSaude;
  estetica: PreConsultaEstetica;
  seguranca: PreConsultaSeguranca;
  consentimento: PreConsultaConsentimento;
}

export interface PreConsultaApi {
  id: string;
  paciente_id: string;
  especialidade: string;
  respostas: PreConsultaDermatologiaIn;
  alerta_critico: boolean;
  criado_em: string;
}

export async function enviarPreConsulta(
  pacienteId: string,
  dados: PreConsultaDermatologiaIn,
): Promise<PreConsultaApi> {
  const res = await pedir(`${API_URL}/pacientes/${pacienteId}/pre-consulta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  return res.json();
}

export async function listarPreConsultas(pacienteId: string): Promise<PreConsultaApi[]> {
  const res = await pedir(`${API_URL}/pacientes/${pacienteId}/pre-consulta`, { cache: "no-store" });
  return res.json();
}
