"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApoioMedico } from "@/components/ApoioMedico";
import { AvisoDialog } from "@/components/AvisoDialog";
import { BackButton } from "@/components/BackButton";
import { BarraConsulta } from "@/components/BarraConsulta";
import { BigButton } from "@/components/BigButton";
import { CampoTextoGerado } from "@/components/CampoTextoGerado";
import { PainelConsultaAnterior, useConsultaAnterior } from "@/components/ConsultaAnterior";
import { FonteSeletor } from "@/components/FonteSeletor";
import { GravadorVoz } from "@/components/GravadorVoz";
import { ImagensNovas } from "@/components/ImagensNovas";
import { LaudosNovos } from "@/components/LaudosNovos";
import { Panel } from "@/components/Panel";
import { SalvoDialog } from "@/components/SalvoDialog";
import { SugestoesTela } from "@/components/SugestoesTela";
import { useEtapa } from "@/hooks/useEtapa";
import { useSugestoes } from "@/hooks/useSugestoes";
import {
  gerarConduta,
  gerarInvestigacao,
  gerarOrientacoesTexto,
  gerarTratamento,
  registrarProntuario,
  sugerirDiagnosticos,
  urlPdfProntuario,
} from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { registroBruto } from "@/lib/historia";
import { compartilharPdf, criarPdfProntuario } from "@/lib/pdf";
import { condutaDoProntuario, diagnosticosDoProntuario, montarEvolucao } from "@/lib/prontuario";
import { rotaDaEtapa } from "@/lib/rotas";
import { FONTES_DIAGNOSTICO, MAX_DIAGNOSTICOS, type Fonte, type ItemSugerido } from "@/lib/sugestoes";
import { usePreviews } from "@/lib/previews";
import { useConsulta, type Decisao } from "@/store/consulta";

const DECISOES: { valor: Decisao; rotulo: string }[] = [
  { valor: "manter", rotulo: "Manter" },
  { valor: "ajustar", rotulo: "Ajustar" },
  { valor: "novo", rotulo: "Novo" },
];

function Decidir({
  rotulo,
  valor,
  onEscolher,
}: {
  rotulo: string;
  valor: Decisao | null;
  onEscolher: (d: Decisao) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-3 gap-ds-3">
      {DECISOES.map((d) => (
        <button
          key={d.valor}
          type="button"
          role="radio"
          aria-checked={valor === d.valor}
          onClick={() => onEscolher(d.valor)}
          className={`chip justify-center text-center ${valor === d.valor ? "chip-on" : "chip-off"}`}
        >
          {d.rotulo}
        </button>
      ))}
    </div>
  );
}

