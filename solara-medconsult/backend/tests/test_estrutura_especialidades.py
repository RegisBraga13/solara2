"""Garante que toda especialidade segue a mesma estrutura (e que uma nova não esquece nada).

Quando uma destas verificações falha ao acrescentar uma especialidade, a mensagem diz o que falta.
"""

import importlib.util
import re
from pathlib import Path

import pytest

from app.especialidades import ESPECIALIDADES, Especialidade
from app.motores import busca_diretrizes

RAIZ = Path(__file__).resolve().parents[2]
BACKEND = RAIZ / "backend"
SITE_TS = RAIZ / "frontend/src/lib/especialidade.ts"
SLUG = re.compile(r"[a-z][a-z0-9_]*")


@pytest.mark.parametrize("slug", sorted(ESPECIALIDADES))
def test_slug_e_modulo_batem_e_o_nome_e_valido(slug):
    esp = ESPECIALIDADES[slug]
    assert SLUG.fullmatch(slug)
    assert esp.slug == slug
    assert esp.nome.strip()
    assert (BACKEND / "app/especialidades" / f"{slug}.py").is_file()


@pytest.mark.parametrize("slug", sorted(ESPECIALIDADES))
def test_diretrizes_ficam_em_diretrizes_slug(slug):
    pasta = ESPECIALIDADES[slug].pasta_diretrizes
    assert pasta == busca_diretrizes.PASTA / slug
    assert pasta.is_dir(), f"crie {pasta.relative_to(RAIZ)}"


def test_nao_ha_pasta_de_diretrizes_ou_acervo_orfa():
    for base in (BACKEND / "diretrizes", BACKEND / "acervo"):
        # pastas com "_" (ex.: acervo/_deprecated) guardam material retirado, fora do RAG
        pastas = {p.name for p in base.iterdir() if p.is_dir() and not p.name.startswith("_")}
        orfas = pastas - set(ESPECIALIDADES)
        assert not orfas, f"{base.relative_to(RAIZ)}: pasta sem especialidade registrada: {orfas}"


def test_site_e_servidor_tem_as_mesmas_especialidades():
    ts = SITE_TS.read_text(encoding="utf-8")
    uniao = re.search(r"export type SlugEspecialidade =([^;]+);", ts)
    assert uniao, "não achei SlugEspecialidade em especialidade.ts"
    no_tipo = set(re.findall(r'"([a-z][a-z0-9_]*)"', uniao.group(1)))
    blocos = set(re.findall(r'(?m)^  ([a-z][a-z0-9_]*): \{\s*\n\s*slug: "\1"', ts))
    servidor = set(ESPECIALIDADES)
    assert no_tipo == servidor, f"tipo do site x servidor: {no_tipo ^ servidor}"
    assert blocos == servidor, f"blocos do site x servidor: {blocos ^ servidor}"


@pytest.mark.parametrize("slug", sorted(ESPECIALIDADES))
def test_vocabulario_nao_deixa_dermatologia_em_outra_especialidade(slug):
    if slug == "dermatologia":
        pytest.skip("a dermatologia é o texto original dos prompts")
    texto = "médico dermatologista; Exame dermatológico (lesões e imagens); dermatologia"
    adaptado = ESPECIALIDADES[slug].adaptar(texto)
    assert "dermat" not in adaptado.lower(), f"vocabulário de {slug} não cobre: {adaptado!r}"


def test_esqueleto_de_nova_especialidade_gera_modulo_valido():
    spec = importlib.util.spec_from_file_location(
        "nova_especialidade", RAIZ / "scripts/nova_especialidade.py"
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    codigo = mod.MODULO.format(
        nome="Cardiologia", slug="cardiologia", constante="CARDIOLOGIA", slug_texto="cardiologia"
    )
    ns: dict = {}
    exec(compile(codigo, "cardiologia.py", "exec"), ns)  # noqa: S102 - modelo do próprio repositório
    esp = ns["CARDIOLOGIA"]
    assert isinstance(esp, Especialidade) and esp.slug == "cardiologia"
    assert {"tratamento", "investigacao", "acompanhamento"} == set(esp.propedeutica_secoes)
    assert {"cuidados", "fotoprotecao", "higiene"} == set(esp.orientacoes_secoes)
    assert esp.pasta_diretrizes == busca_diretrizes.PASTA / "cardiologia"
    assert "dermat" not in esp.adaptar("médico dermatologista").lower()
