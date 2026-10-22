import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import pacientes as rota_p
from app.routers import prontuarios as rota_r

client = TestClient(app)
PDF = b"%PDF-1.4\n%x\n"


class Banco:
    def __init__(self):
        self.pacientes: dict[str, dict] = {}
        self.prontuarios: dict[str, dict] = {}
        self.arquivos: dict[str, bytes] = {}

    # pacientes
    def _cpf_em_uso(self, cpf, exceto=None):
        return cpf and any(p["cpf"] == cpf and p["id"] != exceto for p in self.pacientes.values())

    def inserir_paciente(self, *, nome, nascimento, dados):
        if self._cpf_em_uso(dados.get("cpf")):
            raise rota_p.repositorio.CpfDuplicado
        id_ = str(uuid.uuid4())
        self.pacientes[id_] = {
            "id": id_, "nome": nome, "nascimento": nascimento, "criado_em": datetime.now(UTC),
            **{c: dados.get(c) for c in rota_p.repositorio.CAMPOS_FICHA},
        }  # fmt: skip
        return dict(self.pacientes[id_])

    def atualizar_paciente(self, id_, *, nome, nascimento, dados):
        if id_ not in self.pacientes:
            return None
        if self._cpf_em_uso(dados.get("cpf"), exceto=id_):
            raise rota_p.repositorio.CpfDuplicado
        self.pacientes[id_].update(
            nome=nome, nascimento=nascimento,
            **{c: dados.get(c) for c in rota_p.repositorio.CAMPOS_FICHA},
        )  # fmt: skip
        return dict(self.pacientes[id_])

    def _resumo(self, p):
        cs = [r for r in self.prontuarios.values() if r["paciente_id"] == p["id"]]
        cs.sort(key=lambda r: r["criado_em"], reverse=True)
        return dict(p, n_prontuarios=len(cs), ultima_consulta=cs[0]["criado_em"] if cs else None)

    def listar_pacientes(self, q=None, limite=100):
        dig = "".join(c for c in (q or "") if c.isdigit())
        ps = [
            p for p in self.pacientes.values()
            if not q or q.lower() in p["nome"].lower() or (dig in (p["cpf"] or "") and len(dig) > 2)
        ]  # fmt: skip
        return [self._resumo(p) for p in ps]

    def obter_paciente(self, id_):
        return self.pacientes.get(id_)

    def listar_do_paciente(self, id_):
        cs = [r for r in self.prontuarios.values() if r["paciente_id"] == id_]
        return sorted(cs, key=lambda r: r["criado_em"], reverse=True)

    def obter_prontuario(self, id_):
        r = self.prontuarios.get(id_)
        return dict(r) if r else None

    def prontuario_do_paciente(self, id_):
        cs = [r for r in self.prontuarios.values() if r["paciente_id"] == id_]
        return sorted(cs, key=lambda r: r["criado_em"])

    def corrigir_prontuario(self, id_, *, texto, pdf_object_name):
        r = self.prontuarios.get(id_)
        if r is None:
            return None
        antigo = r["pdf_object_name"]
        r.update(texto=texto, pdf_object_name=pdf_object_name, corrigido_em=datetime.now(UTC))
        return antigo

    # prontuários
    def inserir_prontuario(self, *, session_id, paciente, modo, texto, pdf_object_name,
                           paciente_id=None, tipo="nova", retorno_de=None):  # fmt: skip
        id_ = str(uuid.uuid4())
        self.prontuarios[id_] = {
            "id": id_, "paciente": paciente, "paciente_id": paciente_id, "modo": modo,
            "tipo": tipo, "retorno_de": retorno_de, "texto": texto,
            "pdf_object_name": pdf_object_name, "criado_em": datetime.now(UTC),
        }  # fmt: skip
        return dict(self.prontuarios[id_])


@pytest.fixture
def banco(monkeypatch):
    b = Banco()
    for modulo in (rota_p.repositorio, rota_r.repositorio):
        monkeypatch.setattr(modulo, "inserir_paciente", b.inserir_paciente)
        monkeypatch.setattr(modulo, "listar_pacientes", b.listar_pacientes)
        monkeypatch.setattr(modulo, "obter_paciente", b.obter_paciente)
        monkeypatch.setattr(modulo, "atualizar_paciente", b.atualizar_paciente)
        monkeypatch.setattr(modulo, "prontuario_do_paciente", b.prontuario_do_paciente)
        monkeypatch.setattr(modulo, "corrigir_prontuario", b.corrigir_prontuario)
        monkeypatch.setattr(modulo, "obter_prontuario", b.obter_prontuario)
        monkeypatch.setattr(modulo, "listar_prontuarios_do_paciente", b.listar_do_paciente)
        monkeypatch.setattr(modulo, "inserir_prontuario", b.inserir_prontuario)
    monkeypatch.setattr(rota_r.storage, "upload_object", lambda k, d, t: b.arquivos.update({k: d}))
    monkeypatch.setattr(rota_r.storage, "delete_object", lambda k: b.arquivos.pop(k, None))
    return b


