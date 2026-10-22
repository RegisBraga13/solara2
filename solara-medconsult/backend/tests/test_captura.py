import asyncio
import io
import uuid
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import settings
from app.main import app
from app.motores import imagens as motor_imagens
from app.motores import voz as motor_voz
from app.routers import captura as captura_router

client = TestClient(app)
SID = str(uuid.uuid4())


# --------------------------------------------------------------------------- helpers


def _jpeg(exif_data: str | None = None, gps: bool = False, size=(40, 30)) -> bytes:
    img = Image.new("RGB", size, (200, 120, 100))
    exif = Image.Exif()
    if exif_data:
        exif.get_ifd(0x8769)[0x9003] = exif_data
    if gps:
        exif.get_ifd(0x8825)[1] = "S"
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (10, 10), (255, 0, 0, 128)).save(buf, "PNG")
    return buf.getvalue()


def _resultado(palavras, final=True, texto=None):
    ws = [
        {"word": w, "punctuated_word": w, "start": 1.0 + i, "end": 1.5 + i, "speaker": s}
        for i, (w, s) in enumerate(palavras)
    ]
    return {
        "type": "Results",
        "is_final": final,
        "channel": {
            "alternatives": [{"transcript": texto or " ".join(w for w, _ in palavras), "words": ws}]
        },
    }


# ------------------------------------------------------------------------ voz (puro)


def test_segmentos_separam_vozes_e_atribuem_papeis_pela_ordem():
    ordem = motor_voz.OrdemFalantes()
    msg = _resultado(
        [("Bom", 1), ("dia.", 1), ("Dói", 0), ("aqui.", 0), ("Desde", 2), ("ontem.", 2)]
    )
    seg = motor_voz.segmentos_do_resultado(msg, ordem)
    assert [(s.text, s.speaker, s.speaker_id) for s in seg] == [
        ("Bom dia.", "medico", 1),
        ("Dói aqui.", "paciente", 0),
        ("Desde ontem.", "acompanhante", 2),
    ]
    assert all(s.is_final for s in seg)
    assert seg[0].timestamp_ms == 1000


def test_quarta_voz_e_indefinida_e_papel_e_estavel():
    ordem = motor_voz.OrdemFalantes()
    assert [ordem.papel(i) for i in (5, 6, 7, 8, 5)] == [
        "medico",
        "paciente",
        "acompanhante",
        "indefinido",
        "medico",
    ]
    assert ordem.papel(None) == "indefinido"


def test_resultado_sem_diarizacao_ou_vazio_ou_de_outro_tipo():
    ordem = motor_voz.OrdemFalantes()
    sem = {
        "type": "Results",
        "is_final": False,
        "channel": {"alternatives": [{"transcript": "olá", "words": []}]},
    }
    [t] = motor_voz.segmentos_do_resultado(sem, ordem)
    assert (t.speaker, t.speaker_id, t.is_final) == ("indefinido", None, False)
    vazio = {"type": "Results", "channel": {"alternatives": [{"transcript": "  ", "words": []}]}}
    assert motor_voz.segmentos_do_resultado(vazio, ordem) == []
    assert motor_voz.segmentos_do_resultado({"type": "Metadata"}, ordem) == []
    assert motor_voz.segmentos_do_resultado({"type": "Results"}, ordem) == []


def test_url_deepgram_usa_nova3_ptbr_e_diarizacao():
    url = motor_voz.url_deepgram()
    for trecho in ("model=nova-3", "language=pt-BR", "diarize=true", "punctuate=true"):
        assert trecho in url


# ------------------------------------------------------------------- imagens (puro)


def test_processar_extrai_data_exif_e_remove_exif_e_gps():
    raw = _jpeg("2025:03:14 10:20:30", gps=True)
    assert motor_imagens.extrair_data_exif(raw) == date(2025, 3, 14)
    p = motor_imagens.processar_imagem(raw)
    assert p.data_exif == date(2025, 3, 14)
    with Image.open(io.BytesIO(p.dados)) as saida:
        assert dict(saida.getexif()) == {}
    assert p.extensao == "jpg"


