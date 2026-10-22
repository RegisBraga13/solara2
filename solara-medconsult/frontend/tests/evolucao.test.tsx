import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const api = vi.hoisted(() => ({
  obterProntuario: vi.fn(),
  sugerirDiagnosticos: vi.fn(),
  gerarConduta: vi.fn(),
  gerarInvestigacao: vi.fn(),
  gerarTratamento: vi.fn(),
  gerarOrientacoesTexto: vi.fn(),
  registrarProntuario: vi.fn(),
  uploadImage: vi.fn(),
  uploadLaudo: vi.fn(),
  removerLaudo: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));

const pdf = vi.hoisted(() => ({ criarPdfProntuario: vi.fn(), compartilharPdf: vi.fn() }));
vi.mock("@/lib/pdf", async (original) => ({
  ...(await original<typeof import("@/lib/pdf")>()),
  ...pdf,
}));

import Evolucao from "@/app/evolucao/page";
import { condutaDoProntuario, diagnosticosDoProntuario, montarEvolucao } from "@/lib/prontuario";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const ANTERIOR = [
  "CONSULTA PRESENCIAL",
  "",
  "HISTÓRIA CLÍNICA",
  "Prurido há 3 dias.",
  "",
  "DIAGNÓSTICO",
  "- Dermatite atópica",
  "- Eczema numular",
  "",
  "CONDUTA",
  "Biópsia não necessária; observação.",
  "",
  "TRATAMENTO",
  "Emolientes diariamente.",
  "",
  "ORIENTAÇÕES GERAIS",
  "Hidratar a pele e evitar banhos quentes.",
].join("\n");

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));
const escolher = (grupo: string, opcao: string) => {
  const g = screen.getByRole("radiogroup", { name: grupo });
  fireEvent.click(Array.from(g.querySelectorAll('[role="radio"]')).find((e) => e.textContent === opcao)!);
};
const marcarFonte = (rotulo: string) => {
  const botao = screen.getByRole("checkbox", { name: rotulo });
  if (botao.getAttribute("aria-checked") !== "true") fireEvent.click(botao);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal("open", vi.fn());
  useConsulta.setState({
    ...dadosIniciais("dia"),
    modo: "presencial",
    tipo: "retorno",
    retornoDe: "c1",
    paciente: "Ana",
    pacienteId: "p1",
    sessionId: "11111111-1111-4111-8111-111111111111",
    iniciada_em: Date.now() - 1000,
    etapa_atual: 2,
  });
  api.obterProntuario.mockResolvedValue({
    id: "c1",
    paciente: "Ana",
    modo: "presencial",
    criado_em: "2026-09-01T10:00:00",
    texto: ANTERIOR,
  });
  api.sugerirDiagnosticos.mockResolvedValue({ nomes: ["Psoríase em placas"], probabilidades: [55] });
  api.gerarConduta.mockResolvedValue("Corticoide tópico diário.");
  api.gerarInvestigacao.mockResolvedValue("Biópsia com histopatológico.");
  api.gerarTratamento.mockResolvedValue("Metotrexato 15mg/semana.");
  api.gerarOrientacoesTexto.mockResolvedValue("Evitar sol direto.");
  api.registrarProntuario.mockResolvedValue({ id: "novo-1", paciente: "Ana", modo: "presencial", criado_em: "2026-10-08T12:00:00" });
  pdf.criarPdfProntuario.mockResolvedValue({ blob: new Blob(["%PDF"]), nome: "p.pdf" });
});

