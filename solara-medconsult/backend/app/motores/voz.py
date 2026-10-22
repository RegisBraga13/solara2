"""Motor de voz: transcrição em tempo real (Deepgram Nova-3) com diarização nativa.

Usa o WebSocket do Deepgram diretamente (sem SDK). O áudio chega do navegador como
WebM/Opus (MediaRecorder) e é repassado sem conversão.
"""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urlencode

from pydantic import BaseModel
from websockets.asyncio.client import connect

from app.config import settings

logger = logging.getLogger("medconsult.voz")

DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen"
# Deepgram só numera as vozes (0, 1, 2...). O papel é uma SUPOSIÇÃO pela ordem de entrada:
# 1ª voz = médico, 2ª = paciente, 3ª = acompanhante. O médico pode trocar na tela.
PAPEIS = ("medico", "paciente", "acompanhante")


class Transcricao(BaseModel):
    text: str
    speaker: str
    speaker_id: int | None
    is_final: bool
    timestamp_ms: int | None


class OrdemFalantes:
    """Associa o id de voz do Deepgram a um papel, pela ordem da primeira fala."""

    def __init__(self) -> None:
        self._ordem: list[int] = []

    def papel(self, speaker_id: int | None) -> str:
        if speaker_id is None:
            return "indefinido"
        if speaker_id not in self._ordem:
            self._ordem.append(speaker_id)
        i = self._ordem.index(speaker_id)
        return PAPEIS[i] if i < len(PAPEIS) else "indefinido"


def segmentos_do_resultado(msg: dict[str, Any], ordem: OrdemFalantes) -> list[Transcricao]:
    """Converte uma mensagem 'Results' do Deepgram em trechos por voz (puro e testável)."""
    if msg.get("type") != "Results":
        return []
    try:
        alt = msg["channel"]["alternatives"][0]
    except (KeyError, IndexError, TypeError):
        return []
    is_final = bool(msg.get("is_final"))
    texto = (alt.get("transcript") or "").strip()
    if not texto:
        return []
    palavras = [p for p in alt.get("words", []) if isinstance(p, dict)]
    if not palavras or not any("speaker" in p for p in palavras):
        inicio = palavras[0].get("start") if palavras else msg.get("start")
        return [
            Transcricao(
                text=texto,
                speaker="indefinido",
                speaker_id=None,
                is_final=is_final,
                timestamp_ms=_ms(inicio),
            )
        ]
    # Agrupa palavras consecutivas da mesma voz.
    grupos: list[tuple[int | None, list[dict[str, Any]]]] = []
    for p in palavras:
        sid = p.get("speaker")
        if grupos and grupos[-1][0] == sid:
            grupos[-1][1].append(p)
        else:
            grupos.append((sid, [p]))
    saida = []
    for sid, ps in grupos:
        trecho = " ".join(str(p.get("punctuated_word") or p.get("word") or "") for p in ps).strip()
        if trecho:
            saida.append(
                Transcricao(
                    text=trecho,
                    speaker=ordem.papel(sid),
                    speaker_id=sid,
                    is_final=is_final,
                    timestamp_ms=_ms(ps[0].get("start")),
                )
            )
    return saida


def _ms(segundos: Any) -> int | None:
    try:
        return int(float(segundos) * 1000)
    except (TypeError, ValueError):
        return None


def url_deepgram() -> str:
    params = {
        "model": settings.deepgram_model,
        "language": settings.deepgram_language,
        "diarize": "true",
        "punctuate": "true",
        "smart_format": "true",
        "interim_results": "true",
        "endpointing": "500",
    }
    return f"{DEEPGRAM_URL}?{urlencode(params)}"


class SessaoDeepgram:
    """Uma conexão de streaming com o Deepgram."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key if api_key is not None else settings.deepgram_api_key
        self._ws: Any = None
        self.ordem = OrdemFalantes()

    async def abrir(self) -> None:
        self._ws = await connect(
            url_deepgram(),
            additional_headers={"Authorization": f"Token {self._api_key}"},
            open_timeout=8,
            max_size=None,
        )

    async def enviar_audio(self, chunk: bytes) -> None:
        await self._ws.send(chunk)

    async def manter_viva(self) -> None:
        await self._ws.send(json.dumps({"type": "KeepAlive"}))

    async def fechar_stream(self) -> None:
        """Pede ao Deepgram que termine de processar o que já recebeu."""
        await self._ws.send(json.dumps({"type": "CloseStream"}))

    async def eventos(self) -> AsyncIterator[Transcricao]:
        async for bruto in self._ws:
            if isinstance(bruto, bytes):
                continue
            try:
                msg = json.loads(bruto)
            except ValueError:
                continue
            for t in segmentos_do_resultado(msg, self.ordem):
                yield t

    async def fechar(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:  # noqa: BLE001
                pass
