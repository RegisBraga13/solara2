interface ProgressDotsProps {
  total?: number;
  atual: number;
  /** Se informado, cada ponto vira um botão que leva direto àquela etapa. */
  onSelecionar?: (etapa: number) => void;
}

/** Ponto atual em couro (10px, relevo); demais discretos (6px, 50%). */
export function ProgressDots({ total = 8, atual, onSelecionar }: ProgressDotsProps) {
  const a11y = onSelecionar
    ? { role: "group", "aria-label": `Etapas (atual: ${atual} de ${total})` }
    : {
        role: "progressbar",
        "aria-valuemin": 1,
        "aria-valuemax": total,
        "aria-valuenow": atual,
        "aria-label": `Etapa ${atual} de ${total}`,
      };
  return (
    <div {...a11y} className={`flex items-center ${onSelecionar ? "gap-0" : "gap-ds-2"}`}>
      {Array.from({ length: total }, (_, i) => {
        const atualPonto = i + 1 === atual;
        const ponto = (
          <span
            className={`skeu block rounded-full ${
              atualPonto
                ? "h-[10px] w-[10px] bg-leather shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                : "h-[6px] w-[6px] bg-muted opacity-50"
            }`}
          />
        );
        if (!onSelecionar) return <span key={i}>{ponto}</span>;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Ir para a etapa ${i + 1}`}
            aria-current={atualPonto ? "step" : undefined}
            onClick={() => onSelecionar(i + 1)}
            className="touch inline-flex h-11 w-7 items-center justify-center md:w-11"
          >
            {ponto}
          </button>
        );
      })}
    </div>
  );
}
