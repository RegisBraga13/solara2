"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LuzTempo } from "@/components/LuzTempo";
import { ProgressDots } from "@/components/ProgressDots";
import { rotaDaEtapa } from "@/lib/rotas";
import { useConsulta } from "@/store/consulta";

/**
 * Navegação livre entre as 8 etapas + luz de tempo + "Sair".
 * "Sair" é a única forma de encerrar a consulta: apaga o rascunho e volta à Home.
 */
export function BarraConsulta({ etapa, simples = false }: { etapa: number; simples?: boolean }) {
  const router = useRouter();
  const iniciadaEm = useConsulta((s) => s.iniciada_em);
  const reset = useConsulta((s) => s.reset);
  const [confirmando, setConfirmando] = useState(false);

  function sair() {
    setConfirmando(false);
    reset();
    router.push("/");
  }

  return (
    <div className="flex items-center gap-ds-3">
      {!simples && <ProgressDots atual={etapa} onSelecionar={(e) => router.push(rotaDaEtapa(e))} />}
      <LuzTempo iniciadaEm={iniciadaEm} />
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="touch skeu inline-flex min-h-[44px] items-center rounded-md px-3 text-base font-medium text-muted active:translate-y-px md:hover:text-ink"
      >
        Sair
      </button>
      <ConfirmDialog
        aberto={confirmando}
        mensagem="Encerrar a consulta? Os dados desta consulta serão apagados."
        onConfirmar={sair}
        onCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
