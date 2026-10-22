import re

from app.especialidades.psiquiatria import PSIQUIATRIA
from app.motores import busca_diretrizes as dr

TRATAMENTO = ("tratamento", "farmacoterapia", "psicoterapia", "algoritmo", "diretriz terapêutica")


def test_limite_da_psiquiatria_mantem_o_tratamento_inteiro_nas_diretrizes():
    limite = PSIQUIATRIA.diretriz_max_chars
    assert limite and limite >= 30000
    for d in dr.carregar(PSIQUIATRIA.pasta_diretrizes):
        enviado = dr.resumo_para_ia(d.texto, limite)
        secoes = re.split(r"(?m)^(?=## )", d.texto)[1:]
        for s in secoes:
            titulo = s.splitlines()[0].lower()
            if "tratamento" in titulo:
                assert s.strip() in enviado, f"{d.arquivo}: seção cortada: {titulo}"
