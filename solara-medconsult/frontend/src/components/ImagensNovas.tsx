"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { BigButton } from "@/components/BigButton";
import { CameraCaptura, hojeLocal } from "@/components/CameraCaptura";
import { ApiError, deleteImage, uploadImage } from "@/lib/api";
import { dataBr } from "@/lib/historia";
import { useConsulta, type ImagemEnviada } from "@/store/consulta";

/** Imagens novas do retorno: câmera ao vivo ou galeria, enviadas à consulta (mesma rota da Captura). */
export function ImagensNovas() {
  const sessionId = useConsulta((s) => s.sessionId);
  const imagens = useConsulta((s) => s.imagens);
  const addImagem = useConsulta((s) => s.addImagem);
  const removeImagem = useConsulta((s) => s.removeImagem);
  const addImagemEnviada = useConsulta((s) => s.addImagemEnviada);
  const removeImagemEnviada = useConsulta((s) => s.removeImagemEnviada);

  const [camera, setCamera] = useState(false);
  const [enviando, setEnviando] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function enviar(file: File, dataManual?: string) {
    if (!sessionId) {
      setAviso("⚠️ Consulta não iniciada.");
      return;
    }
    setAviso(null);
    setEnviando((n) => n + 1);
    try {
      const r = dataManual
        ? await uploadImage(sessionId, file, dataManual)
        : await uploadImage(sessionId, file);
      const nome = addImagem(file.name);
      addImagemEnviada({ id: r.image_id, nome, url: r.url, data: r.data_classificada, descricao: r.descricao });
    } catch (e) {
      setAviso(
        e instanceof ApiError && e.status !== null && e.status < 500
          ? `⚠️ ${e.message}`
          : "⚠️ Não foi possível enviar a imagem agora. Tente de novo.",
      );
    } finally {
      setEnviando((n) => n - 1);
    }
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void enviar(arquivo);
  }

  async function remover(img: ImagemEnviada) {
    try {
      if (sessionId) await deleteImage(sessionId, img.id);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        setAviso("⚠️ Não foi possível remover a imagem agora. Tente de novo.");
        return;
      }
    }
    removeImagem(img.nome);
    removeImagemEnviada(img.id);
  }

  return (
    <div className="flex flex-col gap-ds-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Escolher imagem"
        className="hidden"
        onChange={aoEscolher}
      />
      <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
        <BigButton onClick={() => setCamera(true)}>📷 TIRAR FOTO (CÂMERA)</BigButton>
        <BigButton variant="secondary" onClick={() => fileRef.current?.click()}>
          🖼️ ESCOLHER DA GALERIA
        </BigButton>
      </div>
      <CameraCaptura aberto={camera} onFoto={(arquivo) => void enviar(arquivo, hojeLocal())} onFechar={() => setCamera(false)} />
      {enviando > 0 && (
        <p role="status" className="text-base text-muted">
          Enviando {enviando} imagem(ns)…
        </p>
      )}
      {aviso && (
        <p role="alert" className="text-base font-semibold">
          {aviso}
        </p>
      )}
      {imagens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {imagens.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-sunken p-ds-3">
              <span className="break-all text-base">
                {dataBr(i.data)} · {i.nome}
              </span>
              <button
                type="button"
                aria-label={`Remover ${i.nome}`}
                onClick={() => void remover(i)}
                className="touch skeu min-h-[44px] min-w-[44px] rounded-md bg-surface px-3 font-bold shadow-raised"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
