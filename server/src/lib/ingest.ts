// Server-side document text extraction.
// Supports .pdf via pdf-parse and .docx via mammoth. Returns full text + a SHA-256 hash.

import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type FileType = "pdf" | "docx";

export interface ExtractedDocument {
  fullText: string;
  fileType: FileType;
  sha256: string;
  byteSize: number;
}

export class IngestError extends Error {}

export function detectFileType(filename: string): FileType {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  throw new IngestError(`Unsupported file type: ${filename}. Only .pdf and .docx are accepted.`);
}

export async function extract(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
  const fileType = detectFileType(filename);
  let fullText = "";

  if (fileType === "pdf") {
    const result = await pdfParse(buffer);
    fullText = result.text ?? "";
  } else {
    const result = await mammoth.extractRawText({ buffer });
    fullText = result.value ?? "";
  }

  if (fullText.trim().length < 200) {
    throw new IngestError(
      "Document produced <200 chars of text. If this is a scanned PDF, OCR is not supported in the prototype — use a text-based PDF or DOCX."
    );
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { fullText, fileType, sha256, byteSize: buffer.length };
}
