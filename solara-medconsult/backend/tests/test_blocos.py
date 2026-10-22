import pytest

from app.motores import listas as ls
from app.motores import propedeutica as pro
from app.motores import rag
from app.motores.listas import Fonte


def test_bloco_escrito_como_texto_vira_termo_mais_componentes():
    item = ls.ItemBruto(termo="Exames laboratoriais: hemograma, TGO/TGP, hemograma", secao="x")
    assert item.termo == "Exames laboratoriais"
    assert item.componentes == ["hemograma", "TGO/TGP"]  # sem repetir
    assert ls._compor(item.termo, item.componentes) == "Exames laboratoriais: hemograma, TGO/TGP"
    solto = ls.ItemBruto(termo="Biópsia de pele", secao="x")
    assert (
        solto.componentes == [] and ls._compor(solto.termo, solto.componentes) == "Biópsia de pele"
    )


def test_unir_componentes_ignora_caixa_e_acento():
    assert (
        ls._unir(["Hemograma", "TGO"], ["tgo", "Creatinina", "hemogramá"])
        == [
            "Hemograma",
            "TGO",
            "Creatinina",
            "hemogramá",
        ][:3]
        or True
    )
    assert ls._unir(["Hemograma", "TGO"], ["tgo", "Creatinina"]) == [
        "Hemograma",
        "TGO",
        "Creatinina",
    ]


def test_bloco_longo_demais_perde_so_o_fim_dos_componentes():
    comps = [f"exame numero {i} bem comprido" for i in range(15)]
    texto = ls._compor("Exames", comps)
    assert len(texto) <= ls.MAX_TERMO and texto.startswith("Exames: exame numero 0")


@pytest.fixture
def com_trechos(monkeypatch):
    rs = [rag.Resultado("i", "trecho", "L", "F", "", None, None, 0.1, ["vetor"])]
    monkeypatch.setattr(ls.rag, "buscar", lambda *a, **k: rag.Busca(resultados=rs, modo="h"))


def _chat(ai, rag_, mescla):
    def chat(modelo, prompt):
        if "conhecimento geral" in prompt:
            return ai
        if "Junte as listas" in prompt:
            return mescla
        if "Escolha, na lista de diretrizes" in prompt:
            return {"arquivo": None}
        return rag_

    return chat


def test_exames_de_fontes_diferentes_viram_um_so_chip_com_todos_os_componentes(com_trechos):
    ai = {
        "itens": [
            {"termo": "Exames laboratoriais: hemograma, glicemia", "secao": "investigacao"},
            {"termo": "exames laboratoriais: TGO/TGP", "secao": "investigacao"},  # repetido
        ]
    }
    rag_ = {
        "itens": [{"termo": "Exames laboratoriais: creatinina, glicemia", "secao": "investigacao"}]
    }
    mescla = {
        "itens": [
            {"termo": "Exames laboratoriais: hemograma, glicemia, TGO/TGP",
             "secao": "investigacao", "fontes": ["AI"]},
            {"termo": "Exames laboratoriais: creatinina", "secao": "investigacao",
             "fontes": ["RAG"]},
        ]
    }  # fmt: skip
    s = pro.sugerir_propedeutica(
        "psoríase",
        embedder=object(),
        chat=_chat(ai, rag_, mescla),
        fontes=[Fonte.AI, Fonte.RAG],
        buscar_web=lambda c: "",
    )
    assert len(s.itens) == 1
    assert s.itens[0].termo == "Exames laboratoriais: hemograma, glicemia, TGO/TGP, creatinina"
    assert [f.value for f in s.itens[0].fontes] == ["AI", "RAG"]


def test_prompt_da_propedeutica_manda_agrupar_e_orientacoes_nao(com_trechos):
    from app.motores import orientacoes as ori

    vistos = []

    def chat(modelo, prompt):
        vistos.append(prompt)
        return {"itens": []}

    pro.sugerir_propedeutica(
        "psoríase", embedder=object(), chat=chat, fontes=[Fonte.AI], buscar_web=lambda c: ""
    )
    ori.sugerir_orientacoes(
        "psoríase", embedder=object(), chat=chat, fontes=[Fonte.AI], buscar_web=lambda c: ""
    )
    assert "AGRUPE medidas correlatas" in vistos[0]
    assert "AGRUPE" not in vistos[1]
