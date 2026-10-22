import pytest

from app.motores import listas as ls
from app.motores import orientacoes as ori
from app.motores import propedeutica as pro
from app.motores import rag
from app.motores.diagnostico import Acao
from app.motores.embeddings import EmbeddingIndisponivel
from app.motores.listas import Fonte


def _busca(n=2):
    rs = [
        rag.Resultado(f"id{i}", f"trecho {i}", "Livro", "Fonte", "", None, None, 0.1, ["vetor"])
        for i in range(n)
    ]
    return rag.Busca(resultados=rs, modo="hibrida")


@pytest.fixture
def com_trechos(monkeypatch):
    monkeypatch.setattr(ls.rag, "buscar", lambda *a, **k: _busca())


def _itens(*pares):
    return {"itens": [{"termo": t, "secao": s} for t, s in pares]}


def falso_chat(ai=None, rag_=None, dir_=None, web_=None, mescla=None, falha=()):
    """Responde conforme o tipo de pedido, reconhecido pelo texto do prompt."""
    ai = ai if ai is not None else _itens(("Item AI", "tratamento"))
    rag_ = rag_ if rag_ is not None else _itens(("Item RAG", "tratamento"))
    dir_ = dir_ if dir_ is not None else _itens(("Item Dir", "tratamento"))
    web_ = web_ if web_ is not None else _itens(("Item Web", "tratamento"))

    def chat(modelo, prompt):
        if "conhecimento geral" in prompt:
            tipo, saida = "ai", ai
        elif "Junte as listas" in prompt:
            return mescla if mescla is not None else {"itens": []}
        elif "Escolha, na lista de diretrizes" in prompt:
            return {"arquivo": None}
        elif "TEXTO WEB" in prompt:
            tipo, saida = "web", web_
        elif "\n[1] " in prompt:
            tipo, saida = "rag", rag_
        else:
            tipo, saida = "dir", dir_
        if tipo in falha:
            raise EmbeddingIndisponivel("fora")
        return saida

    return chat


def web_ok(consulta):
    return "TEXTO WEB: resumo"


def sugerir(chat, tema=pro, diagnostico="psoríase vulgar", **k):
    k.setdefault("buscar_web", web_ok)
    fn = pro.sugerir_propedeutica if tema is pro else ori.sugerir_orientacoes
    return fn(diagnostico, embedder=object(), chat=chat, **k)


def test_tres_secoes_da_propedeutica_com_fontes_e_revisao_humana(com_trechos):
    mescla = {
        "itens": [
            {"termo": "Biópsia de pele", "secao": "investigacao", "fontes": ["RAG", "Web"]},
            {"termo": "Corticoide tópico", "secao": "tratamento", "fontes": ["AI", "Diretrizes"]},
            {"termo": "Retorno em 30 dias", "secao": "acompanhamento", "fontes": ["AI"]},
        ]
    }
    s = sugerir(falso_chat(mescla=mescla))
    assert s.acao is Acao.HUMAN_REVIEW
    assert {i.secao for i in s.itens} == {"tratamento", "investigacao", "acompanhamento"}
    assert [f.value for f in s.itens[0].fontes] in (["AI", "Diretrizes"], ["RAG", "Web"])
    assert s.decision_id and s.schema_versao == "2"


def test_orientacoes_tem_as_tres_secoes_proprias(com_trechos):
    mescla = {
        "itens": [
            {"termo": "Hidratar a pele", "secao": "cuidados", "fontes": ["AI"]},
            {"termo": "Protetor solar FPS 50", "secao": "fotoprotecao", "fontes": ["AI"]},
            {"termo": "Banho morno", "secao": "higiene", "fontes": ["AI"]},
            {"termo": "Biópsia", "secao": "investigacao", "fontes": ["AI"]},  # seção alheia cai
        ]
    }
    ai = _itens(("Hidratar a pele", "cuidados"))
    s = sugerir(falso_chat(ai=ai, mescla=mescla), tema=ori, fontes=[Fonte.AI])
    assert {i.secao for i in s.itens} == {"cuidados", "fotoprotecao", "higiene"}


def test_so_consulta_as_fontes_escolhidas_pelo_medico(monkeypatch):
    chamadas = []
    monkeypatch.setattr(ls.rag, "buscar", lambda *a, **k: chamadas.append("rag") or _busca())
    pedidos = []
    base = falso_chat(
        mescla={
            "itens": [{"termo": "Item AI", "secao": "tratamento", "fontes": ["AI", "RAG", "Web"]}]
        }
    )

    def chat(modelo, prompt):
        pedidos.append(prompt)
        return base(modelo, prompt)

    def web_proibida(consulta):
        raise AssertionError("não deveria buscar na web")

    s = sugerir(chat, fontes=[Fonte.AI], buscar_web=web_proibida)
    assert chamadas == []  # RAG não foi consultado
    assert not any("TEXTO:" in p for p in pedidos)  # nem RAG, Diretrizes ou Web
    assert [f.value for f in s.itens[0].fontes] == ["AI"]  # fonte não escolhida nunca é marcada


