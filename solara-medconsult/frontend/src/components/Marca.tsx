import { ESPECIALIDADE, NOME_MAE } from "@/lib/especialidade";

const AMBAR_SOBRE_COURO = "#FFB84D";

function Destaque({ children, couro }: { children: string; couro: boolean }) {
  return (
    <strong
      className="font-extrabold"
      style={{ color: couro ? AMBAR_SOBRE_COURO : "var(--color-ia)" }}
    >
      {children}
    </strong>
  );
}

/** "espec·IA·lidades · dermatologIA": o "IA" de cada nome em âmbar e negrito. */
export function Marca({ couro = false, className = "" }: { couro?: boolean; className?: string }) {
  const [antes, depois] = NOME_MAE.split("·IA·");
  const modulo = ESPECIALIDADE.nomeVisual;
  const raiz = modulo.endsWith("IA") ? modulo.slice(0, -2) : modulo;
  return (
    <span className={`whitespace-nowrap ${className}`} aria-label={`${NOME_MAE} · ${modulo}`}>
      <span aria-hidden="true">
        {antes}·<Destaque couro={couro}>IA</Destaque>·{depois} · {raiz}
        {modulo.endsWith("IA") && <Destaque couro={couro}>IA</Destaque>}
      </span>
    </span>
  );
}
