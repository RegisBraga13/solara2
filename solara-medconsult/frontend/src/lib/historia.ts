import { idadeEmAnos } from "@/lib/pacientes";
import type { ConsultaData, ImagemEnviada } from "@/store/consulta";

const ROTULO = {
  medico: "Médico",
  paciente: "Paciente",
  acompanhante: "Acompanhante",
  indefinido: "Voz",
} as const;

/** AAAA-MM-DD -> DD/MM/AAAA (sem passar por Date, para não deslocar o dia por fuso). */
export function dataBr(iso: string | null): string {
  if (!iso) return "sem data";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : "sem data";
}

/**
 * Registro BRUTO da consulta: exatamente o que foi capturado, sem reescrever nada.
 * (A reconstituição no padrão médico por IA ainda não existe nesta versão.)
 * Devolve "" quando nada foi registrado.
 */
export function registroBruto(
  d: Pick<ConsultaData, "captura" | "exameFisico" | "transcricoes" | "imagens">,
): string {
  const partes: string[] = [];

  const texto = d.captura.texto.trim();
  if (texto) partes.push(`ANAMNESE (texto digitado)\n${texto}`);

  if (d.transcricoes.length > 0) {
    const linhas = d.transcricoes.map((t) => `[${ROTULO[t.speaker]}] ${t.text}`);
    partes.push(`DIÁLOGO TRANSCRITO\n${linhas.join("\n")}`);
  }

  const exame = d.exameFisico.texto.trim();
  if (exame) partes.push(`EXAME FÍSICO E COMPLEMENTOS (texto digitado)\n${exame}`);

  if (d.imagens.length > 0) {
    const ordenadas = [...d.imagens].sort((a, b) =>
      a.data === b.data ? 0 : a.data === null ? 1 : b.data === null ? -1 : a.data < b.data ? -1 : 1,
    );
    const linhas = ordenadas.map(
      (i) => `- ${dataBr(i.data)} (${i.nome}): ${i.descricao ?? "sem descrição automática"}`,
    );
    partes.push(`IMAGENS (descrição automática, a revisar)\n${linhas.join("\n")}`);
  }

  return partes.join("\n\n");
}

/**
 * Seção "Identificação" da história clínica (padrão de 5 seções): idade, sexo e profissão do
 * cadastro. Dado estruturado, nunca passa pelo modelo — "" se não houver paciente ligado ou
 * nenhum desses campos estiver preenchido.
 */
export function linhaIdentificacao(
  p: { nascimento: string | null; sexo: string | null; profissao: string | null } | null,
): string {
  if (!p) return "";
  const idade = idadeEmAnos(p.nascimento);
  const dados = [
    idade !== null ? `${idade} anos` : null,
    p.sexo?.trim() ? `sexo ${p.sexo.trim().toLowerCase()}` : null,
    p.profissao?.trim() ? `profissão ${p.profissao.trim().toLowerCase()}` : null,
  ].filter((x): x is string => Boolean(x));
  return dados.length > 0 ? `Identificação: ${dados.join(", ")}.` : "";
}

/**
 * Seção "Exame físico" da história clínica (padrão de 5 seções): texto digitado na tela de Exame
 * Físico e Complementos + descrição automática das imagens. Sempre presente, mesmo vazia (nunca
 * omitida, para não parecer que o exame foi esquecido) — nunca passa pelo modelo.
 */
export function linhaExameFisico(texto: string, imagens: ImagemEnviada[]): string {
  const descricoes = imagens.map((i) => i.descricao).filter((d): d is string => Boolean(d));
  const corpo = [texto.trim(), ...descricoes].filter(Boolean).join(" ");
  return `Exame físico: ${corpo || "Não relatado."}`;
}
