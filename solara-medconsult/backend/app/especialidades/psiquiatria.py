"""Psiquiatria: conteúdo clínico próprio, no mesmo app (mesmo fluxo, mesma identidade visual).

Origem: trabalho paralelo do Codex na branch `psiquiatria`, aqui reunido na base única. As
chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais às da
dermatologia; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Antidepressivos ISRS" com componentes ["sertralina", "escitalopram", '
        '"fluoxetina"]; termo "Escalas de avaliação" com ["PHQ-9", "GAD-7", "YMRS"]; termo '
        '"Exames laboratoriais" com ["hemograma", "TSH", "glicemia", "função hepática"]; termo '
        '"Psicoterapias" com ["terapia cognitivo-comportamental", "terapia interpessoal"].'
    ),
    sem_integrantes='"Avaliação de risco de suicídio", "Retorno em 15 dias"',
)

PSIQUIATRIA = Especialidade(
    slug="psiquiatria",
    nome="Psiquiatria",
    propedeutica_objetivo="propedêutica psiquiátrica (tratamento, investigação e acompanhamento)",
    propedeutica_secoes={
        "tratamento": "farmacoterapia, psicoterapia, psicoeducação e medidas de segurança",
        "investigacao": (
            "avaliação psicopatológica, escalas, exames complementares e diagnóstico diferencial"
        ),
        "acompanhamento": "retorno, monitoramento de resposta, adesão, efeitos adversos e risco",
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, investigação e acompanhamento em psiquiatria para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação e acompanhamento de {diagnostico} em psiquiatria."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em psiquiatria",
    orientacoes_secoes={
        "cuidados": (
            "higiene do sono, rotina, atividade física e redução de álcool e outras substâncias"
        ),
        "fotoprotecao": (
            "adesão medicamentosa, organização de horários e manejo de efeitos adversos"
        ),
        "higiene": "rede de apoio, suporte social, plano de segurança e sinais de alerta",
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente e autocuidado em psiquiatria para {diagnostico}"
    ),
    orientacoes_consulta_web="Orientações gerais ao paciente com {diagnostico} em psiquiatria.",
    dominios_web=(
        "pubmed.ncbi.nlm.nih.gov", "abp.org.br", "apa.org", "who.int", "openevidence.com",
    ),
    # Sínteses de 25 a 48 mil caracteres, com 6 a 21 mil só de tratamento. Medido nas 39: com
    # 10.000 só 2 mantinham o tratamento inteiro; com 30.000 todas mantêm tratamento e avaliação
    # (~9 mil tokens por chamada). Só esta especialidade tem diretrizes desse tamanho.
    diretriz_max_chars=30000,
    # Mesma divisão por gênero do projeto PSIQUIATRIA: o diagnóstico lê o fenômeno, a síndrome e o
    # critério operacional; o tratamento lê só a terapêutica (medido lá: psicofarmacologia
    # disputando com psicopatologia no mesmo embedding diluía o resultado).
    usa_nuvem=True,
    escopos_rag={
        "diagnostico": ("psicopatologia", "sindromes", "criterios"),
        "tratamento": ("terapeutica",),
    },
    vocabulario=vocabulario_padrao(
        exame="Exame psíquico (estado mental)",
        profissional="psiquiatra",
        termos="termos psiquiátricos",
        nome="psiquiatria",
        imagem="documento clínico",
    ),
)
