"""Motor de imagens: validação, remoção de metadados, data (EXIF) e descrição por visão.

A descrição gerada pelo modelo é uma SUGESTÃO para o médico revisar: não é diagnóstico e
nenhuma ação automática depende dela.
"""

import base64
import io
import logging
from datetime import date, datetime, timedelta

from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

from app.config import settings
from app.especialidades import atual

logger = logging.getLogger("medconsult.imagens")

# formato Pillow -> (extensão, content-type)
FORMATOS = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
}
MAX_PIXELS = 60_000_000
LADO_MAX_VISAO = 1568

PROMPT_DERMATOLOGICO = (
    "Analise esta imagem dermatológica e descreva no padrão clínico:\n"
    "- Tipo de lesão (mácula, pápula, placa, nódulo, etc)\n"
    "- Cor\n"
    "- Localização anatômica (se visível)\n"
    "- Bordas e superfície\n"
    "- Distribuição\n"
    "- Observações relevantes\n"
    "Seja conciso, use linguagem médica. Descreva apenas o que é visível: não dê diagnóstico "
    "nem conduta. Se a imagem não parecer uma imagem clínica de pele, diga isso."
)


class ImagemInvalida(ValueError):
    """Arquivo que não é uma imagem aceita (formato, tamanho ou conteúdo)."""


class VisaoIndisponivel(RuntimeError):
    """Sem chave, sem rede ou resposta inválida do modelo de visão."""


class DescricaoImagem(BaseModel):
    texto: str = Field(min_length=1, max_length=4000)
    modelo: str
    gerada_por_ia: bool = True


class ImagemProcessada(BaseModel):
    dados: bytes  # sem EXIF/GPS, orientação corrigida
    extensao: str
    content_type: str
    data_exif: date | None
    para_visao: bytes  # JPEG reduzido

    model_config = {"arbitrary_types_allowed": True}


def _parse_data_exif(valor: object) -> date | None:
    if isinstance(valor, bytes):
        valor = valor.decode("ascii", errors="ignore")
    if not isinstance(valor, str):
        return None
    try:
        d = datetime.strptime(valor.strip()[:10], "%Y:%m:%d").date()
    except ValueError:
        return None
    # data futura (relógio da câmera errado) não é confiável
    if d > date.today() + timedelta(days=1):
        return None
    return d


def extrair_data_exif_de(img: Image.Image) -> date | None:
    try:
        exif = img.getexif()
        candidatos = [
            exif.get_ifd(0x8769).get(0x9003),  # DateTimeOriginal
            exif.get_ifd(0x8769).get(0x9004),  # DateTimeDigitized
            exif.get(0x0132),  # DateTime
        ]
    except Exception:  # noqa: BLE001  EXIF corrompido não pode derrubar o upload
        return None
    for c in candidatos:
        d = _parse_data_exif(c)
        if d:
            return d
    return None


def extrair_data_exif(image_bytes: bytes) -> date | None:
    """Data de captura gravada na foto, ou None se não houver EXIF confiável."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            return extrair_data_exif_de(img)
    except (UnidentifiedImageError, OSError):
        return None


def processar_imagem(raw: bytes) -> ImagemProcessada:
    if not raw:
        raise ImagemInvalida("Arquivo vazio.")
    if len(raw) > settings.max_image_bytes:
        raise ImagemInvalida("Imagem maior que 10 MB.")
    try:
        img = Image.open(io.BytesIO(raw))
        formato = img.format or ""
        if formato not in FORMATOS:
            raise ImagemInvalida("Formato não aceito. Use JPEG, PNG ou WebP.")
        if img.width * img.height > MAX_PIXELS:
            raise ImagemInvalida("Imagem com resolução alta demais.")
        data = extrair_data_exif_de(img)
        img.load()
    except ImagemInvalida:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImagemInvalida("Arquivo não é uma imagem válida.") from exc

    # Reencodar descarta EXIF (inclui GPS) e metadados; a orientação é aplicada antes.
    img = ImageOps.exif_transpose(img)
    ext, content_type = FORMATOS[formato]
    if formato == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    saida = io.BytesIO()
    if formato == "JPEG":
        img.save(saida, "JPEG", quality=95)
    else:
        img.save(saida, formato)

    visao = img.convert("RGB")
    visao.thumbnail((LADO_MAX_VISAO, LADO_MAX_VISAO))
    buf = io.BytesIO()
    visao.save(buf, "JPEG", quality=85)

    return ImagemProcessada(
        dados=saida.getvalue(),
        extensao=ext,
        content_type=content_type,
        data_exif=data,
        para_visao=buf.getvalue(),
    )


async def analisar_imagem(image_bytes: bytes) -> DescricaoImagem:
    """Descrição dermatológica via GPT-4o-mini (visão). Levanta VisaoIndisponivel se falhar."""
    if not settings.openai_api_key:
        raise VisaoIndisponivel("OPENAI_API_KEY não configurada.")
    from openai import AsyncOpenAI

    cliente = AsyncOpenAI(api_key=settings.openai_api_key, timeout=30, max_retries=1)
    b64 = base64.b64encode(image_bytes).decode("ascii")
    try:
        resp = await cliente.chat.completions.create(
            model=settings.openai_vision_model,
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": atual().adaptar(PROMPT_DERMATOLOGICO)},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                        },
                    ],
                }
            ],
        )
        conteudo = (resp.choices[0].message.content or "").strip()
        return DescricaoImagem(texto=conteudo, modelo=settings.openai_vision_model)
    except Exception as exc:  # noqa: BLE001
        # Não registra o conteúdo da imagem nem da resposta: só o tipo do erro.
        logger.warning("Falha na análise de imagem: %s", type(exc).__name__)
        raise VisaoIndisponivel(type(exc).__name__) from exc
