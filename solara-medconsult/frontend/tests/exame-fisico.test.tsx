import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const h = vi.hoisted(() => ({
  upload: vi.fn(),
  apagar: vi.fn(),
  listar: vi.fn(),
}));

vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return {
    ...real,
    uploadImage: h.upload,
    deleteImage: h.apagar,
    listImages: h.listar,
  };
});

import ExameFisico from "@/app/exame-fisico/page";
import { ApiError } from "@/lib/api";
import { dadosIniciais, useConsulta } from "@/store/consulta";

const SID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  h.listar.mockResolvedValue([]);
  localStorage.clear();
  useConsulta.setState({
    ...dadosIniciais("dia"),
    modo: "online",
    sessionId: SID,
    iniciada_em: Date.now(),
  });
});

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));
const resposta = (extra: object = {}) => ({
  image_id: "22222222-2222-4222-8222-222222222222",
  url: "http://x/img.jpg",
  data_classificada: "2025-03-14",
  data_origem: "exif",
  descricao: "Placa eritematosa com descamação fina.",
  gerada_por_ia: true,
  avisos: [],
  ...extra,
});
const arquivo = (nome = "lesao.jpg") => new File(["x"], nome, { type: "image/jpeg" });
const escolher = (f: File) =>
  fireEvent.change(screen.getByLabelText("Escolher imagem"), { target: { files: [f] } });

describe("exame físico e complementos", () => {
  it("mostra o título e o aviso de instrução, e leva à história ao concluir", async () => {
    render(<ExameFisico />);
    expect(await screen.findByText("EXAME FÍSICO E COMPLEMENTOS")).toBeInTheDocument();
    expect(screen.getByText(/Selecione ou insira o conteúdo do exame físico/)).toBeInTheDocument();
    clicar("CONCLUIR");
    expect(nav.push).toHaveBeenCalledWith("/historia");
    expect(useConsulta.getState().etapa_atual).toBe(5);
  });

  it("mostra os 4 botões de fonte: Prints, Fotos, Voz e Texto", async () => {
    render(<ExameFisico />);
    expect(screen.getByRole("button", { name: /PRINTS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FOTOS \(CÂMERA\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /VOZ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TEXTO/ })).toBeInTheDocument();
  });

  it("Voz abre o gravador; Texto abre a caixa e guarda no estado global", async () => {
    render(<ExameFisico />);
    expect(screen.queryByRole("button", { name: /GRAVAR/ })).toBeNull();
    clicar(/VOZ/);
    expect(await screen.findByRole("button", { name: /GRAVAR/ })).toBeInTheDocument();

    expect(screen.queryByLabelText("Achados do exame físico (texto)")).toBeNull();
    clicar(/TEXTO/);
    const caixa = await screen.findByLabelText("Achados do exame físico (texto)");
    fireEvent.change(caixa, { target: { value: "Placa única em dorso." } });
    expect(useConsulta.getState().exameFisico.texto).toBe("Placa única em dorso.");
  });

  it("envia, mostra data e descrição, expande e remove", async () => {
    h.upload.mockResolvedValue(resposta());
    render(<ExameFisico />);
    escolher(arquivo());
    await screen.findByText("14/03/2025");
    expect(h.upload).toHaveBeenCalledWith(SID, expect.any(File));
    const descricao = screen.getByRole("button", { name: /Placa eritematosa/ });
    expect(descricao).toHaveClass("line-clamp-2");
    fireEvent.click(descricao);
    expect(descricao).not.toHaveClass("line-clamp-2");
    expect(screen.queryByText(/gerada por IA/)).toBeNull(); // sem ressalvas: só a descrição
    expect(useConsulta.getState().captura.imagens).toEqual(["lesao.jpg"]);

    h.apagar.mockResolvedValue(undefined);
    clicar("Remover lesao.jpg");
    await waitFor(() => expect(useConsulta.getState().imagens).toHaveLength(0));
    expect(h.apagar).toHaveBeenCalledWith(SID, "22222222-2222-4222-8222-222222222222");
    expect(useConsulta.getState().captura.imagens).toEqual([]);
  });

  it("ordena em ordem cronológica, sem data por último", async () => {
    h.upload
      .mockResolvedValueOnce(resposta({ image_id: "a", data_classificada: "2025-05-01" }))
      .mockResolvedValueOnce(resposta({ image_id: "b", data_classificada: null }))
      .mockResolvedValueOnce(resposta({ image_id: "c", data_classificada: "2024-01-01" }));
    render(<ExameFisico />);
    for (const n of ["a.jpg", "b.jpg", "c.jpg"]) {
      escolher(arquivo(n));
      await waitFor(() => expect(screen.getByAltText(n)).toBeInTheDocument());
    }
    const alts = screen.getAllByRole("img").map((i) => i.getAttribute("alt"));
    expect(alts).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
    expect(screen.getByText("Sem data")).toBeInTheDocument();
  });

  it("falha no upload avisa e permite tentar de novo", async () => {
    h.upload.mockRejectedValueOnce(new ApiError("Servidor indisponível.", null)).mockResolvedValueOnce(resposta());
    render(<ExameFisico />);
    escolher(arquivo());
    expect(await screen.findByText(/Falha no upload/)).toBeInTheDocument();
    clicar("Tentar de novo");
    await screen.findByText("14/03/2025");
    expect(screen.queryByText(/Falha no upload/)).toBeNull();
    expect(h.upload).toHaveBeenCalledTimes(2);
  });

  it("imagem inválida ou grande demais: mostra o motivo, sem repetir", async () => {
    h.upload.mockRejectedValue(new ApiError("Imagem maior que 10 MB.", 413));
    render(<ExameFisico />);
    escolher(arquivo());
    expect(await screen.findByText("⚠️ Imagem maior que 10 MB.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
    clicar("Descartar");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem descrição automática a imagem continua utilizável", async () => {
    h.upload.mockResolvedValue(resposta({ descricao: null, gerada_por_ia: false }));
    render(<ExameFisico />);
    escolher(arquivo());
    expect(await screen.findByText("Sem descrição automática.")).toBeInTheDocument();
  });

  it("falha ao remover mantém a imagem e avisa", async () => {
    useConsulta.setState({
      imagens: [{ id: "i1", nome: "a.jpg", url: "http://x/a", data: null, descricao: null }],
      captura: { audio_duracao: 0, imagens: ["a.jpg"], texto: "" },
    });
    h.listar.mockResolvedValue([resposta({ image_id: "i1", data_classificada: null, descricao: null })]);
    h.apagar.mockRejectedValue(new ApiError("Servidor indisponível.", null));
    render(<ExameFisico />);
    clicar("Remover a.jpg");
    expect(await screen.findByText(/Não foi possível remover a imagem/)).toBeInTheDocument();
    expect(useConsulta.getState().imagens).toHaveLength(1);
  });

  it("ao abrir, renova as URLs a partir do servidor", async () => {
    useConsulta.setState({
      imagens: [{ id: "i1", nome: "a.jpg", url: "http://velha", data: null, descricao: null }],
    });
    h.listar.mockResolvedValue([resposta({ image_id: "i1", url: "http://nova" })]);
    render(<ExameFisico />);
    await waitFor(() => expect(useConsulta.getState().imagens[0].url).toBe("http://nova"));
    expect(useConsulta.getState().imagens[0].nome).toBe("a.jpg");
  });
});
