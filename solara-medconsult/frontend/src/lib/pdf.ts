// PDF do prontuário, gerado no próprio navegador: o conteúdo clínico não sai do aparelho.



import { ESPECIALIDADE, NOME_MAE } from "@/lib/especialidade";


import { idadeEmAnos } from "@/lib/pacientes";

import { TITULOS_PRONTUARIO } from "@/lib/prontuario";

import { lerMedico, medicoValido, type Medico } from "@/lib/medico";



const MARGEM = 20; // mm

const TAMANHO = 11;

const ENTRELINHA = 5.8; // mm

const RODAPE = 14; // mm reservados no pé da página

const CINZA = 110;



/** A fonte padrão do PDF só cobre Latin-1: troca o que ficar de fora (ex.: emoji) por espaço. */

const apenasLatin1 = (s: string) =>
  Array.from(s, (c) => (c.charCodeAt(0) <= 255 || "—–•".includes(c) ? c : " ")).join("");


export interface DadosPdf {

  texto: string;

  paciente: string;

  geradoEm: Date;

  /** Data de nascimento (AAAA-MM-DD), quando conhecida: entra na identificação. */

  nascimento?: string | null;

  /** Médico responsável; sem isto usa o cadastrado neste aparelho (se houver). */

  medico?: Medico;

}



/** Nome do arquivo sem dados do paciente. */

export const nomeDoPdf = (d: Date) =>

  `prontuario-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.pdf`;



async function montarPdf({ texto, paciente, geradoEm, nascimento, medico }: DadosPdf) {

  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const larguraPagina = doc.internal.pageSize.getWidth();

  const largura = larguraPagina - 2 * MARGEM;

  const altura = doc.internal.pageSize.getHeight() - MARGEM - RODAPE;

  const responsavel = medico && medicoValido(medico) ? medico : lerMedico();

  const temMedico = medicoValido(responsavel);

  let y = MARGEM;



  const linhas = (t: string, w = largura) => doc.splitTextToSize(apenasLatin1(t), w) as string[];

  const quebra = (precisa = ENTRELINHA) => {

    if (y + precisa > altura) {

      doc.addPage();

      y = MARGEM;

    }

  };

  const escrever = (t: string, negrito = false, tamanho = TAMANHO) => {

    doc.setFont("helvetica", negrito ? "bold" : "normal");

    doc.setFontSize(tamanho);

    doc.setTextColor(0);

    for (const l of linhas(t)) {

      quebra();

      doc.text(l, MARGEM, y);

      y += ENTRELINHA;

    }

  };

  const regua = (cinza = 190) => {

    doc.setDrawColor(cinza);

    doc.setLineWidth(0.3);

    doc.line(MARGEM, y, MARGEM + largura, y);

  };



  // Cabeçalho do documento

  doc.setFont("helvetica", "bold");

  doc.setFontSize(18);

  doc.setTextColor(0);

  doc.text("PRONTUÁRIO MÉDICO", MARGEM, y + 5);

  doc.setFont("helvetica", "normal");

  doc.setFontSize(10);

  doc.setTextColor(CINZA);

  doc.text(ESPECIALIDADE.nome.toUpperCase(), MARGEM + largura, y + 5, { align: "right" });

  y += 10;

  regua(0);

  y += 6;



  // Identificação

  const idade = idadeEmAnos(nascimento ?? null);

  const nasc = nascimento

    ? `${nascimento.split("-").reverse().join("/")}${idade !== null ? ` (${idade} anos)` : ""}`

    : "";

  const campos: [string, string][] = [

    ["Paciente", paciente.trim()],

    ["Nascimento", nasc],

    ["Médico(a)", temMedico ? `${responsavel.nome.trim()} · ${responsavel.crm.trim()}` : ""],

    ["Emitido em", geradoEm.toLocaleString("pt-BR")],

  ];

  for (const [rotulo, valor] of campos) {

    if (!valor) continue;

    doc.setFont("helvetica", "bold");

    doc.setFontSize(10);

    doc.setTextColor(CINZA);

    doc.text(`${rotulo}:`, MARGEM, y);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(TAMANHO);

    doc.setTextColor(0);

    for (const l of linhas(valor, largura - 32)) {

      doc.text(l, MARGEM + 32, y);

      y += ENTRELINHA;

    }

  }

  y += 2;

  regua();

  y += 7;



  // Corpo

  const titulos = new Set(TITULOS_PRONTUARIO);

  const subtitulos = new Set(["Diagnóstico:", "Conduta:"]);

  for (const linha of texto.split("\n")) {

    if (linha === "") y += 2;

    else if (titulos.has(linha) || linha.startsWith("CONSULTA ") || linha.startsWith("RETORNO ")) {

      y += 3;

      quebra(ENTRELINHA * 3);

      escrever(linha, true, 12);

      y -= 3;

      regua(215);

      y += 4;

    } else escrever(linha, subtitulos.has(linha));

  }



  // Fecho: aviso e assinatura

  quebra(ENTRELINHA * 9);

  y += 8;

  escrever("Sugestões de apoio revisadas pelo médico, que responde pelas decisões clínicas.", false, 9);

  if (temMedico) {

    y += 14;

    doc.setDrawColor(0);

    doc.setLineWidth(0.3);

    doc.line(MARGEM, y, MARGEM + 70, y);

    y += 5;

    escrever(responsavel.nome.trim());

    escrever(responsavel.crm.trim());

  }



  // Cabeçalho corrido (2ª página em diante) e rodapé com numeração em todas

  const total = doc.getNumberOfPages();

  for (let i = 1; i <= total; i++) {

    doc.setPage(i);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(8);

    doc.setTextColor(CINZA);

    if (i > 1 && paciente.trim()) doc.text(`Prontuário — ${apenasLatin1(paciente.trim())}`, MARGEM, 12);

    const pe = doc.internal.pageSize.getHeight() - 10;

    doc.setDrawColor(215);

    doc.setLineWidth(0.2);

    doc.line(MARGEM, pe - 4, MARGEM + largura, pe - 4);

    doc.text(`${NOME_MAE} · ${ESPECIALIDADE.nome}`, MARGEM, pe);

    doc.text(`Página ${i} de ${total}`, MARGEM + largura, pe, { align: "right" });

  }

  return doc;

}



/** Gera o PDF e baixa no aparelho. */

export async function gerarPdfProntuario(dados: DadosPdf): Promise<void> {

  const doc = await montarPdf(dados);

  doc.save(nomeDoPdf(dados.geradoEm));

}



/** Gera o PDF como arquivo (para guardar no servidor e compartilhar). */

export async function criarPdfProntuario(dados: DadosPdf): Promise<{ blob: Blob; nome: string }> {

  const doc = await montarPdf(dados);

  return { blob: doc.output("blob"), nome: nomeDoPdf(dados.geradoEm) };

}



/**

 * Abre a folha de compartilhamento do aparelho (AirDrop, Arquivos, e-mail, WhatsApp). Onde não

 * existir, baixa o arquivo. Devolve "compartilhado", "baixado" ou "cancelado".

 */

export async function compartilharPdf(

  blob: Blob,

  nome: string,

): Promise<"compartilhado" | "baixado" | "cancelado"> {

  const arquivo = new File([blob], nome, { type: "application/pdf" });

  try {

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [arquivo] })) {

      await navigator.share({ files: [arquivo], title: "Prontuário" });

      return "compartilhado";

    }

  } catch (e) {

    if ((e as { name?: string })?.name === "AbortError") return "cancelado";

  }

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = nome;

  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return "baixado";

}

