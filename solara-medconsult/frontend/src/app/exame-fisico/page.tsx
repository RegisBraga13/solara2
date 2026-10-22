"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { BigButton } from "@/components/BigButton";
import { CameraCaptura, hojeLocal } from "@/components/CameraCaptura";
import { GravadorVoz } from "@/components/GravadorVoz";
import { Panel } from "@/components/Panel";
import { Tela } from "@/components/Tela";
import { useAutoAltura } from "@/hooks/useAutoAltura";
import { useEtapa } from "@/hooks/useEtapa";
import { ApiError, deleteImage, listImages, uploadImage } from "@/lib/api";
import { novoUuid } from "@/lib/uuid";
import { useConsulta, type ImagemEnviada } from "@/store/consulta";

interface Pendente {
  tmp: string;
  nome: string;
  preview: string | null;
}
interface Falha {
  tmp: string;
  file: File;
  motivo: string;
  repetir: boolean;
}

/** AAAA-MM-DD -> DD/MM/AAAA (sem passar por Date, para não deslocar o dia por fuso). */
const fmtData = (iso: string | null) => {
  if (!iso) return "Sem data";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : "Sem data";
};

function Conteudo() {
  const router = useRouter();
  const sessionId = useConsulta((s) => s.sessionId);
  const imagens = useConsulta((s) => s.imagens);
  const addImagem = useConsulta((s) => s.addImagem);
  const removeImagem = useConsulta((s) => s.removeImagem);
  const addImagemEnviada = useConsulta((s) => s.addImagemEnviada);
  const removeImagemEnviada = useConsulta((s) => s.removeImagemEnviada);
  const substituirImagens = useConsulta((s) => s.substituirImagensEnviadas);
  const exameFisico = useConsulta((s) => s.exameFisico);
  const setExameFisicoTexto = useConsulta((s) => s.setExameFisicoTexto);
  const setEtapa = useConsulta((s) => s.setEtapa);

  const [aviso, setAviso] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [camera, setCamera] = useState(false);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [vozAberta, setVozAberta] = useState(false);
  const [textoAberto, setTextoAberto] = useState(() => exameFisico.texto.trim() !== "");
  const fileRef = useRef<HTMLInputElement>(null);
  const achadosRef = useAutoAltura(exameFisico.texto);

  // As URLs das imagens expiram: ao abrir a tela, pede a lista atualizada (em ordem cronológica).
  useEffect(() => {
    if (!sessionId || useConsulta.getState().imagens.length === 0) return;
    let vivo = true;
    listImages(sessionId)
      .then((lista) => {
        if (!vivo) return;
        const nomes = new Map(useConsulta.getState().imagens.map((i) => [i.id, i.nome]));
        substituirImagens(
          lista.map<ImagemEnviada>((i) => ({
            id: i.image_id,
            nome: nomes.get(i.image_id) ?? "imagem",
            url: i.url,
            data: i.data_classificada,
            descricao: i.descricao,
          })),
        );
      })
      .catch(() => undefined); // sem servidor: mantém o que já está salvo
    return () => {
      vivo = false;
    };
  }, [sessionId, substituirImagens]);

  async function enviar(file: File, tmp: string = novoUuid(), dataManual?: string) {
    if (!sessionId) {
      setFalhas((f) => [...f, { tmp, file, motivo: "Sessão não iniciada.", repetir: false }]);
      return;
    }
    const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
    setPendentes((p) => [...p, { tmp, nome: file.name, preview }]);
    try {
      const r = dataManual
        ? await uploadImage(sessionId, file, dataManual)
        : await uploadImage(sessionId, file);
      const nome = addImagem(file.name);
      addImagemEnviada({
        id: r.image_id,
        nome,
        url: r.url,
        data: r.data_classificada,
        descricao: r.descricao,
      });
    } catch (e) {
      const api = e instanceof ApiError ? e : null;
      const definitivo = api !== null && api.status !== null && api.status < 500;
      setFalhas((f) => [
        ...f,
        { tmp, file, motivo: definitivo ? (api?.message ?? "") : "", repetir: !definitivo },
      ]);
    } finally {
      setPendentes((p) => p.filter((x) => x.tmp !== tmp));
      if (preview && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(preview);
    }
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void enviar(arquivo);
  }

  function tentarDeNovo(f: Falha) {
    setFalhas((lista) => lista.filter((x) => x.tmp !== f.tmp));
    void enviar(f.file, f.tmp);
  }

  async function remover(img: ImagemEnviada) {
    if (sessionId) {
      try {
        await deleteImage(sessionId, img.id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          setAviso("⚠️ Não foi possível remover a imagem agora. Tente de novo.");
          return;
        }
      }
    }
    removeImagemEnviada(img.id);
    removeImagem(img.nome);
  }

  function concluir() {
    setEtapa(5);
    router.push("/historia");
  }

  const ordenadas = [...imagens].sort((a, b) =>
    a.data === b.data ? 0 : a.data === null ? 1 : b.data === null ? -1 : a.data < b.data ? -1 : 1,
  );

  return (
    <Tela etapa={4} titulo="EXAME FÍSICO E COMPLEMENTOS">
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base text-muted">
        Selecione ou insira o conteúdo do exame físico abaixo.
      </p>

      {aviso && (
        <div role="alert" className="skeu flex items-center justify-between gap-ds-3 rounded-xl bg-sunken p-ds-4 shadow-sunken">
          <p className="text-lg font-semibold">{aviso}</p>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setAviso(null)}
            className="touch skeu min-h-[44px] min-w-[44px] rounded-md bg-surface px-3 font-bold shadow-raised active:shadow-pressed"
          >
            ✕
          </button>
        </div>
      )}

      <Panel className="flex flex-col gap-ds-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Escolher imagem"
          className="hidden"
          onChange={aoEscolher}
        />
        <div className="grid grid-cols-2 gap-ds-3">
          <BigButton variant="secondary" onClick={() => fileRef.current?.click()}>
            🖼️ PRINTS (GALERIA/ARQUIVOS)
          </BigButton>
          <BigButton onClick={() => setCamera(true)}>📸 FOTOS (CÂMERA)</BigButton>
          <BigButton
            variant={vozAberta ? "primary" : "secondary"}
            onClick={() => setVozAberta((v) => !v)}
          >
            🎙️ VOZ
          </BigButton>
          <BigButton
            variant={textoAberto ? "primary" : "secondary"}
            onClick={() => setTextoAberto((v) => !v)}
          >
            📝 TEXTO
          </BigButton>
        </div>
        <CameraCaptura
          aberto={camera}
          onFoto={(arquivo) => void enviar(arquivo, novoUuid(), hojeLocal())}
          onFechar={() => setCamera(false)}
        />

        {vozAberta && <GravadorVoz />}

        {textoAberto && (
          <label className="flex flex-col gap-2">
            <span className="text-lg font-bold">Achados do exame físico (texto)</span>
            <textarea
              ref={achadosRef}
              rows={1}
              value={exameFisico.texto}
              onChange={(e) => setExameFisicoTexto(e.target.value)}
              className="input-sunken resize-none overflow-hidden"
            />
          </label>
        )}

        {falhas.map((f) => (
          <div
            key={f.tmp}
            role="alert"
            className="skeu flex flex-wrap items-center justify-between gap-ds-3 rounded-xl bg-sunken p-ds-4 shadow-sunken"
          >
            <p className="text-lg font-semibold">
              {f.motivo ? `⚠️ ${f.motivo}` : `⚠️ Falha no upload (${f.file.name}). Tentar de novo?`}
            </p>
            <div className="flex gap-ds-3">
              {f.repetir && (
                <BigButton variant="primary" onClick={() => tentarDeNovo(f)}>
                  Tentar de novo
                </BigButton>
              )}
              <BigButton
                variant="secondary"
                onClick={() => setFalhas((l) => l.filter((x) => x.tmp !== f.tmp))}
              >
                Descartar
              </BigButton>
            </div>
          </div>
        ))}

        {(ordenadas.length > 0 || pendentes.length > 0) && (
          <ul className="grid grid-cols-2 gap-ds-3 md:grid-cols-3">
            {pendentes.map((p) => (
              <li key={p.tmp} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview} alt={p.nome} className="h-28 w-full rounded-xl object-cover opacity-60" />
                ) : (
                  <span aria-hidden="true" className="flex h-28 items-center justify-center rounded-xl bg-soft text-2xl">🖼️</span>
                )}
                <p className="text-sm text-muted">Enviando e analisando…</p>
              </li>
            ))}
            {ordenadas.map((img) => {
              const aberta = expandida === img.id;
              return (
                <li key={img.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.nome} className="h-28 w-full rounded-xl object-cover" />
                  <p className="text-sm font-semibold">{fmtData(img.data)}</p>
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setExpandida(aberta ? null : img.id)}
                    className={`touch min-h-[44px] text-left text-sm ${aberta ? "" : "line-clamp-2"}`}
                  >
                    {img.descricao ?? "Sem descrição automática."}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${img.nome}`}
                    onClick={() => void remover(img)}
                    className="touch skeu min-h-[44px] min-w-[44px] self-end rounded-md bg-surface px-3 font-bold shadow-raised active:shadow-pressed"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <BigButton onClick={concluir}>CONCLUIR</BigButton>
    </Tela>
  );
}

export default function ExameFisicoPage() {
  const pronto = useEtapa(4);
  return pronto ? <Conteudo /> : null;
}
