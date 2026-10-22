"""Persistência da captura (imagens e transcrições). Funções síncronas e pequenas."""

import json
import logging
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db import engine

logger = logging.getLogger(__name__)

DDL = [
    """
    CREATE TABLE IF NOT EXISTS images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL,
      minio_object_name TEXT NOT NULL,
      url TEXT NOT NULL,
      data_classificada DATE,
      data_origem TEXT, -- 'exif' | 'manual' | 'aproximada'
      descricao_padrao TEXT,
      descricao_modelo TEXT, -- modelo que gerou a descrição (auditoria)
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS images_session_idx ON images (session_id)",
    """
    CREATE TABLE IF NOT EXISTS transcricoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL,
      texto TEXT NOT NULL,
      speaker TEXT, -- 'medico' | 'paciente' | 'acompanhante' | 'indefinido'
      is_final BOOLEAN DEFAULT FALSE,
      timestamp_ms BIGINT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS transcricoes_session_idx ON transcricoes (session_id)",
    """
    CREATE TABLE IF NOT EXISTS prontuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID,
      paciente TEXT NOT NULL DEFAULT '',
      modo TEXT NOT NULL DEFAULT '',
      texto TEXT NOT NULL,
      pdf_object_name TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS prontuarios_criado_idx ON prontuarios (criado_em DESC)",
    """
    CREATE TABLE IF NOT EXISTS pacientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome TEXT NOT NULL,
      nascimento DATE,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS pacientes_nome_idx ON pacientes (lower(nome))",
    """
    CREATE TABLE IF NOT EXISTS laudos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'pdf' | 'imagem'
      content_type TEXT NOT NULL,
      object_name TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS laudos_session_idx ON laudos (session_id)",
    "ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS cpf TEXT",
    *(
        f"ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS {c} TEXT"
        for c in (
            "sexo",
            "contato",
            "profissao",
            "moradia",
            "plano_saude",
            "historico_familiar",
            "medicacoes_uso",
            "alergias",
        )
    ),
    "CREATE UNIQUE INDEX IF NOT EXISTS pacientes_cpf_idx ON pacientes (cpf) WHERE cpf IS NOT NULL",
    "ALTER TABLE prontuarios ADD COLUMN IF NOT EXISTS paciente_id UUID",
    "ALTER TABLE prontuarios ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'nova'",
    "ALTER TABLE prontuarios ADD COLUMN IF NOT EXISTS retorno_de UUID",
    "ALTER TABLE prontuarios ADD COLUMN IF NOT EXISTS corrigido_em TIMESTAMP",
    "CREATE INDEX IF NOT EXISTS prontuarios_paciente_idx "
    "ON prontuarios (paciente_id, criado_em DESC)",
    """
    CREATE TABLE IF NOT EXISTS receitas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id UUID,
      session_id UUID,
      paciente TEXT NOT NULL DEFAULT '',
      itens JSONB NOT NULL,
      observacoes TEXT NOT NULL DEFAULT '',
      medico_nome TEXT NOT NULL DEFAULT '',
      medico_crm TEXT NOT NULL DEFAULT '',
      pdf_object_name TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS receitas_paciente_idx ON receitas (paciente_id, criado_em DESC)",
    """
    CREATE TABLE IF NOT EXISTS documentos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo TEXT NOT NULL, -- 'atestado' | 'declaracao_comparecimento'
      paciente_id UUID,
      session_id UUID,
      paciente TEXT NOT NULL DEFAULT '',
      conteudo JSONB NOT NULL, -- campos específicos do tipo (dias/CID, período, etc.)
      medico_nome TEXT NOT NULL DEFAULT '',
      medico_crm TEXT NOT NULL DEFAULT '',
      pdf_object_name TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS documentos_paciente_idx ON documentos (paciente_id, tipo, criado_em DESC)",
    """
    CREATE TABLE IF NOT EXISTS pre_consultas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id UUID NOT NULL,
      especialidade TEXT NOT NULL,
      respostas JSONB NOT NULL,
      alerta_critico BOOLEAN NOT NULL DEFAULT FALSE,
      criado_em TIMESTAMP DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS pre_consultas_paciente_idx "
    "ON pre_consultas (paciente_id, criado_em DESC)",
]


