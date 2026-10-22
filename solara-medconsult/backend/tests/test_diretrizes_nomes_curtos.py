import pytest

from app.motores import busca_diretrizes as dr


def _pasta(tmp_path, nomes):
    for arquivo, titulo in nomes.items():
        (tmp_path / arquivo).write_text(f"# {titulo}\n\n## Tratamento\nTexto.\n", encoding="utf-8")
    dr.carregar.cache_clear()
    return tmp_path


@pytest.fixture
def pasta(tmp_path):
    return _pasta(
        tmp_path,
        {
            "gota.md": "Gota",
            "avc.md": "AVC",
            "artrite.md": "Artrite reumatoide",
            "hiv.md": "HIV",
            "ar.md": "AR",
        },
    )


def _achados(diagnostico, pasta):
    return [d.arquivo for d in dr.para_diagnostico(diagnostico, pasta)]


def test_gota_de_4_letras_acha_a_diretriz(pasta):
    assert _achados("gota", pasta) == ["gota.md"]
    assert _achados("Gota", pasta) == ["gota.md"]


@pytest.mark.parametrize("sigla,arquivo", [("AVC", "avc.md"), ("HIV", "hiv.md"), ("AR", "ar.md")])
def test_siglas_medicas_curtas_sao_aceitas(pasta, sigla, arquivo):
    assert _achados(sigla, pasta) == [arquivo]


def test_duas_letras_fora_da_lista_nao_acham_nada(pasta):
    assert _achados("ab", pasta) == []
    assert _achados("xy", pasta) == []


def test_sigla_de_duas_letras_nao_casa_com_trecho_de_outra_palavra(pasta):
    # "ar" é sigla (artrite reumatoide), mas não pode casar por trecho com "artrite"
    assert [a for a in _achados("DM", pasta)] == []
    assert "artrite.md" not in _achados("AR", pasta)


def test_nome_curto_so_casa_por_palavra_inteira(pasta):
    assert _achados("Gotejamento", pasta) == []
    assert _achados("gota úrica", pasta) == ["gota.md"]


def test_diagnostico_curto_nao_casa_com_nome_longo_que_o_contem(tmp_path):
    p = _pasta(tmp_path, {"cancer.md": "Câncer de pele não melanoma"})
    assert _achados("pele", p) == []


def test_diagnostico_longo_continua_casando_por_trecho(pasta):
    assert _achados("Artrite reumatoide soropositiva", pasta) == ["artrite.md"]


def test_gota_existe_na_reumatologia_real():
    from app.especialidades.reumatologia import REUMATOLOGIA

    achadas = dr.para_diagnostico("Gota", REUMATOLOGIA.pasta_diretrizes)
    assert [d.arquivo for d in achadas][:1] == ["gota.md"]


@pytest.mark.parametrize(
    "consulta,arquivo",
    [
        ("AR", "artrite_reumatoide.md"),
        ("LES", "lupus_eritematoso_sistemico.md"),
        ("Lúpus", "lupus_eritematoso_sistemico.md"),
        ("EA", "espondilite_anquilosante.md"),
        ("OA", "osteoartrite.md"),
        ("Artrose", "osteoartrite.md"),
        ("FM", "fibromialgia.md"),
        ("ES", "esclerose_sistemica.md"),
        ("Sjögren", "doenca_de_sjogren.md"),
        ("PMR", "polimialgia_reumatica.md"),
        ("ACG", "arterite_de_celulas_gigantes.md"),
        ("Arterite temporal", "arterite_de_celulas_gigantes.md"),
        ("Artrite gotosa", "gota.md"),
    ],
)
def test_siglas_e_sinonimos_da_reumatologia_acham_a_diretriz(consulta, arquivo):
    from app.especialidades.reumatologia import REUMATOLOGIA

    achadas = dr.para_diagnostico(consulta, REUMATOLOGIA.pasta_diretrizes)
    assert achadas and achadas[0].arquivo == arquivo


def test_sigla_de_duas_letras_so_casa_quando_igual(tmp_path):
    texto = "---" + chr(10) + "conditions:" + chr(10) + '  - "EM"' + chr(10) + "---" + chr(10)
    texto += "# Esclerose múltipla" + chr(10) + chr(10) + "Texto." + chr(10)
    (tmp_path / "em.md").write_text(texto, encoding="utf-8")
    dr.carregar.cache_clear()
    assert [d.arquivo for d in dr.para_diagnostico("EM", tmp_path)] == ["em.md"]
    # "em" é preposição: não pode casar com qualquer diagnóstico que a contenha
    assert dr.para_diagnostico("Cefaleia em salvas", tmp_path) == []


