import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const api = vi.hoisted(() => ({
  sugerirDiagnosticos: vi.fn(),
  gerarHistoria: vi.fn(),
  gerarConduta: vi.fn(),
  gerarInvestigacao: vi.fn(),
  gerarTratamento: vi.fn(),
  gerarOrientacoesTexto: vi.fn(),
  registrarProntuario: vi.fn(),
  listarPreConsultas: vi.fn(),
  obterPaciente: vi.fn(),
  listarReceitas: vi.fn(),
  listarAtestados: vi.fn(),
  listarDeclaracoes: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));

const pdf = vi.hoisted(() => ({
  gerarPdfProntuario: vi.fn(),
  criarPdfProntuario: vi.fn(),
  compartilharPdf: vi.fn(),
}));
vi.mock("@/lib/pdf", async (original) => ({
  ...(await original<typeof import("@/lib/pdf")>()),
  ...pdf,
}));

import Anamnese from "@/app/anamnese/page";
import Diagnostico from "@/app/diagnostico/page";
import Home from "@/app/page";
import Prontuario from "@/app/prontuario/page";
import Historia from "@/app/historia/page";
import Propedeutica from "@/app/propedeutica/page";
import Tratamento from "@/app/tratamento/page";
import { idadeEmAnos } from "@/lib/pacientes";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const abrirJanela = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  api.sugerirDiagnosticos.mockResolvedValue({
    nomes: ["Dermatite atópica", "Eczema numular"],
    probabilidades: [62, 21],
  });
  api.gerarHistoria.mockResolvedValue("Paciente refere prurido há 3 dias.");
  api.gerarConduta.mockResolvedValue("Solicitar biópsia de pele.");
  api.gerarInvestigacao.mockResolvedValue("Biópsia com histopatológico.");
  api.gerarTratamento.mockResolvedValue("Emolientes diariamente.");
  api.gerarOrientacoesTexto.mockResolvedValue("Hidratar a pele e usar protetor solar.");
  api.registrarProntuario.mockResolvedValue({ id: "abc-123", paciente: "Ana", modo: "presencial", criado_em: "2026-10-08T12:00:00" });
  api.listarPreConsultas.mockResolvedValue([]);
  api.listarReceitas.mockResolvedValue([]);
  api.listarAtestados.mockResolvedValue([]);
  api.listarDeclaracoes.mockResolvedValue([]);
  pdf.criarPdfProntuario.mockResolvedValue({ blob: new Blob(["%PDF"]), nome: "prontuario-20261008.pdf" });
  pdf.compartilharPdf.mockResolvedValue("baixado");
  vi.stubGlobal("open", abrirJanela);
  useConsulta.setState(dadosIniciais("dia"));
  localStorage.clear();
  vi.stubGlobal("alert", vi.fn());
});

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));

const marcarFonte = (rotulo: string) => {
  const botao = screen.getByRole("checkbox", { name: rotulo });
  if (botao.getAttribute("aria-checked") !== "true") fireEvent.click(botao);
};

/** O médico marca as fontes automáticas e manda gerar; nada é gerado sozinho. */
const gerar = () => {
  marcarFonte("AI");
  marcarFonte("RAG");
  marcarFonte("Web");
  clicar(/GERAR (SUGESTÕES|NOVAMENTE)/);
};
const TODAS_DIAGNOSTICO = ["AI", "RAG", "Web"];
const TODAS_LISTAS = ["AI", "RAG", "Diretrizes", "Web"];

