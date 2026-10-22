"""RAG na nuvem (vector stores da OpenAI): só a especialidade dona usa, com filtro por gênero."""

import pytest

from app.config import settings
from app.motores import nuvem, rag
from app.motores.embeddings import EmbeddingIndisponivel


class _SemEmbedder:
    modelo = "x"
    dim = 3

    def embed(self, textos, tipo):  # pragma: no cover - não deve ser chamado na nuvem
        raise AssertionError("não deveria usar embeddings locais")


def _trecho(texto="critérios do episódio depressivo"):
    return nuvem.TrechoNuvem("file-1", "livro.pdf", texto, 0.9, {"escopo": "criterios"})


def test_psiquiatria_busca_na_nuvem_com_escopos(monkeypatch):
    monkeypatch.setattr(settings, "especialidade", "psiquiatria")
    monkeypatch.setattr(settings, "openai_rag_vector_store_id", "vs_teste")
    chamadas = []

    def falso(store, consulta, *, k, escopos):
        chamadas.append((store, k, escopos))
        return [_trecho()]

    monkeypatch.setattr(nuvem, "buscar", falso)
    busca = rag.buscar("depressão", embedder=_SemEmbedder(), k=5, escopos=("criterios",))
    assert busca.modo == "nuvem"
    assert busca.resultados[0].texto.startswith("critérios")
    assert chamadas == [("vs_teste", 5, ("criterios",))]


def test_dermatologia_ignora_o_vector_store_do_env(monkeypatch):
    monkeypatch.setattr(settings, "especialidade", "dermatologia")
    monkeypatch.setattr(settings, "openai_rag_vector_store_id", "vs_teste")
    monkeypatch.setattr(
        nuvem, "buscar", lambda *a, **k: pytest.fail("dermatologia não pode ler acervo alheio")
    )
    with pytest.raises(Exception) as erro:  # cai no caminho local (banco/embedder)
        rag.buscar("lesão", embedder=_SemEmbedder(), k=3)
    assert "nuvem" not in str(erro.value).lower()


def test_falha_da_nuvem_cai_no_acervo_local_com_aviso(monkeypatch):
    monkeypatch.setattr(settings, "especialidade", "psiquiatria")
    monkeypatch.setattr(settings, "openai_rag_vector_store_id", "vs_teste")

    def quebra(*a, **k):
        raise EmbeddingIndisponivel("fora do ar")

    monkeypatch.setattr(nuvem, "buscar", quebra)
    monkeypatch.setattr(
        rag.repo, "buscar_por_vetor", lambda *a, **k: (_ for _ in ()).throw(AssertionError)
    )

    class _Local(_SemEmbedder):
        def embed(self, textos, tipo):
            raise EmbeddingIndisponivel("sem embeddings")

    monkeypatch.setattr(rag.repo, "buscar_por_texto", lambda *a, **k: [])
    busca = rag.buscar("depressão", embedder=_Local(), k=3)
    assert busca.modo == "texto"
    assert any("nuvem" in a.lower() for a in busca.avisos)


def test_nuvem_descarta_trechos_abaixo_do_corte(monkeypatch):
    monkeypatch.setattr(settings, "rag_nuvem_score_min", 0.55)
    monkeypatch.setattr(
        nuvem,
        "_post",
        lambda caminho, corpo: {
            "data": [
                {"file_id": "a", "filename": "a.pdf", "score": 0.9, "content": [{"text": "bom"}]},
                {"file_id": "b", "filename": "b.pdf", "score": 0.3, "content": [{"text": "fraco"}]},
                {"file_id": "c", "filename": "c.pdf", "score": 0.8, "content": []},
            ]
        },
    )
    achados = nuvem.buscar("vs", "q", k=8, escopos=("terapeutica",))
    assert [t.texto for t in achados] == ["bom"]
