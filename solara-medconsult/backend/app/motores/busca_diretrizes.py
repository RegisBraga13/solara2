"""Busca de diretrizes por doença (pastas `backend/diretrizes/<especialidade>/`; NÃO entram no RAG).

Cada arquivo é uma síntese curta de diretrizes para uma doença. O acesso é por NOME do diagnóstico
(comparação sem acento/caixa), nunca por similaridade: quando não há diretriz para a doença, o
resultado é lista vazia, e nada é inventado. O conteúdo é material de apoio para o médico revisar.
"""

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# Raiz das diretrizes: cada especialidade tem a sua subpasta (diretrizes/<slug>/), no mesmo nível.
PASTA = Path(__file__).resolve().parents[2] / "diretrizes"  # backend/diretrizes
MIN_CARACTERES = 3  # evita casar diagnóstico curto demais
#: Siglas de 2 letras aceitas (as demais de 2 letras são rejeitadas). Em minúsculas, sem acento.
ABREVIACOES_MEDICAS = frozenset(
    {
        "ar",
        "avc",
        "dm",
        "dpoc",
        "ea",
        "em",
        "es",
        "fa",
        "fm",
        "hiv",
        "iam",
        "ic",
        "les",
        "oa",
        "tep",
        "tb",
        "tce",
    }
)
_NOME_LONGO = 5  # a partir daqui vale a comparação por trecho; abaixo, só por palavra inteira


def _norm(texto: str) -> str:
    sem = unicodedata.normalize("NFKD", texto)
    return (
        re.sub(r"\s+", " ", "".join(c for c in sem if not unicodedata.combining(c)))
        .casefold()
        .strip()
    )


@dataclass(frozen=True)
class Diretriz:
    arquivo: str
    titulo: str
    nucleo: str  # título sem faixa etária/parênteses, normalizado: "psoriase"
    grupo: str  # 'pediatrico' | 'adulto_idoso' | 'geral'
    atualizado_em: str | None
    texto: str
    #: outros nomes da doença (campo `conditions:` do cabeçalho YAML), normalizados
    aliases: tuple[str, ...] = ()


def _grupo(arquivo: str) -> str:
    if re.match(r"^\d{2}-", arquivo):
        return "pediatrico"
    if re.match(r"^\d{2}_", arquivo):
        return "adulto_idoso"
    return "geral"


def _nome_aceito(nome: str) -> bool:
    """3+ caracteres, ou sigla médica conhecida de 2 (AR, DM, EM, TB...)."""
    return len(nome) >= MIN_CARACTERES or nome in ABREVIACOES_MEDICAS


def _palavra_em(curto: str, longo: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(curto)}(?![a-z0-9])", longo) is not None


def _casa(nome: str, diagnostico: str) -> bool:
    """Nome da doença x diagnóstico.

    - os dois longos: um contém o outro ("psoríase" ~ "psoríase em placas");
    - nome curto ("gota", "AVC") e diagnóstico longo: o nome como palavra inteira
      ("gota úrica" casa; "gotejamento" não);
    - diagnóstico curto ("pele", "ar"): só o nome igual, para não casar com "câncer de pele";
    - sigla de 2 letras ("EM", "AR"): só igual ("em" é preposição: não casa "cefaleia em salvas").
    """
    if len(nome) < MIN_CARACTERES:  # sigla de 2 letras ("EM", "AR"): só igual; "em" é preposição
        return nome == diagnostico
    if len(nome) >= _NOME_LONGO and len(diagnostico) >= _NOME_LONGO:
        return _palavra_em(nome, diagnostico) or _palavra_em(diagnostico, nome)
    if len(diagnostico) >= _NOME_LONGO:
        return _palavra_em(nome, diagnostico)
    return nome == diagnostico


def _nucleo(titulo: str) -> str:
    t = re.sub(r"\(.*?\)", "", titulo)
    t = re.sub(r"\s+(em|no|na|do)\s+(adultos?|idosos?|crian).*$", "", t, flags=re.I)
    t = re.sub(r"\s+/.*$", "", t)  # "Alopecia androgenética / perda de cabelo..."
    return _norm(t)


_PALAVRAS_VAZIAS = {
    "de",
    "do",
    "da",
    "dos",
    "das",
    "em",
    "e",
    "o",
    "a",
    "com",
    "no",
    "na",
    "por",
    "ao",
}
_PALAVRAS_GENERICAS = {"transtorno", "transtornos", "sindrome", "doenca", "episodio", "quadro"}


# Letra que distingue doenças ("hepatite B", "hepatite C"); o "a" só conta depois de "hepatite"/"tipo".
_LETRAS_DISTINTIVAS = frozenset("bcdgk")
_ANTES_DO_A = frozenset({"hepatite", "tipo", "vitamina", "grupo"})


