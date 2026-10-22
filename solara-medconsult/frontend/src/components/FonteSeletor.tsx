"use client";

import { useState } from "react";

import type { Fonte } from "@/lib/sugestoes";

interface FonteSeletorProps {
  fontes: Fonte[];
  onFontesChange: (fontes: Fonte[]) => void;
  colado: string;
  onColadoChange: (texto: string) => void;
}

function Botao({ rotulo, ativo, onClick }: { rotulo: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ativo}
      onClick={onClick}
      className={`chip justify-center text-center ${ativo ? "chip-on" : "chip-off"}`}
    >
      {rotulo}
    </button>
  );
}

/**
 * Fontes automáticas (AI, RAG, Web — múltipla escolha; o app busca sozinho) + Open: o médico cola
 * manualmente o que trouxer (ex.: da OpenEvidence), sem nenhuma busca automática. Só escolhe o
 * que vai ser usado no próximo "gerar"; nada é buscado aqui.
 */
export function FonteSeletor({ fontes, onFontesChange, colado, onColadoChange }: FonteSeletorProps) {
  const [openAberto, setOpenAberto] = useState(() => colado.trim() !== "");

  const tem = (f: Fonte) => fontes.includes(f);
  const toggle = (f: Fonte) =>
    onFontesChange(tem(f) ? fontes.filter((x) => x !== f) : [...fontes, f]);

  return (
    <div className="flex flex-col gap-ds-3">
      <div className="grid grid-cols-2 gap-ds-3">
        <Botao rotulo="AI" ativo={tem("AI")} onClick={() => toggle("AI")} />
        <Botao rotulo="RAG" ativo={tem("RAG")} onClick={() => toggle("RAG")} />
        <Botao rotulo="Open" ativo={openAberto} onClick={() => setOpenAberto((v) => !v)} />
        <Botao rotulo="Web" ativo={tem("Web")} onClick={() => toggle("Web")} />
      </div>
      {openAberto && (
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Colar da OpenEvidence (ou outra fonte)</span>
          <textarea
            value={colado}
            onChange={(e) => onColadoChange(e.target.value)}
            placeholder="Cole aqui o texto."
            className="input-sunken min-h-[100px]"
          />
        </label>
      )}
    </div>
  );
}
