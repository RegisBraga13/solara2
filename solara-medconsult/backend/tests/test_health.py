import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import health as health_module

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["app"] == "espec·IA·lidades"


def test_health_estrutura():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "medconsult-backend"
    assert set(body["checks"]) == {"postgres", "redis", "storage"}
    assert body["status"] in {"ok", "degraded"}


def test_health_degraded_quando_servico_falha(monkeypatch):
    def falha():
        raise ConnectionError("fora do ar")

    monkeypatch.setattr(health_module, "check_redis", falha)
    r = client.get("/health")
    body = r.json()
    assert body["status"] == "degraded"
    assert body["checks"]["redis"].startswith("erro")


def test_health_ok_com_servicos_reais():
    """Teste de integração: só roda se Postgres, Redis e o armazenamento S3 estiverem no ar."""
    body = client.get("/health").json()
    if body["status"] != "ok":
        pytest.skip(f"serviços indisponíveis: {body['checks']}")
    assert body["checks"] == {"postgres": "ok", "redis": "ok", "storage": "ok"}


def test_info_devolve_nome_mae_e_especialidade_ativa():
    r = client.get("/info")
    assert r.status_code == 200
    assert r.json() == {"nome_mae": "espec·IA·lidades", "especialidade_ativa": "dermatologia"}
