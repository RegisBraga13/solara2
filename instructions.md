# Solara Health — especificação de reconstrução e plano de execução

**Alvo:** <https://solara.doctor/app>  
**Levantamento:** 22/10/2026 (America/Fortaleza)  
**Público:** engenharia, produto, UX, segurança e operações.  
**Estado:** especificação executável de referência; contratos e regras marcados como propostos exigem validação com uma conta autorizada antes de alegar paridade com o produto publicado.

## 0. Evidência, limites e vocabulário

| Marca | Significado | Evidência |
|---|---|---|
| **O** | Observado no HTML/CSS público em 22/10/2026 | `GET /app` sem sessão redireciona a `/login?redirect=%2Fapp`; `/login` contém e-mail, senha e link `/onboarding`; onboarding inicia pela profissão; CSS público contém tokens abaixo. |
| **S** | Observado em captura autenticada enviada pelo usuário em 22/10/2026 | Página `/app` com navegação e painel inicial descritos na seção 5. A captura não expõe URLs internas, APIs ou interações após clique. |
| **P** | Promessa ou demonstração do site público; disponibilidade real não verificada | [Página inicial Solara](https://solara.doctor/) anuncia gravação, transcrição, documentos, agenda, assinatura, WhatsApp, offline, exportação e planos. |
| **L** | Existe no projeto local `solara-medconsult/`, que não é prova do código de produção | Next.js, FastAPI, Postgres/pgvector, Redis, SeaweedFS, captura, pacientes, prontuários, receitas, laudos e RAG. |
| **R** | Requisito ou contrato recomendado para a reconstrução | API `/api/v1`, esquema multiclínica, filas, assinatura, cobrança e controles de segurança abaixo. |

**Limite material:** as capturas autenticadas fornecidas pelo usuário cobrem partes de Consultas, Modelos, Ajustes, Pacientes, Agenda e Nova teleconsulta, mas a aba/sessão não está acessível interativamente. Não foram observados os fluxos completos, tráfego autenticado, banco, integrações, algoritmo, limites reais, política de retenção nem infraestrutura do serviço publicado. A página pública é material de produto, não evidência de que cada função esteja operacional. Não copiar dados pessoais ou clínicos das capturas para fixtures; usar dados sintéticos nos testes. Uma implementação fiel deve ser comparada com uma conta de teste autorizada, com captura de telas e contratos, antes de receber o rótulo de paridade.

**Leituras locais:** [`docs/fluxo-aprovado.md`](docs/fluxo-aprovado.md) define um fluxo local aprovado; [`solara-medconsult/docs/arquitetura.md`](solara-medconsult/docs/arquitetura.md) descreve a base anterior. O [relatório de crawl público](docs/solara-public-crawl.md) documenta método, URLs e achados dos bundles. Há divergência entre essa base e o site atual. O fluxo aprovado local prevalece para decisões já aprovadas no projeto local, enquanto a interface publicada é referência de pesquisa; registrar conflitos em uma ADR antes de alterar comportamento.

## 1. Escopo funcional e módulos

| Módulo | Capacidades e estados | Evidência | Prioridade |
|---|---|---|---|
| Identidade e onboarding | Login via Supabase Auth, escolha médico/psicólogo/nutricionista, wizard de cinco etapas; Ajustes > Perfil mostra nome, e-mail, CRM/UF, número do CRM e especialidade; validação profissional, clínica, convite e permissões são R; recuperação de senha aparece como “em breve” | S/O/código cliente/R | P0 |
| Organização e assinatura comercial | Clínica, membros, limites, teste de 7 dias, plano profissional/clínica, fatura, webhook, suspensão e reativação | P/R | P2 |
| Pacientes | Lista lateral com total/ativos, novo paciente, busca por nome/CPF, ordenação; ficha com dados demográficos, métricas PA/FC/SpO₂/peso/visitas, abas Timeline/Documentos/Laudos/Medicações, resumo lateral Contato/Alergias/Condições/Medicações e ações Editar/Gerar laudo/Nova consulta; editor Cadastro/Contato/Clínico, com contatos e tags na segunda etapa, alergias/condições/medicações na terceira, rascunho local e ação de excluir; persistência, exclusão e detalhe de medicação ainda dependem de inspeção | S/P/L/R | P0 |
| Agenda | Grade semanal observada, alternância Dia/Semana/Mês/Lista, Hoje e setas, calendário mensal lateral, linha da hora atual, filtros visíveis Primeira consulta/Retorno/Teleconsulta/Procedimento e botões Nova/Nova consulta; criação, detalhes, remarcação, lembretes e prevenção de conflito dependem de inspeção/implementação | S/P/R | P2 |
| Consentimento | Registro específico de gravação, finalidade, versão do termo, data, evidência e revogação | P/R | P0 |
| Encontro clínico | Modalidade, paciente, especialidade, anamnese, captura voz/texto, pausas, rascunho, retorno e anexos | P/L/R | P0 |
| Teleconsulta | Tela **Nova teleconsulta** com paciente existente/novo, busca por nome/CPF e tipo de documento anunciado; estado **Sala criada** com link `/tele/{token}`, copiar, **Entrar na sala** e **Criar outra** observado; entrada do paciente sem conta e gravação são descritas pela interface, mas acesso pelo link, consentimento e vídeo ainda não foram testados | S/R | P1 |
| Mídia e transcrição | Chunks de áudio, sincronização, diarização, timestamps, reprocessamento e descarte | P/L/R | P1 |
| Assistência de IA | Estruturação, sugestões, fontes, validação, rastreabilidade, revisão e edição humana | P/L/R | P1 |
| Documentos e modelos | Anamnese, evolução, receita, atestado, encaminhamento e laudo; modelos padrão de Anamnese e Evolução (SOAP) com prompts de IA; criação de modelo textual de Atestado em Markdown com variáveis automáticas e manuais; modelos próprios, versionamento e PDF | S/P/L/R | P1 |
| Assinatura e entrega | Assinatura qualificada quando exigida, PDF imutável, envio por canal autorizado, comprovante | P/R | P2 |
| Integração e exportação | CSV, PDF, FHIR conforme perfil definido, webhooks assinados | P/R | P2 |
| Auditoria e privacidade | Trilhas de leitura/edição/assinatura, retenção, solicitações do titular e incidentes | P/R | P0 |
| Gestão e métricas | Painel inicial com contagem semanal, tempo economizado e duração média; painel de equipe e exportação dependem de inspeção | S/P/R | P3 |

### Jornadas críticas e regras de negócio

1. **Entrada:** usuário escolhe a profissão (`/onboarding`, O) → passa por tela de conta e aviso LGPD → wizard “Boas-vindas / Experimente / Perfil / Recursos / Tudo pronto” (código cliente público) → `auth.signUp` envia e-mail, senha e metadados → se houver sessão imediata, o cliente tenta `POST /api/onboarding/complete` → entra em `/app` após validações. **R:** confirmação de e-mail, credencial profissional, clínica e convites precisam ser definidos e validados no servidor; conta pendente não assina documentos. O código público não comprova verificação automática do conselho.
2. **Consulta presencial:** no painel, **Iniciar consulta** abre menu com **Presencial** e **Teleconsulta** (S). A tela seguinte de **Nova consulta** permite iniciar a gravação e diz explicitamente que o paciente pode ser atribuído depois, na tela do documento (S). Nome, idade e sexo aparecem como contexto prévio; **Salvar como novo paciente** está selecionado na captura; tipo **Primeira consulta** está selecionado, com alternativa **Evolução**. Obrigatoriedade e persistência ainda não foram testadas. A pré-visualização de **Modelos** diz que o padrão da Solara é usado automaticamente quando não há modelo próprio para Anamnese (S). Fluxo alvo **R:** criar encontro provisório com tipo e intenção de cadastro → resolver modelo aplicável → registrar consentimento para áudio → gravar ou digitar → processar → atribuir paciente existente ou criar ficha nova de forma transacional antes da finalização → revisar documento → salvar → assinar → entregar. Nenhuma saída de IA vira prontuário assinado automaticamente.
3. **Retorno:** selecionar paciente e consulta anterior → criar novo encontro ligado ao anterior → registrar diferenças e evolução → revisar → assinar. **R:** documento anterior é imutável; correção posterior cria adendo com autor, motivo e data.
4. **Permissão de microfone:** ao clicar **Iniciar gravação** com microfone bloqueado ou não autorizado, a interface mostra uma tela dedicada “Precisamos do seu microfone”, explica como permitir nas configurações do site e oferece **Tentar novamente** (S). **R:** solicitar permissão apenas após gesto do usuário; diferenciar negada, dispositivo ausente/ocupado e navegador incompatível; preservar o rascunho e reexecutar a verificação ao tentar novamente. O estado de captura autorizada ainda não foi observado.
5. **Consulta offline:** navegador guarda rascunho/chunks cifrados localmente → mostra estado de sincronização → reconexão envia partes com `Idempotency-Key` → servidor ordena, confirma hash e processa → limpeza local após confirmação. **R:** não prometer modo offline até demonstrar persistência cifrada e recuperação após fechar a aba.
6. **Agenda:** criar horário → reservar com trava de concorrência → confirmar/remarcar/cancelar → enfileirar lembrete somente com autorização de contato → registrar entrega ou falha. **R:** conflito de profissional/sala retorna 409.
7. **Cobrança:** iniciar teste → período termina → provedor envia webhook assinado → evento é deduplicado e conciliado com a assinatura → capacidade é ajustada. **R:** webhook repetido não duplica cobrança nem muda estado incorretamente; indisponibilidade do provedor não apaga prontuário.
8. **Exportação/privacidade:** titular/representante autenticado solicita exportação → autorização e escopo são checados → job gera pacote cifrado com prazo curto → download auditado. Eliminação depende da base legal e retenção aplicável; jamais executar exclusão geral automática apenas porque a assinatura foi cancelada.
9. **Edição do paciente:** na ficha, **Editar** abre painel de três etapas **Cadastro → Contato → Clínico** (S). Em **Cadastro**, revisar nome e idade obrigatórios, sexo, nascimento, CPF, convênio e cor do avatar (S) → navegar pelas etapas → **Salvar alterações** (ação visível, resultado não observado). **R:** validar CPF se informado, consistência idade/nascimento, versão otimista e auditoria; **Excluir paciente** deve abrir confirmação e aplicar política de arquivamento/retenção, sem apagar prontuário por um clique.
10. **Teleconsulta:** selecionar **Teleconsulta** no início da consulta (opção observada no menu) → tela **Nova teleconsulta** exibe paciente existente/novo e anuncia escolha do tipo de documento (S) → após iniciar, a captura seguinte confirma **Sala criada** com URL para o paciente, copiar link, **Entrar na sala** e **Criar outra** (S). A tela orienta enviar o link por e-mail/WhatsApp; diz que o paciente entra sem conta e que a chamada gravada vira documento (descrição, sem execução observada). A URL mostrada segue `/tele/{token_opaco}`; o valor capturado é credencial de acesso e não é reproduzido. **R:** emitir convite de escopo limitado e prazo curto, verificar a identidade do convidado por mecanismo proporcional, registrar consentimento remoto para gravação, permitir revogar/rotacionar link, registrar entrada/saída e só transcrever mídia autorizada; rascunho clínico continua vinculado ao encontro selecionado.

**Máquina de estados do encontro (R):** `draft → recording ↔ paused → processing → review → finalized → signed → delivered`; `processing → failed → retrying`; `draft/review → cancelled`. Proibir transições ilegais e exigir versão otimista (`If-Match`). Documento assinado só aceita adendo. O servidor é autoridade de ordem temporal, usando UTC; a UI formata para o fuso local.

**Regras transversais (R):** toda consulta clínica pertence a uma clínica e profissional; o paciente pode ficar pendente no rascunho, como indica a tela observada, mas deve ser associado e confirmado antes de finalizar/assinar. Se **Salvar como novo paciente** estiver ativo, criar a ficha e associá-la na mesma transação de finalização, com deduplicação; se não, exigir seleção explícita de ficha existente ou política de encontro sem ficha aprovada. Não misturar dados provisórios com ficha existente sem confirmação explícita. Controles de acesso são aplicados antes de buscar objetos; duplicação é tratada por chave idempotente e restrições SQL; IA não deve receber identificadores diretos desnecessários; resultado de IA traz versão do modelo, prompt, fontes e grau de incerteza; falha de IA preserva rascunho manual; áudio temporário tem prazo de descarte configurável e deleção verificável; métricas não contêm texto clínico.

## 2. Arquitetura e infraestrutura

**Escolha:** monólito modular com workers separados. A base local já usa Next.js + FastAPI + Postgres; domínios compartilham transações, política de acesso e prontuário. Separar serviços agora aumenta latência e complexidade de consistência sem evidência de escala que o exija. Captura/transcrição, mensagens e exportação rodam em workers; módulos podem ser extraídos depois mediante métricas.

```text
Navegador/PWA
  ├─ HTTPS/TLS → DNS → CDN/WAF (assets públicos; nunca cachear PHI)
  │   → Load Balancer → API Gateway (origem, limites, request-id)
  │      ├─ Next.js: páginas, BFF, sessão web
  │      └─ FastAPI: identidade, clínicas, pacientes, consultas,
  │          documentos, salas/convites e sinalização de teleconsulta
  │           ├─ PostgreSQL primário + réplica de leitura + pgvector
  │           ├─ Redis: sessão/limites/cache curto, sem PHI durável
  │           ├─ S3: áudio temporário, anexos e PDFs cifrados
  │           └─ Outbox SQL → RabbitMQ → workers de STT/IA, PDF,
  │                                assinatura, lembrete e descarte
  │                    └─ callbacks/webhooks verificados → API → SQL
  └─ WebRTC/DTLS-SRTP → P2P ou SFU (ICE via STUN/TURN);
      estados da sala por canal autenticado na API
```

**Implantação (R):** uma região brasileira para dados clínicos quando contratualmente exigido, redes privadas para SQL/Redis/RabbitMQ, serviços stateless com pelo menos duas instâncias por zona, banco gerenciado com backups cifrados e restauração ensaiada. O site afirma hospedagem no Brasil, mas o local real de produção não foi verificado. Usar Terraform, migrações versionadas, imagens fixadas por digest, CI com análise de dependências, staging com dados sintéticos e deploy gradual. Segredos em gestor de segredos, nunca em `NEXT_PUBLIC_*`, log ou Git.

**Disponibilidade proposta:** SLO de API 99,9% mensal; p95 de leitura < 300 ms sem IA; p95 de escrita < 700 ms; transcrição e geração têm SLO próprio medido por duração do áudio. RPO ≤ 15 min e RTO ≤ 4 h devem ser validados por exercício de recuperação. Escalar app por CPU/latência e workers por tamanho da fila; impor cotas por clínica para proteger provedores externos.

**Cache (R):** Redis para sessão opaca, rate limit, configurações e modelos públicos por clínica com TTL curto e invalidação por versão. Nunca cachear prontuário em CDN nem usar Redis como fonte primária de consentimento, assinatura ou faturamento. Cache de paciente só após chave por `tenant_id`, TTL breve e revogação na edição; preferir leitura SQL quando dúvida de isolamento.

**Fila e consistência (R):** `jobs` + `outbox_events` são gravados na mesma transação do encontro. Publicador move eventos para RabbitMQ com entrega pelo menos uma vez; consumidor idempotente usa `event_id`. Retry exponencial, fila morta, observabilidade e reprocessamento manual. Não enfileirar áudio bruto no broker: guardar objeto privado e enviar referência curta.

**Teleconsulta (R):** HTTPS e sinalização autenticada no backend; mídia WebRTC protegida por DTLS-SRTP; STUN/TURN para conectividade e SFU somente se a topologia/carga exigir. O [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html) exige SRTP/DTLS-SRTP para mídia WebRTC. A frase **“Vídeo ponta a ponta”** da interface não é prova de criptografia de conteúdo entre navegador médico e navegador paciente quando há servidor de mídia: o [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605.html) separa proteção entre saltos e criptografia de ponta a ponta das imagens/áudio em SFU. Decidir e documentar a topologia, quem detém chaves e onde áudio é descriptografado para gravação/transcrição. Se a promessa for E2EE real com SFU, usar proteção de quadros entre participantes (por exemplo, SFrame) e uma estratégia de gravação compatível, como captura autorizada em um terminal; não afirmar E2EE enquanto um serviço intermediário puder ler a mídia. O convite sem conta é credencial portadora: a captura confirma token opaco no caminho `/tele/{token}`. Gerar token aleatório, armazenar só o hash, definir expiração/revogação/limite de tentativas, impedir indexação, aplicar `Referrer-Policy: no-referrer`, retirar o token do histórico após resgate e redigir caminho/tokens nos logs da borda, servidor e analytics; escopo apenas da sala.

## 3. Dados: estratégia e esquema de referência

PostgreSQL é a fonte de verdade para identidade, transações, prontuários, agenda, consentimentos, cobrança e auditoria; JSONB serve apenas a campos clínicos heterogêneos versionados. `pgvector` pode indexar apenas conteúdo de referência licenciado e desidentificado; vetores de prontuário requerem decisão explícita de privacidade. Objeto S3 guarda binários, com hash, chave e ciclo de vida em SQL. Redis é efêmero. Um banco NoSQL adicional não é necessário; introduzi-lo somente após perfil de carga que prove benefício.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE clinics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo', status text NOT NULL DEFAULT 'active',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id uuid PRIMARY KEY, email citext NOT NULL UNIQUE,
 email_verified_at timestamptz, mfa_enabled boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 clinic_id uuid NOT NULL REFERENCES clinics(id), user_id uuid NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK (role IN ('owner','admin','clinician','assistant','billing')),
 status text NOT NULL DEFAULT 'active', PRIMARY KEY (clinic_id,user_id)
);
CREATE TABLE professional_profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id), profession text NOT NULL,
 full_name text NOT NULL, specialty text, council_state char(2), council_number text,
 version bigint NOT NULL DEFAULT 1,
 validation_status text NOT NULL DEFAULT 'pending', validated_at timestamptz,
 UNIQUE (profession,council_state,council_number)
);
CREATE TABLE patients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL REFERENCES clinics(id),
 full_name_enc bytea NOT NULL, birth_date_enc bytea, cpf_blind_index bytea,
 age_years smallint CHECK (age_years BETWEEN 0 AND 120), age_as_of date,
 sex text, coverage_kind text, coverage_name_enc bytea, contact_enc bytea,
 marital_status text,
 avatar_color text, CHECK (age_years IS NULL OR age_as_of IS NOT NULL),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz, UNIQUE (clinic_id,cpf_blind_index), UNIQUE (clinic_id,id)
);
CREATE TABLE patient_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 patient_id uuid NOT NULL, label_enc bytea NOT NULL, label_blind_index bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id),
 UNIQUE (clinic_id,patient_id,label_blind_index)
);
CREATE TABLE recording_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 patient_id uuid, encounter_id uuid NOT NULL, subject_role text NOT NULL
   CHECK (subject_role IN ('patient','clinician')),
 subject_label_enc bytea,
 purpose text NOT NULL,
 notice_version text NOT NULL, status text NOT NULL CHECK (status IN ('granted','revoked')),
 captured_at timestamptz NOT NULL, revoked_at timestamptz, evidence_object_key text,
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id)
);
CREATE TABLE encounters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 patient_id uuid, clinician_id uuid NOT NULL REFERENCES users(id),
 provisional_name_enc bytea, provisional_age_years smallint,
 provisional_sex text, CHECK (provisional_age_years BETWEEN 0 AND 120),
 save_as_new_patient boolean NOT NULL DEFAULT true,
 document_kind text NOT NULL DEFAULT 'first_visit'
   CHECK (document_kind IN ('first_visit','evolution')),
 previous_encounter_id uuid REFERENCES encounters(id), specialty text NOT NULL,
 modality text NOT NULL CHECK (modality IN ('onsite','remote')),
 status text NOT NULL DEFAULT 'draft', version bigint NOT NULL DEFAULT 1,
 started_at timestamptz, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id),
 FOREIGN KEY (clinic_id,clinician_id) REFERENCES memberships(clinic_id,user_id),
 UNIQUE (clinic_id,id), UNIQUE (clinic_id,id,patient_id)
);
CREATE TABLE teleconsultation_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 encounter_id uuid NOT NULL, status text NOT NULL DEFAULT 'created'
   CHECK (status IN ('created','waiting','active','ended','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 ended_at timestamptz,
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id),
 UNIQUE (clinic_id,encounter_id), UNIQUE (clinic_id,id)
);
CREATE TABLE teleconsultation_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 room_id uuid NOT NULL, token_hash bytea NOT NULL UNIQUE,
 role text NOT NULL CHECK (role = 'patient'),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,room_id) REFERENCES teleconsultation_rooms(clinic_id,id)
);
ALTER TABLE recording_consents ADD CONSTRAINT consent_encounter_fk
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id);
CREATE TABLE patient_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 patient_id uuid NOT NULL, encounter_id uuid, code text NOT NULL
   CHECK (code IN ('blood_pressure','heart_rate','spo2','weight')),
 value_enc bytea NOT NULL, unit text NOT NULL, context text,
 observed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id),
 FOREIGN KEY (clinic_id,encounter_id,patient_id)
   REFERENCES encounters(clinic_id,id,patient_id)
);
CREATE TABLE patient_clinical_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 patient_id uuid NOT NULL, kind text NOT NULL
   CHECK (kind IN ('allergy','condition','medication')),
 coding_enc bytea, display_enc bytea NOT NULL, details_enc bytea NOT NULL,
 status text NOT NULL DEFAULT 'active', verification_status text NOT NULL DEFAULT 'unconfirmed',
 recorded_by uuid REFERENCES users(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id)
);
CREATE TABLE media_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 encounter_id uuid NOT NULL, kind text NOT NULL, object_key text NOT NULL UNIQUE,
 sha256 bytea NOT NULL, size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
 mime_type text NOT NULL, retention_until timestamptz, deleted_at timestamptz,
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id)
);
CREATE TABLE transcript_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 encounter_id uuid NOT NULL, ordinal int NOT NULL, speaker text,
 start_ms bigint NOT NULL, end_ms bigint NOT NULL, text_enc bytea NOT NULL,
 confidence numeric(4,3), model_version text,
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id),
 UNIQUE (encounter_id,ordinal)
);
CREATE TABLE document_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid REFERENCES clinics(id),
 source_template_id uuid REFERENCES document_templates(id), name text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('anamnesis','progress_note','certificate',
   'prescription','report','request','referral','other')),
 render_mode text NOT NULL DEFAULT 'static'
   CHECK (render_mode IN ('static','ai')), specialty text, version int NOT NULL,
 schema_json jsonb NOT NULL DEFAULT '{}', body_json jsonb NOT NULL DEFAULT '{}',
 body_markdown text NOT NULL DEFAULT '', generation_prompt text NOT NULL DEFAULT '',
 question_format text NOT NULL DEFAULT '',
 generation_config jsonb NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true,
 UNIQUE (clinic_id,kind,specialty,version)
);
CREATE TABLE documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 encounter_id uuid NOT NULL, patient_id uuid, author_id uuid NOT NULL REFERENCES users(id),
 template_id uuid REFERENCES document_templates(id), kind text NOT NULL,
 status text NOT NULL DEFAULT 'draft', revision int NOT NULL DEFAULT 1,
 body_enc bytea NOT NULL, evidence_json jsonb NOT NULL DEFAULT '{}',
 pdf_object_key text, signed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id),
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id),
 UNIQUE (clinic_id,id)
);
CREATE TABLE signatures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL UNIQUE REFERENCES documents(id),
 signer_id uuid NOT NULL REFERENCES users(id), provider_ref text NOT NULL UNIQUE,
 signed_pdf_sha256 bytea NOT NULL, certificate_metadata jsonb NOT NULL,
 signed_at timestamptz NOT NULL
);
CREATE TABLE deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 document_id uuid NOT NULL, channel text NOT NULL, recipient_enc bytea NOT NULL,
 status text NOT NULL DEFAULT 'queued', provider_ref text,
 sent_at timestamptz, failed_at timestamptz,
 FOREIGN KEY (clinic_id,document_id) REFERENCES documents(clinic_id,id)
);
CREATE TABLE ai_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 encounter_id uuid NOT NULL, document_id uuid,
 task text NOT NULL, model_id text NOT NULL, prompt_version text NOT NULL,
 input_hash bytea NOT NULL, output_schema_version int NOT NULL,
 status text NOT NULL, source_refs jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (clinic_id,encounter_id) REFERENCES encounters(clinic_id,id),
 FOREIGN KEY (clinic_id,document_id) REFERENCES documents(clinic_id,id)
);
CREATE TABLE appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL REFERENCES clinics(id),
 patient_id uuid NOT NULL, clinician_id uuid NOT NULL, starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL, kind text NOT NULL
   CHECK (kind IN ('first_visit','follow_up','teleconsultation','procedure')),
 status text NOT NULL, room_id uuid,
 FOREIGN KEY (clinic_id,patient_id) REFERENCES patients(clinic_id,id),
 FOREIGN KEY (clinic_id,clinician_id) REFERENCES memberships(clinic_id,user_id),
 CHECK (ends_at > starts_at)
);
ALTER TABLE appointments ADD CONSTRAINT appointment_clinician_no_overlap
 EXCLUDE USING gist (clinic_id WITH =, clinician_id WITH =,
                     tstzrange(starts_at,ends_at,'[)') WITH &&)
 WHERE (status IN ('scheduled','confirmed'));
