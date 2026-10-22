# Carcinoma Tímico

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Oncológica), sem fisiopatologia, autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=39152&categoryId=207&subcategoryId=212

**Definição:** tumor maligno do epitélio tímico, em geral invasivo e agressivo, descoberto em estágio avançado. Homens de 50–70 anos; 10% dos tumores epiteliais do timo e o mais agressivo. Em geral irressecável, metastatiza cedo (linfo-hematogênica) e tem sobrevida pior que a dos timomas. Epitélio indiferenciado com CD5, CD70, CD117 em ~60%. Tipos mais comuns: linfoepitelioma-like e epidermoide. Outros: epidermoide não queratinizante, sarcomatoide (carcinossarcoma), células claras, basaloide, mucoepidermoide, papilar, indiferenciado, com translocação t(15;19).

## Clínica
Sintomas de invasão/compressão sem especificidade: tosse, dor torácica, paralisia do frênico, síndrome de veia cava superior. Em geral sem síndromes paraneoplásicas. Grandes massas mediastinais anteriores infiltrativas, mal definidas; derrame pleural ou pericárdico frequente.

## Diagnóstico
- **Clínica:** exame neurológico, sintomas B, adenomegalia, exame escrotal; LDH, hCG e AFP (diferenciar de linfoma e tumores germinativos).
- **RX:** alargamento mediastinal, massa arredondada ou lobulada anterossuperior. **TC com contraste** (método de escolha): massa irregular que capta contraste, calcificações, cistos, necrose; derrame pleural sugere invasão; difícil distinguir invasão local ou timoma invasivo × não invasivo. **RM:** suspeita de invasão de grandes vasos. **PET-FDG:** não diagnóstico; ajuda em metástases.
- **Biópsia** (transtorácica ou mediastinotomia anterior): tumores irressecáveis; diferenciar tipos de timoma (AB, B1, B2 × A, B3), carcinoma tímico e outros sólidos (em que análogos de somatostatina + corticoide neoadjuvante ou quimioterapia são alternativas).
- **Masaoka-Koga:** I totalmente encapsulado; II invasão micro/macroscópica da gordura ou pleura mediastinal; III órgãos adjacentes (pericárdio, pulmões, grandes vasos); IVa pericárdica/pleural; IVb metástases a distância. **TNM** igual ao do tumor neuroendócrino tímico (T1–T4, N1–N2, M1a/M1b; estágios I, II, IIIA, IIIB, IVA, IVB).
- **Diferenciais:** tumor germinativo, linfoma mediastinal primário, câncer de pulmão com invasão mediastinal, carcinoma NUT.

## Tratamento (conforme histologia e Masaoka-Koga)
- **Cirurgia** é a escolha se ressecável (Masaoka I/II e alguns III): esternotomia mediana, timectomia radical com ressecção em bloco das estruturas invadidas e linfadenectomia (anterior, mediastinal profunda, cervical anterior); minimamente invasiva em I–II presumidos; amostragem de linfonodos em III–IV; clipar áreas duvidosas para a RT; **sem congelação** de margens (falso-negativos); ressecar o frênico não altera sobrevida, mas aumenta recidiva local.
- **RT adjuvante:** reduz recidiva, não altera sobrevida; ideal em até 3 meses; indicada em R1/R2 ou alto grau; opcional em estágio I, considerada no II, recomendada em III e IV; dose não padronizada; sem irradiação profilática supraclavicular nem de todo o hemitórax.
- **QT adjuvante** (estágios II–IV, sobretudo sem indução): platina, 2–4 ciclos antes de reavaliar; ressecção parcial (R2/debulking) não indicada. **RT definitiva** em não candidatos à cirurgia (± QT). **QT definitiva** (platina) nos avançados, irressecáveis, não irradiáveis ou IVB, paliativa, resposta geralmente < 50%.
- **Recidiva:** mesmo princípio; ressecção completa se possível; várias linhas de QT, podendo repetir esquema prévio que funcionou.
- **Terapia-alvo:** KIT superexpresso em 80%; casos com imatinibe, sunitinibe, sorafenibe; sequenciar KIT (éxons 9–17) em refratários; uso off-label; imatinibe só com mutação sensibilizadora; sunitinibe como 2ª linha independentemente do status KIT.
- **Imunoterapia:** alta expressão de PD-L1; pembrolizumabe em fase II em refratários/recidivados (III–IVB), taxa de resposta 22,4 (o texto escreve “22,4 meses”; conferir na fonte), com doenças autoimunes manejáveis.

## Seguimento e prognóstico
TC de tórax basal em 3–4 meses; semestral por 2 anos e depois anual por 10–15 anos. Prognóstico desfavorável, com alta recidiva.

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Massa mediastinal anterior infiltrativa] --> B[TC ± RM, marcadores, biópsia]
    B --> C{Ressecável (Masaoka I-III)?}
    C -->|Sim| D[Timectomia radical em bloco + linfadenectomia]
    D --> E{R1/R2 ou alto grau ou estágio III-IV?}
    E -->|Sim| F[RT adjuvante ± QT com platina]
    C -->|Não| G[QT com platina ± RT definitiva]
    G --> H[KIT / PD-L1: terapia-alvo ou imunoterapia em refratários]
    D --> I[TC semestral 2 anos, depois anual]
```
