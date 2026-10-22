import hashlib
import math
import re
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app import repositorio_rag as repo
from app.config import settings
from app.main import app
from app.motores import embeddings, rag
from app.motores.embeddings import EmbeddingIndisponivel

client = TestClient(app)


class EmbedderFalso:
    """Vetor por palavras (hash em 1024 posições): textos com as mesmas palavras ficam próximos."""

    modelo = "falso-1"

    def __init__(self, dim: int | None = None, falha: bool = False) -> None:
        self.dim = dim or settings.embedding_dim
        self.falha = falha
        self.chamadas = 0

    def embed(self, textos, tipo):
        self.chamadas += 1
        if self.falha:
            raise EmbeddingIndisponivel("fora do ar")
        saida = []
        for t in textos:
            v = [0.0] * self.dim
            for palavra in re.findall(r"\w{3,}", t.lower()):
                v[int(hashlib.md5(palavra.encode()).hexdigest(), 16) % self.dim] += 1.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            saida.append([x / n for x in v])
        return saida


class RerankFalso:
    modelo = "rerank-falso"

    def __init__(self, ordem=None, falha=False):
        self.ordem, self.falha = ordem, falha

    def rerank(self, consulta, textos, top_k):
        if self.falha:
            raise EmbeddingIndisponivel("fora do ar")
        ordem = self.ordem or list(range(len(textos)))[::-1]
        return [(i, 1.0 - n / 10) for n, i in enumerate(ordem[:top_k])]


@pytest.fixture(scope="module", autouse=True)
def tabelas():
    repo.criar_tabelas_rag()


@pytest.fixture
def esp():
    """Especialidade única por teste: isola do acervo real e permite limpar no fim."""
    e = f"teste-{uuid.uuid4().hex[:8]}"
    ids: list[str] = []
    yield e, ids
    for i in ids:
        repo.remover_documento(i)


def _doc(esp_nome, titulo, corpo, versao="1"):
    return rag.Documento(
        titulo=titulo, fonte=f"Fonte {esp_nome}", corpo=corpo, versao=versao, especialidade=esp_nome
    )


def _indexa(esp, doc, emb=None):
    emb = emb or EmbedderFalso()
    estado = rag.indexar_documento(doc, emb)
    esp[1].append(doc.id)
    return estado


# ------------------------------------------------------------------ documento e trechos


def test_ler_documento_valido_e_campos_ausentes_ficam_vazios():
    d = rag.ler_documento("titulo: Guia X\nfonte: Sociedade Y\n\nCorpo do texto.")
    assert (d.titulo, d.fonte, d.corpo) == ("Guia X", "Sociedade Y", "Corpo do texto.")
    assert d.versao == "" and d.data_fonte is None and d.especialidade is None and d.url is None


@pytest.mark.parametrize(
    "texto",
    [
        "fonte: Y\n\ncorpo",  # sem título
        "titulo: X\n\ncorpo",  # sem fonte
        "titulo: X\nfonte: Y\nautor: Z\n\ncorpo",  # campo desconhecido
        "titulo: X\nfonte: Y\ndata: 14/03/2025\n\ncorpo",  # data fora do formato
        "titulo: X\nfonte: Y\n\n   ",  # sem conteúdo
    ],
)
def test_ler_documento_invalido_e_rejeitado(texto):
    with pytest.raises(rag.DocumentoInvalido):
        rag.ler_documento(texto)


def test_trechos_curtos_ficam_juntos_e_longos_sao_cortados_com_sobreposicao():
    assert rag.dividir_em_trechos("Um.\n\nDois.") == ["Um.\n\nDois."]
    longo = " ".join(f"palavra{i}" for i in range(600))
    trechos = rag.dividir_em_trechos(longo, max_chars=300, sobreposicao=50)
    assert len(trechos) > 3 and all(len(t) <= 300 for t in trechos)
    assert trechos[0].split()[-1] in trechos[1]  # sobreposição
    assert "palavra599" in trechos[-1] and "palavra0" in trechos[0]