CREATE TABLE subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL UNIQUE REFERENCES clinics(id),
 plan_code text NOT NULL, status text NOT NULL, trial_ends_at timestamptz,
 provider_customer_ref text, provider_subscription_ref text UNIQUE, current_period_end timestamptz
);
CREATE TABLE webhook_receipts (
 provider text NOT NULL, event_id text NOT NULL, payload_hash bytea NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (provider,event_id)
);
CREATE TABLE jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL REFERENCES clinics(id),
 kind text NOT NULL, status text NOT NULL, attempts int NOT NULL DEFAULT 0,
 payload_ref text, result_ref text, error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aggregate_type text NOT NULL,
 aggregate_id uuid NOT NULL, kind text NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 actor_id uuid, action text NOT NULL, resource_type text NOT NULL, resource_id uuid,
 request_id text, metadata jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patients_clinic_created_idx ON patients (clinic_id,created_at DESC);
CREATE INDEX teleconsultation_invites_room_idx ON teleconsultation_invites (clinic_id,room_id,expires_at DESC);
CREATE INDEX patient_tags_patient_idx ON patient_tags (clinic_id,patient_id);
CREATE INDEX patient_observations_latest_idx ON patient_observations (clinic_id,patient_id,code,observed_at DESC);
CREATE INDEX patient_clinical_items_kind_idx ON patient_clinical_items (clinic_id,patient_id,kind,status);
CREATE INDEX encounters_patient_created_idx ON encounters (clinic_id,patient_id,created_at DESC);
CREATE INDEX documents_encounter_idx ON documents (clinic_id,encounter_id,created_at DESC);
CREATE INDEX jobs_pending_idx ON jobs (status,created_at) WHERE status IN ('queued','retrying');
CREATE INDEX audit_resource_idx ON audit_events (clinic_id,resource_type,resource_id,occurred_at DESC);
ALTER TABLE encounters ADD CONSTRAINT previous_encounter_same_clinic_fk
 FOREIGN KEY (clinic_id,previous_encounter_id) REFERENCES encounters(clinic_id,id);
