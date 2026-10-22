# Câncer Colorretal em Pediatria

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Pediátrica), sem fisiopatologia detalhada, autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=62545&categoryId=207&subcategoryId=826

**Definição:** neoplasia maligna do cólon e reto, extremamente rara em crianças, com incidência crescente em jovens. Associa-se a alterações hereditárias (PAF, HNPCC) ou mutações adquiridas (instabilidade de microssatélites, sequência adenoma-carcinoma).

## Epidemiologia
- Maioria carcinomas (> 90% adenocarcinomas); 90% dos casos de cólon em geral após os 50 anos.
- Segunda neoplasia digestiva maligna mais comum em pediatria (após fígado), pico por volta dos **15 anos**; mais no cólon esquerdo.
- Predisponentes: síndromes hereditárias e colite ulcerativa.
- Prognóstico pior que em adultos (diagnóstico tardio, estágio avançado, histologias agressivas: anel de sinete, mucinoso, pouco diferenciado). Mutações mais frequentes em RNF43, PIK3CA, ATR, CDK6, KMT2D.

## Clínica
Dor abdominal, náusea/vômito, perda de peso, alteração do hábito, fezes afiladas (lado esquerdo), sangue nas fezes; em casos avançados, obstrução (cirurgia de urgência). **Fatores de risco:** polipose familiar, síndromes sem polipose, DII, ureterossigmoidostomia prévia, radioterapia, exposições ambientais, obesidade, dieta rica em gordura e pobre em fibras. Exame físico inespecífico (emagrecimento, massa, toque retal para lesões do reto).

## Diagnóstico
- **Laboratório:** hemograma (anemia), eletrólitos, função renal e hepática, **CEA**.
- **Colonoscopia com biópsia** (padrão-ouro). **Estadiamento:** TC ou RM de abdome/pelve e TC de tórax.
- **Síndromes:** **PAF** (polipose extensa, risco até 100%; rastrear outros tumores); **Gardner** (desmoides, cistos mandibulares, fibromas, osteomas, hipertrofia do epitélio pigmentado da retina); **Turcot** (polipose + gliomas/ependimomas). **Lynch/HNPCC:** CCR precoce familiar; Lynch I (só cólon) e II (extracolônica: endométrio, ovário, estômago, pâncreas, geniturinário). Critérios: ≥ 3 familiares com CCR/endométrio/delgado/ureter/pelve renal em duas gerações, um parente de 1º grau dos outros dois, um diagnóstico antes dos 50 anos, PAF excluída.

## Tratamento
- **Cirurgia:** ressecção completa com margens livres + linfadenectomia ampla (principal modalidade curativa); cirurgia guiada por fluorescência (indocianina); colostomia em casos avançados para sair da urgência.
- **Quimioterapia:** neoadjuvante em doença local avançada, tumores grandes ou metastáticos; adjuvante geralmente em estágios II/III; **FOLFOX** (ácido folínico + 5-FU + oxaliplatina) e **CAPOX** (capecitabina + oxaliplatina) com doses adaptadas.
- **Radioterapia:** sobretudo no reto.
- **Terapia-alvo/imunoterapia:** pembrolizumabe (mutações específicas, pacientes selecionados), bevacizumabe e cetuximabe em doença avançada com perfil molecular adequado.
- **Prognóstico:** em estágios avançados a sobrevida é menor que em jovens adultos; ressecção é o principal fator de sobrevida; melhora nos estágios iniciais; preservar fertilidade e função sexual; risco de efeitos tardios e segundas neoplasias; biologia distinta pede protocolos pediátricos próprios.

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Dor, sangramento, alteração do hábito, anemia em criança/adolescente] --> B[Hemograma, CEA, colonoscopia com biópsia]
    B --> C{Carcinoma?}
    C -->|Sim| D[TC/RM abdome-pelve + TC tórax: estadiar; investigar PAF/Lynch]
    D --> E{Ressecável?}
    E -->|Sim| F[Ressecção + linfadenectomia ± quimio adjuvante FOLFOX/CAPOX em II/III]
    E -->|Não ou localmente avançado| G[Quimio neoadjuvante ± radioterapia (reto)] --> F
    F --> H[Seguimento e aconselhamento genético]
```