def cadastrar(nome="  Ana   Souza ", nascimento="1980-05-17"):
    return client.post("/pacientes", json={"nome": nome, "nascimento": nascimento})


def registrar(**extra):
    dados = {"texto": "CONSULTA PRESENCIAL", "paciente": "digitado", "modo": "presencial"}
    dados.update(extra)
    return client.post("/prontuarios", data=dados, files={"pdf": ("p.pdf", PDF, "application/pdf")})


def test_cadastra_com_nome_limpo_e_busca_sem_diferenciar_caixa(banco):
    r = cadastrar()
    assert r.status_code == 201 and r.json()["nome"] == "Ana Souza"
    cadastrar("Bruno Lima", None)
    todos = client.get("/pacientes").json()
    assert {p["nome"] for p in todos} == {"Ana Souza", "Bruno Lima"}
    achados = client.get("/pacientes", params={"q": "souz"}).json()
    assert [p["nome"] for p in achados] == ["Ana Souza"]
    assert client.get("/pacientes", params={"q": "zzz"}).json() == []


@pytest.mark.parametrize(
    "corpo",
    [
        {"nome": "A"},
        {"nome": "   "},
        {"nome": "x" * 121},
        {"nome": "Ana", "nascimento": "1850-01-01"},
        {
            "nome": "Ana",
            "nascimento": (date.today().replace(year=date.today().year + 1)).isoformat(),
        },
        {"nome": "Ana", "nascimento": "não é data"},
        {},
    ],
)
def test_cadastro_invalido_e_422(banco, corpo):
    assert client.post("/pacientes", json=corpo).status_code == 422
    assert banco.pacientes == {}


def test_prontuario_ligado_ao_paciente_usa_o_nome_cadastrado_e_aparece_no_historico(banco):
    pid = cadastrar().json()["id"]
    primeira = registrar(paciente_id=pid)
    assert primeira.status_code == 201
    assert primeira.json()["paciente"] == "Ana Souza"  # vale o cadastro, não o digitado
    assert primeira.json()["tipo"] == "nova"

    volta = registrar(paciente_id=pid, tipo="retorno", retorno_de=primeira.json()["id"])
    assert volta.status_code == 201 and volta.json()["tipo"] == "retorno"

    detalhe = client.get(f"/pacientes/{pid}").json()
    assert detalhe["n_prontuarios"] == 2
    assert [c["tipo"] for c in detalhe["consultas"]] == ["retorno", "nova"]  # mais recente primeiro
    na_lista = client.get("/pacientes").json()[0]
    assert na_lista["n_prontuarios"] == 2 and na_lista["ultima_consulta"] is not None


def test_retorno_exige_a_consulta_anterior_e_paciente_tem_de_existir(banco):
    pid = cadastrar().json()["id"]
    assert registrar(paciente_id=pid, tipo="retorno").status_code == 422
    assert registrar(paciente_id=str(uuid.uuid4())).status_code == 422
    assert registrar(paciente_id="nao-e-uuid").status_code == 422
    assert registrar(tipo="outro").status_code == 422
    assert banco.prontuarios == {} and banco.arquivos == {}  # nada ficou pela metade


def test_paciente_inexistente_e_id_invalido(banco):
    assert client.get(f"/pacientes/{uuid.uuid4()}").status_code == 404
    assert client.get("/pacientes/nao-e-uuid").status_code == 422


def test_consulta_sem_cadastro_continua_funcionando(banco):
    r = registrar(paciente="Fulano Avulso")
    assert r.status_code == 201 and r.json()["paciente"] == "Fulano Avulso"
    assert r.json()["paciente_id"] is None


CPF_OK = "529.982.247-25"  # CPF de teste válido (dígitos verificadores corretos)


def test_cadastro_completo_guarda_a_ficha_e_normaliza_o_cpf(banco):
    r = client.post("/pacientes", json={
        "nome": "Ana Souza", "cpf": CPF_OK, "sexo": " feminino ", "alergias": "dipirona",
        "contato": "", "plano_saude": "Unimed",
    })  # fmt: skip
    assert r.status_code == 201
    ficha = client.get(f"/pacientes/{r.json()['id']}").json()
    assert ficha["cpf"] == "52998224725"
    assert ficha["sexo"] == "feminino" and ficha["alergias"] == "dipirona"
    assert ficha["contato"] is None  # vazio vira ausente
    assert ficha["plano_saude"] == "Unimed" and ficha["moradia"] is None


@pytest.mark.parametrize("cpf", ["123", "111.111.111-11", "529.982.247-26", "abc"])
def test_cpf_invalido_e_422(banco, cpf):
    assert client.post("/pacientes", json={"nome": "Ana", "cpf": cpf}).status_code == 422
    assert banco.pacientes == {}


