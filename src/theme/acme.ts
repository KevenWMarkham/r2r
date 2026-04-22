import type { Theme } from "./types";

export const acmeTheme: Theme = {
  name: "acme",
  brandName: "ACME CO",
  productName: "RECAL",
  tagline: "Agentic Financial Close",
  colors: {
    bg: "#0A0E1A",
    surface: "#121829",
    surfaceAlt: "#1a2238",
    border: "#1f2940",
    accent: "#4F9EF8",
    accentDim: "rgba(79,158,248,0.14)",
    accentGlow: "rgba(79,158,248,0.28)",
    text: "#ffffff",
    textMuted: "#a7b0c4",
    textDim: "#6b748a",
  },
  fonts: {
    display: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
};
