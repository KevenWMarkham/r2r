import { API_URL, IS_CANNED } from "@/config/env";
import { getFixtureContracts, getFixtureContract } from "./fixtures";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* ignore */ }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Contract types ───────────────────────────────────────────────────────────
export interface ContractSummary {
  id: string;
  filename: string;
  file_type: "pdf" | "docx";
  byte_size: string;
  source: "upload" | "sample_acme" | "sample_user";
  uploaded_at: string;
  risk_category: "High" | "Medium" | "Low" | null;
  risk_score: number | null;
  counterparty: string | null;
  tcv: string | null;
  lease_flagged: boolean | null;
  derivative_flagged: boolean | null;
  agent_status: Record<string, string>;
  updated_at: string;
}

export interface UploadResponse {
  id: string;
  filename: string;
  file_type: "pdf" | "docx";
  sha256: string;
  byte_size: number;
  is_new: boolean;
  embedding_dim: number;
}

export interface ContractDetail extends ContractSummary {
  attributes: Record<string, unknown>;
  risk_reasons: unknown[] | null;
  tech_acct_flags: Record<string, unknown> | null;
  proposed_je: Record<string, unknown> | null;
  narrative: Record<string, unknown> | null;
  full_text: string | null;
}

// ── Health ───────────────────────────────────────────────────────────────────
export async function health(): Promise<{ ok: boolean; db: string }> {
  if (IS_CANNED) return { ok: true, db: "fixtures" };
  return request("/health");
}

// ── Contracts ────────────────────────────────────────────────────────────────
export async function listContracts(): Promise<ContractSummary[]> {
  if (IS_CANNED) return getFixtureContracts();
  return request("/api/contracts");
}

export async function getContract(id: string): Promise<ContractDetail> {
  if (IS_CANNED) {
    const c = getFixtureContract(id);
    if (!c) throw new ApiError("Contract not found", 404);
    return c;
  }
  return request(`/api/contracts/${id}`);
}

export async function uploadContract(file: File): Promise<UploadResponse> {
  if (IS_CANNED) {
    throw new ApiError(
      "Upload is disabled in the Pages demo — run locally in live mode to upload contracts.",
      400
    );
  }
  const form = new FormData();
  form.append("file", file);
  return request("/api/contracts", { method: "POST", body: form });
}

export async function deleteContract(id: string): Promise<void> {
  if (IS_CANNED) throw new ApiError("Delete disabled in canned mode", 400);
  return request(`/api/contracts/${id}`, { method: "DELETE" });
}

export function blobUrl(id: string): string {
  if (IS_CANNED) return "#";
  return `${API_URL}/api/contracts/${id}/blob`;
}

// ── Metabase ─────────────────────────────────────────────────────────────────
export async function patchMetabase(
  contractId: string,
  patch: Partial<{
    attributes: Record<string, unknown>;
    risk_score: number;
    risk_category: "High" | "Medium" | "Low";
    risk_reasons: unknown[];
    tech_acct_flags: Record<string, unknown>;
    proposed_je: Record<string, unknown>;
    narrative: Record<string, unknown>;
    agent_status: Record<string, string>;
  }>
): Promise<ContractDetail> {
  if (IS_CANNED) {
    // In canned mode, fixture data is static — the PATCH is a no-op
    const c = getFixtureContract(contractId);
    if (!c) throw new ApiError("Contract not found", 404);
    return c;
  }
  return request(`/api/metabase/${contractId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── Search ───────────────────────────────────────────────────────────────────
export interface SearchResult {
  id: string;
  filename: string;
  file_type: string;
  byte_size: string;
  risk_category: string | null;
  risk_score: number | null;
  counterparty: string | null;
  contract_type: string | null;
  similarity: number;
}

export async function semanticSearch(query: string, limit = 5): Promise<{ query: string; results: SearchResult[] }> {
  if (IS_CANNED) {
    // Naive canned search: keyword-match against counterparty + filename
    const q = query.toLowerCase();
    const matches = getFixtureContracts()
      .map((c) => ({
        id: c.id,
        filename: c.filename,
        file_type: c.file_type,
        byte_size: c.byte_size,
        risk_category: c.risk_category,
        risk_score: c.risk_score,
        counterparty: c.counterparty,
        contract_type: null as string | null,
        similarity:
          (c.filename.toLowerCase().includes(q) ? 0.9 : 0) +
          (c.counterparty?.toLowerCase().includes(q) ? 0.5 : 0),
      }))
      .filter((r) => r.similarity > 0)
      .slice(0, limit);
    return { query, results: matches };
  }
  return request("/api/search/semantic", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

export async function similarTo(contractId: string, limit = 5) {
  if (IS_CANNED) return { contract_id: contractId, results: [] };
  return request(`/api/search/similar/${contractId}`, {
    method: "POST",
    body: JSON.stringify({ limit }),
  });
}

// ── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEvent {
  id: string;
  event_type: string;
  contract_id: string | null;
  agent: string | null;
  confidence: number | null;
  payload: Record<string, unknown> | null;
  user_id: string | null;
  ts: string;
}

export async function auditEvents(contractId?: string, limit = 100): Promise<AuditEvent[]> {
  if (IS_CANNED) return [];
  const qs = contractId
    ? `?contract_id=${encodeURIComponent(contractId)}&limit=${limit}`
    : `?limit=${limit}`;
  return request(`/api/audit${qs}`);
}

export async function recordAudit(ev: {
  event_type: string;
  contract_id?: string;
  agent?: string;
  confidence?: number;
  payload?: Record<string, unknown>;
  user_id?: string;
}): Promise<AuditEvent> {
  if (IS_CANNED) {
    // Canned mode: no server, return a synthetic audit record
    return {
      id: `audit-${Date.now()}`,
      event_type: ev.event_type,
      contract_id: ev.contract_id ?? null,
      agent: ev.agent ?? null,
      confidence: ev.confidence ?? null,
      payload: ev.payload ?? null,
      user_id: ev.user_id ?? null,
      ts: new Date().toISOString(),
    };
  }
  return request("/api/audit", { method: "POST", body: JSON.stringify(ev) });
}
