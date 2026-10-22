"use client";

import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { EscalasPsiquiatria, ESCALAS_ITEM_A_ITEM } from "@/components/EscalasPsiquiatria";
import { Panel } from "@/components/Panel";
import { ESPECIALIDADE, type EscalaClinica } from "@/lib/especialidade";
import { useConsulta } from "@/store/consulta";

/**
 * Escalas aplicadas na consulta (ex.: PHQ-9 na psiquiatria). O escore vai para o prontuário.
 * Só aparece se a especialidade ativa define escalas; é um registro do médico, não uma sugestão da IA.
 * Psiquiatria: PHQ-9 e GAD-7 são respondidos item a item (soma automática); as demais escalas
 * (YMRS, PANSS) e as das outras especialidades seguem como escore digitado.
 */
export function EscalasClinicas() {
  const itemAItem = ESPECIALIDADE.slug === "psiquiatria";
  const manuais = itemAItem
    ? ESPECIALIDADE.escalas.filter((e) => !ESCALAS_ITEM_A_ITEM.includes(e.id))
    : ESPECIALIDADE.escalas;

  return (
    <>
      {itemAItem && <EscalasPsiquiatria />}
      {manuais.length > 0 && <EscoresManuais escalas={manuais} />}
    </>
  );
}

function EscoresManuais({ escalas: definicoes }: { escalas: EscalaClinica[] }) {
  const escalas = useConsulta((s) => s.escalas);
  const setEscala = useConsulta((s) => s.setEscala);
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <Panel className="flex flex-col gap-ds-3">
      <div>
        <h2 className="text-xl font-bold tracking-wide">🧪 TESTES E ESCALAS</h2>
        <p className="mt-1 text-base text-muted">
          Escolha a escala aplicada e registre o escore. Ele vai para o prontuário.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {definicoes.map((e) => {
          const selecionada = aberta === e.id;
          const valor = escalas[e.id] ?? "";
          return (
            <div key={e.id} className="flex flex-col gap-2">
              <BigButton
                variant={selecionada || valor ? "primary" : "secondary"}
                onClick={() => setAberta(selecionada ? null : e.id)}
              >
                {e.nome}
                {valor ? `: ${valor}` : ""}
              </BigButton>
              {selecionada && (
                <label className="flex items-center justify-between gap-3 rounded-xl bg-sunken p-3 text-base">
                  <span>
                    {e.descricao} (0–{e.max})
                  </span>
                  <input
                    aria-label={`Escore ${e.nome}`}
                    type={e.casas ? "text" : "number"}
                    inputMode={e.casas ? "decimal" : "numeric"}
                    min={0}
                    max={e.max}
                    value={valor}
                    onChange={(ev) => setEscala(e.id, ev.target.value, e.max, e.casas ?? 0)}
                    className="input-sunken w-24 text-center"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
