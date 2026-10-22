"""Dermatologia: o conteúdo clínico que o app já usava (nada aqui muda o comportamento anterior)."""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar

# Medidas correlatas viram UM bloco (um chip), em vez de dezenas de itens soltos.
AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["hemograma", "glicemia", "TGO/TGP", '
        '"creatinina"]; termo "Corticoides tópicos" com ["clobetasol", "betametasona"]; termo '
        '"Imunossupressores sistêmicos" com ["azatioprina", "micofenolato", "ciclofosfamida"]; '
        'termo "Biológicos" com ["secuquinumabe", "ustequinumabe"]; termo "Exames de imagem" com '
        '["radiografia", "ultrassonografia"].'
    ),
    sem_integrantes='"Biópsia de pele com histopatológico", "Retorno em 30 dias"',
)

DERMATOLOGIA = Especialidade(
    slug="dermatologia",
    nome="Dermatologia",
    propedeutica_objetivo="propedêutica (tratamento, investigação e acompanhamento)",
    propedeutica_secoes={
        "tratamento": (
            "medicamentos, classes, fototerapia, laser, crioterapia e procedimentos terapêuticos"
        ),
        "investigacao": (
            "exames para confirmar ou descartar o diagnóstico: biópsia com histopatológico e "
            "imunofluorescência, exames laboratoriais, cultura, micológico direto, dermatoscopia, "
            "patch test, imagem"
        ),
        "acompanhamento": (
            "retorno, monitoramento clínico e laboratorial, encaminhamento, seguimento"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag="tratamento, exames e acompanhamento de {diagnostico}",
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em dermatologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente",
    orientacoes_secoes={
        "cuidados": "cuidados com a pele, hidratação, o que evitar, sinais de alerta",
        "fotoprotecao": "protetor solar, roupas, chapéu, horários de exposição ao sol",
        "higiene": "banho, sabonetes, roupas de cama, produtos, ambiente doméstico e de trabalho",
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente, cuidados com a pele e fotoproteção em {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico}: cuidados com a pele, fotoproteção, "
        "higiene e ambiente."
    ),
    dominios_web=("pubmed.ncbi.nlm.nih.gov", "sbd.org.br", "aad.org", "openevidence.com"),
    anamnese_categorias=(
        "História da lesão/queixa atual: tempo de evolução, modo de instalação (súbito ou "
        "gradual), mudanças de cor, tamanho ou forma, sintomas associados (prurido, dor, "
        "ardor, sangramento), fatores de melhora ou piora",
        "Fototipo de pele e exposição solar: fototipo de Fitzpatrick, histórico de "
        "queimaduras solares, uso de fotoproteção, exposição ocupacional ou recreativa",
        "Antecedente oncológico cutâneo: câncer de pele pessoal ou familiar, lesões "
        "prévias tratadas, dermatoses crônicas",
        "Gatilhos e tratamentos prévios: produtos usados na lesão, cosméticos, "
        "medicações sistêmicas em uso, resposta a tratamentos já tentados",
    ),
    anamnese_red_flags=(
        "Mudança recente de cor, tamanho ou forma em lesão pigmentada",
        "Bordas irregulares ou assimetria em lesão pigmentada",
        "Sangramento ou ferida que não cicatriza",
        "Lesão com crescimento rápido",
    ),
    conduta_objetivo=(
        "conduta clínica geral: decisão de manejo, encaminhamentos e orientações gerais sobre a "
        "condução do caso"
    ),
    investigacao_objetivo=(
        "investigações complementares para confirmar ou aprofundar o diagnóstico: exames "
        "laboratoriais, biópsia com histopatológico, parecer de outro especialista"
    ),
    tratamento_objetivo=(
        "tratamento objetivo, com nome do medicamento, dose e dias de uso, ou conduta "
        "cirúrgica, ablação ou fototerapia"
    ),
)
