/** A luz de tempo surge aos 00:30 da consulta. */
export const APARECE_EM_MS = 30 * 1000;
/** A partir de 45:00 a luz passa a âmbar com respiração suave. */
export const ALERTA_EM_MS = 45 * 60 * 1000;

export type FaseTempo = "oculto" | "normal" | "alerta";

export function faseDoTempo(decorridoMs: number): FaseTempo {
  if (!Number.isFinite(decorridoMs) || decorridoMs < APARECE_EM_MS) return "oculto";
  return decorridoMs < ALERTA_EM_MS ? "normal" : "alerta";
}

/** mm:ss (os minutos passam de 59 sem virar hora, ex.: 75:03). */
export function formatarTempo(decorridoMs: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(decorridoMs) ? decorridoMs : 0) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
