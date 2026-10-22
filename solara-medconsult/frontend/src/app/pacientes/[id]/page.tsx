"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AlertaSeguranca } from "@/components/AlertaSeguranca";
import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { FormularioPaciente } from "@/components/FormularioPaciente";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import {
  FICHA_VAZIA,
  corrigirPaciente,
  listarPreConsultas,
  listarReceitas,
  obterProntuarioDoPaciente,
  urlLaudo,
  urlPdfProntuario,
  urlPdfReceita,
  type FichaPaciente,
  type PacienteDetalhe,
  type PreConsultaApi,
  type ProntuarioDoPaciente,
  type ReceitaApi,
} from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { formatarCpf, idadeEmAnos } from "@/lib/pacientes";
import { compartilharPdf, criarPdfProntuario } from "@/lib/pdf";
import { textoDoHistorico } from "@/lib/prontuario";

/** Prontuário completo do paciente: dados no topo e os registros do mais antigo ao mais recente. */
export default function ProntuarioDoPacientePage() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<ProntuarioDoPaciente | null>(null);
  const [erro, setErro] = useState(false);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [receitas, setReceitas] = useState<ReceitaApi[]>([]);
  const [preConsultas, setPreConsultas] = useState<PreConsultaApi[]>([]);

  const carregar = () =>
    obterProntuarioDoPaciente(id)
      .then(setDados)
      .catch(() => setErro(true));

  useEffect(() => {
    listarReceitas(id)
      .then(setReceitas)
      .catch(() => setReceitas([]));
    listarPreConsultas(id)
      .then(setPreConsultas)
      .catch(() => setPreConsultas([]));
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function corrigir(ficha: FichaPaciente) {
    await corrigirPaciente(id, ficha);
    await carregar();
    setEditando(false);
  }

  async function exportar() {
    if (!dados) return;
    try {
      const arquivo = await criarPdfProntuario({
        texto: textoDoHistorico(dados.registros),
        paciente: dados.paciente.nome,
        nascimento: dados.paciente.nascimento,
        geradoEm: new Date(),
      });
      await compartilharPdf(arquivo.blob, arquivo.nome);
    } catch {
      setAviso("Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  const p = dados?.paciente ?? null;
  const registros = dados?.registros ?? [];
  const idade = p ? idadeEmAnos(p.nascimento) : null;

  return (
    <TelaSimples titulo={p ? p.nome : "PRONTUÁRIO"}>
      {erro && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
          ⚠️ Paciente não encontrado ou servidor indisponível.
        </p>
      )}
      {p && (
        <>
          <p className="text-base text-muted">
            {idade !== null ? `${idade} anos` : "Idade não informada"} ·{" "}
            {registros.length === 0 ? "sem registros" : `${registros.length} registro(s)`}
          </p>
          <AlertaSeguranca preConsulta={preConsultas[0] ?? null} />
          <DadosDoPaciente p={p} editando={editando} onEditar={() => setEditando(true)} />

          <Link
            href={`/pacientes/${id}/pre-consulta`}
            className="btn btn-secondary w-full touch inline-flex min-h-[56px] items-center justify-center rounded-xl px-ds-5 text-center font-bold"
          >
            PRÉ-CONSULTA
          </Link>
          {editando && (
            <Panel>
              <FormularioPaciente
                inicial={fichaDe(p)}
                rotuloSalvar="SALVAR CORREÇÃO"
                onSalvar={corrigir}
                onCancelar={() => setEditando(false)}
              />
            </Panel>
          )}

          <Link
            href={`/pacientes/${id}/receita`}
            className="btn btn-secondary w-full touch inline-flex min-h-[56px] items-center justify-center rounded-xl px-ds-5 text-center font-bold"
          >
            NOVA RECEITA
          </Link>
          {receitas.length > 0 && (
            <Panel className="flex flex-col gap-ds-3">
              <h2 className="text-xl font-bold tracking-wide">RECEITAS EMITIDAS</h2>
              <ul className="flex flex-col gap-2">
                {receitas.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {formatarData(r.criado_em)} · {r.itens.map((i) => i.medicamento).join(", ")}
                    </span>
                    <a
                      href={urlPdfReceita(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      Abrir PDF
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <h2 className="text-xl font-bold tracking-wide">HISTÓRICO (DO MAIS ANTIGO AO MAIS RECENTE)</h2>
          {registros.length === 0 ? (
            <Panel>
              <p className="text-lg text-muted">Nenhum registro ainda. Ao concluir uma consulta, ela aparece aqui.</p>
            </Panel>
          ) : (
            <>
              <BigButton onClick={exportar}>EXPORTAR PDF</BigButton>
              <ol className="flex flex-col gap-ds-4">
                {registros.map((r) => (
                  <li key={r.id}>
                    <Panel className="flex flex-col gap-ds-3">
                      <div className="flex flex-col">
                        <h3 className="text-2xl font-bold">{r.rotulo}</h3>
                        <p className="text-base text-muted">
                          {formatarData(r.criado_em)}
                          {r.modo ? ` · ${r.modo}` : ""}
                          {r.corrigido_em ? ` · corrigido em ${formatarData(r.corrigido_em)}` : ""}
                        </p>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed">{r.texto}</pre>
                      {(r.laudos ?? []).length > 0 && (
                        <ul className="flex flex-col gap-1">
                          {(r.laudos ?? []).map((l) => (
                            <li key={l.id}>
                              📎{" "}
                              <a href={urlLaudo(l.id)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                                {l.nome}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
                        <BigButton
                          variant="secondary"
                          onClick={() => window.open(urlPdfProntuario(r.id), "_blank", "noopener")}
                        >
                          ABRIR PDF
                        </BigButton>
                        <Link
                          href={`/prontuarios/${r.id}?editar=1`}
                          className="btn btn-secondary w-full touch inline-flex min-h-[56px] items-center justify-center rounded-xl px-ds-5 text-center font-bold"
                        >
                          EDITAR (CORRIGIR ERROS)
                        </Link>
                      </div>
                    </Panel>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </TelaSimples>
  );
}

function fichaDe(p: PacienteDetalhe): FichaPaciente {
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

const ROTULOS_DADOS: [keyof PacienteDetalhe, string][] = [
  ["cpf", "CPF"],
  ["sexo", "Sexo"],
  ["contato", "Contato"],
  ["profissao", "Profissão"],
  ["moradia", "Moradia"],
  ["plano_saude", "Plano de saúde"],
  ["alergias", "Alergias"],
  ["medicacoes_uso", "Medicações em uso"],
  ["historico_familiar", "Histórico familiar"],
];

/** Dados do cadastro (mostrar/ocultar) e o botão de corrigir. */
function DadosDoPaciente({ p, editando, onEditar }: { p: PacienteDetalhe; editando: boolean; onEditar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const linhas = ROTULOS_DADOS.filter(([campo]) => p[campo]);
  return (
    <Panel className="flex flex-col gap-ds-3">
      <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
        <BigButton variant="secondary" onClick={() => setAberto((a) => !a)}>
          {aberto ? "OCULTAR DADOS DO PACIENTE" : "MOSTRAR DADOS DO PACIENTE"}
        </BigButton>
        {!editando && (
          <BigButton variant="secondary" onClick={onEditar}>
            CORRIGIR CADASTRO
          </BigButton>
        )}
      </div>
      {aberto &&
        (linhas.length === 0 ? (
          <p className="text-base text-muted">Nenhum dado além do nome e do nascimento.</p>
        ) : (
          <dl className="flex flex-col gap-ds-3">
            {linhas.map(([campo, rotulo]) => (
              <div key={campo}>
                <dt className="text-sm font-semibold text-muted">{rotulo}</dt>
                <dd className="whitespace-pre-wrap text-lg">
                  {campo === "cpf" ? formatarCpf(String(p[campo])) : String(p[campo])}
                </dd>
              </div>
            ))}
          </dl>
        ))}
    </Panel>
  );
}
