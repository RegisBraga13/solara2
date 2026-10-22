"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { LaudosNovos } from "@/components/LaudosNovos";
import { Panel } from "@/components/Panel";
import { SalvoDialog } from "@/components/SalvoDialog";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import {
  listarAtestados,
  listarDeclaracoes,
  listarReceitas,
  registrarProntuario,
  urlPdfDocumento,
  urlPdfProntuario,
  urlPdfReceita,
  type AtestadoApi,
  type DeclaracaoApi,
  type ReceitaApi,
} from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { dataBr } from "@/lib/historia";
import { compartilharPdf, criarPdfProntuario } from "@/lib/pdf";
import { usePreviews } from "@/lib/previews";
import { escalasAplicadas, montarProntuario } from "@/lib/prontuario";
import { useConsulta } from "@/store/consulta";

/** Painel colapsado ("caixinha") de um item de ANEXOS, no padrão já usado para a consulta anterior. */
function Caixinha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Panel>
      <details>
        <summary className="cursor-pointer text-lg font-bold">{titulo}</summary>
        <div className="mt-ds-3 flex flex-col gap-ds-3">{children}</div>
      </details>
    </Panel>
  );
}

/**
 * Caixinha genérica de documentos emitidos (receita, atestado, declaração): busca a lista do
 * paciente e filtra pelos emitidos desde o início desta consulta (nenhum desses documentos guarda
 * `sessionId` ligado de volta — é uma heurística por data, não uma certeza).
 */
