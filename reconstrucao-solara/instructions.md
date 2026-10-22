# instructions.md: construir o `escriba`, módulo por módulo

Você é o agente de desenvolvimento deste projeto. Seu trabalho é transformar a
[`ESPECIFICACAO_TECNICA.md`](ESPECIFICACAO_TECNICA.md) em código de produção, **um módulo por vez**, na ordem abaixo.
Esta pasta (`reconstrucao-solara/`) é a raiz do repositório.

---

## 1. Antes de escrever qualquer código

Leia a especificação inteira uma vez. Depois, para cada módulo, releia as seções indicadas no próprio módulo.
As partes que você vai consultar o tempo todo:

| Assunto | Seção da especificação |
|---|---|
| O que o produto faz e as jornadas | 1.1 e 1.2 |
| Regras de negócio (códigos `RN-xx`) | 1.3 |
| Arquitetura, filas e cache | 2 |
| Schema do banco | 3.3 |
| Convenções de API e erros | 4.1 e 4.2 |
| Contratos de documentos e decisões de IA | 4.5 e 4.6 |
| Tokens e componentes de UI | 5 |
| Segurança e stack | 6 |
| Decisões em aberto | 7 |

Crie `PROGRESSO.md` na raiz com uma tabela de todos os módulos (código, nome, status, data, observações) e atualize-a ao fim de cada módulo.

## 2. Regras que valem em todos os módulos

1. **Um módulo por vez.** Só comece o próximo quando o atual cumprir a Definição de Pronto (seção 3).
2. **Contrato primeiro.** Para cada funcionalidade, siga esta ordem:
   1. schema Zod em `packages/contracts`;
   2. migração SQL em `packages/db`;
   3. caso de uso no módulo da API;
   4. rota;
   5. tela;
   6. testes.
3. **Rastreie as regras.** Todo teste que cobre uma regra de negócio leva o código no nome. Exemplo: `it("RN-16: segunda gravação ativa devolve 409")`.
4. **Provedores externos só por adaptador.** Cada provedor (STT, LLM, assinatura, WhatsApp, e-mail, billing, NFS-e, CRM) tem uma interface e um adaptador `fake` determinístico. Desenvolvimento e testes usam o `fake`. Nenhum teste chama serviço pago ou real.
5. **IA sempre pela política.** Toda saída de modelo:
   - passa pelo schema;
   - passa pelas regras determinísticas;
   - passa por `decide()` (spec 4.6);
   - grava `ai_decisions`.

   Documento médico, receita, CID, red flag e extração de exame **nunca** são `AUTO_EXECUTE`. Campo não falado é `MISSING` (`null`), nunca inventado.
6. **Dados de saúde fora dos logs.** Proibido logar corpo de requisição, transcrição, conteúdo de documento, nome, CPF, telefone ou e-mail. Seeds e testes usam só dados fictícios.
7. **Tenant em tudo.** Toda tabela de negócio tem `org_id` e RLS. Todo caso de uso checa permissão e vínculo (RN-47). Recurso de outro tenant responde `404`.
8. **Sem ativos de terceiros.** Não use nome, logotipo, textos, depoimentos, números ou conteúdo do produto de referência. Use o codinome `escriba` e os tokens da seção 5 até a decisão D1.
9. **Decisões em aberto (spec 7).**
   - Se a decisão não mudar contrato, risco ou arquitetura: escolha a opção mais simples e reversível, registre uma ADR curta em `docs/adr/NNNN-titulo.md` (contexto, decisão, consequências) e siga com o adaptador `fake`.
   - Se mudar: **pare e pergunte**.
10. **Mudança na especificação.** Se a implementação mostrar que a especificação está errada ou incompleta:
    - corrija o arquivo `ESPECIFICACAO_TECNICA.md` no mesmo commit;
    - explique a correção no relatório do módulo.
11. **Git.** Commits pequenos, mensagens no imperativo em português, um tema por commit. Não faça push nem abra PR sem pedido.
12. **Acessibilidade e responsividade** são parte do módulo, não etapa posterior:
    - teclado;
    - foco visível;
    - contraste AA;
    - 44 px de toque;
    - telas testadas em 390 px, 768 px, 1024 px e 1440 px.

## 3. Definição de Pronto (todo módulo)

