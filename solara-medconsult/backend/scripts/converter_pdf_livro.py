"""Converte um livro em PDF (com texto) em documentos .md no formato do acervo do RAG.

Uso (na pasta backend):
    .venv/Scripts/python -m scripts.converter_pdf_livro "C:/livros/Livro.pdf" \\
        --slug dalgalarrondo --titulo "Psicopatologia - Dalgalarrondo" --versao "3a ed." \\
        --especialidade psiquiatria

Gera `acervo/<especialidade>/<slug>/<slug>_p0001-0012.md` (um documento a cada N páginas).
Os livros têm direitos autorais: a pasta de saída fica FORA do git (veja .gitignore). Depois:
    .venv/Scripts/python -m scripts.carregar_acervo acervo/<esp>/<slug> --especialidade <esp>
"""

import argparse
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf

MIN_CARACTERES_PAGINA = 200  # página só com figura/índice quase vazio não entra


def slugificar(texto: str) -> str:
    sem = unicodedata.normalize("NFKD", texto)
    sem = "".join(c for c in sem if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", sem.lower()).strip("-")


def limpar_pagina(texto: str, repetidas: set[str]) -> str:
    """Tira cabeçalho/rodapé repetido e número de página; junta palavras quebradas por hífen."""
    linhas = []
    for ln in texto.splitlines():
        s = ln.strip()
        if not s or s in repetidas or re.fullmatch(r"\d{1,4}", s):
            continue
        linhas.append(s)
    corpo = "\n".join(linhas)
    corpo = re.sub(r"(\w)-\n(\w)", r"\1\2", corpo)  # hifenização no fim da linha
    corpo = re.sub(r"(?<![.!?:;])\n(?=[a-zà-ú])", " ", corpo)  # linha quebrada no meio da frase
    corpo = re.sub(r"[ \t]{2,}", " ", corpo)
    return corpo.strip()


def linhas_repetidas(paginas: list[str]) -> set[str]:
    """Linhas que aparecem em muitas páginas (títulos correntes, nome do livro)."""
    if len(paginas) < 8:
        return set()
    contagem: Counter[str] = Counter()
    for p in paginas:
        contagem.update({ln.strip() for ln in p.splitlines() if 3 <= len(ln.strip()) <= 90})
    limite = max(5, int(len(paginas) * 0.12))
    return {ln for ln, n in contagem.items() if n >= limite}


def converter(
    pdf: Path,
    saida: Path,
    *,
    slug: str,
    titulo: str,
    versao: str,
    especialidade: str,
    por_documento: int,
    primeira: int,
    ultima: int | None,
) -> tuple[int, int]:
    """Devolve (documentos gravados, páginas aproveitadas)."""
    livro = pymupdf.open(str(pdf))
    fim = min(ultima or len(livro), len(livro))
    brutas = [livro[i].get_text() for i in range(primeira - 1, fim)]
    repetidas = linhas_repetidas(brutas)
    saida.mkdir(parents=True, exist_ok=True)
    docs = aproveitadas = 0
    for ini in range(0, len(brutas), por_documento):
        bloco = brutas[ini : ini + por_documento]
        partes = []
        for bruto in bloco:
            texto = limpar_pagina(bruto, repetidas)
            if len(texto) >= MIN_CARACTERES_PAGINA:
                partes.append(texto)
                aproveitadas += 1
        if not partes:
            continue
        p_ini, p_fim = primeira + ini, primeira + ini + len(bloco) - 1
        cab = (
            f"titulo: {titulo} (págs. {p_ini}-{p_fim})\n"
            f"fonte: {titulo}\n"
            f"versao: {versao}\n"
            f"especialidade: {especialidade}\n\n"
        )
        nome = f"{slug}_p{p_ini:04d}-{p_fim:04d}.md"
        (saida / nome).write_text(cab + "\n\n".join(partes) + "\n", encoding="utf-8")
        docs += 1
    return docs, aproveitadas


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--slug", help="nome curto (padrão: derivado do arquivo)")
    ap.add_argument("--titulo", help="título do livro (padrão: nome do arquivo)")
    ap.add_argument("--versao", default="")
    ap.add_argument("--especialidade", default="psiquiatria")
    ap.add_argument("--saida", type=Path, default=Path("acervo"))
    ap.add_argument("--paginas-por-doc", type=int, default=10)
    ap.add_argument("--primeira", type=int, default=1)
    ap.add_argument("--ultima", type=int)
    a = ap.parse_args()
    if not a.pdf.is_file():
        print(f"Arquivo não encontrado: {a.pdf}")
        return 1
    titulo = a.titulo or a.pdf.stem
    slug = a.slug or slugificar(titulo)
    destino = a.saida / a.especialidade / slug
    docs, pags = converter(
        a.pdf,
        destino,
        slug=slug,
        titulo=titulo,
        versao=a.versao,
        especialidade=a.especialidade,
        por_documento=a.paginas_por_doc,
        primeira=a.primeira,
        ultima=a.ultima,
    )
    print(f"{titulo}: {docs} documentos, {pags} páginas aproveitadas -> {destino}")
    return 0 if docs else 2


if __name__ == "__main__":
    sys.exit(main())
