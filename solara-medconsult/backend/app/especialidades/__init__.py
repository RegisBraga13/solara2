"""Especialidades do espec·IA·lidades: o app é um só; a especialidade é só CONTEÚDO CLÍNICO.

Cada especialidade é um objeto `Especialidade` com: seções e consultas da propedêutica e das
orientações, domínios da busca web e adaptação de vocabulário dos prompts (a pasta das diretrizes é
`diretrizes/<slug>/`). Identidade visual, fluxo, pacientes, prontuários, laudos, imagens e voz são
comuns e NÃO mudam por especialidade. Textos repetidos ficam em `base.py`.

Qual está ativa: variável de ambiente `ESPECIALIDADE` (padrão `dermatologia`). Mesmo código,
mesmo banco; muda o conteúdo. Cada uma é um módulo `<slug>.py` desta pasta, todas no mesmo nível
(dermatologia, psiquiatria, reumatologia…).
"""

import importlib
import pkgutil
from dataclasses import dataclass, field
from pathlib import Path

from app.config import settings
from app.motores import busca_diretrizes


@dataclass(frozen=True)
class Especialidade:
    slug: str
    nome: str
    #: Propedêutica (tela 6): seções {chave: descrição para a IA}, blocos e consultas.
    propedeutica_objetivo: str
    propedeutica_secoes: dict[str, str]
    propedeutica_agrupar: str | None
    propedeutica_consulta_rag: str
    propedeutica_consulta_web: str
    #: Orientações (tela 7). Chaves fixas (cuidados, fotoprotecao, higiene); o significado muda.
    orientacoes_objetivo: str
    orientacoes_secoes: dict[str, str]
    orientacoes_consulta_rag: str
    orientacoes_consulta_web: str
    dominios_web: tuple[str, ...]
    #: Tamanho máximo (caracteres) do trecho de diretriz enviado ao modelo; None = padrão global.
    diretriz_max_chars: int | None = None
    #: Pode usar os vector stores da nuvem (OPENAI_*_VECTOR_STORE_ID). Só a especialidade dona do
    #: acervo liga isto; o `.env` é compartilhado e as outras nunca devem ler acervo alheio.
    usa_nuvem: bool = False
    #: Gêneros de livro (atributo `escopo` do vector store) lidos por etapa:
    #: {"diagnostico": (...), "tratamento": (...)}. Vazio = sem filtro.
    escopos_rag: dict[str, tuple[str, ...]] = field(default_factory=dict)
    #: Trocas de vocabulário aplicadas aos prompts (a mais longa primeiro). Vazio = texto original.
    vocabulario: tuple[tuple[str, str], ...] = field(default=())
    #: Anamnese (tela 3, Captura): tópicos essenciais que o motor de pendências confere depois da
    #: transcrição. Não são perguntas prontas — o modelo decide a pergunta a partir do que já foi
    #: dito. Vazio = especialidade ainda sem esse conteúdo (motor rejeita, não inventa).
    anamnese_categorias: tuple[str, ...] = field(default=())
    #: Sinais de alarme fixos que o motor sempre confere (presente/ausente/não verificado).
    #: Deliberadamente determinístico: não fica a cargo do raciocínio livre do modelo se um sinal
    #: crítico foi ou não abordado.
    anamnese_red_flags: tuple[str, ...] = field(default=())
    #: Conduta (tela 6a): plano clínico geral e orientações de manejo, texto corrido gerado a
    #: partir do diagnóstico, para o médico revisar e editar. Vazio = especialidade ainda sem esse
    #: conteúdo (motor rejeita, não inventa).
    conduta_objetivo: str = ""
    #: Propedêutica/Investigação (tela 6a): exames, biópsia, parecer de outro especialista — mais
    #: dados para confirmar ou aprofundar o diagnóstico (não é o tratamento).
    investigacao_objetivo: str = ""
    #: Tratamento (tela 6b): medicamento, dose e dias, ou conduta cirúrgica/procedimento.
    tratamento_objetivo: str = ""

    @property
    def pasta_diretrizes(self) -> Path:
        """Diretrizes desta especialidade: sempre `backend/diretrizes/<slug>/`."""
        return busca_diretrizes.PASTA / self.slug

    def adaptar(self, texto: str) -> str:
        """Ajusta o vocabulário de um prompt à especialidade (dermatologia: não muda nada)."""
        for de, para in self.vocabulario:
            texto = texto.replace(de, para)
        return texto


def _registro() -> dict[str, Especialidade]:
    """Descobre as especialidades: todo módulo desta pasta com um objeto `Especialidade`.

    Todas ficam no mesmo nível. Para acrescentar uma, basta criar `<slug>.py` aqui (veja
    `scripts/nova_especialidade.py`); não é preciso editar este arquivo.
    """
    encontradas: dict[str, Especialidade] = {}
    for modulo in pkgutil.iter_modules(__path__):
        mod = importlib.import_module(f"{__name__}.{modulo.name}")
        for valor in vars(mod).values():
            if isinstance(valor, Especialidade):
                if valor.slug != modulo.name:
                    raise ValueError(f"{modulo.name}.py define a especialidade '{valor.slug}'")
                encontradas[valor.slug] = valor
    return dict(sorted(encontradas.items()))


ESPECIALIDADES: dict[str, Especialidade] = _registro()
PASTA_DIRETRIZES = busca_diretrizes.PASTA


def atual() -> Especialidade:
    """Especialidade ativa neste servidor (ESPECIALIDADE). Valor desconhecido = erro claro."""
    try:
        return ESPECIALIDADES[settings.especialidade]
    except KeyError:
        validas = ", ".join(sorted(ESPECIALIDADES))
        raise ValueError(
            f"ESPECIALIDADE='{settings.especialidade}' não existe. Use uma destas: {validas}."
        ) from None
