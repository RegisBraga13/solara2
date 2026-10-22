// Design system "Modern Skeuomorphism" — fonte da verdade dos tokens.
// Os valores de cor/sombra também existem como variáveis CSS em app/globals.css
// (o teste tests/design.test.ts garante que os dois lados não divergem).

export const colors = {
  day: {
    bg: "#EFEAE2",
    surface: "#F5F0E8",
    surfaceElevated: "#FFFFFF",
    surfaceSunken: "#E5DFD5",
    leather: "#C87D45",
    leatherDark: "#A86538",
    terracotta: "#D68A3E",
    mint: "#A8C9A8",
    lilac: "#C8B8D8",
    textPrimary: "#2A2A2A",
    textSecondary: "#8A857D",
    textOnAccent: "#FFFFFF",
    borderSoft: "#E0DAD0",
    borderStrong: "#D0C8BC",
  },
  night: {
    bg: "#3A3A3E",
    surface: "#2A2A2E",
    surfaceElevated: "#333338",
    surfaceSunken: "#1F1F23",
    leather: "#8B5A32",
    leatherDark: "#6B4523",
    terracotta: "#C87D45",
    mint: "#A8D8C8",
    lilac: "#B8A8D8",
    textPrimary: "#F0EDE8",
    textSecondary: "#9A9A9E",
    textOnAccent: "#1F1F23",
    borderSoft: "#4A4A4E",
    borderStrong: "#5A5A5E",
  },
};

export const typography = {
  sizes: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
    "3xl": "32px",
    "4xl": "40px",
  },
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
};

export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "24px",
  6: "32px",
  7: "48px",
  8: "64px",
};

export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  pill: "9999px",
};

// SOMBRAS — a alma do Modern Skeuomorphism
export const shadows = {
  // Botão levantado (default)
  raised: `
    0 2px 4px rgba(0,0,0,0.08),
    0 4px 8px rgba(0,0,0,0.06),
    inset 0 -2px 4px rgba(0,0,0,0.08),
    inset 0 2px 4px rgba(255,255,255,0.7)
  `,
  // Botão pressionado (afundado)
  pressed: `
    inset 0 3px 6px rgba(0,0,0,0.15),
    inset 0 -2px 4px rgba(255,255,255,0.5)
  `,
  // Card flutuante
  card: `
    0 8px 24px rgba(0,0,0,0.10),
    0 2px 6px rgba(0,0,0,0.06),
    inset 0 1px 0 rgba(255,255,255,0.8)
  `,
  // Card no modo noite
  cardNight: `
    0 8px 24px rgba(0,0,0,0.45),
    0 2px 6px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.08)
  `,
  // Área afundada (input, área de texto)
  sunken: `
    inset 0 3px 6px rgba(0,0,0,0.12),
    inset 0 -1px 2px rgba(255,255,255,0.5)
  `,
};

export const breakpoints = {
  sm: "640px",
  md: "768px", // iPad retrato (PRINCIPAL)
  lg: "1024px", // iPad paisagem
  xl: "1280px", // Desktop
};
