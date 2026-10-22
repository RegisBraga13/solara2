/** Data e hora de um registro do servidor (guardado em UTC, sem sufixo) no horário do aparelho. */
export const formatarData = (iso: string) =>
  new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });