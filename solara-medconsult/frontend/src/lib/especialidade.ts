/**
 * Especialidade ativa do app: só o CONTEÚDO que muda (títulos, rótulos, Whitebook, escalas).
 * Identidade visual e fluxo são comuns. Escolha: variável NEXT_PUBLIC_ESPECIALIDADE no build
 * (precisa ser a mesma ESPECIALIDADE do servidor). Padrão: dermatologia.
 *
 * As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais em todas; só o
 * significado e o título mudam aqui. O conteúdo do servidor está em backend/app/especialidades/.
 */

/** Nome-mãe do produto (só o nome visual; o repositório continua medconsult). */
export const NOME_MAE = "espec·IA·lidades";

export type SlugEspecialidade =
  | "dermatologia"
  | "psiquiatria"
  | "reumatologia"
  | "endocrinologia"
  | "neurologia" | "gastroenterologia" | "pneumologia" | "cardiologia" | "infectologia" | "nefrologia" | "geriatria" | "cirurgia";

export interface EscalaClinica {
  id: string;
  nome: string;
  descricao: string;
  max: number;
  /** Casas decimais aceitas no escore (padrão 0 = só inteiros). Ex.: DAS28 = 2, HAQ = 3. */
  casas?: number;
}

export interface ConfigEspecialidade {
  slug: SlugEspecialidade;
  nome: string;
  /** Nome visual do módulo; o "IA" final é destacado (ex.: dermatologIA). */
  nomeVisual: string;
  whitebookUrl: string;
  /** Títulos das telas de orientações (com emoji) e rótulos no prontuário (sem emoji). */
  orientacoes: Record<"cuidados" | "fotoprotecao" | "higiene", { titulo: string; rotulo: string }>;
  /** Escalas aplicáveis na propedêutica (vazio = não mostra o bloco). */
  escalas: EscalaClinica[];
}

