# NOAH Prototype — Demo Walkthrough Script

**Audience:** Nike R2R / Controllership stakeholders + Deloitte engagement team
**Duration:** ~30 minutes (20-minute compressed version noted at the end)
**Demo mode:** Canned (`pnpm dev` with `VITE_MODE=canned`) — predictable timing, no Ollama dependency
**Starting URL:** `http://localhost:5175/contracts`

> **Sequencing note:** This script intentionally **starts with Contracts and ends with the Close Cockpit**. Contracts is where the agentic value lands first — extract → risk → tech-acct → accrual → JE → review. The Cockpit closes the demo as the "where this all rolls up" frame.

---

## Table of Contents

| # | Section | Duration | URL |
|---|---------|----------|-----|
| 0 | Pre-flight | 2 min | — |
| 1 | Contracts Queue — process the portfolio | 9 min | `/contracts` |
| 2 | Review Queue — line-level approval + auto-reversal | 7 min | `/review` |
| 3 | Narrative — Variance, Exec, Balance Sheet | 6 min | `/narrative` |
| 4 | NOAH Help — grounded Q&A | 3 min | `/copilot` |
| 5 | Close Cockpit — the orchestration frame | 4 min | `/` |
| 6 | Wrap + questions | 2 min | — |

---

## 0. Pre-flight (2 min, before audience joins)

**You should have done this already, but double-check:**

- [ ] Dev server running on port 5175 (`pnpm dev` — server prints the URL)
- [ ] Browser at `http://localhost:5175/contracts` — Acme Co. theme loads, you see 11 contracts
- [ ] **Reset the canned JE store** by hard-refreshing (Ctrl+Shift+R). The Review Queue should be empty.
- [ ] Close Cockpit is **not started** (Day 0 of 6). You'll start it at the end.
- [ ] Browser zoom at 100%, dev tools closed, no Slack/Teams notifications.

> Optional: open a second tab pointed at `http://localhost:5175/review` — you'll switch to it during Section 2 without losing context.

---

## 1. Contracts Queue — Process the Portfolio (~9 min)

**Goal:** Show the agentic chain that takes raw contracts → 27-attribute extraction → risk score → tech-accounting flags → calculated accrual JEs → submitted to the review queue with materiality routing.

**URL:** `http://localhost:5175/contracts`

### 1.1 Orient the audience (1 min)

**What you do:** Land on the Contracts tab. Point at the table.

**Speaker notes:**

> *"This is the contract queue — 11 contracts seeded for the demo. In production this is the live `contract_metabase` Postgres table. Each row shows what a controller cares about at a glance: counterparty, total contract value with thousand separators, risk category and score, technical-accounting flags (lease and derivative pills), and the agent processing status."*

> *"Notice the risk thresholds reflect Nike scale — High doesn't trigger until TCV is over $25M, with $5M and $1M as the lower bumps. We tuned these together earlier this engagement; a $12M contract at a mid-market client would be High, but at Nike's revenue base it's Medium with a few qualitative flags. The pre-baked scores already reflect that recalibration."*

**Point out:**
- The TCV column has thousand separators (Nike's bigger contracts won't read as a wall of digits)
- Lease/Deriv pills already show on AWS, Atlas Realty, Nexus Cloud
- Risk distribution is 2 High / 6 Medium / 3 Low — visible without clicking anything

### 1.2 Selection model + Run All (2 min)

**What you do:** All checkboxes are ticked by default. Click the header checkbox once to deselect all, then once more to select all again to demonstrate. Click **Run selected (11)**.

**Speaker notes:**

> *"By default we select everything, but the controller picks what to process — maybe you want to defer low-priority contracts to the next batch. Tick or untick whatever you want. The header checkbox is tri-state — if some are selected it shows indeterminate."*

> *"When I click Run selected, NOAH runs three agents in sequence on each contract — extract the 27 attributes, score the risk, flag the technical accounting. Watch the progress bar."*

