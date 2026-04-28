// In-memory JE + audit-event store for canned mode demos.
//
// Why this exists: canned mode (VITE_MODE=canned) runs without a backend
// server, but Kim's full demo path includes Submit-for-Review → materiality
// route → Approve → Post (SAP) → Auto-reverse. This module makes those
// transitions work locally, with realistic SAP doc numbers + audit trail,
// so the entire Senior Accountant → SG&A Manager → BlackLine → SAP flow demos cleanly
// at Claude-API speed.
//
// State lives in module-level arrays. Refreshing the page resets it.

import type { ProposedJERecord, MaterialityTier, AuditEvent } from "./api-client";
import { getFixtureContract } from "./fixtures";

// ── Materiality routing matches the live Postgres rule (server/migrations) ──
function routeByMateriality(amount: number): MaterialityTier {
  if (amount < 100_000) return "standard";   // auto-approve
  if (amount < 1_000_000) return "manager";  // SG&A Manager
  if (amount < 10_000_000) return "controller"; // VP Controlling
  return "exec";                             // CFO
}

// ── HMR-survival state ──────────────────────────────────────────────────────
// Vite hot-reloads modules during dev, which would reset plain `const jes = []`
// on every save and silently empty the Review Queue while the user is mid-demo.
// Persisting on globalThis survives HMR for the whole session.
type StoreShape = {
  jes: ProposedJERecord[];
  events: AuditEvent[];
  listeners: Set<() => void>;
};
const GLOBAL_KEY = "__noahCannedJEStore__";
const g = globalThis as unknown as Record<string, StoreShape>;
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = { jes: [], events: [], listeners: new Set() };
}
const jes = g[GLOBAL_KEY].jes;
const events = g[GLOBAL_KEY].events;
const listeners = g[GLOBAL_KEY].listeners;

// Subscribers (lightweight pub-sub so React screens can re-render on change)
type Listener = () => void;
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeJEStore(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0")}`;
}

function pushAudit(ev: Omit<AuditEvent, "id" | "ts">): AuditEvent {
  const full: AuditEvent = {
    id: nextId("audit"),
    ts: nowIso(),
    confidence: ev.confidence ?? null,
    payload: ev.payload ?? null,
    user_id: ev.user_id ?? null,
    agent: ev.agent ?? null,
    contract_id: ev.contract_id ?? null,
    event_type: ev.event_type,
  };
  events.push(full);
  notify();
  return full;
}

