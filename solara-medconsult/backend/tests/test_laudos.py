import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import laudos as rota

client = TestClient(app)
SESSAO = str(uuid.uuid4())
PDF = b"%PDF-1.4\n%laudo\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20
JPG = b"\xff\xd8\xff\xe0" + b"0" * 20
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"0" * 10


class Banco:
    def __init__(self):
        self.laudos: dict[str, dict] = {}
        self.arquivos: dict[str, bytes] = {}

    def inserir_laudo(self, *, session_id, nome, tipo, content_type, object_name):
        id_ = str(uuid.uuid4())
        self.laudos[id_] = {
            "id": id_, "session_id": session_id, "nome": nome, "tipo": tipo,
            "content_type": content_type, "object_name": object_name,
            "criado_em": datetime.now(UTC),
        }  # fmt: skip
        return dict(self.laudos[id_])

    def listar_laudos(self, session_id):
        return [dict(x) for x in self.laudos.values() if x["session_id"] == session_id]

    def obter_laudo(self, id_):
        x = self.laudos.get(id_)
        return dict(x) if x else None

    def remover_laudo(self, session_id, id_):
        x = self.laudos.get(id_)
        if x is None or x["session_id"] != session_id:
            return None
        del self.laudos[id_]
        return x["object_name"]


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    for nome in ("inserir_laudo", "listar_laudos", "obter_laudo", "remover_laudo"):
        monkeypatch.setattr(rota.repositorio, nome, getattr(b, nome))
    monkeypatch.setattr(rota.storage, "upload_object", lambda k, d, t: b.arquivos.update({k: d}))
    monkeypatch.setattr(rota.storage, "get_object", lambda k: b.arquivos[k])
    monkeypatch.setattr(rota.storage, "delete_object", lambda k: b.arquivos.pop(k, None))
    return b


def enviar(dados, nome="laudo.pdf", sessao=SESSAO):
    return client.post(f"/session/{sessao}/laudos", files={"arquivo": (nome, dados)})


@pytest.mark.parametrize(
    ("dados", "tipo"), [(PDF, "pdf"), (PNG, "imagem"), (JPG, "imagem"), (WEBP, "imagem")]
)
def test_aceita_pdf_e_imagens_pelo_conteudo_e_nao_pelo_nome(banco, dados, tipo):
    r = enviar(dados, nome="qualquer.xyz")
    assert r.status_code == 201 and r.json()["tipo"] == tipo
    assert len(banco.arquivos) == 1


def test_recusa_outros_tipos_e_arquivo_vazio(banco):
    assert enviar(b"MZ\x90\x00 executavel", nome="laudo.pdf").status_code == 415
    assert enviar(b"<html>oi</html>").status_code == 415
    assert enviar(b"").status_code == 415
    assert banco.laudos == {} and banco.arquivos == {}


def test_recusa_arquivo_grande_e_sessao_invalida(banco, monkeypatch):
    monkeypatch.setattr(rota, "MAX_LAUDO", 100)
    assert enviar(PDF + b"x" * 200).status_code == 413
    assert enviar(PDF, sessao="nao-e-uuid").status_code == 422
    assert banco.arquivos == {}


def test_limite_de_laudos_por_consulta(banco, monkeypatch):
    monkeypatch.setattr(rota, "MAX_POR_CONSULTA", 2)
    assert enviar(PDF).status_code == 201
    assert enviar(PDF).status_code == 201
    assert enviar(PDF).status_code == 409
    assert len(banco.arquivos) == 2


def test_nome_do_arquivo_e_limpo(banco):
    r = enviar(PDF, nome="../../Laudo <Hemograma>.pdf")
    assert (
        ".." not in r.json()["nome"] and "<" not in r.json()["nome"] and "/" not in r.json()["nome"]
    )
    assert rota.nome_limpo(None, "pdf") == "laudo.pdf"
    assert rota.nome_limpo("   ", "jpg") == "laudo.jpg"


def test_lista_abre_e_remove(banco):
    a = enviar(PDF, nome="hemograma.pdf").json()
    enviar(PNG, nome="foto.png", sessao=str(uuid.uuid4()))  # outra consulta
    lista = client.get(f"/session/{SESSAO}/laudos").json()
    assert [x["nome"] for x in lista] == ["hemograma.pdf"]

    arq = client.get(f"/laudos/{a['id']}/arquivo")
    assert arq.status_code == 200 and arq.content == PDF
    assert arq.headers["content-type"] == "application/pdf"
    assert client.get(f"/laudos/{uuid.uuid4()}/arquivo").status_code == 404

    assert (
        client.delete(f"/session/{uuid.uuid4()}/laudos/{a['id']}").status_code == 404
    )  # sessão errada
    assert client.delete(f"/session/{SESSAO}/laudos/{a['id']}").status_code == 204
    assert client.get(f"/session/{SESSAO}/laudos").json() == []
    assert len(banco.arquivos) == 1  # só o da outra consulta sobrou


def test_falha_ao_gravar_apaga_o_arquivo_enviado(banco, monkeypatch):
    def quebra(**_):
        raise RuntimeError("banco fora")

    monkeypatch.setattr(rota.repositorio, "inserir_laudo", quebra)
    assert enviar(PDF).status_code == 503
    assert banco.arquivos == {}  # nada ficou pela metade
