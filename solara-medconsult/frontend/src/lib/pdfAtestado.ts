// PDF do atestado, gerado no navegador. Documento de apoio SEM assinatura digital ICP-Brasil.

import type { Medico } from "@/lib/medico";

const MARGEM = 20; // mm
const ENTRELINHA = 6;
const apenasLatin1 = (s: string) => s.replace(/[^\u0000-ÿ—–•]/g, " ");

export interface DadosAtestado {
  medico: Medico;
  paciente: string;
  documento: string; // CPF (ou "" se não houver)
  diasAfastamento: number;
  dataInicial: Date;
  cid: string; // "" = sem CID (o paciente não autorizou ou o médico não informou)
  cidade: string;
  emitidaEm: Date;
}

export const nomeDoAtestado = (d: Date) =>
  `atestado-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.pdf`;

export async function criarPdfAtestado(dados: DadosAtestado): Promise<{ blob: Blob; nome: string }> {
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

  escrever("ATESTADO MÉDICO", true, 16);
  y += 6;

  const documentoTxt = dados.documento.trim() ? `portador(a) do CPF ${dados.documento.trim()}, ` : "";
  const dataInicialTxt = dados.dataInicial.toLocaleDateString("pt-BR");
  const diasTxt = `${dados.diasAfastamento} dia${dados.diasAfastamento === 1 ? "" : "s"}`;

  if (dados.cid.trim()) {
    escrever(
      `Atesto, para os devidos fins, que o(a) Sr(a). ${dados.paciente.trim()}, ${documentoTxt}` +
        `foi atendido(a) nesta data e necessita de afastamento de suas atividades por ${diasTxt}, ` +
        `a contar de ${dataInicialTxt}.`,
    );
    y += 6;
    escrever(
      `CID-11: ${dados.cid.trim()} — registrado mediante autorização expressa do paciente.`,
    );
  } else {
    escrever(
      `Atesto, para os devidos fins, que o(a) Sr(a). ${dados.paciente.trim()}, ${documentoTxt}` +
        `foi atendido(a) nesta data e necessita de afastamento de suas atividades por ${diasTxt}, ` +
        `a contar de ${dataInicialTxt}, por motivo de doença.`,
    );
  }

  y += 10;
  escrever(`${dados.cidade.trim()}, ${dados.emitidaEm.toLocaleDateString("pt-BR")}.`);

  y = Math.max(y + 18, 235);
  if (y > altura - 24) {
    doc.addPage();
    y = 40;
  }
  doc.line(MARGEM + 30, y, MARGEM + largura - 30, y);
  y += 6;
  escrever(`Dr(a). ${dados.medico.nome.trim()}`);
  escrever(`CRM ${dados.medico.crm.trim()}`);

  return { blob: doc.output("blob"), nome: nomeDoAtestado(dados.emitidaEm) };
}
