export const AUDIO_MIME = "audio/webm;codecs=opus";
const TIMESLICE_MS = 250;

export interface AudioRecorderOptions {
  /** Chamado a cada ~250 ms com um pedaço do áudio WebM/Opus. */
  onChunk: (chunk: Blob) => void;
  onError: (error: Error) => void;
}

/** Gravação de microfone com MediaRecorder (WebM/Opus). */
export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  constructor(private readonly opts: AudioRecorderOptions) {}

  /** O navegador tem microfone e sabe gravar WebM/Opus? (Safari antigo não sabe.) */
  static suportado(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(AUDIO_MIME)
    );
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const recorder = new MediaRecorder(this.stream, { mimeType: AUDIO_MIME });
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.opts.onChunk(e.data);
    };
    recorder.onerror = () => this.opts.onError(new Error("Falha na gravação de áudio."));
    recorder.start(TIMESLICE_MS);
    this.recorder = recorder;
  }

  pause(): void {
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  resume(): void {
    if (this.recorder?.state === "paused") this.recorder.resume();
  }

  /** Para a gravação e libera o microfone. */
  stop(): void {
    const r = this.recorder;
    this.recorder = null;
    if (r && r.state !== "inactive") {
      r.ondataavailable = null;
      r.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
