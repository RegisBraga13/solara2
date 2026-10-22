import type { Secao } from "@/lib/sugestoes";
import { formatarData } from "@/lib/datas";
import { ESPECIALIDADE } from "@/lib/especialidade";
import { dataBr, registroBruto } from "@/lib/historia";
import type { CondutaTratamentoData, ConsultaData } from "@/store/consulta";

type DadosProntuario = Pick<
  ConsultaData,
  "modo" | "historia" | "diagnostico" | "condutaTratamento" | "anotacoes" | "tipo"
> & { escalas?: Record<string, string> };

const lista = (itens: string[]) =>
  itens.length ? itens.map((i) => `- ${i}`).join("\n") : "(nenhum assinalado)";

const textoOu = (t: string, vazio: string) => (t.trim() ? t.trim() : vazio);

/** Rótulos das seções de orientações por especialidade (ainda usados pela configuração antiga). */
export const ROTULOS_SECAO: Record<Secao, string> = {
  tratamento: "Tratamento",
  investigacao: "Investigação",
  acompanhamento: "Acompanhamento",
  cuidados: ESPECIALIDADE.orientacoes.cuidados.rotulo,
  fotoprotecao: ESPECIALIDADE.orientacoes.fotoprotecao.rotulo,
  higiene: ESPECIALIDADE.orientacoes.higiene.rotulo,
};

/** Títulos de bloco do prontuário (o PDF usa para pôr em negrito e para separar as seções). */
export const TITULOS_PRONTUARIO = [
  "HISTÓRIA CLÍNICA",
  "MINI ANAMNESE",
  "LAUDOS NOVOS",
  "IMAGENS NOVAS",
  "DIAGNÓSTICO",
  "CONDUTA",
  "PROPEDÊUTICA",
  "TRATAMENTO",
  "ORIENTAÇÕES GERAIS",
  "ESCALAS APLICADAS",
  "ANOTAÇÕES DO MÉDICO",
];

/** Escalas da especialidade com escore preenchido, para o prontuário e para o painel de ANEXOS. */
export function escalasAplicadas(
  escalas: Record<string, string> | undefined,
): { id: string; nome: string; valor: string; max: number }[] {
  return ESPECIALIDADE.escalas
    .filter((e) => (escalas?.[e.id] ?? "").trim() !== "")
    .map((e) => ({ id: e.id, nome: e.nome, valor: escalas?.[e.id] ?? "", max: e.max }));
}

/** "ESCALAS APLICADAS" com os escores preenchidos (nada, se nenhuma foi aplicada). */
function linhasDeEscalas(escalas: Record<string, string> | undefined): string[] {
  const preenchidas = escalasAplicadas(escalas);
  if (preenchidas.length === 0) return [];
  return ["", "ESCALAS APLICADAS", ...preenchidas.map((e) => `- ${e.nome}: ${e.valor} (0-${e.max})`)];
}

/** Texto consolidado do prontuário, na ordem da consulta. */
export function montarProntuario(d: DadosProntuario): string {
  const modo = d.modo === "online" ? "ONLINE" : d.modo === "presencial" ? "PRESENCIAL" : "—";
  const anot = [
    d.anotacoes.diagnostico.trim() && `Diagnóstico:\n${d.anotacoes.diagnostico.trim()}`,
    d.anotacoes.propedeutica.trim() && `Conduta:\n${d.anotacoes.propedeutica.trim()}`,
  ].filter((x): x is string => Boolean(x));

  return [
    `CONSULTA ${modo}${d.tipo === "retorno" ? " - RETORNO" : ""}`,
    "",
    "HISTÓRIA CLÍNICA",
    d.historia.texto.trim() || "(não registrada)",
    "",
    "DIAGNÓSTICO",
    lista(d.diagnostico.selecionados),
    "",
    "CONDUTA",
    textoOu(d.condutaTratamento.conduta.texto, "(não registrada)"),
    "",
    "PROPEDÊUTICA",
    textoOu(d.condutaTratamento.investigacao.texto, "(não registrada)"),
    "",
    "TRATAMENTO",
    textoOu(d.condutaTratamento.tratamento.texto, "(não registrado)"),
    "",
    "ORIENTAÇÕES GERAIS",
    textoOu(d.condutaTratamento.orientacoes.texto, "(não registradas)"),
    ...linhasDeEscalas(d.escalas),
    ...(anot.length ? ["", "ANOTAÇÕES DO MÉDICO", ...anot] : []),
  ].join("\n");
}

/** Histórico do paciente num texto só (do mais antigo ao mais recente), para o PDF. */
export function textoDoHistorico(
  registros: { rotulo: string; criado_em: string; modo: string; texto: string }[],
): string {
  return registros
    .map((r) => `${r.rotulo.toUpperCase()} - ${formatarData(r.criado_em)}\n${r.texto}`)
    .join("\n\n");
}


// ----------------------------------------------------------------------------- evolução (retorno)

