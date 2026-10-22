"use client";

import { useRouter } from "next/navigation";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";
import { rotaDaConsulta } from "@/lib/rotas";
import { useConsulta } from "@/store/consulta";

/** Aviso no lugar de "começar": há uma consulta aberta e é preciso terminá-la (ou sair dela) antes. */
export function ConsultaEmAndamento() {
  const router = useRouter();
  const etapaAtual = useConsulta((s) => s.etapa_atual);
  const tipo = useConsulta((s) => s.tipo);
  return (
    <Panel className="flex flex-col gap-ds-4">
      <p role="note" className="text-lg font-semibold">
        ⚠️ Há uma consulta em andamento. Termine-a, ou toque em <strong>Sair</strong> dentro dela, antes de
        começar outra.
      </p>
      <BigButton onClick={() => router.push(rotaDaConsulta(tipo, etapaAtual))}>CONTINUAR CONSULTA EM ANDAMENTO</BigButton>
    </Panel>
  );
}