**While it runs (~50-60s in canned mode):**

> *"In canned mode each step has a synthetic dwell of about a second so you can see the agent activity stream. In live mode that's a real Anthropic API call grounded against the contract text, with Ollama / Qwen 7B as the local-eval option. On Azure AI Foundry with GPU, this whole batch runs in well under a minute."*

### 1.3 Post-run results modal (1.5 min)

**What you do:** When the modal opens, walk the audience through it.

**Speaker notes:**

> *"Once the batch finishes the controller gets a structured prompt — what just happened, broken down by risk so they know where to focus. Two High-risk contracts at the top: AWS at risk score 85 and Nexus at 71. Each contract shows the contributing risk reasons inline — TCV bumps, no liability cap, auto-renewal — so you understand WHY it's High without drilling in."*

> *"Two actions per row — Review and Accrual. Review opens a focused detail modal so I never lose my place in the batch. Let me show you."*

**Click Review on AWS Enterprise.**

> *"Modal stacks on top of the results modal. I can see the risk panel with the contributing factors, the technical accounting findings — ASC 815 derivative review needed because of the cloud-credits commitment indexing — and the full 27-attribute checklist with confidence scores and source page references. When I'm done, I close the review modal and I'm right back at the batch results."*

**Close the review modal. Then close the results modal.**

### 1.4 Calculate Accruals + Submit All (3 min)

**What you do:** Re-tick all if anything got unticked. Click **Calculate accruals (11)**.

**Speaker notes:**

> *"Same selection drives the accrual button. NOAH computes a journal entry for each contract — period-end accrual or prepaid amortization based on the contract's expense recognition method. Watch the progress bar."*

**Modal opens — pause here.**

> *"This is a deliberate two-step flow. NOAH calculates first, surfaces the JEs grouped by where they would route — Manager + Director dual approval over $5M, Manager from $1M to $5M, Senior Accountant from $100K to $1M, auto-post under $100K. The controller sees what's about to happen BEFORE anything hits the system."*

**Point at the groupings.**

> *"For example, AWS at $1.25M routes to the Manager tier. Accenture at $2M routes to Manager. If we'd seeded a $50M contract, it would show up under the dual-approval header so the controller knows two signatures are needed."*

> *"If anything was missing — service start date, fee schedule — it's in the Skipped section with the specific missing fields. Olympic Insurance is a prepaid amortization, not an accrual, so its reversal date is null and the lifecycle reflects that. We don't fake reversal dates on prepaid drawdowns."*

**Click Submit all.**

> *"One click sends every calculated JE to the review queue with the right materiality routing already attached. Watch the rows flip from amber 'calculated' to cyan 'submitted'. Sub-$100K entries auto-post immediately and pick up SAP doc numbers — those bypass the queue entirely."*

**After Submit completes:**

> *"From here the controller goes to the Review Queue to approve. Let me show you that screen."*

**Click Open Review Queue → in the modal footer.**

### 1.5 Likely Q&A — Section 1

**Q: *"How does NOAH know what to extract? Did you train a custom model?"***
A: No custom training. The 27 attributes are defined in `contract-schema.ts` — a structured Zod schema. The agent prompt instructs Claude (or Qwen in local mode) to extract those fields and return JSON. Confidence scores come from the model's self-evaluation. In production with Foundry, this is grounded against your contract repository — DocuSign, Ironclad, Coupa — and runs as a managed agent.

**Q: *"What if extraction is wrong?"***
A: Confidence-weighted UI — fields under 0.5 confidence highlight amber. Source page references on every attribute let the reviewer click straight to the page in the source PDF. We never auto-post extraction outputs; risk + tech-acct + accrual all gate on the extracted attributes, and a missing attribute will skip the contract with a specific gap message rather than hallucinate.

