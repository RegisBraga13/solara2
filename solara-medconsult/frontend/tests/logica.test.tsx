import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Chip } from "@/components/Chip";

import { linhaExameFisico, linhaIdentificacao, registroBruto } from "@/lib/historia";
import { escalasAplicadas, montarProntuario } from "@/lib/prontuario";
import { rotaDaEtapa } from "@/lib/rotas";
import {
  juntarTermos,
  partirTermo,
  unirItens,
  type ItemSecao,
  type ItemSugerido,
  type SecaoPropedeutica,
} from "@/lib/sugestoes";
import { temaPorHora } from "@/lib/tema";
import { dadosIniciais, useConsulta } from "@/store/consulta";

beforeEach(() => {
  localStorage.clear();
  useConsulta.setState(dadosIniciais("dia"));
});

describe("registro bruto da captura", () => {
  const base = () => dadosIniciais("dia");

  it("sem nada capturado devolve vazio (nunca texto inventado)", () => {
    expect(registroBruto(base())).toBe("");
  });

  it("reúne texto digitado, diálogo e imagens em ordem cronológica, sem reescrever", () => {
    const d = base();
    d.captura.texto = "  Dor lombar há 3 dias.  ";
    d.transcricoes = [
      { text: "Bom dia, o que sente?", speaker: "medico", speaker_id: 0, is_final: true, timestamp_ms: 1 },
      { text: "Dor nas costas.", speaker: "paciente", speaker_id: 1, is_final: true, timestamp_ms: 2 },
    ];
    d.imagens = [
      { id: "b", nome: "b.jpg", url: "u", data: null, descricao: null },
      { id: "a", nome: "a.jpg", url: "u", data: "2025-03-14", descricao: "Placa eritematosa." },
    ];
    const r = registroBruto(d);
    expect(r).toContain("ANAMNESE (texto digitado)\nDor lombar há 3 dias.");
    expect(r).toContain("[Médico] Bom dia, o que sente?\n[Paciente] Dor nas costas.");
    expect(r.indexOf("14/03/2025 (a.jpg): Placa eritematosa.")).toBeLessThan(
      r.indexOf("sem data (b.jpg): sem descrição automática"),
    );
    expect(r).not.toMatch(/Paciente do sexo|dermatite/i);
  });

  it("inclui os achados do exame físico digitados, entre o diálogo e as imagens", () => {
    const d = base();
    d.transcricoes = [
      { text: "Bom dia.", speaker: "medico", speaker_id: 0, is_final: true, timestamp_ms: 1 },
    ];
    d.exameFisico.texto = "  Lesão eritemato-descamativa em couro cabeludo.  ";
    d.imagens = [{ id: "a", nome: "a.jpg", url: "u", data: null, descricao: null }];
    const r = registroBruto(d);
    expect(r).toContain(
      "EXAME FÍSICO E COMPLEMENTOS (texto digitado)\nLesão eritemato-descamativa em couro cabeludo.",
    );
    expect(r.indexOf("[Médico] Bom dia.")).toBeLessThan(
      r.indexOf("EXAME FÍSICO E COMPLEMENTOS (texto digitado)"),
    );
    expect(r.indexOf("EXAME FÍSICO E COMPLEMENTOS (texto digitado)")).toBeLessThan(
      r.indexOf("IMAGENS (descrição automática"),
    );
  });
});

describe("escalasAplicadas (ANEXOS e prontuário)", () => {
  it("vazio ou com escore vazio não aparece; a especialidade padrão (dermatologia) não define escalas", () => {
    expect(escalasAplicadas(undefined)).toEqual([]);
    expect(escalasAplicadas({})).toEqual([]);
    expect(escalasAplicadas({ qualquer: "" })).toEqual([]);
    expect(escalasAplicadas({ phq9: "12" })).toEqual([]); // não é escala desta especialidade
  });
});

