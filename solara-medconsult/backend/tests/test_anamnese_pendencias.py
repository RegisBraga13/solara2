from app.config import settings
from app.especialidades import Especialidade
from app.motores import anamnese_pendencias as ap
from app.motores.diagnostico import Acao
from app.motores.embeddings import EmbeddingIndisponivel

ESP = Especialidade(
    slug="dermatologia",
    nome="Dermatologia",
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
    anamnese_categorias=("Fototipo e exposição solar", "Antecedente oncológico cutâneo"),
    anamnese_red_flags=("Sangramento ou ferida que não cicatriza", "Lesão com crescimento rápido"),
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


def test_verifica_pendencias_e_classifica_red_flags(monkeypatch):
    monkeypatch.setattr(ap, "atual", lambda: ESP)
    visto = {}

    def chat(modelo, prompt):
        visto["p"] = prompt
        return {
            "pendentes": [
                {
                    "topico": "Antecedente oncológico cutâneo",
                    "pergunta_sugerida": "Alguém na família já teve câncer de pele?",
                }
            ],
            "red_flags": [
                {"sinal": "Sangramento ou ferida que não cicatriza", "estado": "ausente"},
                {"sinal": "Lesão com crescimento rápido", "estado": "nao_verificado"},
            ],
        }

    r = ap.verificar_pendencias("paciente relata mancha há 2 meses", chat=chat)
    assert r.acao is Acao.HUMAN_REVIEW
    assert r.pendentes[0].topico == "Antecedente oncológico cutâneo"
    assert r.red_flags[0].estado is ap.EstadoRedFlag.AUSENTE
    assert r.red_flags[1].estado is ap.EstadoRedFlag.NAO_VERIFICADO
    assert "Fototipo e exposição solar" in visto["p"]
    assert "Sangramento ou ferida que não cicatriza" in visto["p"]
    assert "Não invente" in visto["p"] or "Não invente respostas" in visto["p"]
    assert r.modelo == settings.anamnese_pendencias_model


def test_descarta_red_flags_fora_da_lista_fixa(monkeypatch):
    monkeypatch.setattr(ap, "atual", lambda: ESP)

    def chat(modelo, prompt):
        return {
            "pendentes": [],
            "red_flags": [
                {"sinal": "Sangramento ou ferida que não cicatriza", "estado": "presente"},
                {"sinal": "Um sinal inventado pelo modelo", "estado": "presente"},
            ],
        }

    r = ap.verificar_pendencias("algo", chat=chat)
    assert len(r.red_flags) == 1
    assert r.red_flags[0].sinal == "Sangramento ou ferida que não cicatriza"


def test_registro_vazio_rejeita_sem_chamar_o_modelo(monkeypatch):
    monkeypatch.setattr(ap, "atual", lambda: ESP)

    def nunca(modelo, prompt):
        raise AssertionError("não deveria chamar o modelo")

    r = ap.verificar_pendencias("   ", chat=nunca)
    assert r.acao is Acao.REJECT and r.pendentes == [] and r.red_flags == []


def test_especialidade_sem_conteudo_rejeita_sem_chamar_o_modelo(monkeypatch):
    monkeypatch.setattr(ap, "atual", lambda: SEM_CONTEUDO)

    def nunca(modelo, prompt):
        raise AssertionError("não deveria chamar o modelo")

    r = ap.verificar_pendencias("algo", chat=nunca)
    assert r.acao is Acao.REJECT
    assert "semconteudo" in r.motivos[0]


def test_modelo_indisponivel_ou_saida_invalida_rejeita(monkeypatch):
    monkeypatch.setattr(ap, "atual", lambda: ESP)

    def cai(modelo, prompt):
        raise EmbeddingIndisponivel("fora")

    assert ap.verificar_pendencias("algo", chat=cai).acao is Acao.REJECT

    for ruim in ({}, {"pendentes": "x", "red_flags": []}, {"red_flags": []}):
        r = ap.verificar_pendencias("algo", chat=lambda m, p, r=ruim: r)
        assert r.acao is Acao.REJECT


def test_auditoria_sem_conteudo_clinico(monkeypatch, caplog):
    monkeypatch.setattr(ap, "atual", lambda: ESP)
    caplog.set_level("INFO", logger="medconsult.anamnese_pendencias")
    ap.verificar_pendencias(
        "segredo clínico sigiloso",
        chat=lambda m, p: {"pendentes": [], "red_flags": []},
    )
    assert "anamnese_pendencias id=" in caplog.text
    assert "segredo" not in caplog.text and "sigiloso" not in caplog.text
