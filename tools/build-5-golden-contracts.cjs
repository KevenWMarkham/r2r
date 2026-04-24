// Generates 5 golden contracts covering distinct R2R scenarios, each structured
// for 100%-extraction (top summary table + 27 numbered sections mirroring the
// attribute schema). Intended as a polished deliverable package for Nike Finance.
//
// Scenarios:
//   A  TechFlow Consulting MSA       · services · straight-line · Medium risk
//   B  Nexus Cloud SaaS Renewal      · SaaS · CPI escalator (ASC 815) · High risk
//   C  Atlas Realty Office Lease     · lease (ASC 842) · High risk
//   D  Summit Builders Store Buildout· construction · milestone/direct-assoc · High risk
//   E  Olympic Insurance Multi-Year  · prepaid amortization · Low-Medium risk
//
// Each contract has every one of the 27 contract attributes stated verbatim,
// front-loaded onto pages 1-3 with a summary table and explicit NO statements
// for negative booleans.
//
// Usage from Prototype/:  node tools/build-5-golden-contracts.cjs

const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, Footer, PageNumber,
} = require("docx");

const OUT_DIR = path.join(__dirname, "..", "samples", "acme");

// ── shared style helpers ─────────────────────────────────────────────────
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
  spacing: { before: 200, after: 70 },
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

const makeSummary = (c) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3500, 5860],
  rows: [
    kvRow("Counterparty", c.counterparty),
    kvRow("Contract Type", c.contract_type),
    kvRow("Effective Date", c.effective_date),
    kvRow("Expiration Date", c.expiration_date),
    kvRow("Service Start Date", c.service_start_date),
    kvRow("Service End Date", c.service_end_date),
    kvRow("Total Contract Value", c.total_contract_value),
    kvRow("Currency", c.currency),
    kvRow("Payment Terms", c.payment_terms),
    kvRow("Billing Frequency", c.billing_frequency),
    kvRow("Fee Schedule", c.fee_schedule),
    kvRow("Service Description", c.service_description),
    kvRow("Auto-Renewal", c.auto_renewal),
    kvRow("Termination Notice Days", c.termination_notice_days),
    kvRow("Governing Law", c.governing_law),
    kvRow("Indemnification Present", c.indemnification_present),
    kvRow("Liability Cap", c.liability_cap),
    kvRow("Lease Component", c.lease_component),
    kvRow("Embedded Derivative", c.embedded_derivative),
    kvRow("Expense Recognition Method", c.expense_recognition_method),
    kvRow("Performance Obligations", c.performance_obligations),
    kvRow("Pricing Variability", c.pricing_variability),
    kvRow("Minimum Commitment", c.minimum_commitment),
    kvRow("Exclusivity Clause", c.exclusivity_clause),
    kvRow("IP Ownership", c.ip_ownership),
    kvRow("Confidentiality Term", c.confidentiality_term),
    kvRow("Change Order Mechanism", c.change_order_mechanism),
  ],
});

