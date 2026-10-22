import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import documentos as rota

client = TestClient(app)
PDF = b"%PDF-1.4\n%documento\n"
PACIENTE_ID = str(uuid.uuid4())


class Banco:
    def __init__(self):
        self.documentos: dict[str, dict] = {}
        self.arquivos: dict[str, bytes] = {}

    def obter_paciente(self, id_):
        return {"id": id_, "nome": "Maria Cadastrada"} if id_ == PACIENTE_ID else None

    def inserir_documento(self, **kw):
        id_ = str(uuid.uuid4())
        self.documentos[id_] = {"id": id_, "criado_em": datetime.now(UTC), "session_id": None, **kw}
        return dict(self.documentos[id_])

    def documentos_do_paciente(self, pid, tipo):
        return [d for d in self.documentos.values() if d["paciente_id"] == pid and d["tipo"] == tipo]

    def obter_documento(self, id_):
        d = self.documentos.get(id_)
        return dict(d) if d else None


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    for nome in ("obter_paciente", "inserir_documento", "documentos_do_paciente", "obter_documento"):
        monkeypatch.setattr(rota.repositorio, nome, getattr(b, nome))
    monkeypatch.setattr(rota.storage, "upload_object", lambda k, d, t: b.arquivos.update({k: d}))
    monkeypatch.setattr(rota.storage, "get_object", lambda k: b.arquivos[k])
    monkeypatch.setattr(rota.storage, "delete_object", lambda k: b.arquivos.pop(k, None))
    return b


def emitir_atestado(pdf=PDF, **campos):
    dados = {
        "medico_nome": "Dr. Fulano de Tal",
        "medico_crm": "CRM 12345/SP",
        "dias_afastamento": 3,
        "data_inicial": "2026-10-19",
        "cidade": "São Paulo",
        "paciente_id": PACIENTE_ID,
        **campos,
    }
    return client.post("/atestados", data=dados, files={"pdf": ("a.pdf", pdf)})


def emitir_declaracao(pdf=PDF, **campos):
    dados = {
        "medico_nome": "Dr. Fulano de Tal",
        "medico_crm": "CRM 12345/SP",
        "data": "2026-10-19",
        "hora_inicio": "09:00",
        "hora_fim": "10:30",
        "cidade": "São Paulo",
        "paciente_id": PACIENTE_ID,
        **campos,
    }
    return client.post("/declaracoes", data=dados, files={"pdf": ("d.pdf", pdf)})


def test_emite_atestado_sem_cid_e_baixa(banco):
    r = emitir_atestado()
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["tipo"] == "atestado"
    assert corpo["paciente"] == "Maria Cadastrada"
    assert corpo["conteudo"] == {
        "dias_afastamento": 3,
        "data_inicial": "2026-10-19",
        "cidade": "São Paulo",
        "cid": None,
    }
    assert "pdf_object_name" not in corpo
    pdf = client.get(f"/documentos/{corpo['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content == PDF
    lista = client.get(f"/pacientes/{PACIENTE_ID}/atestados").json()
    assert len(lista) == 1 and lista[0]["id"] == corpo["id"]


def test_emite_atestado_com_cid(banco):
    r = emitir_atestado(cid="l40")
    assert r.status_code == 201
    assert r.json()["conteudo"]["cid"] == "L40"  # normalizado em caixa alta


def test_emite_declaracao_e_baixa(banco):
    r = emitir_declaracao()
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["tipo"] == "declaracao_comparecimento"
    assert corpo["conteudo"] == {
        "data": "2026-10-19",
        "hora_inicio": "09:00",
        "hora_fim": "10:30",
        "cidade": "São Paulo",
    }
    pdf = client.get(f"/documentos/{corpo['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content == PDF
    lista = client.get(f"/pacientes/{PACIENTE_ID}/declaracoes").json()
    assert len(lista) == 1


def test_atestados_e_declaracoes_nao_se_misturam(banco):
    emitir_atestado()
    emitir_declaracao()
    assert len(client.get(f"/pacientes/{PACIENTE_ID}/atestados").json()) == 1
    assert len(client.get(f"/pacientes/{PACIENTE_ID}/declaracoes").json()) == 1


@pytest.mark.parametrize(
    "campos",
    [
        {"dias_afastamento": 0},
        {"dias_afastamento": 366},
        {"data_inicial": "não é data"},
    ],
)
def test_atestado_invalido(banco, campos):
    assert emitir_atestado(**campos).status_code == 422
    assert banco.documentos == {}


@pytest.mark.parametrize(
    "campos",
    [{"data": "não é data"}, {"hora_inicio": "25:99"}, {"hora_fim": "meio-dia"}],
)
def test_declaracao_invalida(banco, campos):
    assert emitir_declaracao(**campos).status_code == 422
    assert banco.documentos == {}


def test_pdf_invalido(banco):
    assert emitir_atestado(pdf=b"nao e pdf").status_code == 415
    assert banco.arquivos == {}


def test_paciente_inexistente_ou_ausente(banco):
    assert emitir_atestado(paciente_id=str(uuid.uuid4())).status_code == 422
    assert emitir_atestado(paciente_id="").status_code == 422


def test_paciente_avulso_com_nome(banco):
    assert emitir_atestado(paciente_id="", paciente="Avulso da Silva").status_code == 201


def test_nao_ha_edicao_nem_exclusao(banco):
    id_ = emitir_atestado().json()["id"]
    assert client.delete(f"/documentos/{id_}").status_code in (404, 405)
    assert client.put(f"/documentos/{id_}").status_code in (404, 405)
