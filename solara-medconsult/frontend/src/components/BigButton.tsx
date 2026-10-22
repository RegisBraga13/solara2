import type { ButtonHTMLAttributes, ReactNode } from "react";

export type BigButtonVariant = "primary" | "secondary" | "ghost";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: BigButtonVariant;
}

/** Botão em relevo: primary (couro), secondary (papel) e ghost (sem sombra). */
export function BigButton({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: BigButtonProps) {
  const textura = variant === "primary" ? "skeu-leather" : "";
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${textura} w-full ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
