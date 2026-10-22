# Endocrinologia

Especialidade de conteúdo clínico do MedConsult, no mesmo nível de Dermatologia, Psiquiatria e Reumatologia.

| Item | Onde |
|---|---|
| Conteúdo clínico | `backend/app/especialidades/endocrinologia.py` |
| Diretrizes | `backend/diretrizes/endocrinologia/` |
| Acervo RAG | `backend/acervo/endocrinologia/<livro>/` (fora do git) |
| Gabarito | `backend/acervo/endocrinologia/gabarito_casos.json` |
| Site | bloco `endocrinologia` em `frontend/src/lib/especialidade.ts` |

- Propedêutica: tratamento, investigação e acompanhamento endocrinológicos.
- Orientações: cuidados metabólicos, tratamento e monitorização, descompensação e seguimento.
- Escalas: nenhuma; o campo de escore do núcleo aceita apenas inteiros.
- RAG: local, com acervo específico da especialidade.
- Diagnóstico: a decisão permanece com o médico; as sugestões são apoio ao fluxo clínico.

O acervo de livros deve ser colocado em subpastas próprias, com documentos autorizados no formato definido em `backend/acervo/README.md`. Depois, carregar com:

```text
python -m scripts.carregar_acervo acervo/endocrinologia --especialidade endocrinologia
```
