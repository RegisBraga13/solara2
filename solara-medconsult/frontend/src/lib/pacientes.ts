import type { Paciente } from "@/lib/api";
import { formatarData } from "@/lib/datas";

/** Idade em anos a partir de AAAA-MM-DD (null se não houver data). */
export function idadeEmAnos(nascimento: string | null, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split("-").map(Number);
  if (!a || !m || !d) return null;
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade -= 1;
  return idade >= 0 ? idade : null;
}

/** Máscara 000.000.000-00 enquanto digita (só números, até 11). */
export function formatarCpf(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".");
  return d.length > 9 ? `${partes}-${d.slice(9)}` : partes;
}

/** "42 anos · 3 consulta(s) · última 08/10/2026 15:30" */
export function resumoDoPaciente(p: Paciente): string {
  const partes: string[] = [];
  const idade = idadeEmAnos(p.nascimento);
  if (idade !== null) partes.push(`${idade} anos`);
  partes.push(p.n_prontuarios === 0 ? "sem consultas" : `${p.n_prontuarios} consulta(s)`);
  if (p.ultima_consulta) partes.push(`última ${formatarData(p.ultima_consulta)}`);
  return partes.join(" · ");
}
