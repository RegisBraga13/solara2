// PDF da declaração de comparecimento, gerado no navegador. Documento de apoio SEM assinatura ICP-Brasil.

import type { Medico } from "@/lib/medico";

const MARGEM = 20; // mm
const ENTRELINHA = 6;
const apenasLatin1 = (s: string) => s.replace(/[^\u0000-ÿ—–•]/g, " ");

export interface DadosDeclaracao {
  medico: Medico;
  paciente: string;
  data: Date;
  horaInicio: string; // "HH:MM"
  horaFim: string; // "HH:MM"
  cidade: string;
  emitidaEm: Date;
}

export const nomeDaDeclaracao = (d: Date) =>
  `declaracao-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.pdf`;

export async function criarPdfDeclaracao(
  dados: DadosDeclaracao,
): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth() - 2 * MARGEM;
  const altura = doc.internal.pageSize.getHeight() - MARGEM;
  let y = MARGEM;

  const escrever = (t: string, negrito = false, tamanho = 11) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    for (const l of doc.splitTextToSize(apenasLatin1(t), largura) as string[]) {
      if (y > altura) {
        doc.addPage();
        y = MARGEM;
      }
      doc.text(l, MARGEM, y);
      y += ENTRELINHA;
    }
  };

  escrever("DECLARAÇÃO DE COMPARECIMENTO", true, 16);
  y += 6;

  escrever(
    `Declaro que o(a) Sr(a). ${dados.paciente.trim()} compareceu a esta unidade para ` +
      `atendimento no dia ${dados.data.toLocaleDateString("pt-BR")}, no período de ` +
      `${dados.horaInicio} às ${dados.horaFim}.`,
  );

  y += 10;
  escrever(`${dados.cidade.trim()}, ${dados.emitidaEm.toLocaleDateString("pt-BR")}.`);

  y = Math.max(y + 18, 235);
  if (y > altura - 24) {
    doc.addPage();
    y = 40;
  }
  doc.line(MARGEM + 30, y, MARGEM + largura - 30, y);
  y += 6;
  escrever(`Dr(a). ${dados.medico.nome.trim()} — CRM ${dados.medico.crm.trim()}`);

  return { blob: doc.output("blob"), nome: nomeDaDeclaracao(dados.emitidaEm) };
}
