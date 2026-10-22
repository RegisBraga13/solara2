# Tarefas do Codex — conteúdo clínico da Psiquiatria

Contexto: o espec·IA·lidades é um app só. A branch `psiquiatria` foi encerrada e integrada na
`dermatologia` (tag de arquivo: `arquivo/psiquiatria-codex-8cd57bc`). Psiquiatria é **conteúdo
clínico configurável** em cima do mesmo código. Leia antes: [`AGENTS.md`](../../AGENTS.md), [`NUCLEO.txt`](../../NUCLEO.txt), [README](../../README.md)
(seção "Especialidades").

## Onde você pode mexer (somente)
- `backend/app/especialidades/psiquiatria.py`
- `frontend/src/lib/especialidade.ts` (bloco `psiquiatria`)
- `backend/diretrizes/psiquiatria/`
- `backend/acervo/psiquiatria/`
- `backend/tests/` e `frontend/tests/` apenas para testar esse conteúdo

**Não mexa em nada listado em `NUCLEO.txt`.** Se precisar de uma mudança lá, pare e peça.
Trabalhe em branch curta (`psiq/<tema>`) a partir da `dermatologia`; não crie fork nem copie o app.

## Regras
- **Citar fonte é opcional** (decisão 0004): o conteúdo é mantido como está. Mesmo assim, não
  invente conduta, dose, escala nem critério diagnóstico.
- **Material com direitos autorais** (livros) fica fora do git (`.gitignore`). Só entram sínteses
  próprias, curtas, com a fonte indicada.
- **Revisão humana sempre.** Nada de `AUTO_EXECUTE`. Nada é gerado automaticamente.
- **Sem dados de pacientes** em nenhum arquivo.
- Risco de suicídio, psicose e mania: o conteúdo é apoio à decisão do médico; nunca texto que
  pareça conduta automática ou diagnóstico fechado.

## Tarefas

### 1. Diretrizes — CONCLUÍDA (Claude)
39 sínteses recuperadas do projeto PSIQUIATRIA do médico estão em `backend/diretrizes/psiquiatria/`
(cabeçalho YAML com `conditions:`, seções de tratamento, referências). O app já as lê pelo nome
da doença e envia ao modelo as seções de tratamento (`resumo_para_ia`).
O que falta (se quiser): revisar as sínteses contra as fontes oficiais citadas dentro delas e
apontar divergências. **Não reescreva o conteúdo clínico sem pedido.**

### 2. Acervo do RAG — CONCLUÍDA (Claude)
14 livros do médico convertidos para `backend/acervo/psiquiatria/<livro>/` (fora do git, direitos
autorais) com `scripts/preparar_acervo_psiquiatria.py` e carregados com
`carregar_acervo --especialidade psiquiatria`. Nada a fazer aqui; se o médico indicar livro novo,
acrescente-o em `LIVROS` desse script.

**Atualização:** o RAG da Psiquiatria agora consulta direto os vector stores da OpenAI do projeto
PSIQUIATRIA (`OPENAI_RAG_VECTOR_STORE_ID` / `OPENAI_DIRETRIZES_VECTOR_STORE_ID`, `usa_nuvem=True`,
escopos por etapa em `psiquiatria.py`), com fallback ao pgvector local. Não mexa nessa ligação
(está em arquivos do núcleo); para avaliar, use as mesmas variáveis do `.env`.

### 3. Gabarito de casos
Modelo: `backend/acervo/dermatologia/gabarito_casos.json` e `scripts/medir_casos.py`
(`ESPECIALIDADE=psiquiatria python -m scripts.medir_casos`).
- Criar `backend/acervo/psiquiatria/gabarito_casos.json` com 15–20 casos clínicos **fictícios**
  (sem identificadores), cada um com o diagnóstico esperado e diferenciais plausíveis.
- Rodar a avaliação e registrar o resultado (acerto no 1º lugar e no top-3).

**Aceite:** arquivo válido; relatório com os números; casos cobrindo ao menos 8 condições.

### 4. Escalas completas — CONCLUÍDA (integração feita na base)
Hoje o médico só digita o escore (PHQ-9, GAD-7, YMRS, PANSS). Montar o questionário item a item
com soma automática **apenas das escalas cuja licença permitir o uso** (PHQ-9 e GAD-7 são de
domínio público; confirme YMRS/PANSS antes — se não for livre, manter só o campo de escore).
- Componente novo em `frontend/src/components/` específico de escalas (não altere os do núcleo);
  grava o total no mesmo `escalas` do store (`setEscala`).
- Mostrar faixa de gravidade apenas como apoio ("sugere", nunca "diagnostica").
- PHQ-9: se o item 9 (ideação suicida) for > 0, mostrar aviso claro de avaliação de risco imediata.

**Aceite:** testes de soma e de faixas; item 9 gera aviso; sem alteração no `NUCLEO.txt`.

**Nota para o Codex:** a integração de `EscalasPsiquiatria` na tela de Propedêutica foi feita na
base pelo responsável pelo núcleo. Não refazer a integração nesta branch nem alterar
`frontend/src/components/EscalasClinicas.tsx` ou `frontend/src/app/propedeutica/page.tsx`.

### 5. Prompts da Psiquiatria
Hoje o vocabulário é trocado por `vocabulario` em `psiquiatria.py`. Se precisar de prompt
realmente diferente (ex.: história com exame psíquico, risco), peça a mudança no núcleo.
- Medir diagnóstico e propedêutica com o gabarito (tarefa 3) antes e depois de qualquer ajuste.
- Registrar o que melhorou e o que piorou; não trocar sem medir.

**Aceite:** tabela antes/depois no relatório; nenhum ajuste que reduza o acerto.

## Como entregar (toda tarefa)
1. `py -3 scripts/verificar_nucleo.py --outro <sua-branch>` → **OK**
2. `backend`: `ruff check app tests` e `pytest`
3. `frontend`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
4. Testar com `ESPECIALIDADE=psiquiatria` / `NEXT_PUBLIC_ESPECIALIDADE=psiquiatria`
5. Relatório curto: o que mudou, fonte de cada conteúdo, o que ficou pendente.
Quem faz o merge na base é o Claude (revisão); a revisão clínica final é do médico.
