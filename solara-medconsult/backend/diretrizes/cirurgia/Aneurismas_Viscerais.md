# Aneurismas Viscerais

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Vascular), sem fisiopatologia detalhada, autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=64257&categoryId=207&subcategoryId=238

**Definição:** aneurismas das artérias que nutrem vísceras abdominais, com diâmetro ≥ 50% do esperado; raros, mais comuns na esplênica e na hepática. Etiologia mais comum degenerativa (aterosclerose); também displasia fibromuscular, colagenoses, vasculites, infecção. **Gestação e multiparidade** (hormônios e hemodinâmica) são desencadeantes e fatores de risco de ruptura.

## Clínica
Em geral assintomáticos (achado incidental); os volumosos dão dor abdominal vaga. Ruptura = emergência: dor abdominal/lombar súbita, choque hemorrágico, hemoperitônio, peritonite. Exame físico inespecífico.

## Diagnóstico
- **USG Doppler:** acessível, de escolha para seguimento (difícil em obesos).
- **Angio-TC:** escolha para anatomia e planejamento (reconstrução multiplanar).
- **Angiografia:** em desuso diagnóstico; reservada ao tratamento endovascular concomitante.

## Quando tratar
Todos os **sintomáticos** e todos os **rotos** (emergência grave), por via aberta ou endovascular. Assintomáticos, segundo o tamanho:
- **Esplênica:** ≥ 3 cm, ou qualquer tamanho em mulher em idade fértil/gestante.
- **Hepática:** > 2 cm, ou crescimento > 0,5 cm/ano.
- **Tronco celíaco:** > 2 cm.
- **Renal:** ≥ 3 cm (o texto original repete a regra da esplênica para gestantes — **conferir na fonte**).
- **Jejunais e ileais:** > 2 cm.
- **Mesentérica superior, pancreatoduodenal, gastroduodenal, gástrica, gastroepiploica e cólicas:** qualquer diâmetro.

## Tratamento
- **Aberto** (ligadura do vaso ou interposição de enxerto autólogo/protético): perdendo espaço por morbimortalidade; ainda indicado em ruptura com instabilidade, falha endovascular e anatomia desfavorável.
- **Endovascular** (menos invasivo, menor morbimortalidade): embolização com molas, técnica de gaiola (*cage*), stents recobertos, moduladores de fluxo; antiagregação plaquetária no pós-operatório de stent recoberto.
- **Clínico:** nenhum fármaco faz o aneurisma regredir; controlar fatores de risco e doença de base; degenerativos são de alto risco cardiovascular → estatina de alta potência e AAS. Vasculites/infecção: tratar a causa.
- **Seguimento** dos não operados: imagem seriada semestral ou anual com o cirurgião vascular.

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Aneurisma visceral] --> B{Roto ou sintomático?}
    B -->|Sim| C[Emergência: reparo endovascular ou aberto (aberto se instável)]
    B -->|Não| D{Acima do limiar? esplênica ≥ 3 cm / mulher fértil, hepática > 2 cm, celíaco > 2 cm, MS e outros qualquer tamanho}
    D -->|Sim| E[Embolização/stent recoberto ou cirurgia]
    D -->|Não| F[Controle de risco, estatina + AAS, imagem a cada 6-12 meses]
```
