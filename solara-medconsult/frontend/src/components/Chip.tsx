import { partirTermo } from "@/lib/sugestoes";

interface ChipProps {
  rotulo: string;
  selecionado: boolean;
  onToggle: () => void;
  /** Estimativa da IA em % (diagnóstico). Negativo ou ausente = não mostra. */
  percentual?: number;
}

function Check() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Item selecionável: levantado quando livre, afundado (couro) quando selecionado. */
export function Chip({ rotulo, selecionado, onToggle, percentual }: ChipProps) {
  const bloco = partirTermo(rotulo); // "Exames laboratoriais: a, b" aparece como um bloco só
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selecionado}
      onClick={onToggle}
      className={`chip flex w-full items-center gap-3 text-left ${selecionado ? "chip-on" : "chip-off"}`}
    >
      <span className="flex-1">
        {bloco.componentes.length > 0 ? (
          <>
            <span className="font-bold">{bloco.titulo}</span>
            <span className="mt-1 block text-base font-normal leading-snug opacity-85">
              {bloco.componentes.join(" · ")}
            </span>
          </>
        ) : (
          rotulo
        )}
      </span>
      {percentual !== undefined && percentual >= 0 && (
        <span
          aria-label={`estimativa ${percentual} por cento`}
          className={`rounded-full px-2 py-0.5 text-sm font-bold ${
            selecionado ? "bg-black/15 text-white" : "bg-sunken text-muted"
          }`}
        >
          {percentual}%
        </span>
      )}
      {selecionado && <Check />}
    </button>
  );
}
