export default function AccrualProposal() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
        Accrual Proposal
      </h1>
      <p className="text-sm text-brand-text-muted max-w-2xl">
        UC-10 — Accrual extraction → deterministic math → proposed JE. Implementation lands in PS-04
        (see <code className="font-mono">PLAN.md</code>, Tasks 4.1–4.5).
      </p>
      <div className="border border-brand-border bg-brand-surface p-5 text-sm text-brand-text-muted">
        <div className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim mb-2">
          Placeholder
        </div>
        This screen will render the proposed journal entry (T-account form), calc detail, clause
        traceability, and approve/reject actions.
      </div>
    </div>
  );
}