def test_sem_exif_ou_exif_invalido_ou_futuro_devolve_none():
    assert motor_imagens.extrair_data_exif(_jpeg()) is None
    assert motor_imagens.extrair_data_exif(_jpeg("0000:00:00 00:00:00")) is None
    futuro = f"{datetime.now().year + 2}:01:01 00:00:00"
    assert motor_imagens.extrair_data_exif(_jpeg(futuro)) is None
    assert motor_imagens.extrair_data_exif(b"nao e imagem") is None


def test_png_com_transparencia_e_aceito():
    p = motor_imagens.processar_imagem(_png())
    assert (p.extensao, p.content_type) == ("png", "image/png")
    assert Image.open(io.BytesIO(p.para_visao)).format == "JPEG"


@pytest.mark.parametrize("raw", [b"", b"lixo", b"GIF89a" + b"\x00" * 20])
def test_processar_rejeita_invalidos(raw):
    with pytest.raises(motor_imagens.ImagemInvalida):
        motor_imagens.processar_imagem(raw)


def test_limite_de_10mb(monkeypatch):
    monkeypatch.setattr(settings, "max_image_bytes", 100)
    with pytest.raises(motor_imagens.ImagemInvalida, match="10 MB"):
        motor_imagens.processar_imagem(_jpeg(size=(200, 200)))


