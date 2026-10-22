import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useParams: () => ({ id: "p1" }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const api = vi.hoisted(() => ({
  listarPacientes: vi.fn(),
  cadastrarPaciente: vi.fn(),
  corrigirPaciente: vi.fn(),
  obterPaciente: vi.fn(),
  obterProntuario: vi.fn(),
  obterProntuarioDoPaciente: vi.fn(),
  listarPreConsultas: vi.fn(),
  enviarPreConsulta: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  ...api,
}));

import { ConsultaAnterior } from "@/components/ConsultaAnterior";
import Ficha from "@/app/pacientes/[id]/page";
import Home from "@/app/page";
import Modalidade from "@/app/modalidade/page";
import PreConsulta from "@/app/pacientes/[id]/pre-consulta/page";
import Prontuarios from "@/app/prontuarios/page";
import NovoPaciente from "@/app/paciente/novo/page";
import NovaConsulta from "@/app/nova-consulta/page";
import Retorno from "@/app/retorno/page";
import { formatarCpf, idadeEmAnos } from "@/lib/pacientes";
import { textoDoHistorico } from "@/lib/prontuario";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const ANA = {
  id: "p1",
  nome: "Ana Souza",
  nascimento: "1980-05-17",
  n_prontuarios: 2,
  ultima_consulta: "2026-10-01T12:00:00",
};
const BRUNO = { id: "p2", nome: "Bruno Lima", nascimento: null, n_prontuarios: 0, ultima_consulta: null };
const FICHA = {
  cpf: "52998224725",
  sexo: "feminino",
  alergias: "dipirona",
  contato: null,
  profissao: null,
  moradia: null,
  plano_saude: null,
  historico_familiar: null,
  medicacoes_uso: null,
};
const DETALHE = {
  ...ANA,
  ...FICHA,
  consultas: [
    { id: "c2", modo: "presencial", tipo: "retorno", criado_em: "2026-10-01T12:00:00" },
    { id: "c1", modo: "online", tipo: "nova", criado_em: "2026-09-01T10:00:00" },
  ],
};
const PRONTUARIO = {
  paciente: DETALHE,
  registros: [
    {
      id: "c1",
      rotulo: "Consulta 1",
      tipo: "nova",
      modo: "online",
      criado_em: "2026-09-01T10:00:00",
      corrigido_em: null,
      texto: "CONSULTA ONLINE\n- Dermatite",
    },
    {
      id: "c2",
      rotulo: "Retorno 1",
      tipo: "retorno",
      modo: "presencial",
      criado_em: "2026-10-01T12:00:00",
      corrigido_em: "2026-10-02T08:00:00",
      texto: "CONSULTA PRESENCIAL - RETORNO\n- Psoríase",
    },
  ],
};

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.pushState({}, "", "/");
  useConsulta.setState({ ...dadosIniciais("dia"), modo: "presencial" }); // o modo vem da Home
  api.listarPacientes.mockResolvedValue([ANA, BRUNO]);
  api.obterPaciente.mockImplementation(async (id: string) =>
    id === "p1" ? DETALHE : { ...BRUNO, ...FICHA, consultas: [] },
  );
  api.cadastrarPaciente.mockResolvedValue({ ...BRUNO, id: "novo", nome: "Carla Dias" });
  api.corrigirPaciente.mockResolvedValue(ANA);
  api.obterProntuarioDoPaciente.mockResolvedValue(PRONTUARIO);
  api.listarPreConsultas.mockResolvedValue([]);
  api.obterProntuario.mockResolvedValue({
    id: "c2",
    paciente: "Ana Souza",
    modo: "presencial",
    criado_em: "2026-10-01T12:00:00",
    texto: "CONSULTA PRESENCIAL\n- Psoríase",
  });
});

describe("Atendimento: escolhe o que fazer", () => {
  it("cada opção leva à escolha da modalidade com o destino certo", async () => {
    useConsulta.setState({ ...dadosIniciais("dia") });
    render(<Home />);
    const itens: [string, string][] = [
      ["NOVO PACIENTE", "/paciente/novo"],
      ["CONSULTA", "/nova-consulta"],
      ["RETORNO", "/retorno"],
    ];
    for (const [nome, rota] of itens) {
      clicar(nome);
      expect(nav.push).toHaveBeenLastCalledWith(`/modalidade?next=${encodeURIComponent(rota)}`);
    }
  });
});

