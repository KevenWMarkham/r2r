// Generates Contract_0_Meridian_Golden.docx — a "golden" sample contract
// designed so every one of the 27 attributes is stated explicitly and
// unambiguously on the first 3 pages. Qwen 3B should hit 100% on this.
//
// Key design choices for 100% extraction:
//   1. Every attribute has its OWN numbered section with a clear heading
//      whose name mirrors the attribute name
//   2. All values front-loaded (first 3 pages) to beat "lost in the middle"
//   3. Values repeated in summary table at top for redundancy
//   4. No legalese burying — short, declarative sentences
//   5. Explicit "NOT applicable" statements for negative fields (lease,
//      derivative, exclusivity) so the LLM can answer "false" with confidence
//
// Usage (from Prototype/):  node tools/build-golden-contract.js

const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, Footer, PageNumber,
} = require("docx");

const OUT = path.join(
  __dirname, "..", "samples", "acme", "Contract_0_Meridian_Golden.docx"
);

// ── style helpers ─────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 4, color: "888888" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60 },
  alignment: opts.align,
  children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size })],
});

const title = (text) => new Paragraph({
  spacing: { before: 0, after: 120 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text, bold: true, size: 32 })],
});

const subtitle = (text) => new Paragraph({
  spacing: { after: 360 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text, italics: true, size: 22, color: "555555" })],
});

const h = (num, text) => new Paragraph({
  spacing: { before: 220, after: 80 },
  children: [new TextRun({ text: `${num}. ${text}`, bold: true, size: 24 })],
});

const kvRow = (k, v) => new TableRow({
  children: [
    new TableCell({
      borders: cellBorders, width: { size: 3500, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 20 })] })],
    }),
    new TableCell({
      borders: cellBorders, width: { size: 5860, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })],
    }),
  ],
});

// ── Summary table at the very top — redundant restatement of every attr ──
const summaryTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3500, 5860],
  rows: [
    kvRow("Counterparty", "Meridian Solutions Inc."),
    kvRow("Contract Type", "Master Services Agreement"),
    kvRow("Effective Date", "March 1, 2026"),
    kvRow("Expiration Date", "February 28, 2029"),
    kvRow("Service Start Date", "March 1, 2026"),
    kvRow("Service End Date", "February 28, 2029"),
    kvRow("Total Contract Value", "USD $18,000,000"),
    kvRow("Currency", "USD (United States Dollars)"),
    kvRow("Payment Terms", "Net 30 days"),
    kvRow("Billing Frequency", "Monthly"),
    kvRow("Fee Schedule", "$500,000 per month, fixed for the full Term"),
    kvRow("Service Description", "Digital transformation advisory, strategy, and change management"),
    kvRow("Auto-Renewal", "Yes — 12-month successive terms unless 90-day notice given"),
    kvRow("Termination Notice Days", "90 days written notice"),
    kvRow("Governing Law", "State of Delaware"),
    kvRow("Indemnification Present", "Yes"),
    kvRow("Liability Cap", "Yes — 2x fees paid in prior 12 months"),
    kvRow("Lease Component", "No"),
    kvRow("Embedded Derivative", "No"),
    kvRow("Expense Recognition Method", "Straight-line"),
    kvRow("Performance Obligations", "Single obligation — advisory services across the Term"),
    kvRow("Pricing Variability", "None — fees fixed"),
    kvRow("Minimum Commitment", "$6,000,000 per year"),
    kvRow("Exclusivity Clause", "No — non-exclusive"),
    kvRow("IP Ownership", "Acme Co owns Client Work Product; Meridian retains pre-existing IP"),
    kvRow("Confidentiality Term", "7 years post-termination"),
    kvRow("Change Order Mechanism", "Written Change Order signed by both parties"),
  ],
});

