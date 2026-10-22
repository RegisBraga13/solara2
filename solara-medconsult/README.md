# espec·IA·lidades

Plataforma de consultas médicas com IA por especialidade. Módulos: dermatologIA, psiquiatrIA, reumatologIA. (Antes chamado MedConsult; a pasta do repositório e os identificadores técnicos continuam `medconsult`.)

App de consulta médica — uso exclusivo do médico.

Documentação: [docs/](docs/README.md) · [CHANGELOG](CHANGELOG.md) · [AGENTS.md](AGENTS.md) (regras para agentes)

## Stack

- Frontend: Next.js 15 (React 19) + Tailwind + TypeScript
- Backend: FastAPI + Python 3.12
- Banco: PostgreSQL 16 + pgvector
- Cache/Fila: Redis 7
- Storage: SeaweedFS (S3-compatible; substitui o MinIO, veja a nota abaixo)

> **Por que SeaweedFS e não MinIO?** O MinIO parou de distribuir imagens Docker em outubro de 2025 e
> o repositório foi arquivado em 2026, então `docker pull minio/minio` falha. O backend usa o cliente
> S3 padrão (`boto3`), que funciona com SeaweedFS, AWS S3 e outros servidores compatíveis.

> **Por que Next.js 15 e não 14?** A linha 14 não recebe mais correções e tem falhas críticas
> conhecidas (incluindo execução remota de código em servidores Windows). A versão 15.5.27 é a
> linha de backport mantida pelo projeto e deixa `npm audit` com 0 vulnerabilidades em produção.

## Como rodar

### Windows (um clique)

Pré-requisitos: Docker Desktop (aberto), Python 3.12+ e Node.js 20+.

1. Dê dois cliques em `scripts\windows\iniciar.bat` (cria o `.env`, sobe os containers, instala dependências e abre o navegador).
2. Para desligar tudo, dois cliques em `scripts\windows\parar.bat`.

### Linha de comando

```bash
docker compose up -d postgres redis storage
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

### Tudo em containers (opcional)

```bash
docker compose --profile app up -d --build
```

## Endereços

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend (health) | http://localhost:8000/health |
| Backend (docs) | http://localhost:8000/docs |
| API S3 (armazenamento) | http://localhost:8333 (credenciais no `.env`) |

## Segurança (desenvolvimento)

- Todas as portas dos containers são publicadas só em `127.0.0.1`: ninguém na sua rede local acessa o banco, o Redis ou o armazenamento.
- As senhas padrão (`medconsult`, `medconsult-dev-secret`) servem **apenas para desenvolvimento local**. Troque-as no `.env` antes de qualquer uso com dados reais de pacientes.
- O `.env` não é versionado (está no `.gitignore`).
- Os servidores de desenvolvimento do backend e do frontend escutam apenas em `127.0.0.1`.

## Testes e qualidade

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest        # um teste só roda com Postgres, Redis e o armazenamento no ar; senão é pulado
ruff check .

cd ../frontend
npm run lint
npx tsc --noEmit
```

## Problemas comuns

- **"port is already allocated"**: outro programa usa 5432, 6379 ou 8333 (ex.: PostgreSQL instalado no Windows). Feche-o ou altere a porta no `docker-compose.yml`.
- **`/health` mostra `degraded`**: os containers ainda estão iniciando (aguarde ~15 s) ou algum caiu; veja `docker compose ps`.

## Armazenamento S3

As credenciais ficam em `infra/seaweedfs/s3.json` e precisam bater com `S3_ACCESS_KEY` e `S3_SECRET_KEY` do `.env`.
O bucket (`S3_BUCKET`) é criado automaticamente pelo backend. Se o armazenamento não subir, o sistema continua
funcionando e o `/health` mostra `storage` com erro.

## Chaves de API

Preencha no `.env`: `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`.

## Fase 1 — fluxo navegável (dados fictícios)

8 telas: Home → Anamnese → Captura → História clínica → Diagnóstico → Condutas (com investigação) → Tratamento → Prontuário.
Nesta fase tudo era simulado (veja as fases seguintes para o que é real). O rascunho fica salvo no navegador (`medconsult-state`);
ao reabrir, a Home pergunta "Retomar consulta?". A esfera no canto superior direito alterna dia/noite.
Testes: `cd frontend && npm test`.

## Fase 1.5 — Modern Skeuomorphism + iPad-first + PWA

