export const TOTAL_ETAPAS = 9;

/** Rota de cada etapa, na ordem: 1 = Home ... 9 = Prontuário. */
export const ROTAS = [
  "/",
  "/anamnese",
  "/captura",
  "/exame-fisico",
  "/historia",
  "/diagnostico",
  "/propedeutica",
  "/tratamento",
  "/prontuario",
] as const;

export function rotaDaEtapa(etapa: number): string {
  const n = Number.isFinite(etapa) ? Math.trunc(etapa) : 1;
  const i = Math.min(Math.max(n, 1), TOTAL_ETAPAS) - 1;
  return ROTAS[i];
}

/** Onde "continuar" leva: o retorno tem uma tela só (Evolução); a consulta segue as 9 etapas. */
export function rotaDaConsulta(tipo: "nova" | "retorno", etapa: number): string {
  return tipo === "retorno" ? ROTA_EVOLUCAO : rotaDaEtapa(etapa);
}

export const ROTA_EVOLUCAO = "/evolucao";
