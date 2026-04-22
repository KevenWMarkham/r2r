import { z } from "zod";

export const CONTRACT_ATTRIBUTE_NAMES = [
  "counterparty",
  "contract_type",
  "effective_date",
  "expiration_date",
  "total_contract_value",
  "currency",
  "payment_terms",
  "billing_frequency",
  "fee_schedule",
  "service_description",
  "service_start_date",
  "service_end_date",
  "auto_renewal",
  "termination_notice_days",
  "governing_law",
  "indemnification_present",
  "liability_cap",
  "lease_component",
  "embedded_derivative",
  "expense_recognition_method",
  "performance_obligations",
  "pricing_variability",
  "minimum_commitment",
  "exclusivity_clause",
  "ip_ownership",
  "confidentiality_term",
  "change_order_mechanism",
] as const;

export type ContractAttributeName = (typeof CONTRACT_ATTRIBUTE_NAMES)[number];

export const AttributeField = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  source_page: z.number().int().min(1).nullable(),
});

export type AttributeField = z.infer<typeof AttributeField>;

export const ContractAttributesSchema = z.object(
  Object.fromEntries(CONTRACT_ATTRIBUTE_NAMES.map((n) => [n, AttributeField])) as {
    [K in ContractAttributeName]: typeof AttributeField;
  }
);

export type ContractAttributes = z.infer<typeof ContractAttributesSchema>;

export function emptyAttributes(): ContractAttributes {
  return Object.fromEntries(
    CONTRACT_ATTRIBUTE_NAMES.map((n) => [n, { value: null, confidence: 0, source_page: null }])
  ) as ContractAttributes;
}

// Human-friendly labels for the UI checklist
export const ATTRIBUTE_LABELS: Record<ContractAttributeName, string> = {
  counterparty: "Counterparty",
  contract_type: "Contract Type",
  effective_date: "Effective Date",
  expiration_date: "Expiration Date",
  total_contract_value: "Total Contract Value (TCV)",
  currency: "Currency",
  payment_terms: "Payment Terms",
  billing_frequency: "Billing Frequency",
  fee_schedule: "Fee Schedule",
  service_description: "Service Description",
  service_start_date: "Service Start Date",
  service_end_date: "Service End Date",
  auto_renewal: "Auto-Renewal",
  termination_notice_days: "Termination Notice (days)",
  governing_law: "Governing Law",
  indemnification_present: "Indemnification Present",
  liability_cap: "Liability Cap",
  lease_component: "Lease Component",
  embedded_derivative: "Embedded Derivative",
  expense_recognition_method: "Expense Recognition Method",
  performance_obligations: "Performance Obligations",
  pricing_variability: "Pricing Variability",
  minimum_commitment: "Minimum Commitment",
  exclusivity_clause: "Exclusivity Clause",
  ip_ownership: "IP Ownership",
  confidentiality_term: "Confidentiality Term",
  change_order_mechanism: "Change Order Mechanism",
};
