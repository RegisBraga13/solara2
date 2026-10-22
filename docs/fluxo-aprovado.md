# Fluxo aprovado da consulta

Este documento registra o fluxo visual e funcional aprovado para o aplicativo. A implementação deve reproduzir as telas de referência como um clone: mesmas cores, fontes, proporções, espaçamentos, controles, bordas e comportamento responsivo.

## Regras visuais

- A montagem com médico, tablet e celular é apenas referência visual.
- O aplicativo não exibirá a foto do médico nem a moldura dos dispositivos.
- A interface interna mostrada no tablet/celular será reproduzida integralmente.
- O mesmo design deve funcionar em desktop, tablet e celular, preservando as proporções da referência.
- Login, seleção de especialidade e todas as etapas usam a mesma identidade visual.
- Nenhuma imagem, elemento ou proporção será removido ou adaptado sem aprovação.

## Fluxo fixo

As páginas e a ordem do fluxo são fixas para todas as especialidades. Uma especialidade pode alterar campos, conteúdo clínico e lógica interna, mas não pode acrescentar, remover ou reordenar páginas.

1. Login.
2. Seleção da especialidade.
3. Seleção da modalidade: Online ou Presencial.
4. Anamnese: Voz ou Texto.
5. História Clínica.
6. Diagnóstico.
7. Conduta / Propedêutica.
8. Tratamento / Orientações.
9. Anexos dentro da consulta.
10. Resumo expansível e Salvar e sair.

O médico pode retornar livremente entre as páginas. As alterações permanecem editáveis e a consolidação definitiva acontece somente em **Salvar e sair**.

## Regras por etapa

### Login

O login seguirá o mesmo padrão visual das telas de referência. Autenticação real, recuperação de senha e gestão completa de usuários não fazem parte da primeira definição funcional; o projeto deve apenas contemplar essa entrada.

### Especialidade

Haverá várias especialidades. Cada uma será apresentada como botão ou cartão no mesmo design, cores e proporções da referência. A seleção define o conteúdo e as regras clínicas internas da consulta.

### Modalidade

- **Online:** abre a plataforma de vídeo escolhida em um painel interno de tela cheia, com botão Voltar e preservação do rascunho.
- **Presencial:** segue para a próxima etapa sem abrir vídeo.

A plataforma de vídeo ainda será escolhida após análise técnica.

### Anamnese

- **Voz:** abre a captura de voz; a transcrição aparece em texto editável.
- **Texto:** abre o campo de texto; o conteúdo pode ser complementado posteriormente por voz.

Os rótulos exibidos serão exatamente **Voz** e **Texto**.

### História Clínica

Opções de fonte:

- **AI:** modelo de inteligência artificial.
- **Open Evidence:** abre o serviço por link para pesquisa do médico.

O médico pode editar livremente o resultado e o conteúdo da caixa se necessário.

### Diagnóstico

Opções de fonte:

- **AI:** modelo de inteligência artificial.
- **RAG:** livros e acervo já preparados.
- **Open Evidence:** pesquisa externa por link.
- **Web:** navegador para pesquisa manual.

Ao selecionar uma fonte, a consulta é acionada automaticamente. O médico pode selecionar outra fonte depois, consultar novamente e editar o conteúdo consolidado.

### Conduta / Propedêutica

A tela mantém as opções AI, RAG, Open Evidence e Web, além das duas áreas editáveis:

- Conduta.
- Propedêutica.

### Tratamento / Orientações

A tela mantém as opções AI, RAG, Open Evidence e Web, além das duas áreas editáveis:

- Tratamento.
- Orientações.

### Painéis externos

Vídeo, Open Evidence e Web devem aparecer em painéis internos de tela cheia sempre que tecnicamente possível. O painel terá retorno para a consulta e deverá preservar todo o rascunho.

Para sites que bloquearem incorporação, o fallback aprovado é abrir uma nova aba controlada e retornar ao aplicativo sem perder os dados.

No Web, o médico pesquisa manualmente, seleciona o conteúdo, copia e cola na caixa de texto do aplicativo.

### Anexos

Os anexos aparecem depois de Tratamento / Orientações, ainda dentro da mesma consulta, usando o mesmo design e as mesmas cores. A organização será feita por acordeões ou componente equivalente.

Categorias previstas:

- Prontuário.
- Atestados.
- Receitas.
- Escalas.
- Outras categorias a definir.

Os formatos e modelos de anexos serão definidos quando essa etapa for implementada.

### Finalização

Antes da finalização, o médico poderá abrir um resumo expansível da consulta. As ações finais são:

- continuar editando;
- salvar e sair.

Somente **Salvar e sair** consolida definitivamente a consulta.

## Decisões ainda pendentes

- Plataforma de vídeo para o modo Online.
- Comportamento técnico final do painel de Open Evidence.
- Modelos e formatos dos anexos.
- Lista completa de especialidades.
- Conteúdo e lógica clínica específica de cada especialidade.
