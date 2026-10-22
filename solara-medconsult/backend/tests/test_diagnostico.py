import pytest

from app.config import settings
from app.motores import diagnostico as dx
from app.motores import rag
from app.motores.embeddings import EmbeddingIndisponivel


def _busca(n=2):
    rs = [
        rag.Resultado(f"id{i}", f"trecho {i}", "Livro", "Fonte", "", None, None, 0.1, ["vetor"])
        for i in range(n)
    ]
    return rag.Busca(resultados=rs, modo="hibrida")


@pytest.fixture
def com_trechos(monkeypatch):
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: _busca())


def _chat(*hipoteses):
    return lambda modelo, prompt: {
        "hipoteses": [{"diagnostico": d, "confianca": c, "cid11": "XA00"} for d, c in hipoteses]
    }


def sugerir(chat, caso="caso clínico"):
    return dx.sugerir_diagnosticos(caso, embedder=object(), chat=chat)


def test_ordena_pela_estimativa_e_exige_revisao_humana(com_trechos):
    # o modelo devolveu "fora de ordem": número e posição precisam concordar
    s = sugerir(_chat(("Psoríase vulgar", 0.3), ("Dermatite seborreica", 0.6)))
    assert s.diagnosticos == ["Dermatite seborreica", "Psoríase vulgar"]
    assert s.probabilidades == [60, 30]
    assert s.cid11 == ["XA00", "XA00"]
    assert s.acao is dx.Acao.HUMAN_REVIEW
    assert s.decision_id and s.modelo == settings.diagnostico_model and s.schema_versao == "1"


def test_cid11_acompanha_cada_diagnostico_na_ordem_certa(com_trechos):
    def chat(modelo, prompt):
        return {
            "hipoteses": [
                {"diagnostico": "Psoríase vulgar", "confianca": 0.3, "cid11": "EA90"},
                {"diagnostico": "Dermatite seborreica", "confianca": 0.6, "cid11": "EA80"},
            ]
        }

    s = sugerir(chat)
    assert s.diagnosticos == ["Dermatite seborreica", "Psoríase vulgar"]
    assert s.cid11 == ["EA80", "EA90"]


def test_cid11_ausente_e_rejeitado_sem_inventar(com_trechos):
    s = sugerir(lambda m, p: {"hipoteses": [{"diagnostico": "Doença Y", "confianca": 0.5}]})
    assert s.acao is dx.Acao.REJECT and s.diagnosticos == [] and s.cid11 == []


def test_estimativas_que_somam_mais_de_100_sao_reduzidas_proporcionalmente(com_trechos):
    s = sugerir(_chat(("Doença A", 0.9), ("Doença B", 0.6), ("Doença C", 0.3)))
    assert s.probabilidades == [50, 33, 17]
    assert sum(s.probabilidades) <= 101  # arredondamento
    assert s.probabilidades == sorted(s.probabilidades, reverse=True)


def test_estimativas_que_somam_ate_100_ficam_como_vieram(com_trechos):
    s = sugerir(_chat(("Doença A", 0.55), ("Doença B", 0.25)))
    assert s.probabilidades == [55, 25]


def test_percentuais_nao_dependem_do_modelo_obedecer_o_prompt():
    assert dx._percentuais([1.0, 1.0]) == [50, 50]
    assert dx._percentuais([]) == []
    assert dx._percentuais([0.0, 0.0]) == [0, 0]


def test_nunca_existe_auto_execute():
    assert {a.value for a in dx.Acao} == {"HUMAN_REVIEW", "REJECT"}


def test_prompt_pede_ordem_de_probabilidade_e_proibe_citar_o_livro(com_trechos):
    visto = {}

    def chat(modelo, prompt):
        visto["p"] = prompt
        return {"hipoteses": [{"diagnostico": "X doença", "confianca": 0.5, "cid11": "XA00"}]}

    sugerir(chat)
    assert "do mais para o menos provável" in visto["p"]
    assert "não cite trechos nem páginas" in visto["p"]


def test_remove_duplicados_ignorando_acento_e_caixa_e_limita_o_total(com_trechos):
    nomes = [("Pênfigo vulgar", 0.9), ("PENFIGO VULGAR", 0.8)] + [
        (f"Doença {i}", 0.1) for i in range(9)
    ]
    s = sugerir(_chat(*nomes))
    assert s.diagnosticos[0] == "Pênfigo vulgar" and len(s.diagnosticos) == settings.diagnostico_max
    assert len({dx._norm(d) for d in s.diagnosticos}) == len(s.diagnosticos)