describe("texto da evolução", () => {
  it("lê diagnósticos e conduta do prontuário anterior", () => {
    expect(diagnosticosDoProntuario(ANTERIOR)).toEqual(["Dermatite atópica", "Eczema numular"]);
    expect(condutaDoProntuario(ANTERIOR)).toEqual({
      conduta: "Biópsia não necessária; observação.",
      investigacao: "",
      tratamento: "Emolientes diariamente.",
      orientacoes: "Hidratar a pele e evitar banhos quentes.",
    });
    expect(diagnosticosDoProntuario("sem nada")).toEqual([]);
    expect(diagnosticosDoProntuario("DIAGNÓSTICO\n(nenhum assinalado)")).toEqual([]);
  });

  it("manter leva o que havia; ajustar/novo leva o que o médico escolheu agora", () => {
    const base = { ...useConsulta.getState() };
    const manter = montarEvolucao({ ...base, evolucao: { diagnostico: "manter", conduta: "manter" } }, ANTERIOR);
    expect(manter).toContain("CONSULTA PRESENCIAL - RETORNO");
    expect(manter).toContain("Decisão: mantido\n- Dermatite atópica\n- Eczema numular");
    expect(manter).toContain("Decisão: mantida\nBiópsia não necessária; observação.");
    expect(manter).toContain("TRATAMENTO\nEmolientes diariamente.");
    expect(manter).toContain("ORIENTAÇÕES GERAIS\nHidratar a pele e evitar banhos quentes.");

    useConsulta.getState().addExtra("diagnostico", "Psoríase");
    useConsulta.getState().setCondutaTratamento("tratamento", "Metotrexato 15mg.", true);
    const novo = montarEvolucao(
      { ...useConsulta.getState(), evolucao: { diagnostico: "novo", conduta: "ajustar" } },
      ANTERIOR,
      ["laudo.pdf"],
    );
    expect(novo).toContain("Decisão: novo\n- Psoríase");
    expect(novo).not.toContain("Dermatite atópica");
    expect(novo).toContain("Decisão: ajustada\n(não registrada)"); // conduta ainda não escrita
    expect(novo).toContain("TRATAMENTO\nMetotrexato 15mg.");
    expect(novo).toContain("LAUDOS NOVOS\n- laudo.pdf");
  });

  it("sem decisão aparece 'não informada'", () => {
    const t = montarEvolucao({ ...useConsulta.getState() }, null);
    expect(t).toContain("Decisão: não informada");
    expect(t).toContain("(não registrada)");
  });
});

