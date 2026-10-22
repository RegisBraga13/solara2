"use client";

import { useConsulta } from "@/store/consulta";

/** Esfera em relevo no canto superior direito: alterna dia/noite. Toque 44×44. */
export function ThemeToggle() {
  const theme = useConsulta((s) => s.theme);
  const toggle = useConsulta((s) => s.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dia" ? "Ativar tema noite" : "Ativar tema dia"}
      title={theme === "dia" ? "Tema noite" : "Tema dia"}
      className="theme-sphere touch fixed z-50"
      style={{
        top: "max(8px, env(safe-area-inset-top))",
        right: "max(16px, env(safe-area-inset-right))",
      }}
    />
  );
}
