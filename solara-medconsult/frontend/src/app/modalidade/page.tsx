"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import { usePersist } from "@/hooks/usePersist";
import { useConsulta, type Modo } from "@/store/consulta";

/** Depois de escolher o que fazer (Atendimento, "/"): a modalidade da consulta. */
export default function ModalidadePage() {
  const router = useRouter();
  const hidratado = usePersist();
  const emAndamento = useConsulta((s) => s.iniciada_em !== null);
  const setModo = useConsulta((s) => s.setModo);

  // Lido do browser (não useSearchParams) para não exigir Suspense nesta página.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get("next"));
  }, []);

  useEffect(() => {
    if (hidratado && next === null) router.replace("/");
  }, [hidratado, next, router]);

  function escolher(modo: Modo) {
    if (!hidratado || !next) return;
    if (!emAndamento) setModo(modo); // com consulta aberta, o modo dela não muda
    router.push(next);
  }

  return (
    <TelaSimples titulo="MODALIDADE">
      <Panel>
        <div className="grid grid-cols-1 gap-ds-4 md:grid-cols-2 md:gap-ds-5">
          <BigButton className="md:min-h-[120px]" disabled={!hidratado || !next} onClick={() => escolher("online")}>
            ONLINE
          </BigButton>
          <BigButton
            className="md:min-h-[120px]"
            disabled={!hidratado || !next}
            onClick={() => escolher("presencial")}
          >
            PRESENCIAL
          </BigButton>
        </div>
      </Panel>
    </TelaSimples>
  );
}
