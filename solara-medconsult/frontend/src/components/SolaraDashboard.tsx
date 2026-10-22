"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listarPacientes, listarProntuarios, type Paciente, type ProntuarioResumo } from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { rotaDaConsulta } from "@/lib/rotas";
import { usePersist } from "@/hooks/usePersist";
import { useConsulta } from "@/store/consulta";

const quickActions = [
  { label: "Nova consulta", hint: "Grave e gere o documento", next: "/nova-consulta", icon: "＋", tone: "primary" },
  { label: "Selecionar paciente", hint: "Abra uma ficha existente", next: "/nova-consulta", icon: "⌕", tone: "soft" },
  { label: "Novo paciente", hint: "Cadastre em poucos campos", next: "/paciente/novo", icon: "＋", tone: "soft" },
] as const;

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function SolaraDashboard() {
  const router = useRouter();
  const ready = usePersist();
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [records, setRecords] = useState<ProntuarioResumo[]>([]);
  const currentPatient = useConsulta((state) => state.paciente);
  const startedAt = useConsulta((state) => state.iniciada_em);
  const currentStep = useConsulta((state) => state.etapa_atual);
  const consultationType = useConsulta((state) => state.tipo);

  useEffect(() => {
    if (!ready) return;
    Promise.all([listarPacientes(), listarProntuarios()]).then(([nextPatients, nextRecords]) => {
      setPatients(nextPatients.slice(0, 4));
      setRecords(nextRecords.slice(0, 4));
    }).catch(() => undefined);
  }, [ready]);

  return (
    <main className="solara-app">
      <aside className="solara-sidebar">
        <div className="solara-brand"><span className="solara-mark">✦</span><span>solara<span className="solara-brand-dot">.</span></span></div>
        <p className="solara-specialty">Dermatologia · consultório</p>
        <nav className="solara-nav" aria-label="Navegação principal">
          <button className="is-active" type="button"><span>⌂</span> Visão geral</button>
          <button type="button" onClick={() => router.push("/prontuarios")}><span>♙</span> Pacientes</button>
          <button type="button" onClick={() => router.push("/prontuario")}><span>▤</span> Documentos</button>
          <button type="button" onClick={() => router.push("/modalidade?next=%2Fnova-consulta")}><span>◷</span> Histórico</button>
        </nav>
        <div className="solara-sidebar-footer"><span className="status-dot" /> Dados locais sincronizados<p>RAG, APIs e banco conectados ao ambiente MedConsult.</p></div>
      </aside>

      <section className="solara-content">
        <header className="solara-topbar"><div><p className="eyebrow">segunda-feira, 19 de outubro</p><h1>Bom dia, doutor(a)</h1></div><div className="solara-profile"><span className="status-pill"><span className="status-dot" /> Sistema online</span><span className="profile-avatar">DR</span></div></header>
        <div className="solara-main">
          {startedAt !== null && <section className="active-consultation"><div><p className="eyebrow">Consulta em andamento</p><h2>{currentPatient || "Paciente sem nome"}</h2><p>Etapa {currentStep} de 9 · iniciada às {new Date(startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div><button type="button" onClick={() => router.push(rotaDaConsulta(consultationType, currentStep))}>Continuar consulta</button></section>}
          <section className="hero-copy"><div><p className="eyebrow">Seu consultório em um só lugar</p><h2>Da escuta ao documento.<br /><em>Sem digitar uma palavra.</em></h2><p>Organize a consulta, revise o conteúdo e salve o prontuário com o apoio dos seus dados clínicos e fontes RAG.</p></div><div className="hero-orbit" aria-hidden="true"><span>IA</span><i /><i /><i /></div></section>
          <section><div className="section-heading"><div><p className="eyebrow">Comece por aqui</p><h2>O que você precisa hoje?</h2></div><span className="section-note">Três passos para fechar a consulta</span></div><div className="quick-grid">{quickActions.map((action) => <button key={action.label} type="button" disabled={!ready} onClick={() => router.push(`/modalidade?next=${encodeURIComponent(action.next)}`)} className={`quick-card ${action.tone}`}><span className="quick-icon">{action.icon}</span><span className="quick-title">{action.label}</span><span className="quick-hint">{action.hint}</span><span className="quick-arrow">→</span></button>)}</div></section>
          <div className="data-grid">
            <section className="data-card"><div className="section-heading compact"><div><p className="eyebrow">Acesso rápido</p><h2>Pacientes recentes</h2></div><button type="button" onClick={() => router.push("/prontuarios")} className="text-link">Ver todos</button></div>{patients.length ? <div className="patient-list">{patients.map((patient) => <button type="button" key={patient.id} onClick={() => router.push(`/pacientes/${patient.id}`)}><span className="patient-initials">{initials(patient.nome)}</span><span><strong>{patient.nome}</strong><small>{patient.ultima_consulta ? `Última consulta · ${formatarData(patient.ultima_consulta)}` : "Sem consulta registrada"}</small></span><span className="row-arrow">→</span></button>)}</div> : <p className="empty-state">Os pacientes aparecerão aqui quando a API estiver conectada.</p>}</section>
            <section className="data-card"><div className="section-heading compact"><div><p className="eyebrow">Produção clínica</p><h2>Documentos recentes</h2></div><button type="button" onClick={() => router.push("/prontuarios")} className="text-link">Abrir</button></div>{records.length ? <div className="record-list">{records.map((record) => <button type="button" key={record.id} onClick={() => router.push(`/prontuarios/${record.id}`)}><span className="record-icon">▤</span><span><strong>{record.tipo === "retorno" ? "Evolução / retorno" : "Prontuário clínico"}</strong><small>{record.paciente} · {formatarData(record.criado_em)}</small></span><span className="row-arrow">→</span></button>)}</div> : <p className="empty-state">Depois de registrar uma consulta, seus documentos ficarão organizados aqui.</p>}</section>
          </div>
          <section className="flow-card"><div><p className="eyebrow">Fluxo clínico</p><h2>Selecione · Grave · Revise</h2><p>O conteúdo gerado permanece editável e nada é salvo sem sua revisão.</p></div><div className="flow-steps"><span><b>01</b> Paciente</span><span><b>02</b> Captura</span><span><b>03</b> Documento</span></div></section>
        </div>
      </section>
    </main>
  );
}
