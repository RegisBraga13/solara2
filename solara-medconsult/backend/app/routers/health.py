from collections.abc import Callable

from fastapi import APIRouter

from app.config import NOME_MAE, settings
from app.db import check_db
from app.redis_client import check_redis
from app.storage import check_storage

router = APIRouter(tags=["health"])


def _run(check: Callable[[], bool]) -> str:
    try:
        check()
        return "ok"
    except Exception as exc:  # noqa: BLE001
        return f"erro: {type(exc).__name__}"


@router.get("/health")
def health():
    checks = {
        "postgres": _run(check_db),
        "redis": _run(check_redis),
        "storage": _run(check_storage),
    }
    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "service": "medconsult-backend", "checks": checks}


@router.get("/info")
def info():
    return {"nome_mae": NOME_MAE, "especialidade_ativa": settings.especialidade}
