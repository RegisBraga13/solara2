"""Captura da consulta: áudio em tempo real (WebSocket) e imagens (upload + análise)."""

import asyncio
import contextlib
import json
import logging
import mimetypes
import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, WebSocket
from fastapi.websockets import WebSocketDisconnect
from pydantic import BaseModel

from app import repositorio, storage
from app.config import settings
from app.motores import imagens as motor_imagens
from app.motores import voz as motor_voz

logger = logging.getLogger("medconsult.captura")
router = APIRouter(tags=["captura"])


KEEPALIVE_S = 5.0
FLUSH_S = 3.0


# ----------------------------------------------------------------------------- imagens


class ImagemOut(BaseModel):
    image_id: str
    url: str
    data_classificada: date | None
    data_origem: str | None
    descricao: str | None
    gerada_por_ia: bool
    avisos: list[str] = []


def _session_uuid(session_id: str) -> str:
    try:
        return str(uuid.UUID(session_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id inválido.") from None


def _out(row: dict[str, Any], session_id: str, avisos: list[str] | None = None) -> ImagemOut:
    return ImagemOut(
        image_id=row["id"],
        # Servida pelo próprio backend (a URL do armazenamento só abre na máquina do servidor).
        url=f"/session/{session_id}/images/{row['id']}/arquivo",
        data_classificada=row["data_classificada"],
        data_origem=row["data_origem"],
        descricao=row["descricao_padrao"],
        gerada_por_ia=bool(row["descricao_padrao"]) and bool(row.get("descricao_modelo")),
        avisos=avisos or [],
    )


@router.post("/session/{session_id}/images", response_model=ImagemOut)
async def enviar_imagem(
    session_id: str,
    file: Annotated[UploadFile, File()],
    data_manual: Annotated[date | None, Form()] = None,
) -> ImagemOut:
    sid = _session_uuid(session_id)
    raw = await file.read(settings.max_image_bytes + 1)
    try:
        img = await asyncio.to_thread(motor_imagens.processar_imagem, raw)
    except motor_imagens.ImagemInvalida as exc:
        status = 413 if "10 MB" in str(exc) else 422
        raise HTTPException(status_code=status, detail=str(exc)) from None

    avisos: list[str] = []
    if img.data_exif:
        data, origem = img.data_exif, "exif"
    elif data_manual:
        data, origem = data_manual, "manual"
    else:
        data, origem = None, None
        avisos.append("Data da foto não identificada.")

    chave = f"sessions/{sid}/{uuid.uuid4()}.{img.extensao}"
    try:
        await asyncio.to_thread(storage.upload_object, chave, img.dados, img.content_type)
    except Exception as exc:  # noqa: BLE001
        logger.error("Falha no upload para o armazenamento: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Armazenamento indisponível.") from None

    descricao = None
    try:
        descricao = await motor_imagens.analisar_imagem(img.para_visao)
    except motor_imagens.VisaoIndisponivel:
        avisos.append("Descrição automática indisponível. Descreva a imagem manualmente.")

    try:
        row = await asyncio.to_thread(
            repositorio.inserir_imagem,
            session_id=sid,
            object_name=chave,
            url=f"s3://{settings.s3_bucket}/{chave}",
            data_classificada=data,
            data_origem=origem,
            descricao=descricao.texto if descricao else None,
            modelo=descricao.modelo if descricao else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Falha ao gravar imagem no banco: %s", type(exc).__name__)
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        raise HTTPException(status_code=503, detail="Banco de dados indisponível.") from None

    # Auditoria sem conteúdo clínico: só ids, modelo e origem da data.
    logger.info(
        "imagem session=%s image=%s modelo=%s data_origem=%s ia=%s",
        sid,
        row["id"],
        descricao.modelo if descricao else "-",
        origem or "-",
        bool(descricao),
    )
    return _out(row, sid, avisos)


@router.get("/session/{session_id}/images", response_model=list[ImagemOut])
async def listar_imagens(session_id: str) -> list[ImagemOut]:
    sid = _session_uuid(session_id)
    try:
        rows = await asyncio.to_thread(repositorio.listar_imagens, sid)
    except Exception as exc:  # noqa: BLE001
        logger.error("Falha ao listar imagens: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Banco de dados indisponível.") from None
    return [_out(r, sid) for r in rows]


@router.get("/session/{session_id}/images/{image_id}/arquivo")
async def arquivo_da_imagem(session_id: str, image_id: str) -> Response:
    sid = _session_uuid(session_id)
    try:
        iid = str(uuid.UUID(image_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="image_id inválido.") from None
    try:
        chave = await asyncio.to_thread(repositorio.chave_da_imagem, sid, iid)
        if chave is None:
            raise HTTPException(status_code=404, detail="Imagem não encontrada.")
        dados = await asyncio.to_thread(storage.get_object, chave)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Imagem indisponível: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Imagem indisponível no momento.") from None
    tipo = mimetypes.guess_type(chave)[0] or "application/octet-stream"
    return Response(
        content=dados, media_type=tipo, headers={"Cache-Control": "private, max-age=3600"}
    )


@router.delete("/session/{session_id}/images/{image_id}", status_code=204)
async def remover_imagem(session_id: str, image_id: str) -> None:
    sid = _session_uuid(session_id)
    try:
        iid = str(uuid.UUID(image_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="image_id inválido.") from None
    try:
        chave = await asyncio.to_thread(repositorio.remover_imagem, sid, iid)
    except Exception as exc:  # noqa: BLE001
        logger.error("Falha ao remover imagem: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Banco de dados indisponível.") from None
    if chave is None:
        raise HTTPException(status_code=404, detail="Imagem não encontrada.")
    with contextlib.suppress(Exception):
        await asyncio.to_thread(storage.delete_object, chave)


# ------------------------------------------------------------------------------- áudio


def criar_sessao_voz() -> motor_voz.SessaoDeepgram:
    """Ponto único de criação (os testes substituem por uma sessão falsa)."""
    return motor_voz.SessaoDeepgram()


async def _enviar(ws: WebSocket, payload: dict[str, Any]) -> bool:
    try:
        await ws.send_json(payload)
        return True
    except Exception:  # noqa: BLE001
        return False


def _origem_permitida(ws: WebSocket) -> bool:
    origem = ws.headers.get("origin")
    return origem is None or origem in settings.cors_origins


@router.websocket("/ws/session/{session_id}/audio")
async def audio_ws(ws: WebSocket, session_id: str) -> None:
    try:
        sid = str(uuid.UUID(session_id))
    except ValueError:
        await ws.close(code=1008)
        return
    if not _origem_permitida(ws):
        await ws.close(code=1008)
        return
    await ws.accept()

    if not settings.deepgram_api_key:
        await _enviar(
            ws,
            {
                "type": "erro",
                "codigo": "sem_chave",
                "mensagem": "Transcrição não configurada. Continue em modo texto.",
            },
        )
        await ws.close(code=1011)
        return

    voz = criar_sessao_voz()
    try:
        await voz.abrir()
    except Exception as exc:  # noqa: BLE001
        logger.error("Não conectou ao Deepgram: %s", type(exc).__name__)
        await _enviar(
            ws,
            {
                "type": "erro",
                "codigo": "motor_indisponivel",
                "mensagem": "Transcrição indisponível. Continue em modo texto.",
            },
        )
        await ws.close(code=1011)
        return

    estado = {"pausado": False}
    await _enviar(ws, {"type": "estado", "estado": "gravando"})

    async def do_cliente() -> None:
        """Áudio (binário) e controles (JSON) vindos do navegador."""
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                return
            if msg.get("bytes") is not None:
                chunk = msg["bytes"]
                if estado["pausado"] or not chunk:
                    continue
                if len(chunk) > settings.max_audio_chunk_bytes:
                    await _enviar(
                        ws,
                        {
                            "type": "erro",
                            "codigo": "chunk_grande",
                            "mensagem": "Trecho grande demais.",
                        },
                    )
                    continue
                await voz.enviar_audio(chunk)
            elif msg.get("text") is not None:
                try:
                    cmd = json.loads(msg["text"]).get("type")
                except (ValueError, AttributeError):
                    continue
                if cmd == "pause":
                    estado["pausado"] = True
                    await _enviar(ws, {"type": "estado", "estado": "pausado"})
                elif cmd == "resume":
                    estado["pausado"] = False
                    await _enviar(ws, {"type": "estado", "estado": "gravando"})
                elif cmd == "stop":
                    await voz.fechar_stream()
                    return

    async def do_deepgram() -> None:
        async for t in voz.eventos():
            await _enviar(ws, {"type": "transcricao", **t.model_dump()})
            if t.is_final:
                try:
                    await asyncio.to_thread(
                        repositorio.inserir_transcricao,
                        session_id=sid,
                        texto=t.text,
                        speaker=t.speaker,
                        is_final=True,
                        timestamp_ms=t.timestamp_ms,
                    )
                except Exception as exc:  # noqa: BLE001  não interrompe a captura
                    logger.warning("Transcrição não gravada no banco: %s", type(exc).__name__)

    async def do_keepalive() -> None:
        while True:
            await asyncio.sleep(KEEPALIVE_S)
            if estado["pausado"]:
                await voz.manter_viva()

    t_cliente = asyncio.create_task(do_cliente())
    t_voz = asyncio.create_task(do_deepgram())
    t_keep = asyncio.create_task(do_keepalive())
    try:
        feitas, _ = await asyncio.wait(
            {t_cliente, t_voz, t_keep}, return_when=asyncio.FIRST_COMPLETED
        )
        if t_voz in feitas and t_cliente not in feitas:
            # O Deepgram encerrou/caiu antes do cliente: avisa para seguir em modo texto.
            erro = t_voz.exception()
            if erro:
                logger.error("Deepgram caiu: %s", type(erro).__name__)
            await _enviar(
                ws,
                {
                    "type": "erro",
                    "codigo": "conexao_perdida",
                    "mensagem": "Conexão com a transcrição perdida. Continue em modo texto.",
                },
            )
        elif t_cliente in feitas and not t_cliente.cancelled() and t_cliente.exception() is None:
            # "stop": dá um tempo para o Deepgram entregar os últimos trechos.
            with contextlib.suppress(asyncio.TimeoutError, Exception):
                await asyncio.wait_for(asyncio.shield(t_voz), timeout=FLUSH_S)
            await _enviar(ws, {"type": "estado", "estado": "encerrado"})
    except WebSocketDisconnect:
        pass
    finally:
        for t in (t_cliente, t_voz, t_keep):
            t.cancel()
        await asyncio.gather(t_cliente, t_voz, t_keep, return_exceptions=True)
        await voz.fechar()
        with contextlib.suppress(Exception):
            await ws.close()


# ------------------------------------------------------------------ estado dos motores


@router.get("/captura/motores")
async def estado_dos_motores() -> dict[str, Any]:
    """Diz se a voz e a visão estão configuradas (para diagnóstico). Não chama os serviços."""
    voz = {"provedor": "deepgram", "ok": bool(settings.deepgram_api_key)}
    if not voz["ok"]:
        voz["detalhe"] = "DEEPGRAM_API_KEY vazia."
    visao = {"provedor": "openai", "ok": bool(settings.openai_api_key)}
    if not visao["ok"]:
        visao["detalhe"] = "OPENAI_API_KEY vazia."
    return {"voz": voz, "visao": visao}
