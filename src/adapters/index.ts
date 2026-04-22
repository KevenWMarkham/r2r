import { IS_CANNED } from "@/config/env";
import { LiveAgent } from "./live-agent";
import { CannedAgent } from "./canned-agent";
import type { Agent } from "./agent-interface";

// Agent selection by build-time mode.
//   live   → calls Ollama + server (full stack required)
//   canned → reads bundled JSON fixtures + artificial step delays (GitHub Pages)
export const agent: Agent = IS_CANNED ? new CannedAgent() : new LiveAgent();

export type { Agent, AgentEvent, AgentStep, AgentStatus, AgentCallbacks, ExtractOutcome } from "./agent-interface";
