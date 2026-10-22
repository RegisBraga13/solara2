"use client";

import { ConsultaAnterior } from "@/components/ConsultaAnterior";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ApoioMedico } from "@/components/ApoioMedico";
import { SugestoesTela } from "@/components/SugestoesTela";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import { useSugestoes } from "@/hooks/useSugestoes";
import { sugerirDiagnosticos } from "@/lib/api";
import { registroBruto } from "@/lib/historia";
import { FONTES_DIAGNOSTICO, type ItemSugerido } from "@/lib/sugestoes";
import { useConsulta } from "@/store/consulta";

function Conteudo() {
  const router = useRouter();
  const historia = useConsulta((s) => s.historia.texto);
  const captura = useConsulta((s) => s.captura);
  const exameFisico = useConsulta((s) => s.exameFisico);
  const transcricoes = useConsulta((s) => s.transcricoes);
  const imagens = useConsulta((s) => s.imagens);
  const salvo = useConsulta((s) => s.sugestoes.diagnostico);
  const selecionados = useConsulta((s) => s.diagnostico.selecionados);
  const extras = useConsulta((s) => s.extras.diagnostico);
  const salvar = useConsulta((s) => s.setSugestoesDiagnostico);
  const toggle = useConsulta((s) => s.toggleDiagnostico);
  const addExtra = useConsulta((s) => s.addExtra);
  const setEtapa = useConsulta((s) => s.setEtapa);

  // O caso é a história salva; sem ela, o registro bruto da Captura (navegação livre entre etapas).
  const caso = useMemo(
    () => historia.trim() || registroBruto({ captura, exameFisico, transcricoes, imagens }),
    [historia, captura, exameFisico, transcricoes, imagens],
  );

  const { estado, gerar } = useSugestoes({
    chave: caso,
    salvo,
    buscar: (fontes, colado) => sugerirDiagnosticos(caso, fontes, colado),
    salvar: (r) => salvar(caso, r.nomes, r.probabilidades, r.cid11),
  });

  const itens: ItemSugerido[] = (salvo?.chave === caso ? salvo.itens : []).map((termo, i) => ({
    termo,
    percentual: salvo?.probabilidades?.[i],
  }));

  return (
    <Tela etapa={6} titulo="DIAGNÓSTICO">
      <ConsultaAnterior />
      <SugestoesTela
        itens={itens}
        extras={extras}
        selecionados={selecionados}
        fontesDisponiveis={FONTES_DIAGNOSTICO}
        estado={estado}
        semBase="Não há história nem registro da Captura para gerar sugestões. Volte à etapa 3 ou 4, ou acrescente o diagnóstico abaixo."
        onGerar={gerar}
        onToggle={toggle}
        onAdd={(t) => addExtra("diagnostico", t)}
        rotuloConcluir="CONCLUIR DIAGNÓSTICO"
        mensagemConfirmacao="Nenhum diagnóstico assinalado. Concluir mesmo assim?"
        apoio={<ApoioMedico tela="diagnostico" />}
        onConcluir={() => {
          setEtapa(7);
          router.push("/propedeutica");
        }}
      />
    </Tela>
  );
}

export default function DiagnosticoPage() {
  const pronto = useEtapa(6);
  return pronto ? <Conteudo /> : null;
}
