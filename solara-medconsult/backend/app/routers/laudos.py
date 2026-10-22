"""Laudos novos do retorno: PDF ou foto do laudo, guardados como anexo da consulta.

O arquivo NÃO é lido nem enviado à IA (laudos trazem nome e dados do paciente): fica no
armazenamento do próprio sistema e o médico o abre quando quiser. Sem conteúdo no log.
"""

import asyncio
import contextlib
import logging
import re
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from pydantic import BaseModel

from app import repositorio, storage

logger = logging.getLogger("medconsult.laudos")
router = APIRouter(tags=["laudos"])

MAX_LAUDO = 15 * 1024 * 1024
MAX_POR_CONSULTA = 20


class LaudoOut(BaseModel):
    id: str
    nome: str
    tipo: str
    criado_em: datetime


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


def tipo_do_arquivo(dados: bytes) -> tuple[str, str, str] | None:
    """(tipo, content-type, extensão) pelos primeiros bytes; None se não for PDF nem imagem."""
    if dados.startswith(b"%PDF"):
        return "pdf", "application/pdf", "pdf"
    if dados.startswith(b"\x89PNG\r\n\x1a\n"):
        return "imagem", "image/png", "png"
    if dados.startswith(b"\xff\xd8\xff"):
        return "imagem", "image/jpeg", "jpg"
    if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return "imagem", "image/webp", "webp"
    return None


def nome_limpo(nome: str | None, extensao: str) -> str:
    base = re.sub(r"[^\w .\-()]", "", (nome or "").strip(), flags=re.UNICODE)[:100].strip()
    base = re.sub(r"\.{2,}", ".", base).lstrip(". ")  # sem '..' nem ponto inicial
    return base or f"laudo.{extensao}"


def _out(row: dict) -> LaudoOut:
    return LaudoOut(id=row["id"], nome=row["nome"], tipo=row["tipo"], criado_em=row["criado_em"])


@router.post("/session/{session_id}/laudos", response_model=LaudoOut, status_code=201)
async def enviar_laudo(session_id: str, arquivo: Annotated[UploadFile, File()]) -> LaudoOut:
    sid = _uuid(session_id)
    dados = await arquivo.read(MAX_LAUDO + 1)
    if len(dados) > MAX_LAUDO:
        raise HTTPException(status_code=413, detail="Laudo maior que 15 MB.")
    achado = tipo_do_arquivo(dados)
    if achado is None:
        raise HTTPException(status_code=415, detail="Envie o laudo em PDF ou em imagem (JPG, PNG).")
    tipo, content_type, ext = achado
    try:
        existentes = await asyncio.to_thread(repositorio.listar_laudos, sid)
    except Exception as exc:  # noqa: BLE001
        logger.error("Laudos indisponíveis: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Laudos indisponíveis no momento.") from None
    if len(existentes) >= MAX_POR_CONSULTA:
        raise HTTPException(status_code=409, detail="Limite de 20 laudos por consulta.")
    chave = f"laudos/{sid}/{uuid.uuid4()}.{ext}"
    try:
        await asyncio.to_thread(storage.upload_object, chave, dados, content_type)
        row = await asyncio.to_thread(
            repositorio.inserir_laudo,
            session_id=sid,
            nome=nome_limpo(arquivo.filename, ext),
            tipo=tipo,
            content_type=content_type,
            object_name=chave,
        )
    except Exception as exc:  # noqa: BLE001
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        logger.error("Falha ao guardar laudo: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Não foi possível guardar o laudo.") from None
    logger.info("laudo guardado id=%s tipo=%s bytes=%d", row["id"], tipo, len(dados))
    return _out(row)


@router.get("/session/{session_id}/laudos", response_model=list[LaudoOut])
async def listar(session_id: str) -> list[LaudoOut]:
    try:
        rows = await asyncio.to_thread(repositorio.listar_laudos, _uuid(session_id))
    except Exception as exc:  # noqa: BLE001
        logger.error("Laudos indisponíveis: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Laudos indisponíveis no momento.") from None
    return [_out(r) for r in rows]


@router.get("/laudos/{laudo_id}/arquivo")
async def abrir(laudo_id: str) -> Response:
    row = await asyncio.to_thread(repositorio.obter_laudo, _uuid(laudo_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Laudo não encontrado.")
    try:
        dados = await asyncio.to_thread(storage.get_object, row["object_name"])
    except Exception as exc:  # noqa: BLE001
        logger.error("Arquivo do laudo indisponível: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Laudo indisponível no momento.") from None
    return Response(
        content=dados,
        media_type=row["content_type"],
        headers={"Content-Disposition": f'inline; filename="laudo-{row["id"][:8]}"'},
    )


@router.delete("/session/{session_id}/laudos/{laudo_id}", status_code=204)
async def remover(session_id: str, laudo_id: str) -> None:
    chave = await asyncio.to_thread(repositorio.remover_laudo, _uuid(session_id), _uuid(laudo_id))
    if chave is None:
        raise HTTPException(status_code=404, detail="Laudo não encontrado.")
    with contextlib.suppress(Exception):
        await asyncio.to_thread(storage.delete_object, chave)


def cabecalhos_de_total(response: Response, devolvidos: int, total: int) -> None:
    """Avisa nas listas limitadas quantos itens existem e se a resposta foi cortada."""
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Truncado"] = "true" if total > devolvidos else "false"