describe("5 seções da história: Identificação e Exame físico (dado estruturado, nunca a IA)", () => {
  it("identificação: '' sem paciente ligado ou sem nenhum campo preenchido", () => {
    expect(linhaIdentificacao(null)).toBe("");
    expect(linhaIdentificacao({ nascimento: null, sexo: null, profissao: null })).toBe("");
  });

  it("identificação: junta só os campos preenchidos", () => {
    expect(linhaIdentificacao({ nascimento: null, sexo: "Feminino", profissao: null })).toBe(
      "Identificação: sexo feminino.",
    );
    expect(linhaIdentificacao({ nascimento: null, sexo: "Masculino", profissao: "Pedreiro" })).toBe(
      "Identificação: sexo masculino, profissão pedreiro.",
    );
  });

  it("exame físico: sempre presente, mesmo vazio (nunca omitido, nunca inventado)", () => {
    expect(linhaExameFisico("", [])).toBe("Exame físico: Não relatado.");
    expect(linhaExameFisico("Placas em cotovelos.", [])).toBe("Exame físico: Placas em cotovelos.");
    expect(
      linhaExameFisico("", [
        { id: "a", nome: "a.jpg", url: "u", data: null, descricao: "Placa eritematosa." },
        { id: "b", nome: "b.jpg", url: "u", data: null, descricao: null },
      ]),
    ).toBe("Exame físico: Placa eritematosa.");
  });
});

describe("rotas e tema", () => {
  it("mapeia etapas e limita extremos", () => {
    expect(rotaDaEtapa(1)).toBe("/");
    expect(rotaDaEtapa(9)).toBe("/prontuario");
    expect(rotaDaEtapa(99)).toBe("/prontuario");
    expect(rotaDaEtapa(-3)).toBe("/");
  });
  it("tema por hora", () => {
    expect(temaPorHora(new Date(2026, 0, 1, 6))).toBe("dia");
    expect(temaPorHora(new Date(2026, 0, 1, 17, 59))).toBe("dia");
    expect(temaPorHora(new Date(2026, 0, 1, 18))).toBe("noite");
    expect(temaPorHora(new Date(2026, 0, 1, 3))).toBe("noite");
  });
});

describe("store", () => {
  it("alterna seleções e tema", () => {
    const s = useConsulta.getState();
    s.toggleDiagnostico("A");
    s.toggleDiagnostico("B");
    s.toggleDiagnostico("A");
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["B"]);
    s.toggleTheme();
    expect(useConsulta.getState().theme).toBe("noite");
  });
  it("addExtra seleciona, recusa vazio e duplicado", () => {
    useConsulta.getState().setSugestoesDiagnostico("c", ["Dermatite atópica"]);
    const s = useConsulta.getState();
    expect(s.addExtra("diagnostico", "  Rosácea ")).toBe(true);
    expect(useConsulta.getState().diagnostico.selecionados).toContain("Rosácea");
    expect(s.addExtra("diagnostico", "rosácea")).toBe(false);
    expect(s.addExtra("diagnostico", "dermatite atópica")).toBe(false);
    expect(s.addExtra("diagnostico", "   ")).toBe(false);
  });
  it("sugestões novas não apagam o que o médico marcou (vira item dele)", () => {
    const s = useConsulta.getState();
    s.setSugestoesDiagnostico("a", ["Psoríase", "Rosácea"]);
    s.toggleDiagnostico("Psoríase");
    s.addExtra("diagnostico", "Diagnóstico livre");
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["Psoríase", "Diagnóstico livre"]);
    useConsulta.getState().setSugestoesDiagnostico("b", ["Melasma"]);
    expect(useConsulta.getState().diagnostico.selecionados).toEqual(["Psoríase", "Diagnóstico livre"]);
    expect(useConsulta.getState().sugestoes.diagnostico).toEqual({ chave: "b", itens: ["Melasma"] });
  });
  it("propedêutica: o rótulo é único entre as seções e o que foi marcado permanece", () => {
    const s = useConsulta.getState();
    s.setSugestoesPropedeutica("x", [
      { termo: "Biópsia", secao: "investigacao" },
      { termo: "Retorno em 15 dias", secao: "acompanhamento" },
    ]);
    expect(s.addExtra("tratamento", "biópsia")).toBe(false);
    expect(useConsulta.getState().addExtra("acompanhamento", "Orientar retorno")).toBe(true);
    s.togglePropedeutica("Biópsia");
    useConsulta.getState().setSugestoesPropedeutica("y", []);
    expect(useConsulta.getState().propedeutica.selecionados).toEqual(["Orientar retorno", "Biópsia"]);
  });
  it("orientações: itens livres entram na seção certa e não se misturam com a propedêutica", () => {
    const s = useConsulta.getState();
    expect(s.addExtra("fotoprotecao", "Chapéu de aba larga")).toBe(true);
    expect(useConsulta.getState().extras.orientacoes.fotoprotecao).toEqual(["Chapéu de aba larga"]);
    expect(useConsulta.getState().orientacoes.selecionados).toEqual(["Chapéu de aba larga"]);
    expect(useConsulta.getState().propedeutica.selecionados).toEqual([]);
    expect(useConsulta.getState().addExtra("higiene", "chapéu de aba larga")).toBe(false);
  });
  it("anotações ficam por tela e vão para o estado salvo", () => {
    const s = useConsulta.getState();
    s.setAnotacao("diagnostico", "trecho colado");
    s.setAnotacao("propedeutica", "outro trecho");
    expect(useConsulta.getState().anotacoes).toEqual({
      diagnostico: "trecho colado",
      propedeutica: "outro trecho",
      evolucao: "",
    });
  });  it("addImagem evita nomes repetidos", () => {
    const s = useConsulta.getState();
    expect(s.addImagem("a.png")).toBe("a.png");
    expect(s.addImagem("a.png")).toBe("a.png (2)");
  });
  it("setEtapa limita 1–9; reset mantém tema", () => {
    const s = useConsulta.getState();
    s.setEtapa(20);
    expect(useConsulta.getState().etapa_atual).toBe(9);
    s.setModo("online");
    s.toggleTheme();
    s.reset();
    const r = useConsulta.getState();
    expect(r.modo).toBeNull();
    expect(r.theme).toBe("noite");
    expect(r.etapa_atual).toBe(1);
  });
  it("persiste no localStorage e restaura", async () => {
    useConsulta.getState().setModo("presencial");
    useConsulta.getState().togglePropedeutica("Retorno em 15 dias");
    const bruto = JSON.parse(localStorage.getItem("medconsult-state")!);
    expect(bruto.state.modo).toBe("presencial");
    expect(bruto.state.setModo).toBeUndefined();
    const salvo = localStorage.getItem("medconsult-state")!;
    useConsulta.setState(dadosIniciais("dia"));
    localStorage.setItem("medconsult-state", salvo);
    await useConsulta.persist.rehydrate();
    expect(useConsulta.getState().modo).toBe("presencial");
    expect(useConsulta.getState().propedeutica.selecionados).toEqual(["Retorno em 15 dias"]);
  });
});