ALTER TABLE documents ADD CONSTRAINT document_author_member_fk
 FOREIGN KEY (clinic_id,author_id) REFERENCES memberships(clinic_id,user_id);
```

**Relacionamentos:** clínica 1:N membros, pacientes, encontros, agendas e auditorias; usuário N:N clínica via `memberships`; paciente 1:N encontros, observações e itens clínicos. Encontro provisório pode não ter `patient_id` até a revisão, mas finalização/assinatura exigem vínculo validado. Nome/idade/sexo provisórios são contexto do encontro e não criam automaticamente uma ficha. Encontro 1:N segmentos, arquivos e documentos; encontro remoto 0:1 sala de teleconsulta, sala 1:N convites revogáveis; modelo 1:N documentos; documento 0:1 assinatura e 1:N entregas. `users` é projeção do cadastro Supabase Auth: usar o mesmo UUID de `auth.users` e sincronizar mudanças; credenciais/senhas pertencem somente ao serviço de identidade. `documents.revision` aumenta a cada edição antes da assinatura; correção posterior é um novo documento de adendo, nunca alteração do PDF assinado. Aplicar RLS por clínica como defesa adicional, testes de isolamento cruzado e privilégios mínimos por papel. Nunca usar `clinic_id` vindo do corpo como autorização. `bytea` supõe cifragem de envelope na aplicação/KMS; busca por CPF usa blind index com chave separada e normalização. Busca por nome em dados cifrados requer índice de busca protegido por clínica ou varredura limitada e auditada; definir capacidade, política de prefixo e ameaça antes de implementá-la. Toda coluna sensível e prazo de retenção precisam de catálogo de dados aprovado.

```sql
-- Exemplo: repetir a política nas demais tabelas clínicas; o papel da API não recebe BYPASSRLS.
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
CREATE POLICY patients_clinic_isolation ON patients
 USING (clinic_id = current_setting('app.clinic_id', true)::uuid)
 WITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);
