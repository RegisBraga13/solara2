import pytest

from app.especialidades.dermatologia import DERMATOLOGIA
from app.especialidades.psiquiatria import PSIQUIATRIA
from app.motores import busca_diretrizes as dr

PASTA = PSIQUIATRIA.pasta_diretrizes


@pytest.fixture(scope="module")
def todas():
    return dr.carregar(PASTA)


def test_sinteses_de_psiquiatria_carregadas_com_titulo_e_nomes_alternativos(todas):
    assert len(todas) >= 39
    for d in todas:
        assert d.titulo and not d.titulo.startswith("title:"), d.arquivo
        assert len(d.texto) > 5000, f"{d.arquivo} parece só um resumo"
    assert sum(1 for d in todas if d.aliases) >= 35  # cabeçalho `conditions:` lido


@pytest.mark.parametrize(
    ("diagnostico", "arquivo"),
    [
        ("Transtorno depressivo maior", "Episodios_Depressivos_e_Depressao_Maior.md"),
        ("Esquizofrenia", "Esquizofrenia.md"),
        ("Transtorno de pânico", "Ansiedade.md"),  # "do pânico" no cabeçalho
        ("TDAH", "Transtorno_de_Deficit_de_Atencao_e_Hiperatividade_TDAH.md"),  # sigla
        ("Transtorno bipolar tipo I", "Transtorno_Afetivo_Bipolar_TAB.md"),
        ("Insônia", "Transtornos_do_Sono_Vigilia.md"),
        ("Anorexia nervosa", "Transtornos_Alimentares.md"),
    ],
)
def test_diagnostico_acha_a_sintese_certa(diagnostico, arquivo):
    achadas = [d.arquivo for d in dr.para_diagnostico(diagnostico, PASTA)]
    assert achadas and achadas[0] == arquivo


def test_palavra_generica_ou_curta_demais_nao_casa_com_nada():
    assert dr.para_diagnostico("Transtorno", PASTA) == []
    assert dr.para_diagnostico("de", PASTA) == []
    assert dr.para_diagnostico("xyz inexistente", PASTA) == []


def test_dermatologia_continua_casando_pelo_titulo():
    achadas = dr.para_diagnostico("Psoríase", DERMATOLOGIA.pasta_diretrizes)
    assert [d.arquivo for d in achadas][:1] == ["02_psoriase.md"]


def test_resumo_para_ia_cabe_no_limite_e_leva_o_tratamento_que_fica_no_meio(todas):
    d = next(x for x in todas if x.arquivo.startswith("Episodios_Depressivos"))
    assert len(d.texto) > 30000
    r = dr.resumo_para_ia(d.texto, 10000)
    assert len(r) <= 10000
    titulos = [ln for ln in r.splitlines() if ln.startswith("## ")]
    assert "## Resumo executivo" in titulos
    assert any("tratamento" in t.lower() or "farmacoterapia" in t.lower() for t in titulos)
    assert not any("Referências" in t or "Glossário" in t for t in titulos)
    # a ordem original das seções é preservada
    ordem = [ln for ln in d.texto.splitlines() if ln.startswith("## ")]
    assert [t for t in ordem if t in titulos] == titulos


def test_resumo_para_ia_documento_curto_vai_inteiro():
    assert dr.resumo_para_ia("# A\n\n## B\ntexto", 6000) == "# A\n\n## B\ntexto"
    assert len(dr.resumo_para_ia("x" * 500, 100)) == 100
