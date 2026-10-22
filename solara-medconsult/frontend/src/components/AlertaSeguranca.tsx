import type { PreConsultaApi } from "@/lib/api";

const RISCOS: { campo: keyof PreConsultaApi["respostas"]["seguranca"]; texto: string }[] = [
  {
    campo: "possui_marcapasso_ou_implante_metalico",
    texto: "Marcapasso ou implante metálico — contraindicação para radiofrequência, eletrocautério e ultrassom microfocado.",
  },
  {
    campo: "historico_herpes_simples",
    texto: "Histórico de herpes simples — exige profilaxia antiviral antes de laser ou peeling.",
  },
  {
    campo: "tendencia_queloide",
    texto: "Tendência a queloide — risco em procedimentos cirúrgicos ou ablativos.",
  },
];

/** Banner de risco a partir da pré-consulta mais recente do paciente. Nulo se não houver nada crítico. */
export function AlertaSeguranca({ preConsulta }: { preConsulta: PreConsultaApi | null }) {
  if (!preConsulta || !preConsulta.alerta_critico) return null;
  const seguranca = preConsulta.respostas.seguranca;
  const ativos = RISCOS.filter((r) => seguranca[r.campo]);

  return (
    <div
      role="alert"
      className="animate-pulse rounded-2xl border-2 border-red-700 bg-red-600 p-ds-5 text-white shadow-card"
    >
      <p className="flex items-center gap-2 text-xl font-bold tracking-wide">
        <span aria-hidden="true">🛡️</span> ALERTA CRÍTICO DE SEGURANÇA
      </p>
      <ul className="mt-ds-3 flex flex-col gap-2 text-base">
        {ativos.map((r) => (
          <li key={r.campo}>• {r.texto}</li>
        ))}
      </ul>
    </div>
  );
}
