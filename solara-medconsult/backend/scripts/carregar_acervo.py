"""Carrega o acervo de referência: lê .md/.txt, gera embeddings (OpenAI) e grava no pgvector.

Uso (na pasta backend):  .venv/Scripts/python -m scripts.carregar_acervo acervo
Formato dos arquivos: veja acervo/README.md. Rodar de novo é seguro: só reindexa o que mudou.

Por padrão (modo "replace") o acervo fica igual à pasta: depois de indexar, remove do banco os
documentos antigos da mesma fonte (livro) e especialidade que não estão mais na pasta (ex.: um PDF
reconvertido com outro título ou outras páginas). Isso só acontece se tudo foi indexado sem erro.
Carregar só parte de um livro não apaga o resto (proteção: abaixo de metade, nada é removido).
`--append` só acrescenta e atualiza, sem remover nada.
"""

import argparse
import sys
from pathlib import Path

from app import repositorio_rag as repo
from app.especialidades import ESPECIALIDADES
from app.motores import rag
from app.motores.embeddings import EmbeddingIndisponivel, OpenAIEmbedder
from app.repositorio_rag import criar_tabelas_rag


def listar_arquivos(pasta: str) -> list[Path]:
    """Arquivos a indexar. Pastas que começam com "_" (ex.: `_deprecated/`) ficam de fora."""
    raiz = Path(pasta)
    return sorted(
        p
        for p in raiz.rglob("*")
        if p.suffix in {".md", ".txt"}
        and p.name.lower() != "readme.md"
        and not any(parte.startswith("_") for parte in p.relative_to(raiz).parts[:-1])
    )


def remover_obsoletos(carregados: dict[tuple[str, str | None], set[str]]) -> int:
    """Remove do banco o que é da mesma fonte e especialidade, mas não veio nesta carga."""
    removidos = 0
    for (fonte, esp), ids in carregados.items():
        existentes = repo.ids_da_fonte(fonte, esp)
        obsoletos = existentes - ids
        if not obsoletos:
            continue
        if len(ids) * 2 < len(existentes):  # carga parcial: não apaga o resto do livro
            print(
                f"AVISO {fonte}: carga com {len(ids)} de {len(existentes)} documentos; "
                "nada removido (carregue a pasta inteira do livro, ou use --append)."
            )
            continue
        n = repo.remover_documentos(sorted(obsoletos))
        print(f"removidos {n} documentos obsoletos de {fonte}")
        removidos += n
    return removidos


def main(
    pasta: str,
    especialidade: str | None = None,
    *,
    substituir: bool = True,
    embedder=None,
) -> int:
    arquivos = listar_arquivos(pasta)
    if not arquivos:
        print(f"Nenhum .md/.txt em {pasta}.")
        return 1
    criar_tabelas_rag()
    embedder = embedder or OpenAIEmbedder()
    carregados: dict[tuple[str, str | None], set[str]] = {}
    contagem = {"indexado": 0, "inalterado": 0, "rejeitado": 0}
    for arq in arquivos:
        try:
            doc = rag.ler_documento(arq.read_text(encoding="utf-8"))
            if especialidade:
                from dataclasses import replace

                doc = replace(doc, especialidade=especialidade)
            estado = rag.indexar_documento(doc, embedder)
            carregados.setdefault((doc.fonte, doc.especialidade), set()).add(doc.id)
        except rag.DocumentoInvalido as exc:
            estado = "rejeitado"
            print(f"REJEITADO {arq.name}: {exc}")
        except EmbeddingIndisponivel as exc:
            print(f"ERRO {arq.name}: {exc} (nada foi gravado para este arquivo)")
            return 2
        contagem[estado] += 1
        if estado != "rejeitado":
            print(f"{estado:>10}  {arq.name}")
    print(contagem)
    if substituir and contagem["rejeitado"]:
        print("AVISO: houve arquivos rejeitados; nenhum documento antigo foi removido.")
    elif substituir:
        remover_obsoletos(carregados)
    return 0 if contagem["rejeitado"] == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pasta", nargs="?", default="acervo")
    parser.add_argument(
        "--especialidade",
        choices=sorted(ESPECIALIDADES),
        help="grava esta especialidade em todos os documentos da pasta (filtra a busca do RAG)",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="só acrescenta/atualiza; não remove documentos antigos da mesma fonte",
    )
    args = parser.parse_args()
    sys.exit(main(args.pasta, args.especialidade, substituir=not args.append))
