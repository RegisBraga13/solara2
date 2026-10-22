"""Geradores de apoio ao médico: história, diagnóstico, propedêutica e orientações.

São lembretes e facilidades para o médico; o diagnóstico é dele. NADA é gerado sem pedido explícito.
A resposta traz SÓ a informação pedida (diagnósticos com %, itens por seção, texto da história):
sem avisos, origem, trechos, páginas, links nem citações. Nada é guardado aqui. O texto enviado vai
à OpenAI: não inclua nome nem identificadores do paciente.
"""

import logging
from typing import Literal, Self

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.motores import anamnese_pendencias as motor_pendencias
from app.motores import conduta_tratamento as motor_conduta
from app.motores import diagnostico as motor_diagnostico
from app.motores import historia as motor_historia
from app.motores import orientacoes as motor_orientacoes
from app.motores import propedeutica as motor_propedeutica
from app.motores.embeddings import OpenAIEmbedder, OpenAIReranker
from app.motores.listas import Fonte, Sugestao

logger = logging.getLogger("medconsult.sugestoes")
router = APIRouter(tags=["sugestoes"])

MAX_CASO = 6000
MAX_REGISTRO = 20000
# Texto colado manualmente pelo médico (ex.: da OpenEvidence) — não é buscado pelo servidor.
MAX_COLADO = 8000


class RegistroIn(BaseModel):
    registro: str = Field(min_length=1, max_length=MAX_REGISTRO)


class HistoriaOut(BaseModel):
    historia: str


class TopicoPendenteOut(BaseModel):
    topico: str
    pergunta_sugerida: str


class RedFlagOut(BaseModel):
    sinal: str
    estado: motor_pendencias.EstadoRedFlag


class PendenciasOut(BaseModel):
    pendentes: list[TopicoPendenteOut]
    red_flags: list[RedFlagOut]


def _precisa_fonte_ou_colado(self: Self) -> Self:
    if not self.fontes and not self.colado.strip():
        raise ValueError("escolha uma fonte ou cole um material")
    return self


class CasoIn(BaseModel):
    caso: str = Field(min_length=1, max_length=MAX_CASO)
    # Fontes escolhidas pelo médico. Sem Diretrizes aqui. Pode vir vazia se houver `colado`.
    fontes: list[Literal["AI", "RAG", "Web"]] = []
    # Texto colado manualmente da OpenEvidence ("Open"); não é buscado pelo servidor.
    colado: str = Field(default="", max_length=MAX_COLADO)

    _precisa_fonte_ou_colado = model_validator(mode="after")(_precisa_fonte_ou_colado)


class DiagnosticoIn(BaseModel):
    diagnostico: str = Field(min_length=2, max_length=160)
    fontes: list[Fonte] = []
    colado: str = Field(default="", max_length=MAX_COLADO)

    _precisa_fonte_ou_colado = model_validator(mode="after")(_precisa_fonte_ou_colado)


class DiagnosticosOut(BaseModel):
    diagnosticos: list[str]
    # Estimativa da IA em %, na mesma ordem. Soma no máximo 100.
    probabilidades: list[int]
    # Código CID-11 de cada diagnóstico, na mesma ordem.
    cid11: list[str]


class CondutaTratamentoOut(BaseModel):
    texto: str


class ItemOut(BaseModel):
    termo: str
    secao: str


class ListaOut(BaseModel):
    itens: list[ItemOut]


def _indisponivel(exc: Exception) -> HTTPException:
    logger.warning("Sugestão indisponível: %s", type(exc).__name__)
    return HTTPException(status_code=503, detail="Sugestões indisponíveis no momento.")


def _lista(s: Sugestao) -> ListaOut:
    itens = [ItemOut(termo=i.termo, secao=i.secao) for i in s.itens]  # sem a origem de cada item
    return ListaOut(itens=itens)


@router.post("/historia/gerar", response_model=HistoriaOut)
def gerar_historia(corpo: RegistroIn) -> HistoriaOut:
    if not corpo.registro.strip():
        raise HTTPException(status_code=422, detail="Registro vazio.")
    try:
        r = motor_historia.gerar_historia(corpo.registro)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return HistoriaOut(historia=r.historia)


@router.post("/anamnese/pendencias", response_model=PendenciasOut)
def verificar_pendencias(corpo: RegistroIn) -> PendenciasOut:
    if not corpo.registro.strip():
        raise HTTPException(status_code=422, detail="Registro vazio.")
    try:
        r = motor_pendencias.verificar_pendencias(corpo.registro)
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    pendentes = [
        TopicoPendenteOut(topico=p.topico, pergunta_sugerida=p.pergunta_sugerida)
        for p in r.pendentes
    ]
    red_flags = [RedFlagOut(sinal=f.sinal, estado=f.estado) for f in r.red_flags]
    return PendenciasOut(pendentes=pendentes, red_flags=red_flags)


@router.post("/diagnostico/sugerir", response_model=DiagnosticosOut)
def sugerir_diagnosticos(corpo: CasoIn) -> DiagnosticosOut:
    if not corpo.caso.strip():
        raise HTTPException(status_code=422, detail="Caso vazio.")
    try:
        s = motor_diagnostico.sugerir_diagnosticos(
            corpo.caso,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
            colado=corpo.colado,
        )
    except Exception as exc:  # noqa: BLE001  (banco fora do ar etc.)
        raise _indisponivel(exc) from exc
    return DiagnosticosOut(
        diagnosticos=s.diagnosticos, probabilidades=s.probabilidades, cid11=s.cid11
    )


@router.post("/conduta/gerar", response_model=CondutaTratamentoOut)
def gerar_conduta(corpo: DiagnosticoIn) -> CondutaTratamentoOut:
    try:
        r = motor_conduta.gerar_conduta(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
            colado=corpo.colado,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return CondutaTratamentoOut(texto=r.texto)


@router.post("/investigacao/gerar", response_model=CondutaTratamentoOut)
def gerar_investigacao(corpo: DiagnosticoIn) -> CondutaTratamentoOut:
    try:
        r = motor_conduta.gerar_investigacao(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
            colado=corpo.colado,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return CondutaTratamentoOut(texto=r.texto)


@router.post("/tratamento/gerar", response_model=CondutaTratamentoOut)
def gerar_tratamento(corpo: DiagnosticoIn) -> CondutaTratamentoOut:
    try:
        r = motor_conduta.gerar_tratamento(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
            colado=corpo.colado,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return CondutaTratamentoOut(texto=r.texto)


@router.post("/orientacoes/gerar", response_model=CondutaTratamentoOut)
def gerar_orientacoes_texto(corpo: DiagnosticoIn) -> CondutaTratamentoOut:
    try:
        r = motor_conduta.gerar_orientacoes(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
            colado=corpo.colado,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return CondutaTratamentoOut(texto=r.texto)


@router.post("/propedeutica/sugerir", response_model=ListaOut)
def sugerir_propedeutica(corpo: DiagnosticoIn) -> ListaOut:
    try:
        s = motor_propedeutica.sugerir_propedeutica(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return _lista(s)


@router.post("/orientacoes/sugerir", response_model=ListaOut)
def sugerir_orientacoes(corpo: DiagnosticoIn) -> ListaOut:
    try:
        s = motor_orientacoes.sugerir_orientacoes(
            corpo.diagnostico,
            embedder=OpenAIEmbedder(),
            reranker=OpenAIReranker(),
            fontes=corpo.fontes,
        )
    except Exception as exc:  # noqa: BLE001
        raise _indisponivel(exc) from exc
    return _lista(s)
