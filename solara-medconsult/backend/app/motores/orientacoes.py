"""Orientações gerais ao paciente (tela 7): três seções (cuidados, fotoproteção, higiene).

Os títulos e o significado de cada seção vêm da especialidade ativa (`app/especialidades/`).
Veja `listas.py` para o funcionamento (fontes escolhidas pelo médico, revisão humana sempre).
"""

from app.especialidades import atual
from app.motores.listas import Sugestao, Tema, sugerir

_E = atual()
TEMA = Tema(
    nome="orientacoes",
    objetivo=_E.orientacoes_objetivo,
    secoes=_E.orientacoes_secoes,
    maximo=12,
    consulta_rag=_E.orientacoes_consulta_rag,
    consulta_web=_E.orientacoes_consulta_web,
    so_secao_terapeutica=False,
)


def sugerir_orientacoes(diagnostico: str, **kwargs) -> Sugestao:
    return sugerir(TEMA, diagnostico, **kwargs)
