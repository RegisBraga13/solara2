"""Estado do acervo de referência (RAG). Os livros são base interna: nenhum trecho sai por aqui."""

from fastapi import APIRouter

from app import repositorio_rag
from app.config import settings

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/estado")
def estado() -> dict:
    """Diagnóstico: o que está indexado e se a OpenAI está configurada. Não chama a OpenAI."""
    try:
        contagens = repositorio_rag.contagens()
    except Exception as exc:  # noqa: BLE001
        contagens = {"erro": type(exc).__name__}
    return {
        "embeddings": {
            "ok": bool(settings.openai_api_key),
            "detalhe": None if settings.openai_api_key else "OPENAI_API_KEY vazia.",
        },
        "modelo_embedding": settings.embedding_model,
        "dimensao": settings.embedding_dim,
        "acervo": contagens,
    }
