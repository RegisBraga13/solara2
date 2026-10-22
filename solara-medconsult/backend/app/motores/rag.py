"""RAG: indexa o acervo de referência (OpenAI + pgvector) e busca trechos com a fonte.

Só RECUPERA trechos. Não gera diagnóstico, conduta nem tratamento: o resultado é material de
apoio para o médico, sempre com a fonte, e a decisão é dele.
"""

import hashlib
import logging
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app import repositorio_rag as repo
from app.config import settings
from app.especialidades import atual
from app.motores import nuvem
from app.motores.embeddings import Embedder, EmbeddingIndisponivel, Reranker

logger = logging.getLogger("medconsult.rag")

CAMPOS_PERMITIDOS = {"titulo", "fonte", "versao", "data", "especialidade", "url"}
RRF_K = 60  # constante da fusão por posição (Reciprocal Rank Fusion)


class DocumentoInvalido(ValueError):
    """Documento do acervo sem campo obrigatório ou com campo desconhecido/inválido."""


# ------------------------------------------------------------------------------ documento


@dataclass(frozen=True)
class Documento:
    titulo: str
    fonte: str
    corpo: str
    versao: str = ""
    data_fonte: date | None = None
    especialidade: str | None = None
    url: str | None = None

    @property
    def id(self) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{self.fonte}|{self.titulo}|{self.versao}"))

    @property
    def hash(self) -> str:
        base = "\x1f".join(
            [
                self.titulo,
                self.fonte,
                self.versao,
                str(self.data_fonte),
                self.especialidade or "",
                self.url or "",
                self.corpo,
            ]
        )
        return hashlib.sha256(base.encode()).hexdigest()


def ler_documento(texto: str) -> Documento:
    """Formato: linhas `chave: valor` no topo, uma linha em branco e o corpo.

    Obrigatórios: titulo, fonte. Nada é inventado: campo ausente fica vazio, desconhecido é erro.
    """
    cabecalho, _, corpo = texto.replace("\r\n", "\n").lstrip("﻿").partition("\n\n")
    campos: dict[str, str] = {}
    for linha in cabecalho.splitlines():
        if not linha.strip():
            continue
        chave, sep, valor = linha.partition(":")
        chave = chave.strip().lower()
        if not sep or chave not in CAMPOS_PERMITIDOS:
            raise DocumentoInvalido(f"Cabeçalho inválido: {linha[:40]!r}")
        campos[chave] = valor.strip()
    for obrigatorio in ("titulo", "fonte"):
        if not campos.get(obrigatorio):
            raise DocumentoInvalido(f"Falta o campo obrigatório '{obrigatorio}'.")
    if not corpo.strip():
        raise DocumentoInvalido("Documento sem conteúdo.")
    data_fonte = None
    if campos.get("data"):
        try:
            data_fonte = date.fromisoformat(campos["data"])
        except ValueError:
            raise DocumentoInvalido("Campo 'data' deve ser AAAA-MM-DD.") from None
    return Documento(
        titulo=campos["titulo"],
        fonte=campos["fonte"],
        corpo=corpo.strip(),
        versao=campos.get("versao", ""),
        data_fonte=data_fonte,
        especialidade=campos.get("especialidade") or None,
        url=campos.get("url") or None,
    )


