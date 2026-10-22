"""Conteúdo clínico próprio da Nefrologia.

As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais em todas as
especialidades; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).
Os textos abaixo ainda não foram revisados por médico nefrologista.
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["creatinina", "ureia", "potássio", '
        '"sódio", "gasometria"]; termo "Exames de urina" com ["urina tipo I", '
        '"relação albumina/creatinina", "proteinúria de 24 horas"]; termo "Classes terapêuticas" '
        'com ["IECA", "BRA", "inibidor de SGLT2", "diurético"].'
    ),
    sem_integrantes='"Retorno em 30 dias"',
)

NEFROLOGIA = Especialidade(
    slug="nefrologia",
    nome="Nefrologia",
    propedeutica_objetivo=(
        "propedêutica nefrológica: avaliação da função renal, doenças glomerulares e "
        "tubulointersticiais, distúrbios hidroeletrolíticos e ácido-básicos, hipertensão e "
        "terapia renal substitutiva, com tratamento individualizado e seguimento"
    ),
    propedeutica_secoes={
        "tratamento": (
            "controle pressórico e da proteinúria (bloqueio do sistema renina-angiotensina, "
            "inibidor de SGLT2), correção de distúrbios hidroeletrolíticos e ácido-básicos, "
            "ajuste de medicamentos à função renal, imunossupressão em doenças glomerulares e "
            "indicação de diálise ou transplante quando necessário"
        ),
        "investigacao": (
            "história e exame físico dirigidos; creatinina com taxa de filtração glomerular, "
            "ureia, eletrólitos, gasometria, urina tipo I, relação albumina/creatinina ou "
            "proteinúria de 24 horas; ultrassonografia renal; sorologias, complemento e "
            "biópsia renal conforme o caso"
        ),
        "acompanhamento": (
            "estadiamento e progressão da doença renal, pressão arterial, proteinúria, potássio "
            "e anemia, ajuste de doses, vacinação, preparo para terapia renal substitutiva, "
            "retorno e encaminhamento"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, exames e acompanhamento em nefrologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em nefrologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em nefrologia",
    orientacoes_secoes={
        "cuidados": (
            "alimentação com pouco sal e ajuste de proteína, potássio e fósforo conforme "
            "orientação, hidratação adequada, controle da pressão e da glicemia, evitar "
            "anti-inflamatórios e outros medicamentos que agridem os rins, e parar de fumar"
        ),
        "fotoprotecao": (
            "uso regular dos medicamentos, não suspender por conta própria, atenção a efeitos "
            "adversos e a interações, não usar remédios, fitoterápicos ou suplementos sem "
            "avisar a equipe e levar a lista de medicamentos às consultas"
        ),
        "higiene": (
            "diminuição da urina, inchaço progressivo, ganho rápido de peso, falta de ar, "
            "urina com sangue ou espumosa, vômitos persistentes, câimbras ou fraqueza intensa, "
            "febre em quem faz diálise e quando procurar atendimento ou manter seguimento"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente e autocuidado em nefrologia para {diagnostico}"
    ),
    orientacoes_consulta_web=("Orientações gerais ao paciente com {diagnostico} em nefrologia."),
    dominios_web=(
        "sbn.org.br",
        "kdigo.org",
        "asn-online.org",
        "era-online.org",
        "pubmed.ncbi.nlm.nih.gov",
        "gov.br",
        "openevidence.com",
    ),
    usa_nuvem=False,  # acervo no pgvector local, como as demais
    vocabulario=vocabulario_padrao(
        exame="Exame físico nefrológico (pressão arterial, volume, edema)",
        profissional="nefrologista",
        termos="termos nefrológicos",
        nome="nefrologia",
    ),
)
