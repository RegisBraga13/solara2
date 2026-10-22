import { wsUrl } from "@/lib/api";

export type Papel = "medico" | "paciente" | "acompanhante" | "indefinido";

export interface TranscricaoMsg {
  text: string;
  speaker: Papel;
  speaker_id: number | null;
  is_final: boolean;
  timestamp_ms: number | null;
}

export interface ErroWs {
  codigo: string;
  mensagem: string;
}

export interface AudioWebSocketOptions {
  onTranscription: (t: TranscricaoMsg) => void;
  /** Erro avisado pelo servidor ou conexão perdida durante a gravação. Não bloqueia o médico. */
  onError: (e: ErroWs) => void;
}

const CONNECT_TIMEOUT_MS = 5000;
const STOP_TIMEOUT_MS = 4000;

/** Canal WebSocket do áudio da consulta (envia WebM/Opus, recebe transcrições). */
export class AudioWebSocket {
  private ws: WebSocket | null = null;
  private encerradoPorNos = false;
  private aoEncerrar: (() => void) | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly opts: AudioWebSocketOptions,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let aberto = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl(`/ws/session/${this.sessionId}/audio`));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("WebSocket indisponível."));
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        if (!aberto) {
          ws.close();
          reject(new Error("Tempo esgotado ao conectar."));
        }
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        aberto = true;
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        if (!aberto) {
          clearTimeout(timer);
          reject(new Error("Falha ao conectar."));
        }
      };
      ws.onmessage = (ev: MessageEvent) => this.aoReceber(ev.data);
      ws.onclose = () => {
        clearTimeout(timer);
        this.aoEncerrar?.();
        if (aberto && !this.encerradoPorNos) {
          this.opts.onError({
            codigo: "conexao_perdida",
            mensagem: "Conexão perdida. Continuando em modo texto.",
          });
        }
      };
    });
  }

  private aoReceber(dados: unknown): void {
    if (typeof dados !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(dados);
    } catch {
      return;
    }
    if (msg.type === "transcricao" && typeof msg.text === "string") {
      this.opts.onTranscription({
        text: msg.text,
        speaker: (msg.speaker as Papel) ?? "indefinido",
        speaker_id: typeof msg.speaker_id === "number" ? msg.speaker_id : null,
        is_final: msg.is_final === true,
        timestamp_ms: typeof msg.timestamp_ms === "number" ? msg.timestamp_ms : null,
      });
    } else if (msg.type === "erro") {
      if (msg.codigo === "chunk_grande") return; // trecho recusado: a conexão segue
      this.encerradoPorNos = true; // o servidor já vai fechar; evita avisar duas vezes
      this.opts.onError({
        codigo: String(msg.codigo ?? "erro"),
        mensagem: String(msg.mensagem ?? "Erro na transcrição. Continue em modo texto."),
      });
    } else if (msg.type === "estado" && msg.estado === "encerrado") {
      this.aoEncerrar?.();
    }
  }

  private enviarControle(tipo: "pause" | "resume" | "stop"): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: tipo }));
  }

  sendChunk(blob: Blob): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(blob);
  }

  pause(): void {
    this.enviarControle("pause");
  }

  resume(): void {
    this.enviarControle("resume");
  }

  /** Pede o fechamento, espera os últimos trechos (até 4 s) e fecha. */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.close();
        resolve();
        return;
      }
      const fim = () => {
        clearTimeout(timer);
        this.aoEncerrar = null;
        this.close();
        resolve();
      };
      const timer = setTimeout(fim, STOP_TIMEOUT_MS);
      this.aoEncerrar = fim;
      this.enviarControle("stop");
    });
  }

  close(): void {
    this.encerradoPorNos = true;
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
  }
}
