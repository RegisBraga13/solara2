"""Persistência do acervo de referência (RAG): documentos e trechos com vetor no pgvector."""

import logging
from datetime import date
from functools import lru_cache
from typing import Any

from sqlalchemy import text

from app.config import settings
from app.db import engine

logger = logging.getLogger("medconsult.rag")


def _ddl() -> list[str]:
    dim = int(settings.embedding_dim)
    return [
        """
        CREATE TABLE IF NOT EXISTS rag_documentos (
          id UUID PRIMARY KEY,
          titulo TEXT NOT NULL,
          fonte TEXT NOT NULL,
          versao TEXT NOT NULL DEFAULT '',
          data_fonte DATE,
          especialidade TEXT,
          url TEXT,
          hash_conteudo TEXT NOT NULL,
          modelo_embedding TEXT NOT NULL,
          criado_em TIMESTAMP DEFAULT NOW()
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS rag_trechos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          documento_id UUID NOT NULL REFERENCES rag_documentos(id) ON DELETE CASCADE,
          posicao INT NOT NULL,
          texto TEXT NOT NULL,
          embedding vector({dim}) NOT NULL,
          tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', texto)) STORED
        )
        """,
        "CREATE INDEX IF NOT EXISTS rag_documentos_esp_idx ON rag_documentos (especialidade)",
        "CREATE INDEX IF NOT EXISTS rag_trechos_doc_idx ON rag_trechos (documento_id)",
        "CREATE INDEX IF NOT EXISTS rag_trechos_tsv_idx ON rag_trechos USING gin (tsv)",
        """
        CREATE INDEX IF NOT EXISTS rag_trechos_emb_idx
          ON rag_trechos USING hnsw (embedding vector_cosine_ops)
        """,
    ]


def _dim_atual(conn, esquema: str) -> int | None:
    """Dimensão da coluna `embedding` já existente NESTE esquema (None se não existe)."""
    return conn.execute(
        text(
            "SELECT a.atttypmod FROM pg_attribute a "
            "WHERE a.attrelid = to_regclass(:t) AND a.attname = 'embedding'"
        ),
        {"t": f"{esquema}.rag_trechos"},
    ).scalar()


def criar_tabelas_rag() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        esquema = conn.execute(text("SELECT current_schema()")).scalar_one()
        atual = _dim_atual(conn, esquema)
        if atual is not None and atual != settings.embedding_dim:
            # Vetores de outro modelo/dimensão não servem: o acervo é derivado, basta recarregar.
            # Nomes qualificados: nunca age em tabela de outro esquema do caminho de busca.
            logger.warning(
                "Dimensão do embedding mudou (%s -> %s): acervo zerado.",
                atual,
                settings.embedding_dim,
            )
            conn.execute(text(f"DROP TABLE {esquema}.rag_trechos"))
            conn.execute(text(f"DELETE FROM {esquema}.rag_documentos"))
        for stmt in _ddl():
            conn.execute(text(stmt))


def _vetor(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8g}" for x in v) + "]"


def hash_do_documento(documento_id: str) -> str | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT hash_conteudo || '|' || modelo_embedding FROM rag_documentos "
                "WHERE id = CAST(:i AS uuid)"
            ),
            {"i": documento_id},
        ).first()
    return row[0] if row else None


def substituir_documento(
    *,
    documento_id: str,
    titulo: str,
    fonte: str,
    versao: str,
    data_fonte: date | None,
    especialidade: str | None,
    url: str | None,
    hash_conteudo: str,
    modelo: str,
    trechos: list[str],
    vetores: list[list[float]],
) -> None:
    """Troca o documento inteiro numa transação (idempotente: nunca deixa trechos pela metade)."""
    if len(trechos) != len(vetores):
        raise ValueError("trechos e vetores com tamanhos diferentes")
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM rag_documentos WHERE id = CAST(:i AS uuid)"), {"i": documento_id}
        )
        conn.execute(
            text(
                """
                INSERT INTO rag_documentos (id, titulo, fonte, versao, data_fonte, especialidade,
                                            url, hash_conteudo, modelo_embedding)
                VALUES (CAST(:i AS uuid), :titulo, :fonte, :versao, :data, :esp, :url, :h, :m)
                """
            ),
            {
                "i": documento_id,
                "titulo": titulo,
                "fonte": fonte,
                "versao": versao,
                "data": data_fonte,
                "esp": especialidade,
                "url": url,
                "h": hash_conteudo,
                "m": modelo,
            },
        )
        if trechos:
            conn.execute(
                text(
                    """
                    INSERT INTO rag_trechos (documento_id, posicao, texto, embedding)
                    VALUES (CAST(:d AS uuid), :p, :t, CAST(:v AS vector))
                    """
                ),
                [
                    {"d": documento_id, "p": pos, "t": texto, "v": _vetor(vet)}
                    for pos, (texto, vet) in enumerate(zip(trechos, vetores, strict=True))
                ],
            )


