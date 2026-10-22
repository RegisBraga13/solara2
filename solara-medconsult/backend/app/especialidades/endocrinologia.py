"""Conteúdo clínico configurável da Endocrinologia."""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["glicemia", "HbA1c", "TSH", "T4 livre", '
        '"cálcio", "PTH"]; termo "Exames de imagem" com ["ultrassonografia", "densitometria '
        'óssea", "ressonância magnética"]; termo "Classes terapêuticas" com ["insulina", '
        '"metformina", "agonista de GLP-1", "antitireoidiano"].'
    ),
    sem_integrantes='"Retorno programado"',
)


ENDOCRINOLOGIA = Especialidade(
    slug="endocrinologia",
    nome="Endocrinologia",
    propedeutica_objetivo=(
        "propedêutica endocrinológica: tratamento individualizado, investigação do eixo hormonal "
        "e acompanhamento clínico, laboratorial e por imagem"
    ),
    propedeutica_secoes={
        "tratamento": (
            "medidas não farmacológicas, reposição ou bloqueio hormonal quando indicado, "
            "terapias para diabetes e obesidade, tratamento de complicações e procedimentos"
        ),
        "investigacao": (
            "história e exame físico dirigidos; exames hormonais e metabólicos; avaliação de "
            "complicações; ultrassonografia, densitometria, tomografia ou ressonância "
            "quando indicadas"
        ),
        "acompanhamento": (
            "retorno, revisão de sintomas e adesão, monitoramento laboratorial e de complicações, "
            "ajuste compartilhado do plano e encaminhamento quando necessário"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, investigação e acompanhamento em endocrinologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em endocrinologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em endocrinologia",
    orientacoes_secoes={
        "cuidados": (
            "alimentação, atividade física, sono, autocuidado, monitorização orientada e prevenção "
            "de complicações conforme a condição"
        ),
        "fotoprotecao": (
            "adesão ao tratamento, organização de horários, uso correto de dispositivos e "
            "reconhecimento de efeitos adversos sem alterar a prescrição por conta própria"
        ),
        "higiene": (
            "sinais de descompensação, quando procurar atendimento, preparo para exames e "
            "seguimento com a equipe"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente, autocuidado e acompanhamento em endocrinologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico}: autocuidado, adesão, monitorização e "
        "sinais de descompensação."
    ),
    dominios_web=(
        "endocrino.org.br",
        "diabetes.org.br",
        "thyroid.org",
        "endocrine.org",
        "pubmed.ncbi.nlm.nih.gov",
        "gov.br",
        "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Exame físico endocrinológico e avaliação corporal",
        profissional="endocrinologista",
        termos="termos endocrinológicos",
        nome="endocrinologia",
        imagem="exame de imagem endócrino",
    ),
)
