import type { PreConsultaDermatologiaIn } from "@/lib/api";

const simNao = (v: boolean) => (v ? "sim" : "não");

/** Texto corrido da pré-consulta (blocos 2 a 7), para alimentar a história clínica. */
export function textoDaPreConsulta(p: PreConsultaDermatologiaIn): string {
  const { queixa, historico, saude, estetica, seguranca } = p;
  const partes: string[] = [];

  partes.push(
    [
      "QUEIXA PRINCIPAL",
      `Queixa principal: ${queixa.queixa_principal} (há ${queixa.duracao_queixa}).`,
      queixa.categorias.length ? `Categorias: ${queixa.categorias.join(", ")}.` : null,
      `Já tratou antes: ${simNao(queixa.ja_tratou_antes)}` +
        (queixa.ja_tratou_antes && queixa.tratamento_anterior ? ` — ${queixa.tratamento_anterior}` : "") +
        ".",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  partes.push(
    [
      "HISTÓRICO DERMATOLÓGICO",
      `Exposição solar: ${simNao(historico.exposicao_solar)}` +
        (historico.tipo_exposicao ? ` (${historico.tipo_exposicao})` : "") +
        ".",
      `Queimadura solar na infância: ${simNao(historico.queimadura_solar_infancia)}.`,
      `Câmara de bronzeamento: ${simNao(historico.uso_camara_bronzeamento)}.`,
      `Uso de protetor solar: ${historico.frequencia_protetor_solar.replace("_", " ")}.`,
      `Fototipo de Fitzpatrick: ${historico.fototipo_fitzpatrick}.`,
      `Histórico familiar de câncer de pele: ${simNao(historico.historico_familiar_cancer_pele)}` +
        (historico.quem_historico_familiar ? ` (${historico.quem_historico_familiar})` : "") +
        ".",
      `Melanoma na família: ${simNao(historico.melanoma_familiar)}.`,
    ].join("\n"),
  );

  partes.push(
    [
      "SAÚDE GERAL E MEDICAÇÕES",
      `Alergias: ${simNao(saude.alergias)}` +
        (saude.tipos_alergia.length ? ` (${saude.tipos_alergia.join(", ")})` : "") +
        (saude.descricao_alergia ? ` — ${saude.descricao_alergia}` : "") +
        ".",
      `Medicação contínua: ${simNao(saude.medicamentos_uso_continuo)}` +
        (saude.lista_medicamentos ? ` — ${saude.lista_medicamentos}` : "") +
        ".",
      saude.comorbidades.length
        ? `Comorbidades: ${saude.comorbidades.join(", ")}.`
        : "Sem comorbidades relatadas.",
      `Tabagismo: ${saude.tabagismo.replace("_", "-")}. Etilismo: ${saude.etilismo}. ` +
        `Atividade física: ${saude.atividade_fisica}.`,
      saude.gestante ? "Gestante." : null,
      saude.amamentando ? "Amamentando." : null,
      saude.uso_anticoncepcional ? "Usa anticoncepcional." : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  partes.push(
    [
      "ESTÉTICA E PROCEDIMENTOS",
      estetica.procedimentos_anteriores.length
        ? `Procedimentos estéticos anteriores: ${estetica.procedimentos_anteriores.join(", ")}` +
          (estetica.tempo_ultimo_procedimento ? ` (último há ${estetica.tempo_ultimo_procedimento})` : "") +
          "."
        : "Sem procedimentos estéticos anteriores.",
      `Complicação em procedimento anterior: ${simNao(estetica.teve_complicacao)}` +
        (estetica.descricao_complicacao ? ` — ${estetica.descricao_complicacao}` : "") +
        ".",
      `Usa ácidos na pele: ${simNao(estetica.usa_acidos)}.`,
      estetica.produtos_skincare ? `Produtos de skincare: ${estetica.produtos_skincare}.` : null,
      `Tratamento estético em andamento: ${simNao(estetica.tratamento_em_andamento)}.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const riscos = [
    seguranca.historico_herpes_simples && "histórico de herpes simples",
    seguranca.tendencia_queloide && "tendência a queloide",
    seguranca.possui_marcapasso_ou_implante_metalico && "marcapasso ou implante metálico",
    seguranca.quimica_capilar_recente && "química capilar recente",
    seguranca.alergia_anestesico && "alergia a anestésico",
    seguranca.usa_anticoagulante && "uso de anticoagulante",
  ].filter((x): x is string => Boolean(x));
  partes.push(
    `SEGURANÇA CLÍNICA\n${riscos.length ? `Atenção: ${riscos.join("; ")}.` : "Sem fatores de risco relatados."}`,
  );

  return `PRÉ-CONSULTA (preenchida pelo paciente)\n\n${partes.join("\n\n")}`;
}