describe("prontuário", () => {
  it("consolida as seções na ordem da consulta, com as anotações do médico", () => {
    const d = dadosIniciais();
    d.modo = "online";
    d.historia.texto = "Texto X";
    d.diagnostico.selecionados = ["Dermatite atópica"];
    d.condutaTratamento = {
      conduta: { texto: "Plano geral.", editado: true },
      investigacao: { texto: "Biópsia com histopatológico.", editado: true },
      tratamento: { texto: "Corticoide tópico.", editado: true },
      orientacoes: { texto: "Protetor solar FPS 50.", editado: true },
    };
    d.anotacoes = { diagnostico: "colado do Whitebook", propedeutica: "", evolucao: "" };
    const t = montarProntuario(d);
    expect(t).toContain("CONSULTA ONLINE");
    expect(t).toContain("Texto X");
    expect(t).toContain("- Dermatite atópica");
    expect(t).toContain("CONDUTA\nPlano geral.");
    expect(t).toContain("PROPEDÊUTICA\nBiópsia com histopatológico.");
    expect(t).toContain("TRATAMENTO\nCorticoide tópico.");
    expect(t).toContain("ORIENTAÇÕES GERAIS\nProtetor solar FPS 50.");
    expect(t).toContain("ANOTAÇÕES DO MÉDICO\nDiagnóstico:\ncolado do Whitebook");
    expect(t).not.toContain("Conduta:\n"); // anotação vazia não aparece
    const ordem = [
      "DIAGNÓSTICO",
      "CONDUTA",
      "PROPEDÊUTICA",
      "TRATAMENTO",
      "ORIENTAÇÕES GERAIS",
      "ANOTAÇÕES DO MÉDICO",
    ].map((x) => t.indexOf(x));
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });
  it("sem conduta/propedêutica/tratamento/orientações gerados, mostra que não foram registrados", () => {
    const t = montarProntuario(dadosIniciais());
    expect(t).toContain("CONDUTA\n(não registrada)");
    expect(t).toContain("PROPEDÊUTICA\n(não registrada)");
    expect(t).toContain("TRATAMENTO\n(não registrado)");
    expect(t).toContain("ORIENTAÇÕES GERAIS\n(não registradas)");
  });
  it("sem anotações o bloco não aparece", () => {
    expect(montarProntuario(dadosIniciais())).not.toContain("ANOTAÇÕES DO MÉDICO");
  });
});