export const ESPECIALIDADES: Record<SlugEspecialidade, ConfigEspecialidade> = {
  dermatologia: {
    slug: "dermatologia",
    nome: "Dermatologia",
    nomeVisual: "dermatologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🧴 CUIDADOS COM A PELE", rotulo: "Cuidados com a pele" },
      fotoprotecao: { titulo: "☀️ FOTOPROTEÇÃO", rotulo: "Fotoproteção" },
      higiene: { titulo: "🏠 HIGIENE E AMBIENTE", rotulo: "Higiene e ambiente" },
    },
    escalas: [],
  },
  psiquiatria: {
    slug: "psiquiatria",
    nome: "Psiquiatria",
    nomeVisual: "psiquiatrIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/psiquiatria",
    orientacoes: {
      cuidados: { titulo: "😴 HIGIENE DO SONO", rotulo: "Higiene do sono" },
      fotoprotecao: { titulo: "💊 ADESÃO MEDICAMENTOSA", rotulo: "Adesão medicamentosa" },
      higiene: { titulo: "🤝 REDE DE APOIO E SUPORTE SOCIAL", rotulo: "Rede de apoio e suporte social" },
    },
    escalas: [
      { id: "phq9", nome: "PHQ-9", descricao: "Sintomas depressivos", max: 27 },
      { id: "gad7", nome: "GAD-7", descricao: "Sintomas de ansiedade", max: 21 },
      { id: "ymrs", nome: "YMRS", descricao: "Sintomas maníacos", max: 60 },
      { id: "panss", nome: "PANSS", descricao: "Sintomas psicóticos", max: 210 },
    ],
  },
  reumatologia: {
    slug: "reumatologia",
    nome: "Reumatologia",
    nomeVisual: "reumatologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: {
        titulo: "🦴 CUIDADOS COM AS ARTICULAÇÕES",
        rotulo: "Cuidados com as articulações",
      },
      fotoprotecao: {
        titulo: "💊 ADESÃO MEDICAMENTOSA",
        rotulo: "Adesão medicamentosa",
      },
      higiene: {
        titulo: "⚠️ SINAIS DE ALERTA E SEGUIMENTO",
        rotulo: "Sinais de alerta e seguimento",
      },
    },
    escalas: [
      { id: "das28", nome: "DAS28", descricao: "Atividade da artrite reumatoide", max: 9.4, casas: 2 },
      { id: "cdai", nome: "CDAI", descricao: "Atividade da artrite reumatoide", max: 76 },
      { id: "basdai", nome: "BASDAI", descricao: "Atividade da espondilite anquilosante", max: 10, casas: 1 },
      { id: "haq", nome: "HAQ", descricao: "Incapacidade funcional", max: 3, casas: 3 },
    ],
  },
  endocrinologia: {
    slug: "endocrinologia",
    nome: "Endocrinologia",
    nomeVisual: "endocrinologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🥗 CUIDADOS METABÓLICOS", rotulo: "Cuidados metabólicos" },
      fotoprotecao: { titulo: "💊 TRATAMENTO E MONITORIZAÇÃO", rotulo: "Tratamento e monitorização" },
      higiene: { titulo: "⚠️ DESCOMPENSAÇÃO E SEGUIMENTO", rotulo: "Descompensação e seguimento" },
    },
    escalas: [],
  },
  neurologia: {
    slug: "neurologia",
    nome: "Neurologia",
    nomeVisual: "neurologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🩺 CUIDADOS NO DIA A DIA", rotulo: "Cuidados no dia a dia" },
      fotoprotecao: { titulo: "💊 ADESÃO AO TRATAMENTO", rotulo: "Adesão ao tratamento" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA E SEGUIMENTO", rotulo: "Sinais de alerta e seguimento" },
    },
    escalas: [
      { id: "nihss", nome: "NIHSS", descricao: "Gravidade do AVC", max: 42 },
      { id: "glasgow", nome: "Glasgow", descricao: "Nível de consciência", max: 15 },
      { id: "moca", nome: "MoCA", descricao: "Avaliação cognitiva", max: 30 },
      { id: "meem", nome: "MEEM", descricao: "Mini exame do estado mental", max: 30 },
      { id: "edss", nome: "EDSS", descricao: "Incapacidade na esclerose múltipla", max: 10, casas: 1 },
    ],
  },
  gastroenterologia: {
    slug: "gastroenterologia",
    nome: "Gastroenterologia",
    nomeVisual: "gastroenterologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🥗 CUIDADOS DIGESTIVOS", rotulo: "Cuidados digestivos" },
      fotoprotecao: { titulo: "💊 ADESÃO AO TRATAMENTO", rotulo: "Adesão ao tratamento" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA E SEGUIMENTO", rotulo: "Sinais de alerta e seguimento" },
    },
    escalas: [],
  },
  pneumologia: {
    slug: "pneumologia",
    nome: "Pneumologia",
    nomeVisual: "pneumologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🫁 CUIDADOS RESPIRATÓRIOS", rotulo: "Cuidados respiratórios" },
      fotoprotecao: { titulo: "💨 TRATAMENTO INALATÓRIO", rotulo: "Tratamento inalatório" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA RESPIRATÓRIOS", rotulo: "Sinais de alerta respiratórios" },
    },
    escalas: [],
  },
  cardiologia: {
    slug: "cardiologia",
    nome: "Cardiologia",
    nomeVisual: "cardiologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🫀 CUIDADOS CARDIOVASCULARES", rotulo: "Cuidados cardiovasculares" },
      fotoprotecao: { titulo: "💊 ADESÃO AO TRATAMENTO", rotulo: "Adesão ao tratamento" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA E SEGUIMENTO", rotulo: "Sinais de alerta e seguimento" },
    },
    escalas: [],
  },
  infectologia: {
    slug: "infectologia",
    nome: "Infectologia",
    nomeVisual: "infectologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🧼 PREVENÇÃO DE INFECÇÕES", rotulo: "Prevenção de infecções" },
      fotoprotecao: { titulo: "💊 ADESÃO AO TRATAMENTO", rotulo: "Adesão ao tratamento" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA INFECCIOSOS", rotulo: "Sinais de alerta infecciosos" },
    },
    escalas: [],
  },
  nefrologia: {
    slug: "nefrologia",
    nome: "Nefrologia",
    nomeVisual: "nefrologIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "💧 CUIDADOS RENAIS", rotulo: "Cuidados renais" },
      fotoprotecao: { titulo: "💊 ADESÃO AO TRATAMENTO", rotulo: "Adesão ao tratamento" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA E SEGUIMENTO", rotulo: "Sinais de alerta e seguimento" },
    },
    escalas: [],
  },
  geriatria: {
    slug: "geriatria",
    nome: "Geriatria",
    nomeVisual: "geriatrIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🧓 FUNCIONALIDADE E SEGURANÇA", rotulo: "Funcionalidade e segurança" },
      fotoprotecao: { titulo: "💊 SEGURANÇA MEDICAMENTOSA", rotulo: "Segurança medicamentosa" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA", rotulo: "Sinais de alerta" },
    },
    escalas: [],
  },
  cirurgia: {
    slug: "cirurgia",
    nome: "Cirurgia",
    nomeVisual: "cirurgIA",
    whitebookUrl: "https://whitebook.pebmed.com.br/home/",
    orientacoes: {
      cuidados: { titulo: "🩹 CUIDADOS COM A FERIDA OPERATÓRIA", rotulo: "Cuidados com a ferida operatória" },
      fotoprotecao: { titulo: "💊 MEDICAÇÃO E RECUPERAÇÃO", rotulo: "Medicação e recuperação" },
      higiene: { titulo: "⚠️ SINAIS DE ALERTA PÓS-OPERATÓRIOS", rotulo: "Sinais de alerta pós-operatórios" },
    },
    escalas: [],
  },
};

const pedida = process.env.NEXT_PUBLIC_ESPECIALIDADE as SlugEspecialidade | undefined;

/** Especialidade ativa (desconhecida cai em dermatologia, que é o padrão). */
export const ESPECIALIDADE: ConfigEspecialidade =
  (pedida && ESPECIALIDADES[pedida]) || ESPECIALIDADES.dermatologia;