function AnexoDocumento<T extends { id: string; criado_em: string }>({
  emoji,
  titulo,
  rotuloVazio,
  rotuloBotao,
  pacienteId,
  desde,
  listar,
  urlPdf,
  urlEmitir,
  renderItem,
}: {
  emoji: string;
  titulo: string;
  rotuloVazio: string;
  rotuloBotao: string;
  pacienteId: string | null;
  desde: number | null;
  listar: (pacienteId: string) => Promise<T[]>;
  urlPdf: (id: string) => string;
  urlEmitir: (pacienteId: string) => string;
  renderItem: (item: T) => string;
}) {
  const [itens, setItens] = useState<T[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    let vivo = true;
    listar(pacienteId)
      .then((lista) => {
        if (!vivo) return;
        setItens(desde !== null ? lista.filter((d) => new Date(d.criado_em).getTime() >= desde) : lista);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [pacienteId, desde, listar]);

  return (
    <Caixinha titulo={`${emoji} ${titulo}${itens && itens.length > 0 ? ` (${itens.length})` : ""}`}>
      {!pacienteId && <p className="text-base text-muted">Disponível só para pacientes cadastrados.</p>}
      {pacienteId && erro && <p className="text-base font-semibold">⚠️ Não foi possível carregar.</p>}
      {pacienteId && !erro && itens === null && <p className="text-base text-muted">Carregando…</p>}
      {pacienteId && itens !== null && itens.length === 0 && (
        <p className="text-base text-muted">{rotuloVazio}</p>
      )}
      {itens && itens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <li key={item.id}>
              <a
                href={urlPdf(item.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-base font-semibold underline"
              >
                {renderItem(item)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {pacienteId && (
        <BigButton variant="secondary" onClick={() => window.open(urlEmitir(pacienteId), "_blank", "noopener")}>
          {rotuloBotao}
        </BigButton>
      )}
    </Caixinha>
  );
}

function AnexoReceitas({ pacienteId, desde }: { pacienteId: string | null; desde: number | null }) {
  return (
    <AnexoDocumento<ReceitaApi>
      emoji="💊"
      titulo="Receitas"
      rotuloVazio="Nenhuma receita emitida nesta consulta."
      rotuloBotao="+ EMITIR RECEITA"
      pacienteId={pacienteId}
      desde={desde}
      listar={listarReceitas}
      urlPdf={urlPdfReceita}
      urlEmitir={(id) => `/pacientes/${id}/receita`}
      renderItem={(r) => `${formatarData(r.criado_em)} — ${r.itens.map((i) => i.medicamento).join(", ")}`}
    />
  );
}

function AnexoAtestados({ pacienteId, desde }: { pacienteId: string | null; desde: number | null }) {
  return (
    <AnexoDocumento<AtestadoApi>
      emoji="📄"
      titulo="Atestados"
      rotuloVazio="Nenhum atestado emitido nesta consulta."
      rotuloBotao="+ EMITIR ATESTADO"
      pacienteId={pacienteId}
      desde={desde}
      listar={listarAtestados}
      urlPdf={urlPdfDocumento}
      urlEmitir={(id) => `/pacientes/${id}/atestado`}
      renderItem={(a) =>
        `${formatarData(a.criado_em)} — ${a.conteudo.dias_afastamento} dia(s) a partir de ${dataBr(a.conteudo.data_inicial)}`
      }
    />
  );
}

function AnexoDeclaracoes({ pacienteId, desde }: { pacienteId: string | null; desde: number | null }) {
  return (
    <AnexoDocumento<DeclaracaoApi>
      emoji="📝"
      titulo="Declarações"
      rotuloVazio="Nenhuma declaração emitida nesta consulta."
      rotuloBotao="+ EMITIR DECLARAÇÃO"
      pacienteId={pacienteId}
      desde={desde}
      listar={listarDeclaracoes}
      urlPdf={urlPdfDocumento}
      urlEmitir={(id) => `/pacientes/${id}/declaracao`}
      renderItem={(d) =>
        `${formatarData(d.criado_em)} — comparecimento ${dataBr(d.conteudo.data)} ${d.conteudo.hora_inicio}–${d.conteudo.hora_fim}`
      }
    />
  );
}

function AnexoEscalas({ escalas }: { escalas: Record<string, string> }) {
  const itens = escalasAplicadas(escalas);
  return (
    <Caixinha titulo={`📊 Escalas${itens.length > 0 ? ` (${itens.length})` : ""}`}>
      {itens.length === 0 ? (
        <p className="text-base text-muted">Nenhuma escala aplicada nesta consulta.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((e) => (
            <li key={e.id} className="text-base">
              {e.nome}: {e.valor} (0–{e.max})
            </li>
          ))}
        </ul>
      )}
    </Caixinha>
  );
}

function AnexoRegistro({
  transcricoesCount,
  imagens,
  urls,
}: {
  transcricoesCount: number;
  imagens: string[];
  urls: Record<string, string>;
}) {
  return (
    <Caixinha titulo="🎙️ Transcrição e imagens">
      <p className="text-base text-muted">
        {transcricoesCount > 0 ? `${transcricoesCount} fala(s) registrada(s).` : "Nenhuma transcrição."}
      </p>
      {imagens.length > 0 ? (
        <ul className="flex flex-wrap gap-ds-3">
          {imagens.map((nome) => (
            <li key={nome} className="flex items-center gap-2">
              {urls[nome] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[nome]} alt={nome} className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <span aria-hidden="true" className="text-2xl">🖼️</span>
              )}
              <span className="break-all text-sm">{nome}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted">Nenhuma imagem.</p>
      )}
    </Caixinha>
  );
}

function Conteudo() {
  const router = useRouter();
  const modo = useConsulta((s) => s.modo);
  const historia = useConsulta((s) => s.historia);
  const diagnostico = useConsulta((s) => s.diagnostico);
  const condutaTratamento = useConsulta((s) => s.condutaTratamento);
  const anotacoes = useConsulta((s) => s.anotacoes);
  const escalas = useConsulta((s) => s.escalas);
  const imagens = useConsulta((s) => s.captura.imagens);
  const laudos = useConsulta((s) => s.laudos);
  const paciente = useConsulta((s) => s.paciente);
  const sessionId = useConsulta((s) => s.sessionId);
  const pacienteId = useConsulta((s) => s.pacienteId);
  const tipo = useConsulta((s) => s.tipo);
  const retornoDe = useConsulta((s) => s.retornoDe);
  const transcricoes = useConsulta((s) => s.transcricoes);
  const iniciadaEm = useConsulta((s) => s.iniciada_em);
  const reset = useConsulta((s) => s.reset);
  const urls = usePreviews((s) => s.urls);
  const limparPreviews = usePreviews((s) => s.limparPreviews);

  const texto = montarProntuario({
    modo,
    historia,
    diagnostico,
    condutaTratamento,
    anotacoes,
    tipo,
    escalas,
  });

  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ blob: Blob; nome: string } | null>(null);

  async function obterPdf() {
    if (pdf) return pdf;
    const novo = await criarPdfProntuario({ texto, paciente, geradoEm: new Date() });
    setPdf(novo);
    return novo;
  }

  async function registrar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const arquivo = await obterPdf();
      const r = await registrarProntuario({
        texto,
        paciente,
        modo: modo ?? "",
        sessionId,
        pacienteId,
        tipo,
        retornoDe,
        pdf: arquivo.blob,
        nomePdf: arquivo.nome,
      });
      setSalvoId(r.id);
    } catch {
      setAviso(
        "Não foi possível salvar o prontuário no servidor agora. Nada foi apagado: toque em COMPARTILHAR PDF para guardar uma cópia e tente salvar de novo.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function compartilhar() {
    try {
      const arquivo = await obterPdf();
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

  return (
    <Tela etapa={9} titulo="PRONTUÁRIO">
      <Panel>
        <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed">{texto}</pre>
      </Panel>

      <h2 className="text-xl font-bold tracking-wide">ANEXOS</h2>
      <div className="flex flex-col gap-ds-3">
        <AnexoAtestados pacienteId={pacienteId} desde={iniciadaEm} />
        <AnexoDeclaracoes pacienteId={pacienteId} desde={iniciadaEm} />
        <AnexoReceitas pacienteId={pacienteId} desde={iniciadaEm} />
        <Caixinha titulo={`📎 Laudos${laudos.length > 0 ? ` (${laudos.length})` : ""}`}>
          <LaudosNovos />
        </Caixinha>
        <AnexoEscalas escalas={escalas} />
        <AnexoRegistro transcricoesCount={transcricoes.length} imagens={imagens} urls={urls} />
      </div>

      <BigButton disabled={ocupado || salvoId !== null} onClick={registrar}>
        {ocupado ? "SALVANDO…" : salvoId ? "✅ SALVO" : "REGISTRAR E SALVAR PDF"}
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
    </Tela>
  );
}

export default function ProntuarioPage() {
  const pronto = useEtapa(9);
  return pronto ? <Conteudo /> : null;
}
