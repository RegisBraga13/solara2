import { afterEach, describe, expect, it, vi } from "vitest";

import { listImages, uploadImage } from "@/lib/api";

const caminho = "/session/s1/images/i1/arquivo";
const corpo = (url: string) => ({
  image_id: "i1",
  url,
  data_classificada: null,
  data_origem: null,
  descricao: null,
  gerada_por_ia: false,
  avisos: [],
});

afterEach(() => vi.unstubAllGlobals());

describe("endereço das imagens", () => {
  it("o servidor devolve relativo; o app torna absoluto (abre no iPad)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([corpo(caminho)]), { status: 200 })),
    );
    const [img] = await listImages("s1");
    expect(img.url.startsWith("http")).toBe(true);
    expect(img.url.endsWith(caminho)).toBe(true);
  });

  it("no envio também; endereço já absoluto não é mexido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(corpo(caminho)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(corpo("https://x/y.jpg")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const arquivo = new File(["x"], "f.jpg", { type: "image/jpeg" });
    expect((await uploadImage("s1", arquivo)).url.endsWith(caminho)).toBe(true);
    expect((await uploadImage("s1", arquivo)).url).toBe("https://x/y.jpg");
  });
});
