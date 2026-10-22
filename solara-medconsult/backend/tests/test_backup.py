import hashlib
import json

import pytest

from scripts import backup


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _montar(tmp_path, dump=b"dump", arquivos=None):
    arquivos = arquivos or {}
    (tmp_path / "banco.dump").write_bytes(dump)
    itens = []
    for chave, conteudo in arquivos.items():
        f = tmp_path / "arquivos" / chave
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(conteudo)
        itens.append({"chave": chave, "bytes": len(conteudo), "sha256": _sha(conteudo)})
    mf = {
        "versao": 1,
        "criado_em": "2026-10-10T00:00:00",
        "completo": False,
        "banco": {"arquivo": "banco.dump", "bytes": len(dump), "sha256": _sha(dump)},
        "contagens": {},
        "arquivos": itens,
    }
    (tmp_path / "manifesto.json").write_text(json.dumps(mf), encoding="utf-8")


@pytest.mark.parametrize("chave", ["../x", "/etc/passwd", "a/../../b", "C:/x", ""])
def test_chave_insegura_e_recusada(chave):
    assert not backup._chave_segura(chave)


def test_chave_normal_e_aceita():
    assert backup._chave_segura("imagens/2026/abc.jpg")


def test_backup_sem_manifesto_nao_e_valido(tmp_path):
    with pytest.raises(backup.BackupErro, match="sem manifesto"):
        backup.verificar(tmp_path)


def test_dump_corrompido_e_detectado(tmp_path):
    _montar(tmp_path)
    (tmp_path / "banco.dump").write_bytes(b"adulterado")
    with pytest.raises(backup.BackupErro, match="dump"):
        backup.verificar(tmp_path)


def test_arquivo_corrompido_ou_ausente_e_detectado(tmp_path):
    _montar(tmp_path, arquivos={"a.jpg": b"1", "b.jpg": b"2"})
    (tmp_path / "arquivos" / "a.jpg").write_bytes(b"x")
    with pytest.raises(backup.BackupErro, match="a.jpg"):
        backup.verificar(tmp_path)
    (tmp_path / "arquivos" / "a.jpg").write_bytes(b"1")
    (tmp_path / "arquivos" / "b.jpg").unlink()
    with pytest.raises(backup.BackupErro, match="b.jpg"):
        backup.verificar(tmp_path)


def test_rotacao_mantem_os_mais_recentes_e_ignora_parciais(tmp_path):
    nomes = [f"medconsult-2026100{d}-120000" for d in range(1, 6)]
    for n in nomes:
        (tmp_path / n).mkdir()
    (tmp_path / ".parcial-20261001-120000").mkdir()
    (tmp_path / "outra-pasta").mkdir()
    removidos = backup._rotacionar(tmp_path, 2)
    assert removidos == nomes[:3]
    assert {p.name for p in tmp_path.iterdir()} == {
        *nomes[3:],
        ".parcial-20261001-120000",
        "outra-pasta",
    }


def test_restaurar_recusa_banco_ativo_sem_sobrescrever(tmp_path, monkeypatch):
    monkeypatch.setattr(
        backup,
        "verificar",
        lambda p: {"banco": {"arquivo": "banco.dump"}, "contagens": {}, "arquivos": []},
    )
    monkeypatch.setattr(backup, "_banco_ativo", lambda: "medconsult")
    with pytest.raises(backup.BackupErro, match="banco ativo"):
        backup.restaurar(tmp_path, "medconsult")
