import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const h = vi.hoisted(() => ({
  suportado: true,
  conectarFalha: false,
  iniciarFalha: false,
  ws: null as null | {
    opts: { onTranscription: (t: unknown) => void; onError: (e: { codigo: string; mensagem: string }) => void };
    connect: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  },
  rec: null as null | { stop: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> },
  verificar: vi.fn(),
  obterPaciente: vi.fn(),
}));

vi.mock("@/lib/audio", () => ({
  AudioRecorder: class {
    static suportado = () => h.suportado;
    start = vi.fn(async () => {
      if (h.iniciarFalha) throw new Error("sem microfone");
    });
    pause = vi.fn();
    resume = vi.fn();
    stop = vi.fn();
    constructor() {
      h.rec = this;
    }
  },
}));

vi.mock("@/lib/websocket", () => ({
  AudioWebSocket: class {
    opts: unknown;
    connect = vi.fn(async () => {
      if (h.conectarFalha) throw new Error("fora");
    });
    sendChunk = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
    stop = vi.fn(async () => undefined);
    close = vi.fn();
    constructor(_id: string, opts: unknown) {
      this.opts = opts;
      h.ws = this as never;
    }
  },
}));

vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return {
    ...real,
    verificarPendencias: h.verificar,
    obterPaciente: h.obterPaciente,
  };
});

import Captura from "@/app/captura/page";
import { ApiError } from "@/lib/api";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const SID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  h.suportado = true;
  h.conectarFalha = false;
  h.iniciarFalha = false;
  h.ws = null;
  h.rec = null;
  h.verificar.mockResolvedValue({ pendentes: [], red_flags: [] });
  h.obterPaciente.mockResolvedValue(null);
  localStorage.clear();
  useConsulta.setState({
    ...dadosIniciais("dia"),
    modo: "online",
    sessionId: SID,
    iniciada_em: Date.now(),
    anamnese: { voz: true, texto: false },
  });
});

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));

async function gravar() {
  render(<Captura />);
  clicar("GRAVAR");
  await screen.findByRole("button", { name: "PAUSAR" });
}

