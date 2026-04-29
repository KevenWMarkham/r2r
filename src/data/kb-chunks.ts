// NOAH knowledge base — shared between canned mode (in-memory retrieval) and
// live mode (Postgres seed + pgvector cosine search).
//
// Data lives in fixtures/kb-chunks.json so both the client (Vite JSON import)
// and the server seed script (fs.readFile) can read the same source.

import chunks from "../../fixtures/kb-chunks.json";

export type KBTopic =
  | "contracts"
  | "risk"
  | "materiality"
  | "accruals"
  | "reversals"
  | "tech-acct"
  | "phases"
  | "narrative"
  | "review"
  | "architecture"
  | "demo-flow"
  | "extraction"
  | "audit";

export interface KBChunk {
  id: string;
  title: string;
  topic: KBTopic;
  content: string;
  keywords: string[];
}

export const KB_CHUNKS: KBChunk[] = chunks as KBChunk[];

export const KB_TOPICS: KBTopic[] = Array.from(
  new Set(KB_CHUNKS.map((c) => c.topic))
);
