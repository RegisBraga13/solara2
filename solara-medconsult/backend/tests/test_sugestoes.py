from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.motores import diagnostico as md
from app.motores import listas as ml
from app.motores.listas import Fonte
from app.routers import sugestoes as rota

client = TestClient(app)
AGORA = datetime.now(UTC)


def _dx(diagnosticos):
    return md.Sugestao(
        decision_id="d", acao=md.Acao.HUMAN_REVIEW, diagnosticos=diagnosticos,
        probabilidades=[60, 30][: len(diagnosticos)],
        cid11=["EA80", "EA90"][: len(diagnosticos)],
        avisos=["a"], modelo="m", criado_em=AGORA,
    )  # fmt: skip


def _lista(*itens):
    return ml.Sugestao(
        decision_id="d", acao=md.Acao.HUMAN_REVIEW, modelo="m", criado_em=AGORA,
        itens=[ml.Item(termo=t, secao=s, fontes=f) for t, s, f in itens],
    )  # fmt: skip


@pytest.fixture(autouse=True)
def sem_openai(monkeypatch):
    # os construtores não chamam a rede; só os motores (trocados em cada teste) o fariam
    monkeypatch.setattr(rota, "OpenAIEmbedder", lambda: object())
    monkeypatch.setattr(rota, "OpenAIReranker", lambda: object())


