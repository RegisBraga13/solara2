"use client";

import { useMemo, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";
import { useConsulta } from "@/store/consulta";

type EscalaId = "phq9" | "gad7";

type Pergunta = {
  id: string;
  texto: string;
};

const OPCOES = [
  "Nunca",
  "Vários dias",
  "Mais da metade dos dias",
  "Quase todos os dias",
] as const;

// Instrumentos de domínio público; a pergunta se refere às últimas duas semanas.
const PERGUNTAS: Record<EscalaId, Pergunta[]> = {
  phq9: [
    { id: "1", texto: "Pouco interesse ou prazer em fazer as coisas" },
    { id: "2", texto: "Sentir-se para baixo, deprimido(a) ou sem esperança" },
    { id: "3", texto: "Dificuldade para pegar no sono, continuar dormindo ou dormir demais" },
    { id: "4", texto: "Cansaço ou falta de energia" },
    { id: "5", texto: "Pouco apetite ou comer demais" },
    { id: "6", texto: "Sentir-se mal consigo mesmo(a), ou que é um fracasso" },
    { id: "7", texto: "Dificuldade para se concentrar" },
    { id: "8", texto: "Lentidão para se movimentar ou falar, ou agitação incomum" },
    { id: "9", texto: "Pensamentos de que seria melhor estar morto(a) ou de se ferir" },
  ],
  gad7: [
    { id: "1", texto: "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)" },
    { id: "2", texto: "Não conseguir parar ou controlar a preocupação" },
    { id: "3", texto: "Preocupar-se demais com diversas coisas" },
    { id: "4", texto: "Dificuldade para relaxar" },
    { id: "5", texto: "Ficar tão inquieto(a) que é difícil permanecer parado(a)" },
    { id: "6", texto: "Ficar facilmente irritado(a) ou aborrecido(a)" },
    { id: "7", texto: "Sentir medo como se algo terrível pudesse acontecer" },
  ],
};

const TITULOS: Record<EscalaId, string> = { phq9: "PHQ-9", gad7: "GAD-7" };
const MAXIMOS: Record<EscalaId, number> = { phq9: 27, gad7: 21 };

function faixa(id: EscalaId, total: number): string {
  if (id === "phq9") {
    if (total < 5) return "sugere sintomas mínimos";
    if (total < 10) return "sugere sintomas leves";
    if (total < 15) return "sugere sintomas moderados";
    if (total < 20) return "sugere sintomas moderadamente graves";
    return "sugere sintomas graves";
  }
  if (total < 5) return "sugere ansiedade mínima";
  if (total < 10) return "sugere ansiedade leve";
  if (total < 15) return "sugere ansiedade moderada";
  return "sugere ansiedade grave";
}

type Respostas = Record<EscalaId, Record<string, number>>;

// Respostas item a item só em memória: voltam ao reabrir a tela na mesma sessão (ida e volta entre
// etapas) e nunca são gravadas. Só valem se o escore guardado no store ainda é a soma delas; se a
// consulta foi reiniciada ou o escore mudou, são descartadas.
let rascunho: Respostas = { phq9: {}, gad7: {} };

function somar(itens: Record<string, number>): number {
  return Object.values(itens).reduce((soma, valor) => soma + valor, 0);
}

function respostasValidas(escalas: Record<string, string>): Respostas {
  const valido = (id: EscalaId) =>
    Object.keys(rascunho[id]).length > 0 && String(somar(rascunho[id])) === escalas[id];
  return { phq9: valido("phq9") ? rascunho.phq9 : {}, gad7: valido("gad7") ? rascunho.gad7 : {} };
}

export function EscalasPsiquiatria() {
  const setEscala = useConsulta((state) => state.setEscala);
  const [ativa, setAtiva] = useState<EscalaId>("phq9");
  const [respostas, setRespostas] = useState<Respostas>(() =>
    respostasValidas(useConsulta.getState().escalas),
  );
  const perguntas = PERGUNTAS[ativa];
  const respostasAtuais = respostas[ativa];
  const total = useMemo(
    () => Object.values(respostasAtuais).reduce((soma, valor) => soma + valor, 0),
    [respostasAtuais],
  );
  const item9Positivo = ativa === "phq9" && (respostasAtuais["9"] ?? 0) > 0;

  function responder(id: string, valor: number) {
    const novas = { ...respostasAtuais, [id]: valor };
    const proximas = { ...respostas, [ativa]: novas };
    rascunho = proximas;
    setRespostas(proximas);
    const soma = Object.values(novas).reduce((acumulado, item) => acumulado + item, 0);
    setEscala(ativa, String(soma), MAXIMOS[ativa]);
  }

  return (
    <Panel className="flex flex-col gap-ds-3">
      <div>
        <h2 className="text-xl font-bold tracking-wide">🧪 ESCALAS DE PSIQUIATRIA</h2>
        <p className="mt-1 text-base text-muted">
          Registro item a item das últimas duas semanas.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TITULOS) as EscalaId[]).map((id) => (
          <BigButton key={id} variant={ativa === id ? "primary" : "secondary"} onClick={() => setAtiva(id)}>
            {TITULOS[id]}
          </BigButton>
        ))}
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-bold">{TITULOS[ativa]}</legend>
        {perguntas.map((pergunta) => (
          <div key={pergunta.id} className="rounded-xl bg-sunken p-3">
            <p className="font-semibold">{pergunta.id}. {pergunta.texto}</p>
            <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
              {OPCOES.map((opcao, valor) => (
                <label key={opcao} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${ativa}-${pergunta.id}`}
                    value={valor}
                    checked={respostasAtuais[pergunta.id] === valor}
                    onChange={() => responder(pergunta.id, valor)}
                  />
                  {valor} — {opcao}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <div aria-live="polite" className="rounded-xl bg-raised p-3">
        <p className="font-bold">Total {TITULOS[ativa]}: {total}/{MAXIMOS[ativa]}</p>
        <p className="text-muted">{faixa(ativa, total)}.</p>
      </div>
      {item9Positivo && (
        <div role="alert" className="rounded-xl border-2 border-red-700 bg-red-100 p-3 font-bold text-red-900">
          Item 9 positivo: avaliar risco suicida.
        </div>
      )}
    </Panel>
  );
}

/** Escalas respondidas item a item aqui; as demais da especialidade seguem como escore manual. */
export const ESCALAS_ITEM_A_ITEM: readonly string[] = Object.keys(PERGUNTAS);

export { faixa as faixaEscalaPsiquiatria, PERGUNTAS as perguntasEscalaPsiquiatria };
