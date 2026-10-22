"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BigButton } from "@/components/BigButton";
import { FormularioPaciente } from "@/components/FormularioPaciente";
import { Panel } from "@/components/Panel";
import { ProgressDots } from "@/components/ProgressDots";
import { TelaSimples } from "@/components/TelaSimples";
import {
  ApiError,
  FICHA_VAZIA,
  corrigirPaciente,
  enviarPreConsulta,
  obterPaciente,
  type FichaPaciente,
  type PreConsultaDermatologiaIn,
} from "@/lib/api";
import { formatarCpf } from "@/lib/pacientes";

const TOTAL_ETAPAS = 7;

function fichaDoCadastro(p: Awaited<ReturnType<typeof obterPaciente>>): FichaPaciente {
  return {
    ...FICHA_VAZIA,
    nome: p.nome,
    nascimento: p.nascimento ?? "",
    cpf: p.cpf ? formatarCpf(p.cpf) : "",
    sexo: p.sexo ?? "",
    contato: p.contato ?? "",
    profissao: p.profissao ?? "",
    moradia: p.moradia ?? "",
    plano_saude: p.plano_saude ?? "",
    historico_familiar: p.historico_familiar ?? "",
    medicacoes_uso: p.medicacoes_uso ?? "",
    alergias: p.alergias ?? "",
  };
}

const VAZIA: PreConsultaDermatologiaIn = {
  queixa: {
    queixa_principal: "",
    duracao_queixa: "dias",
    ja_tratou_antes: false,
    tratamento_anterior: "",
    categorias: [],
  },
  historico: {
    exposicao_solar: false,
    tipo_exposicao: null,
    queimadura_solar_infancia: false,
    uso_camara_bronzeamento: false,
    frequencia_protetor_solar: "nunca",
    fps_habitual: null,
    fototipo_fitzpatrick: 3,
    historico_familiar_cancer_pele: false,
    quem_historico_familiar: "",
    melanoma_familiar: false,
    outras_doencas_familia: [],
  },
  saude: {
    alergias: false,
    tipos_alergia: [],
    descricao_alergia: "",
    medicamentos_uso_continuo: false,
    lista_medicamentos: "",
    comorbidades: [],
    tabagismo: "nunca",
    etilismo: "nunca",
    atividade_fisica: "nenhuma",
    gestante: null,
    amamentando: null,
    uso_anticoncepcional: null,
  },
  estetica: {
    procedimentos_anteriores: [],
    tempo_ultimo_procedimento: "",
    teve_complicacao: false,
    descricao_complicacao: "",
    usa_acidos: false,
    produtos_skincare: "",
    tratamento_em_andamento: false,
  },
  seguranca: {
    historico_herpes_simples: false,
    tendencia_queloide: false,
    possui_marcapasso_ou_implante_metalico: false,
    quimica_capilar_recente: false,
    alergia_anestesico: false,
    usa_anticoagulante: false,
  },
  consentimento: {
    aceite_informacoes_verdadeiras: false,
    autoriza_imagens_prontuario: false,
    autoriza_imagens_cientificas: false,
    aceite_lgpd: false,
    nome_assinatura: "",
  },
};

function Alterna({
  rotulo,
  valor,
  onMudar,
}: {
  rotulo: string;
  valor: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-col gap-2">
      <span className="text-base font-semibold">{rotulo}</span>
      <div className="grid grid-cols-2 gap-ds-3">
        <button
          type="button"
          role="radio"
          aria-checked={valor}
          onClick={() => onMudar(true)}
          className={`chip justify-center text-center ${valor ? "chip-on" : "chip-off"}`}
        >
          Sim
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!valor}
          onClick={() => onMudar(false)}
          className={`chip justify-center text-center ${!valor ? "chip-on" : "chip-off"}`}
        >
          Não
        </button>
      </div>
    </div>
  );
}

