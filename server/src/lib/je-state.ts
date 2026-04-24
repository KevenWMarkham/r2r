// JE state transition validator. Enforces legal transitions so bad code
// paths (and bad actors) can't leapfrog approval steps.

export type JEStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "posted"
  | "reversed"
  | "voided";

const LEGAL: Record<JEStatus, JEStatus[]> = {
  draft:     ["submitted", "voided"],
  submitted: ["approved", "rejected", "voided"],
  approved:  ["posted", "voided"],
  rejected:  ["draft", "voided"],          // back to Marcus
  posted:    ["reversed", "voided"],
  reversed:  [],                            // terminal
  voided:    [],                            // terminal
};

export class IllegalTransitionError extends Error {
  constructor(from: JEStatus, to: JEStatus) {
    super(`Illegal JE transition: ${from} → ${to}. Legal next states: ${LEGAL[from].join(", ") || "(none)"}`);
  }
}

export function assertTransition(from: JEStatus, to: JEStatus): void {
  if (!LEGAL[from]?.includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
}