def test_cpf_repetido_e_409_e_busca_por_cpf(banco):
    a = client.post("/pacientes", json={"nome": "Ana Souza", "cpf": CPF_OK})
    assert a.status_code == 201
    dup = client.post("/pacientes", json={"nome": "Outra", "cpf": "52998224725"})
    assert dup.status_code == 409
    assert len(banco.pacientes) == 1
    achados = client.get("/pacientes", params={"q": "529982"}).json()
    assert [p["nome"] for p in achados] == ["Ana Souza"]
    assert "cpf" not in achados[0]  # a lista não expõe o CPF


def test_corrigir_cadastro(banco):
    pid = client.post("/pacientes", json={"nome": "Ana Souza", "cpf": CPF_OK}).json()["id"]
    outro = client.post("/pacientes", json={"nome": "Bruno Lima"}).json()["id"]
    r = client.put(f"/pacientes/{pid}", json={"nome": "Ana Souza Lima", "alergias": "latex"})
    assert r.status_code == 200 and r.json()["nome"] == "Ana Souza Lima"
    ficha = client.get(f"/pacientes/{pid}").json()
    assert ficha["alergias"] == "latex" and ficha["cpf"] is None  # a correção substitui tudo
    assert client.put(f"/pacientes/{pid}", json={"nome": "Ana", "cpf": CPF_OK}).status_code == 200
    conflito = client.put(f"/pacientes/{outro}", json={"nome": "Bruno", "cpf": CPF_OK})
    assert conflito.status_code == 409
    assert client.put(f"/pacientes/{uuid.uuid4()}", json={"nome": "Zé"}).status_code == 404
    assert client.put("/pacientes/nao-e-uuid", json={"nome": "Zé"}).status_code == 422


def test_prontuario_cronologico_mais_antigo_primeiro_com_rotulos(banco):
    pid = cadastrar().json()["id"]
    c1 = registrar(paciente_id=pid, texto="PRIMEIRA").json()["id"]
    r1 = registrar(paciente_id=pid, tipo="retorno", retorno_de=c1, texto="VOLTA").json()["id"]
    c2 = registrar(paciente_id=pid, texto="SEGUNDA").json()["id"]
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for i, rid in enumerate((c1, r1, c2)):  # datas bem separadas e em ordem
        banco.prontuarios[rid]["criado_em"] = base + timedelta(days=i)
    r = client.get(f"/pacientes/{pid}/prontuario")
    assert r.status_code == 200
    corpo = r.json()
    assert [x["rotulo"] for x in corpo["registros"]] == ["Consulta 1", "Retorno 1", "Consulta 2"]
    assert [x["texto"] for x in corpo["registros"]] == ["PRIMEIRA", "VOLTA", "SEGUNDA"]
    assert corpo["paciente"]["nome"] == "Ana Souza" and corpo["paciente"]["n_prontuarios"] == 3
    assert client.get(f"/pacientes/{uuid.uuid4()}/prontuario").status_code == 404
    assert client.get("/pacientes/nao-e-uuid/prontuario").status_code == 422


def test_paciente_sem_registros_tem_prontuario_vazio(banco):
    pid = cadastrar().json()["id"]
    assert client.get(f"/pacientes/{pid}/prontuario").json()["registros"] == []


def corrigir(id_, texto="TEXTO CORRIGIDO", pdf=PDF):
    return client.put(
        f"/prontuarios/{id_}",
        data={"texto": texto},
        files={"pdf": ("p.pdf", pdf, "application/pdf")},
    )


def test_corrigir_prontuario_troca_texto_e_pdf_e_apaga_o_pdf_antigo(banco):
    pid = cadastrar().json()["id"]
    criado = registrar(paciente_id=pid).json()
    antigo = banco.prontuarios[criado["id"]]["pdf_object_name"]
    r = corrigir(criado["id"], pdf=PDF + b"novo")
    assert r.status_code == 200
    reg = banco.prontuarios[criado["id"]]
    assert reg["texto"] == "TEXTO CORRIGIDO" and reg["corrigido_em"] is not None
    assert reg["pdf_object_name"] != antigo
    assert antigo not in banco.arquivos and reg["pdf_object_name"] in banco.arquivos
    assert reg["tipo"] == "nova" and reg["paciente_id"] == pid  # o resto não muda


def test_corrigir_prontuario_invalido_nao_mexe_em_nada(banco):
    pid = cadastrar().json()["id"]
    criado = registrar(paciente_id=pid, texto="ORIGINAL").json()
    arquivos = dict(banco.arquivos)
    assert corrigir(criado["id"], texto="   ").status_code == 422
    assert corrigir(criado["id"], pdf=b"nao e pdf").status_code == 415
    assert corrigir(str(uuid.uuid4())).status_code == 404
    assert corrigir("nao-e-uuid").status_code == 422
    assert banco.prontuarios[criado["id"]]["texto"] == "ORIGINAL"
    assert banco.arquivos == arquivos  # nenhum PDF sobrando nem perdido
