"use client";

import { useEffect, useState } from "react";

import { Panel } from "@/components/Panel";
import { obterProntuario, type ProntuarioCompleto } from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { useConsulta } from "@/store/consulta";

/** Busca no servidor a consulta anterior do retorno (texto e data). */
export function useConsultaAnterior() {
  const retornoDe = useConsulta((s) => s.retornoDe);
  const [p, setP] = useState<ProntuarioCompleto | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!retornoDe) return;
    setErro(false);
    obterProntuario(retornoDe)
      .then(setP)
      .catch(() => setErro(true));
  }, [retornoDe]);

  return { p, erro, temRetorno: Boolean(retornoDe) };
}

/** Painel recolhido com o texto da consulta anterior. */
export function PainelConsultaAnterior({ p, erro }: { p: ProntuarioCompleto | null; erro: boolean }) {
  return (
    <Panel>
      <details>
        <summary className="cursor-pointer text-lg font-bold">
          📂 Consulta anterior{p ? ` (${formatarData(p.criado_em)})` : ""}
        </summary>
        {erro && <p className="mt-ds-3 text-base font-semibold">⚠️ Não foi possível abrir a consulta anterior.</p>}
        {!erro && !p && <p className="mt-ds-3 text-base text-muted">Carregando…</p>}
        {p && <pre className="mt-ds-3 whitespace-pre-wrap font-sans text-base leading-relaxed">{p.texto}</pre>}
      </details>
    </Panel>
  );
}

/** No retorno: mostra, recolhida, a consulta anterior do paciente para consulta rápida. */
export function ConsultaAnterior() {
  const { p, erro, temRetorno } = useConsultaAnterior();
  if (!temRetorno) return null;
  return <PainelConsultaAnterior p={p} erro={erro} />;
}
