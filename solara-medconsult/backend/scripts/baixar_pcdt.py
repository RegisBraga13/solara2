"""Baixa um PCDT (Protocolo Clínico e Diretriz Terapêutica) do Ministério da Saúde e extrai o
texto do PDF, para servir de material de apoio na redação manual de uma diretriz (ver
`backend/diretrizes/README.md` e `app/motores/busca_diretrizes.py`).

Este script NÃO escreve direto em `diretrizes/`: as diretrizes do projeto são sínteses redigidas
no estilo próprio (título, seções curtas) e revisadas por um médico, não cópias de um documento
externo. A saída aqui é só o texto bruto extraído do PDF oficial, com a data de atualização do
Ministério, para alguém (ou uma sessão de edição assistida) usar como referência ao escrever a
diretriz de verdade.

Uso (na pasta backend):
    .venv/Scripts/python -m scripts.baixar_pcdt \\
        "https://www.gov.br/saude/pt-br/assuntos/pcdt/d/doenca-de-parkinson/view" \\
        --saida /tmp/pcdt

Licença do portal: Creative Commons Atribuição-SemDerivações 3.0 (CC BY-ND) — o texto extraído é
só para leitura/referência interna, não deve ser publicado nem redistribuído como está.
"""

import argparse
import re
import sys
from pathlib import Path

import httpx
import pymupdf

_RE_DOWNLOAD = re.compile(r'href="([^"]+/@@download/file)"')
_RE_TITULO = re.compile(r"<title>\s*(.*?)\s*(?:—.*)?</title>", re.S)
_RE_ATUALIZADO = re.compile(
    r'documentModified.*?<span class="value">\s*([\d/]+)', re.S
)


def resolver(url_view: str) -> tuple[str, str, str]:
    """(titulo, data_atualizacao, url_download) a partir da página /view do PCDT."""
    r = httpx.get(url_view, timeout=30.0, follow_redirects=True)
    r.raise_for_status()
    html = r.text
    m_download = _RE_DOWNLOAD.search(html)
    if not m_download:
        raise ValueError(f"Link de download não encontrado em {url_view}")
    m_titulo = _RE_TITULO.search(html)
    m_data = _RE_ATUALIZADO.search(html)
    titulo = m_titulo.group(1).strip() if m_titulo else url_view.rstrip("/").rsplit("/", 1)[-1]
    data = m_data.group(1).strip() if m_data else ""
    return titulo, data, m_download.group(1)


def extrair_texto(pdf: Path) -> str:
    doc = pymupdf.open(str(pdf))
    paginas = [doc[i].get_text() for i in range(len(doc))]
    corpo = "\n\n".join(p.strip() for p in paginas if p.strip())
    corpo = re.sub(r"(\w)-\n(\w)", r"\1\2", corpo)
    return corpo.strip()


def baixar(url_view: str, saida: Path) -> Path:
    titulo, data, url_download = resolver(url_view)
    saida.mkdir(parents=True, exist_ok=True)
    pdf = saida / "fonte.pdf"
    with httpx.stream("GET", url_download, timeout=60.0, follow_redirects=True) as resp:
        resp.raise_for_status()
        with pdf.open("wb") as f:
            for parte in resp.iter_bytes():
                f.write(parte)
    texto = extrair_texto(pdf)
    cab = (
        f"titulo: {titulo}\n"
        f"fonte: PCDT - Ministério da Saúde\n"
        f"url: {url_view}\n"
        f"atualizado_em: {data}\n\n"
    )
    md = saida / "fonte.md"
    md.write_text(cab + texto + "\n", encoding="utf-8")
    return md


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("url_view", help="URL da página .../pcdt/<letra>/<doenca>/view")
    ap.add_argument("--saida", type=Path, required=True)
    a = ap.parse_args()
    md = baixar(a.url_view, a.saida)
    print(f"Gravado em {md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