# --------------------------------------------------------------------- indexar e buscar


def test_indexar_e_idempotente_e_reindexa_so_se_mudar(esp):
    nome, _ = esp
    emb = EmbedderFalso()
    doc = _doc(nome, "Doc A", "texto sobre psoríase em placas")
    assert _indexa(esp, doc, emb) == "indexado"
    assert _indexa(esp, doc, emb) == "inalterado"
    assert emb.chamadas == 1  # segunda vez não gasta a Voyage
    assert _indexa(esp, _doc(nome, "Doc A", "texto sobre psoríase invertida"), emb) == "indexado"


def test_falha_do_embedding_nao_grava_nada(esp):
    nome, ids = esp
    doc = _doc(nome, "Doc B", "conteúdo qualquer")
    with pytest.raises(EmbeddingIndisponivel):
        rag.indexar_documento(doc, EmbedderFalso(falha=True))
    assert repo.hash_do_documento(doc.id) is None


def test_busca_acha_o_documento_certo_com_a_fonte(esp):
    nome, _ = esp
    _indexa(
        esp, _doc(nome, "Psoríase", "A psoríase em placas causa descamação prateada nos cotovelos.")
    )
    _indexa(esp, _doc(nome, "Hanseníase", "A hanseníase causa perda de sensibilidade em manchas."))
    b = rag.buscar(
        "descamação prateada nos cotovelos", embedder=EmbedderFalso(), k=3, especialidade=nome
    )
    assert b.modo == "hibrida" and b.avisos == []
    assert b.resultados[0].titulo == "Psoríase"
    assert b.resultados[0].fonte == f"Fonte {nome}" and b.resultados[0].versao == "1"
    assert set(b.resultados[0].origens) >= {"vetor", "texto"}


def test_filtro_de_especialidade_isola_resultados(esp):
    nome, _ = esp
    _indexa(esp, _doc(nome, "Só aqui", "frase distintiva zzxquark"))
    assert rag.buscar("zzxquark", embedder=EmbedderFalso(), especialidade=nome).resultados
    assert not rag.buscar(
        "zzxquark", embedder=EmbedderFalso(), especialidade="outra-esp"
    ).resultados


def test_sem_voyage_cai_para_busca_por_palavras_e_avisa(esp):
    nome, _ = esp
    _indexa(esp, _doc(nome, "Doc C", "protocolo de crioterapia para verrugas"))
    b = rag.buscar("crioterapia verrugas", embedder=EmbedderFalso(falha=True), especialidade=nome)
    assert b.modo == "texto" and b.resultados[0].titulo == "Doc C"
    assert any("palavras" in a for a in b.avisos)


def test_rerank_reordena_e_sua_falha_so_avisa(esp):
    nome, _ = esp
    _indexa(esp, _doc(nome, "Doc D1", "tratamento tópico corticoide"))
    _indexa(esp, _doc(nome, "Doc D2", "tratamento tópico imunomodulador"))
    emb = EmbedderFalso()
    base = rag.buscar("tratamento tópico", embedder=emb, especialidade=nome)
    assert len(base.resultados) == 2
    inv = rag.buscar(
        "tratamento tópico", embedder=emb, especialidade=nome, reranker=RerankFalso([1, 0])
    )
    assert [r.titulo for r in inv.resultados] == [
        base.resultados[1].titulo,
        base.resultados[0].titulo,
    ]
    assert "rerank" in inv.resultados[0].origens
    falha = rag.buscar(
        "tratamento tópico", embedder=emb, especialidade=nome, reranker=RerankFalso(falha=True)
    )
    assert [r.titulo for r in falha.resultados] == [r.titulo for r in base.resultados]
    assert any("Reordenação" in a for a in falha.avisos)


def test_consulta_vazia_e_sem_resultado():
    with pytest.raises(ValueError):
        rag.buscar("   ", embedder=EmbedderFalso())
    b = rag.buscar("zzzqqq", embedder=EmbedderFalso(), especialidade="nao-existe")
    assert b.resultados == [] and any("Nenhum trecho" in a for a in b.avisos)