- Tokens em `frontend/src/styles/tokens.ts` e `textures.ts`; variáveis CSS em `app/globals.css`.
  Tema por classe no `<html>` (`day` / `night`), transição de 400ms.
- Instalar no iPad: abrir o endereço no Safari → Compartilhar → "Adicionar à Tela de Início".
  O service worker só é registrado em produção (`npm run build && npm start`).
- O iPad exige HTTPS (ou localhost) para microfone/câmera e para o service worker.

## Fase 2 — captura real (voz e imagens)

Só a tela **Captura** usa o servidor. Precisa de `DEEPGRAM_API_KEY` (transcrição) e `OPENAI_API_KEY`
(descrição das imagens) no `.env`. Sem elas nada trava: a voz cai para o modo texto e a imagem é
guardada sem descrição.

- **Voz:** Deepgram Nova-3 em streaming (`pt-BR`, pontuação e diarização). O áudio sai do navegador em
  WebM/Opus pelo WebSocket `/ws/session/{id}/audio`. O Deepgram só numera as vozes: o app chama a 1ª de
  Médico, a 2ª de Paciente e a 3ª de Acompanhante; o botão "Trocar Médico ↔ Paciente" corrige.
- **Imagens:** `POST /session/{id}/images` (máx. 10 MB; JPEG, PNG ou WebP). O servidor lê a data no EXIF,
  **remove o EXIF (inclusive GPS)**, guarda no armazenamento S3 (SeaweedFS) e pede uma descrição ao
  GPT-4o-mini. A descrição é só uma sugestão para o médico revisar, não um diagnóstico.
- **Tabelas** `images` e `transcricoes`: criadas sozinhas quando o backend sobe.
- O microfone exige HTTPS ou `localhost`/`127.0.0.1`. Safari antigo (iPad) não grava WebM/Opus: cai no modo texto.
- Use `127.0.0.1` (não `localhost`) nas URLs: no Windows o `localhost` tenta IPv6 primeiro e fica lento.

## Fase 3 (parte 1) — RAG: acervo de referência (OpenAI embeddings + pgvector)

Só **recupera trechos de um acervo com a fonte de cada um**. Não escreve história, diagnóstico, conduta
nem tratamento (isso é a próxima parte, e sempre com revisão do médico).

- **Carga:** coloque os documentos em `backend/acervo/` (formato em `acervo/README.md`) e rode
  `python -m scripts.carregar_acervo acervo` na pasta `backend`. Gera os vetores com
  `text-embedding-3-small` (usa `OPENAI_API_KEY`) e grava no pgvector. Repetir é seguro: só reindexa o que mudou.
- **Livro em PDF:** `python -m scripts.converter_pdf_azulay <pdf> acervo/dermatologia/azulay` divide o Azulay por seção
  (título + páginas do PDF) antes da carga.
- **Busca:** interna (nenhuma rota devolve trecho de livro). Junta busca por significado (vetor) e por
  palavras (Postgres) e funde as duas por posição; se a OpenAI falhar, cai para busca por palavras.
  `GET /rag/estado` mostra o que está indexado.
- **Medir:** `python -m scripts.avaliar_rag acervo/avaliacao.json` calcula recall@k e MRR com perguntas
  de resposta conhecida; serve para comparar modelos de embedding.
- **Privacidade:** o texto da busca vai à OpenAI. Envie sem nome e sem identificadores do paciente.
- Trocar `EMBEDDING_MODEL` ou `EMBEDDING_DIM` zera o acervo indexado ao subir o backend: recarregue-o.
- Não há reranker no momento (o gancho existe em `motores/embeddings.py`).

## Especialidades (um app, um código)

A especialidade é só o **conteúdo clínico**; identidade visual, fluxo, pacientes, prontuários,
laudos, imagens e voz são comuns. Ativa por `ESPECIALIDADE` (servidor) e `NEXT_PUBLIC_ESPECIALIDADE`
(site, no build); padrão `dermatologia`.

- Servidor: `backend/app/especialidades/` (propedêutica, orientações, domínios web, diretrizes,
  Whitebook, vocabulário dos prompts). Site: `frontend/src/lib/especialidade.ts` (rótulos, escalas).
