"""Prontuários registrados: texto + PDF, guardados para o médico reabrir depois.

O PDF é gerado no aparelho do médico e enviado aqui junto com o texto. O PDF é servido pelo
próprio backend (não por URL do armazenamento), para abrir também em outro aparelho (iPad).
Dados clínicos e nome do paciente ficam no banco e no armazenamento: é o prontuário em si.
Nada de conteúdo clínico vai para o log.
"""

import asyncio
import contextlib
import logging
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel

from app import repositorio, storage
from app.routers.laudos import LaudoOut, cabecalhos_de_total

logger = logging.getLogger("medconsult.prontuarios")
router = APIRouter(tags=["prontuarios"])

MAX_PDF = 15 * 1024 * 1024
MAX_TEXTO = 100_000


class ProntuarioResumo(BaseModel):
    id: str
    paciente: str
    paciente_id: str | None = None
    modo: str
    tipo: str = "nova"
    criado_em: datetime


class ProntuarioOut(ProntuarioResumo):
    texto: str
    laudos: list[LaudoOut] = []


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


@router.post("/prontuarios", response_model=ProntuarioResumo, status_code=201)
async def registrar(
    texto: Annotated[str, Form(max_length=MAX_TEXTO)],
    pdf: Annotated[UploadFile, File()],
    paciente: Annotated[str, Form(max_length=200)] = "",
    modo: Annotated[str, Form(max_length=20)] = "",
    session_id: Annotated[str, Form()] = "",
    paciente_id: Annotated[str, Form()] = "",
    tipo: Annotated[Literal["nova", "retorno"], Form()] = "nova",
    retorno_de: Annotated[str, Form()] = "",
) -> ProntuarioResumo:
    if not texto.strip():
        raise HTTPException(status_code=422, detail="Prontuário vazio.")
    sid = _uuid(session_id) if session_id else None
    pid = _uuid(paciente_id) if paciente_id else None
    ret = _uuid(retorno_de) if retorno_de else None
    if tipo == "retorno" and ret is None:
        raise HTTPException(status_code=422, detail="Retorno precisa indicar a consulta anterior.")
    if pid is not None:
        cadastrado = await asyncio.to_thread(repositorio.obter_paciente, pid)
        if cadastrado is None:
            raise HTTPException(status_code=422, detail="Paciente não cadastrado.")
        paciente = cadastrado["nome"]  # o nome cadastrado vale mais que o digitado
    dados = await pdf.read(MAX_PDF + 1)
    if len(dados) > MAX_PDF:
        raise HTTPException(status_code=413, detail="PDF maior que 15 MB.")
    if not dados.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="O arquivo não é um PDF.")
    chave = f"prontuarios/{uuid.uuid4()}.pdf"
    try:
        await asyncio.to_thread(storage.upload_object, chave, dados, "application/pdf")
        row = await asyncio.to_thread(
            repositorio.inserir_prontuario,
            session_id=sid,
            paciente=paciente.strip(),
            modo=modo.strip(),
            texto=texto,
            pdf_object_name=chave,
            paciente_id=pid,
            tipo=tipo,
            retorno_de=ret,
        )
    except Exception as exc:  # noqa: BLE001
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        logger.error("Falha ao registrar prontuário: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503, detail="Não foi possível salvar o prontuário."
        ) from None
    logger.info("prontuario registrado id=%s bytes_pdf=%d", row["id"], len(dados))
    return ProntuarioResumo(**row)


@router.put("/prontuarios/{prontuario_id}", response_model=ProntuarioResumo)
async def corrigir(
    prontuario_id: str,
    texto: Annotated[str, Form(max_length=MAX_TEXTO)],
    pdf: Annotated[UploadFile, File()],
) -> ProntuarioResumo:
    """Correção de erros pelo médico: troca o texto e o PDF; o resto do registro não muda."""
    pid = _uuid(prontuario_id)
    if not texto.strip():
        raise HTTPException(status_code=422, detail="Prontuário vazio.")
    dados = await pdf.read(MAX_PDF + 1)
    if len(dados) > MAX_PDF:
        raise HTTPException(status_code=413, detail="PDF maior que 15 MB.")
    if not dados.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="O arquivo não é um PDF.")
    chave = f"prontuarios/{uuid.uuid4()}.pdf"
    try:
        await asyncio.to_thread(storage.upload_object, chave, dados, "application/pdf")
        antigo = await asyncio.to_thread(
            repositorio.corrigir_prontuario, pid, texto=texto, pdf_object_name=chave
        )
    except Exception as exc:  # noqa: BLE001
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        logger.error("Falha ao corrigir prontuário: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Não foi possível salvar a correção.") from None
    if antigo is None:
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        raise HTTPException(status_code=404, detail="Prontuário não encontrado.")
    with contextlib.suppress(Exception):
        await asyncio.to_thread(storage.delete_object, antigo)
    row = await asyncio.to_thread(repositorio.obter_prontuario, pid)
    logger.info("prontuario corrigido id=%s bytes_pdf=%d", pid, len(dados))
    return ProntuarioResumo(**row)


@router.get("/prontuarios", response_model=list[ProntuarioResumo])
async def listar(response: Response) -> list[ProntuarioResumo]:
    try:
        rows = await asyncio.to_thread(repositorio.listar_prontuarios)
        total = len(rows)
        if total >= repositorio.LIMITE_LISTA:  # pode haver mais: só então conta
            total = await asyncio.to_thread(repositorio.contar_prontuarios)
    except Exception as exc:  # noqa: BLE001
        logger.error("Falha ao listar prontuários: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503, detail="Prontuários indisponíveis no momento."
        ) from None
    cabecalhos_de_total(response, len(rows), total)
    return [ProntuarioResumo(**r) for r in rows]


@router.get("/prontuarios/{prontuario_id}", response_model=ProntuarioOut)
async def abrir(prontuario_id: str) -> ProntuarioOut:
    row = await asyncio.to_thread(repositorio.obter_prontuario, _uuid(prontuario_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado.")
    laudos: list[LaudoOut] = []
    if row.get("session_id"):
        with contextlib.suppress(Exception):
            achados = await asyncio.to_thread(repositorio.listar_laudos, row["session_id"])
            laudos = [
                LaudoOut(id=x["id"], nome=x["nome"], tipo=x["tipo"], criado_em=x["criado_em"])
                for x in achados
            ]
    return ProntuarioOut(**row, laudos=laudos)


@router.get("/prontuarios/{prontuario_id}/pdf")
async def baixar_pdf(prontuario_id: str) -> Response:
    row = await asyncio.to_thread(repositorio.obter_prontuario, _uuid(prontuario_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado.")
    try:
        dados = await asyncio.to_thread(storage.get_object, row["pdf_object_name"])
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF indisponível: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="PDF indisponível no momento.") from None
    return Response(
        content=dados,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="prontuario-{row["id"][:8]}.pdf"'},
    )


@router.delete("/prontuarios/{prontuario_id}", status_code=204)
async def excluir(prontuario_id: str) -> None:
    chave = await asyncio.to_thread(repositorio.remover_prontuario, _uuid(prontuario_id))
    if chave is None:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado.")
    with contextlib.suppress(Exception):
        await asyncio.to_thread(storage.delete_object, chave)
