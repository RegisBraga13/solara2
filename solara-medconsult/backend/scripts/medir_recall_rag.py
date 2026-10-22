"""Mede se o filtro de especialidade devolve os `top_k` trechos esperados na busca vetorial.

Uso (na pasta backend):
    .venv/Scripts/python -m scripts.medir_recall_rag [top_k]

O índice HNSW é único para todas as especialidades e o filtro por especialidade vem depois da
busca no índice. Se uma especialidade é pequena diante das outras, a busca pode devolver menos
trechos que o pedido. Só lê o banco (e chama o modelo de embeddings); não grava nada.
"""

import sys

from sqlalchemy import text

from app.db import engine
from app.motores.embeddings import OpenAIEmbedder
from app.repositorio_rag import buscar_por_vetor

CONSULTAS = {
    "dermatologia": [
        "psoríase em placas tratamento",
        "dermatite atópica",
        "acne vulgar isotretinoína",
        "melanoma diagnóstico",
        "urticária crônica",
    ],
    "psiquiatria": [
        "transtorno depressivo maior",
        "transtorno bipolar lítio",
        "esquizofrenia antipsicóticos",
        "transtorno de ansiedade generalizada",
        "risco de suicídio avaliação",
    ],
    "reumatologia": [
        "artrite reumatoide",
        "lúpus eritematoso sistêmico",
        "espondilite anquilosante",
        "gota ácido úrico",
        "fibromialgia",
    ],
    "neurologia": [
        "acidente vascular cerebral isquêmico",
        "epilepsia crises focais",
        "enxaqueca profilaxia",
        "doença de Parkinson",
        "esclerose múltipla",
    ],
}


def _contagem_por_especialidade() -> dict[str, int]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT d.especialidade, count(*) FROM rag_trechos t "
                "JOIN rag_documentos d ON d.id = t.documento_id GROUP BY d.especialidade"
            )
        ).all()
    return {str(r[0]): int(r[1]) for r in rows}


def main() -> None:
    top_k = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    embedder = OpenAIEmbedder()
    totais = _contagem_por_especialidade()
    print("Trechos no banco:", ", ".join(f"{e}={n}" for e, n in sorted(totais.items())))
    print(f"\n{'especialidade':<14} {'consulta':<40} {'retornados':>10} {'esperado':>8}")
    resumo: dict[str, list[int]] = {}
    for esp, consultas in CONSULTAS.items():
        for q in consultas:
            vetor = embedder.embed([q], "query")[0]
            achados = buscar_por_vetor(vetor, top_k, esp)
            resumo.setdefault(esp, []).append(len(achados))
            print(f"{esp:<14} {q:<40} {len(achados):>10} {top_k:>8}")
    print("\nResumo (mínimo / média de trechos retornados):")
    for esp, lista in resumo.items():
        print(f"  {esp:<14} min={min(lista)} media={sum(lista) / len(lista):.1f} de {top_k}")


if __name__ == "__main__":
    main()
