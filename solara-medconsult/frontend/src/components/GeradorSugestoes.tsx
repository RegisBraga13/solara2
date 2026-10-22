"use client";

import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { FonteSeletor } from "@/components/FonteSeletor";
import type { EstadoSugestao } from "@/hooks/useSugestoes";
import type { Fonte } from "@/lib/sugestoes";

interface GeradorSugestoesProps {
  estado: EstadoSugestao;
  /** Fontes automáticas desta tela (AI/RAG/Web; sem Diretrizes aqui). */
  fontesDisponiveis: Fonte[];
  onGerar: (fontes: Fonte[], colado: string) => void;
}

/**
 * O médico escolhe as fontes (AI/RAG/Web, múltipla escolha) e/ou cola um material (Open), e só
 * então toca em gerar. Nada é gerado sozinho, e o botão fica travado até haver alguma fonte ou
 * material colado.
 */
export function GeradorSugestoes({ estado, fontesDisponiveis, onGerar }: GeradorSugestoesProps) {
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [colado, setColado] = useState("");
  const semBase = estado === "ocioso";
  const carregando = estado === "carregando";
  const jaGerou = estado === "pronto";
  const podeGerar = fontes.length > 0 || colado.trim() !== "";

  return (
    <div className="flex flex-col gap-ds-3">
      <p className="text-base font-semibold">Escolha as fontes e toque em gerar:</p>
      <FonteSeletor
        fontes={fontes.filter((f) => fontesDisponiveis.includes(f))}
        onFontesChange={setFontes}
        colado={colado}
        onColadoChange={setColado}
      />
      <BigButton
        variant={jaGerou ? "secondary" : "primary"}
        className="disabled:cursor-not-allowed disabled:opacity-50"
        disabled={semBase || carregando || !podeGerar}
        onClick={() => onGerar(fontes, colado)}
      >
        {carregando ? "GERANDO…" : jaGerou ? "GERAR NOVAMENTE" : "GERAR SUGESTÕES"}
      </BigButton>
      {estado === "aguardando" && (
        <p className="text-base text-muted">Nada é gerado até você tocar em gerar.</p>
      )}
      {jaGerou && (
        <p className="text-base text-muted">
          Gerar de novo troca a lista sugerida. O que você marcou continua marcado. As sugestões não ficam salvas: só a sua escolha.
        </p>
      )}
    </div>
  );
}
