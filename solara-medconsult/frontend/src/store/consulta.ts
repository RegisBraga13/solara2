import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { TOTAL_ETAPAS } from "@/lib/rotas";
import {
  SECOES_ORIENTACOES,
  SECOES_PROPEDEUTICA,
  normalizar,
  type ItemSecao,
  type SecaoOrientacao,
  type SecaoPropedeutica,
} from "@/lib/sugestoes";
import type { Tema } from "@/lib/tema";
import { novoUuid } from "@/lib/uuid";
import type { Papel } from "@/lib/websocket";

export const STORAGE_KEY = "medconsult-state";

/** Trecho final de fala (as parciais ficam só na tela). */
export interface TranscricaoItem {
  text: string;
  speaker: Papel;
  speaker_id: number | null;
  is_final: boolean;
  timestamp_ms: number | null;
}

/** Imagem já enviada ao servidor. `url` é assinada e expira: a tela da captura a renova. */
export interface ImagemEnviada {
  id: string;
  /** Nome em `captura.imagens` (usado pelo prontuário). */
  nome: string;
  url: string;
  /** AAAA-MM-DD ou null. */
  data: string | null;
  descricao: string | null;
}

/** Laudo anexado à consulta (PDF ou foto). O arquivo fica no servidor; a IA não lê. */
export interface LaudoEnviado {
  id: string;
  nome: string;
}

/** Texto gerado por IA (ou escrito do zero) que o médico pode editar livremente. */
export interface TextoEditavel {
  texto: string;
  editado: boolean;
}

export type CampoCondutaTratamento = "conduta" | "investigacao" | "tratamento" | "orientacoes";

/** Conduta/Tratamento/Orientações (tela 6): texto corrido por campo, não mais chips. */
export type CondutaTratamentoData = Record<CampoCondutaTratamento, TextoEditavel>;

export type Modo = "online" | "presencial";
/** Onde um item livre entra: diagnóstico ou uma seção da propedêutica / das orientações. */
export type ListaExtra = "diagnostico" | SecaoPropedeutica | SecaoOrientacao;
/** Telas que têm campo de anotações (trechos que o médico cola do Whitebook). */
export type TelaAnotacao = "diagnostico" | "propedeutica" | "evolucao";

/** No retorno, o médico decide o que fazer com o diagnóstico e a conduta da consulta anterior. */
export type Decisao = "manter" | "ajustar" | "novo";
export interface Evolucao {
  diagnostico: Decisao | null;
  conduta: Decisao | null;
}

/** Sugestões do servidor, guardadas com a chave do que foi pedido (para não refazer sem necessidade). */
export interface SugestoesSalvas {
  diagnostico: {
    chave: string;
    itens: string[];
    probabilidades?: number[];
    /** Código CID-11 de cada item, na mesma ordem. */
    cid11?: string[];
  } | null;
  // Mantidos por compatibilidade com rascunhos antigos (telas de Propedêutica/Orientações em
  // chips, substituídas por `condutaTratamento`). Não são mais escritos por nenhuma tela.
  propedeutica: { chave: string; itens: ItemSecao<SecaoPropedeutica>[] } | null;
  orientacoes: { chave: string; itens: ItemSecao<SecaoOrientacao>[] } | null;
}

export type TipoConsulta = "nova" | "retorno";

