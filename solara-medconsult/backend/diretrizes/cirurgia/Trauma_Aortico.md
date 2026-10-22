# Trauma Aórtico

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Vascular), sem autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=64332&categoryId=207&subcategoryId=238

**Definição:** lesão da aorta por mecanismo contuso ou penetrante, em qualquer segmento; uma das lesões vasculares mais graves do trauma.

## Classificação
- **Fechado:** desaceleração brusca, contusão ou pico de pressão intraluminal; típico do istmo (fixação pelo ligamento arterioso). **Grau I** lesão intimal isolada; **II** hematoma intramural; **III** pseudoaneurisma; **IV** ruptura completa.
- **Penetrante:** projétil, arma branca, explosão, corpo estranho; exsanguinação rápida.
- **Iatrogênico:** cateteres, balão intra-aórtico, TAVI, fios-guia.

## Clínica
Suspeitar em penetrante com instabilidade ou trajeto vascular, e em contuso de alta energia (desaceleração). Dor torácica ou interescapular, dispneia, síncope, choque, hipotensão e taquicardia, assimetria de pulsos, sopro interescapular, lesões multissistêmicas.

## Diagnóstico
ATLS primeiro. **RX de tórax:** limitado, normal não exclui; alargamento mediastinal, apagamento do botão aórtico, desvio traqueal para a direita. **Angio-TC** (flap intimal, pseudoaneurisma, extravasamento, hematoma intramural, dissecção/oclusão de ramos). **Eco transesofágico:** útil em instáveis, intraoperatório; boa avaliação da aorta ascendente/torácica, limitada na abdominal. **Diferencial:** contusão miocárdica, tamponamento, hematoma mediastinal sem lesão aórtica, ruptura esofágica, lesão de via aérea, pneumotórax hipertensivo.

## Tratamento
Depende de estabilidade, mecanismo, segmento e grau. Início pelo ATLS.
- Penetrante: em geral intervenção; aberta ainda indicada, endovascular crescente em selecionados.
- **Contuso graus I–II estáveis:** conservador — **PAS 100–120 mmHg e FC < 80 bpm**, UTI, equipe cirúrgica de prontidão.
- **TEVAR:** modalidade principal no contuso torácico, sobretudo graus III–IV, com menor morbimortalidade; cirurgia aberta em penetrante extenso, ruptura franca ou anatomia desfavorável (mortalidade alta).

## Seguimento
Grau I: sem imagem seriada. Grau II: angio-TC em ~30 dias. Graus III–IV (TEVAR): angio-TC em 1 mês, 12 meses e depois anual (endoleak, trombose, perviedade, migração).

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Trauma de alta energia / penetrante com suspeita aórtica] --> B[ATLS; angio-TC se estável (ETE se instável)]
    B --> C{Grau}
    C -->|I-II estável| D[Conservador: PAS 100-120, FC < 80; reimagem em ~30 dias (grau II)]
    C -->|III-IV| E[TEVAR (grau IV imediato)]
    C -->|Penetrante / anatomia desfavorável| F[Cirurgia aberta]
    E --> G[Angio-TC 1 mês, 12 meses, anual]
```
