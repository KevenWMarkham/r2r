import { useCloseStore } from "@/store/closeStore";
import clsx from "clsx";

const kindColor = {
  info: "text-brand-text-muted",
  agent: "text-brand-accent",
  approval: "text-status-green",
} as const;

const kindPrefix = {
  info: "INFO",
  agent: "AGENT",
  approval: "APPROVE",
} as const;

export default function EventLog() {
  const events = useCloseStore((s) => s.events);
  return (
    <div className="bg-black/50 border border-brand-border p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-1">
      {events.length === 0 ? (
        <div className="text-brand-text-dim italic">
          No events yet — press Start to begin the close simulation.
        </div>
      ) : (
        events.map((e, i) => {
          const kind = e.kind ?? "info";
          const time = new Date(e.ts).toLocaleTimeString();
          return (
            <div key={i} className="fade-in flex gap-3">
              <span className="text-brand-text-dim flex-shrink-0">{time}</span>
              <span className={clsx("font-bold flex-shrink-0 w-14", kindColor[kind])}>
                [{kindPrefix[kind]}]
              </span>
              <span className="text-brand-text-muted break-words">{e.text}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
