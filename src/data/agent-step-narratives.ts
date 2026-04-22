import type { AgentStep } from "@/adapters";

export interface StepNarrative {
  step: AgentStep;
  title: string;
  orchestratorRole: string;
  actions: string[];
  systems: string[];
  outputs: string[];
  handoffTo: string;
  demoNote?: string;
}

export const STEP_NARRATIVES: Record<AgentStep, StepNarrative> = {
  extract: {
    step: "extract",
    title: "Extract Contract Attributes",
    orchestratorRole: "Record Agent — ingests the contract and extracts structured attributes.",
    actions: [
      "Downloads contract blob from PostgreSQL metabase (bytea column)",
      "Reads full extracted text (already parsed server-side via pdf-parse or mammoth)",
      "Calls Qwen 2.5 (JSON mode) with a 27-attribute schema hint",
      "Retries once with a correction prompt on malformed JSON; partial-salvage fallback otherwise",
      "Validates response against zod schema; assigns per-field confidence",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b)",
      "PostgreSQL contract_metabase (UPDATE attributes + agent_status + updated_at)",
      "audit_events (INSERT event_type='extract', confidence=avg)",
    ],
    outputs: [
      "27 attribute fields with {value, confidence, source_page}",
      "Low-confidence fields flagged amber in the UI",
    ],
    handoffTo: "Risk agent + Technical Accounting classifier (can run in parallel).",
    demoNote: "In production, calls Azure AI Foundry with Document Intelligence — NOAH's Record Agent.",
  },
  risk: {
    step: "risk",
    title: "Score Risk",
    orchestratorRole: "Risk Agent — combines deterministic rules with LLM signal.",
    actions: [
      "scoreRules() — TCV tiers, auto-renewal, liability cap, lease flag, derivative flag (0-60)",
      "scoreLLM() — Qwen qualitative signal on factors not captured by rules (0-40)",
      "Aggregates to 0-100 and categorizes (Low/Medium/High)",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b)",
      "contract_metabase (UPDATE risk_score, risk_category, risk_reasons)",
      "audit_events (INSERT event_type='risk')",
    ],
    outputs: [
      "risk_score (0-100)",
      "risk_category: Low | Medium | High",
      "risk_reasons[] — contributing factors for review",
    ],
    handoffTo: "Marcus (Sr Accountant) — validates high-risk contracts. Queue sorts by score desc.",
  },
  techAcct: {
    step: "techAcct",
    title: "Flag Technical Accounting",
    orchestratorRole: "Technical Accounting Classifier — ASC 840/842/815 determinations.",
    actions: [
      "Analyzes contract + structured attribute hints for lease indicators (right to control identified asset)",
      "Detects embedded derivatives indexed to financial variables (CPI, rate, FX, commodity)",
      "Classifies expense recognition method (straight-line / immediate / direct-association / unknown)",
      "Sets requires_senior_review when any flag triggers",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b)",
      "contract_metabase (UPDATE tech_acct_flags)",
      "audit_events (INSERT event_type='tech_acct')",
    ],
    outputs: [
      "lease: {flagged, standard: ASC 840|842, reasoning}",
      "derivative: {flagged, standard: ASC 815, reasoning}",
      "expense_method + requires_senior_review",
    ],
    handoffTo: "Rachel (Manager) — signs off on ASC classifications per SOX.",
    demoNote: "Production NOAH persists these flags to BlackLine for downstream consumption.",
  },
  accrual: {
    step: "accrual",
    title: "Propose Accrual JE",
    orchestratorRole: "Accrual Agent — contract → deterministic math → proposed journal entry.",
    actions: [
      "Qwen extracts fee schedule + service dates as STRINGS (no numeric output permitted)",
      "TypeScript parses strings → numbers/dates (type-enforced seam)",
      "Pure TS computes: monthly rate, months elapsed, cumulative earned, GR/IR netted period accrual",
      "JE builder enforces debits = credits, reversal = 1st of next month",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b) — term extraction only",
      "src/lib/accrual-math.ts (pure TS, no LLM)",
      "src/lib/je-builder.ts (enforces invariants)",
      "contract_metabase (UPDATE proposed_je)",
      "audit_events (INSERT event_type='accrual')",
    ],
    outputs: [
      "AccrualInputs (strings/dates only)",
      "AccrualCalcResult {periodAccrual, accruedCumulative, monthlyRate, reasoning}",
      "ProposedJE {lines: [DR Expense, CR Accrued Liability], reversalDate}",
    ],
    handoffTo: "Marcus (Sr Accountant) — one-click Approve → posts to SAP via BlackLine (simulated).",
    demoNote: "Type system guarantees LLM never produces JE dollar amounts.",
  },
  "narrative-variance": {
    step: "narrative-variance",
    title: "Generate Variance Commentary",
    orchestratorRole: "Reporting Agent — drafts per-line variance commentary grounded in seeded P&L.",
    actions: [
      "Reads seeded P&L line (current, prior, variance, drivers)",
      "Qwen generates 2-3 sentence prose — grounded in supplied numbers only",
      "Prompt forbids fabricating figures; prose output only",
      "Returns commentary + key_drivers[] + risk_flags[] + confidence",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b)",
      "seed-pnl.ts (12-15 line items with variance context)",
    ],
    outputs: ["VarianceCommentary {commentary, key_drivers[], risk_flags[], confidence}"],
    handoffTo: "Daniel (Reporting Manager) — Copy/Accept; edits as needed.",
    demoNote: "PS-05 scope — coming next in the build.",
  },
  "narrative-exec": {
    step: "narrative-exec",
    title: "Generate Executive Close Narrative",
    orchestratorRole: "Reporting Agent — board-ready close summary.",
    actions: [
      "Reads close metrics from closeStore (phase, day, auto-cert rate)",
      "Aggregates top variances from seeded P&L",
      "Qwen generates headline + highlights[] + risks[] + recommendation",
      "Tone: concise, quantified, neutral — CFO memo style",
    ],
    systems: [
      "Ollama @ localhost:11434 (qwen2.5:7b)",
      "closeStore (Zustand state)",
      "seed-pnl.ts",
    ],
    outputs: [
      "ExecutiveSummary {headline, key_highlights[], risks[], recommendation}",
    ],
    handoffTo: "Sarah (VP Controlling) — presents to board.",
    demoNote: "Triggered automatically at Gate phase in the Close Cockpit.",
  },
};
