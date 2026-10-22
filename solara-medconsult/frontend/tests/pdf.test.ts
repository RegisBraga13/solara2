import { beforeEach, describe, expect, it, vi } from "vitest";

const doc = vi.hoisted(() => ({
  textos: [] as string[],
  paginas: 1,
  paginaAtual: 0,
  arquivo: "",
}));

vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    getNumberOfPages() {
      return doc.paginas;
    }
    setPage(n: number) {
      doc.paginaAtual = n;
    }
    splitTextToSize(t: string) {
      return [t];
    }
    text(t: string) {
      doc.textos.push(t);
    }
    addPage() {
      doc.paginas += 1;
    }
    save(nome: string) {
      doc.arquivo = nome;
    }
  },
}));

import { gerarPdfProntuario, nomeDoPdf } from "@/lib/pdf";

beforeEach(() => {
  doc.textos = [];
  doc.paginas = 1;
  doc.arquivo = "";
});

describe("pdf do prontuário", () => {
  it("escreve o prontuário inteiro e salva com nome sem dados do paciente", async () => {
    const quando = new Date(2026, 9, 8, 10, 0);
    await gerarPdfProntuario({
      texto: "CONSULTA ONLINE\n\nDIAGNÓSTICO\n- Psoríase vulgar",
      paciente: "Ana Souza",
      geradoEm: quando,
    });
    expect(doc.textos).toContain("- Psoríase vulgar");
    expect(doc.textos).toContain("Ana Souza");
    expect(doc.textos).toContain("PRONTUÁRIO MÉDICO");
    expect(doc.textos.some((t) => t.startsWith("Página 1 de "))).toBe(true);
    expect(doc.arquivo).toBe("prontuario-20261008.pdf");
    expect(doc.arquivo).not.toMatch(/ana|souza/i);
    expect(nomeDoPdf(quando)).toBe(doc.arquivo);
  });

  it("troca emoji por espaço e quebra de página em textos longos", async () => {
    const longo = Array.from({ length: 120 }, (_, i) => `- item ${i} 🔪`).join("\n");
    await gerarPdfProntuario({ texto: longo, paciente: "", geradoEm: new Date() });
    expect(doc.paginas).toBeGreaterThan(1);
    expect(doc.textos.some((t) => t.includes("🔪"))).toBe(false);
    expect(doc.textos).not.toContain("Paciente:");
    expect(doc.textos.filter((t) => t.startsWith("Página ")).length).toBe(doc.paginas);
  });
});
