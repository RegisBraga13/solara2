import { ESPECIALIDADE } from "@/lib/especialidade";
// Tipos e utilitários das sugestões (diagnóstico, propedêutica e orientações) vindas do servidor.

/**
 * Fontes consultadas a cada pedido (uso interno; nunca aparecem na tela): conhecimento do modelo
 * (AI), livros do acervo (RAG), diretrizes da pasta (Diretrizes) e busca na web (Web).
 */
export type Fonte = "AI" | "RAG" | "Diretrizes" | "Web";
export const FONTES: Fonte[] = ["AI", "RAG", "Diretrizes", "Web"];
/** O diagnóstico não usa a pasta de Diretrizes. */
export const FONTES_DIAGNOSTICO: Fonte[] = ["AI", "RAG", "Web"];

export interface ItemSugerido {
  termo: string;
  /** Estimativa da IA em % (só no diagnóstico). Não é probabilidade calibrada. */
  percentual?: number;
}

/** Quantos diagnósticos escolhidos geram sugestões (cada um é um pedido ao servidor). */
export const MAX_DIAGNOSTICOS = 3;

export type SecaoPropedeutica = "tratamento" | "investigacao" | "acompanhamento";
export type SecaoOrientacao = "cuidados" | "fotoprotecao" | "higiene";
export type Secao = SecaoPropedeutica | SecaoOrientacao;

export interface ItemSecao<S extends Secao = Secao> extends ItemSugerido {
  secao: S;
}

export interface DefSecao<S extends Secao> {
  chave: S;
  titulo: string;
}

export const SECOES_PROPEDEUTICA: DefSecao<SecaoPropedeutica>[] = [
  { chave: "tratamento", titulo: "💊 TRATAMENTO" },
  { chave: "investigacao", titulo: "🔬 INVESTIGAÇÃO" },
  { chave: "acompanhamento", titulo: "📋 ACOMPANHAMENTO" },
];

/** Títulos vêm da especialidade ativa (lib/especialidade.ts); as chaves são fixas. */
export const SECOES_ORIENTACOES: DefSecao<SecaoOrientacao>[] = (
  ["cuidados", "fotoprotecao", "higiene"] as const
).map((chave) => ({ chave, titulo: ESPECIALIDADE.orientacoes[chave].titulo }));

/** Compara termos sem se importar com espaços, maiúsculas (acentos contam, como no cadastro livre). */
export const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** "Exames laboratoriais: hemograma, TGO" -> título + componentes. Sem ":" = só título. */
export function partirTermo(termo: string): { titulo: string; componentes: string[] } {
  const i = termo.indexOf(":");
  if (i < 0) return { titulo: termo.trim(), componentes: [] };
  return {
    titulo: termo.slice(0, i).trim(),
    componentes: termo
      .slice(i + 1)
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  };
}

/** Junta dois blocos do mesmo grupo somando os componentes, sem repetir. */
export function juntarTermos(a: string, b: string): string {
  const { titulo, componentes: ca } = partirTermo(a);
  const { componentes: cb } = partirTermo(b);
  const vistos = new Set<string>();
  const todos = [...ca, ...cb].filter((c) => {
    const k = normalizar(c);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return todos.length ? `${titulo}: ${todos.join(", ")}` : titulo;
}
export const ehFonte = (f: unknown): f is Fonte => FONTES.includes(f as Fonte);
export const ehSecao = <S extends Secao>(defs: DefSecao<S>[], s: unknown): s is S =>
  defs.some(({ chave }) => chave === s);

/**
 * Junta listas de sugestões (uma por diagnóstico): mesmo termo na mesma seção vira um item só,
 * Mantém a ordem de chegada.
 */
export function unirItens<T extends ItemSugerido>(listas: T[][]): T[] {
  const porTermo = new Map<string, T>();
  for (const lista of listas) {
    for (const item of lista) {
      const secao = (item as { secao?: string }).secao ?? "";
      const chave = `${secao}|${normalizar(partirTermo(item.termo).titulo)}`;
      const atual = porTermo.get(chave);
      if (!atual) porTermo.set(chave, { ...item });
      else {
        atual.termo = juntarTermos(atual.termo, item.termo); // mesmo grupo de diagnósticos diferentes
      }
    }
  }
  return [...porTermo.values()];
}