def test_web_entra_como_fonte_e_so_o_resumo_vai_ao_modelo(com_trechos):
    visto = []

    def web(consulta):
        visto.append(consulta)
        return "TEXTO WEB: resumo https://pubmed.ncbi.nlm.nih.gov/1/"

    mescla = {"itens": [{"termo": "Item Web", "secao": "tratamento", "fontes": ["Web"]}]}
    s = sugerir(falso_chat(mescla=mescla), fontes=[Fonte.WEB], buscar_web=web)
    assert [(i.termo, [f.value for f in i.fontes]) for i in s.itens] == [("Item Web", ["Web"])]
    assert "psoríase vulgar" in visto[0]


def test_web_sem_resultado_avisa_e_nao_marca_a_fonte(com_trechos):
    mescla = {"itens": [{"termo": "Item AI", "secao": "tratamento", "fontes": ["AI", "Web"]}]}
    s = sugerir(falso_chat(mescla=mescla), fontes=[Fonte.AI, Fonte.WEB], buscar_web=lambda c: "")
    assert [f.value for f in s.itens[0].fontes] == ["AI"]
    assert any("web" in a.lower() for a in s.avisos)


def test_web_fora_do_ar_nao_derruba_as_outras(com_trechos):
    def cai(consulta):
        raise EmbeddingIndisponivel("fora")

    mescla = {"itens": [{"termo": "Item AI", "secao": "tratamento", "fontes": ["AI"]}]}
    s = sugerir(falso_chat(mescla=mescla), buscar_web=cai)
    assert s.acao is Acao.HUMAN_REVIEW and "Fonte Web indisponível." in s.avisos


def test_sem_fontes_escolhidas_nao_gera_nada(monkeypatch):
    monkeypatch.setattr(ls.rag, "buscar", lambda *a, **k: pytest.fail("não deveria buscar"))
    s = pro.sugerir_propedeutica(
        "psoríase vulgar",
        embedder=object(),
        chat=lambda m, p: pytest.fail("sem chamada"),
        fontes=[],
    )
    assert s.acao is Acao.REJECT and s.itens == []


def test_fonte_citada_cuja_lista_veio_vazia_e_removida(com_trechos):
    mescla = {"itens": [{"termo": "Item AI", "secao": "tratamento", "fontes": ["AI", "RAG"]}]}
    s = sugerir(falso_chat(rag_=_itens(), mescla=mescla), fontes=[Fonte.AI, Fonte.RAG])
    assert [f.value for f in s.itens[0].fontes] == ["AI"]


def test_secao_invalida_na_extracao_derruba_so_o_item(com_trechos):
    ai = _itens(("Item bom", "tratamento"), ("Item ruim", "outra"))
    mescla = {
        "itens": [
            {"termo": "Item bom", "secao": "tratamento", "fontes": ["AI"]},
            {"termo": "Item ruim", "secao": "outra", "fontes": ["AI"]},
        ]
    }
    s = sugerir(falso_chat(ai=ai, mescla=mescla), fontes=[Fonte.AI])
    assert [i.termo for i in s.itens] == ["Item bom"]


@pytest.mark.parametrize("ruim", [{}, {"itens": "x"}, {"itens": [{"termo": "A"}]}])
def test_saida_fora_do_contrato_rejeita(com_trechos, ruim):
    s = sugerir(falso_chat(ai=ruim), fontes=[Fonte.AI])
    assert s.acao is Acao.REJECT and s.itens == []


def test_banco_do_acervo_fora_do_ar_nao_derruba_as_outras_fontes(monkeypatch):
    from sqlalchemy.exc import OperationalError

    def cai(*a, **k):
        raise OperationalError("select", {}, Exception("sem conexão"))

    monkeypatch.setattr(ls.rag, "buscar", cai)
    mescla = {"itens": [{"termo": "Item AI", "secao": "tratamento", "fontes": ["AI"]}]}
    s = sugerir(falso_chat(mescla=mescla), fontes=[Fonte.AI, Fonte.RAG])
    assert s.acao is Acao.HUMAN_REVIEW and "Fonte RAG indisponível." in s.avisos


def test_prompts_proibem_dose_citacao_e_link_e_fecham_o_json(com_trechos):
    pedidos = []

    def chat(modelo, prompt):
        pedidos.append(prompt)
        return falso_chat()(modelo, prompt)

    sugerir(chat, fontes=[Fonte.AI, Fonte.RAG])
    ai = next(p for p in pedidos if "conhecimento geral" in p)
    assert "não inclua doses" in ai.lower() and "links" in ai
    assert (
        '"componentes": ["integrante", "..."], "secao": "tratamento|investigacao|acompanhamento"'
        in ai
    )
    assert "DIAGNÓSTICO: psoríase vulgar" in ai


def test_auditoria_nao_vaza_diagnostico_nem_itens(com_trechos, caplog):
    caplog.set_level("INFO", logger="medconsult.listas")
    mescla = {"itens": [{"termo": "Segredo terapêutico", "secao": "tratamento", "fontes": ["AI"]}]}
    sugerir(falso_chat(mescla=mescla), diagnostico="doença rara xyz", fontes=[Fonte.AI])
    log = caplog.text
    assert "propedeutica" in log and "doença rara" not in log and "Segredo" not in log