- **Estrutura igual para todas** (nenhuma é "a principal"):
  ```
  backend/app/especialidades/<slug>.py        conteúdo clínico (descoberto sozinho)
  backend/diretrizes/<slug>/*.md              uma síntese por doença
  backend/acervo/<slug>/<livro>/*.md          livros (fora do git)
  backend/acervo/<slug>/gabarito_casos.json   casos para medir a busca (no git)
  frontend/src/lib/especialidade.ts           bloco da especialidade (rótulos, escalas)
  ```
  Carga do acervo: `python -m scripts.carregar_acervo acervo/<slug> --especialidade <slug>`; a busca
  do RAG só traz documentos da especialidade ativa. Medir: `ESPECIALIDADE=<slug> python -m
  scripts.medir_casos` (usa `acervo/<slug>/gabarito_casos.json`).
- **Nova especialidade:** `py -3 scripts/nova_especialidade.py <slug> "<Nome>"` cria o esqueleto
  (módulo Python, pastas de diretrizes e acervo, bloco do site); depois é preencher os TODO.
- **Psiquiatria:** estrutura pronta e conteúdo recuperado do projeto PSIQUIATRIA do médico.
  - **Diretrizes:** 39 sínteses em `backend/diretrizes/psiquiatria/` (cabeçalho YAML `conditions:`
    usado para achar a síntese pelo nome da doença; as seções de tratamento vão ao modelo).
  - **Acervo RAG:** 14 livros do médico (carregados: 1.456 documentos, 88.666 trechos; DSM-5-TR, Dalgalarrondo, Cheniaux, Clínica Psiquiátrica
    FMUSP vol. 1–3 e Guia Prático, Bolso IPq, Condutas, Tratado ABP, Psicofarmacologia 2025,
    entrevistas, Manual do Residente). Os PDFs ficam fora do git; para refazer:
    `python -m scripts.preparar_acervo_psiquiatria "<pasta dos PDFs>"` e depois
    `python -m scripts.carregar_acervo acervo/psiquiatria --especialidade psiquiatria`.
  - **RAG direto na nuvem (vector stores do projeto PSIQUIATRIA):** com
    `OPENAI_RAG_VECTOR_STORE_ID` e `OPENAI_DIRETRIZES_VECTOR_STORE_ID` no `.env`, a Psiquiatria
    consulta esses stores direto (18 livros por gênero + 40 diretrizes), sem reindexar. O
    diagnóstico lê psicopatologia + síndromes + critérios; o tratamento lê terapêutica. Só a
    especialidade com `usa_nuvem=True` os lê (a Dermatologia ignora, mesmo com o `.env`
    compartilhado). Se a nuvem falhar, cai no acervo local (pgvector) e avisa.
  - Pendente: segunda passada de revisão e tabelas de CID.
- **Reumatologia:** mesmo fluxo e identidade visual; acervo local (pgvector), sem nuvem.
  - **Diretrizes:** 117 sínteses em `backend/diretrizes/reumatologia/` (uma por doença).
  - **Acervo RAG:** Carvalho, *Reumatologia: diagnóstico e tratamento* (4ª ed.): 76 documentos, 726
    páginas com texto. O PDF fica fora do git; para refazer:
    `python -m scripts.converter_pdf_livro "<pdf>" --slug carvalho --titulo "Reumatologia: diagnóstico e tratamento - Carvalho" --versao "4a ed." --especialidade reumatologia`
    e `python -m scripts.carregar_acervo acervo/reumatologia --especialidade reumatologia`.
  - **Medição (12 casos sintéticos, `acervo/reumatologia/gabarito_casos.json`):** acerto @3 = 0,83 sem e
    0,92 com reordenação; @10 = 1,00. Pior caso: polimialgia reumática (posição 9). Critério
    aproximado (menções do termo na janela de páginas), não é gabarito clínico validado.
  - **Escalas:** DAS28 (0–9,4; 2 casas), CDAI (0–76), BASDAI (0–10; 1 casa) e HAQ (0–3; 3 casas). O campo
    de escore aceita decimais por escala (`casas` em `especialidade.ts`; vírgula ou ponto).
  - Ativar: `ESPECIALIDADE=reumatologia` (servidor) e `NEXT_PUBLIC_ESPECIALIDADE=reumatologia` (site).
