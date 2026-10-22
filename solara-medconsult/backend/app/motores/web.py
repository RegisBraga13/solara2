"""Fonte "Web": busca com a ferramenta web_search da OpenAI, restrita a domínios confiáveis.

O resultado é só CONTEXTO INTERNO para os geradores (como os trechos do RAG): nunca é devolvido
ao médico com links, trechos ou citações. A consulta deve ir sem identificadores do paciente.
"""

import re

from app.config import settings
from app.especialidades import atual
from app.motores.embeddings import EmbeddingIndisponivel, _post

MAX_CHARS = 6000

INSTRUCAO = (
    "Pesquise nas fontes permitidas (pode buscar em inglês e em português) e resuma, em português "
    "e em tópicos curtos, o que elas dizem sobre o pedido abaixo. Cite só nomes de condutas, "
    "exames e tratamentos, sem doses. Não invente: se realmente não achar nada, responda apenas "
    "'sem resultados'.\n\nPEDIDO: "
)


def _sem_links(texto: str) -> str:
    texto = re.sub(r"\(\[[^\]]*\]\([^)]*\)\)", "", texto)  # ([fonte](url))
    texto = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", texto)  # [texto](url) -> texto
    texto = re.sub(r"https?://\S+", "", texto)
    return re.sub(r"[ \t]+\n", "\n", texto).strip()


def buscar_web(consulta: str) -> str:
    """Resumo das fontes permitidas para a consulta; texto vazio quando não achou nada."""
    dominios = (
        settings.web_search_domains
        if settings.web_search_domains is not None
        else list(atual().dominios_web)
    )
    if not dominios:
        return ""
    dados = _post(
        "responses",
        {
            "model": settings.web_search_model,
            "tools": [
                {
                    "type": "web_search",
                    "filters": {"allowed_domains": dominios},
                }
            ],
            "input": INSTRUCAO + consulta,
        },
        timeout=settings.web_search_timeout,
    )
    try:
        partes = [
            c["text"]
            for item in dados["output"]
            if item.get("type") == "message"
            for c in item.get("content", [])
            if c.get("type") == "output_text"
        ]
    except (KeyError, TypeError, AttributeError) as exc:
        raise EmbeddingIndisponivel("Resposta da busca web fora do formato.") from exc
    texto = _sem_links("\n".join(partes))[:MAX_CHARS]
    return "" if texto.lower().strip(". ") == "sem resultados" else texto
