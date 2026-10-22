import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function carregar(slug?: string) {
  vi.resetModules();
  if (slug) vi.stubEnv("NEXT_PUBLIC_ESPECIALIDADE", slug);
  const esp = await import("@/lib/especialidade");
  const sug = await import("@/lib/sugestoes");
  const pront = await import("@/lib/prontuario");
  const store = await import("@/store/consulta");
  return { esp, sug, pront, store };
}

describe("especialidade ativa", () => {
  it("o padrão é dermatologia e os títulos anteriores não mudaram", async () => {
    const { esp, sug, pront } = await carregar();
    expect(esp.ESPECIALIDADE.slug).toBe("dermatologia");
    expect(sug.SECOES_ORIENTACOES.map((s) => s.titulo)).toEqual([
      "🧴 CUIDADOS COM A PELE",
      "☀️ FOTOPROTEÇÃO",
      "🏠 HIGIENE E AMBIENTE",
    ]);
    expect(pront.ROTULOS_SECAO.fotoprotecao).toBe("Fotoproteção");
    expect(esp.ESPECIALIDADE.escalas).toEqual([]);
  });

  it("psiquiatria troca títulos e rótulos, mantendo as mesmas chaves internas", async () => {
    const { esp, sug, pront } = await carregar("psiquiatria");
    expect(esp.ESPECIALIDADE.slug).toBe("psiquiatria");
    expect(sug.SECOES_ORIENTACOES.map((s) => s.chave)).toEqual(["cuidados", "fotoprotecao", "higiene"]);
    expect(sug.SECOES_ORIENTACOES[1].titulo).toContain("ADESÃO MEDICAMENTOSA");
    expect(pront.ROTULOS_SECAO.fotoprotecao).toBe("Adesão medicamentosa");
    expect(esp.ESPECIALIDADE.escalas.map((e) => e.nome)).toContain("PHQ-9");
  });

  it("reumatologia troca títulos e rótulos, mantendo as mesmas chaves internas", async () => {
    const { esp, sug, pront } = await carregar("reumatologia");
    expect(esp.ESPECIALIDADE.slug).toBe("reumatologia");
    expect(sug.SECOES_ORIENTACOES.map((s) => s.chave)).toEqual(["cuidados", "fotoprotecao", "higiene"]);
    expect(sug.SECOES_ORIENTACOES[0].titulo).toContain("CUIDADOS COM AS ARTICULAÇÕES");
    expect(pront.ROTULOS_SECAO.higiene).toBe("Sinais de alerta e seguimento");
    expect(esp.ESPECIALIDADE.escalas.map((e) => e.nome)).toEqual(["DAS28", "CDAI", "BASDAI", "HAQ"]);
  });

  it("valor desconhecido cai em dermatologia (nunca quebra o app)", async () => {
    const { esp } = await carregar("especialidade-inexistente");
    expect(esp.ESPECIALIDADE.slug).toBe("dermatologia");
  });
});

describe("escalas", () => {
  beforeEach(() => vi.resetModules());

  it("o escore é só número, limitado ao máximo, e vazio apaga", async () => {
    const { store } = await carregar("psiquiatria");
    const s = () => store.useConsulta.getState();
    s().setEscala("phq9", "12", 27);
    expect(s().escalas).toEqual({ phq9: "12" });
    s().setEscala("phq9", "99", 27);
    expect(s().escalas.phq9).toBe("27");
    s().setEscala("phq9", "1a2", 27);
    expect(s().escalas.phq9).toBe("12");
    s().setEscala("phq9", "", 27);
    expect(s().escalas).toEqual({});
  });

  it("escalas preenchidas vão para o prontuário; sem escores, nada aparece", async () => {
    const { store, pront } = await carregar("psiquiatria");
    const base = { ...store.useConsulta.getState() };
    expect(pront.montarProntuario(base)).not.toContain("ESCALAS APLICADAS");
    const texto = pront.montarProntuario({ ...base, escalas: { phq9: "14", gad7: "" } });
    expect(texto).toContain("ESCALAS APLICADAS\n- PHQ-9: 14 (0-27)");
    expect(texto).not.toContain("GAD-7");
    expect(pront.TITULOS_PRONTUARIO).toContain("ESCALAS APLICADAS");
  });

  it("dermatologia não mostra nem grava escalas no prontuário", async () => {
    const { store, pront } = await carregar();
    const base = { ...store.useConsulta.getState(), escalas: { phq9: "14" } };
    expect(pront.montarProntuario(base)).not.toContain("ESCALAS");
  });
});

describe("escores com casas decimais", () => {
  it("normaliza vírgula/ponto, limita casas e máximo, mantém inteiros como antes", async () => {
    const { normalizarEscore } = await import("@/store/consulta");
    expect(normalizarEscore("3,456", 9.4, 2)).toBe("3,45");
    expect(normalizarEscore("3.4", 9.4, 2)).toBe("3,4");
    expect(normalizarEscore("7,", 9.4, 2)).toBe("7,"); // digitando
    expect(normalizarEscore("9,9", 9.4, 2)).toBe("9,4"); // limita ao máximo
    expect(normalizarEscore(",5", 10, 1)).toBe("0,5");
    expect(normalizarEscore("abc", 10, 1)).toBe("");
    expect(normalizarEscore("", 10, 1)).toBe("");
    expect(normalizarEscore("1a2", 27)).toBe("12"); // sem casas: igual ao comportamento anterior
    expect(normalizarEscore("3,7", 27)).toBe("3"); // escala inteira não aceita decimais
    expect(normalizarEscore("99", 27)).toBe("27");
  });

  it("DAS28, BASDAI, HAQ (reumatologia) e EDSS (neurologia) aceitam decimais", async () => {
    const reum = await carregar("reumatologia");
    const porId = Object.fromEntries(reum.esp.ESPECIALIDADE.escalas.map((e) => [e.id, e]));
    expect(porId.das28).toMatchObject({ max: 9.4, casas: 2 });
    expect(porId.basdai).toMatchObject({ max: 10, casas: 1 });
    expect(porId.haq).toMatchObject({ max: 3, casas: 3 });
    expect(porId.cdai.casas).toBeUndefined(); // CDAI continua inteiro
    reum.store.useConsulta.getState().setEscala("das28", "5,12", 9.4, 2);
    expect(reum.store.useConsulta.getState().escalas.das28).toBe("5,12");
    expect(reum.pront.montarProntuario).toBeDefined();

    const neuro = await carregar("neurologia");
    const edss = neuro.esp.ESPECIALIDADE.escalas.find((e) => e.id === "edss");
    expect(edss).toMatchObject({ max: 10, casas: 1 });
  });
});
