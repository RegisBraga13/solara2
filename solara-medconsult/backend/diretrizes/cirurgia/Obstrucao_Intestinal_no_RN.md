# Obstrução Intestinal no Recém-Nascido

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Pediátrica), sem fisiopatologia detalhada, autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=23096&categoryId=207&subcategoryId=826

**Definição:** obstrução parcial ou completa do trato gastrintestinal no RN, funcional ou mecânica, congênita ou adquirida (sinônimos: íleo neonatal, obstrução intestinal congênita, oclusão intestinal neonatal). Há acúmulo de líquido e gás acima do bloqueio, com distensão, vômitos e parada de eliminação de gases e fezes.

## Tipos
- **Intrínseca:** atresia, estenose, má rotação, cistos luminais, malformações anorretais.
- **Extrínseca:** bandas peritoneais com ou sem má rotação, pâncreas anular, vasos aberrantes, duplicações, hidrometrocolpo, persistência do ducto onfalomesentérico.
- **Adquiridas/outras:** volvo, aderências, trombose mesentérica, estenose pós-enterocolite necrosante, hérnia inguinal encarcerada.
- **Funcionais:** imaturidade da motilidade, hipoganglionose, Hirschsprung, íleo paralítico, íleo meconial, hipotireoidismo.

## Clínica
- **Pré-natal:** polidrâmnio, alças dilatadas com líquido, dupla bolha (obstrução duodenal).
- **Retardo ou ausência de mecônio** (normal entre 12 e 48 h).
- **Distensão abdominal progressiva** (risco de perfuração e sepse); maior nas obstruções baixas.
- **Vômito:** mais precoce nas obstruções altas; **bilioso** quando abaixo da papila (segunda porção do duodeno); sem bile se acima dela.
- **Dor à palpação:** cólica na suboclusão, contínua na obstrução/complicação; peritonite se houver perfuração.

## Etiologias mais comuns
- **Atresia duodenal:** completa, quase sempre ao nível da ampola de Vater; polidrâmnio em até 81%; vômito bilioso em horas, abdome superior distendido ou escavado; aspirado gástrico > **30 mL** sugere obstrução (normal < 5 mL).
- **Atresia/estenose de jejuno-íleo:** vômito bilioso após 24 h com eliminação anormal de mecônio; distensão maior nas atresias baixas.
- **Má rotação:** emergência se há volvo; principal causa de vômito bilioso súbito em RN que eliminou mecônio.
- **Anomalia anorretal:** metade com anomalias associadas (VACTERL); conduta depende de fístula perineal visível.
- **Hirschsprung:** sem mecônio em 48 h; estímulo retal alivia com fezes explosivas; ~75% só retossigmoide.
- **Íleo meconial:** obstrução do íleo médio/distal; fibrose cística (15% têm doença meconial); 10–30% das obstruções em UTI neonatal; prematuros, filhos de diabéticas. Simples: enema terapêutico isosmolar; falha ou complicado (atresia, perfuração, volvo): cirurgia.
- **Hidrometrocolpo:** membrana vaginal, hímen abaulado, massa pélvica, possível peritonite meconial, hidronefrose, cianose/edema de pernas; se não diagnosticado, aparece na puberdade.

## Diagnóstico
- **RX de abdome:** alças dilatadas, ausência de gás distal (reto), níveis hidroaéreos, calcificações (peritonite meconial) ou massa (pseudocisto), dupla bolha, compressão extrínseca (hidrometrocolpo).
- **Trânsito/contraste (delgado):** posição do duodeno e ceco; ângulo de Treitz à direita, bico de pássaro, saca-rolha = má rotação com volvo. **Enema opaco:** ceco mal posicionado = má rotação; microcólon = atresia; cone de transição = Hirschsprung; pérolas de mecônio no íleo terminal = íleo meconial.
- **USG:** distensão, edema de parede, massas; veia mesentérica superior à esquerda/anterior e sinal do redemoinho = volvo; cisto com sedimento e hidroureteronefrose = hidrometrocolpo.
- **Biópsia retal** se suspeita de Hirschsprung (ausência de gânglios, hipertrofia do plexo).
- Considerar o estado hemodinâmico; **não atrasar a conduta** se risco de isquemia.

## Tratamento
- **Estabilização:** via aérea, oxigênio se necessário, controle térmico, acesso venoso e hidratação com correção hidroeletrolítica, **dieta zero e descompressão** com sonda orogástrica aberta/aspiração contínua; NPT se jejum prolongado ou ressecção prevista.
- **Cirurgia:** quase sempre laparotomia exploradora; ressecção, anastomose primária, enterotomia, estomas, abaixamento de cólon/íleo, cirurgias endoanais conforme a causa. Hidrometrocolpo: punção-drenagem guiada por USG, himenotomia, vaginostomia, abaixamento abdominoperineal.
- **Complicações:** perfuração, sepse, síndrome do intestino curto, distúrbios nutricionais.
- **Prognóstico:** depende da causa, malformações associadas e diagnóstico precoce; o momento da cirurgia é o principal preditor de complicações.

## Fluxograma (refeito, a partir do texto; o original traz um algoritmo de quando acionar o cirurgião pediátrico, conferir na fonte)
```mermaid
flowchart TD
    A[RN: vômito (bilioso), distensão, sem mecônio] --> B[Estabilizar: dieta zero, SOG aberta, hidratação]
    B --> C[RX de abdome]
    C --> D{Pneumoperitônio ou sinais de isquemia/volvo?}
    D -->|Sim| E[Cirurgião pediátrico: laparotomia imediata]
    D -->|Não| F{Padrão}
    F -->|Dupla bolha| G[Atresia/estenose duodenal; excluir má rotação]
    F -->|Alças dilatadas, sem gás distal| H[Enema opaco: microcólon, cone de transição, pérolas]
    F -->|Sem ânus/fístula| I[Anomalia anorretal]
    H --> J{Íleo meconial simples?}
    J -->|Sim| K[Enema terapêutico]
    J -->|Não| L[Laparotomia / ostomia / biópsia retal]
```