- **Duas ao mesmo tempo** (mesmo código e mesmo banco), no PowerShell:
  ```
  # servidor da Psiquiatria (porta 8001)
  $env:ESPECIALIDADE='psiquiatria'; $env:CORS_ORIGINS='["http://127.0.0.1:3001"]'
  backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001   # na pasta backend
  # site da Psiquiatria (porta 3001, compilado em pasta própria)
  $env:NEXT_PUBLIC_ESPECIALIDADE='psiquiatria'; $env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8001'
  $env:NEXT_DIST_DIR='.next-psiquiatria'; npm run build; npm run start -- -p 3001   # na pasta frontend
  ```
  Depois de compilar assim, rode `npm run build` normal antes de voltar à dermatologia.
- Regras para agentes e núcleo protegido: `AGENTS.md`, `NUCLEO.txt`,
  `py -3 scripts/verificar_nucleo.py --outro <branch>`.

## Backup e restauração

Dados que não se recriam: pacientes, prontuários, receitas, laudos e imagens (Postgres + storage S3).
O acervo RAG é recriável a partir de `acervo/` e fica fora do backup padrão (é ~99% do banco).

- **Fazer:** duplo clique em `scripts\windows\backup.bat` (ou, em `backend`: `python -m scripts.backup fazer`).
  Destino: `BACKUP_DIR` (padrão `MedConsultBackups` na pasta do usuário). Mantém os 14 mais
  recentes. `--completo` inclui o acervo RAG (GBs).
- **Conferir:** `python -m scripts.backup verificar` confere hashes e a leitura do dump.
- **Restaurar (sem risco):** `python -m scripts.backup restaurar <pasta> --banco medconsult_teste`
  cria um banco novo e compara as contagens com o manifesto. Só substitui o banco ativo com
  `--sobrescrever`; laudos e imagens só voltam ao storage com `--arquivos`.
- O backup contém dados de pacientes: guarde em local protegido (cifrado) e faça uma segunda cópia
  fora do computador. Nada é enviado à internet pelo script.
- Não cobre o `.env` (segredos) nem os livros do acervo; guarde-os à parte.

### Backup diário automático (Windows)
- **Agendar:** `scripts\windows\agendar-backup.bat` (padrão 20:00; ou `agendar-backup.bat 13:30`). Cria a
  tarefa `especIA-backup-diario` no Agendador de Tarefas, só com o usuário logado e o Docker Desktop
  aberto. Cada execução grava o resultado em `%USERPROFILE%\MedConsultBackups\agendado.log`.
- **Remover:** `scripts\windows\agendar-backup.bat remover`.
- **Cópia fora da máquina e cifragem:** aponte `BACKUP_DIR` para uma pasta em disco externo ou em um
  serviço de nuvem **cifrado** (BitLocker no disco externo; ou uma pasta sincronizada que você
  proteja com senha). O script não envia nada à internet nem cifra por conta própria.
- **Conferir de vez em quando:** `python -m scripts.backup verificar` e uma restauração de teste.

## Diretrizes (fontes por doença, fora do RAG)

Cada especialidade tem a sua pasta em `backend/diretrizes/<slug>/`. A da dermatologia
(`backend/diretrizes/dermatologia/`) reúne 120 arquivos `.md`, um por doença: 70 sínteses de doenças comuns e
sistêmicas (avaliação, tratamento e condutas) e 50 doenças adicionais, cada uma com a seção
"Diretriz terapêutica resumida". Não passam pela busca por similaridade: `app/motores/busca_diretrizes.py` abre o
arquivo pelo **nome do diagnóstico** (sem acento nem diferença de maiúsculas) e devolve lista vazia
quando não há diretriz.

- São sínteses, **não** os documentos originais: confirme dose, duração e contraindicações na fonte.
- O nome precisa estar contido no título (ou o contrário). Siglas e sinônimos ainda não casam.
- Novas doenças entram copiando o `.md` para a pasta, com conduta e tratamento escritos.
- Ainda não estão ligadas ao gerador de diagnósticos nem às telas de Tratamento e Condutas.

## Fase 3 (parte 2) — IA real nas telas 4 a 8

A **Home** escolhe **ONLINE** ou **PRESENCIAL** e leva às **4 opções** (**Novo paciente**, **Nova consulta**, **Retorno**, **Prontuário**). A consulta tem 8 telas: Home → Anamnese → Captura → **História clínica** → **Diagnóstico** → **Propedêutica**
(tratamento + investigação + acompanhamento juntos) → **Orientações gerais** (cuidados com a pele,
fotoproteção, higiene e ambiente) → **Prontuário**. Nenhuma tela mostra dados de exemplo.