// ── doc body ─────────────────────────────────────────────────────────────
const children = [
  title("MASTER SERVICES AGREEMENT"),
  subtitle("Acme Co — Meridian Solutions Inc."),

  p("This Master Services Agreement (the \"Agreement\") is entered into as of March 1, 2026 (the \"Effective Date\") by and between Acme Co, a Delaware corporation (\"Acme\" or \"Client\"), and Meridian Solutions Inc., a Delaware corporation (\"Meridian\" or \"Service Provider\")."),

  p("SUMMARY OF KEY TERMS", { bold: true, size: 24 }),
  summaryTable,

  // ── Numbered sections, each with a clear heading + unambiguous body ──
  h(1, "Counterparty"),
  p("The counterparty to Acme Co under this Agreement is Meridian Solutions Inc., a Delaware corporation with offices at 100 Main Street, Wilmington, DE 19801."),

  h(2, "Contract Type"),
  p("This Agreement is a Master Services Agreement (MSA). Individual engagements under this MSA will be governed by separate Statements of Work."),

  h(3, "Effective Date"),
  p("The Effective Date of this Agreement is March 1, 2026."),

  h(4, "Expiration Date"),
  p("The Expiration Date of this Agreement is February 28, 2029. This Agreement has an initial term of three (3) years."),

  h(5, "Service Start Date"),
  p("Services commence on March 1, 2026 (the Service Start Date)."),

  h(6, "Service End Date"),
  p("Services continue through February 28, 2029 (the Service End Date), unless this Agreement is terminated earlier in accordance with Section 14 below."),

  h(7, "Total Contract Value"),
  p("The Total Contract Value under this Agreement is United States Dollars Eighteen Million (USD $18,000,000) over the three-year Initial Term."),

  h(8, "Currency"),
  p("All amounts under this Agreement are denominated and payable in United States Dollars (USD). No currency other than USD applies."),

  h(9, "Payment Terms"),
  p("All undisputed invoices are payable by Client on Net 30 day terms from the date of invoice receipt."),

  h(10, "Billing Frequency"),
  p("Meridian will invoice Client on a Monthly basis, in arrears, for services rendered the prior month."),

  h(11, "Fee Schedule"),
  p("The fee schedule is: Five Hundred Thousand US Dollars (US $500,000) per month, fixed for the full three-year Term. Annual aggregate fees: $6,000,000. Total Contract Value: $18,000,000."),

  h(12, "Service Description"),
  p("Services include: digital transformation advisory, strategy consulting, business process redesign, organizational change management, and ad-hoc expert support as requested by Client. Deliverables are defined in Statements of Work executed under this MSA."),

  h(13, "Auto-Renewal"),
  p("This Agreement automatically renews for successive twelve (12) month periods (each a \"Renewal Term\") after the Initial Term unless either party delivers written notice of non-renewal at least ninety (90) days prior to the end of the then-current term. Auto-renewal: YES."),

  h(14, "Termination Notice Days"),
  p("Either party may terminate this Agreement for convenience upon Ninety (90) days prior written notice to the other party. Termination notice period: 90 days."),

  h(15, "Governing Law"),
  p("This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict-of-laws principles."),

  h(16, "Indemnification Present"),
  p("Indemnification: YES. Each party shall indemnify, defend, and hold harmless the other from third-party claims arising out of (a) bodily injury or property damage caused by the indemnifying party's negligence, or (b) the indemnifying party's infringement of third-party intellectual property rights."),

  h(17, "Liability Cap"),
  p("Liability Cap: YES. The aggregate liability of each party under this Agreement shall not exceed two times (2x) the fees paid by Client in the twelve (12) months preceding the event giving rise to the claim."),

  h(18, "Lease Component"),
  p("Lease Component: NO. This Agreement is a services engagement and does not include any right to use any identified asset under the control of Client. There is no lease component and ASC 840 / ASC 842 lease accounting does not apply."),

  h(19, "Embedded Derivative"),
  p("Embedded Derivative: NO. Fees are denominated in USD and are fixed in amount; there is no indexing to any financial variable (interest rates, commodity prices, FX, credit rating, or CPI). ASC 815 embedded-derivative evaluation is not required."),

  h(20, "Expense Recognition Method"),
  p("Client shall recognize expense on a straight-line basis over the three-year Term. Services are provided ratably over the term and equal benefit is delivered each period. Expense recognition method: straight-line."),

  h(21, "Performance Obligations"),
  p("This Agreement has one (1) performance obligation: delivery of digital transformation advisory services across the Term. Specific deliverables within each Statement of Work are integrated and do not represent separately identifiable performance obligations."),

  h(22, "Pricing Variability"),
  p("Pricing Variability: NONE. The monthly fee of $500,000 is fixed for the full Term. There are no escalators, no indexing, no volume-based adjustments, and no variable consideration."),

  h(23, "Minimum Commitment"),
  p("Minimum Commitment: Six Million US Dollars ($6,000,000) per calendar year. Eighteen Million US Dollars ($18,000,000) over the three-year Term."),

  h(24, "Exclusivity Clause"),
  p("Exclusivity: NO. This Agreement is non-exclusive. Either party may engage other parties for similar services without restriction."),

  h(25, "IP Ownership"),
  p("IP Ownership: Acme Co owns all Work Product specifically created by Meridian for Acme under this Agreement, upon full payment. Meridian retains ownership of its pre-existing methodologies, templates, know-how, and tools."),

  h(26, "Confidentiality Term"),
  p("Each party's confidentiality obligations survive for seven (7) years following the expiration or termination of this Agreement."),

  h(27, "Change Order Mechanism"),
  p("Any change to the scope, fees, or schedule of services must be documented in a written Change Order signed by both parties' authorized representatives. Oral changes are not binding."),

  // ── Signatures ──
  new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    spacing: { before: 400, after: 200 },
    children: [new TextRun("")],
  }),
  p("IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.", { bold: true }),

  new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "ACME CO", bold: true })] }),
  new Paragraph({ children: [new TextRun("By: __________________________________")] }),
  new Paragraph({ children: [new TextRun("Name: Kate Whitfield")] }),
  new Paragraph({ children: [new TextRun("Title: Chief Procurement Officer")] }),
  new Paragraph({ children: [new TextRun("Date: March 1, 2026")] }),

  new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "MERIDIAN SOLUTIONS INC.", bold: true })] }),
  new Paragraph({ children: [new TextRun("By: __________________________________")] }),
  new Paragraph({ children: [new TextRun("Name: James O'Brien")] }),
  new Paragraph({ children: [new TextRun("Title: Managing Partner")] }),
  new Paragraph({ children: [new TextRun("Date: March 1, 2026")] }),
];

const doc = new Document({
  creator: "Acme Co Legal",
  title: "MSA — Acme Co + Meridian Solutions Inc. (Golden Demo)",
  styles: {
    default: { document: { run: { font: "Times New Roman", size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Acme Co — Confidential · Page ", italics: true, size: 18, color: "777777" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "777777" }),
            new TextRun({ text: " of ", size: 18, color: "777777" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "777777" }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  Size: ${buf.length} bytes`);
  console.log(`  Contains: 27 explicit sections + top-of-doc summary table`);
  console.log(`\nNext: cd server && pnpm seed`);
});
