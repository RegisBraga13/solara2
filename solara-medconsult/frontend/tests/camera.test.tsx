import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CameraCaptura, hojeLocal } from "@/components/CameraCaptura";

const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole("button", { name: nome }));

const parar = vi.fn();
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  parar.mockReset();
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: parar }] });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  // jsdom não toca vídeo nem desenha canvas: simulamos o necessário
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, value: 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, value: 480 });
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(["jpeg"], { type: "image/jpeg" }));
  } as never;
});

afterEach(() => vi.restoreAllMocks());

describe("câmera em tempo real", () => {
  it("abre a câmera traseira, tira várias fotos e entrega cada uma como arquivo JPEG", async () => {
    const onFoto = vi.fn();
    const onFechar = vi.fn();
    render(<CameraCaptura aberto onFoto={onFoto} onFechar={onFechar} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /TIRAR FOTO/ })).toBeEnabled());
    expect(getUserMedia.mock.calls[0][0].video.facingMode.ideal).toBe("environment");
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);

    clicar(/TIRAR FOTO/);
    clicar(/TIRAR FOTO/);
    expect(onFoto).toHaveBeenCalledTimes(2);
    const arquivo = onFoto.mock.calls[0][0] as File;
    expect(arquivo.type).toBe("image/jpeg");
    expect(arquivo.name).toMatch(/^foto-.*\.jpg$/);
    expect(screen.getByText(/2 foto\(s\) enviada\(s\)/)).toBeInTheDocument();

    clicar("CONCLUIR");
    expect(onFechar).toHaveBeenCalled();
  });

  it("troca para a câmera frontal e libera a câmera ao fechar", async () => {
    const { rerender } = render(<CameraCaptura aberto onFoto={vi.fn()} onFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /TIRAR FOTO/ })).toBeEnabled());
    clicar(/TROCAR CÂMERA/);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.calls[1][0].video.facingMode.ideal).toBe("user");
    await act(async () => rerender(<CameraCaptura aberto={false} onFoto={vi.fn()} onFechar={vi.fn()} />));
    expect(parar).toHaveBeenCalled(); // a luz da câmera apaga
  });

  it("câmera bloqueada ou indisponível explica o que fazer e não quebra", async () => {
    getUserMedia.mockRejectedValueOnce({ name: "NotAllowedError" });
    const a = render(<CameraCaptura aberto onFoto={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText(/A câmera está bloqueada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TIRAR FOTO/ })).toBeDisabled();
    a.unmount();

    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    render(<CameraCaptura aberto onFoto={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText(/escolher da galeria/)).toBeInTheDocument();
  });

  it("fechada, não pede a câmera", () => {
    render(<CameraCaptura aberto={false} onFoto={vi.fn()} onFechar={vi.fn()} />);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("a data da foto tirada agora é a de hoje, no formato AAAA-MM-DD", () => {
    expect(hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