**Regra principal: nada é gerado sozinho.** Ao abrir uma tela, nenhuma fonte vem marcada e o botão de
gerar espera o toque do médico. Um botão único, **GERAR**, consulta todas as fontes da tela (o site
envia o campo `fontes`, obrigatório; sem ele a resposta é 422). Tudo é proposta para revisão.

- **Fontes** (consultadas juntas, sem botões nem rótulos): **AI** (conhecimento do modelo), **RAG** (livros no pgvector), **Diretrizes**
  (pasta `backend/diretrizes/`) e **Web** (ferramenta `web_search` da OpenAI, restrita aos domínios
  de `dominios_web` de cada especialidade em `backend/app/especialidades/<slug>.py` — sempre
  incluem `pubmed.ncbi.nlm.nih.gov` e, desde 2026-10-15, `openevidence.com` em todas; o restante é
  sociedade/órgão próprio da especialidade, ex.: dermatologia tem também `sbd.org.br` e `aad.org`).
  O diagnóstico oferece AI, RAG e Web (sem Diretrizes). Os itens aparecem sem etiqueta de origem;
  nunca há trecho, página, link, título de livro ou citação — mesmo quando o resultado vem do
  OpenEvidence.
- `POST /historia/gerar` `{registro}` → história no padrão médico, só com o que foi registrado (sem
  inventar, sem diagnóstico). Botão "GERAR HISTÓRIA COM IA" na tela 4; o texto fica editável.
- `POST /diagnostico/sugerir` `{caso, fontes}` → nomes do mais ao menos provável, cada um com a **estimativa
  em %** da IA (`probabilidades`). Não é probabilidade calibrada: a tela avisa. As estimativas somam no máximo
  100% (se passarem, são reduzidas proporcionalmente) e a ordem sempre concorda com o número.
- `POST /propedeutica/sugerir` e `POST /orientacoes/sugerir` `{diagnostico, fontes}` → itens com
  `secao` e `fontes`. Até 3 diagnósticos escolhidos, um pedido por diagnóstico.
- **Whitebook:** botão "Consultar Whitebook" nas telas 5 e 6 abre o site em outra aba (sem integração
  nem leitura do conteúdo). Endereço em `NEXT_PUBLIC_WHITEBOOK_URL` (padrão `https://whitebook.pebmed.com.br/home/`). O campo "Anotações" guarda o que o médico colar; fica no aparelho, **não é
  enviado à IA** e vai para o prontuário e o PDF.
- **OpenEvidence:** botão "Consultar OpenEvidence" ao lado do Whitebook, mesmo funcionamento (abre o
  site em outra aba; sem integração nem leitura do conteúdo). Endereço em
  `NEXT_PUBLIC_OPENEVIDENCE_URL` (padrão `https://www.openevidence.com/`). Fica com rótulo e
  destaque visual próprios no app porque é uma IA médica especializada em evidências — diferente de
  uma IA genérica (ChatGPT e afins) — e vale para todas as especialidades, não só uma.
- **Prontuário:** consolida história, diagnósticos, propedêutica, orientações e anotações. O botão PDF
  gera o arquivo no navegador (`jspdf`), sem enviar nada ao servidor. 
- **Receita (Fase 4):** no prontuário do paciente, NOVA RECEITA. Preenchida à mão pelo médico
  (nada de IA), PDF gerado no aparelho e salvo ligado ao paciente. Não edita nem exclui; corrigir é
  emitir outra. É documento de apoio SEM assinatura ICP-Brasil (controlados exigem sistema próprio).
  Falta: assinatura digital, modelos de posologia e emissão a partir da consulta.
- **Sugestões não são salvas.** A lista gerada fica só na memória da página (some ao recarregar) e o
  servidor não guarda nada. Só a **escolha do médico** é salva: ao marcar uma sugestão ela vira item do
  médico, com a seção, e entra no prontuário. Gerar de novo troca a lista sem desmarcar o que já foi marcado.
- **Blocos de itens correlatos.** Na propedêutica, medidas parecidas viram **um chip só**, com o nome do
  grupo e os integrantes (ex.: "Exames laboratoriais: hemograma, glicemia, TGO/TGP, creatinina";
  "Corticoides tópicos: clobetasol, betametasona"). Marcar o chip marca o bloco inteiro. O servidor junta
  grupos repetidos e soma os componentes de todas as fontes escolhidas.
