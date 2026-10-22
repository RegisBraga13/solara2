"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { BigButton } from "@/components/BigButton";
import { ApiError, removerLaudo, uploadLaudo, urlLaudo } from "@/lib/api";
import { useConsulta } from "@/store/consulta";

/**
 * Laudos novos do retorno (PDF ou foto). Ficam anexados à consulta no servidor; a IA não lê o
 * conteúdo (laudo traz dados do paciente): o médico abre quando quiser.
 */
export function LaudosNovos() {
  const sessionId = useConsulta((s) => s.sessionId);
  const laudos = useConsulta((s) => s.laudos);
  const addLaudo = useConsulta((s) => s.addLaudo);
  const removeLaudo = useConsulta((s) => s.removeLaudo);

  const [enviando, setEnviando] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function enviar(file: File) {
    if (!sessionId) {
      setAviso("⚠️ Consulta não iniciada.");
      return;
    }
    setAviso(null);
    setEnviando((n) => n + 1);
    try {
      const r = await uploadLaudo(sessionId, file);
      addLaudo({ id: r.id, nome: r.nome });
    } catch (e) {
      setAviso(
        e instanceof ApiError && e.status !== null && e.status < 500
          ? `⚠️ ${e.message}`
          : "⚠️ Não foi possível enviar o laudo agora. Tente de novo.",
      );
    } finally {
      setEnviando((n) => n - 1);
    }
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void enviar(arquivo);
  }

  async function remover(id: string) {
    try {
      if (sessionId) await removerLaudo(sessionId, id);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        setAviso("⚠️ Não foi possível remover o laudo agora. Tente de novo.");
        return;
      }
    }
    removeLaudo(id);
  }

  return (
    <div className="flex flex-col gap-ds-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        aria-label="Escolher laudo"
        className="hidden"
        onChange={aoEscolher}
      />
      <BigButton variant="secondary" onClick={() => fileRef.current?.click()}>
        📎 ADICIONAR LAUDO (PDF OU FOTO)
      </BigButton>
      {enviando > 0 && (
        <p role="status" className="text-base text-muted">
          Enviando {enviando} laudo(s)…
        </p>
      )}
      {aviso && (
        <p role="alert" className="text-base font-semibold">
          {aviso}
        </p>
      )}
      {laudos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {laudos.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl bg-sunken p-ds-3">
              <a
                href={urlLaudo(l.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-base font-semibold underline"
              >
                {l.nome}
              </a>
              <button
                type="button"
                aria-label={`Remover ${l.nome}`}
                onClick={() => void remover(l.id)}
                className="touch skeu min-h-[44px] min-w-[44px] rounded-md bg-surface px-3 font-bold shadow-raised"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">Os laudos ficam anexados ao registro. A IA não lê o conteúdo.</p>
    </div>
  );
}
