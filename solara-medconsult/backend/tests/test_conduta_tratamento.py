import pytest

from app.config import settings
from app.especialidades import Especialidade
from app.motores import conduta_tratamento as ct
from app.motores.diagnostico import Acao
from app.motores.embeddings import EmbeddingIndisponivel
from app.motores.listas import Fonte

ESP = Especialidade(
    slug="dermatologia",
    nome="Dermatologia",
    propedeutica_objetivo="x",
    propedeutica_secoes={},
    propedeutica_agrupar=None,
    propedeutica_consulta_rag="tratamento de {diagnostico}",
    propedeutica_consulta_web="Tratamento de {diagnostico}.",
    orientacoes_objetivo="x",
    orientacoes_secoes={},
    orientacoes_consulta_rag="x",
    orientacoes_consulta_web="x",
    dominios_web=(),
    conduta_objetivo="conduta: exames e orientações gerais",
    investigacao_objetivo="investigação: exames, biópsia, parecer de especialista",
    tratamento_objetivo="tratamento: medicamento, dose e dias",
)

SEM_CONTEUDO = Especialidade(
    slug="semconteudo",
    nome="Sem Conteúdo",
    propedeutica_objetivo="x",
    propedeutica_secoes={},
    propedeutica_agrupar=None,
    propedeutica_consulta_rag="x",
    propedeutica_consulta_web="x",
    orientacoes_objetivo="x",
    orientacoes_secoes={},
    orientacoes_consulta_rag="x",
    orientacoes_consulta_web="x",
    dominios_web=(),
)


@pytest.fixture(autouse=True)
def especialidade(monkeypatch):
    monkeypatch.setattr(ct, "atual", lambda: ESP)


def _sem_material(monkeypatch, **overrides):
    monkeypatch.setattr(ct, "_material_rag", overrides.get("rag", lambda *a, **k: ""))
    monkeypatch.setattr(ct, "_material_diretrizes", overrides.get("diretrizes", lambda *a, **k: ""))
    monkeypatch.setattr(ct, "_material_web", overrides.get("web", lambda *a, **k: ""))


def test_gera_texto_a_partir_do_material_das_fontes_escolhidas(monkeypatch):
    visto = {}
    monkeypatch.setattr(ct, "_material_rag", lambda *a, **k: "biópsia confirma psoríase")
    monkeypatch.setattr(ct, "_material_diretrizes", lambda *a, **k: "corticoide tópico de 1a linha")
    monkeypatch.setattr(ct, "_material_web", lambda *a, **k: "")

    def chat(modelo, prompt):
        visto["p"] = prompt
        return {"texto": "Solicitar biópsia. Iniciar corticoide tópico."}

    r = ct.gerar_conduta(
        "Psoríase", embedder=object(), chat=chat, fontes=[Fonte.RAG, Fonte.DIRETRIZES, Fonte.WEB]
    )
    assert r.acao is Acao.HUMAN_REVIEW
    assert r.texto == "Solicitar biópsia. Iniciar corticoide tópico."
    assert "biópsia confirma psoríase" in visto["p"]
    assert "corticoide tópico de 1a linha" in visto["p"]
    assert "conduta: exames e orientações gerais" in visto["p"]
    assert r.modelo == settings.tratamento_model


def test_so_ai_basta_mesmo_sem_material_das_outras_fontes(monkeypatch):
    _sem_material(monkeypatch)
    r = ct.gerar_tratamento(
        "Psoríase",
        embedder=object(),
        chat=lambda m, p: {"texto": "Corticoide tópico."},
        fontes=[Fonte.AI],
    )
    assert r.acao is Acao.HUMAN_REVIEW and r.texto == "Corticoide tópico."


def test_sem_fonte_nem_ai_sem_material_rejeita_sem_chamar_o_modelo(monkeypatch):
    _sem_material(monkeypatch)

    def nunca(m, p):
        raise AssertionError("não deveria chamar o modelo")

    r = ct.gerar_conduta("Psoríase", embedder=object(), chat=nunca, fontes=[Fonte.RAG])
    assert r.acao is Acao.REJECT and r.motivos == ["nenhuma fonte devolveu material"]


def test_diagnostico_vazio_ou_sem_fonte_rejeita(monkeypatch):
    _sem_material(monkeypatch)
    vazio = ct.gerar_conduta("   ", embedder=object(), chat=lambda m, p: {}, fontes=[Fonte.AI])
    assert vazio.acao is Acao.REJECT
    sem_fonte = ct.gerar_conduta("Psoríase", embedder=object(), chat=lambda m, p: {}, fontes=[])
    assert sem_fonte.acao is Acao.REJECT


def test_colado_basta_mesmo_sem_fonte_nem_ai(monkeypatch):
    _sem_material(monkeypatch)
    visto = {}

    def chat(modelo, prompt):
        visto["p"] = prompt
        return {"texto": "Conduta a partir do colado."}

    r = ct.gerar_conduta(
        "Psoríase", embedder=object(), chat=chat, fontes=[], colado="Trecho colado da OpenEvidence"
    )
    assert r.acao is Acao.HUMAN_REVIEW
    assert r.texto == "Conduta a partir do colado."
    assert "Trecho colado da OpenEvidence" in visto["p"]
    assert "[Colado pelo médico]" in visto["p"]


