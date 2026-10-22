# 0004 — Nenhuma fonte citada: nem nas diretrizes, nem no app

**Contexto.** A regra anterior exigia fonte citada em todo conteúdo clínico (diretrizes e sínteses).
As 117 sínteses de reumatologia vieram sem seção de fontes ou links, e a origem de cada uma não é
verificável a partir do arquivo.

**Decisão (2026-10-10, Regis Braga).** Manter o conteúdo e deixar de exigir fonte nas diretrizes e
sínteses. Dermatologia e psiquiatria mantêm as referências que já têm; reumatologia segue sem elas.

**Extensão (2026-10-10).** O médico não quer nenhum tipo de fonte citado nos aplicativos, em lugar
nenhum. Em consequência: a API de sugestões devolve só `termo` e `secao` (sem a origem de cada
item), a tela não mostra selos AI/RAG/Diretrizes/Web nos itens, e a rota `/rag/buscar` foi
removida (os livros são base interna: nenhum trecho sai por HTTP). Os
botões de escolha de fonte (AI/RAG/Diretrizes/Web) também saíram: há um único botão GERAR, que
consulta todas as fontes da tela.

**O que não muda.**
- O RAG continua exigindo texto real e o cabeçalho (`titulo` e `fonte`) em cada documento do acervo.
- A saída ao médico não mostra trecho, página nem citação de livro.
- Revisão humana sempre (ADR 0003); não inventar conduta, dose, escala nem critério diagnóstico.

**Consequências.** Sem fonte no arquivo, não há como conferir uma síntese contra a diretriz de
origem pelo próprio documento; a validação fica com a revisão médica. Se for preciso reverter a
decisão, basta restabelecer a regra em `AGENTS.md` e preencher as fontes das sínteses sem referência.
