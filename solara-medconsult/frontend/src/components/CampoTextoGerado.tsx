"use client";

import { BigButton } from "@/components/BigButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel } from "@/components/Panel";
import { useTextoGerado } from "@/hooks/useTextoGerado";

interface CampoTextoGeradoProps {
  titulo: string;
  rotuloGerar: string;
  /** Aviso mostrado como placeholder quando não há diagnóstico para gerar a partir de. */
  semBase: string;
  disponivel: boolean;
  salvo: { texto: string; editado: boolean };
  gerar: () => Promise<string>;
  salvar: (texto: string, editado: boolean) => void;
}

/** Bloco de texto gerado por IA e livremente editável (conduta, tratamento, orientações…). */
export function CampoTextoGerado({
  titulo,
  rotuloGerar,
  semBase,
  disponivel,
  salvo,
  gerar,
  salvar,
}: CampoTextoGeradoProps) {
  const t = useTextoGerado({ salvo, gerar, salvar });
  return (
    <Panel className="flex flex-col gap-ds-3">
      <h2 className="text-xl font-bold tracking-wide">{titulo}</h2>
      <BigButton
        variant="secondary"
        disabled={!disponivel || t.gerando}
        className="disabled:cursor-not-allowed disabled:opacity-50"
        onClick={t.solicitarGerar}
      >
        {t.gerando ? "GERANDO…" : rotuloGerar}
      </BigButton>
      {t.erro && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
          ⚠️ Não foi possível gerar agora. Escreva o texto manualmente ou tente de novo.
        </p>
      )}
      <textarea
        aria-label={`Editar ${titulo.toLowerCase()}`}
        value={t.texto}
        onChange={(e) => t.mudar(e.target.value)}
        placeholder={disponivel ? "" : semBase}
        className="input-sunken min-h-[160px] leading-relaxed"
      />
      <ConfirmDialog
        aberto={t.confirmando}
        mensagem={`Gerar um novo texto de ${titulo.toLowerCase()}? O texto atual será substituído.`}
        onConfirmar={t.executar}
        onCancelar={t.cancelarConfirmacao}
      />
    </Panel>
  );
}
