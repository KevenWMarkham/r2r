import { chatJSON, OllamaError } from "./ollama-client";
import {
  CONTRACT_ATTRIBUTE_NAMES,
  ContractAttributesSchema,
  emptyAttributes,
  type ContractAttributes,
} from "./contract-schema";

const SYSTEM = `You are a meticulous contract analyst. Extract exactly the 27 specified attributes from a contract. For each attribute, provide:
- value: the extracted value (string, number, boolean, or null if not found)
- confidence: a score 0.0 to 1.0 representing how confident you are in the extracted value
- source_page: the 1-indexed page number where this value appears (or null if uncertain)

Critical rules:
- Never guess. If an attribute is unclear, set value to null and confidence to 0.0 (or low).
- Do NOT fabricate numbers or dates.
- Return ONLY valid JSON. No prose, no markdown, no code fences.`;

function buildSchemaHint(): string {
  const fields = CONTRACT_ATTRIBUTE_NAMES.map(
    (n) => `  "${n}": { "value": <string|number|boolean|null>, "confidence": <0..1>, "source_page": <int|null> }`
  ).join(",\n");
  return `{\n${fields}\n}`;
}

export interface ExtractorResult {
  attributes: ContractAttributes;
  degraded: boolean;
  raw?: unknown;
  warning?: string;
}

export async function extractAttributes(fullText: string): Promise<ExtractorResult> {
  const truncated = fullText.length > 12000 ? fullText.slice(0, 12000) : fullText;
  const prompt = `Contract text:\n\n${truncated}\n\nExtract all 27 attributes.`;
  const schemaHint = buildSchemaHint();

  let raw: unknown;
  try {
    raw = await chatJSON({ system: SYSTEM, prompt, schemaHint, temperature: 0.1 });
  } catch (e) {
    if (e instanceof OllamaError) {
      try {
        raw = await chatJSON({
          system: SYSTEM,
          prompt: `${prompt}\n\nYour previous response was invalid JSON. Please retry and return ONLY the JSON object.`,
          schemaHint,
          temperature: 0.1,
        });
      } catch (e2) {
        return {
          attributes: emptyAttributes(),
          degraded: true,
          warning: `Extraction failed after retry: ${String(e2)}`,
        };
      }
    } else {
      throw e;
    }
  }

  const parsed = ContractAttributesSchema.safeParse(raw);
  if (parsed.success) {
    return { attributes: reconcileAliases(parsed.data), degraded: false, raw };
  }

  // Partial parse: try to salvage individual fields from the raw response
  const salvaged = emptyAttributes();
  if (raw && typeof raw === "object") {
    for (const name of CONTRACT_ATTRIBUTE_NAMES) {
      const field = (raw as Record<string, unknown>)[name];
      const check = (salvaged as unknown as Record<string, unknown>);
      const fieldParse = ContractAttributesSchema.shape[name].safeParse(field);
      if (fieldParse.success) {
        check[name] = fieldParse.data;
      }
    }
  }
  return {
    attributes: reconcileAliases(salvaged),
    degraded: true,
    raw,
    warning: `Partial schema match — ${parsed.error.issues.length} fields invalid, rendering nulls for those.`,
  };
}

// Post-process pass: the 27-attribute schema has several near-duplicate pairs
// (effective_date ≈ service_start_date; expiration_date ≈ service_end_date).
// Smaller models reliably populate one alias but leave the twin null. Reconcile
// them deterministically here — this is ALIAS RESOLUTION, not derivation, so we
// keep the same value + confidence + source_page and just mirror it across.
function reconcileAliases(attrs: ContractAttributes): ContractAttributes {
  const out = { ...attrs } as ContractAttributes;
  const raw = out as unknown as Record<string, { value: unknown; confidence: number; source_page: number | null }>;

  const mirror = (primary: string, alias: string) => {
    const p = raw[primary];
    const a = raw[alias];
    const pHas = p && p.value !== null && p.confidence > 0;
    const aHas = a && a.value !== null && a.confidence > 0;
    if (pHas && !aHas) {
      raw[alias] = { ...p!, confidence: Math.max(0.6, p!.confidence - 0.2) }; // slight penalty to flag derived
    } else if (!pHas && aHas) {
      raw[primary] = { ...a!, confidence: Math.max(0.6, a!.confidence - 0.2) };
    }
  };

  mirror("effective_date", "service_start_date");
  mirror("expiration_date", "service_end_date");

  return out;
}