describe("rascunho antigo", () => {
  it("rascunho da versão anterior (tratamento/condutas) continua abrindo e mantém o que existe", async () => {
    const antigo = {
      ...dadosIniciais("dia"),
      modo: "online",
      historia: { texto: "Hist antiga", editado: true },
      diagnostico: { selecionados: ["Psoríase"] },
      tratamento: { selecionados: ["x"] },
      condutas: { selecionados: ["y"] },
      etapa_atual: 7,
    };
    localStorage.setItem("medconsult-state", JSON.stringify({ state: antigo, version: 2 }));
    await useConsulta.persist.rehydrate();
    const s = useConsulta.getState();
    expect(s.modo).toBe("online");
    expect(s.historia).toEqual({ texto: "Hist antiga", editado: true });
    expect(s.diagnostico.selecionados).toEqual(["Psoríase"]);
    expect(s.propedeutica.selecionados).toEqual([]);
    expect(s.orientacoes.selecionados).toEqual([]);
    expect(s.extras.propedeutica.investigacao).toEqual([]);
    expect(s.anotacoes).toEqual({ diagnostico: "", propedeutica: "", evolucao: "" });
    expect(s.addExtra("investigacao", "Hemograma")).toBe(true);
  });
});
describe("sugestões não são salvas", () => {
  const ITENS: ItemSecao<SecaoPropedeutica>[] = [
    { termo: "Biópsia", secao: "investigacao" },
    { termo: "Corticoide tópico", secao: "tratamento" },
  ];

  function bruto() {
    return JSON.parse(localStorage.getItem("medconsult-state")!).state;
  }

  it("a lista sugerida nunca vai para o armazenamento; a escolha do médico vai, com a seção", async () => {
    const s = useConsulta.getState();
    s.setSugestoesDiagnostico("c", ["Psoríase", "Rosácea"]);
    s.setSugestoesPropedeutica("c", [...ITENS]);
    s.toggleDiagnostico("Psoríase");
    useConsulta.getState().togglePropedeutica("Biópsia");
    const salvo = bruto();
    expect(salvo.sugestoes).toEqual({ diagnostico: null, propedeutica: null, orientacoes: null });
    const texto = JSON.stringify(salvo);
    expect(texto).not.toContain("Rosácea"); // sugerido e não escolhido: não ficou salvo
    expect(texto).not.toContain("Corticoide tópico");
    expect(salvo.diagnostico.selecionados).toEqual(["Psoríase"]);
    expect(salvo.extras.diagnostico).toEqual(["Psoríase"]);
    expect(salvo.extras.propedeutica.investigacao).toEqual(["Biópsia"]);

    // recarregar a página: a escolha volta (como item do médico, na seção certa); a lista, não
    const guardado = localStorage.getItem("medconsult-state")!;
    useConsulta.setState(dadosIniciais("dia"));
    localStorage.setItem("medconsult-state", guardado);
    await useConsulta.persist.rehydrate();
    const r = useConsulta.getState();
    expect(r.sugestoes).toEqual({ diagnostico: null, propedeutica: null, orientacoes: null });
    expect(r.propedeutica.selecionados).toEqual(["Biópsia"]);
    expect(r.extras.propedeutica.investigacao).toEqual(["Biópsia"]);
  });

  it("marcar e desmarcar não duplica o item do médico", () => {
    const s = useConsulta.getState();
    s.setSugestoesPropedeutica("c", [...ITENS]);
    s.togglePropedeutica("Biópsia");
    useConsulta.getState().togglePropedeutica("Biópsia");
    useConsulta.getState().togglePropedeutica("biópsia ");
    expect(useConsulta.getState().extras.propedeutica.investigacao).toEqual(["Biópsia"]);
  });

  it("rascunho da versão anterior (com a lista salva) passa a escolha para os itens do médico", async () => {
    const antigo = dadosIniciais("dia");
    antigo.modo = "online";
    antigo.propedeutica.selecionados = ["Biópsia"];
    antigo.diagnostico.selecionados = ["Psoríase"];
    antigo.sugestoes.propedeutica = { chave: "x", itens: [...ITENS] };
    antigo.sugestoes.diagnostico = { chave: "x", itens: ["Psoríase", "Rosácea"] };
    localStorage.setItem("medconsult-state", JSON.stringify({ state: antigo, version: 3 }));
    await useConsulta.persist.rehydrate();
    const r = useConsulta.getState();
    expect(r.sugestoes.propedeutica).toBeNull();
    expect(r.sugestoes.diagnostico).toBeNull();
    expect(r.extras.propedeutica.investigacao).toEqual(["Biópsia"]);
    expect(r.extras.diagnostico).toEqual(["Psoríase"]);
    expect(r.extras.propedeutica.tratamento).toEqual([]); // não escolhido: some
  });
});
describe("unirItens", () => {
  it("o mesmo termo em seções diferentes não se funde", () => {
    const r = unirItens<ItemSecao>([
      [{ termo: "Retorno", secao: "acompanhamento" }],
      [{ termo: "retorno", secao: "tratamento" }],
    ]);
    expect(r).toHaveLength(2);
  });
  it("junta o mesmo termo de listas diferentes, sem repetir", () => {
    const r = unirItens<ItemSugerido>([
      [
        { termo: "Itraconazol" },
        { termo: "Iodeto" },
      ],
      [{ termo: " itraconazol " }],
    ]);
    expect(r).toEqual([
      { termo: "Itraconazol" },
      { termo: "Iodeto" },
    ]);
  });
});

