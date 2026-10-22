"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApoioMedico } from "@/components/ApoioMedico";
import { BigButton } from "@/components/BigButton";
import { CampoTextoGerado } from "@/components/CampoTextoGerado";
import { ConsultaAnterior } from "@/components/ConsultaAnterior";
import { EscalasClinicas } from "@/components/EscalasClinicas";
import { FonteSeletor } from "@/components/FonteSeletor";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import { gerarConduta, gerarInvestigacao } from "@/lib/api";
import { MAX_DIAGNOSTICOS, type Fonte } from "@/lib/sugestoes";
import { useConsulta } from "@/store/consulta";

function Conteudo() {
  const router = useRouter();
  const diagnosticos = useConsulta((s) => s.diagnostico.selecionados).slice(0, MAX_DIAGNOSTICOS);
  const condutaTratamento = useConsulta((s) => s.condutaTratamento);
  const setCondutaTratamento = useConsulta((s) => s.setCondutaTratamento);
  const setEtapa = useConsulta((s) => s.setEtapa);

  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [colado, setColado] = useState("");

  const diagnosticoTexto = diagnosticos.join("; ");
  const temDiagnostico = diagnosticoTexto.trim() !== "";
  const temFonte = fontes.length > 0 || colado.trim() !== "";
  const disponivel = temDiagnostico && temFonte;

  return (
    <Tela etapa={7} titulo="CONDUTA / PROPEDÊUTICA">
      <ConsultaAnterior />
      <EscalasClinicas />
      <ApoioMedico tela="propedeutica" />
      {!temDiagnostico && (
        <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base text-muted">
          Nenhum diagnóstico foi escolhido na etapa 5. Volte e escolha um, ou escreva os textos
          abaixo à mão.
        </p>
      )}
      <FonteSeletor fontes={fontes} onFontesChange={setFontes} colado={colado} onColadoChange={setColado} />
      <CampoTextoGerado
        titulo="Conduta"
        rotuloGerar="✨ GERAR CONDUTA COM IA"
        semBase="Escolha um diagnóstico e uma fonte, ou escreva a conduta aqui."
        disponivel={disponivel}
        salvo={condutaTratamento.conduta}
        gerar={() => gerarConduta(diagnosticoTexto, fontes, colado)}
        salvar={(texto, editado) => setCondutaTratamento("conduta", texto, editado)}
      />
      <CampoTextoGerado
        titulo="Propedêutica"
        rotuloGerar="✨ GERAR PROPEDÊUTICA COM IA"
        semBase="Escolha um diagnóstico e uma fonte, ou escreva a propedêutica aqui."
        disponivel={disponivel}
        salvo={condutaTratamento.investigacao}
        gerar={() => gerarInvestigacao(diagnosticoTexto, fontes, colado)}
        salvar={(texto, editado) => setCondutaTratamento("investigacao", texto, editado)}
      />
      <BigButton
        onClick={() => {
          setEtapa(8);
          router.push("/tratamento");
        }}
      >
        CONCLUIR CONDUTA / PROPEDÊUTICA
      </BigButton>
    </Tela>
  );
}

export default function PropedeuticaPage() {
  const pronto = useEtapa(7);
  return pronto ? <Conteudo /> : null;
}
