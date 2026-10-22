# Revisão clínica: o que um médico precisa conferir

Roteiro para quem for revisar o conteúdo clínico antes do uso em produção. O app só **lembra e organiza**
para o médico; o diagnóstico e a conduta são dele. Mesmo assim, o texto que alimenta as sugestões
precisa de olho clínico. Nada aqui foi revisado por médico até hoje.

## Como revisar (vale para todas)

1. **O módulo** (`backend/app/especialidades/<especialidade>.py`): 3 blocos de texto.
   - *Propedêutica*: o que cada seção (tratamento, investigação, acompanhamento) deve trazer.
   - *Orientações ao paciente*: cuidados, adesão, sinais de alerta (os títulos aparecem no site).
   - *Exemplos de agrupamento*: grupos de exames e medicamentos que o app sugere como um item só.
2. **As diretrizes** (`backend/diretrizes/<especialidade>/*.md`): uma ficha por doença. Conferir
   doses, condutas de emergência e se o título corresponde ao conteúdo.
3. **Os nomes e siglas** (`conditions:` no topo da ficha): conferir se "AR", "TAB", "AVC" etc. abrem a
   ficha certa.
4. **O gabarito** (`backend/acervo/<especialidade>/gabarito_casos.json`): conferir se cada caso
   clínico corresponde ao diagnóstico esperado.

Marque o que mudar; o ajuste de texto é rápido e não mexe no programa.

## Prioridade de leitura (maior risco primeiro)

| Prioridade | O que | Por quê |
|---|---|---|
| 1 | Fichas com **doses e esquemas** (anticoagulantes, antiepilépticos, insulina, biológicos, psicofármacos) | erro de dose é o dano mais provável |
| 2 | Fichas de **emergência** (AVC, meningite, estado de mal epiléptico, cetoacidose, crise tireotóxica, risco de suicídio) | tempo-dependentes |
| 3 | **Orientações ao paciente** de cada especialidade | chegam ao paciente |
| 4 | Fichas de doença rara | menor uso, menor risco |

## Por especialidade

| Especialidade | Diretrizes | Origem do conteúdo | Atenção especial |
|---|---|---|---|
| Dermatologia | 120 | sínteses por faixa etária (infância, adulto, idoso) + livros de Azulay e Sampaio (RAG) | fichas separadas por idade: conferir se a conduta da faixa certa é a que aparece |
| Psiquiatria | 39 | guias longos (24 a 48 mil caracteres) + 14 livros (RAG) | risco de suicídio, lítio, antipsicóticos e interações; fichas muito longas |
| Reumatologia | 117 | sínteses próprias + Carvalho (RAG) | imunossupressores e biológicos; escalas DAS28, CDAI, BASDAI e HAQ |
| Endocrinologia | 115 | pacote de sínteses + *Endocrinologia Clínica* 7ª ed. (RAG) | insulinas, metas glicêmicas, reposição hormonal, gestação |
| Neurologia | 150 | pacote de sínteses + Tratado e Greenberg (RAG) | trombólise, antiepilépticos, meningite, escala NIHSS e EDSS |
| Gastroenterologia | 123 | pacote Whitebook (106) + 17 protocolos com doses (hepatologia, hemorragias, DII) + Harrison e LIAGEC (RAG) | doses de antivirais, terlipressina, biológicos na DII; hemorragia digestiva e encefalopatia hepática |
| Pneumologia | 52 | pacote Whitebook + *Pneumologia: Princípios e Prática* (RAG) | corticoide e broncodilatador na crise, oxigenoterapia, hemoptise, anticoagulação no TEP |
| Cardiologia | 186 | pacote Whitebook (173) + fichas próprias e sínteses de 2026 sem equivalente + Braunwald (RAG) | antitrombóticos e anticoagulantes, antiarrítmicos, trombólise, metas pressóricas e lipídicas, doses na gestação |
| Nefrologia | 92 | 44 protocolos com doses (DRC, LRA, glomerulopatias, distúrbios hidroeletrolíticos, TRS) + 48 fichas do pacote Whitebook + *Princípios de Nefrologia e Distúrbios Hidroeletrolíticos* (RAG) | correção de sódio e potássio, ajuste de doses à função renal, imunossupressão nas glomerulopatias, indicação de diálise |

## O que NÃO precisa revisar

- O fluxo das telas, a marca e o banco de dados (são tema de engenharia).
- Os livros do RAG: são material de referência; o app não os cita na tela.

## Como registrar o resultado

Para cada ficha revisada, anote: **nome do arquivo**, **ok / ajustar / remover** e o trecho a mudar.
Uma planilha simples com essas 3 colunas basta. Com ela, eu aplico os ajustes em lote.