describe("Modalidade: escolhe ONLINE/PRESENCIAL", () => {
  it("define o modo e segue para o destino escolhido no Atendimento", async () => {
    window.history.pushState({}, "", "/modalidade?next=%2Fpaciente%2Fnovo");
    useConsulta.setState({ ...dadosIniciais("dia") }); // sem modo ainda
    render(<Modalidade />);
    await waitFor(() => expect(screen.getByRole("button", { name: "ONLINE" })).toBeEnabled());
    clicar("ONLINE");
    expect(useConsulta.getState().modo).toBe("online");
    expect(nav.push).toHaveBeenLastCalledWith("/paciente/novo");
  });

  it("com consulta em andamento não troca o modo da consulta", async () => {
    window.history.pushState({}, "", "/modalidade?next=%2Fnova-consulta");
    useConsulta.setState({ modo: "online", iniciada_em: Date.now() - 1000, paciente: "Ana" });
    render(<Modalidade />);
    await waitFor(() => expect(screen.getByRole("button", { name: "PRESENCIAL" })).toBeEnabled());
    clicar("PRESENCIAL");
    expect(useConsulta.getState().modo).toBe("online");
    expect(nav.push).toHaveBeenLastCalledWith("/nova-consulta");
  });

  it("sem destino (next), volta para o Atendimento", async () => {
    window.history.pushState({}, "", "/modalidade");
    useConsulta.setState({ ...dadosIniciais("dia") });
    render(<Modalidade />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });
});

describe("prontuário: busca o paciente", () => {
  it("lista com idade e número de consultas; busca pelo nome ou CPF; abre o histórico", async () => {
    render(<Prontuarios />);
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText(/2 consulta\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/sem consultas/)).toBeInTheDocument();
    expect(screen.queryByText("+ CADASTRAR PACIENTE NOVO")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Digite parte do nome ou CPF"), { target: { value: "529" } });
    await waitFor(() => expect(api.listarPacientes).toHaveBeenLastCalledWith("529"));
    fireEvent.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    expect(nav.push).toHaveBeenCalledWith("/pacientes/p1");
  });
});

describe("novo paciente", () => {
  it("cadastro completo (nome obrigatório) e, ao salvar, começa a Consulta 1", async () => {
    render(<NovoPaciente />);
    expect(screen.getByLabelText("CPF")).toBeInTheDocument(); // já abre completo
    clicar("SALVAR E INICIAR CONSULTA");
    expect(await screen.findByText(/Digite o nome do paciente\./)).toBeInTheDocument();
    expect(api.cadastrarPaciente).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: " Carla Dias " } });
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), { target: { value: "1990-02-03" } });
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "52998224725" } });
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    fireEvent.change(screen.getByLabelText("Alergias"), { target: { value: "dipirona" } });
    clicar("SALVAR E INICIAR CONSULTA");
    await waitFor(() => expect(api.cadastrarPaciente).toHaveBeenCalledTimes(1));
    expect(api.cadastrarPaciente.mock.calls[0][0]).toMatchObject({
      nome: " Carla Dias ",
      nascimento: "1990-02-03",
      cpf: "529.982.247-25",
      alergias: "dipirona",
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/anamnese"));
    const s = useConsulta.getState();
    expect(s.pacienteId).toBe("novo");
    expect(s.paciente).toBe("Carla Dias");
    expect(s.tipo).toBe("nova");
    expect(s.modo).toBe("presencial"); // o da Home
    expect(s.iniciada_em).not.toBeNull();
  });

  it("CPF repetido avisa e não começa a consulta", async () => {
    const { ApiError } = await import("@/lib/api");
    api.cadastrarPaciente.mockRejectedValueOnce(new ApiError("Já existe um paciente com este CPF.", 409));
    render(<NovoPaciente />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Carla Dias" } });
    clicar("SALVAR E INICIAR CONSULTA");
    expect(await screen.findByText(/Já existe um paciente com este CPF/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
    expect(useConsulta.getState().iniciada_em).toBeNull();
  });

  it("com consulta em andamento não deixa começar outra", async () => {
    useConsulta.setState({ iniciada_em: Date.now() - 5000, etapa_atual: 4 });
    render(<NovoPaciente />);
    expect(await screen.findByText(/Há uma consulta em andamento/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).toBeNull();
  });
});

describe("prontuário cronológico do paciente", () => {
  it("mostra os registros do mais antigo ao mais recente, com rótulo, data e correção", async () => {
    render(<Ficha />);
    expect(await screen.findByText("Consulta 1")).toBeInTheDocument();
    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(["Consulta 1", "Retorno 1"]);
    expect(screen.getByText(/Dermatite/)).toBeInTheDocument();
    expect(screen.getByText(/corrigido em/)).toBeInTheDocument();
    expect(api.obterProntuarioDoPaciente).toHaveBeenCalledWith("p1");
  });

  it("dados do paciente: mostrar/ocultar e corrigir o cadastro", async () => {
    api.corrigirPaciente.mockResolvedValue(ANA);
    render(<Ficha />);
    await screen.findByText("Consulta 1");
    expect(screen.queryByText("dipirona")).toBeNull(); // começam ocultos
    clicar("MOSTRAR DADOS DO PACIENTE");
    expect(screen.getByText("dipirona")).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    clicar("CORRIGIR CADASTRO");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    fireEvent.change(screen.getByLabelText("Alergias"), { target: { value: "latex" } });
    clicar("SALVAR CORREÇÃO");
    await waitFor(() => expect(api.corrigirPaciente).toHaveBeenCalledTimes(1));
    expect(api.corrigirPaciente.mock.calls[0][0]).toBe("p1");
    expect(api.corrigirPaciente.mock.calls[0][1]).toMatchObject({ alergias: "latex", cpf: "529.982.247-25" });
    await waitFor(() => expect(screen.queryByText("SALVAR CORREÇÃO")).toBeNull());
  });

  it("cada registro tem EDITAR e o histórico tem EXPORTAR PDF", async () => {
    render(<Ficha />);
    await screen.findByText("Consulta 1");
    expect(screen.getAllByRole("link", { name: /EDITAR/ }).map((a) => a.getAttribute("href"))).toEqual([
      "/prontuarios/c1?editar=1",
      "/prontuarios/c2?editar=1",
    ]);
    expect(screen.getByRole("button", { name: "EXPORTAR PDF" })).toBeEnabled();
  });

  it("paciente sem registros mostra aviso e não oferece exportar", async () => {
    api.obterProntuarioDoPaciente.mockResolvedValue({ paciente: { ...DETALHE, consultas: [] }, registros: [] });
    render(<Ficha />);
    expect(await screen.findByText(/Nenhum registro ainda/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EXPORTAR PDF" })).toBeNull();
  });

  it("texto do histórico junta os registros em ordem, com rótulo e data", () => {
    const t = textoDoHistorico(PRONTUARIO.registros);
    expect(t.indexOf("CONSULTA 1 - ")).toBeLessThan(t.indexOf("RETORNO 1 - "));
    expect(t).toContain("- Dermatite");
    expect(t).toContain("- Psoríase");
  });

  it("máscara do CPF e idade em anos", () => {
    expect(formatarCpf("5299")).toBe("529.9");
    expect(formatarCpf("52998224725999")).toBe("529.982.247-25");
    expect(formatarCpf("")).toBe("");
    const hoje = new Date(2026, 9, 8); // 08/10/2026
    expect(idadeEmAnos("1980-10-08", hoje)).toBe(46);
    expect(idadeEmAnos("1980-10-09", hoje)).toBe(45);
    expect(idadeEmAnos(null, hoje)).toBeNull();
    expect(idadeEmAnos("2030-01-01", hoje)).toBeNull();
  });
});

describe("nova consulta e retorno", () => {
  it("nova consulta: escolhe o paciente, vê 'Consulta N' e começa com o modo da Home", async () => {
    render(<NovaConsulta />);
    fireEvent.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    expect(await screen.findByText("Trocar paciente")).toBeInTheDocument();
    expect(screen.getByText("Consulta 2")).toBeInTheDocument(); // já teve 1 consulta nova
    expect(screen.queryByText("Retorno de qual consulta?")).toBeNull();
    expect(screen.queryByRole("button", { name: "ONLINE" })).toBeNull(); // o modo já foi escolhido
    await waitFor(() => expect(screen.getByRole("button", { name: "INICIAR CONSULTA" })).toBeEnabled());
    clicar("INICIAR CONSULTA");
    const s = useConsulta.getState();
    expect(s.modo).toBe("presencial");
    expect(s.paciente).toBe("Ana Souza");
    expect(s.pacienteId).toBe("p1");
    expect(s.tipo).toBe("nova");
    expect(s.retornoDe).toBeNull();
    expect(s.iniciada_em).not.toBeNull();
    expect(nav.push).toHaveBeenCalledWith("/anamnese");
  });

  it("nova consulta não oferece cadastrar paciente (isso é 'Novo paciente')", async () => {
    render(<NovaConsulta />);
    await screen.findByText("Ana Souza");
    expect(screen.queryByText("+ CADASTRAR PACIENTE NOVO")).toBeNull();
  });

  it("retorno: paciente -> escolhe EVOLUÇÃO, pede a consulta anterior e liga a ela", async () => {
    render(<Retorno />);
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Lima")).toBeNull(); // sem consulta salva não faz retorno
    fireEvent.click(screen.getByRole("button", { name: /Ana Souza/ }));
    expect(await screen.findByRole("button", { name: "EVOLUÇÃO / RETORNO" })).toBeInTheDocument();
    expect(screen.queryByText("Retorno de qual consulta?")).toBeNull(); // só depois de escolher EVOLUÇÃO
    clicar("EVOLUÇÃO / RETORNO");
    expect(await screen.findByText("Retorno de qual consulta?")).toBeInTheDocument();
    const opcoes = screen.getAllByRole("radio");
    expect(opcoes).toHaveLength(2);
    expect(opcoes[0]).toHaveAttribute("aria-checked", "true"); // a mais recente já vem marcada
    fireEvent.click(opcoes[1]);
    clicar("INICIAR RETORNO");
    const s = useConsulta.getState();
    expect(s.tipo).toBe("retorno");
    expect(s.retornoDe).toBe("c1");
    expect(s.pacienteId).toBe("p1");
    expect(nav.push).toHaveBeenCalledWith("/evolucao"); // retorno = tela única de Evolução
  });

  it("retorno: paciente -> VER PRONTUÁRIO vai direto à ficha, sem passar pela Evolução", async () => {
    render(<Retorno />);
    fireEvent.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    fireEvent.click(await screen.findByRole("button", { name: "VER PRONTUÁRIO" }));
    expect(nav.push).toHaveBeenCalledWith("/pacientes/p1");
    expect(useConsulta.getState().iniciada_em).toBeNull(); // só visualizar não começa consulta
  });

  it("vindo do histórico (?paciente=), já entra com o paciente escolhido", async () => {
    window.history.pushState({}, "", "/retorno?paciente=p1");
    render(<Retorno />);
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "EVOLUÇÃO / RETORNO" })).toBeInTheDocument();
  });

  it("com consulta em andamento não começa outra: oferece continuar", async () => {
    useConsulta.setState({ modo: "online", iniciada_em: Date.now() - 5000, etapa_atual: 5 });
    render(<NovaConsulta />);
    expect(await screen.findByText(/Há uma consulta em andamento/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Digite parte do nome ou CPF")).toBeNull();
    clicar("CONTINUAR CONSULTA EM ANDAMENTO");
    expect(nav.push).toHaveBeenCalledWith("/historia");
  });

  it("sem o modo da Home, volta à Home", async () => {
    useConsulta.setState({ modo: null });
    render(<NovaConsulta />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });

  it("falha ao abrir o paciente avisa sem travar", async () => {
    api.obterPaciente.mockRejectedValueOnce(new Error("fora"));
    render(<NovaConsulta />);
    fireEvent.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    expect(await screen.findByText(/Não foi possível abrir o paciente/)).toBeInTheDocument();
  });
});

function marcarSim(rotulo: RegExp) {
  const grupo = screen.getByRole("radiogroup", { name: rotulo });
  fireEvent.click(within(grupo).getByRole("radio", { name: "Sim" }));
}

describe("pré-consulta", () => {
  const SEM_RISCO = {
    id: "pc1",
    paciente_id: "p1",
    especialidade: "dermatologia",
    alerta_critico: false,
    criado_em: "2026-10-16T09:00:00",
    respostas: { seguranca: { historico_herpes_simples: false, tendencia_queloide: false, possui_marcapasso_ou_implante_metalico: false } },
  };
  const COM_RISCO = {
    ...SEM_RISCO,
    id: "pc2",
    alerta_critico: true,
    respostas: { seguranca: { historico_herpes_simples: true, tendencia_queloide: false, possui_marcapasso_ou_implante_metalico: false } },
  };

  it("ficha do paciente: sem pré-consulta crítica, não mostra alerta, mas mostra o link", async () => {
    render(<Ficha />);
    await screen.findByText("Consulta 1");
    expect(screen.queryByText(/ALERTA CRÍTICO/)).toBeNull();
    expect(screen.getByRole("link", { name: "PRÉ-CONSULTA" })).toHaveAttribute(
      "href",
      "/pacientes/p1/pre-consulta",
    );
  });

  it("ficha do paciente: pré-consulta com risco mostra o alerta com o motivo", async () => {
    api.listarPreConsultas.mockResolvedValue([COM_RISCO]);
    render(<Ficha />);
    await screen.findByText("Consulta 1");
    expect(await screen.findByText(/ALERTA CRÍTICO DE SEGURANÇA/)).toBeInTheDocument();
    expect(screen.getByText(/Histórico de herpes simples/)).toBeInTheDocument();
    expect(screen.queryByText(/Tendência a queloide/)).toBeNull(); // só o risco marcado
  });

  it("preenche o wizard de 7 etapas (identificação já carregada) e envia a ficha", async () => {
    api.enviarPreConsulta.mockResolvedValue({ id: "pc3", alerta_critico: true });
    render(<PreConsulta />);
    expect(await screen.findByText("IDENTIFICAÇÃO")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza"); // já carregado do cadastro
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 1 (identificação) -> 2

    fireEvent.change(await screen.findByLabelText(/O que trouxe você à consulta/), {
      target: { value: "Manchas no rosto" },
    });
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 2 -> 3
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 3 -> 4
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 4 -> 5
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 5 -> 6
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // 6 -> 7
    expect(await screen.findByText("CONSENTIMENTO")).toBeInTheDocument();

    const enviar = screen.getByRole("button", { name: "ENVIAR FICHA" });
    expect(enviar).toBeDisabled(); // sem os aceites obrigatórios

    marcarSim(/Declaro que as informações/);
    marcarSim(/Li e aceito os termos de privacidade/);
    fireEvent.change(screen.getByLabelText(/Nome completo \(assinatura digital\)/), {
      target: { value: "Ana Souza" },
    });
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);

    expect(await screen.findByText("✅ Ficha enviada")).toBeInTheDocument();
    expect(api.corrigirPaciente).toHaveBeenCalledWith("p1", expect.objectContaining({ nome: "Ana Souza" }));
    expect(api.enviarPreConsulta).toHaveBeenCalledTimes(1);
    expect(api.enviarPreConsulta.mock.calls[0][0]).toBe("p1");
    const enviado = api.enviarPreConsulta.mock.calls[0][1];
    expect(enviado.queixa.queixa_principal).toBe("Manchas no rosto");
    expect(enviado.consentimento.aceite_lgpd).toBe(true);
  });

  it("falha ao enviar mostra aviso e não perde o preenchimento", async () => {
    api.enviarPreConsulta.mockRejectedValueOnce(new Error("fora"));
    render(<PreConsulta />);
    await screen.findByText("IDENTIFICAÇÃO");
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" })); // identificação -> queixa
    fireEvent.change(await screen.findByLabelText(/O que trouxe você à consulta/), {
      target: { value: "Acne" },
    });
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "CONTINUAR" }));
    marcarSim(/Declaro que as informações/);
    marcarSim(/Li e aceito os termos de privacidade/);
    fireEvent.change(screen.getByLabelText(/Nome completo \(assinatura digital\)/), {
      target: { value: "Ana Souza" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ENVIAR FICHA" }));
    expect(await screen.findByText(/Não foi possível enviar a ficha agora/)).toBeInTheDocument();
    expect(screen.queryByText("✅ Ficha enviada")).toBeNull();
  });
});

describe("consulta anterior no retorno", () => {
  it("aparece recolhida só no retorno, com o texto da consulta anterior", async () => {
    const { container, rerender } = render(<ConsultaAnterior />);
    expect(container).toBeEmptyDOMElement(); // consulta nova: nada
    useConsulta.setState({ tipo: "retorno", retornoDe: "c2" });
    rerender(<ConsultaAnterior />);
    expect(await screen.findByText(/Consulta anterior/)).toBeInTheDocument();
    expect(await screen.findByText(/Psoríase/)).toBeInTheDocument();
    expect(api.obterProntuario).toHaveBeenCalledWith("c2");
  });

  it("falha ao buscar a consulta anterior avisa", async () => {
    api.obterProntuario.mockRejectedValueOnce(new Error("fora"));
    useConsulta.setState({ tipo: "retorno", retornoDe: "c2" });
    render(<ConsultaAnterior />);
    expect(await screen.findByText(/Não foi possível abrir a consulta anterior/)).toBeInTheDocument();
  });
});

describe("lista de pacientes truncada", () => {
  it("avisa quantos existem quando a API cortou a lista", async () => {
    const lista = Object.assign([ANA, BRUNO], { total: 732, truncado: true });
    api.listarPacientes.mockResolvedValue(lista);
    const { SeletorPaciente } = await import("@/components/SeletorPaciente");
    render(<SeletorPaciente onEscolher={() => {}} />);
    expect(await screen.findByText(/Mostrando 2 de 732 pacientes/)).toBeTruthy();
  });
});
