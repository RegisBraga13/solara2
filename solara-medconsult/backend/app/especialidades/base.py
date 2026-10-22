"""Peças comuns para escrever uma especialidade sem repetir texto.

Aqui só entra o que é igual em todas. O que é clínico (seções, exemplos, domínios, escalas) fica
no módulo de cada especialidade. Este arquivo não define nenhuma `Especialidade`.
"""

_AGRUPAR_ABERTURA = (
    'AGRUPE medidas correlatas em UM item só: "termo" é o nome do grupo e "componentes" lista os '
    "integrantes. Exemplos: "
)
_AGRUPAR_FECHAMENTO = (
    "NUNCA crie um item por exame ou por medicamento quando couberem num grupo. Use no máximo 5 "
    "itens por seção. Item sem integrantes (ex.: {sem_integrantes}) leva "
    '"componentes": [].'
)


def agrupar(exemplos: str, sem_integrantes: str) -> str:
    """Instrução que faz o modelo agrupar medidas correlatas em um bloco (um chip).

    `exemplos`: grupos típicos da especialidade (ex.: 'termo "Exames laboratoriais" com [...]').
    `sem_integrantes`: itens que não são grupo (ex.: '"Retorno em 30 dias"').
    """
    fecho = _AGRUPAR_FECHAMENTO.format(sem_integrantes=sem_integrantes)
    return f"{_AGRUPAR_ABERTURA}{exemplos} {fecho}"


def vocabulario_padrao(
    *, exame: str, profissional: str, termos: str, nome: str, imagem: str = "exame de imagem"
) -> tuple[tuple[str, str], ...]:
    """Trocas de vocabulário que tiram o jargão de dermatologia dos prompts (a mais longa primeiro).

    Ex.: exame="Exame articular (articulações)", profissional="reumatologista",
    termos="termos reumatológicos", nome="reumatologia".
    """
    return (
        ("Exame dermatológico (lesões e imagens)", exame),
        ("médico dermatologista", f"médico {profissional}"),
        ("termos dermatológicos", termos),
        ("livro de dermatologia", f"livro de {nome}"),
        ("imagem dermatológica", imagem),
        ("dermatologista", profissional),
        ("dermatologia", nome),
    )
