import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useParams: () => ({ id: "11111111-aaaa-4aaa-8aaa-111111111111" }),
}));

const api = vi.hoisted(() => ({
  corrigirProntuario: vi.fn(),
  obterProntuario: vi.fn(),
  excluirProntuario: vi.fn(),
  baixarPdfProntuario: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));

const pdf = vi.hoisted(() => ({
  compartilharPdf: vi.fn(),
  criarPdfProntuario: vi.fn(),
}));
vi.mock("@/lib/pdf", async (original) => ({
  ...(await original<typeof import("@/lib/pdf")>()),
  ...pdf,
}));

import Detalhe from "@/app/prontuarios/[id]/page";
import { formatarData } from "@/lib/datas";

const ID = "11111111-aaaa-4aaa-8aaa-111111111111";
const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));
const abrir = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("open", abrir);
  api.corrigirProntuario.mockResolvedValue({ id: ID });
  api.obterProntuario.mockResolvedValue({
    id: ID,
    paciente: "Ana Souza",
    modo: "presencial",
    criado_em: "2026-10-08T15:30:00",
    texto: "CONSULTA PRESENCIAL\n- Psoríase",
  });
  api.excluirProntuario.mockResolvedValue(undefined);
  api.baixarPdfProntuario.mockResolvedValue(new Blob(["%PDF"]));
  pdf.compartilharPdf.mockResolvedValue("compartilhado");
  pdf.criarPdfProntuario.mockResolvedValue({ blob: new Blob(["%PDF-novo"]), nome: "prontuario.pdf" });
  window.history.pushState({}, "", "/");
});

describe("prontuários salvos", () => {
  it("detalhe mostra o texto e abre o PDF guardado no servidor", async () => {
    render(<Detalhe />);
    expect(await screen.findByText(/CONSULTA PRESENCIAL/)).toBeInTheDocument();
    clicar("ABRIR PDF");
    expect(abrir).toHaveBeenCalledWith(
      expect.stringContaining(`/prontuarios/${ID}/pdf`),
      "_blank",
      "noopener",
    );
  });

  it("detalhe compartilha o PDF e exclui só depois de confirmar", async () => {
    render(<Detalhe />);
    await screen.findByText(/CONSULTA PRESENCIAL/);
    clicar(/COMPARTILHAR/);
    await waitFor(() => expect(pdf.compartilharPdf).toHaveBeenCalledTimes(1));
    expect(api.baixarPdfProntuario).toHaveBeenCalledWith(ID);

    clicar("EXCLUIR PRONTUÁRIO");
    clicar("Cancelar");
    expect(api.excluirProntuario).not.toHaveBeenCalled();
    clicar("EXCLUIR PRONTUÁRIO");
    clicar("Confirmar");
    await waitFor(() => expect(api.excluirProntuario).toHaveBeenCalledWith(ID));
    expect(nav.replace).toHaveBeenCalledWith("/prontuarios");
  });

  it("EDITAR: o médico corrige o texto; o PDF é refeito e enviado junto", async () => {
    render(<Detalhe />);
    await screen.findByText(/Psoríase/);
    clicar("EDITAR (CORRIGIR ERROS)");
    const campo = screen.getByLabelText("Corrigir o texto do prontuário");
    expect(campo).toHaveValue("CONSULTA PRESENCIAL\n- Psoríase");
    fireEvent.change(campo, { target: { value: "CONSULTA PRESENCIAL\n- Psoríase vulgar" } });
    clicar("SALVAR CORREÇÃO");
    await waitFor(() => expect(api.corrigirProntuario).toHaveBeenCalledTimes(1));
    const [id, dados] = api.corrigirProntuario.mock.calls[0];
    expect(id).toBe(ID);
    expect(dados.texto).toContain("Psoríase vulgar");
    expect(dados.pdf).toBeInstanceOf(Blob);
    expect(pdf.criarPdfProntuario.mock.calls[0][0].texto).toContain("Psoríase vulgar");
    await waitFor(() => expect(screen.queryByText("SALVAR CORREÇÃO")).toBeNull());
  });

  it("EDITAR: texto vazio não salva; falha no servidor avisa e mantém a edição", async () => {
    render(<Detalhe />);
    await screen.findByText(/Psoríase/);
    clicar("EDITAR (CORRIGIR ERROS)");
    const campo = screen.getByLabelText("Corrigir o texto do prontuário");
    fireEvent.change(campo, { target: { value: "   " } });
    clicar("SALVAR CORREÇÃO");
    expect(await screen.findByText(/não pode ficar vazio/)).toBeInTheDocument();
    expect(api.corrigirProntuario).not.toHaveBeenCalled();
    clicar("OK");
    api.corrigirProntuario.mockRejectedValueOnce(new Error("fora"));
    fireEvent.change(campo, { target: { value: "novo texto" } });
    clicar("SALVAR CORREÇÃO");
    expect(await screen.findByText(/Nada foi alterado/)).toBeInTheDocument();
    expect(screen.getByLabelText("Corrigir o texto do prontuário")).toHaveValue("novo texto");
  });

  it("vindo do histórico (?editar=1) já abre em edição; CANCELAR descarta", async () => {
    window.history.pushState({}, "", `/prontuarios/${ID}?editar=1`);
    render(<Detalhe />);
    const campo = await screen.findByLabelText("Corrigir o texto do prontuário");
    fireEvent.change(campo, { target: { value: "rabisco" } });
    clicar("CANCELAR");
    expect(screen.getByText(/Psoríase/)).toBeInTheDocument();
    expect(api.corrigirProntuario).not.toHaveBeenCalled();
  });

  it("prontuário inexistente avisa sem quebrar", async () => {
    api.obterProntuario.mockRejectedValueOnce(new Error("404"));
    render(<Detalhe />);
    expect(await screen.findByText(/não encontrado ou servidor indisponível/)).toBeInTheDocument();
  });

  it("data do servidor (UTC sem sufixo) é lida como UTC", () => {
    const a = formatarData("2026-10-08T15:30:00");
    const b = formatarData("2026-10-08T15:30:00Z");
    expect(a).toBe(b);
  });
});