def test_diagnostico_devolve_so_os_nomes_em_ordem(monkeypatch):
    visto = {}

    def falso(caso, **k):
        visto.update(caso=caso, fontes=k["fontes"])
        return _dx(["Psoríase vulgar", "Dermatite seborreica"])

    monkeypatch.setattr(rota.motor_diagnostico, "sugerir_diagnosticos", falso)
    r = client.post(
        "/diagnostico/sugerir", json={"caso": "placas descamativas", "fontes": ["AI", "Web"]}
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["diagnosticos"] == ["Psoríase vulgar", "Dermatite seborreica"]
    assert corpo["probabilidades"] == [60, 30]
    assert corpo["cid11"] == ["EA80", "EA90"]
    assert set(corpo) == {"diagnosticos", "probabilidades", "cid11"}  # só o pedido: nada mais
    assert visto == {"caso": "placas descamativas", "fontes": ["AI", "Web"]}


def test_propedeutica_devolve_so_termo_e_secao_sem_citar_origem(monkeypatch):
    s = _lista(
        ("Itraconazol", "tratamento", [Fonte.AI, Fonte.DIRETRIZES]),
        ("Cultura", "investigacao", [Fonte.WEB]),
    )
    monkeypatch.setattr(rota.motor_propedeutica, "sugerir_propedeutica", lambda d, **k: s)
    r = client.post(
        "/propedeutica/sugerir", json={"diagnostico": "esporotricose", "fontes": ["AI", "Web"]}
    )
    assert r.status_code == 200
    assert r.json()["itens"] == [
        {"termo": "Itraconazol", "secao": "tratamento"},
        {"termo": "Cultura", "secao": "investigacao"},
    ]


def test_orientacoes_devolve_so_termo_e_secao_sem_citar_origem(monkeypatch):
    s = _lista(("Protetor solar", "fotoprotecao", [Fonte.RAG]))
    monkeypatch.setattr(rota.motor_orientacoes, "sugerir_orientacoes", lambda d, **k: s)
    r = client.post("/orientacoes/sugerir", json={"diagnostico": "melasma", "fontes": ["RAG"]})
    assert r.json()["itens"] == [{"termo": "Protetor solar", "secao": "fotoprotecao"}]


def test_historia_devolve_so_o_texto(monkeypatch):
    from app.motores import historia as mh

    r_ok = mh.Resultado(
        decision_id="d", acao=md.Acao.HUMAN_REVIEW, historia="Texto.", modelo="m", criado_em=AGORA
    )
    monkeypatch.setattr(rota.motor_historia, "gerar_historia", lambda reg, **k: r_ok)
    r = client.post("/historia/gerar", json={"registro": "paciente com coceira"})
    assert r.status_code == 200 and r.json()["historia"] == "Texto."
    assert set(r.json()) == {"historia"}


def test_conduta_e_tratamento_devolvem_so_o_texto(monkeypatch):
    from app.motores import conduta_tratamento as mc

    r_ok = mc.Resultado(
        decision_id="d",
        acao=md.Acao.HUMAN_REVIEW,
        texto="Solicitar biópsia.",
        modelo="m",
        criado_em=AGORA,
    )
    monkeypatch.setattr(rota.motor_conduta, "gerar_conduta", lambda d, **k: r_ok)
    r = client.post("/conduta/gerar", json={"diagnostico": "psoríase", "fontes": ["AI"]})
    assert r.status_code == 200
    assert r.json() == {"texto": "Solicitar biópsia."}

    r_trat = mc.Resultado(
        decision_id="d",
        acao=md.Acao.HUMAN_REVIEW,
        texto="Corticoide tópico.",
        modelo="m",
        criado_em=AGORA,
    )
    monkeypatch.setattr(rota.motor_conduta, "gerar_tratamento", lambda d, **k: r_trat)
    r = client.post("/tratamento/gerar", json={"diagnostico": "psoríase", "fontes": ["AI"]})
    assert r.status_code == 200
    assert r.json() == {"texto": "Corticoide tópico."}

    r_ori = mc.Resultado(
        decision_id="d",
        acao=md.Acao.HUMAN_REVIEW,
        texto="Use protetor solar.",
        modelo="m",
        criado_em=AGORA,
    )
    monkeypatch.setattr(rota.motor_conduta, "gerar_orientacoes", lambda d, **k: r_ori)
    r = client.post("/orientacoes/gerar", json={"diagnostico": "psoríase", "fontes": ["AI"]})
    assert r.status_code == 200
    assert r.json() == {"texto": "Use protetor solar."}

    r_inv = mc.Resultado(
        decision_id="d",
        acao=md.Acao.HUMAN_REVIEW,
        texto="Solicitar parecer de especialista.",
        modelo="m",
        criado_em=AGORA,
    )
    monkeypatch.setattr(rota.motor_conduta, "gerar_investigacao", lambda d, **k: r_inv)
    r = client.post("/investigacao/gerar", json={"diagnostico": "psoríase", "fontes": ["AI"]})
    assert r.status_code == 200
    assert r.json() == {"texto": "Solicitar parecer de especialista."}


def test_colado_dispensa_fontes_e_chega_ao_motor(monkeypatch):
    from app.motores import conduta_tratamento as mc

    visto = {}

    def falso_dx(caso, **k):
        visto["dx"] = k.get("colado")
        return _dx(["Psoríase"])

    monkeypatch.setattr(rota.motor_diagnostico, "sugerir_diagnosticos", falso_dx)
    r = client.post(
        "/diagnostico/sugerir", json={"caso": "placas", "colado": "texto da OpenEvidence"}
    )
    assert r.status_code == 200
    assert visto["dx"] == "texto da OpenEvidence"

    r_ok = mc.Resultado(
        decision_id="d", acao=md.Acao.HUMAN_REVIEW, texto="ok", modelo="m", criado_em=AGORA
    )

    def falso_conduta(d, **k):
        visto["conduta"] = k.get("colado")
        return r_ok

    monkeypatch.setattr(rota.motor_conduta, "gerar_conduta", falso_conduta)
    r = client.post("/conduta/gerar", json={"diagnostico": "psoríase", "colado": "trecho colado"})
    assert r.status_code == 200
    assert visto["conduta"] == "trecho colado"


def test_pendencias_devolve_pendentes_e_red_flags(monkeypatch):
    from app.motores import anamnese_pendencias as mp

    r_ok = mp.Resultado(
        decision_id="d",
        acao=md.Acao.HUMAN_REVIEW,
        pendentes=[mp.TopicoPendente(topico="Fototipo", pergunta_sugerida="Qual o fototipo?")],
        red_flags=[mp.RedFlagAvaliado(sinal="Sangramento", estado=mp.EstadoRedFlag.PRESENTE)],
        modelo="m",
        criado_em=AGORA,
    )
    monkeypatch.setattr(rota.motor_pendencias, "verificar_pendencias", lambda reg, **k: r_ok)
    r = client.post("/anamnese/pendencias", json={"registro": "paciente relata mancha"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["pendentes"] == [{"topico": "Fototipo", "pergunta_sugerida": "Qual o fototipo?"}]
    assert corpo["red_flags"] == [{"sinal": "Sangramento", "estado": "presente"}]
    assert set(corpo) == {"pendentes", "red_flags"}


@pytest.mark.parametrize(
    "caminho, corpo",
    [
        ("/diagnostico/sugerir", {"caso": "", "fontes": ["AI"]}),
        ("/diagnostico/sugerir", {"caso": "   ", "fontes": ["AI"]}),
        ("/diagnostico/sugerir", {"caso": "x" * 7000, "fontes": ["AI"]}),
        ("/diagnostico/sugerir", {}),
        ("/propedeutica/sugerir", {"diagnostico": "x", "fontes": ["AI"]}),
        ("/orientacoes/sugerir", {"diagnostico": "", "fontes": ["AI"]}),
        ("/historia/gerar", {"registro": ""}),
        ("/historia/gerar", {"registro": "x" * 20001}),
        ("/anamnese/pendencias", {"registro": ""}),
        ("/anamnese/pendencias", {"registro": "x" * 20001}),
        # nada é gerado sem o médico escolher as fontes (e Diretrizes não vale no diagnóstico)
        ("/diagnostico/sugerir", {"caso": "algo"}),
        ("/diagnostico/sugerir", {"caso": "algo", "fontes": []}),
        ("/diagnostico/sugerir", {"caso": "algo", "fontes": ["Diretrizes"]}),
        ("/propedeutica/sugerir", {"diagnostico": "psoriase"}),
        ("/propedeutica/sugerir", {"diagnostico": "psoriase", "fontes": []}),
        ("/orientacoes/sugerir", {"diagnostico": "psoriase", "fontes": ["outra"]}),
        # sem fonte nem colado: nada a usar
        ("/conduta/gerar", {"diagnostico": "psoriase"}),
        ("/conduta/gerar", {"diagnostico": "psoriase", "fontes": [], "colado": "  "}),
        ("/investigacao/gerar", {"diagnostico": "psoriase"}),
        ("/tratamento/gerar", {"diagnostico": "psoriase"}),
        ("/orientacoes/gerar", {"diagnostico": "psoriase"}),
        ("/diagnostico/sugerir", {"caso": "algo", "fontes": [], "colado": "  "}),
    ],
)
def test_entrada_invalida_e_422(caminho, corpo):
    assert client.post(caminho, json=corpo).status_code == 422


def test_rotas_antigas_nao_existem_mais():
    assert client.post("/tratamento/sugerir", json={}).status_code == 404
    assert client.post("/condutas/sugerir", json={}).status_code == 404


def test_falha_interna_vira_503_sem_vazar_detalhe(monkeypatch):
    def quebra(*a, **k):
        raise RuntimeError("senha=segredo caso=José")

    monkeypatch.setattr(rota.motor_diagnostico, "sugerir_diagnosticos", quebra)
    r = client.post("/diagnostico/sugerir", json={"caso": "algo", "fontes": ["AI"]})
    assert r.status_code == 503
    assert "segredo" not in r.text and "José" not in r.text


def test_rejeicao_do_motor_vira_lista_vazia_sem_erro(monkeypatch):
    rej = md.Sugestao(
        decision_id="d", acao=md.Acao.REJECT, diagnosticos=[], modelo="m", criado_em=AGORA
    )
    monkeypatch.setattr(rota.motor_diagnostico, "sugerir_diagnosticos", lambda c, **k: rej)
    r = client.post("/diagnostico/sugerir", json={"caso": "algo", "fontes": ["AI"]})
    assert r.status_code == 200 and r.json()["diagnosticos"] == []
