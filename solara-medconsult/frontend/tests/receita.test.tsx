import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useParams: () => ({ id: "p1" }),
}));

const api = vi.hoisted(() => ({
  obterPaciente: vi.fn(),
  emitirReceita: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));
vi.mock("@/lib/pdfReceita", () => ({
  criarPdfReceita: vi.fn(async () => ({ blob: new Blob(["%PDF"]), nome: "receita.pdf" })),
}));

import ReceitaPage from "@/app/pacientes/[id]/receita/page";
import { medicoValido } from "@/lib/medico";
import { itensPreenchidos, temItemIncompleto } from "@/lib/receita";

describe("regras da receita", () => {
  it("ignora linhas em branco e detecta item incompleto", () => {
    const vazio = { medicamento: "", posologia: "", duracao: "", quantidade: "" };
    const ok = { ...vazio, medicamento: "Amoxicilina 500 mg", posologia: "8/8 h" };
    expect(itensPreenchidos([vazio, ok])).toEqual([ok]);
    expect(temItemIncompleto([vazio, ok])).toBe(false);
    expect(temItemIncompleto([{ ...vazio, medicamento: "Dipirona" }])).toBe(true);
    expect(temItemIncompleto([{ ...vazio, posologia: "1 ao dia" }])).toBe(true);
  });

  it("exige nome e CRM do médico", () => {
    expect(medicoValido({ nome: "Dr. Ana", crm: "CRM 1/SP", cidade: "" })).toBe(true);
    expect(medicoValido({ nome: "", crm: "CRM 1/SP", cidade: "" })).toBe(false);
    expect(medicoValido({ nome: "Dr. Ana", crm: "", cidade: "" })).toBe(false);
  });
});

describe("tela de receita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.obterPaciente.mockResolvedValue({ id: "p1", nome: "Ana Souza" });
    api.emitirReceita.mockResolvedValue({ id: "r1" });
  });

  const preencher = (rotulo: RegExp, valor: string, indice = 0) =>
    fireEvent.change(screen.getAllByLabelText(rotulo)[indice], { target: { value: valor } });

  it("não emite sem médico; emite com tudo e guarda o médico no aparelho", async () => {
    render(<ReceitaPage />);
    await screen.findByText("Ana Souza");
    preencher(/Medicamento/, "Isotretinoína 20 mg");
    preencher(/Posologia/, "1 cápsula ao dia");

    fireEvent.click(screen.getByRole("button", { name: /EMITIR RECEITA/ }));
    expect(await screen.findByText(/nome e o CRM/)).toBeTruthy();
    expect(api.emitirReceita).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /OK|ENTENDI|FECHAR/i }));

    preencher(/^Nome$/, "Dr. Fulano de Tal");
    preencher(/CRM e UF/, "CRM 12345/SP");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR RECEITA/ }));

    await waitFor(() => expect(api.emitirReceita).toHaveBeenCalledTimes(1));
    const enviado = api.emitirReceita.mock.calls[0][0];
    expect(enviado.pacienteId).toBe("p1");
    expect(enviado.itens).toEqual([
      { medicamento: "Isotretinoína 20 mg", posologia: "1 cápsula ao dia", duracao: "", quantidade: "" },
    ]);
    expect(enviado.medicoCrm).toBe("CRM 12345/SP");
    expect(await screen.findByText(/Receita salva no prontuário de Ana Souza/)).toBeTruthy();
    expect(window.localStorage.getItem("medconsult-medico")).toContain("Fulano");
  });

  it("bloqueia item com medicamento sem posologia", async () => {
    window.localStorage.setItem("medconsult-medico", JSON.stringify({ nome: "Dr. Ana", crm: "CRM 1/SP" }));
    render(<ReceitaPage />);
    await screen.findByText("Ana Souza");
    preencher(/Medicamento/, "Dipirona");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR RECEITA/ }));
    expect(await screen.findByText(/sem posologia/)).toBeTruthy();
    expect(api.emitirReceita).not.toHaveBeenCalled();
  });

  it("mostra que nada é gerado pela IA", async () => {
    render(<ReceitaPage />);
    expect(await screen.findByText(/nada é sugerido nem gerado pela IA/)).toBeTruthy();
  });
});
