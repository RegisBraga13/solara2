"use client";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";
import { ESPECIALIDADE } from "@/lib/especialidade";
import { useConsulta, type TelaAnotacao } from "@/store/consulta";

/** Endereço do Whitebook. Troque em NEXT_PUBLIC_WHITEBOOK_URL se for outro. */
export const WHITEBOOK_URL = process.env.NEXT_PUBLIC_WHITEBOOK_URL ?? ESPECIALIDADE.whitebookUrl;

/** Endereço do OpenEvidence. Troque em NEXT_PUBLIC_OPENEVIDENCE_URL se for outro. */
export const OPENEVIDENCE_URL =
  process.env.NEXT_PUBLIC_OPENEVIDENCE_URL ?? "https://www.openevidence.com/";

/**
 * Consulta manual ao Whitebook e ao OpenEvidence: os botões só abrem o site em outra aba (não há
 * integração nem leitura do conteúdo) e o médico pode colar aqui os trechos que quiser guardar no
 * prontuário. As anotações ficam no aparelho e NÃO são enviadas à IA.
 *
 * O OpenEvidence é uma IA médica especializada (responde com base em evidência e literatura
 * biomédica) — por isso fica destacado separadamente de uma IA genérica (ChatGPT e afins), que não
 * tem esse mesmo compromisso com a fonte clínica.
 */
export function ApoioMedico({ tela }: { tela: TelaAnotacao }) {
  const texto = useConsulta((s) => s.anotacoes[tela]);
  const setAnotacao = useConsulta((s) => s.setAnotacao);

  return (
    <Panel className="flex flex-col gap-ds-3">
      <BigButton
        variant="secondary"
        onClick={() => window.open(WHITEBOOK_URL, "_blank", "noopener,noreferrer")}
      >
        🔗 Consultar Whitebook
      </BigButton>
      <div className="flex flex-col gap-ds-1">
        <BigButton
          variant="primary"
          onClick={() => window.open(OPENEVIDENCE_URL, "_blank", "noopener,noreferrer")}
        >
          🩺🤖 Consultar OpenEvidence
        </BigButton>
        <p className="text-sm text-muted text-center">
          IA médica especializada em evidências — não é uma IA genérica (ChatGPT e afins)
        </p>
      </div>
      <label htmlFor={`anotacoes-${tela}`} className="text-base font-semibold">
        📝 Anotações (opcional)
      </label>
      <textarea
        id={`anotacoes-${tela}`}
        value={texto}
        onChange={(e) => setAnotacao(tela, e.target.value)}
        placeholder="Cole aqui trechos do Whitebook ou escreva suas observações. Vão para o prontuário."
        className="input-sunken min-h-[120px] leading-relaxed"
      />
    </Panel>
  );
}
