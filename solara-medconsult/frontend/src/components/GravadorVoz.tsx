"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { AudioRecorder } from "@/lib/audio";
import { AudioWebSocket, type Papel, type TranscricaoMsg } from "@/lib/websocket";
import { useConsulta } from "@/store/consulta";

type Estado = "parado" | "gravando" | "pausado";

const ROTULO: Record<Papel, string> = {
  medico: "Médico",
  paciente: "Paciente",
  acompanhante: "Acompanhante",
  indefinido: "Voz",
};

const MSG_CONEXAO = "Conexão perdida. Continue escrevendo.";
const MSG_AUDIO = "Não foi possível gravar áudio. Você pode escrever.";

/**
 * Gravação com transcrição ao vivo (a mesma da Captura), numa versão compacta para a Evolução.
 * Nenhuma falha de voz bloqueia o médico: avisa e ele continua escrevendo.
 */
export function GravadorVoz() {
  const sessionId = useConsulta((s) => s.sessionId);
  const transcricoes = useConsulta((s) => s.transcricoes);
  const addTranscricao = useConsulta((s) => s.addTranscricao);

  const [estado, setEstado] = useState<Estado>("parado");
  const [aviso, setAviso] = useState<string | null>(null);
  const [parcial, setParcial] = useState<TranscricaoMsg | null>(null);
  const recRef = useRef<AudioRecorder | null>(null);
  const wsRef = useRef<AudioWebSocket | null>(null);

  useEffect(
    () => () => {
      recRef.current?.stop();
      wsRef.current?.close();
    },
    [],
  );

  const aoTranscricao = useCallback(
    (t: TranscricaoMsg) => {
      if (t.is_final) {
        addTranscricao(t);
        setParcial(null);
      } else {
        setParcial(t);
      }
    },
    [addTranscricao],
  );

  const pararTudo = useCallback(() => {
    recRef.current?.stop();
    wsRef.current?.close();
    recRef.current = null;
    wsRef.current = null;
    setEstado("parado");
    setParcial(null);
  }, []);

  const falhar = useCallback(
    (mensagem: string) => {
      pararTudo();
      setAviso(`⚠️ ${mensagem}`);
    },
    [pararTudo],
  );

  async function iniciar() {
    setAviso(null);
    if (!sessionId || !AudioRecorder.suportado()) {
      falhar(MSG_AUDIO);
      return;
    }
    const ws = new AudioWebSocket(sessionId, {
      onTranscription: aoTranscricao,
      onError: (e) => falhar(e.mensagem || MSG_CONEXAO),
    });
    try {
      await ws.connect();
    } catch {
      ws.close();
      falhar(MSG_CONEXAO);
      return;
    }
    wsRef.current = ws;
    const rec = new AudioRecorder({
      onChunk: (b) => wsRef.current?.sendChunk(b),
      onError: () => falhar(MSG_AUDIO),
    });
    try {
      await rec.start();
    } catch {
      rec.stop();
      falhar(MSG_AUDIO);
      return;
    }
    if (wsRef.current !== ws) {
      rec.stop(); // o servidor avisou um erro enquanto o microfone abria
      return;
    }
    recRef.current = rec;
    setEstado("gravando");
  }

  function alternar() {
    if (estado === "parado") {
      void iniciar();
    } else if (estado === "gravando") {
      recRef.current?.pause();
      wsRef.current?.pause();
      setEstado("pausado");
    } else {
      recRef.current?.resume();
      wsRef.current?.resume();
      setEstado("gravando");
    }
  }

  async function parar() {
    const ws = wsRef.current;
    recRef.current?.stop();
    recRef.current = null;
    setEstado("parado");
    await ws?.stop(); // espera os últimos trechos
    wsRef.current = null;
    setParcial(null);
  }

  return (
    <div className="flex flex-col gap-ds-3">
      {estado !== "parado" && (
        <p role="status" className="rounded-xl bg-sunken p-ds-3 text-base font-semibold">
          🎙️ Gravando. Avise o paciente que a conversa está sendo gravada.
        </p>
      )}
      {aviso && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-3 text-base font-semibold">
          {aviso}
        </p>
      )}
      <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
        <BigButton onClick={alternar}>
          {estado === "parado" ? "🎙️ GRAVAR" : estado === "gravando" ? "⏸️ PAUSAR" : "▶️ CONTINUAR"}
        </BigButton>
        <BigButton variant="secondary" disabled={estado === "parado"} onClick={() => void parar()}>
          ⏹️ PARAR
        </BigButton>
      </div>
      {(transcricoes.length > 0 || parcial) && (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-sunken p-ds-3 text-base">
          {transcricoes.map((t, i) => (
            <li key={i}>
              <strong>{ROTULO[t.speaker]}:</strong> {t.text}
            </li>
          ))}
          {parcial && (
            <li className="text-muted">
              <strong>{ROTULO[parcial.speaker]}:</strong> {parcial.text}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
