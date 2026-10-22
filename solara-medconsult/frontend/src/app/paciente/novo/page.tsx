"use client";

import { useRouter } from "next/navigation";

import { ConsultaEmAndamento } from "@/components/ConsultaEmAndamento";
import { FormularioPaciente } from "@/components/FormularioPaciente";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import { useComecarConsulta } from "@/hooks/useComecarConsulta";
import { FICHA_VAZIA, cadastrarPaciente } from "@/lib/api";

/** Novo paciente: cadastro completo e, ao salvar, já começa a Consulta 1. */
export default function NovoPacientePage() {
  const router = useRouter();
  const { hidratado, modo, emAndamento, comecar } = useComecarConsulta();

  if (hidratado && emAndamento) {
    return (
      <TelaSimples titulo="NOVO PACIENTE">
        <ConsultaEmAndamento />
      </TelaSimples>
    );
  }

  return (
    <TelaSimples titulo="NOVO PACIENTE">
      <p className="text-base text-muted">
        Modo: {modo === "online" ? "ONLINE" : modo === "presencial" ? "PRESENCIAL" : "—"}
      </p>
      <Panel>
        <FormularioPaciente
          inicial={FICHA_VAZIA}
          abrirTudo
          rotuloSalvar="SALVAR E INICIAR CONSULTA"
          onSalvar={async (ficha) => {
            const p = await cadastrarPaciente(ficha);
            comecar({ id: p.id, nome: p.nome }, "nova", null);
          }}
          onCancelar={() => router.back()}
        />
      </Panel>
    </TelaSimples>
  );
}
