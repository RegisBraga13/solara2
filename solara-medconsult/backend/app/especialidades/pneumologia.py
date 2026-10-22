"""Conteudo clinico proprio da Pneumologia."""

# As descricoes clinicas sao mantidas em linhas longas para preservar a leitura dos prompts.
# ruff: noqa: E501

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames funcionais" com componentes ["espirometria", "prova broncodilatadora", '
        '"oximetria"]; termo "Exames de imagem" com ["radiografia de torax", '
        '"tomografia de torax", "angio-TC"]; termo "Classes terapeuticas" com '
        '["broncodilatador", "corticoide inalatorio", '
        '"antibiotico", "oxigenoterapia"].'
    ),
    sem_integrantes='"Retorno programado"',
)


PNEUMOLOGIA = Especialidade(
    slug="pneumologia",
    nome="Pneumologia",
    propedeutica_objetivo=(
        "propedeutica pneumologica: avaliacao de sintomas respiratorios, funcao pulmonar, "
        "troca gasosa, "
        "doencas das vias aereas, parenquima, pleura e circulacao pulmonar"
    ),
    propedeutica_secoes={
        "tratamento": (
            "cessacao do tabagismo e reducao de exposicoes, tecnicas inalatórias, broncodilatadores, "
            "corticoides inalatorios ou sistemicos quando indicados, antimicrobianos, reabilitacao pulmonar, "
            "oxigenoterapia e ventilacao conforme a gravidade"
        ),
        "investigacao": (
            "historia respiratoria e exposicional, exame do aparelho respiratorio, "
            "oximetria e gasometria quando indicadas; espirometria com prova broncodilatadora, "
            "radiografia ou tomografia de torax, "
            "avaliacao de alergia, sono, infeccao, pleura e funcao pulmonar conforme a hipotese"
        ),
        "acompanhamento": (
            "revisao de sintomas, tecnica e adesao ao dispositivo inalatorio, exacerbacoes, "
            "funcao pulmonar, saturacao, efeitos adversos e vacinacao; reabilitacao, "
            "seguimento especializado e encaminhamento "
            "em caso de deterioracao ou sinais de gravidade"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, investigacao e acompanhamento em pneumologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigacao diagnostica e acompanhamento de {diagnostico} "
        "em pneumologia."
    ),
    orientacoes_objetivo="orientacoes gerais ao paciente em pneumologia",
    orientacoes_secoes={
        "cuidados": (
            "cessar tabagismo, evitar fumaca e exposicoes desencadeantes, manter atividade fisica "
            "conforme tolerancia, hidratar-se, usar corretamente os dispositivos e manter vacinas "
            "respiratorias em dia"
        ),
        "fotoprotecao": (
            "adesao ao tratamento, tecnica correta do inalador, uso de espacador quando indicado, "
            "higienizacao dos dispositivos e reconhecimento de efeitos adversos sem alterar a prescricao "
            "por conta propria"
        ),
        "higiene": (
            "falta de ar intensa ou progressiva, labios arroxeados, confusao, dor toracica, hemoptise, "
            "febre persistente, queda importante da saturacao e quando procurar atendimento imediato"
        ),
    },
    orientacoes_consulta_rag=(
        "orientacoes ao paciente, autocuidado e sinais de alerta em pneumologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientacoes gerais ao paciente com {diagnostico} em pneumologia: autocuidado, "
        "inaladores e sinais de alerta."
    ),
    dominios_web=(
        "sbpt.org.br", "thoracic.org", "ersnet.org", "goldcopd.org", "ginasthma.org",
        "pubmed.ncbi.nlm.nih.gov", "gov.br", "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Exame fisico do aparelho respiratorio",
        profissional="pneumologista",
        termos="termos pneumologicos",
        nome="pneumologia",
        imagem="imagem do torax",
    ),
)
