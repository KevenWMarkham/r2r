// NOAH Help knowledge-base agent.
//
// Two retrieval paths:
//   - LIVE mode: POST /api/kb/search — pgvector cosine similarity on Postgres
//   - CANNED mode: in-memory keyword/term scoring over the shared chunk file
//
// Plus a "live-data" layer that answers state-dependent questions (counts,
// filters by TCV, pending JEs, etc.) from the actual contract + JE state. The
// agent decides at query time whether to retrieve from the KB, compute live
// data, or combine both.

import { IS_CANNED, API_URL } from "@/config/env";
import { KB_CHUNKS, type KBChunk } from "@/data/kb-chunks";
import type { ContractSummary, ProposedJERecord } from "@/lib/api-client";

export interface KBSource {
  id: string;
  title: string;
  topic: string;
  content: string;
  similarity?: number;
}

export interface KBAnswer {
  answer: string;
  sources: KBSource[];
  liveDataUsed: boolean;
  intent: string; // human-readable label for the path taken
}

export interface AskContext {
  contracts: ContractSummary[];
  jes: ProposedJERecord[];
  closeDay?: number;
  activePhase?: string | null;
}

// ── Live data helpers ────────────────────────────────────────────────────────

const ACCRUED_ACCOUNTS = new Set(["2310", "2311", "2320", "2330"]);

interface JEBody { lines?: Array<{ account: string; debit?: number; credit?: number }> }

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function tcvNumber(c: ContractSummary): number {
  if (!c.tcv) return 0;
  return parseFloat(c.tcv.replace(/[^0-9.]/g, "")) || 0;
}

// Parse "10m", "$10m", "$10 million", "10 million", "5b", "$2.5B" → number of dollars
function parseAmount(s: string): number | null {
  const m = s.match(/\$?\s*([\d.]+)\s*(b|m|k|million|billion|thousand)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("b")) return n * 1_000_000_000;
  if (unit.startsWith("m")) return n * 1_000_000;
  if (unit.startsWith("k") || unit.startsWith("thousand")) return n * 1_000;
  return n;
}

function briefContract(c: ContractSummary): string {
  const parts: string[] = [c.counterparty ?? c.filename];
  if (c.tcv) parts.push(c.tcv);
  if (c.risk_category && c.risk_score != null) parts.push(`${c.risk_category} · ${c.risk_score}`);
  return parts.join(" · ");
}

// ── Live-data intent matchers ────────────────────────────────────────────────
// Each handler returns a string answer OR null if it doesn't apply. Agents
// fall through to KB retrieval if all return null.
//
// Order matters — most specific patterns first.

type LiveHandler = (q: string, ctx: AskContext) => string | null;

