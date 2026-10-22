import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chip } from "@/components/Chip";
import { sugerirOrientacoes, sugerirPropedeutica } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** O app não cita fonte em lugar nenhum (decisão do médico): nem na tela, nem nos dados guardados. */
describe("sem fontes citadas", () => {
  it("o item sugerido não carrega a origem, mesmo que o servidor a envie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          itens: [
            { termo: "Emolientes", secao: "tratamento", fontes: ["RAG", "Diretrizes"] },
            { termo: "Retorno em 15 dias", secao: "acompanhamento", fontes: ["AI"] },
          ],
        }),
      })),
    );
    const prop = await sugerirPropedeutica("Psoríase", ["AI"]);
    const ori = await sugerirOrientacoes("Psoríase", ["AI"]);
    for (const item of [...prop, ...ori]) expect(item).not.toHaveProperty("fontes");
    expect(prop.map((i) => i.termo)).toEqual(["Emolientes", "Retorno em 15 dias"]);
  });

  it("o chip mostra só o texto do item, sem selo de origem", () => {
    render(<Chip rotulo="Emolientes" selecionado={false} onToggle={() => {}} />);
    expect(screen.getByRole("checkbox").textContent).toBe("Emolientes");
  });
});
