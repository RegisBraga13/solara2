from sqlalchemy import create_engine, text

from app.config import settings


def _sqlalchemy_url(url: str) -> str:
    # Usa o driver psycopg (v3)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


engine = create_engine(
    _sqlalchemy_url(settings.database_url),
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},  # não deixa a API presa se o banco não responde
)


def check_db() -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
