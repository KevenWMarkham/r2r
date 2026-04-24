// Simulated Posting Agent — mocks the BlackLine REST call that invokes
// SAP's BAPI_ACC_DOCUMENT_POST. In production this is a real async call
// with retries + 60s SLA; here we fake ~1s round-trip and return a
// plausible SAP doc number.

export interface PostResult {
  success: boolean;
  posting_ref: string;      // SAP document number
  posted_at: Date;
  latency_ms: number;
}

let _counter = 4_500_000_000;

function nextSapDocNum(): string {
  _counter += 1 + Math.floor(Math.random() * 7);  // non-sequential gaps
  return String(_counter);
}

export async function postToSAPviaBlackLine(jeId: string): Promise<PostResult> {
  const t0 = Date.now();
  const latency = 800 + Math.floor(Math.random() * 600);  // 800-1400ms
  await new Promise((r) => setTimeout(r, latency));
  return {
    success: true,
    posting_ref: nextSapDocNum(),
    posted_at: new Date(),
    latency_ms: Date.now() - t0,
  };
}

// Simulated reversal — fires on the 1st of the period after posted_at
let _reversalCounter = 4_600_000_000;
export function nextReversalDocNum(): string {
  _reversalCounter += 1 + Math.floor(Math.random() * 5);
  return String(_reversalCounter);
}