def test_visao_sem_chave_levanta_indisponivel(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(motor_imagens.VisaoIndisponivel):
        asyncio.run(motor_imagens.analisar_imagem(b"x"))


# ------------------------------------------------------------------ rotas de imagem


@pytest.fixture
def fakes(monkeypatch):
    estado = {"apagados": [], "inseridos": []}
    monkeypatch.setattr(captura_router.storage, "upload_object", lambda k, d, c: None)
    monkeypatch.setattr(
        captura_router.storage, "presigned_url", lambda k, expires=3600: f"http://x/{k}"
    )
    monkeypatch.setattr(
        captura_router.storage, "delete_object", lambda k: estado["apagados"].append(k)
    )

    async def visao(_):
        return motor_imagens.DescricaoImagem(texto="Placa eritematosa.", modelo="gpt-4o-mini")

    monkeypatch.setattr(captura_router.motor_imagens, "analisar_imagem", visao)

    def inserir(**kw):
        estado["inseridos"].append(kw)
        return {
            "id": str(uuid.uuid4()),
            "minio_object_name": kw["object_name"],
            "data_classificada": kw["data_classificada"],
            "data_origem": kw["data_origem"],
            "descricao_padrao": kw["descricao"],
            "descricao_modelo": kw["modelo"],
        }

    monkeypatch.setattr(captura_router.repositorio, "inserir_imagem", inserir)
    return estado


def _post(raw, nome="foto.jpg", tipo="image/jpeg", sid=SID, **data):
    return client.post(f"/session/{sid}/images", files={"file": (nome, raw, tipo)}, data=data)


def test_upload_ok_com_exif_e_descricao(fakes):
    r = _post(_jpeg("2025:03:14 10:20:30"))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["data_classificada"] == "2025-03-14"
    assert b["descricao"] == "Placa eritematosa."
    assert b["gerada_por_ia"] is True
    assert b["avisos"] == []
    assert fakes["inseridos"][0]["data_origem"] == "exif"


def test_upload_sem_exif_avisa_e_aceita_data_manual(fakes):
    b = _post(_jpeg()).json()
    assert b["data_classificada"] is None
    assert "Data da foto não identificada." in b["avisos"]
    b = _post(_jpeg(), data_manual="2025-01-02").json()
    assert (b["data_classificada"], fakes["inseridos"][-1]["data_origem"]) == (
        "2025-01-02",
        "manual",
    )


def test_upload_com_visao_fora_do_ar_nao_bloqueia(fakes, monkeypatch):
    async def falha(_):
        raise motor_imagens.VisaoIndisponivel("x")

    monkeypatch.setattr(captura_router.motor_imagens, "analisar_imagem", falha)
    r = _post(_jpeg("2025:03:14 10:20:30"))
    assert r.status_code == 200
    b = r.json()
    assert b["descricao"] is None and b["gerada_por_ia"] is False
    assert any("Descrição automática indisponível" in a for a in b["avisos"])


def test_upload_rejeita_invalido_grande_e_sessao_ruim(fakes, monkeypatch):
    assert _post(b"lixo").status_code == 422
    assert _post(_jpeg(), sid="nao-e-uuid").status_code == 422
    monkeypatch.setattr(settings, "max_image_bytes", 100)
    assert _post(_jpeg(size=(200, 200))).status_code == 413
    assert fakes["inseridos"] == []


def test_upload_falha_no_armazenamento_e_503(fakes, monkeypatch):
    def quebra(*a, **k):
        raise ConnectionError("fora")

    monkeypatch.setattr(captura_router.storage, "upload_object", quebra)
    assert _post(_jpeg()).status_code == 503
    assert fakes["inseridos"] == []


def test_upload_falha_no_banco_desfaz_o_objeto(fakes, monkeypatch):
    def quebra(**k):
        raise ConnectionError("fora")

    monkeypatch.setattr(captura_router.repositorio, "inserir_imagem", quebra)
    assert _post(_jpeg()).status_code == 503
    assert len(fakes["apagados"]) == 1


def test_listar_e_remover(fakes, monkeypatch):
    row = {
        "id": str(uuid.uuid4()),
        "minio_object_name": "k",
        "data_classificada": None,
        "data_origem": None,
        "descricao_padrao": None,
        "descricao_modelo": None,
    }
    monkeypatch.setattr(captura_router.repositorio, "listar_imagens", lambda s: [row])
    r = client.get(f"/session/{SID}/images")
    assert r.status_code == 200 and r.json()[0]["image_id"] == row["id"]

    monkeypatch.setattr(captura_router.repositorio, "remover_imagem", lambda s, i: "k")
    assert client.delete(f"/session/{SID}/images/{row['id']}").status_code == 204
    assert fakes["apagados"] == ["k"]
    monkeypatch.setattr(captura_router.repositorio, "remover_imagem", lambda s, i: None)
    assert client.delete(f"/session/{SID}/images/{row['id']}").status_code == 404
    assert client.delete(f"/session/{SID}/images/xx").status_code == 422


# ------------------------------------------------------------------------ WebSocket


class VozFalsa:
    def __init__(self, falha_ao_abrir=False):
        self.falha_ao_abrir = falha_ao_abrir
        self.audio: list[bytes] = []
        self.fila: asyncio.Queue = asyncio.Queue()
        self.fechada = False

    async def abrir(self):
        if self.falha_ao_abrir:
            raise ConnectionError("fora")

    async def enviar_audio(self, chunk):
        self.audio.append(chunk)
        await self.fila.put(
            motor_voz.Transcricao(
                text="oi",
                speaker="medico",
                speaker_id=0,
                is_final=len(self.audio) > 1,
                timestamp_ms=10,
            )
        )

    async def manter_viva(self):
        pass

    async def fechar_stream(self):
        await self.fila.put(
            motor_voz.Transcricao(
                text="fim", speaker="paciente", speaker_id=1, is_final=True, timestamp_ms=99
            )
        )
        await self.fila.put(None)

    async def eventos(self):
        while True:
            t = await self.fila.get()
            if t is None:
                return
            yield t

    async def fechar(self):
        self.fechada = True


@pytest.fixture
def ws_fakes(monkeypatch):
    monkeypatch.setattr(settings, "deepgram_api_key", "chave-de-teste")
    salvas = []
    monkeypatch.setattr(
        captura_router.repositorio, "inserir_transcricao", lambda **kw: salvas.append(kw)
    )
    voz = VozFalsa()
    monkeypatch.setattr(captura_router, "criar_sessao_voz", lambda: voz)
    return voz, salvas


def test_ws_sem_chave_avisa_e_fecha(monkeypatch):
    monkeypatch.setattr(settings, "deepgram_api_key", "")
    with client.websocket_connect(f"/ws/session/{SID}/audio") as ws:
        msg = ws.receive_json()
        assert (msg["type"], msg["codigo"]) == ("erro", "sem_chave")


def test_ws_motor_indisponivel_avisa(monkeypatch):
    monkeypatch.setattr(settings, "deepgram_api_key", "x")
    monkeypatch.setattr(captura_router, "criar_sessao_voz", lambda: VozFalsa(falha_ao_abrir=True))
    with client.websocket_connect(f"/ws/session/{SID}/audio") as ws:
        assert ws.receive_json()["codigo"] == "motor_indisponivel"


def test_ws_sessao_invalida_e_origem_proibida(monkeypatch):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/session/abc/audio"):
            pass
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws/session/{SID}/audio", headers={"origin": "http://malicioso.com"}
        ):
            pass