/** Linhas do bloco que começa no título `titulo` e vai até o próximo título (ou o fim). */
function blocoDoTexto(texto: string, titulos: string[]): string[] {
  const linhas = texto.split("\n");
  const inicio = linhas.findIndex((l) => titulos.includes(l.trim()));
  if (inicio < 0) return [];
  const fim = linhas.findIndex((l, i) => i > inicio && TITULOS_PRONTUARIO.includes(l.trim()));
  return linhas.slice(inicio + 1, fim < 0 ? undefined : fim);
}

/** Diagnósticos ("- item") do prontuário anterior; vazio se não houver nenhum assinalado. */
export function diagnosticosDoProntuario(texto: string): string[] {
  return blocoDoTexto(texto, ["DIAGNÓSTICO"])
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

/** Conduta, propedêutica, tratamento e orientações do prontuário anterior (texto de cada bloco). */
export function condutaDoProntuario(
  texto: string,
): Record<"conduta" | "investigacao" | "tratamento" | "orientacoes", string> {
  const bloco = (titulos: string[]) => blocoDoTexto(texto, titulos).join("\n").trim();
  return {
    conduta: bloco(["CONDUTA"]),
    investigacao: bloco(["PROPEDÊUTICA"]),
    tratamento: bloco(["TRATAMENTO"]),
    orientacoes: bloco(["ORIENTAÇÕES GERAIS"]),
  };
}

type DadosEvolucao = DadosProntuario &
  Pick<ConsultaData, "captura" | "exameFisico" | "transcricoes" | "imagens" | "evolucao"> & {
    laudos?: { nome: string }[];
  };

const PALAVRA: Record<"manter" | "ajustar" | "novo", [string, string]> = {
  manter: ["mantido", "mantida"],
  ajustar: ["ajustado", "ajustada"],
  novo: ["novo", "nova"],
};

/**
 * Texto da Evolução (retorno), na estrutura de dados do retorno: mini anamnese, laudos/imagens
 * novos, diagnóstico e conduta (mantido/ajustado/novo) e anotações. `anterior` é o texto da
 * consulta que originou o retorno (usado quando o médico mantém o diagnóstico ou a conduta).
 */
export function montarEvolucao(d: DadosEvolucao, anterior: string | null, laudosExtra: string[] = []): string {
  const laudos = [...(d.laudos ?? []).map((l) => l.nome), ...laudosExtra];
  const modo = d.modo === "online" ? "ONLINE" : d.modo === "presencial" ? "PRESENCIAL" : "—";
  const dx = d.evolucao.diagnostico;
  const cd = d.evolucao.conduta;
  const diagnosticos =
    dx === "manter" ? diagnosticosDoProntuario(anterior ?? "") : d.diagnostico.selecionados;
  const anteriorCt = condutaDoProntuario(anterior ?? "");
  const ct: CondutaTratamentoData = d.condutaTratamento;
  const conduta = cd === "manter" ? anteriorCt.conduta : ct.conduta.texto;
  const investigacao = cd === "manter" ? anteriorCt.investigacao : ct.investigacao.texto;
  const tratamento = cd === "manter" ? anteriorCt.tratamento : ct.tratamento.texto;
  const orientacoes = cd === "manter" ? anteriorCt.orientacoes : ct.orientacoes.texto;
  const imagens = [...d.imagens].map((i) => `- ${dataBr(i.data)} (${i.nome})`);
  const mini = registroBruto({
    captura: d.captura,
    exameFisico: d.exameFisico,
    transcricoes: d.transcricoes,
    imagens: [],
  });
  const nota = d.anotacoes.evolucao.trim();

  return [
    `CONSULTA ${modo} - RETORNO`,
    "",
    "MINI ANAMNESE",
    mini || "(não registrada)",
    ...(laudos.length ? ["", "LAUDOS NOVOS", ...laudos.map((l) => `- ${l}`)] : []),
    ...(imagens.length ? ["", "IMAGENS NOVAS", ...imagens] : []),
    "",
    "DIAGNÓSTICO",
    `Decisão: ${dx ? PALAVRA[dx][0] : "não informada"}`,
    lista(diagnosticos),
    "",
    "CONDUTA",
    `Decisão: ${cd ? PALAVRA[cd][1] : "não informada"}`,
    textoOu(conduta, cd === "manter" ? "(não encontrada na consulta anterior)" : "(não registrada)"),
    "",
    "PROPEDÊUTICA",
    textoOu(
      investigacao,
      cd === "manter" ? "(não encontrada na consulta anterior)" : "(não registrada)",
    ),
    "",
    "TRATAMENTO",
    textoOu(tratamento, cd === "manter" ? "(não encontrado na consulta anterior)" : "(não registrado)"),
    "",
    "ORIENTAÇÕES GERAIS",
    textoOu(orientacoes, cd === "manter" ? "(não encontradas na consulta anterior)" : "(não registradas)"),
    ...(nota ? ["", "ANOTAÇÕES DO MÉDICO", nota] : []),
  ].join("\n");
}