**Q: *"Why is a $12M contract not High risk?"***
A: At Nike's revenue base of ~$51B, a $12M contract is below performance materiality. The risk thresholds we tuned reflect that — High requires TCV >$25M plus other red flags (no liability cap, embedded derivative, etc.). We can resize per client; at a mid-market client the same scoring would put $10M in the High tier.

**Q: *"What's the difference between the structured rules score and the LLM signal?"***
A: Rules score (0-60) covers TCV bumps, auto-renewal, liability cap, lease, derivative — deterministic. LLM signal (0-40) adds qualitative factors — vendor concentration, exclusivity, audit exposure — things the rules miss. Both feed the 0-100 score; categories are >=75 High, >=40 Medium, <40 Low.

**Q: *"Can a single user process all the contracts in parallel?"***
A: Today the demo runs sequentially with explicit progress because in live mode each contract takes 30-90s on Qwen 7B. With Anthropic's API on Foundry we'd parallelize — concurrent calls per contract, with a configurable concurrency limit per tenant. The UX would still gate Submit on a deliberate human click.

---

## 2. Review Queue — Approval + Auto-Reversal (~7 min)

**Goal:** Show what a controller sees when JEs land for approval — line-level detail with Company Code, debit/credit accounts, downloadable calculation worksheet — and the auto-reversal policy.

**URL:** `http://localhost:5175/review` (you should already be here from clicking through)

### 2.1 Layout walkthrough (1 min)

**Speaker notes:**

> *"Two sections: Pending Review at the top — JEs that need a click — and Recent Activity below for posted, reversed, rejected, anything that's already done. The auditor needs both views; you can't drop posted entries from the queue or you lose the audit trail."*

> *"Each row shows what an SAP reviewer actually checks: Company Code 1000 — that's Nike US in this seeded demo, your real bukrs codes would map per legal entity — debit account number with the GL name, debit amount, credit account number, credit amount. No drilling required to verify a JE; the line is on the row."*

> *"Materiality and status pills on the right. Status flips as the JE moves through its lifecycle."*

### 2.2 Click to expand a row (2 min)

**What you do:** Click the chevron on the largest pending JE (probably Accenture or Wieden+Kennedy).

**Speaker notes:**

> *"Click the chevron and the row expands in place — full multi-line journal entry table on the left, lifecycle panel on the right showing the SAP document numbers if posted, the approver, the reversal date, all timestamps. Below that is the calculation narrative — exactly how this number was derived. Straight-line monthly fees over the contract term, fee schedule, billing frequency, the math."*

> *"Click Download and you get a tab-delimited audit-ready worksheet. Your auditors will want this attached to the JE in BlackLine — let's not make controllers reconstruct it from a screenshot."*

**Click Download to demonstrate.**

> *"The worksheet includes the full JE body, the supporting calculation reasoning, and the SAP doc numbers. Drop it in the work papers."*

### 2.3 Approve a JE — show auto-reversal scheduling (2 min)

**What you do:** Pick a pending JE that has a reversal date (Accenture or Wieden+Kennedy work). Click **Approve**.

**Speaker notes:**

> *"One click. NOAH's Posting Agent calls BlackLine which calls SAP `BAPI_ACC_DOCUMENT_POST`. The original entry posts immediately with a fresh SAP document number — visible in the lifecycle panel. The reversal status reads 'Scheduled 2026-05-01' — a date, not a SAP doc, because the reversal hasn't fired yet."*

> *"This matches Nike's actual policy. Accrual reversals inherit approval from the original entry — they're mechanical undo entries on the reversal date, no separate human sign-off. SAP F.81 / BlackLine handle this in production; we're modeling the same policy in canned mode."*

### 2.4 Demo advance clock — show reversal flip (1 min)

**What you do:** Click **(Demo) advance clock** in the top right.

**Speaker notes:**

> *"This button is a presenter aid only — it's labeled (Demo). In production the calendar drives the reversal; the controller never clicks anything. But for this demo I'll fast-forward."*

**Click it.**

