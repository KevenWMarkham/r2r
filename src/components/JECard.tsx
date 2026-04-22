import type { ProposedJE } from "@/lib/je-builder";
import clsx from "clsx";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function JECard({ je }: { je: ProposedJE }) {
  const balanced = Math.abs(je.totalDebits - je.totalCredits) < 0.01;
  return (
    <div className="bg-brand-surface border border-brand-border">
      <div className="flex justify-between items-center px-4 py-3 border-b border-brand-border">
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-wider">
            Proposed Journal Entry
          </div>
          <div className="font-mono text-[11px] text-brand-text-dim mt-0.5">
            {je.id} · Period {je.period}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[10px] uppercase text-brand-text-dim tracking-[2px]">
            Reverses
          </div>
          <div className="font-mono text-xs text-brand-text">{je.reversalDate}</div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 font-mono text-xs text-brand-text-muted border-b border-brand-border">
        {je.description}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="font-display text-[10px] font-bold uppercase tracking-[2px] text-brand-text-dim">
            <th className="text-left px-4 py-2">Account</th>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-right px-4 py-2">Debit</th>
            <th className="text-right px-4 py-2">Credit</th>
          </tr>
        </thead>
        <tbody>
          {je.lines.map((line, i) => (
            <tr key={i} className="border-t border-brand-border">
              <td className="px-4 py-2 font-mono text-brand-text">{line.account}</td>
              <td className="px-4 py-2 text-brand-text-muted">{line.accountName}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {line.debit > 0 ? fmt(line.debit) : ""}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {line.credit > 0 ? fmt(line.credit) : ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr
            className={clsx(
              "border-t-2 font-bold",
              balanced ? "border-status-green" : "border-status-red"
            )}
          >
            <td className="px-4 py-2 font-display uppercase tracking-wider text-xs" colSpan={2}>
              Totals
            </td>
            <td className="px-4 py-2 text-right font-mono tabular-nums">
              {fmt(je.totalDebits)}
            </td>
            <td className="px-4 py-2 text-right font-mono tabular-nums">
              {fmt(je.totalCredits)}
            </td>
          </tr>
        </tfoot>
      </table>

      {!balanced && (
        <div className="px-4 py-2 bg-status-red/10 text-status-red text-xs font-mono border-t border-status-red/60">
          WARNING: debits ≠ credits — JE invariant broken
        </div>
      )}
    </div>
  );
}
