"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import { useConsulta } from "@/store/consulta";

function Cartao({ rotulo, icone, ativo, onToggle }: { rotulo: string; icone: string; ativo: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ativo}
      onClick={onToggle}
      className={`skeu touch relative flex min-h-[160px] flex-col items-center justify-center gap-ds-3 rounded-xl p-ds-5 text-xl font-bold tracking-wide ${
        ativo ? "bg-sunken shadow-pressed ring-2 ring-leather" : "bg-surface shadow-raised"
      }`}
    >
      {ativo && (
        <span aria-hidden="true" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ok font-bold text-white">
          ✓
        </span>
      )}
      <span aria-hidden="true" className="text-4xl">{icone}</span>
      {rotulo}
    </button>
  );
}

function Conteudo() {
  const router = useRouter();
  const salvo = useConsulta((s) => s.anamnese);
  const setAnamnese = useConsulta((s) => s.setAnamnese);
  const setEtapa = useConsulta((s) => s.setEtapa);
  const [voz, setVoz] = useState(salvo.voz);
  const [texto, setTexto] = useState(salvo.texto);
  const qtd = Number(voz) + Number(texto);

  function continuar() {
    setAnamnese({ voz, texto });
    setEtapa(3);
    router.push("/captura");
  }

  return (
    <Tela etapa={2} titulo="ANAMNESE">
      <p className="text-lg text-muted">Você pode combinar as duas formas de registro.</p>
      <div className="grid grid-cols-1 gap-ds-4 md:grid-cols-2 md:gap-ds-5">
        <Cartao rotulo="POR VOZ" icone="🎙️" ativo={voz} onToggle={() => setVoz(!voz)} />
        <Cartao rotulo="TEXTO ESCRITO" icone="⌨️" ativo={texto} onToggle={() => setTexto(!texto)} />
      </div>
      <p className="text-center text-base text-muted">{qtd} forma(s) selecionada(s)</p>
      <BigButton disabled={qtd === 0} onClick={continuar}>
        CONTINUAR
      </BigButton>
    </Tela>
  );
}

export default function AnamnesePage() {
  const pronto = useEtapa(2);
  return pronto ? <Conteudo /> : null;
}
