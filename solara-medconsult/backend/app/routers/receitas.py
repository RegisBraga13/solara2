"""Receitas: preenchidas à mão pelo médico (nada é sugerido nem gerado por IA).

O PDF é gerado no aparelho do médico e enviado junto com os itens. Receita é registro legal:
não há edição nem exclusão; corrigir é emitir outra. O PDF aqui é documento de apoio, SEM
assinatura digital ICP-Brasil (a validade legal de receita controlada depende de sistema próprio).
Itens e nome do paciente ficam só no banco local; nada disso vai para o log.
"""

import asyncio
import contextlib
import json
import logging
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, ValidationError, field_validator

from app import repositorio, storage

logger = logging.getLogger("medconsult.receitas")
router = APIRouter(tags=["receitas"])

MAX_PDF = 5 * 1024 * 1024
MAX_ITENS = 20


class ItemReceita(BaseModel):
    medicamento: str = Field(min_length=2, max_length=200)
    posologia: str = Field(min_length=2, max_length=500)
    duracao: str = Field(default="", max_length=100)
    quantidade: str = Field(default="", max_length=100)

    @field_validator("medicamento", "posologia", "duracao", "quantidade")
    @classmethod
    def _limpar(cls, v: str) -> str:
        return " ".join(v.split())


class ReceitaOut(BaseModel):
    id: str
    paciente_id: str | None = None
    session_id: str | None = None
    paciente: str
    itens: list[ItemReceita]
    observacoes: str
    medico_nome: str
    medico_crm: str
    criado_em: datetime


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


def _saida(row: dict) -> ReceitaOut:
    return ReceitaOut(**{k: v for k, v in row.items() if k != "pdf_object_name"})


@router.post("/receitas", response_model=ReceitaOut, status_code=201)
async def emitir(
    itens: Annotated[str, Form(max_length=20_000)],
    pdf: Annotated[UploadFile, File()],
    medico_nome: Annotated[str, Form(min_length=3, max_length=200)],
    medico_crm: Annotated[str, Form(min_length=3, max_length=40)],
    paciente: Annotated[str, Form(max_length=200)] = "",
    paciente_id: Annotated[str, Form()] = "",
    session_id: Annotated[str, Form()] = "",
    observacoes: Annotated[str, Form(max_length=2000)] = "",
) -> ReceitaOut:
    try:
        lista = [ItemReceita.model_validate(x) for x in json.loads(itens)]
    except (ValueError, ValidationError, TypeError):
        raise HTTPException(status_code=422, detail="Itens da receita inválidos.") from None
    if not 1 <= len(lista) <= MAX_ITENS:
        raise HTTPException(status_code=422, detail=f"A receita precisa de 1 a {MAX_ITENS} itens.")
    pid = _uuid(paciente_id) if paciente_id else None
    sid = _uuid(session_id) if session_id else None
    if pid is not None:
        cadastrado = await asyncio.to_thread(repositorio.obter_paciente, pid)
        if cadastrado is None:
            raise HTTPException(status_code=422, detail="Paciente não cadastrado.")
        paciente = cadastrado["nome"]
    if not paciente.strip():
        raise HTTPException(status_code=422, detail="Receita sem paciente.")
    dados = await pdf.read(MAX_PDF + 1)
    if len(dados) > MAX_PDF:
        raise HTTPException(status_code=413, detail="PDF maior que 5 MB.")
    if not dados.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="O arquivo não é um PDF.")
    chave = f"receitas/{uuid.uuid4()}.pdf"
    try:
        await asyncio.to_thread(storage.upload_object, chave, dados, "application/pdf")
        row = await asyncio.to_thread(
            repositorio.inserir_receita,
            paciente_id=pid,
            session_id=sid,
            paciente=paciente.strip(),
            itens=[i.model_dump() for i in lista],
            observacoes=observacoes.strip(),
            medico_nome=" ".join(medico_nome.split()),
            medico_crm=" ".join(medico_crm.split()),
            pdf_object_name=chave,
        )
    except Exception as exc:  # noqa: BLE001
        with contextlib.suppress(Exception):
            await asyncio.to_thread(storage.delete_object, chave)
        logger.error("Falha ao emitir receita: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Não foi possível salvar a receita.") from None
    logger.info("receita emitida id=%s itens=%d", row["id"], len(lista))
    return _saida(row)


@router.get("/pacientes/{paciente_id}/receitas", response_model=list[ReceitaOut])
async def do_paciente(paciente_id: str) -> list[ReceitaOut]:
    rows = await asyncio.to_thread(repositorio.receitas_do_paciente, _uuid(paciente_id))
    return [_saida(r) for r in rows]


@router.get("/receitas/{receita_id}/pdf")
async def baixar_pdf(receita_id: str) -> Response:
    row = await asyncio.to_thread(repositorio.obter_receita, _uuid(receita_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Receita não encontrada.")
    try:
        dados = await asyncio.to_thread(storage.get_object, row["pdf_object_name"])
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF da receita indisponível: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="PDF indisponível no momento.") from None
    return Response(
        content=dados,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receita-{row["id"][:8]}.pdf"'},
    )
