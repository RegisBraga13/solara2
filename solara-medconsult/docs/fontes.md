# Fontes por especialidade

Levantamento das fontes de conhecimento do app, por especialidade e por tipo. Contagens medidas em
2026-10-10 no banco (RAG) e nas pastas `backend/diretrizes/<slug>/`.

Tipos: **RAG** (livros indexados, busca por similaridade), **Diretrizes** (uma síntese por doença,
abertas pelo nome do diagnóstico, fora do RAG) e **Web** (busca restrita a domínios da especialidade).
O médico escolhe a fonte de cada sugestão; o app não mostra trecho, página nem citação do livro.

## Dermatologia

**RAG (pgvector local): 2 livros, 1.214 documentos, 15.446 trechos**

| Livro | Documentos | Trechos |
|---|---|---|
| Azulay Dermatologia, Guanabara Koogan (edição não identificada no PDF) | 1.004 | 10.155 |
| Manual de Dermatologia Clínica, Sampaio e Rivitti, Artes Médicas, 2014 | 210 | 5.291 |

**Diretrizes: 120 sínteses** (`backend/diretrizes/dermatologia/`), todas com seção de fontes e links.
Organizações mais citadas: AAD (22 arquivos), EADV (14), BAD (10), IDSA (9), CDC (8), Cochrane (7),
EULAR (6), PCDT/Ministério da Saúde (5), OMS (5). Domínios mais frequentes nos links: PubMed (51),
DermNet (33), DOI (28), aad.org (24), PMC (11), bad.org.uk (8), idsociety.org (8), cdc.gov (8), who.int (8).

**Web (domínios permitidos):** pubmed.ncbi.nlm.nih.gov, sbd.org.br, aad.org.

## Psiquiatria

**RAG: 14 livros no pgvector local, 1.456 documentos, 88.666 trechos**

| Livro | Documentos |
|---|---|
| Clínica Psiquiátrica FMUSP vol. 2 (Grandes síndromes) | 201 |
| Tratado de Psiquiatria, ABP (2022) | 188 |
| Clínica Psiquiátrica FMUSP vol. 3 (Terapêutica) | 165 |
| Clínica Psiquiátrica FMUSP vol. 1 (Fundamentos) | 141 |
| DSM-5-TR | 139 |
| Psicofarmacologia: da Teoria à Clínica (1ª ed. 2025) | 106 |
| Manual do Residente de Psiquiatria (2023) | 99 |
| Psicopatologia e Semiologia dos Transtornos Mentais, Dalgalarrondo | 87 |
| Clínica Psiquiátrica FMUSP, Guia Prático (2ª ed.) | 82 |
| Psicopatologia Clínica e Entrevista Psiquiátrica | 69 |
| Condutas em Psiquiatria, Baldacara e Teng (2021) | 61 |
| A Entrevista Psiquiátrica na Prática Clínica (3ª ed.) | 51 |
| Clínica Psiquiátrica de Bolso, IPq (3ª ed. 2023) | 35 |
| Manual de Psicopatologia, Cheniaux (6ª ed.) | 32 |

**RAG na nuvem (OpenAI vector stores do projeto PSIQUIATRIA), ligado só nesta especialidade:**
18 livros, separados por gênero (`psicopatologia`, `sindromes`, `criterios`, `terapeutica`), e 40
diretrizes. O diagnóstico lê psicopatologia, síndromes e critérios; o tratamento lê terapêutica.
Se a nuvem falhar, cai no acervo local.

**Diretrizes: 39 sínteses** (`backend/diretrizes/psiquiatria/`), 38 com seção de referências e
todas com links. Mais citadas: NICE (29 arquivos), DSM (27), CID (19), APA (17), OMS/WHO (15 + 13),
Cochrane (15), mhGAP (7), Ministério da Saúde (5), WFSBP (4), CANMAT (4). Domínios: DOI (34),
nice.org.uk (30), who.int (22), PubMed (18), PMC (12), healthquality.va.gov (11), FDA (9+8),
icd.who.int (8).

**Web:** pubmed.ncbi.nlm.nih.gov, abp.org.br, apa.org, who.int.

## Reumatologia

**RAG (pgvector local): 1 livro, 76 documentos, 6.947 trechos**

| Livro | Documentos | Trechos |
|---|---|---|
| Reumatologia: diagnóstico e tratamento, Carvalho (4ª ed.) | 76 | 6.947 |

**Diretrizes: 117 sínteses** (`backend/diretrizes/reumatologia/`).
Nenhuma tem seção de fontes ou links; só mencionam ACR (12 arquivos), EULAR (11), ACR/EULAR (9) e
ASAS (3) no corpo do texto. Por decisão (ver [0004](decisoes/0004-diretrizes-sem-fonte-obrigatoria.md)),
o conteúdo é mantido sem fontes citadas.

**Web:** reumatologia.org.br, pubmed.ncbi.nlm.nih.gov, rheumatology.org, eular.org.

## Situação resumida

| | RAG (livros) | Diretrizes | Fontes citadas nas diretrizes |
|---|---|---|---|
| Dermatologia | 2 | 120 | sim (120/120) |
| Psiquiatria | 14 local (+18 na nuvem) | 39 | sim (38/39 com referências) |
| Reumatologia | 1 | 117 | não (0/117), por decisão |
