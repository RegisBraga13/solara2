import uuid

import pytest

from app import repositorio_rag as repo
from scripts import carregar_acervo
from tests.test_rag import EmbedderFalso


@pytest.fixture(scope="module", autouse=True)
def tabelas():
    repo.criar_tabelas_rag()


@pytest.fixture
def esp():
    e = f"teste-{uuid.uuid4().hex[:8]}"
    yield e
    repo.remover_documentos(sorted(repo.ids_da_fonte(f"Livro {e}", e)))


def _arq(pasta, nome, titulo, corpo, fonte):
    (pasta / nome).write_text(
        f"titulo: {titulo}\nfonte: {fonte}\nversao: 1\n\n{corpo}\n", encoding="utf-8"
    )


def _carregar(pasta, esp, **kw):
    return carregar_acervo.main(str(pasta), esp, embedder=EmbedderFalso(), **kw)


def _titulos(fonte, esp):
    import sqlalchemy as sa

    from app.db import engine

    with engine.connect() as c:
        rows = c.execute(
            sa.text("SELECT titulo FROM rag_documentos WHERE fonte = :f AND especialidade = :e"),
            {"f": fonte, "e": esp},
        ).all()
    return sorted(r[0] for r in rows)


def test_recarregar_arquivo_alterado_deixa_so_a_versao_nova(tmp_path, esp):
    fonte = f"Livro {esp}"
    _arq(tmp_path, "a.md", "Livro (págs. 1-10)", "texto antigo sobre tireoide", fonte)
    assert _carregar(tmp_path, esp) == 0
    assert _titulos(fonte, esp) == ["Livro (págs. 1-10)"]

    # PDF reconvertido: mesmo arquivo, outro título (outro id) e outro conteúdo
    _arq(tmp_path, "a.md", "Livro (págs. 1-12)", "texto novo sobre insulina", fonte)
    assert _carregar(tmp_path, esp) == 0

    assert _titulos(fonte, esp) == ["Livro (págs. 1-12)"]  # só a versão nova


def test_documento_removido_da_pasta_some_do_banco(tmp_path, esp):
    fonte = f"Livro {esp}"
    _arq(tmp_path, "a.md", "A", "conteúdo a sobre cortisol", fonte)
    _arq(tmp_path, "b.md", "B", "conteúdo b sobre prolactina", fonte)
    _carregar(tmp_path, esp)
    (tmp_path / "b.md").unlink()
    _carregar(tmp_path, esp)
    assert _titulos(fonte, esp) == ["A"]


def test_append_mantem_os_antigos(tmp_path, esp):
    fonte = f"Livro {esp}"
    _arq(tmp_path, "a.md", "Antigo", "conteúdo antigo sobre insulina", fonte)
    _carregar(tmp_path, esp)
    _arq(tmp_path, "a.md", "Novo", "conteúdo novo sobre glucagon", fonte)
    _carregar(tmp_path, esp, substituir=False)
    assert _titulos(fonte, esp) == ["Antigo", "Novo"]


def test_carga_parcial_nao_apaga_o_resto_do_livro(tmp_path, esp):
    fonte = f"Livro {esp}"
    for i in range(4):
        _arq(tmp_path, f"p{i}.md", f"Parte {i}", f"conteúdo {i} sobre hormônio", fonte)
    _carregar(tmp_path, esp)
    parcial = tmp_path / "parcial"
    parcial.mkdir()
    _arq(parcial, "p0.md", "Parte 0", "conteúdo 0 sobre hormônio", fonte)
    _carregar(parcial, esp)  # 1 de 4: abaixo de metade, nada é removido
    assert len(_titulos(fonte, esp)) == 4


def test_arquivo_rejeitado_nao_causa_remocao(tmp_path, esp):
    fonte = f"Livro {esp}"
    _arq(tmp_path, "a.md", "A", "conteúdo a sobre cortisol", fonte)
    _arq(tmp_path, "b.md", "B", "conteúdo b sobre prolactina", fonte)
    _carregar(tmp_path, esp)
    (tmp_path / "b.md").write_text("sem cabeçalho valido", encoding="utf-8")
    assert _carregar(tmp_path, esp) == 1
    assert _titulos(fonte, esp) == ["A", "B"]
