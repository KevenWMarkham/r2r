/* eslint-disable */
// Build DEMO_SCRIPT.docx from the markdown source. One-shot; no markdown parser
// — content is hand-modeled here so we get full control of typography.

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  TabStopType, TabStopPosition, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak,
} = require("docx");

// Page constants — US Letter, 1" margins
const PAGE_WIDTH = 12240;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

// Color palette — Deloitte greens + neutrals
const C_PRIMARY = "0E7C3A";      // forest green
const C_DARK = "1F1F1F";
const C_BODY = "333333";
const C_MUTED = "666666";
const C_BORDER = "CCCCCC";
const C_NOTE_BG = "EAF6EE";      // pale green for speaker notes
const C_QUOTE_BG = "F5F5F5";     // pale grey for spoken text quotes
const C_TIP_BG = "FFF8E1";       // pale yellow for tip / sequencing note
const C_TABLE_HDR = "0E7C3A";

const border = { style: BorderStyle.SINGLE, size: 4, color: C_BORDER };
const cellBorders = { top: border, bottom: border, left: border, right: border };

// ── Builders ───────────────────────────────────────────────────────────────────

const para = (text, opts = {}) => new Paragraph({
  spacing: { before: opts.before ?? 80, after: opts.after ?? 80 },
  alignment: opts.align,
  ...opts.paraProps,
  children: Array.isArray(text)
    ? text
    : [new TextRun({ text, font: "Arial", size: opts.size ?? 22, color: opts.color ?? C_BODY, bold: opts.bold, italics: opts.italics })],
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 200 },
  children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: C_PRIMARY })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: C_DARK })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: C_PRIMARY })],
});

// Bold-prefixed line: "**Label:** body text"
const labeled = (label, body, opts = {}) => para([
  new TextRun({ text: label, font: "Arial", size: 22, bold: true, color: opts.labelColor ?? C_DARK }),
  new TextRun({ text: " " + body, font: "Arial", size: 22, color: C_BODY }),
], { before: 60, after: 60 });

// Speaker quote — italic, indented, light grey background via a single-cell table
const quote = (text) => new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: [CONTENT_WIDTH],
  rows: [new TableRow({
    children: [new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: C_PRIMARY },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: C_PRIMARY },
        left: { style: BorderStyle.SINGLE, size: 24, color: C_PRIMARY },
        right: { style: BorderStyle.SINGLE, size: 4, color: C_PRIMARY },
      },
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      shading: { fill: C_QUOTE_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 160 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, font: "Arial", size: 22, italics: true, color: C_DARK })],
      })],
    })],
  })],
});

// Tip / sequencing note — yellow tint
const tipBox = (text) => new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: [CONTENT_WIDTH],
  rows: [new TableRow({
    children: [new TableCell({
      borders: cellBorders,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      shading: { fill: C_TIP_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: text,
      })],
    })],
  })],
});

// Q&A pair — bold question, regular answer
const qa = (q, a) => [
  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [
      new TextRun({ text: "Q: ", font: "Arial", size: 22, bold: true, color: C_PRIMARY }),
      new TextRun({ text: q, font: "Arial", size: 22, italics: true, bold: true, color: C_DARK }),
    ],
  }),
  new Paragraph({
    spacing: { before: 0, after: 120 },
    indent: { left: 240 },
    children: [
      new TextRun({ text: "A: ", font: "Arial", size: 22, bold: true, color: C_BODY }),
      new TextRun({ text: a, font: "Arial", size: 22, color: C_BODY }),
    ],
  }),
];

// Bullet list paragraph
const bullet = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { before: 40, after: 40 },
  children: Array.isArray(text)
    ? text
    : [new TextRun({ text, font: "Arial", size: 22, color: C_BODY })],
});

// Standard table builder
function buildTable(rows, columnWidths) {
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    rows: rows.map((row, rIdx) => new TableRow({
      tableHeader: rIdx === 0,
      children: row.map((cellText, cIdx) => new TableCell({
        borders: cellBorders,
        width: { size: columnWidths[cIdx], type: WidthType.DXA },
        shading: rIdx === 0 ? { fill: C_TABLE_HDR, type: ShadingType.CLEAR } : undefined,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({
            text: cellText,
            font: "Arial",
            size: 22,
            bold: rIdx === 0,
            color: rIdx === 0 ? "FFFFFF" : C_BODY,
          })],
        })],
      })),
    })),
  });
}

// Convenience — divider rule
const divider = () => new Paragraph({
  spacing: { before: 200, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C_PRIMARY, space: 1 } },
  children: [new TextRun({ text: "" })],
});

// ── Document content ───────────────────────────────────────────────────────────

const children = [];

// Title block
children.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  children: [new TextRun({
    text: "NOAH Prototype",
    font: "Arial", size: 56, bold: true, color: C_PRIMARY,
  })],
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 320 },
  children: [new TextRun({
    text: "Demo Walkthrough Script",
    font: "Arial", size: 36, bold: true, color: C_DARK,
  })],
}));