# Busca por parte do nome/CPF (ILIKE '%q%') só usa índice trigram. Opcional: se a extensão não puder
# ser criada, o app segue funcionando (a busca só fica sem índice).
DDL_TRIGRAM = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    "CREATE INDEX IF NOT EXISTS pacientes_nome_trgm_idx ON pacientes USING gin (nome gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS pacientes_cpf_trgm_idx ON pacientes USING gin (cpf gin_trgm_ops)",
]


def criar_tabelas() -> None:
    with engine.begin() as conn:
        for stmt in DDL:
            conn.execute(text(stmt))
    try:
        with engine.begin() as conn:
            for stmt in DDL_TRIGRAM:
                conn.execute(text(stmt))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Índice trigram de pacientes indisponível: %s", type(exc).__name__)


def _imagem(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    d["id"] = str(d["id"])
    d["session_id"] = str(d["session_id"])
    return d


def inserir_imagem(
    *,
    session_id: str,
    object_name: str,
    url: str,
    data_classificada: date | None,
    data_origem: str | None,
    descricao: str | None,
    modelo: str | None,
) -> dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO images (session_id, minio_object_name, url, data_classificada,
                                    data_origem, descricao_padrao, descricao_modelo)
                VALUES (CAST(:sid AS uuid), :obj, :url, :data, :origem, :desc, :modelo)
                RETURNING *
                """
            ),
            {
                "sid": session_id,
                "obj": object_name,
                "url": url,
                "data": data_classificada,
                "origem": data_origem,
                "desc": descricao,
                "modelo": modelo,
            },
        ).one()
    return _imagem(row)


def listar_imagens(session_id: str) -> list[dict[str, Any]]:
    """Ordem cronológica; imagens sem data vão para o fim, na ordem de envio."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, session_id, data_classificada, data_origem, descricao_padrao,
                       descricao_modelo
                FROM images WHERE session_id = CAST(:sid AS uuid)
                ORDER BY data_classificada ASC NULLS LAST, criado_em ASC
                """
            ),
            {"sid": session_id},
        ).all()
    return [_imagem(r) for r in rows]


def chave_da_imagem(session_id: str, image_id: str) -> str | None:
    """Nome do objeto no armazenamento (para servir a imagem pelo próprio backend)."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT minio_object_name FROM images "
                "WHERE id = CAST(:iid AS uuid) AND session_id = CAST(:sid AS uuid)"
            ),
            {"iid": image_id, "sid": session_id},
        ).first()
    return row[0] if row else None


def remover_imagem(session_id: str, image_id: str) -> str | None:
    """Apaga o registro e devolve o nome do objeto (para apagar do armazenamento)."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                DELETE FROM images
                WHERE id = CAST(:iid AS uuid) AND session_id = CAST(:sid AS uuid)
                RETURNING minio_object_name
                """
            ),
            {"iid": image_id, "sid": session_id},
        ).first()
    return row[0] if row else None


def inserir_transcricao(
    *, session_id: str, texto: str, speaker: str, is_final: bool, timestamp_ms: int | None
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO transcricoes (session_id, texto, speaker, is_final, timestamp_ms)
                VALUES (CAST(:sid AS uuid), :texto, :speaker, :final, :ts)
                """
            ),
            {
                "sid": session_id,
                "texto": texto,
                "speaker": speaker,
                "final": is_final,
                "ts": timestamp_ms,
            },
        )


# ----------------------------------------------------------------------------- laudos


def _laudo(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    d["id"] = str(d["id"])
    return d


def inserir_laudo(
    *, session_id: str, nome: str, tipo: str, content_type: str, object_name: str
) -> dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO laudos (session_id, nome, tipo, content_type, object_name)
                VALUES (CAST(:sid AS uuid), :nome, :tipo, :ct, :obj)
                RETURNING id, session_id, nome, tipo, content_type, object_name, criado_em
                """
            ),
            {"sid": session_id, "nome": nome, "tipo": tipo, "ct": content_type, "obj": object_name},
        ).one()
    return _laudo(row)


