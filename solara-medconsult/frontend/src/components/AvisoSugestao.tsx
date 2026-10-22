import { BigButton } from "@/components/BigButton";
import type { EstadoSugestao } from "@/hooks/useSugestoes";

interface AvisoSugestaoProps {
  estado: EstadoSugestao;
  /** Texto quando não há o que pedir ao servidor (ex.: nenhum diagnóstico escolhido). */
  semBase: string;
  /** Opcional: com ele o aviso de falha mostra o botão "tentar novamente". */
  onTentarNovamente?: () => void;
}

/** Estado do pedido de sugestões: carregando, falha (não bloqueia) ou sem base para pedir. */
export function AvisoSugestao({ estado, semBase, onTentarNovamente }: AvisoSugestaoProps) {
  if (estado === "carregando") {
    return (
      <p role="status" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
        Gerando sugestões… isso pode levar alguns segundos.
      </p>
    );
  }
  if (estado === "erro") {
    return (
      <div role="alert" className="flex flex-col gap-ds-3 rounded-xl bg-sunken p-ds-4">
        <p className="text-base font-semibold">
          ⚠️ Não foi possível gerar sugestões agora. Toque em gerar de novo ou acrescente os itens
          manualmente.
        </p>
        {onTentarNovamente && (
          <BigButton variant="secondary" onClick={onTentarNovamente}>
            TENTAR NOVAMENTE
          </BigButton>
        )}
      </div>
    );
  }
  if (estado === "ocioso") {
    return (
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base text-muted">
        {semBase}
      </p>
    );
  }
  return null;
}
