"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Fonte } from "@/lib/sugestoes";

/** "aguardando" = há base para pedir, mas o médico ainda não mandou gerar. */
export type EstadoSugestao = "ocioso" | "aguardando" | "carregando" | "pronto" | "erro";

interface Opcoes<T> {
  /** O que identifica o pedido (texto do caso, diagnósticos…). Vazio = nada a pedir. */
  chave: string;
  /** Sugestões já guardadas e a chave com a qual foram pedidas. */
  salvo: { chave: string } | null;
  buscar: (fontes: Fonte[], colado: string) => Promise<T>;
  salvar: (resultado: T) => void;
}

/**
 * Nada é gerado sozinho: o servidor só é chamado quando o médico escolhe as fontes e manda
 * `gerar`. O resultado fica guardado no store; voltar à tela não repete o pedido. Falha de rede
 * não trava nada: o estado vira "erro" e o médico segue acrescentando itens à mão.
 */
export function useSugestoes<T>({ chave, salvo, buscar, salvar }: Opcoes<T>) {
  const jaTem = salvo !== null && salvo.chave === chave;
  const [pedido, setPedido] = useState<"nenhum" | "carregando" | "erro">("nenhum");
  const buscarRef = useRef(buscar);
  const salvarRef = useRef(salvar);
  const chaveRef = useRef(chave);
  const numeroRef = useRef(0);
  buscarRef.current = buscar;
  salvarRef.current = salvar;
  chaveRef.current = chave;

  // Mudou o caso/diagnóstico: um pedido em andamento deixa de valer.
  useEffect(() => {
    numeroRef.current += 1;
    setPedido("nenhum");
  }, [chave]);

  const gerar = useCallback((fontes: Fonte[], colado = "") => {
    if (!chaveRef.current || (fontes.length === 0 && !colado.trim())) return;
    const numero = ++numeroRef.current;
    setPedido("carregando");
    buscarRef
      .current(fontes, colado)
      .then((resultado) => {
        if (numero !== numeroRef.current) return;
        salvarRef.current(resultado);
        setPedido("nenhum");
      })
      .catch(() => {
        if (numero === numeroRef.current) setPedido("erro");
      });
  }, []);

  const estado: EstadoSugestao = !chave
    ? "ocioso"
    : pedido === "carregando"
      ? "carregando"
      : pedido === "erro"
        ? "erro"
        : jaTem
          ? "pronto"
          : "aguardando";
  return { estado, gerar };
}
