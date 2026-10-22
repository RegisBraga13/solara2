"use client";

import { useCallback, useEffect, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { FormularioPaciente } from "@/components/FormularioPaciente";
import { Panel } from "@/components/Panel";
import {
  FICHA_VAZIA,
  cadastrarPaciente,
  listarPacientes,
  type ListaPacientes,
  type Paciente,
} from "@/lib/api";
import { resumoDoPaciente } from "@/lib/pacientes";

interface SeletorPacienteProps {
  /** Só mostra quem já tem consulta salva (usado no retorno). */
  apenasComConsulta?: boolean;
  /** Permite cadastrar um paciente novo ali mesmo. */
  permitirCadastro?: boolean;
  onEscolher: (p: Paciente) => void;
}

/** Busca pelo nome e lista os pacientes; opcionalmente cadastra um novo. */
export function SeletorPaciente({ apenasComConsulta = false, permitirCadastro = true, onEscolher }: SeletorPacienteProps) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<ListaPacientes | null>(null);
  const [erro, setErro] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const carregar = useCallback(() => {
    setErro(false);
    listarPacientes(busca)
      .then(setLista)
      .catch(() => setErro(true));
  }, [busca]);

  useEffect(() => {
    const espera = setTimeout(carregar, 250); // não busca a cada letra
    return () => clearTimeout(espera);
  }, [carregar]);

  const visiveis = (lista ?? []).filter((p) => !apenasComConsulta || p.n_prontuarios > 0);

  return (
    <div className="flex flex-col gap-ds-4">
      <label className="flex flex-col gap-ds-3">
        <span className="text-lg font-bold">Buscar paciente pelo nome ou CPF</span>
        <input
          type="search"
          value={busca}
          maxLength={80}
          autoComplete="off"
          placeholder="Digite parte do nome ou CPF"
          onChange={(e) => setBusca(e.target.value)}
          className="skeu min-h-[56px] rounded-xl bg-sunken px-ds-5 text-xl shadow-sunken outline-none focus:ring-2 focus:ring-[var(--color-leather)]"
        />
      </label>

      {erro && (
        <div role="alert" className="flex flex-col gap-ds-3 rounded-xl bg-sunken p-ds-4">
          <p className="text-base font-semibold">⚠️ Não foi possível carregar os pacientes agora.</p>
          <BigButton variant="secondary" onClick={carregar}>
            TENTAR NOVAMENTE
          </BigButton>
        </div>
      )}
      {!erro && lista === null && (
        <p role="status" className="text-base text-muted">
          Carregando…
        </p>
      )}
      {lista !== null && visiveis.length === 0 && (
        <p className="text-base text-muted">
          {apenasComConsulta
            ? "Nenhum paciente com consulta salva encontrado. Retorno é para quem já teve consulta registrada."
            : "Nenhum paciente encontrado."}
        </p>
      )}
      {lista?.truncado && (
        <p role="note" className="text-base text-muted">
          Mostrando {lista.length} de {lista.total} pacientes. Digite o nome ou o CPF para encontrar os demais.
        </p>
      )}
      {visiveis.length > 0 && (
        <ul className="flex flex-col gap-ds-3">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onEscolher(p)}
                className="skeu touch flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-ds-5 py-ds-3 text-left shadow-raised"
              >
                <span className="flex flex-col">
                  <span className="text-xl font-semibold">{p.nome}</span>
                  <span className="text-base text-muted">{resumoDoPaciente(p)}</span>
                </span>
                <span aria-hidden="true" className="text-2xl text-muted">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {permitirCadastro && !cadastrando && (
        <BigButton variant="secondary" onClick={() => setCadastrando(true)}>
          + CADASTRAR PACIENTE NOVO
        </BigButton>
      )}
      {permitirCadastro && cadastrando && (
        <Panel className="flex flex-col gap-ds-3">
          <h2 className="text-xl font-bold">Novo paciente</h2>
          <FormularioPaciente
            inicial={{ ...FICHA_VAZIA, nome: busca.trim() }}
            rotuloSalvar="CADASTRAR E CONTINUAR"
            onSalvar={async (ficha) => onEscolher(await cadastrarPaciente(ficha))}
            onCancelar={() => setCadastrando(false)}
          />
        </Panel>
      )}
    </div>
  );
}
