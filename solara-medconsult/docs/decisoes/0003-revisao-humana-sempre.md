# 0003 — Revisão humana sempre

**Contexto.** O app lida com dados e decisões de saúde (ação de alto impacto).

**Decisão.** Nenhuma sugestão é executada ou salva automaticamente. O médico toca em gerar
e escolhe o que entra no prontuário. Não existe `AUTO_EXECUTE`. A estimativa de cada
diagnóstico é um sinal operacional para ordenar, não uma probabilidade de acerto.

**Consequências.** Sugestões não persistem; só a escolha do médico. A saída ao médico traz só o
conteúdo clínico, sem trecho, página ou citação de livro.