// Metadata grid
children.push(buildTable(
  [
    ["Field", "Value"],
    ["Audience", "Nike R2R / Controllership stakeholders + Deloitte engagement team"],
    ["Total Duration", "~30 minutes (20-minute compressed version included at the end)"],
    ["Demo Mode", "Canned (pnpm dev with VITE_MODE=canned) — predictable timing, no Ollama dependency"],
    ["Starting URL", "http://localhost:5175/contracts"],
  ],
  [2200, 7160]
));

children.push(para("", { after: 240 }));

// Sequencing note
children.push(tipBox([
  new TextRun({ text: "Sequencing note: ", font: "Arial", size: 22, bold: true, color: C_DARK }),
  new TextRun({
    text: "This script intentionally starts with Contracts and ends with the Close Cockpit. Contracts is where the agentic value lands first — extract → risk → tech-acct → accrual → JE → review. The Cockpit closes the demo as the \u201Cwhere this all rolls up\u201D frame.",
    font: "Arial", size: 22, color: C_BODY,
  }),
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── Table of contents ──
children.push(h1("Table of Contents"));
children.push(buildTable(
  [
    ["#", "Section", "Duration", "URL"],
    ["0", "Pre-flight", "2 min", "—"],
    ["1", "Contracts Queue — process the portfolio", "9 min", "/contracts"],
    ["2", "Review Queue — line-level approval + auto-reversal", "7 min", "/review"],
    ["3", "Narrative — Variance, Exec, Balance Sheet", "6 min", "/narrative"],
    ["4", "NOAH Help — grounded Q&A", "3 min", "/copilot"],
    ["5", "Close Cockpit — the orchestration frame", "4 min", "/"],
    ["6", "Wrap + questions", "2 min", "—"],
  ],
  [600, 5760, 1300, 1700]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 0. Pre-flight ──
children.push(h1("0. Pre-flight (2 min, before audience joins)"));
children.push(labeled("You should have done this already, but double-check:", ""));
children.push(bullet("Dev server running on port 5175 (pnpm dev — server prints the URL)"));
children.push(bullet("Browser at http://localhost:5175/contracts — Acme Co. theme loads, you see 11 contracts"));
children.push(bullet([
  new TextRun({ text: "Reset the canned JE store ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "by hard-refreshing (Ctrl+Shift+R). The Review Queue should be empty.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet([
  new TextRun({ text: "Close Cockpit is ", font: "Arial", size: 22, color: C_BODY }),
  new TextRun({ text: "not started ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "(Day 0 of 6). You\u2019ll start it at the end.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet("Browser zoom at 100%, dev tools closed, no Slack/Teams notifications."));
children.push(para("", { after: 80 }));
children.push(tipBox([
  new TextRun({ text: "Optional: ", font: "Arial", size: 22, bold: true, color: C_DARK }),
  new TextRun({ text: "open a second tab pointed at http://localhost:5175/review — you\u2019ll switch to it during Section 2 without losing context.", font: "Arial", size: 22, color: C_BODY }),
]));

children.push(divider());

// ── 1. Contracts Queue ──
children.push(h1("1. Contracts Queue — Process the Portfolio (~9 min)"));
children.push(labeled("Goal:", "Show the agentic chain that takes raw contracts → 27-attribute extraction → risk score → tech-accounting flags → calculated accrual JEs → submitted to the review queue with materiality routing."));
children.push(labeled("URL:", "http://localhost:5175/contracts"));

// 1.1
children.push(h2("1.1 Orient the audience (1 min)"));
children.push(labeled("What you do:", "Land on the Contracts tab. Point at the table."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("This is the contract queue \u2014 11 contracts seeded for the demo. In production this is the live contract_metabase Postgres table. Each row shows what a controller cares about at a glance: counterparty, total contract value with thousand separators, risk category and score, technical-accounting flags (lease and derivative pills), and the agent processing status."));
children.push(para("", { after: 80 }));
children.push(quote("Notice the risk thresholds reflect Nike scale \u2014 High doesn\u2019t trigger until TCV is over $25M, with $5M and $1M as the lower bumps. We tuned these together earlier this engagement; a $12M contract at a mid-market client would be High, but at Nike\u2019s revenue base it\u2019s Medium with a few qualitative flags. The pre-baked scores already reflect that recalibration."));
children.push(para("", { after: 80 }));
children.push(labeled("Point out:", ""));
children.push(bullet("The TCV column has thousand separators (Nike\u2019s bigger contracts won\u2019t read as a wall of digits)"));
children.push(bullet("Lease/Deriv pills already show on AWS, Atlas Realty, Nexus Cloud"));
children.push(bullet("Risk distribution is 2 High / 6 Medium / 3 Low \u2014 visible without clicking anything"));

// 1.2
children.push(h2("1.2 Selection model + Run All (2 min)"));
children.push(labeled("What you do:", "All checkboxes are ticked by default. Click the header checkbox once to deselect all, then once more to select all again to demonstrate. Click Run selected (11)."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("By default we select everything, but the controller picks what to process \u2014 maybe you want to defer low-priority contracts to the next batch. Tick or untick whatever you want. The header checkbox is tri-state \u2014 if some are selected it shows indeterminate."));
children.push(para("", { after: 60 }));
children.push(quote("When I click Run selected, NOAH runs three agents in sequence on each contract \u2014 extract the 27 attributes, score the risk, flag the technical accounting. Watch the progress bar."));
children.push(para("", { after: 60 }));
children.push(labeled("While it runs (~50\u201360s in canned mode):", ""));
children.push(quote("In canned mode each step has a synthetic dwell of about a second so you can see the agent activity stream. In live mode that\u2019s a real Anthropic API call grounded against the contract text, with Ollama / Qwen 7B as the local-eval option. On Azure AI Foundry with GPU, this whole batch runs in well under a minute."));

// 1.3
children.push(h2("1.3 Post-run results modal (1.5 min)"));
children.push(labeled("What you do:", "When the modal opens, walk the audience through it."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Once the batch finishes the controller gets a structured prompt \u2014 what just happened, broken down by risk so they know where to focus. Two High-risk contracts at the top: AWS at risk score 85 and Nexus at 71. Each contract shows the contributing risk reasons inline \u2014 TCV bumps, no liability cap, auto-renewal \u2014 so you understand WHY it\u2019s High without drilling in."));
children.push(para("", { after: 60 }));
children.push(quote("Two actions per row \u2014 Review and Accrual. Review opens a focused detail modal so I never lose my place in the batch. Let me show you."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Review on AWS Enterprise.", ""));
children.push(quote("Modal stacks on top of the results modal. I can see the risk panel with the contributing factors, the technical accounting findings \u2014 ASC 815 derivative review needed because of the cloud-credits commitment indexing \u2014 and the full 27-attribute checklist with confidence scores and source page references. When I\u2019m done, I close the review modal and I\u2019m right back at the batch results."));
children.push(para("", { after: 60 }));
children.push(labeled("Close the review modal. Then close the results modal.", ""));

// 1.4
children.push(h2("1.4 Calculate Accruals + Submit All (3 min)"));
children.push(labeled("What you do:", "Re-tick all if anything got unticked. Click Calculate accruals (11)."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Same selection drives the accrual button. NOAH computes a journal entry for each contract \u2014 period-end accrual or prepaid amortization based on the contract\u2019s expense recognition method. Watch the progress bar."));
children.push(para("", { after: 60 }));
children.push(labeled("Modal opens \u2014 pause here.", ""));
children.push(quote("This is a deliberate two-step flow. NOAH calculates first, surfaces the JEs grouped by where they would route \u2014 Manager + Director dual approval over $5M, Manager from $1M to $5M, Senior Accountant from $100K to $1M, auto-post under $100K. The controller sees what\u2019s about to happen BEFORE anything hits the system."));
children.push(para("", { after: 60 }));
children.push(labeled("Point at the groupings.", ""));
children.push(quote("For example, AWS at $1.25M routes to the Manager tier. Accenture at $2M routes to Manager. If we\u2019d seeded a $50M contract, it would show up under the dual-approval header so the controller knows two signatures are needed."));
children.push(para("", { after: 60 }));
children.push(quote("If anything was missing \u2014 service start date, fee schedule \u2014 it\u2019s in the Skipped section with the specific missing fields. Olympic Insurance is a prepaid amortization, not an accrual, so its reversal date is null and the lifecycle reflects that. We don\u2019t fake reversal dates on prepaid drawdowns."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Submit all.", ""));
children.push(quote("One click sends every calculated JE to the review queue with the right materiality routing already attached. Watch the rows flip from amber \u2018calculated\u2019 to cyan \u2018submitted\u2019. Sub-$100K entries auto-post immediately and pick up SAP doc numbers \u2014 those bypass the queue entirely."));
children.push(para("", { after: 60 }));
children.push(labeled("After Submit completes:", ""));
children.push(quote("From here the controller goes to the Review Queue to approve. Let me show you that screen."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Open Review Queue \u2192 in the modal footer.", ""));

// 1.5 Q&A
children.push(h2("1.5 Likely Q&A — Section 1"));
[...qa(
  "How does NOAH know what to extract? Did you train a custom model?",
  "No custom training. The 27 attributes are defined in contract-schema.ts — a structured Zod schema. The agent prompt instructs Claude (or Qwen in local mode) to extract those fields and return JSON. Confidence scores come from the model\u2019s self-evaluation. In production with Foundry, this is grounded against your contract repository — DocuSign, Ironclad, Coupa — and runs as a managed agent."
), ...qa(
  "What if extraction is wrong?",
  "Confidence-weighted UI — fields under 0.5 confidence highlight amber. Source page references on every attribute let the reviewer click straight to the page in the source PDF. We never auto-post extraction outputs; risk + tech-acct + accrual all gate on the extracted attributes, and a missing attribute will skip the contract with a specific gap message rather than hallucinate."
), ...qa(
  "Why is a $12M contract not High risk?",
  "At Nike\u2019s revenue base of ~$51B, a $12M contract is below performance materiality. The risk thresholds we tuned reflect that — High requires TCV >$25M plus other red flags (no liability cap, embedded derivative, etc.). We can resize per client; at a mid-market client the same scoring would put $10M in the High tier."
), ...qa(
  "What\u2019s the difference between the structured rules score and the LLM signal?",
  "Rules score (0–60) covers TCV bumps, auto-renewal, liability cap, lease, derivative — deterministic. LLM signal (0–40) adds qualitative factors — vendor concentration, exclusivity, audit exposure — things the rules miss. Both feed the 0–100 score; categories are ≥75 High, ≥40 Medium, <40 Low."
), ...qa(
  "Can a single user process all the contracts in parallel?",
  "Today the demo runs sequentially with explicit progress because in live mode each contract takes 30–90s on Qwen 7B. With Anthropic\u2019s API on Foundry we\u2019d parallelize — concurrent calls per contract, with a configurable concurrency limit per tenant. The UX would still gate Submit on a deliberate human click."
)].forEach((p) => children.push(p));

children.push(divider());

// ── 2. Review Queue ──
children.push(h1("2. Review Queue — Approval + Auto-Reversal (~7 min)"));
children.push(labeled("Goal:", "Show what a controller sees when JEs land for approval — line-level detail with Company Code, debit/credit accounts, downloadable calculation worksheet — and the auto-reversal policy."));
children.push(labeled("URL:", "http://localhost:5175/review (you should already be here from clicking through)"));

children.push(h2("2.1 Layout walkthrough (1 min)"));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Two sections: Pending Review at the top \u2014 JEs that need a click \u2014 and Recent Activity below for posted, reversed, rejected, anything that\u2019s already done. The auditor needs both views; you can\u2019t drop posted entries from the queue or you lose the audit trail."));
children.push(para("", { after: 60 }));
children.push(quote("Each row shows what an SAP reviewer actually checks: Company Code 1000 \u2014 that\u2019s Nike US in this seeded demo, your real bukrs codes would map per legal entity \u2014 debit account number with the GL name, debit amount, credit account number, credit amount. No drilling required to verify a JE; the line is on the row."));
children.push(para("", { after: 60 }));
children.push(quote("Materiality and status pills on the right. Status flips as the JE moves through its lifecycle."));

children.push(h2("2.2 Click to expand a row (2 min)"));
children.push(labeled("What you do:", "Click the chevron on the largest pending JE (probably Accenture or Wieden+Kennedy)."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Click the chevron and the row expands in place \u2014 full multi-line journal entry table on the left, lifecycle panel on the right showing the SAP document numbers if posted, the approver, the reversal date, all timestamps. Below that is the calculation narrative \u2014 exactly how this number was derived. Straight-line monthly fees over the contract term, fee schedule, billing frequency, the math."));
children.push(para("", { after: 60 }));
children.push(quote("Click Download and you get a tab-delimited audit-ready worksheet. Your auditors will want this attached to the JE in BlackLine \u2014 let\u2019s not make controllers reconstruct it from a screenshot."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Download to demonstrate.", ""));
children.push(quote("The worksheet includes the full JE body, the supporting calculation reasoning, and the SAP doc numbers. Drop it in the work papers."));

children.push(h2("2.3 Approve a JE — show auto-reversal scheduling (2 min)"));
children.push(labeled("What you do:", "Pick a pending JE that has a reversal date (Accenture or Wieden+Kennedy work). Click Approve."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("One click. NOAH\u2019s Posting Agent calls BlackLine which calls SAP BAPI_ACC_DOCUMENT_POST. The original entry posts immediately with a fresh SAP document number \u2014 visible in the lifecycle panel. The reversal status reads \u2018Scheduled 2026-05-01\u2019 \u2014 a date, not a SAP doc, because the reversal hasn\u2019t fired yet."));
children.push(para("", { after: 60 }));
children.push(quote("This matches Nike\u2019s actual policy. Accrual reversals inherit approval from the original entry \u2014 they\u2019re mechanical undo entries on the reversal date, no separate human sign-off. SAP F.81 / BlackLine handle this in production; we\u2019re modeling the same policy in canned mode."));

children.push(h2("2.4 Demo advance clock — show reversal flip (1 min)"));
children.push(labeled("What you do:", "Click (Demo) advance clock in the top right."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("This button is a presenter aid only \u2014 it\u2019s labeled (Demo). In production the calendar drives the reversal; the controller never clicks anything. But for this demo I\u2019ll fast-forward."));
children.push(para("", { after: 60 }));
children.push(labeled("Click it.", ""));
children.push(quote("The reversal posts. Same approver authority \u2014 the audit trail records the reversal under the original Manager, not a new sign-off. The JE moves to Reversed status with the second SAP doc number visible in the lifecycle. Net balance-sheet impact is zero, exactly as it should be."));

children.push(h2("2.5 Likely Q&A — Section 2"));
[...qa(
  "What about dual approval over $5M? Does it require two clicks?",
  "Today the prototype shows the routing label — \u201CManager + Director (Dual)\u201D — but a single approve click still posts. Real dual-approval gating with two distinct sign-off states is on the roadmap; it requires backend state to track manager-approved + director-approved separately and only post when both are recorded. Easy to implement; deliberate scope choice for this prototype."
), ...qa(
  "Can a controller reject a JE? What happens?",
  "Yes — Reject opens an inline reason input. The JE moves to Rejected status with the reason in the audit trail. The Senior Accountant who prepared it sees the rejection and can recalculate with corrected inputs."
), ...qa(
  "How does this integrate with BlackLine specifically?",
  "BlackLine sits between NOAH and SAP. NOAH posts to BlackLine\u2019s API; BlackLine handles certification workflows, transaction matching, and the SAP BAPI_ACC_DOCUMENT_POST call. Reversal batches use BlackLine Smart Close which calls SAP F.81. We\u2019re not replacing BlackLine — we\u2019re feeding it."
), ...qa(
  "What if the reversal period is closed?",
  "Production gating: if the period is hard-closed, the reversal can\u2019t post and routes to an exception queue for manual review. The prototype doesn\u2019t yet model period-close gates — flag for the roadmap."
), ...qa(
  "Where\u2019s the audit trail?",
  "Every state transition pushes an audit event — je_submit, je_approve, je_post, je_reversal. In live mode these write to a noah_audit_log table with timestamps, user IDs, agent IDs, confidence scores, and the full JE payload. We can add an Audit timeline screen as a separate view if reviewers want it surfaced (currently there\u2019s a route at /contracts/:id/audit)."
)].forEach((p) => children.push(p));

children.push(divider());

// ── 3. Narrative ──
children.push(h1("3. Narrative — Variance, Exec, Balance Sheet (~6 min)"));
children.push(labeled("Goal:", "Show the three narrative deliverables — line-item variance commentary, executive close summary, and a contract-driven balance sheet view."));
children.push(labeled("URL:", "http://localhost:5175/narrative"));

children.push(h2("3.1 Variance Commentary (2 min)"));
children.push(labeled("What you do:", "Click on a P&L line — Direct-to-Consumer Revenue is a good lead. Click Generate."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("P&L vs prior period, sortable by variance. Click any line, click Generate, and Claude drafts 2\u20133 sentences of CFO-memo-tone commentary. Notice the prompt forbids fabrication \u2014 every dollar in the commentary traces back to the data we passed in. The confidence badge shows how strongly the model rates its own output."));
children.push(para("", { after: 60 }));
children.push(quote("Generate All runs the whole table \u2014 useful at quarter-end when you need every line covered."));
children.push(para("", { after: 60 }));
children.push(quote("In live mode this calls Anthropic with cache control on the system prompt, so re-running across many lines is cheap. The schema enforces JSON structure \u2014 commentary, key drivers, risk flags, confidence \u2014 so the output drops straight into your reporting templates."));

children.push(h2("3.2 Executive Summary (1.5 min)"));
children.push(labeled("Click the Executive Summary tab.", ""));
children.push(labeled("Speaker notes:", ""));
children.push(quote("One level up \u2014 this drafts the close summary the CFO sends to the board. Pulls the top 3 dollar variances from the P&L plus close metrics from the Cockpit \u2014 currently idle so we fall back to a 5.2-day baseline. When the Cockpit is running, this would read \u2018Day 4 of 6 \u00b7 CONSOLIDATE\u2019 instead."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Generate.", ""));
children.push(quote("Headline, three-to-five highlights, two-to-three risks, one recommendation \u2014 all grounded in the structured inputs. Voice is concise, neutral, board-ready. Copy or print straight to the deck."));

children.push(h2("3.3 Balance Sheet — the contract-grounded line item (2.5 min)"));
children.push(labeled("Click the Balance Sheet tab.", ""));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Same layout pattern as P&L Variance Commentary \u2014 line items on the left, period end vs prior year end with variance dollar and percent, commentary panel on the right. Thirteen line items across Current Asset, Non-Current Asset, Current Liability, Non-Current Liability, Equity."));
children.push(para("", { after: 60 }));
children.push(labeled("Point at the Accrued Liabilities row \u2014 it has a CONTRACTS chip.", ""));
children.push(quote("This row is special. The Accrued Liabilities current period balance isn\u2019t just seeded \u2014 it\u2019s the seeded BAU base PLUS the live sum of credits to GL 2310 from the JEs we just submitted on the Contracts page. The variance reflects what we processed today."));
children.push(para("", { after: 60 }));
children.push(labeled("Click Generate on the Accrued Liabilities row.", ""));
children.push(quote("The commentary names the actual reviewed contracts \u2014 Amazon Web Services, Accenture, the rest. It cites the materiality-routing breakdown by tier, scheduled auto-reversals from the original approval, and ASC 842/815 flags from the contributing contracts. None of this is hand-written narrative; it\u2019s deterministic composition from the live JE store and the contract metadata."));
children.push(para("", { after: 60 }));
children.push(quote("Click Generate on any other line \u2014 say Inventories or PP&E \u2014 and you\u2019ll see commentary based on the seeded driver text plus an automatic disclosure flag if the YoY move is over 10%. The pattern is the same; the data sources differ."));

children.push(h2("3.4 Likely Q&A — Section 3"));
[...qa(
  "How do we make sure the LLM doesn\u2019t make up numbers?",
  "Three layers. First, the system prompt explicitly forbids fabrication (\u201Cuse ONLY numbers provided\u201D). Second, JSON schema validation rejects malformed output. Third, the inputs are passed structured — line item, current period, prior period, variance, drivers — so the model has no incentive to invent numbers. For the Balance Sheet accrued line, narrative is deterministic (no LLM) — we compose the prose from the JE rollup directly."
), ...qa(
  "Is the variance commentary pulling from real numbers, or are these fixtures?",
  "Today both sides — seedPnL is hand-curated Nike-shaped quarterly figures. In live mode this connects to your reporting cube (Foundry / Power BI dataset) and pulls the actual quarterly close. The agent layer is identical; only the data source changes."
), ...qa(
  "Can we customize the voice / template?",
  "Yes. The system prompts in narrative.ts are configurable per tenant — voice, tone, structure (sentence count, bullet count, recommendation format). For Nike specifically we\u2019d match your existing earnings-script style."
), ...qa(
  "What if I disagree with the commentary?",
  "Commentary is a draft, not a final. Copy button → paste into your editor → revise. Confidence badge tells you whether to trust it as-is or rewrite. We\u2019re not replacing the controller\u2019s judgment — we\u2019re getting the first draft to 80%."
), ...qa(
  "How does the Balance Sheet stay in sync if I post a new accrual?",
  "It subscribes to the canned JE store in this prototype; in live mode it reads the same proposed_je Postgres table on a refresh. Submit a new JE on /contracts and refresh /narrative → Balance Sheet — Accrued Liabilities updates with the new contract in the contributors list."
)].forEach((p) => children.push(p));

children.push(divider());

// ── 4. NOAH Help ──
children.push(h1("4. NOAH Help — Grounded Q&A (~3 min)"));
children.push(labeled("Goal:", "Show the assistant pane that knows the current state of the demo — contract counts, pending JEs, scheduled reversals — and answers specific questions distinctly."));
children.push(labeled("URL:", "http://localhost:5175/copilot"));

children.push(h2("4.1 Demonstrate the suggestion chips (2 min)"));
children.push(labeled("What you do:", "Click each chip in turn, narrating as you go."));
children.push(para("", { after: 60 }));
const chipsAndQuotes = [
  ["Click \u201CHow many contracts?\u201D", "Live count \u2014 11 contracts, the actual risk distribution from what\u2019s in the queue right now. If I delete a fixture and refresh, this number changes."],
  ["Click \u201CHighest-risk contract?\u201D", "Names the High-risk contracts with TCV and score. Notice this is a different answer to the same topic \u2014 old version returned the same response for any question containing the word \u2018contract\u2019."],
  ["Click \u201CTotal accrued\u201D", "Pulls the sum of credits to GL 2310 from the JE store \u2014 should match what we just submitted. Posted vs pending split, plus a pointer to the Balance Sheet tab."],
  ["Click \u201CPending review\u201D", "Counts by routing tier \u2014 dual approval, Manager, Senior Accountant \u2014 with names of the top three pending. Updates when I approve a JE."],
  ["Click \u201CReversals\u201D", "Shows scheduled and completed reversals with the policy reminder \u2014 auto-post on reversal_date, no separate sign-off, matches SAP F.81 / BlackLine."],
  ["Click \u201CTop variance\u201D", "Top three P&L variances pulled from the same seedPnL data the Variance Commentary tab uses. Consistency across the app."],
  ["Click \u201CClose status\u201D", "Cockpit is idle \u2014 that\u2019s accurate, we haven\u2019t started it yet. When we do, this reads the actual current day and phase."],
];
chipsAndQuotes.forEach(([label, q]) => {
  children.push(labeled(label, ""));
  children.push(quote(q));
  children.push(para("", { after: 60 }));
});

children.push(h2("4.2 Type a custom question (1 min)"));
children.push(labeled("What you do:", "Type \u201Chow do I process a contract?\u201D and send."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Free-text questions also work. The matcher is regex-based today \u2014 in production this is a Copilot Studio agent grounded over your close data with full conversational context. The point of the prototype is to show that the answer adapts to what the user actually sees in the app, not a static FAQ."));

children.push(h2("4.3 Likely Q&A — Section 4"));
[...qa(
  "This is canned. How does it work in production?",
  "Production wraps a Copilot Studio agent with knowledge grounding over contract_metabase, proposed_je, the audit log, and your reporting cube. The same intent matchers we use in canned mode become tools the agent calls — getContractCount, getPendingJEs, etc. — so the prose is generated by Claude with cited tool outputs. Conversational state, follow-up questions, all native."
), ...qa(
  "Why is the demo answer so structured?",
  "Deliberate. In a prototype demo we\u2019d rather show predictable, accurate answers than have the model occasionally hallucinate. In production the Copilot Studio agent has real grounding — same accuracy, more natural prose."
), ...qa(
  "Can it answer questions about a specific contract?",
  "Roadmap. The matchers today don\u2019t parse counterparty names — adding \u201Chow risky is the AWS contract\u201D requires either a NER pass or routing to the contract detail. Trivial in production where we\u2019re not pattern-matching."
)].forEach((p) => children.push(p));

children.push(divider());

// ── 5. Close Cockpit ──
children.push(h1("5. Close Cockpit — The Orchestration Frame (~4 min)"));
children.push(labeled("Goal:", "Show how everything we just demonstrated fits inside the broader R2R close cycle."));
children.push(labeled("URL:", "http://localhost:5175/"));

children.push(h2("5.1 Orient the audience (1 min)"));
children.push(labeled("Speaker notes:", ""));
children.push(quote("This is where a controller starts their day during close. Five phases left to right \u2014 Pre-Close on Day -1 and before, Execute Day 1-3, Consolidate Day 4, Validate Day 5-6, Gate Day 6. Six entities running in parallel \u2014 NA, EMEA, Greater China, APLA, Corporate, Global. Each phase has Foundry / BlackLine / SAP integrations behind it; the Cockpit visualizes orchestration without making the controller babysit the pipelines."));
children.push(para("", { after: 60 }));
children.push(quote("Everything we just walked through happens inside Phase 2 (Execute) and Phase 3 (Consolidate) \u2014 contract review, accrual JEs, posting to SAP. The other phases handle pre-close readiness scans, balance validation, and the Gate sign-off."));

children.push(h2("5.2 Start the simulation (2 min)"));
children.push(labeled("What you do:", "Click Start. Let it tick through all phases."));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Click Start. The simulation ticks once per second \u2014 six ticks for six sim days. Watch the entity progression on the right; NA leads, then the others stagger in. Phase chips light up cyan when active, green when complete."));
children.push(para("", { after: 60 }));
children.push(quote("The event log on the right captures every phase transition with a timestamp. In production this is a real activity stream \u2014 Foundry job completions, BlackLine certifications, SAP postings, exceptions routed to controllers. The Cockpit doesn\u2019t generate the events; it surfaces them."));
children.push(para("", { after: 60 }));
children.push(labeled("As phases advance:", ""));
children.push(quote("Pre-Close \u2014 Foundry\u2019s predictive model flags at-risk accounts before the period even closes. The Readiness Report posts to Teams."));
children.push(para("", { after: 40 }));
children.push(quote("Execute \u2014 BlackLine Smart Close triggers SAP jobs. Event Grid monitors for failures; the JE postings we did earlier flow through here."));
children.push(para("", { after: 40 }));
children.push(quote("Consolidate \u2014 subsidiary entries roll up; eliminations and FX translation post; group totals lock."));
children.push(para("", { after: 40 }));
children.push(quote("Validate \u2014 recon agent checks. The Narrative agent drafts variance commentary. NOAH generates the executive summary."));
children.push(para("", { after: 40 }));
children.push(quote("Gate \u2014 exceptions are below materiality, controller signs off, period closes. Cycle complete."));

children.push(h2("5.3 Tie it back (1 min)"));
children.push(labeled("Speaker notes:", ""));
children.push(quote("This is the frame. Inside it, the work we showed earlier is real \u2014 contract extraction, accrual JEs, narrative drafting. The Cockpit doesn\u2019t do the work; it shows that all the work is happening, where each agent is in its lifecycle, and what needs human eyes. The win for Nike is that a controller spends close week answering questions and reviewing exceptions, not chasing reconciliations."));

children.push(h2("5.4 Likely Q&A — Section 5"));
[...qa(
  "How long does Nike\u2019s actual close take today?",
  "That\u2019s a discovery question — varies by entity. Industry benchmark for consumer brands at this scale is 5–8 business days. The Cockpit\u2019s 6-day target is illustrative; we\u2019d tune to your actual cycle and show variance against your target."
), ...qa(
  "What if a phase fails?",
  "Production: exceptions route to a triage queue. The Cockpit surfaces them as red badges on the affected phase, with a click-through to the specific failure (a SAP job error, a BlackLine certification reject, a recon difference above materiality). The simulation doesn\u2019t model failure today; we can add a \u201Cdemo failure\u201D toggle if useful."
), ...qa(
  "Does the Cockpit work without all the underlying agents?",
  "It needs the data feeds — phase status, entity status, event stream — but those don\u2019t have to be Anthropic agents. You could light up the Cockpit with just Foundry + SAP + BlackLine and incrementally add agents (extraction, narrative, etc.) as you adopt them. It\u2019s a visualization layer over real orchestration."
), ...qa(
  "Who\u2019s the audience for the Cockpit screen?",
  "VP Controlling and the close team. Below that level, controllers live in /contracts and /review where the actual decisions happen. Above that level, CFO/audit lives in /narrative for the deliverables. Cockpit is the operational view for whoever owns the close cycle."
)].forEach((p) => children.push(p));

children.push(divider());

// ── 6. Wrap ──
children.push(h1("6. Wrap (~2 min)"));
children.push(labeled("Speaker notes:", ""));
children.push(quote("Quick recap of what we showed: 1) eleven contracts processed end-to-end through extract / risk / tech-acct in roughly a minute; 2) accruals calculated, routed by materiality, and submitted with one click; 3) line-level approval in the Review Queue with downloadable audit-ready worksheets and policy-correct auto-reversals; 4) variance, executive, and balance-sheet narratives \u2014 the balance sheet specifically grounded in the contracts we just reviewed; 5) a grounded Q&A assistant that knows the live state of the close; and 6) the Cockpit frame that ties it all together."));
children.push(para("", { after: 60 }));
children.push(quote("What I\u2019d want from you: where does this map to your current pain? What\u2019s missing that would block adoption? What would you want to add to a 90-day pilot scope?"));
children.push(para("", { after: 60 }));
children.push(labeled("Open the floor.", ""));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── Compressed 20-min ──
children.push(h1("Compressed 20-Minute Version"));
children.push(para("If you only have 20 minutes, drop these sections:", { after: 120 }));
children.push(buildTable(
  [
    ["Section", "Skip?", "Save"],
    ["1. Contracts", "Keep all", "—"],
    ["2. Review Queue", "Skip 2.4 (advance clock demo)", "2 min"],
    ["3. Narrative", "Skip Variance Commentary; show only Exec + Balance Sheet", "2 min"],
    ["4. NOAH Help", "Show 2 chips only", "2 min"],
    ["5. Cockpit", "Skip Q&A", "2 min"],
  ],
  [2400, 5360, 1600]
));
children.push(para("", { after: 120 }));
children.push(para("That\u2019s a 22-minute walkthrough — pulls the audience through the highest-value moments (Contracts → Review → Balance Sheet → Cockpit) without losing the narrative arc.", { italics: true, color: C_MUTED }));

children.push(divider());

// ── Speaker reference card ──
children.push(h1("Speaker Reference Card (Print This)"));
children.push(buildTable(
  [
    ["Cue", "URL", "Click Path"],
    ["Open", "/contracts", "(default)"],
    ["Run extract", "/contracts", "Header checkbox → Run selected"],
    ["Calculate", "/contracts", "Calculate accruals → Submit all"],
    ["Approve", "/review", "Expand row → Approve"],
    ["Advance clock", "/review", "(Demo) advance clock"],
    ["Variance", "/narrative", "Variance Commentary → Generate on a row"],
    ["Exec", "/narrative?tab=exec", "Generate close narrative"],
    ["Balance Sheet", "/narrative?tab=balance-sheet", "Generate on Accrued Liabilities"],
    ["NOAH Help", "/copilot", "Click chips"],
    ["Cockpit", "/", "Start"],
  ],
  [2200, 2800, 4360]
));

children.push(divider());

// ── Disclosures ──
children.push(h1("Disclosure / Caveats to Mention When Asked"));
children.push(bullet([
  new TextRun({ text: "Risk thresholds (>$25M High) ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "reflect Nike scale — tunable per tenant.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet([
  new TextRun({ text: "Dual-approval over $5M ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "is labeled but single-click in this prototype.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet([
  new TextRun({ text: "Auto-reversal compresses time; ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "production gates on calendar reversal_date with exception handling for closed periods.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet([
  new TextRun({ text: "All numbers are synthetic ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "— Nike-shaped, not Nike-actual.", font: "Arial", size: 22, color: C_BODY }),
]));
children.push(bullet([
  new TextRun({ text: "Canned mode runs without Ollama; ", font: "Arial", size: 22, bold: true, color: C_BODY }),
  new TextRun({ text: "live mode requires Qwen 7B locally OR the Anthropic API.", font: "Arial", size: 22, color: C_BODY }),
]));

// ── Build the document ──

const doc = new Document({
  creator: "Deloitte / NOAH Prototype",
  title: "NOAH Prototype — Demo Walkthrough Script",
  description: "Presenter walkthrough script for the NOAH agentic R2R demo, structured for Nike Controllership briefings.",
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: C_BODY } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: C_PRIMARY },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C_DARK },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C_PRIMARY },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: 15840, orientation: PageOrientation.PORTRAIT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "NOAH Prototype \u2014 Demo Walkthrough", font: "Arial", size: 18, color: C_MUTED }),
            new TextRun({ text: "\tNike R2R / Deloitte", font: "Arial", size: 18, color: C_MUTED }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: "Page ", font: "Arial", size: 18, color: C_MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: C_MUTED }),
            new TextRun({ text: " of ", font: "Arial", size: 18, color: C_MUTED }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: C_MUTED }),
          ],
        })],
      }),
    },
    children,
  }],
});

const outPath = path.resolve(__dirname, "..", "DEMO_SCRIPT.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length.toLocaleString()} bytes)`);
});
