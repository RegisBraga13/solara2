// Identidade do médico (nome, CRM, cidade): fica só neste aparelho (sem login por enquanto).
// Usada por Receita, Atestado e Declaração para preencher o rodapé e o local de emissão.

export interface Medico {
  nome: string;
  crm: string;
  cidade: string;
}

export const MEDICO_VAZIO: Medico = { nome: "", crm: "", cidade: "" };

const CHAVE_MEDICO = "medconsult-medico";

export const medicoValido = (m: Medico): boolean =>
  m.nome.trim().length >= 3 && m.crm.trim().length >= 3;

/** A cidade só é exigida em documentos que a usam (Atestado, Declaração) — não na Receita. */
export const cidadeValida = (m: Medico): boolean => m.cidade.trim().length >= 2;

export function lerMedico(): Medico {
  try {
    const bruto = window.localStorage.getItem(CHAVE_MEDICO);
    if (!bruto) return MEDICO_VAZIO;
    const m = JSON.parse(bruto) as Partial<Medico>;
    return { nome: String(m.nome ?? ""), crm: String(m.crm ?? ""), cidade: String(m.cidade ?? "") };
  } catch {
    return MEDICO_VAZIO;
  }
}

export function guardarMedico(m: Medico): void {
  try {
    window.localStorage.setItem(CHAVE_MEDICO, JSON.stringify(m));
  } catch {
    // sem armazenamento: o médico digita de novo na próxima vez
  }
}
