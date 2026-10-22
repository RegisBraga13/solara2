"""Atestados e declarações de comparecimento.

Identificação, data e (no atestado) o diagnóstico com CID vêm prontos da consulta; o médico só
completa o que não pode ser automático (dias de afastamento, período de comparecimento). O PDF é
gerado no aparelho do médico e enviado já pronto, igual à receita — mesmo registro legal: não há
edição nem exclusão, corrigir é emitir outro documento. Tabela única `documentos`, discriminada
por `tipo`, para não duplicar o boilerplate de paciente/médico/PDF que a receita já tem sozinha.
"""

import asyncio
import contextlib
import logging
import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel

from app import repositorio, storage

logger = logging.getLogger("medconsult.documentos")
router = APIRouter(tags=["documentos"])

MAX_PDF = 5 * 1024 * 1024
TipoDocumento = Literal["atestado", "declaracao_comparecimento"]
NOME_ARQUIVO: dict[str, str] = {"atestado": "atestado", "declaracao_comparecimento": "declaracao"}


class DocumentoOut(BaseModel):
    id: str
    tipo: TipoDocumento
    paciente_id: str | None = None
    session_id: str | None = None
    paciente: str
    conteudo: dict[str, Any]
    medico_nome: str
    medico_crm: str
    criado_em: datetime


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


def _data(valor: str, campo: str) -> str:
    try:
        return date.fromisoformat(valor).isoformat()
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{campo} inválida.") from None


def _hora(valor: str, campo: str) -> str:
    try:
        datetime.strptime(valor, "%H:%M")  # noqa: DTZ007
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{campo} inválido.") from None
    return valor


def _saida(row: dict) -> DocumentoOut:
    return DocumentoOut(**{k: v for k, v in row.items() if k != "pdf_object_name"})


async def _emitir(
    *,
    tipo: TipoDocumento,
    conteudo: dict[str, Any],
    pdf: UploadFile,
    medico_nome: str,
    medico_crm: str,
    paciente: str,
    paciente_id: str,
    session_id: str,
) -> DocumentoOut:
    pid = _uuid(paciente_id) if paciente_id else None
    sid = _uuid(session_id) if session_id else None
    if pid is not None:
        cadastrado = await asyncio.to_thread(repositorio.obter_paciente, pid)
        if cadastrado is None:
            raise HTTPException(status_code=422, detail="Paciente não cadastrado.")
        paciente = cadastrado["nome"]
    if not paciente.strip():
        raise HTTPException(status_code=422, detail="Documento sem paciente.")
    dados = await pdf.read(MAX_PDF + 1)
    if len(dados) > MAX_PDF:
        raise HTTPException(status_code=413, detail="PDF maior que 5 MB.")
    if not dados.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="O arquivo não é um PDF.")
    chave = f"documentos/{uuid.uuid4()}.pdf"
    try:
        await asyncio.to_thread(storage.upload_object, chave, dados, "application/pdf")
        row = await asyncio.to_thread(
            repositorio.inserir_documento,
            tipo=tipo,
            paciente_id=pid,
            session_id=sid,
            paciente=paciente.strip(),
            conteudo=conteudo,
            medico_nome=" ".join(medico_nome.split()),
            medico_crm=" ".join(medico_crm.split()),
            pdf_object_name=chave,
        )
    except Exception as exc:  # noqa: BLE001
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        logger.error("Falha ao emitir documento tipo=%s: %s", tipo, type(exc).__name__)
        raise HTTPException(status_code=503, detail="Não foi possível salvar o documento.") from None
    logger.info("documento emitido id=%s tipo=%s", row["id"], tipo)
    return _saida(row)


@router.post("/atestados", response_model=DocumentoOut, status_code=201)
async def emitir_atestado(
    pdf: Annotated[UploadFile, File()],
    medico_nome: Annotated[str, Form(min_length=3, max_length=200)],
    medico_crm: Annotated[str, Form(min_length=3, max_length=40)],
    dias_afastamento: Annotated[int, Form(ge=1, le=365)],
    data_inicial: Annotated[str, Form()],
    cidade: Annotated[str, Form(min_length=2, max_length=100)],
    cid: Annotated[str, Form(max_length=10)] = "",
    paciente: Annotated[str, Form(max_length=200)] = "",
    paciente_id: Annotated[str, Form()] = "",
    session_id: Annotated[str, Form()] = "",
) -> DocumentoOut:
    conteudo = {
        "dias_afastamento": dias_afastamento,
        "data_inicial": _data(data_inicial, "Data inicial"),
        "cidade": " ".join(cidade.split()),
        "cid": cid.strip().upper() or None,
    }
    return await _emitir(
        tipo="atestado",
        conteudo=conteudo,
        pdf=pdf,
        medico_nome=medico_nome,
        medico_crm=medico_crm,
        paciente=paciente,
        paciente_id=paciente_id,
        session_id=session_id,
    )


@router.post("/declaracoes", response_model=DocumentoOut, status_code=201)
async def emitir_declaracao(
    pdf: Annotated[UploadFile, File()],
    medico_nome: Annotated[str, Form(min_length=3, max_length=200)],
    medico_crm: Annotated[str, Form(min_length=3, max_length=40)],
    data: Annotated[str, Form()],
    hora_inicio: Annotated[str, Form()],
    hora_fim: Annotated[str, Form()],
    cidade: Annotated[str, Form(min_length=2, max_length=100)],
    paciente: Annotated[str, Form(max_length=200)] = "",
    paciente_id: Annotated[str, Form()] = "",
    session_id: Annotated[str, Form()] = "",
) -> DocumentoOut:
    conteudo = {
        "data": _data(data, "Data"),
        "hora_inicio": _hora(hora_inicio, "Hora de início"),
        "hora_fim": _hora(hora_fim, "Hora de fim"),
        "cidade": " ".join(cidade.split()),
    }
    return await _emitir(
        tipo="declaracao_comparecimento",
        conteudo=conteudo,
        pdf=pdf,
        medico_nome=medico_nome,
        medico_crm=medico_crm,
        paciente=paciente,
        paciente_id=paciente_id,
        session_id=session_id,
    )


@router.get("/pacientes/{paciente_id}/atestados", response_model=list[DocumentoOut])
async def atestados_do_paciente(paciente_id: str) -> list[DocumentoOut]:
    rows = await asyncio.to_thread(repositorio.documentos_do_paciente, _uuid(paciente_id), "atestado")
    return [_saida(r) for r in rows]


@router.get("/pacientes/{paciente_id}/declaracoes", response_model=list[DocumentoOut])
async def declaracoes_do_paciente(paciente_id: str) -> list[DocumentoOut]:
    rows = await asyncio.to_thread(
        repositorio.documentos_do_paciente, _uuid(paciente_id), "declaracao_comparecimento"
    )
    return [_saida(r) for r in rows]


@router.get("/documentos/{documento_id}/pdf")
async def baixar_pdf(documento_id: str) -> Response:
    row = await asyncio.to_thread(repositorio.obter_documento, _uuid(documento_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    try:
        dados = await asyncio.to_thread(storage.get_object, row["pdf_object_name"])
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF do documento indisponível: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="PDF indisponível no momento.") from None
    nome = NOME_ARQUIVO.get(row["tipo"], "documento")
    return Response(
        content=dados,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{nome}-{row["id"][:8]}.pdf"'},
    )
