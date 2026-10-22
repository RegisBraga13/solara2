"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { hojeLocal } from "@/components/CameraCaptura";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import { emitirAtestado, obterPaciente, urlPdfDocumento } from "@/lib/api";
import { cidadeValida, guardarMedico, lerMedico, medicoValido, MEDICO_VAZIO, type Medico } from "@/lib/medico";
import { compartilharPdf } from "@/lib/pdf";
import { criarPdfAtestado } from "@/lib/pdfAtestado";
import { useConsulta, type SugestoesSalvas } from "@/store/consulta";

/** CID da primeira hipótese diagnóstica selecionada (vazio se não houver, nunca inventado). */
function cidPrincipal(sugestoes: SugestoesSalvas["diagnostico"], selecionados: string[]): string {
  if (!sugestoes?.cid11) return "";
  const idx = sugestoes.itens.findIndex((t) => selecionados.includes(t));
  return idx >= 0 ? sugestoes.cid11[idx] ?? "" : "";
}

export default function AtestadoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = useConsulta((s) => s.sessionId);
  const diagnosticoSelecionados = useConsulta((s) => s.diagnostico.selecionados);
  const sugestoesDiagnostico = useConsulta((s) => s.sugestoes.diagnostico);

  const [paciente, setPaciente] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [medico, setMedico] = useState<Medico>(MEDICO_VAZIO);
  const [diasAfastamento, setDiasAfastamento] = useState("");
  const [dataInicial, setDataInicial] = useState(hojeLocal());
  const [incluirCid, setIncluirCid] = useState(false);
  const [cid, setCid] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [emitido, setEmitido] = useState<{ id: string; blob: Blob; nome: string } | null>(null);

  useEffect(() => {
    setMedico(lerMedico());
    obterPaciente(id)
      .then((p) => {
        setPaciente(p.nome);
        setCpf(p.cpf ?? "");
      })
      .catch(() => setAviso("Paciente não encontrado ou servidor indisponível."));
  }, [id]);

  useEffect(() => {
    setCid(cidPrincipal(sugestoesDiagnostico, diagnosticoSelecionados));
  }, [sugestoesDiagnostico, diagnosticoSelecionados]);

  async function emitir() {
    if (ocupado || paciente === null) return;
    if (!medicoValido(medico)) {
      setAviso("Informe o seu nome e o CRM (com a UF) para emitir o atestado.");
      return;
    }
    if (!cidadeValida(medico)) {
      setAviso("Informe a cidade onde o atestado é emitido.");
      return;
    }
    const dias = Number(diasAfastamento);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      setAviso("Informe um número de dias de afastamento válido (1 a 365).");
      return;
    }
    if (!dataInicial) {
      setAviso("Informe a data inicial do afastamento.");
      return;
    }
    setOcupado(true);
    try {
      guardarMedico(medico);
      const cidFinal = incluirCid ? cid.trim() : "";
      const arquivo = await criarPdfAtestado({
        medico,
        paciente,
        documento: cpf,
        diasAfastamento: dias,
        dataInicial: new Date(`${dataInicial}T00:00:00`),
        cid: cidFinal,
        cidade: medico.cidade,
        emitidaEm: new Date(),
      });
      const r = await emitirAtestado({
        pacienteId: id,
        sessionId,
        diasAfastamento: dias,
        dataInicial,
        cidade: medico.cidade.trim(),
        cid: cidFinal,
        medicoNome: medico.nome.trim(),
        medicoCrm: medico.crm.trim(),
        pdf: arquivo.blob,
        nomePdf: arquivo.nome,
      });
      setEmitido({ id: r.id, ...arquivo });
    } catch {
      setAviso("Não foi possível emitir o atestado agora. Nada foi enviado: confira os dados e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  if (emitido) {
    return (
      <TelaSimples titulo="ATESTADO EMITIDO">
        <Panel className="flex flex-col gap-ds-3">
          <p className="text-lg">✅ Atestado salvo no prontuário de {paciente}.</p>
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
    <TelaSimples titulo="NOVO ATESTADO">
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
        Identificação e diagnóstico já vêm preenchidos da consulta. Confira os dados antes de
        emitir: o documento não pode ser editado depois (para corrigir, emita outro).
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
          <span className="text-base font-semibold">Cidade (onde o atestado é emitido)</span>
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
        <h2 className="text-xl font-bold tracking-wide">AFASTAMENTO</h2>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Dias de afastamento</span>
          <input
            type="number"
            min={1}
            max={365}
            value={diasAfastamento}
            onChange={(e) => setDiasAfastamento(e.target.value)}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">A contar de</span>
          <input
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            className="input-sunken min-h-[52px]"
          />
        </label>
      </Panel>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">CID (OPCIONAL)</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={incluirCid}
            onChange={(e) => setIncluirCid(e.target.checked)}
            className="h-6 w-6"
          />
          <span className="text-base">Incluir CID no atestado (mediante autorização do paciente)</span>
        </label>
        {incluirCid && (
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">CID</span>
            <input
              value={cid}
              maxLength={10}
              onChange={(e) => setCid(e.target.value)}
              className="input-sunken min-h-[52px]"
            />
          </label>
        )}
      </Panel>

      <BigButton disabled={ocupado || paciente === null} onClick={() => void emitir()}>
        {ocupado ? "EMITINDO…" : "EMITIR ATESTADO (PDF)"}
      </BigButton>
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </TelaSimples>
  );
}
