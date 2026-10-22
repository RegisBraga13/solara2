# Especificação Técnica de Reconstrução: escriba clínico por IA

**Referência analisada:** https://solara.doctor (produto "Solara Health")
**Data da coleta:** 2026-10-22
**Codinome do projeto novo:** `escriba` (troque pelo nome definitivo antes do lançamento)

> **Limite de reprodução.** Esta especificação reproduz *comportamento e capacidades*, não ativos de terceiros.
> Não reutilize o nome "Solara", o logotipo, os textos de marketing, os depoimentos, os números de uso
> ("8.400+ médicos", "2,4M consultas"), os logos de hospitais nem o conteúdo das ~370 páginas de `/recursos`.
> Selos de conformidade (ISO 27001, SOC 2, SBIS-NGS2) só podem ser exibidos depois de obtidos pelo projeto novo.


## Sumário

0. [Método, evidências e grau de certeza](#0-método-evidências-e-grau-de-certeza)
1. [Engenharia reversa de escopo e funcionalidades](#1-engenharia-reversa-de-escopo-e-funcionalidades)
2. [Design de sistema e arquitetura](#2-design-de-sistema-e-arquitetura)
3. [Modelagem de dados](#3-modelagem-de-dados)
4. [Arquitetura de API e contratos](#4-arquitetura-de-api-e-contratos)
5. [Frontend e identidade visual](#5-frontend-e-identidade-visual)
6. [Segurança e stack](#6-segurança-e-stack)
7. [Decisões em aberto](#7-decisões-em-aberto-bloqueiam-ou-mudam-a-implementação)
8. [Ordem de construção](#8-ordem-de-construção)

---

## 0. Método, evidências e grau de certeza

### 0.1 Fontes usadas

- Página pública `/`, `/recursos` e um artigo de `/recursos/*`.
- `robots.txt`, `sitemap.xml`, `/manifest.webmanifest`, `/sw.js`.
- CSS e JS públicos em `/_next/static/*` e cabeçalhos HTTP.

- **App logado (`/app`), em 2026-10-22**, com a conta de teste do usuário e autorização dele: navegação só de leitura (telas, menus, diálogos, formulários abertos e fechados sem salvar) e uma prévia de modelo que a própria tela declara não salvar. Detalhes na seção 0.4.

**Não visto:** a tela de gravação em andamento e a do documento gerado (exigem gravar com microfone), além de `/pair/*`, `/record/*`, `/m/*` e `/onboarding`. O que se refere a elas continua **inferido**.

Legenda usada no documento:

| Marca | Significado |
|---|---|
| **[O]** | Observado diretamente (código, cabeçalho, texto público ou tela do app logado) |
| **[I]** | Inferido do comportamento anunciado; precisa ser confirmado por uso real do produto |
| **[R]** | Recomendação de projeto para a reconstrução |

### 0.2 Fatos observados

| Item | Evidência | Marca |
|---|---|---|
| Frontend em Next.js com App Router | chunks `/_next/static/chunks/app/*`, `main-app-*.js` | [O] |
| Hospedagem Vercel, borda em São Paulo | `Server: Vercel`, `X-Vercel-Id: gru1::…`, parâmetro `?dpl=` | [O] |
| HSTS de 2 anos | `Strict-Transport-Security: max-age=63072000` | [O] |
| Tailwind CSS + tokens no padrão shadcn/ui | variáveis `--background`, `--primary`, `--card`, `--ring` em HSL; `--radius` | [O] |
| Fontes Geist Sans, Geist Mono e Instrument Serif | classes `next/font` `__GeistSans_*`, `__GeistMono_*`, `__Instrument_Serif_*` | [O] |
| Tema claro e escuro | seletor `[data-theme=dark]` | [O] |
| Toasts com `sonner` | classes `sonner-*` | [O] |
| PWA: `start_url: /app`, `display: standalone`, `orientation: portrait`, cor `#F2EADD` | `/manifest.webmanifest` | [O] |
| Service worker sem cache (só habilita instalação) | `/sw.js`: handler `fetch` vazio | [O] |
| GA4 (`gtag`) e Microsoft Clarity; Clarity só liga em `/` e `/recursos/*` | bundle `layout-*.js` | [O] |
| Rotas privadas | `robots.txt`: `/api/`, `/app/`, `/pair/`, `/record/`, `/m/`, `/login`, `/signup`, `/onboarding` | [O] |
| Conteúdo SEO: ~370 páginas em `/recursos` (modelos de documentos e guias) | `sitemap.xml` | [O] |
| Planos: teste de 7 dias sem cartão; Profissional R$ 249/mês por usuário (R$ 233/mês no anual); Clínica a partir de 5 médicos, sob consulta | home | [O] |
| Status de lançamento: "Agenda inteligente disponível em maio"; Receita, Atestado e Encaminhamento marcados "Em breve" em uma das abas | home | [O] |
| Organização: Solara Health Tecnologia Ltda., São Paulo/SP | JSON-LD `Organization` | [O] |
| O app é um Next.js full-stack: as telas vêm como React Server Components (`?_rsc=`), sem API REST de dados no navegador | rede do `/app` | [O] |
| Rota de API própria em `/api/*` com streaming: `POST /api/templates/preview` (JSON) responde `text/event-stream` | rede do `/app` | [O] |
| O LLM é o **Claude** (Anthropic): "Defina como o Claude deve redigir a partir da transcrição da consulta" | editor de modelo | [O] |
| GA4, Google Ads (remarketing e conversão) e DoubleClick carregam **dentro do `/app`** | rede do `/app` | [O] |

### 0.3 Contradições no material público (viram regras de projeto)

O marketing do produto de referência faz promessas que conflitam entre si ou com a lei. A reconstrução deve
resolvê-las de propósito, não copiar a promessa:

| # | Promessa | Conflito | Decisão para o projeto novo [R] |
|---|---|---|---|
| C1 | "Funciona offline" | O service worker não faz cache algum | Offline é responsabilidade da aplicação: gravação em IndexedDB e fila de envio (módulo M07) |
| C2 | "Áudio descartado após gerar o documento" e "cada frase tem rastreabilidade da gravação original" | Sem áudio não há como voltar à gravação | A rastreabilidade aponta para **segmentos da transcrição** (texto + tempo), que ficam guardados; o áudio segue a política de retenção |
| C3 | "Dados nunca saem do território nacional" | Provedores de transcrição e LLM costumam processar fora do Brasil | Escolher provedores com processamento em `sa-east-1`, ou declarar transferência internacional (LGPD art. 33) com contrato. **Decisão bloqueante** |
| C4 | "Eliminamos seu histórico em 30 dias" | Prontuário deve ser guardado por no mínimo 20 anos (Lei 13.787/2018) | Exclusão só depois de exportação e transferência formal da guarda ao médico ou à clínica, com termo assinado |
| C5 | "Criptografia ponta-a-ponta" | O servidor precisa ler o texto para gerar documentos | Não anunciar E2E. Usar TLS 1.3 em trânsito, AES-256 com KMS em repouso e cifragem por campo nos identificadores |
| C6 | Anual "-2 meses" | R$ 233 × 12 = R$ 2.796 (desconto de ~6%), e não 2 meses grátis (R$ 2.490) | Definir o preço anual de forma coerente |
| C7 | Copilot "referenciado com UpToDate, BMJ" | Exige licença comercial dessas bases | Usar apenas fontes licenciadas ou abertas (diretrizes de sociedades brasileiras, PCDT do Ministério da Saúde, bulas da ANVISA) |
| C8 | Site anuncia Copilot, assinatura ICP-Brasil, receita, atestado, encaminhamento, WhatsApp, insights, plano Clínica | O app observado tem 5 áreas (Consultas, Agenda, Pacientes, Modelos, Ajustes). Nenhuma tela de Copilot, assinatura digital, cobrança, equipe, insights ou envio. Receita, atestado e encaminhamento existem só como **categorias de modelo** | O escopo real do produto hoje é o escriba (anamnese e evolução) + agenda + pacientes + modelos. Os demais módulos são roadmap: construir depois do MVP (ver ordem no `instructions.md`) |
| C9 | "LGPD não é checkbox", "dados criptografados" | Rastreadores de anúncio do Google rodam nas telas com dados de pacientes; a URL da página vai para o Google | **Proibido** qualquer analytics de terceiros ou pixel de anúncio em `/app`, `/pair`, `/record` e `/m` (teste automatizado no M21) |
| C10 | Site: "áudio descartado após gerar o documento". App: "o áudio original é apagado imediatamente após a transcrição" | Duas promessas diferentes | Padrão do projeto: apagar o áudio quando a transcrição final estiver gravada (RN-17), com opção de reter por até 30 dias |

### 0.4 Observado no app logado (2026-10-22)

Conta de teste vazia (plano de teste, especialidade Clínica Médica). Tudo nesta seção é **[O]**.

#### Navegação

Barra superior fixa (não há barra lateral global):

- logotipo;
- abas **Consultas** (`/app`), **Agenda**, **Pacientes**, **Modelos** e **Ajustes**;
- botão âmbar "+ Nova consulta";
- sino de notificações;
- avatar com iniciais.

Títulos de página em serifa (Instrument Serif), com a palavra de destaque em itálico âmbar: "Bom dia, *Dr. Francisco*", "Nova *consulta*", "Novo *paciente*", "Editar *modelo*".

#### Rotas observadas

| Rota | Tela |
|---|---|
| `/app` | Consultas (início) |
| `/app/agenda` | Agenda |
| `/app/pacientes` | Pacientes em mestre-detalhe (lista à esquerda, ficha ao centro, resumo clínico à direita) |
| `/app/modelos` | Modelos em mestre-detalhe |
| `/app/ajustes` | Ajustes (só perfil) |
| `/app/consulta/nova` (aceita `?patient_id=`) | Configurar a consulta |
| `/app/consulta/gravando?id={uuid}` | Gravação (pede o microfone: "Nada é gravado até você começar") |
| `/app/consulta/{uuid}` | Consulta (documento) |

#### Consultas (`/app`)

- Saudação com data e frase de contexto ("nenhuma consulta agendada hoje" ou "Você tem 1 consulta agendada hoje").
- 4 cartões de indicador: **Hoje** ("próxima às 11:25"), **Esta semana**, **Tempo economizado** ("em documentação"), **Duração média** ("por consulta").
- Faixa "Pronta para a próxima consulta?" com botão escuro **Iniciar consulta ▾**, cujo menu oferece **Presencial** e **Teleconsulta**. Texto: "O áudio é apagado imediatamente após a transcrição."
- "Consultas recentes":
  - busca "Buscar por paciente…";
  - filtros em pílula com contagem: Todas, Primeira consulta, Evolução;
  - tabela com colunas Paciente, Queixa, Documento e Data;
  - status por linha (ex.: "Em gravação");
  - estado vazio "Você ainda não gravou nenhuma consulta".

#### Nova consulta (`/app/consulta/nova`)

- Subtítulo: "Comece a gravar agora. Você atribui o paciente depois, direto na tela do documento." **O paciente é opcional para começar.**
- Cartão **Paciente**:
  - nome;
  - idade (número);
  - sexo (Feminino, Masculino, Outro);
  - caixa "Salvar como novo paciente", marcada por padrão: "A ficha é criada junto com a consulta".
- Cartão **Tipo de documento**:
  - **Primeira consulta**: "HPMA, revisão de sistemas, antecedentes, hipótese diagnóstica e conduta";
  - **Evolução**: "SOAP".
- Coluna **Resumo**: paciente, idade/sexo, documento, "Duração estimada 30–60 min" e selo "NOVO CADASTRO".
- Aviso verde: "Áudio não é armazenado."
- Botão "Iniciar gravação →" leva a `/app/consulta/gravando?id=`.

#### Agenda (`/app/agenda`)

- Coluna esquerda:
  - "Agenda · Dr(a). Nome";
  - botão Nova consulta;
  - minicalendário;
  - filtros com contagem e cor:
    - **Tipo:** Primeira consulta (âmbar), Retorno (verde-água), Teleconsulta (roxo), Procedimento (vermelho), Bloqueio/Pausa (cinza), Reunião interna (preto);
    - **Status:** Confirmada, Pendente, Realizada, No-show;
  - resumo "Esta semana".
- Área principal:
  - título do mês e intervalo ("18 – 24 Out");
  - botões Hoje e setas;
  - visões **Dia, Semana, Mês e Lista**;
  - grade das 07:00 às 19:00 com linha da hora atual;
  - botão "+ Nova".
- Diálogo **Nova consulta** (agendamento):

  | Campo | Valores |
  |---|---|
  | Tipo | Os 6 acima, em cartões |
  | Paciente | Obrigatório, com busca |
  | Data e Horário | Padrão: agora |
  | Duração | 20 min, 40 min, 1 h, 1 h 30, 2 h |
  | Local | Consultório 1, Consultório 2, Sala de procedimentos, Sala de reuniões, Online (teleconsulta) |
  | Status | Confirmada, Pendente, Realizada, No-show |
  | Observações | Texto livre |

  Botões: Cancelar e Criar consulta (desabilitado até escolher o paciente).

#### Pacientes (`/app/pacientes`)

- **Lista:**
  - total e ativos;
  - "+ Novo paciente";
  - busca "Nome ou CPF…";
  - ordenação: Mais recentes, Nome (A-Z), Nº de consultas.
- **Novo paciente** (gaveta lateral em 3 passos: Cadastro, Contato, Clínico; indicador "Rascunho local"):
  - nome completo (obrigatório);
  - **idade (obrigatória)**;
  - sexo;
  - nascimento (opcional);
  - CPF;
  - convênio: Particular, Unimed, Bradesco Saúde, SulAmérica, Amil, Porto Seguro, NotreDame Intermédica, Hapvida, SUS;
  - cor do avatar: 7 opções.
- **Ficha:**
  - cabeçalho com avatar, nome, idade, sexo e convênio;
  - selo "LGPD · dados criptografados";
  - botões Editar, **Gerar laudo** e Nova consulta;
  - cartões de sinais vitais com a data da última medida: **PA** (mmHg), **FC** (bpm, "em repouso"), **SpO₂** (%, "em ar ambiente"), **Peso** (kg, com IMC);
  - cartão **Visitas** ("desde 2026");
  - abas **Timeline**, **Documentos**, **Laudos** e **Medicações**;
  - coluna direita: Contato, Alergias, Condições e Medicações ("Nenhuma registrada").

#### Modelos (`/app/modelos`)

- **Lista agrupada por categoria**, com busca e botão "+". Cada modelo tem um selo:
  - **PADRÃO**: modelo da plataforma, só leitura, com Duplicar e Ver detalhes;
  - **EM USO**: modelo do médico definido como padrão da categoria. Ações: Remover como padrão, Duplicar, Editar modelo.

  A conta nova já vem com "Anamnese — Clínica Médica" e "Evolução — Clínica Médica" criados a partir da especialidade do cadastro.
- **Categorias:** Anamnese, Evolução, Atestados, Receitas, Laudos, Solicitações, Encaminhamentos, Outros.
- **Pré-visualização do corpo do modelo**, com variáveis: `@paciente.nome`, `@paciente.cpf`, `@medico.nome`, `@medico.crm`, `@data.hoje` e, nos exemplos de atestado, `@dias` e `@cid`. O exemplo do novo modelo é um atestado em Markdown com essas variáveis.
- **Editor de modelo** (gaveta larga em duas colunas):
  - coluna esquerda:
    - nome (obrigatório);
    - categoria;
    - **"Instruções ao modelo (opcional)"**: o prompt de sistema enviado ao Claude, num editor com negrito, itálico, lista, linha e "Inserir variável". Em branco, usa o prompt padrão da categoria;
    - **"Configuração avançada" → "Formato da pergunta (opcional)"**: modelo da mensagem do usuário, com os marcadores `{patient_context}` e `{transcript}`;
  - coluna direita, **"Prévia ao vivo · Não salva"**:
    - botão Gerar prévia, que vira "Regenerar";
    - transcrição de exemplo fixa (dor lombar);
    - resultado em streaming via `POST /api/templates/preview`;
  - rodapé: Excluir modelo, Cancelar, Salvar alterações.
- **Como o prompt padrão de Clínica Médica funciona** (resumo, sem copiar o texto):
  - redação em 3ª pessoa, só com dados da transcrição e do contexto do paciente;
  - informação ausente vira "Não referido na consulta.";
  - medicamentos e doses preservados literalmente;
  - hipóteses com justificativa e sem diagnóstico definitivo; CID-10 só quando explícito;
  - saída **em Markdown** com 12 seções H2 fixas: Identificação, Queixa Principal, História da Doença Atual, Medicações em Uso, Antecedentes Pessoais, Antecedentes Familiares, Hábitos e Estilo de Vida, Alergias, Revisão de Sistemas, Exame Físico, Hipótese Diagnóstica, Conduta;
  - um bloco de ênfases por especialidade.
- **Saída observada na prévia:** Markdown com as 12 seções. Seções sem dado saem como "Não referido na consulta."; o exame físico traz só o que foi dito ("Lasègue à direita positivo a 60 graus").

#### Gravação (`/app/consulta/gravando?id=`)

- **Tela cheia, sem a barra de navegação:**
  - só o logotipo à esquerda e uma pílula de status à direita ("Solicitando microfone…");
  - fundo em degradê suave do âmbar claro ao verde-água claro.
- **Antes de liberar o microfone:**
  - ícone de carregamento;
  - título "Preparando o microfone";
  - texto "Aceite a solicitação de acesso ao microfone no seu navegador. Nada é gravado até você começar."
- **Ao abrir a consulta pela lista**, `/app/consulta/{uuid}` redireciona para esta tela enquanto a gravação não termina.
- **O usuário confirmou que o resultado do produto é só a história clínica** (anamnese na primeira consulta, evolução no retorno). Não há outro documento gerado a partir da gravação.

#### Ajustes (`/app/ajustes`)

Só o cartão **Perfil**: nome completo, e-mail (somente leitura), CRM (UF + número) e especialidade (texto), com o botão "Salvar alterações". Não há plano, cobrança, equipe, assinatura digital, retenção, exportação nem segurança.

#### O que isso muda no projeto [R]

1. **Contrato de saída:** o original gera Markdown livre com cabeçalhos fixos. O projeto novo mantém a saída **estruturada** (seção 4.5, com `PRESENT/INFERRED/MISSING` e evidência), porque texto livre não serve de contrato para efeitos automáticos (sugestões para a ficha, CID, receita). O documento renderizado ao médico pode ter as mesmas 12 seções.
2. **Modelos = prompt + formato + corpo com variáveis.** A definição do modelo (tabela `template_versions`) passa a ter:
   - `systemInstructions` (texto do médico, opcional);
   - `userPromptFormat` (com `{patient_context}` e `{transcript}`, opcional);
   - `body` (Markdown com `@variáveis`, para documentos sem IA como o atestado);
   - `sections` (para validação).

   As instruções do médico entram **dentro** de um prompt de sistema fixo da plataforma, que mantém as regras de segurança (não inventar, evidência, formato). O médico nunca as remove.
3. **Paciente opcional no início da gravação:** `encounters.patient_id` aceita nulo até o paciente ser atribuído na tela do documento. A assinatura e o envio exigem o paciente.
4. **Idade sem data de nascimento:** `patients.birth_date` aceita nulo e existe `age_years_at_registration`. A idade exibida vem do nascimento quando houver.
5. **Sinais vitais incluem SpO₂;** ficha com abas Timeline, Documentos, Laudos e Medicações, e "Gerar laudo" a partir da ficha.
6. **Agenda:** os 6 tipos, os locais e as durações acima entram como dados configuráveis por organização.

---

## 1. Engenharia reversa de escopo e funcionalidades

### 1.1 Mapa de módulos

| Código | Módulo | Responsabilidade | Status no original (site × app observado) |
|---|---|---|---|
| M01 | Identidade e acesso | Cadastro, login, verificação de e-mail, MFA, sessão, recuperação de senha | [O] login existe; telas não vistas |
| M02 | Onboarding e perfil profissional | CRM + UF, RQE, especialidade, modelos padrão, importação de pacientes por CSV | [O] perfil com CRM/UF e especialidade; modelos criados pela especialidade |
| M03 | Organizações, equipes e permissões | Conta individual × clínica, convites, papéis, permissões granulares | Só no site (plano Clínica); ausente no app |
| M04 | Pacientes e ficha clínica | Cadastro, linha do tempo, medicações, alergias, sinais vitais com gráficos, importação de exames em PDF | [O] no app (lista, ficha, sinais vitais, abas) |
| M05 | Consentimento | Termo digital assinado pelo paciente no celular; revogação a qualquer momento | Só no site (FAQ); não visto no app |
| M06 | Consultas (encounters) | Sessão clínica: paciente, tipo de documento, modelo, contexto, estados | [O] no app (paciente opcional) |
| M07 | Captura de áudio | Gravação no navegador, pausa e retomada, offline com sincronização | [O] no app (tela de microfone) |
| M08 | Celular como microfone | Pareamento por QR + código de 4 dígitos, sem login no celular | Só no site; não visto no app |
| M09 | Transcrição e diarização | Streaming pt-BR médico, identifica médico × paciente, ignora ruído | [I] não visto (exige gravação) |
| M10 | Geração e revisão de documentos | 6 tipos: anamnese, evolução, receita, atestado, encaminhamento, laudo; editor com sugestões e rastreabilidade | [O] prévia de anamnese; tela do documento não vista |
| M11 | Modelos e aprendizado de estilo | Modelos por especialidade, seções, tom, nível de detalhe; aprende com as edições | [O] no app (editor com prompt e prévia) |
| M12 | Assinatura, PDF e envio | ICP-Brasil em 1 clique; PDF; WhatsApp e e-mail | Só no site; ausente no app |
| M13 | Receituário | Detecção de medicamentos, posologia padrão, receita simples e de controle especial, interações | Só como categoria de modelo |
| M14 | Copilot clínico | Chat com contexto da consulta: sinais de alerta, diagnóstico diferencial, interações, orientações de alta, com citações | Só no site; ausente no app |
| M15 | Agenda inteligente | Dia, semana, mês e lista; detecção de conflito; arrastar para remarcar; lembretes WhatsApp | [O] no app (sem lembretes visíveis) |
| M16 | Insights e relatórios | Produtividade, taxa de retorno, no-show, tempo médio; exportação PDF e CSV | Parcial: 4 indicadores na tela inicial |
| M17 | Assinaturas e faturamento | Teste grátis, planos mensal e anual, assentos, inadimplência | Só no site; ausente no app |
| M18 | Interoperabilidade e portabilidade | API, exportação FHIR, HL7 e PDF estruturado; exportação total; exclusão | Só no site (FAQ); ausente no app |
| M19 | Auditoria, LGPD e observabilidade | Log de acessos e edições exportável; telemetria das decisões de IA | Selo "LGPD · dados criptografados"; auditoria não visível |
| M20 | Notificações | E-mail, in-app, WhatsApp transacional | [O] sino de notificações |
| M21 | Site público e conteúdo | Landing, preços, `/recursos` (SEO), changelog ("Mudanças"), status | [O] |
| M22 | Backoffice interno | Suporte, verificação manual de CRM, reembolsos | [R] |

### 1.2 Jornadas críticas do usuário

#### J1. Cadastro até o teste grátis

1. Visitante clica em "Começar 7 dias grátis" e vai para `/signup` [O].
2. Informa nome, e-mail e senha, ou entra com Google [I].
3. Recebe e-mail de verificação com link de uso único (TTL de 24 h) [R].
4. Ao verificar, é levado a `/onboarding` [O]:
   1. Confirma CRM + UF (validação, ver RN-07);
   2. Informa RQE (opcional);
   3. Escolhe a especialidade, o que define os modelos padrão;
   4. Opcionalmente importa pacientes por CSV.
5. O teste de 7 dias começa na verificação do e-mail, sem cartão [O]. O usuário cai em `/app`.
6. E-mails de lembrete no dia 5 e no dia 7 [R]. No dia 8, a conta passa a **somente leitura**: pode ver e exportar, não pode gravar nem gerar (RN-11).

#### J2. Primeira consulta (anamnese)

1. Em `/app`, o médico toca em "Nova consulta".
2. Opcionalmente informa o paciente: nome, idade e sexo, com "Salvar como novo paciente" marcado por padrão. Também pode começar sem paciente e atribuí-lo depois, na tela do documento [O].
3. Escolhe o tipo de documento (Anamnese, Evolução, Receita, Atestado…) e o modelo; a sugestão é o padrão da clínica [O].
4. Opcionalmente digita o contexto clínico ("Retorno HAS") [O].
5. Consentimento:
   - se o paciente não tem consentimento de gravação válido, o app mostra o termo;
   - o paciente assina no celular por um link `/m/{token}` [I], ou o médico registra "consentimento verbal" com data e hora (RN-14).
6. Toca em **Gravar**. O navegador pede o microfone e o app mostra cronômetro, nível de áudio e "Gravando 04:23" [O].
7. A transcrição aparece ao vivo, com rótulos "Dr." e "Pac." [O]. Dá para pausar e retomar [O].
8. Toca em **Finalizar**. O app mostra "Gerando documento" e o documento chega em ~12 s [O].
9. Revisão no editor [O]:
   - o documento vem organizado em seções;
   - edição inline, com sugestões da IA;
   - ao passar o cursor sobre uma frase, o app mostra os trechos da transcrição que a sustentam;
   - campos não mencionados na consulta aparecem como "Não relatado", nunca inventados.
10. Toca em **Assinar**: assinatura ICP-Brasil em nuvem, autorizada por PIN ou OTP [O/I].
11. Toca em **Enviar**: PDF por WhatsApp ou e-mail [O].
12. A consulta é encerrada e o áudio é apagado conforme a política de retenção (RN-17).

#### J3. Retorno (evolução)

1. Médico escolhe o paciente e o tipo "Evolução / Retorno".
2. O app carrega o resumo da última consulta, as medicações em uso e os últimos sinais vitais [O "compara com consultas anteriores"].
3. Grava e finaliza como em J2.
4. O documento vem em SOAP (Subjetivo, Objetivo, Avaliação, Plano), com comparações calculadas por regra fixa, sem a IA. Exemplo: "Peso 71,4 kg (-0,8 kg desde a última consulta)" [O].
5. Mudanças de medicação viram propostas de atualização da lista de medicações em uso, que o médico confirma (RN-29).

#### J4. Celular como microfone

1. No PC, durante a consulta, o médico toca em "Usar celular como microfone" [O].
2. O servidor cria um pareamento: `token` aleatório de 128 bits, código de 4 dígitos, validade de 120 s (RN-20).
3. O PC mostra o QR para `https://<host>/pair/{token}` e o código, por exemplo "3 9 7 5" [O].
4. O celular lê o QR com a câmera e abre a página sem login e sem instalar app [O].
5. O celular mostra o código e pede confirmação; o médico confirma que é o mesmo código do PC [O].
6. O celular passa para `/record/{captureToken}` [I]:
   - pede o microfone e captura o áudio;
   - envia o áudio por WebSocket;
   - mostra só o cronômetro e o botão de parar.
7. O PC mostra "Aguardando celular…" e, depois, a transcrição ao vivo [O].
8. Ao parar, ou se o celular cair, o PC oferece "Voltar para o microfone do PC" [O].

#### J5. Receita

1. Depois da consulta, o médico escolhe o tipo "Receita".
2. A IA lista os medicamentos citados na conversa, com posologia sugerida a partir do catálogo de medicamentos [O].
3. O médico confirma, edita ou remove cada item. Nenhum item entra sem confirmação (RN-33).
4. O app verifica interações entre os itens novos e as medicações em uso (RN-35).
5. O tipo de receita é escolhido pela lista de controle do medicamento: branca, controle especial (C1), azul (B) ou amarela (A) [O]. Ver RN-34.
6. Assinatura, PDF e envio como em J2.

#### J6. Atestado

1. Tipo: afastamento, comparecimento ou aptidão [O].
2. Campos: dias (número e por extenso), data de início (padrão: hoje) e cidade.
3. Caixa "Incluir CID": desmarcada por padrão; só fica disponível depois de registrada a autorização do paciente (RN-36) [O].
4. Assinatura e envio direto por WhatsApp [O].

#### J7. Encaminhamento

1. A IA sugere a especialidade de destino com base na queixa [O].
2. O app preenche hipótese diagnóstica com CID-10, resumo do caso, exames recentes, medicações e caráter (eletivo ou urgente) [O].
3. Compatível com SUS e convênios: os campos acompanham a guia de referência [O].
4. Revisão, assinatura e envio.

#### J8. Copilot clínico

1. Durante ou depois da consulta, o médico abre o painel Copilot, que já tem o contexto da consulta [O].
2. Faz uma pergunta, por exemplo diferenciais ou "posso aumentar a losartana?".
3. A resposta chega em streaming, com citações [O].
4. O médico pode inserir um trecho no documento como **sugestão**, que ele precisa aceitar (RN-43).

#### J9. Agenda

1. O médico cria um agendamento (paciente, início, duração, tipo).
2. Vê a agenda por dia, semana, mês ou lista [O].
3. Arrasta um agendamento para remarcar; havendo conflito, o app recusa e sugere horários livres (RN-39) [O].
4. Lembretes por WhatsApp; o paciente responde confirmando ou cancelando (RN-40) [O].
5. Do agendamento, o médico inicia a consulta (J2 com o paciente já preenchido).
6. Paciente que não veio é marcado como no-show (RN-41).

#### J10. Assinar o plano

1. Em `/app/assinatura`, o médico escolhe mensal ou anual.
2. Checkout com cartão, Pix ou boleto [R para o mercado brasileiro].
3. O webhook do provedor ativa a assinatura (RN-09) e o sistema emite a NFS-e (RN-13).

#### J11. Clínica (equipe)

1. O dono da clínica convida médicos por e-mail, com papel definido [O "permissões granulares"].
2. O convidado aceita e é vinculado à organização. O CRM continua pessoal.
3. Acesso a pacientes: por papel e vínculo assistencial (RN-47).
4. O painel de gestão mostra indicadores da equipe [O].

#### J12. Exportar e encerrar a conta

1. O médico pede a exportação total em PDF, FHIR e CSV [O].
2. Um job gera um ZIP cifrado; o link expira em 24 h.
3. O médico pede o encerramento. Há 30 dias de carência [O].
4. A eliminação definitiva só acontece depois do termo de transferência da guarda do prontuário (C4).

#### J13. Ficha do paciente

1. A ficha mostra:
   - linha do tempo das consultas;
   - medicações e alergias;
   - gráficos de PA, FC e peso [O].
2. Importação de exame em PDF [O]:
   - o médico envia o arquivo;
   - a IA extrai exame, data, valor e unidade, com status `PRESENT`, `INFERRED` ou `MISSING`;
   - o médico revisa;
   - só então os valores entram no gráfico (RN-29).

### 1.3 Regras de negócio ocultas (servidor)

As regras abaixo são inferidas ou recomendadas para que o comportamento anunciado seja seguro e consistente.
Cada uma tem código para ser referenciada em testes.

#### Sessão e acesso

| Código | Regra |
|---|---|
| RN-01 | Access token JWT de 10 min e refresh token opaco de 30 dias, com rotação a cada uso. Reuso de um refresh já usado revoga toda a família de tokens (detecção de roubo) |
| RN-02 | Bloqueio por inatividade em `/app` após 15 min. Para voltar, PIN ou senha; os dados não aparecem por trás do bloqueio. Uma gravação ativa mantém a sessão viva |
| RN-03 | Login: no máximo 5 tentativas por minuto por IP + e-mail. Bloqueio progressivo (1, 5 e 15 min). Mensagem genérica, sem dizer se o e-mail existe |
| RN-04 | MFA obrigatório para administradores de clínica e para exportação total. Opcional, mas incentivado, para os demais |
| RN-05 | Sessões simultâneas permitidas; o médico pode listar e revogar dispositivos |
| RN-06 | Verificação de e-mail obrigatória antes de gravar a primeira consulta |

#### Onboarding e teste grátis

| Código | Regra |
|---|---|
| RN-07 | CRM + UF validado em serviço externo (consulta ao CFM ou provedor). Nome divergente ou CRM inativo leva a `HUMAN_REVIEW` pelo suporte: o usuário usa o teste, mas não assina documentos até a validação |
| RN-08 | Um teste grátis por CRM + UF (único no banco). Um segundo cadastro com o mesmo CRM entra sem teste |

#### Faturamento

| Código | Regra |
|---|---|
| RN-09 | Máquina de estados da assinatura: `TRIALING → ACTIVE → PAST_DUE` (7 dias de carência com acesso total) `→ SUSPENDED` (somente leitura e exportação) `→ CANCELED`. Nunca bloquear a leitura de prontuários já registrados (dever legal de guarda) |
| RN-10 | Webhooks idempotentes pelo `provider_event_id` (único). Eventos fora de ordem são resolvidos pelo timestamp do objeto no provedor. Um job diário reconcilia com a API do provedor |
| RN-11 | Teste expirado sem assinatura: o estado vai para `SUSPENDED` com os mesmos limites do item anterior |
| RN-12 | Plano Clínica: cobrança por assento ativo, com pró-rata em entradas e saídas no ciclo |
| RN-13 | Emissão de NFS-e para cada cobrança paga (obrigação fiscal de empresa brasileira) via integrador |

#### Consentimento e gravação

| Código | Regra |
|---|---|
| RN-14 | Não se inicia gravação sem consentimento de gravação válido para o paciente (ou para a consulta, quando o paciente ainda não foi atribuído). Vale o termo digital assinado ou o "consentimento verbal" registrado pelo médico, com data, hora e usuário. A clínica decide se o verbal é aceito |
| RN-15 | Revogação do consentimento: interrompe a gravação em curso, apaga o áudio e marca a consulta. A transcrição já feita é mantida ou apagada conforme o termo (padrão: apagada) |
| RN-16 | No máximo uma gravação `ACTIVE` por médico por vez: trava no Redis com TTL de 30 s renovada por heartbeat. Uma segunda tentativa recebe `409 RECORDING_ALREADY_ACTIVE` com a opção de encerrar a outra |
| RN-17 | Retenção do áudio configurável: imediata, 7 dias ou 30 dias. **Padrão: imediata**, isto é, o áudio é apagado quando a transcrição final estiver gravada e confirmada, como no app de referência [O]. Um job de expurgo apaga do S3, verifica que apagou e registra auditoria. O texto da transcrição segue a retenção do prontuário |
| RN-18 | Áudio em blocos de 5 s numerados (`seq`). O servidor descarta duplicados por `(recording_id, seq)`. Lacunas na sequência ficam registradas e aparecem no editor como "trecho não recebido" |
| RN-19 | Duração máxima de 2 h por gravação, com aviso aos 90 min |

#### Pareamento do celular

| Código | Regra |
|---|---|
| RN-20 | Token de pareamento de 128 bits, uso único, TTL de 120 s, guardado só como hash. Código de 4 dígitos com no máximo 3 tentativas; depois, o pareamento é invalidado |
| RN-21 | O celular recebe uma *capability* limitada: só envia áudio daquela gravação. Não vê prontuário; mostra no máximo as iniciais do paciente. Expira ao fim da gravação ou em 3 h |
| RN-22 | Um pareamento ativo por consulta. Um novo pareamento revoga o anterior |

#### Transcrição

| Código | Regra |
|---|---|
| RN-23 | Os rótulos do provedor (`speaker 0, 1, 2`) viram papéis (`DOCTOR`, `PATIENT`, `COMPANION`) por uma decisão de IA tipada (ver 4.6). Abaixo do limiar, a tela mostra "Falante 1/2" e o botão "Trocar falantes" |
| RN-24 | Segmentos com confiança abaixo de 0,40 ficam marcados como "baixa confiança" e destacados no editor; não são descartados em silêncio |
| RN-25 | A transcrição é dado, nunca instrução: o texto do paciente vai ao LLM sempre delimitado e sem poder de mudar o comportamento (defesa contra *prompt injection*) |

#### Geração de documentos

| Código | Regra |
|---|---|
| RN-26 | Geração assíncrona. A chave de idempotência é `hash(encounter_id, doc_type, template_version_id, transcript_hash)`: pedir de novo com a mesma transcrição devolve o mesmo job |
| RN-27 | A saída passa por validação de schema por tipo (Zod). Saída inválida leva a uma tentativa de reparo; se falhar de novo, `REJECT`, e a tela oferece "Tentar de novo" sem mostrar conteúdo parcial |
| RN-28 | Toda afirmação clínica precisa de evidência: pelo menos um `segmentId` da transcrição. Item sem evidência vira `INFERRED` com aviso e destaque, ou é removido. Campo não falado vira `MISSING` (`null`) e aparece como "Não relatado". A sugestão de exame físico ("sugere exame físico baseado na queixa") é um bloco separado de **sugestões**, nunca preenche o exame |
| RN-29 | Medicações, alergias, condições e sinais vitais extraídos são *propostas* de atualização da ficha. Só entram na ficha depois que o médico confirma |
| RN-30 | Estados do documento: `DRAFT → IN_REVIEW → SIGNED` (imutável) `→ SENT`. Corrigir um documento assinado cria um **adendo** (nova versão ligada à original); o assinado nunca é editado |
| RN-31 | Edição com trava otimista (`version`), salvamento automático com debounce de 1 s. Conflito devolve `409 VERSION_CONFLICT` com a versão atual |
| RN-32 | Aprendizado de estilo: ao assinar, o sistema calcula, por seção, a diferença entre o gerado e o final. O par sem identificadores é guardado como exemplo do modelo; a geração seguinte usa até 3 exemplos recentes. O médico pode zerar o aprendizado. Não há *fine-tuning* |

#### Receituário

| Código | Regra |
|---|---|
| RN-33 | Item de receita só entra com confirmação explícita. A posologia sugerida vem do catálogo (dados da ANVISA/CMED) e do modelo; o LLM só reconhece o nome citado |
| RN-34 | Tipo de receita pela lista da Portaria SVS/MS 344/98: sem lista → simples; C1 → controle especial em 2 vias; B1/B2 → notificação azul; A → notificação amarela. Receitas A e B dependem de numeração da vigilância sanitária e da norma vigente para o formato digital. **Verificar a regulamentação atual antes de habilitar A e B digitais.** Prazos de validade ficam em tabela parametrizável, não no código |
| RN-35 | Checagem de interações por base estruturada, determinística. Interação grave bloqueia a assinatura até o médico registrar a ciência, com justificativa opcional (`HUMAN_REVIEW`) |

#### Atestado e encaminhamento

| Código | Regra |
|---|---|
| RN-36 | CID no atestado só com autorização do paciente registrada (campo `cid_authorized_at`), conforme a Resolução CFM 1.658/2002 |
| RN-37 | Atestado: dias em número e por extenso, gerados por regra fixa. A data de início não pode ser anterior à data da consulta sem justificativa escrita |
| RN-38 | Encaminhamento e atestado usam CID-10 da tabela oficial do DATASUS. A IA só escolhe entre candidatos da tabela; código fora da tabela significa "sem código" |

#### Agenda

| Código | Regra |
|---|---|
| RN-39 | Conflito impedido no banco por `EXCLUDE USING gist (doctor_id WITH =, during WITH &&)` para agendamentos ativos. Remarcar é um `PATCH` com `version`. Conflito devolve `409 SCHEDULE_CONFLICT` com 3 horários livres sugeridos |
| RN-40 | Lembretes por WhatsApp só com opt-in do paciente: D-1 às 09:00 e 2 h antes, no fuso da clínica. A resposta do paciente pelo webhook muda o status para `CONFIRMED` ou `CANCELED_BY_PATIENT` |
| RN-41 | No-show: 30 min depois do fim do horário, sem consulta iniciada, o agendamento vira `NO_SHOW` (regra determinística, desfazível) |

#### Copilot

| Código | Regra |
|---|---|
| RN-42 | Contexto enviado ao LLM sem nome, CPF, telefone nem endereço do paciente; só idade, sexo e conteúdo clínico |
| RN-43 | Toda afirmação clínica da resposta cita uma fonte da base licenciada (RAG). Resposta sem fonte recuperada aparece com o selo "sem fonte" e não pode ser inserida no documento |
| RN-44 | Limite de 60 mensagens por hora por usuário |

#### Envio e acesso do paciente

| Código | Regra |
|---|---|
| RN-45 | Só documentos `SIGNED` podem ser enviados |
| RN-46 | O WhatsApp e o e-mail levam um link `/m/{token}` (TTL de 7 dias, guardado como hash). Para abrir, o paciente confirma a data de nascimento: 5 tentativas, depois o link é bloqueado. O PDF nunca vai como anexo aberto no WhatsApp |

#### Multi-tenant e auditoria

| Código | Regra |
|---|---|
| RN-47 | Toda consulta ao banco é filtrada por `org_id`, e o Postgres tem RLS como segunda barreira. Na clínica, o acesso ao paciente exige permissão do papel e vínculo (o paciente tem consulta ou agendamento com o médico), salvo papéis administrativos |
| RN-48 | Toda leitura de dado de saúde gera auditoria: abrir ficha, ver documento, exportar, baixar áudio |
| RN-49 | Nenhum paciente nem documento é apagado de verdade antes do fim da guarda legal. "Excluir" arquiva, exceto na eliminação pedida pelo titular depois da transferência de guarda (C4) |

#### Limites de taxa

| Escopo | Limite [R] | Resposta |
|---|---|---|
| `POST /auth/login` | 5/min por IP + e-mail | `429` com `Retry-After` |
| `POST /auth/signup` | 3/h por IP | `429` |
| API autenticada (geral) | 600/min por usuário | `429` |
| Geração de documento | 30/h por usuário | `429 GENERATION_RATE_LIMIT` |
| Copilot | 60/h por usuário | `429` |
| Pareamento | 10/h por usuário | `429` |
| Link do paciente `/m/*` | 5 tentativas de data de nascimento por token | `423 LINK_LOCKED` |
| API pública (chave) | por plano, por exemplo 1.000/dia | `429` |

Implementação: janela deslizante no Redis (`ZSET` por chave) no gateway da aplicação.

---

## 2. Design de sistema e arquitetura

### 2.1 Estilo arquitetural: monólito modular

**Recomendação [R]:** monólito modular em TypeScript, com **três processos implantáveis** saídos do mesmo repositório e
do mesmo código de domínio:

1. `api`: HTTP REST, autenticação e regras de negócio;
2. `realtime`: gateway WebSocket de áudio e transcrição;
3. `worker`: jobs assíncronos (geração, PDF, assinatura, envio, expurgo, exportação, lembretes).

Justificativa:

- **Um domínio só, muito transacional.** Consulta, documento, assinatura e auditoria precisam de consistência forte na mesma transação. Microsserviços obrigariam a sagas e consistência eventual onde ela não traz ganho.
- **Time pequeno e entrega rápida.** Um repositório, um pipeline e um banco reduzem o custo operacional em uma ordem de grandeza.
- **Escala diferente só em dois pontos.** Áudio em tempo real (conexões longas) e IA (latência alta, picos) já ficam isolados em `realtime` e `worker`, que escalam sozinhos.
- **LGPD e auditoria** são mais simples com um banco e um ponto de controle de acesso.
- **Costuras prontas para extrair depois.** Cada módulo é uma pasta com interface pública; não há import entre módulos fora dessa interface (regra de lint). Candidatos naturais a serviço próprio, se um dia for preciso: transcrição, faturamento e Copilot.

O produto de referência roda o frontend na Vercel (região `gru1`) [O] e anuncia dados na AWS São Paulo [O].
A recomendação segue o mesmo desenho: **web na Vercel** (sem dados de saúde no edge) e **API, banco e arquivos na AWS `sa-east-1`**.

### 2.2 Componentes de infraestrutura

```text
                         ┌────────────────────────────────────────────┐
  Navegador (PC/iPad)    │  Vercel (Next.js)  - site público + /app   │
  Celular (/pair,/record)│  CDN global, SSR, sem dados de saúde       │
          │              └───────────────┬────────────────────────────┘
          │ HTTPS / WSS                  │ fetch para api.<dominio>
          ▼                              ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │ AWS WAF  ->  CloudFront (api + downloads assinados)               │
  └───────────────┬───────────────────────────────┬───────────────────┘
                  ▼                               ▼
        ┌──────────────────┐            ┌──────────────────────┐
        │ ALB (HTTP)       │            │ ALB (WebSocket)      │
        └────────┬─────────┘            └──────────┬───────────┘
                 ▼                                 ▼
    ┌──────────────────────┐          ┌─────────────────────────┐
    │ ECS Fargate: api     │          │ ECS Fargate: realtime   │
    │ (NestJS, N tarefas)  │          │ (WS, áudio -> STT)      │
    └───┬──────┬──────┬────┘          └───┬───────────┬─────────┘
        │      │      │                   │           │ streaming
        │      │      │ outbox            │           ▼
        │      │      ▼                   │   ┌──────────────────┐
        │      │  ┌──────────────┐        │   │ Provedor STT     │
        │      │  │ Redis        │◄───────┘   │ (pt-BR médico)   │
        │      │  │ ElastiCache  │ pub/sub,   └──────────────────┘
        │      │  │ cache, filas │ travas
        │      │  └──────┬───────┘
        │      │         ▼ BullMQ
        │      │  ┌──────────────────────┐   ┌───────────────────────┐
        │      │  │ ECS Fargate: worker  │──►│ LLM (geração/Copilot) │
        │      │  │ geração, PDF, envio, │   │ Assinatura ICP (CSC)  │
        │      │  │ expurgo, exportação  │──►│ WhatsApp Cloud API    │
        │      │  └──────┬───────────────┘   │ E-mail (SES)          │
        │      │         │                   │ Billing + NFS-e       │
        ▼      ▼         ▼                   └───────────────────────┘
  ┌──────────────────┐  ┌────────────────────────────┐
  │ RDS PostgreSQL 16│  │ S3 (SSE-KMS): áudio, PDFs, │
  │ Multi-AZ+pgvector│  │ anexos, exportações        │
  └──────────────────┘  └────────────────────────────┘
        Observabilidade: OpenTelemetry -> métricas/logs/traces (sem dados de saúde)
        Segredos: AWS Secrets Manager  ·  Chaves: AWS KMS (chave por organização)
```

| Componente | Escolha [R] | Papel |
|---|---|---|
| CDN | Vercel Edge (web) + CloudFront (API e downloads) | Cache de assets estáticos e páginas públicas (ISR); downloads de PDF por URL assinada de curta duração |
| WAF | AWS WAF | Regras gerenciadas OWASP, limite por IP, bloqueio geográfico opcional |
| API Gateway | Gateway na própria aplicação (middlewares NestJS) para `/api/v1`; **AWS API Gateway** só para a API pública de integração (`/public/v1`, FHIR), por causa de planos de uso e chaves | Autenticação, limite de taxa, versionamento, `X-Request-Id` |
| Load balancer | ALB (HTTP/2 e WebSocket) | Health checks, TLS 1.3, sem *sticky session* (estado no Redis) |
| Servidores de aplicação | ECS Fargate (`api`, `realtime`, `worker`) | Escala horizontal por CPU, conexões e tamanho de fila |
| Cache | Redis 7 (ElastiCache, cifrado em trânsito e em repouso) | Ver 2.4 |
| Mensageria | BullMQ sobre Redis + **outbox transacional** no Postgres | Jobs com retentativa e DLQ. Kafka é desnecessário: não há fluxo de eventos de alto volume nem vários consumidores independentes. Caminho de migração: SQS FIFO se o volume crescer |
| Banco | RDS PostgreSQL 16 Multi-AZ, `pgvector`, PITR de 35 dias | Fonte da verdade |
| Objetos | S3 com SSE-KMS, versionamento, *object lock* nos PDFs assinados | Áudio (temporário), PDFs, anexos, exportações |
| Provedores externos | STT, LLM, assinatura ICP-Brasil (CSC), WhatsApp, e-mail, billing, NFS-e | Ver 6.3 |

### 2.3 Fluxos de dados

#### F1. Requisição HTTP autenticada

`navegador → Vercel (página) → fetch api.<dominio>/api/v1/... (cookie HttpOnly + X-CSRF-Token)`
`→ WAF → CloudFront → ALB → api`

Dentro da `api`, a requisição passa por esta cadeia de middlewares:

1. `requestId`;
2. limite de taxa (Redis);
3. autenticação (JWT);
4. carga do tenant;
5. autorização (RBAC + vínculo);
6. validação Zod;
7. caso de uso;
8. Postgres (transação + outbox);
9. resposta;
10. auditoria (assíncrona via outbox).

#### F2. Áudio ao vivo

1. O cliente pede um ticket: `POST /api/v1/realtime/tickets`, que devolve um ticket de 30 s, uso único.
2. Abre `wss://rt.<dominio>/v1/stream?ticket=…`.
3. A cada 5 s, envia frames binários Opus com `seq`. O `realtime` responde com `ack`.
4. O `realtime` grava cada bloco no S3, na pasta `audio/{org}/{recording}/{seq}.webm`.
5. Ao mesmo tempo, encaminha o áudio ao provedor STT em streaming.
6. Resultados parciais e finais do STT viram `transcript_segments` (só os finais vão ao Postgres).
7. Os segmentos são publicados no Redis em `pubsub:encounter:{id}`.
8. Todos os assinantes (PC e iPad do mesmo médico) recebem `partial` e `final`.

Com o celular pareado, o celular é o produtor e o PC é só assinante.

#### F3. Geração de documento

1. `POST /encounters/{id}/documents:generate` responde `202` com `jobId`.
2. O worker carrega:
   - a transcrição final;
   - o modelo;
   - até 3 exemplos de estilo;
   - para evolução, o resumo da consulta anterior.
3. Tira os identificadores e chama o LLM com saída estruturada.
4. Valida o schema (Zod) e as evidências (cada `segmentId` existe na consulta).
5. Aplica a política (4.6) e grava `document_versions` e `ai_decisions`.
6. Publica `document.ready`; o cliente, por WS ou consulta ao job, abre o editor.

#### F4. Assinatura

1. `POST /documents/{id}/signatures`.
2. O worker renderiza o PDF/A (HTML → PDF), calcula o SHA-256 e pede autorização ao provedor CSC (OAuth com PIN/OTP do certificado em nuvem).
3. Chama `signHash` e embute a assinatura PAdES.
4. Grava o PDF no S3 com *object lock*.
5. O documento passa a `SIGNED`.

#### F5. Webhooks externos (billing, WhatsApp, assinatura)

1. `POST /webhooks/{provider}`.
2. Valida a assinatura HMAC do provedor.
3. Grava em `inbound_events` (único por `provider_event_id`) e responde `200` na hora.
4. O worker processa de forma idempotente.

### 2.4 Estratégia de cache (Redis)

| Chave | Conteúdo | TTL | Invalidação |
|---|---|---|---|
| `sess:{sessionId}` | Metadados da sessão (userId, orgId, mfa, revogada?) | 30 min deslizante | Logout ou revogação |
| `rl:{escopo}:{id}` | ZSET da janela de limite de taxa | Janela + 1 min | Automática |
| `perm:{orgId}:{userId}` | Permissões efetivas resolvidas | 10 min | Mudança de papel ou membro (evento) |
| `tpl:{templateVersionId}` | Definição compilada do modelo | 24 h | Imutável por versão |
| `cat:drug:{query}` | Resultado de busca no catálogo de medicamentos | 24 h | Recarga do catálogo |
| `cid10:{query}` | Busca na tabela CID-10 | 7 dias | Recarga da tabela |
| `pair:{tokenHash}` | Estado do pareamento (código, tentativas, encounterId) | 120 s | Confirmação ou expiração |
| `rt:ticket:{ticket}` | Ticket de WebSocket | 30 s | Uso único (`GETDEL`) |
| `lock:recording:{doctorId}` | Trava de gravação ativa | 30 s com heartbeat | Fim da gravação |
| `pubsub:encounter:{id}` | Canal pub/sub de transcrição e status | n/a | n/a |
| `cnt:usage:{orgId}:{yyyymm}` | Contadores (consultas, minutos, gerações) | 40 dias | Consolidado diário no Postgres |
| `insights:{orgId}:{range}` | Agregados do painel | 15 min | Tempo |
| `idem:{userId}:{key}` | Resposta da requisição idempotente | 24 h | Tempo |

**Não vão para o cache:** conteúdo de documento, transcrição e dados de identificação do paciente.

### 2.5 Filas (BullMQ)

| Fila | Produtor | Consumidor | Retentativas | Observações |
|---|---|---|---|---|
| `generation` | api | worker | 2 (backoff exponencial 5 s) | Concorrência limitada por cota do LLM; prioridade para planos pagos |
| `transcription-batch` | api (upload offline) | worker | 3 | Transcreve gravações enviadas depois de offline |
| `pdf-render` | worker | worker | 3 | Chromium sem rede (sandbox) |
| `signature` | api | worker | 0 automáticas | Depende do PIN/OTP do médico; falha volta ao usuário |
| `delivery` | api | worker | 5 | WhatsApp ou e-mail; status por webhook |
| `audio-purge` | cron | worker | 10 | Verifica a exclusão no S3 |
| `export` | api | worker | 2 | ZIP cifrado, link de 24 h |
| `reminders` | cron (a cada 5 min) | worker | 3 | Janela de envio, opt-in |
| `lab-import` | api | worker | 2 | OCR + extração tipada |
| `outbox-relay` | Postgres | worker | infinitas | Publica eventos e auditoria |
| `billing-reconcile` | cron diário | worker | 3 | Compara com o provedor |

Toda fila tem DLQ (`<fila>:failed`) com alerta quando houver mais de 0 jobs por mais de 15 min.

### 2.6 Capacidade e SLOs [R]

Estimativa a partir dos números públicos (2,4 M consultas em ~10 meses de 2026):

| Grandeza | Estimativa |
|---|---|
| Consultas por dia útil | ~10.000; pico de ~1.500 gravações simultâneas |
| Banda de áudio | Opus a 24 kbps × 1.500 = ~36 Mbps de entrada |
| Áudio por consulta | ~20 min, ~3,6 MB (apagado pela retenção) |
| Texto por consulta | ~20 KB (transcrição + versões), ~50 GB/ano |

| SLO | Meta |
|---|---|
| Disponibilidade do `/app` e da API | 99,9 % mensal |
| Latência da transcrição parcial | p95 < 1,5 s |
| Geração de documento | p95 < 20 s (o original anuncia ~12 s) |
| API (leitura) | p95 < 300 ms |
| Perda de áudio | 0 blocos confirmados perdidos (`ack` só depois da gravação no S3) |

---

## 3. Modelagem de dados

### 3.1 Estratégia de armazenamento

| Dado | Onde | Por quê |
|---|---|---|
| Usuários, organizações, pacientes, consultas, documentos, receitas, agenda, assinaturas, auditoria | **PostgreSQL 16** (relacional) | Transações ACID, integridade referencial, RLS, `EXCLUDE` para conflito de agenda, JSONB para o conteúdo tipado dos documentos |
| Conteúdo dos documentos (seções variáveis por modelo) | **PostgreSQL JSONB** em `document_versions.content` | Estrutura variável sem precisar de NoSQL; validada por Zod na aplicação e por `CHECK` de tipo no banco |
| Vetores da base de conhecimento do Copilot | **pgvector** (mesmo Postgres) | Evita mais um banco; volume pequeno (centenas de milhares de trechos) |
| Sessões, limites de taxa, travas, pareamento, pub/sub, filas | **Redis 7** (chave-valor) | Leitura e escrita em menos de 1 ms, TTL nativo |
| Áudio, PDFs, anexos, exportações | **S3** (objetos) | Barato, durável, cifrado com KMS, *object lock* para documentos assinados |
| Eventos de auditoria de alto volume | Postgres particionado por mês (`audit_logs`), com arquivamento mensal em S3 (Parquet) | Consulta recente rápida e histórico barato |
| Analytics de produto (cliques, funil), sem dados de saúde | Ferramenta de product analytics (PostHog com hospedagem própria) | Separado do banco clínico |

**MongoDB e DynamoDB não são recomendados:** o JSONB cobre o conteúdo flexível, e um segundo banco operacional
aumentaria a superfície de LGPD e de backup sem ganho.

### 3.2 Convenções

- **Chaves primárias:** `uuid` v7, ordenável no tempo (`gen_random_uuid()` como alternativa).
- **Datas:** `timestamptz` em UTC; o fuso da organização fica em `organizations.timezone`.
- **Tenant:** toda tabela de negócio tem `org_id` e política RLS: `org_id = current_setting('app.org_id')::uuid`.
- **Exclusão:** sem `DELETE` em dados clínicos; usa-se `archived_at`.
- **Identificadores sensíveis do paciente** (CPF, telefone, e-mail, endereço):
  - ficam cifrados na aplicação (envelope com chave de dados da organização no KMS), em colunas `bytea` com sufixo `_enc`;
  - para busca, há um **índice cego** HMAC-SHA256 em colunas `_hash`.
- **Concorrência:** coluna `version int` para trava otimista onde há edição.

### 3.3 Schema (migração SQL)

```sql
-- 0001_extensions.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 0002_enums.sql
CREATE TYPE org_kind              AS ENUM ('SOLO', 'CLINIC');
CREATE TYPE member_status         AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE crm_status            AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_REVIEW', 'REJECTED');
CREATE TYPE sex                   AS ENUM ('F', 'M', 'I');   -- I = intersexo / não informado
CREATE TYPE consent_type          AS ENUM ('RECORDING', 'DATA_SHARING');
CREATE TYPE consent_method        AS ENUM ('DIGITAL_SIGNATURE', 'VERBAL_RECORDED', 'PAPER_UPLOAD');
CREATE TYPE consent_status        AS ENUM ('GRANTED', 'REVOKED');
CREATE TYPE appointment_status    AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELED', 'CANCELED_BY_PATIENT',
                                           'NO_SHOW', 'COMPLETED');
CREATE TYPE encounter_kind        AS ENUM ('FIRST_VISIT', 'FOLLOW_UP');
CREATE TYPE encounter_status      AS ENUM ('DRAFT', 'RECORDING', 'PAUSED', 'PROCESSING', 'REVIEW',
                                           'SIGNED', 'CANCELED');
CREATE TYPE recording_source      AS ENUM ('BROWSER', 'PAIRED_PHONE', 'UPLOAD');
CREATE TYPE recording_status      AS ENUM ('ACTIVE', 'PAUSED', 'FINALIZED', 'FAILED', 'PURGED');
CREATE TYPE speaker_role          AS ENUM ('DOCTOR', 'PATIENT', 'COMPANION', 'UNKNOWN');
CREATE TYPE pairing_status        AS ENUM ('PENDING', 'CLAIMED', 'CONFIRMED', 'EXPIRED', 'REVOKED');
CREATE TYPE document_type         AS ENUM ('ANAMNESE', 'EVOLUCAO', 'RECEITA', 'ATESTADO',
                                           'ENCAMINHAMENTO', 'LAUDO', 'SOLICITACAO', 'PERSONALIZADO');
CREATE TYPE document_status       AS ENUM ('DRAFT', 'IN_REVIEW', 'SIGNED', 'SENT', 'VOID');
CREATE TYPE content_origin        AS ENUM ('AI', 'HUMAN', 'AI_EDITED');
CREATE TYPE field_status          AS ENUM ('PRESENT', 'INFERRED', 'MISSING');
CREATE TYPE prescription_kind     AS ENUM ('SIMPLES', 'CONTROLE_ESPECIAL', 'NOTIFICACAO_B',
                                           'NOTIFICACAO_B2', 'NOTIFICACAO_A');
CREATE TYPE signature_status      AS ENUM ('AWAITING_AUTHORIZATION', 'SIGNING', 'SIGNED', 'FAILED');
CREATE TYPE delivery_channel      AS ENUM ('WHATSAPP', 'EMAIL', 'LINK');
CREATE TYPE delivery_status       AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE subscription_status   AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');
CREATE TYPE billing_interval      AS ENUM ('MONTH', 'YEAR');
CREATE TYPE decision_action       AS ENUM ('AUTO_EXECUTE', 'HUMAN_REVIEW', 'REJECT');
CREATE TYPE risk_level            AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE job_status            AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- 0003_identity.sql
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            org_kind NOT NULL DEFAULT 'SOLO',
  name            text NOT NULL,
  cnpj            char(14) UNIQUE,
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  kms_key_id      text NOT NULL,                     -- chave de dados da organização
  audio_retention text NOT NULL DEFAULT 'PT0S'       -- ISO-8601: PT0S (padrão, RN-17), P7D, P30D
                  CHECK (audio_retention IN ('PT0S','P7D','P30D')),
  verbal_consent_allowed boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL UNIQUE,
  email_verified_at timestamptz,
  password_hash     text,                             -- argon2id; nulo se só OAuth
  full_name         text NOT NULL,
  mfa_totp_secret_enc bytea,
  mfa_enabled_at    timestamptz,
  locale            text NOT NULL DEFAULT 'pt-BR',
  status            text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz
);

CREATE TABLE auth_identities (                        -- login social (1:N com users)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id),
  provider         text NOT NULL,                     -- 'google'
  provider_subject text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  family_id   uuid NOT NULL,                           -- rotação; reuso revoga a família (RN-01)
  token_hash  bytea NOT NULL UNIQUE,
  device_name text,
  ip_hash     bytea,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON refresh_tokens (family_id);

CREATE TABLE webauthn_credentials (                   -- passkeys (opcional, recomendado)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  credential_id bytea NOT NULL UNIQUE,
  public_key    bytea NOT NULL,
  sign_count    bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES organizations(id),       -- nulo = papel de sistema
  key        text NOT NULL,                           -- 'owner','admin','doctor','secretary','auditor'
  name       text NOT NULL,
  UNIQUE (org_id, key)
);

CREATE TABLE role_permissions (                       -- N:N roles x permissões
  role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,                       -- 'patient:read','document:sign','schedule:write',...
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE memberships (                            -- N:N users x organizations
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  role_id    uuid NOT NULL REFERENCES roles(id),
  status     member_status NOT NULL DEFAULT 'ACTIVE',
  invited_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE specialties (
  code text PRIMARY KEY,                              -- 'cardiologia','psiquiatria',...
  name text NOT NULL
);

CREATE TABLE doctor_profiles (                        -- 1:1 com users
  user_id           uuid PRIMARY KEY REFERENCES users(id),
  crm               varchar(10) NOT NULL,
  crm_uf            char(2) NOT NULL,
  rqe               varchar(20),
  specialty_code    text REFERENCES specialties(code),
  crm_status        crm_status NOT NULL DEFAULT 'PENDING',
  crm_checked_at    timestamptz,
  trial_consumed_at timestamptz,                      -- RN-08
  signature_provider text,                            -- 'birdid','vidaas',...
  UNIQUE (crm, crm_uf)
);

-- 0004_patients.sql
CREATE TABLE patients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  full_name      text NOT NULL,                        -- exibido na UI; nunca vai ao LLM (RN-42)
  social_name    text,
  birth_date     date,                                 -- opcional no app de referência
  age_years_at_registration smallint CHECK (age_years_at_registration BETWEEN 0 AND 130),
  avatar_color   text,
  sex            sex NOT NULL,
  cpf_enc        bytea,
  cpf_hash       bytea,                                -- índice cego para busca e unicidade
  rg_enc         bytea,
  phone_enc      bytea,
  phone_hash     bytea,
  email_enc      bytea,
  address_enc    bytea,                                -- JSON cifrado
  health_plan    jsonb,                                -- {operadora: 'PARTICULAR'|'UNIMED'|...|'SUS', carteirinha_enc?}
  whatsapp_opt_in_at timestamptz,
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  version        int NOT NULL DEFAULT 1,
  archived_at    timestamptz
);
CREATE UNIQUE INDEX patients_org_cpf ON patients (org_id, cpf_hash) WHERE cpf_hash IS NOT NULL;
CREATE INDEX patients_name_trgm ON patients USING gin (full_name gin_trgm_ops);   -- busca por nome; RLS filtra org
CREATE INDEX patients_recent ON patients (org_id, updated_at DESC);

CREATE TABLE care_relationships (                      -- vínculo médico x paciente (RN-47); N:N
  patient_id uuid NOT NULL REFERENCES patients(id),
  doctor_id  uuid NOT NULL REFERENCES users(id),
  since      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, doctor_id)
);

CREATE TABLE patient_allergies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  patient_id         uuid NOT NULL REFERENCES patients(id),
  substance          text NOT NULL,
  reaction           text,
  severity           text CHECK (severity IN ('LEVE','MODERADA','GRAVE')),
  status             text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ENTERED_IN_ERROR')),
  source_document_id uuid,                              -- documento que originou (RN-29)
  confirmed_by       uuid NOT NULL REFERENCES users(id),
  confirmed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patient_medications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  patient_id         uuid NOT NULL REFERENCES patients(id),
  drug_id            uuid,                              -- FK para drugs (catálogo), opcional
  name               text NOT NULL,
  dose               text,
  frequency          text,
  route              text,
  status             text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','STOPPED','ENTERED_IN_ERROR')),
  started_on         date,
  stopped_on         date,
  source_document_id uuid,
  confirmed_by       uuid NOT NULL REFERENCES users(id),
  confirmed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patient_conditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  patient_id  uuid NOT NULL REFERENCES patients(id),
  cid10       varchar(5),                               -- tabela oficial DATASUS (RN-38)
  description text NOT NULL,
  status      text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','ENTERED_IN_ERROR')),
  onset_on    date,
  source_document_id uuid,
  confirmed_by uuid NOT NULL REFERENCES users(id),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE observations (                             -- sinais vitais e exames (gráficos)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  patient_id    uuid NOT NULL REFERENCES patients(id),
  encounter_id  uuid,
  code          text NOT NULL,                          -- 'BP_SYS','BP_DIA','HR','SPO2','WEIGHT','HEIGHT','LAB:<loinc>'
  value_num     numeric,
  value_text    text,
  unit          text,
  observed_at   timestamptz NOT NULL,
  source        text NOT NULL CHECK (source IN ('TRANSCRIPT','MANUAL','LAB_IMPORT')),
  field_status  field_status NOT NULL,                  -- PRESENT/INFERRED (MISSING não é gravado)
  evidence      jsonb,                                  -- {segmentIds:[...]} ou {page, bbox}
  confirmed_by  uuid NOT NULL REFERENCES users(id),     -- só entra depois da revisão (RN-29)
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (value_num IS NOT NULL OR value_text IS NOT NULL)
);
CREATE INDEX ON observations (patient_id, code, observed_at);

CREATE TABLE lab_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  patient_id      uuid NOT NULL REFERENCES patients(id),
  file_object_key text NOT NULL,
  status          job_status NOT NULL DEFAULT 'QUEUED',
  extraction      jsonb,                                 -- campos PRESENT/INFERRED/MISSING com página
  decision_id     uuid,
  reviewed_by     uuid REFERENCES users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  patient_id          uuid REFERENCES patients(id),       -- nulo: consentimento verbal numa consulta ainda sem paciente
  encounter_id        uuid,                               -- preenchido quando o consentimento é da consulta
  CHECK (patient_id IS NOT NULL OR encounter_id IS NOT NULL),
  type                consent_type NOT NULL,
  method              consent_method NOT NULL,
  status              consent_status NOT NULL DEFAULT 'GRANTED',
  term_version        text NOT NULL,
  granted_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  registered_by       uuid NOT NULL REFERENCES users(id),
  evidence_object_key text,                             -- PDF do termo assinado
  signer_ip_hash      bytea
);
CREATE INDEX ON consents (patient_id, type, status);

-- 0005_schedule.sql
CREATE TABLE appointments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  doctor_id   uuid NOT NULL REFERENCES users(id),
  patient_id  uuid NOT NULL REFERENCES patients(id),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  during      tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  status      appointment_status NOT NULL DEFAULT 'SCHEDULED',
  kind        text NOT NULL DEFAULT 'CONSULTA',          -- 'CONSULTA','RETORNO','PROCEDIMENTO'
  modality    text NOT NULL DEFAULT 'PRESENCIAL' CHECK (modality IN ('PRESENCIAL','TELECONSULTA')),
  notes       text,
  version     int NOT NULL DEFAULT 1,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- RN-39: sem sobreposição para o mesmo médico entre agendamentos ativos
  EXCLUDE USING gist (doctor_id WITH =, during WITH &&)
    WHERE (status IN ('SCHEDULED','CONFIRMED'))
);
CREATE INDEX ON appointments (org_id, doctor_id, starts_at);

CREATE TABLE reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  channel        delivery_channel NOT NULL,
  scheduled_for  timestamptz NOT NULL,
  status         delivery_status NOT NULL DEFAULT 'QUEUED',
  provider_message_id text,
  UNIQUE (appointment_id, channel, scheduled_for)
);

-- 0006_encounters.sql
CREATE TABLE encounters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  doctor_id      uuid NOT NULL REFERENCES users(id),
  patient_id     uuid REFERENCES patients(id),         -- nulo até atribuir na tela do documento (0.4)
  appointment_id uuid REFERENCES appointments(id),
  kind           encounter_kind NOT NULL,
  modality       text NOT NULL DEFAULT 'PRESENCIAL' CHECK (modality IN ('PRESENCIAL','TELECONSULTA')),
  status         encounter_status NOT NULL DEFAULT 'DRAFT',
  context_note   text,                                  -- "Retorno HAS"
  consent_id     uuid REFERENCES consents(id),          -- obrigatório antes de RECORDING (RN-14)
  started_at     timestamptz,
  ended_at       timestamptz,
  version        int NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('RECORDING','PAUSED') OR consent_id IS NOT NULL)
);
CREATE INDEX ON encounters (org_id, doctor_id, created_at DESC);
CREATE INDEX ON encounters (patient_id, created_at DESC);

CREATE TABLE recordings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  encounter_id      uuid NOT NULL REFERENCES encounters(id),
  source            recording_source NOT NULL,
  status            recording_status NOT NULL DEFAULT 'ACTIVE',
  codec             text NOT NULL DEFAULT 'opus',
  sample_rate       int NOT NULL DEFAULT 48000,
  last_seq          int NOT NULL DEFAULT -1,
  duration_ms       bigint NOT NULL DEFAULT 0,
  object_prefix     text NOT NULL,                       -- audio/{org}/{recording}/
  purge_after       timestamptz,                         -- RN-17
  purged_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audio_chunks (
  recording_id uuid NOT NULL REFERENCES recordings(id),
  seq          int  NOT NULL,
  object_key   text NOT NULL,
  bytes        int  NOT NULL,
  duration_ms  int  NOT NULL,
  sha256       bytea NOT NULL,
  captured_at  timestamptz NOT NULL,                     -- relógio do cliente (offline)
  received_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recording_id, seq)                        -- dedupe (RN-18)
);

CREATE TABLE device_pairings (                           -- registro auditável; o estado vivo fica no Redis
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  encounter_id  uuid NOT NULL REFERENCES encounters(id),
  created_by    uuid NOT NULL REFERENCES users(id),
  token_hash    bytea NOT NULL UNIQUE,
  status        pairing_status NOT NULL DEFAULT 'PENDING',
  attempts      smallint NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  claimed_ua    text,
  confirmed_at  timestamptz,
  revoked_at    timestamptz
);
CREATE UNIQUE INDEX one_live_pairing ON device_pairings (encounter_id)
  WHERE status IN ('PENDING','CLAIMED','CONFIRMED');      -- RN-22

CREATE TABLE transcript_segments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  encounter_id  uuid NOT NULL REFERENCES encounters(id),
  recording_id  uuid NOT NULL REFERENCES recordings(id),
  seq           int NOT NULL,
  speaker_label smallint,                                -- rótulo bruto do STT
  speaker_role  speaker_role NOT NULL DEFAULT 'UNKNOWN',
  start_ms      int NOT NULL,
  end_ms        int NOT NULL,
  text          text NOT NULL,
  confidence    real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  low_confidence boolean GENERATED ALWAYS AS (confidence < 0.40) STORED,   -- RN-24
  edited_text   text,                                    -- correção manual do médico
  UNIQUE (recording_id, seq)
);
CREATE INDEX ON transcript_segments (encounter_id, start_ms);

-- 0007_templates.sql
CREATE TABLE templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid REFERENCES organizations(id),   -- nulo = modelo do sistema
  owner_user_id      uuid REFERENCES users(id),           -- nulo = modelo da clínica
  document_type      document_type NOT NULL,
  specialty_code     text REFERENCES specialties(code),
  name               text NOT NULL,
  is_org_default     boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  archived_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_versions (                         -- imutável
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id),
  version_no  int NOT NULL,
  definition  jsonb NOT NULL,     -- {systemInstructions?, userPromptFormat? ({patient_context},{transcript}),
                                  --  body? (Markdown com @variaveis), sections:[{key,title,required}], tone, detailLevel}
  schema_version text NOT NULL,   -- versão do contrato de saída (ex.: 'evolucao.v3')
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_no)
);
ALTER TABLE templates ADD FOREIGN KEY (current_version_id) REFERENCES template_versions(id);

CREATE TABLE style_examples (                            -- RN-32 (sem identificadores)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  template_id   uuid NOT NULL REFERENCES templates(id),
  section_key   text NOT NULL,
  generated_text text NOT NULL,
  final_text    text NOT NULL,
  edit_distance real NOT NULL,                           -- 0..1
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON style_examples (user_id, template_id, section_key, created_at DESC);

-- 0008_documents.sql
CREATE TABLE documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  patient_id          uuid NOT NULL REFERENCES patients(id),
  encounter_id        uuid REFERENCES encounters(id),     -- nulo para documento avulso
  author_id           uuid NOT NULL REFERENCES users(id),
  type                document_type NOT NULL,
  subtype             text,                               -- 'AFASTAMENTO','COMPARECIMENTO','APTIDAO', ...
  status              document_status NOT NULL DEFAULT 'DRAFT',
  template_version_id uuid REFERENCES template_versions(id),
  current_version_id  uuid,
  amends_document_id  uuid REFERENCES documents(id),      -- adendo (RN-30)
  signed_at           timestamptz,
  pdf_object_key      text,
  version             int NOT NULL DEFAULT 1,             -- trava otimista (RN-31)
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON documents (patient_id, created_at DESC);
CREATE INDEX ON documents (encounter_id);

CREATE TABLE document_versions (                          -- histórico completo; o assinado é o último
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents(id),
  version_no   int NOT NULL,
  content      jsonb NOT NULL,                            -- schema por tipo (seção 4.5)
  schema_version text NOT NULL,
  origin       content_origin NOT NULL,
  decision_id  uuid,                                      -- ai_decisions.id quando origin = AI
  content_hash bytea NOT NULL,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
ALTER TABLE documents ADD FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

CREATE TABLE document_evidence (                          -- rastreabilidade frase -> transcrição (C2)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  json_pointer        text NOT NULL,                     -- '/sections/hma/sentences/2'
  status              field_status NOT NULL,
  segment_ids         uuid[] NOT NULL,                   -- pode ser vazio só se status = MISSING
  CHECK (status = 'MISSING' OR cardinality(segment_ids) > 0)
);
CREATE INDEX ON document_evidence (document_version_id);

-- 0009_prescriptions.sql
CREATE TABLE drugs (                                      -- catálogo (ANVISA/CMED), carga periódica
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_number   text,
  name              text NOT NULL,
  active_ingredient text NOT NULL,
  presentation      text,
  controlled_list   text,                                 -- 'A1','B1','C1',... (Portaria 344/98)
  default_posology  text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drugs_search ON drugs USING gin (to_tsvector('portuguese', name || ' ' || active_ingredient));

CREATE TABLE prescriptions (                               -- 1:1 com documents (type = RECEITA)
  document_id  uuid PRIMARY KEY REFERENCES documents(id),
  kind         prescription_kind NOT NULL,
  valid_until  date,                                       -- tabela de validade parametrizada (RN-34)
  notification_number text                                 -- A/B, quando aplicável
);

CREATE TABLE prescription_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES prescriptions(document_id),
  position        smallint NOT NULL,
  drug_id         uuid REFERENCES drugs(id),
  drug_name       text NOT NULL,
  presentation    text,
  posology        text NOT NULL,
  quantity        text NOT NULL,                           -- "1 caixa com 30 comprimidos"
  continuous_use  boolean NOT NULL DEFAULT false,
  confirmed_by    uuid NOT NULL REFERENCES users(id),      -- RN-33
  confirmed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, position)
);

CREATE TABLE interaction_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES prescriptions(document_id),
  checked_at       timestamptz NOT NULL DEFAULT now(),
  database_version text NOT NULL,
  findings         jsonb NOT NULL,                          -- [{a,b,severity,mechanism,recommendation}]
  max_severity     text NOT NULL CHECK (max_severity IN ('NONE','MINOR','MODERATE','MAJOR','CONTRAINDICATED')),
  acknowledged_by  uuid REFERENCES users(id),               -- obrigatório se MAJOR+ (RN-35)
  acknowledged_at  timestamptz,
  justification    text
);

-- 0010_signature_delivery.sql
CREATE TABLE signatures (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES documents(id),
  signer_id          uuid NOT NULL REFERENCES users(id),
  provider           text NOT NULL,
  status             signature_status NOT NULL DEFAULT 'AWAITING_AUTHORIZATION',
  document_hash      bytea NOT NULL,                        -- SHA-256 do PDF assinado
  certificate_subject text,
  certificate_serial text,
  signed_at          timestamptz,
  signed_pdf_key     text,
  error_code         text,
  idempotency_key    text NOT NULL UNIQUE
);

CREATE TABLE deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  document_id         uuid NOT NULL REFERENCES documents(id),
  channel             delivery_channel NOT NULL,
  recipient_enc       bytea NOT NULL,
  status              delivery_status NOT NULL DEFAULT 'QUEUED',
  link_token_hash     bytea UNIQUE,                         -- /m/{token} (RN-46)
  link_expires_at     timestamptz,
  link_failed_attempts smallint NOT NULL DEFAULT 0,
  provider_message_id text,
  sent_by             uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 0011_copilot.sql
CREATE TABLE copilot_threads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  encounter_id uuid REFERENCES encounters(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE copilot_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES copilot_threads(id),
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL,
  citations   jsonb NOT NULL DEFAULT '[]',                  -- [{chunkId, sourceName, year}]
  decision_id uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_sources (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,                                   -- "Diretriz Brasileira de Hipertensão"
  publisher text NOT NULL,
  year     int,
  license  text NOT NULL,                                   -- tipo de licença/permissão de uso (C7)
  active   boolean NOT NULL DEFAULT true
);

CREATE TABLE knowledge_chunks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  uuid NOT NULL REFERENCES knowledge_sources(id),
  title      text NOT NULL,
  content    text NOT NULL,
  embedding  vector(1536) NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', title || ' ' || content)) STORED
);
CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_chunks USING gin (tsv);

-- 0012_billing.sql
CREATE TABLE plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,                         -- 'pro_monthly','pro_yearly','clinic'
  name        text NOT NULL,
  price_cents int,                                          -- nulo = sob consulta
  currency    char(3) NOT NULL DEFAULT 'BRL',
  interval    billing_interval,
  per_seat    boolean NOT NULL DEFAULT true,
  features    jsonb NOT NULL,                               -- flags por funcionalidade
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL UNIQUE REFERENCES organizations(id),
  plan_id                  uuid REFERENCES plans(id),
  status                   subscription_status NOT NULL DEFAULT 'TRIALING',
  seats                    int NOT NULL DEFAULT 1,
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  grace_ends_at            timestamptz,                     -- PAST_DUE + 7 dias (RN-09)
  cancel_at                timestamptz,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text UNIQUE,
  provider_updated_at      timestamptz,                     -- ordenação de eventos (RN-10)
  version                  int NOT NULL DEFAULT 1
);

CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  provider_invoice_id text NOT NULL UNIQUE,
  amount_cents        int NOT NULL,
  status              text NOT NULL,                        -- 'paid','open','void','uncollectible'
  paid_at             timestamptz,
  nfse_number         text,                                 -- RN-13
  nfse_status         text
);

-- 0013_platform.sql
CREATE TABLE inbound_events (                               -- webhooks (RN-10)
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  provider_event_id text NOT NULL,
  type              text NOT NULL,
  payload           jsonb NOT NULL,                         -- sem dados de saúde
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  error             text,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE outbox (
  id           bigserial PRIMARY KEY,
  topic        text NOT NULL,                               -- 'document.ready','audit.record',...
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_pending ON outbox (id) WHERE published_at IS NULL;

CREATE TABLE idempotency_keys (
  user_id      uuid NOT NULL,
  key          text NOT NULL,
  request_hash bytea NOT NULL,
  status_code  int,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE jobs (                                         -- espelho consultável dos jobs longos
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  kind         text NOT NULL,                               -- 'generation','export','lab-import'
  status       job_status NOT NULL DEFAULT 'QUEUED',
  dedupe_key   text UNIQUE,                                 -- RN-26
  result       jsonb,                                       -- {documentId} | {exportId} | {error}
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE TABLE ai_decisions (                                 -- telemetria de IA (seção 4.6), sem prompt nem PHI
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- decisionId
  org_id         uuid NOT NULL REFERENCES organizations(id),
  kind           text NOT NULL,                             -- 'document.generate','speaker.roles',...
  subject_type   text NOT NULL,
  subject_id     uuid NOT NULL,
  model          text NOT NULL,
  model_version  text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  confidence     real CHECK (confidence BETWEEN 0 AND 1),
  risk           risk_level NOT NULL,
  action         decision_action NOT NULL,
  reasons        jsonb NOT NULL,                            -- códigos auditáveis, não texto clínico
  warnings       jsonb NOT NULL DEFAULT '[]',
  latency_ms     int,
  input_tokens   int,
  output_tokens  int,
  reviewed_by    uuid REFERENCES users(id),
  review_outcome text CHECK (review_outcome IN ('ACCEPTED','EDITED','DISCARDED')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_decisions (kind, created_at);

CREATE TABLE audit_logs (                                   -- somente inserção; particionada por mês
  id            bigserial,
  org_id        uuid NOT NULL,
  actor_user_id uuid,
  actor_type    text NOT NULL CHECK (actor_type IN ('USER','SYSTEM','PATIENT_LINK','API_KEY','SUPPORT')),
  action        text NOT NULL,                              -- 'patient.read','document.sign','export.create'
  resource_type text NOT NULL,
  resource_id   uuid,
  ip_hash       bytea,
  user_agent    text,
  metadata      jsonb NOT NULL DEFAULT '{}',                -- sem conteúdo clínico
  at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

CREATE TABLE exports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  scope        jsonb NOT NULL,                              -- {patients:'all'|[ids], formats:['pdf','fhir','csv']}
  status       job_status NOT NULL DEFAULT 'QUEUED',
  object_key   text,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE custody_transfers (                            -- C4: termo antes da eliminação
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  export_id      uuid NOT NULL REFERENCES exports(id),
  accepted_by    uuid NOT NULL REFERENCES users(id),
  term_version   text NOT NULL,
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  purge_after    timestamptz NOT NULL,                      -- +30 dias
  purged_at      timestamptz
);

CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  name         text NOT NULL,
  key_prefix   char(8) NOT NULL,
  key_hash     bytea NOT NULL UNIQUE,
  scopes       text[] NOT NULL,                              -- {'fhir:read','documents:read'}
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  type       text NOT NULL,
  payload    jsonb NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_daily (                                   -- base dos Insights (M16)
  org_id          uuid NOT NULL REFERENCES organizations(id),
  doctor_id       uuid NOT NULL REFERENCES users(id),
  day             date NOT NULL,
  encounters      int NOT NULL DEFAULT 0,
  recorded_ms     bigint NOT NULL DEFAULT 0,
  documents_signed int NOT NULL DEFAULT 0,
  appointments    int NOT NULL DEFAULT 0,
  no_shows        int NOT NULL DEFAULT 0,
  follow_ups      int NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, doctor_id, day)
);

-- 0014_rls.sql (exemplo para uma tabela; repetir em todas as tabelas com org_id)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patients
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
```

### 3.4 Relacionamentos

| Relação | Cardinalidade |
|---|---|
| `organizations` ↔ `users` via `memberships` | N:N |
| `roles` ↔ permissões via `role_permissions` | N:N |
| `users` → `doctor_profiles` | 1:1 |
| `organizations` → `patients` | 1:N |
| `patients` ↔ `users` (médicos) via `care_relationships` | N:N |
| `patients` → `patient_allergies` / `patient_medications` / `patient_conditions` / `observations` / `consents` / `lab_imports` | 1:N |
| `patients` → `appointments` → `reminders` | 1:N → 1:N |
| `appointments` → `encounters` | 1:0..1 |
| `patients` → `encounters` | 1:N |
| `encounters` → `recordings` → `audio_chunks` | 1:N → 1:N |
| `encounters` → `transcript_segments` | 1:N |
| `encounters` → `device_pairings` | 1:N (no máximo 1 viva) |
| `encounters` → `documents` | 1:N |
| `documents` → `document_versions` → `document_evidence` | 1:N → 1:N |
| `document_evidence` ↔ `transcript_segments` (por `segment_ids[]`) | N:N |
| `documents` → `prescriptions` → `prescription_items` | 1:0..1 → 1:N |
| `prescription_items` → `drugs` | N:1 |
| `documents` → `signatures` / `deliveries` | 1:N |
| `documents` → `documents` (`amends_document_id`, adendo) | 1:N |
| `templates` → `template_versions` → `documents` | 1:N → 1:N |
| `templates` → `style_examples` | 1:N |
| `knowledge_sources` → `knowledge_chunks` | 1:N |
| `copilot_threads` → `copilot_messages` | 1:N |
| `organizations` → `subscriptions` → `plans` | 1:1 → N:1 |

### 3.5 Layout no S3

```text
s3://escriba-<env>-sa-east-1/
  audio/{orgId}/{recordingId}/{seq:06}.webm        # temporário; regra de ciclo de vida de 31 dias como rede de segurança
  documents/{orgId}/{documentId}/v{n}.pdf           # object lock (governance) após assinatura
  consents/{orgId}/{consentId}.pdf
  labs/{orgId}/{labImportId}/original.pdf
  exports/{orgId}/{exportId}.zip                    # ciclo de vida de 2 dias
```

Todas as chaves usam IDs, nunca nomes de paciente. Downloads só por URL pré-assinada de 5 min, depois da checagem de permissão e do registro de auditoria.

---

## 4. Arquitetura de API e contratos

### 4.1 Convenções

| Item | Regra |
|---|---|
| Estilo | REST + JSON, base `https://api.<dominio>/api/v1`. Tempo real por WebSocket (`wss://rt.<dominio>/v1`). Streaming do Copilot por SSE |
| Especificação | OpenAPI 3.1 gerada a partir dos schemas Zod (`packages/contracts`), publicada em `/api/v1/openapi.json` |
| Autenticação (web) | Cookie `__Host-at` (access JWT, 10 min) e `__Host-rt` (refresh, `Path=/api/v1/auth`), ambos `HttpOnly; Secure; SameSite=Lax` |
| CSRF | Double-submit: cookie `csrf` legível + header `X-CSRF-Token` igual, obrigatório em métodos que mudam estado |
| Autenticação (integração) | `Authorization: Bearer <api_key>` só em `/public/v1/*` |
| Idempotência | Header `Idempotency-Key` (UUID) obrigatório em `POST` com efeito externo: gerar, assinar, enviar, checkout, exportar. Repetir a mesma chave devolve a mesma resposta por 24 h |
| Concorrência | `If-Match: "<version>"` em `PATCH`; resposta com `ETag` |
| Rastreio | `X-Request-Id` aceito e devolvido em toda resposta |
| Paginação | Cursor: `?limit=50&cursor=<opaco>`; resposta com `nextCursor` |
| Datas | ISO-8601 UTC (`2026-04-30T14:03:00Z`) |
| Erros | RFC 9457 (`application/problem+json`) com `code` estável |

**Formato de erro (todas as rotas):**

```json
{
  "type": "https://api.escriba.app/errors/validation",
  "title": "Dados inválidos",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "Um ou mais campos não passaram na validação.",
  "requestId": "01J9Z3K8V6Q2T4N7M1P0R5S8XW",
  "errors": [
    { "path": "birthDate", "code": "invalid_date", "message": "Data inválida." }
  ]
}
```

**Catálogo de códigos de erro:**

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Corpo, query ou params fora do schema |
| 401 | `UNAUTHENTICATED` | Sem sessão, ou token expirado (o cliente tenta `/auth/refresh` uma vez) |
| 401 | `MFA_REQUIRED` | Ação exige MFA recente |
| 403 | `FORBIDDEN` | Sem permissão ou sem vínculo com o paciente |
| 403 | `CSRF_FAILED` | Header CSRF ausente ou diferente |
| 403 | `SUBSCRIPTION_INACTIVE` | Conta `SUSPENDED` tentando gravar, gerar ou assinar |
| 403 | `CRM_NOT_VERIFIED` | Assinatura antes da validação do CRM (RN-07) |
| 403 | `CONSENT_REQUIRED` | Gravação sem consentimento (RN-14) |
| 404 | `NOT_FOUND` | Recurso inexistente **ou de outro tenant** (não revelar existência) |
| 409 | `VERSION_CONFLICT` | `If-Match` desatualizado |
| 409 | `SCHEDULE_CONFLICT` | Sobreposição na agenda (RN-39) |
| 409 | `RECORDING_ALREADY_ACTIVE` | RN-16 |
| 409 | `INVALID_STATE` | Transição de estado proibida (ex.: editar documento assinado) |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Mesma chave com corpo diferente |
| 410 | `PAIRING_EXPIRED` | Pareamento vencido (RN-20) |
| 422 | `TRANSCRIPT_EMPTY` | Geração sem transcrição útil |
| 422 | `AI_OUTPUT_REJECTED` | Política devolveu `REJECT` (RN-27) |
| 422 | `INTERACTION_ACK_REQUIRED` | Assinar receita com interação grave sem ciência (RN-35) |
| 422 | `CODE_MISMATCH` | Código de pareamento diferente; corpo traz `attemptsLeft` |
| 422 | `OTP_INVALID` | Código do certificado em nuvem incorreto |
| 422 | `WHATSAPP_OPT_IN_REQUIRED` | Envio por WhatsApp sem opt-in do paciente |
| 423 | `PAIRING_LOCKED` | 3 códigos errados no pareamento |
| 423 | `LINK_LOCKED` | Link do paciente bloqueado (RN-46) |
| 429 | `RATE_LIMITED` | Limite excedido; header `Retry-After` |
| 429 | `GENERATION_RATE_LIMIT` | Mais de 30 gerações por hora |
| 500 | `INTERNAL_ERROR` | Erro inesperado; corpo sem stack trace, só `requestId` |
| 502 | `UPSTREAM_UNAVAILABLE` | Provedor externo (STT, LLM, assinatura) indisponível |

### 4.2 Mapa de endpoints

| Módulo | Método e rota | Descrição |
|---|---|---|
| M01 | `POST /auth/signup` | Cria usuário e organização SOLO, envia verificação |
| M01 | `POST /auth/verify-email` | Confirma o token do e-mail e inicia o teste |
| M01 | `POST /auth/login` | Login por senha; pode devolver desafio MFA |
| M01 | `POST /auth/mfa/verify` | Conclui o login com TOTP ou passkey |
| M01 | `POST /auth/refresh` | Rotaciona o refresh e emite novo access |
| M01 | `POST /auth/logout` | Revoga a família do refresh atual |
| M01 | `GET /auth/oauth/google/start` · `GET /auth/oauth/google/callback` | Login social |
| M01 | `POST /auth/password/forgot` · `POST /auth/password/reset` | Recuperação de senha |
| M01 | `GET /me` · `GET /me/sessions` · `DELETE /me/sessions/{id}` | Perfil e dispositivos |
| M02 | `PUT /me/doctor-profile` | CRM, UF, RQE, especialidade |
| M02 | `POST /me/doctor-profile/crm-verification` | Dispara a validação de CRM |
| M02 | `POST /patients/import` | Importação CSV (assíncrona) |
| M03 | `GET/POST /org/members` · `PATCH/DELETE /org/members/{id}` | Equipe |
| M03 | `GET/POST /org/roles` · `PUT /org/roles/{id}/permissions` | Papéis e permissões |
| M04 | `GET /patients?query=&recent=true` · `POST /patients` | Busca e cadastro |
| M04 | `GET/PATCH /patients/{id}` · `POST /patients/{id}/archive` | Ficha |
| M04 | `GET /patients/{id}/timeline` | Consultas e documentos em ordem |
| M04 | `GET/POST /patients/{id}/medications` · `/allergies` · `/conditions` | Listas clínicas |
| M04 | `GET /patients/{id}/observations?code=BP_SYS,BP_DIA,HR,WEIGHT&from=&to=` | Séries para gráficos |
| M04 | `POST /patients/{id}/lab-imports` · `POST /lab-imports/{id}/review` | Importação de exame em PDF |
| M05 | `POST /patients/{id}/consents` · `POST /consents/{id}/revoke` | Consentimento |
| M05 | `POST /patients/{id}/consent-links` | Link `/m/{token}` para o paciente assinar no celular |
| M06 | `POST /encounters` · `GET /encounters?status=` · `GET/PATCH /encounters/{id}` | Consultas |
| M07 | `POST /encounters/{id}/recordings` | Abre a gravação |
| M07 | `POST /recordings/{id}/pause` · `/resume` · `/finalize` | Controle da gravação |
| M07 | `PUT /recordings/{id}/chunks/{seq}` | Envio de bloco (fila offline) |
| M07 | `POST /realtime/tickets` | Ticket para o WebSocket |
| M08 | `POST /encounters/{id}/pairings` | Cria o QR e o código |
| M08 | `POST /pairings/claim` (público, por token) | Celular reivindica o pareamento |
| M08 | `POST /pairings/{id}/confirm` | Confirmação do código |
| M08 | `DELETE /pairings/{id}` | Revoga e volta ao microfone do PC |
| M09 | `GET /encounters/{id}/transcript` · `PATCH /transcript-segments/{id}` | Leitura e correção da transcrição |
| M09 | `POST /encounters/{id}/speakers:swap` | Trocar médico ↔ paciente |
| M10 | `POST /encounters/{id}/documents:generate` | Gera um documento (assíncrono) |
| M10 | `GET /jobs/{id}` | Estado do job |
| M10 | `GET /documents/{id}` · `PATCH /documents/{id}` | Ler e editar (trava otimista) |
| M10 | `POST /documents/{id}/sections/{key}:regenerate` | Regerar uma seção |
| M10 | `POST /documents/{id}/suggestions/{sid}:accept` · `:reject` | Sugestões inline |
| M10 | `GET /documents/{id}/evidence?pointer=` | Trechos da transcrição que sustentam uma frase |
| M10 | `POST /documents/{id}/amendments` | Adendo a documento assinado |
| M11 | `GET/POST /templates` · `GET/PUT /templates/{id}` · `POST /templates/{id}/versions` | Modelos |
| M11 | `DELETE /me/style-memory?templateId=` | Zera o aprendizado de estilo |
| M11 | `POST /templates/preview` (SSE) | Prévia ao vivo do modelo com transcrição de exemplo; não grava nada (equivale ao `POST /api/templates/preview` observado no original) |
| M12 | `POST /documents/{id}/signatures` · `POST /signatures/{id}/complete` | Assinatura ICP-Brasil |
| M12 | `GET /documents/{id}/pdf` | URL pré-assinada do PDF |
| M12 | `POST /documents/{id}/deliveries` | Envio por WhatsApp ou e-mail |
| M12 | `GET /m/{token}` · `POST /m/{token}/unlock` (público) | Acesso do paciente |
| M13 | `GET /drugs?query=` | Catálogo |
| M13 | `PUT /documents/{id}/prescription` | Itens e tipo da receita |
| M13 | `POST /documents/{id}/prescription/interaction-check` · `POST /interaction-checks/{id}/acknowledge` | Interações |
| M14 | `POST /copilot/threads` · `POST /copilot/threads/{id}/messages` (SSE) | Copilot |
| M15 | `GET /appointments?from=&to=&doctorId=&view=` · `POST /appointments` | Agenda |
| M15 | `PATCH /appointments/{id}` · `POST /appointments/{id}/cancel` · `/no-show` · `/start-encounter` | Ações da agenda |
| M15 | `GET /appointments/free-slots?doctorId=&date=&duration=` | Horários livres |
| M16 | `GET /insights?from=&to=&doctorId=` · `GET /insights/export?format=csv|pdf` | Indicadores |
| M17 | `GET /billing/plans` · `GET /billing/subscription` · `POST /billing/checkout` · `POST /billing/portal` | Assinatura |
| M18 | `POST /exports` · `GET /exports/{id}` · `POST /account/custody-transfer` | Portabilidade |
| M18 | `GET /public/v1/fhir/Patient/{id}` · `/Encounter` · `/Composition` · `/DocumentReference` · `/MedicationRequest` · `/Observation` | FHIR R4 (chave de API) |
| M19 | `GET /audit-logs?resourceType=&resourceId=&from=&to=` · `GET /audit-logs/export` | Auditoria |
| M20 | `GET /notifications` · `POST /notifications/{id}/read` | Notificações |
| — | `POST /webhooks/billing` · `/webhooks/whatsapp` · `/webhooks/signature` · `/webhooks/stt` | Webhooks (assinatura HMAC) |
| — | `GET /health` · `GET /ready` | Saúde |

### 4.3 Contratos detalhados dos endpoints críticos

#### 4.3.1 `POST /api/v1/auth/signup`

Headers: `Content-Type: application/json`

```json
{
  "fullName": "Ricardo Alves",
  "email": "ricardo@exemplo.com.br",
  "password": "uma-frase-longa-e-unica",
  "acceptedTermsVersion": "2026-05",
  "acceptedPrivacyVersion": "2026-05",
  "marketingOptIn": false
}
```

`201 Created`:

```json
{
  "user": { "id": "0192f0a1-7b3c-7d2e-9f10-5a6b7c8d9e0f", "email": "ricardo@exemplo.com.br", "emailVerified": false },
  "next": "VERIFY_EMAIL"
}
```

Regras:

- Senha com no mínimo 12 caracteres, verificada contra listas de senhas vazadas (k-anonymity).
- Se o e-mail já existir, a resposta é a **mesma** `201`, e o e-mail enviado diz "você já tem conta" (não revela cadastro).

Erros: `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

#### 4.3.2 `POST /api/v1/auth/login`

```json
{ "email": "ricardo@exemplo.com.br", "password": "uma-frase-longa-e-unica" }
```

Resposta `200` sem MFA. Define os cookies `__Host-at`, `__Host-rt` e `csrf`:

```json
{
  "user": { "id": "0192f0a1-…", "fullName": "Ricardo Alves" },
  "org": { "id": "0192f0a2-…", "kind": "SOLO", "subscriptionStatus": "TRIALING", "trialEndsAt": "2026-05-07T14:00:00Z" },
  "permissions": ["patient:read", "patient:write", "document:sign", "schedule:write"]
}
```

Resposta `200` com MFA ativo (sem cookies de sessão ainda):

```json
{ "mfaRequired": true, "challengeId": "mfa_01J9Z…", "methods": ["totp", "webauthn"] }
```

Erros:

- `401 UNAUTHENTICATED`, com detalhe genérico "E-mail ou senha incorretos.";
- `429 RATE_LIMITED`.

#### 4.3.3 `POST /api/v1/encounters`

Headers: cookie, `X-CSRF-Token`

```json
{
  "patientId": "0192f0b0-…",
  "kind": "FOLLOW_UP",
  "documentType": "EVOLUCAO",
  "templateId": "0192f0c0-…",
  "appointmentId": null,
  "contextNote": "Retorno HAS"
}
```

`201 Created`:

```json
{
  "id": "0192f0d0-…",
  "status": "DRAFT",
  "patient": { "id": "0192f0b0-…", "displayName": "Maria Silva Fernandes", "age": 45, "sex": "F" },
  "consent": { "recording": "MISSING" },
  "version": 1
}
```

`consent.recording` é `VALID` ou `MISSING`. Com `MISSING`, o cliente mostra o fluxo de consentimento antes de gravar.

Erros: `403 FORBIDDEN` (sem vínculo), `403 SUBSCRIPTION_INACTIVE`, `404 NOT_FOUND`.

#### 4.3.4 `POST /api/v1/encounters/{id}/recordings`

```json
{ "source": "BROWSER", "codec": "opus", "sampleRate": 48000, "clientRecordingId": "c-7f3a…" }
```

`clientRecordingId` é gerado no cliente e garante idempotência quando a gravação foi iniciada offline.

`201 Created`:

```json
{
  "recordingId": "0192f0e0-…",
  "chunkMs": 5000,
  "maxDurationMs": 7200000,
  "realtime": { "url": "wss://rt.escriba.app/v1/stream", "ticket": "rt_9c1e…", "ticketExpiresIn": 30 }
}
```

Erros:

- `403 CONSENT_REQUIRED`;
- `409 RECORDING_ALREADY_ACTIVE`, com corpo `{ "activeEncounterId": "…" }`;
- `403 SUBSCRIPTION_INACTIVE`.

#### 4.3.5 Protocolo WebSocket `wss://rt.<dominio>/v1/stream?ticket=…`

Mensagens do cliente produtor (PC ou celular):

```json
{ "type": "start", "recordingId": "0192f0e0-…", "role": "PRODUCER", "codec": "opus", "sampleRate": 48000, "resumeFromSeq": 0 }
```

Frames de áudio são **binários**: 4 bytes `seq` (uint32 big-endian), 8 bytes `capturedAtMs` (uint64) e o payload WebM/Opus.

```json
{ "type": "pause" }
{ "type": "resume" }
{ "type": "stop" }
{ "type": "heartbeat" }
```

`heartbeat` é enviado a cada 10 s.

Mensagens do servidor:

```json
{ "type": "ack", "seq": 41 }
{ "type": "partial", "segmentKey": "s-41-0", "speaker": 0, "text": "e essa dor de cabeça", "startMs": 205000 }
{ "type": "final", "segment": { "id": "0192f0f1-…", "seq": 88, "speakerRole": "DOCTOR", "startMs": 205000, "endMs": 208400, "text": "Dona Maria, e essa dor de cabeça, como ela está nos últimos dias?", "confidence": 0.93 } }
{ "type": "speakers", "decisionId": "0192f100-…", "mapping": { "0": "DOCTOR", "1": "PATIENT" }, "action": "AUTO_EXECUTE" }
{ "type": "gap", "fromSeq": 52, "toSeq": 54 }
{ "type": "error", "code": "STT_UNAVAILABLE", "retryable": true }
```

O `ack` só é enviado depois que o bloco foi gravado no S3. O cliente mantém em IndexedDB todo bloco sem `ack`.

Assinante (PC acompanhando o celular): `{ "type": "subscribe", "encounterId": "…" }`. Recebe `partial`, `final`, `speakers` e `status`.

Códigos de fechamento: `4401` ticket inválido, `4403` sem permissão, `4409` outra gravação ativa, `4410` gravação finalizada.

#### 4.3.6 Pareamento do celular

`POST /api/v1/encounters/{id}/pairings`, chamado pelo PC, sem corpo. Resposta `201`:

```json
{
  "pairingId": "0192f110-…",
  "qrUrl": "https://escriba.app/pair/Jr8Qm1x…(43 chars base64url)",
  "code": "3975",
  "expiresAt": "2026-04-30T14:05:00Z"
}
```

`POST /api/v1/pairings/claim`, chamado pelo celular sem login, com o token tirado da URL:

```json
{ "token": "Jr8Qm1x…", "deviceInfo": { "ua": "Mozilla/5.0 (iPhone…)", "platform": "iOS" } }
```

Resposta `200`:

```json
{ "pairingId": "0192f110-…", "status": "CLAIMED", "patientInitials": "MS", "codeLength": 4 }
```

`POST /api/v1/pairings/{id}/confirm`, chamado pelo celular depois que o médico confere o código nos dois aparelhos:

```json
{ "token": "Jr8Qm1x…", "code": "3975" }
```

Resposta `200`. O `captureToken` é a *capability* de RN-21:

```json
{
  "status": "CONFIRMED",
  "recordingId": "0192f0e0-…",
  "captureToken": "cap_…",
  "realtime": { "url": "wss://rt.escriba.app/v1/stream", "ticket": "rt_…" }
}
```

Erros:

- `410 PAIRING_EXPIRED`;
- `422 CODE_MISMATCH`, com `{ "attemptsLeft": 2 }`;
- `423 PAIRING_LOCKED`, depois de 3 erros.

Ao confirmar, o PC recebe o evento `pairing.confirmed` pelo canal da consulta.

#### 4.3.7 `POST /api/v1/encounters/{id}/documents:generate`

Headers: cookie, `X-CSRF-Token`, `Idempotency-Key`

```json
{
  "type": "EVOLUCAO",
  "templateVersionId": "0192f0c1-…",
  "options": { "includePreviousEncounter": true, "detailLevel": "PADRAO" }
}
```

`202 Accepted`:

```json
{ "jobId": "0192f120-…", "status": "QUEUED", "pollUrl": "/api/v1/jobs/0192f120-…", "estimatedSeconds": 12 }
```

`GET /api/v1/jobs/{id}` quando o job termina:

```json
{
  "id": "0192f120-…",
  "kind": "generation",
  "status": "SUCCEEDED",
  "result": { "documentId": "0192f130-…" },
  "decision": { "decisionId": "0192f131-…", "action": "HUMAN_REVIEW", "confidence": 0.86, "risk": "HIGH" }
}
```

Se a política rejeitou, o job vem com `status: "FAILED"`, `result.error.code = "AI_OUTPUT_REJECTED"` e `decision.action = "REJECT"`, sem conteúdo.

Erros na criação:

- `409 INVALID_STATE` (gravação ainda ativa);
- `422 TRANSCRIPT_EMPTY`;
- `429 RATE_LIMITED`;
- `403 SUBSCRIPTION_INACTIVE`.

#### 4.3.8 `GET /api/v1/documents/{id}`

`200` (com `ETag: "3"`):

```json
{
  "id": "0192f130-…",
  "type": "EVOLUCAO",
  "status": "IN_REVIEW",
  "version": 3,
  "patient": { "id": "0192f0b0-…", "displayName": "Maria Silva Fernandes", "age": 45, "sex": "F" },
  "author": { "name": "Ricardo Alves", "crm": "125443", "crmUf": "SP" },
  "content": {
    "schemaVersion": "evolucao.v1",
    "type": "EVOLUCAO",
    "subjetivo": {
      "status": "PRESENT",
      "value": "Refere melhora da dispneia aos esforços. Mantém uso regular da medicação. PA domiciliar média de 134/82 mmHg.",
      "evidence": [{ "segmentIds": ["0192f0f1-…", "0192f0f4-…"], "quote": "melhorou bastante a falta de ar" }]
    },
    "objetivo": {
      "status": "PRESENT",
      "value": "PA 138/86 mmHg · FC 72 bpm · Peso 71,4 kg (-0,8 kg desde a última consulta).",
      "evidence": [{ "segmentIds": ["0192f0f9-…"], "quote": "cento e trinta e oito por oitenta e seis" }]
    },
    "avaliacao": {
      "status": "INFERRED",
      "value": "HAS em controle parcial.",
      "evidence": [{ "segmentIds": ["0192f0f9-…"], "quote": "ainda tá um pouquinho alta" }],
      "warning": "Avaliação deduzida da conversa; o médico não a verbalizou."
    },
    "plano": {
      "status": "PRESENT",
      "value": "Manter losartana 50 mg/dia. Solicito MAPA. Retorno em 30 dias.",
      "evidence": [{ "segmentIds": ["0192f0fc-…"], "quote": "vamos manter a losartana e pedir um MAPA" }]
    },
    "sugestoes": [
      { "id": "sg_1", "kind": "MEDICATION_LIST_UPDATE", "payload": { "name": "Losartana", "dose": "50 mg", "frequency": "1x/dia", "action": "KEEP" } }
    ]
  },
  "decision": {
    "decisionId": "0192f131-…",
    "confidence": 0.86,
    "risk": "HIGH",
    "action": "HUMAN_REVIEW",
    "reasons": ["MEDICAL_DOCUMENT_ALWAYS_REVIEWED", "ONE_INFERRED_FIELD"],
    "warnings": ["avaliacao: INFERRED"]
  }
}
```

`PATCH /api/v1/documents/{id}` usa os headers `If-Match: "3"` e `X-CSRF-Token`:

```json
{ "content": { "avaliacao": { "status": "PRESENT", "value": "HAS em controle parcial; meta não atingida.", "evidence": [] } } }
```

Quando o médico edita, a origem passa a `AI_EDITED` e o campo editado deixa de exigir evidência (o autor é o médico).
Resposta `200` com `version: 4`. Erros: `409 VERSION_CONFLICT` (corpo traz a versão atual), `409 INVALID_STATE` (já assinado).

#### 4.3.9 Assinatura

`POST /api/v1/documents/{id}/signatures`. Headers: `Idempotency-Key`, `X-CSRF-Token`.

```json
{ "provider": "birdid" }
```

`202 Accepted`:

```json
{
  "signatureId": "0192f140-…",
  "status": "AWAITING_AUTHORIZATION",
  "authorization": { "method": "OTP", "hint": "Digite o código do app do seu certificado em nuvem" }
}
```

Quando o provedor usa OAuth, a resposta vem com `{ "method": "REDIRECT", "url": "https://…" }`.

`POST /api/v1/signatures/{id}/complete`:

```json
{ "otp": "482913" }
```

`200`:

```json
{ "status": "SIGNED", "documentStatus": "SIGNED", "signedAt": "2026-04-30T14:20:11Z", "pdfUrl": "/api/v1/documents/0192f130-…/pdf" }
```

Erros:

- `403 CRM_NOT_VERIFIED`;
- `422 INTERACTION_ACK_REQUIRED`;
- `422 OTP_INVALID`;
- `502 UPSTREAM_UNAVAILABLE`.

#### 4.3.10 `POST /api/v1/documents/{id}/deliveries`

```json
{ "channel": "WHATSAPP", "to": "+5511987654321", "message": "Olá, Maria. Segue sua receita." }
```

`202`:

```json
{ "deliveryId": "0192f150-…", "status": "QUEUED", "linkExpiresAt": "2026-05-07T14:21:00Z" }
```

Erros: `409 INVALID_STATE` (documento não assinado, RN-45), `422 WHATSAPP_OPT_IN_REQUIRED`.

#### 4.3.11 `POST /api/v1/copilot/threads/{id}/messages` (SSE)

Headers: `Accept: text/event-stream`

```json
{ "content": "Pode revisar os diferenciais para essa cefaleia e checar se posso aumentar a losartana para 100 mg?", "useEncounterContext": true }
```

Stream:

```text
event: delta
data: {"text":"Considerando cefaleia frontal pulsátil vespertina…"}

event: citation
data: {"index":1,"chunkId":"0192f160-…","source":"Diretriz Brasileira de Hipertensão","year":2024}

event: done
data: {"messageId":"0192f161-…","decisionId":"0192f162-…","unsupportedClaims":0}
```

Erros: `429 RATE_LIMITED` (RN-44), `502 UPSTREAM_UNAVAILABLE`.

#### 4.3.12 `PATCH /api/v1/appointments/{id}` (arrastar para remarcar)

Header `If-Match: "2"`:

```json
{ "startsAt": "2026-05-04T13:00:00Z", "endsAt": "2026-05-04T13:30:00Z" }
```

`200` com o agendamento atualizado (`version: 3`). Resposta `409` em caso de conflito:

```json
{
  "type": "https://api.escriba.app/errors/schedule-conflict",
  "title": "Horário ocupado",
  "status": 409,
  "code": "SCHEDULE_CONFLICT",
  "conflictsWith": [{ "id": "0192f170-…", "startsAt": "2026-05-04T13:00:00Z" }],
  "suggestions": ["2026-05-04T13:30:00Z", "2026-05-04T14:00:00Z", "2026-05-04T15:30:00Z"],
  "requestId": "…"
}
```

#### 4.3.13 `POST /api/v1/billing/checkout` e webhook

```json
{ "planCode": "pro_yearly", "seats": 1, "paymentMethods": ["card", "pix", "boleto"] }
```

`200`:

```json
{ "checkoutUrl": "https://checkout.provedor.com/c/…" }
```

`POST /api/v1/webhooks/billing` (header de assinatura do provedor):

- assinatura inválida: `401`;
- evento repetido: `200` sem efeito;
- evento processado: o worker atualiza `subscriptions` só se `event.created >= provider_updated_at` (RN-10).

#### 4.3.14 `POST /api/v1/exports`

Headers: `Idempotency-Key`; MFA recente obrigatório (RN-04).

```json
{ "scope": { "patients": "all" }, "formats": ["pdf", "fhir", "csv"] }
```

`202`:

```json
{ "exportId": "0192f180-…", "status": "QUEUED" }
```

Quando pronto, `GET /exports/{id}` devolve `{ "status": "SUCCEEDED", "downloadUrl": "…", "expiresAt": "…" }`. O link vale 24 h.

### 4.4 Exemplos de erro por status

```json
{ "type": "https://api.escriba.app/errors/unauthenticated", "title": "Sessão expirada", "status": 401, "code": "UNAUTHENTICATED", "requestId": "…" }
```

```json
{ "type": "https://api.escriba.app/errors/forbidden", "title": "Acesso negado", "status": 403, "code": "FORBIDDEN", "detail": "Você não tem vínculo com este paciente.", "requestId": "…" }
```

```json
{ "type": "https://api.escriba.app/errors/internal", "title": "Erro inesperado", "status": 500, "code": "INTERNAL_ERROR", "detail": "Tente novamente. Se persistir, informe o código ao suporte.", "requestId": "01J9Z3K8V6Q2T4N7M1P0R5S8XW" }
```

### 4.5 Contrato dos documentos (saída da IA)

Os schemas ficam em `packages/contracts` e são a **única** fonte de verdade: a API, o worker, o frontend e o prompt
(saída estruturada do LLM) usam o mesmo schema. Texto livre nunca é contrato.

```ts
// packages/contracts/src/documents.ts
import { z } from "zod";

export const Evidence = z.object({
  segmentIds: z.array(z.string().uuid()).min(1),
  quote: z.string().min(1).max(300), // trecho literal da transcrição
});

// Extração: PRESENT, INFERRED ou MISSING. MISSING é sempre null; INFERRED exige evidência e aviso.
export const ClinicalField = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PRESENT"), value: z.string().min(1), evidence: z.array(Evidence).min(1) }),
  z.object({
    status: z.literal("INFERRED"),
    value: z.string().min(1),
    evidence: z.array(Evidence).min(1),
    warning: z.string().min(1),
  }),
  z.object({ status: z.literal("MISSING"), value: z.null() }),
]);

export const Suggestion = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("MEDICATION_LIST_UPDATE"),
    payload: z.object({
      name: z.string(),
      dose: z.string().nullable(),
      frequency: z.string().nullable(),
      action: z.enum(["START", "KEEP", "CHANGE", "STOP"]),
    }),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("ALLERGY"),
    payload: z.object({ substance: z.string(), reaction: z.string().nullable() }),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("VITAL_SIGN"),
    payload: z.object({ code: z.enum(["BP_SYS", "BP_DIA", "HR", "WEIGHT", "HEIGHT", "TEMP", "SPO2"]), value: z.number(), unit: z.string() }),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("PHYSICAL_EXAM_PROMPT"),
    payload: z.object({ text: z.string() }), // RN-28: sugestão, nunca preenche o exame
  }),
  z.object({
    id: z.string(),
    kind: z.literal("RED_FLAG"),
    payload: z.object({ text: z.string(), ruleId: z.string().nullable() }),
  }),
]);

const Base = { schemaVersion: z.string(), sugestoes: z.array(Suggestion).default([]) };

export const Anamnese = z.object({
  ...Base,
  type: z.literal("ANAMNESE"),
  queixaPrincipal: ClinicalField,
  hma: ClinicalField,
  antecedentesPessoais: ClinicalField,
  antecedentesFamiliares: ClinicalField,
  medicacoesEmUso: ClinicalField,
  alergias: ClinicalField,
  habitos: ClinicalField,
  revisaoDeSistemas: ClinicalField,
  exameFisico: ClinicalField, // MISSING quando não foi falado: "Não relatado"
  hipotesesDiagnosticas: z.array(
    z.object({ texto: z.string(), cid10: z.string().regex(/^[A-Z]\d{2}(\.?\d)?$/).nullable(), evidence: z.array(Evidence).min(1) }),
  ),
  plano: ClinicalField,
});

export const Evolucao = z.object({
  ...Base,
  type: z.literal("EVOLUCAO"),
  subjetivo: ClinicalField,
  objetivo: ClinicalField,
  avaliacao: ClinicalField,
  plano: ClinicalField,
});

export const ReceitaItem = z.object({
  drugName: z.string(),
  drugId: z.string().uuid().nullable(), // casado com o catálogo; null = não encontrado
  presentation: z.string().nullable(),
  posology: z.string().nullable(), // null: o médico preenche (nunca inventado)
  quantity: z.string().nullable(),
  continuousUse: z.boolean().nullable(),
  evidence: z.array(Evidence).min(1),
});

export const Receita = z.object({
  ...Base,
  type: z.literal("RECEITA"),
  itens: z.array(ReceitaItem),
  orientacoes: ClinicalField,
});

export const Atestado = z.object({
  ...Base,
  type: z.literal("ATESTADO"),
  subtipo: z.enum(["AFASTAMENTO", "COMPARECIMENTO", "APTIDAO"]),
  dias: z.number().int().min(0).max(365).nullable(),
  inicio: z.string().date().nullable(),
  horario: z.object({ inicio: z.string(), fim: z.string() }).nullable(), // comparecimento
  cid10: z.string().nullable(), // só renderizado se cidAuthorizedAt existir (RN-36)
  cidAuthorizedAt: z.string().datetime().nullable(),
  atividade: z.string().nullable(), // aptidão
});

export const Encaminhamento = z.object({
  ...Base,
  type: z.literal("ENCAMINHAMENTO"),
  especialidadeDestino: ClinicalField,
  carater: z.enum(["ELETIVO", "PRIORITARIO", "URGENTE"]).nullable(),
  hipoteseDiagnostica: ClinicalField,
  cid10: z.string().nullable(),
  resumoDoCaso: ClinicalField,
  examesRecentes: ClinicalField,
  medicacoesEmUso: ClinicalField,
  solicitacao: ClinicalField,
});

// Laudo e documento personalizado: seções vêm da definição do modelo
export const SecoesDoModelo = z.object({
  ...Base,
  type: z.enum(["LAUDO", "PERSONALIZADO"]),
  secoes: z.record(z.string(), ClinicalField),
});

export const DocumentContent = z.discriminatedUnion("type", [
  Anamnese, Evolucao, Receita, Atestado, Encaminhamento,
  SecoesDoModelo.extend({ type: z.literal("LAUDO") }),
  SecoesDoModelo.extend({ type: z.literal("PERSONALIZADO") }),
]);
```

Validações depois do schema, determinísticas, no worker:

1. Todo `segmentId` citado pertence à consulta. Se algum não pertencer, o documento inteiro é rejeitado (RN-27).
2. Todo `quote` aparece de forma aproximada (similaridade ≥ 0,8) no texto dos segmentos citados.
3. Todo `cid10` existe na tabela DATASUS; se não existir, vira `null` com aviso (RN-38).
4. Todo `drugId` existe no catálogo; se não existir, vira `null` com aviso.
5. Números de sinais vitais estão dentro de faixas fisiológicas (ex.: PA sistólica 50–300). Fora disso, `INFERRED` com aviso.

### 4.6 Contrato das decisões de IA e política

Toda chamada de modelo cuja saída é usada pelo software produz um envelope tipado e um registro em `ai_decisions`.
A **proposta** (modelo) fica separada da **política** (código determinístico que autoriza a ação).

```ts
// packages/contracts/src/decision.ts
export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const DecisionAction = z.enum(["AUTO_EXECUTE", "HUMAN_REVIEW", "REJECT"]);

export const AiDecision = z.object({
  decisionId: z.string().uuid(),
  kind: z.enum([
    "speaker.roles", "document.generate", "document.section.regenerate",
    "prescription.extract", "cid10.suggest", "referral.specialty",
    "redflag.detect", "lab.extract", "copilot.answer",
  ]),
  model: z.string(),
  modelVersion: z.string(),
  promptVersion: z.string(),
  schemaVersion: z.string(),
  confidence: z.number().min(0).max(1), // sinal operacional, não probabilidade de acerto
  risk: RiskLevel,
  action: DecisionAction,
  reasons: z.array(z.string()).min(1), // códigos auditáveis
  warnings: z.array(z.string()),
  createdAt: z.string().datetime(),
});
```

```ts
// apps/api/src/modules/ai/policy.ts
type PolicyInput = {
  kind: AiDecision["kind"];
  schemaValid: boolean;
  deterministicRulesValid: boolean;
  requiredEvidencePresent: boolean;
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  highImpact: boolean; // médico, jurídico, financeiro, irreversível
};

export const THRESHOLDS = { autoExecute: 0.95, humanReview: 0.7 } as const; // calibrar por kind (ver 4.7)

export function decide(i: PolicyInput): { action: DecisionAction; reasons: string[] } {
  if (!i.schemaValid) return { action: "REJECT", reasons: ["SCHEMA_INVALID"] };
  if (!i.deterministicRulesValid) return { action: "REJECT", reasons: ["RULE_VIOLATION"] };
  if (!i.requiredEvidencePresent) return { action: "REJECT", reasons: ["EVIDENCE_MISSING"] };
  if (i.risk === "HIGH" || i.highImpact) return { action: "HUMAN_REVIEW", reasons: ["HIGH_RISK_OR_IMPACT"] };
  if (i.confidence >= THRESHOLDS.autoExecute && i.risk === "LOW") return { action: "AUTO_EXECUTE", reasons: ["HIGH_CONFIDENCE_LOW_RISK"] };
  if (i.confidence >= THRESHOLDS.humanReview) return { action: "HUMAN_REVIEW", reasons: ["MEDIUM_CONFIDENCE"] };
  return { action: "REJECT", reasons: ["LOW_CONFIDENCE"] };
}
```

Aplicação por tipo de decisão:

| `kind` | Risco | Alto impacto? | Ações possíveis | Efeito em cada ação |
|---|---|---|---|---|
| `speaker.roles` | LOW | Não (rótulo editável) | AUTO / REVIEW / REJECT | AUTO: aplica os rótulos. REVIEW: rótulos aplicados com botão "Trocar falantes" em destaque. REJECT: "Falante 1/2" |
| `document.generate` | HIGH | Sim (médico) | REVIEW / REJECT | REVIEW: abre no editor como `IN_REVIEW`. **Nunca** AUTO |
| `prescription.extract` | HIGH | Sim | REVIEW / REJECT | Itens propostos; cada um exige confirmação |
| `cid10.suggest` | HIGH | Sim | REVIEW / REJECT | Código fora da tabela: REJECT do código, mantém o texto |
| `referral.specialty` | MEDIUM | Sim | REVIEW / REJECT | Pré-seleciona; o médico confirma |
| `redflag.detect` | HIGH | Sim | REVIEW | Alerta visível; nunca suprimido em silêncio. Regras fixas por queixa somadas ao modelo |
| `lab.extract` | HIGH | Sim | REVIEW / REJECT | Valores entram no gráfico só depois da revisão |
| `copilot.answer` | MEDIUM | Não age sozinho | REVIEW | Resposta exibida; inserir no documento exige aceite (RN-43) |

**Telemetria:** em `ai_decisions` e nos logs estruturados, registrar `decisionId`, `kind`, modelo, versão do modelo,
versão do prompt, versão do schema, confiança, risco, ação, motivos, latência, tokens, timestamp e o resultado da revisão
(`ACCEPTED`, `EDITED` ou `DISCARDED`).

**Não registrar:** prompts completos, transcrição, conteúdo de documento, nome ou identificadores do paciente,
nem chaves de API.

### 4.7 O que precisa ser calibrado com dados reais

| Valor | Default | Como calibrar |
|---|---|---|
| `autoExecute` em `speaker.roles` | 0,95 | Taxa de "Trocar falantes" depois de AUTO; meta < 2 % |
| `humanReview` geral | 0,70 | Curva de cobertura × erro por `kind` em um conjunto rotulado por médicos |
| Confiança mínima de segmento (RN-24) | 0,40 | Comparar com correções manuais de transcrição |
| Similaridade de `quote` | 0,8 | Falsos REJECT × alucinações detectadas em revisão |
| Exemplos de estilo (RN-32) | 3 | Distância de edição média antes × depois |
| Métricas a acompanhar por `kind` | — | Falso positivo, falso negativo, cobertura de automação, taxa de revisão, taxa de descarte, mudança de distribuição (especialidade, duração, ruído) |

---

## 5. Frontend e identidade visual

### 5.1 Design tokens

Valores extraídos do CSS público [O]. A paleta de marca é âmbar e verde-água sobre fundo creme ("papel quente"),
com tinta marrom-escura no lugar do preto. No projeto novo, **mantenha a estrutura de tokens e troque os valores de
marca** para ter identidade própria [R].

#### Cores de marca (hex) [O]

| Token | Valor | Uso |
|---|---|---|
| `--brand-amber` / `--amber` | `#FF9F1C` | Ação primária, foco, destaque do gravador |
| `--amber-soft` | `#FFB547` | Hover da ação primária |
| `--brand-honey` / `--honey` | `#FFBF69` | Realces, gráficos |
| `--honey-pale` | `#FFE0B8` | Fundo de destaque suave (ex.: campo `INFERRED`) |
| `--brand-sea` / `--sea` | `#2EC4B6` | Estado positivo, gravação ok, gráficos |
| `--sea-deep` / `--success` | `#1FA194` | Sucesso |
| `--brand-frozen` / `--frozen` | `#CBF3F0` | Fundo informativo |
| `--frozen-pale` | `#E8F8F6` | Fundo informativo suave |
| `--danger` | `#C43F3F` | Erro, red flag, gravando (ponto pulsante) |
| `--brand-ink` / `--ink` | `#1A1614` | Texto principal |
| `--ink-2` | `#3E3832` | Texto secundário forte |
| `--ink-3` | `#6B6359` | Texto secundário |
| `--ink-4` | `#9A9082` | Texto terciário, placeholders |
| `--ink-5` | `#C2B8A9` | Desabilitado |
| `--brand-canvas` / `--canvas` | `#FBF8F3` | Fundo da página |
| `--surface` | `#FFFCF7` | Superfície elevada |
| `--paper` | `#FFFFFF` | Documento clínico (folha) |
| `--line` | `#EAE3D6` | Divisórias |
| `--line-strong` | `#D9CFBD` | Bordas de campo |
| `theme-color` (PWA) | `#F2EADD` | Barra do navegador e splash |

#### Tokens semânticos (padrão shadcn/ui, HSL) [O]

| Token | Claro | Escuro |
|---|---|---|
| `--background` | `36 45% 97%` | `20 25% 7%` |
| `--foreground` | `17 16% 9%` | `36 45% 92%` |
| `--card` / `--popover` | `0 0% 100%` | `20 20% 10%` |
| `--card-foreground` | `17 16% 9%` | `36 45% 92%` |
| `--primary` | `32 100% 55%` | `32 100% 55%` |
| `--primary-foreground` | `0 0% 100%` | `17 16% 9%` |
| `--secondary` / `--accent` | `35 40% 92%` | `20 15% 15%` |
| `--muted` | `35 40% 94%` | `20 15% 13%` |
| `--muted-foreground` | `20 8% 45%` | `30 15% 65%` |
| `--border` / `--input` | `34 35% 89%` | `20 15% 17%` |
| `--ring` | `32 100% 55%` | `32 100% 55%` |
| `--destructive` | `0 72% 51%` | `0 72% 51%` |
| `--warm-tint` | `36 45% 93%` | `20 18% 13%` |
| `--line-strong` | `35 25% 80%` | `20 15% 22%` |

O tema escuro é ativado por `html[data-theme="dark"]` [O], com preferência salva no navegador e padrão do sistema operacional [R].

> **Acessibilidade [R]:** o âmbar `#FF9F1C` sobre branco tem contraste ~2:1 e o verde-água `#2EC4B6` ~2,2:1.
> Nenhum dos dois serve para texto. Use os dois como **preenchimento** com texto `--ink`, e crie tons escuros
> (ex.: `#B36200` e `#127A70`) para texto e ícones, garantindo 4,5:1 (WCAG AA).

#### Tipografia [O]

| Papel | Fonte | Uso |
|---|---|---|
| `--font-display` | Instrument Serif (com fallback "Iowan Old Style", Georgia, serif) | Títulos, números grandes, frases de destaque (itálico no hero) |
| `--font-ui` | Geist Sans (com fallback -apple-system, Segoe UI, sans-serif) | Interface, corpo de texto, formulários |
| `--font-mono` | Geist Mono (com fallback SF Mono, Menlo, monospace) | Cronômetro, metadados em caixa alta ("MARIA SILVA · 45F · 30 ABR 2026"), códigos (CRM, CID) |

Escala tipográfica [R] (rem, base 16 px):

| Token | Tamanho / altura de linha | Uso |
|---|---|---|
| `text-xs` | 12 / 16 | Metadados mono, legendas |
| `text-sm` | 14 / 20 | Rótulos, tabelas |
| `text-base` | 16 / 24 | Corpo, documento clínico |
| `text-lg` | 18 / 28 | Subtítulos |
| `text-xl` | 20 / 28 | Títulos de card |
| `text-2xl` | 24 / 32 | Títulos de seção (display) |
| `text-4xl` | 36 / 40 | Título de página (display) |
| `text-6xl` | 60 / 64 | Hero (display) |

#### Espaçamento, raio, sombra e movimento

| Grupo | Valores |
|---|---|
| Espaçamento [R] | Base de 4 px: `1=4`, `2=8`, `3=12`, `4=16`, `5=20`, `6=24`, `8=32`, `10=40`, `12=48`, `16=64`, `24=96` |
| Raio [O] | `--radius-sm: 8px`, `--radius-md: 12px` (padrão `--radius`), `--radius-lg: 16px` |
| Sombra [O] (marrom quente, nunca preta) | `--shadow-sm: 0 1px 2px rgba(61,40,15,.04), 0 1px 1px rgba(61,40,15,.03)`<br>`--shadow: 0 2px 8px rgba(61,40,15,.06), 0 1px 2px rgba(61,40,15,.04)`<br>`--shadow-lg: 0 12px 32px rgba(61,40,15,.10), 0 4px 12px rgba(61,40,15,.06)`<br>`--shadow-xl: 0 24px 64px rgba(61,40,15,.14), 0 8px 24px rgba(61,40,15,.08)` |
| Movimento | Transições de 150 a 250 ms com `ease-out`. Respeitar `prefers-reduced-motion: reduce` [O], que desliga animações de onda e pulsos |

#### Responsividade

| Breakpoint | Largura | Comportamento [R] |
|---|---|---|
| base | < 640 px | Celular: navegação inferior, uma coluna, página `/record` em retrato (o manifest fixa `portrait`) [O] |
| `sm` | 640 px | Celular grande |
| `md` | 768 px | iPad retrato: barra lateral recolhida em ícones |
| custom | 720 px e 1100 px [O] | Quebras do site público (seções lado a lado) |
| `lg` | 1024 px | iPad paisagem e notebook: barra lateral aberta; consulta em 2 colunas |
| custom | 1240 px [O] | Largura máxima do conteúdo do site público |
| `xl` | 1280 px | Desktop: consulta em 3 colunas (contexto, gravação e transcrição, documento e Copilot) |
| `2xl` | 1536 px | Desktop largo: agenda semanal com mais colunas |

Regras gerais:

- Alvo de toque mínimo de 44 × 44 px.
- `viewport-fit=cover` com `env(safe-area-inset-*)` [O].
- Sem rolagem horizontal da página; tabelas largas rolam dentro do próprio contêiner.

#### Configuração Tailwind (trecho)

```ts
// packages/ui/tailwind.preset.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        destructive: "hsl(var(--destructive))",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)", 4: "var(--ink-4)", 5: "var(--ink-5)" },
        amber: { DEFAULT: "var(--amber)", soft: "var(--amber-soft)" },
        honey: { DEFAULT: "var(--honey)", pale: "var(--honey-pale)" },
        sea: { DEFAULT: "var(--sea)", deep: "var(--sea-deep)" },
        frozen: { DEFAULT: "var(--frozen)", pale: "var(--frozen-pale)" },
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        paper: "var(--paper)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)" },
      boxShadow: { sm: "var(--shadow-sm)", DEFAULT: "var(--shadow)", lg: "var(--shadow-lg)", xl: "var(--shadow-xl)" },
      screens: { tablet: "720px", wide: "1100px", content: "1240px" },
    },
  },
} satisfies Partial<Config>;
```

### 5.2 Estrutura de telas do `/app`

As telas marcadas [O] estão descritas em detalhe na seção 0.4. A navegação é por **barra superior**: Consultas, Agenda, Pacientes, Modelos, Ajustes, "+ Nova consulta", notificações e avatar. No celular, as abas viram navegação inferior [R].

| Rota | Tela | Marca |
|---|---|---|
| `/app` | Consultas: saudação, 4 indicadores, "Iniciar consulta ▾" (Presencial/Teleconsulta), consultas recentes com filtros | [O] |
| `/app/consulta/nova` | Paciente opcional (nome, idade, sexo, salvar como novo), tipo de documento, resumo, "Iniciar gravação" | [O] |
| `/app/consulta/gravando?id=` | Permissão do microfone e gravação | [O] parcial |
| `/app/consulta/[id]` | Documento: revisão, atribuição do paciente, edição; assinatura e envio [R] | [I] |
| `/app/agenda` | Filtros por tipo e status, visões Dia/Semana/Mês/Lista, diálogo de agendamento | [O] |
| `/app/pacientes` | Mestre-detalhe: lista, ficha com sinais vitais, abas Timeline/Documentos/Laudos/Medicações, coluna clínica | [O] |
| `/app/modelos` | Mestre-detalhe por categoria; editor com instruções, formato da pergunta e prévia ao vivo | [O] |
| `/app/ajustes` | Perfil (nome, e-mail, CRM/UF, especialidade). No projeto novo também: segurança, retenção do áudio, plano, equipe, exportação e auditoria [R] | [O] + [R] |
| `/app/insights` | Indicadores (não existe no original) | [R] |
| `/pair/[token]` · `/record/[captureToken]` | Celular como microfone (não visto no original) | [I] |
| `/m/[token]` | Acesso do paciente (não visto no original) | [I] |
| `/login` · `/signup` · `/onboarding` | Acesso e configuração inicial | [I] |

### 5.3 Componentes reutilizáveis

| Componente | Base | Comportamento e variações |
|---|---|---|
| `Button` | shadcn | `primary` (âmbar, texto ink), `secondary`, `ghost`, `destructive`, `link`; tamanhos `sm`, `md`, `lg`, `icon`; estado `loading` com spinner e `aria-busy` |
| `Input`, `Textarea` (altura automática), `Select`, `Checkbox`, `RadioGroup`, `Switch` | shadcn + React Hook Form | Erro inline com `aria-describedby` |
| `DateInput` / `DateTimePicker` | shadcn Calendar | pt-BR, formato `dd/mm/aaaa`, fuso da clínica |
| `MaskedInput` | — | CPF, telefone E.164, CRM + UF |
| `PatientCombobox` | cmdk | Busca por nome ou CPF, "Recentes" no topo, "Criar paciente" inline |
| `Avatar` | — | Iniciais ("MS") com cor derivada do id, nunca foto por padrão |
| `Badge` / `StatusPill` | — | Estados de consulta, documento, agenda e assinatura |
| `Card`, `Panel`, `Section` | — | Superfície com `--shadow` e `--radius-md` |
| `Dialog` / `Modal` genérico | Radix | Foco preso, `Esc` fecha, variante `confirm` para ações destrutivas |
| `Sheet` / `Drawer` | Radix / vaul | Painéis laterais no desktop (Copilot) e inferiores no celular |
| `Toast` | sonner [O] | Sucesso, erro com `requestId` copiável, ação "Desfazer" |
| `Tabs`, `SegmentedControl` | Radix | Mensal / Anual; Dia / Semana / Mês / Lista |
| `ProgressSteps` | — | "1 Configurar · 2 Gravar · 3 Receber documento" [O] |
| `StatCard` de indicador | — | Rótulo mono em caixa alta, número grande em serifa, linha de apoio com ícone ("próxima às 11:25") [O] |
| `FilterPills` | — | Pílulas com contagem ("Todas 0", "Primeira consulta 0") [O] |
| `ChoiceCard` | — | Cartão selecionável com ícone, título, descrição e marcação circular âmbar (tipo de documento, tipo de agendamento) [O] |
| `MasterDetail` | — | Lista à esquerda, detalhe ao centro, painel opcional à direita (Pacientes, Modelos) [O] |
| `TemplateEditor` | TipTap | Instruções ao modelo com "Inserir variável", formato da pergunta, prévia ao vivo em streaming com transcrição de exemplo [O] |
| `VariableChip` | — | `@paciente.nome` em fonte mono com fundo âmbar claro (paciente) ou verde-água claro (médico, data) [O] |
| `GenerationProgress` | — | Barra indeterminada com etapas ("Organizando seções…") e ETA |
| `RecorderControl` | — | Botão gravar / pausar / retomar / finalizar; cronômetro mono; medidor de nível; origem ("Consultório 2 · Microfone embutido") [O]; estado offline com contador de blocos pendentes |
| `LiveTranscript` | — | Falas com rótulo de papel (Dr./Pac./Acomp.), rolagem automática que pausa quando o usuário rola, destaque de baixa confiança, botão "Trocar falantes" |
| `PairingDialog` | — | QR, código grande em mono com dígitos espaçados, contagem regressiva, "Aguardando celular…", "Voltar para o microfone do PC" [O] |
| `ConsentSheet` | — | Termo, envio de link ao paciente, opção de consentimento verbal com confirmação |
| `DocumentEditor` | TipTap/ProseMirror | Seções com título; texto editável inline; campo `INFERRED` com fundo `--honey-pale` e ícone de aviso; campo `MISSING` com placeholder "Não relatado"; ao passar o cursor numa frase, popover com os trechos da transcrição; sugestões com aceitar e rejeitar; salvamento automático com indicador |
| `SuggestionList` | — | Atualizações de medicação, alergia, sinais vitais e red flags para confirmar |
| `PrescriptionEditor` | — | Lista ordenável de itens; busca no catálogo; seleção do tipo de receita; resultado da checagem de interações com níveis de gravidade |
| `SignatureDialog` | — | Escolha do provedor, OTP ou redirecionamento, estados de erro |
| `DeliveryDialog` | — | WhatsApp ou e-mail, mensagem editável, status de entrega |
| `CopilotPanel` | — | Chat em streaming, chips de citação, selo "sem fonte", "Inserir no documento como sugestão" |
| `DataTable` | TanStack Table | Ordenar, filtrar, paginar por cursor, seleção, colunas responsivas, estado vazio e esqueleto |
| `Calendar` (agenda) | dnd-kit | Visões dia, semana, mês e lista; arrastar e redimensionar; conflito com tremida e toast; linha da hora atual |
| `VitalsChart` | Recharts | Séries PA (sistólica e diastólica), FC e peso; faixa de referência; tooltip com origem |
| `Timeline` | — | Consultas e documentos por data |
| `StatCard` (KPI) | — | Valor em display, variação, sparkline |
| `PlanCard` + `BillingToggle` | — | Preços mensal e anual, plano em destaque |
| `FileDropzone` | — | PDF/JPG/PNG, limite de tamanho, progresso |
| `EmptyState`, `Skeleton`, `ErrorState` | — | Padrões de estado |
| `CommandMenu` | cmdk | ⌘K: buscar paciente, nova consulta, ir para tela |
| `ThemeToggle` | — | Claro, escuro e sistema |
| `TrialBanner` | — | Dias restantes do teste, chamada para assinar |
| `IdleLock` | — | Tela de bloqueio por inatividade (RN-02) |

---

## 6. Segurança e stack

### 6.1 Mecanismos de segurança

#### Autenticação e sessão

- Senha com **Argon2id** (memória ≥ 64 MB, t=3), mínimo de 12 caracteres e checagem contra senhas vazadas.
- Login social Google por OIDC com PKCE.
- Access JWT de 10 min (assinado com ES256, chave rotacionada por `kid`) e refresh opaco com rotação e detecção de reuso (RN-01).
- Cookies `__Host-` com `HttpOnly; Secure; SameSite=Lax`, sem `Domain`.
- CSRF por double-submit em toda mutação.
- MFA por TOTP e passkeys (WebAuthn). MFA "recente" (≤ 10 min) exigido para exportação, mudança de e-mail e gestão de equipe.
- Bloqueio por inatividade (RN-02) e listagem e revogação de sessões.

#### Autorização

- RBAC por organização (`roles`, `role_permissions`) e checagem de vínculo com o paciente (RN-47) em todo caso de uso.
- RLS no Postgres como segunda barreira: a conexão define `SET LOCAL app.org_id` por transação.
- Recurso de outro tenant responde `404`, nunca `403`.
- Capabilities de escopo mínimo para celular pareado e link do paciente (RN-21, RN-46).

#### Criptografia

| Camada | Medida |
|---|---|
| Em trânsito | TLS 1.3 (mínimo 1.2) em todas as bordas; HSTS com `preload` |
| Em repouso | RDS, S3 e Redis cifrados com AES-256 via KMS; uma chave KMS por organização para envelope dos campos sensíveis |
| Campos sensíveis | CPF, RG, telefone, e-mail e endereço do paciente cifrados na aplicação, com índices cegos HMAC para busca |
| Áudio | Cifrado no S3, apagado pela retenção (RN-17); no cliente, IndexedDB com blocos cifrados por chave efêmera da sessão (WebCrypto AES-GCM) |
| Documentos assinados | PAdES ICP-Brasil, S3 com *object lock* e hash SHA-256 registrado |

#### OWASP Top 10 (2021)

| Risco | Controle |
|---|---|
| A01 Quebra de controle de acesso | Autorização centralizada por caso de uso, RLS, testes de autorização para cada rota (matriz papel × ação) |
| A02 Falhas criptográficas | Ver tabela de criptografia; segredos no Secrets Manager, nunca no bundle do frontend |
| A03 Injeção (SQLi, XSS, prompt) | ORM com parâmetros, sem SQL concatenado; React escapa por padrão; HTML do editor saneado (DOMPurify) e renderizado por whitelist de nós; transcrição delimitada como dado no prompt (RN-25); saída do LLM validada por schema |
| A04 Design inseguro | Modelagem de ameaças por módulo; política de IA separada da proposta (4.6) |
| A05 Configuração insegura | Cabeçalhos (abaixo), sem stack trace em produção, imagens mínimas (distroless), varredura de IaC |
| A06 Componentes vulneráveis | Renovate, `npm audit`/OSV no CI, SBOM (CycloneDX), varredura de imagens (Trivy) |
| A07 Falhas de autenticação | Limite de taxa, bloqueio progressivo, MFA, rotação de refresh |
| A08 Integridade de software e dados | Webhooks com HMAC, idempotência, commits e imagens assinados, lockfile |
| A09 Falhas de log e monitoramento | Auditoria de acesso a dados de saúde (RN-48), alertas de anomalia (ex.: exportação em massa, muitos `403`) |
| A10 SSRF | Worker de PDF sem rede; nenhuma URL de usuário é buscada pelo servidor; lista de destinos de saída permitidos no egress |

#### Cabeçalhos HTTP do `/app`

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}' 'strict-dynamic';
  connect-src 'self' https://api.<dominio> wss://rt.<dominio>; img-src 'self' data: blob:;
  media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: microphone=(self), camera=(self), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

Analytics de terceiros (GA4, Clarity) **nunca** carregam em `/app`, `/pair`, `/record` e `/m`.
O produto de referência já limita o Clarity às páginas públicas [O]; replicar isso com um teste automatizado.

#### Uploads

- Lista de tipos permitidos (PDF, JPEG, PNG) verificada pelo conteúdo (magic bytes), não pela extensão.
- Limite de 20 MB.
- EXIF removido das imagens.
- Antivírus (ClamAV) no worker antes de qualquer processamento.
- Arquivos guardados com nome gerado e servidos com `Content-Disposition: attachment`.

#### Específico de IA

- Identificadores do paciente removidos antes de qualquer chamada ao provedor (RN-42).
- Contratos com os provedores sem retenção de dados e sem treino com os dados (*zero data retention*).
- Saída validada por schema e por regras determinísticas antes de qualquer efeito (4.5, 4.6).
- O modelo não chama ferramentas que alterem dados; só propõe.

#### Logs e observabilidade

- Logs estruturados em JSON com `requestId`, `orgId` (hash), rota, status e latência.
- Nunca registrar corpo de requisição, transcrição, conteúdo de documento nem identificadores.
- O Sentry (ou similar) roda com `beforeSend` que remove corpo e query.
- Traces OpenTelemetry com atributos na lista permitida.

#### Continuidade

- RDS Multi-AZ com PITR de 35 dias e snapshots diários.
- Backups na mesma região `sa-east-1` (residência), com cópia em conta AWS separada e imutável.
- Restauração testada a cada trimestre.
- RPO ≤ 5 min, RTO ≤ 4 h.

#### LGPD e regulação

| Tema | Requisito |
|---|---|
| Papéis | Médico ou clínica é **controlador** dos dados dos pacientes; a empresa é **operadora** (contrato de tratamento de dados). Para dados da conta do médico, a empresa é controladora |
| Base legal | Dados de saúde do paciente: art. 11, II, "f" (tutela da saúde, por profissional de saúde). Gravação com consentimento específico (RN-14) |
| Documentação | Registro das operações de tratamento, RIPD (relatório de impacto), lista pública de suboperadores (STT, LLM, WhatsApp, e-mail, billing) |
| Direitos do titular | Canal para acesso, correção e portabilidade, atendido via médico controlador |
| Incidentes | Plano de resposta; comunicação à ANPD e aos titulares no prazo da Resolução CD/ANPD 15/2024 |
| Encarregado (DPO) | Nomeado e publicado |
| Prontuário | Guarda mínima de 20 anos (Lei 13.787/2018); Res. CFM 1.821/2007 (prontuário eletrônico; sem papel exige certificação SBIS-NGS2) |
| Documentos eletrônicos | Res. CFM 2.299/2021 (prescrição e atestado eletrônicos com assinatura ICP-Brasil); MP 2.200-2/2001 (ICP-Brasil) |
| Atestado | Res. CFM 1.658/2002: diagnóstico só com autorização do paciente (RN-36) |
| Telemedicina | Res. CFM 2.314/2022, se houver teleconsulta |
| Medicamentos controlados | Portaria SVS/MS 344/1998 e normas atuais da ANVISA para receituário digital (RN-34) |

> Confirme com assessoria jurídica e regulatória a versão vigente de cada norma antes do lançamento.

### 6.2 Stack recomendada

| Camada | Tecnologia [R] | Motivo |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Contratos compartilhados entre web, API e worker |
| Web | **Next.js 15 (App Router) + React 19 + TypeScript strict** | Mesmo framework do original [O]; SSR no site público e no `/recursos`, SPA no `/app` |
| UI | **Tailwind CSS + shadcn/ui (Radix) + lucide-react**, sonner, cmdk, vaul | Mesmos padrões observados [O] |
| Estado e dados no cliente | TanStack Query (servidor) + Zustand (gravação, UI) + React Hook Form + Zod | Cache e invalidação por recurso; formulários tipados |
| Editor | TipTap (ProseMirror) | Seções, marcações de evidência e sugestões inline |
| Agenda e gráficos | dnd-kit, Recharts | Arrastar e soltar acessível; gráficos simples |
| Offline | IndexedDB com Dexie, MediaRecorder (WebM/Opus) | Fila de blocos de áudio (C1) |
| API | **Node.js 22 + NestJS 11 (adaptador Fastify) + TypeScript** | Módulos explícitos para o monólito modular, injeção de dependência, guards e interceptors para autenticação, auditoria e limite de taxa |
| Validação | **Zod** em `packages/contracts`, com OpenAPI gerado (zod-to-openapi) | Um schema para API, worker, frontend e LLM |
| ORM e migrações | **Drizzle ORM + migrações SQL versionadas** | O schema usa `EXCLUDE`, `tstzrange`, `pgvector`, colunas geradas e RLS, que o Prisma não modela sem SQL bruto. Prisma serve se o time preferir, com migrações SQL manuais para esses pontos |
| Banco | **PostgreSQL 16 + pgvector** (RDS em produção; Supabase só se oferecer região São Paulo e contrato de operador LGPD) | Ver 3.1 |
| Cache e filas | Redis 7 + **BullMQ** + outbox | Ver 2.5 |
| Tempo real | `ws` no processo `realtime` + Redis pub/sub | Frames binários de áudio, sem overhead de Socket.IO |
| Transcrição | **Decisão C3.** Opção residente: AWS Transcribe Streaming em `sa-east-1` (pt-BR, vocabulário médico customizado). Opção de qualidade: Deepgram Nova-3 pt-BR (verificar onde processa). Escolher por benchmark de WER em consultas reais com consentimento | Diarização e vocabulário médico são o diferencial do produto |
| LLM | **Decisão C3.** Claude via Amazon Bedrock (validar disponibilidade e residência em `sa-east-1`) ou API da Anthropic com contrato de transferência internacional. Geração de documentos: `claude-sonnet-5-5`; classificação curta (papéis, especialidade): `claude-haiku-5-5`. Saída estruturada por tool use com o JSON Schema gerado do Zod | Qualidade em pt-BR clínico e saída estruturada |
| Embeddings | Modelo multilíngue com pt-BR (ex.: via Bedrock); dimensão configurável (`EMBEDDING_DIM`) | Copilot (RAG) |
| OCR de exames | Camada de texto do PDF primeiro; OCR (Textract ou Tesseract no worker) para escaneados | Extração `PRESENT/INFERRED/MISSING` com página de origem |
| PDF | HTML (React server-rendered) → Chromium headless (Playwright) no worker, PDF/A-2b | Fidelidade tipográfica |
| Assinatura ICP-Brasil | Certificado em nuvem via **API CSC** (BirdID, VIDaaS, SafeID, RemoteID) + biblioteca PAdES (ex.: Lacuna PKI) | "Assinatura em 1 clique" [O]; validável no verificador do ITI |
| Receita digital (alternativa) | Integração com plataforma de prescrição (ex.: Memed) | Atalho para catálogo, interações e receita controlada; avaliar custo e dependência |
| WhatsApp | WhatsApp Business Cloud API (Meta) ou BSP (Twilio, Zenvia) | Templates aprovados para lembretes e envio de link |
| E-mail | Amazon SES `sa-east-1` | Transacional |
| Pagamentos | Stripe (cartão, boleto e Pix no Brasil) ou Pagar.me / Asaas | Assinatura recorrente; checkout e portal |
| NFS-e | Focus NFe, eNotas ou NFE.io | RN-13 |
| Flags | GrowthBook ou Unleash com hospedagem própria | Liberar módulos "Em breve" por plano e por organização |
| Observabilidade | OpenTelemetry → Grafana (Loki, Tempo, Prometheus) ou Datadog; Sentry com limpeza de dados | Ver 6.1 |
| Analytics de produto | PostHog com hospedagem própria, sem dados de saúde, sem gravação de sessão no `/app` | Funil de teste → pagamento |
| Infra | AWS `sa-east-1` (ECS Fargate, RDS, ElastiCache, S3, KMS, WAF, CloudFront), web na Vercel | Ver 2.2 |
| IaC e CI/CD | Terraform; GitHub Actions (lint, typecheck, testes, build, varreduras, deploy com aprovação) | — |
| Contêineres | Docker multi-stage, imagens distroless; `docker compose` local com Postgres + pgvector, Redis e S3 local (SeaweedFS ou LocalStack; o MinIO deixou de distribuir imagens) | — |
| Testes | Vitest (unidade), Testcontainers (integração com Postgres e Redis reais), Playwright (e2e), k6 (carga do WebSocket e da geração), testes de contrato a partir do OpenAPI | — |

### 6.3 Estrutura do repositório

```text
escriba/
├─ apps/
│  ├─ web/                 # Next.js: site público, /app, /pair, /record, /m
│  ├─ api/                 # NestJS: REST /api/v1, webhooks, FHIR /public/v1
│  │  └─ src/modules/
│  │     ├─ identity/      # M01
│  │     ├─ onboarding/    # M02
│  │     ├─ organizations/ # M03
│  │     ├─ patients/      # M04
│  │     ├─ consents/      # M05
│  │     ├─ encounters/    # M06
│  │     ├─ recordings/    # M07, M08
│  │     ├─ transcription/ # M09
│  │     ├─ documents/     # M10
│  │     ├─ templates/     # M11
│  │     ├─ signatures/    # M12
│  │     ├─ prescriptions/ # M13
│  │     ├─ copilot/       # M14
│  │     ├─ schedule/      # M15
│  │     ├─ insights/      # M16
│  │     ├─ billing/       # M17
│  │     ├─ portability/   # M18
│  │     ├─ audit/         # M19
│  │     ├─ notifications/ # M20
│  │     └─ ai/            # política de decisão, cliente LLM, telemetria
│  ├─ realtime/            # gateway WebSocket de áudio
│  └─ worker/              # consumidores BullMQ e crons
├─ packages/
│  ├─ contracts/           # Zod: DTOs, documentos, decisões, eventos, erros
│  ├─ db/                  # Drizzle schema, migrações SQL, seeds
│  ├─ ui/                  # tokens, preset Tailwind, componentes shadcn
│  ├─ config/              # eslint, tsconfig, prettier
│  └─ testing/             # fábricas de dados fictícios, helpers Testcontainers
├─ infra/
│  ├─ terraform/
│  └─ docker/
├─ docs/
│  └─ adr/                 # uma ADR por decisão D1–D10 resolvida
├─ ESPECIFICACAO_TECNICA.md
├─ instructions.md
└─ docker-compose.yml
```

Regra de fronteira: um módulo só importa outro pelo `index.ts` público dele (regra `eslint-plugin-boundaries`).

### 6.4 Variáveis de ambiente

```bash
# Comuns
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
RT_URL=ws://localhost:4001
DATABASE_URL=postgres://escriba:escriba@localhost:5432/escriba
REDIS_URL=redis://localhost:6379/0
S3_ENDPOINT=http://localhost:8333
S3_BUCKET=escriba-dev
S3_REGION=sa-east-1
KMS_KEY_ID=local-dev                     # em dev: chave local; em prod: ARN do KMS
JWT_PRIVATE_KEY_PEM=...                  # ES256
JWT_KID=2026-01
CSRF_SECRET=...
BLIND_INDEX_KEY=...                      # HMAC dos índices cegos

# Provedores (deixar vazio em dev roda os fakes)
STT_PROVIDER=fake                        # fake | aws-transcribe | deepgram
LLM_PROVIDER=fake                        # fake | bedrock | anthropic
LLM_MODEL_GENERATION=claude-sonnet-5-5
LLM_MODEL_CLASSIFY=claude-haiku-5-5
EMBEDDING_MODEL=...
EMBEDDING_DIM=1536
SIGNATURE_PROVIDER=fake                  # fake | birdid | vidaas | ...
WHATSAPP_PROVIDER=fake
EMAIL_PROVIDER=fake                      # fake | ses
BILLING_PROVIDER=fake                    # fake | stripe | pagarme
NFSE_PROVIDER=fake
CRM_VERIFICATION_PROVIDER=fake

# Analytics (somente páginas públicas)
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_CLARITY_ID=
```

Todo provedor externo tem um **adaptador `fake` determinístico**, usado no desenvolvimento e nos testes. Nenhum teste chama serviço pago.

---

## 7. Decisões em aberto (bloqueiam ou mudam a implementação)

| # | Decisão | Opções | Impacto |
|---|---|---|---|
| D1 | Nome e identidade visual próprios | — | Tokens de marca, domínio, textos |
| D2 | Residência dos dados × provedores de IA (C3) | Tudo em `sa-east-1` × transferência internacional com contrato | Escolha de STT e LLM, textos de privacidade |
| D3 | Provedor de transcrição | Benchmark de WER e diarização em pt-BR médico | Qualidade percebida do produto |
| D4 | Provedor de assinatura ICP-Brasil | BirdID, VIDaaS, SafeID, RemoteID, ou vários | M12 |
| D5 | Receituário próprio × integração (ex.: Memed) | Construir catálogo + interações × integrar | M13, licenças da base de interações |
| D6 | Fontes do Copilot (C7) | Diretrizes brasileiras abertas × bases licenciadas | M14, custo de licença |
| D7 | Provedor de pagamento e NFS-e | Stripe × Pagar.me/Asaas; integrador de NFS-e | M17 |
| D8 | Validação de CRM | Serviço do CFM × provedor × revisão manual | M02 |
| D9 | Consentimento verbal permitido? | Sim, com registro × só termo assinado | RN-14, fluxo J2 |
| D10 | Preço anual (C6) | — | M17 |

## 8. Ordem de construção

A ordem de implementação, módulo por módulo, com critérios de aceite, está em [`instructions.md`](instructions.md).
