import { useCloseStore, type Entity } from "@/store/closeStore";
import clsx from "clsx";

const entityLabels: Record<Entity, string> = {
  NA: "North America",
  EMEA: "EMEA",
  GC: "Greater China",
  APLA: "Asia Pacific Latin America",
  Corp: "Corporate",
  Global: "Global Consolidation",
};

export default function EntityList() {
  const entities = useCloseStore((s) => s.entities);
  const order: Entity[] = ["NA", "EMEA", "GC", "APLA", "Corp", "Global"];
  return (
    <div className="space-y-[2px]">
      {order.map((e) => {
        const state = entities[e];
        return (
          <div
            key={e}
            className={clsx(
              "flex items-center justify-between px-3 py-2 text-xs font-medium border transition-all",
              state === "idle" && "bg-brand-surface-alt border-brand-border text-brand-text-muted",
              state === "processing" && "bg-status-amber/10 border-status-amber/60 text-brand-text",
              state === "complete" && "bg-status-green/10 border-status-green/60 text-brand-text"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-[10px] text-brand-text-dim w-10">{e}</span>
              <span className="truncate">{entityLabels[e]}</span>
            </span>
            <span
              className={clsx(
                "w-2 h-2 rounded-full flex-shrink-0",
                state === "idle" && "bg-brand-text-dim",
                state === "processing" && "bg-status-amber pulse-dot",
                state === "complete" && "bg-status-green"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