def dividir_em_trechos(
    corpo: str, max_chars: int | None = None, sobreposicao: int | None = None
) -> list[str]:
    """Junta parágrafos até `max_chars`; parágrafo maior é cortado em janelas com sobreposição."""
    max_chars = max_chars or settings.rag_trecho_max_chars
    sobreposicao = settings.rag_trecho_sobreposicao if sobreposicao is None else sobreposicao
    paragrafos = [p.strip() for p in re.split(r"\n\s*\n", corpo) if p.strip()]
    trechos: list[str] = []
    atual = ""

    def fechar() -> None:
        nonlocal atual
        if atual:
            trechos.append(atual)
            atual = ""

    for p in paragrafos:
        if len(p) > max_chars:
            fechar()
            ini = 0
            while ini < len(p):
                fim = min(ini + max_chars, len(p))
                if fim < len(p):  # corta em espaço, para não partir palavra
                    corte = p.rfind(" ", ini + max_chars // 2, fim)
                    fim = corte if corte > 0 else fim
                trechos.append(p[ini:fim].strip())
                if fim >= len(p):
                    break
                ini = max(fim - sobreposicao, ini + 1)
        elif atual and len(atual) + 2 + len(p) > max_chars:
            fechar()
            atual = p
        else:
            atual = f"{atual}\n\n{p}" if atual else p
    fechar()
    return [t for t in trechos if t]


def indexar_documento(doc: Documento, embedder: Embedder) -> str:
    """Devolve 'indexado' ou 'inalterado' (mesmo conteúdo e modelo: não chama a OpenAI de novo)."""
    chave = f"{doc.hash}|c{settings.rag_trecho_max_chars}"  # muda se o conteúdo ou o corte mudar
    marca = f"{chave}|{embedder.modelo}"
    if repo.hash_do_documento(doc.id) == marca:
        return "inalterado"
    trechos = dividir_em_trechos(doc.corpo)
    vetores = embedder.embed(trechos, "document")  # falha aqui = nada é gravado
    repo.substituir_documento(
        documento_id=doc.id,
        titulo=doc.titulo,
        fonte=doc.fonte,
        versao=doc.versao,
        data_fonte=doc.data_fonte,
        especialidade=doc.especialidade,
        url=doc.url,
        hash_conteudo=chave,
        modelo=embedder.modelo,
        trechos=trechos,
        vetores=vetores,
    )
    return "indexado"


# ---------------------------------------------------------------------------------- busca


@dataclass
class Resultado:
    trecho_id: str
    texto: str
    titulo: str
    fonte: str
    versao: str
    data_fonte: date | None
    url: str | None
    pontuacao: float  # sinal operacional de ordenação; NÃO é probabilidade de estar correto
    origens: list[str] = field(default_factory=list)  # 'vetor' | 'texto' | 'rerank'


@dataclass
class Busca:
    resultados: list[Resultado]
    modo: str  # 'hibrida' | 'texto'
    avisos: list[str] = field(default_factory=list)


def _tsquery(consulta: str) -> str:
    termos = list(dict.fromkeys(re.findall(r"\w{3,}", consulta.lower())))[:40]
    return " | ".join(termos)


def _resultado(linha: dict[str, Any], pontuacao: float, origem: str) -> Resultado:
    return Resultado(
        trecho_id=linha["trecho_id"],
        texto=linha["texto"],
        titulo=linha["titulo"],
        fonte=linha["fonte"],
        versao=linha["versao"],
        data_fonte=linha["data_fonte"],
        url=linha["url"],
        pontuacao=pontuacao,
        origens=[origem],
    )


def buscar(
    consulta: str,
    *,
    embedder: Embedder,
    reranker: Reranker | None = None,
    k: int = 8,
    especialidade: str | None = None,
    escopos: tuple[str, ...] | None = None,
) -> Busca:
    """Busca híbrida (vetor + texto), fundida por posição e, se houver, reordenada pelo reranker.

    Falhas do provedor de embeddings não derrubam a busca: cai para texto e avisa. Com um vector
    store da OpenAI configurado para a especialidade ativa, busca nele (filtrando por `escopos`,
    o gênero do livro); se a nuvem falhar, cai no acervo local e avisa.
    """
    consulta = consulta.strip()[: settings.rag_consulta_max_chars]
    if not consulta:
        raise ValueError("consulta vazia")
    especialidade = especialidade or settings.especialidade  # o acervo é filtrado pela ativa
    n = settings.rag_candidatos
    avisos: list[str] = []

    ativa = atual()
    if ativa.usa_nuvem and settings.openai_rag_vector_store_id and especialidade == ativa.slug:
        try:
            achados = nuvem.buscar(
                settings.openai_rag_vector_store_id, consulta, k=k, escopos=escopos
            )
        except EmbeddingIndisponivel as exc:
            logger.warning("Acervo na nuvem indisponível: %s", exc)
            avisos.append("Acervo na nuvem indisponível; usei o acervo local.")
        else:
            resultados = [
                Resultado(
                    trecho_id=f"{t.file_id}:{hashlib.sha1(t.texto.encode()).hexdigest()[:12]}",
                    texto=t.texto,
                    titulo=t.arquivo,
                    fonte=t.arquivo,
                    versao="",
                    data_fonte=None,
                    url=None,
                    pontuacao=t.pontuacao,
                    origens=["nuvem"],
                )
                for t in achados
            ]
            if not resultados:
                avisos.append("Nenhum trecho do acervo encontrado para esta consulta.")
            return Busca(resultados=resultados, modo="nuvem", avisos=avisos)

    por_vetor: list[dict[str, Any]] = []
    modo = "hibrida"
    try:
        por_vetor = repo.buscar_por_vetor(embedder.embed([consulta], "query")[0], n, especialidade)
    except EmbeddingIndisponivel as exc:
        modo = "texto"
        logger.warning("Busca vetorial indisponível: %s", exc)
        avisos.append("Busca por significado indisponível; usei só busca por palavras.")
    por_texto = repo.buscar_por_texto(_tsquery(consulta), n, especialidade)

    fundidos: dict[str, Resultado] = {}
    for origem, lista in (("vetor", por_vetor), ("texto", por_texto)):
        for pos, linha in enumerate(lista):
            parcela = 1.0 / (RRF_K + pos + 1)
            existente = fundidos.get(linha["trecho_id"])
            if existente:
                existente.pontuacao += parcela
                existente.origens.append(origem)
            else:
                fundidos[linha["trecho_id"]] = _resultado(linha, parcela, origem)
    ordenados = sorted(fundidos.values(), key=lambda r: r.pontuacao, reverse=True)

    if reranker and len(ordenados) > 1:
        try:
            # Só os melhores candidatos vão ao reranker; o resto segue depois, na ordem original.
            topo, resto = (
                ordenados[: settings.rag_rerank_candidatos],
                ordenados[settings.rag_rerank_candidatos :],
            )
            nova = reranker.rerank(consulta, [r.texto for r in topo], len(topo))
            reordenados = [
                Resultado(
                    **{
                        **topo[i].__dict__,
                        "pontuacao": s,
                        "origens": [*topo[i].origens, "rerank"],
                    }
                )
                for i, s in nova
                if 0 <= i < len(topo)
            ]
            ordenados = reordenados + resto
        except EmbeddingIndisponivel as exc:
            logger.warning("Rerank indisponível: %s", exc)
            avisos.append("Reordenação indisponível; usei a ordem da busca.")

    resultados = ordenados[:k]
    if not resultados:
        avisos.append("Nenhum trecho do acervo encontrado para esta consulta.")
    # Auditoria sem conteúdo clínico: só contagens e modelo.
    logger.info(
        "rag.buscar modo=%s resultados=%d modelo=%s", modo, len(resultados), embedder.modelo
    )
    return Busca(resultados=resultados, modo=modo, avisos=avisos)


# ------------------------------------------------------------------------------ avaliação


def avaliar(
    casos: list[dict[str, Any]], buscar_fn: Callable[[str], Busca], k: int = 5
) -> dict[str, Any]:
    """Mede a busca num conjunto com resposta conhecida.

    Cada caso: {"pergunta": str, "esperados": [títulos de documentos que respondem]}.
    Acerto = algum trecho dos k primeiros vem de um documento esperado.
    """
    if not casos:
        raise ValueError("sem casos de avaliação")
    detalhes = []
    for caso in casos:
        esperados = set(caso["esperados"])
        achados = buscar_fn(caso["pergunta"]).resultados[:k]
        posicao = next((i + 1 for i, r in enumerate(achados) if r.titulo in esperados), None)
        detalhes.append({"pergunta": caso["pergunta"], "posicao_do_primeiro_acerto": posicao})
    acertos = [d for d in detalhes if d["posicao_do_primeiro_acerto"] is not None]
    return {
        "casos": len(casos),
        f"recall@{k}": len(acertos) / len(casos),
        "mrr": sum(1 / d["posicao_do_primeiro_acerto"] for d in acertos) / len(casos),
        "detalhes": detalhes,
    }