function buildContract(c) {
  const fields = [
    ["Counterparty",                  c.counterparty],
    ["Contract Type",                 c.contract_type],
    ["Effective Date",                c.effective_date],
    ["Expiration Date",               c.expiration_date],
    ["Service Start Date",            c.service_start_date],
    ["Service End Date",              c.service_end_date],
    ["Total Contract Value",          c.total_contract_value],
    ["Currency",                      c.currency],
    ["Payment Terms",                 c.payment_terms],
    ["Billing Frequency",             c.billing_frequency],
    ["Fee Schedule",                  c.fee_schedule],
    ["Service Description",           c.service_description],
    ["Auto-Renewal",                  c.auto_renewal],
    ["Termination Notice Days",       c.termination_notice_days],
    ["Governing Law",                 c.governing_law],
    ["Indemnification Present",       c.indemnification_present],
    ["Liability Cap",                 c.liability_cap],
    ["Lease Component",               c.lease_component],
    ["Embedded Derivative",           c.embedded_derivative],
    ["Expense Recognition Method",    c.expense_recognition_method],
    ["Performance Obligations",       c.performance_obligations],
    ["Pricing Variability",           c.pricing_variability],
    ["Minimum Commitment",            c.minimum_commitment],
    ["Exclusivity Clause",            c.exclusivity_clause],
    ["IP Ownership",                  c.ip_ownership],
    ["Confidentiality Term",          c.confidentiality_term],
    ["Change Order Mechanism",        c.change_order_mechanism],
  ];

  const children = [
    title(c.docTitle),
    subtitle(`Acme Co — ${c.counterparty}`),
    p(c.recitals),
    p("SUMMARY OF KEY TERMS", { bold: true, size: 24 }),
    makeSummary(c),
  ];

  fields.forEach(([label, value], i) => {
    children.push(h(i + 1, label));
    children.push(p(value));
  });

  // Signatures
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { before: 400, after: 200 },
      children: [new TextRun("")],
    }),
    p("IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.", { bold: true }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "ACME CO", bold: true })] }),
    new Paragraph({ children: [new TextRun("By: __________________________________")] }),
    new Paragraph({ children: [new TextRun(`Name: ${c.acme_signer}`)] }),
    new Paragraph({ children: [new TextRun(`Title: ${c.acme_title}`)] }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: c.counterparty.toUpperCase(), bold: true })] }),
    new Paragraph({ children: [new TextRun("By: __________________________________")] }),
    new Paragraph({ children: [new TextRun(`Name: ${c.cp_signer}`)] }),
    new Paragraph({ children: [new TextRun(`Title: ${c.cp_title}`)] }),
  );

  return new Document({
    creator: "Acme Co Legal",
    title: c.docTitle,
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
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
}

// ── the 5 contracts ──────────────────────────────────────────────────────
const contracts = [
  {
    file: "Golden_A_TechFlow_MSA.docx",
    docTitle: "MASTER SERVICES AGREEMENT",
    recitals: "This Master Services Agreement (the \"Agreement\") is entered into as of May 1, 2026 (the \"Effective Date\") by and between Acme Co, a Delaware corporation (\"Acme\" or \"Client\"), and TechFlow Consulting LLC, a Virginia limited liability company (\"TechFlow\" or \"Service Provider\").",
    counterparty: "TechFlow Consulting LLC",
    contract_type: "Master Services Agreement for Technology Advisory Services",
    effective_date: "May 1, 2026",
    expiration_date: "April 30, 2028",
    service_start_date: "May 1, 2026",
    service_end_date: "April 30, 2028",
    total_contract_value: "USD $2,400,000 (Two Million Four Hundred Thousand US Dollars) over two years",
    currency: "USD (United States Dollars)",
    payment_terms: "Net 30 days from invoice date",
    billing_frequency: "Monthly, in arrears",
    fee_schedule: "$100,000 per month, fixed for the full Term. Annual aggregate fee $1,200,000. Total over two years: $2,400,000.",
    service_description: "Technology advisory services including cloud architecture review, security assessment, and DevOps advisory. Deliverables defined in individual Statements of Work executed under this MSA.",
    auto_renewal: "Yes — auto-renews for successive twelve (12) month Renewal Terms unless either party provides ninety (90) days written notice of non-renewal.",
    termination_notice_days: "90 days written notice",
    governing_law: "Laws of the State of Virginia, without regard to conflict-of-laws principles",
    indemnification_present: "Yes — mutual indemnification for third-party claims arising from negligence or IP infringement",
    liability_cap: "Yes — capped at two times (2x) the fees paid in the preceding twelve (12) months",
    lease_component: "No — this is a services engagement with no right to use any identified asset",
    embedded_derivative: "No — fees are fixed in USD with no financial-variable indexing",
    expense_recognition_method: "Straight-line — services are rendered ratably over the Term",
    performance_obligations: "Single performance obligation — delivery of technology advisory services across the Term",
    pricing_variability: "None — fees are fixed for the full Term; no escalators, no indexing",
    minimum_commitment: "$100,000 minimum monthly commitment; $1,200,000 annual minimum; $2,400,000 total minimum",
    exclusivity_clause: "No — non-exclusive; either party may engage other parties for similar services",
    ip_ownership: "Acme Co owns all Work Product specifically created for Acme upon payment. TechFlow retains pre-existing methodologies, templates, and tools.",
    confidentiality_term: "Five (5) years post-termination",
    change_order_mechanism: "All changes require a written Change Order signed by both parties' authorized representatives",
    acme_signer: "Rebecca Torres", acme_title: "VP Technology Procurement",
    cp_signer: "Daniel Park", cp_title: "Principal, TechFlow Consulting",
  },
  {
    file: "Golden_B_Nexus_SaaS_Renewal.docx",
    docTitle: "ENTERPRISE SAAS SUBSCRIPTION RENEWAL",
    recitals: "This Subscription Renewal Agreement (the \"Agreement\") is entered into as of June 1, 2026 (the \"Renewal Date\") between Acme Co (\"Subscriber\") and Nexus Cloud Inc., a Delaware corporation (\"Nexus\" or \"Provider\").",
    counterparty: "Nexus Cloud Inc.",
    contract_type: "Enterprise SaaS Subscription Renewal Agreement",
    effective_date: "June 1, 2026",
    expiration_date: "May 31, 2029",
    service_start_date: "June 1, 2026",
    service_end_date: "May 31, 2029",
    total_contract_value: "USD $1,350,000 (One Million Three Hundred Fifty Thousand US Dollars) estimated over three years; subject to CPI escalator",
    currency: "USD (United States Dollars)",
    payment_terms: "Annual pre-payment within 30 days of anniversary invoice",
    billing_frequency: "Annual, in advance",
    fee_schedule: "Year 1 Annual Fee: $450,000. Years 2-3 adjusted by CPI-U escalator, minimum 3%, maximum 6%. Estimated total: $1,350,000.",
    service_description: "Nexus Enterprise Data Platform — Analytics, Data Catalog, and Governance modules for up to 500 named users.",
    auto_renewal: "Yes — auto-renews for successive twelve (12) month terms unless Subscriber provides ninety (90) days written notice of non-renewal.",
    termination_notice_days: "90 days written notice",
    governing_law: "Laws of the State of California",
    indemnification_present: "Yes — mutual indemnification including IP infringement carve-out",
    liability_cap: "Yes — capped at fees paid in the preceding twelve (12) months, subject to carve-outs for IP and confidentiality breaches",
    lease_component: "No — cloud consumption with no identified physical asset under Subscriber control",
    embedded_derivative: "Yes — the pricing contains a CPI-U indexed escalator capped at 6% annually; Subscriber shall evaluate under ASC 815 for potential embedded derivative bifurcation",
    expense_recognition_method: "Straight-line — subscription benefit is consumed ratably each period; prepayment offsets a Prepaid Asset",
    performance_obligations: "Single performance obligation — provision of Service across the Term with 99.95% uptime SLA",
    pricing_variability: "CPI-U indexed annual escalator, minimum 3%, maximum 6%",
    minimum_commitment: "500 named users minimum for the Term; $450,000 annual minimum pre-CPI",
    exclusivity_clause: "No — Subscriber may purchase similar services from other providers",
    ip_ownership: "Subscriber retains Subscriber Data. Provider retains platform and software IP. Subscriber receives a non-exclusive, non-transferable, revocable license.",
    confidentiality_term: "Five (5) years post-termination",
    change_order_mechanism: "Commercial terms require written amendment; add-ons may use click-through order forms",
    acme_signer: "Linda Okeke", acme_title: "Chief Information Officer",
    cp_signer: "Priya Sharma", cp_title: "VP Enterprise Sales, Nexus Cloud",
  },
  {
    file: "Golden_C_Atlas_Office_Lease.docx",
    docTitle: "COMMERCIAL OFFICE LEASE AGREEMENT",
    recitals: "This Commercial Lease Agreement (the \"Lease\") is entered into as of July 1, 2026 (the \"Commencement Date\") by and between Atlas Realty Partners, LP, a Delaware limited partnership (\"Landlord\"), and Acme Co, a Delaware corporation (\"Tenant\").",
    counterparty: "Atlas Realty Partners, LP",
    contract_type: "Commercial Real Estate Lease Agreement",
    effective_date: "July 1, 2026",
    expiration_date: "June 30, 2031",
    service_start_date: "July 1, 2026",
    service_end_date: "June 30, 2031",
    total_contract_value: "USD $3,600,000 (Three Million Six Hundred Thousand US Dollars) aggregate base rent over the five-year Term",
    currency: "USD (United States Dollars)",
    payment_terms: "Monthly, payable on the first business day of each month in advance",
    billing_frequency: "Monthly, in advance",
    fee_schedule: "Base Rent: $60,000 per month × 60 months = $3,600,000. No annual escalator. Common Area Maintenance and taxes billed separately.",
    service_description: "Lease of 12,000 rentable square feet of Class-A office space at 1500 Innovation Way, Portland, OR 97209, Suite 400, including 15 designated parking spaces.",
    auto_renewal: "No — Tenant has two five-year extension options exercisable on twelve (12) months prior written notice at then-negotiated rent",
    termination_notice_days: "Lease is non-cancelable except for material default with thirty (30) days cure period",
    governing_law: "Laws of the State of Oregon",
    indemnification_present: "Yes — Tenant indemnifies Landlord for claims arising from Tenant's use of Premises; Landlord indemnifies for structural defects",
    liability_cap: "Landlord liability limited to Landlord's interest in the Building; consequential damages excluded",
    lease_component: "Yes — this is a long-term real estate operating lease; Tenant recognizes a right-of-use asset and lease liability at the Commencement Date under ASC 842",
    embedded_derivative: "No — rent is fixed with no indexing to financial variables",
    expense_recognition_method: "Straight-line lease expense over the five-year Term per ASC 842",
    performance_obligations: "Landlord provides quiet enjoyment and structural maintenance; Tenant pays rent and maintains the Premises",
    pricing_variability: "None — base rent is fixed for the full Term",
    minimum_commitment: "$3,600,000 aggregate base rent over 60 months, non-cancelable",
    exclusivity_clause: "No",
    ip_ownership: "Not applicable — real estate lease",
    confidentiality_term: "Terms of this Lease are confidential for five (5) years post-expiration",
    change_order_mechanism: "Any amendment requires a written Lease Amendment signed by Landlord and Tenant",
    acme_signer: "Michael Chen", acme_title: "Chief Real Estate Officer",
    cp_signer: "Victoria Ashford", cp_title: "Managing Director, Atlas Realty Partners",
  },
  {
    file: "Golden_D_Summit_Construction_Buildout.docx",
    docTitle: "FIXED-PRICE CONSTRUCTION AGREEMENT",
    recitals: "This Fixed-Price Construction Agreement (the \"Agreement\") is entered into as of August 1, 2026 (the \"Effective Date\") by and between Acme Co (\"Client\") and Summit Builders LLC, an Oregon limited liability company (\"Contractor\").",
    counterparty: "Summit Builders LLC",
    contract_type: "Fixed-Price Construction Agreement — Retail Store Buildout",
    effective_date: "August 1, 2026",
    expiration_date: "April 30, 2027",
    service_start_date: "August 1, 2026",
    service_end_date: "April 30, 2027",
    total_contract_value: "USD $8,500,000 (Eight Million Five Hundred Thousand US Dollars) fixed price",
    currency: "USD (United States Dollars)",
    payment_terms: "Net 30 days from certified milestone draw",
    billing_frequency: "Milestone-based — five (5) draws",
    fee_schedule: "Milestone 1 (Site Prep) $850,000 · M2 (Structural) $1,700,000 · M3 (Build-out) $2,550,000 · M4 (Fixtures) $2,550,000 · M5 (Commissioning) $850,000 · Total $8,500,000",
    service_description: "Complete turnkey buildout of 28 Acme retail stores across the Pacific Northwest — demolition, structural, fixtures, electrical, HVAC, and commissioning.",
    auto_renewal: "No — agreement terminates upon final milestone completion or April 30, 2027, whichever comes first",
    termination_notice_days: "Client may terminate for convenience on thirty (30) days written notice with payment for milestones accepted plus documented work-in-progress on in-flight milestone",
    governing_law: "Laws of the State of Oregon",
    indemnification_present: "Yes — Contractor indemnifies Client for third-party claims arising from Contractor's negligence, bodily injury, or property damage",
    liability_cap: "Yes — Contractor aggregate liability capped at contract value ($8.5M); performance bonds required",
    lease_component: "No — Client owns the underlying real estate; this is a construction capex engagement",
    embedded_derivative: "No — fees fixed with no indexing",
    expense_recognition_method: "Direct-association — recognized as milestones are certified and accepted; capitalized to Construction in Progress pending commissioning",
    performance_obligations: "Five distinct performance obligations — one per milestone; each represents a separable deliverable",
    pricing_variability: "None — fixed-price; any scope changes via written Change Order",
    minimum_commitment: "$8,500,000 fixed",
    exclusivity_clause: "No",
    ip_ownership: "Client owns all constructed improvements, designs, and specifications upon payment",
    confidentiality_term: "Two (2) years post-completion",
    change_order_mechanism: "Any scope change requires written Change Order signed by Project Managers of both parties with 48-hour escalation protocol",
    acme_signer: "Priya Nair", acme_title: "Chief Real Estate Officer",
    cp_signer: "Thomas O'Brien", cp_title: "President, Summit Builders LLC",
  },
  {
    file: "Golden_E_Olympic_Insurance_MultiYear.docx",
    docTitle: "MULTI-YEAR PROPERTY & CASUALTY INSURANCE POLICY",
    recitals: "This Multi-Year Insurance Policy (the \"Policy\") is issued as of September 1, 2026 (the \"Effective Date\") by Olympic Insurance Group, Inc., a New York corporation (\"Insurer\") to Acme Co (\"Insured\").",
    counterparty: "Olympic Insurance Group, Inc.",
    contract_type: "Multi-Year Property & Casualty Insurance Policy",
    effective_date: "September 1, 2026",
    expiration_date: "August 31, 2029",
    service_start_date: "September 1, 2026",
    service_end_date: "August 31, 2029",
    total_contract_value: "USD $2,250,000 (Two Million Two Hundred Fifty Thousand US Dollars) aggregate premium over three years",
    currency: "USD (United States Dollars)",
    payment_terms: "Annual pre-payment due thirty (30) days before each anniversary",
    billing_frequency: "Annual, in advance",
    fee_schedule: "Annual premium $750,000 × 3 years = $2,250,000. Premium fixed for the Term subject to loss-experience adjustment at renewal.",
    service_description: "Property and casualty coverage for Acme's global operations — property, business interruption, general liability, automobile, and excess coverage per Declarations.",
    auto_renewal: "No — renewal is by mutual written agreement at Term expiration",
    termination_notice_days: "90 days written notice; cancellation subject to short-rate premium calculation",
    governing_law: "Laws of the State of New York",
    indemnification_present: "Yes — Insurer indemnifies Insured for covered losses per Policy Declarations",
    liability_cap: "Yes — Insurer liability capped at Policy Limits set forth in Declarations",
    lease_component: "No — this is an insurance contract; no right-to-use asset",
    embedded_derivative: "No — premium is fixed; not indexed to financial variables",
    expense_recognition_method: "Straight-line amortization of annual prepaid premium — $62,500 per month; offsets Prepaid Insurance asset",
    performance_obligations: "Single performance obligation — coverage per Declarations and claim handling throughout the Term",
    pricing_variability: "Premium fixed for the Term; subject to loss-experience adjustment at renewal",
    minimum_commitment: "$750,000 per annual policy year; $2,250,000 aggregate over three years",
    exclusivity_clause: "No",
    ip_ownership: "Not applicable — insurance policy",
    confidentiality_term: "Policy term plus five (5) years",
    change_order_mechanism: "Modifications to coverage require written Endorsement signed by Insurer and Insured",
    acme_signer: "Karen Mitchell", acme_title: "VP Risk Management",
    cp_signer: "James Whitman", cp_title: "SVP Commercial Underwriting, Olympic Insurance Group",
  },
];

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Generating 5 golden contracts...\n");
  for (const c of contracts) {
    const doc = buildContract(c);
    const buf = await Packer.toBuffer(doc);
    const out = path.join(OUT_DIR, c.file);
    fs.writeFileSync(out, buf);
    console.log(`  ✓ ${c.file}  (${buf.length} bytes)`);
  }
  console.log("\nAll 5 contracts written to samples/acme/");
  console.log("Next: cd server && pnpm seed   (ingests all samples into Postgres)");
}

run();
