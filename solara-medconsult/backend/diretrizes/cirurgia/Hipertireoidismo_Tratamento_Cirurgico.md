# Hipertireoidismo (Tratamento Cirúrgico)

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia de Cabeça e Pescoço), sem autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=38903&categoryId=207&subcategoryId=289

**Contexto:** excesso de hormônio tireoidiano por alteração primária (Graves, bócio nodular tóxico, adenoma tóxico) ou por distúrbio do SNC; mais raro: ingestão exógena, mola hidatiforme (hCG), malignidade com superprodução.

## Clínica e diagnóstico
- Sudorese, perda de peso com apetite aumentado, intolerância ao calor, sede, alteração menstrual, ansiedade, diarreia, palpitações, queda de cabelo, distúrbio do sono. Graves: IC de alto débito, ICC com edema, arritmias (TV, FA).
- Laboratório: T3 e T4 elevados com TSH baixo ou indetectável; anticorpos tireoidianos geralmente elevados (Graves); cintilografia com I¹²³ com captação alta em glândula aumentada; USG ou TC cervical para marcos da doença.
- **Graves:** causa mais comum (bócio tóxico difuso); mulheres de 20–40 anos; autoanticorpos estimulantes do receptor de TSH; tríade: tireotoxicose, bócio (às vezes com sopro) e exoftalmia; compressão traqueal possível, aguda e grave raríssima.
- **Bócio nodular tóxico (Plummer):** nódulos que ganham autonomia independente do TSH; pacientes mais velhos, às vezes retroesternal; sintomas leves, hormônios altos, TSH suprimido, anticorpos geralmente negativos; cintilografia com 1–2 áreas hipercaptantes e o resto suprimido.

## Tratamento clínico e radioiodo
- Betabloqueador (propranolol) para sintomas adrenérgicos; **PTU ou metimazol** bloqueiam a síntese (PTU também a conversão T4→T3); corticoide + betabloqueador no hipermetabolismo; meta eutireoidismo (hipotireoidismo possível, reposição).
- Antitireoidianos: controle rápido, **recidiva ~50% em 12–18 meses**.
- **Radioiodo (I¹³¹):** ablação em 6–18 semanas; cura global ~90%; escolha nos EUA para Graves; bom em adenoma tóxico e bócio multinodular tóxico (menos eficaz que em Graves). Idosos ou muito tireotóxicos podem precisar de tionamida prévia. Contraindicado em gestante, lactante ou nódulo suspeito.
- No bócio nodular tóxico: tionamida, radioiodo e cirurgia (preferência para os dois últimos).

## Cirurgia
- **Opções:** lobectomia (adenoma único hiperfuncionante: geralmente curativa), tireoidectomia subtotal ou parcial; total para ablação completa (mais hipoparatireoidismo e lesão do laríngeo recorrente). Quantidade residual é debatida.
- **Indicações em Graves:** bócio obstrutivo/compressivo, medo de radioatividade, má adesão, efeito adverso de tionamida, risco de malignidade concomitante; possível na gestação. Vantagem: controle rápido sem medicação prolongada.
- **Pré-operatório:** **documentar eutireoidismo** (obrigatório). Sem preparo, a **tempestade tireoidiana** pode ser fatal: taquicardia, febre, confusão, vômitos/desidratação, hiperestimulação adrenérgica até mania e coma. Tratar com reposição rápida de fluidos, antitireoidianos, betabloqueador e corticoide; em risco iminente, diálise peritoneal ou hemodiálise reduz T4/T3.
- **Complicações:** lesão de paratireoide (a mais comum; hipoparatireoidismo com sinais de Chvostek e Trousseau); **hematoma cervical** (a mais temida; insuficiência respiratória, drenar imediatamente); lesão do laríngeo recorrente (a mais grave; unilateral rouquidão, bilateral insuficiência respiratória aguda, difícil correção).

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Tireotoxicose: T3/T4 ↑, TSH ↓] --> B[Cintilografia: difusa (Graves) ou nodular]
    B --> C[Betabloqueador + tionamida até eutireoidismo]
    C --> D{Cirurgia indicada? bócio compressivo, nódulo suspeito, recusa de I131, intolerância à tionamida, gestante}
    D -->|Não| E[Radioiodo ou tionamida prolongada]
    D -->|Sim| F[Eutireoidismo documentado]
    F --> G[Lobectomia (adenoma) ou tireoidectomia subtotal/total]
    G --> H[Vigiar cálcio/paratireoide, hematoma cervical e voz]
```
