import { OLLAMA_URL, QWEN_MODEL } from "@/config/env";

export class OllamaError extends Error {}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    return r.ok;
  } catch {
    return false;
  }
}

export interface ChatArgs {
  prompt: string;
  schemaHint: string;
  system?: string;
  temperature?: number;
}

export async function chatJSON<T = unknown>(args: ChatArgs): Promise<T> {
  const body = {
    model: QWEN_MODEL,
    stream: false,
    format: "json",
    options: { temperature: args.temperature ?? 0.1 },
    messages: [
      ...(args.system ? [{ role: "system", content: args.system }] : []),
      {
        role: "user",
        content: `${args.prompt}\n\nRespond with valid JSON matching:\n${args.schemaHint}`,
      },
    ],
  };
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OllamaError(`HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OllamaError(`Model returned non-JSON: ${String(content).slice(0, 200)}`);
  }
}
