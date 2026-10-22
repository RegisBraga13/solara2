import { useEffect, useRef } from "react";

/** Faz a caixa crescer com o conteúdo (1 linha no início, sem scroll nem sobra de espaço). */
export function useAutoAltura(valor: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  return ref;
}
