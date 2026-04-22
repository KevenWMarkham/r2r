/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-bg": "var(--brand-bg)",
        "brand-surface": "var(--brand-surface)",
        "brand-surface-alt": "var(--brand-surface-alt)",
        "brand-accent": "var(--brand-accent)",
        "brand-accent-dim": "var(--brand-accent-dim)",
        "brand-accent-glow": "var(--brand-accent-glow)",
        "brand-text": "var(--brand-text)",
        "brand-text-muted": "var(--brand-text-muted)",
        "brand-text-dim": "var(--brand-text-dim)",
        "brand-border": "var(--brand-border)",
        "status-green": "var(--status-green)",
        "status-amber": "var(--status-amber)",
        "status-red": "var(--status-red)",
        "status-purple": "var(--status-purple)",
        "status-cyan": "var(--status-cyan)",
      },
      fontFamily: {
        display: ["var(--brand-font-display)", "sans-serif"],
        body: ["var(--brand-font-body)", "sans-serif"],
        mono: ["var(--brand-font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
