# Dermatologia

Especialidade padrão do app (`ESPECIALIDADE=dermatologia`), no mesmo nível das demais.

| Item | Onde |
|---|---|
| Conteúdo clínico | `backend/app/especialidades/dermatologia.py` |
| Diretrizes | `backend/diretrizes/dermatologia/` (120 sínteses, uma por doença) |
| Acervo RAG | `backend/acervo/dermatologia/azulay/` e `.../sampaio/` (livros; fora do git) |
| Gabarito de medição | `backend/acervo/dermatologia/gabarito_casos.json` |
| Site | bloco `dermatologia` em `frontend/src/lib/especialidade.ts` |

- Orientações: Cuidados com a pele, Fotoproteção, Higiene e ambiente.
- Escalas: nenhuma (o campo de escore não é exibido).
- RAG local (pgvector); não usa vector store na nuvem.
- Medir a busca: `ESPECIALIDADE=dermatologia python -m scripts.medir_casos` (na pasta `backend`).