def test_sem_fonte_e_sem_colado_rejeita(monkeypatch):
    _sem_material(monkeypatch)
    r = ct.gerar_conduta(
        "Psoríase", embedder=object(), chat=lambda m, p: {}, fontes=[], colado="   "
    )
    assert r.acao is Acao.REJECT and r.motivos == ["nenhuma fonte escolhida"]


def test_especialidade_sem_conteudo_rejeita_sem_chamar_nada(monkeypatch):
    monkeypatch.setattr(ct, "atual", lambda: SEM_CONTEUDO)
    _sem_material(monkeypatch)

    def nunca(m, p):
        raise AssertionError("não deveria chamar o modelo")

    r = ct.gerar_conduta("Psoríase", embedder=object(), chat=nunca, fontes=[Fonte.AI])
    assert r.acao is Acao.REJECT and "semconteudo" in r.motivos[0]


def test_fonte_indisponivel_registra_aviso_mas_segue_com_as_outras(monkeypatch):
    def cai(*a, **k):
        raise EmbeddingIndisponivel("fora")

    monkeypatch.setattr(ct, "_material_rag", cai)
    monkeypatch.setattr(ct, "_material_diretrizes", lambda *a, **k: "material das diretrizes")
    monkeypatch.setattr(ct, "_material_web", lambda *a, **k: "")
    r = ct.gerar_conduta(
        "Psoríase",
        embedder=object(),
        chat=lambda m, p: {"texto": "ok"},
        fontes=[Fonte.RAG, Fonte.DIRETRIZES],
    )
    assert r.acao is Acao.HUMAN_REVIEW
    assert "Fonte RAG indisponível." in r.avisos


def test_modelo_indisponivel_ou_saida_invalida_ou_vazia_rejeita(monkeypatch):
    _sem_material(monkeypatch, rag=lambda *a, **k: "algo")

    def cai(m, p):
        raise EmbeddingIndisponivel("fora")

    r = ct.gerar_conduta("Psoríase", embedder=object(), chat=cai, fontes=[Fonte.RAG])
    assert r.acao is Acao.REJECT

    for ruim in ({}, {"texto": ""}, {"texto": "   "}):
        r = ct.gerar_conduta(
            "Psoríase", embedder=object(), chat=lambda m, p, r=ruim: r, fontes=[Fonte.RAG]
        )
        assert r.acao is Acao.REJECT


def test_conduta_e_tratamento_usam_secoes_diferentes_da_diretriz():
    assert ct.conduta().so_terapeutica is False  # conduta: texto completo (inclui investigação)
    assert ct.tratamento().so_terapeutica is True  # tratamento: só a seção terapêutica
    assert ct.conduta().objetivo == ESP.conduta_objetivo
    assert ct.tratamento().objetivo == ESP.tratamento_objetivo


def test_investigacao_usa_seu_proprio_objetivo(monkeypatch):
    sec = ct.investigacao()
    assert sec.objetivo == ESP.investigacao_objetivo
    assert sec.so_terapeutica is False


def test_gerar_investigacao_gera_texto_a_partir_do_material(monkeypatch):
    monkeypatch.setattr(ct, "_material_rag", lambda *a, **k: "biópsia recomendada")
    monkeypatch.setattr(ct, "_material_diretrizes", lambda *a, **k: "")
    monkeypatch.setattr(ct, "_material_web", lambda *a, **k: "")
    r = ct.gerar_investigacao(
        "Psoríase",
        embedder=object(),
        chat=lambda m, p: {"texto": "Solicitar biópsia com histopatológico."},
        fontes=[Fonte.RAG],
    )
    assert r.acao is Acao.HUMAN_REVIEW
    assert r.texto == "Solicitar biópsia com histopatológico."


def test_orientacoes_usa_seu_proprio_objetivo_e_consultas(monkeypatch):
    sec = ct.orientacoes()
    assert sec.objetivo == ESP.orientacoes_objetivo
    assert sec.consulta_rag == ESP.orientacoes_consulta_rag
    assert sec.consulta_web == ESP.orientacoes_consulta_web
    assert sec.so_terapeutica is False


def test_gerar_orientacoes_gera_texto_a_partir_do_material(monkeypatch):
    monkeypatch.setattr(ct, "_material_rag", lambda *a, **k: "protetor solar diário")
    monkeypatch.setattr(ct, "_material_diretrizes", lambda *a, **k: "")
    monkeypatch.setattr(ct, "_material_web", lambda *a, **k: "")
    r = ct.gerar_orientacoes(
        "Psoríase",
        embedder=object(),
        chat=lambda m, p: {"texto": "Use protetor solar todos os dias."},
        fontes=[Fonte.RAG],
    )
    assert r.acao is Acao.HUMAN_REVIEW
    assert r.texto == "Use protetor solar todos os dias."


def test_auditoria_sem_conteudo_clinico(monkeypatch, caplog):
    _sem_material(monkeypatch, rag=lambda *a, **k: "segredo clínico")
    caplog.set_level("INFO", logger="medconsult.conduta_tratamento")
    ct.gerar_conduta(
        "Psoríase sigilosa",
        embedder=object(),
        chat=lambda m, p: {"texto": "texto sigiloso"},
        fontes=[Fonte.RAG],
    )
    assert "conduta id=" in caplog.text
    for proibido in ("segredo", "sigiloso", "Psoríase"):
        assert proibido not in caplog.text
