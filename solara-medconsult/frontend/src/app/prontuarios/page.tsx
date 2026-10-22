"use client";

import { useRouter } from "next/navigation";

import { SeletorPaciente } from "@/components/SeletorPaciente";
import { TelaSimples } from "@/components/TelaSimples";

/** Prontuário: busca o paciente e abre o histórico cronológico dele. */
export default function ProntuariosPage() {
  const router = useRouter();
  return (
    <TelaSimples titulo="PRONTUÁRIO">
      <p className="text-lg text-muted">Escolha o paciente para ver o histórico.</p>
      <SeletorPaciente permitirCadastro={false} onEscolher={(p) => router.push(`/pacientes/${p.id}`)} />
    </TelaSimples>
  );
}
