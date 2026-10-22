import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import prontuarios as rota

client = TestClient(app)
PDF = b"%PDF-1.4\n%conteudo de teste\n"


class Banco:
    """Repositório e armazenamento falsos, em memória."""

    def __init__(self):
        self.linhas: dict[str, dict] = {}
        self.arquivos: dict[str, bytes] = {}

    def inserir(self, *, session_id, paciente, modo, texto, pdf_object_name, **extra):
        id_ = str(uuid.uuid4())
        self.linhas[id_] = {
            "id": id_, "paciente": paciente, "modo": modo, "texto": texto,
            "pdf_object_name": pdf_object_name, "criado_em": datetime.now(UTC),
        }  # fmt: skip
        return {k: self.linhas[id_][k] for k in ("id", "paciente", "modo", "criado_em")}

    def listar(self, limite=200):
        return [
            {k: r[k] for k in ("id", "paciente", "modo", "criado_em")} for r in self.linhas.values()
        ]

    def obter(self, id_):
        return self.linhas.get(id_)

    def remover(self, id_):
        r = self.linhas.pop(id_, None)
        return r["pdf_object_name"] if r else None


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    monkeypatch.setattr(rota.repositorio, "inserir_prontuario", b.inserir)
    monkeypatch.setattr(rota.repositorio, "listar_prontuarios", b.listar)
    monkeypatch.setattr(rota.repositorio, "obter_prontuario", b.obter)
    monkeypatch.setattr(rota.repositorio, "remover_prontuario", b.remover)
    monkeypatch.setattr(rota.storage, "upload_object", lambda k, d, t: b.arquivos.update({k: d}))
    monkeypatch.setattr(rota.storage, "get_object", lambda k: b.arquivos[k])
    monkeypatch.setattr(rota.storage, "delete_object", lambda k: b.arquivos.pop(k, None))
    return b


def registrar(**extra):
    dados = {"texto": "CONSULTA PRESENCIAL\n- Psoríase", "paciente": "Ana", "modo": "presencial"}
    dados.update(extra)
    return client.post("/prontuarios", data=dados, files={"pdf": ("p.pdf", PDF, "application/pdf")})


def test_registrar_listar_abrir_baixar_e_excluir(banco):
    r = registrar()
    assert r.status_code == 201
    id_ = r.json()["id"]
    assert r.json()["paciente"] == "Ana" and "texto" not in r.json()

    lista = client.get("/prontuarios").json()
    assert [p["id"] for p in lista] == [id_] and "texto" not in lista[0]

    aberto = client.get(f"/prontuarios/{id_}").json()
    assert aberto["texto"].startswith("CONSULTA PRESENCIAL")

    pdf = client.get(f"/prontuarios/{id_}/pdf")
    assert pdf.status_code == 200 and pdf.content == PDF
    assert pdf.headers["content-type"] == "application/pdf"

    assert client.delete(f"/prontuarios/{id_}").status_code == 204
    assert client.get(f"/prontuarios/{id_}").status_code == 404
    assert banco.arquivos == {}  # o PDF também foi apagado do armazenamento


def test_recusa_o_que_nao_e_pdf_texto_vazio_e_id_invalido(banco):
    ruim = client.post(
        "/prontuarios",
        data={"texto": "x"},
        files={"pdf": ("p.pdf", b"nao e pdf", "application/pdf")},
    )
    assert ruim.status_code == 415
    assert registrar(texto="   ").status_code == 422
    assert registrar(session_id="nao-e-uuid").status_code == 422
    assert client.get("/prontuarios/nao-e-uuid").status_code == 422
    assert client.get(f"/prontuarios/{uuid.uuid4()}/pdf").status_code == 404
    assert client.delete(f"/prontuarios/{uuid.uuid4()}").status_code == 404
    assert banco.linhas == {} and banco.arquivos == {}


def test_falha_ao_gravar_apaga_o_pdf_enviado_e_nao_vaza_detalhe(banco, monkeypatch):
    def quebra(**k):
        raise RuntimeError("senha=segredo paciente=José")

    monkeypatch.setattr(rota.repositorio, "inserir_prontuario", quebra)
    r = registrar()
    assert r.status_code == 503
    assert "segredo" not in r.text and "José" not in r.text
    assert banco.arquivos == {}  # não deixa PDF órfão


def test_log_nao_leva_conteudo_clinico(banco, caplog):
    caplog.set_level("INFO", logger="medconsult.prontuarios")
    registrar(texto="DIAGNÓSTICO segredo clínico", paciente="Maria Secreta")
    assert "prontuario registrado" in caplog.text
    assert "segredo" not in caplog.text and "Maria" not in caplog.text
