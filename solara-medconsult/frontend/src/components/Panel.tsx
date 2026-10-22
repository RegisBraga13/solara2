import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}

/** Container em papel: cantos 32px, sombra de card, grão sutil (::before). Sem hover. */
export function Panel({ children, className = "", as: Tag = "section" }: PanelProps) {
  return (
    <Tag
      className={`skeu skeu-paper rounded-2xl bg-surface p-5 text-ink shadow-card md:p-ds-6 ${className}`}
    >
      {children}
    </Tag>
  );
}
