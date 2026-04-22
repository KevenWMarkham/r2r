import { useCallback, useEffect, useState } from "react";
import { checkHealth } from "@/agents/ollama-client";
import { OLLAMA_URL, QWEN_MODEL, IS_LIVE } from "@/config/env";
import { RefreshCw, AlertCircle } from "lucide-react";

type Status = "checking" | "healthy" | "unreachable";

export default function OllamaGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  const probe = useCallback(async () => {
    setStatus("checking");
    const ok = await checkHealth();
    setStatus(ok ? "healthy" : "unreachable");
  }, []);

  useEffect(() => {
    if (!IS_LIVE) {
      setStatus("healthy"); // canned mode doesn't need Ollama
      return;
    }
    void probe();
  }, [probe]);

  if (status === "healthy") return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-brand-surface border border-status-amber max-w-md w-full p-6 space-y-4">
          <div className="flex items-center gap-2 text-status-amber">
            <AlertCircle size={20} />
            <span className="font-display text-lg font-bold uppercase tracking-wider">
              Ollama Unreachable
            </span>
          </div>
          <p className="text-sm text-brand-text-muted leading-relaxed">
            The live-mode agents require a running Ollama instance at{" "}
            <code className="font-mono text-brand-accent">{OLLAMA_URL}</code> with the{" "}
            <code className="font-mono text-brand-accent">{QWEN_MODEL}</code> model pulled.
          </p>
          <div className="bg-brand-surface-alt border border-brand-border p-3 font-mono text-[11px] space-y-1">
            <div className="text-brand-text-dim"># Install + pull models</div>
            <div>winget install Ollama.Ollama</div>
            <div>ollama pull {QWEN_MODEL}</div>
            <div>ollama pull nomic-embed-text</div>
          </div>
          <button
            onClick={probe}
            disabled={status === "checking"}
            className="w-full py-2 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} className={status === "checking" ? "animate-spin" : ""} />
            {status === "checking" ? "Checking…" : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}