function Conteudo() {
  const router = useRouter();
  const tipo = useConsulta((s) => s.tipo);
  const etapaAtual = useConsulta((s) => s.etapa_atual);
  const paciente = useConsulta((s) => s.paciente);
  const pacienteId = useConsulta((s) => s.pacienteId);
  const retornoDe = useConsulta((s) => s.retornoDe);
  const sessionId = useConsulta((s) => s.sessionId);
  const modo = useConsulta((s) => s.modo);
  const anamnese = useConsulta((s) => s.anamnese);
  const setAnamnese = useConsulta((s) => s.setAnamnese);
  const captura = useConsulta((s) => s.captura);
  const setCapturaTexto = useConsulta((s) => s.setCapturaTexto);
  const exameFisico = useConsulta((s) => s.exameFisico);
  const transcricoes = useConsulta((s) => s.transcricoes);
  const imagens = useConsulta((s) => s.imagens);
  const laudos = useConsulta((s) => s.laudos);
  const evolucao = useConsulta((s) => s.evolucao);
  const setDecisao = useConsulta((s) => s.setDecisao);
  const diagnostico = useConsulta((s) => s.diagnostico);
  const condutaTratamento = useConsulta((s) => s.condutaTratamento);
  const setCondutaTratamento = useConsulta((s) => s.setCondutaTratamento);
  const historia = useConsulta((s) => s.historia);
  const extras = useConsulta((s) => s.extras);
  const anotacoes = useConsulta((s) => s.anotacoes);
  const sugestoes = useConsulta((s) => s.sugestoes);
  const salvarDx = useConsulta((s) => s.setSugestoesDiagnostico);
  const toggleDx = useConsulta((s) => s.toggleDiagnostico);
  const addExtra = useConsulta((s) => s.addExtra);
  const reset = useConsulta((s) => s.reset);
  const limparPreviews = usePreviews((s) => s.limparPreviews);

  const { p: anterior, erro: erroAnterior } = useConsultaAnterior();
  const textoAnterior = anterior?.texto ?? "";

  // O retorno só existe nesta tela; uma consulta nova segue as 8 etapas.
  useEffect(() => {
    if (tipo !== "retorno") router.replace(rotaDaEtapa(etapaAtual));
  }, [tipo, etapaAtual, router]);

  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ blob: Blob; nome: string } | null>(null);

  // ---- diagnóstico (ajustar/novo): o caso é a mini anamnese
  const caso = useMemo(
    () => registroBruto({ captura, exameFisico, transcricoes, imagens: [] }),
    [captura, exameFisico, transcricoes],
  );
  const dx = useSugestoes({
    chave: caso,
    salvo: sugestoes.diagnostico,
    buscar: (fontes, colado) => sugerirDiagnosticos(caso, fontes, colado),
    salvar: (r) => salvarDx(caso, r.nomes, r.probabilidades, r.cid11),
  });
  const itensDx: ItemSugerido[] = (sugestoes.diagnostico?.chave === caso ? sugestoes.diagnostico.itens : []).map(
    (termo, i) => ({ termo, percentual: sugestoes.diagnostico?.probabilidades?.[i] }),
  );

  // ---- conduta (ajustar/novo): parte dos diagnósticos (os mantidos ou os escolhidos agora)
  const diagnosticosBase = (
    evolucao.diagnostico === "manter" ? diagnosticosDoProntuario(textoAnterior) : diagnostico.selecionados
  ).slice(0, MAX_DIAGNOSTICOS);
  const diagnosticoTexto = diagnosticosBase.join("; ");
  const [fontesConduta, setFontesConduta] = useState<Fonte[]>([]);
  const [coladoConduta, setColadoConduta] = useState("");
  const condutaDisponivel =
    diagnosticoTexto.trim() !== "" && (fontesConduta.length > 0 || coladoConduta.trim() !== "");
  const condutaPrevia = condutaDoProntuario(textoAnterior);

  const dados = {
    modo,
    historia,
    diagnostico,
    condutaTratamento,
    anotacoes,
    tipo,
    captura,
    exameFisico,
    transcricoes,
    imagens,
    laudos,
    evolucao,
  };

  async function obterPdf(texto: string) {
    if (pdf) return pdf;
    const novo = await criarPdfProntuario({ texto, paciente, geradoEm: new Date() });
    setPdf(novo);
    return novo;
  }

  async function concluir() {
    if (ocupado || salvoId) return;
    if (!evolucao.diagnostico || !evolucao.conduta) {
      setAviso("Escolha Manter, Ajustar ou Novo para o diagnóstico e para a conduta antes de concluir.");
      return;
    }
    setOcupado(true);
    try {
      const texto = montarEvolucao(dados, textoAnterior);
      const arquivo = await obterPdf(texto);
      const r = await registrarProntuario({
        texto,
        paciente,
        modo: modo ?? "",
        sessionId,
        pacienteId,
        tipo: "retorno",
        retornoDe,
        pdf: arquivo.blob,
        nomePdf: arquivo.nome,
      });
      setSalvoId(r.id);
    } catch {
      setAviso(
        "Não foi possível salvar a evolução no servidor agora. Nada foi apagado: toque em COMPARTILHAR PDF para guardar uma cópia e tente de novo.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function compartilhar() {
    try {
      const arquivo = await obterPdf(montarEvolucao(dados, textoAnterior));
      await compartilharPdf(arquivo.blob, arquivo.nome);
    } catch {
      setAviso("Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  function encerrar(destino: string) {
    limparPreviews();
    reset();
    router.push(destino);
  }

  const dxPrevios = diagnosticosDoProntuario(textoAnterior);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-ds-5 px-4 pb-ds-7 pt-4 md:px-ds-6 md:pt-ds-5 lg:max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-1 pr-16">
        <BackButton />
        <BarraConsulta etapa={1} simples />
      </header>
      <div>
        <h1 className="text-3xl font-bold tracking-wide md:text-4xl">EVOLUÇÃO</h1>
        <p className="text-lg text-muted">
          Retorno da consulta{anterior ? ` de ${formatarData(anterior.criado_em)}` : ""}
          {paciente.trim() ? ` · ${paciente.trim()}` : ""}
        </p>
      </div>
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
        A consulta anterior não muda; esta evolução vira um novo registro ligado a ela.
      </p>

      <PainelConsultaAnterior p={anterior} erro={erroAnterior} />

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">MINI ANAMNESE</h2>
        <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
          <button
            type="button"
            aria-pressed={anamnese.voz}
            onClick={() => setAnamnese({ ...anamnese, voz: !anamnese.voz })}
            className={`chip justify-center text-center ${anamnese.voz ? "chip-on" : "chip-off"}`}
          >
            🎙️ TRANSCRIÇÃO
          </button>
          <button
            type="button"
            aria-pressed={anamnese.texto}
            onClick={() => setAnamnese({ ...anamnese, texto: !anamnese.texto })}
            className={`chip justify-center text-center ${anamnese.texto ? "chip-on" : "chip-off"}`}
          >
            ⌨️ ESCRITO
          </button>
        </div>
        {anamnese.voz && <GravadorVoz />}
        {anamnese.texto && (
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">Como o paciente está desde a última consulta?</span>
            <textarea
              value={captura.texto}
              onChange={(e) => setCapturaTexto(e.target.value)}
              className="input-sunken min-h-[160px]"
            />
          </label>
        )}
      </Panel>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">LAUDOS NOVOS</h2>
        <LaudosNovos />
      </Panel>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">IMAGENS NOVAS</h2>
        <ImagensNovas />
      </Panel>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">DIAGNÓSTICO</h2>
        <Decidir rotulo="Diagnóstico" valor={evolucao.diagnostico} onEscolher={(d) => setDecisao("diagnostico", d)} />
        {evolucao.diagnostico === "manter" && (
          <p className="text-base">
            {dxPrevios.length
              ? `Mantido: ${dxPrevios.join("; ")}.`
              : anterior
                ? "A consulta anterior não tem diagnóstico assinalado."
                : "Carregando a consulta anterior…"}
          </p>
        )}
      </Panel>
      {(evolucao.diagnostico === "ajustar" || evolucao.diagnostico === "novo") && (
        <SugestoesTela
          itens={itensDx}
          extras={extras.diagnostico}
          selecionados={diagnostico.selecionados}
          fontesDisponiveis={FONTES_DIAGNOSTICO}
          estado={dx.estado}
          semBase="Escreva ou grave a mini anamnese para gerar sugestões, ou acrescente o diagnóstico abaixo."
          onGerar={dx.gerar}
          onToggle={toggleDx}
          onAdd={(t) => addExtra("diagnostico", t)}
        />
      )}

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">CONDUTA</h2>
        <Decidir rotulo="Conduta" valor={evolucao.conduta} onEscolher={(d) => setDecisao("conduta", d)} />
        {evolucao.conduta === "manter" && (
          <p className="whitespace-pre-wrap text-base">
            {condutaPrevia.conduta ||
            condutaPrevia.investigacao ||
            condutaPrevia.tratamento ||
            condutaPrevia.orientacoes
              ? [
                  condutaPrevia.conduta,
                  condutaPrevia.investigacao,
                  condutaPrevia.tratamento,
                  condutaPrevia.orientacoes,
                ]
                  .filter(Boolean)
                  .join("\n\n")
              : anterior
                ? "A consulta anterior não tem conduta registrada."
                : "Carregando a consulta anterior…"}
          </p>
        )}
      </Panel>
      {(evolucao.conduta === "ajustar" || evolucao.conduta === "novo") && (
        <>
          <FonteSeletor
            fontes={fontesConduta}
            onFontesChange={setFontesConduta}
            colado={coladoConduta}
            onColadoChange={setColadoConduta}
          />
          <CampoTextoGerado
            titulo="Conduta"
            rotuloGerar="✨ GERAR CONDUTA COM IA"
            semBase="Escolha ou mantenha um diagnóstico e uma fonte acima, ou escreva a conduta aqui."
            disponivel={condutaDisponivel}
            salvo={condutaTratamento.conduta}
            gerar={() => gerarConduta(diagnosticoTexto, fontesConduta, coladoConduta)}
            salvar={(texto, editado) => setCondutaTratamento("conduta", texto, editado)}
          />
          <CampoTextoGerado
            titulo="Propedêutica"
            rotuloGerar="✨ GERAR PROPEDÊUTICA COM IA"
            semBase="Escolha ou mantenha um diagnóstico e uma fonte acima, ou escreva a propedêutica aqui."
            disponivel={condutaDisponivel}
            salvo={condutaTratamento.investigacao}
            gerar={() => gerarInvestigacao(diagnosticoTexto, fontesConduta, coladoConduta)}
            salvar={(texto, editado) => setCondutaTratamento("investigacao", texto, editado)}
          />
          <CampoTextoGerado
            titulo="Tratamento"
            rotuloGerar="✨ GERAR TRATAMENTO COM IA"
            semBase="Escolha ou mantenha um diagnóstico e uma fonte acima, ou escreva o tratamento aqui."
            disponivel={condutaDisponivel}
            salvo={condutaTratamento.tratamento}
            gerar={() => gerarTratamento(diagnosticoTexto, fontesConduta, coladoConduta)}
            salvar={(texto, editado) => setCondutaTratamento("tratamento", texto, editado)}
          />
          <CampoTextoGerado
            titulo="Orientações gerais"
            rotuloGerar="✨ GERAR ORIENTAÇÕES COM IA"
            semBase="Escolha ou mantenha um diagnóstico e uma fonte acima, ou escreva as orientações aqui."
            disponivel={condutaDisponivel}
            salvo={condutaTratamento.orientacoes}
            gerar={() => gerarOrientacoesTexto(diagnosticoTexto, fontesConduta, coladoConduta)}
            salvar={(texto, editado) => setCondutaTratamento("orientacoes", texto, editado)}
          />
        </>
      )}

      <ApoioMedico tela="evolucao" />

      <BigButton disabled={ocupado || salvoId !== null} onClick={concluir}>
        {ocupado ? "SALVANDO…" : salvoId ? "✅ SALVO" : "CONCLUIR EVOLUÇÃO"}
      </BigButton>
      <BigButton variant="secondary" onClick={compartilhar}>
        COMPARTILHAR / SALVAR PDF NO APARELHO
      </BigButton>

      <SalvoDialog
        aberto={salvoId !== null}
        onAbrirPdf={() => window.open(urlPdfProntuario(salvoId ?? ""), "_blank", "noopener")}
        onCompartilhar={compartilhar}
        onVerProntuario={pacienteId ? () => encerrar(`/pacientes/${pacienteId}`) : undefined}
        onInicio={() => encerrar("/")}
      />
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </main>
  );
}

export default function EvolucaoPage() {
  const pronto = useEtapa(2);
  return pronto ? <Conteudo /> : null;
}
