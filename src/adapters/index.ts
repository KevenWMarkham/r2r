import { LiveAgent } from "./live-agent";
import type { Agent } from "./agent-interface";

// CannedAgent (fixture replay) lands in PS-06. Until then, both modes use LiveAgent;
// the runtime guard in `components/OllamaGuard` prevents live calls when Ollama is down.
export const agent: Agent = new LiveAgent();

export type { Agent, AgentEvent, AgentStep, AgentStatus, AgentCallbacks, ExtractOutcome } from "./agent-interface";
