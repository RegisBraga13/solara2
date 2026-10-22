import { describe, expect, it } from "vitest";

import { faixaEscalaPsiquiatria, perguntasEscalaPsiquiatria } from "@/components/EscalasPsiquiatria";

describe("escalas item a item da psiquiatria", () => {
  it("define os nove itens do PHQ-9 e sete do GAD-7", () => {
    expect(perguntasEscalaPsiquiatria.phq9).toHaveLength(9);
    expect(perguntasEscalaPsiquiatria.gad7).toHaveLength(7);
    expect(perguntasEscalaPsiquiatria.phq9[8].texto).toContain("morto");
  });

  it("usa faixas de apoio com linguagem sugestiva", () => {
    expect(faixaEscalaPsiquiatria("phq9", 0)).toContain("sugere");
    expect(faixaEscalaPsiquiatria("phq9", 12)).toContain("moderados");
    expect(faixaEscalaPsiquiatria("phq9", 22)).toContain("graves");
    expect(faixaEscalaPsiquiatria("gad7", 8)).toContain("leve");
    expect(faixaEscalaPsiquiatria("gad7", 16)).toContain("grave");
  });
});
