from scripts.carregar_acervo import listar_arquivos


def test_pastas_com_underscore_e_readme_ficam_fora(tmp_path):
    (tmp_path / "endocrinologia" / "livro").mkdir(parents=True)
    (tmp_path / "_deprecated" / "endocrinologia").mkdir(parents=True)
    (tmp_path / "endocrinologia" / "livro" / "a.md").write_text("x", encoding="utf-8")
    (tmp_path / "endocrinologia" / "livro" / "b.txt").write_text("x", encoding="utf-8")
    (tmp_path / "_deprecated" / "endocrinologia" / "velho.md").write_text("x", encoding="utf-8")
    (tmp_path / "README.md").write_text("x", encoding="utf-8")
    (tmp_path / "gabarito.json").write_text("{}", encoding="utf-8")

    achados = [p.name for p in listar_arquivos(str(tmp_path))]

    assert achados == ["a.md", "b.txt"]
