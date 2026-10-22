"use client";

import { ConsultaAnterior } from "@/components/ConsultaAnterior";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel } from "@/components/Panel";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import { gerarHistoria, listarPreConsultas, obterPaciente, type PacienteDetalhe } from "@/lib/api";
import { linhaExameFisico, linhaIdentificacao, registroBruto } from "@/lib/historia";
import { textoDaPreConsulta } from "@/lib/preConsulta";
import { useConsulta } from "@/store/consulta";

function Conteudo() {
  const router = useRouter();
  const historia = useConsulta((s) => s.historia);
  const captura = useConsulta((s) => s.captura);
  const exameFisico = useConsulta((s) => s.exameFisico);
  const transcricoes = useConsulta((s) => s.transcricoes);
  const imagens = useConsulta((s) => s.imagens);
  const pacienteId = useConsulta((s) => s.pacienteId);
  const setHistoria = useConsulta((s) => s.setHistoria);
  const setEtapa = useConsulta((s) => s.setEtapa);

  // Texto da pré-consulta (se o paciente/recepção preencheu uma): entra junto da Captura.
  const [textoPreConsulta, setTextoPreConsulta] = useState("");
  useEffect(() => {
    if (!pacienteId) return;
    listarPreConsultas(pacienteId)
      .then((lista) => setTextoPreConsulta(lista[0] ? textoDaPreConsulta(lista[0].respostas) : ""))
      .catch(() => setTextoPreConsulta(""));
  }, [pacienteId]);

  // Dados do cadastro: alimentam as seções "Identificação" e "Exame físico" sem passar pela IA.
  const [paciente, setPaciente] = useState<PacienteDetalhe | null>(null);
  useEffect(() => {
    if (!pacienteId) return;
    let vivo = true;
    obterPaciente(pacienteId)
      .then((p) => vivo && setPaciente(p))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  const bruto = [textoPreConsulta, registroBruto({ captura, exameFisico, transcricoes, imagens })]
    .filter((p) => p.trim())
    .join("\n\n");
  // Texto que o médico editou é preservado; enquanto não houver edição, acompanha a Captura (+ pré-consulta).
  const [editado, setEditado] = useState(historia.editado);
  const [texto, setTexto] = useState(historia.editado ? historia.texto : bruto);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoIa, setConfirmandoIa] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erroIa, setErroIa] = useState(false);
  const [fonte, setFonte] = useState<"AI" | "OPEN">("AI");
  const [colado, setColado] = useState("");

  // A pré-consulta chega depois do fetch: atualiza o texto exibido enquanto o médico não editou.
  useEffect(() => {
    if (!editado) setTexto(bruto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bruto]);

  function salvar(comEdicao: boolean) {
    const foiEditado = comEdicao || editado;
    setHistoria(texto, foiEditado);
    setEtapa(6);
    router.push("/diagnostico");
  }

  function refazer() {
    setConfirmando(false);
    setTexto(bruto);
    setEditado(false);
  }

  async function gerarComIa() {
    setConfirmandoIa(false);
    setGerando(true);
    setErroIa(false);
    try {
      const gerada = await gerarHistoria(bruto);
      if (!gerada) throw new Error("vazia");
      // As 5 seções da história: Identificação e Exame físico são montadas aqui, de dados já
      // estruturados (cadastro e tela de Exame Físico), sem passar pela IA — nunca inventadas.
      const estruturada = [
        linhaIdentificacao(paciente),
        gerada,
        linhaExameFisico(exameFisico.texto, imagens),
      ]
        .filter((p) => p.trim())
        .join("\n");
      setTexto(estruturada);
      setEditado(true);
    } catch {
      setErroIa(true);
    } finally {
      setGerando(false);
    }
  }

  function usarColado() {
    const novoTexto = colado.trim();
    if (!novoTexto) return;
    setTexto(novoTexto);
    setEditado(true);
    setColado("");
  }

  return (
    <Tela etapa={5} titulo="HISTÓRIA CLÍNICA">
      <ConsultaAnterior />
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base text-muted">
        Este texto reúne <strong>exatamente o que foi registrado</strong>: a pré-consulta do paciente
        (quando houver) e a Captura (texto digitado, diálogo transcrito, exame físico e descrição
        das imagens). Escolha <strong>AI</strong> para reescrevê-lo em 5 seções no padrão médico
        (Identificação, Queixa Principal, História da Doença Atual, Revisão de Sistemas e Exame
        Físico), sem acrescentar dados, ou <strong>OPEN</strong> para colar uma história já pronta
        (ex.: da OpenEvidence).
      </p>
      <div role="radiogroup" aria-label="Fonte da história" className="grid grid-cols-2 gap-ds-3">
        <button
          type="button"
          role="radio"
          aria-checked={fonte === "AI"}
          onClick={() => setFonte("AI")}
          className={`chip justify-center text-center ${fonte === "AI" ? "chip-on" : "chip-off"}`}
        >
          AI
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={fonte === "OPEN"}
          onClick={() => setFonte("OPEN")}
          className={`chip justify-center text-center ${fonte === "OPEN" ? "chip-on" : "chip-off"}`}
        >
          OPEN
        </button>
      </div>
      {fonte === "AI" ? (
        <>
          <BigButton
            variant="secondary"
            disabled={gerando || !bruto.trim()}
            className="disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => (editado && texto !== bruto ? setConfirmandoIa(true) : gerarComIa())}
          >
            {gerando ? "GERANDO…" : "✨ GERAR HISTÓRIA COM IA"}
          </BigButton>
          {gerando && (
            <p role="status" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
              Escrevendo a história… isso pode levar alguns segundos.
            </p>
          )}
          {erroIa && (
            <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
              ⚠️ Não foi possível gerar a história agora. Edite o texto manualmente ou tente de novo.
            </p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Colar história (OpenEvidence ou outra fonte)</span>
          <textarea
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            placeholder="Cole aqui a história já estruturada."
            className="input-sunken min-h-[160px]"
          />
          <BigButton
            variant="secondary"
            disabled={!colado.trim()}
            className="disabled:cursor-not-allowed disabled:opacity-50"
            onClick={usarColado}
          >
            USAR ESTE TEXTO
          </BigButton>
        </label>
      )}
      <Panel>
        {editando ? (
          <textarea
            aria-label="Editar história clínica"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setEditado(true);
            }}
            className="input-sunken min-h-[420px] leading-relaxed"
          />
        ) : texto.trim() ? (
          <p className="whitespace-pre-line text-lg leading-relaxed">{texto}</p>
        ) : (
          <p className="text-lg text-muted">
            Nada foi registrado na Captura (etapa 3). Volte e grave, digite ou envie imagens, ou
            escreva a história aqui em EDITAR.
          </p>
        )}
      </Panel>
      <div className="grid grid-cols-1 gap-ds-4 md:grid-cols-2 md:gap-ds-5">
        {editando ? (
          <BigButton onClick={() => salvar(true)}>SALVAR EDIÇÃO</BigButton>
        ) : (
          <>
            <BigButton onClick={() => salvar(false)}>SALVAR</BigButton>
            <BigButton variant="secondary" onClick={() => setEditando(true)}>
              EDITAR
            </BigButton>
          </>
        )}
      </div>
      {editado && texto !== bruto && (
        <BigButton variant="secondary" onClick={() => setConfirmando(true)}>
          REFAZER A PARTIR DA CAPTURA
        </BigButton>
      )}
      <ConfirmDialog
        aberto={confirmandoIa}
        mensagem="Gerar uma nova história a partir da Captura? O texto atual será substituído."
        onConfirmar={gerarComIa}
        onCancelar={() => setConfirmandoIa(false)}
      />
      <ConfirmDialog
        aberto={confirmando}
        mensagem="Substituir o texto atual pelo registro da Captura? Suas edições serão perdidas."
        onConfirmar={refazer}
        onCancelar={() => setConfirmando(false)}
      />
    </Tela>
  );
}

export default function HistoriaPage() {
  const pronto = useEtapa(5);
  return pronto ? <Conteudo /> : null;
}