@pytest.mark.parametrize("consulta", ["Meningite", "Meningite viral"])
def test_meningite_acha_a_diretriz_de_meningoencefalite(consulta):
    from app.especialidades.neurologia import NEUROLOGIA

    achadas = dr.para_diagnostico(consulta, NEUROLOGIA.pasta_diretrizes)
    assert achadas and achadas[0].arquivo == "meningoencefalite.md"


@pytest.mark.parametrize(
    "consulta,arquivo",
    [
        ("Meningite bacteriana", "meningite_bacteriana.md"),
        ("Doença de Alzheimer", "doenca_de_alzheimer.md"),
        ("Alzheimer", "doenca_de_alzheimer.md"),
        ("Neuropatia diabética", "neuropatia_diabetica.md"),
    ],
)
def test_fichas_novas_da_neurologia(consulta, arquivo):
    from app.especialidades.neurologia import NEUROLOGIA

    achadas = dr.para_diagnostico(consulta, NEUROLOGIA.pasta_diretrizes)
    assert achadas and achadas[0].arquivo == arquivo


@pytest.mark.parametrize(
    "slug,consulta,arquivo",
    [
        ("psiquiatria", "TAB", "Transtorno_Afetivo_Bipolar_TAB.md"),
        ("psiquiatria", "TEPT", "Transtorno_de_Estresse_Pos_Traumatico.md"),
        ("psiquiatria", "TOC", "Transtorno_Obsessivo_Compulsivo.md"),
        ("psiquiatria", "TDAH", "Transtorno_de_Deficit_de_Atencao_e_Hiperatividade_TDAH.md"),
        ("psiquiatria", "TAG", "Ansiedade.md"),
        ("psiquiatria", "Alcoolismo", "Transtorno_por_Uso_de_Alcool.md"),
        ("dermatologia", "Acne", "05_acne_adulta.md"),
        ("dermatologia", "Herpes zoster", "07_herpes_zoster.md"),
        ("dermatologia", "CBC", "03_cancer_pele_nao_melanoma.md"),
        ("endocrinologia", "DM1", "diabetes_mellitus_tipo_1.md"),
        ("endocrinologia", "DM2", "diabetes_mellitus_tipo_2.md"),
        ("endocrinologia", "SOP", "sindrome_dos_ovarios_policisticos.md"),
        ("endocrinologia", "CAD", "cetoacidose_diabetica.md"),
        ("endocrinologia", "Diabetes mellitus tipo 2", "diabetes_mellitus_tipo_2.md"),
        ("pneumologia", "DPOC", "Doenca_Pulmonar_Obstrutiva_Cronica.md"),
        ("pneumologia", "FPI", "Fibrose_Pulmonar_Idiopatica.md"),
        ("pneumologia", "SDRA", "Sindrome_do_Desconforto_Respiratorio_Agudo.md"),
        ("gastroenterologia", "Hepatite A", "Hepatite_A.md"),
        ("gastroenterologia", "Hepatite B", "Hepatite_B_Cronica.md"),
        ("gastroenterologia", "Hepatite C", "Hepatite_C.md"),
        ("gastroenterologia", "Cirrose", "Cirrose_e_Hipertensao_Portal.md"),
        ("gastroenterologia", "MASLD", "MASLD_e_MASH.md"),
        ("nefrologia", "DRC", "Doenca_Renal_Cronica.md"),
        ("nefrologia", "LRA", "Lesao_Renal_Aguda.md"),
        ("nefrologia", "GESF", "Glomeruloesclerose_Segmentar_e_Focal.md"),
        ("nefrologia", "SHU", "Microangiopatia_Trombotica.md"),
        ("nefrologia", "Hiponatremia", "Hiponatremia.md"),
        ("cardiologia", "HAS", "Hipertensao_Arterial.md"),
        ("cardiologia", "IC", "Insuficiencia_Cardiaca_Cronica.md"),
        ("cardiologia", "FA", "Fibrilacao_Atrial.md"),
        ("cardiologia", "IAM", "SCA_com_Supra_de_ST.md"),
        ("cardiologia", "TEP", "Tromboembolismo_Pulmonar.md"),
        ("cardiologia", "BAV", "Bloqueio_Atrioventricular.md"),
        ("cardiologia", "Angina instável", "SCA_sem_Supra_de_ST.md"),
        ("cardiologia", "Chagas", "Cardiomiopatia_Chagasica.md"),
    ],
)
def test_siglas_das_outras_especialidades(slug, consulta, arquivo):
    from app.especialidades import ESPECIALIDADES

    achadas = dr.para_diagnostico(consulta, ESPECIALIDADES[slug].pasta_diretrizes)
    assert achadas and achadas[0].arquivo == arquivo
