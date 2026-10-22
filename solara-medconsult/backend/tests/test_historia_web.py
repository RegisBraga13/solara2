import pytest

from app.config import settings
from app.motores import diagnostico as dx
from app.motores import historia as hs
from app.motores import rag, web
from app.motores.embeddings import EmbeddingIndisponivel

# ------------------------------------------------------------------ história clínica


def test_historia_so_reescreve_o_registro_e_exige_revisao():
    visto = {}

    def chat(modelo, prompt):
        visto["p"] = prompt
        return {"topicos": [{"titulo": "Queixa principal", "texto": "Prurido há 3 dias."}]}

    r = hs.gerar_historia("prurido há 3 dias", chat=chat)
    assert r.acao is hs.Acao.HUMAN_REVIEW and r.historia == "Queixa principal: Prurido há 3 dias."
    assert "Não invente" in visto["p"] and "prurido há 3 dias" in visto["p"]
    assert r.modelo == settings.historia_model


def test_historia_vazia_ou_modelo_fora_do_ar_ou_saida_ruim_rejeita():
    def nunca(modelo, prompt):
        raise AssertionError("não deveria chamar o modelo")

    assert hs.gerar_historia("   ", chat=nunca).acao is hs.Acao.REJECT

    def cai(modelo, prompt):
        raise EmbeddingIndisponivel("fora")

    assert hs.gerar_historia("algo", chat=cai).acao is hs.Acao.REJECT
    for ruim in (
        {},
        {"topicos": "x"},
        {"topicos": []},  # nada aproveitável
        {"topicos": [{"titulo": "Hábitos", "texto": "N/A"}]},  # só tópicos sem informação
        {"topicos": [{"titulo": "Queixa", "texto": "x" * 9000}]},
    ):
        assert hs.gerar_historia("algo", chat=lambda m, p, r=ruim: r).acao is hs.Acao.REJECT


def test_historia_auditoria_sem_conteudo(caplog):
    caplog.set_level("INFO", logger="medconsult.historia")
    hs.gerar_historia(
        "segredo clínico",
        chat=lambda m, p: {"topicos": [{"titulo": "Queixa", "texto": "texto sigiloso"}]},
    )
    assert "historia id=" in caplog.text
    assert "segredo" not in caplog.text and "sigiloso" not in caplog.text


# ------------------------------------------------------------------ busca web


def _resposta(*textos):
    return {
        "output": [
            {"type": "web_search_call", "status": "completed"},
            {
                "type": "message",
                "content": [{"type": "output_text", "text": t, "annotations": []} for t in textos],
            },
        ]
    }


def test_web_envia_so_os_dominios_permitidos_e_tira_links(monkeypatch):
    enviado = {}

    def post(caminho, corpo, timeout=60.0):
        enviado.update(caminho=caminho, corpo=corpo)
        return _resposta(
            "• Metotrexato ([pubmed](https://pubmed.ncbi.nlm.nih.gov/1/?utm=x))\n"
            "• Veja [a diretriz](https://sbd.org.br/x) e https://aad.org/y"
        )

    monkeypatch.setattr(web, "_post", post)
    texto = web.buscar_web("psoríase")
    ferramenta = enviado["corpo"]["tools"][0]
    assert enviado["caminho"] == "responses" and ferramenta["type"] == "web_search"
    assert ferramenta["filters"]["allowed_domains"] == [
        "pubmed.ncbi.nlm.nih.gov",
        "sbd.org.br",
        "aad.org",
        "openevidence.com",
    ]
    assert "http" not in texto and "Metotrexato" in texto and "a diretriz" in texto


def test_web_sem_resultado_ou_formato_estranho():
    assert web._sem_links("a [b](http://x) c") == "a b c"
    import app.motores.web as w

    original = w._post
    try:
        w._post = lambda *a, **k: _resposta("Sem resultados.")
        assert w.buscar_web("x") == ""
        w._post = lambda *a, **k: {"output": None}
        with pytest.raises(EmbeddingIndisponivel):
            w.buscar_web("x")
    finally:
        w._post = original


def test_web_sem_dominios_configurados_nao_busca(monkeypatch):
    monkeypatch.setattr(settings, "web_search_domains", [])
    monkeypatch.setattr(web, "_post", lambda *a, **k: pytest.fail("não deveria chamar a rede"))
    assert web.buscar_web("x") == ""


# ------------------------------------------------------------------ diagnóstico com Web


def _chat_dx(visto):
    def chat(modelo, prompt):
        visto.append(prompt)
        return {"hipoteses": [{"diagnostico": "Psoríase", "confianca": 0.9, "cid11": "EA90"}]}

    return chat


def test_diagnostico_so_web_usa_o_resumo_e_nao_o_acervo(monkeypatch):
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: pytest.fail("RAG não foi escolhido"))
    monkeypatch.setattr(dx, "buscar_web", lambda c: "resumo da web")
    vistos = []
    s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=_chat_dx(vistos), fontes=["Web"])
    assert s.diagnosticos == ["Psoríase"]
    assert "RESUMO DA WEB" in vistos[-1] and "resumo da web" in vistos[-1]
    assert "o RESUMO DA WEB apenas" in vistos[-1]


