from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app import repositorio
from app.main import app
from app.routers import pacientes as rota_p
from app.routers import prontuarios as rota_r

client = TestClient(app)
LIMITE = repositorio.LIMITE_LISTA


def _paciente(i):
    return {"id": str(i), "nome": f"P{i}", "nascimento": None, "criado_em": datetime.now(UTC),
            "n_prontuarios": 0, "ultima_consulta": None}  # fmt: skip


def _prontuario(i):
    return {"id": str(i), "paciente": f"P{i}", "paciente_id": None, "modo": "online",
            "tipo": "nova", "criado_em": datetime.now(UTC)}  # fmt: skip


def test_limite_das_listas_e_500():
    assert LIMITE == 500


def test_pacientes_abaixo_do_limite_nao_trunca_e_nao_conta(monkeypatch):
    monkeypatch.setattr(rota_p.repositorio, "listar_pacientes", lambda q=None: [_paciente(1)])

    def nao_deveria(q=None):
        raise AssertionError("contou sem precisar")

    monkeypatch.setattr(rota_p.repositorio, "contar_pacientes", nao_deveria)
    r = client.get("/pacientes")
    assert r.status_code == 200 and len(r.json()) == 1
    assert r.headers["x-total-count"] == "1" and r.headers["x-truncado"] == "false"


def test_pacientes_no_limite_conta_e_avisa_que_truncou(monkeypatch):
    monkeypatch.setattr(
        rota_p.repositorio, "listar_pacientes", lambda q=None: [_paciente(i) for i in range(LIMITE)]
    )
    monkeypatch.setattr(rota_p.repositorio, "contar_pacientes", lambda q=None: LIMITE + 37)
    r = client.get("/pacientes")
    assert len(r.json()) == LIMITE
    assert r.headers["x-total-count"] == str(LIMITE + 37) and r.headers["x-truncado"] == "true"


def test_pacientes_exatamente_no_limite_nao_e_truncado(monkeypatch):
    monkeypatch.setattr(
        rota_p.repositorio, "listar_pacientes", lambda q=None: [_paciente(i) for i in range(LIMITE)]
    )
    monkeypatch.setattr(rota_p.repositorio, "contar_pacientes", lambda q=None: LIMITE)
    assert client.get("/pacientes").headers["x-truncado"] == "false"


@pytest.mark.parametrize("total,esperado", [(3, "false"), (LIMITE + 1, "true")])
def test_prontuarios_informam_total_e_truncamento(monkeypatch, total, esperado):
    n = min(total, LIMITE)
    monkeypatch.setattr(
        rota_r.repositorio, "listar_prontuarios", lambda: [_prontuario(i) for i in range(n)]
    )
    monkeypatch.setattr(rota_r.repositorio, "contar_prontuarios", lambda: total)
    r = client.get("/prontuarios")
    assert len(r.json()) == n
    assert r.headers["x-total-count"] == str(total) and r.headers["x-truncado"] == esperado
