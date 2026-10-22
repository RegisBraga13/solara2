# Arquitetura do novo produto

## Camadas

1. **Solara UI** — dashboard, shell, navegação e fluxo de consulta em `frontend/src/components`.
2. **Fluxo clínico existente** — captura, transcrição, anamnese, diagnóstico, conduta e prontuário, preservado nas rotas Next existentes.
3. **API clínica** — `frontend/src/lib/api.ts`, reutilizando pacientes, prontuários, receitas, atestados, declarações, imagens e pré-consulta.
4. **IA e RAG** — endpoints do backend para sugestões, história, conduta, investigação, tratamento e orientações.
5. **Persistência** — Zustand para rascunho local; Postgres para registros; SeaweedFS para PDFs, imagens e anexos.

## Princípio de evolução

O novo produto deve trocar a camada de experiência gradualmente, sem reescrever o núcleo clínico. A próxima vertical recomendada é transformar a rota de captura em uma tela dividida: paciente/contexto à esquerda, gravação e transcrição no centro, pendências e documentos à direita.

## Segurança

- O médico revisa o conteúdo antes do registro final.
- O áudio não deve ser enviado para novos destinos fora da API existente.
- Chaves OpenAI permanecem no backend e nunca no bundle do frontend.
- O projeto original `medconsult` não é dependência de runtime do produto novo; a cópia serve como base de migração controlada.
