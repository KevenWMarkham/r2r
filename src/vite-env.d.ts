/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE: "live" | "canned";
  readonly VITE_OLLAMA_URL: string;
  readonly VITE_QWEN_MODEL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
