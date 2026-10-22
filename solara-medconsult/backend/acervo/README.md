# Acervo de referência (RAG)

Coloque aqui os documentos que o espec·IA·lidades pode consultar (diretrizes, protocolos, bulas, artigos).
Um arquivo `.md` ou `.txt` por documento, neste formato:

```
titulo: Nome do documento
fonte: Sociedade ou órgão que publicou
versao: 2024
data: 2024-05-01
especialidade: dermatologia
url: https://...

Texto do documento. Parágrafos separados por linha em branco.
```

- `titulo` e `fonte` são **obrigatórios**. O restante é opcional e, se ausente, fica vazio (nada é inventado).
- Campo desconhecido no cabeçalho rejeita o arquivo, para erro de digitação não passar em silêncio.
- Só coloque material que você tem direito de usar e que **não contenha dados de pacientes**.

Carregar (precisa de `VOYAGE_API_KEY` no `.env` e do Postgres no ar):

```
.venv/Scripts/python -m scripts.carregar_acervo acervo
```

Organização: `acervo/<especialidade>/<livro>/*.md` (livros, fora do git) e
`acervo/<especialidade>/gabarito_casos.json` (casos de medição, no git). Todas as especialidades
seguem o mesmo padrão.

Medir a busca: crie `avaliacao.json` (veja `avaliacao.exemplo.json`) e rode

```
.venv/Scripts/python -m scripts.avaliar_rag acervo/avaliacao.json
```

## Recarregar é idempotente

`carregar_acervo` deixa o banco igual à pasta: depois de indexar, remove os documentos antigos da
mesma fonte (livro) e especialidade que não estão mais nela (por exemplo, um PDF reconvertido com
outro título). Só remove se tudo foi indexado sem erro e se a carga cobre ao menos metade do livro;
`--append` só acrescenta e atualiza.

## Material retirado (`_deprecated/`)

Pastas que começam com `_` (por exemplo `acervo/_deprecated/`) **não são indexadas** pelo
`carregar_acervo`: servem para guardar o que saiu do RAG sem apagar. Ficam fora do git, como os
livros.

- **2026-10-11 — `_deprecated/endocrinologia/referencias_publicas/` (14 arquivos).** Eram os
  "Resumo interno — …" (cushing, diabetes gestacional/mellitus/tipo 1/tipo 2, endocrinologia do
  adulto, hiperprolactinemia, hipotireoidismo, insuficiência adrenal, nódulo de tireoide, obesidade,
  osteoporose, SOP e doenças da tireoide). Saíram do RAG porque: não têm revisão clínica
  documentada, a fonte declarada não é verificável (nenhum documento ou versão), têm 450 a 1.040
  caracteres e só repetem, de forma genérica, o que o livro e as diretrizes já trazem, e apareciam
  entre os primeiros resultados. Os documentos foram removidos do banco (`remover_documento`); o
  carregador não remove sozinho.
