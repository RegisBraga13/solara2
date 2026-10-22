"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { hojeLocal } from "@/components/CameraCaptura";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import { emitirDeclaracao, obterPaciente, urlPdfDocumento } from "@/lib/api";
import { cidadeValida, guardarMedico, lerMedico, medicoValido, MEDICO_VAZIO, type Medico } from "@/lib/medico";
import { compartilharPdf } from "@/lib/pdf";
import { criarPdfDeclaracao } from "@/lib/pdfDeclaracao";
import { useConsulta } from "@/store/consulta";

/** HH:MM a partir de um timestamp (ms); "" se não houver. */
function horaLocal(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DeclaracaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = useConsulta((s) => s.sessionId);
  const iniciadaEm = useConsulta((s) => s.iniciada_em);

  const [paciente, setPaciente] = useState<string | null>(null);
  const [medico, setMedico] = useState<Medico>(MEDICO_VAZIO);
  const [data, setData] = useState(hojeLocal());
  const [horaInicio, setHoraInicio] = useState(() => horaLocal(iniciadaEm) || horaLocal(Date.now()));
  const [horaFim, setHoraFim] = useState(() => horaLocal(Date.now()));
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [emitido, setEmitido] = useState<{ id: string; blob: Blob; nome: string } | null>(null);

  useEffect(() => {
    setMedico(lerMedico());
    obterPaciente(id)
      .then((p) => setPaciente(p.nome))
      .catch(() => setAviso("Paciente não encontrado ou servidor indisponível."));
  }, [id]);

  async function emitir() {
    if (ocupado || paciente === null) return;
    if (!medicoValido(medico)) {
      setAviso("Informe o seu nome e o CRM (com a UF) para emitir a declaração.");
      return;
    }
    if (!cidadeValida(medico)) {
      setAviso("Informe a cidade onde a declaração é emitida.");
      return;
    }
    if (!data || !horaInicio || !horaFim) {
      setAviso("Informe a data e o período de comparecimento.");
      return;
    }
    setOcupado(true);
    try {
      guardarMedico(medico);
      const arquivo = await criarPdfDeclaracao({
        medico,
        paciente,
        data: new Date(`${data}T00:00:00`),
        horaInicio,
        horaFim,
        cidade: medico.cidade,
        emitidaEm: new Date(),
      });
      const r = await emitirDeclaracao({
        pacienteId: id,
        sessionId,
        data,
        horaInicio,
        horaFim,
        cidade: medico.cidade.trim(),
        medicoNome: medico.nome.trim(),
        medicoCrm: medico.crm.trim(),
        pdf: arquivo.blob,
        nomePdf: arquivo.nome,
      });
      setEmitido({ id: r.id, ...arquivo });
    } catch {
      setAviso(
        "Não foi possível emitir a declaração agora. Nada foi enviado: confira os dados e tente de novo.",
      );
    } finally {
      setOcupado(false);
    }
  }

  if (emitido) {
    return (
      <TelaSimples titulo="DECLARAÇÃO EMITIDA">
        <Panel className="flex flex-col gap-ds-3">
          <p className="text-lg">✅ Declaração salva no prontuário de {paciente}.</p>
          <p className="text-base text-muted">
            Documento de apoio sem assinatura digital ICP-Brasil.
          </p>
        </Panel>
        <BigButton onClick={() => window.open(urlPdfDocumento(emitido.id), "_blank", "noopener")}>
          ABRIR PDF
        </BigButton>
        <BigButton variant="secondary" onClick={() => void compartilharPdf(emitido.blob, emitido.nome)}>
          COMPARTILHAR / SALVAR PDF NO APARELHO
        </BigButton>
        <BigButton variant="secondary" onClick={() => router.push(`/pacientes/${id}`)}>
          VOLTAR AO PRONTUÁRIO DO PACIENTE
        </BigButton>
      </TelaSimples>
    );
  }

  return (
    <TelaSimples titulo="NOVA DECLARAÇÃO">
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
        Identificação e data já vêm preenchidas da consulta. Confira os dados antes de emitir: o
        documento não pode ser editado depois (para corrigir, emita outro).
      </p>
      <p className="text-lg">
        Paciente: <strong>{paciente ?? "…"}</strong>
      </p>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">MÉDICO</h2>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Nome</span>
          <input
            value={medico.nome}
            maxLength={120}
            onChange={(e) => setMedico((m) => ({ ...m, nome: e.target.value }))}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">CRM e UF (ex.: CRM 12345/SP)</span>
          <input
            value={medico.crm}
            maxLength={40}
            onChange={(e) => setMedico((m) => ({ ...m, crm: e.target.value }))}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Cidade (onde a declaração é emitida)</span>
          <input
            value={medico.cidade}
            maxLength={100}
            onChange={(e) => setMedico((m) => ({ ...m, cidade: e.target.value }))}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <p className="text-sm text-muted">Fica salvo só neste aparelho.</p>
      </Panel>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">COMPARECIMENTO</h2>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <div className="grid grid-cols-2 gap-ds-3">
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">Hora de início</span>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="input-sunken min-h-[52px]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">Hora de fim</span>
            <input
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              className="input-sunken min-h-[52px]"
            />
          </label>
        </div>
      </Panel>

      <BigButton disabled={ocupado || paciente === null} onClick={() => void emitir()}>
        {ocupado ? "EMITINDO…" : "EMITIR DECLARAÇÃO (PDF)"}
      </BigButton>
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </TelaSimples>
  );
}
