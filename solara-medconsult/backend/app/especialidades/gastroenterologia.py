"""Conteúdo clínico próprio da Gastroenterologia.

As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais em todas as
especialidades; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["hemograma", "função hepática", '
        '"amilase e lipase", "sorologias" ]; termo "Exames endoscópicos" com '
        '["endoscopia digestiva alta", "colonoscopia", "CPRE"]; termo "Classes terapêuticas" '
        'com ["inibidor de bomba de prótons", "laxativo", "antiviral", "imunossupressor"].'
    ),
    sem_integrantes='"Retorno em 30 dias"',
)

GASTROENTEROLOGIA = Especialidade(
    slug="gastroenterologia",
    nome="Gastroenterologia",
    propedeutica_objetivo=(
        "propedêutica gastroenterológica: abordagem de sintomas digestivos, doenças do fígado, "
        "vias biliares e pâncreas, com tratamento individualizado e seguimento"
    ),
    propedeutica_secoes={
        "tratamento": (
            "medidas dietéticas e comportamentais, terapias farmacológicas, "
            "erradicação de H. pylori "
            "quando indicada, tratamento de doenças inflamatórias e hepáticas, e procedimentos "
            "endoscópicos ou cirúrgicos quando necessários"
        ),
        "investigacao": (
            "história e exame físico dirigidos; hemograma, função hepática e pancreática, "
            "marcadores conforme o caso; ultrassonografia, tomografia ou ressonância; "
            "endoscopia digestiva alta, "
            "colonoscopia e biópsias quando indicadas"
        ),
        "acompanhamento": (
            "revisão de sintomas e resposta ao tratamento, monitoramento clínico e laboratorial, "
            "vigilância de complicações e neoplasias quando aplicável, retorno e encaminhamento"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, exames e acompanhamento em gastroenterologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} "
        "em gastroenterologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em gastroenterologia",
    orientacoes_secoes={
        "cuidados": (
            "alimentação individualizada, hidratação, fibras quando apropriadas, atividade física, "
            "evitar álcool e gatilhos identificados, e uso seguro de medicamentos"
        ),
        "fotoprotecao": (
            "adesão ao tratamento, preparo e cuidados após exames ou procedimentos, organização de "
            "horários, uso correto de medicamentos e reconhecimento de efeitos adversos"
        ),
        "higiene": (
            "sinais de sangramento ou desidratação, dor intensa, icterícia, febre persistente, "
            "vômitos "
            "incontroláveis, perda de peso e quando procurar atendimento ou manter seguimento"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente e autocuidado em gastroenterologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico} em gastroenterologia."
    ),
    dominios_web=(
        "gastro.org.br",
        "endoscopy-campus.com",
        "aasld.org",
        "gi.org",
        "pubmed.ncbi.nlm.nih.gov",
        "gov.br",
        "openevidence.com",
    ),
    usa_nuvem=False,  # acervo no pgvector local, como as demais
    vocabulario=vocabulario_padrao(
        exame="Exame físico gastroenterológico e abdominal",
        profissional="gastroenterologista",
        termos="termos gastroenterológicos",
        nome="gastroenterologia",
    ),
)