@pytest.mark.parametrize(
    "bruto",
    [
        {},  # sem o campo
        {"hipoteses": "texto"},  # tipo errado
        {"hipoteses": [{"diagnostico": "X", "confianca": 0.5}]},  # nome curto demais
        {"hipoteses": [{"diagnostico": "Doença Y", "confianca": 1.5}]},  # confiança fora de 0..1
        {"hipoteses": [{"diagnostico": "Doença Y"}]},  # sem confiança
    ],
)
def test_saida_fora_do_contrato_e_rejeitada(com_trechos, bruto):
    s = sugerir(lambda m, p: bruto)
    assert s.acao is dx.Acao.REJECT and s.diagnosticos == []


def test_lista_vazia_do_modelo_e_rejeitada(com_trechos):
    assert sugerir(_chat()).acao is dx.Acao.REJECT


def test_sem_base_no_acervo_rejeita_sem_chamar_o_modelo(monkeypatch):
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: _busca(0))

    def nao_deve_chamar(m, p):
        raise AssertionError("não deveria chamar o modelo")

    s = sugerir(nao_deve_chamar)
    assert s.acao is dx.Acao.REJECT and "sem base" in s.motivos[0]


def test_modelo_fora_do_ar_rejeita_e_caso_vazio_rejeita(com_trechos):
    def cai(m, p):
        raise EmbeddingIndisponivel("x")

    assert sugerir(cai).acao is dx.Acao.REJECT
    assert sugerir(_chat(("Doença Z", 0.5)), caso="   ").acao is dx.Acao.REJECT


def test_auditoria_nao_vaza_o_caso_nem_os_diagnosticos(com_trechos, caplog):
    with caplog.at_level("INFO", logger="medconsult.diagnostico"):
        sugerir(_chat(("Doença Secreta", 0.9)), caso="paciente José da Silva, CPF 123")
    texto = " ".join(r.getMessage() for r in caplog.records)
    assert "decision_id" not in texto and "id=" in texto
    for proibido in ("José", "CPF", "Secreta"):
        assert proibido not in texto


def test_confere_posicao_sem_acento_nem_caixa():
    assert dx.confere(["Dermatite", "Síndrome de SÉZARY"], ["sezary"], 5) == 2
    assert dx.confere(["Dermatite"], ["sezary"], 5) is None
    assert dx.confere(["A", "B", "Sézary"], ["Sézary"], 2) is None  # fora do top-k


def test_banco_do_acervo_fora_do_ar_rejeita_sem_estourar(monkeypatch):
    from sqlalchemy.exc import OperationalError

    def cai(*a, **k):
        raise OperationalError("select", {}, Exception("sem conexão"))

    monkeypatch.setattr(dx.rag, "buscar", cai)
    s = sugerir(_chat(("Doença Z", 0.5)))
    assert s.acao is dx.Acao.REJECT and s.motivos == ["acervo indisponível"]


def test_so_ai_nao_busca_no_acervo_e_so_rag_usa_apenas_os_trechos(monkeypatch):
    buscas = []
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: buscas.append(1) or _busca())
    prompts = []

    def chat(modelo, prompt):
        prompts.append(prompt)
        return {"hipoteses": [{"diagnostico": "Psoríase", "confianca": 0.9, "cid11": "EA90"}]}

    dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=["AI"])
    assert buscas == [] and "Use seu conhecimento médico geral apenas" in prompts[-1]
    dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=["RAG"])
    assert len(buscas) == 1 and "Use os TRECHOS DE REFERÊNCIA apenas" in prompts[-1]
    dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=["AI", "RAG"])
    assert "TRECHOS DE REFERÊNCIA e seu conhecimento" in prompts[-1]


def test_sem_fonte_valida_nao_gera_e_so_rag_sem_base_rejeita(monkeypatch):
    chat = lambda m, p: pytest.fail("não deveria chamar o modelo")  # noqa: E731
    for fontes in ([], ["Diretrizes"]):
        s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=fontes)
        assert s.acao is dx.Acao.REJECT
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: rag.Busca(resultados=[], modo="hibrida"))
    s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=["RAG"])
    assert s.acao is dx.Acao.REJECT


def test_colado_basta_mesmo_sem_fonte_nem_ai():
    prompts = []

    def chat(modelo, prompt):
        prompts.append(prompt)
        return {"hipoteses": [{"diagnostico": "Psoríase", "confianca": 0.9, "cid11": "EA90"}]}

    s = dx.sugerir_diagnosticos(
        "caso", embedder=object(), chat=chat, fontes=[], colado="Trecho da OpenEvidence"
    )
    assert s.acao is dx.Acao.HUMAN_REVIEW
    assert "Trecho da OpenEvidence" in prompts[-1]
    assert "o MATERIAL COLADO PELO MÉDICO" in prompts[-1]


def test_sem_fonte_e_sem_colado_rejeita():
    chat = lambda m, p: pytest.fail("não deveria chamar o modelo")  # noqa: E731
    s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=chat, fontes=[], colado="   ")
    assert s.acao is dx.Acao.REJECT and s.motivos == ["nenhuma fonte escolhida"]
