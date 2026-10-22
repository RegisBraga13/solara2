import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useParams: () => ({ id: "p1" }),
}));

const api = vi.hoisted(() => ({
  obterPaciente: vi.fn(),
  emitirAtestado: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));
vi.mock("@/lib/pdfAtestado", () => ({
  criarPdfAtestado: vi.fn(async () => ({ blob: new Blob(["%PDF"]), nome: "atestado.pdf" })),
}));

import AtestadoPage from "@/app/pacientes/[id]/atestado/page";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const preencher = (rotulo: RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe("tela de atestado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useConsulta.setState(dadosIniciais("dia"));
    api.obterPaciente.mockResolvedValue({ id: "p1", nome: "Ana Souza", cpf: "52998224725" });
    api.emitirAtestado.mockResolvedValue({ id: "a1" });
  });

  it("CID vem do diagnóstico selecionado, mas só entra no PDF se o médico marcar a autorização", async () => {
    useConsulta.setState({
      diagnostico: { selecionados: ["Psoríase"] },
      sugestoes: {
        ...dadosIniciais("dia").sugestoes,
        diagnostico: { chave: "x", itens: ["Psoríase"], cid11: ["EA90"] },
      },
    });
    render(<AtestadoPage />);
    await screen.findByText("Ana Souza");
    expect(screen.queryByLabelText("CID")).toBeNull(); // some até o médico marcar

    fireEvent.click(screen.getByLabelText(/Incluir CID/));
    expect(screen.getByLabelText("CID")).toHaveValue("EA90"); // preenchido, nunca inventado à toa
  });

  it("não emite sem médico nem cidade; emite com tudo e guarda no aparelho", async () => {
    render(<AtestadoPage />);
    await screen.findByText("Ana Souza");
    preencher(/Dias de afastamento/, "3");
    preencher(/A contar de/, "2026-10-19");

    fireEvent.click(screen.getByRole("button", { name: /EMITIR ATESTADO/ }));
    expect(await screen.findByText(/nome e o CRM/)).toBeTruthy();
    expect(api.emitirAtestado).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /OK|ENTENDI|FECHAR/i }));

    preencher(/^Nome$/, "Dr. Fulano de Tal");
    preencher(/CRM e UF/, "CRM 12345/SP");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR ATESTADO/ }));
    expect(await screen.findByText(/cidade/)).toBeTruthy();
    expect(api.emitirAtestado).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /OK|ENTENDI|FECHAR/i }));

    preencher(/Cidade/, "São Paulo");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR ATESTADO/ }));

    await waitFor(() => expect(api.emitirAtestado).toHaveBeenCalledTimes(1));
    const enviado = api.emitirAtestado.mock.calls[0][0];
    expect(enviado.pacienteId).toBe("p1");
    expect(enviado.diasAfastamento).toBe(3);
    expect(enviado.dataInicial).toBe("2026-10-19");
    expect(enviado.cidade).toBe("São Paulo");
    expect(enviado.cid).toBe(""); // não marcou "incluir CID"
    expect(await screen.findByText(/Atestado salvo no prontuário de Ana Souza/)).toBeTruthy();
    expect(window.localStorage.getItem("medconsult-medico")).toContain("Fulano");
  });

  it("recusa dias de afastamento fora do intervalo (1 a 365)", async () => {
    window.localStorage.setItem(
      "medconsult-medico",
      JSON.stringify({ nome: "Dr. Ana", crm: "CRM 1/SP", cidade: "São Paulo" }),
    );
    render(<AtestadoPage />);
    await screen.findByText("Ana Souza");
    preencher(/Dias de afastamento/, "0");
    fireEvent.click(screen.getByRole("button", { name: /EMITIR ATESTADO/ }));
    expect(await screen.findByText(/número de dias de afastamento válido/)).toBeTruthy();
    expect(api.emitirAtestado).not.toHaveBeenCalled();
  });

  it("mostra que identificação e diagnóstico já vêm da consulta", async () => {
    render(<AtestadoPage />);
    expect(await screen.findByText(/já vêm preenchidos da consulta/)).toBeTruthy();
  });
});
