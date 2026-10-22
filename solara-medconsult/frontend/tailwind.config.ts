import type { Config } from "tailwindcss";

import { breakpoints, radius, spacing } from "./src/styles/tokens";

const v = (nome: string) => `var(--color-${nome})`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    screens: {
      sm: breakpoints.sm,
      md: breakpoints.md,
      lg: breakpoints.lg,
      xl: breakpoints.xl,
    },
    extend: {
      colors: {
        app: v("bg"),
        surface: v("surface"),
        elevated: v("surface-elevated"),
        sunken: v("surface-sunken"),
        leather: v("leather"),
        "leather-dark": v("leather-dark"),
        terracotta: v("terracotta"),
        mint: v("mint"),
        lilac: v("lilac"),
        ink: v("text-primary"),
        muted: v("text-secondary"),
        "on-accent": v("text-on-accent"),
        line: v("border-soft"),
        "line-strong": v("border-strong"),
        ok: v("ok"),
        "accent-text": v("accent-text"),
        // apelidos usados pelas telas da Fase 1
        card: v("surface"),
        soft: v("surface-sunken"),
        primary: v("leather"),
        "primary-fg": "#ffffff",
      },
      // Escala do design system com prefixo "ds-" (não substitui a escala padrão do Tailwind).
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, val]) => [`ds-${k}`, val])),
      borderRadius: radius,
      boxShadow: {
        raised: "var(--shadow-raised)",
        pressed: "var(--shadow-pressed)",
        card: "var(--shadow-card)",
        sunken: "var(--shadow-sunken)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