// SAP doc numbers look like: 4900012345 (10 digits, 49xxxxxxxx range)
function fakeSapDocNumber(): string {
  return `49000${Math.floor(Math.random() * 100_000)
    .toString()
    .padStart(5, "0")}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function cannedSubmitJE(payload: {
  contract_id: string;
  period: string;
  je_body: Record<string, unknown>;
  total_amount: number;
  reversal_date: string;
  prepared_by?: string;
}): ProposedJERecord {
  const tier = routeByMateriality(payload.total_amount);
  const contract = getFixtureContract(payload.contract_id);
  const filename = contract?.filename;
  const counterparty = contract?.counterparty ?? null;

  const rec: ProposedJERecord = {
    id: nextId("je"),
    contract_id: payload.contract_id,
    status: tier === "standard" ? "posted" : "submitted",
    period: payload.period,
    je_body: payload.je_body,
    materiality_tier: tier,
    total_amount: payload.total_amount.toFixed(2),
    prepared_by: payload.prepared_by ?? "Senior Accountant",
    submitted_at: nowIso(),
    approved_by: tier === "standard" ? "auto-approved" : null,
    approved_at: tier === "standard" ? nowIso() : null,
    rejected_by: null,
    rejected_at: null,
    rejected_reason: null,
    posted_at: tier === "standard" ? nowIso() : null,
    posting_ref: tier === "standard" ? fakeSapDocNumber() : null,
    reversal_date: payload.reversal_date,
    reversed_at: null,
    reversal_ref: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    filename,
    counterparty,
  };
  jes.push(rec);

  // Audit chain: submit (+ auto-approve + post if standard tier)
  pushAudit({
    event_type: "je_submit",
    contract_id: payload.contract_id,
    agent: "JE-Compose",
    confidence: 1.0,
    payload: { je_id: rec.id, period: rec.period, amount: payload.total_amount, tier },
    user_id: rec.prepared_by,
  });
  if (tier === "standard") {
    pushAudit({
      event_type: "je_approve",
      contract_id: payload.contract_id,
      agent: "Materiality-Router",
      confidence: 1.0,
      payload: { je_id: rec.id, auto_approved: true, threshold: "<$100K" },
      user_id: "auto-approved",
    });
    pushAudit({
      event_type: "je_post",
      contract_id: payload.contract_id,
      agent: "Posting-Agent",
      confidence: 1.0,
      payload: { je_id: rec.id, sap_doc: rec.posting_ref, system: "BlackLine→SAP" },
      user_id: "auto-approved",
    });
  }

  notify();
  return rec;
}

export function cannedListJEQueue(tier?: MaterialityTier): ProposedJERecord[] {
  return jes
    .filter((j) => j.status === "submitted")
    .filter((j) => !tier || j.materiality_tier === tier)
    .slice()
    .reverse();
}

export function cannedListJEsForContract(contractId: string): ProposedJERecord[] {
  return jes
    .filter((j) => j.contract_id === contractId)
    .slice()
    .reverse();
}

export function cannedApproveJE(id: string, approvedBy = "SG&A Manager"): ProposedJERecord {
  const rec = jes.find((j) => j.id === id);
  if (!rec) throw new Error(`JE not found: ${id}`);
  if (rec.status !== "submitted") {
    throw new Error(`JE ${id} is in status ${rec.status}, cannot approve`);
  }
  rec.status = "posted";
  rec.approved_by = approvedBy;
  rec.approved_at = nowIso();
  rec.posted_at = nowIso();
  rec.posting_ref = fakeSapDocNumber();
  rec.updated_at = nowIso();

  pushAudit({
    event_type: "je_approve",
    contract_id: rec.contract_id,
    agent: "HITL-Gate",
    confidence: 1.0,
    payload: { je_id: rec.id, tier: rec.materiality_tier },
    user_id: approvedBy,
  });
  pushAudit({
    event_type: "je_post",
    contract_id: rec.contract_id,
    agent: "Posting-Agent",
    confidence: 1.0,
    payload: { je_id: rec.id, sap_doc: rec.posting_ref, system: "BlackLine→SAP" },
    user_id: approvedBy,
  });

  notify();
  return rec;
}

export function cannedRejectJE(id: string, reason: string, rejectedBy = "SG&A Manager"): ProposedJERecord {
  const rec = jes.find((j) => j.id === id);
  if (!rec) throw new Error(`JE not found: ${id}`);
  if (rec.status !== "submitted") {
    throw new Error(`JE ${id} is in status ${rec.status}, cannot reject`);
  }
  rec.status = "rejected";
  rec.rejected_by = rejectedBy;
  rec.rejected_at = nowIso();
  rec.rejected_reason = reason;
  rec.updated_at = nowIso();

  pushAudit({
    event_type: "je_reject",
    contract_id: rec.contract_id,
    agent: "HITL-Gate",
    confidence: 1.0,
    payload: { je_id: rec.id, reason },
    user_id: rejectedBy,
  });

  notify();
  return rec;
}

export function cannedRunReversals(): { count: number; reversed: Array<{ id: string; reversal_ref: string }> } {
  // Demo mode: force-reverse every posted JE regardless of reversal_date.
  // Real production logic would gate on `rec.reversal_date <= today`, but in
  // canned mode all fixture JEs have reversal_date in the next period (typical
  // accrual pattern), so a strict date gate would always find zero matches and
  // the demo button would do nothing visible. The button's tooltip already
  // calls this out as a "dev-only" simulator of the SAP auto-reversal batch.
  const reversed: Array<{ id: string; reversal_ref: string }> = [];
  for (const rec of jes) {
    if (rec.status === "posted" && !rec.reversed_at) {
      rec.status = "reversed";
      rec.reversed_at = nowIso();
      rec.reversal_ref = fakeSapDocNumber();
      rec.updated_at = nowIso();
      reversed.push({ id: rec.id, reversal_ref: rec.reversal_ref });
      pushAudit({
        event_type: "je_reversal",
        contract_id: rec.contract_id,
        agent: "Reversal-Batch",
        confidence: 1.0,
        payload: { je_id: rec.id, reversal_ref: rec.reversal_ref, original_doc: rec.posting_ref },
        user_id: "auto-reversed",
      });
    }
  }
  notify();
  return { count: reversed.length, reversed };
}

export function cannedAuditEvents(contractId?: string, limit = 100): AuditEvent[] {
  return events
    .filter((e) => !contractId || e.contract_id === contractId)
    .slice(-limit)
    .reverse();
}

// Force a reversal demo (dev-only): expire today's reversal_date so the next
// runReversals call picks them up.
export function cannedForceReverseAll(): number {
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const rec of jes) {
    if (rec.status === "posted" && !rec.reversed_at) {
      rec.reversal_date = today;
      n++;
    }
  }
  if (n > 0) notify();
  return n;
}
