import json
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import receitas as rota

client = TestClient(app)
PDF = b"%PDF-1.4\n%receita\n"
PACIENTE_ID = str(uuid.uuid4())


class Banco:
    def __init__(self):
        self.receitas: dict[str, dict] = {}
        self.arquivos: dict[str, bytes] = {}

    def obter_paciente(self, id_):
        return {"id": id_, "nome": "Maria Cadastrada"} if id_ == PACIENTE_ID else None

    def inserir_receita(self, **kw):
        id_ = str(uuid.uuid4())
        self.receitas[id_] = {"id": id_, "criado_em": datetime.now(UTC), "session_id": None, **kw}
        return dict(self.receitas[id_])

    def receitas_do_paciente(self, pid):
        return [dict(r) for r in self.receitas.values() if r["paciente_id"] == pid]

    def obter_receita(self, id_):
        r = self.receitas.get(id_)
        return dict(r) if r else None


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    for nome in ("obter_paciente", "inserir_receita", "receitas_do_paciente", "obter_receita"):
        monkeypatch.setattr(rota.repositorio, nome, getattr(b, nome))
    monkeypatch.setattr(rota.storage, "upload_object", lambda k, d, t: b.arquivos.update({k: d}))
    monkeypatch.setattr(rota.storage, "get_object", lambda k: b.arquivos[k])
    monkeypatch.setattr(rota.storage, "delete_object", lambda k: b.arquivos.pop(k, None))
    return b


ITENS = [
    {"medicamento": "Isotretinoína 20 mg", "posologia": "1 cápsula ao dia", "duracao": "30 dias"}
]


def emitir(itens=ITENS, pdf=PDF, **campos):
    dados = {
        "itens": json.dumps(itens),
        "medico_nome": "Dr. Fulano de Tal",
        "medico_crm": "CRM 12345/SP",
        "paciente_id": PACIENTE_ID,
        **campos,
    }
    return client.post("/receitas", data=dados, files={"pdf": ("r.pdf", pdf)})


def test_emite_e_baixa(banco):
    r = emitir()
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["paciente"] == "Maria Cadastrada"  # nome cadastrado vale mais
    assert corpo["itens"][0]["medicamento"] == "Isotretinoína 20 mg"
    assert "pdf_object_name" not in corpo
    pdf = client.get(f"/receitas/{corpo['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content == PDF
    assert len(client.get(f"/pacientes/{PACIENTE_ID}/receitas").json()) == 1


@pytest.mark.parametrize(
    "itens",
    [[], [{"medicamento": "X", "posologia": "1 ao dia"}], [{"medicamento": "Dipirona"}]],
)
def test_itens_invalidos(banco, itens):
    assert emitir(itens=itens).status_code == 422
    assert banco.receitas == {}


def test_sem_itens_demais(banco):
    muitos = [{"medicamento": f"Med {i}", "posologia": "1 ao dia"} for i in range(21)]
    assert emitir(itens=muitos).status_code == 422


def test_pdf_invalido(banco):
    assert emitir(pdf=b"nao e pdf").status_code == 415
    assert banco.arquivos == {}


def test_paciente_inexistente_ou_ausente(banco):
    assert emitir(paciente_id=str(uuid.uuid4())).status_code == 422
    assert emitir(paciente_id="").status_code == 422  # sem paciente e sem nome


def test_paciente_avulso_com_nome(banco):
    assert emitir(paciente_id="", paciente="Avulso da Silva").status_code == 201


def test_nao_ha_edicao_nem_exclusao(banco):
    id_ = emitir().json()["id"]
    assert client.delete(f"/receitas/{id_}").status_code in (404, 405)
    assert client.put(f"/receitas/{id_}").status_code in (404, 405)
