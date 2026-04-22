/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE: "live" | "canned";
  readonly VITE_OLLAMA_URL: string;
  readonly VITE_QWEN_MODEL: string;
  readonly VITE_API_URL: string;
  readonly VITE_LLM_PROVIDER: "ollama" | "anthropic";
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_ANTHROPIC_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
