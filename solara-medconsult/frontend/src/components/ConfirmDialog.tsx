"use client";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";

interface ConfirmDialogProps {
  aberto: boolean;
  mensagem: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({ aberto, mensagem, onConfirmar, onCancelar }: ConfirmDialogProps) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <Panel as="div" className="w-full max-w-md">
        <div role="alertdialog" aria-modal="true" aria-label={mensagem}>
          <p className="mb-ds-5 text-xl font-semibold">{mensagem}</p>
          <div className="grid grid-cols-2 gap-ds-3">
            <BigButton variant="secondary" onClick={onCancelar}>
              Cancelar
            </BigButton>
            <BigButton variant="primary" onClick={onConfirmar}>
              Confirmar
            </BigButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
