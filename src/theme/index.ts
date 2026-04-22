import { MODE } from "@/config/env";
import { nikeTheme } from "./nike";
import { acmeTheme } from "./acme";
import type { Theme } from "./types";

export const theme: Theme = MODE === "canned" ? acmeTheme : nikeTheme;

export function applyThemeToRoot(): void {
  const root = document.documentElement;
  root.style.setProperty("--brand-bg", theme.colors.bg);
  root.style.setProperty("--brand-surface", theme.colors.surface);
  root.style.setProperty("--brand-surface-alt", theme.colors.surfaceAlt);
  root.style.setProperty("--brand-border", theme.colors.border);
  root.style.setProperty("--brand-accent", theme.colors.accent);
  root.style.setProperty("--brand-accent-dim", theme.colors.accentDim);
  root.style.setProperty("--brand-accent-glow", theme.colors.accentGlow);
  root.style.setProperty("--brand-text", theme.colors.text);
  root.style.setProperty("--brand-text-muted", theme.colors.textMuted);
  root.style.setProperty("--brand-text-dim", theme.colors.textDim);
  root.style.setProperty("--brand-font-display", theme.fonts.display);
  root.style.setProperty("--brand-font-body", theme.fonts.body);
  root.style.setProperty("--brand-font-mono", theme.fonts.mono);
  document.title = `${theme.productName} — ${theme.brandName}`;
}

export type { Theme };
