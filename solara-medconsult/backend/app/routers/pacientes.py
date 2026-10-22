"""Pacientes: cadastro simples (nome e nascimento) e o histórico de consultas de cada um.

É o ponto de partida de "Nova consulta" e "Retorno". Dados pessoais ficam no banco do próprio
sistema; nada vai para a OpenAI nem para o log.
"""

import asyncio
import logging
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from app import repositorio
from app.routers.laudos import LaudoOut, cabecalhos_de_total

logger = logging.getLogger("medconsult.pacientes")
router = APIRouter(tags=["pacientes"])


def cpf_valido(digitos: str) -> bool:
    """11 dígitos com os dois dígitos verificadores corretos."""
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False
    for tam in (9, 10):
        soma = sum(int(d) * p for d, p in zip(digitos[:tam], range(tam + 1, 1, -1), strict=True))
        if int(digitos[tam]) != (soma * 10 % 11) % 10:
            return False
    return True


class FichaIn(BaseModel):
    """Dados opcionais do cadastro. Ficam só no banco local; nunca vão à IA."""

    cpf: str | None = Field(default=None, max_length=20)
    sexo: str | None = Field(default=None, max_length=30)
    contato: str | None = Field(default=None, max_length=120)
    profissao: str | None = Field(default=None, max_length=120)
    moradia: str | None = Field(default=None, max_length=200)
    plano_saude: str | None = Field(default=None, max_length=120)
    historico_familiar: str | None = Field(default=None, max_length=2000)
    medicacoes_uso: str | None = Field(default=None, max_length=2000)
    alergias: str | None = Field(default=None, max_length=2000)

    @field_validator("*", mode="before")
    @classmethod
    def _vazio_vira_nulo(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("cpf")
    @classmethod
    def _cpf(cls, v: str | None) -> str | None:
        if v is None:
            return None
        digitos = "".join(c for c in v if c.isdigit())
        if not cpf_valido(digitos):
            raise ValueError("CPF inválido.")
        return digitos


class PacienteIn(FichaIn):
    nome: str = Field(min_length=2, max_length=120)
    nascimento: date | None = None

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Nome muito curto.")
        return v

    @field_validator("nascimento")
    @classmethod
    def _nascimento(cls, v: date | None) -> date | None:
        if v is not None and not (date(1900, 1, 1) <= v <= date.today()):
            raise ValueError("Data de nascimento inválida.")
        return v


class PacienteOut(BaseModel):
    id: str
    nome: str
    nascimento: date | None = None
    n_prontuarios: int = 0
    ultima_consulta: datetime | None = None


class ConsultaResumo(BaseModel):
    id: str
    modo: str
    tipo: str
    criado_em: datetime


class PacienteDetalhe(PacienteOut, FichaIn):
    consultas: list[ConsultaResumo]


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


def _indisponivel(exc: Exception) -> HTTPException:
    logger.error("Pacientes indisponível: %s", type(exc).__name__)
    return HTTPException(status_code=503, detail="Pacientes indisponíveis no momento.")


def _dados(corpo: PacienteIn) -> dict[str, str | None]:
    return corpo.model_dump(include=set(repositorio.CAMPOS_FICHA))


def _cpf_repetido() -> HTTPException:
    return HTTPException(status_code=409, detail="Já existe um paciente com este CPF.")


@router.post("/pacientes", response_model=PacienteOut, status_code=201)
async def cadastrar(corpo: PacienteIn) -> PacienteOut:
    try:
        row = await asyncio.to_thread(
            repositorio.inserir_paciente,
            nome=corpo.nome,
            nascimento=corpo.nascimento,
            dados=_dados(corpo),
        )
    except repositorio.CpfDuplicado:
        raise _cpf_repetido() from None
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return PacienteOut(**row)


@router.put("/pacientes/{paciente_id}", response_model=PacienteOut)
async def corrigir(paciente_id: str, corpo: PacienteIn) -> PacienteOut:
    """Corrige o cadastro (substitui todos os campos)."""
    pid = _uuid(paciente_id)
    try:
        row = await asyncio.to_thread(
            repositorio.atualizar_paciente,
            pid,
            nome=corpo.nome,
            nascimento=corpo.nascimento,
            dados=_dados(corpo),
        )
    except repositorio.CpfDuplicado:
        raise _cpf_repetido() from None
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return PacienteOut(**row)


@router.get("/pacientes", response_model=list[PacienteOut])
async def listar(
    response: Response, q: Annotated[str | None, Query(max_length=80)] = None
) -> list[PacienteOut]:
    try:
        rows = await asyncio.to_thread(repositorio.listar_pacientes, q)
        total = len(rows)
        if total >= repositorio.LIMITE_LISTA:  # pode haver mais: só então conta
            total = await asyncio.to_thread(repositorio.contar_pacientes, q)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    cabecalhos_de_total(response, len(rows), total)
    return [PacienteOut(**r) for r in rows]


@router.get("/pacientes/{paciente_id}", response_model=PacienteDetalhe)
async def abrir(paciente_id: str) -> PacienteDetalhe:
    pid = _uuid(paciente_id)
    try:
        p = await asyncio.to_thread(repositorio.obter_paciente, pid)
        consultas = await asyncio.to_thread(repositorio.listar_prontuarios_do_paciente, pid)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    if p is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return PacienteDetalhe(
        **p,
        n_prontuarios=len(consultas),
        ultima_consulta=consultas[0]["criado_em"] if consultas else None,
        consultas=[ConsultaResumo(**c) for c in consultas],
    )


class RegistroProntuario(BaseModel):
    id: str
    rotulo: str  # "Consulta 1", "Retorno 1", "Consulta 2"...
    tipo: str
    modo: str
    criado_em: datetime
    corrigido_em: datetime | None = None
    texto: str
    laudos: list[LaudoOut] = []


class ProntuarioDoPaciente(BaseModel):
    paciente: PacienteDetalhe
    registros: list[RegistroProntuario]  # do mais antigo para o mais recente


def rotular(registros: list[dict]) -> list[str]:
    """ "Consulta 1", "Retorno 1", "Consulta 2"... cada tipo conta separado."""
    contagem = {"nova": 0, "retorno": 0}
    nomes = []
    for r in registros:
        tipo = "retorno" if r["tipo"] == "retorno" else "nova"
        contagem[tipo] += 1
        nomes.append(f"{'Retorno' if tipo == 'retorno' else 'Consulta'} {contagem[tipo]}")
    return nomes


@router.get("/pacientes/{paciente_id}/prontuario", response_model=ProntuarioDoPaciente)
async def prontuario_cronologico(paciente_id: str) -> ProntuarioDoPaciente:
    pid = _uuid(paciente_id)
    try:
        p = await asyncio.to_thread(repositorio.obter_paciente, pid)
        regs = await asyncio.to_thread(repositorio.prontuario_do_paciente, pid)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    if p is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    consultas = sorted(regs, key=lambda r: r["criado_em"], reverse=True)
    detalhe = PacienteDetalhe(
        **p,
        n_prontuarios=len(regs),
        ultima_consulta=consultas[0]["criado_em"] if consultas else None,
        consultas=[ConsultaResumo(**c) for c in consultas],
    )
    laudos = await asyncio.to_thread(_laudos_por_registro, regs)
    return ProntuarioDoPaciente(
        paciente=detalhe,
        registros=[
            RegistroProntuario(
                rotulo=nome,
                laudos=laudos.get(r["id"], []),
                **{k: r.get(k) for k in CAMPOS_REGISTRO},
            )
            for nome, r in zip(rotular(regs), regs, strict=True)
        ],
    )


CAMPOS_REGISTRO = ("id", "tipo", "modo", "criado_em", "corrigido_em", "texto")


def _laudos_por_registro(regs: list[dict]) -> dict[str, list[LaudoOut]]:
    """Laudos de cada registro (pela sessão da consulta). Falha aqui não derruba o histórico."""
    sessoes = [r["session_id"] for r in regs if r.get("session_id")]
    try:
        por_sessao = repositorio.listar_laudos_de_sessoes(sessoes)
    except Exception:  # noqa: BLE001
        return {}
    saida: dict[str, list[LaudoOut]] = {}
    for r in regs:
        rows = por_sessao.get(str(r.get("session_id")))
        if not rows:
            continue
        saida[r["id"]] = [
            LaudoOut(id=x["id"], nome=x["nome"], tipo=x["tipo"], criado_em=x["criado_em"])
            for x in rows
        ]
    return saida