export interface ConsultaData {
  paciente: string;
  /** Paciente cadastrado a que a consulta pertence (null = consulta avulsa). */
  pacienteId: string | null;
  /** "retorno" = volta de um paciente, ligada à consulta anterior. */
  tipo: TipoConsulta;
  /** Prontuário da consulta anterior (só no retorno). O conteúdo é buscado no servidor quando preciso. */
  retornoDe: string | null;
  /** Instante (ms) em que a consulta começou; `null` = nenhuma consulta em andamento. */
  iniciada_em: number | null;
  /** Identifica a consulta no servidor (áudio e imagens). Criado junto com a consulta. */
  sessionId: string | null;
  transcricoes: TranscricaoItem[];
  imagens: ImagemEnviada[];
  laudos: LaudoEnviado[];
  modo: Modo | null;
  anamnese: { voz: boolean; texto: boolean };
  /** `texto` é um acréscimo à especificação: guarda o que foi digitado na captura. */
  captura: { audio_duracao: number; imagens: string[]; texto: string };
  /** Achados do exame físico e complementos, digitados à parte da anamnese. */
  exameFisico: { texto: string };
  historia: { texto: string; editado: boolean };
  diagnostico: { selecionados: string[] };
  // Mantidos por compatibilidade com rascunhos antigos; não são mais usados por nenhuma tela.
  propedeutica: { selecionados: string[] };
  orientacoes: { selecionados: string[] };
  /** Conduta, tratamento e orientações (tela 6): texto corrido, gerado por IA e editável. */
  condutaTratamento: CondutaTratamentoData;
  /** Itens livres acrescentados pelo médico (ficam como chips mesmo se desmarcados). */
  extras: {
    diagnostico: string[];
    propedeutica: Record<SecaoPropedeutica, string[]>;
    orientacoes: Record<SecaoOrientacao, string[]>;
  };
  /** Anotações do médico (ex.: trechos colados do Whitebook). Ficam só no aparelho e vão ao prontuário. */
  anotacoes: Record<TelaAnotacao, string>;
  /** Só no retorno (tela de Evolução). */
  evolucao: Evolucao;
  /** Escores das escalas aplicadas (id da escala -> valor), conforme a especialidade. */
  escalas: Record<string, string>;
  sugestoes: SugestoesSalvas;
  etapa_atual: number;
  theme: Tema;
}

export interface ConsultaActions {
  setPaciente: (nome: string) => void;
  /** Define para quem e de que tipo é a consulta que vai começar. */
  setContexto: (c: { pacienteId: string | null; paciente: string; tipo: TipoConsulta; retornoDe: string | null }) => void;
  /** Marca o início da consulta (só se ainda não houver um). */
  iniciarConsulta: () => void;
  addTranscricao: (t: TranscricaoItem) => void;
  /** Troca médico <-> paciente nos trechos já gravados (quando a ordem de fala enganou). */
  trocarPapeis: () => void;
  addImagemEnviada: (img: ImagemEnviada) => void;
  removeImagemEnviada: (id: string) => void;
  addLaudo: (laudo: LaudoEnviado) => void;
  removeLaudo: (id: string) => void;
  /** Atualiza as imagens com a lista do servidor (ordem cronológica, URLs novas). */
  substituirImagensEnviadas: (lista: ImagemEnviada[]) => void;
  setModo: (modo: Modo) => void;
  setAnamnese: (anamnese: { voz: boolean; texto: boolean }) => void;
  setAudioDuracao: (segundos: number) => void;
  setCapturaTexto: (texto: string) => void;
  setExameFisicoTexto: (texto: string) => void;
  /** Devolve o nome realmente gravado (acrescenta "(2)" se já existir). */
  addImagem: (nome: string) => string;
  removeImagem: (nome: string) => void;
  setHistoria: (texto: string, editado: boolean) => void;
  setCondutaTratamento: (campo: CampoCondutaTratamento, texto: string, editado: boolean) => void;
  toggleDiagnostico: (termo: string) => void;
  togglePropedeutica: (item: string) => void;
  toggleOrientacao: (item: string) => void;
  setAnotacao: (tela: TelaAnotacao, texto: string) => void;
  setDecisao: (campo: keyof Evolucao, decisao: Decisao) => void;
  /** Guarda o escore (só números, limitado ao máximo da escala; vazio apaga). */
  setEscala: (id: string, valor: string, max: number, casas?: number) => void;
  /** Guarda as sugestões recebidas e tira da seleção o que não existe mais. */
  setSugestoesDiagnostico: (
    chave: string,
    itens: string[],
    probabilidades?: number[],
    cid11?: string[],
  ) => void;
  setSugestoesPropedeutica: (chave: string, itens: ItemSecao<SecaoPropedeutica>[]) => void;
  setSugestoesOrientacoes: (chave: string, itens: ItemSecao<SecaoOrientacao>[]) => void;
  /** Acrescenta e já seleciona um item livre. Devolve false se vazio ou duplicado. */
  addExtra: (lista: ListaExtra, termo: string) => boolean;
  setEtapa: (etapa: number) => void;
  setTheme: (tema: Tema) => void;
  toggleTheme: () => void;
  /** Apaga o rascunho da consulta. Mantém a preferência de tema. */
  reset: () => void;
}

