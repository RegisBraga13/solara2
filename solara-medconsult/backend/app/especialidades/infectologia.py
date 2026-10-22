"""Conteudo clinico proprio da Infectologia."""

# As descricoes clinicas sao mantidas em linhas longas para preservar a leitura dos prompts.
# ruff: noqa: E501

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames microbiologicos" com componentes ["culturas", "bacterioscopia", '
        '"testes moleculares", "sorologias"]; termo "Exames de imagem" com '
        '["radiografia", "ultrassonografia", "tomografia", "ressonancia"]; '
        'termo "Classes antimicrobianas" com ["antibiotico", "antiviral", "antifungico", '
        '"antiparasitario"].'
    ),
    sem_integrantes='"Retorno programado"',
)


INFECTOLOGIA = Especialidade(
    slug="infectologia",
    nome="Infectologia",
    propedeutica_objetivo=(
        "propedeutica infectologica: abordagem sindromica de infeccoes, identificacao do foco, "
        "agente e gravidade, com tratamento antimicrobiano seguro e vigilancia epidemiologica"
    ),
    propedeutica_secoes={
        "tratamento": (
            "medidas de suporte, controle de foco, coleta de culturas antes do antimicrobiano quando "
            "seguro, terapia empirica guiada pela sindrome e epidemiologia, descalonamento conforme "
            "microbiologia, ajuste por funcao renal e hepatica, duracao adequada e prevencao de resistencia"
        ),
        "investigacao": (
            "historia temporal e epidemiologica, exposicoes, viagens, contatos, vacinacao, uso previo "
            "de antimicrobianos e exame fisico completo; hemograma, funcao renal e hepatica, marcadores "
            "inflamatorios, culturas, testes moleculares, sorologias e imagem conforme o foco"
        ),
        "acompanhamento": (
            "reavaliacao de resposta e sinais de gravidade, resultados de culturas e susceptibilidade, "
            "eventos adversos, adesao, necessidade de controle de foco, isolamento, notificacao e "
            "seguimento de infeccoes cronicas ou imunossupressao"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, diagnostico microbiologico e acompanhamento em infectologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigacao diagnostica e acompanhamento de {diagnostico} em infectologia."
    ),
    orientacoes_objetivo="orientacoes gerais ao paciente em infectologia",
    orientacoes_secoes={
        "cuidados": (
            "higiene das maos, etiqueta respiratoria, agua e alimentos seguros, sexo protegido, "
            "cuidado com feridas, vacinacao indicada e nao compartilhar medicamentos ou objetos pessoais"
        ),
        "fotoprotecao": (
            "adesao ao antimicrobiano conforme prescricao, horarios corretos, nao interromper ou reutilizar "
            "sobras por conta propria, manejo de efeitos adversos e comunicacao de alergias e medicamentos"
        ),
        "higiene": (
            "febre persistente, confusao, falta de ar, hipotensao, rigidez de nuca, desidratacao, "
            "piora rapida, manchas ou sangramento e quando procurar atendimento imediato"
        ),
    },
    orientacoes_consulta_rag=(
        "orientacoes ao paciente, prevencao e sinais de alerta em infectologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientacoes gerais ao paciente com {diagnostico} em infectologia: prevencao, adesao e sinais de alerta."
    ),
    dominios_web=(
        "infectologia.org.br",
        "sbim.org.br",
        "anvisa.gov.br",
        "gov.br",
        "who.int",
        "cdc.gov",
        "pubmed.ncbi.nlm.nih.gov",
        "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Exame fisico infectologico",
        profissional="infectologista",
        termos="termos infectologicos",
        nome="infectologia",
        imagem="imagem conforme foco infeccioso",
    ),
)
