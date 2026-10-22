# Transplante Intestinal e Multiorgãos

> Resumo em palavras próprias do Whitebook (Condutas Cirúrgicas > Cirurgia Vascular), sem autoria e referências. Confira detalhes e doses na fonte: https://whitebook.pebmed.com.br/conteudo/?id=45403&categoryId=207&subcategoryId=238

**Contexto:** o transplante intestinal (TI) é opção para insuficiência intestinal irreversível, sobretudo síndrome do intestino curto (SIC). O multivisceral é reservado a doença colestática/insuficiência hepática progressiva com NPT e infecções recorrentes de cateter, e a distúrbios de motilidade irreversíveis. É muito menos frequente que outros transplantes e há poucos centros.

## Tipos
Isolado (só delgado); combinado fígado-intestino (insuficiência hepática concomitante); multivisceral (estômago, duodeno, pâncreas, fígado e intestino — neoplasia abdominal extensa com grandes ressecções ou trombose mesentérica difusa). Um rim pode ser incluído se houver doença renal terminal; o baço foi proposto para reduzir doença linfoproliferativa.

## Indicações
- Incapacidade de absorção com NPT e esgotamento de acessos venosos (mais da metade dos sítios de NPT — jugulares, subclávias, ilíacas — trombosados), múltiplos episódios de sepse por cateter, distúrbio hidroeletrolítico, desidratação, hepatopatia colestática progressiva pela NPT.
- Adicionais: trombose portomesentérica difusa, malignidades restritas ao abdome (tumor desmoide, TGI/pâncreas), lesão actínica, distúrbios congênitos de motilidade (Hirschsprung total, microcólon megacístico, pseudo-obstrução), polipose adenomatosa familiar.
- **Crianças:** SIC por anomalias congênitas, enterocolite necrosante, atresia, volvo, gastrósquise, motilidade. **Adultos:** SIC com Crohn, trombose mesentérica, trauma, desmoide.

## Contraindicações
Neoplasia maligna ativa, infecção sistêmica/sepse, cardiopatia ou pneumopatia grave irreversível (ICC, hipertensão pulmonar, DPOC avançada), falta de suporte social ou adesão, doença psiquiátrica não controlada, drogas/álcool, hepatopatia terminal não abordável (se não houver transplante combinado), doença autoimune sistêmica ativa.

## Pré-transplante
Biópsia hepática se houver suspeita de hepatopatia (pode ser adiada em doença avançada), US de fígado e veias centrais, sorologias (CMV, EBV, HIV, hepatites), trombofilias se trombose mesentérica prévia. Objetivo: definir TI isolado × com fígado × multivisceral (isolado possível em fibrose portal e disfunção hepática leve/moderada; combinado em hepatopatia terminal; multivisceral em neuropatia ou trombose mesentérica extensa).

## Técnica
Enxerto em bloco único (duodeno + delgado ± pâncreas), perfundido com solução fria/gelo, **preservando o tronco mesentérico superior**. Artéria mesentérica superior em geral terminolateral na aorta infrarrenal (ilíaca comum se aorta inacessível); atenção ao comprimento e a torções; veia mesentérica superior na VCI ou veia porta do receptor; Doppler ou angiografia intraoperatória. Risco de acidose e instabilidade por síndrome de reperfusão.

## Pós-transplante
Função intestinal: teste de D-xilose, gordura fecal (má absorção precoce sugere rejeição, enterite por CMV ou disfunção renal). NPT até retornar a motilidade; após integridade da anastomose, dieta elementar por sonda com progressão; NPT reduzida em 4–6 semanas.

## Imunossupressão
Indução com antilinfocitário (timoglobulina, alentuzumabe) ou anti-receptor de IL-2 + base de **tacrolimo** ± corticoide (o corticoide pode ser dispensado após timoglobulina ou alentuzumabe); o intestino é muito imunogênico. Adjuvantes: micofenolato (reduz a dose/toxicidade de ciclosporina e tacrolimo), sirolimo ou everolimo (menos nefrotoxicidade).

## Complicações
- **Técnicas:** sangramento, trombose, fístula anastomótica; morbimortalidade de 10–15% ou mais.
- **Infecção:** principal causa de morte (sepse intra-abdominal, de cateter, por translocação bacteriana). Tratar causa, remover cateter, tratar CMV, **descontaminação intestinal** (polimixina + anfotericina + gentamicina VO a cada 6 h) em suspeita de translocação ou rejeição aguda. Profilaxia: SMX-TMP (*Pneumocystis*), nistatina/clotrimazol, CMV.
- **Doença linfoproliferativa pós-transplante (DLPT):** até 30%, em geral ligada ao EBV; reduzir imunossupressão + antiviral.
- **Doença enxerto-versus-hospedeiro (DEH):** ~7–9%; pele, boca, diarreia, úlceras GI, disfunção hepática, supressão medular.
- **Rejeição aguda:** frequente e grave; mortalidade 25–45% aos 6 meses; perda do enxerto em praticamente todos os graves. Clínica: ↑ débito do estoma, febre, dor, distensão, íleo; predispõe a sepse e fungo. Histologia: infiltrado mononuclear, lesão de criptas, apoptose; graus indeterminado/leve/moderado/grave. Vigilância por endoscopias seriadas do estoma com biópsia (maior risco no 1º mês). Tratamento leve: corticoide e intensificação da imunossupressão (risco de CMV/EBV).
- **Rejeição crônica:** ~8%; fatores: TI isolado, rejeição aguda no 1º mês, mais episódios/gravidade, idade avançada, etnia não caucasiana; dificuldade alimentar, enteral por meses, obstrução; diagnóstico definitivo por biópsia do enxerto (obliteração de vasos submucosos e fibrose).

## Fluxograma (refeito, a partir do texto; o original não traz algoritmo)
```mermaid
flowchart TD
    A[Insuficiência intestinal irreversível (SIC, motilidade)] --> B{Falha da NPT? sepse de cateter, perda de acessos, hepatopatia}
    B -->|Não| C[Manter NPT / reabilitação intestinal]
    B -->|Sim| D{Hepatopatia terminal ou trombose portomesentérica / tumor abdominal?}
    D -->|Não| E[Transplante intestinal isolado]
    D -->|Fígado| F[Fígado-intestino]
    D -->|Extensa| G[Multivisceral]
    E --> H[Tacrolimo + indução; NPT → dieta elementar]
    F --> H
    G --> H
    H --> I[Endoscopia com biópsia do estoma: rejeição? infecção? DLPT?]
```
