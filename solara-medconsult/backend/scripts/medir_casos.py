"""Mede a busca com casos clínicos cujo diagnóstico é conhecido.

Uso:  .venv/Scripts/python -m scripts.medir_casos [acervo/<esp>/gabarito_casos.json]
(sem argumento: o gabarito da especialidade ativa, variável ESPECIALIDADE)

Acerto = a janela de páginas dos livros da especialidade cita a doença (algum `termo`) pelo menos
`min_mencoes` vezes. É um critério aproximado: confira as páginas dos casos que falharem.
Compara a busca sozinha com a busca + reordenação por IA. Posição = janela distinta.
"""

import glob
import json
import re
import sys
from pathlib import Path

from app.config import settings
from app.motores import rag
from app.motores.embeddings import OpenAIEmbedder, OpenAIReranker


def _pagina(titulo: str) -> str:
    """Chave do documento = o título completo (inclui o livro e as páginas)."""
    return titulo.removeprefix("titulo:").strip()


def _carregar_janelas(pasta: Path) -> dict[str, str]:
    """Livros da especialidade: <pasta>/<livro>/*.md (a pasta do gabarito)."""
    janelas = {}
    for f in glob.glob(f"{pasta.as_posix()}/*/*.md"):
        t = Path(f).read_text(encoding="utf-8")
        janelas[_pagina(t.split("\n", 1)[0])] = t
    return janelas


def _posicao(resultados, regex: re.Pattern, minimo: int, janelas: dict[str, str]) -> int | None:
    vistas: list[str] = []
    for r in resultados:
        p = _pagina(r.titulo)
        if p in vistas:
            continue
        vistas.append(p)
        if len(regex.findall(janelas.get(p, ""))) >= minimo:
            return len(vistas)
    return None


def _taxa(pos: list[int | None], k: int) -> float:
    return sum(1 for x in pos if x and x <= k) / len(pos)


def _resumo(nome: str, pos: list[int | None]) -> str:
    mrr = sum(1 / x for x in pos if x) / len(pos)
    taxas = " ".join(f"@{k}={_taxa(pos, k):.2f}" for k in (1, 3, 5, 10))
    return f"{nome:18} acerto {taxas} MRR={mrr:.2f}"


def main(caminho: str | None = None) -> int:
    caminho = caminho or f"acervo/{settings.especialidade}/gabarito_casos.json"
    casos = json.loads(Path(caminho).read_text(encoding="utf-8"))
    janelas = _carregar_janelas(Path(caminho).parent)
    embedder, reranker = OpenAIEmbedder(), OpenAIReranker()
    sem: list[int | None] = []
    com: list[int | None] = []
    for c in casos:
        rx = re.compile("|".join(re.escape(t) for t in c["termos"]), re.I)
        mn = c["min_mencoes"]
        base = rag.buscar(c["caso"], embedder=embedder, k=20).resultados
        reord = rag.buscar(c["caso"], embedder=embedder, reranker=reranker, k=20).resultados
        a, b = _posicao(base, rx, mn, janelas), _posicao(reord, rx, mn, janelas)
        sem.append(a)
        com.append(b)
        print(f"{c['diagnostico']:26} busca: {a!s:>4}   com reordenação: {b!s:>4}")
    print()
    print(_resumo("busca", sem))
    print(_resumo("com reordenação", com))
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