> *"The reversal posts. Same approver authority — the audit trail records the reversal under the original Manager, not a new sign-off. The JE moves to Reversed status with the second SAP doc number visible in the lifecycle. Net balance-sheet impact is zero, exactly as it should be."*

### 2.5 Likely Q&A — Section 2

**Q: *"What about dual approval over $5M? Does it require two clicks?"***
A: Today the prototype shows the **routing label** — *"Manager + Director (Dual)"* — but a single approve click still posts. Real dual-approval gating with two distinct sign-off states is on the roadmap; it requires backend state to track manager-approved + director-approved separately and only post when both are recorded. Easy to implement; deliberate scope choice for this prototype.

**Q: *"Can a controller reject a JE? What happens?"***
A: Yes — Reject opens an inline reason input. The JE moves to Rejected status with the reason in the audit trail. The Senior Accountant who prepared it sees the rejection and can recalculate with corrected inputs.

**Q: *"How does this integrate with BlackLine specifically?"***
A: BlackLine sits between NOAH and SAP. NOAH posts to BlackLine's API; BlackLine handles certification workflows, transaction matching, and the SAP `BAPI_ACC_DOCUMENT_POST` call. Reversal batches use BlackLine Smart Close which calls SAP F.81. We're not replacing BlackLine — we're feeding it.

**Q: *"What if the reversal period is closed?"***
A: Production gating: if the period is hard-closed, the reversal can't post and routes to an exception queue for manual review. The prototype doesn't yet model period-close gates — flag for the roadmap.

