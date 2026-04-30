import { useEffect, useRef, useState } from "react";
import { askKnowledgeBase, type KBSource } from "@/agents/kb-agent";
import { listContracts, listAllJEs, type ContractSummary, type ProposedJERecord } from "@/lib/api-client";
import { subscribeJEStore } from "@/lib/canned-je-store";
import { IS_CANNED } from "@/config/env";
import { useCloseStore } from "@/store/closeStore";
import { Send, BookOpen, Database } from "lucide-react";

interface Message {
  role: "user" | "bot";
  text: string;
  sources?: KBSource[];
  liveDataUsed?: boolean;
  intent?: string;
  ts: number;
}

const suggestions = [
  "How many contracts?",
  "How much SG&A this period?",
  "What is wholesale revenue?",
  "How much cash do we have?",
  "Tell me about AWS",
  "Highest-risk contract?",
  "Total accrued",
  "What's the 12-week PoV?",
];

export default function CopilotPanel() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [jes, setJes] = useState<ProposedJERecord[]>([]);
  const closeDay = useCloseStore((s) => s.day);
  const activePhase = useCloseStore((s) => s.activePhase);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text:
        "Welcome. I answer questions by searching a knowledge base of facts about NOAH plus computing live answers from your contract + JE state. Try the chips below or ask things like \"which contracts are over $10M\", \"how does auto-reversal work\", or \"why is the High threshold $25M\".",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const [c, j] = await Promise.all([listContracts(), listAllJEs()]);
      setContracts(c);
      setJes(j);
    } catch {
      /* leave previous values */
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!IS_CANNED) return;
    return subscribeJEStore(() => { void refresh(); });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q, ts: Date.now() }]);
    setInput("");
    setTyping(true);
    try {
      const result = await askKnowledgeBase(q, { contracts, jes, closeDay, activePhase });
      // Small delay so the typing indicator is visible at least briefly
      window.setTimeout(() => {
        setMessages((m) => [...m, {
          role: "bot",
          text: result.answer,
          sources: result.sources,
          liveDataUsed: result.liveDataUsed,
          intent: result.intent,
          ts: Date.now(),
        }]);
        setTyping(false);
      }, 300);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "bot",
        text: `Couldn't reach the knowledge base: ${e instanceof Error ? e.message : String(e)}`,
        ts: Date.now(),
      }]);
      setTyping(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">NOAH Help</h1>
        <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
          Retrieval-augmented assistant. Live mode searches a Postgres + pgvector knowledge base via cosine similarity on nomic-embed-text embeddings. Canned mode uses keyword retrieval over the same source-of-truth chunks. Both modes augment with live state — contract counts, JE queue, accrual totals — so answers update as you work through the demo.
        </p>
      </div>

      <div className="bg-brand-surface border border-brand-border flex flex-col h-[560px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[78%] p-3 ${
                m.role === "user"
                  ? "ml-auto bg-brand-accent-dim border border-brand-accent/30"
                  : "bg-brand-surface-alt border border-brand-border"
              }`}
            >
              <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] mb-1 text-brand-text-dim flex items-center gap-2">
                <span>{m.role === "user" ? "You" : "NOAH Orchestrator"}</span>
                {m.role === "bot" && m.intent && (
                  <span className="font-mono text-[9px] text-brand-text-dim normal-case tracking-normal flex items-center gap-1">
                    {m.liveDataUsed ? (
                      <><Database size={9} /> live data</>
                    ) : m.intent === "kb-live" ? (
                      <><BookOpen size={9} /> kb · pgvector</>
                    ) : m.intent === "kb-canned" ? (
                      <><BookOpen size={9} /> kb · keyword</>
                    ) : null}
                  </span>
                )}
              </div>
              <div className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-brand-border space-y-1">
                  <div className="font-display text-[9px] font-bold uppercase tracking-[1.5px] text-brand-text-dim">
                    Sources
                  </div>
                  {m.sources.map((s) => (
                    <div key={s.id} className="text-[10px] text-brand-text-dim font-mono flex items-center gap-2">
                      <span className="text-brand-accent">{s.id}</span>
                      <span>· {s.title}</span>
                      <span>· {s.topic}</span>
                      {s.similarity != null && (
                        <span className="ml-auto">
                          {s.similarity < 1 ? `${(s.similarity * 100).toFixed(1)}%` : `score ${s.similarity.toFixed(1)}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="max-w-[75%] p-3 bg-brand-surface-alt border border-brand-border">
              <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] mb-1 text-brand-text-dim">
                NOAH Orchestrator
              </div>
              <div className="text-sm text-brand-text-muted italic">searching knowledge base…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-1 px-5 py-2 border-t border-brand-border">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { void send(s); }}
              className="font-display text-[10px] font-semibold uppercase tracking-wider border border-brand-border bg-brand-surface-alt px-2 py-1 hover:border-brand-accent hover:text-brand-accent"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2 p-3 border-t border-brand-border"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about contracts, accruals, reversals, materiality, phases…"
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
