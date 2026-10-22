"""Gera um esqueleto de especialidade clínica para o projeto Solara."""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

MODULO = '''"""{nome}: conteúdo clínico próprio."""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos='termo "Exames laboratoriais" com componentes ["TODO exame 1", "TODO exame 2"]',
    sem_integrantes='"Retorno em 30 dias"',
)

{constante} = Especialidade(
    slug="{slug}",
    nome="{nome}",
    propedeutica_objetivo="propedêutica em {slug_texto}",
    propedeutica_secoes={{
        "tratamento": "TODO: terapias, medicamentos e procedimentos",
        "investigacao": "TODO: exames para confirmar ou descartar o diagnóstico",
        "acompanhamento": "retorno, monitoramento e encaminhamento",
    }},
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag="tratamento e acompanhamento em {slug_texto} para {{diagnostico}}",
    propedeutica_consulta_web="Tratamento e acompanhamento de {{diagnostico}} em {slug_texto}.",
    orientacoes_objetivo="orientações gerais ao paciente em {slug_texto}",
    orientacoes_secoes={{
        "cuidados": "TODO: cuidados no dia a dia",
        "fotoprotecao": "TODO: adesão ao tratamento",
        "higiene": "TODO: sinais de alerta e seguimento",
    }},
    orientacoes_consulta_rag="orientações ao paciente com {{diagnostico}} em {slug_texto}",
    orientacoes_consulta_web="Orientações gerais para {{diagnostico}} em {slug_texto}.",
    dominios_web=("pubmed.ncbi.nlm.nih.gov",),
    vocabulario=vocabulario_padrao(
        exame="TODO: exame próprio da especialidade",
        profissional="médico da especialidade",
        termos="termos da especialidade",
        nome="{slug_texto}",
    ),
)
'''


def main(argv: list[str]) -> int:
    if len(argv) != 2 or not re.fullmatch(r"[a-z][a-z0-9_]*", argv[0]):
        print(__doc__)
        return 1
    slug, nome = argv
    modulo = RAIZ / "backend/app/especialidades" / f"{slug}.py"
    if modulo.exists():
        print(f"ERRO: {modulo.relative_to(RAIZ)} já existe.")
        return 1
    modulo.write_text(
        MODULO.format(nome=nome, slug=slug, constante=slug.upper(), slug_texto=nome.lower()),
        encoding="utf-8",
    )
    for pasta in (RAIZ / "backend/diretrizes" / slug, RAIZ / "backend/acervo" / slug):
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / ".gitkeep").touch()
    print(f"Especialidade '{slug}' criada.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