def listar_laudos(session_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, session_id, nome, tipo, content_type, object_name, criado_em "
                "FROM laudos WHERE session_id = CAST(:sid AS uuid) ORDER BY criado_em"
            ),
            {"sid": session_id},
        ).all()
    return [_laudo(r) for r in rows]


def listar_laudos_de_sessoes(session_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """Laudos de várias sessões numa só query: {session_id: [laudos]} (sem laudo = fora)."""
    if not session_ids:
        return {}
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, session_id, nome, tipo, content_type, object_name, criado_em "
                "FROM laudos WHERE session_id = ANY(CAST(:ids AS uuid[])) "
                "ORDER BY session_id, criado_em"
            ),
            {"ids": list(dict.fromkeys(session_ids))},
        ).all()
    agrupados: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        d = _laudo(r)
        agrupados.setdefault(str(d["session_id"]), []).append(d)
    return agrupados


def obter_laudo(laudo_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT id, session_id, nome, tipo, content_type, object_name, criado_em "
                "FROM laudos WHERE id = CAST(:id AS uuid)"
            ),
            {"id": laudo_id},
        ).first()
    return _laudo(row) if row else None


def remover_laudo(session_id: str, laudo_id: str) -> str | None:
    """Apaga o registro do laudo e devolve o nome do arquivo no armazenamento."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                "DELETE FROM laudos WHERE id = CAST(:id AS uuid) "
                "AND session_id = CAST(:sid AS uuid) RETURNING object_name"
            ),
            {"id": laudo_id, "sid": session_id},
        ).first()
    return row[0] if row else None


# ----------------------------------------------------------------------------- prontuários


def _prontuario(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    for campo in ("id", "paciente_id", "retorno_de", "session_id"):
        if d.get(campo) is not None:
            d[campo] = str(d[campo])
    return d


def inserir_prontuario(
    *,
    session_id: str | None,
    paciente: str,
    modo: str,
    texto: str,
    pdf_object_name: str,
    paciente_id: str | None = None,
    tipo: str = "nova",
    retorno_de: str | None = None,
) -> dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO prontuarios
                  (session_id, paciente, modo, texto, pdf_object_name,
                   paciente_id, tipo, retorno_de)
                VALUES (CAST(:sid AS uuid), :paciente, :modo, :texto, :pdf,
                        CAST(:pid AS uuid), :tipo, CAST(:ret AS uuid))
                RETURNING id, paciente, paciente_id, modo, tipo, criado_em
                """
            ),
            {
                "sid": session_id,
                "paciente": paciente,
                "modo": modo,
                "texto": texto,
                "pdf": pdf_object_name,
                "pid": paciente_id,
                "tipo": tipo,
                "ret": retorno_de,
            },
        ).one()
    return _prontuario(row)


#: Máximo de itens por lista (prontuários e pacientes). Acima disso a API avisa que truncou.
LIMITE_LISTA = 500


def listar_prontuarios(limite: int = LIMITE_LISTA) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, paciente, paciente_id, modo, tipo, criado_em FROM prontuarios "
                "ORDER BY criado_em DESC LIMIT :n"
            ),
            {"n": limite},
        ).all()
    return [_prontuario(r) for r in rows]


def contar_prontuarios() -> int:
    with engine.connect() as conn:
        return int(conn.execute(text("SELECT count(*) FROM prontuarios")).scalar_one())


def obter_prontuario(prontuario_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM prontuarios WHERE id = CAST(:id AS uuid)"), {"id": prontuario_id}
        ).first()
    return _prontuario(row) if row else None


