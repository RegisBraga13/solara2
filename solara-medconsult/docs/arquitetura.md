# Arquitetura

Visão geral. Detalhes de execução e de cada fase estão no [README](../README.md).

## Camadas

| Camada | Tecnologia | Papel |
|---|---|---|
| Site (iPad-first, PWA) | Next.js 15, React 19, Tailwind, TypeScript | Telas, rascunho da consulta no navegador, PDF do prontuário e da receita gerados no aparelho |
| Servidor | FastAPI, Python 3.12 | Motores de captura (voz, imagens), RAG, sugestões de diagnóstico, propedêutica e orientações, pacientes, prontuários, receitas |
| Banco | PostgreSQL 16 + pgvector | Pacientes, prontuários, receitas, laudos, imagens, transcrições; acervo RAG (vetores) |
| Cache | Redis 7 | Cache e filas |
| Arquivos | SeaweedFS (API S3) | Laudos e imagens (ver [ADR 0001](decisoes/0001-seaweedfs-no-lugar-do-minio.md)) |

## Fluxo

Home (ONLINE/PRESENCIAL) → 4 opções: **Novo paciente**, **Nova consulta**, **Retorno**, **Prontuário**.
A consulta tem 8 telas (Home, Anamnese, Captura, História clínica, Diagnóstico, Propedêutica,
Orientações, Prontuário). O retorno é uma evolução em tela única; a consulta original nunca muda.

## Especialidades

Um app, um código. A especialidade ativa vem de `ESPECIALIDADE` (servidor) e
`NEXT_PUBLIC_ESPECIALIDADE` (site). Todas têm a mesma estrutura:

```
backend/app/especialidades/<slug>.py        conteúdo clínico (descoberto sozinho)
backend/diretrizes/<slug>/*.md              uma síntese por doença
backend/acervo/<slug>/<livro>/*.md          livros do RAG (fora do git)
backend/acervo/<slug>/gabarito_casos.json   casos de medição da busca
frontend/src/lib/especialidade.ts           rótulos, Whitebook, escalas
```

Ver [especialidades/](especialidades/) e [ADR 0002](decisoes/0002-especialidade-e-conteudo.md).

## RAG e fontes

Cada pedido de sugestão consulta todas as fontes da tela, sem que o médico as escolha nem veja: **AI**, **RAG** (acervo da especialidade ativa, busca
híbrida por vetor e texto, com reordenação por IA), **Diretrizes** (por nome da doença, fora do RAG) e
**Web** (restrita a domínios da especialidade). Nada é gerado automaticamente.

## Dados e privacidade

- Nome e identificadores do paciente nunca vão à IA; laudos nunca são lidos pela IA.
- Sugestões não são salvas: só a escolha do médico persiste.
- Pacientes e prontuários não são excluídos.
- Revisão humana sempre; não há execução automática (ver [ADR 0003](decisoes/0003-revisao-humana-sempre.md)).
- Backup: `scripts/windows/backup.bat` (banco + arquivos, com manifesto e hash).
