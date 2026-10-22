"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BigButton } from "@/components/BigButton";
import { CampoTextoGerado } from "@/components/CampoTextoGerado";
import { ConsultaAnterior } from "@/components/ConsultaAnterior";
import { FonteSeletor } from "@/components/FonteSeletor";
import { Tela } from "@/components/Tela";
import { useEtapa } from "@/hooks/useEtapa";
import { gerarOrientacoesTexto, gerarTratamento } from "@/lib/api";
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
    <Tela etapa={8} titulo="TRATAMENTO / ORIENTAÇÕES">
      <ConsultaAnterior />
      {!temDiagnostico && (
        <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base text-muted">
          Nenhum diagnóstico foi escolhido na etapa 5. Volte e escolha um, ou escreva os textos
          abaixo à mão.
        </p>
      )}
      <FonteSeletor fontes={fontes} onFontesChange={setFontes} colado={colado} onColadoChange={setColado} />
      <CampoTextoGerado
        titulo="Tratamento"
        rotuloGerar="✨ GERAR TRATAMENTO COM IA"
        semBase="Escolha um diagnóstico e uma fonte, ou escreva o tratamento aqui."
        disponivel={disponivel}
        salvo={condutaTratamento.tratamento}
        gerar={() => gerarTratamento(diagnosticoTexto, fontes, colado)}
        salvar={(texto, editado) => setCondutaTratamento("tratamento", texto, editado)}
      />
      <CampoTextoGerado
        titulo="Orientações gerais"
        rotuloGerar="✨ GERAR ORIENTAÇÕES COM IA"
        semBase="Escolha um diagnóstico e uma fonte, ou escreva as orientações aqui."
        disponivel={disponivel}
        salvo={condutaTratamento.orientacoes}
        gerar={() => gerarOrientacoesTexto(diagnosticoTexto, fontes, colado)}
        salvar={(texto, editado) => setCondutaTratamento("orientacoes", texto, editado)}
      />
      <BigButton
        onClick={() => {
          setEtapa(9);
          router.push("/prontuario");
        }}
      >
        CONCLUIR TRATAMENTO / ORIENTAÇÕES
      </BigButton>
    </Tela>
  );
}

export default function TratamentoPage() {
  const pronto = useEtapa(8);
  return pronto ? <Conteudo /> : null;
}
