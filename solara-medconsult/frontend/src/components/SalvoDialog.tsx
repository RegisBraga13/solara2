"use client";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";

interface SalvoDialogProps {
  aberto: boolean;
  onAbrirPdf: () => void;
  onCompartilhar: () => void;
  /** Só quando a consulta é de um paciente cadastrado. */
  onVerProntuario?: () => void;
  onInicio: () => void;
}

/** Confirmação depois de salvar: diz ONDE o prontuário ficou e o que fazer a seguir. */
export function SalvoDialog({ aberto, onAbrirPdf, onCompartilhar, onVerProntuario, onInicio }: SalvoDialogProps) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <Panel as="div" className="w-full max-w-md">
        <div role="alertdialog" aria-modal="true" aria-label="Prontuário salvo">
          <p className="mb-ds-3 text-2xl font-bold">✅ Prontuário salvo</p>
          <p className="mb-ds-5 text-base text-muted">
            Foi adicionado ao prontuário do paciente, com o PDF. Para rever depois: 4 opções →
            <strong>PRONTUÁRIO</strong>.
          </p>
          <div className="flex flex-col gap-ds-3">
            <BigButton onClick={onAbrirPdf}>ABRIR PDF</BigButton>
            <BigButton variant="secondary" onClick={onCompartilhar}>
              COMPARTILHAR / SALVAR EM ARQUIVOS
            </BigButton>
            {onVerProntuario && (
              <BigButton variant="secondary" onClick={onVerProntuario}>
                VER PRONTUÁRIO DO PACIENTE
              </BigButton>
            )}
            <BigButton variant="secondary" onClick={onInicio}>
              VOLTAR AO INÍCIO
            </BigButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