export type ConsultaState = ConsultaData & ConsultaActions;

const vazias = <S extends string>(defs: { chave: S }[]) =>
  Object.fromEntries(defs.map(({ chave }) => [chave, [] as string[]])) as Record<S, string[]>;

export const dadosIniciais = (theme: Tema = "dia"): ConsultaData => ({
  paciente: "",
  pacienteId: null,
  tipo: "nova",
  retornoDe: null,
  iniciada_em: null,
  sessionId: null,
  transcricoes: [],
  imagens: [],
  laudos: [],
  modo: null,
  anamnese: { voz: false, texto: false },
  captura: { audio_duracao: 0, imagens: [], texto: "" },
  exameFisico: { texto: "" },
  historia: { texto: "", editado: false },
  diagnostico: { selecionados: [] },
  propedeutica: { selecionados: [] },
  orientacoes: { selecionados: [] },
  condutaTratamento: {
    conduta: { texto: "", editado: false },
    investigacao: { texto: "", editado: false },
    tratamento: { texto: "", editado: false },
    orientacoes: { texto: "", editado: false },
  },
  extras: {
    diagnostico: [],
    propedeutica: vazias(SECOES_PROPEDEUTICA),
    orientacoes: vazias(SECOES_ORIENTACOES),
  },
  anotacoes: { diagnostico: "", propedeutica: "", evolucao: "" },
  evolucao: { diagnostico: null, conduta: null },
  escalas: {},
  sugestoes: { diagnostico: null, propedeutica: null, orientacoes: null },
  etapa_atual: 1,
  theme,
});

const mesmo = (a: string, b: string) => normalizar(a) === normalizar(b);
/** Acrescenta o termo à lista se ainda não estiver (sem repetir). */
const guardar = (lista: string[], termo: string) =>
  lista.some((e) => mesmo(e, termo)) ? lista : [...lista, termo];

const alternar = (lista: string[], item: string) =>
  lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];

const ehSecaoPropedeutica = (l: ListaExtra): l is SecaoPropedeutica =>
  SECOES_PROPEDEUTICA.some(({ chave }) => chave === l);

// O rótulo precisa ser único entre as seções de uma mesma tela (a seleção é uma lista só).
function termosDaLista(lista: ListaExtra, s: ConsultaData): string[] {
  if (lista === "diagnostico") return [...(s.sugestoes.diagnostico?.itens ?? []), ...s.extras.diagnostico];
  if (ehSecaoPropedeutica(lista)) {
    return [
      ...(s.sugestoes.propedeutica?.itens.map((i) => i.termo) ?? []),
      ...Object.values(s.extras.propedeutica).flat(),
    ];
  }
  return [
    ...(s.sugestoes.orientacoes?.itens.map((i) => i.termo) ?? []),
    ...Object.values(s.extras.orientacoes).flat(),
  ];
}

/** Mantém na seleção só o que ainda existe (sugestão nova ou item livre). */
/**
 * Escore digitado -> texto guardado. Só dígitos e, se a escala tem casas decimais, uma vírgula (aceita
 * ponto); limitado ao máximo e às casas da escala. Vazio apaga. Ex.: ("3,456", 9.4, 2) -> "3,45".
 */
export function normalizarEscore(valor: string, max: number, casas = 0): string {
  const bruto = valor.replace(",", ".");
  const temSeparador = casas > 0 && bruto.includes(".");
  const [i = "", d = ""] = bruto.split(".");
  const inteira = i.replace(/\D/g, "");
  const decimal = d.replace(/\D/g, "").slice(0, casas);
  if (inteira === "" && decimal === "") return "";
  const numero = Number(`${inteira || "0"}.${decimal || "0"}`);
  if (numero > max) return String(max).replace(".", ",");
  const parteInteira = String(Number(inteira || "0"));
  return temSeparador ? `${parteInteira},${decimal}` : parteInteira;
}

const podar = (selecionados: string[], existentes: string[]) => {
  const vivos = new Set(existentes.map(normalizar));
  return selecionados.filter((t) => vivos.has(normalizar(t)));
};

