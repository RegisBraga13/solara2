"""Converte o PDF do Azulay Dermatologia (8ª ed.) em documentos do acervo, um por seção.

Uso:  .venv/Scripts/python -m scripts.converter_pdf_azulay <arquivo.pdf> [pasta_saida] [--janela N]

Sem --janela: PDF com hierarquia de fontes (edição 2022). Com --janela N: PDF de fonte única, sem
títulos detectáveis (versão sem figuras); divide em janelas de N páginas.

O PDF não tem sumário navegável; a estrutura vem do tamanho da fonte (21 = seção, 17 = subseção).
Fora do acervo: capa/prefácios (antes da p. 52), bibliografias e o índice final (p. 4409+).
O título de cada documento leva o intervalo de páginas DO PDF, para a fonte ser conferível.
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

FONTE = "Azulay Dermatologia, 8ª ed., Guanabara Koogan, 2022"
PRIMEIRA_PAGINA = 52  # 1ª página de conteúdo ("Função da pele")
ULTIMA_PAGINA = 4408  # depois vem o índice do e-book
MIN_CHARS = 200

REGEX_ANO = re.compile(r"\b(19|20)\d{2}\b")
REGEX_REF = re.compile(r"\d+\s*[:;(]\s*\d|\bIn:|UpToDate|Disponível|doi|\bet al\b", re.I)


@dataclass
class Secao:
    titulo: str
    pagina_ini: int
    pagina_fim: int
    linhas: list[str] = field(default_factory=list)

    @property
    def corpo(self) -> str:
        return "\n\n".join(self.linhas)


def _nivel(tamanho: float) -> str:
    if tamanho >= 20:
        return "h1"
    if round(tamanho) == 17:
        return "h2"
    return "corpo"


def _juntar(linhas: list[str]) -> str:
    texto = ""
    for ln in linhas:
        ln = ln.strip()
        if not ln:
            continue
        if texto.endswith("-") and ln[:1].islower():
            texto += ln  # "cerato-" + "hialina"
        else:
            texto = f"{texto} {ln}".strip()
    return re.sub(r"\s+", " ", texto)


REGEX_AUTOR = re.compile(
    r"^[^\s.,:]+(?: [^\s.,:]+){0,3} [A-Z]{1,4}[,.]"
)  # "Reygagne P." "Silva AB,"


def _parece_referencia(texto: str) -> bool:
    ano, ref, autor = (
        bool(REGEX_ANO.search(texto)),
        bool(REGEX_REF.search(texto)),
        bool(REGEX_AUTOR.match(texto)),
    )
    return (ano and (ref or autor)) or (ref and autor)


def blocos(doc: pymupdf.Document):
    """Gera (página, nível, texto) em ordem de leitura; linhas seguidas do mesmo nível se juntam."""
    for i in range(PRIMEIRA_PAGINA - 1, min(ULTIMA_PAGINA, len(doc))):
        for b in doc[i].get_text("dict")["blocks"]:
            grupos: list[tuple[str, list[str]]] = []
            for ln in b.get("lines", []):
                spans = ln["spans"]
                txt = "".join(s["text"] for s in spans).strip()
                if not txt:
                    continue
                nivel = _nivel(max(spans, key=lambda s: len(s["text"]))["size"])
                if grupos and grupos[-1][0] == nivel:
                    grupos[-1][1].append(txt)
                else:
                    grupos.append((nivel, [txt]))
            for nivel, linhas in grupos:
                texto = _juntar(linhas)
                if texto and not re.fullmatch(r"[\d\s.,]+", texto):  # descarta nº de página solto
                    yield i + 1, nivel, texto


def secoes(doc: pymupdf.Document) -> list[Secao]:
    saida: list[Secao] = []
    atual: Secao | None = None
    em_bibliografia = False

    def abrir(titulo: str, pagina: int) -> Secao:
        s = Secao(titulo, pagina, pagina)
        saida.append(s)
        return s

    for pagina, nivel, texto in blocos(doc):
        if nivel == "h1":
            em_bibliografia = texto.lower().startswith("bibliografia")
            atual = None if em_bibliografia else abrir(texto, pagina)
            continue
        if em_bibliografia:
            # Sai da bibliografia quando aparece texto corrido que não é referência.
            if nivel == "corpo" and len(texto) > 150 and not _parece_referencia(texto):
                em_bibliografia = False
                atual = abrir("Início de capítulo", pagina)
                atual.linhas.append(texto)
            continue
        if atual is None:
            atual = abrir("Início de capítulo", pagina)
        atual.pagina_fim = pagina
        atual.linhas.append(f"## {texto}" if nivel == "h2" else texto)
    return [s for s in saida if len(s.corpo) >= MIN_CHARS]


REGEX_FIGURA = re.compile(r"^(Figura|Fig\.)\s*\d", re.I)
INICIO_CORPO = "corresponde a 15% de seu peso"  # 1ª frase do capítulo 1 ("Função da pele")


def _ref_forte(texto: str) -> bool:
    """Referência bibliográfica inequívoca (autor + ano + padrão de revista), para descartar."""
    return bool(REGEX_AUTOR.match(texto) and REGEX_ANO.search(texto) and REGEX_REF.search(texto))


def _paragrafos(doc: pymupdf.Document, ini: int, fim: int) -> list[str]:
    """Junta as linhas soltas do PDF em parágrafos (o PDF traz uma linha por bloco).

    Quebra quando a linha anterior termina bem antes da margem direita da página e fecha frase,
    ou quando é uma linha curta sem pontuação (título).
    """
    saida: list[str] = []
    atual = ""
    ult_x1 = 0.0
    for i in range(ini, fim):
        blocos = [b for b in doc[i].get_text("blocks", sort=True) if b[6] == 0]
        larguras = sorted(b[2] for b in blocos if len(b[4]) > 40)
        margem = larguras[int(len(larguras) * 0.9)] if larguras else 0.0
        for b in blocos:
            texto = _juntar(b[4].splitlines())
            if not texto:
                continue
            if atual:
                curta = ult_x1 < margem - 35
                fecha = atual.endswith((".", ":", ";", "?", "!", ")"))
                titulo = len(atual) < 50 and not atual.endswith((",", "-"))
                if (curta and fecha) or titulo:
                    saida.append(atual)
                    atual = ""
            if atual and atual.endswith("-") and texto[:1].islower():
                atual += texto
            else:
                atual = f"{atual} {texto}".strip()
            ult_x1 = b[2]
    if atual:
        saida.append(atual)
    return saida


def secoes_por_janela(doc: pymupdf.Document, janela: int) -> list[Secao]:
    """PDF sem títulos detectáveis: janelas de `janela` páginas, sem figuras nem referências."""
    inicio = next(
        (i for i in range(len(doc)) if INICIO_CORPO in re.sub(r"\s+", " ", doc[i].get_text())), 21
    )
    saida: list[Secao] = []
    for ini in range(inicio, len(doc), janela):
        fim = min(ini + janela, len(doc))
        s = Secao("Azulay Dermatologia", ini + 1, fim)
        for texto in _paragrafos(doc, ini, fim):
            if (
                not re.fullmatch(r"[\d\s.,]+", texto)
                and not REGEX_FIGURA.match(texto)
                and not _ref_forte(texto)
            ):
                s.linhas.append(texto)
        saida.append(s)
    return [s for s in saida if len(s.corpo) >= MIN_CHARS]


def escrever(
    secs: list[Secao],
    pasta: Path,
    fonte: str = FONTE,
    versao: str = "8ª edição",
    prefixo: str = "azulay",
) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    for antigo in pasta.glob(f"{prefixo}_*.md"):
        antigo.unlink()
    for n, s in enumerate(secs, 1):
        titulo = f"{s.titulo} (PDF p. {s.pagina_ini}-{s.pagina_fim})".replace("\n", " ")
        cab = f"titulo: {titulo}\nfonte: {fonte}\nversao: {versao}\nespecialidade: dermatologia\n\n"
        (pasta / f"{prefixo}_{n:04d}.md").write_text(cab + s.corpo + "\n", encoding="utf-8")


def main(pdf: str, saida: str = "acervo/dermatologia/azulay", janela: int = 0) -> int:
    doc = pymupdf.open(pdf)
    if janela:
        secs = secoes_por_janela(doc, janela)
        escrever(
            secs,
            Path(saida),
            fonte="Azulay Dermatologia, Guanabara Koogan (edição não identificada no PDF)",
            versao="edição não identificada",
        )
    else:
        secs = secoes(doc)
        escrever(secs, Path(saida))
    chars = sum(len(s.corpo) for s in secs)
    print(f"{len(secs)} documentos, {chars:,} caracteres -> {saida}")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--janela")]
    janela = int(sys.argv[sys.argv.index("--janela") + 1]) if "--janela" in sys.argv else 0
    if janela:
        args = [a for a in args if a != str(janela)]
    sys.exit(main(*args[:2], janela=janela))
