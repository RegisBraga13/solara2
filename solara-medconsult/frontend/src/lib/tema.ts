export type Tema = "dia" | "noite";

/** Dia entre 6h (inclusive) e 18h (exclusive); o resto é noite. */
export function temaPorHora(data: Date = new Date()): Tema {
  const h = data.getHours();
  return h >= 6 && h < 18 ? "dia" : "noite";
}

/** Classe aplicada ao <html> (`day` | `night`), conforme o design system. */
export const classeDoTema = (t: Tema): "day" | "night" => (t === "dia" ? "day" : "night");
