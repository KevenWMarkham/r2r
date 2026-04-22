// Anthropic Claude API backend — alternative to Ollama/Qwen for the live demo.
// Uses direct browser fetch with anthropic-dangerous-direct-browser-access.
// This is acceptable for a single-user prototype demo laptop; for production,
// proxy through the server instead.
//
// JSON reliability trick: assistant-prefill with "{" forces the response to
// start as a JSON object. We prepend "{" to the returned text and parse.
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from "@/config/env";

export class ClaudeError extends Error {}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface ChatArgs {
  prompt: string;
  schemaHint: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function checkHealthClaude(): Promise<boolean> {
  // No dedicated health endpoint; presence of API key is the signal.
  // A true round-trip check would cost a real API call.
  return Boolean(ANTHROPIC_API_KEY);
}

export async function chatJSONClaude<T = unknown>(args: ChatArgs): Promise<T> {
  if (!ANTHROPIC_API_KEY) {
    throw new ClaudeError(
      "ANTHROPIC_API_KEY is missing. Set VITE_ANTHROPIC_API_KEY in .env or switch VITE_LLM_PROVIDER=ollama."
    );
  }

  const system = [
    args.system ?? "",
    "Return ONLY a single valid JSON object matching the requested schema. No prose, no markdown, no code fences.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 4096,
    temperature: args.temperature ?? 0.1,
    system,
    messages: [
      {
        role: "user",
        content: `${args.prompt}\n\nReturn JSON matching this shape:\n${args.schemaHint}`,
      },
      // Prefill with "{" forces JSON-object start — most reliable Claude JSON technique
      { role: "assistant", content: "{" },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch { /* noop */ }
    throw new ClaudeError(detail);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  // Reconstruct the JSON: prefill "{" + continuation from the model
  const jsonText = "{" + text;
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // Sometimes Claude emits trailing prose after the JSON — try to slice at the last closing brace
    const lastBrace = jsonText.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        return JSON.parse(jsonText.slice(0, lastBrace + 1)) as T;
      } catch { /* fall through */ }
    }
    throw new ClaudeError(`Claude returned non-JSON: ${jsonText.slice(0, 200)}`);
  }
}
