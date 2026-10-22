# Especialidades

Todas no mesmo nível, com a mesma estrutura. Nenhuma é "a principal".

| Especialidade | Página |
|---|---|
| Dermatologia | [dermatologia.md](dermatologia.md) |
| Psiquiatria | [psiquiatria.md](psiquiatria.md) |
| Reumatologia | [reumatologia.md](reumatologia.md) |
| Endocrinologia | [endocrinologia.md](endocrinologia.md) |
| Gastroenterologia | [gastroenterologia.md](gastroenterologia.md) |
| Pneumologia | [pneumologia.md](pneumologia.md) |
| Cardiologia | [cardiologia.md](cardiologia.md) |
| Infectologia | [infectologia.md](infectologia.md) |
| Nefrologia | [nefrologia.md](nefrologia.md) |
| Geriatria | [geriatria.md](geriatria.md) |

## Acrescentar uma especialidade

```
py -3 scripts/nova_especialidade.py <slug> "<Nome>"
```

Cria o módulo `backend/app/especialidades/<slug>.py` (descoberto sozinho), as pastas
`backend/diretrizes/<slug>/` e `backend/acervo/<slug>/` e o bloco em `frontend/src/lib/especialidade.ts`.

### Lista de conferência (pronta quando tudo estiver marcado)

- [ ] Todos os `TODO` do módulo Python e do bloco do site preenchidos e revisados por um médico da área.
- [ ] Vocabulário (`vocabulario`) cobre os termos de dermatologia dos prompts (há teste para isso).
- [ ] Diretrizes em `backend/diretrizes/<slug>/*.md` (citar fonte é opcional, ver decisão 0004).
- [ ] Livros convertidos em `backend/acervo/<slug>/<livro>/` (fora do git) e carregados com
      `python -m scripts.carregar_acervo acervo/<slug> --especialidade <slug>`.
- [ ] `backend/acervo/<slug>/gabarito_casos.json` com casos fictícios e medição registrada
      (`ESPECIALIDADE=<slug> python -m scripts.medir_casos`).
- [ ] Escalas, se houver: só as de uso permitido; escore inteiro (campo do núcleo não aceita decimais).
- [ ] Página `docs/especialidades/<slug>.md` e linha no `CHANGELOG.md`.
- [ ] `py -3 scripts/verificar_tudo.py` sem falhas e teste manual no iPad com
      `ESPECIALIDADE=<slug>` / `NEXT_PUBLIC_ESPECIALIDADE=<slug>`.

### O que os testes garantem sozinhos

`backend/tests/test_estrutura_especialidades.py` falha, com mensagem do que falta, se: o slug não
bate com o módulo; falta a pasta de diretrizes; existe pasta de diretrizes ou acervo sem especialidade
registrada; o site e o servidor têm especialidades diferentes; o vocabulário deixa "dermatologia"
passar; ou o esqueleto (`nova_especialidade.py`) deixa de gerar um módulo válido.

### O que não muda por especialidade

Identidade visual, fluxo das telas, pacientes, prontuários, laudos, imagens, voz e motores. Isso é o
núcleo (`NUCLEO.txt`); mudanças nele são feitas uma vez, na base.
