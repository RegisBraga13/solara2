"""Ficha pré-consulta: preenchida pelo paciente (tablet no consultório, com acompanhamento).

Conteúdo por especialidade (Dermatologia tem o seu; outras entram depois, uma de cada vez — veja
`AGENTS.md`). O cadastro (nome, contato...) já existe em `pacientes`; aqui só entram os blocos
clínicos específicos da pré-consulta. `alerta_critico` é calculado no servidor a partir das
respostas de segurança clínica; o médico sempre revê — não há ação automática.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app import repositorio
from app.config import settings

logger = logging.getLogger("medconsult.pre_consulta")
router = APIRouter(tags=["pre-consulta"])


# --------------------------------------------------------------------- blocos (Dermatologia)

CategoriaQueixa = Literal[
    "rotina", "nevos", "acne", "manchas", "queda_cabelo", "unhas", "coceira", "estetica", "outro"
]
TipoAlergia = Literal["medicamentos", "cosmeticos", "latex", "niquel", "alimentos"]
Comorbidade = Literal["diabetes", "hipertensao", "tireoide", "autoimunes", "cancer", "outras"]
ProcedimentoEstetico = Literal[
    "toxina", "preenchimento", "bioestimulador", "peeling", "laser", "microagulhamento", "fios",
    "outros",
]


class QueixaPrincipal(BaseModel):
    queixa_principal: str = Field(min_length=3, max_length=2000)
    duracao_queixa: Literal["dias", "semanas", "meses", "anos"]
    ja_tratou_antes: bool
    tratamento_anterior: str = Field(default="", max_length=1000)
    categorias: list[CategoriaQueixa] = []


class HistoricoDermatologico(BaseModel):
    exposicao_solar: bool
    tipo_exposicao: Literal["trabalho", "lazer", "ambos"] | None = None
    queimadura_solar_infancia: bool
    uso_camara_bronzeamento: bool
    frequencia_protetor_solar: Literal["nunca", "as_vezes", "todo_dia"]
    fps_habitual: int | None = Field(default=None, ge=0, le=100)
    fototipo_fitzpatrick: int = Field(ge=1, le=6)
    historico_familiar_cancer_pele: bool
    quem_historico_familiar: str = Field(default="", max_length=300)
    melanoma_familiar: bool
    outras_doencas_familia: list[str] = Field(default_factory=list, max_length=20)


class SaudeGeral(BaseModel):
    alergias: bool
    tipos_alergia: list[TipoAlergia] = []
    descricao_alergia: str = Field(default="", max_length=1000)
    medicamentos_uso_continuo: bool
    lista_medicamentos: str = Field(default="", max_length=1000)
    comorbidades: list[Comorbidade] = []
    tabagismo: Literal["nunca", "ex_fumante", "fumante"]
    etilismo: Literal["nunca", "social", "frequente"]
    atividade_fisica: Literal["nenhuma", "leve", "moderada", "intensa"]
    gestante: bool | None = None
    amamentando: bool | None = None
    uso_anticoncepcional: bool | None = None


class EsteticaProcedimentos(BaseModel):
    procedimentos_anteriores: list[ProcedimentoEstetico] = []
    tempo_ultimo_procedimento: str = Field(default="", max_length=200)
    teve_complicacao: bool
    descricao_complicacao: str = Field(default="", max_length=1000)
    usa_acidos: bool
    produtos_skincare: str = Field(default="", max_length=1000)
    tratamento_em_andamento: bool


class SegurancaClinica(BaseModel):
    """Campos que, se verdadeiros, acendem o alerta crítico no prontuário."""

    historico_herpes_simples: bool
    tendencia_queloide: bool
    possui_marcapasso_ou_implante_metalico: bool
    quimica_capilar_recente: bool
    alergia_anestesico: bool
    usa_anticoagulante: bool


class Consentimento(BaseModel):
    aceite_informacoes_verdadeiras: bool
    autoriza_imagens_prontuario: bool
    autoriza_imagens_cientificas: bool = False
    aceite_lgpd: bool
    nome_assinatura: str = Field(min_length=2, max_length=200)

    @field_validator("aceite_informacoes_verdadeiras", "aceite_lgpd")
    @classmethod
    def _obrigatorio(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Este consentimento é obrigatório para enviar a ficha.")
        return v


class PreConsultaDermatologiaIn(BaseModel):
    queixa: QueixaPrincipal
    historico: HistoricoDermatologico
    saude: SaudeGeral
    estetica: EsteticaProcedimentos
    seguranca: SegurancaClinica
    consentimento: Consentimento


# Uma entrada por especialidade com ficha pronta (hoje só dermatologia; outras entram depois).
_SCHEMAS_POR_ESPECIALIDADE: dict[str, type[BaseModel]] = {
    "dermatologia": PreConsultaDermatologiaIn,
}


def _alerta_critico(corpo: BaseModel) -> bool:
    """Hoje só a Dermatologia tem o bloco de segurança; cada especialidade define o seu risco."""
    seguranca = getattr(corpo, "seguranca", None)
    if seguranca is None:
        return False
    return bool(
        seguranca.historico_herpes_simples
        or seguranca.tendencia_queloide
        or seguranca.possui_marcapasso_ou_implante_metalico
    )


class PreConsultaOut(BaseModel):
    id: str
    paciente_id: str
    especialidade: str
    respostas: dict
    alerta_critico: bool
    criado_em: datetime


def _uuid(valor: str) -> str:
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        raise HTTPException(status_code=422, detail="Identificador inválido.") from None


def _indisponivel(exc: Exception) -> HTTPException:
    logger.error("Pré-consulta indisponível: %s", type(exc).__name__)
    return HTTPException(status_code=503, detail="Pré-consulta indisponível no momento.")


@router.post(
    "/pacientes/{paciente_id}/pre-consulta", response_model=PreConsultaOut, status_code=201
)
async def preencher(paciente_id: str, corpo: dict) -> PreConsultaOut:
    pid = _uuid(paciente_id)
    especialidade = settings.especialidade
    schema = _SCHEMAS_POR_ESPECIALIDADE.get(especialidade)
    if schema is None:
        raise HTTPException(
            status_code=501, detail=f"Pré-consulta ainda não configurada para '{especialidade}'."
        )
    try:
        dados = schema.model_validate(corpo)
    except Exception as exc:  # noqa: BLE001 — erro de validação do Pydantic
        raise HTTPException(status_code=422, detail=str(exc)) from None
    try:
        cadastrado = await asyncio.to_thread(repositorio.obter_paciente, pid)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    if cadastrado is None:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    try:
        row = await asyncio.to_thread(
            repositorio.inserir_pre_consulta,
            paciente_id=pid,
            especialidade=especialidade,
            respostas=dados.model_dump(),
            alerta_critico=_alerta_critico(dados),
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    logger.info("pré-consulta registrada paciente=%s alerta=%s", pid, row["alerta_critico"])
    return PreConsultaOut(**row)


@router.get("/pacientes/{paciente_id}/pre-consulta", response_model=list[PreConsultaOut])
async def do_paciente(paciente_id: str) -> list[PreConsultaOut]:
    pid = _uuid(paciente_id)
    try:
        rows = await asyncio.to_thread(repositorio.pre_consultas_do_paciente, pid)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return [PreConsultaOut(**r) for r in rows]
