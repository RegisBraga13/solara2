"use client";

import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { ApiError, type FichaPaciente } from "@/lib/api";
import { formatarCpf } from "@/lib/pacientes";

interface FormularioPacienteProps {
  inicial: FichaPaciente;
  rotuloSalvar: string;
  /** Já abre com todos os campos (cadastro completo). */
  abrirTudo?: boolean;
  onSalvar: (ficha: FichaPaciente) => Promise<void>;
  onCancelar: () => void;
}

const CAMPOS_CURTOS: { campo: keyof FichaPaciente; rotulo: string }[] = [
  { campo: "sexo", rotulo: "Sexo" },
  { campo: "contato", rotulo: "Contato (telefone ou e-mail)" },
  { campo: "profissao", rotulo: "Profissão" },
  { campo: "moradia", rotulo: "Moradia (cidade e bairro)" },
  { campo: "plano_saude", rotulo: "Plano de saúde" },
];

const CAMPOS_LONGOS: { campo: keyof FichaPaciente; rotulo: string }[] = [
  { campo: "historico_familiar", rotulo: "Histórico familiar" },
  { campo: "medicacoes_uso", rotulo: "Medicações em uso" },
  { campo: "alergias", rotulo: "Alergias" },
];

/** Cadastro do paciente (só o nome é obrigatório). Os dados ficam no banco local e não vão à IA. */
export function FormularioPaciente({ inicial, rotuloSalvar, abrirTudo = false, onSalvar, onCancelar }: FormularioPacienteProps) {
  const [f, setF] = useState<FichaPaciente>(inicial);
  const [mais, setMais] = useState(() =>
    abrirTudo ||
    Object.entries(inicial).some(([campo, valor]) => campo !== "nome" && campo !== "nascimento" && valor),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (campo: keyof FichaPaciente) => (valor: string) => setF((a) => ({ ...a, [campo]: valor }));

  async function salvar() {
    setMsg(null);
    if (f.nome.trim().length < 2) {
      setMsg("Digite o nome do paciente.");
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(f);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setMsg(e.message);
      else if (e instanceof ApiError && e.status === 422) setMsg("Confira os dados (o CPF precisa ser válido).");
      else setMsg("Não foi possível salvar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-ds-3">
      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold">Nome completo</span>
        <input
          value={f.nome}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => mudar("nome")(e.target.value)}
          className="input-sunken min-h-[52px]"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold">Data de nascimento (opcional)</span>
        <input
          type="date"
          value={f.nascimento}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => mudar("nascimento")(e.target.value)}
          className="input-sunken min-h-[52px]"
        />
      </label>

      {!mais && (
        <BigButton variant="secondary" onClick={() => setMais(true)}>
          + MAIS DADOS (OPCIONAL)
        </BigButton>
      )}
      {mais && (
        <>
          <p className="text-sm text-muted">
            Tudo opcional. Estes dados ficam só no seu servidor e não são enviados à IA.
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">CPF</span>
            <input
              inputMode="numeric"
              value={f.cpf}
              maxLength={14}
              autoComplete="off"
              placeholder="000.000.000-00"
              onChange={(e) => mudar("cpf")(formatarCpf(e.target.value))}
              className="input-sunken min-h-[52px]"
            />
          </label>
          {CAMPOS_CURTOS.map(({ campo, rotulo }) => (
            <label key={campo} className="flex flex-col gap-2">
              <span className="text-base font-semibold">{rotulo}</span>
              <input
                value={f[campo]}
                maxLength={200}
                autoComplete="off"
                onChange={(e) => mudar(campo)(e.target.value)}
                className="input-sunken min-h-[52px]"
              />
            </label>
          ))}
          {CAMPOS_LONGOS.map(({ campo, rotulo }) => (
            <label key={campo} className="flex flex-col gap-2">
              <span className="text-base font-semibold">{rotulo}</span>
              <textarea
                value={f[campo]}
                rows={3}
                maxLength={2000}
                onChange={(e) => mudar(campo)(e.target.value)}
                className="input-sunken"
              />
            </label>
          ))}
        </>
      )}

      {msg && (
        <p role="alert" className="text-base font-semibold">
          ⚠️ {msg}
        </p>
      )}
      <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
        <BigButton disabled={salvando} onClick={salvar}>
          {salvando ? "SALVANDO…" : rotuloSalvar}
        </BigButton>
        <BigButton variant="secondary" onClick={onCancelar}>
          CANCELAR
        </BigButton>
      </div>
    </div>
  );
}