describe("blocos de itens correlatos (um chip só)", () => {
  it("separa título e componentes e junta blocos do mesmo grupo sem repetir", () => {
    expect(partirTermo("Exames laboratoriais: hemograma, TGO/TGP")).toEqual({
      titulo: "Exames laboratoriais",
      componentes: ["hemograma", "TGO/TGP"],
    });
    expect(partirTermo("Biópsia de pele")).toEqual({ titulo: "Biópsia de pele", componentes: [] });
    expect(juntarTermos("Exames: hemograma, TGO", "Exames: tgo, creatinina")).toBe(
      "Exames: hemograma, TGO, creatinina",
    );
  });

  it("unirItens funde o mesmo grupo vindo de diagnósticos diferentes, somando componentes", () => {
    const r = unirItens<ItemSecao>([
      [{ termo: "Exames laboratoriais: hemograma, TGO", secao: "investigacao" }],
      [{ termo: "exames laboratoriais: TGO, creatinina", secao: "investigacao" }],
      [{ termo: "Exames laboratoriais: glicemia", secao: "acompanhamento" }],
    ]);
    expect(r).toHaveLength(2); // a seção diferente não se funde
    expect(r[0]).toEqual({
      termo: "Exames laboratoriais: hemograma, TGO, creatinina",
      secao: "investigacao",
    });
  });

  it("o chip mostra o título em destaque e os componentes embaixo; item simples fica como está", () => {
    const { rerender } = render(
      <Chip rotulo="Exames laboratoriais: hemograma, TGO/TGP" selecionado={false} onToggle={() => undefined} />,
    );
    expect(screen.getByText("Exames laboratoriais")).toBeInTheDocument();
    expect(screen.getByText("hemograma · TGO/TGP")).toBeInTheDocument();
    rerender(<Chip rotulo="Biópsia de pele" selecionado={false} onToggle={() => undefined} />);
    expect(screen.getByText("Biópsia de pele")).toBeInTheDocument();
  });

  it("marcar o bloco guarda o texto inteiro (título + componentes) como item do médico", () => {
    const s = useConsulta.getState();
    s.setSugestoesPropedeutica("c", [
      { termo: "Exames laboratoriais: hemograma, TGO/TGP", secao: "investigacao" },
    ]);
    s.togglePropedeutica("Exames laboratoriais: hemograma, TGO/TGP");
    expect(useConsulta.getState().extras.propedeutica.investigacao).toEqual([
      "Exames laboratoriais: hemograma, TGO/TGP",
    ]);
  });
});
describe("luz de tempo", () => {
  it("fases nos limites 00:30 e 45:00", async () => {
    const { faseDoTempo, formatarTempo } = await import("@/lib/tempo");
    expect(faseDoTempo(0)).toBe("oculto");
    expect(faseDoTempo(29_999)).toBe("oculto");
    expect(faseDoTempo(30_000)).toBe("normal");
    expect(faseDoTempo(45 * 60_000 - 1)).toBe("normal");
    expect(faseDoTempo(45 * 60_000)).toBe("alerta");
    expect(faseDoTempo(Number.NaN)).toBe("oculto");
    expect(formatarTempo(44 * 60_000 + 59_000)).toBe("44:59");
    expect(formatarTempo(75 * 60_000 + 3_000)).toBe("75:03");
  });
  it("iniciarConsulta não reinicia o relógio; reset zera", () => {
    const s = useConsulta.getState();
    s.iniciarConsulta();
    const t = useConsulta.getState().iniciada_em;
    expect(t).not.toBeNull();
    s.iniciarConsulta();
    expect(useConsulta.getState().iniciada_em).toBe(t);
    s.reset();
    expect(useConsulta.getState().iniciada_em).toBeNull();
  });
});
