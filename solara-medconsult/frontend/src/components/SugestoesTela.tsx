"use client";

import { useState, type ReactNode } from "react";

import { AcrescentarItem } from "@/components/AcrescentarItem";
import { AvisoSugestao } from "@/components/AvisoSugestao";
import { BigButton } from "@/components/BigButton";
import { Chip } from "@/components/Chip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GeradorSugestoes } from "@/components/GeradorSugestoes";
import { Panel } from "@/components/Panel";
import type { EstadoSugestao } from "@/hooks/useSugestoes";
import { normalizar, type Fonte, type ItemSugerido } from "@/lib/sugestoes";



interface SugestoesTelaProps {
  itens: ItemSugerido[];
  extras: string[];
  selecionados: string[];
  /** Fontes consultadas a cada pedido (todas; o médico não as escolhe). */
  fontesDisponiveis: Fonte[];
  estado: EstadoSugestao;
  /** Texto quando não há o que pedir ao servidor. */
  semBase: string;
  onGerar: (fontes: Fonte[], colado: string) => void;
  onToggle: (termo: string) => void;
  onAdd: (termo: string) => boolean;
  /** Sem estes três, a tela não mostra o botão de concluir (ex.: dentro da Evolução). */
  rotuloConcluir?: string;
  mensagemConfirmacao?: string;
  onConcluir?: () => void;
  /** Bloco extra acima do gerador (ex.: Whitebook e anotações). */
  apoio?: ReactNode;
}

/** Corpo compartilhado de Diagnóstico e Tratamento. Nada é gerado sem o médico mandar. */
export function SugestoesTela(p: SugestoesTelaProps) {
  const [confirmando, setConfirmando] = useState(false);

  function concluir() {
    if (p.selecionados.length === 0) setConfirmando(true);
    else p.onConcluir?.();
  }

  return (
    <>
      {p.apoio}
      <GeradorSugestoes estado={p.estado} fontesDisponiveis={p.fontesDisponiveis} onGerar={p.onGerar} />

      <AvisoSugestao estado={p.estado} semBase={p.semBase} />

      <Panel className="flex flex-col gap-ds-3">
        {p.itens.map((i) => (
          <Chip
            key={i.termo}
            rotulo={i.termo}
            percentual={i.percentual}
            selecionado={p.selecionados.includes(i.termo)}
            onToggle={() => p.onToggle(i.termo)}
          />
        ))}
        {p.extras
          .filter((e) => !p.itens.some((i) => normalizar(i.termo) === normalizar(e)))
          .map((t) => (
          <Chip key={t} rotulo={t} selecionado={p.selecionados.includes(t)} onToggle={() => p.onToggle(t)} />
        ))}
        {p.estado === "pronto" && p.itens.length === 0 && p.extras.length === 0 && (
          <p className="text-muted">Nenhuma sugestão encontrada.</p>
        )}
        <AcrescentarItem rotulo="+ ACRESCENTAR" onAdd={p.onAdd} />
      </Panel>

      <p className="text-base text-muted">{p.selecionados.length} item(ns) selecionado(s)</p>
      {p.onConcluir && <BigButton onClick={concluir}>{p.rotuloConcluir}</BigButton>}

      <ConfirmDialog
        aberto={confirmando}
        mensagem={p.mensagemConfirmacao ?? ""}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          p.onConcluir?.();
        }}
      />
    </>
  );
}