const liveHandlers: LiveHandler[] = [
  // Contracts over/under a dollar threshold
  (q, ctx) => {
    const m = q.match(/contract.*(over|above|more than|greater than|>=?)\s*\$?\s*([\d.]+\s*[bmk]?(?:illion|housand)?)/i);
    if (!m) return null;
    const amt = parseAmount(m[2]);
    if (amt === null) return null;
    const filtered = ctx.contracts.filter((c) => tcvNumber(c) > amt).sort((a, b) => tcvNumber(b) - tcvNumber(a));
    if (filtered.length === 0) {
      return `No contracts over ${fmt(amt)}. The largest is ${ctx.contracts.sort((a, b) => tcvNumber(b) - tcvNumber(a))[0]?.counterparty ?? "—"} at ${ctx.contracts.sort((a, b) => tcvNumber(b) - tcvNumber(a))[0]?.tcv ?? "—"}.`;
    }
    return `${filtered.length} contract${filtered.length === 1 ? "" : "s"} over ${fmt(amt)}: ${filtered.map(briefContract).join("; ")}.`;
  },
  (q, ctx) => {
    const m = q.match(/contract.*(under|below|less than|<=?)\s*\$?\s*([\d.]+\s*[bmk]?(?:illion|housand)?)/i);
    if (!m) return null;
    const amt = parseAmount(m[2]);
    if (amt === null) return null;
    const filtered = ctx.contracts.filter((c) => tcvNumber(c) > 0 && tcvNumber(c) < amt).sort((a, b) => tcvNumber(b) - tcvNumber(a));
    if (filtered.length === 0) return `No contracts under ${fmt(amt)} (with TCV available).`;
    return `${filtered.length} contract${filtered.length === 1 ? "" : "s"} under ${fmt(amt)}: ${filtered.map(briefContract).join("; ")}.`;
  },

  // How many contracts/JEs require Manager / Senior Accountant / dual review
  // Must match BEFORE the generic "how many contracts" handler.
  (q, ctx) => {
    const isReviewQ =
      /(how many|count|number).*(require|need|for).*(review|approv|sign[- ]?off)/i.test(q) ||
      /(manager|senior accountant|director|dual|approval).*review/i.test(q) ||
      /review.*(tier|breakdown|count)/i.test(q) ||
      /tier.*breakdown/i.test(q);
    if (!isReviewQ) return null;
    const submitted = ctx.jes.filter((j) => j.status === "submitted" || j.status === "posted");
    if (submitted.length === 0) {
      // Estimate from contract TCVs as a rough proxy — accrual size depends on
      // billing frequency, but TCV gives the right order-of-magnitude bucket.
      const buckets = { exec: 0, controller: 0, manager: 0, standard: 0 };
      for (const c of ctx.contracts) {
        const tcv = tcvNumber(c);
        if (tcv === 0) continue;
        // Rough: monthly accrual ≈ TCV / 36 (assume 3yr term). Bucket on monthly.
        const monthly = tcv / 36;
        if (monthly > 5_000_000) buckets.exec++;
        else if (monthly > 1_000_000) buckets.controller++;
        else if (monthly > 100_000) buckets.manager++;
        else buckets.standard++;
      }
      return `No JEs submitted yet — calculate accruals on /contracts first. Estimating from contract TCVs (rough monthly accrual basis): ${buckets.exec} would route to Manager + Director (dual approval, >$5M), ${buckets.controller} to Manager ($1M–$5M), ${buckets.manager} to Senior Accountant ($100K–$1M), ${buckets.standard} would auto-post (<$100K). Run Calculate accruals → Submit all on /contracts to see actual tier counts.`;
    }
    const exec = submitted.filter((j) => j.materiality_tier === "exec").length;
    const controller = submitted.filter((j) => j.materiality_tier === "controller").length;
    const manager = submitted.filter((j) => j.materiality_tier === "manager").length;
    const standard = submitted.filter((j) => j.materiality_tier === "standard").length;
    const requiresMgrOrAbove = controller + exec;
    return `${requiresMgrOrAbove} JE${requiresMgrOrAbove === 1 ? "" : "s"} require Manager review or higher (${exec} dual-approval >$5M, ${controller} Manager $1M–$5M). ${manager} go to Senior Accountant ($100K–$1M), ${standard} auto-posted (<$100K). Note: routing depends on accrual amount, not contract TCV — a $50M contract paid quarterly may book a Manager-tier accrual.`;
  },

  // How many contracts (count + risk distribution)
  (q, ctx) => {
    if (!/(how many|count|number|total).*contract/i.test(q) && !/contract.*count/i.test(q)) return null;
    const high = ctx.contracts.filter((c) => c.risk_category === "High").length;
    const med = ctx.contracts.filter((c) => c.risk_category === "Medium").length;
    const low = ctx.contracts.filter((c) => c.risk_category === "Low").length;
    const processed = ctx.contracts.filter((c) => c.agent_status?.extract === "done").length;
    return `${ctx.contracts.length} contracts in scope this period — ${high} High risk, ${med} Medium, ${low} Low. ${processed === ctx.contracts.length ? "All processed." : `${ctx.contracts.length - processed} pending extract → risk → tech-acct.`}`;
  },

  // Highest-risk contracts
  (q, ctx) => {
    if (!/(highest|top|most|riskiest|biggest).*risk/i.test(q) && !/high.?risk.*contract/i.test(q)) return null;
    const high = ctx.contracts.filter((c) => c.risk_category === "High").sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
    if (high.length === 0) return "No High-risk contracts in the queue right now. Run extract on /contracts to score them.";
    return `${high.length} High-risk contract${high.length === 1 ? "" : "s"}: ${high.slice(0, 5).map(briefContract).join("; ")}. Open /contracts and click Review.`;
  },

  // Largest contract by TCV
  (q, ctx) => {
    if (!/(largest|biggest|top|highest).*(contract|tcv|value)/i.test(q)) return null;
    const sorted = [...ctx.contracts].filter((c) => tcvNumber(c) > 0).sort((a, b) => tcvNumber(b) - tcvNumber(a));
    if (sorted.length === 0) return "No contracts with TCV available.";
    return `Top by TCV: ${sorted.slice(0, 3).map(briefContract).join("; ")}.`;
  },

  // ASC 842 lease flags
  (q, ctx) => {
    if (!/(asc.?842|lease.*flag|lease.*review|lease.*account)/i.test(q)) return null;
    const flagged = ctx.contracts.filter((c) => c.lease_flagged);
    if (flagged.length === 0) return "No contracts currently flagged for ASC 842 lease review.";
    return `${flagged.length} contract${flagged.length === 1 ? "" : "s"} flagged for ASC 842: ${flagged.map(briefContract).join("; ")}.`;
  },

  // ASC 815 derivative flags
  (q, ctx) => {
    if (!/(asc.?815|derivative|embedded.*deriv|hedge|hedging)/i.test(q)) return null;
    const flagged = ctx.contracts.filter((c) => c.derivative_flagged);
    if (flagged.length === 0) return "No contracts flagged for ASC 815 embedded-derivative review.";
    return `${flagged.length} contract${flagged.length === 1 ? "" : "s"} flagged for ASC 815: ${flagged.map(briefContract).join("; ")}.`;
  },

  // Total accrued expense
  (q, ctx) => {
    if (!/(total.*accru|accru.*total|accrued.*expense|accrued.*balance)/i.test(q)) return null;
    let total = 0;
    let posted = 0;
    let pending = 0;
    for (const j of ctx.jes) {
      if (j.status !== "posted" && j.status !== "submitted") continue;
      const body = (j.je_body ?? {}) as JEBody;
      for (const ln of body.lines ?? []) {
        if (!ACCRUED_ACCOUNTS.has(ln.account)) continue;
        const credit = ln.credit ?? 0;
        total += credit;
        if (j.status === "posted") posted += credit;
        else pending += credit;
      }
    }
    if (total === 0) return "No accrued-expense balance from reviewed contracts yet. Tick contracts on /contracts and click Calculate accruals → Submit all.";
    return `Total accrued expense from reviewed contracts: ${fmt(total)} (${fmt(posted)} posted, ${fmt(pending)} pending review). See /narrative → B/S Variance Analysis for the line-item breakdown.`;
  },

  // Pending review
  (q, ctx) => {
    if (!/(pending.*review|awaiting.*approval|to.*approve|review.*queue|pending.*manager|pending.*director)/i.test(q)) return null;
    const submitted = ctx.jes.filter((j) => j.status === "submitted");
    if (submitted.length === 0) return "Review queue is empty — no JEs awaiting approval.";
    const dual = submitted.filter((j) => j.materiality_tier === "exec").length;
    const mgr = submitted.filter((j) => j.materiality_tier === "controller").length;
    const sr = submitted.filter((j) => j.materiality_tier === "manager").length;
    const top = submitted.slice(0, 3).map((j) => `${j.counterparty ?? j.filename} ${fmt(parseFloat(j.total_amount))}`).join("; ");
    return `${submitted.length} JE${submitted.length === 1 ? "" : "s"} awaiting approval: ${dual} dual-approval (>$5M), ${mgr} Manager ($1M-$5M), ${sr} Senior Accountant ($100K-$1M). Top pending: ${top}. Open /review.`;
  },

  // Close status
  (q, ctx) => {
    if (!/(close.*status|where.*are.*we|current.*phase|what.*phase|cockpit.*state)/i.test(q)) return null;
    if (ctx.activePhase) {
      return `Cockpit: Day ${ctx.closeDay} of 6 · ${ctx.activePhase.toUpperCase()} phase active.`;
    }
    return "Cockpit is idle — start it from the Close Cockpit tab to drive the phase animation.";
  },
];