/** Só a parte persistida (sem funções). */
const dadosDe = (s: ConsultaState): ConsultaData => ({
  paciente: s.paciente,
  pacienteId: s.pacienteId,
  tipo: s.tipo,
  retornoDe: s.retornoDe,
  iniciada_em: s.iniciada_em,
  sessionId: s.sessionId,
  transcricoes: s.transcricoes,
  imagens: s.imagens,
  laudos: s.laudos,
  modo: s.modo,
  anamnese: s.anamnese,
  captura: s.captura,
  exameFisico: s.exameFisico,
  historia: s.historia,
  diagnostico: s.diagnostico,
  propedeutica: s.propedeutica,
  orientacoes: s.orientacoes,
  condutaTratamento: s.condutaTratamento,
  extras: s.extras,
  anotacoes: s.anotacoes,
  evolucao: s.evolucao,
  escalas: s.escalas,
  // As sugestões geradas NÃO são salvas: só ficam na memória, enquanto a página está aberta.
  sugestoes: dadosIniciais().sugestoes,
  etapa_atual: s.etapa_atual,
  theme: s.theme,
});

/**
 * v4: as sugestões deixaram de ser salvas. No rascunho v3, o que o médico marcou e só existia na
 * lista sugerida passa para os itens do médico (com a seção), e a lista sugerida é descartada.
 */
function migrarV3(d: ConsultaData): ConsultaData {
  const base = dadosIniciais(d.theme);
  const extras = {
    diagnostico: [...(d.extras?.diagnostico ?? base.extras.diagnostico)],
    propedeutica: { ...base.extras.propedeutica, ...(d.extras?.propedeutica ?? {}) },
    orientacoes: { ...base.extras.orientacoes, ...(d.extras?.orientacoes ?? {}) },
  };
  const sel = (l?: { selecionados: string[] }) => l?.selecionados ?? [];
  for (const termo of sel(d.diagnostico)) extras.diagnostico = guardar(extras.diagnostico, termo);
  for (const i of d.sugestoes?.propedeutica?.itens ?? []) {
    if (sel(d.propedeutica).some((s) => mesmo(s, i.termo))) {
      extras.propedeutica[i.secao] = guardar(extras.propedeutica[i.secao] ?? [], i.termo);
    }
  }
  for (const i of d.sugestoes?.orientacoes?.itens ?? []) {
    if (sel(d.orientacoes).some((s) => mesmo(s, i.termo))) {
      extras.orientacoes[i.secao] = guardar(extras.orientacoes[i.secao] ?? [], i.termo);
    }
  }
  return { ...base, ...d, extras, sugestoes: base.sugestoes };
}

/**
 * v3: tratamento + condutas viraram propedêutica + orientações. Rascunhos antigos mantêm o que
 * ainda existe (captura, história, diagnóstico); as listas novas começam vazias.
 */
export function migrarRascunho(antigo: unknown, versao = 0): ConsultaData {
  if (versao === 3) return migrarV3(antigo as ConsultaData);
  const a = (antigo ?? {}) as Partial<ConsultaData> & {
    sugestoes?: { diagnostico?: SugestoesSalvas["diagnostico"] };
    extras?: { diagnostico?: string[] };
  };
  const base = dadosIniciais(a.theme);
  return {
    ...base,
    paciente: a.paciente ?? base.paciente,
    iniciada_em: a.iniciada_em ?? null,
    sessionId: a.sessionId ?? null,
    transcricoes: a.transcricoes ?? [],
    imagens: a.imagens ?? [],
    modo: a.modo ?? null,
    anamnese: a.anamnese ?? base.anamnese,
    captura: a.captura ?? base.captura,
    historia: a.historia ?? base.historia,
    diagnostico: a.diagnostico ?? base.diagnostico,
    extras: { ...base.extras, diagnostico: a.extras?.diagnostico ?? [] },
    sugestoes: { ...base.sugestoes, diagnostico: a.sugestoes?.diagnostico ?? null },
    etapa_atual: Math.min(Math.max(a.etapa_atual ?? 1, 1), TOTAL_ETAPAS),
  };
}

