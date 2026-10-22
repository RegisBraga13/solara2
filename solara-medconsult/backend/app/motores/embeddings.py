"""Embeddings (OpenAI, HTTP direto). Isola o provedor do resto do app."""

import json
import time
from typing import Literal, Protocol

import httpx

from app.config import settings
from app.especialidades import atual

OPENAI_URL = "https://api.openai.com/v1"
LOTE = 128  # textos por chamada
TENTATIVAS = 4  # limite de taxa (429) e falhas do servidor (5xx) são repetidos com espera

TipoEntrada = Literal["document", "query"]


class EmbeddingIndisponivel(Exception):
    """Provedor sem chave, fora do ar ou com resposta inválida."""


class Embedder(Protocol):
    modelo: str
    dim: int

    def embed(self, textos: list[str], tipo: TipoEntrada) -> list[list[float]]: ...


class Reranker(Protocol):
    """Gancho opcional: reordena os candidatos. Sem implementação no momento."""

    modelo: str

    def rerank(self, consulta: str, textos: list[str], top_k: int) -> list[tuple[int, float]]:
        """Devolve (índice_original, relevância), do mais para o menos relevante."""
        ...


def _post(caminho: str, corpo: dict, timeout: float = 60.0) -> dict:
    if not settings.openai_api_key:
        raise EmbeddingIndisponivel("OPENAI_API_KEY vazia.")
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    ultimo: Exception | None = None
    for tentativa in range(TENTATIVAS):
        try:
            r = httpx.post(f"{OPENAI_URL}/{caminho}", json=corpo, headers=headers, timeout=timeout)
            if r.status_code == 429 and "insufficient_quota" in r.text:
                # Sem créditos: repetir não adianta. Falha na hora, com motivo claro.
                raise EmbeddingIndisponivel("OpenAI sem créditos (insufficient_quota).")
            if r.status_code == 429 or r.status_code >= 500:
                ultimo = httpx.HTTPStatusError(
                    f"status {r.status_code}", request=r.request, response=r
                )
                time.sleep(2.0 * 2**tentativa)
                continue
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPError, ValueError) as exc:
            ultimo = exc
            break
    # Não inclui o corpo da resposta (pode repetir texto clínico) na mensagem.
    detalhe = (
        f" ({ultimo.response.status_code})" if isinstance(ultimo, httpx.HTTPStatusError) else ""
    )
    raise EmbeddingIndisponivel(f"OpenAI falhou: {type(ultimo).__name__}{detalhe}") from ultimo


class OpenAIEmbedder:
    def __init__(self, modelo: str | None = None, dim: int | None = None) -> None:
        self.modelo = modelo or settings.embedding_model
        self.dim = dim or settings.embedding_dim

    def embed(self, textos: list[str], tipo: TipoEntrada) -> list[list[float]]:
        # `tipo` existe na interface por outros provedores; a OpenAI usa o mesmo vetor para ambos.
        saida: list[list[float]] = []
        for i in range(0, len(textos), LOTE):
            lote = textos[i : i + LOTE]
            dados = _post(
                "embeddings",
                {
                    "input": lote,
                    "model": self.modelo,
                    "dimensions": self.dim,
                    "encoding_format": "float",
                },
            )
            try:
                itens = sorted(dados["data"], key=lambda d: d["index"])
                vetores = [list(map(float, d["embedding"])) for d in itens]
            except (KeyError, TypeError, ValueError) as exc:
                raise EmbeddingIndisponivel("Resposta da OpenAI fora do formato.") from exc
            if len(vetores) != len(lote) or any(len(v) != self.dim for v in vetores):
                raise EmbeddingIndisponivel("A OpenAI devolveu vetores com tamanho inesperado.")
            saida.extend(vetores)
        return saida


PROMPT_RERANK = (
    "Você ajuda a ordenar trechos de um livro de dermatologia por relevância para um caso clínico. "
    "Dê a CADA trecho uma nota inteira de 0 a 10: quão bem ele descreve a doença que explica os "
    "achados do caso (0 = outra doença ou assunto). Não diagnostique; apenas avalie relevância. "
    'Responda só JSON no formato {"notas": {"0": n, "1": n, ...}} com uma entrada para cada '
    "índice listado.\n\nCASO:\n"
)


class OpenAIReranker:
    """Reordena os candidatos pedindo a um modelo de linguagem uma nota de relevância por trecho.

    Só ordena: não gera texto clínico nem diagnóstico. Trecho sem nota válida recebe 0.
    """

    def __init__(self, modelo: str | None = None) -> None:
        self.modelo = modelo or settings.rag_rerank_model

    def rerank(self, consulta: str, textos: list[str], top_k: int) -> list[tuple[int, float]]:
        if not textos:
            return []
        trechos = "\n".join(f"[{i}] {t[:600]}" for i, t in enumerate(textos))
        dados = _post(
            "chat/completions",
            {
                "model": self.modelo,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f"{atual().adaptar(PROMPT_RERANK)}{consulta}\n\nTRECHOS:\n{trechos}"
                        ),
                    }
                ],
            },
        )
        try:
            notas = json.loads(dados["choices"][0]["message"]["content"])["notas"]
            if not isinstance(notas, dict):
                raise TypeError
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise EmbeddingIndisponivel("Resposta do reordenador fora do formato.") from exc

        def nota(i: int) -> float:
            try:
                return max(0.0, min(10.0, float(notas.get(str(i), 0))))
            except (TypeError, ValueError):
                return 0.0

        ordenados = sorted(range(len(textos)), key=lambda i: -nota(i))  # estável nos empates
        return [(i, nota(i)) for i in ordenados[:top_k]]


def chat_json(modelo: str, prompt: str) -> dict:
    """Pede ao modelo uma resposta em JSON (objeto). Erros viram EmbeddingIndisponivel."""
    dados = _post(
        "chat/completions",
        {
            "model": modelo,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    try:
        saida = json.loads(dados["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise EmbeddingIndisponivel("Resposta do modelo fora do formato.") from exc
    if not isinstance(saida, dict):
        raise EmbeddingIndisponivel("Resposta do modelo fora do formato.")
    return saida