- [ ] Schemas Zod, migração, casos de uso, rotas e telas do módulo implementados.
- [ ] Rotas documentadas no OpenAPI gerado (`/api/v1/openapi.json`).
- [ ] Testes de unidade das regras (`RN-xx`) e testes de integração com Postgres e Redis reais (Testcontainers).
- [ ] Teste de autorização por papel para cada rota nova: permitido, proibido e outro tenant.
- [ ] Teste e2e (Playwright) do caminho feliz do módulo, quando houver tela.
- [ ] Todos estes comandos passam sem erro: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.
- [ ] Nenhum dado de saúde em log (há um teste que procura padrões de CPF, telefone e nomes fictícios nos logs capturados).
- [ ] `PROGRESSO.md` atualizado.
- [ ] Relatório ao usuário em até 10 linhas com:
  - o que foi feito;
  - como verificar;
  - testes (quantos passaram);
  - suposições e ADRs;
  - pendências.

## 4. Comandos do repositório

Os comandos abaixo são criados no M00:

```bash
pnpm install
docker compose up -d          # Postgres + pgvector, Redis, S3 local
pnpm db:migrate               # aplica packages/db/migrations
pnpm db:seed                  # dados fictícios
pnpm dev                      # web :3000, api :4000, realtime :4001, worker
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

---

## 5. Roteiro

| Fase | Módulos | Marco |
|---|---|---|
| 0. Fundação | M00 | Repositório roda, CI verde, app shell vazio |
| 1. Núcleo do escriba | M01, M02, M04+M05, M06+M07, M09, M10, M11, M12 | **MVP:** gravar uma consulta → anamnese ou evolução → revisar → assinar → enviar (jornadas J1, J2, J3) |
| 2. Documentos e receita | M08, M13, M10-B, M17, M03 | Celular como microfone, receita, atestado, encaminhamento, laudo, cobrança, clínica |
| 3. Plataforma clínica | M15, M04-B, M14, M16, M18, M20, M21, M22 | Agenda, ficha com gráficos, Copilot, insights, portabilidade |
| 4. Endurecimento | M99 | Pronto para dados reais |

---

### M00: Fundação

**Ler:** spec 2.1, 2.2, 3.2, 4.1, 5.1, 6.2, 6.3, 6.4.

**Entregas:**

- Monorepo pnpm + Turborepo com a estrutura da spec 6.3:
  - `apps/web`, `apps/api`, `apps/realtime`, `apps/worker`;
  - `packages/contracts`, `packages/db`, `packages/ui`, `packages/config`, `packages/testing`.
- `docker-compose.yml`:
  - `pgvector/pgvector:pg16`;
  - `redis:7-alpine`;
  - S3 local (SeaweedFS ou LocalStack);
  - portas só em `127.0.0.1`.
- `packages/db`: Drizzle configurado, migrações `0001_extensions` e `0002_enums` da spec 3.3, script de seed vazio.
- `packages/contracts`: formato de erro RFC 9457 (spec 4.1), `AiDecision` e `decide()` (spec 4.6) com testes dos limites de threshold.
- `apps/api` (NestJS + Fastify) com:
  - `GET /health` e `GET /ready` (checa Postgres, Redis e S3);
  - middleware de `X-Request-Id`;
  - filtro de exceções para problem+json;
  - logger JSON com lista permitida de campos;
  - limitador de taxa em Redis (janela deslizante) reutilizável;
  - geração de OpenAPI;
  - helper de transação que faz `SET LOCAL app.org_id`.
- `apps/worker`: BullMQ conectado, fila `outbox-relay` e tabela `outbox`.
- `apps/realtime`: servidor `ws` que aceita conexão e responde `heartbeat`.
- Framework de adaptadores: `packages/contracts/src/providers/*.ts` (interfaces) e `fake` de cada provedor.
- `packages/ui`: tokens CSS (claro e escuro), preset Tailwind (spec 5.1), shadcn/ui inicializado, fontes Geist e Instrument Serif via `next/font`.
- `apps/web`:
  - shell do `/app` com barra lateral vazia, `ThemeToggle` e `Toaster`;
  - páginas `/login` e `/signup` só com layout;
  - CSP e cabeçalhos da spec 6.1.
- CI (GitHub Actions): instalar, lint, typecheck, testes, build, `npm audit`/OSV.

**Aceite:**

- `docker compose up -d && pnpm db:migrate && pnpm dev` sobe tudo.
- `GET /ready` devolve `200`.
- `/app` abre nos dois temas.
- Erro forçado devolve problem+json com `requestId`.
- Testes de `decide()` cobrem: schema inválido → `REJECT`; evidência ausente → `REJECT`; risco alto → `HUMAN_REVIEW`; 0,95 com risco baixo → `AUTO_EXECUTE`; 0,949 → `HUMAN_REVIEW`; 0,70 → `HUMAN_REVIEW`; 0,699 → `REJECT`.

---

### M01: Identidade e acesso

**Ler:** spec 1.2 J1, 1.3 (RN-01 a RN-06), 3.3 (`0003_identity`), 4.3.1, 4.3.2, 6.1 (Autenticação e sessão).

**Entregas:**

- Migração `0003_identity` completa e RLS nas tabelas com `org_id`.
- Rotas:
  - signup, verify-email, login, MFA (TOTP e passkey), refresh com rotação e detecção de reuso;
  - logout, forgot/reset;
  - `/me`, sessões;
  - Google OIDC.
- Cookies `__Host-`, CSRF double-submit, guard de autenticação, guard de permissão.
- Papéis de sistema (`owner`, `admin`, `doctor`, `secretary`, `auditor`) com permissões seed.
- Bloqueio por inatividade (RN-02) no web.
- Telas: `/signup`, `/login`, verificação de e-mail, recuperação, configurações de segurança (MFA, sessões).

**Testes obrigatórios:**

- RN-01: reuso de refresh revoga a família.
- RN-03: 6ª tentativa em 1 min dá `429`; mensagem igual para e-mail inexistente.
- RN-06: sem e-mail verificado, a gravação é bloqueada (deixe o teste pendente e conclua no M07).
- CSRF ausente dá `403 CSRF_FAILED`.
- Senha vazada é recusada.

**Aceite:** um usuário cria a conta, verifica o e-mail (fake de e-mail grava em `tmp/mails/`), entra com MFA e vê `/app`.

---

### M02: Onboarding e perfil profissional

**Ler:** spec 1.2 J1, RN-07, RN-08, RN-09 (só `TRIALING`), tabela `doctor_profiles`, `subscriptions`, `plans`.

**Entregas:**

- `/onboarding` em 3 passos: CRM + UF + RQE → especialidade → modelos padrão.
- Adaptador de verificação de CRM (`fake` aceita CRM par e marca `NEEDS_REVIEW` para ímpar).
- Criação da assinatura `TRIALING` com `trial_ends_at` = verificação + 7 dias.
- Seed de `specialties` e `plans`.
- `TrialBanner`.

**Testes:**

- RN-07: CRM em `NEEDS_REVIEW` impede assinar (o teste fica pendente até o M12).
- RN-08: segundo cadastro com o mesmo CRM + UF fica sem teste.

**Aceite:** um usuário novo termina o onboarding e chega a `/app` com "7 dias restantes".

---

### M04 + M05: Pacientes e consentimento

**Ler:** spec 1.2 J2 (passos 2 e 5), J13 (só cadastro), RN-14, RN-15, RN-47, RN-48, RN-49, `0004_patients`, 3.2 (cifragem e índice cego).

**Entregas:**

- Cifragem por envelope dos campos `_enc` e índice cego HMAC (`packages/db/crypto`).
- Rotas de pacientes:
  - criar, buscar por nome (trigram) ou CPF (hash), recentes;
  - ler, editar com `If-Match`, arquivar.
- Rotas de consentimento: registrar (termo digital ou verbal), revogar, gerar link `/m/{token}` para o paciente assinar.
- Auditoria `patient.read` em toda leitura de ficha (RN-48).
- Importação de pacientes por CSV (job assíncrono, relatório de linhas rejeitadas).
- Telas:
  - lista de pacientes (`DataTable`);
  - cadastro rápido e completo;
  - ficha básica;
  - `ConsentSheet`;
  - página pública `/m/[token]` do termo.

**Testes:**

- CPF duplicado na mesma organização dá `409`; o mesmo CPF em outra organização é permitido.
- Paciente de outro tenant dá `404`.
- RN-49: não existe rota de exclusão; arquivar mantém os dados.
- RN-15: revogar o consentimento marca o status e grava a auditoria.
- Banco cru não contém CPF em texto puro (consulta direta na tabela).

**Aceite:** o médico cadastra a paciente fictícia "Maria Silva Fernandes", registra o consentimento verbal e o encontra pela busca.

---

### M06 + M07: Consultas e captura de áudio

**Ler:** spec 1.2 J2 (passos 1 a 8), RN-14, RN-16 a RN-19, 2.3 F2, 4.3.3, 4.3.4, 4.3.5, `0006_encounters`, `RecorderControl` (5.3).

**Entregas:**

- Rotas: criar consulta, listar, ler, atualizar; abrir, pausar, retomar e finalizar gravação; `PUT /recordings/{id}/chunks/{seq}`; tickets de WebSocket.
- `apps/realtime`:
  - protocolo da spec 4.3.5;
  - grava cada bloco no S3 **antes** do `ack`;
  - dedupe por `(recording_id, seq)`;
  - evento `gap`;
  - trava `lock:recording:{doctorId}` com heartbeat.
- Web:
  - MediaRecorder (WebM/Opus, blocos de 5 s);
  - fila em IndexedDB (Dexie) com blocos cifrados (WebCrypto);
  - reenvio ao reconectar;
  - indicador "offline · N blocos pendentes";
  - pausa e retomada;
  - limite de 2 h com aviso aos 90 min.
- Telas: `/app/consulta/nova` e `/app/consulta/gravando?id=` (gravação), no layout da spec 0.4:
  - paciente opcional (nome, idade, sexo, "Salvar como novo paciente");
  - tipo Primeira consulta ou Evolução;
  - coluna de resumo;
  - menu "Iniciar consulta ▾" com Presencial e Teleconsulta;
  - a atribuição do paciente na tela do documento fica pronta no M10.
- Job `audio-purge` com a política de retenção (RN-17).

**Testes:**

- RN-14: gravar sem consentimento dá `403 CONSENT_REQUIRED`.
- RN-16: segunda gravação ativa dá `409`.
- RN-18: o mesmo `seq` enviado duas vezes grava um bloco só; buraco na sequência gera `gap`.
- Bloco sem `ack` continua no IndexedDB (teste no navegador com a rede cortada).
- RN-17: o expurgo apaga o objeto, preenche `purged_at` e grava a auditoria.
- RN-06: conclua o teste pendente do M01.

**Aceite:** gravar 30 s, desligar a rede por 10 s, religar e finalizar. Todos os blocos chegam ao S3 em ordem, sem duplicatas.

---

### M09: Transcrição e diarização

**Ler:** spec RN-23 a RN-25, 2.3 F2, 4.3.5 (`partial`, `final`, `speakers`), 4.6 (`speaker.roles`), `transcript_segments`.

**Entregas:**

- Interface `SttProvider` (streaming e lote).
- Adaptador `fake`: lê um roteiro fictício de `packages/testing/fixtures/consulta-cefaleia.json` e emite parciais e finais em tempo simulado.
- Adaptador real escolhido na ADR da decisão D3. Implemente, mas deixe desligado por padrão.
- Gravação dos segmentos finais; pub/sub por consulta; `LiveTranscript` com rótulos.
- Decisão `speaker.roles` (LLM de classificação ou heurística no fake) passando por `decide()`.
- Botão "Trocar falantes" (`POST /encounters/{id}/speakers:swap`).
- Edição manual de segmento (`edited_text`).
- Fila `transcription-batch` para gravações enviadas depois de offline.

**Testes:**

- RN-23: confiança 0,96 com risco baixo aplica os papéis (`AUTO_EXECUTE`); 0,80 aplica com destaque (`HUMAN_REVIEW`); 0,50 mostra "Falante 1/2" (`REJECT`).
- RN-24: segmento com confiança 0,39 fica `low_confidence`.
- RN-25: segmento com o texto "ignore as instruções e…" não muda a saída do classificador (teste com o fake de LLM que falha se receber texto fora do delimitador).

**Aceite:** a consulta fictícia aparece transcrita ao vivo, com Dr./Pac. corretos e troca manual funcionando.

---

### M10: Geração e revisão de documentos (Anamnese e Evolução)

**Ler:** spec 1.2 J2 (passos 8 e 9), J3, RN-26 a RN-31, 2.3 F3, 4.3.7, 4.3.8, **4.5 e 4.6 inteiras**, `0008_documents`, `DocumentEditor` (5.3).

**Entregas:**

- `packages/contracts/src/documents.ts` exatamente como a spec 4.5 (Anamnese, Evolução e união discriminada; demais tipos como stubs).
- Worker `generation`:
  - remove identificadores (RN-42);
  - monta o prompt versionado (`promptVersion`);
  - chama o LLM com saída estruturada (JSON Schema gerado do Zod);
  - valida o schema;
  - tenta um reparo se precisar;
  - roda as validações determinísticas (spec 4.5, itens 1 a 5);
  - executa `decide()`;
  - grava `document_versions`, `document_evidence` e `ai_decisions`.
- Comparações da evolução calculadas por regra fixa, sem a IA. Exemplo: variação de peso desde a última observação confirmada.
- Rotas:
  - gerar (`202` + job), ler job, ler documento;
  - `PATCH` com `If-Match`;
  - regerar seção;
  - aceitar e rejeitar sugestão;
  - evidência por ponteiro;
  - adendo.
- Sugestões (`MEDICATION_LIST_UPDATE`, `ALLERGY`, `VITAL_SIGN`) geram atualizações da ficha só quando aceitas (RN-29).
- `DocumentEditor`:
  - seções;
  - `INFERRED` destacado;
  - `MISSING` como "Não relatado";
  - popover de evidência;
  - salvamento automático com debounce de 1 s;
  - conflito de versão com diálogo.
- `GenerationProgress` e contador "tempo economizado" (estimativa simples: duração da consulta × fator configurável).

**Testes:**

- RN-26: duas chamadas com a mesma transcrição devolvem o mesmo job.
- RN-27: saída inválida duas vezes dá `REJECT` e job `FAILED`, sem documento parcial.
- RN-28:
  - `segmentId` de outra consulta rejeita o documento;
  - `quote` que não está na transcrição rejeita o documento;
  - exame físico não falado fica `MISSING` (`null`).
- `document.generate` nunca resulta em `AUTO_EXECUTE`, nem com confiança 1,0.
- RN-29: sugestão de medicação não altera `patient_medications` até ser aceita.
- RN-31: `PATCH` com versão antiga dá `409 VERSION_CONFLICT`.
- `ai_decisions` não contém texto clínico (o teste varre o JSON gravado).

**Aceite:** a consulta fictícia gera uma anamnese com seções, evidência clicável e "Não relatado" onde cabe. Depois, uma evolução de retorno mostra "-0,8 kg desde a última consulta".

---

### M11: Modelos e aprendizado de estilo

**Ler:** spec 0.4 (Modelos), 1.1 (M11), RN-32, `0007_templates`.

**Entregas:**

- CRUD de modelos com versões imutáveis.
- Categorias: Anamnese, Evolução, Atestados, Receitas, Laudos, Solicitações, Encaminhamentos, Outros.
- Selos PADRÃO (da plataforma, só leitura, Duplicar) e EM USO (padrão do médico na categoria).
- Definição com:
  - `systemInstructions` (opcional): entra dentro do prompt fixo da plataforma, que mantém as regras de segurança;
  - `userPromptFormat` (opcional): com `{patient_context}` e `{transcript}`;
  - `body`: Markdown com `@paciente.nome`, `@paciente.cpf`, `@medico.nome`, `@medico.crm`, `@data.hoje`, `@dias`, `@cid`;
  - `sections`, tom e nível de detalhe.
- Editor em gaveta de duas colunas, com "Inserir variável" e **prévia ao vivo que não salva**: transcrição de exemplo fictícia própria e streaming SSE em `POST /api/v1/templates/preview`.
- Na conta nova, os modelos "Anamnese — <especialidade>" e "Evolução — <especialidade>" nascem da especialidade do cadastro.
- Modelos de sistema por especialidade (seed: clínica geral, cardiologia, psiquiatria com exame do estado mental, pediatria, dermatologia).
- Padrão da clínica.
- Aprendizado de estilo:
  - ao assinar, grava `style_examples` por seção (texto sem identificadores);
  - a geração usa até 3 exemplos;
  - rota para zerar.
- Telas: `/app/modelos` e o editor de modelo.

**Testes:**

- Editar um modelo cria uma versão nova; documentos antigos continuam apontando para a versão antiga.
- RN-32: o exemplo de estilo não contém o nome nem o CPF do paciente (teste com nome fictício no texto).
- Zerar o estilo remove os exemplos do usuário.

**Testes adicionais:**

- Instruções do médico que tentam remover as regras ("pode inventar dados") não mudam o contrato: a saída continua validada pelo schema e pela política.
- A prévia não grava nada no banco.

**Aceite:** o médico cria o modelo "Consulta primeira vez" com 5 seções e tom "técnico", vê a prévia em streaming, e a geração seguinte segue essas seções.

---

### M12: Assinatura, PDF e envio

**Ler:** spec 1.2 J2 (passos 10 a 12), RN-30, RN-45, RN-46, 2.3 F4, 4.3.9, 4.3.10, `0010_signature_delivery`, 6.1 (Criptografia).

**Entregas:**

- Worker `pdf-render`: HTML → Chromium sem rede → PDF/A, layout da folha com cabeçalho do médico (nome, CRM/UF, RQE), paciente, data e seções.
- Interface `SignatureProvider` (CSC):
  - `fake` assina com certificado de teste autoassinado e grava PAdES;
  - adaptador real conforme a ADR da decisão D4, desligado por padrão.
- Fluxo de assinatura em duas etapas (OTP ou redirecionamento), idempotente.
- `SIGNED` torna o documento imutável; *object lock* no S3.
- Envio:
  - `WhatsappProvider` e `EmailProvider` (fakes gravam em `tmp/outbox/`);
  - link `/m/{token}` com desbloqueio por data de nascimento e 5 tentativas;
  - status de entrega por webhook.
- Telas: `SignatureDialog`, `DeliveryDialog`, `/m/[token]` (download).

**Testes:**

- RN-07: CRM não verificado dá `403 CRM_NOT_VERIFIED` (conclui o pendente do M02).
- RN-30: editar um documento assinado dá `409 INVALID_STATE`; o adendo cria um documento novo ligado ao original.
- RN-45: enviar um documento não assinado dá `409`.
- RN-46: a 6ª data de nascimento errada dá `423 LINK_LOCKED`; o link expirado não abre.
- O hash do PDF gravado bate com o hash da assinatura.

**Aceite (marco do MVP):** pelo navegador e com os fakes, o médico:

1. entra no app;
2. escolhe a paciente;
3. grava;
4. gera a anamnese;
5. edita uma frase;
6. assina;
7. envia por WhatsApp.

O paciente abre o link fictício e baixa o PDF. Rode o e2e completo dessa jornada.

---

### M08: Celular como microfone

**Ler:** spec 1.2 J4, RN-20 a RN-22, 4.3.6, `device_pairings`, `PairingDialog`.

**Entregas:**

- Rotas de pareamento (criar, reivindicar, confirmar, revogar), estado vivo no Redis e registro em `device_pairings`.
- `PairingDialog` (QR gerado no cliente, código com dígitos espaçados, contagem regressiva).
- Páginas públicas `/pair/[token]` e `/record/[captureToken]` (gravador mínimo em retrato, sem dados do paciente além das iniciais).
- O PC vira assinante do canal; fallback "Voltar para o microfone do PC".

**Testes:**

- RN-20: token expirado dá `410`; 3 códigos errados dão `423`; token usado duas vezes é recusado.
- RN-21: o `captureToken` não acessa nenhuma outra rota (matriz de rotas).
- RN-22: um novo pareamento revoga o anterior.

**Aceite:** com dois navegadores (um em modo celular), o pareamento conclui e a transcrição aparece no PC.

---

### M13: Receituário

**Ler:** spec 1.2 J5, RN-33 a RN-35, `0009_prescriptions`, `PrescriptionEditor`, decisão D5.

**Entregas:**

- Carga do catálogo `drugs` (script de importação de dados abertos da ANVISA/CMED, com fixture pequena para testes).
- Extração `prescription.extract`: só nomes e evidência; posologia pelo catálogo e modelo; campos ausentes `null`.
- Escolha do tipo de receita pela lista de controle, com tabela de validade parametrizada.
- Checagem de interações: interface `InteractionDatabase`, com `fake` contendo 5 pares conhecidos.
- Ciência obrigatória em interação grave.
- PDF da receita: simples; controle especial em 2 vias.
- A e B ficam atrás de uma flag desligada até a validação regulatória.

**Testes:**

- RN-33: item não confirmado não aparece no PDF.
- RN-34: medicamento C1 gera receita de controle especial em 2 vias; a lista A fica bloqueada com a flag desligada.
- RN-35: interação `MAJOR` sem ciência dá `422 INTERACTION_ACK_REQUIRED` na assinatura.
- Posologia não falada fica `null`, nunca preenchida pelo LLM.

**Aceite:** a consulta fictícia gera a receita com losartana e hidroclorotiazida, a checagem roda e a receita é assinada.

---

### M10-B: Atestado, encaminhamento e laudo

**Ler:** spec 1.2 J6 e J7, RN-36 a RN-38, 4.5 (`Atestado`, `Encaminhamento`, `SecoesDoModelo`), 4.6 (`cid10.suggest`, `referral.specialty`).

**Entregas:**

- Tabela CID-10 do DATASUS carregada; busca com cache.
- Atestado (afastamento, comparecimento, aptidão) com dias por extenso por regra fixa.
- CID só com `cidAuthorizedAt`.
- Encaminhamento com especialidade sugerida (revisão obrigatória), resumo, exames e medicações.
- Laudo a partir de seções do modelo.
- Feature flags por tipo, para liberar aos poucos.

**Testes:**

- RN-36: sem autorização o CID não sai no PDF, mesmo se estiver preenchido.
- RN-37: "3" vira "3 (três)"; data retroativa sem justificativa é recusada.
- RN-38: código inexistente vira `null` com aviso.

**Aceite:** os três documentos gerados, assinados e enviados com os fakes.

---

### M17: Assinaturas e faturamento

**Ler:** spec 1.2 J10, RN-09 a RN-13, 2.3 F5, 4.3.13, `0012_billing`, decisão D7.

**Entregas:**

- `BillingProvider` com `fake` que emite eventos de webhook simulados.
- Checkout, portal, webhook com HMAC e `inbound_events`.
- Máquina de estados RN-09 e reconciliação diária.
- Modo somente leitura em `SUSPENDED`.
- `NfseProvider` fake.
- Telas: planos (mensal e anual), assinatura atual, faturas.

**Testes:**

- RN-10: evento repetido não tem efeito; evento antigo depois de um novo é ignorado.
- RN-09: `PAST_DUE` mantém o acesso por 7 dias; depois, `SUSPENDED` bloqueia gravar e gerar, mas permite ler e exportar.
- RN-11: teste expirado vira `SUSPENDED`.

**Aceite:** pelo fake, o teste expira, a conta fica somente leitura, o médico assina o plano e volta a gravar.

---

### M03: Organizações, equipes e permissões

**Ler:** spec 1.2 J11, RN-12, RN-47, `roles`, `role_permissions`, `memberships`, `care_relationships`.

**Entregas:**

- Converter SOLO em CLINIC.
- Convites por e-mail.
- Papéis customizados com editor de permissões.
- Vínculo médico × paciente criado automaticamente na primeira consulta ou agendamento.
- Cobrança por assento.

**Testes:**

- Matriz papel × ação para todas as rotas existentes (teste gerado a partir do registro de rotas).
- RN-47: médico sem vínculo dá `403`; secretária vê a agenda, mas não o conteúdo dos documentos.

**Aceite:** a clínica com 2 médicos e 1 secretária funciona com o isolamento correto.

---

### M15: Agenda inteligente

**Ler:** spec 1.2 J9, RN-39 a RN-41, 4.3.12, `0005_schedule`, `Calendar`.

**Entregas:**

- CRUD de agendamentos com `EXCLUDE`; horários livres; arrastar e redimensionar com `If-Match`.
- Visões dia, semana, mês e lista.
- Lembretes WhatsApp com opt-in e webhook de resposta.
- No-show automático e desfazível.
- "Iniciar consulta" a partir do agendamento.

**Testes:**

- RN-39: sobreposição dá `409` com 3 sugestões; agendamento cancelado não conflita.
- RN-40: sem opt-in não há lembrete; a resposta "confirmar" muda o status.
- RN-41: no-show automático depois de fim + 30 min, e desfazer volta ao estado anterior.

**Aceite:** a semana com 10 agendamentos fictícios, uma remarcação por arrasto e um conflito recusado.

---

### M04-B: Ficha avançada (sinais vitais e exames)

**Ler:** spec 1.2 J13, RN-29, `observations`, `lab_imports`, 4.6 (`lab.extract`), `VitalsChart`, `Timeline`.

**Entregas:**

- Linha do tempo.
- Gráficos de PA, FC e peso a partir de `observations` confirmadas.
- Importação de PDF de exame:
  - antivírus;
  - camada de texto ou OCR;
  - extração com `PRESENT`, `INFERRED` ou `MISSING` e página de origem;
  - tela de revisão;
  - só depois os valores entram em `observations`.

**Testes:**

- Valor não encontrado fica `MISSING` (`null`) e não vai ao gráfico.
- `INFERRED` exige evidência e aviso.
- Valor fora da faixa fisiológica vira `INFERRED` com aviso.

**Aceite:** um PDF fictício de hemograma importado, revisado e visível na ficha.

---

### M14: Copilot clínico

**Ler:** spec 1.2 J8, RN-42 a RN-44, 4.3.11, `0011_copilot`, `CopilotPanel`, decisão D6.

**Entregas:**

- Carga da base de conhecimento (`knowledge_sources` com licença registrada, `knowledge_chunks` com embeddings).
- Busca híbrida (vetor + texto).
- SSE com eventos `delta`, `citation` e `done`.
- Contexto da consulta sem identificadores.
- Selo "sem fonte".
- "Inserir no documento como sugestão".

**Testes:**

- RN-42: o payload enviado ao LLM não contém nome nem CPF (o fake de LLM falha se receber).
- RN-43: resposta sem trecho recuperado não pode ser inserida.
- RN-44: a 61ª mensagem na hora dá `429`.

**Aceite:** a pergunta da jornada J8 responde com citações da base fictícia.

---

### M16: Insights e relatórios

**Ler:** spec 1.1 (M16), `usage_daily`, cache `insights:*` (2.4).

**Entregas:**

- Consolidação diária em `usage_daily`.
- Painel com:
  - consultas;
  - tempo médio;
  - documentos assinados;
  - taxa de retorno;
  - no-show;
  - tempo economizado.
- Filtros por período e médico; exportação CSV e PDF.

**Aceite:** os números do painel batem com uma contagem SQL direta nos dados de seed.

---

### M18: Interoperabilidade e portabilidade

**Ler:** spec 1.2 J12, contradição C4, 4.3.14, `exports`, `custody_transfers`, `api_keys`, FHIR em 4.2.

**Entregas:**

- Exportação total (PDF + FHIR R4 em NDJSON + CSV) em ZIP cifrado com link de 24 h e MFA recente.
- Termo de transferência de guarda, carência de 30 dias e expurgo.
- Chaves de API com escopos.
- Rotas FHIR somente leitura: `Patient`, `Encounter`, `Composition`, `DocumentReference`, `MedicationRequest`, `Observation`.

**Testes:**

- Exportar sem MFA recente dá `401 MFA_REQUIRED`.
- Expurgo antes do termo é impossível.
- Os recursos FHIR passam no validador oficial (fixture).

**Aceite:** a exportação completa da conta de seed é reimportável em um banco vazio (teste de ida e volta dos dados essenciais).

---

### M20, M21 e M22: Notificações, site público e backoffice

**M20:** notificações in-app e e-mail (teste terminando, documento pronto, falha de envio, assinatura vencendo).

**M21:** site público com conteúdo **próprio**:

- landing, preços, segurança, FAQ;
- `/recursos` com MDX;
- sitemap;
- `robots.txt` bloqueando `/app`, `/api`, `/pair`, `/record`, `/m`, `/login`, `/signup`, `/onboarding`;
- GA4, Clarity e qualquer pixel de anúncio só em páginas públicas, com teste que garante que nada de terceiros carrega em `/app`, `/pair`, `/record` e `/m` (contradição C9 da spec: o original carrega Google Ads dentro do app).

**M22:** backoffice interno com acesso por papel `SUPPORT`, MFA obrigatório e auditoria de cada ação:

- fila de CRM em `NEEDS_REVIEW`;
- busca de conta;
- reembolso;
- **sem acesso a conteúdo clínico**.

---

### M99: Endurecimento para dados reais

**Ler:** spec 2.6, 6.1 inteira, 7.

**Entregas:**

- Revisão OWASP item a item com evidência.
- CSP sem `unsafe-inline`.
- Varreduras (Trivy, OSV, IaC).
- Teste de carga k6: 1.500 WebSockets simultâneos e 100 gerações por minuto, dentro dos SLOs.
- Alertas: DLQ, latência, erros `5xx`, exportações em massa.
- Teste de restauração do backup.
- RIPD e registro de operações (rascunho para o jurídico).
- Lista de suboperadores.
- Todas as decisões D1–D10 resolvidas em ADR.
- Thresholds de IA (spec 4.7) com plano de calibração e painel das métricas por `kind`.

**Aceite:** checklist da spec 6.1 inteira marcado, com link para a evidência de cada item.

---

## 6. Comece agora

Comece pelo **M00: Fundação**, nesta ordem:

1. Leia a especificação inteira.
2. Crie `PROGRESSO.md` com todos os módulos em "pendente".
3. Inicialize o monorepo (pnpm + Turborepo) com a árvore da spec 6.3 e `packages/config`.
4. Escreva o `docker-compose.yml` e confirme que Postgres + pgvector, Redis e o S3 local sobem.
5. Configure o Drizzle e aplique as migrações `0001_extensions` e `0002_enums`.
6. Implemente em `packages/contracts`:
   - o formato de erro;
   - `AiDecision`;
   - `decide()`;
   - os testes de limite de threshold.
7. Suba `apps/api` com `/health`, `/ready`, `X-Request-Id`, problem+json, logger com lista permitida e limitador de taxa.
8. Suba `apps/worker` (outbox) e `apps/realtime` (heartbeat).
9. Crie `packages/ui` com tokens e preset; em `apps/web`, faça o shell do `/app` com tema claro e escuro e os cabeçalhos de segurança.
10. Configure o CI.
11. Rode a Definição de Pronto, atualize `PROGRESSO.md` e entregue o relatório do M00.

Depois do relatório, siga para o **M01** sem esperar nova instrução, a menos que uma decisão da seção 7 da spec exija resposta do usuário.
