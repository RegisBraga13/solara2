// Receita: preenchida à mão pelo médico. Nada aqui é sugerido nem gerado por IA.
// Identidade do médico (nome/CRM/cidade) mora em @/lib/medico — compartilhada com Atestado e Declaração.

import type { ItemReceitaApi } from "@/lib/api";

export type ItemReceita = ItemReceitaApi;

export const ITEM_VAZIO: ItemReceita = { medicamento: "", posologia: "", duracao: "", quantidade: "" };
export const MAX_ITENS = 20;

/** Itens com medicamento E posologia preenchidos (os demais são linhas em branco). */
export const itensPreenchidos = (itens: ItemReceita[]): ItemReceita[] =>
  itens
    .map((i) => ({
      medicamento: i.medicamento.trim(),
      posologia: i.posologia.trim(),
      duracao: i.duracao.trim(),
      quantidade: i.quantidade.trim(),
    }))
    .filter((i) => i.medicamento && i.posologia);

/** Linha incompleta: tem medicamento sem posologia (ou o contrário). Bloqueia a emissão. */
export const temItemIncompleto = (itens: ItemReceita[]): boolean =>
  itens.some((i) => Boolean(i.medicamento.trim()) !== Boolean(i.posologia.trim()));