function MultiSelect({
  rotulo,
  opcoes,
  valores,
  onMudar,
}: {
  rotulo: string;
  opcoes: { valor: string; texto: string }[];
  valores: string[];
  onMudar: (v: string[]) => void;
}) {
  function alternar(v: string) {
    onMudar(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold">{rotulo}</span>
      <div className="flex flex-wrap gap-ds-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="checkbox"
            aria-checked={valores.includes(o.valor)}
            onClick={() => alternar(o.valor)}
            className={`chip ${valores.includes(o.valor) ? "chip-on" : "chip-off"}`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Selecao<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: { valor: T; texto: string }[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-base font-semibold">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => onMudar(e.target.value as T)}
        className="input-sunken min-h-[52px]"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Agrupa campos curtos lado a lado no tablet/desktop (empilha no celular). */
function Linha({ colunas = 2, children }: { colunas?: 2 | 3; children: ReactNode }) {
  return (
    <div className={`grid grid-cols-1 gap-ds-4 ${colunas === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {children}
    </div>
  );
}

/** Divide um painel longo em blocos de assunto. */
function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-2 text-sm font-bold uppercase tracking-wide text-muted first:mt-0">
      {children}
    </h3>
  );
}

const FOTOTIPOS = [
  { valor: 1, numeral: "I", texto: "Sempre queima, nunca bronzeia" },
  { valor: 2, numeral: "II", texto: "Queima fácil, bronzeia pouco" },
  { valor: 3, numeral: "III", texto: "Queima moderado, bronzeia aos poucos" },
  { valor: 4, numeral: "IV", texto: "Queima pouco, bronzeia bem" },
  { valor: 5, numeral: "V", texto: "Raramente queima, bronzeia fácil" },
  { valor: 6, numeral: "VI", texto: "Nunca queima, pele muito escura" },
] as const;

function Fototipo({ valor, onMudar }: { valor: number; onMudar: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold">Fototipo de pele (Fitzpatrick)</span>
      <div className="grid grid-cols-2 gap-ds-2 md:grid-cols-3">
        {FOTOTIPOS.map((ft) => (
          <button
            key={ft.valor}
            type="button"
            role="radio"
            aria-checked={valor === ft.valor}
            onClick={() => onMudar(ft.valor)}
            className={`chip flex flex-col items-start gap-0.5 text-left ${valor === ft.valor ? "chip-on" : "chip-off"}`}
          >
            <span className="font-bold">Tipo {ft.numeral}</span>
            <span className="text-sm font-normal opacity-85">{ft.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Texto({
  rotulo,
  valor,
  onMudar,
  area = false,
  obrigatorio = false,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  area?: boolean;
  obrigatorio?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-base font-semibold">
        {rotulo}
        {obrigatorio && " *"}
      </span>
      {area ? (
        <textarea
          value={valor}
          rows={3}
          maxLength={2000}
          onChange={(e) => onMudar(e.target.value)}
          className="input-sunken"
        />
      ) : (
        <input
          value={valor}
          maxLength={500}
          autoComplete="off"
          onChange={(e) => onMudar(e.target.value)}
          className="input-sunken min-h-[52px]"
        />
      )}
    </label>
  );
}

const CATEGORIAS_QUEIXA = [
  { valor: "rotina", texto: "Rotina" },
  { valor: "nevos", texto: "Nevos (pintas)" },
  { valor: "acne", texto: "Acne" },
  { valor: "manchas", texto: "Manchas" },
  { valor: "queda_cabelo", texto: "Queda de cabelo" },
  { valor: "unhas", texto: "Unhas" },
  { valor: "coceira", texto: "Coceira" },
  { valor: "estetica", texto: "Estética" },
  { valor: "outro", texto: "Outro" },
];

const TIPOS_ALERGIA = [
  { valor: "medicamentos", texto: "Medicamentos" },
  { valor: "cosmeticos", texto: "Cosméticos" },
  { valor: "latex", texto: "Látex" },
  { valor: "niquel", texto: "Níquel" },
  { valor: "alimentos", texto: "Alimentos" },
];

const COMORBIDADES = [
  { valor: "diabetes", texto: "Diabetes" },
  { valor: "hipertensao", texto: "Hipertensão" },
  { valor: "tireoide", texto: "Tireoide" },
  { valor: "autoimunes", texto: "Doenças autoimunes" },
  { valor: "cancer", texto: "Câncer" },
  { valor: "outras", texto: "Outras" },
];

const PROCEDIMENTOS = [
  { valor: "toxina", texto: "Toxina botulínica" },
  { valor: "preenchimento", texto: "Preenchimento" },
  { valor: "bioestimulador", texto: "Bioestimulador" },
  { valor: "peeling", texto: "Peeling" },
  { valor: "laser", texto: "Laser" },
  { valor: "microagulhamento", texto: "Microagulhamento" },
  { valor: "fios", texto: "Fios" },
  { valor: "outros", texto: "Outros" },
];

/** Ficha pré-consulta (Dermatologia): preenchida pelo paciente no tablet, com acompanhamento. */
export default function PreConsultaPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [etapa, setEtapa] = useState(1);
  const [identificacao, setIdentificacao] = useState<FichaPaciente | null>(null);
  const [erroCadastro, setErroCadastro] = useState(false);
  const [f, setF] = useState<PreConsultaDermatologiaIn>(VAZIA);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  // Identificação já carregada do cadastro: o médico só acrescenta o que faltar.
  useEffect(() => {
    obterPaciente(id)
      .then((p) => setIdentificacao(fichaDoCadastro(p)))
      .catch(() => setErroCadastro(true));
  }, [id]);

  const mudar = <K extends keyof PreConsultaDermatologiaIn>(
    bloco: K,
    valores: Partial<PreConsultaDermatologiaIn[K]>,
  ) => setF((a) => ({ ...a, [bloco]: { ...a[bloco], ...valores } }));

  async function enviar() {
    if (!identificacao) return;
    setErro(null);
    setEnviando(true);
    try {
      await corrigirPaciente(id, identificacao);
      await enviarPreConsulta(id, f);
      setEnviado(true);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível enviar a ficha agora. Os dados preenchidos continuam aqui: tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (erroCadastro) {
    return (
      <TelaSimples titulo="PRÉ-CONSULTA">
        <Panel>
          <p role="alert" className="text-base font-semibold">
            ⚠️ Não foi possível abrir o cadastro do paciente agora. Tente de novo.
          </p>
        </Panel>
      </TelaSimples>
    );
  }

  if (enviado) {
    return (
      <TelaSimples titulo="PRÉ-CONSULTA">
        <Panel className="flex flex-col gap-ds-4">
          <p className="text-2xl font-bold">✅ Ficha enviada</p>
          <p className="text-lg text-muted">
            Obrigado! As respostas já estão disponíveis para o médico no prontuário.
          </p>
          <BigButton onClick={() => router.push(`/pacientes/${id}`)}>VOLTAR AO PRONTUÁRIO</BigButton>
        </Panel>
      </TelaSimples>
    );
  }

  if (!identificacao) {
    return (
      <TelaSimples titulo="PRÉ-CONSULTA (DERMATOLOGIA)">
        <p role="status" className="text-base text-muted">
          Carregando o cadastro do paciente…
        </p>
      </TelaSimples>
    );
  }

  return (
    <TelaSimples titulo="PRÉ-CONSULTA (DERMATOLOGIA)">
      <ProgressDots total={TOTAL_ETAPAS} atual={etapa} />

      {etapa === 1 && (
        <Panel className="flex flex-col gap-ds-3">
          <h2 className="text-xl font-bold tracking-wide">IDENTIFICAÇÃO</h2>
          <p className="text-base text-muted">
            Já carregado do cadastro. Acrescente ou corrija o que for preciso.
          </p>
          <FormularioPaciente
            inicial={identificacao}
            abrirTudo
            rotuloSalvar="CONTINUAR"
            onSalvar={async (ficha) => {
              setIdentificacao(ficha);
              setEtapa(2);
            }}
            onCancelar={() => router.back()}
          />
        </Panel>
      )}

      {etapa === 2 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">QUEIXA PRINCIPAL</h2>
          <Texto
            rotulo="O que trouxe você à consulta?"
            area
            obrigatorio
            valor={f.queixa.queixa_principal}
            onMudar={(v) => mudar("queixa", { queixa_principal: v })}
          />
          <Selecao
            rotulo="Há quanto tempo?"
            valor={f.queixa.duracao_queixa}
            onMudar={(v) => mudar("queixa", { duracao_queixa: v })}
            opcoes={[
              { valor: "dias", texto: "Dias" },
              { valor: "semanas", texto: "Semanas" },
              { valor: "meses", texto: "Meses" },
              { valor: "anos", texto: "Anos" },
            ]}
          />
          <MultiSelect
            rotulo="Categoria da queixa"
            opcoes={CATEGORIAS_QUEIXA}
            valores={f.queixa.categorias}
            onMudar={(v) => mudar("queixa", { categorias: v })}
          />
          <Alterna
            rotulo="Já tratou isso antes?"
            valor={f.queixa.ja_tratou_antes}
            onMudar={(v) => mudar("queixa", { ja_tratou_antes: v })}
          />
          {f.queixa.ja_tratou_antes && (
            <Texto
              rotulo="Como foi o tratamento anterior?"
              area
              valor={f.queixa.tratamento_anterior}
              onMudar={(v) => mudar("queixa", { tratamento_anterior: v })}
            />
          )}
        </Panel>
      )}

      {etapa === 3 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">HISTÓRICO DERMATOLÓGICO</h2>

          <Subtitulo>Exposição ao sol</Subtitulo>
          <Linha>
            <Alterna
              rotulo="Exposição solar frequente?"
              valor={f.historico.exposicao_solar}
              onMudar={(v) => mudar("historico", { exposicao_solar: v })}
            />
            <Selecao
              rotulo="Uso de protetor solar"
              valor={f.historico.frequencia_protetor_solar}
              onMudar={(v) => mudar("historico", { frequencia_protetor_solar: v })}
              opcoes={[
                { valor: "nunca", texto: "Nunca" },
                { valor: "as_vezes", texto: "Às vezes" },
                { valor: "todo_dia", texto: "Todo dia" },
              ]}
            />
          </Linha>
          {f.historico.exposicao_solar && (
            <Selecao
              rotulo="Tipo de exposição"
              valor={f.historico.tipo_exposicao ?? "lazer"}
              onMudar={(v) => mudar("historico", { tipo_exposicao: v })}
              opcoes={[
                { valor: "trabalho", texto: "Trabalho" },
                { valor: "lazer", texto: "Lazer" },
                { valor: "ambos", texto: "Ambos" },
              ]}
            />
          )}
          <Linha>
            <Alterna
              rotulo="Queimadura solar na infância?"
              valor={f.historico.queimadura_solar_infancia}
              onMudar={(v) => mudar("historico", { queimadura_solar_infancia: v })}
            />
            <Alterna
              rotulo="Já usou câmara de bronzeamento?"
              valor={f.historico.uso_camara_bronzeamento}
              onMudar={(v) => mudar("historico", { uso_camara_bronzeamento: v })}
            />
          </Linha>
          <Fototipo
            valor={f.historico.fototipo_fitzpatrick}
            onMudar={(v) => mudar("historico", { fototipo_fitzpatrick: v })}
          />

          <Subtitulo>Histórico familiar</Subtitulo>
          <Linha>
            <Alterna
              rotulo="Câncer de pele na família?"
              valor={f.historico.historico_familiar_cancer_pele}
              onMudar={(v) => mudar("historico", { historico_familiar_cancer_pele: v })}
            />
            <Alterna
              rotulo="Melanoma na família?"
              valor={f.historico.melanoma_familiar}
              onMudar={(v) => mudar("historico", { melanoma_familiar: v })}
            />
          </Linha>
          {f.historico.historico_familiar_cancer_pele && (
            <Texto
              rotulo="Quem na família?"
              valor={f.historico.quem_historico_familiar}
              onMudar={(v) => mudar("historico", { quem_historico_familiar: v })}
            />
          )}
        </Panel>
      )}

      {etapa === 4 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">SAÚDE GERAL E MEDICAÇÕES</h2>

          <Subtitulo>Alergias e medicação</Subtitulo>
          <Linha>
            <Alterna
              rotulo="Tem alguma alergia?"
              valor={f.saude.alergias}
              onMudar={(v) => mudar("saude", { alergias: v })}
            />
            <Alterna
              rotulo="Usa medicamento contínuo?"
              valor={f.saude.medicamentos_uso_continuo}
              onMudar={(v) => mudar("saude", { medicamentos_uso_continuo: v })}
            />
          </Linha>
          {f.saude.alergias && (
            <>
              <MultiSelect
                rotulo="Tipo de alergia"
                opcoes={TIPOS_ALERGIA}
                valores={f.saude.tipos_alergia}
                onMudar={(v) => mudar("saude", { tipos_alergia: v })}
              />
              <Texto
                rotulo="Descreva a alergia"
                area
                valor={f.saude.descricao_alergia}
                onMudar={(v) => mudar("saude", { descricao_alergia: v })}
              />
            </>
          )}
          {f.saude.medicamentos_uso_continuo && (
            <Texto
              rotulo="Quais medicamentos?"
              area
              valor={f.saude.lista_medicamentos}
              onMudar={(v) => mudar("saude", { lista_medicamentos: v })}
            />
          )}

          <Subtitulo>Comorbidades e hábitos</Subtitulo>
          <MultiSelect
            rotulo="Comorbidades"
            opcoes={COMORBIDADES}
            valores={f.saude.comorbidades}
            onMudar={(v) => mudar("saude", { comorbidades: v })}
          />
          <Linha colunas={3}>
            <Selecao
              rotulo="Tabagismo"
              valor={f.saude.tabagismo}
              onMudar={(v) => mudar("saude", { tabagismo: v })}
              opcoes={[
                { valor: "nunca", texto: "Nunca fumou" },
                { valor: "ex_fumante", texto: "Ex-fumante" },
                { valor: "fumante", texto: "Fumante" },
              ]}
            />
            <Selecao
              rotulo="Etilismo"
              valor={f.saude.etilismo}
              onMudar={(v) => mudar("saude", { etilismo: v })}
              opcoes={[
                { valor: "nunca", texto: "Nunca" },
                { valor: "social", texto: "Social" },
                { valor: "frequente", texto: "Frequente" },
              ]}
            />
            <Selecao
              rotulo="Atividade física"
              valor={f.saude.atividade_fisica}
              onMudar={(v) => mudar("saude", { atividade_fisica: v })}
              opcoes={[
                { valor: "nenhuma", texto: "Nenhuma" },
                { valor: "leve", texto: "Leve" },
                { valor: "moderada", texto: "Moderada" },
                { valor: "intensa", texto: "Intensa" },
              ]}
            />
          </Linha>

          <Subtitulo>Saúde da mulher (opcional)</Subtitulo>
          <Linha colunas={3}>
            <Alterna
              rotulo="Gestante?"
              valor={f.saude.gestante ?? false}
              onMudar={(v) => mudar("saude", { gestante: v })}
            />
            <Alterna
              rotulo="Amamentando?"
              valor={f.saude.amamentando ?? false}
              onMudar={(v) => mudar("saude", { amamentando: v })}
            />
            <Alterna
              rotulo="Usa anticoncepcional?"
              valor={f.saude.uso_anticoncepcional ?? false}
              onMudar={(v) => mudar("saude", { uso_anticoncepcional: v })}
            />
          </Linha>
        </Panel>
      )}

      {etapa === 5 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">ESTÉTICA E PROCEDIMENTOS</h2>
          <MultiSelect
            rotulo="Procedimentos estéticos anteriores"
            opcoes={PROCEDIMENTOS}
            valores={f.estetica.procedimentos_anteriores}
            onMudar={(v) => mudar("estetica", { procedimentos_anteriores: v })}
          />
          {f.estetica.procedimentos_anteriores.length > 0 && (
            <Texto
              rotulo="Há quanto tempo foi o último?"
              valor={f.estetica.tempo_ultimo_procedimento}
              onMudar={(v) => mudar("estetica", { tempo_ultimo_procedimento: v })}
            />
          )}
          <Alterna
            rotulo="Já teve alguma complicação com procedimento estético?"
            valor={f.estetica.teve_complicacao}
            onMudar={(v) => mudar("estetica", { teve_complicacao: v })}
          />
          {f.estetica.teve_complicacao && (
            <Texto
              rotulo="Descreva a complicação"
              area
              valor={f.estetica.descricao_complicacao}
              onMudar={(v) => mudar("estetica", { descricao_complicacao: v })}
            />
          )}
          <Linha>
            <Alterna
              rotulo="Usa ácidos na pele (esfoliantes, clareadores)?"
              valor={f.estetica.usa_acidos}
              onMudar={(v) => mudar("estetica", { usa_acidos: v })}
            />
            <Alterna
              rotulo="Está em tratamento estético no momento?"
              valor={f.estetica.tratamento_em_andamento}
              onMudar={(v) => mudar("estetica", { tratamento_em_andamento: v })}
            />
          </Linha>
          <Texto
            rotulo="Produtos de skincare que usa (opcional)"
            area
            valor={f.estetica.produtos_skincare}
            onMudar={(v) => mudar("estetica", { produtos_skincare: v })}
          />
        </Panel>
      )}

      {etapa === 6 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">SEGURANÇA CLÍNICA</h2>

          <div className="rounded-xl border-2 border-red-700/40 bg-sunken p-ds-4">
            <p className="mb-ds-3 text-base font-semibold">
              ⚠️ Estas três respostas geram um alerta para o médico antes de qualquer procedimento.
            </p>
            <Linha>
              <Alterna
                rotulo="Já teve herpes simples (labial ou genital)?"
                valor={f.seguranca.historico_herpes_simples}
                onMudar={(v) => mudar("seguranca", { historico_herpes_simples: v })}
              />
              <Alterna
                rotulo="Tendência a formar queloide (cicatriz elevada)?"
                valor={f.seguranca.tendencia_queloide}
                onMudar={(v) => mudar("seguranca", { tendencia_queloide: v })}
              />
            </Linha>
            <div className="mt-ds-4">
              <Alterna
                rotulo="Possui marcapasso ou implante metálico?"
                valor={f.seguranca.possui_marcapasso_ou_implante_metalico}
                onMudar={(v) => mudar("seguranca", { possui_marcapasso_ou_implante_metalico: v })}
              />
            </div>
          </div>

          <Subtitulo>Outros fatores de segurança</Subtitulo>
          <Linha>
            <Alterna
              rotulo="Fez química capilar recentemente?"
              valor={f.seguranca.quimica_capilar_recente}
              onMudar={(v) => mudar("seguranca", { quimica_capilar_recente: v })}
            />
            <Alterna
              rotulo="Tem alergia a anestésico?"
              valor={f.seguranca.alergia_anestesico}
              onMudar={(v) => mudar("seguranca", { alergia_anestesico: v })}
            />
          </Linha>
          <Alterna
            rotulo="Usa anticoagulante?"
            valor={f.seguranca.usa_anticoagulante}
            onMudar={(v) => mudar("seguranca", { usa_anticoagulante: v })}
          />
        </Panel>
      )}

      {etapa === 7 && (
        <Panel className="flex flex-col gap-ds-4">
          <h2 className="text-xl font-bold tracking-wide">CONSENTIMENTO</h2>
          <Alterna
            rotulo="Declaro que as informações acima são verdadeiras *"
            valor={f.consentimento.aceite_informacoes_verdadeiras}
            onMudar={(v) => mudar("consentimento", { aceite_informacoes_verdadeiras: v })}
          />
          <Linha>
            <Alterna
              rotulo="Autorizo imagens no meu prontuário"
              valor={f.consentimento.autoriza_imagens_prontuario}
              onMudar={(v) => mudar("consentimento", { autoriza_imagens_prontuario: v })}
            />
            <Alterna
              rotulo="Autorizo imagens para fins científicos (opcional)"
              valor={f.consentimento.autoriza_imagens_cientificas}
              onMudar={(v) => mudar("consentimento", { autoriza_imagens_cientificas: v })}
            />
          </Linha>
          <Alterna
            rotulo="Li e aceito os termos de privacidade (LGPD) *"
            valor={f.consentimento.aceite_lgpd}
            onMudar={(v) => mudar("consentimento", { aceite_lgpd: v })}
          />
          <Texto
            rotulo="Nome completo (assinatura digital)"
            obrigatorio
            valor={f.consentimento.nome_assinatura}
            onMudar={(v) => mudar("consentimento", { nome_assinatura: v })}
          />
        </Panel>
      )}

      {erro && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
          ⚠️ {erro}
        </p>
      )}

      {etapa > 1 && (
        <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
          <BigButton variant="secondary" onClick={() => setEtapa((e) => e - 1)}>
            VOLTAR
          </BigButton>
          {etapa < TOTAL_ETAPAS ? (
            <BigButton
              onClick={() => setEtapa((e) => e + 1)}
              disabled={etapa === 2 && !f.queixa.queixa_principal.trim()}
            >
              CONTINUAR
            </BigButton>
          ) : (
            <BigButton
              disabled={
                enviando ||
                !f.consentimento.aceite_informacoes_verdadeiras ||
                !f.consentimento.aceite_lgpd ||
                !f.consentimento.nome_assinatura.trim()
              }
              onClick={enviar}
            >
              {enviando ? "ENVIANDO…" : "ENVIAR FICHA"}
            </BigButton>
          )}
        </div>
      )}
    </TelaSimples>
  );
}