describe("tela de Evolução", () => {
  it("é uma tela só, com mini anamnese, imagens, diagnóstico, conduta, Whitebook e anotações", async () => {
    render(<Evolucao />);
    expect(await screen.findByText("EVOLUÇÃO")).toBeInTheDocument();
    expect(await screen.findByText(/Retorno da consulta de/)).toBeInTheDocument();
    for (const t of ["MINI ANAMNESE", "LAUDOS NOVOS", "IMAGENS NOVAS", "DIAGNÓSTICO", "CONDUTA"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Consultar Whitebook/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Anotações/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TRANSCRIÇÃO/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir para a etapa 5" })).toBeNull(); // sem as 8 etapas
    expect(api.sugerirDiagnosticos).not.toHaveBeenCalled(); // nada é gerado sozinho
  });

  it("consulta nova não usa esta tela: volta para a etapa em que estava", async () => {
    useConsulta.setState({ tipo: "nova", retornoDe: null, etapa_atual: 5 });
    render(<Evolucao />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/historia"));
  });

  it("mini anamnese escrita; manter o diagnóstico permite gerar a conduta a partir dele", async () => {
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    clicar(/ESCRITO/);
    fireEvent.change(screen.getByLabelText(/Como o paciente está/), { target: { value: "Melhorou do prurido." } });
    expect(useConsulta.getState().captura.texto).toBe("Melhorou do prurido.");

    escolher("Diagnóstico", "Manter");
    expect(await screen.findByText(/Mantido: Dermatite atópica; Eczema numular/)).toBeInTheDocument();
    expect(screen.queryByText("GERAR SUGESTÕES")).toBeNull(); // manter não gera nada

    escolher("Conduta", "Ajustar");
    expect(screen.queryByText(/podem conter erros/)).toBeNull();
    marcarFonte("AI");
    clicar("✨ GERAR CONDUTA COM IA");
    await screen.findByText("Corticoide tópico diário.");
    // o texto parte dos diagnósticos mantidos, juntos num texto só
    expect(api.gerarConduta).toHaveBeenCalledWith("Dermatite atópica; Eczema numular", ["AI"], "");
  });

  it("novo diagnóstico: gera pela mini anamnese quando o médico manda", async () => {
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    useConsulta.getState().setCapturaTexto("Placas descamativas em cotovelos.");
    escolher("Diagnóstico", "Novo");
    marcarFonte("AI");
    clicar(/GERAR (SUGESTÕES|NOVAMENTE)/);
    expect(await screen.findByText("Psoríase em placas")).toBeInTheDocument();
    expect(api.sugerirDiagnosticos).toHaveBeenCalledWith(
      expect.stringContaining("Placas descamativas"),
      ["AI"],
      "",
    );
  });

  it("concluir exige decidir diagnóstico e conduta", async () => {
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    clicar("CONCLUIR EVOLUÇÃO");
    expect(await screen.findByText(/Escolha Manter, Ajustar ou Novo/)).toBeInTheDocument();
    expect(api.registrarProntuario).not.toHaveBeenCalled();
  });

  it("concluir registra um novo prontuário de retorno ligado à consulta anterior", async () => {
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    escolher("Diagnóstico", "Manter");
    escolher("Conduta", "Manter");
    fireEvent.change(screen.getByLabelText(/Anotações/), { target: { value: "ver exames" } });
    clicar("CONCLUIR EVOLUÇÃO");
    expect(await screen.findByText(/Prontuário salvo/)).toBeInTheDocument();
    const enviado = api.registrarProntuario.mock.calls[0][0];
    expect(enviado.tipo).toBe("retorno");
    expect(enviado.retornoDe).toBe("c1");
    expect(enviado.pacienteId).toBe("p1");
    expect(enviado.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(enviado.texto).toContain("CONSULTA PRESENCIAL - RETORNO");
    expect(enviado.texto).toContain("Decisão: mantido\n- Dermatite atópica");
    expect(enviado.texto).toContain("ver exames");
    clicar("VER PRONTUÁRIO DO PACIENTE");
    expect(nav.push).toHaveBeenCalledWith("/pacientes/p1");
    expect(useConsulta.getState().iniciada_em).toBeNull();
  });

  it("falha ao salvar não apaga nada", async () => {
    api.registrarProntuario.mockRejectedValueOnce(new Error("fora"));
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    escolher("Diagnóstico", "Manter");
    escolher("Conduta", "Manter");
    clicar("CONCLUIR EVOLUÇÃO");
    expect(await screen.findByText(/Nada foi apagado/)).toBeInTheDocument();
    expect(useConsulta.getState().iniciada_em).not.toBeNull();
    expect(useConsulta.getState().evolucao.diagnostico).toBe("manter");
  });
});

describe("laudos novos", () => {
  const laudo = () => new File(["%PDF-1.4"], "hemograma.pdf", { type: "application/pdf" });

  it("anexa o laudo, lista com link, vai para o texto do registro e pode ser removido", async () => {
    api.uploadLaudo.mockResolvedValue({ id: "l1", nome: "hemograma.pdf", tipo: "pdf", criado_em: "2026-10-08T12:00:00" });
    api.removerLaudo.mockResolvedValue(undefined);
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    fireEvent.change(screen.getByLabelText("Escolher laudo"), { target: { files: [laudo()] } });
    const link = await screen.findByRole("link", { name: "hemograma.pdf" });
    expect(link.getAttribute("href")).toContain("/laudos/l1/arquivo");
    expect(api.uploadLaudo).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.any(File));
    expect(screen.getByText(/A IA não lê o conteúdo/)).toBeInTheDocument();

    expect(montarEvolucao({ ...useConsulta.getState() }, null)).toContain("LAUDOS NOVOS\n- hemograma.pdf");

    clicar("Remover hemograma.pdf");
    await waitFor(() => expect(screen.queryByRole("link", { name: "hemograma.pdf" })).toBeNull());
    expect(api.removerLaudo).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "l1");
    expect(useConsulta.getState().laudos).toEqual([]);
  });

  it("recusa do servidor aparece e nada é anexado", async () => {
    const { ApiError } = await import("@/lib/api");
    api.uploadLaudo.mockRejectedValueOnce(new ApiError("Envie o laudo em PDF ou em imagem (JPG, PNG).", 415));
    render(<Evolucao />);
    await screen.findByText(/Retorno da consulta de/);
    fireEvent.change(screen.getByLabelText("Escolher laudo"), { target: { files: [laudo()] } });
    expect(await screen.findByText(/Envie o laudo em PDF/)).toBeInTheDocument();
    expect(useConsulta.getState().laudos).toEqual([]);
  });
});
