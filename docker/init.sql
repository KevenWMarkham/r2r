-- NOAH Prototype — PostgreSQL initialization
-- Runs once on first container start (mounted at /docker-entrypoint-initdb.d/)

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- =============================================================================
-- contracts — blob storage for uploaded contracts
-- =============================================================================
CREATE TABLE IF NOT EXISTS contracts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename      TEXT NOT NULL,
    file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    bytes         BYTEA NOT NULL,
    sha256        TEXT NOT NULL UNIQUE,
    byte_size     BIGINT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'sample_acme', 'sample_user')),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_sha256   ON contracts(sha256);
CREATE INDEX IF NOT EXISTS idx_contracts_uploaded ON contracts(uploaded_at DESC);

COMMENT ON TABLE contracts IS 'Blob storage for contract documents. Files stored as BYTEA (bytes). sha256 enforces dedup.';

-- =============================================================================
-- contract_metabase — metadata catalog + vector embeddings for semantic search
-- =============================================================================
CREATE TABLE IF NOT EXISTS contract_metabase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    -- 27 structured attributes extracted by the Extractor agent (UC-07)
    attributes      JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Agent-derived fields
    risk_score      INT,
    risk_category   TEXT CHECK (risk_category IN ('High', 'Medium', 'Low')),
    risk_reasons    JSONB,
    tech_acct_flags JSONB,

    -- Full extracted text (LLM context + embedding source)
    full_text       TEXT,

    -- Vector embedding of full_text (nomic-embed-text → 768 dims)
    embedding       VECTOR(768),

    -- Downstream agent outputs
    proposed_je     JSONB,
    narrative       JSONB,

    -- Per-agent lifecycle status: {extract: "done"|"pending"|"failed", risk: ..., ...}
    agent_status    JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (contract_id)
);

-- Lookups
CREATE INDEX IF NOT EXISTS idx_metabase_contract_id ON contract_metabase(contract_id);

-- JSONB querying over structured attributes
CREATE INDEX IF NOT EXISTS idx_metabase_attributes ON contract_metabase USING gin(attributes);

-- Vector similarity index (cosine).
-- Using HNSW: better than ivfflat for small prototype datasets (ivfflat needs
-- training data before lists can be meaningful; with <100 rows it aggressively
-- under-returns). HNSW works well from row 1 and scales to millions.
CREATE INDEX IF NOT EXISTS idx_metabase_embedding ON contract_metabase
    USING hnsw (embedding vector_cosine_ops);

COMMENT ON COLUMN contract_metabase.embedding IS 'Vector embedding of full_text via nomic-embed-text (768 dims). Use cosine similarity for semantic search.';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_metabase_touch ON contract_metabase;
CREATE TRIGGER trg_metabase_touch
  BEFORE UPDATE ON contract_metabase
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- audit_events — SOX-style traceability (UC-23, UC-24 scaffolding)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,                   -- upload | extract | risk | tech_acct | accrual | approve | narrative
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    agent       TEXT,                            -- which agent produced this event
    confidence  FLOAT,
    payload     JSONB,
    user_id     TEXT,                            -- presenter/demo user
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts       ON audit_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type     ON audit_events(event_type);

-- =============================================================================
-- pnl_lines — seed P&L data for Narrative Agent (UC-18, UC-20)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pnl_lines (
    id              TEXT PRIMARY KEY,
    line_item       TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('Revenue', 'COGS', 'Opex', 'Below-Line')),
    current_period  NUMERIC(18, 2) NOT NULL,
    prior_period    NUMERIC(18, 2) NOT NULL,
    variance        NUMERIC(18, 2) GENERATED ALWAYS AS (current_period - prior_period) STORED,
    variance_pct    NUMERIC(6, 2),
    driver          TEXT,
    entity_split    JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE pnl_lines IS 'Seed P&L data powering UC-18 Variance Commentary and UC-20 Executive Narrative.';

-- =============================================================================
-- Dev convenience view — one-row summary per contract
-- =============================================================================
CREATE OR REPLACE VIEW v_contract_summary AS
SELECT
    c.id,
    c.filename,
    c.file_type,
    c.byte_size,
    c.source,
    c.uploaded_at,
    m.risk_category,
    m.risk_score,
    m.attributes->>'counterparty' AS counterparty,
    m.attributes->>'total_contract_value' AS tcv,
    (m.tech_acct_flags->'lease'->>'flagged')::BOOLEAN AS lease_flagged,
    (m.tech_acct_flags->'derivative'->>'flagged')::BOOLEAN AS derivative_flagged,
    m.agent_status,
    m.updated_at
FROM contracts c
LEFT JOIN contract_metabase m ON m.contract_id = c.id
ORDER BY c.uploaded_at DESC;