// ── KB retrieval ─────────────────────────────────────────────────────────────

// Tokenize query into lowercase terms; drop common stopwords
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "in", "on", "at", "to", "for",
  "of", "and", "or", "but", "not", "this", "that", "these", "those", "i", "you", "we", "they", "what",
  "how", "why", "when", "where", "which", "who", "do", "does", "did", "have", "has", "had", "can",
  "could", "should", "would", "tell", "me", "show", "about", "any", "all", "some", "with",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// BM25-lite scoring over keywords + content + title.
function scoreChunk(chunk: KBChunk, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const titleLower = chunk.title.toLowerCase();
  const contentLower = chunk.content.toLowerCase();
  const kwSet = new Set(chunk.keywords.map((k) => k.toLowerCase()));
  let score = 0;
  for (const t of queryTerms) {
    if (kwSet.has(t)) score += 4; // explicit keyword hit weighted highest
    if (titleLower.includes(t)) score += 2;
    // Content term frequency, capped to avoid one chunk dominating
    const matches = (contentLower.match(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g")) ?? []).length;
    score += Math.min(matches, 3);
  }
  // Slight boost for shorter chunks of equal hit count (more focused)
  return score / Math.sqrt(chunk.content.length / 200 + 1);
}

function retrieveCanned(query: string, topK = 3): KBSource[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scored = KB_CHUNKS.map((c) => ({ chunk: c, score: scoreChunk(c, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored.map((s) => ({
    id: s.chunk.id,
    title: s.chunk.title,
    topic: s.chunk.topic,
    content: s.chunk.content,
    similarity: s.score,
  }));
}

async function retrieveLive(query: string, topK = 3): Promise<KBSource[]> {
  try {
    const res = await fetch(`${API_URL}/api/kb/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.results as Array<{ id: string; title: string; topic: string; content: string; similarity: number }>)
      .map((r) => ({ id: r.id, title: r.title, topic: r.topic, content: r.content, similarity: r.similarity }));
  } catch {
    // Fall back to canned retrieval if the server / Ollama isn't reachable.
    return retrieveCanned(query, topK);
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function askKnowledgeBase(query: string, ctx: AskContext): Promise<KBAnswer> {
  // 1) Try live-data handlers first — these answer state-dependent questions
  for (const h of liveHandlers) {
    const reply = h(query, ctx);
    if (reply !== null) {
      return { answer: reply, sources: [], liveDataUsed: true, intent: "live-data" };
    }
  }

  // 2) Otherwise: KB retrieval
  const sources = IS_CANNED ? retrieveCanned(query, 3) : await retrieveLive(query, 3);
  if (sources.length === 0) {
    return {
      answer:
        "I don't have a relevant fact in the knowledge base for that. Try asking about contracts, accruals, materiality routing, reversals, the close cycle, or technical accounting flags. The chips below show common questions.",
      sources: [],
      liveDataUsed: false,
      intent: "no-match",
    };
  }

  // 3) Compose: lead with the top chunk, optionally cite the next one if its
  //    score is close.
  const top = sources[0];
  const second = sources[1];
  const closeSecond = second && top.similarity != null && second.similarity != null
    && (second.similarity / top.similarity) > 0.6;
  const composed = closeSecond
    ? `${top.content}\n\nRelated: ${second.content}`
    : top.content;

  return {
    answer: composed,
    sources,
    liveDataUsed: false,
    intent: IS_CANNED ? "kb-canned" : "kb-live",
  };
}
