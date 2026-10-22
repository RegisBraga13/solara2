import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import NOME_MAE, settings
from app.repositorio import criar_tabelas
from app.repositorio_rag import criar_tabelas_rag
from app.routers import (
    captura,
    documentos,
    health,
    laudos,
    pacientes,
    pre_consulta,
    prontuarios,
    rag,
    receitas,
    sugestoes,
)
from app.storage import ensure_bucket

logger = logging.getLogger("medconsult")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Não derruba a API se um serviço ainda não estiver pronto; /health mostra o estado.
    try:
        ensure_bucket()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Armazenamento S3 indisponível na inicialização: %s", exc)
    try:
        await asyncio.to_thread(criar_tabelas)
        await asyncio.to_thread(criar_tabelas_rag)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Tabelas não criadas (banco indisponível?): %s", type(exc).__name__)
    yield


app = FastAPI(title="espec·IA·lidades API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Truncado"],
)

app.include_router(health.router)
app.include_router(captura.router)
app.include_router(rag.router)
app.include_router(sugestoes.router)
app.include_router(prontuarios.router)
app.include_router(pacientes.router)
app.include_router(laudos.router)
app.include_router(receitas.router)
app.include_router(documentos.router)
app.include_router(pre_consulta.router)


@app.get("/")
def root():
    return {"app": NOME_MAE, "docs": "/docs"}