def test_diagnostico_web_vazia_ou_fora_do_ar_so_web_rejeita_sem_chamar_o_modelo(monkeypatch):
    def nunca(modelo, prompt):
        if "Resuma os achados" in prompt:  # o resumo para a busca é permitido
            return {"achados": "placas descamativas"}
        raise AssertionError("não deveria gerar diagnósticos")

    monkeypatch.setattr(dx, "buscar_web", lambda c: "")
    s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=nunca, fontes=["Web"])
    assert s.acao is dx.Acao.REJECT and s.diagnosticos == []

    def cai(c):
        raise EmbeddingIndisponivel("fora")

    monkeypatch.setattr(dx, "buscar_web", cai)
    s = dx.sugerir_diagnosticos("caso", embedder=object(), chat=nunca, fontes=["Web"])
    assert s.acao is dx.Acao.REJECT and "Fonte Web indisponível." in s.avisos


def test_diagnostico_ai_mais_web_segue_mesmo_com_web_fora_do_ar(monkeypatch):
    def cai(c):
        raise EmbeddingIndisponivel("fora")

    monkeypatch.setattr(dx, "buscar_web", cai)
    vistos = []
    s = dx.sugerir_diagnosticos(
        "caso", embedder=object(), chat=_chat_dx(vistos), fontes=["AI", "Web"]
    )
    assert s.acao is dx.Acao.HUMAN_REVIEW and "Fonte Web indisponível." in s.avisos


def test_diagnostico_envia_web_so_um_pedaco_do_caso(monkeypatch):
    enviados = []
    monkeypatch.setattr(dx, "buscar_web", lambda c: enviados.append(c) or "resumo")
    monkeypatch.setattr(dx.rag, "buscar", lambda *a, **k: rag.Busca(resultados=[], modo="hibrida"))
    dx.sugerir_diagnosticos("a" * 5000, embedder=object(), chat=_chat_dx([]), fontes=["Web"])
    assert len(enviados[0]) < dx.MAX_CASO_WEB + 300


# ------------------------------------------------------------------ sem créditos


def test_sem_creditos_falha_na_hora_sem_repetir(monkeypatch):
    from app.motores import embeddings as em

    chamadas = []

    class Resp:
        status_code = 429
        text = '{"error": {"code": "insufficient_quota"}}'
        request = None

    monkeypatch.setattr(settings, "openai_api_key", "x")
    monkeypatch.setattr(em.httpx, "post", lambda *a, **k: chamadas.append(1) or Resp())
    monkeypatch.setattr(em.time, "sleep", lambda s: pytest.fail("não deveria esperar"))
    with pytest.raises(EmbeddingIndisponivel, match="sem créditos"):
        em._post("chat/completions", {})
    assert len(chamadas) == 1


def test_historia_descarta_topicos_sem_informacao_e_formata_uma_linha_por_topico():
    saida = {
        "topicos": [
            {"titulo": "Queixa principal:", "texto": "Placas em cotovelos."},
            {"titulo": "Hábitos", "texto": "N/A"},
            {"titulo": "Alergias", "texto": "Não informado."},
            {"titulo": "Antecedentes", "texto": "Mãe com psoríase."},
        ]
    }
    r = hs.gerar_historia("x", chat=lambda m, p: saida)
    assert r.historia == "Queixa principal: Placas em cotovelos.\nAntecedentes: Mãe com psoríase."


def test_diagnostico_web_busca_so_os_achados_resumidos_sem_identificadores(monkeypatch):
    enviados = []
    monkeypatch.setattr(dx, "buscar_web", lambda c: enviados.append(c) or "resumo")

    def chat(modelo, prompt):
        if "Resuma os achados" in prompt:
            return {"achados": "placas descamativas, pitting ungueal / scaly plaques, nail pitting"}
        return {"hipoteses": [{"diagnostico": "Psoríase", "confianca": 0.9, "cid11": "EA90"}]}

    caso = "Maria Souza, 45 anos, CPF 123, placas descamativas e pitting ungueal."
    s = dx.sugerir_diagnosticos(caso, embedder=object(), chat=chat, fontes=["Web"])
    assert s.acao is dx.Acao.HUMAN_REVIEW
    assert "scaly plaques" in enviados[0]
    assert "Maria" not in enviados[0] and "CPF" not in enviados[0]


def test_diagnostico_web_sem_resumo_do_modelo_usa_o_inicio_do_caso(monkeypatch):
    enviados = []
    monkeypatch.setattr(dx, "buscar_web", lambda c: enviados.append(c) or "resumo")

    def chat(modelo, prompt):
        if "Resuma os achados" in prompt:
            raise EmbeddingIndisponivel("fora")
        return {"hipoteses": [{"diagnostico": "Psoríase", "confianca": 0.9, "cid11": "EA90"}]}

    dx.sugerir_diagnosticos("placas em cotovelos", embedder=object(), chat=chat, fontes=["Web"])
    assert "placas em cotovelos" in enviados[0]