def remover_prontuario(prontuario_id: str) -> str | None:
    """Apaga o registro e devolve o nome do PDF no armazenamento (para apagá-lo também)."""
    with engine.begin() as conn:
        row = conn.execute(
            text("DELETE FROM prontuarios WHERE id = CAST(:id AS uuid) RETURNING pdf_object_name"),
            {"id": prontuario_id},
        ).first()
    return row[0] if row else None


def corrigir_prontuario(prontuario_id: str, *, texto: str, pdf_object_name: str) -> str | None:
    """Troca o texto e o PDF (correção de erros). Devolve o PDF antigo, ou None se não existe."""
    with engine.begin() as conn:
        antigo = conn.execute(
            text(
                """
                UPDATE prontuarios p
                SET texto = :texto, pdf_object_name = :pdf, corrigido_em = NOW()
                FROM (SELECT id, pdf_object_name FROM prontuarios
                      WHERE id = CAST(:id AS uuid) FOR UPDATE) velho
                WHERE p.id = velho.id
                RETURNING velho.pdf_object_name
                """
            ),
            {"texto": texto, "pdf": pdf_object_name, "id": prontuario_id},
        ).first()
    return antigo[0] if antigo else None


# ----------------------------------------------------------------------------- pacientes


def _paciente(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    d["id"] = str(d["id"])
    return d


class CpfDuplicado(Exception):
    """Já existe outro paciente com este CPF."""


CAMPOS_FICHA = (
    "cpf", "sexo", "contato", "profissao", "moradia", "plano_saude",
    "historico_familiar", "medicacoes_uso", "alergias",
)  # fmt: skip
_COLUNAS = "id, nome, nascimento, criado_em, " + ", ".join(CAMPOS_FICHA)


def inserir_paciente(*, nome: str, nascimento: Any, dados: dict[str, Any]) -> dict[str, Any]:
    campos = ["nome", "nascimento", *CAMPOS_FICHA]
    valores = {"nome": nome, "nascimento": nascimento, **{c: dados.get(c) for c in CAMPOS_FICHA}}
    sql = (
        f"INSERT INTO pacientes ({', '.join(campos)}) "
        f"VALUES ({', '.join(':' + c for c in campos)}) RETURNING {_COLUNAS}"
    )
    try:
        with engine.begin() as conn:
            row = conn.execute(text(sql), valores).one()
    except IntegrityError as exc:
        raise CpfDuplicado from exc
    return _paciente(row)


def atualizar_paciente(
    paciente_id: str, *, nome: str, nascimento: Any, dados: dict[str, Any]
) -> dict[str, Any] | None:
    campos = ["nome", "nascimento", *CAMPOS_FICHA]
    valores = {"nome": nome, "nascimento": nascimento, "id": paciente_id}
    valores.update({c: dados.get(c) for c in CAMPOS_FICHA})
    sql = (
        f"UPDATE pacientes SET {', '.join(f'{c} = :{c}' for c in campos)} "
        f"WHERE id = CAST(:id AS uuid) RETURNING {_COLUNAS}"
    )
    try:
        with engine.begin() as conn:
            row = conn.execute(text(sql), valores).first()
    except IntegrityError as exc:
        raise CpfDuplicado from exc
    return _paciente(row) if row else None


def listar_pacientes(q: str | None = None, limite: int = LIMITE_LISTA) -> list[dict[str, Any]]:
    """Pacientes (busca por parte do nome ou do CPF), com o resumo das consultas de cada um."""
    busca = (q or "").strip() or None
    digitos = "".join(c for c in (busca or "") if c.isdigit())
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.id, p.nome, p.nascimento, p.criado_em,
                       COUNT(r.id) AS n_prontuarios, MAX(r.criado_em) AS ultima_consulta
                FROM pacientes p
                LEFT JOIN prontuarios r ON r.paciente_id = p.id
                WHERE (CAST(:q AS text) IS NULL OR p.nome ILIKE '%' || :q || '%'
                       OR (CAST(:d AS text) IS NOT NULL AND p.cpf LIKE '%' || :d || '%'))
                GROUP BY p.id
                ORDER BY MAX(r.criado_em) DESC NULLS LAST, p.nome
                LIMIT :n
                """
            ),
            {"q": busca, "d": digitos if len(digitos) >= 3 else None, "n": limite},
        ).all()
    return [_paciente(r) for r in rows]


def contar_pacientes(q: str | None = None) -> int:
    """Quantos pacientes a busca encontra (mesmo critério de `listar_pacientes`)."""
    busca = (q or "").strip() or None
    digitos = "".join(c for c in (busca or "") if c.isdigit())
    with engine.connect() as conn:
        return int(
            conn.execute(
                text(
                    """
                    SELECT count(*) FROM pacientes p
                    WHERE (CAST(:q AS text) IS NULL OR p.nome ILIKE '%' || :q || '%'
                           OR (CAST(:d AS text) IS NOT NULL AND p.cpf LIKE '%' || :d || '%'))
                    """
                ),
                {"q": busca, "d": digitos if len(digitos) >= 3 else None},
            ).scalar_one()
        )


def obter_paciente(paciente_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT {_COLUNAS} FROM pacientes WHERE id = CAST(:id AS uuid)"),
            {"id": paciente_id},
        ).first()
    return _paciente(row) if row else None


def prontuario_do_paciente(paciente_id: str) -> list[dict[str, Any]]:
    """Todos os registros do paciente com o texto, do mais antigo para o mais recente."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, session_id, paciente, paciente_id, modo, tipo, retorno_de, texto, "
                "criado_em, corrigido_em FROM prontuarios WHERE paciente_id = CAST(:id AS uuid) "
                "ORDER BY criado_em ASC"
            ),
            {"id": paciente_id},
        ).all()
    return [_prontuario(r) for r in rows]