def _tokens(norm: str) -> frozenset[str]:
    """Palavras que identificam a doença (sem 'de/do/em' nem 'transtorno'), com 3+ letras.

    Letra isolada que distingue doenças ("hepatite B" x "hepatite C") também entra.
    """
    palavras = re.findall(r"[a-z0-9]+", norm)
    saida: set[str] = set()
    for i, p in enumerate(palavras):
        if p in _PALAVRAS_VAZIAS | _PALAVRAS_GENERICAS and p != "a":
            continue
        if len(p) >= 3:
            saida.add(p)
        elif len(p) == 1 and (
            p in _LETRAS_DISTINTIVAS or (p == "a" and i > 0 and palavras[i - 1] in _ANTES_DO_A)
        ):
            saida.add(p)
    return frozenset(saida)


def _condicoes(texto: str) -> tuple[str, ...]:
    """Itens de `conditions:` no cabeçalho YAML (--- ... ---), normalizados. Sem cabeçalho: ()."""
    if not texto.startswith("---"):
        return ()
    fim = texto.find("\n---", 3)
    if fim < 0:
        return ()
    nomes: list[str] = []
    dentro = False
    for linha in texto[3:fim].splitlines():
        if re.match(r"^conditions:\s*$", linha):
            dentro = True
        elif dentro and (m := re.match(r"^\s+-\s+(.+?)\s*$", linha)):
            nomes.append(_norm(m.group(1).strip("\"'")))
        elif dentro and linha.strip():
            break
    return tuple(n for n in nomes if _nome_aceito(n))


# Seções que mais ajudam a propor conduta, em ordem de prioridade (as demais só se sobrar espaço).
_PRIORIDADE = (
    "diretriz terapêutica resumida",
    "resumo executivo",
    "avaliação",
    "princípios gerais de tratamento",
    "tratamento",
    "farmacoterapia",
    "psicoterapia",
    "algoritmo",
    "primeiro episódio",
    "resposta insuficiente",
    "manutenção",
    "segurança",
)
_IGNORAR = ("referências", "glossário", "notas de atualização", "como interpretar", "checklist")


def resumo_para_ia(texto: str, limite: int) -> str:
    """Cabe `limite` caracteres escolhendo as seções mais úteis (documento curto vai inteiro).

    Documentos longos (sínteses de 30–50 mil caracteres) não podem ser cortados no começo, porque o
    tratamento fica no meio. Escolhe seções por prioridade e mantém a ordem original no resultado.
    """
    if len(texto) <= limite:
        return texto
    partes = re.split(r"(?m)^(?=## )", texto)
    cabeca, secoes = partes[0], partes[1:]
    if not secoes:
        return texto[:limite]

    def rank(secao: str) -> int | None:
        titulo = secao.splitlines()[0].lower()
        if any(i in titulo for i in _IGNORAR):
            return None
        for n, chave in enumerate(_PRIORIDADE):
            if chave in titulo:
                return n
        return len(_PRIORIDADE)

    candidatos = sorted(((r, i) for i, s in enumerate(secoes) if (r := rank(s)) is not None))
    escolhidas: set[int] = set()
    usado = 0
    for _, i in candidatos:
        tamanho = len(secoes[i])
        if usado + tamanho <= limite:
            escolhidas.add(i)
            usado += tamanho
        elif not escolhidas:  # primeira seção maior que o limite: entra cortada
            escolhidas.add(i)
            usado = limite
    saida = "".join(secoes[i] for i in sorted(escolhidas))
    return (saida or cabeca)[:limite]


@lru_cache(maxsize=4)
def carregar(pasta: Path) -> tuple[Diretriz, ...]:
    itens = []
    for f in sorted(pasta.glob("*.md")):
        texto = f.read_text(encoding="utf-8")
        titulo = next((ln[2:].strip() for ln in texto.splitlines() if ln.startswith("# ")), f.stem)
        data = re.search(r"\*\*Atualização:\*\*\s*([\d/]+)", texto)
        itens.append(
            Diretriz(
                f.name,
                titulo,
                _nucleo(titulo),
                _grupo(f.name),
                data and data.group(1),
                texto,
                _condicoes(texto),
            )
        )
    return tuple(itens)


def para_diagnostico(diagnostico: str, pasta: Path) -> list[Diretriz]:
    """Diretrizes cujo nome corresponde ao diagnóstico (mais específico primeiro). [] se nenhum."""
    d = _norm(diagnostico)
    tokens_d = _tokens(d) or (frozenset({d}) if d in ABREVIACOES_MEDICAS else frozenset())
    if not _nome_aceito(d) or not tokens_d:  # vazio ou só palavras genéricas ("transtorno")
        return []
    achados = []
    for g in carregar(pasta):
        nomes = [n for n in (g.nucleo, *g.aliases) if _nome_aceito(n)]
        ok = [n for n in nomes if _casa(n, d)]
        # Outros nomes da doença (cabeçalho `conditions:`): vale "transtorno de pânico" ~
        # "transtorno do pânico" e a sigla "TDAH" (todas as palavras do diagnóstico no nome).
        ok += [n for n in g.aliases if tokens_d <= _tokens(n)]
        if ok:
            achados.append((min(abs(len(n) - len(d)) for n in ok), g))
    return [g for _, g in sorted(achados, key=lambda x: x[0])]
