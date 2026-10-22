// Texturas em CSS puro (ruído SVG embutido). Cada função devolve declarações CSS.

/** Textura de papel (grão sutil via SVG noise). */
export function paperTexture(opacity = 0.04) {
  return `
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${opacity}'/%3E%3C/svg%3E");
  `;
}

/** Textura de couro (gradiente + ruído). */
export function leatherTexture(baseColor = "#C87D45", darkColor = "#A86538") {
  return `
    background: linear-gradient(180deg, ${baseColor} 0%, ${darkColor} 100%);
    background-blend-mode: multiply;
    background-image:
      url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='leather'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23leather)' opacity='0.08'/%3E%3C/svg%3E"),
      linear-gradient(180deg, ${baseColor} 0%, ${darkColor} 100%);
  `;
}
