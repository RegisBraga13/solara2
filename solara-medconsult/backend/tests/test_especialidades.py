import pytest

from app.config import settings
from app.especialidades import ESPECIALIDADES, atual
from app.especialidades.dermatologia import DERMATOLOGIA
from app.especialidades.psiquiatria import PSIQUIATRIA
from app.motores import orientacoes, propedeutica

CHAVES_PROPEDEUTICA = {"tratamento", "investigacao", "acompanhamento"}
CHAVES_ORIENTACOES = {"cuidados", "fotoprotecao", "higiene"}


def test_padrao_e_dermatologia_e_o_conteudo_anterior_nao_mudou():
    assert settings.especialidade == "dermatologia"
    assert atual() is DERMATOLOGIA
    assert propedeutica.TEMA.objetivo == "propedêutica (tratamento, investigação e acompanhamento)"
    assert "dermatoscopia" in propedeutica.TEMA.secoes["investigacao"]
    assert "protetor solar" in orientacoes.TEMA.secoes["fotoprotecao"]
    assert propedeutica.TEMA.consulta_web.endswith("em dermatologia.")


@pytest.mark.parametrize("esp", list(ESPECIALIDADES.values()), ids=lambda e: e.slug)
def test_toda_especialidade_define_as_mesmas_chaves_que_o_app_usa(esp):
    assert set(esp.propedeutica_secoes) == CHAVES_PROPEDEUTICA
    assert set(esp.orientacoes_secoes) == CHAVES_ORIENTACOES
    assert "{diagnostico}" in esp.propedeutica_consulta_rag
    assert "{diagnostico}" in esp.propedeutica_consulta_web
    assert "{diagnostico}" in esp.orientacoes_consulta_rag
    assert "{diagnostico}" in esp.orientacoes_consulta_web
    assert esp.dominios_web
    assert esp.propedeutica_agrupar and "componentes" in esp.propedeutica_agrupar


def test_dermatologia_nao_altera_prompts_e_psiquiatria_troca_o_vocabulario():
    texto = "Você apoia um médico dermatologista. Exame dermatológico (lesões e imagens)."
    assert DERMATOLOGIA.adaptar(texto) == texto
    adaptado = PSIQUIATRIA.adaptar(texto)
    assert "dermat" not in adaptado.lower()
    assert "psiquiatra" in adaptado and "Exame psíquico" in adaptado


def test_cada_especialidade_tem_a_propria_pasta_de_diretrizes():
    assert PSIQUIATRIA.pasta_diretrizes != DERMATOLOGIA.pasta_diretrizes
    assert PSIQUIATRIA.pasta_diretrizes.is_dir()
    from app.motores import busca_diretrizes as dr

    derm = {d.arquivo for d in dr.carregar(DERMATOLOGIA.pasta_diretrizes)}
    psiq = {d.arquivo for d in dr.carregar(PSIQUIATRIA.pasta_diretrizes)}
    assert psiq and derm and not (psiq & derm)  # uma não polui a outra


def test_especialidade_desconhecida_da_erro_claro(monkeypatch):
    monkeypatch.setattr(settings, "especialidade", "inexistente")
    validas = ", ".join(sorted(ESPECIALIDADES))  # acrescentar especialidade não quebra o teste
    with pytest.raises(ValueError, match=validas):
        atual()
