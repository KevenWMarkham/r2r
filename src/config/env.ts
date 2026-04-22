export type Mode = "live" | "canned";
export type LLMProvider = "ollama" | "anthropic";

export const MODE: Mode = (import.meta.env.VITE_MODE as Mode) ?? "live";
export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";
export const QWEN_MODEL = import.meta.env.VITE_QWEN_MODEL ?? "qwen2.5:7b";
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// LLM provider switch: "ollama" (default, local) or "anthropic" (Claude API, paid)
export const LLM_PROVIDER: LLMProvider =
  (import.meta.env.VITE_LLM_PROVIDER as LLMProvider) ?? "ollama";
export const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? "";
export const ANTHROPIC_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL ?? "claude-haiku-4-5";

export const IS_LIVE = MODE === "live";
export const IS_CANNED = MODE === "canned";
export const IS_OLLAMA = LLM_PROVIDER === "ollama";
export const IS_ANTHROPIC = LLM_PROVIDER === "anthropic";
export const IS_PROD = import.meta.env.PROD;
