"""Busca direta nos vector stores da OpenAI (acervo e diretrizes já indexados na nuvem).

Usado quando `OPENAI_RAG_VECTOR_STORE_ID` / `OPENAI_DIRETRIZES_VECTOR_STORE_ID` estão definidos
(hoje: a Psiquiatria, reaproveitando o projeto PSIQUIATRIA). Só RECUPERA trechos; o texto vai ao
modelo como contexto interno e nunca é mostrado ao médico. A consulta não leva identificadores.
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.motores.embeddings import EmbeddingIndisponivel, _post

logger = logging.getLogger("medconsult.rag")


@dataclass(frozen=True)
class TrechoNuvem:
    file_id: str
    arquivo: str
    texto: str
    pontuacao: float
    atributos: dict[str, Any]


def buscar(
    store_id: str,
    consulta: str,
    *,
    k: int = 8,
    escopos: tuple[str, ...] | None = None,
) -> list[TrechoNuvem]:
    """Trechos do vector store acima do corte de relevância, na ordem da OpenAI.

    `escopos` filtra pelo atributo `escopo` (gênero do livro). `rewrite_query` fica desligado: a
    reescrita é não determinística (a mesma consulta trazia 8 trechos numa rodada e 0 noutra).
    """
    corpo: dict[str, Any] = {"query": consulta, "max_num_results": k, "rewrite_query": False}
    if escopos:
        corpo["filters"] = {
            "type": "or",
            "filters": [{"type": "eq", "key": "escopo", "value": e} for e in escopos],
        }
    dados = _post(f"vector_stores/{store_id}/search", corpo)
    trechos: list[TrechoNuvem] = []
    for item in dados.get("data", []):
        pontuacao = float(item.get("score") or 0)
        if pontuacao < settings.rag_nuvem_score_min:
            continue
        texto = "\n".join(
            p.get("text", "").strip() for p in item.get("content", []) if p.get("text")
        ).strip()
        if not texto:
            continue
        trechos.append(
            TrechoNuvem(
                file_id=item.get("file_id", ""),
                arquivo=item.get("filename", ""),
                texto=texto,
                pontuacao=round(pontuacao, 4),
                atributos=item.get("attributes") or {},
            )
        )
    logger.info("nuvem.buscar resultados=%d escopos=%s", len(trechos), list(escopos or ()))
    return trechos


__all__ = ["EmbeddingIndisponivel", "TrechoNuvem", "buscar"]
