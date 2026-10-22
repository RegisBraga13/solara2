"""Backup e restauração dos dados do espec·IA·lidades: banco (Postgres) e arquivos (S3).

Uso (na pasta backend):
    .venv/Scripts/python -m scripts.backup fazer              # dados clínicos (rápido, pequeno)
    .venv/Scripts/python -m scripts.backup fazer --completo   # inclui o acervo RAG (GBs; recriável)
    .venv/Scripts/python -m scripts.backup listar
    .venv/Scripts/python -m scripts.backup verificar [pasta]  # confere hashes e o dump; não altera
    .venv/Scripts/python -m scripts.backup restaurar <pasta> --banco medconsult_teste

Destino: variável BACKUP_DIR (padrão: ~/MedConsultBackups). Fica FORA do repositório e contém dados
de pacientes: guarde em disco/pasta protegidos (idealmente cifrados) e em um segundo local. Nada é
enviado para a internet por este script.

Garantias:
- O backup é montado em `.parcial-*` e só ganha o nome final depois de verificado; um backup que
  falhou nunca aparece como válido.
- Restaurar NUNCA toca o banco ativo sem `--sobrescrever`. O normal é restaurar num banco de teste
  e conferir as contagens do manifesto.
- O acervo RAG (rag_documentos, rag_trechos) é recriável a partir de `acervo/` e fica fora do backup
  padrão: é ~99% do tamanho do banco e não contém dado de paciente.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from app.config import settings

VERSAO_MANIFESTO = 1
PREFIXO = "medconsult-"
CONTAINER_PG = os.environ.get("MEDCONSULT_PG_CONTAINER", "medconsult-postgres")
TABELAS_RAG = ("rag_documentos", "rag_trechos")
MANTER_PADRAO = 14


class BackupErro(RuntimeError):
    pass


def _destino_raiz() -> Path:
    return Path(os.environ.get("BACKUP_DIR") or Path.home() / "MedConsultBackups")


def _banco_ativo() -> str:
    return urlparse(settings.database_url).path.lstrip("/")


def _usuario_pg() -> str:
    return urlparse(settings.database_url).username or "medconsult"


def _sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as f:
        for bloco in iter(lambda: f.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def _docker(*args: str, entrada=None, saida=None, capturar: bool = False):
    cmd = ["docker", "exec", *(["-i"] if entrada is not None else []), CONTAINER_PG, *args]
    r = subprocess.run(
        cmd,
        stdin=entrada,
        stdout=saida if saida is not None else (subprocess.PIPE if capturar else None),
        stderr=subprocess.PIPE,
        check=False,
    )
    if r.returncode != 0:
        raise BackupErro(
            f"{' '.join(args[:2])} falhou: {r.stderr.decode('utf-8', 'replace')[:500]}"
        )
    return r.stdout.decode("utf-8", "replace") if capturar else None


def _psql(banco: str, sql: str) -> str:
    return _docker(
        "psql", "-U", _usuario_pg(), "-d", banco, "-At", "-c", sql, capturar=True
    ).strip()


def _tabelas_clinicas(banco: str) -> list[str]:
    saida = _psql(
        banco,
        "select tablename from pg_tables where schemaname='public' order by tablename",
    )
    return [t for t in saida.splitlines() if t and t not in TABELAS_RAG]


def _contagens(banco: str) -> dict[str, int]:
    return {t: int(_psql(banco, f'select count(*) from "{t}"')) for t in _tabelas_clinicas(banco)}


def _chave_segura(chave: str) -> bool:
    """Chave S3 que vira caminho local: relativa, sem '..', sem raiz nem unidade (Windows)."""
    if not chave or chave.startswith(("/", "\\")) or ":" in chave:
        return False
    return ".." not in chave.replace("\\", "/").split("/")


def _s3():
    from app.storage import s3_client

    return s3_client


def _copiar_arquivos(pasta: Path) -> list[dict]:
    s3 = _s3()
    itens = []
    pag = s3.get_paginator("list_objects_v2")
    for pagina in pag.paginate(Bucket=settings.s3_bucket):
        for obj in pagina.get("Contents", []):
            chave = obj["Key"]
            if not _chave_segura(chave):
                raise BackupErro(f"chave de arquivo insegura no storage: {chave!r}")
            destino = pasta / "arquivos" / chave
            destino.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(settings.s3_bucket, chave, str(destino))
            itens.append(
                {"chave": chave, "bytes": destino.stat().st_size, "sha256": _sha256(destino)}
            )
    return itens


def verificar(pasta: Path) -> dict:
    """Confere manifesto, hashes e a legibilidade do dump; levanta BackupErro se algo falhar."""
    mf_path = pasta / "manifesto.json"
    if not mf_path.is_file():
        raise BackupErro(f"{pasta.name}: sem manifesto.json (backup incompleto)")
    mf = json.loads(mf_path.read_text(encoding="utf-8"))
    dump = pasta / mf["banco"]["arquivo"]
    if not dump.is_file() or _sha256(dump) != mf["banco"]["sha256"]:
        raise BackupErro(f"{pasta.name}: dump do banco ausente ou corrompido")
    for item in mf["arquivos"]:
        if not _chave_segura(item["chave"]):
            raise BackupErro(f"{pasta.name}: chave insegura {item['chave']!r}")
        f = pasta / "arquivos" / item["chave"]
        if not f.is_file() or _sha256(f) != item["sha256"]:
            raise BackupErro(f"{pasta.name}: arquivo ausente ou corrompido: {item['chave']}")
    with dump.open("rb") as entrada:
        _docker("pg_restore", "--list", entrada=entrada, saida=subprocess.DEVNULL)
    return mf


def _rotacionar(raiz: Path, manter: int) -> list[str]:
    validos = sorted(
        p
        for p in raiz.iterdir()
        if p.is_dir() and p.name.startswith(PREFIXO) and p.name[-6:].isdigit()
    )
    removidos = []
    for antigo in validos[: max(0, len(validos) - manter)]:
        shutil.rmtree(antigo)
        removidos.append(antigo.name)
    return removidos


def fazer(completo: bool = False, manter: int = MANTER_PADRAO) -> Path:
    raiz = _destino_raiz()
    raiz.mkdir(parents=True, exist_ok=True)
    carimbo = datetime.now().strftime("%Y%m%d-%H%M%S")
    final = raiz / f"{PREFIXO}{carimbo}"
    parcial = raiz / f".parcial-{carimbo}"
    parcial.mkdir()
    try:
        banco = _banco_ativo()
        contagens = _contagens(banco)
        excluir = [] if completo else [f"--exclude-table-data={t}" for t in TABELAS_RAG]
        dump = parcial / "banco.dump"
        with dump.open("wb") as saida:
            _docker("pg_dump", "-U", _usuario_pg(), "-d", banco, "-Fc", *excluir, saida=saida)
        arquivos = _copiar_arquivos(parcial)
        manifesto = {
            "versao": VERSAO_MANIFESTO,
            "criado_em": datetime.now().isoformat(timespec="seconds"),
            "completo": completo,
            "banco_origem": banco,
            "banco": {
                "arquivo": "banco.dump",
                "bytes": dump.stat().st_size,
                "sha256": _sha256(dump),
            },
            "contagens": contagens,  # só números por tabela; nenhum conteúdo clínico
            "arquivos": arquivos,
        }
        (parcial / "manifesto.json").write_text(
            json.dumps(manifesto, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        verificar(parcial)
        parcial.rename(final)
    except BaseException:
        shutil.rmtree(parcial, ignore_errors=True)
        raise
    removidos = _rotacionar(raiz, manter)
    print(f"Backup criado: {final}")
    print(f"  banco: {manifesto['banco']['bytes'] / 1e6:.1f} MB | arquivos: {len(arquivos)}")
    print(f"  tabelas: {contagens}")
    if removidos:
        print(f"  rotação: removidos {len(removidos)} backups antigos (mantém {manter})")
    return final


def listar() -> int:
    raiz = _destino_raiz()
    pastas = sorted(p for p in raiz.glob(f"{PREFIXO}*") if p.is_dir()) if raiz.is_dir() else []
    if not pastas:
        print(f"Nenhum backup em {raiz}.")
        return 1
    for p in pastas:
        mf = p / "manifesto.json"
        info = json.loads(mf.read_text(encoding="utf-8")) if mf.is_file() else {}
        print(
            f"{p.name}  banco={info.get('banco', {}).get('bytes', 0) / 1e6:.1f}MB  "
            f"arquivos={len(info.get('arquivos', []))}  completo={info.get('completo')}"
        )
    return 0


def restaurar(pasta: Path, banco: str, sobrescrever: bool = False, arquivos: bool = False) -> int:
    mf = verificar(pasta)
    ativo = _banco_ativo()
    if banco == ativo and not sobrescrever:
        raise BackupErro(
            f"'{banco}' é o banco ativo. Restaure num banco de teste (--banco medconsult_teste) "
            "ou use --sobrescrever, sabendo que isso substitui os dados atuais."
        )
    existe = _psql("postgres", f"select 1 from pg_database where datname='{banco}'") == "1"
    if existe and banco != ativo:
        raise BackupErro(f"o banco '{banco}' já existe; escolha outro nome ou apague-o antes.")
    if not existe:
        _docker("createdb", "-U", _usuario_pg(), banco)
    limpar = ["--clean", "--if-exists"] if existe else []
    with (pasta / mf["banco"]["arquivo"]).open("rb") as entrada:
        _docker(
            "pg_restore", "-U", _usuario_pg(), "-d", banco, "--no-owner", *limpar, entrada=entrada
        )
    obtido = _contagens(banco)
    diferentes = {t: (n, obtido.get(t)) for t, n in mf["contagens"].items() if obtido.get(t) != n}
    if diferentes:
        raise BackupErro(f"contagens diferentes do manifesto (esperado, obtido): {diferentes}")
    print(f"Banco '{banco}' restaurado; contagens conferem: {obtido}")
    if arquivos:
        s3 = _s3()
        for item in mf["arquivos"]:
            s3.upload_file(
                str(pasta / "arquivos" / item["chave"]), settings.s3_bucket, item["chave"]
            )
        print(f"{len(mf['arquivos'])} arquivos devolvidos ao storage.")
    elif mf["arquivos"]:
        print("Arquivos (laudos/imagens) NÃO foram devolvidos ao storage; use --arquivos.")
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fazer")
    f.add_argument("--completo", action="store_true", help="inclui o acervo RAG (muito maior)")
    f.add_argument("--manter", type=int, default=MANTER_PADRAO)
    sub.add_parser("listar")
    v = sub.add_parser("verificar")
    v.add_argument("pasta", nargs="?", type=Path, help="padrão: o backup mais recente")
    r = sub.add_parser("restaurar")
    r.add_argument("pasta", type=Path)
    r.add_argument("--banco", required=True)
    r.add_argument("--sobrescrever", action="store_true")
    r.add_argument("--arquivos", action="store_true", help="devolve laudos/imagens ao storage")
    a = p.parse_args()
    try:
        if a.cmd == "fazer":
            fazer(a.completo, a.manter)
            return 0
        if a.cmd == "listar":
            return listar()
        if a.cmd == "verificar":
            pasta = a.pasta
            if pasta is None:
                todos = sorted(_destino_raiz().glob(f"{PREFIXO}*"))
                if not todos:
                    raise BackupErro("nenhum backup encontrado")
                pasta = todos[-1]
            mf = verificar(pasta)
            print(
                f"OK: {pasta.name} íntegro ({len(mf['arquivos'])} arquivos, "
                f"criado em {mf['criado_em']})."
            )
            return 0
        return restaurar(a.pasta, a.banco, a.sobrescrever, a.arquivos)
    except BackupErro as exc:
        print(f"ERRO: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
