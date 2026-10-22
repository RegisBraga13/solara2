import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function marca(slug?: string) {
  vi.resetModules();
  if (slug) vi.stubEnv("NEXT_PUBLIC_ESPECIALIDADE", slug);
  const { Marca } = await import("@/components/Marca");
  render(<Marca />);
}

describe("marca espec·IA·lidades", () => {
  it("mostra nome-mãe e módulo ativo, com o IA em destaque", async () => {
    await marca();
    expect(screen.getByLabelText("espec·IA·lidades · dermatologIA")).toBeTruthy();
    const destaques = screen.getAllByText("IA", { selector: "strong" });
    expect(destaques).toHaveLength(2);
  });

  it.each([
    ["psiquiatria", "psiquiatrIA"],
    ["reumatologia", "reumatologIA"],
  ])("troca o módulo ao trocar a especialidade (%s)", async (slug, nome) => {
    await marca(slug);
    expect(screen.getByLabelText(`espec·IA·lidades · ${nome}`)).toBeTruthy();
  });
});
