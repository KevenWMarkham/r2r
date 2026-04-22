export type Mode = "live" | "canned";

export const MODE: Mode = (import.meta.env.VITE_MODE as Mode) ?? "live";
export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";
export const QWEN_MODEL = import.meta.env.VITE_QWEN_MODEL ?? "qwen2.5:7b";
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export const IS_LIVE = MODE === "live";
export const IS_CANNED = MODE === "canned";
export const IS_PROD = import.meta.env.PROD;
