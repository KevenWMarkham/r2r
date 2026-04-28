// Stylized contract wireframe — renders a paper-like document preview
// populated from the fixture attributes. Used in canned mode where the
// full extracted text isn't bundled, but we still want a visually rich
// "document" panel for the demo.

import type { ContractDetail } from "@/lib/api-client";

interface AttrValue {
  value: unknown;
  confidence?: number;
  source_page?: number | null;
}

function attr<T = unknown>(c: ContractDetail, key: string): T | null {
  const a = (c.attributes as Record<string, AttrValue> | null)?.[key];
  if (!a) return null;
  return (a.value as T) ?? null;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtUSD(n: number | null): string {
  if (n == null) return "—";
  return `USD $${n.toLocaleString("en-US")}`;
}

function inferContractTitle(c: ContractDetail): string {
  const ct = attr<string>(c, "contract_type");
  if (ct) return ct.toUpperCase();
  // Fallbacks based on filename patterns
  const fn = c.filename.toLowerCase();
  if (fn.includes("lease")) return "COMMERCIAL OFFICE LEASE AGREEMENT";
  if (fn.includes("insurance")) return "MULTI-YEAR PROPERTY & CASUALTY INSURANCE POLICY";
  if (fn.includes("construction")) return "FIXED-PRICE CONSTRUCTION AGREEMENT";
  if (fn.includes("saas") || fn.includes("subscription")) return "ENTERPRISE SAAS SUBSCRIPTION AGREEMENT";
  if (fn.includes("aws") || fn.includes("cloud")) return "ENTERPRISE CLOUD SERVICES AGREEMENT";
  return "MASTER SERVICES AGREEMENT";
}

export default function ContractWireframe({ contract }: { contract: ContractDetail }) {
  const counterparty = contract.counterparty ?? attr<string>(contract, "counterparty") ?? "Counterparty";
  const title = inferContractTitle(contract);
  const effective = attr<string>(contract, "effective_date");
  const expiration = attr<string>(contract, "expiration_date");
  const serviceStart = attr<string>(contract, "service_start_date");
  const serviceEnd = attr<string>(contract, "service_end_date");
  const tcv = attr<number>(contract, "total_contract_value");
  const currency = attr<string>(contract, "currency") ?? "USD";
  const paymentTerms = attr<string>(contract, "payment_terms");
  const billingFreq = attr<string>(contract, "billing_frequency");
  const feeSchedule = attr<string>(contract, "fee_schedule");
  const serviceDesc = attr<string>(contract, "service_description");
  const autoRenewal = attr<boolean>(contract, "auto_renewal");
  const noticeDays = attr<number>(contract, "termination_notice_days");
  const governing = attr<string>(contract, "governing_law");
  const indemn = attr<boolean>(contract, "indemnification_present");
  const liability = attr<unknown>(contract, "liability_cap");
  const liabilityStr =
    typeof liability === "string" ? liability : liability === true ? "Yes" : liability === false ? "No" : "—";
  const leaseFlag = attr<boolean>(contract, "lease_component");
  const derivFlag = attr<boolean>(contract, "embedded_derivative");
  const expenseMethod = attr<string>(contract, "expense_recognition_method");
  const exclusivity = attr<boolean>(contract, "exclusivity_clause");
  const ipOwnership = attr<string>(contract, "ip_ownership");
  const confTerm = attr<string>(contract, "confidentiality_term");
  const minCommit = attr<string>(contract, "minimum_commitment");
  const pricingVar = attr<string>(contract, "pricing_variability");
  const performance = attr<string>(contract, "performance_obligations");
  const changeOrder = attr<string>(contract, "change_order_mechanism");

  const partyDescriptor = (() => {
    const ct = (attr<string>(contract, "contract_type") ?? "").toLowerCase();
    if (ct.includes("lease")) return "Landlord";
    if (ct.includes("insurance") || ct.includes("policy")) return "Insurer";
    if (ct.includes("construction")) return "Contractor";
    if (ct.includes("saas") || ct.includes("subscription")) return "Provider";
    return "Service Provider";
  })();

  return (
    <div className="max-h-[560px] overflow-y-auto bg-stone-100 text-stone-900 border border-brand-border shadow-inner">
      {/* "Page" — paper-styled document */}
      <div className="bg-stone-50 mx-auto my-4 max-w-[640px] shadow-[0_2px_8px_rgba(0,0,0,0.4)] px-10 py-12 font-serif text-[12px] leading-relaxed">
        {/* Title block */}
        <div className="text-center pb-6 border-b-2 border-stone-800">
          <div className="font-sans text-[10px] uppercase tracking-[3px] text-stone-500 mb-2">
            {currency}-Denominated · Effective {fmtDate(effective)}
          </div>
          <h1 className="text-[22px] font-bold uppercase tracking-wide text-stone-900 leading-tight">
            {title}
          </h1>
          <div className="mt-3 text-[13px] text-stone-700">
            <span className="font-semibold">Acme Co</span>
            <span className="mx-2 text-stone-400">—</span>
            <span className="font-semibold">{counterparty}</span>
          </div>
        </div>

        {/* Preamble */}
        <p className="mt-6 text-stone-800">
          This <span className="italic">{title.split(" ").slice(0, -1).join(" ").toLowerCase()}</span>{" "}
          (the &ldquo;Agreement&rdquo;) is entered into as of <strong>{fmtDate(effective)}</strong>{" "}
          (the &ldquo;Effective Date&rdquo;) by and between <strong>Acme Co</strong>, a Delaware
          corporation (&ldquo;Acme&rdquo; or &ldquo;Client&rdquo;), and <strong>{counterparty}</strong>{" "}
          (the &ldquo;{partyDescriptor}&rdquo;).
        </p>

        {/* Summary of key terms — tabled like real contract preamble */}
        <h2 className="mt-8 mb-3 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700 border-b border-stone-300 pb-1">
          Summary of Key Terms
        </h2>
        <table className="w-full text-[11px] border-collapse">
          <tbody>
            {[
              ["Counterparty", counterparty],
              ["Contract Type", attr<string>(contract, "contract_type") ?? "—"],
              ["Effective Date", fmtDate(effective)],
              ["Expiration Date", fmtDate(expiration)],
              ["Service Start Date", fmtDate(serviceStart)],
              ["Service End Date", fmtDate(serviceEnd)],
              ["Total Contract Value", fmtUSD(tcv)],
              ["Currency", currency],
              ["Payment Terms", paymentTerms ?? "—"],
              ["Billing Frequency", billingFreq ?? "—"],
              ["Fee Schedule", feeSchedule ?? "—"],
              ["Service Description", serviceDesc ?? "—"],
              ["Auto-Renewal", autoRenewal === true ? "Yes" : autoRenewal === false ? "No" : "—"],
              ["Termination Notice Days", noticeDays != null ? `${noticeDays} days` : "—"],
              ["Governing Law", governing ?? "—"],
              ["Indemnification Present", indemn === true ? "Yes" : indemn === false ? "No" : "—"],
              ["Liability Cap", liabilityStr],
              ["Lease Component", leaseFlag === true ? "Yes (ASC 842)" : leaseFlag === false ? "No" : "—"],
              ["Embedded Derivative", derivFlag === true ? "Yes (ASC 815)" : derivFlag === false ? "No" : "—"],
              ["Expense Recognition Method", expenseMethod ?? "—"],
              ["Performance Obligations", performance ?? "—"],
              ["Pricing Variability", pricingVar ?? "—"],
              ["Minimum Commitment", minCommit ?? "—"],
              ["Exclusivity Clause", exclusivity === true ? "Yes" : exclusivity === false ? "No" : "—"],
              ["IP Ownership", ipOwnership ?? "—"],
              ["Confidentiality Term", confTerm ?? "—"],
              ["Change Order Mechanism", changeOrder ?? "—"],
            ].map(([k, v], i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-stone-100/60" : ""}>
                <td className="px-2 py-1 align-top font-semibold text-stone-700 w-[40%]">{k}</td>
                <td className="px-2 py-1 align-top text-stone-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Articles — selected high-impact clauses, narrative-style */}
        <h2 className="mt-8 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 1 — Counterparty &amp; Term
        </h2>
        <p className="text-stone-800">
          <strong>1.1 Counterparty.</strong> The counterparty to Acme Co under this Agreement is{" "}
          <strong>{counterparty}</strong>. <strong>1.2 Term.</strong> This Agreement commences on{" "}
          {fmtDate(effective)} and continues through {fmtDate(expiration)} unless terminated earlier
          in accordance with Article 6.
        </p>

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 2 — Fees &amp; Payment
        </h2>
        <p className="text-stone-800">
          <strong>2.1 Fee Schedule.</strong> {feeSchedule ?? "Fees as set forth in the applicable Order Form."}{" "}
          <strong>2.2 Total Contract Value.</strong> The Total Contract Value under this Agreement
          is {fmtUSD(tcv)}. <strong>2.3 Payment Terms.</strong> All undisputed invoices are payable
          on {paymentTerms ?? "Net 30"} terms.{" "}
          {billingFreq && <><strong>2.4 Billing Frequency.</strong> {String(billingFreq).charAt(0).toUpperCase() + String(billingFreq).slice(1)}, in arrears.</>}
        </p>

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 3 — Service Description
        </h2>
        <p className="text-stone-800">
          {serviceDesc ?? "Services as described in the applicable Statement of Work."}{" "}
          {performance && <>The {partyDescriptor.toLowerCase()} undertakes the following performance obligations: {performance}.</>}
        </p>

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 4 — Renewal &amp; Termination
        </h2>
        <p className="text-stone-800">
          <strong>4.1 Renewal.</strong>{" "}
          {autoRenewal
            ? `This Agreement automatically renews for successive twelve (12) month periods unless either party provides ${noticeDays ?? 90} days written notice of non-renewal.`
            : "This Agreement does not auto-renew. Renewal is by mutual written agreement at expiration."}{" "}
          <strong>4.2 Termination.</strong> Either party may terminate for material default upon{" "}
          {noticeDays ?? 30} days written notice with opportunity to cure.
        </p>

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 5 — Liability &amp; Indemnification
        </h2>
        <p className="text-stone-800">
          <strong>5.1 Liability Cap.</strong> {liabilityStr === "Yes" || liabilityStr === "—" ? "Each party's aggregate liability is capped as set forth in the Order Form." : liabilityStr}{" "}
          <strong>5.2 Indemnification.</strong>{" "}
          {indemn
            ? "Mutual indemnification for third-party claims arising from negligence or IP infringement applies, subject to standard carve-outs."
            : "No mutual indemnification provision."}
        </p>

        {(leaseFlag || derivFlag) && (
          <>
            <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
              Article 6 — Accounting Notes (informational)
            </h2>
            <p className="text-stone-800">
              {leaseFlag && (
                <>
                  <strong>6.1 ASC 842 Lease Accounting.</strong> This Agreement contains an
                  identified asset under Client&rsquo;s control over the Term and is therefore
                  expected to be classified as an operating lease under ASC 842; Client recognizes
                  a right-of-use asset and lease liability at the Commencement Date.{" "}
                </>
              )}
              {derivFlag && (
                <>
                  <strong>6.2 ASC 815 Derivative Review.</strong> Pricing contains an indexed
                  escalator that may meet the definition of an embedded derivative under ASC 815.
                  Client shall evaluate the clearly-and-closely-related test for potential
                  bifurcation in advance of the next reporting period.
                </>
              )}
            </p>
          </>
        )}

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 7 — IP &amp; Confidentiality
        </h2>
        <p className="text-stone-800">
          <strong>7.1 IP Ownership.</strong>{" "}
          {ipOwnership ?? "Each party retains ownership of pre-existing intellectual property; rights to deliverables are governed by the applicable Statement of Work."}{" "}
          <strong>7.2 Confidentiality.</strong> Confidentiality obligations survive termination for{" "}
          {confTerm ?? "five (5) years"}.
        </p>

        <h2 className="mt-6 mb-2 font-sans uppercase tracking-[2px] text-[11px] font-bold text-stone-700">
          Article 8 — Governing Law &amp; Miscellaneous
        </h2>
        <p className="text-stone-800">
          <strong>8.1 Governing Law.</strong> This Agreement shall be governed by the laws of the
          State of {governing ?? "Delaware"}, without regard to conflict-of-laws principles.{" "}
          <strong>8.2 Change Orders.</strong> {changeOrder ?? "All changes require a written Change Order signed by both parties' authorized representatives."}
        </p>

        {/* Signature block */}
        <div className="mt-10 grid grid-cols-2 gap-8 pt-6 border-t border-stone-300">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">Acme Co</div>
            <div className="border-b border-stone-400 h-6 mb-1" />
            <div className="text-[10px] text-stone-500">Authorized Signatory · Date</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{counterparty}</div>
            <div className="border-b border-stone-400 h-6 mb-1" />
            <div className="text-[10px] text-stone-500">Authorized Signatory · Date</div>
          </div>
        </div>

        {/* Footer page indicator */}
        <div className="mt-8 pt-3 border-t border-stone-200 flex justify-between text-[9px] text-stone-400 font-sans uppercase tracking-wider">
          <span>{contract.filename}</span>
          <span>Confidential · Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
