"""Mede se o diagnóstico sugerido bate com o gabarito do médico.

Uso:  .venv/Scripts/python -m scripts.medir_diagnosticos [acervo/<esp>/gabarito_casos.json] [modelo]
(sem argumento: o gabarito da especialidade ativa, variável ESPECIALIDADE)

Acerto = algum dos primeiros k diagnósticos contém um dos `termos` do caso (sem acento/caixa).
Mostra, para cada caso, o que o sistema devolveu (uso interno, para conferência).
"""

import json
import sys
from pathlib import Path

from app.config import settings
from app.motores.diagnostico import confere, sugerir_diagnosticos
from app.motores.embeddings import OpenAIEmbedder, OpenAIReranker


def main(caminho: str | None = None, modelo: str | None = None) -> int:
    caminho = caminho or f"acervo/{settings.especialidade}/gabarito_casos.json"
    casos = json.loads(Path(caminho).read_text(encoding="utf-8"))
    embedder, reranker = OpenAIEmbedder(), OpenAIReranker()
    posicoes: list[int | None] = []
    for c in casos:
        s = sugerir_diagnosticos(c["caso"], embedder=embedder, reranker=reranker, modelo=modelo)
        aceitos = [c["diagnostico"], *c["termos"]]
        pos = confere(s.diagnosticos, aceitos, 5)
        posicoes.append(pos)
        marca = "OK " if pos == 1 else ("~  " if pos else "ERR")
        print(f"{marca} esperado={c['diagnostico']!r}  posição={pos}  acao={s.acao.value}")
        if pos != 1:
            print(f"      devolveu: {s.diagnosticos}")
    n = len(casos)
    top = lambda k: sum(1 for p in posicoes if p and p <= k) / n  # noqa: E731
    print(f"\n{n} casos  top-1={top(1):.2f}  top-3={top(3):.2f}  top-5={top(5):.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