/** No servidor (SSR/build) não há localStorage: usa um armazenamento vazio para o middleware existir. */
const semArmazenamento: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useConsulta = create<ConsultaState>()(
  persist(
    (set, get) => ({
      ...dadosIniciais(),

      setPaciente: (paciente) => set({ paciente }),
      setContexto: (c) => set(c),
      iniciarConsulta: () => {
        const s = get();
        if (s.iniciada_em === null) set({ iniciada_em: Date.now() });
        if (s.sessionId === null) set({ sessionId: novoUuid() });
      },
      addTranscricao: (t) => set({ transcricoes: [...get().transcricoes, t] }),
      trocarPapeis: () =>
        set({
          transcricoes: get().transcricoes.map((t) =>
            t.speaker === "medico"
              ? { ...t, speaker: "paciente" as const }
              : t.speaker === "paciente"
                ? { ...t, speaker: "medico" as const }
                : t,
          ),
        }),
      addImagemEnviada: (img) => set({ imagens: [...get().imagens, img] }),
      removeImagemEnviada: (id) => set({ imagens: get().imagens.filter((i) => i.id !== id) }),
      addLaudo: (laudo) => set({ laudos: [...get().laudos, laudo] }),
      removeLaudo: (id) => set({ laudos: get().laudos.filter((l) => l.id !== id) }),
      substituirImagensEnviadas: (lista) => set({ imagens: lista }),
      setModo: (modo) => set({ modo }),
      setAnamnese: (anamnese) => set({ anamnese: { ...anamnese } }),
      setAudioDuracao: (segundos) =>
        set({ captura: { ...get().captura, audio_duracao: Math.max(0, Math.floor(segundos)) } }),
      setCapturaTexto: (texto) => set({ captura: { ...get().captura, texto } }),
      setExameFisicoTexto: (texto) => set({ exameFisico: { texto } }),

      addImagem: (nome) => {
        const { captura } = get();
        let final = nome;
        let n = 2;
        while (captura.imagens.includes(final)) {
          final = `${nome} (${n})`;
          n += 1;
        }
        set({ captura: { ...captura, imagens: [...captura.imagens, final] } });
        return final;
      },
      removeImagem: (nome) => {
        const { captura } = get();
        set({ captura: { ...captura, imagens: captura.imagens.filter((i) => i !== nome) } });
      },

      setHistoria: (texto, editado) => set({ historia: { texto, editado } }),
      setCondutaTratamento: (campo, texto, editado) =>
        set({
          condutaTratamento: { ...get().condutaTratamento, [campo]: { texto, editado } },
        }),

      // Ao marcar uma sugestão, ela vira item do médico (extras): a escolha é guardada, a lista
      // sugerida não (veja `dadosDe`).
      toggleDiagnostico: (termo) => {
        const s = get();
        set({
          diagnostico: { selecionados: alternar(s.diagnostico.selecionados, termo) },
          extras: { ...s.extras, diagnostico: guardar(s.extras.diagnostico, termo) },
        });
      },
      togglePropedeutica: (item) => {
        const s = get();
        const secao = s.sugestoes.propedeutica?.itens.find((i) => mesmo(i.termo, item))?.secao;
        const ja = Object.values(s.extras.propedeutica).flat().some((e) => mesmo(e, item));
        set({
          propedeutica: { selecionados: alternar(s.propedeutica.selecionados, item) },
          extras:
            secao && !ja
              ? {
                  ...s.extras,
                  propedeutica: {
                    ...s.extras.propedeutica,
                    [secao]: [...s.extras.propedeutica[secao], item],
                  },
                }
              : s.extras,
        });
      },
      toggleOrientacao: (item) => {
        const s = get();
        const secao = s.sugestoes.orientacoes?.itens.find((i) => mesmo(i.termo, item))?.secao;
        const ja = Object.values(s.extras.orientacoes).flat().some((e) => mesmo(e, item));
        set({
          orientacoes: { selecionados: alternar(s.orientacoes.selecionados, item) },
          extras:
            secao && !ja
              ? {
                  ...s.extras,
                  orientacoes: {
                    ...s.extras.orientacoes,
                    [secao]: [...(s.extras.orientacoes[secao] ?? []), item],
                  },
                }
              : s.extras,
        });
      },
      setAnotacao: (tela, texto) => set({ anotacoes: { ...get().anotacoes, [tela]: texto } }),
      setDecisao: (campo, decisao) => set({ evolucao: { ...get().evolucao, [campo]: decisao } }),
      setEscala: (id, valor, max, casas = 0) => {
        const n = normalizarEscore(valor, max, casas);
        const proximo = { ...get().escalas };
        if (n === "") delete proximo[id];
        else proximo[id] = n;
        set({ escalas: proximo });
      },

      setSugestoesDiagnostico: (chave, itens, probabilidades, cid11) => {
        const s = get();
        set({
          sugestoes: { ...s.sugestoes, diagnostico: { chave, itens, probabilidades, cid11 } },
          diagnostico: { selecionados: podar(s.diagnostico.selecionados, [...itens, ...s.extras.diagnostico]) },
        });
      },
      setSugestoesPropedeutica: (chave, itens) => {
        const s = get();
        set({
          sugestoes: { ...s.sugestoes, propedeutica: { chave, itens } },
          propedeutica: {
            selecionados: podar(s.propedeutica.selecionados, [
              ...itens.map((i) => i.termo),
              ...Object.values(s.extras.propedeutica).flat(),
            ]),
          },
        });
      },
      setSugestoesOrientacoes: (chave, itens) => {
        const s = get();
        set({
          sugestoes: { ...s.sugestoes, orientacoes: { chave, itens } },
          orientacoes: {
            selecionados: podar(s.orientacoes.selecionados, [
              ...itens.map((i) => i.termo),
              ...Object.values(s.extras.orientacoes).flat(),
            ]),
          },
        });
      },

      addExtra: (lista, termo) => {
        const limpo = termo.trim().replace(/\s+/g, " ");
        if (!limpo) return false;
        const s = get();
        if (termosDaLista(lista, s).some((t) => normalizar(t) === normalizar(limpo))) {
          return false;
        }
        if (lista === "diagnostico") {
          set({
            extras: { ...s.extras, diagnostico: [...s.extras.diagnostico, limpo] },
            diagnostico: { selecionados: [...s.diagnostico.selecionados, limpo] },
          });
        } else if (ehSecaoPropedeutica(lista)) {
          set({
            extras: {
              ...s.extras,
              propedeutica: {
                ...s.extras.propedeutica,
                [lista]: [...s.extras.propedeutica[lista], limpo],
              },
            },
            propedeutica: { selecionados: [...s.propedeutica.selecionados, limpo] },
          });
        } else {
          set({
            extras: {
              ...s.extras,
              orientacoes: {
                ...s.extras.orientacoes,
                [lista]: [...s.extras.orientacoes[lista], limpo],
              },
            },
            orientacoes: { selecionados: [...s.orientacoes.selecionados, limpo] },
          });
        }
        return true;
      },

      setEtapa: (etapa) =>
        set({ etapa_atual: Math.min(Math.max(Math.trunc(etapa), 1), TOTAL_ETAPAS) }),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dia" ? "noite" : "dia" }),

      reset: () => set({ ...dadosIniciais(get().theme) }),
    }),
    {
      name: STORAGE_KEY,
      version: 4,
      migrate: (antigo, versao) => migrarRascunho(antigo, versao) as ConsultaState,
      // Rascunho salvo nunca traz sugestões (as de versões antigas são descartadas).
      merge: (salvo, atual) => {
        const s = (salvo ?? {}) as Partial<ConsultaState>;
        return {
          ...atual,
          ...s,
          // campos novos que um rascunho antigo não tem
          anotacoes: { ...atual.anotacoes, ...(s.anotacoes ?? {}) },
          evolucao: { ...atual.evolucao, ...(s.evolucao ?? {}) },
          escalas: { ...(s.escalas ?? {}) },
          // idem: um rascunho de antes de um campo novo (ex.: investigacao) não deve apagá-lo
          condutaTratamento: { ...atual.condutaTratamento, ...(s.condutaTratamento ?? {}) },
          sugestoes: atual.sugestoes,
        };
      },
      storage: createJSONStorage(() => (typeof window === "undefined" ? semArmazenamento : window.localStorage)),
      // A reidratação é feita no cliente pelo hook usePersist (evita erro de hidratação do SSR).
      skipHydration: true,
      partialize: dadosDe,
    },
  ),
);
