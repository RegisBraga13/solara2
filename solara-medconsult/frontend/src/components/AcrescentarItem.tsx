"use client";

import { useState } from "react";

interface AcrescentarItemProps {
  rotulo: string;
  onAdd: (termo: string) => boolean;
}

export function AcrescentarItem({ rotulo, onAdd }: AcrescentarItemProps) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(false);

  function enviar() {
    if (onAdd(valor)) {
      setValor("");
      setErro(false);
      setAberto(false);
    } else {
      setErro(true);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="touch skeu min-h-[48px] w-full rounded-lg border-2 border-dashed border-line-strong px-4 text-base font-semibold text-accent-text"
      >
        {rotulo}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-ds-3">
        <input
          autoFocus
          aria-label="Novo item"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setErro(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          className="input-sunken flex-1"
        />
        <button type="button" onClick={enviar} className="btn btn-primary skeu-leather !min-h-[48px] !px-6 !text-base">
          Adicionar
        </button>
      </div>
      {erro && <p role="alert" className="text-base text-muted">Informe um termo novo (vazio ou já existente).</p>}
    </div>
  );
}
