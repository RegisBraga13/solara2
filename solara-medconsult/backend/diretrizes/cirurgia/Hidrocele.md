# Hidrocele

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Urológica), sem fisiopatologia, autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=45419&categoryId=207&subcategoryId=214

**Definição:** acúmulo de líquido entre as camadas parietal e visceral da túnica vaginal que envolve testículo e cordão; congênita ou adquirida. O texto traz uma ilustração da formação (não reproduzida aqui).

## Etiologia
- Persistência do conduto peritoniovaginal (congênita/primária).
- Secundária: produção excessiva ou má absorção (infecção, trauma, malignidade); alteração da drenagem linfática (filariose).

## Clínica
- Aumento escrotal uniforme, de consistência cística, com desconforto conforme o tamanho; nas comunicantes o volume varia ao longo do dia ou com aumento da pressão abdominal (mais em congênitas).
- Exame: massa cística, **transiluminação positiva** (lanterna na face posterior), sem conteúdo sólido; comunicantes em geral redutíveis. Palpar todo o testículo e o cordão para excluir causa secundária. Hérnia inguinal é o principal diferencial e define a conduta cirúrgica.
- Exames complementares apenas se dúvida diagnóstica ou suspeita de causa secundária (infecção, torção, tumor): exame duvidoso, impossibilidade de distinguir de hérnia, ou de palpar o testículo.

## Classificação
- **Comunicante:** processo vaginal pérvio com líquido peritoneal; mais em crianças até a puberdade; costuma resolver no 1º ano.
- **Não comunicante:** primária (idiopática, desequilíbrio produção/absorção) ou secundária (orquite, epididimite, torção testicular ou de apêndice, trauma, tumor testicular).
- **Diferenciais:** hérnia inguinal, cisto de epidídimo, espermatocele, tumor testicular, edema escrotal, varicocele.

## Tratamento e prognóstico
- **Cirurgia** é o tratamento mais comum; indicada se sintomática ou comprometendo a pele. Hidrocele comunicante em idoso raramente resolve e predispõe a hérnia inguinal encarcerada.
- Aspiração do líquido: opção para sintomáticos com alto risco cirúrgico, mas recidiva rápida.
- Complicações: hemorragia, infecção, recorrência.
- Prognóstico: congênita excelente, com resolução espontânea em geral até 2 anos e bom resultado cirúrgico nas persistentes; em adultos depende da causa.

## Fluxograma (refeito, a partir do texto; o original traz apenas ilustração)
```mermaid
flowchart TD
    A[Aumento escrotal cístico, transilumina] --> B[Palpar testículo/cordão; afastar hérnia]
    B --> C{Dúvida ou suspeita de causa secundária?}
    C -->|Sim| D[USG escrotal / exames]
    C -->|Não| E{Sintomática ou lesão de pele?}
    D --> E
    E -->|Sim| F[Cirurgia]
    E -->|Não, criança comunicante| G[Observar até ~2 anos]
    E -->|Alto risco cirúrgico| H[Aspiração (recidiva rápida)]
```
