import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings

_CONFIG = Config(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
    connect_timeout=3,
    read_timeout=5,
    retries={"max_attempts": 1},
)


def _cliente(endpoint: str):
    return boto3.client(
        "s3",
        endpoint_url=f"http://{endpoint}",
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name="us-east-1",
        config=_CONFIG,
    )


# Cliente S3 generico: funciona com SeaweedFS, AWS S3 e outros servidores compativeis.
s3_client = _cliente(settings.s3_endpoint)
# Só para assinar URLs que o navegador vai abrir (assinar não faz chamada de rede).
_s3_assinatura = _cliente(settings.s3_public_endpoint or settings.s3_endpoint)


def ensure_bucket() -> None:
    """Cria o bucket padrão caso ainda não exista."""
    try:
        s3_client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        s3_client.create_bucket(Bucket=settings.s3_bucket)


def check_storage() -> bool:
    # Idempotente: se o armazenamento subiu depois do backend, o bucket é criado aqui.
    ensure_bucket()
    return True


def upload_object(key: str, data: bytes, content_type: str) -> None:
    ensure_bucket()
    s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type)


def presigned_url(key: str, expires: int = 3600) -> str:
    return _s3_assinatura.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires,
    )


def get_object(key: str) -> bytes:
    return s3_client.get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()


def delete_object(key: str) -> None:
    s3_client.delete_object(Bucket=settings.s3_bucket, Key=key)
