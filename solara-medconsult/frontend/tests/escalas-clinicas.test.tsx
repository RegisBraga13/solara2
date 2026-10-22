import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

let EscalasClinicas: typeof import("@/components/EscalasClinicas").EscalasClinicas;

async function montar(slug?: string) {
  vi.resetModules();
  if (slug) vi.stubEnv("NEXT_PUBLIC_ESPECIALIDADE", slug);
  ({ EscalasClinicas } = await import("@/components/EscalasClinicas"));
  const { useConsulta } = await import("@/store/consulta");
  useConsulta.getState().reset();
  render(<EscalasClinicas />);
  return useConsulta;
}

describe("escalas na propedêutica", () => {
  it("dermatologia não define escalas: nada aparece", async () => {
    await montar();
    expect(screen.queryByText(/ESCALAS/i)).toBeNull();
  });

  it("reumatologia mantém só o escore digitado (CDAI)", async () => {
    await montar("reumatologia");
    expect(screen.getByRole("button", { name: /CDAI/ })).toBeTruthy();
    expect(screen.queryByText(/ESCALAS DE PSIQUIATRIA/)).toBeNull();
  });

  it("psiquiatria mostra PHQ-9/GAD-7 item a item e YMRS/PANSS como escore manual", async () => {
    const store = await montar("psiquiatria");
    expect(screen.getByText(/ESCALAS DE PSIQUIATRIA/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "YMRS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PANSS" })).toBeTruthy();
    // PHQ-9 e GAD-7 não aparecem de novo como escore manual
    expect(screen.getAllByRole("button", { name: "PHQ-9" })).toHaveLength(1);

    const item1 = screen.getAllByLabelText(/^2 — Mais da metade dos dias$/)[0];
    fireEvent.click(item1);
    expect(store.getState().escalas.phq9).toBe("2");
  });

  it("PHQ-9: as respostas voltam ao reabrir a tela, e somem se a consulta é reiniciada", async () => {
    const store = await montar("psiquiatria");
    fireEvent.click(screen.getAllByLabelText(/^1 — Vários dias$/)[0]);
    expect(store.getState().escalas.phq9).toBe("1");
    cleanup();
    render(<EscalasClinicas />);
    expect((screen.getAllByLabelText(/^1 — Vários dias$/)[0] as HTMLInputElement).checked).toBe(true);

    store.getState().reset();
    cleanup();
    render(<EscalasClinicas />);
    expect((screen.getAllByLabelText(/^1 — Vários dias$/)[0] as HTMLInputElement).checked).toBe(false);
  });
});