def ids_da_fonte(fonte: str, especialidade: str | None) -> set[str]:
    """Ids dos documentos da mesma fonte (livro) e especialidade."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id FROM rag_documentos WHERE fonte = :f "
                "AND especialidade IS NOT DISTINCT FROM :e"
            ),
            {"f": fonte, "e": especialidade},
        ).all()
    return {str(r[0]) for r in rows}


def remover_documentos(documento_ids: list[str]) -> int:
    """Remove vários documentos (e seus trechos) numa única transação."""
    if not documento_ids:
        return 0
    with engine.begin() as conn:
        r = conn.execute(
            text("DELETE FROM rag_documentos WHERE id = ANY(CAST(:ids AS uuid[]))"),
            {"ids": list(documento_ids)},
        )
    return int(r.rowcount)


def remover_documento(documento_id: str) -> bool:
    with engine.begin() as conn:
        r = conn.execute(
            text("DELETE FROM rag_documentos WHERE id = CAST(:i AS uuid)"), {"i": documento_id}
        )
    return r.rowcount > 0


_COLUNAS = """
    t.id AS trecho_id, t.posicao, t.texto,
    d.id AS documento_id, d.titulo, d.fonte, d.versao, d.data_fonte, d.especialidade, d.url
"""


def _linha(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    d["trecho_id"] = str(d["trecho_id"])
    d["documento_id"] = str(d["documento_id"])
    return d


HNSW_EF_SEARCH = 200  # candidatos que o índice HNSW examina por busca (padrão do pgvector: 40)


@lru_cache(maxsize=1)
def _pgvector_com_busca_iterativa() -> bool:
    """pgvector 0.8+ tem `hnsw.iterative_scan` (continua o índice até achar `n` com o filtro)."""
    with engine.connect() as conn:
        versao = conn.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        ).scalar()
    try:
        maior, menor = (int(x) for x in str(versao).split(".")[:2])
    except ValueError:
        return False
    return (maior, menor) >= (0, 8)


def buscar_por_vetor(vetor: list[float], n: int, especialidade: str | None) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        # pgvector aplica o filtro DEPOIS do HNSW. Com ef_search baixo, especialidades pequenas
        # podem retornar menos de top_k trechos. ef_search alto aumenta o recall. iterative_scan
        # (pgvector 0.8+) permite busca iterativa sem perder recall. O filtro continua no WHERE.
        conn.execute(text(f"SET LOCAL hnsw.ef_search = {min(1000, max(HNSW_EF_SEARCH, n))}"))
        if _pgvector_com_busca_iterativa():
            conn.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))
        rows = conn.execute(
            text(
                f"""
                SELECT {_COLUNAS}, 1 - (t.embedding <=> CAST(:v AS vector)) AS similaridade
                FROM rag_trechos t JOIN rag_documentos d ON d.id = t.documento_id
                WHERE (CAST(:esp AS text) IS NULL OR d.especialidade = :esp)
                ORDER BY t.embedding <=> CAST(:v AS vector)
                LIMIT :n
                """
            ),
            {"v": _vetor(vetor), "n": n, "esp": especialidade},
        ).all()
    return [_linha(r) for r in rows]


def buscar_por_texto(tsquery: str, n: int, especialidade: str | None) -> list[dict[str, Any]]:
    """`tsquery` já vem saneado (só palavras ligadas por ' | ')."""
    if not tsquery:
        return []
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT {_COLUNAS}, ts_rank_cd(t.tsv, to_tsquery('portuguese', :q)) AS similaridade
                FROM rag_trechos t JOIN rag_documentos d ON d.id = t.documento_id
                WHERE t.tsv @@ to_tsquery('portuguese', :q)
                  AND (CAST(:esp AS text) IS NULL OR d.especialidade = :esp)
                ORDER BY similaridade DESC
                LIMIT :n
                """
            ),
            {"q": tsquery, "n": n, "esp": especialidade},
        ).all()
    return [_linha(r) for r in rows]


def contagens() -> dict[str, int]:
    with engine.connect() as conn:
        docs, trechos = conn.execute(
            text("SELECT (SELECT count(*) FROM rag_documentos), (SELECT count(*) FROM rag_trechos)")
        ).one()
    return {"documentos": int(docs), "trechos": int(trechos)}
