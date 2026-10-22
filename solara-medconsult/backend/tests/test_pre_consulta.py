import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import pre_consulta as rota

client = TestClient(app)
PACIENTE_ID = str(uuid.uuid4())


class Banco:
    def __init__(self):
        self.fichas: dict[str, dict] = {}

    def obter_paciente(self, id_):
        return {"id": id_, "nome": "Maria Cadastrada"} if id_ == PACIENTE_ID else None

    def inserir_pre_consulta(self, **kw):
        id_ = str(uuid.uuid4())
        self.fichas[id_] = {"id": id_, "criado_em": "2026-10-16T09:00:00", **kw}
        return dict(self.fichas[id_])

    def pre_consultas_do_paciente(self, pid):
        return sorted(
            (dict(f) for f in self.fichas.values() if f["paciente_id"] == pid),
            key=lambda f: f["criado_em"],
            reverse=True,
        )


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    for nome in ("obter_paciente", "inserir_pre_consulta", "pre_consultas_do_paciente"):
        monkeypatch.setattr(rota.repositorio, nome, getattr(b, nome))
    monkeypatch.setattr(rota.settings, "especialidade", "dermatologia")
    return b


SEGURANCA_SEM_RISCO = {
    "historico_herpes_simples": False,
    "tendencia_queloide": False,
    "possui_marcapasso_ou_implante_metalico": False,
    "quimica_capilar_recente": False,
    "alergia_anestesico": False,
    "usa_anticoagulante": False,
}


def ficha(seguranca=None, **extra):
    corpo = {
        "queixa": {
            "queixa_principal": "Manchas no rosto",
            "duracao_queixa": "meses",
            "ja_tratou_antes": False,
            "categorias": ["manchas"],
        },
        "historico": {
            "exposicao_solar": True,
            "tipo_exposicao": "lazer",
            "queimadura_solar_infancia": False,
            "uso_camara_bronzeamento": False,
            "frequencia_protetor_solar": "as_vezes",
            "fototipo_fitzpatrick": 3,
            "historico_familiar_cancer_pele": False,
            "melanoma_familiar": False,
        },
        "saude": {
            "alergias": False,
            "medicamentos_uso_continuo": False,
            "tabagismo": "nunca",
            "etilismo": "social",
            "atividade_fisica": "leve",
        },
        "estetica": {
            "teve_complicacao": False,
            "usa_acidos": True,
            "tratamento_em_andamento": False,
        },
        "seguranca": seguranca or SEGURANCA_SEM_RISCO,
        "consentimento": {
            "aceite_informacoes_verdadeiras": True,
            "autoriza_imagens_prontuario": True,
            "aceite_lgpd": True,
            "nome_assinatura": "Maria Cadastrada",
        },
        **extra,
    }
    return corpo


def enviar(pid=PACIENTE_ID, **kw):
    return client.post(f"/pacientes/{pid}/pre-consulta", json=ficha(**kw))


def test_preenche_sem_risco(banco):
    r = enviar()
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["alerta_critico"] is False
    assert corpo["especialidade"] == "dermatologia"
    assert corpo["respostas"]["queixa"]["queixa_principal"] == "Manchas no rosto"


@pytest.mark.parametrize(
    "campo",
    ["historico_herpes_simples", "tendencia_queloide", "possui_marcapasso_ou_implante_metalico"],
)
def test_alerta_critico_por_fator_de_risco(banco, campo):
    r = enviar(seguranca={**SEGURANCA_SEM_RISCO, campo: True})
    assert r.status_code == 201
    assert r.json()["alerta_critico"] is True


def test_fator_sem_risco_nao_acende_alerta(banco):
    r = enviar(seguranca={**SEGURANCA_SEM_RISCO, "usa_anticoagulante": True})
    assert r.status_code == 201
    assert r.json()["alerta_critico"] is False


def test_consentimento_obrigatorio(banco):
    corpo = ficha()
    corpo["consentimento"]["aceite_lgpd"] = False
    assert client.post(f"/pacientes/{PACIENTE_ID}/pre-consulta", json=corpo).status_code == 422
    assert banco.fichas == {}


def test_paciente_inexistente(banco):
    assert enviar(pid=str(uuid.uuid4())).status_code == 404


def test_lista_por_paciente_mais_recente_primeiro(banco):
    enviar()
    enviar()
    r = client.get(f"/pacientes/{PACIENTE_ID}/pre-consulta")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_especialidade_sem_ficha_configurada(banco, monkeypatch):
    monkeypatch.setattr(rota.settings, "especialidade", "psiquiatria")
    assert enviar().status_code == 501
