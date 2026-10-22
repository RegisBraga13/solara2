"""Conteúdo clínico próprio da Geriatria."""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Avaliação funcional" com componentes ["atividades básicas", '
        '"atividades instrumentais", "mobilidade", "quedas"]; termo "Avaliação cognitiva e '
        'afetiva" com ["memória", "humor", "delirium", "sono"]; termo "Riscos geriátricos" '
        'com ["polifarmácia", "desnutrição", "fragilidade", "isolamento social"].'
    ),
    sem_integrantes='"Retorno em 30 dias"',
)

GERIATRIA = Especialidade(
    slug="geriatria",
    nome="Geriatria",
    propedeutica_objetivo=(
        "propedêutica geriátrica centrada na pessoa: avaliação clínica, funcional, cognitiva, "
        "afetiva e social, prevenção de declínios e plano de cuidado individualizado"
    ),
    propedeutica_secoes={
        "tratamento": (
            "plano de cuidado compartilhado, revisão e desprescrição segura de medicamentos, "
            "atividade física e reabilitação, nutrição, prevenção de quedas, manejo de síndromes "
            "geriátricas e articulação com cuidadores e equipe multiprofissional"
        ),
        "investigacao": (
            "história clínica e funcional com linha do tempo, medicamentos e substâncias, "
            "cognição, humor, sono, visão, audição, marcha, equilíbrio, continência, nutrição, "
            "rede de apoio e objetivos do paciente; exames dirigidos pela avaliação clínica"
        ),
        "acompanhamento": (
            "reavaliação de função, cognição, humor, mobilidade, nutrição, adesão e eventos "
            "adversos; monitoramento de metas, risco de quedas, sobrecarga do cuidador, "
            "vacinação, planejamento antecipado e necessidade de reabilitação ou suporte social"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "avaliação geriátrica ampla, síndromes geriátricas e acompanhamento para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Avaliação, tratamento e acompanhamento de {diagnostico} em geriatria, com foco em "
        "funcionalidade, segurança e cuidado centrado na pessoa."
    ),
    orientacoes_objetivo="orientações gerais ao paciente e à rede de apoio em geriatria",
    orientacoes_secoes={
        "cuidados": (
            "rotina segura, atividade física adaptada, alimentação e hidratação adequadas, "
            "sono, uso de dispositivos de apoio, vacinação, prevenção de quedas e participação "
            "do paciente nas decisões"
        ),
        "fotoprotecao": (
            "organização dos medicamentos, conferência da lista em cada consulta, não iniciar, "
            "suspender ou duplicar remédios sem orientação, atenção à visão e audição e apoio "
            "do cuidador quando necessário"
        ),
        "higiene": (
            "queda, confusão aguda ou mudança súbita do comportamento, falta de ar, dor no peito, "
            "fraqueza súbita, desidratação, febre persistente, incapacidade de se alimentar ou "
            "piora rápida do estado geral"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente, prevenção de quedas, segurança medicamentosa e apoio ao cuidador "
        "em geriatria para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico} em geriatria: funcionalidade, segurança, "
        "prevenção de quedas e rede de apoio."
    ),
    dominios_web=(
        "sbgg.org.br",
        "who.int",
        "gov.br",
        "saude.gov.br",
        "pubmed.ncbi.nlm.nih.gov",
        "nia.nih.gov",
        "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Avaliação geriátrica ampla",
        profissional="geriatra",
        termos="termos geriátricos",
        nome="geriatria",
        imagem="imagem conforme a hipótese clínica",
    ),
)
