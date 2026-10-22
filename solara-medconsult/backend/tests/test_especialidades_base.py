from app.especialidades import ESPECIALIDADES
from app.especialidades.base import agrupar, vocabulario_padrao
from app.motores import busca_diretrizes


def test_agrupar_monta_a_instrucao_com_exemplos_e_itens_sem_integrantes():
    texto = agrupar('termo "Exames" com ["a", "b"].', '"Retorno em 30 dias"')
    assert texto.startswith('AGRUPE medidas correlatas em UM item só: "termo"')
    assert 'Exemplos: termo "Exames" com ["a", "b"]. NUNCA crie' in texto
    assert 'Item sem integrantes (ex.: "Retorno em 30 dias") leva "componentes": [].' in texto


def test_vocabulario_padrao_troca_o_jargao_de_dermatologia():
    voc = dict(
        vocabulario_padrao(
            exame="Exame X",
            profissional="cardiologista",
            termos="termos cardíacos",
            nome="cardiologia",
        )
    )
    assert voc["médico dermatologista"] == "médico cardiologista"
    assert voc["livro de dermatologia"] == "livro de cardiologia"
    assert voc["dermatologia"] == "cardiologia"


def test_pasta_das_diretrizes_vem_do_slug():
    for slug, esp in ESPECIALIDADES.items():
        assert esp.pasta_diretrizes == busca_diretrizes.PASTA / slug
