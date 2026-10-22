"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";

interface CameraCapturaProps {
  aberto: boolean;
  onFoto: (arquivo: File) => void;
  onFechar: () => void;
}

/** AAAA-MM-DD no horário do aparelho (a foto tirada agora é de hoje). */
export const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Câmera em tempo real: mostra a imagem ao vivo e tira quantas fotos o médico quiser, sem sair da
 * tela. Cada foto vai direto para a lista de imagens da consulta. Exige HTTPS (ou localhost) e a
 * permissão da câmera; sem elas, avisa e o médico usa "Escolher da galeria".
 */
export function CameraCaptura({ aberto, onFoto, onFechar }: CameraCapturaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const [tiradas, setTiradas] = useState(0);
  const [traseira, setTraseira] = useState(true);

  const parar = useCallback(() => {
    fluxoRef.current?.getTracks().forEach((t) => t.stop());
    fluxoRef.current = null;
    setPronta(false);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setErro(null);
    setTiradas(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não abre a câmera aqui. Use a opção de escolher da galeria.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: traseira ? "environment" : "user" }, width: { ideal: 1920 } },
        audio: false,
      })
      .then((fluxo) => {
        if (!ativo) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        fluxoRef.current = fluxo;
        const v = videoRef.current;
        if (v) {
          v.srcObject = fluxo;
          void v.play().catch(() => undefined);
        }
        setPronta(true);
      })
      .catch((e: { name?: string }) => {
        if (!ativo) return;
        setErro(
          e?.name === "NotAllowedError"
            ? "A câmera está bloqueada. Em Ajustes > Safari > Câmera, permita este site e tente de novo."
            : "Não foi possível abrir a câmera. Use a opção de escolher da galeria.",
        );
      });
    return () => {
      ativo = false;
      parar();
    };
  }, [aberto, traseira, parar]);

  function tirar() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const nome = `foto-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
        onFoto(new File([blob], nome, { type: "image/jpeg" }));
        setTiradas((n) => n + 1);
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-3 md:p-ds-5">
      <div role="dialog" aria-modal="true" aria-label="Câmera" className="mx-auto flex h-full w-full max-w-3xl flex-col gap-ds-3">
        <div className="relative flex-1 overflow-hidden rounded-xl bg-black">
          {erro ? (
            <p role="alert" className="p-ds-5 text-lg font-semibold text-white">
              ⚠️ {erro}
            </p>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
          )}
          {!erro && !pronta && (
            <p role="status" className="absolute inset-0 flex items-center justify-center text-lg text-white">
              Abrindo a câmera… permita o acesso se o aparelho pedir.
            </p>
          )}
        </div>
        {tiradas > 0 && (
          <p role="status" className="text-center text-lg font-semibold text-white">
            {tiradas} foto(s) enviada(s) à consulta
          </p>
        )}
        <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-3">
          <BigButton disabled={!pronta} onClick={tirar} className="disabled:opacity-50">
            📸 TIRAR FOTO
          </BigButton>
          <BigButton variant="secondary" disabled={!pronta} onClick={() => setTraseira((t) => !t)} className="disabled:opacity-50">
            🔄 TROCAR CÂMERA
          </BigButton>
          <BigButton variant="secondary" onClick={onFechar}>
            {tiradas > 0 ? "CONCLUIR" : "FECHAR"}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
