"use client";

import { useEffect, useState } from "react";

import { temaPorHora } from "@/lib/tema";
import { STORAGE_KEY, useConsulta } from "@/store/consulta";

let iniciado = false;

/**
 * Restaura o rascunho do localStorage (uma única vez por carregamento da página)
 * e informa quando isso terminou. Sem rascunho salvo, o tema inicial vem da hora.
 *
 * Enquanto devolver `false`, as telas não devem gravar nada no store, para não
 * sobrescrever um rascunho que ainda não foi lido.
 */
export function usePersist(): boolean {
  const [hidratado, setHidratado] = useState(() => useConsulta.persist.hasHydrated());

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      let semRascunho = true;
      try {
        semRascunho = window.localStorage.getItem(STORAGE_KEY) === null;
      } catch {
        // localStorage indisponível (ex.: navegação privada restrita): segue sem persistência.
      }
      void Promise.resolve(useConsulta.persist.rehydrate()).then(() => {
        if (semRascunho) useConsulta.getState().setTheme(temaPorHora());
      });
    }
    if (useConsulta.persist.hasHydrated()) setHidratado(true);
    return useConsulta.persist.onFinishHydration(() => setHidratado(true));
  }, []);

  return hidratado;
}
