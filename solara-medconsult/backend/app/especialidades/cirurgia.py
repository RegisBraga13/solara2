"""Conteúdo clínico próprio da Cirurgia (cirurgia geral)."""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames pré-operatórios" com componentes ["hemograma", "coagulograma", '
        '"função renal", "eletrocardiograma"]; termo "Exames de imagem" com '
        '["ultrassonografia", "tomografia", "ressonância"]; termo "Classes de medicamentos" '
        'com ["analgésico", "antibiótico profilático", "antiemético", "profilaxia de TVP"].'
    ),
    sem_integrantes='"Retorno em 7 dias para revisão da ferida operatória"',
)

CIRURGIA = Especialidade(
    slug="cirurgia",
    nome="Cirurgia",
    propedeutica_objetivo=(
        "propedêutica cirúrgica: indicação operatória, avaliação de risco, preparo "
        "pré-operatório, conduta intra e pós-operatória e acompanhamento da ferida e de "
        "complicações"
    ),
    propedeutica_secoes={
        "tratamento": (
            "indicação cirúrgica e via de acesso, preparo pré-operatório (jejum, suspensão "
            "ou ajuste de medicamentos, profilaxia antibiótica e de trombose venosa, reserva "
            "de sangue), cuidados intraoperatórios, analgesia pós-operatória, cuidados com a "
            "ferida e drenos, mobilização precoce e manejo de complicações cirúrgicas"
        ),
        "investigacao": (
            "história clínica, comorbidades, medicamentos em uso (anticoagulantes e "
            "antiagregantes), alergias, cirurgias e anestesias anteriores, exame físico "
            "dirigido ao sítio cirúrgico; exames laboratoriais, de imagem e avaliação de "
            "risco cirúrgico e anestésico conforme o porte do procedimento"
        ),
        "acompanhamento": (
            "reavaliação da ferida operatória, sinais de infecção ou deiscência, dor, "
            "função do órgão operado, retirada de pontos ou drenos, resultado de "
            "anatomopatológico quando aplicável e encaminhamento para reabilitação ou "
            "seguimento especializado"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "indicação cirúrgica, preparo, técnica e acompanhamento pós-operatório para "
        "{diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Indicação cirúrgica, preparo pré-operatório, técnica e acompanhamento "
        "pós-operatório de {diagnostico} em cirurgia geral."
    ),
    orientacoes_objetivo="orientações gerais ao paciente cirúrgico",
    orientacoes_secoes={
        "cuidados": (
            "cuidados com a ferida operatória e curativos, higiene local, repouso relativo "
            "e retorno gradual às atividades, alimentação e hidratação adequadas, uso de "
            "meias de compressão e deambulação precoce quando indicado"
        ),
        "fotoprotecao": (
            "uso correto de analgésicos e antibióticos prescritos, não suspender "
            "anticoagulantes ou retomar medicamentos sem orientação, manejo de náusea, dor "
            "e constipação pós-operatória"
        ),
        "higiene": (
            "febre, secreção, vermelhidão ou abertura da ferida, dor que piora, "
            "sangramento, inchaço importante de um dos membros, falta de ar, distensão "
            "abdominal, vômitos persistentes ou ausência de evacuação após a cirurgia"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente, cuidados com a ferida operatória e sinais de alerta "
        "pós-operatórios em cirurgia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente operado por {diagnostico}: cuidados com a ferida, "
        "atividades permitidas e sinais de alerta pós-operatórios."
    ),
    dominios_web=(
        "cbc.org.br",
        "facs.org",
        "who.int",
        "gov.br",
        "saude.gov.br",
        "pubmed.ncbi.nlm.nih.gov",
        "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Exame físico cirúrgico e avaliação de risco operatório",
        profissional="cirurgião",
        termos="termos cirúrgicos",
        nome="cirurgia",
        imagem="imagem conforme sítio cirúrgico",
    ),
)
