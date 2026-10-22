import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(__dirname, "../..");

const caminhos = readFileSync(resolve(RAIZ, "NUCLEO.txt"), "utf-8")
  .split(/\r?\n/)
  .map((l) => l.split("#")[0].trim())
  .filter(Boolean);

describe("núcleo compartilhado entre as especialidades", () => {
  it("todo caminho listado em NUCLEO.txt existe (renomear exige atualizar a lista)", () => {
    const faltando = caminhos.filter((c) => !existsSync(resolve(RAIZ, c)));
    expect(faltando).toEqual([]);
  });

  it("a lista cobre a identidade visual e as telas do fluxo", () => {
    for (const obrigatorio of [
      "frontend/src/app/globals.css",
      "frontend/src/components/BigButton.tsx",
      "frontend/src/app/modalidade",
      "frontend/src/app/evolucao",
      "backend/app/routers/prontuarios.py",
    ]) {
      expect(caminhos).toContain(obrigatorio);
    }
  });

  it("as regras para agentes existem e apontam para a lista", () => {
    const agentes = readFileSync(resolve(RAIZ, "AGENTS.md"), "utf-8");
    expect(agentes).toContain("NUCLEO.txt");
    expect(agentes).toContain("verificar_nucleo.py");
  });
});
