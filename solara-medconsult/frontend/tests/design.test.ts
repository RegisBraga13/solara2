import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { classeDoTema } from "@/lib/tema";
import { colors, shadows } from "@/styles/tokens";
import { leatherTexture, paperTexture } from "@/styles/textures";

const raiz = path.resolve(__dirname, "..");
const css = readFileSync(path.join(raiz, "src/app/globals.css"), "utf8");

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const bloco = (seletor: string) => {
  const i = css.indexOf(seletor);
  return css.slice(i, css.indexOf("}", i));
};

describe("tokens x CSS", () => {
  for (const [tema, classe] of [["day", ":root.day {"], ["night", ":root.night {"]] as const) {
    it(`variáveis de cor do tema ${tema} coincidem com tokens.ts`, () => {
      const b = bloco(classe).toLowerCase();
      for (const [nome, valor] of Object.entries(colors[tema])) {
        if (nome === "textOnAccent") continue;
        expect(b, `${tema}.${nome}`).toContain(`--color-${kebab(nome)}: ${valor.toLowerCase()}`);
      }
    });
  }
  it("sombras do dia coincidem (ignorando espaços)", () => {
    const limpa = (s: string) => s.replace(/\s+/g, "").replace(/(\d\.\d)0(?!\d)/g, "$1");
    const b = limpa(bloco(":root.day {"));
    expect(b).toContain(`--shadow-raised:${limpa(shadows.raised)}`);
    expect(b).toContain(`--shadow-pressed:${limpa(shadows.pressed)}`);
    expect(b).toContain(`--shadow-card:${limpa(shadows.card)}`);
    expect(b).toContain(`--shadow-sunken:${limpa(shadows.sunken)}`);
    expect(limpa(bloco(":root.night {"))).toContain(`--shadow-card:${limpa(shadows.cardNight)}`);
  });
});

describe("texturas e tema", () => {
  it("funções devolvem CSS com SVG de ruído", () => {
    expect(paperTexture(0.1)).toContain("feTurbulence");
    expect(paperTexture(0.1)).toContain("opacity='0.1'");
    expect(leatherTexture("#111", "#222")).toContain("linear-gradient(180deg, #111 0%, #222 100%)");
  });
  it("classe do tema", () => {
    expect(classeDoTema("dia")).toBe("day");
    expect(classeDoTema("noite")).toBe("night");
  });
});

describe("PWA", () => {
  const manifest = JSON.parse(readFileSync(path.join(raiz, "public/manifest.json"), "utf8"));
  it("manifest instalável", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#EFEAE2");
    for (const i of manifest.icons) {
      expect(existsSync(path.join(raiz, "public", i.src))).toBe(true);
    }
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
  });
  it("ícones PNG existem, incluindo apple-touch-icon", () => {
    for (const f of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
      const b = readFileSync(path.join(raiz, "public", f));
      expect(b.subarray(1, 4).toString()).toBe("PNG");
    }
  });
  it("service worker tem cache-first e não intercepta API", () => {
    const sw = readFileSync(path.join(raiz, "public/sw.js"), "utf8");
    expect(sw).toContain("caches.match(req)");
    expect(sw).toContain('startsWith("/api")');
  });
});
