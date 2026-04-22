import { useEffect, useState } from "react";
import { listContracts, uploadContract, type ContractSummary } from "@/lib/api-client";
import { FileText, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

export default function ContractQueue() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listContracts();
      setContracts(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadContract(file);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">Contracts</h1>
        <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
          Risk-ranked contract queue. Upload a .pdf or .docx — NOAH extracts 27 attributes, scores
          risk, flags technical accounting (ASC 840/842/815), and proposes accruals.
        </p>
      </div>

      <label className="block cursor-pointer">
        <input
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={(e) => onUpload(e.target.files)}
          className="hidden"
          disabled={uploading}
        />
        <div
          className={clsx(
            "border-2 border-dashed p-10 text-center transition-colors",
            uploading
              ? "border-status-amber bg-status-amber/10"
              : "border-brand-border hover:border-brand-accent hover:bg-brand-accent-dim"
          )}
        >
          <Upload className="mx-auto mb-2" size={24} />
          <div className="font-display text-sm uppercase tracking-[1px] text-brand-text-muted">
            {uploading ? "Uploading + embedding…" : "Drop .pdf / .docx or click to upload"}
          </div>
          <div className="text-xs text-brand-text-dim mt-1 font-mono">
            Server extracts text, generates embedding, stores in metabase
          </div>
        </div>
      </label>

      {error && (
        <div className="border border-status-red/60 bg-status-red/10 text-status-red p-3 text-sm font-mono">
          Error: {error}
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_120px_120px_100px] gap-2 px-4 py-3 border-b border-brand-border font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
          <span />
          <span>Filename</span>
          <span>Counterparty</span>
          <span>Source</span>
          <span>Risk</span>
          <span>Status</span>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-brand-text-muted">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-brand-text-muted">
            No contracts yet. Upload one above or run <code className="font-mono">pnpm seed</code> in the server.
          </div>
        ) : (
          contracts.map((c) => (
            <Link
              key={c.id}
              to={`/contracts/${c.id}`}
              className="grid grid-cols-[auto_1fr_1fr_120px_120px_100px] gap-2 px-4 py-3 items-center border-b border-brand-border hover:bg-brand-accent-dim transition-colors"
            >
              <FileText size={16} className="text-brand-text-dim" />
              <span className="text-sm truncate">{c.filename}</span>
              <span className="text-sm text-brand-text-muted truncate">
                {c.counterparty ?? "—"}
              </span>
              <span className="font-mono text-[10px] uppercase text-brand-text-dim">
                {c.source.replace("sample_", "")}
              </span>
              <span>
                {c.risk_category ? (
                  <span
                    className={clsx(
                      "font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border",
                      c.risk_category === "High" &&
                        "text-status-red border-status-red/60 bg-status-red/10",
                      c.risk_category === "Medium" &&
                        "text-status-amber border-status-amber/60 bg-status-amber/10",
                      c.risk_category === "Low" &&
                        "text-status-green border-status-green/60 bg-status-green/10"
                    )}
                  >
                    {c.risk_category}
                    {c.risk_score !== null ? ` · ${c.risk_score}` : ""}
                  </span>
                ) : (
                  <span className="text-[10px] text-brand-text-dim font-mono">—</span>
                )}
              </span>
              <span className="font-mono text-[10px] text-brand-text-dim uppercase">
                {c.agent_status.extract ?? "pending"}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
