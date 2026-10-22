"use client";

import type { ReactNode } from "react";

import { AcrescentarItem } from "@/components/AcrescentarItem";
import { AvisoSugestao } from "@/components/AvisoSugestao";
import { BigButton } from "@/components/BigButton";
import { Chip } from "@/components/Chip";
import { GeradorSugestoes } from "@/components/GeradorSugestoes";
import { Panel } from "@/components/Panel";
import type { EstadoSugestao } from "@/hooks/useSugestoes";
import { FONTES, normalizar, type DefSecao, type Fonte, type ItemSecao, type Secao } from "@/lib/sugestoes";

interface SecoesTelaProps<S extends Secao> {
  defs: DefSecao<S>[];
  itens: ItemSecao<S>[];
  extras: Record<S, string[]>;
  selecionados: string[];
  estado: EstadoSugestao;
  semBase: string;
  onGerar: (fontes: Fonte[]) => void;
  onToggle: (termo: string) => void;
  onAdd: (secao: S, termo: string) => boolean;
  /** Sem estes dois, a tela não mostra o botão de concluir (ex.: dentro da Evolução). */
  rotuloConcluir?: string;
  onConcluir?: () => void;
  /** Bloco extra acima do gerador (ex.: Whitebook e anotações). */
  apoio?: ReactNode;
}

/** Corpo compartilhado de Propedêutica e Orientações: gerar (fontes escolhidas) + seções. */
export function SecoesTela<S extends Secao>(p: SecoesTelaProps<S>) {
  return (
    <>
      {p.apoio}
      <GeradorSugestoes estado={p.estado} fontesDisponiveis={FONTES} onGerar={p.onGerar} />
      <AvisoSugestao estado={p.estado} semBase={p.semBase} />
      {p.defs.map(({ chave, titulo }) => (
        <Panel key={chave} className="flex flex-col gap-ds-3">
          <h2 className="text-xl font-bold tracking-wide">{titulo}</h2>
          {p.itens
            .filter((i) => i.secao === chave)
            .map((i) => (
              <Chip
                key={i.termo}
                rotulo={i.termo}
                selecionado={p.selecionados.includes(i.termo)}
                onToggle={() => p.onToggle(i.termo)}
              />
            ))}
          {(p.extras[chave] ?? [])
            .filter((e) => !p.itens.some((i) => normalizar(i.termo) === normalizar(e)))
            .map((item) => (
            <Chip
              key={item}
              rotulo={item}
              selecionado={p.selecionados.includes(item)}
              onToggle={() => p.onToggle(item)}
            />
          ))}
          <AcrescentarItem rotulo="+ ACRESCENTAR" onAdd={(t) => p.onAdd(chave, t)} />
        </Panel>
      ))}
      <p className="text-base text-muted">{p.selecionados.length} itens selecionados</p>
      {p.onConcluir && <BigButton onClick={p.onConcluir}>{p.rotuloConcluir}</BigButton>}
    </>
  );
}
