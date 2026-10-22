// PDF da receita, gerado no navegador. Documento de apoio SEM assinatura digital ICP-Brasil.

import type { Medico } from "@/lib/medico";
import type { ItemReceita } from "@/lib/receita";

const MARGEM = 20; // mm
const ENTRELINHA = 6;
const apenasLatin1 = (s: string) => s.replace(/[^\u0000-ÿ—–•]/g, " ");

export interface DadosReceita {
  medico: Medico;
  paciente: string;
  itens: ItemReceita[];
  observacoes: string;
  emitidaEm: Date;
}

export const nomeDaReceita = (d: Date) =>
  `receita-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.pdf`;

export async function criarPdfReceita(dados: DadosReceita): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth() - 2 * MARGEM;
  const altura = doc.internal.pageSize.getHeight() - MARGEM;
  let y = MARGEM;

  const escrever = (t: string, negrito = false, tamanho = 11, recuo = 0) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    for (const l of doc.splitTextToSize(apenasLatin1(t), largura - recuo) as string[]) {
      if (y > altura) {
        doc.addPage();
        y = MARGEM;
      }
      doc.text(l, MARGEM + recuo, y);
      y += ENTRELINHA;
    }
  };

  escrever(dados.medico.nome.trim(), true, 15);
  escrever(dados.medico.crm.trim());
  y += 2;
  doc.line(MARGEM, y, MARGEM + largura, y);
  y += 8;
  escrever("RECEITUÁRIO", true, 14);
  y += 2;
  escrever(`Paciente: ${dados.paciente.trim()}`, true);
  y += 4;

  dados.itens.forEach((item, i) => {
    escrever(`${i + 1}. ${item.medicamento}${item.quantidade ? `  —  ${item.quantidade}` : ""}`, true);
    escrever(item.posologia, false, 11, 6);
    if (item.duracao) escrever(`Duração: ${item.duracao}`, false, 11, 6);
    y += 3;
  });

  if (dados.observacoes.trim()) {
    y += 2;
    escrever("Observações", true);
    escrever(dados.observacoes.trim());
  }

  y = Math.max(y + 18, 235);
  if (y > altura - 24) {
    doc.addPage();
    y = 40;
  }
  doc.line(MARGEM + 30, y, MARGEM + largura - 30, y);
  y += 6;
  escrever(dados.medico.nome.trim(), false, 11, 30);
  escrever(dados.medico.crm.trim(), false, 11, 30);
  y += 4;
  escrever(`Emitida em ${dados.emitidaEm.toLocaleDateString("pt-BR")}`, false, 10);
  escrever(
    "Documento de apoio sem assinatura digital ICP-Brasil. Não vale como receita de medicamento controlado.",
    false,
    8,
  );
  return { blob: doc.output("blob"), nome: nomeDaReceita(dados.emitidaEm) };
}
