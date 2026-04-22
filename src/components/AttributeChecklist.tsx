import {
  CONTRACT_ATTRIBUTE_NAMES,
  ATTRIBUTE_LABELS,
  type ContractAttributes,
} from "@/agents/contract-schema";
import ConfidenceBadge from "./ConfidenceBadge";
import clsx from "clsx";

interface Props {
  attributes: ContractAttributes | Record<string, unknown> | null;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default function AttributeChecklist({ attributes }: Props) {
  if (!attributes) {
    return (
      <div className="text-sm text-brand-text-muted italic">
        Not extracted yet. Run the Extractor agent to populate the 27 attributes.
      </div>
    );
  }

  return (
    <div className="border border-brand-border divide-y divide-brand-border">
      {CONTRACT_ATTRIBUTE_NAMES.map((name) => {
        const field = (attributes as Record<string, unknown>)[name] as
          | { value: unknown; confidence: number; source_page: number | null }
          | undefined;
        const hasData = field && typeof field === "object";
        const val = hasData ? formatValue(field.value) : "—";
        const confidence = hasData ? field.confidence : 0;
        const page = hasData ? field.source_page : null;
        const lowConfidence = hasData && field.confidence < 0.5 && field.value !== null;
        return (
          <div
            key={name}
            className={clsx(
              "grid grid-cols-[200px_1fr_60px_60px] gap-3 px-3 py-2 items-center text-xs",
              lowConfidence && "bg-status-amber/5"
            )}
          >
            <span className="font-display uppercase tracking-wider text-brand-text-dim truncate">
              {ATTRIBUTE_LABELS[name]}
            </span>
            <span
              className={clsx(
                "truncate",
                field?.value === null ? "text-brand-text-dim italic" : "text-brand-text"
              )}
            >
              {val}
            </span>
            <span>{hasData && <ConfidenceBadge score={confidence} />}</span>
            <span className="font-mono text-[10px] text-brand-text-dim text-right">
              {page ? `p. ${page}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
