"""Converte o PDF do Manual de Dermatologia Clínica de Sampaio e Rivitti (2014) para o acervo.

Uso:  .venv/Scripts/python -m scripts.converter_pdf_sampaio <arquivo.pdf> [pasta_saida] [--janela N]

O PDF tem sumário navegável (um capítulo por entrada) e texto em duas colunas. Cada capítulo é
dividido em janelas de N páginas (padrão 4); o título leva o nome do capítulo e as páginas do PDF.
Ficam fora: capa/créditos ("Iniciais"), cabeçalhos correntes, legendas de figuras e o índice final.
"""

import re
import sys
from pathlib import Path

import pymupdf

from scripts.converter_pdf_azulay import MIN_CHARS, Secao, escrever

FONTE = (
    "Manual de Dermatologia Clínica de Sampaio e Rivitti, Evandro A. Rivitti, Artes Médicas, 2014"
)
PULAR = ("iniciais", "índice", "indice")
REGEX_FIGURA = re.compile(r"^(Figura|Fig\.)\s*\d", re.I)
ALTURA_CABECALHO = 65  # pontos; blocos acima disso são cabeçalho corrente


def _juntar(linhas: list[str]) -> str:
    texto = ""
    for ln in (x.strip() for x in linhas):
        if not ln:
            continue
        if texto.endswith("-") and ln[:1].islower():
            texto = texto[:-1] + ln  # hifenização de fim de linha: "ra-" + "diação"
        else:
            texto = f"{texto} {ln}".strip()
    return re.sub(r"\s+", " ", texto)


def _negrito(span: dict) -> bool:
    return bool(span["flags"] & 16) or "bold" in span["font"].lower()


def _blocos_da_pagina(pagina: pymupdf.Page) -> list[tuple[str, str]]:
    """(tipo, texto) na ordem de leitura de uma página de duas colunas. tipo: 'h' ou 'p'."""
    largura = pagina.rect.width
    meio = largura / 2
    brutos = []
    for b in pagina.get_text("dict")["blocks"]:
        if b["type"] != 0 or b["bbox"][3] < ALTURA_CABECALHO:
            continue
        linhas, spans = [], []
        for ln in b["lines"]:
            linhas.append("".join(s["text"] for s in ln["spans"]))
            spans += [s for s in ln["spans"] if s["text"].strip()]
        texto = _juntar(linhas)
        if not texto or re.fullmatch(r"[\d\s.,|]+", texto) or REGEX_FIGURA.match(texto):
            continue
        titulo = bool(spans) and all(_negrito(s) for s in spans) and len(texto) < 90
        x0, y0, x1, _ = b["bbox"]
        coluna = (
            "inteira" if (x1 - x0) > largura * 0.6 else ("esq" if (x0 + x1) / 2 < meio else "dir")
        )
        brutos.append((y0, coluna, "h" if titulo else "p", texto))

    saida: list[tuple[str, str]] = []
    esq: list[tuple[float, str, str]] = []
    dir_: list[tuple[float, str, str]] = []

    def descarregar() -> None:
        for _, tipo, txt in sorted(esq) + sorted(dir_):
            saida.append((tipo, txt))
        esq.clear()
        dir_.clear()

    for y0, coluna, tipo, texto in sorted(brutos, key=lambda x: x[0]):
        if coluna == "inteira":
            descarregar()
            saida.append((tipo, texto))
        elif coluna == "esq":
            esq.append((y0, tipo, texto))
        else:
            dir_.append((y0, tipo, texto))
    descarregar()
    return saida


def secoes(doc: pymupdf.Document, janela: int = 4) -> list[Secao]:
    toc = [t for t in doc.get_toc() if t[0] == 1]
    saida: list[Secao] = []
    for i, (_, titulo, inicio) in enumerate(toc):
        if titulo.strip().lower() in PULAR:
            continue
        fim = (toc[i + 1][2] - 1) if i + 1 < len(toc) else len(doc)
        nome = re.sub(r"^Cap[ií]tulo\s+\d+\s*-\s*", "", titulo).strip()
        for ini in range(inicio, fim + 1, janela):
            ate = min(ini + janela - 1, fim)
            s = Secao(nome, ini, ate)
            for p in range(ini, ate + 1):
                for tipo, texto in _blocos_da_pagina(doc[p - 1]):
                    s.linhas.append(f"## {texto}" if tipo == "h" else texto)
            saida.append(s)
    return [s for s in saida if len(s.corpo) >= MIN_CHARS]


def main(pdf: str, saida: str = "acervo/dermatologia/sampaio", janela: int = 4) -> int:
    doc = pymupdf.open(pdf)
    secs = secoes(doc, janela)
    for s in secs:  # título com a obra, para distinguir de outros livros
        s.titulo = f"{s.titulo} [Sampaio e Rivitti]"
    escrever(secs, Path(saida), fonte=FONTE, versao="2014", prefixo="sampaio")
    print(f"{len(secs)} documentos, {sum(len(s.corpo) for s in secs):,} caracteres -> {saida}")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--janela")]
    j = int(sys.argv[sys.argv.index("--janela") + 1]) if "--janela" in sys.argv else 4
    args = [a for a in args if a != str(j)] if "--janela" in sys.argv else args
    sys.exit(main(*args[:2], janela=j))