def test_ws_transcreve_pausa_ignora_audio_e_stop_entrega_o_final(ws_fakes):
    voz, salvas = ws_fakes
    with client.websocket_connect(f"/ws/session/{SID}/audio") as ws:
        assert ws.receive_json() == {"type": "estado", "estado": "gravando"}
        ws.send_bytes(b"a1")
        parcial = ws.receive_json()
        assert (parcial["type"], parcial["is_final"], parcial["speaker"]) == (
            "transcricao",
            False,
            "medico",
        )
        ws.send_text('{"type":"pause"}')
        assert ws.receive_json()["estado"] == "pausado"
        ws.send_bytes(b"ignorado")
        ws.send_text('{"type":"resume"}')
        assert ws.receive_json()["estado"] == "gravando"
        ws.send_bytes(b"a2")
        assert ws.receive_json()["is_final"] is True
        ws.send_text('{"type":"stop"}')
        fim = ws.receive_json()
        assert (fim["text"], fim["speaker"]) == ("fim", "paciente")
        assert ws.receive_json() == {"type": "estado", "estado": "encerrado"}
    assert voz.audio == [b"a1", b"a2"]
    assert voz.fechada
    assert [s["texto"] for s in salvas] == ["oi", "fim"]


def test_ws_chunk_grande_e_recusado(ws_fakes, monkeypatch):
    voz, _ = ws_fakes
    monkeypatch.setattr(settings, "max_audio_chunk_bytes", 4)
    with client.websocket_connect(f"/ws/session/{SID}/audio") as ws:
        ws.receive_json()
        ws.send_bytes(b"123456789")
        assert ws.receive_json()["codigo"] == "chunk_grande"
    assert voz.audio == []


def test_estado_dos_motores_mostra_o_que_falta(monkeypatch):
    monkeypatch.setattr(settings, "deepgram_api_key", "")
    monkeypatch.setattr(settings, "openai_api_key", "")
    r = client.get("/captura/motores").json()
    assert r["voz"]["ok"] is False and "DEEPGRAM_API_KEY" in r["voz"]["detalhe"]
    assert r["visao"]["ok"] is False and "OPENAI_API_KEY" in r["visao"]["detalhe"]
    monkeypatch.setattr(settings, "deepgram_api_key", "x")
    monkeypatch.setattr(settings, "openai_api_key", "y")
    r = client.get("/captura/motores").json()
    assert r["voz"] == {"provedor": "deepgram", "ok": True}
    assert r["visao"] == {"provedor": "openai", "ok": True}


def test_url_da_imagem_e_servida_pelo_backend_e_arquivo_abre(fakes, monkeypatch):
    b = _post(_jpeg("2025:03:14 10:20:30")).json()
    assert b["url"] == f"/session/{SID}/images/{b['image_id']}/arquivo"  # relativa, sem 127.0.0.1

    chave = f"sessions/{SID}/abc.jpg"
    monkeypatch.setattr(captura_router.repositorio, "chave_da_imagem", lambda s, i: chave)
    monkeypatch.setattr(captura_router.storage, "get_object", lambda k: b"JPEGDATA")
    r = client.get(b["url"])
    assert r.status_code == 200 and r.content == b"JPEGDATA"
    assert r.headers["content-type"] == "image/jpeg"


def test_arquivo_da_imagem_inexistente_ou_invalido(fakes, monkeypatch):
    monkeypatch.setattr(captura_router.repositorio, "chave_da_imagem", lambda s, i: None)
    assert client.get(f"/session/{SID}/images/{uuid.uuid4()}/arquivo").status_code == 404
    assert client.get(f"/session/{SID}/images/nao-e-uuid/arquivo").status_code == 422
    assert client.get("/session/xx/images/" + str(uuid.uuid4()) + "/arquivo").status_code == 422
