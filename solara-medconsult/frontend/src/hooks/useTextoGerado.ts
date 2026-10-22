"use client";

import { useState } from "react";

interface Opcoes {
  salvo: { texto: string; editado: boolean };
  gerar: () => Promise<string>;
  salvar: (texto: string, editado: boolean) => void;
}

/**
 * Texto gerado por IA (conduta, tratamento, orientações…) que o médico pode editar livremente.
 * Nada é gerado sem o médico tocar em GERAR; o texto já preenchido só é substituído com
 * confirmação. Cada edição é salva imediatamente (sem botão "salvar" separado).
 */
export function useTextoGerado({ salvo, gerar, salvar }: Opcoes) {
  const [texto, setTexto] = useState(salvo.texto);
  const [editado, setEditado] = useState(salvo.editado);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function executar() {
    setConfirmando(false);
    setGerando(true);
    setErro(false);
    try {
      const gerado = await gerar();
      if (!gerado) throw new Error("vazio");
      setTexto(gerado);
      setEditado(true);
      salvar(gerado, true);
    } catch {
      setErro(true);
    } finally {
      setGerando(false);
    }
  }

  function mudar(valor: string) {
    setTexto(valor);
    setEditado(true);
    salvar(valor, true);
  }

  function solicitarGerar() {
    if (texto.trim()) setConfirmando(true);
    else executar();
  }

  return {
    texto,
    editado,
    gerando,
    erro,
    confirmando,
    mudar,
    solicitarGerar,
    executar,
    cancelarConfirmacao: () => setConfirmando(false),
  };
}
