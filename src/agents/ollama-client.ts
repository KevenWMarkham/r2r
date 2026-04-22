// Unified LLM client — dispatches to Ollama (local Qwen) or Claude API.
// Kept as `ollama-client.ts` so existing agent imports don't churn; the name
// is historical. `OllamaError` is re-used as the generic error type so agent
// error-handling doesn't need per-provider branches.
import { OLLAMA_URL, QWEN_MODEL, IS_ANTHROPIC } from "@/config/env";
import { chatJSONClaude, checkHealthClaude, ClaudeError } from "./claude-client";

export class OllamaError extends Error {}

export async function checkHealth(): Promise<boolean> {
  if (IS_ANTHROPIC) return checkHealthClaude();
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
  if (IS_ANTHROPIC) {
    try {
      return await chatJSONClaude<T>(args);
    } catch (e) {
      if (e instanceof ClaudeError) throw new OllamaError(`[Claude] ${e.message}`);
      throw e;
    }
  }

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
