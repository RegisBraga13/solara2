"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { usePersist } from "@/hooks/usePersist";
import { useConsulta } from "@/store/consulta";

/**
 * Para as telas de 2 a 8:
 * - espera o rascunho ser restaurado;
 * - sem consulta iniciada (modo vazio), volta para a Home;
 * - registra a etapa atual e garante que o relógio da consulta esteja correndo.
 *
 * Devolve `true` quando a tela já pode ser exibida.
 */
export function useEtapa(etapa: number): boolean {
  const router = useRouter();
  const hidratado = usePersist();
  const modo = useConsulta((s) => s.modo);
  const setEtapa = useConsulta((s) => s.setEtapa);
  const iniciarConsulta = useConsulta((s) => s.iniciarConsulta);
  const pronto = hidratado && modo !== null;

  useEffect(() => {
    if (hidratado && modo === null) router.replace("/");
  }, [hidratado, modo, router]);

  useEffect(() => {
    if (pronto) {
      setEtapa(etapa);
      iniciarConsulta(); // rascunhos antigos, sem horário de início
    }
  }, [pronto, etapa, setEtapa, iniciarConsulta]);

  return pronto;
}
