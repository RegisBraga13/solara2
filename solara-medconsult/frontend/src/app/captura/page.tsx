"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { obterPaciente, verificarPendencias, type PacienteDetalhe, type Pendencias } from "@/lib/api";
import { AudioRecorder } from "@/lib/audio";
import { dataBr, registroBruto } from "@/lib/historia";
import { AudioWebSocket, type Papel, type TranscricaoMsg } from "@/lib/websocket";
import { useAutoAltura } from "@/hooks/useAutoAltura";
import { useEtapa } from "@/hooks/useEtapa";
import { useConsulta } from "@/store/consulta";

type Estado = "parado" | "gravando" | "pausado";
const nomes: Record<Papel, string> = { medico: "Médico", paciente: "Paciente", acompanhante: "Acompanhante", indefinido: "Voz" };
const cores: Record<Papel, string> = { medico: "#4d9b7a", paciente: "#6e8bd4", acompanhante: "#d69a4d", indefinido: "#9aa59f" };
const tempo = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function PatientContext({ patient }: { patient: PacienteDetalhe | null }) {
  if (!patient) return <div className="capture-empty">Carregando contexto do paciente…</div>;
  const fields = [["Nascimento", dataBr(patient.nascimento)], ["Sexo", patient.sexo || "—"], ["Alergias", patient.alergias || "Não informado"], ["Medicações", patient.medicacoes_uso || "Não informado"]];
  return <div className="capture-patient-card"><div className="capture-patient-head"><span className="capture-patient-avatar">{patient.nome.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><p className="capture-label">Paciente</p><h2>{patient.nome}</h2><p>{patient.contato || "Contato não informado"}</p></div></div><div className="capture-patient-fields">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><button type="button" className="capture-link">Abrir ficha completa →</button></div>;
}

export default function CapturaPage() {
  const ready = useEtapa(3);
  const router = useRouter();
  const sessionId = useConsulta((state) => state.sessionId);
  const patientId = useConsulta((state) => state.pacienteId);
  const patientName = useConsulta((state) => state.paciente);
  const capture = useConsulta((state) => state.captura);
  const exam = useConsulta((state) => state.exameFisico);
  const transcripts = useConsulta((state) => state.transcricoes);
  const images = useConsulta((state) => state.imagens);
  const setAudio = useConsulta((state) => state.setAudioDuracao);
  const setText = useConsulta((state) => state.setCapturaTexto);
  const addTranscript = useConsulta((state) => state.addTranscricao);
  const addImage = useConsulta((state) => state.addImagem);
  const setStep = useConsulta((state) => state.setEtapa);
  const [patient, setPatient] = useState<PacienteDetalhe | null>(null);
  const [status, setStatus] = useState<Estado>("parado");
  const [seconds, setSeconds] = useState(capture.audio_duracao);
  const [partial, setPartial] = useState<TranscricaoMsg | null>(null);
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<AudioRecorder | null>(null);
  const socket = useRef<AudioWebSocket | null>(null);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useAutoAltura(capture.texto);

  useEffect(() => { if (patientId) obterPaciente(patientId).then(setPatient).catch(() => undefined); }, [patientId]);
  useEffect(() => { if (status !== "gravando") return; const id = setInterval(() => setSeconds((value) => value + 1), 1000); return () => clearInterval(id); }, [status]);
  useEffect(() => { if (status !== "gravando") setAudio(seconds); }, [status, seconds, setAudio]);
  useEffect(() => () => { recorder.current?.stop(); socket.current?.close(); if (activeTimer.current) clearTimeout(activeTimer.current); }, []);

  const onTranscript = useCallback((message: TranscricaoMsg) => {
    if (activeTimer.current) clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => undefined, 1300);
    if (message.is_final) { addTranscript(message); setPartial(null); } else setPartial(message);
  }, [addTranscript]);

  const stopEverything = useCallback(() => { recorder.current?.stop(); socket.current?.close(); recorder.current = null; socket.current = null; setStatus("parado"); setPartial(null); }, []);

  async function startRecording() {
    setNotice(null);
    if (!sessionId || !AudioRecorder.suportado()) { setNotice("O áudio não está disponível. Continue pelo texto."); return; }
    const ws = new AudioWebSocket(sessionId, { onTranscription: onTranscript, onError: (error) => { stopEverything(); setNotice(error.mensagem || "Conexão perdida. Continue escrevendo."); } });
    try { await ws.connect(); } catch { setNotice("Não foi possível conectar a transcrição agora."); return; }
    socket.current = ws;
    const rec = new AudioRecorder({ onChunk: (chunk) => socket.current?.sendChunk(chunk), onError: () => { stopEverything(); setNotice("Não foi possível acessar o microfone."); } });
    try { await rec.start(); } catch { setNotice("Permita o microfone ou continue pelo texto."); ws.close(); return; }
    recorder.current = rec; setStatus("gravando");
  }

  async function stopRecording() { const ws = socket.current; recorder.current?.stop(); recorder.current = null; setStatus("parado"); await ws?.stop(); socket.current = null; setPartial(null); }
  function toggleRecording() { if (status === "parado") void startRecording(); else if (status === "gravando") { recorder.current?.pause(); socket.current?.pause(); setStatus("pausado"); } else { recorder.current?.resume(); socket.current?.resume(); setStatus("gravando"); } }
  function addFiles(files: FileList | null) { if (!files) return; Array.from(files).forEach((file) => addImage(file.name)); }
  async function checkPendencies() { const raw = registroBruto({ captura: capture, exameFisico: exam, transcricoes: transcripts, imagens: images }); if (!raw.trim()) return; setChecking(true); try { setPendencias(await verificarPendencias(raw)); } catch { setNotice("Não foi possível verificar as pendências agora."); } finally { setChecking(false); } }
  async function conclude() { if (status !== "parado") await stopRecording(); setAudio(seconds); setStep(4); router.push("/exame-fisico"); }

  if (!ready) return null;
  const raw = registroBruto({ captura: capture, exameFisico: exam, transcricoes: transcripts, imagens: images });
  const redFlags = pendencias?.red_flags.filter((flag) => flag.estado !== "ausente") ?? [];

  return <main className="capture-app"><header className="capture-topbar"><button type="button" className="capture-back" onClick={() => router.push("/")}>← Dashboard</button><div><p className="capture-label">Consulta em andamento</p><h1>{patientName || "Nova consulta"}</h1></div><div className="capture-top-actions"><span className={`capture-live ${status === "gravando" ? "is-recording" : ""}`}><i /> {status === "gravando" ? "Gravando" : "Pronto"}</span><button type="button" onClick={() => router.push("/anamnese")} className="capture-exit">Sair</button></div></header>
    <div className="capture-progress"><span className="done">01 Contexto</span><span className="active">02 Captura</span><span>03 Exame físico</span><span>04 História</span><span>05 Documento</span></div>
    <div className="capture-layout"><aside className="capture-left"><PatientContext patient={patient} /><div className="capture-side-card"><p className="capture-label">Arquivos da consulta</p><label className="capture-upload"><span>＋</span><strong>Anexar exame ou imagem</strong><small>PDF, JPG ou PNG</small><input type="file" accept="image/*,.pdf" multiple onChange={(event) => addFiles(event.target.files)} /></label>{capture.imagens.length > 0 && <ul className="capture-files">{capture.imagens.map((image, index) => <li key={`${image}-${index}`}>▤ {image}</li>)}</ul>}</div></aside>
      <section className="capture-center"><div className="capture-section-title"><div><p className="capture-label">Registro clínico</p><h2>Converse normalmente</h2><p>A Solara identifica as vozes e organiza a anamnese para você revisar depois.</p></div><span className="capture-session">Sessão protegida</span></div><div className={`capture-recorder ${status === "gravando" ? "recording" : ""}`}><div className="capture-time">{tempo(seconds)}</div><button type="button" aria-label={status === "parado" ? "Gravar consulta" : status === "gravando" ? "Pausar gravação" : "Continuar gravação"} onClick={toggleRecording} className="capture-record-button"><span>{status === "gravando" ? "Ⅱ" : status === "pausado" ? "▶" : "●"}</span></button><p>{status === "gravando" ? "Gravando consulta" : status === "pausado" ? "Gravação pausada" : "Toque para começar"}</p><small>Avise o paciente antes de iniciar a gravação.</small></div>{notice && <p role="status" className="capture-notice">{notice}</p>}<div className="capture-transcript"><div className="capture-transcript-head"><span>Transcrição ao vivo</span><span>{transcripts.length ? `${transcripts.length} trechos` : "Aguardando fala"}</span></div><div className="capture-transcript-body">{transcripts.length === 0 && !partial && <p className="capture-empty">A transcrição aparece aqui durante a gravação.</p>}{transcripts.map((item, index) => <p key={index}><b style={{ color: cores[item.speaker] }}>{nomes[item.speaker]}</b>{item.text}</p>)}{partial && <p className="partial"><b style={{ color: cores[partial.speaker] }}>{nomes[partial.speaker]}</b>{partial.text}</p>}</div></div><div className="capture-text-entry"><label htmlFor="captura-texto">Complemento em texto</label><textarea id="captura-texto" ref={textRef} value={capture.texto} onChange={(event) => setText(event.target.value)} placeholder="Digite observações ou continue a anamnese sem áudio…" /></div></section>
      <aside className="capture-right"><div className="capture-pending-card"><div className="capture-section-title compact"><div><p className="capture-label">Assistente clínico</p><h2>O que falta?</h2></div><span className="capture-ai-badge">IA</span></div><p className="capture-help">Verifique tópicos pendentes e sinais de alarme antes de avançar.</p><button type="button" className="capture-check" disabled={!raw.trim() || checking} onClick={() => void checkPendencies()}>{checking ? "Verificando…" : pendencias ? "Atualizar pendências" : "Verificar pendências"}</button>{pendencias && <div className="capture-pending-results">{redFlags.length > 0 && <div className="capture-red-flags"><strong>⚠ Sinais de alarme</strong>{redFlags.map((flag) => <span key={flag.sinal}>{flag.estado === "presente" ? "Relatado: " : "Não verificado: "}{flag.sinal}</span>)}</div>}{pendencias.pendentes.map((item) => <div className="capture-pending-item" key={item.topico}><small>{item.topico}</small><span>{item.pergunta_sugerida}</span></div>)}{!pendencias.pendentes.length && !redFlags.length && <p className="capture-empty">Nenhuma pendência encontrada.</p>}</div>}</div><div className="capture-next-card"><p className="capture-label">Próxima etapa</p><h3>Exame físico</h3><p>Registre achados e complemente a história do paciente.</p><button type="button" onClick={() => void conclude()}>Concluir captura <span>→</span></button></div></aside>
    </div></main>;
}