# ----------------------------------------------------------------------------- avaliação


def test_avaliar_calcula_recall_e_mrr():
    def fake(q):
        titulos = {"a": ["X", "Y"], "b": ["Z", "Y"], "c": ["Z"]}[q]
        return rag.Busca(
            resultados=[rag.Resultado("1", "t", t, "f", "", None, None, 0.0) for t in titulos],
            modo="hibrida",
        )

    casos = [
        {"pergunta": "a", "esperados": ["X"]},  # 1º
        {"pergunta": "b", "esperados": ["Y"]},  # 2º
        {"pergunta": "c", "esperados": ["Y"]},  # errou
    ]
    r = rag.avaliar(casos, fake, k=2)
    assert r["recall@2"] == pytest.approx(2 / 3)
    assert r["mrr"] == pytest.approx((1 + 0.5) / 3)
    with pytest.raises(ValueError):
        rag.avaliar([], fake)


# ------------------------------------------------------------------------------ endpoints


def test_endpoint_estado_nao_chama_a_openai(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    r = client.get("/rag/estado").json()
    assert r["embeddings"]["ok"] is False and "OPENAI_API_KEY" in r["embeddings"]["detalhe"]
    assert r["dimensao"] == settings.embedding_dim and "documentos" in r["acervo"]


def test_nao_ha_rota_que_devolva_trechos_dos_livros():
    # os livros são base interna: nenhuma rota HTTP devolve trecho, título nem fonte
    assert client.post("/rag/buscar", json={"consulta": "psoríase"}).status_code in (404, 405)


# ------------------------------------------------------------------- cliente da OpenAI


def _resp(status, corpo=None):
    return httpx.Response(status, json=corpo or {}, request=httpx.Request("POST", "http://x"))


def _ok(vetores):
    return _resp(200, {"data": [{"index": i, "embedding": v} for i, v in enumerate(vetores)]})


def test_openai_embedder_ordena_por_indice_e_confere_a_dimensao(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    emb = embeddings.OpenAIEmbedder(dim=3)
    chamado = {}

    def post(url, json, headers, timeout):
        chamado.update(json)
        return _resp(
            200,
            {"data": [{"index": 1, "embedding": [4, 5, 6]}, {"index": 0, "embedding": [1, 2, 3]}]},
        )

    monkeypatch.setattr(httpx, "post", post)
    assert emb.embed(["a", "b"], "document") == [[1, 2, 3], [4, 5, 6]]
    assert chamado["dimensions"] == 3 and chamado["model"] == emb.modelo
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _ok([[1, 2]]))
    with pytest.raises(EmbeddingIndisponivel):  # vetor com tamanho errado
        embeddings.OpenAIEmbedder(dim=3).embed(["a"], "query")


def test_openai_embedder_sem_chave_e_com_erro_nao_vaza_conteudo(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(EmbeddingIndisponivel, match="OPENAI_API_KEY"):
        embeddings.OpenAIEmbedder().embed(["texto clínico"], "query")
    monkeypatch.setattr(settings, "openai_api_key", "k")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _resp(401, {"error": "texto clínico"}))
    with pytest.raises(EmbeddingIndisponivel) as e:
        embeddings.OpenAIEmbedder().embed(["texto clínico"], "query")
    assert "clínico" not in str(e.value)


def test_openai_embedder_repete_em_429_e_depois_desiste(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    monkeypatch.setattr(embeddings.time, "sleep", lambda s: None)
    respostas = [_resp(429), _resp(429), _ok([[1.0, 0.0]])]
    monkeypatch.setattr(httpx, "post", lambda *a, **k: respostas.pop(0))
    assert embeddings.OpenAIEmbedder(dim=2).embed(["a"], "document") == [[1.0, 0.0]]
    n = {"c": 0}

    def sempre_429(*a, **k):
        n["c"] += 1
        return _resp(429)

    monkeypatch.setattr(httpx, "post", sempre_429)
    with pytest.raises(EmbeddingIndisponivel, match="429"):
        embeddings.OpenAIEmbedder(dim=2).embed(["a"], "document")
    assert n["c"] == embeddings.TENTATIVAS


def test_mudar_a_dimensao_zera_o_acervo_derivado(monkeypatch):
    """Roda num esquema descartável: NUNCA toca nas tabelas reais do acervo."""
    from sqlalchemy import create_engine, text

    from app.db import _sqlalchemy_url

    esquema = f"teste_{uuid.uuid4().hex[:8]}"
    with repo.engine.begin() as c:
        c.execute(text(f"CREATE SCHEMA {esquema}"))
    isolado = create_engine(
        _sqlalchemy_url(settings.database_url),
        connect_args={"options": f"-csearch_path={esquema},public"},
    )
    try:
        monkeypatch.setattr(repo, "engine", isolado)
        monkeypatch.setattr(settings, "embedding_dim", 3)
        repo.criar_tabelas_rag()
        doc = _doc("esp-dim", "Doc dim", "texto para dimensão")
        repo.substituir_documento(
            documento_id=doc.id,
            titulo=doc.titulo,
            fonte=doc.fonte,
            versao="",
            data_fonte=None,
            especialidade=None,
            url=None,
            hash_conteudo="h",
            modelo="m",
            trechos=["t"],
            vetores=[[1.0, 0.0, 0.0]],
        )
        assert repo.contagens() == {"documentos": 1, "trechos": 1}
        monkeypatch.setattr(settings, "embedding_dim", 4)  # dimensão diferente: recria vazio
        repo.criar_tabelas_rag()
        assert repo.contagens() == {"documentos": 0, "trechos": 0}
    finally:
        monkeypatch.undo()
        isolado.dispose()
        with repo.engine.begin() as c:
            c.execute(text(f"DROP SCHEMA {esquema} CASCADE"))


# ------------------------------------------------------------ reordenação por IA (OpenAI)


def _chat(notas):
    import json as _json

    return _resp(200, {"choices": [{"message": {"content": _json.dumps({"notas": notas})}}]})


def test_reranker_ordena_por_nota_e_trecho_sem_nota_vale_zero(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _chat({"0": 2, "1": 9, "2": "x"}))
    r = embeddings.OpenAIReranker().rerank("caso", ["a", "b", "c", "d"], top_k=4)
    assert [i for i, _ in r] == [1, 0, 2, 3]  # nota inválida e ausente = 0, na ordem original
    assert r[0] == (1, 9.0) and r[2][1] == 0.0


def test_reranker_resposta_fora_do_formato_levanta(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    for corpo in ({"choices": []}, {"choices": [{"message": {"content": "não é json"}}]}):
        monkeypatch.setattr(httpx, "post", lambda *a, _c=corpo, **k: _resp(200, _c))
        with pytest.raises(EmbeddingIndisponivel):
            embeddings.OpenAIReranker().rerank("caso", ["a", "b"], top_k=2)


def test_buscar_reordena_so_o_topo_e_mantem_o_resto(monkeypatch, esp):
    nome, _ = esp
    monkeypatch.setattr(settings, "rag_rerank_candidatos", 2)
    for i in range(4):
        _indexa(esp, _doc(nome, f"Doc R{i}", f"assunto comum numero{i} tratamento topico"))
    emb = EmbedderFalso()
    base = rag.buscar("assunto comum tratamento topico", embedder=emb, especialidade=nome, k=4)
    assert len(base.resultados) == 4
    inv = rag.buscar(
        "assunto comum tratamento topico",
        embedder=emb,
        especialidade=nome,
        k=4,
        reranker=RerankFalso([1, 0]),
    )
    ids = [r.trecho_id for r in base.resultados]
    assert [r.trecho_id for r in inv.resultados] == [ids[1], ids[0], ids[2], ids[3]]
    assert "rerank" in inv.resultados[0].origens and "rerank" not in inv.resultados[3].origens
