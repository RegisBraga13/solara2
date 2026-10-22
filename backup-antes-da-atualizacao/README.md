# MedConsult

App de consulta médica — uso exclusivo do médico.

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

1. Dê dois cliques em `iniciar.bat` (cria o `.env`, sobe os containers, instala dependências e abre o navegador).
2. Para desligar tudo, dois cliques em `parar.bat`.

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
