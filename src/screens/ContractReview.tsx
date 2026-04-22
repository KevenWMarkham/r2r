import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getContract, blobUrl, type ContractDetail } from "@/lib/api-client";
import { ArrowLeft, FileText } from "lucide-react";

export default function ContractReview() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getContract(id).then(setContract).catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <div className="text-status-red">Error: {error}</div>;
  if (!contract) return <div className="text-brand-text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link
        to="/contracts"
        className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-brand-text-muted hover:text-brand-accent"
      >
        <ArrowLeft size={12} /> Back to queue
      </Link>

      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
          {contract.filename}
        </h1>
        <div className="text-sm text-brand-text-muted mt-2 font-mono">
          {contract.file_type.toUpperCase()} · {Number(contract.byte_size).toLocaleString()} bytes ·{" "}
          uploaded {new Date(contract.uploaded_at).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-[2px]">
        <div className="bg-brand-surface border border-brand-border p-5">
          <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
            Document
          </div>
          <a
            href={blobUrl(contract.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-brand-accent hover:underline"
          >
            <FileText size={14} /> Open original file
          </a>
          {contract.full_text && (
            <div className="mt-4 max-h-[480px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-brand-text-muted bg-black/40 border border-brand-border p-3">
              {contract.full_text.slice(0, 4000)}
              {contract.full_text.length > 4000 ? "\n\n…(truncated)" : ""}
            </div>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-border p-5 space-y-4">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
              Metabase Status
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Agent status" value={JSON.stringify(contract.agent_status)} />
              <Row label="Risk" value={contract.risk_category ?? "—"} />
              <Row label="Counterparty" value={contract.counterparty ?? "—"} />
              <Row label="TCV" value={contract.tcv ?? "—"} />
            </div>
          </div>

          <div className="pt-3 border-t border-brand-border">
            <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
              27-Attribute Checklist
            </div>
            <div className="text-xs text-brand-text-muted italic">
              Extractor agent not yet wired (Task 2.2). Attributes will populate here after PS-02.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-brand-border/60 py-1">
      <span className="text-brand-text-dim text-xs uppercase tracking-wider font-display">
        {label}
      </span>
      <span className="text-brand-text font-mono text-xs truncate max-w-[60%]">{value}</span>
    </div>
  );
}
