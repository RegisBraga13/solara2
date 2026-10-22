"""Reumatologia: conteúdo clínico próprio, no mesmo app (mesmo fluxo, mesma identidade visual).

As chaves das orientações (cuidados, fotoprotecao, higiene) são internas e iguais às da
dermatologia; só o significado e o título mudam (veja `frontend/src/lib/especialidade.ts`).

usa_nuvem=False: o acervo vem do pgvector local (mesmo caminho da Dermatologia).
escopos_rag fica de fora: sem vector store na nuvem com atributo escopo por livro.
"""

from app.especialidades import Especialidade
from app.especialidades.base import agrupar, vocabulario_padrao

AGRUPAR = agrupar(
    exemplos=(
        'termo "Exames laboratoriais" com componentes ["fator reumatoide", "anti-CCP", "VHS", '
        '"PCR", "ANA"]; termo "DMARDs sintéticos" com ["metotrexato", "leflunomida", '
        '"sulfassalazina", "hidroxicloroquina"]; termo "Biológicos" com ["anti-TNF", "anti-IL6", '
        '"anti-JAK"]; termo "Exames de imagem" com ["radiografia", "ultrassonografia", '
        '"ressonância magnética"]; termo "Escores de atividade" com ["DAS28", "CDAI", "BASDAI"].'
    ),
    sem_integrantes='"Biópsia sinovial", "Retorno em 30 dias"',
)

REUMATOLOGIA = Especialidade(
    slug="reumatologia",
    nome="Reumatologia",
    propedeutica_objetivo="propedêutica reumatológica (tratamento, investigação e acompanhamento)",
    propedeutica_secoes={
        "tratamento": (
            "farmacoterapia (DMARDs sintéticos e biológicos, corticoide, AINEs), "
            "medidas não farmacológicas, fisioterapia e procedimentos"
        ),
        "investigacao": (
            "exames para confirmar ou descartar o diagnóstico: laboratoriais "
            "(fator reumatoide, anti-CCP, ANA, VHS, PCR, ácido úrico, complemento), "
            "imagem (radiografia, ultrassonografia, ressonância magnética), "
            "escores de atividade (DAS28, CDAI, SDAI, BASDAI), análise de líquido sinovial "
            "e biópsia"
        ),
        "acompanhamento": (
            "retorno, monitoramento de atividade da doença, exames periódicos, "
            "adesão e efeitos adversos, encaminhamento"
        ),
    },
    propedeutica_agrupar=AGRUPAR,
    propedeutica_consulta_rag=(
        "tratamento, exames e acompanhamento em reumatologia para {diagnostico}"
    ),
    propedeutica_consulta_web=(
        "Tratamento, investigação diagnóstica e acompanhamento de {diagnostico} em reumatologia."
    ),
    orientacoes_objetivo="orientações gerais ao paciente em reumatologia",
    orientacoes_secoes={
        "cuidados": (
            "exercícios, alongamento, fortalecimento muscular, proteção articular, "
            "ergonomia e adaptações no dia a dia"
        ),
        "fotoprotecao": (
            "adesão medicamentosa (DMARDs demoram semanas para efeito), "
            "organização de horários, manejo de efeitos adversos e vacinação"
        ),
        "higiene": (
            "sinais de alerta (crise, febre, dor intensa), higiene do sono, "
            "rede de apoio e seguimento"
        ),
    },
    orientacoes_consulta_rag=(
        "orientações ao paciente, autocuidado e ergonomia em reumatologia para {diagnostico}"
    ),
    orientacoes_consulta_web=(
        "Orientações gerais ao paciente com {diagnostico} em reumatologia: exercícios, "
        "ergonomia, adesão medicamentosa e sinais de alerta."
    ),
    dominios_web=(
        "reumatologia.org.br",
        "pubmed.ncbi.nlm.nih.gov",
        "rheumatology.org",
        "eular.org",
        "openevidence.com",
    ),
    usa_nuvem=False,
    vocabulario=vocabulario_padrao(
        exame="Exame articular (articulações)",
        profissional="reumatologista",
        termos="termos reumatológicos",
        nome="reumatologia",
    ),
)
