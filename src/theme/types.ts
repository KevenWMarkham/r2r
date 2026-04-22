export interface Theme {
  name: "nike" | "acme";
  brandName: string;
  productName: string;
  tagline: string;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    accent: string;
    accentDim: string;
    accentGlow: string;
    text: string;
    textMuted: string;
    textDim: string;
  };
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
}
