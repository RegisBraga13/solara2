"""Propedêutica (tela 6): tratamento + investigação + acompanhamento, juntos.

Investigar e tratar andam juntos; por isso são três seções da mesma lista. O conteúdo (seções,
exemplos de agrupamento, consultas) vem da especialidade ativa: `app/especialidades/`.
Veja `listas.py` para o funcionamento (fontes escolhidas pelo médico, revisão humana sempre).
"""

from app.especialidades import atual
from app.motores.listas import Sugestao, Tema, sugerir

_E = atual()
# Medidas correlatas viram UM bloco (um chip), em vez de dezenas de itens soltos.
AGRUPAR = _E.propedeutica_agrupar
TEMA = Tema(
    nome="propedeutica",
    objetivo=_E.propedeutica_objetivo,
    secoes=_E.propedeutica_secoes,
    maximo=18,
    agrupar=AGRUPAR,
    consulta_rag=_E.propedeutica_consulta_rag,
    consulta_web=_E.propedeutica_consulta_web,
    so_secao_terapeutica=False,
)


def sugerir_propedeutica(diagnostico: str, **kwargs) -> Sugestao:
    return sugerir(TEMA, diagnostico, **kwargs)
