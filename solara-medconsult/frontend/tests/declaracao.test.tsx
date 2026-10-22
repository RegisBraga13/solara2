import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useParams: () => ({ id: "p1" }),
}));

const api = vi.hoisted(() => ({
  obterPaciente: vi.fn(),
  emitirDeclaracao: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));
vi.mock("@/lib/pdfDeclaracao", () => ({
  criarPdfDeclaracao: vi.fn(async () => ({ blob: new Blob(["%PDF"]), nome: "declaracao.pdf" })),
}));

import DeclaracaoPage from "@/app/pacientes/[id]/declaracao/page";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const preencher = (rotulo: RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe("tela de declaração de comparecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useConsulta.setState(dadosIniciais("dia"));
    api.obterPaciente.mockResolvedValue({ id: "p1", nome: "Ana Souza" });
    api.emitirDeclaracao.mockResolvedValue({ id: "d1" });
  });

  it("não emite sem médico nem cidade; emite com tudo e guarda no aparelho", async () => {
    render(<DeclaracaoPage />);
    await screen.findByText("Ana Souza");
    preencher(/Data/, "2026-10-19");
    preencher(/Hora de início/, "09:00");
    preencher(/Hora de fim/, "10:00");

    fireEvent.click(screen.getByRole("button", { name: /EMITIR DECLARAÇÃO/ }));
    expect(await screen.findByText(/nome e o CRM/)).toBeTruthy();
    expect(api.emitirDeclaracao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /OK|ENTENDI|FECHAR/i }));

    preencher(/^Nome$/, "Dr. Fulano de Tal");
    preencher(/CRM e UF/, "CRM 12345/SP");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR DECLARAÇÃO/ }));
    expect(await screen.findByText(/cidade/)).toBeTruthy();
    expect(api.emitirDeclaracao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /OK|ENTENDI|FECHAR/i }));

    preencher(/Cidade/, "São Paulo");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR DECLARAÇÃO/ }));

    await waitFor(() => expect(api.emitirDeclaracao).toHaveBeenCalledTimes(1));
    const enviado = api.emitirDeclaracao.mock.calls[0][0];
    expect(enviado.pacienteId).toBe("p1");
    expect(enviado.data).toBe("2026-10-19");
    expect(enviado.horaInicio).toBe("09:00");
    expect(enviado.horaFim).toBe("10:00");
    expect(enviado.cidade).toBe("São Paulo");
    expect(await screen.findByText(/Declaração salva no prontuário de Ana Souza/)).toBeTruthy();
    expect(window.localStorage.getItem("medconsult-medico")).toContain("Fulano");
  });

  it("pré-preenche a data de hoje e um período de comparecimento", async () => {
    render(<DeclaracaoPage />);
    await screen.findByText("Ana Souza");
    const hoje = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText(/Data/)).toHaveValue(hoje);
    expect((screen.getByLabelText(/Hora de início/) as HTMLInputElement).value).not.toBe("");
    expect((screen.getByLabelText(/Hora de fim/) as HTMLInputElement).value).not.toBe("");
  });

  it("mostra que identificação e data já vêm da consulta", async () => {
    render(<DeclaracaoPage />);
    expect(await screen.findByText(/já vêm preenchidas da consulta/)).toBeTruthy();
  });
});
