# 0002 — Especialidade é conteúdo, não cópia do app

**Contexto.** Dermatologia, psiquiatria e reumatologia (e outras que virão) compartilham identidade
visual, fluxo, pacientes, prontuários, laudos, imagens e voz. Branches longas e cópias do app perdem
a identidade visual e divergem.

**Decisão.** Um app, um código. A especialidade é um módulo de conteúdo (`especialidades/<slug>.py`),
pastas de diretrizes e acervo e um bloco no site, todas no mesmo nível. O núcleo (`NUCLEO.txt`) só
muda na base e vale para todas.

**Consequências.** Nova especialidade = `scripts/nova_especialidade.py` + preencher o conteúdo. Não se
troca texto de dermatologia por substituição; o vocabulário dos prompts é adaptado por especialidade.
