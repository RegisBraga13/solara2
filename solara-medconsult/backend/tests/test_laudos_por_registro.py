from datetime import UTC, datetime

from app.routers import pacientes as rota


def _laudo(sessao, nome):
    return {"id": f"id-{nome}", "session_id": sessao, "nome": nome, "tipo": "pdf",
            "criado_em": datetime.now(UTC)}  # fmt: skip


def test_laudos_de_todas_as_consultas_vem_de_uma_so_query(monkeypatch):
    chamadas = []

    def em_lote(sessoes):
        chamadas.append(list(sessoes))
        return {"s1": [_laudo("s1", "a.pdf"), _laudo("s1", "b.pdf")], "s3": [_laudo("s3", "c.pdf")]}

    monkeypatch.setattr(rota.repositorio, "listar_laudos_de_sessoes", em_lote)
    regs = [
        {"id": "r1", "session_id": "s1"},
        {"id": "r2", "session_id": "s2"},
        {"id": "r3", "session_id": "s3"},
        {"id": "r4", "session_id": None},
    ]

    saida = rota._laudos_por_registro(regs)

    assert chamadas == [["s1", "s2", "s3"]]  # uma query, sem consulta sem sessão
    assert [x.nome for x in saida["r1"]] == ["a.pdf", "b.pdf"]
    assert [x.nome for x in saida["r3"]] == ["c.pdf"]
    assert "r2" not in saida and "r4" not in saida


def test_falha_na_consulta_de_laudos_nao_derruba_o_historico(monkeypatch):
    def quebra(_):
        raise RuntimeError("banco fora")

    monkeypatch.setattr(rota.repositorio, "listar_laudos_de_sessoes", quebra)
    assert rota._laudos_por_registro([{"id": "r1", "session_id": "s1"}]) == {}