describe("fluxo", () => {
  it("Atendimento: escolhe o que fazer e segue para a modalidade", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("button", { name: "CONSULTA" })).toBeEnabled());
    clicar("CONSULTA");
    expect(nav.push).toHaveBeenCalledWith("/modalidade?next=%2Fnova-consulta");
    expect(useConsulta.getState().iniciada_em).toBeNull(); // só escolher o que fazer não inicia consulta
  });

  it("Home com consulta em andamento avisa, oferece continuar e não apaga nada", async () => {
    useConsulta.setState({
      modo: "online",
      iniciada_em: Date.now() - 60_000,
      paciente: "Ana",
      etapa_atual: 6,
    });
    useConsulta.getState().toggleDiagnostico("Dermatite atópica");
    render(<Home />);
    expect(await screen.findByText(/Há uma consulta em andamento \(Ana\)/)).toBeInTheDocument();
    expect(screen.queryByText("Retomar consulta?")).toBeNull();
    clicar("CONTINUAR CONSULTA");
    expect(nav.push).toHaveBeenCalledWith("/diagnostico");
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["Dermatite atópica"]);
  });
  it("navegação livre entre etapas e Sair só encerra após confirmar", async () => {
    useConsulta.setState({ modo: "online", iniciada_em: Date.now() });
    render(<Diagnostico />);
    const ir = await screen.findByRole("button", { name: "Ir para a etapa 7" });
    fireEvent.click(ir);
    expect(nav.push).toHaveBeenCalledWith("/propedeutica");
    clicar("Sair");
    clicar("Cancelar");
    expect(useConsulta.getState().modo).toBe("online");
    clicar("Sair");
    clicar("Confirmar");
    expect(useConsulta.getState().modo).toBeNull();
    expect(useConsulta.getState().iniciada_em).toBeNull();
    expect(nav.push).toHaveBeenLastCalledWith("/");
  });

  it("sem consulta iniciada, telas internas voltam à Home", async () => {
    render(<Anamnese />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });

  it("anamnese: continuar só com pelo menos uma forma", async () => {
    useConsulta.setState({ modo: "online" });
    render(<Anamnese />);
    const continuar = await screen.findByRole("button", { name: "CONTINUAR" });
    expect(continuar).toBeDisabled();
    expect(screen.getByText("0 forma(s) selecionada(s)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /POR VOZ/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /TEXTO ESCRITO/ }));
    expect(screen.getByText("2 forma(s) selecionada(s)")).toBeInTheDocument();
    fireEvent.click(continuar);
    expect(useConsulta.getState().anamnese).toEqual({ voz: true, texto: true });
    expect(useConsulta.getState().etapa_atual).toBe(3);
    expect(nav.push).toHaveBeenCalledWith("/captura");
  });

  it("história: editar e salvar edição", async () => {
    useConsulta.setState({ modo: "online" });
    render(<Historia />);
    clicar("EDITAR");
    fireEvent.change(screen.getByLabelText("Editar história clínica"), {
      target: { value: "novo texto" },
    });
    clicar("SALVAR EDIÇÃO");
    expect(useConsulta.getState().historia).toEqual({ texto: "novo texto", editado: true });
    expect(nav.push).toHaveBeenCalledWith("/diagnostico");
  });

  it("diagnóstico: nada é gerado sozinho e a tela não tem rótulos de fonte como botão", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido e placas.", editado: true } });
    render(<Diagnostico />);
    await screen.findByText(/toque em gerar/i);
    expect(api.sugerirDiagnosticos).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "GERAR SUGESTÕES" })).toBeDisabled(); // sem fonte marcada
    for (const f of ["AI", "RAG", "Web", "Diretrizes"]) {
      expect(screen.queryByRole("button", { name: f })).toBeNull(); // fontes são checkbox, não botão
    }
    expect(screen.getAllByRole("checkbox").map((c) => c.textContent)).toEqual(["AI", "RAG", "Open", "Web"]);
  });

  const semFontes = (c: HTMLElement[]) =>
    c.filter((e) => !["AI", "RAG", "Open", "Web"].includes(e.textContent ?? ""));

  it("diagnóstico: nomes na ordem recebida com a estimativa em %, sem etiqueta de fonte", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido e placas.", editado: true } });
    render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    const itens = semFontes(screen.getAllByRole("checkbox")).map((c) => c.textContent);
    expect(itens).toEqual(["Dermatite atópica62%", "Eczema numular21%"]);
    expect(screen.queryByText(/estimativas da IA/)).toBeNull(); // só o pedido: sem avisos
    expect(screen.queryByText("RAG", { selector: "span" })).toBeNull(); // sem etiqueta de fonte
    expect(api.sugerirDiagnosticos).toHaveBeenCalledWith("Prurido e placas.", TODAS_DIAGNOSTICO, "");
  });

  it("diagnóstico: seleção e confirmação sem seleção", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    clicar("CONCLUIR DIAGNÓSTICO");
    expect(
      screen.getByText("Nenhum diagnóstico assinalado. Concluir mesmo assim?"),
    ).toBeInTheDocument();
    clicar("Cancelar");
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Dermatite atópica/ }));
    expect(screen.getByText("1 item(ns) selecionado(s)")).toBeInTheDocument();
    clicar("CONCLUIR DIAGNÓSTICO");
    expect(nav.push).toHaveBeenCalledWith("/propedeutica");
  });

  it("diagnóstico: acrescentar termo livre e avançar", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    clicar("+ ACRESCENTAR");
    fireEvent.change(screen.getByLabelText("Novo item"), { target: { value: "Rosácea" } });
    clicar("Adicionar");
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["Rosácea"]);
    clicar("CONCLUIR DIAGNÓSTICO");
    expect(nav.push).toHaveBeenCalledWith("/propedeutica");
  });

  it("diagnóstico: sem história nem captura não pede nada ao servidor", async () => {
    useConsulta.setState({ modo: "online" });
    render(<Diagnostico />);
    expect(await screen.findByText(/Não há história nem registro da Captura/)).toBeInTheDocument();
    expect(api.sugerirDiagnosticos).not.toHaveBeenCalled();
  });

  it("diagnóstico: usa o registro da Captura quando a história ainda não foi salva", async () => {
    useConsulta.setState({
      modo: "online",
      captura: { audio_duracao: 0, imagens: [], texto: "Mancha na face." },
    });
    render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    expect(api.sugerirDiagnosticos).toHaveBeenCalledWith(
      expect.stringContaining("Mancha na face."),
      TODAS_DIAGNOSTICO,
      "",
    );
  });

  it("diagnóstico: falha do servidor não trava; dá para acrescentar à mão e tentar de novo", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    api.sugerirDiagnosticos.mockRejectedValueOnce(new Error("fora do ar"));
    render(<Diagnostico />);
    gerar();
    expect(await screen.findByText(/Não foi possível gerar sugestões agora/)).toBeInTheDocument();
    clicar("+ ACRESCENTAR");
    fireEvent.change(screen.getByLabelText("Novo item"), { target: { value: "Melasma" } });
    clicar("Adicionar");
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["Melasma"]);
    clicar("GERAR SUGESTÕES");
    await screen.findByText("Dermatite atópica");
    expect(api.sugerirDiagnosticos).toHaveBeenCalledTimes(2);
  });

  it("diagnóstico: voltar à tela mostra o que já foi gerado, sem repetir o pedido", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    const primeira = render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    primeira.unmount();
    render(<Diagnostico />);
    await screen.findByText("Dermatite atópica");
    expect(api.sugerirDiagnosticos).toHaveBeenCalledTimes(1);
  });

  it("diagnóstico: gerar de novo troca a lista", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    render(<Diagnostico />);
    gerar();
    await screen.findByText("Dermatite atópica");
    api.sugerirDiagnosticos.mockResolvedValueOnce({ nomes: ["Rosácea"], probabilidades: [55] });
    clicar("GERAR NOVAMENTE");
    await screen.findByText("Rosácea");
    expect(screen.queryByText("Dermatite atópica")).toBeNull();
    expect(api.sugerirDiagnosticos).toHaveBeenLastCalledWith("Prurido.", TODAS_DIAGNOSTICO, "");
  });

  it("conduta/propedêutica: nada é gerado sozinho; cada campo tem seu próprio botão", async () => {
    useConsulta.setState({
      modo: "online",
      diagnostico: { selecionados: ["Psoríase", "Eczema", "Tinea", "Quarto"] },
    });
    render(<Propedeutica />);
    expect(api.gerarConduta).not.toHaveBeenCalled();
    expect(api.gerarInvestigacao).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "✨ GERAR CONDUTA COM IA" })).toBeDisabled();

    marcarFonte("AI");
    marcarFonte("RAG");
    marcarFonte("Web");

    clicar("✨ GERAR CONDUTA COM IA");
    await screen.findByText("Solicitar biópsia de pele.");
    // até 3 diagnósticos, juntos num texto só
    expect(api.gerarConduta).toHaveBeenCalledWith("Psoríase; Eczema; Tinea", ["AI", "RAG", "Web"], "");

    clicar("✨ GERAR PROPEDÊUTICA COM IA");
    await screen.findByText("Biópsia com histopatológico.");
    expect(api.gerarInvestigacao).toHaveBeenCalledWith(
      "Psoríase; Eczema; Tinea",
      ["AI", "RAG", "Web"],
      "",
    );

    fireEvent.change(screen.getByLabelText("Editar propedêutica"), { target: { value: "Editado à mão." } });
    expect(useConsulta.getState().condutaTratamento.investigacao).toEqual({
      texto: "Editado à mão.",
      editado: true,
    });

    clicar("CONCLUIR CONDUTA / PROPEDÊUTICA");
    expect(nav.push).toHaveBeenCalledWith("/tratamento");
  });

  it("tratamento/orientações: nada é gerado sozinho; cada campo tem seu próprio botão", async () => {
    useConsulta.setState({ modo: "online", diagnostico: { selecionados: ["Psoríase"] } });
    render(<Tratamento />);
    expect(api.gerarTratamento).not.toHaveBeenCalled();
    expect(api.gerarOrientacoesTexto).not.toHaveBeenCalled();

    marcarFonte("AI");

    clicar("✨ GERAR TRATAMENTO COM IA");
    await screen.findByText("Emolientes diariamente.");
    expect(api.gerarTratamento).toHaveBeenCalledWith("Psoríase", ["AI"], "");

    clicar("✨ GERAR ORIENTAÇÕES COM IA");
    await screen.findByText("Hidratar a pele e usar protetor solar.");
    expect(api.gerarOrientacoesTexto).toHaveBeenCalledWith("Psoríase", ["AI"], "");

    clicar("CONCLUIR TRATAMENTO / ORIENTAÇÕES");
    expect(nav.push).toHaveBeenCalledWith("/prontuario");
  });

  it("conduta/propedêutica: Whitebook abre em nova aba e as anotações ficam guardadas", async () => {
    useConsulta.setState({ modo: "online", diagnostico: { selecionados: ["Psoríase"] } });
    const abrir = vi.fn();
    vi.stubGlobal("open", abrir);
    render(<Propedeutica />);
    clicar(/Consultar Whitebook/);
    expect(abrir).toHaveBeenCalledWith(expect.stringContaining("whitebook"), "_blank", "noopener,noreferrer");
    fireEvent.change(screen.getByLabelText(/Anotações/), { target: { value: "trecho colado" } });
    expect(useConsulta.getState().anotacoes.propedeutica).toBe("trecho colado");
    expect(api.gerarConduta).not.toHaveBeenCalled(); // abrir o site ou anotar não gera nada
  });

  it("conduta/propedêutica: sem diagnóstico escolhido, os campos ficam travados mesmo com fonte", async () => {
    useConsulta.setState({ modo: "online" });
    render(<Propedeutica />);
    expect(await screen.findByText(/Nenhum diagnóstico foi escolhido/)).toBeInTheDocument();
    marcarFonte("AI");
    expect(api.gerarConduta).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "✨ GERAR CONDUTA COM IA" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "✨ GERAR PROPEDÊUTICA COM IA" })).toBeDisabled();
  });

  it("conduta: falha da IA não apaga nada e permite escrever à mão", async () => {
    useConsulta.setState({ modo: "online", diagnostico: { selecionados: ["Psoríase"] } });
    api.gerarConduta.mockRejectedValueOnce(new Error("fora"));
    render(<Propedeutica />);
    marcarFonte("AI");
    clicar("✨ GERAR CONDUTA COM IA");
    expect(await screen.findByText(/Não foi possível gerar agora/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Editar conduta"), { target: { value: "Conduta à mão." } });
    expect(useConsulta.getState().condutaTratamento.conduta.texto).toBe("Conduta à mão.");
  });
  it("prontuário: REGISTRAR gera o PDF, guarda no servidor, diz onde ficou e só então encerra", async () => {
    useConsulta.setState({
      modo: "presencial",
      paciente: "Ana",
      pacienteId: "p1",
      sessionId: "11111111-1111-4111-8111-111111111111",
      historia: { texto: "Hist X", editado: false },
      diagnostico: { selecionados: ["Dermatite atópica"] },
      captura: { audio_duracao: 0, imagens: ["foto.png"], texto: "" },
    });
    render(<Prontuario />);
    await screen.findByText(/CONSULTA PRESENCIAL/);
    expect(screen.getByText("foto.png")).toBeInTheDocument();

    clicar("REGISTRAR E SALVAR PDF");
    expect(await screen.findByText(/Prontuário salvo/)).toBeInTheDocument();
    expect(pdf.criarPdfProntuario).toHaveBeenCalledTimes(1);
    const enviado = api.registrarProntuario.mock.calls[0][0];
    expect(enviado.paciente).toBe("Ana");
    expect(enviado.modo).toBe("presencial");
    expect(enviado.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(enviado.texto).toContain("Dermatite atópica");
    expect(screen.getByText(/adicionado ao prontuário do paciente/)).toBeInTheDocument(); // diz onde ficou
    expect(enviado.pacienteId).toBe("p1");
    expect(useConsulta.getState().modo).toBe("presencial"); // ainda não apagou nada

    clicar("ABRIR PDF");
    expect(abrirJanela).toHaveBeenCalledWith(expect.stringContaining("/prontuarios/abc-123/pdf"), "_blank", "noopener");
    clicar("VER PRONTUÁRIO DO PACIENTE");
    expect(useConsulta.getState().modo).toBeNull();
    expect(nav.push).toHaveBeenCalledWith("/pacientes/p1");
  });

  it("prontuário: se o servidor falhar, NADA é apagado e dá para guardar uma cópia do PDF", async () => {
    useConsulta.setState({ modo: "presencial", diagnostico: { selecionados: ["Dermatite atópica"] } });
    api.registrarProntuario.mockRejectedValueOnce(new Error("fora"));
    render(<Prontuario />);
    await screen.findByText(/CONSULTA PRESENCIAL/);
    clicar("REGISTRAR E SALVAR PDF");
    expect(await screen.findByText(/Não foi possível salvar o prontuário no servidor/)).toBeInTheDocument();
    expect(useConsulta.getState().modo).toBe("presencial");
    expect(screen.queryByText(/Prontuário salvo/)).toBeNull();
    clicar("OK");
    clicar(/COMPARTILHAR/);
    await waitFor(() => expect(pdf.compartilharPdf).toHaveBeenCalledTimes(1));
    clicar("REGISTRAR E SALVAR PDF"); // tenta de novo
    expect(await screen.findByText(/Prontuário salvo/)).toBeInTheDocument();
    expect(pdf.criarPdfProntuario).toHaveBeenCalledTimes(1); // reaproveita o mesmo PDF
  });

  it("ANEXOS: atestados, declarações, receitas desta consulta, laudos, escalas e registro bruto, cada um em sua caixinha", async () => {
    const inicio = new Date("2026-10-08T10:00:00Z").getTime();
    api.listarReceitas.mockResolvedValue([
      {
        id: "r1",
        paciente_id: "p1",
        paciente: "Ana",
        itens: [{ medicamento: "Dipirona 500mg", posologia: "1cp 8/8h", duracao: "", quantidade: "" }],
        observacoes: "",
        medico_nome: "Dr. João",
        medico_crm: "123/SP",
        criado_em: "2026-10-08T11:00:00Z",
      },
      {
        id: "r0",
        paciente_id: "p1",
        paciente: "Ana",
        itens: [{ medicamento: "Receita antiga", posologia: "x", duracao: "", quantidade: "" }],
        observacoes: "",
        medico_nome: "Dr. João",
        medico_crm: "123/SP",
        criado_em: "2026-09-01T11:00:00Z", // antes desta consulta: não entra
      },
    ]);
    api.listarAtestados.mockResolvedValue([
      {
        id: "a1",
        paciente_id: "p1",
        paciente: "Ana",
        conteudo: { dias_afastamento: 3, data_inicial: "2026-10-08", cidade: "São Paulo", cid: null },
        medico_nome: "Dr. João",
        medico_crm: "123/SP",
        criado_em: "2026-10-08T11:30:00Z",
      },
    ]);
    api.listarDeclaracoes.mockResolvedValue([
      {
        id: "d1",
        paciente_id: "p1",
        paciente: "Ana",
        conteudo: { data: "2026-10-08", hora_inicio: "09:00", hora_fim: "10:00", cidade: "São Paulo" },
        medico_nome: "Dr. João",
        medico_crm: "123/SP",
        criado_em: "2026-10-08T11:30:00Z",
      },
    ]);
    useConsulta.setState({
      modo: "presencial",
      paciente: "Ana",
      pacienteId: "p1",
      iniciada_em: inicio,
    });
    useConsulta.getState().addLaudo({ id: "l1", nome: "exame-sangue.pdf" });
    render(<Prontuario />);
    await screen.findByText(/CONSULTA PRESENCIAL/);

    expect(api.listarReceitas).toHaveBeenCalledWith("p1");
    expect(await screen.findByText(/Dipirona 500mg/)).toBeInTheDocument();
    expect(screen.queryByText(/Receita antiga/)).toBeNull(); // de antes do início desta consulta
    expect(screen.getByRole("button", { name: "+ EMITIR RECEITA" })).toBeInTheDocument();

    expect(api.listarAtestados).toHaveBeenCalledWith("p1");
    expect(await screen.findByText(/3 dia\(s\) a partir de 08\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ EMITIR ATESTADO" })).toBeInTheDocument();

    expect(api.listarDeclaracoes).toHaveBeenCalledWith("p1");
    expect(await screen.findByText(/comparecimento 08\/10\/2026 09:00–10:00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ EMITIR DECLARAÇÃO" })).toBeInTheDocument();

    expect(screen.getByText("exame-sangue.pdf")).toBeInTheDocument();

    // dermatologia (especialidade padrão do build) não define escalas clínicas: a caixinha avisa.
    expect(screen.getByText("Nenhuma escala aplicada nesta consulta.")).toBeInTheDocument();
  });
  it("história mostra o que foi capturado (nunca um texto fictício) e só usa a IA se o médico pedir", async () => {
    useConsulta.setState({
      modo: "online",
      captura: { audio_duracao: 0, imagens: [], texto: "Cefaleia há 2 dias, sem febre." },
    });
    render(<Historia />);
    expect(await screen.findByText(/Cefaleia há 2 dias, sem febre\./)).toBeInTheDocument();
    expect(screen.queryByText(/Paciente do sexo feminino/)).toBeNull();
    expect(api.gerarHistoria).not.toHaveBeenCalled();
  });

  it("história: GERAR HISTÓRIA COM IA reescreve o registro e o texto fica editável e preservado", async () => {
    useConsulta.setState({
      modo: "online",
      captura: { audio_duracao: 0, imagens: [], texto: "Coceira há 3 dias." },
    });
    render(<Historia />);
    await screen.findByText(/Coceira há 3 dias\./);
    clicar(/GERAR HISTÓRIA COM IA/);
    expect(
      await screen.findByText("Paciente refere prurido há 3 dias. Exame físico: Não relatado."),
    ).toBeInTheDocument();
    expect(api.gerarHistoria).toHaveBeenCalledWith(expect.stringContaining("Coceira há 3 dias."));
    clicar("SALVAR");
    expect(useConsulta.getState().historia).toEqual({
      texto: "Paciente refere prurido há 3 dias.\nExame físico: Não relatado.",
      editado: true,
    });
  });

  it("história: AI monta 5 seções — Identificação e Exame físico vêm do cadastro, nunca do modelo", async () => {
    api.obterPaciente.mockResolvedValue({
      id: "p1",
      nome: "Ana",
      nascimento: "1990-01-01",
      n_prontuarios: 1,
      ultima_consulta: null,
      consultas: [],
      cpf: null,
      sexo: "Feminino",
      contato: null,
      profissao: "Professora",
      moradia: null,
      plano_saude: null,
      historico_familiar: null,
      medicacoes_uso: null,
      alergias: null,
    });
    useConsulta.setState({
      modo: "online",
      pacienteId: "p1",
      captura: { audio_duracao: 0, imagens: [], texto: "Coceira há 3 dias." },
      exameFisico: { texto: "Placas eritematosas em cotovelos." },
    });
    render(<Historia />);
    await screen.findByText(/Coceira há 3 dias\./);
    clicar(/GERAR HISTÓRIA COM IA/);
    const idade = idadeEmAnos("1990-01-01");
    const bloco = await screen.findByText((t) => t.includes("Identificação:"));
    expect(bloco).toHaveTextContent(`Identificação: ${idade} anos, sexo feminino, profissão professora.`);
    expect(bloco).toHaveTextContent("Paciente refere prurido há 3 dias.");
    expect(bloco).toHaveTextContent("Exame físico: Placas eritematosas em cotovelos.");
  });

  it("história: toggle OPEN cola o texto manualmente, sem chamar a IA", async () => {
    useConsulta.setState({
      modo: "online",
      captura: { audio_duracao: 0, imagens: [], texto: "Coceira há 3 dias." },
    });
    render(<Historia />);
    await screen.findByText(/Coceira há 3 dias\./);
    fireEvent.click(screen.getByRole("radio", { name: "OPEN" }));
    expect(screen.queryByRole("button", { name: /GERAR HISTÓRIA COM IA/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Colar história (OpenEvidence ou outra fonte)"), {
      target: { value: "Paciente com prurido há 3 dias, sem outros sintomas." },
    });
    clicar("USAR ESTE TEXTO");
    expect(
      await screen.findByText("Paciente com prurido há 3 dias, sem outros sintomas."),
    ).toBeInTheDocument();
    expect(api.gerarHistoria).not.toHaveBeenCalled();
    clicar("SALVAR");
    expect(useConsulta.getState().historia).toEqual({
      texto: "Paciente com prurido há 3 dias, sem outros sintomas.",
      editado: true,
    });
  });

  it("história: falha da IA não apaga nada e permite editar à mão; sem captura o botão fica travado", async () => {
    useConsulta.setState({
      modo: "online",
      captura: { audio_duracao: 0, imagens: [], texto: "Coceira." },
    });
    api.gerarHistoria.mockRejectedValueOnce(new Error("fora"));
    const { unmount } = render(<Historia />);
    await screen.findByText(/Coceira\./);
    clicar(/GERAR HISTÓRIA COM IA/);
    expect(await screen.findByText(/Não foi possível gerar a história agora/)).toBeInTheDocument();
    expect(screen.getByText(/Coceira\./)).toBeInTheDocument();
    unmount();
    useConsulta.setState({ captura: { audio_duracao: 0, imagens: [], texto: "" } });
    render(<Historia />);
    expect(await screen.findByRole("button", { name: /GERAR HISTÓRIA COM IA/ })).toBeDisabled();
  });

  it("diagnóstico: sem escolha de fontes; Whitebook abre em nova aba; anotações ficam guardadas", async () => {
    useConsulta.setState({ modo: "online", historia: { texto: "Prurido.", editado: true } });
    const abrir = vi.fn();
    vi.stubGlobal("open", abrir);
    render(<Diagnostico />);
    await screen.findByRole("button", { name: "GERAR SUGESTÕES" });
    for (const f of ["AI", "RAG", "Web", "Diretrizes"]) {
      expect(screen.queryByRole("button", { name: f })).toBeNull();
    }
    clicar(/Consultar Whitebook/);
    expect(abrir).toHaveBeenCalledWith(expect.any(String), "_blank", "noopener,noreferrer");
    fireEvent.change(screen.getByLabelText(/Anotações/), { target: { value: "do Whitebook" } });
    expect(useConsulta.getState().anotacoes.diagnostico).toBe("do Whitebook");
    expect(api.sugerirDiagnosticos).not.toHaveBeenCalled();
    gerar();
    await screen.findByText("Dermatite atópica");
    expect(api.sugerirDiagnosticos).toHaveBeenCalledWith("Prurido.", TODAS_DIAGNOSTICO, "");
  });

  it("história sem captura mostra aviso de vazio, não texto de exemplo", async () => {
    useConsulta.setState({ modo: "online" });
    render(<Historia />);
    expect(await screen.findByText(/Nada foi registrado na Captura/)).toBeInTheDocument();
  });

  it("história: pré-consulta do paciente entra junto do registro, mesmo sem captura", async () => {
    api.listarPreConsultas.mockResolvedValue([
      {
        id: "pc1",
        respostas: {
          queixa: { queixa_principal: "Manchas no rosto", duracao_queixa: "meses", ja_tratou_antes: false, categorias: [] },
          historico: { exposicao_solar: false, tipo_exposicao: null, queimadura_solar_infancia: false, uso_camara_bronzeamento: false, frequencia_protetor_solar: "nunca", fps_habitual: null, fototipo_fitzpatrick: 2, historico_familiar_cancer_pele: false, quem_historico_familiar: "", melanoma_familiar: false, outras_doencas_familia: [] },
          saude: { alergias: false, tipos_alergia: [], descricao_alergia: "", medicamentos_uso_continuo: false, lista_medicamentos: "", comorbidades: [], tabagismo: "nunca", etilismo: "nunca", atividade_fisica: "nenhuma", gestante: null, amamentando: null, uso_anticoncepcional: null },
          estetica: { procedimentos_anteriores: [], tempo_ultimo_procedimento: "", teve_complicacao: false, descricao_complicacao: "", usa_acidos: false, produtos_skincare: "", tratamento_em_andamento: false },
          seguranca: { historico_herpes_simples: false, tendencia_queloide: false, possui_marcapasso_ou_implante_metalico: false, quimica_capilar_recente: false, alergia_anestesico: false, usa_anticoagulante: false },
          consentimento: { aceite_informacoes_verdadeiras: true, autoriza_imagens_prontuario: true, autoriza_imagens_cientificas: false, aceite_lgpd: true, nome_assinatura: "Ana" },
        },
      },
    ]);
    useConsulta.setState({ modo: "online", pacienteId: "p1" });
    render(<Historia />);
    expect(await screen.findByText(/Manchas no rosto/)).toBeInTheDocument();
    expect(screen.getByText(/PRÉ-CONSULTA \(preenchida pelo paciente\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Nada foi registrado na Captura/)).toBeNull();
  });

  it("história acompanha a captura enquanto não editada, mas preserva a edição do médico", async () => {
    useConsulta.setState({
      modo: "online",
      historia: { texto: "texto antigo salvo sem edição", editado: false },
      captura: { audio_duracao: 0, imagens: [], texto: "Texto novo da captura." },
    });
    const { unmount } = render(<Historia />);
    expect(
      await screen.findByText("ANAMNESE (texto digitado)", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/texto antigo/)).toBeNull();
    unmount();

    useConsulta.setState({ historia: { texto: "Minha redação final.", editado: true } });
    render(<Historia />);
    expect(await screen.findByText("Minha redação final.")).toBeInTheDocument();
    clicar("REFAZER A PARTIR DA CAPTURA");
    clicar("Confirmar");
    expect(screen.getByText(/Texto novo da captura\./)).toBeInTheDocument();
  });

  it("tela 6 (diagnóstico) não traz avisos nem ressalvas: só o que foi pedido", async () => {
    useConsulta.setState({ modo: "online" });
    const { unmount } = render(<Diagnostico />);
    expect(await screen.findByRole("button", { name: "GERAR SUGESTÕES" })).toBeInTheDocument();
    expect(screen.queryByText(/podem conter erros|revise cada item/)).toBeNull();
    expect(screen.queryByText(/LISTA DE EXEMPLO/)).toBeNull();
    unmount();
  });

  it("tela 7 (conduta/propedêutica) não traz avisos nem ressalvas: só o que foi pedido", async () => {
    useConsulta.setState({ modo: "online" });
    const { unmount } = render(<Propedeutica />);
    expect(await screen.findByRole("button", { name: "✨ GERAR CONDUTA COM IA" })).toBeInTheDocument();
    expect(screen.queryByText(/podem conter erros|revise cada item/)).toBeNull();
    expect(screen.queryByText(/LISTA DE EXEMPLO/)).toBeNull();
    unmount();
  });

  it("Home avisa quando há consulta em andamento", async () => {
    useConsulta.setState({ modo: "online", iniciada_em: Date.now() - 5 * 60_000 });
    render(<Home />);
    expect(await screen.findByText(/Há uma consulta em andamento/)).toBeInTheDocument();
  });
});