def listar_prontuarios_do_paciente(paciente_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, paciente, paciente_id, modo, tipo, criado_em FROM prontuarios "
                "WHERE paciente_id = CAST(:id AS uuid) ORDER BY criado_em DESC"
            ),
            {"id": paciente_id},
        ).all()
    return [_prontuario(r) for r in rows]


# ----------------------------------------------------------------------------- receitas

_COLUNAS_RECEITA = (
    "id, paciente_id, session_id, paciente, itens, observacoes, medico_nome, medico_crm, "
    "pdf_object_name, criado_em"
)


def _receita(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    for campo in ("id", "paciente_id", "session_id"):
        if d.get(campo) is not None:
            d[campo] = str(d[campo])
    return d


def inserir_receita(
    *,
    paciente_id: str | None,
    session_id: str | None,
    paciente: str,
    itens: list[dict[str, str]],
    observacoes: str,
    medico_nome: str,
    medico_crm: str,
    pdf_object_name: str,
) -> dict[str, Any]:
    """Receita é registro legal: só insere. Correção = nova receita (nada é apagado)."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                f"""
                INSERT INTO receitas (paciente_id, session_id, paciente, itens, observacoes,
                                      medico_nome, medico_crm, pdf_object_name)
                VALUES (CAST(:pid AS uuid), CAST(:sid AS uuid), :paciente,
                        CAST(:itens AS jsonb), :obs, :mnome, :mcrm, :pdf)
                RETURNING {_COLUNAS_RECEITA}
                """
            ),
            {
                "pid": paciente_id,
                "sid": session_id,
                "paciente": paciente,
                "itens": json.dumps(itens, ensure_ascii=False),
                "obs": observacoes,
                "mnome": medico_nome,
                "mcrm": medico_crm,
                "pdf": pdf_object_name,
            },
        ).one()
    return _receita(row)


def receitas_do_paciente(paciente_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"SELECT {_COLUNAS_RECEITA} FROM receitas "
                "WHERE paciente_id = CAST(:pid AS uuid) ORDER BY criado_em DESC"
            ),
            {"pid": paciente_id},
        ).all()
    return [_receita(r) for r in rows]


def obter_receita(receita_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT {_COLUNAS_RECEITA} FROM receitas WHERE id = CAST(:id AS uuid)"),
            {"id": receita_id},
        ).first()
    return _receita(row) if row else None


# ----------------------------------------------------------------------------- documentos (atestado, declaração)
# Tabela única para os dois tipos (tipo + conteudo JSONB): mesmo boilerplate de paciente/médico/PDF
# da receita, só o conteúdo específico muda. Registro legal, igual à receita: só insere.

_COLUNAS_DOCUMENTO = (
    "id, tipo, paciente_id, session_id, paciente, conteudo, medico_nome, medico_crm, "
    "pdf_object_name, criado_em"
)


def _documento(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    for campo in ("id", "paciente_id", "session_id"):
        if d.get(campo) is not None:
            d[campo] = str(d[campo])
    return d


def inserir_documento(
    *,
    tipo: str,
    paciente_id: str | None,
    session_id: str | None,
    paciente: str,
    conteudo: dict[str, Any],
    medico_nome: str,
    medico_crm: str,
    pdf_object_name: str,
) -> dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                f"""
                INSERT INTO documentos (tipo, paciente_id, session_id, paciente, conteudo,
                                        medico_nome, medico_crm, pdf_object_name)
                VALUES (:tipo, CAST(:pid AS uuid), CAST(:sid AS uuid), :paciente,
                        CAST(:conteudo AS jsonb), :mnome, :mcrm, :pdf)
                RETURNING {_COLUNAS_DOCUMENTO}
                """
            ),
            {
                "tipo": tipo,
                "pid": paciente_id,
                "sid": session_id,
                "paciente": paciente,
                "conteudo": json.dumps(conteudo, ensure_ascii=False),
                "mnome": medico_nome,
                "mcrm": medico_crm,
                "pdf": pdf_object_name,
            },
        ).one()
    return _documento(row)


def documentos_do_paciente(paciente_id: str, tipo: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"SELECT {_COLUNAS_DOCUMENTO} FROM documentos "
                "WHERE paciente_id = CAST(:pid AS uuid) AND tipo = :tipo ORDER BY criado_em DESC"
            ),
            {"pid": paciente_id, "tipo": tipo},
        ).all()
    return [_documento(r) for r in rows]


def obter_documento(documento_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT {_COLUNAS_DOCUMENTO} FROM documentos WHERE id = CAST(:id AS uuid)"),
            {"id": documento_id},
        ).first()
    return _documento(row) if row else None


# ----------------------------------------------------------------------------- pré-consulta

_COLUNAS_PRE_CONSULTA = "id, paciente_id, especialidade, respostas, alerta_critico, criado_em"


def _pre_consulta(row: Any) -> dict[str, Any]:
    d = dict(row._mapping)
    d["id"] = str(d["id"])
    d["paciente_id"] = str(d["paciente_id"])
    return d


def inserir_pre_consulta(
    *, paciente_id: str, especialidade: str, respostas: dict[str, Any], alerta_critico: bool
) -> dict[str, Any]:
    """Ficha pré-consulta é registro clínico: só insere (nunca edita nem apaga)."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                f"""
                INSERT INTO pre_consultas (paciente_id, especialidade, respostas, alerta_critico)
                VALUES (CAST(:pid AS uuid), :esp, CAST(:resp AS jsonb), :alerta)
                RETURNING {_COLUNAS_PRE_CONSULTA}
                """
            ),
            {
                "pid": paciente_id,
                "esp": especialidade,
                "resp": json.dumps(respostas, ensure_ascii=False),
                "alerta": alerta_critico,
            },
        ).one()
    return _pre_consulta(row)


def pre_consultas_do_paciente(paciente_id: str) -> list[dict[str, Any]]:
    """Mais recente primeiro."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"SELECT {_COLUNAS_PRE_CONSULTA} FROM pre_consultas "
                "WHERE paciente_id = CAST(:pid AS uuid) ORDER BY criado_em DESC"
            ),
            {"pid": paciente_id},
        ).all()
    return [_pre_consulta(r) for r in rows]
