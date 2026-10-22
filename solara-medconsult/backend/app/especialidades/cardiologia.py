"""Cardiologia: conteúdo clínico próprio, no mesmo app (mesmo fluxo, mesma identidade visual).

As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais em todas as
especialidades; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).
Os textos abaixo ainda não foram revisados por médico cardiologista.
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["troponina", "BNP", "perfil lipídico", '
        '"função renal", "eletrólitos"]; termo "Exames de imagem" com ["ecocardiograma", '
        '"teste ergométrico", "cintilografia miocárdica"]; termo "Classes terapêuticas" com '
        '["betabloqueador", "IECA", "estatina", "anticoagulante"].'
    ),
    sem_integrantes='"Retorno em 30 dias"',
)

CARDIOLOGIA = Especialidade(
    slug="cardiologia",
    nome="Cardiologia",
    propedeutica_objetivo="propedêutica em cardiologia (tratamento, investigação e acompanhamento)",
    propedeutica_secoes={
        "tratamento": (
            "medidas não farmacológicas (sal, atividade física, peso, tabagismo), terapias "
            "farmacológicas (anti-hipertensivos, antitrombóticos, estatinas, antiarrítmicos, "
            "terapia da insuficiência cardíaca) e procedimentos (revascularização, ablação, "
            "dispositivos, cirurgia valvar) quando indicados"
        ),
        "investigacao": (
            "história e exame físico dirigidos; eletrocardiograma, ecocardiograma, troponina, "
            "BNP ou NT-proBNP, perfil lipídico e função renal; teste ergométrico, holter, MAPA, "
            "angiotomografia ou cateterismo conforme o caso"
        ),
        "acompanhamento": (
            "metas pressóricas, lipídicas e glicêmicas, resposta ao tratamento, adesão, efeitos "
            "adversos, reavaliação de função ventricular, retorno e encaminhamento"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, exames e acompanhamento em cardiologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em cardiologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em cardiologia",
    orientacoes_secoes={
        "cuidados": (
            "alimentação com pouco sal, atividade física regular conforme liberação, controle do "
            "peso, parar de fumar, moderar o álcool e monitorar pressão e peso em casa"
        ),
        "fotoprotecao": (
            "uso regular dos medicamentos, não interromper por conta própria, atenção a efeitos "
            "adversos e a interações, organização de horários e levar a lista de remédios "
            "às consultas"
        ),
        "higiene": (
            "dor ou aperto no peito, falta de ar, desmaio, palpitações com mal-estar, inchaço "
            "progressivo, ganho rápido de peso, déficit neurológico súbito e quando procurar "
            "atendimento imediato ou manter seguimento"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente e autocuidado em cardiologia para {diagnostico}"
    ),
    orientacoes_consulta_web=("Orientações gerais ao paciente com {diagnostico} em cardiologia."),
    dominios_web=(
        "arquivosonline.com.br",
        "portal.cardiol.br",
        "acc.org",
        "escardio.org",
        "pubmed.ncbi.nlm.nih.gov",
        "gov.br",
        "openevidence.com",
    ),
    usa_nuvem=False,  # acervo no pgvector local, como as demais
    vocabulario=vocabulario_padrao(
        exame="Exame físico cardiovascular",
        profissional="cardiologista",
        termos="termos cardiológicos",
        nome="cardiologia",
    ),
)
