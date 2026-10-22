import pytest

from app.especialidades.dermatologia import DERMATOLOGIA
from app.motores import busca_diretrizes as dr

PASTA = DERMATOLOGIA.pasta_diretrizes


def test_carrega_as_120_diretrizes_com_titulo_e_grupo():
    todas = dr.carregar(PASTA)
    assert len(todas) == 120  # 70 do primeiro pacote + 50 com diretriz terapêutica
    assert all(d.titulo and d.nucleo and d.texto for d in todas)
    assert {d.grupo for d in todas} == {"pediatrico", "adulto_idoso", "geral"}
    assert len({d.arquivo for d in todas}) == 120  # nenhum arquivo repetido


@pytest.mark.parametrize(
    "diagnostico, arquivo",
    [
        ("psoríase vulgar", "02_psoriase.md"),
        ("Psoriase", "02_psoriase.md"),  # sem acento, caixa diferente
        ("melasma", "06_melasma.md"),
        ("rosácea", "04_rosacea.md"),
        ("Lúpus eritematoso sistêmico (LES)", "Lupus_eritematoso_sistemico.md"),
        ("sarcoidose", "Sarcoidose.md"),
        ("herpes-zóster", "07_herpes_zoster.md"),
        # pacote com diretriz terapêutica
        ("pênfigo vulgar", "Penfigo_vulgar.md"),
        ("esporotricose", "Esporotricose_cutanea.md"),
        ("Síndrome de Stevens-Johnson", "SSJ_NET.md"),
        ("síndrome de Sézary", "Linfoma_cutaneo_celulas_T.md"),
        ("micose fungoide", "Linfoma_cutaneo_celulas_T.md"),
        ("Dermatite herpetiforme", "Dermatite_herpetiforme.md"),
    ],
)
def test_acha_a_diretriz_pelo_nome_da_doenca(diagnostico, arquivo):
    achadas = dr.para_diagnostico(diagnostico, PASTA)
    assert achadas and arquivo in [d.arquivo for d in achadas[:2]]


@pytest.mark.parametrize(
    "diagnostico",
    [
        "síndrome DRESS",  # sem diretriz na pasta: não inventa
        "calcifilaxia",
        "doença de Degos",
        "",
        "pele",  # curto/genérico demais
    ],
)
def test_sem_diretriz_devolve_lista_vazia(diagnostico):
    assert dr.para_diagnostico(diagnostico, PASTA) == []


def test_as_50_novas_trazem_a_diretriz_terapeutica():
    novas = [d for d in dr.carregar(PASTA) if "## Diretriz terapêutica resumida" in d.texto]
    assert len(novas) == 50


def test_nucleo_remove_faixa_etaria_e_parenteses():
    assert dr._nucleo("Psoríase em adultos de 40–59 anos") == "psoriase"
    assert dr._nucleo("Queratose actínica no idoso") == "queratose actinica"
    assert (
        dr._nucleo("Síndrome dos ovários policísticos (SOP)") == "sindrome dos ovarios policisticos"
    )
