"use client";

import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";

interface AvisoDialogProps {
  mensagem: string | null;
  onOk: () => void;
}

/** Aviso do próprio app (no lugar do alert() do navegador): uma mensagem e um botão. */
export function AvisoDialog({ mensagem, onOk }: AvisoDialogProps) {
  if (!mensagem) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <Panel as="div" className="w-full max-w-md">
        <div role="alertdialog" aria-modal="true" aria-label={mensagem}>
          <p className="mb-ds-5 text-xl font-semibold">{mensagem}</p>
          <BigButton variant="primary" onClick={onOk}>
            OK
          </BigButton>
        </div>
      </Panel>
    </div>
  );
}
