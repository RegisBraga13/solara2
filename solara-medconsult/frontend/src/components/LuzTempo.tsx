"use client";

import { useEffect, useState } from "react";

import { faseDoTempo, formatarTempo } from "@/lib/tempo";

/**
 * Aviso luminoso discreto do tempo de consulta. Não encerra nada: só informa.
 * - antes de 00:30: não aparece;
 * - 00:30 a 44:59: ponto verde suave, sem animação;
 * - 45:00 em diante: ponto âmbar luminoso com respiração de 3 s.
 */
export function LuzTempo({ iniciadaEm }: { iniciadaEm: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (iniciadaEm === null) return;
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iniciadaEm]);

  if (iniciadaEm === null) return null;
  const decorrido = agora - iniciadaEm;
  const fase = faseDoTempo(decorrido);
  if (fase === "oculto") return null;

  const rotulo =
    fase === "alerta"
      ? `Consulta com ${formatarTempo(decorrido)}: passou de 45 minutos`
      : `Consulta com ${formatarTempo(decorrido)}`;

  return (
    <span
      role="status"
      aria-label={rotulo}
      title={rotulo}
      data-fase={fase}
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${fase === "alerta" ? "luz-alerta" : "luz-normal"}`}
    />
  );
}
