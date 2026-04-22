export default function Narrative() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">Narrative</h1>
      <p className="text-sm text-brand-text-muted max-w-2xl">
        UC-18 Variance Commentary + UC-20 Executive Close Narrative. Implementation lands in PS-05
        (see <code className="font-mono">PLAN.md</code>, Tasks 5.1–5.6).
      </p>
      <div className="border border-brand-border bg-brand-surface p-5 text-sm text-brand-text-muted">
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
          Placeholder
        </div>
        Two tabs will live here: <strong>Variance Commentary</strong> (P&L line items + per-row
        Generate) and <strong>Executive Summary</strong> (one-click close narrative).
      </div>
    </div>
  );
}
