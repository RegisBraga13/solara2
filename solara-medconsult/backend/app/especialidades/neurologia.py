"""Neurologia: conteúdo clínico próprio, no mesmo app (mesmo fluxo, mesma identidade visual).

As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais em todas as
especialidades; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).
Revisar cada texto abaixo com o médico neurologista antes de usar em produção.
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames de imagem" com componentes ["TC de crânio", "RM de encéfalo", '
        '"angiorressonância"]; termo "Antiepilépticos" com ["levetiracetam", "lamotrigina", '
        '"carbamazepina", "valproato"]; termo "Exames laboratoriais" com ["glicemia", '
        '"hemograma", "função tireoidiana", "vitamina B12"].'
    ),
    sem_integrantes='"Retorno em 30 dias"',
)

NEUROLOGIA = Especialidade(
    slug="neurologia",
    nome="Neurologia",
    propedeutica_objetivo="propedêutica em neurologia (tratamento, investigação e acompanhamento)",
    propedeutica_secoes={
        "tratamento": (
            "farmacoterapia (antiepilépticos, profiláticos e abortivos de enxaqueca, "
            "antiparkinsonianos, imunomoduladores, anticolinesterásicos, trombólise e "
            "antiagregantes), reabilitação, fisioterapia e procedimentos"
        ),
        "investigacao": (
            "exames para confirmar ou descartar o diagnóstico: neuroimagem (tomografia, "
            "ressonância), eletroencefalograma, eletroneuromiografia, líquor, exames "
            "laboratoriais, doppler de carótidas e vertebrais, polissonografia e escalas "
            "(NIHSS, Glasgow, MoCA, MEEM)"
        ),
        "acompanhamento": "retorno, monitoramento clínico e laboratorial, encaminhamento",
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, exames e acompanhamento em neurologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em neurologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em neurologia",
    orientacoes_secoes={
        "cuidados": (
            "segurança em casa (risco de queda e de crise), sono regular, atividade física, "
            "gatilhos a evitar e adaptações no dia a dia"
        ),
        "fotoprotecao": (
            "adesão aos medicamentos (não suspender antiepiléptico sem orientação), "
            "organização de horários, manejo de efeitos adversos e diário de sintomas"
        ),
        "higiene": (
            "sinais de alerta (déficit súbito, crise prolongada, cefaleia súbita e intensa), "
            "restrições como dirigir, rede de apoio e seguimento"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente e autocuidado em neurologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico} em neurologia: segurança, adesão "
        "medicamentosa e sinais de alerta."
    ),
    dominios_web=(
        "academiabrasileiradeneurologia.org.br",
        "pubmed.ncbi.nlm.nih.gov",
        "aan.com",
        "ean.org",
        "openevidence.com",
    ),
    usa_nuvem=False,  # acervo no pgvector local, como as demais
    vocabulario=vocabulario_padrao(
        exame="Exame neurológico (força, reflexos, sensibilidade, nervos cranianos)",
        profissional="neurologista",
        termos="termos neurológicos",
        nome="neurologia",
    ),
)
