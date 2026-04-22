import { useEffect, useState } from "react";
import { MODE, QWEN_MODEL, OLLAMA_URL, API_URL, IS_PROD } from "@/config/env";

export default function ModeBanner() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (hidden || IS_PROD) return null;

  const label =
    MODE === "live"
      ? `LIVE · Qwen ${QWEN_MODEL} @ ${OLLAMA_URL} · API ${API_URL}`
      : `CANNED · pre-recorded fixtures`;
  const bg = MODE === "live" ? "bg-emerald-900/80" : "bg-amber-900/80";

  return (
    <div
      className={`${bg} text-white text-[11px] font-mono px-4 py-1 text-center tracking-wide`}
    >
      {label} · Ctrl+Shift+D to toggle
    </div>
  );
}
