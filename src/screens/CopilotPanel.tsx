import { useEffect, useRef, useState } from "react";
import { cannedAnswers } from "@/data/copilot-canned-answers";
import { Send } from "lucide-react";

interface Message {
  role: "user" | "bot";
  text: string;
  ts: number;
}

const suggestions = ["Close status", "Exceptions", "Contracts", "Accruals", "Variance commentary"];

export default function CopilotPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text:
        "Welcome. I can help with close status, recon exceptions, contracts, entities, accruals, variance commentary, and executive summaries. What do you need?",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q, ts: Date.now() }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      const reply = cannedAnswers.find((a) => a.match.test(q))?.reply ??
        "I can help with close status, exceptions, contracts, entities, accruals, variance commentary, and executive summaries.";
      setMessages((m) => [...m, { role: "bot", text: reply, ts: Date.now() }]);
      setTyping(false);
    }, 450);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">NOAH Help</h1>
        <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
          Scripted Teams-style assistant panel. In production, this would route to a NOAH-grounded
          Copilot Studio agent with knowledge grounding over Nike's close data.
        </p>
      </div>

      <div className="bg-brand-surface border border-brand-border flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[75%] p-3 ${
                m.role === "user"
                  ? "ml-auto bg-brand-accent-dim border border-brand-accent/30"
                  : "bg-brand-surface-alt border border-brand-border"
              }`}
            >
              <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] mb-1 text-brand-text-dim">
                {m.role === "user" ? "You" : "NOAH Orchestrator"}
              </div>
              <div className="text-sm text-brand-text leading-relaxed">{m.text}</div>
            </div>
          ))}
          {typing && (
            <div className="max-w-[75%] p-3 bg-brand-surface-alt border border-brand-border">
              <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] mb-1 text-brand-text-dim">
                NOAH Orchestrator
              </div>
              <div className="text-sm text-brand-text-muted italic">typing…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-1 px-5 py-2 border-t border-brand-border">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="font-display text-[10px] font-semibold uppercase tracking-wider border border-brand-border bg-brand-surface-alt px-2 py-1 hover:border-brand-accent hover:text-brand-accent"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 p-3 border-t border-brand-border"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about close status, exceptions, contracts…"
            className="flex-1 bg-brand-surface-alt border border-brand-border text-brand-text px-3 py-2 text-sm focus:outline-none focus:border-brand-accent font-body"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-accent text-black font-display font-bold uppercase text-xs tracking-wider hover:opacity-80 flex items-center gap-1"
          >
            <Send size={12} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
