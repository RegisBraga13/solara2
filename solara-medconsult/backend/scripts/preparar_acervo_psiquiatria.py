"""Prepara o acervo de psiquiatria a partir da pasta de livros do médico.

Uso (na pasta backend):
    .venv/Scripts/python -m scripts.preparar_acervo_psiquiatria "C:/livros"

Converte cada livro da lista abaixo (se existir na pasta) para `acervo/psiquiatria/<slug>/`.
Os livros têm direitos autorais: a saída fica fora do git. Carregar no RAG depois:
    .venv/Scripts/python -m scripts.carregar_acervo acervo/psiquiatria --especialidade psiquiatria
"""

import sys
from pathlib import Path

from scripts.converter_pdf_livro import converter

# (arquivo, slug, título, edição). Gêneros de leitura (para uma futura busca por escopo):
# criterios, psicopatologia, sindromes, terapeutica, tratado, psicofarmacologia, entrevista.
LIVROS = [
    ("DSM-5-TR - Português - edição atualizada.pdf", "dsm5tr", "DSM-5-TR", "edição atualizada"),
    (
        "Psicopatologia - Dalgalarrondo.pdf",
        "dalgalarrondo",
        "Psicopatologia e Semiologia dos Transtornos Mentais - Dalgalarrondo",
        "",
    ),
    (
        "Manual de Psicopatologia - Elie Cheniaux - 6ª edição.pdf",
        "cheniaux",
        "Manual de Psicopatologia - Cheniaux",
        "6a ed.",
    ),
    (
        "Clínica Psiquiátrica - Volume 1 - Os fundamentos da psiquiatria.pdf",
        "fmusp-v1",
        "Clínica Psiquiátrica FMUSP vol. 1 - Fundamentos",
        "",
    ),
    (
        "Clínica Psiquiátrica - Volume 2 - As grandes síndromes psiquiátricas.pdf",
        "fmusp-v2",
        "Clínica Psiquiátrica FMUSP vol. 2 - Grandes síndromes",
        "",
    ),
    (
        "Clínica Psiquiátrica - Volume 3 - A terapêutica psiquiátrica.pdf",
        "fmusp-v3",
        "Clínica Psiquiátrica FMUSP vol. 3 - Terapêutica",
        "",
    ),
    (
        "Clínica Psiquiátrica - Guia Prático - 2ª edição.pdf",
        "fmusp-guia",
        "Clínica Psiquiátrica FMUSP - Guia Prático",
        "2a ed.",
    ),
    (
        "Clínica Psiquiátrica de Bolso - 3ª edição - 2023.pdf",
        "ipq-bolso",
        "Clínica Psiquiátrica de Bolso - IPq",
        "3a ed. 2023",
    ),
    (
        "Condutas em Psiquiatria - 1ª edição - 2021.pdf",
        "condutas",
        "Condutas em Psiquiatria - Baldacara e Teng",
        "1a ed. 2021",
    ),
    (
        "Tratado de Psiquiatria - ABP - 2022.pdf",
        "abp-tratado",
        "Tratado de Psiquiatria - ABP",
        "2022",
    ),
    (
        "Psicofarmacologia - Da Teoria à Clínica - 1ª edição - 2025.pdf",
        "psicofarmaco-2025",
        "Psicofarmacologia: da Teoria à Clínica",
        "1a ed. 2025",
    ),
    (
        "A Entrevista Psiquiátrica na Prática Clínica - 3ª edição.pdf",
        "entrevista",
        "A Entrevista Psiquiátrica na Prática Clínica",
        "3a ed.",
    ),
    (
        "Psicopatologia Clínica e Entrevista Psiquiátrica.pdf",
        "psicopat-entrevista",
        "Psicopatologia Clínica e Entrevista Psiquiátrica",
        "",
    ),
    (
        "Manual do Residente de Psiquiatria - 2023.pdf",
        "residente",
        "Manual do Residente de Psiquiatria",
        "2023",
    ),
]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    pasta = Path(sys.argv[1])
    saida = Path("acervo")
    total_docs = 0
    for arquivo, slug, titulo, versao in LIVROS:
        pdf = pasta / arquivo
        if not pdf.is_file():
            print(f"FALTA   {arquivo}")
            continue
        docs, pags = converter(
            pdf,
            saida / "psiquiatria" / slug,
            slug=slug,
            titulo=titulo,
            versao=versao,
            especialidade="psiquiatria",
            por_documento=10,
            primeira=1,
            ultima=None,
        )
        total_docs += docs
        print(f"OK      {titulo}: {docs} documentos, {pags} páginas", flush=True)
    print(f"Total: {total_docs} documentos em acervo/psiquiatria/")
    return 0 if total_docs else 2


if __name__ == "__main__":
    sys.exit(main())