**Q: *"Where's the audit trail?"***
A: Every state transition pushes an audit event — `je_submit`, `je_approve`, `je_post`, `je_reversal`. In live mode these write to a `noah_audit_log` table with timestamps, user IDs, agent IDs, confidence scores, and the full JE payload. We can add an Audit timeline screen as a separate view if reviewers want it surfaced (currently there's a route at `/contracts/:id/audit`).

---

## 3. Narrative — Variance, Exec, Balance Sheet (~6 min)

**Goal:** Show the three narrative deliverables — line-item variance commentary, executive close summary, and a contract-driven balance sheet view.

**URL:** `http://localhost:5175/narrative`

### 3.1 Variance Commentary (2 min)

**What you do:** Click on a P&L line — Direct-to-Consumer Revenue is a good lead. Click **Generate**.

**Speaker notes:**

> *"P&L vs prior period, sortable by variance. Click any line, click Generate, and Claude drafts 2-3 sentences of CFO-memo-tone commentary. Notice the prompt forbids fabrication — every dollar in the commentary traces back to the data we passed in. The confidence badge shows how strongly the model rates its own output."*

> *"Generate All runs the whole table — useful at quarter-end when you need every line covered."*

> *"In live mode this calls Anthropic with cache control on the system prompt, so re-running across many lines is cheap. The schema enforces JSON structure — commentary, key drivers, risk flags, confidence — so the output drops straight into your reporting templates."*

### 3.2 Executive Summary (1.5 min)

**Click the Executive Summary tab.**

**Speaker notes:**

> *"One level up — this drafts the close summary the CFO sends to the board. Pulls the top 3 dollar variances from the P&L plus close metrics from the Cockpit — currently idle so we fall back to a 5.2-day baseline. When the Cockpit is running, this would read 'Day 4 of 6 · CONSOLIDATE' instead."*

**Click Generate.**

> *"Headline, three-to-five highlights, two-to-three risks, one recommendation — all grounded in the structured inputs. Voice is concise, neutral, board-ready. Copy or print straight to the deck."*

### 3.3 Balance Sheet — the contract-grounded line item (2.5 min)

**Click the Balance Sheet tab.**

**Speaker notes:**

> *"Same layout pattern as P&L Variance Commentary — line items on the left, period end vs prior year end with variance dollar and percent, commentary panel on the right. Thirteen line items across Current Asset, Non-Current Asset, Current Liability, Non-Current Liability, Equity."*

**Point at the Accrued Liabilities row — it has a CONTRACTS chip.**

> *"This row is special. The Accrued Liabilities current period balance isn't just seeded — it's the seeded BAU base PLUS the live sum of credits to GL 2310 from the JEs we just submitted on the Contracts page. The variance reflects what we processed today."*

**Click Generate on the Accrued Liabilities row.**

> *"The commentary names the actual reviewed contracts — Amazon Web Services, Accenture, the rest. It cites the materiality-routing breakdown by tier, scheduled auto-reversals from the original approval, and ASC 842/815 flags from the contributing contracts. None of this is hand-written narrative; it's deterministic composition from the live JE store and the contract metadata."*

> *"Click Generate on any other line — say Inventories or PP&E — and you'll see commentary based on the seeded driver text plus an automatic disclosure flag if the YoY move is over 10%. The pattern is the same; the data sources differ."*

### 3.4 Likely Q&A — Section 3

**Q: *"How do we make sure the LLM doesn't make up numbers?"***
A: Three layers. First, the system prompt explicitly forbids fabrication ("use ONLY numbers provided"). Second, JSON schema validation rejects malformed output. Third, the inputs are passed structured — line item, current period, prior period, variance, drivers — so the model has no incentive to invent numbers. For the Balance Sheet accrued line, narrative is **deterministic** (no LLM) — we compose the prose from the JE rollup directly.

**Q: *"Is the variance commentary pulling from real numbers, or are these fixtures?"***
A: Today both sides — `seedPnL` is hand-curated Nike-shaped quarterly figures. In live mode this connects to your reporting cube (Foundry / Power BI dataset) and pulls the actual quarterly close. The agent layer is identical; only the data source changes.

**Q: *"Can we customize the voice / template?"***
A: Yes. The system prompts in `narrative.ts` are configurable per tenant — voice, tone, structure (sentence count, bullet count, recommendation format). For Nike specifically we'd match your existing earnings-script style.

**Q: *"What if I disagree with the commentary?"***
A: Commentary is a draft, not a final. Copy button → paste into your editor → revise. Confidence badge tells you whether to trust it as-is or rewrite. We're not replacing the controller's judgment — we're getting the first draft to 80%.

**Q: *"How does the Balance Sheet stay in sync if I post a new accrual?"***
A: It subscribes to the canned JE store in this prototype; in live mode it reads the same `proposed_je` Postgres table on a refresh. Submit a new JE on /contracts and refresh /narrative → Balance Sheet — Accrued Liabilities updates with the new contract in the contributors list.

---

## 4. NOAH Help — Grounded Q&A (~3 min)

**Goal:** Show the assistant pane that knows the current state of the demo — contract counts, pending JEs, scheduled reversals — and answers specific questions distinctly.

**URL:** `http://localhost:5175/copilot`

### 4.1 Demonstrate the suggestion chips (2 min)

**What you do:** Click each chip in turn, narrating as you go.

**Click "How many contracts?"**

> *"Live count — 11 contracts, the actual risk distribution from what's in the queue right now. If I delete a fixture and refresh, this number changes."*

**Click "Highest-risk contract?"**

> *"Names the High-risk contracts with TCV and score. Notice this is a different answer to the same topic — old version returned the same response for any question containing the word 'contract'."*

**Click "Total accrued"**

> *"Pulls the sum of credits to GL 2310 from the JE store — should match what we just submitted. Posted vs pending split, plus a pointer to the Balance Sheet tab."*

**Click "Pending review"**

> *"Counts by routing tier — dual approval, Manager, Senior Accountant — with names of the top three pending. Updates when I approve a JE."*

**Click "Reversals"**

> *"Shows scheduled and completed reversals with the policy reminder — auto-post on reversal_date, no separate sign-off, matches SAP F.81 / BlackLine."*

**Click "Top variance"**

> *"Top three P&L variances pulled from the same `seedPnL` data the Variance Commentary tab uses. Consistency across the app."*

**Click "Close status"**

> *"Cockpit is idle — that's accurate, we haven't started it yet. When we do, this reads the actual current day and phase."*

### 4.2 Type a custom question (1 min)

**What you do:** Type *"how do I process a contract?"* and send.

**Speaker notes:**

> *"Free-text questions also work. The matcher is regex-based today — in production this is a Copilot Studio agent grounded over your close data with full conversational context. The point of the prototype is to show that the answer adapts to what the user actually sees in the app, not a static FAQ."*

### 4.3 Likely Q&A — Section 4

**Q: *"This is canned. How does it work in production?"***
A: Production wraps a Copilot Studio agent with knowledge grounding over `contract_metabase`, `proposed_je`, the audit log, and your reporting cube. The same intent matchers we use in canned mode become tools the agent calls — `getContractCount`, `getPendingJEs`, etc. — so the prose is generated by Claude with cited tool outputs. Conversational state, follow-up questions, all native.

**Q: *"Why is the demo answer so structured?"***
A: Deliberate. In a prototype demo we'd rather show predictable, accurate answers than have the model occasionally hallucinate. In production the Copilot Studio agent has real grounding — same accuracy, more natural prose.

**Q: *"Can it answer questions about a specific contract?"***
A: Roadmap. The matchers today don't parse counterparty names — adding *"how risky is the AWS contract"* requires either a NER pass or routing to the contract detail. Trivial in production where we're not pattern-matching.

---

## 5. Close Cockpit — The Orchestration Frame (~4 min)

**Goal:** Show how everything we just demonstrated fits inside the broader R2R close cycle.

**URL:** `http://localhost:5175/`

### 5.1 Orient the audience (1 min)

**Speaker notes:**

> *"This is where a controller starts their day during close. Five phases left to right — Pre-Close on Day -1 and before, Execute Day 1-3, Consolidate Day 4, Validate Day 5-6, Gate Day 6. Six entities running in parallel — NA, EMEA, Greater China, APLA, Corporate, Global. Each phase has Foundry / BlackLine / SAP integrations behind it; the Cockpit visualizes orchestration without making the controller babysit the pipelines."*

> *"Everything we just walked through happens inside Phase 2 (Execute) and Phase 3 (Consolidate) — contract review, accrual JEs, posting to SAP. The other phases handle pre-close readiness scans, balance validation, and the Gate sign-off."*

### 5.2 Start the simulation (2 min)

**What you do:** Click **Start**. Let it tick through all phases.

**Speaker notes:**

> *"Click Start. The simulation ticks once per second — six ticks for six sim days. Watch the entity progression on the right; NA leads, then the others stagger in. Phase chips light up cyan when active, green when complete."*

> *"The event log on the right captures every phase transition with a timestamp. In production this is a real activity stream — Foundry job completions, BlackLine certifications, SAP postings, exceptions routed to controllers. The Cockpit doesn't generate the events; it surfaces them."*

**As phases advance:**

> *"Pre-Close — Foundry's predictive model flags at-risk accounts before the period even closes. The Readiness Report posts to Teams."*

> *"Execute — BlackLine Smart Close triggers SAP jobs. Event Grid monitors for failures; the JE postings we did earlier flow through here."*

> *"Consolidate — subsidiary entries roll up; eliminations and FX translation post; group totals lock."*

> *"Validate — recon agent checks. The Narrative agent drafts variance commentary. NOAH generates the executive summary."*

> *"Gate — exceptions are below materiality, controller signs off, period closes. Cycle complete."*

### 5.3 Tie it back (1 min)

**Speaker notes:**

> *"This is the frame. Inside it, the work we showed earlier is real — contract extraction, accrual JEs, narrative drafting. The Cockpit doesn't do the work; it shows that all the work is happening, where each agent is in its lifecycle, and what needs human eyes. The win for Nike is that a controller spends close week answering questions and reviewing exceptions, not chasing reconciliations."*

### 5.4 Likely Q&A — Section 5

**Q: *"How long does Nike's actual close take today?"***
A: That's a discovery question — varies by entity. Industry benchmark for consumer brands at this scale is 5-8 business days. The Cockpit's 6-day target is illustrative; we'd tune to your actual cycle and show variance against your target.

**Q: *"What if a phase fails?"***
A: Production: exceptions route to a triage queue. The Cockpit surfaces them as red badges on the affected phase, with a click-through to the specific failure (a SAP job error, a BlackLine certification reject, a recon difference above materiality). The simulation doesn't model failure today; we can add a "demo failure" toggle if useful.

**Q: *"Does the Cockpit work without all the underlying agents?"***
A: It needs the data feeds — phase status, entity status, event stream — but those don't have to be Anthropic agents. You could light up the Cockpit with just Foundry + SAP + BlackLine and incrementally add agents (extraction, narrative, etc.) as you adopt them. It's a visualization layer over real orchestration.

**Q: *"Who's the audience for the Cockpit screen?"***
A: VP Controlling and the close team. Below that level, controllers live in /contracts and /review where the actual decisions happen. Above that level, CFO/audit lives in /narrative for the deliverables. Cockpit is the operational view for whoever owns the close cycle.

---

## 6. Wrap (~2 min)

**Speaker notes:**

> *"Quick recap of what we showed: 1) eleven contracts processed end-to-end through extract / risk / tech-acct in roughly a minute; 2) accruals calculated, routed by materiality, and submitted with one click; 3) line-level approval in the Review Queue with downloadable audit-ready worksheets and policy-correct auto-reversals; 4) variance, executive, and balance-sheet narratives — the balance sheet specifically grounded in the contracts we just reviewed; 5) a grounded Q&A assistant that knows the live state of the close; and 6) the Cockpit frame that ties it all together."*

> *"What I'd want from you: where does this map to your current pain? What's missing that would block adoption? What would you want to add to a 90-day pilot scope?"*

**Open the floor.**

---

## Compressed 20-Minute Version

If you only have 20 minutes, drop these sections:

| Section | Skip? | Save |
|---------|-------|------|
| 1. Contracts | Keep all | — |
| 2. Review Queue | Skip 2.4 (advance clock demo) | 2 min |
| 3. Narrative | Skip Variance Commentary; show only Exec + Balance Sheet | 2 min |
| 4. NOAH Help | Show 2 chips only | 2 min |
| 5. Cockpit | Skip Q&A | 2 min |

That's a 22-minute walkthrough — pulls the audience through the highest-value moments (Contracts → Review → Balance Sheet → Cockpit) without losing the narrative arc.

---

## Speaker Reference Card (Print This)

| Cue | URL | Click Path |
|-----|-----|------------|
| Open | `/contracts` | (default) |
| Run extract | `/contracts` | Header checkbox → Run selected |
| Calculate | `/contracts` | Calculate accruals → Submit all |
| Approve | `/review` | Expand row → Approve |
| Advance clock | `/review` | (Demo) advance clock |
| Variance | `/narrative` | Variance Commentary → Generate on a row |
| Exec | `/narrative?tab=exec` | Generate close narrative |
| Balance Sheet | `/narrative?tab=balance-sheet` | Generate on Accrued Liabilities |
| NOAH Help | `/copilot` | Click chips |
| Cockpit | `/` | Start |

## Disclosure / Caveats to Mention When Asked

- Risk thresholds (`>$25M` High) reflect Nike scale — tunable per tenant.
- Dual-approval over $5M is **labeled but single-click** in this prototype.
- Auto-reversal compresses time; production gates on calendar reversal_date with exception handling for closed periods.
- All numbers are synthetic — Nike-shaped, not Nike-actual.
- Canned mode runs without Ollama; live mode requires Qwen 7B locally OR the Anthropic API.
