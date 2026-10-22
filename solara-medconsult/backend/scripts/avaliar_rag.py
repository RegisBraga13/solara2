"""Mede a qualidade da busca com perguntas de resposta conhecida.

Uso:  .venv/Scripts/python -m scripts.avaliar_rag acervo/avaliacao.json [k]
Arquivo: lista de {"pergunta": "...", "esperados": ["título do documento que responde"]}.
Compare modelos: troque EMBEDDING_MODEL (e EMBEDDING_DIM) no .env, recarregue o acervo e rode.
"""

import json
import sys
from pathlib import Path

from app.motores import rag
from app.motores.embeddings import OpenAIEmbedder


def main(caminho: str, k: int = 5) -> int:
    casos = json.loads(Path(caminho).read_text(encoding="utf-8"))
    embedder = OpenAIEmbedder()
    rel = rag.avaliar(casos, lambda q: rag.buscar(q, embedder=embedder, k=k), k=k)
    recall, mrr = rel[f"recall@{k}"], rel["mrr"]
    print(f"[{embedder.modelo}] recall@{k}={recall:.2f} mrr={mrr:.2f} ({rel['casos']} casos)")
    for d in rel["detalhes"]:
        if d["posicao_do_primeiro_acerto"] is None:
            print(f"   ERROU: {d['pergunta']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 5))
