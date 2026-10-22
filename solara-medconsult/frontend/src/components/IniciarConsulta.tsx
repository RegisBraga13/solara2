"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { ConsultaEmAndamento } from "@/components/ConsultaEmAndamento";
import { Panel } from "@/components/Panel";
import { SeletorPaciente } from "@/components/SeletorPaciente";
import { TelaSimples } from "@/components/TelaSimples";
import { useComecarConsulta } from "@/hooks/useComecarConsulta";
import { obterPaciente, type Paciente, type PacienteDetalhe } from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { type TipoConsulta } from "@/store/consulta";

/** No retorno, depois de escolher o paciente: ver a evolução (continuar o atendimento) ou só o prontuário. */
type AcaoRetorno = "evolucao" | null;

/**
 * Início de uma consulta (o modo já veio de /modalidade): 1) escolhe o paciente; 2) no retorno, decide
 * entre Evolução e Ver Prontuário, e (se Evolução) a consulta anterior; 3) confirma e segue.
 */
export function IniciarConsulta({ tipo }: { tipo: TipoConsulta }) {
  const router = useRouter();
  const { hidratado, modo, emAndamento, comecar } = useComecarConsulta();
  const [paciente, setPaciente] = useState<PacienteDetalhe | null>(null);
  const [anterior, setAnterior] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [acao, setAcao] = useState<AcaoRetorno>(null);
  const retorno = tipo === "retorno";

  // Vindo da ficha do paciente (?paciente=...): já entra com ele escolhido.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paciente");
    if (id) escolher({ id } as Paciente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escolher(p: Paciente) {
    setErro(false);
    setAcao(null);
    obterPaciente(p.id)
      .then((d) => {
        setPaciente(d);
        setAnterior(d.consultas[0]?.id ?? null);
      })
      .catch(() => setErro(true));
  }

  function trocarPaciente() {
    setPaciente(null);
    setAcao(null);
  }

  const titulo = retorno ? "RETORNO" : "NOVA CONSULTA";

  if (hidratado && emAndamento) {
    return (
      <TelaSimples titulo={titulo}>
        <ConsultaEmAndamento />
      </TelaSimples>
    );
  }

  // "Consulta 2, 3, 4…": as consultas novas já salvas deste paciente + 1 (retorno não conta).
  const numero = paciente ? paciente.consultas.filter((c) => c.tipo === "nova").length + 1 : 1;
  // No retorno, só mostra "qual consulta" e "iniciar" depois de escolher EVOLUÇÃO (não Ver Prontuário).
  const mostrarEscolhaAcao = retorno && paciente && !acao;
  const mostrarEvolucao = !retorno || acao === "evolucao";

  return (
    <TelaSimples titulo={titulo}>
      {erro && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
          ⚠️ Não foi possível abrir o paciente agora. Tente de novo.
        </p>
      )}

      {!paciente ? (
        <>
          <p className="text-lg text-muted">
            {retorno ? "Escolha o paciente que está voltando." : "Escolha o paciente que será atendido."}
          </p>
          <SeletorPaciente apenasComConsulta={retorno} permitirCadastro={false} onEscolher={escolher} />
        </>
      ) : (
        <>
          <Panel className="flex flex-col gap-ds-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Paciente</p>
            <p className="text-2xl font-bold">{paciente.nome}</p>
            <button type="button" className="self-start text-base font-semibold underline" onClick={trocarPaciente}>
              Trocar paciente
            </button>
          </Panel>

          {mostrarEscolhaAcao && (
            <div className="grid grid-cols-1 gap-ds-4 md:grid-cols-2 md:gap-ds-5">
              <BigButton className="md:min-h-[120px]" onClick={() => setAcao("evolucao")}>
                EVOLUÇÃO / RETORNO
              </BigButton>
              <BigButton
                variant="secondary"
                className="md:min-h-[120px]"
                onClick={() => router.push(`/pacientes/${paciente.id}`)}
              >
                VER PRONTUÁRIO
              </BigButton>
            </div>
          )}

          {retorno && acao === "evolucao" && (
            <Panel className="flex flex-col gap-ds-3">
              <h2 className="text-xl font-bold">Retorno de qual consulta?</h2>
              {paciente.consultas.length === 0 ? (
                <p className="text-base text-muted">Este paciente ainda não tem consulta salva.</p>
              ) : (
                <ul className="flex flex-col gap-ds-2" role="radiogroup" aria-label="Consulta anterior">
                  {paciente.consultas.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={anterior === c.id}
                        onClick={() => setAnterior(c.id)}
                        className={`chip flex w-full items-center justify-between text-left ${anterior === c.id ? "chip-on" : "chip-off"}`}
                      >
                        <span>
                          {formatarData(c.criado_em)} · {c.modo || "consulta"}
                          {c.tipo === "retorno" ? " · retorno" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {!retorno && <p className="text-xl font-semibold">Consulta {numero}</p>}
          {mostrarEvolucao && (
            <>
              <p className="text-base text-muted">Modo: {modo === "online" ? "ONLINE" : "PRESENCIAL"}</p>
              <BigButton
                className="md:min-h-[120px] disabled:opacity-50"
                disabled={!hidratado || !modo || (retorno && !anterior)}
                onClick={() => comecar({ id: paciente.id, nome: paciente.nome }, tipo, retorno ? anterior : null)}
              >
                {retorno ? "INICIAR RETORNO" : "INICIAR CONSULTA"}
              </BigButton>
            </>
          )}
        </>
      )}
    </TelaSimples>
  );
}
