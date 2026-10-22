# Documentação do espec·IA·lidades

Índice. O guia de uso e execução está no [README da raiz](../README.md).

| Documento | Para quê |
|---|---|
| [arquitetura.md](arquitetura.md) | Visão geral: camadas, fluxo das telas, especialidades, RAG, dados |
| [especialidades/](especialidades/README.md) | Uma página por especialidade e a lista de conferência para acrescentar outra |
| [fontes.md](fontes.md) | Fontes de RAG, diretrizes e busca web de cada especialidade |
| [decisoes/](decisoes/) | Registros de decisão de arquitetura (ADRs) |
| [../AGENTS.md](../AGENTS.md) | Regras para qualquer agente (Codex, Claude Code) que altere o projeto |
| [../NUCLEO.txt](../NUCLEO.txt) | Lista oficial do núcleo protegido (identidade visual, fluxo, motores) |
| [../CHANGELOG.md](../CHANGELOG.md) | Histórico por fase |

## Convenções

- Uma especialidade é **conteúdo clínico configurável**, não uma cópia do app.
- Para criar uma: `py -3 scripts/nova_especialidade.py <slug> "<Nome>"`.
- Scripts de uso no Windows: `scripts/windows/` (`iniciar.bat`, `parar.bat`, `backup.bat`).
