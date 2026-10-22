"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { usePersist } from "@/hooks/usePersist";
import { ROTA_EVOLUCAO } from "@/lib/rotas";
import { useConsulta, type TipoConsulta } from "@/store/consulta";

/**
 * Começo de uma consulta. O modo (ONLINE/PRESENCIAL) vem da Home; sem ele, volta à Home.
 * Com uma consulta em andamento não deixa começar outra.
 */
export function useComecarConsulta() {
  const router = useRouter();
  const hidratado = usePersist();
  const modo = useConsulta((s) => s.modo);
  const emAndamento = useConsulta((s) => s.iniciada_em !== null);
  const reset = useConsulta((s) => s.reset);
  const setContexto = useConsulta((s) => s.setContexto);
  const setModo = useConsulta((s) => s.setModo);
  const setEtapa = useConsulta((s) => s.setEtapa);
  const iniciarConsulta = useConsulta((s) => s.iniciarConsulta);

  useEffect(() => {
    if (hidratado && !modo && !emAndamento) router.replace("/");
  }, [hidratado, modo, emAndamento, router]);

  function comecar(paciente: { id: string; nome: string }, tipo: TipoConsulta, retornoDe: string | null) {
    if (!hidratado || !modo || emAndamento) return;
    reset();
    setContexto({ pacienteId: paciente.id, paciente: paciente.nome, tipo, retornoDe });
    iniciarConsulta();
    setModo(modo);
    setEtapa(2);
    router.push(tipo === "retorno" ? ROTA_EVOLUCAO : "/anamnese"); // retorno = Evolução (1 tela)
  }

  return { hidratado, modo, emAndamento, comecar };
}