- **Câmera em tempo real** na Captura ("TIRAR FOTO (CÂMERA)"): imagem ao vivo, várias fotos seguidas, troca
  entre câmera traseira e frontal. Precisa de HTTPS e da permissão do Safari. "Escolher da galeria" continua.
  A foto tirada agora é registrada com a data de hoje.
- **Prontuários salvos.** "REGISTRAR E SALVAR PDF" gera o PDF no aparelho e guarda **texto + PDF no servidor**
  (Postgres + armazenamento). Depois de salvar, a tela diz onde o prontuário ficou. Na tela inicial,
  **PRONTUÁRIOS SALVOS** lista, abre, abre o PDF, compartilha (AirDrop, Arquivos, e-mail) e exclui.
  Se o servidor falhar, nada é apagado e o PDF pode ser compartilhado. Rotas: `POST/GET /prontuarios`,
  `GET /prontuarios/{id}`, `GET /prontuarios/{id}/pdf`, `DELETE /prontuarios/{id}`.
- **Fluxo (Home → 4 opções).** O modo (ONLINE/PRESENCIAL) é escolhido na Home e vale para o que vier depois.
  - **NOVO PACIENTE** (`/paciente/novo`): cadastro completo e, ao salvar, começa a Consulta 1 (Anamnese).
    Só o nome é obrigatório; CPF (validado, único), sexo, contato, profissão, moradia, plano, histórico
    familiar, medicações em uso e alergias ficam só no banco local e **nunca vão à IA**.
  - **NOVA CONSULTA** (`/nova-consulta`): busca por nome ou CPF, mostra "Consulta N" e começa a Anamnese.
  - **RETORNO** (`/retorno`): só pacientes com consulta salva; escolhe a consulta anterior (a mais recente
    vem marcada) e abre a **Evolução**, uma tela só (`/evolucao`): mini anamnese (transcrição e/ou escrito),
    laudos novos (PDF ou foto, anexados; a IA **não** lê), imagens novas (câmera ou galeria), diagnóstico e
    conduta com **Manter / Ajustar / Novo**, fontes AI/RAG/Diretrizes/Web a pedido, Whitebook e anotações.
    "Manter" copia o diagnóstico/conduta da consulta anterior; a consulta original não muda. Ao concluir, grava
    um registro novo (`tipo=retorno`, `retorno_de`) e o PDF.
  - **PRONTUÁRIO** (`/prontuarios` → `/pacientes/{id}`): busca o paciente e mostra o histórico cronológico
    (mais antigo em cima: Consulta 1, Retorno 1, Consulta 2…), dados do paciente (mostrar/ocultar, corrigir),
    laudos de cada registro, **EXPORTAR PDF** do histórico e **EDITAR** (correção de erros; o PDF é refeito e o
    registro mostra "corrigido em"). Paciente e prontuário **não são excluídos** (decisão do médico).
  - Com uma consulta em andamento, a Home oferece CONTINUAR CONSULTA e não deixa começar outra antes de
    "Sair". Rotas: `POST/GET/PUT /pacientes`, `GET /pacientes/{id}`, `GET /pacientes/{id}/prontuario`,
    `PUT /prontuarios/{id}`, `POST/GET/DELETE /session/{sid}/laudos`, `GET /laudos/{id}/arquivo`.
  - Ainda não existe login nem perfis (secretária, robô): hoje qualquer pessoa com acesso ao endereço usa
    tudo. Isso é a Fase 6; antes de pacientes reais é preciso login.
- **Falhas não bloqueiam:** aviso na tela, botão para tentar de novo e itens acrescentados à mão.
  Sem créditos na OpenAI o servidor responde na hora (sem esperar tentativas).
- **Privacidade:** o texto do caso vai à OpenAI (e, na fonte Web, um trecho de até 1500 caracteres do caso
  vai à busca). Não digite nome nem identificadores do paciente.
- Precisam do Postgres (acervo RAG) e de `OPENAI_API_KEY`. A reordenação por IA do RAG segue ligada
  (medido: MRR 0,39 → 0,8). A busca web exige `gpt-4.1` ou `gpt-4o` (o filtro de domínios não vale no
  `gpt-4o-mini`): `WEB_SEARCH_MODEL` no `.env`.