describe("captura — dados do paciente", () => {
  it("sem paciente ligado à consulta, não mostra o painel", async () => {
    render(<Captura />);
    await screen.findByRole("button", { name: "GRAVAR" });
    expect(screen.queryByText("Dados do Paciente")).toBeNull();
    expect(h.obterPaciente).not.toHaveBeenCalled();
  });

  it("com paciente, mostra os dados auto-preenchidos do cadastro", async () => {
    h.obterPaciente.mockResolvedValue({
      id: "p1",
      nome: "Ana Souza",
      nascimento: "1980-05-17",
      sexo: "feminino",
      profissao: "Engenheira",
      moradia: "Rua das Flores, 123",
      contato: "(11) 98765-4321",
    });
    useConsulta.setState({ pacienteId: "p1" });
    render(<Captura />);
    expect(h.obterPaciente).toHaveBeenCalledWith("p1");
    expect(await screen.findByText("Dados do Paciente")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("17/05/1980")).toBeInTheDocument();
    expect(screen.getByText("feminino")).toBeInTheDocument();
    expect(screen.getByText("Engenheira")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, 123")).toBeInTheDocument();
    expect(screen.getByText("(11) 98765-4321")).toBeInTheDocument();
  });
});

describe("captura — voz", () => {
  it("grava, mostra o aviso ao paciente e a transcrição em tempo real", async () => {
    await gravar();
    expect(screen.getByText("🔴 Áudio da consulta será gravado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PARAR" })).toBeInTheDocument();

    act(() =>
      h.ws!.opts.onTranscription({ text: "Bom dia", speaker: "medico", speaker_id: 0, is_final: false, timestamp_ms: 1 }),
    );
    expect(screen.getByText("Bom dia")).toHaveClass("italic", { exact: false });
    expect(useConsulta.getState().transcricoes).toHaveLength(0);

    act(() =>
      h.ws!.opts.onTranscription({ text: "Bom dia.", speaker: "medico", speaker_id: 0, is_final: true, timestamp_ms: 1 }),
    );
    act(() =>
      h.ws!.opts.onTranscription({ text: "Dói aqui.", speaker: "paciente", speaker_id: 1, is_final: true, timestamp_ms: 2 }),
    );
    expect(useConsulta.getState().transcricoes.map((t) => t.speaker)).toEqual(["medico", "paciente"]);
    expect(screen.getByText("Dói aqui.")).toBeInTheDocument();
    expect(screen.getByText("Paciente", { selector: "li" }).dataset.ativo).toBe("true");
  });

  it("o aviso ao paciente pode ser fechado", async () => {
    await gravar();
    clicar("Fechar aviso");
    expect(screen.queryByText("🔴 Áudio da consulta será gravado")).toBeNull();
  });

  it("pausar e continuar repassam ao áudio e ao servidor; PARAR encerra", async () => {
    await gravar();
    clicar("PAUSAR");
    expect(h.rec!.pause).toHaveBeenCalled();
    expect(h.ws!.pause).toHaveBeenCalled();
    clicar("CONTINUAR");
    expect(h.ws!.resume).toHaveBeenCalled();
    clicar("PARAR");
    await screen.findByRole("button", { name: "GRAVAR" });
    expect(h.rec!.stop).toHaveBeenCalled();
    expect(h.ws!.stop).toHaveBeenCalled();
  });

  it("trocar Médico ↔ Paciente corrige os trechos já gravados", async () => {
    await gravar();
    act(() =>
      h.ws!.opts.onTranscription({ text: "Oi", speaker: "medico", speaker_id: 0, is_final: true, timestamp_ms: 1 }),
    );
    clicar(/Trocar Médico/);
    expect(useConsulta.getState().transcricoes[0].speaker).toBe("paciente");
    act(() =>
      h.ws!.opts.onTranscription({ text: "Tchau", speaker: "medico", speaker_id: 0, is_final: true, timestamp_ms: 2 }),
    );
    expect(useConsulta.getState().transcricoes[1].speaker).toBe("paciente");
  });

  it("servidor fora do ar: avisa, libera o texto e não bloqueia", async () => {
    h.conectarFalha = true;
    render(<Captura />);
    clicar("GRAVAR");
    expect(await screen.findByText("⚠️ Conexão perdida. Continuando em modo texto.")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto da anamnese")).toBeInTheDocument();
    expect(h.rec).toBeNull();
    clicar("CONCLUIR");
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/exame-fisico"));
  });

  it("navegador sem suporte ou microfone negado: modo texto", async () => {
    h.suportado = false;
    const { unmount } = render(<Captura />);
    clicar("GRAVAR");
    expect(await screen.findByText("⚠️ Não foi possível gravar áudio. Você pode digitar.")).toBeInTheDocument();
    unmount();

    h.suportado = true;
    h.iniciarFalha = true;
    render(<Captura />);
    clicar("GRAVAR");
    expect(await screen.findByText("⚠️ Não foi possível gravar áudio. Você pode digitar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto da anamnese")).toBeInTheDocument();
  });

  it("conexão cai durante a gravação: para o áudio e segue em modo texto", async () => {
    await gravar();
    act(() => h.ws!.opts.onError({ codigo: "conexao_perdida", mensagem: "Conexão perdida. Continuando em modo texto." }));
    expect(screen.getByText("⚠️ Conexão perdida. Continuando em modo texto.")).toBeInTheDocument();
    expect(h.rec!.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "GRAVAR" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto da anamnese")).toBeInTheDocument();
  });
});

describe("captura — o que falta (pendências da anamnese)", () => {
  it("não aparece sem nada registrado ainda", async () => {
    render(<Captura />);
    expect(screen.queryByText("O QUE FALTA?")).toBeNull();
  });

  it("verifica, mostra tópicos pendentes e red flags (sem os 'ausente'), e permite atualizar", async () => {
    useConsulta.setState({
      captura: { audio_duracao: 0, imagens: [], texto: "Mancha no braço há 2 meses." },
    });
    h.verificar.mockResolvedValue({
      pendentes: [{ topico: "Fototipo", pergunta_sugerida: "Qual o fototipo do paciente?" }],
      red_flags: [
        { sinal: "Sangramento ou ferida que não cicatriza", estado: "presente" },
        { sinal: "Lesão com crescimento rápido", estado: "nao_verificado" },
        { sinal: "Bordas irregulares", estado: "ausente" },
      ],
    });
    render(<Captura />);
    clicar("VERIFICAR");
    expect(await screen.findByText("Qual o fototipo do paciente?")).toBeInTheDocument();
    expect(h.verificar).toHaveBeenCalledWith(expect.stringContaining("Mancha no braço há 2 meses."));
    expect(screen.getByText(/Sangramento ou ferida que não cicatriza/)).toBeInTheDocument();
    expect(screen.getByText(/Lesão com crescimento rápido/)).toBeInTheDocument();
    expect(screen.queryByText(/Bordas irregulares/)).toBeNull(); // "ausente" não precisa de ação
    expect(screen.getByRole("button", { name: "ATUALIZAR" })).toBeInTheDocument();
  });

  it("sem pendências nem red flags, avisa que está tudo coberto", async () => {
    useConsulta.setState({ captura: { audio_duracao: 0, imagens: [], texto: "Texto qualquer." } });
    render(<Captura />);
    clicar("VERIFICAR");
    expect(await screen.findByText("Nada pendente por enquanto.")).toBeInTheDocument();
  });

  it("falha ao verificar avisa sem travar", async () => {
    useConsulta.setState({ captura: { audio_duracao: 0, imagens: [], texto: "Texto qualquer." } });
    h.verificar.mockRejectedValueOnce(new ApiError("Servidor indisponível.", null));
    render(<Captura />);
    clicar("VERIFICAR");
    expect(await screen.findByText("⚠️ Servidor indisponível.")).toBeInTheDocument();
  });
});