-- A API define app.clinic_id com SET LOCAL dentro da transação, após validar a sessão.
```

## 4. API e contratos propostos

**Namespace:** `/api/v1`. São contratos de reconstrução (**R**), não rotas confirmadas do site. JSON em UTF-8; `Content-Type: application/json`; `Accept: application/json`; cookie `session` Secure, HttpOnly, SameSite=Lax e token CSRF em `X-CSRF-Token` para mutações; `X-Request-Id` opcional. Escrever `Idempotency-Key` em criação/processamento/entrega e `If-Match` para edição concorrente. Nunca passar `clinic_id` como substituto de autorização. Paginação por cursor e limite máximo 100.

**Autenticação vista no código público (O):** o bundle de login chama Supabase `auth.signInWithPassword({email,password})`; o onboarding chama `auth.signUp` e depois, se a sessão existir, `POST /api/onboarding/complete`. O corpo e retorno dessa rota interna não foram observados. As linhas `/auth/*` abaixo são uma interface **proposta** para um BFF e podem ser substituídas por Supabase Auth diretamente, preservando autenticação e autorização no backend clínico. A UI atual de “Esqueci minha senha” informa “Recuperação de senha em breve”; o endpoint de reset abaixo é requisito de produção, não recurso confirmado.

**Modelos vistos nas capturas (S):** um modelo padrão de **Anamnese** é usado quando não há modelo próprio; **Duplicar** e **Ver detalhes** estão visíveis. Variáveis citadas: `@paciente`, `@medico`, `@paciente.nome`, `@paciente.cpf`, `@medico.crm` e `@data.hoje`. A tela de detalhes diz que modelos padrão são somente leitura e devem ser duplicados para personalização. Há prompt de regras clínicas separado do layout do documento e do **Formato da pergunta** avançado; este aceita `{patient_context}` e `{transcript}`. Existe prévia com transcrição de exemplo. A interface nomeia **Claude** nas descrições, o que demonstra a configuração exibida, não confirma qual modelo atende requisições em produção. O formulário **Novo modelo** para Atestados usa Markdown e placeholders `@` com duas classes: automáticos (`@paciente.nome`, `@paciente.cpf`, `@paciente.idade`, `@paciente.convenio`, `@medico.nome`, `@medico.crm`, `@data.hoje`) e campos manuais (`@cid`, `@dias`, nomes definidos pelo autor). Resolver fallback por clínica + tipo + especialidade, com versão de layout, prompt, formato da pergunta e configuração fixada no documento gerado. Variáveis automáticas vêm de lista tipada; campos manuais são coletados em formulário antes da emissão, têm validação por tipo e escape contextual. Nunca avaliar expressão livre nem inserir CPF/CID se papel, finalidade e autorização não permitirem.

**Categorias de Novo modelo (S):** o seletor aberto mostra, nesta ordem, **Anamnese**, **Evolução**, **Atestados**, **Receitas**, **Laudos**, **Solicitações**, **Encaminhamentos** e **Outros**. A captura mostra **Encaminhamentos** no campo; o destaque azul em **Anamnese** dentro do menu pode ser foco/realce do controle nativo e não demonstra mudança de categoria. **R:** mapear os rótulos, respectivamente, aos valores de API `anamnesis`, `progress_note`, `certificate`, `prescription`, `report`, `request`, `referral` e `other`. A categoria controla filtros e regras de validação específicas; a tela aberta não prova que todas usam o mesmo editor ou fluxo de emissão.

**Envelope de erro comum:** `400` formato inválido; `401` sem sessão; `403` sem permissão; `404` inexistente ou fora da clínica; `409` conflito de versão/agenda; `422` regra de domínio; `429` limite; `500` erro interno sem PHI. Exemplo:

```json
{"error":{"code":"VERSION_CONFLICT","message":"O registro foi alterado; recarregue antes de salvar.","details":{}},"request_id":"req_01"}
```

| Método e URL | Headers adicionais | Request JSON | Response JSON e status |
|---|---|---|---|
| `POST /auth/register` | Idempotency-Key | `{"email":"medico@clinica.com","password":"...","profession":"doctor"}` | `202 {"user_id":"uuid","email_verification_required":true}`; e-mail existente responde genericamente para evitar enumeração. |
| `POST /auth/login` | nenhum além do padrão | `{"email":"medico@clinica.com","password":"..."}` | `200 {"user":{"id":"uuid","email":"medico@clinica.com"},"memberships":[{"clinic_id":"uuid","role":"clinician"}],"csrf_token":"..."}` + cookie; credencial inválida `401`. |
| `POST /auth/logout` | CSRF | `{}` | `204` sem corpo; invalida sessão. |
| `POST /auth/password-reset-requests` | nenhum além do padrão | `{"email":"medico@clinica.com"}` | `202 {"accepted":true}` sempre, inclusive e-mail desconhecido; token de uso único expira. |
| `POST /onboarding` | CSRF, Idempotency-Key | `{"profession":"doctor","council_state":"SP","council_number":"12345","clinic_name":"Clínica Exemplo"}` | `202 {"profile_id":"uuid","validation_status":"pending","clinic_id":"uuid"}`; perfil inválido `422`. |
| `GET /me/profile` | sessão | sem corpo | `200 {"full_name":"Médica Exemplo","email":"medica@example.com","profession":"doctor","council_state":null,"council_number":null,"specialty":"Clínica Médica","version":1}`; sem sessão `401`. |
| `PATCH /me/profile` | CSRF, `If-Match: "1"` | `{"full_name":"Médica Exemplo","council_state":"CE","council_number":"12345","specialty":"Clínica Médica"}` | `200 {"full_name":"Médica Exemplo","council_state":"CE","council_number":"12345","specialty":"Clínica Médica","version":2,"validation_status":"pending"}`; formato inválido `422`, conflito `409`. E-mail fica fora deste payload; troca de identidade requer fluxo separado. |
| `POST /patients` | CSRF, Idempotency-Key | `{"full_name":"Paciente Exemplo","age_years":45,"birth_date":null,"sex":"female","cpf":null,"coverage_kind":"private","avatar_color":"amber"}` | `201 {"id":"uuid","version":1,"full_name":"Paciente Exemplo","age_years":45,"age_as_of":"2026-10-22"}`; nome/idade ausentes `422` neste fluxo de UI, CPF duplicado na clínica `409`. A exigência real da API original não foi observada. |
| `GET /patients?query=...&sort=recent&cursor=...` | sessão | sem corpo | `200 {"items":[{"id":"uuid","full_name":"Paciente Exemplo","age_years":null,"coverage":"Particular","last_visit_at":"2026-10-22T14:00:00Z"}],"total":1,"active_total":1,"next_cursor":null}`; busca por nome/CPF autorizada, paginação e escopo por clínica. `sort` proposto: `recent`, `name_asc`, `consultation_count`; definir no contrato se o último é decrescente, pois a UI não informa a direção. |
| `GET /patients/{id}` | sessão | sem corpo | `200 {"id":"uuid","full_name":"Paciente Exemplo","age_years":null,"sex":"female","coverage":"Particular","contact":null,"latest_observations":{"blood_pressure":null,"heart_rate":null,"spo2":null,"weight":null},"visit_count":1,"clinical_items":{"allergies":[],"conditions":[],"medications":[]},"version":1}`; de outra clínica `404`. Ausência de registro não equivale a ausência clínica confirmada. |
| `PATCH /patients/{id}` | CSRF, `If-Match: "1"` | `{"full_name":"Paciente Exemplo","age_years":45,"birth_date":null,"sex":"female","cpf":null,"coverage_kind":"private","avatar_color":"amber","contact":{"phone":"+5511987654321","email":"paciente@example.com","address":"Rua Exemplo, 10"},"marital_status":null,"tags":["acompanhamento"],"clinical_items":{"allergies":[],"conditions":[],"medications":[]}}` | `200 {"id":"uuid","version":2}`; idade/nascimento incoerentes ou formato inválido `422`, edição concorrente `409`. `age_as_of` é atribuído no servidor se idade manual for salva sem nascimento; as três etapas são validadas e atualizadas em uma transação. |
| `GET /clinical-terminology?kind=allergy&query=...` | sessão | sem corpo | `200 {"items":[{"display":"Termo de exemplo","coding":{"system":"ICD-10","code":"..."}}]}`; consulta por nome/código, com limite de resultados e versão do catálogo. É suporte proposto à busca descrita na UI, não endpoint observado. |
| `POST /patients/{id}/archive` | CSRF, Idempotency-Key, confirmação reforçada | `{"reason":"registro duplicado","confirm":true}` | `200 {"id":"uuid","archived_at":"2026-10-22T14:00:00Z"}`; sem permissão `403`, vínculo clínico que impede eliminação `409`. É política proposta para a ação **Excluir paciente**, não efeito observado do botão. |
| `GET /patients/{id}/timeline?cursor=...` | sessão | sem corpo | `200 {"items":[{"type":"encounter","id":"uuid","kind":"first_visit","title":"Primeira consulta","occurred_at":"2026-10-22T14:00:00Z"}],"next_cursor":null}`; eventos/documentos só do paciente e da clínica, ordem decrescente. |
| `POST /patients/{id}/observations` | CSRF, Idempotency-Key | `{"code":"blood_pressure","value":{"systolic":120,"diastolic":80},"unit":"mmHg","observed_at":"2026-10-22T14:00:00Z","encounter_id":"uuid"}` | `201 {"id":"uuid"}`; unidade/valor inválido `422`, encontro de outro paciente `404`. |
| `POST /encounters` | CSRF, Idempotency-Key | `{"patient_id":null,"provisional_patient":{"name":"Paciente Exemplo","age_years":45,"sex":"female"},"save_as_new_patient":true,"document_kind":"first_visit","specialty":"cardiology","modality":"onsite","previous_encounter_id":null}` | `201 {"id":"uuid","status":"draft","version":1,"patient_assignment":"pending","document_kind":"first_visit"}`; `patient_id` opcional, se informado deve pertencer à clínica ou retorna `404`. |
| `POST /teleconsultations` | CSRF, Idempotency-Key | `{"patient_id":"uuid","document_kind":"first_visit"}` | `201 {"room_id":"uuid","encounter_id":"uuid","status":"waiting","patient_invite_url":"https://app.exemplo/tele/{token_opaco}","invite_expires_at":"..."}`; cria encontro remoto, sala e convite de forma transacional. O **estado Sala criada** e formato `/tele/{token}` foram vistos, mas método/payload/status são propostos. URL secreta só na resposta privada, `Cache-Control: no-store`; paciente fora da clínica `404`, dados insuficientes `422`. |
| `POST /teleconsultations/join` | token de convite no corpo, limite por IP/sala | `{"invite_token":"segredo_opaco"}` | `200 {"room_id":"uuid","role":"patient","signaling_token":"credencial_curta","expires_at":"..."}`; convite inválido/expirado/revogado `401` genérico, sala encerrada `409`. Entrada sem conta conforme texto da tela; vínculo de identidade e consentimento exigem fluxo de UI específico. |
| `POST /teleconsultations/{id}/patient-recording-consent` | `Authorization: Bearer <signaling_token>`, Idempotency-Key | `{"notice_version":"2026-10","status":"granted"}` | `201 {"consent_id":"uuid","status":"granted","captured_at":"..."}`; sem convite válido `401`, recusa ou termo ausente impede gravação `422`. O token concede somente escopo da sala. |
| `POST /teleconsultations/{id}/invite/rotate` | CSRF, Idempotency-Key, profissional da sala | `{}` | `200 {"patient_invite_url":"https://app.exemplo/tele/{token_opaco}","invite_expires_at":"..."}`; revoga token anterior. Outra clínica `404`. **Criar outra** foi visto, mas não se sabe se rotaciona o convite da sala existente ou cria outra sala. |
| `POST /teleconsultations/{id}/end` | CSRF, Idempotency-Key, profissional da sala | `{"reason":"completed"}` | `200 {"room_id":"uuid","status":"ended"}`; idempotente, revoga convite e sinalização. |
| `POST /encounters/{id}/recording-consents` | CSRF, Idempotency-Key | `{"subject_role":"patient","purpose":"clinical_documentation","notice_version":"2026-10","status":"granted","evidence_ref":"object-key"}` | `201 {"id":"uuid","captured_at":"2026-10-22T14:00:00Z","status":"granted"}`; termo ausente `422`. |
| `POST /encounters/{id}/recordings/uploads` | CSRF, Idempotency-Key | `{"mime_type":"audio/webm","size_bytes":1048576,"sha256":"hex","part_count":1}` | `201 {"upload_id":"uuid","parts":[{"number":1,"url":"signed-short-lived-url"}],"expires_at":"..."}`; sem consentimento `403`. URLs são privadas e não logadas. |
| `POST /encounters/{id}/recordings/{upload_id}/complete` | CSRF, Idempotency-Key | `{"parts":[{"number":1,"etag":"..."}],"sha256":"hex"}` | `202 {"job_id":"uuid","status":"queued"}`; hash errado `422`, duplicata retorna mesmo job. |
| `GET /jobs/{id}` | sessão | sem corpo | `200 {"id":"uuid","kind":"transcribe","status":"succeeded","result_ref":"uuid","error_code":null}`; sem acesso `404`. |
| `PATCH /encounters/{id}` | CSRF, `If-Match: "1"` | `{"status":"review","notes":{"chief_complaint":"..."}}` | `200 {"id":"uuid","status":"review","version":2}`; versão antiga `409`. |
| `PUT /encounters/{id}/patient` | CSRF, `If-Match: "2"` | `{"patient_id":"uuid","confirm_identity":true}` | `200 {"id":"uuid","patient_id":"uuid","version":3}`; conflito de dados provisórios `422`, paciente de outra clínica `404`. |
| `GET /encounters/{id}` | sessão | sem corpo | `200 {"id":"uuid","status":"review","version":2,"patient_id":"uuid","documents":[]}`; sem vínculo `404`. |
| `POST /encounters/{id}/documents/generate` | CSRF, Idempotency-Key | `{"kind":"anamnesis","template_id":"uuid","transcript_revision":1}` | `202 {"job_id":"uuid","status":"queued"}`; saída sempre rascunho; sem material `422`. |
| `GET /document-templates?kind=anamnesis&specialty=...` | sessão | sem corpo | `200 {"items":[{"id":"uuid","name":"Anamnese","source":"system","version":1,"active":true}]}`; incluir padrão + modelos da clínica. |
| `POST /document-templates` | CSRF, Idempotency-Key | `{"name":"Atestado simples","kind":"certificate","render_mode":"static","body_markdown":"# Atestado Médico\n## Identificação\n@paciente.nome...","manual_fields":[{"name":"dias","type":"integer"},{"name":"cid","type":"text"}]}` | `201 {"id":"uuid","version":1,"source":"clinic"}`; nome ausente `400`, placeholder inválido `422`. |
| `POST /document-templates/{id}/duplicate` | CSRF, Idempotency-Key | `{"name":"Anamnese da clínica"}` | `201 {"id":"uuid","source_template_id":"uuid","version":1,"source":"clinic"}`; modelo fora do escopo `404`. |
| `PATCH /document-templates/{id}` | CSRF, `If-Match: "1"` | `{"name":"Anamnese da clínica","body":{"sections":[]},"generation_prompt":"Instruções revisadas...","question_format":"Contexto: {patient_context}\nTranscrição: {transcript}","generation_config":{},"active":true}` | `200 {"id":"uuid","version":2}`; modelo global imutável `403`, variável não permitida `422`. |
| `POST /document-templates/{id}/preview` | CSRF, Idempotency-Key | `{"transcript_fixture_id":"low_back_pain_v1","draft":{"generation_prompt":"...","question_format":"... {transcript}","body":{"sections":[]}}}` | `202 {"job_id":"uuid","persisted":false}`; prévia não altera o modelo, erro do provedor `503`. |
| `PATCH /documents/{id}` | CSRF, `If-Match: "1"` | `{"sections":{"chief_complaint":"texto revisado"},"reviewed":true}` | `200 {"id":"uuid","status":"review","revision":2}`; assinado `409`. |
| `GET /documents/{id}` | sessão | sem corpo | `200 {"id":"uuid","kind":"anamnesis","status":"review","revision":2,"sections":{}}`; outra clínica `404`. |
| `POST /documents/{id}/sign` | CSRF, Idempotency-Key, autenticação reforçada | `{"revision":2,"signature_method":"icp_brasil","provider_token":"token_efemero"}` | `202 {"job_id":"uuid","status":"queued"}`; profissional não validado `403`; falha de certificado `422`. |
| `POST /documents/{id}/deliveries` | CSRF, Idempotency-Key | `{"channel":"email","recipient":"paciente@example.com","consent_id":"uuid"}` | `202 {"job_id":"uuid","status":"queued"}`; documento não assinado `409`, canal sem autorização `403`. |
| `GET /appointments?from=2026-10-18T00:00:00-03:00&to=2026-10-25T00:00:00-03:00&kinds=first_visit,follow_up` | sessão | sem corpo | `200 {"items":[],"counts":{"first_visit":0,"follow_up":0,"teleconsultation":0,"procedure":0},"timezone":"America/Fortaleza"}`; intervalo `[from,to)`, clínica/profissional da sessão, limite de janela e fuso explícitos. |
| `POST /appointments` | CSRF, Idempotency-Key | `{"patient_id":"uuid","clinician_id":"uuid","kind":"first_visit","starts_at":"2026-10-23T12:00:00Z","ends_at":"2026-10-23T12:30:00Z"}` | `201 {"id":"uuid","kind":"first_visit","status":"scheduled"}`; sobreposição `409`. A equivalência da ação **Nova** com este contrato é proposta, não observada. |
| `POST /exports` | CSRF, Idempotency-Key | `{"scope":"patient","patient_id":"uuid","formats":["pdf","csv"]}` | `202 {"job_id":"uuid","status":"queued"}`; escopo proibido `403`. |
| `POST /billing/webhooks/{provider}` | assinatura do provedor e timestamp | JSON nativo do provedor; persistir hash e `event_id` | `200 {"received":true}` inclusive repetição idêntica; assinatura inválida `401`, mesmo ID/hash diferente `409`. |

**Eventos de acompanhamento (R):** `GET /encounters/{id}/events` por SSE com `event`, `id` e `data`, autorizado pela sessão. Nunca transmitir áudio ou PHI em tópico compartilhado. Upload binário usa as URLs assinadas e headers de checksum do provedor, sem corpo JSON. WebSocket só se a transcrição em tempo real for comprovadamente necessária; autenticar handshake e revalidar clínica.

## 5. Frontend, identidade e experiência

### Painel autenticado observado na captura (S)

A captura completa de `/app` enviada pelo usuário mostra barra horizontal com logomarca à esquerda, **Consultas** selecionada, **Agenda**, **Pacientes**, **Modelos** e **Ajustes**; à direita há **Nova consulta**, sino de notificações e avatar. O corpo exibe saudação personalizada, data local e estado sem consulta agendada no dia. Quatro cartões exibem **Hoje: 0 / sem agendamentos**, **Esta semana: 0 / nenhuma consulta ainda**, **Tempo economizado: 0h 0m / em documentação** e **Duração média: — / sem dados ainda**. Há atalhos **Agenda** e **Nova consulta**, seguidos de painel em gradiente âmbar com a ação **Iniciar consulta** e seta de menu. A cópia do painel afirma que o áudio é apagado após a transcrição; a política efetiva de retenção segue não verificada. Não inferir o funcionamento das abas apenas por seus nomes.

A captura da aba **Agenda** mostra um calendário semanal vazio em três áreas: navegação superior com **Agenda** ativa; coluna lateral com título **Agenda**, identificação abreviada do profissional, botão âmbar **+ Nova consulta**, mini calendário de **Outubro 2026** com setas de mês e dia **22** destacado; e grade principal. A lateral mostra a seção **Tipo**, com quatro filtros marcados e respectivos pontos coloridos/contadores `0`: **Primeira consulta** (âmbar), **Retorno** (verde água), **Teleconsulta** (roxo) e **Procedimento** (coral). A lateral tem rolagem própria; a captura não garante que esses sejam todos os filtros. Os nomes **Retorno** e **Evolução** aparecem em contextos distintos e não devem ser unidos sem observar a regra do produto.

No cabeçalho principal, o mês **Outubro 2026** acompanha o intervalo **18–24 Out**, botão **Hoje**, setas anterior/próximo, alternância **Dia / Semana / Mês / Lista** com **Semana** ativa e ação âmbar **+ Nova**. A linha de dias vai de **DOM 18** a **SÁB 24**, com **QUI 22** em âmbar. A grade tem colunas diárias e linhas horárias visíveis a partir de **08:00**; uma linha/bolinha laranja com marcador de hora **11:53** aparece em quinta-feira, compatível com indicador de hora atual no instante da captura. Nenhum compromisso está visível. **R:** renderizar intervalos no fuso do usuário, tratar mudança de horário de verão quando aplicável, manter intervalos meio abertos em UTC no servidor, virtualizar janelas longas e não expor nome de paciente em calendários de outros profissionais sem autorização. Não foram acionados Dia/Mês/Lista, **Hoje**, setas, mini calendário, filtros ou **Nova**; destino e formulário dessas ações seguem desconhecidos.

A segunda captura, da parte inferior da mesma página, mostra **Consultas recentes** com campo **Buscar por paciente...**, filtros **Todas**, **Primeira consulta** e **Evolução**, cada um com contador `0`, e tabela com colunas **Paciente**, **Queixa**, **Documento** e **Data**. No estado vazio há ícone de documento, texto informando ausência de consulta gravada e instrução para usar **Nova consulta**; a primeira gravação é apresentada como configuração de aproximadamente dois minutos. Projetar estados com resultados, busca sem correspondência, carregamento e erro como requisitos **R**; só o estado vazio foi observado. Uma terceira captura mostra o menu de **Iniciar consulta** aberto, com exatamente duas opções visíveis: **Presencial** (ícone de microfone) e **Teleconsulta** (ícone de vídeo). O menu branco, arredondado e sombreado abre abaixo do botão escuro, sem navegação até a seleção de uma opção.

A captura seguinte de **Nova consulta** mostra breadcrumb **Consultas / Nova consulta**, título, instrução de atribuição posterior do paciente, **Voltar** e CTA âmbar **Iniciar gravação**. Em desktop, há dois cartões: **Paciente** (à esquerda), com texto “Comece sem ficha — ou crie um cadastro completo no fim”, campo **Nome do paciente** com placeholder “Nome completo”, campo **Idade** com placeholder `00` e seletor **Sexo** exibindo **Feminino**; e **Resumo** (à direita), com selo **Novo cadastro**, linhas **Paciente**, **Idade / Sexo**, **Documento: Primeira consulta** e **Duração estimada: 30–60 min**. A parte inferior mostra controle selecionado **Salvar como novo paciente**, cuja descrição diz que a ficha é criada junto com a consulta e pode ser completada depois na aba Pacientes. O cartão **Tipo de documento** oferece **Primeira consulta** selecionada, descrita como estrutura com HPMA, revisão de sistemas, antecedentes, hipótese diagnóstica e conduta; e **Evolução**, descrita como retorno/acompanhamento em formato SOAP. O texto diz que o tipo pode ser trocado depois. O painel lateral informa que o áudio original é apagado do servidor automaticamente após a transcrição, uma declaração de interface ainda sem verificação operacional. Obrigatoriedade dos campos, opções do seletor, consentimento e efeito de **Iniciar gravação** ainda não foram observados.

A captura **Nova teleconsulta** apresenta título e texto: escolher paciente e tipo de documento, receber um link para enviar ao paciente, gravar a consulta e convertê-la em documento. O CTA âmbar **Iniciar teleconsulta** usa ícone de vídeo e seta. O cartão **Paciente** diz que a escolha vem da lista e que o histórico entra no contexto do documento; mostra seletor **Paciente existente** com contador `1` ativo e **Novo paciente** como alternativa, busca **Buscar por nome ou CPF...**, uma opção de paciente existente e link **Não encontrou? Criar novo paciente**. A identificação real na lista não foi copiada. O cartão **Como funciona** enumera: criar sala/copiar link; enviar ao paciente por e-mail/WhatsApp para entrar sem conta; gravar e gerar documento como na presencial. Isso descreve o fluxo pretendido, sem demonstrar integração de envio ou geração. Um aviso verde água diz **“Vídeo ponta a ponta”**, menciona **DTLS-SRTP** e afirma que o áudio é apagado após a transcrição. A proteção efetiva da mídia, a topologia e a deleção não foram medidas; ver arquitetura de segurança. O seletor de tipo de documento, embora anunciado, está fora da área capturada. A escolha de paciente/tipo que precedeu o estado seguinte não foi registrada nas imagens.

A captura posterior mostra breadcrumb **Consultas / Teleconsulta** e, no lugar do formulário, cartão **Sala criada** com instrução para enviar o link ao paciente por e-mail ou WhatsApp, porque ele entraria sem conta. O link exibido tem formato `https://solara.doctor/tele/{token_opaco}`; **o token real da captura foi omitido** por dar acesso à sala. Ao lado há botão quadrado de **copiar**; abaixo, CTA âmbar **Entrar na sala** com ícone de vídeo e ação textual **Criar outra**. Esse estado confirma criação/apresentação da sala e emissão do convite na UI. Não confirma cópia bem-sucedida, entrega de mensagem, validade/expiração do convite, entrada do paciente, início da chamada, gravação ou se **Criar outra** revoga a sala anterior.

Após clicar em **Iniciar gravação** com o microfone não autorizado, a captura mostra uma tela de bloqueio com ícone de microfone riscado, título **Precisamos do seu microfone**, texto que reúne duas causas possíveis — acesso bloqueado ou ainda não permitido —, instrução para autorizar nas configurações do site e botão âmbar **Tentar novamente**. Uma segunda captura mais completa mostra o estado ocupando toda a área visível, sem barra de navegação interna: gradiente de pêssego claro no alto/esquerda para verde água claro na parte inferior/direita, ícone dentro de círculo branco (~80 px), título serifado grande, descrição em duas linhas e botão arredondado (~250 × 56 px) com ícone e sombra. As dimensões são aproximações da imagem, não medições do CSS. A captura não distingue se o navegador recusou o pedido, se a permissão já estava bloqueada ou se faltava dispositivo; também não confirma que o botão obtém uma nova permissão sem alteração nas configurações.

Uma captura da aba **Modelos** mostra a área **Pré-visualização** de **Anamnese**, com botões **Duplicar** e **Ver detalhes**. Um aviso informa que o modelo padrão da Solara é aplicado automaticamente quando não existe modelo próprio para Anamnese. O cartão de prévia está em estado **Sem conteúdo** e orienta **Editar modelo**; apresenta chips de variáveis `@paciente.nome`, `@paciente.cpf`, `@medico.crm` e `@data.hoje`, além da indicação geral `@paciente`/`@medico`. A captura não mostra lista de modelos, formulário de edição nem o resultado de duplicar. Visualmente, a prévia usa papel branco, título serifado, regra horizontal preta e chips laranja/verde água por entidade.

Outra tela de **modelo padrão** mostra **Nome do modelo** obrigatório, com valor **Evolução (SOAP)**, e seletor **Categoria: Evolução**. O campo **Instruções ao modelo (opcional)** tem ação **Inserir variável** e editor com formatação básica. O texto visível orienta gerar evoluções de retorno/acompanhamento em formato SOAP, em português clínico formal e conciso, sem inventar informações, preservando medicamentos, doses e exames como mencionados. A prévia à direita mantém o mesmo exemplo de transcrição de dor lombar e o estado **Não salva**; não foi executada. O modelo padrão continua indicado como somente leitura, duplicável para personalização.

A continuação do prompt **Evolução (SOAP)** exige que **A — Avaliação** registre impressão clínica e ajustes possíveis de hipótese, evitando diagnóstico definitivo sem base; em **P — Plano**, pede separar conduta farmacológica, não farmacológica, exames e retorno. A saída deve ter **exatamente quatro cabeçalhos H2** em Markdown. Os três cabeçalhos legíveis na captura são:

```markdown
## S — Subjetivo
## O — Objetivo
## A — Avaliação
```

O quarto cabeçalho H2 e instruções abaixo dele não aparecem na captura; não fixar o texto exato do cabeçalho P antes de observá-lo. A exigência de quatro seções é uma instrução do prompt exibido, não uma saída verificada de geração.

A captura **Novo modelo** abre formulário com **Nome do modelo** obrigatório, **Categoria** selecionada em **Atestados**, campo **Conteúdo do modelo** em Markdown e rodapé **Cancelar / Criar modelo**. O exemplo no editor começa com `# Atestado Médico` e contém `## Identificação`, `## Recomendação` e `## Assinatura`. A tela lista variáveis automáticas de paciente, médico e data, além de placeholders manuais arbitrários como `@cid` e `@dias`; portanto, o motor de templates precisa descobrir esses campos e solicitá-los antes de renderizar. A validação nativa “Preencha este campo.” aparece no nome vazio; nenhum modelo foi criado na captura. A criação de Atestados parece usar conteúdo estático substituído por variáveis, enquanto Anamnese/Evolução exibem prompts de geração por IA; confirmar as outras categorias antes de assumir uma única forma de edição.

O seletor **Categoria** aberto na captura seguinte revela oito opções, na ordem: **Anamnese**, **Evolução**, **Atestados**, **Receitas**, **Laudos**, **Solicitações**, **Encaminhamentos**, **Outros**. Nesse instante, o campo exibe **Encaminhamentos**; o menu aberto por si só não mostra o conteúdo ou os controles que aparecem após confirmar essa escolha. Preservar os rótulos e a ordem na UI desktop e mobile, com navegação por teclado e rótulo acessível.

A captura de **Ajustes** mostra a aba ativa na navegação superior e um cartão central **Perfil**, com subtítulo “Informações básicas vinculadas à sua conta.” As linhas são **Nome completo** (campo preenchido), **E-mail** (apresentado como texto, sem caixa de edição visível), **CRM** (seletor `CRM/ UF` mais campo `Número do CRM`) e **Especialidade** (campo preenchido). Há **Salvar alterações** em âmbar claro no rodapé do cartão; a captura não comprova se o botão está desabilitado ou apenas usa cor mais clara. Nome e e-mail reais exibidos pelo usuário foram omitidos desta especificação. **R:** salvar mudanças de perfil com validação no servidor, controle de versão e revalidação do registro profissional após mudança de CRM/UF; mostrar estado de salvamento, sucesso e erro. A tela não comprova formato aceito, lista de UFs, comportamento de salvamento nem fluxo de alteração do e-mail.

A captura da aba **Pacientes** mostra layout desktop em três áreas: lista lateral esquerda (~425 px), ficha central flexível e resumo clínico lateral direito (~410 px). A lista tem título **Pacientes**, contadores **1 no total · 1 ativos**, botão escuro **+ Novo paciente**, busca **Nome ou CPF...**, seletor **Ordenar por / Mais recentes** e item selecionado com faixa âmbar. A ficha central traz breadcrumb **Pacientes > [identificação]**, avatar circular com inicial, identificação, linha **idade · sexo · dado adicional · Particular**, selo verde água com cadeado **LGPD · dados criptografados** e ações **Editar**, **Gerar laudo**, **+ Nova consulta**. Os valores identificadores vistos na conta foram omitidos. A idade aparece como `? anos`, evidência de que o nascimento/idade pode estar ausente; não preencher um valor artificial.

O seletor **Ordenar por** aberto apresenta, nessa ordem, **Mais recentes**, **Nome (A-Z)** e **Nº de consultas**; **Mais recentes** aparece como valor atual. A captura não mostra a lista após trocar a opção, nem explicita se **Nº de consultas** ordena em ordem crescente ou decrescente. **R:** a API aceita apenas chaves conhecidas, usa desempate estável por ID e conserva filtros/seleção quando a ordenação muda; não calcular contagens de consultas com uma subconsulta por paciente.

Ao acionar **Editar** na ficha, abre-se um painel branco rolável com cabeçalho fixo **Editar [identificação]**, avatar e subtítulo **“Alterações salvas ao confirmar.”**, botão de fechar, navegação por etapas numeradas **1 Cadastro**, **2 Contato**, **3 Clínico** (Cadastro ativa, sublinhado âmbar). A seção **Identificação** da primeira etapa contém **Nome completo*** com valor preenchido; **Idade*** com exemplo `45` em cinza claro; seletor **Sexo** exibindo **Feminino**; **Nascimento** com exemplo `03/07/1980` em cinza claro; **CPF** com máscara de exemplo `000.000.000-00`; **Convênio** exibindo **Particular**; e seção **Avatar** com sete amostras de cor (âmbar selecionado, verde água, roxo, rosa, coral, azul e ocre). Os textos cinza de idade, nascimento e CPF podem ser placeholders; a captura não demonstra que foram persistidos. Em particular, a ficha anterior exibia `? anos`.

Na segunda etapa, **Contato** ativa e sublinhada em âmbar, aparecem **Telefone** e **Email** lado a lado, **Endereço** e seletor **Estado civil** abaixo, seguidos da seção **Tags** com campo **Adicionar tag (ex: Idoso, Hipertenso)** e botão **Adicionar**. Telefone, e-mail e endereço exibem exemplos em cinza claro, sem prova de preenchimento salvo; o estado civil exibe `—`. Nenhum campo visível da etapa tem asterisco obrigatório. A captura não mostra as opções do estado civil, se tags adicionadas viram chips ou como são removidas. **R:** normalizar/validar telefone e e-mail, tratar endereço como texto pessoal, deduplicar tags por paciente e classificar tags clínicas como informação sensível. O texto do exemplo não deve criar diagnósticos automaticamente.

Na terceira etapa, **Clínico** ativa e sublinhada em âmbar, há seção **Alergias** com ícone de alerta vermelho, campo de busca com exemplos de substância e código (`Penicilina`, `Z88.0`, `dipirona`), botão **Adicionar** e ajuda **“Busque pelo nome ou código CID-10. Alergias aparecem em destaque vermelho no prontuário.”** Segue **Condições / Diagnósticos**, com campo de busca que exemplifica `Hipertensão`, `I10`, `diabetes`, botão **Adicionar** e a mesma orientação de busca por nome/código. **Medicações em uso** tem ícone de cápsula e botão de largura total, borda tracejada, **+ Adicionar medicação**. Os exemplos são placeholders, não diagnósticos, alergias ou medicações registrados para o paciente. Não foram vistos resultados da busca, formulários após adicionar, remoção, dose/posologia nem salvamento. **R:** distinguir termo livre de código selecionado, registrar versão/sistema da terminologia, confirmar clinicamente antes de marcar alergia ou diagnóstico, impedir duplicatas e exigir dados estruturados mínimos de medicação (nome, dose, via, frequência e estado quando informados), sem inventar o que estiver ausente.

O rodapé fixo mostra **Excluir paciente** com ícone de alerta, indicador verde água **Rascunho local**, **Cancelar** e **Salvar alterações** em âmbar claro em todas as três etapas vistas. O estado claro não confirma se salvar está desabilitado. **R:** manter rascunho entre etapas sem gravar no servidor antes de confirmação, esclarecer no produto se e por quanto tempo ele persiste no dispositivo, evitar armazenamento local não cifrado de dados clínicos, validar no servidor e pedir confirmação distinta antes de arquivar/excluir. Não foram vistos o menu de estado civil, resultados de adicionar tag/alergia/condição/medicação, a troca de avatar, o salvamento, a exclusão ou o descarte do rascunho ao cancelar.

No corpo da ficha, cartões exibem **PA** (mmHg; “última: ...”), **FC** (bpm; “em repouso”), **SpO₂** (%; “em ar ambiente”), **Peso** (kg; IMC) e **Visitas** (contagem; “desde [ano]”). Na captura, as quatro medidas estão vazias (travessão) e há uma visita. Abaixo, abas **Timeline**, **Documentos**, **Laudos** e **Medicações**; as três primeiras mostram contadores visíveis (`1` para Timeline, `0` para Documentos; o contador de Laudos não aparece claramente), e **Medicações** mostra `0`. A aba Timeline ativa usa sublinhado âmbar e contém ao menos um cartão **Primeira consulta**, com data. A coluna direita exibe títulos **Contato**, **Alergias**, **Condições** e **Medicações**; os três últimos dizem **Nenhuma registrada**. Isso indica ausência de registro, não ausência clínica comprovada. **R:** compor a ficha com consultas, documentos e observações sob autorização por clínica/paciente; carregar lista/timeline por cursor; preservar histórico e unidade de cada sinal vital; calcular IMC somente com altura e peso válidos; não inferir que o selo de criptografia comprova implementação real. Não foram testados busca efetiva, reordenação, salvamento da edição, novo paciente, geração de laudo, nova consulta ou troca de abas.

A tela **Ver detalhes** do **modelo padrão** informa explicitamente que modelos padrão são **somente leitura** e devem ser duplicados para personalização. O painel esquerdo contém instruções de geração em editor com barra de formatação e ação de inserir variável; o trecho visível pede linguagem clínica formal, em terceira pessoa, e proíbe inventar sintomas, antecedentes, medicamentos e alergias. A descrição chama **Claude** pelo nome, mas o provedor real da execução não foi verificado. Há indicação de que deixar o campo em branco usa o prompt padrão de anamnese, além de **Configuração avançada** recolhida. O painel direito **Prévia ao vivo** indica **Não salva**, oferece **Gerar prévia** e **Ver transcrição usada** e informa que usa transcrição de exemplo de dor lombar. O estado visto pede clicar em **Gerar prévia**; texto de ajuda afirma que nada é salvo até **Salvar alterações**. A captura mostra botão **Fechar**. Nenhuma geração de prévia nem salvamento foi executado.

Com **Configuração avançada** expandida, vê-se **Formato da pergunta (opcional)**, em caixa de texto separada. O formato mostrado insere contexto prévio informado pelo médico em `{patient_context}`, transcrição em `{transcript}` e então pede anamnese completa em Markdown segundo a estrutura definida no prompt de regras. A ajuda diz que o campo controla como a transcrição é inserida na pergunta ao Claude e que, se vazio, usa o formato padrão. **R:** validar apenas placeholders permitidos, exigir `{transcript}` ou uma justificativa explícita, limitar tamanho, delimitar o conteúdo inserido como dados não confiáveis, registrar versões sem registrar PHI no log e impedir que uma instrução na transcrição substitua as regras clínicas. Não executar templates como código nem interpolar variáveis com avaliação dinâmica.

**Contrato de saída instruído pelo prompt padrão (S):** o texto visível orienta preservar nomes, doses e posologias de medicamentos como ditos; apresentar hipóteses com justificativa breve quando houver elementos; não afirmar diagnóstico definitivo sem suporte; usar CID-10 apenas quando citado pelo médico ou inequívoco na transcrição; emitir Markdown com estes cabeçalhos H2, nesta ordem:

```markdown
## Queixa Principal
## História da Doença Atual
## Medicações em Uso
## Antecedentes Pessoais
## Antecedentes Familiares
## Hábitos e Estilo de Vida
## Alergias
## Revisão de Sistemas
## Exame Físico
## Hipótese Diagnóstica
## Conduta
```

O prompt pede parágrafo conciso em cada seção, exceto **Medicações em Uso**, que deve ser lista Markdown com um item por linha no formato `Nome — dose — desde quando`, omitindo partes não informadas. Para seção sem dados, instrui escrever **“Não referido na consulta.”** Isso é especificação do texto exibido no editor, não resultado de geração testada. O resumo da tela de Nova consulta menciona “HPMA”, enquanto o prompt usa “História da Doença Atual”; confirmar com revisão clínica se representam o mesmo campo antes de codificar mapeamentos.

**Hierarquia visual observada:** fundo creme, barra superior bege claro com linha divisória sutil, cartões brancos com borda fina e cantos arredondados, títulos numéricos em serifada de alto contraste, rótulos em sans uppercase espaçado, CTAs âmbar e indicador/links em verde água. Na captura desktop completa (~1871 px), o conteúdo fica centralizado em largura máxima próxima de 1544 px; quatro cartões ocupam colunas iguais com intervalo visual próximo de 24 px. A lista recente usa barra de filtros em formato pílula e tabela branca arredondada. Essas medidas são aproximações de imagem, não tokens CSS comprovados. A reprodução pixel a pixel requer captura em 375/768/1440 px e acesso ao CSS da área autenticada.

**Observado no CSS público da página de login (O):** Geist Sans para interface, Instrument Serif para realces, Geist Mono para dados técnicos; fundo claro `hsl(36 45% 97%)` (aprox. `#FBF8F3`), tinta `#1A1614`, âmbar `#FF9F1C`, mel `#FFBF69`, verde água `#2EC4B6`, gelo `#CBF3F0`, branco `#FFFFFF`. Raios `8/12/16px`; formulário de login com entradas de 44 px, botão de 52 px e divisão em duas colunas a partir de `md` (Tailwind 768 px). O login anuncia gravações de até 90 minutos, pausa e retomada. Essas medidas não definem as telas protegidas.

```css
:root {
  --brand-amber:#ff9f1c; --brand-honey:#ffbf69; --brand-sea:#2ec4b6;
  --brand-frozen:#cbf3f0; --brand-canvas:#fbf8f3; --brand-ink:#1a1614;
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
  --space-6:24px; --space-8:32px; --space-12:48px;
}
```

**Responsividade (R):** 320–767 px: coluna única, navegação compacta e CTA fixo sem esconder consentimento; 768–1023 px: tablet com dois painéis quando couber; ≥1024 px: sidebar e painel de consulta com contexto, editor e ações. Alvos ≥44 px, foco visível, contraste WCAG AA, redução de movimento, estados de carregamento/erro/vazio, leitura por teclado e leitor de tela. Não inferir paleta interna a partir da base local: `tokens.ts` e `globals.css` locais divergem entre si e do CSS publicado.

**Componentes:** `AppShell`, `Sidebar`, `TopBar`, `ProfessionCard`, `AuthForm`, `PatientSearch`, `PatientCard`, `AppointmentCalendar`, `ConsentDialog`, `RecordingControls`, `SyncStatus`, `TranscriptTimeline`, `SpeakerBadge`, `ClinicalEditor`, `EvidenceLink`, `SuggestionCard`, `TemplatePicker`, `DocumentPreview`, `SignatureDialog`, `DeliveryDialog`, `AuditTimeline`, `ConfirmDialog`, `Toast`, `ErrorBoundary`, `EmptyState`, `Skeleton`, `Pagination` e campos acessíveis base. Centralizar tokens; documentar variantes e estados no Storybook ou equivalente. Editor separa texto ditado, inferência da IA e alterações do médico; evidência abre trecho temporal sem expor áudio a outro paciente.

## 6. Segurança, conformidade e governança

Dados de saúde são sensíveis segundo a [ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes). Definir controlador/operador, finalidade, hipótese legal, contratos com processadores, duração de retenção e RIPD com assessoria jurídica. Consentimento para gravar deve ser específico e rastreável; não presumir que consentimento seja a única base legal para todo tratamento clínico. Marketing sobre “E2E”, residência brasileira, ISO/SOC 2 e conformidade integral deve ser verificado por evidência contratual e auditoria antes de ser repetido como fato.

- **Identidade:** para maior fidelidade e velocidade, usar Supabase Auth com sessão web em cookies Secure/HttpOnly/SameSite mediada por BFF/SSR, ou justificar a alternativa em ADR. O backend clínico verifica usuário/sessão em operações sensíveis; MFA para administradores e assinatura, proteção contra enumeração e brute force. Quando JWT for usado, validar audiência, emissor, prazo, assinatura e rotação de chaves; revogação e frescor de permissões não dependem apenas de claims antigas. Metadados enviados pelo usuário no `signUp` jamais autorizam acesso ou assinatura.
- **Autorização:** RBAC por clínica mais verificação de relação com paciente/encontro em toda query e URL de objeto; RLS no Postgres como segunda barreira. A função `assistant` não pode ler nota clínica sem concessão explícita. Testar IDOR entre clínicas.
- **Proteção técnica:** TLS em trânsito, KMS/envelope encryption em repouso, chaves separadas por ambiente, rotação, hashes Argon2id para senha, CSP, CSRF, validação de conteúdo e tamanho, ORM parametrizado, sanitização de HTML, antivírus em anexos, SSRF bloqueado em importadores, URLs assinadas curtas, cabeçalhos seguros, limites de taxa por IP/usuário/clínica, WAF e dependências verificadas.
- **IA clínica:** dados mínimos ao provedor; contrato de processamento e retenção; prompts e ferramentas tratados como entrada não confiável; jamais executar instruções vindas de transcrição/anexo; saída validada por esquema, cite fonte verificável quando aplicável e sempre exige revisão humana. Não gerar prescrição, diagnóstico ou assinatura final sem ação profissional explícita.
- **Assinatura:** integrar provedor e política aplicável; preservar PDF final, hash, cadeia de certificado, horário e validação. O [ITI](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital) descreve o certificado ICP-Brasil; a conformidade do documento clínico específico deve ser validada para cada tipo documental.
- **Auditoria:** registrar acesso, edição, exportação, assinatura, permissão e descarte com `request_id`; trilha append-only, sem conteúdo clínico em logs. Monitorar acesso anômalo e testar resposta a incidente. Backups cifrados, segregados e com restauração ensaiada.
- **Retenção:** configurar por categoria legal/contratual; áudio temporário com comprovante de descarte; documentos clínicos e logs seguem prazo validado juridicamente. Revogação do consentimento de gravação impede nova captura, mas não destrói automaticamente o prontuário necessário.

**Riscos específicos da base local (L):** `backend/app/main.py` monta rotas sem middleware de autenticação; `repositorio.py` não modela clínica/usuário em pacientes e prontuários; `docker-compose.yml` usa credenciais padrão de desenvolvimento; a UI local e tokens CSS divergem. Não expor essa base à Internet até fechar esses pontos.

## 7. Stack e decisões de implementação

**Aproveitar a base local:** Next.js/React/TypeScript/Tailwind para UI; Supabase Auth para reproduzir a entrada observada no bundle público; FastAPI/Python/Pydantic/SQLAlchemy para API e motores clínicos; PostgreSQL com pgvector se houver RAG; Redis; storage S3 compatível; RabbitMQ para jobs; Docker Compose em desenvolvimento; Terraform e serviço de contêineres gerenciado em produção. Preferir migrações Alembic versionadas em lugar de `CREATE TABLE IF NOT EXISTS` no startup. TypeScript e Python permanecem com contratos OpenAPI gerados e testes de compatibilidade. Prisma não deve ser acrescentado apenas por moda, pois o backend existente já usa SQLAlchemy. Provedor de STT/LLM, assinatura e pagamento ficam atrás de interfaces trocáveis e contrato de processamento aprovado. Se usar Supabase Data API, habilitar RLS e políticas específicas para toda tabela exposta; não expor chave de serviço no cliente.

**Critérios de escala:** começar com um Postgres primário e workers horizontais; adicionar réplica quando leituras comprovadamente pressionarem o primário. Não criar Kafka/MongoDB/microserviços sem evidência operacional. Separar transcrição como serviço dedicado quando uso de GPU, compliance ou throughput justificarem.

## 8. Execução módulo por módulo para a IA programadora

**Diretriz inicial:** trabalhar em `solara-medconsult/`. Primeiro inventariar rotas, testes e configurações existentes; criar ADR de divergências entre `docs/fluxo-aprovado.md` e a interface publicada. Entregar um módulo por PR pequeno, com migração, contrato OpenAPI, UI, teste de autorização/concorrência e nota de operação quando aplicável. Não usar paciente real, não acessar área protegida por meios não autorizados, não afirmar equivalência com recursos não observados. Priorizar requisitos **R** como produto a construir, não como descrição da Solara publicada.

| Ordem | Entrega concreta | Condição de aceite |
|---|---|---|
| 0 | Baseline: build/testes, migrações Alembic, ambientes, CI, inventário de lacunas e ADR | `frontend` compila; API sobe com dependências locais; testes existentes passam ou falhas são registradas. |
| 1 | Identidade, clínica, membro, perfil profissional, sessão, CSRF e RBAC | Login/logout/expiração; usuário de clínica A nunca lê dados da B; rotas clínicas rejeitam anônimo. |
| 2 | Pacientes e consentimento | CRUD, busca paginada, índices, termo versionado, auditoria e revogação; testes de concorrência e duplicação. |
| 3 | Encontro e rascunho | Máquina de estados, retorno, salvamento otimista e restauração; documento anterior imutável. |
| 4 | Captura e sincronização | Gravação com pausa, chunks e checksums, retomada, fila e descarte; falha de rede não perde rascunho. |
| 5 | Transcrição e IA | Workers, segmentos temporais, esquema validado, fonte/modelo, revisão humana, retry e limites. |
| 6 | Modelos e documentos | Anamnese/evolução primeiro; depois receita/atestado/encaminhamento/laudo conforme validação clínica; PDF versionado. |
| 7 | Teleconsulta | Seleção do paciente e documento, sala, convite sem conta, mídia protegida, consentimento remoto, estados de entrada/saída, captura/transcrição e revogação de link; teste de acesso entre clínicas e convidado. |
| 8 | Assinatura e entrega | Integração em sandbox, prova criptográfica, envio opt-in e auditoria; nunca enviar rascunho. |
| 9 | Agenda e notificações | Conflito transacional, remarcação, lembrete deduplicado e opt-out. |
| 10 | Cobrança, exportação, gestão | Webhooks verificados, estados de plano, exportação auditada, indicadores sem PHI. |
| 11 | Hardening e produção | Pentest, revisão clínica, carga, restauração, observabilidade, plano de incidente e release gradual. |

**Primeira tarefa de programação:** criar migração `clinics/users/memberships/professional_profiles`, serviço de sessão, dependência FastAPI `require_membership`, proteção de uma rota de pacientes e teste de isolamento A/B. Depois conectar a tela de login existente ou criar a correspondente ao CSS observado. Entregar evidência de `401`, `403` e acesso autorizado, sem depender de credenciais reais.

**Gates antes de produção:** revisão de escopo com conta de teste autorizada; validação clínica dos modelos e limites de IA; avaliação jurídica da retenção, consentimento e assinatura; DAST/SAST e teste de isolamento; ensaio de restore; métricas e alertas; rollback; comparação visual em 375/768/1440 px. Registrar requisitos não comprovados como pendências, sem substituí-los por alegações de implementação.

## 9. Fontes e rastreabilidade

- [Aplicativo Solara](https://solara.doctor/app), [login](https://solara.doctor/login), [onboarding](https://solara.doctor/onboarding), [site público](https://solara.doctor/) e [relatório técnico do rastreamento](docs/solara-public-crawl.md), consultados/produzido em 22/10/2026. O CSS público da página de login fundamenta tokens e medidas ali citados; bundles públicos fundamentam os achados de autenticação/onboarding. Capturas autenticadas fornecidas pelo usuário fundamentam os estados descritos de Consultas, Modelos, Ajustes, Pacientes, Agenda e Nova teleconsulta; não revelam contratos reais do backend ou infraestrutura interna.
- Código local: `solara-medconsult/backend/app/main.py`, `backend/app/repositorio.py`, `frontend/src/app/`, `frontend/src/styles/tokens.ts`, `frontend/src/app/globals.css`, `docker-compose.yml` e docs referidos na seção 0.
- [ANPD — perguntas frequentes sobre LGPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes); [ITI — certificação digital ICP-Brasil](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital).
