// Embedding helper — calls Ollama's /api/embeddings endpoint with nomic-embed-text.
// Produces a 768-dim vector. Matches the VECTOR(768) column in contract_metabase.

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 768);

export class EmbeddingError extends Error {}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export async function embed(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new EmbeddingError("Cannot embed empty text");
  }

  // Ollama has a context limit; trim long inputs to the first ~8K chars
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text;

  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: truncated }),
  });

  if (!res.ok) {
    throw new EmbeddingError(`Ollama embeddings HTTP ${res.status}: ${await res.text()}`);
  }

  const data: OllamaEmbeddingResponse = await res.json();
  if (!Array.isArray(data.embedding)) {
    throw new EmbeddingError("Ollama response missing embedding array");
  }
  if (data.embedding.length !== EMBEDDING_DIM) {
    throw new EmbeddingError(
      `Embedding dim mismatch: got ${data.embedding.length}, expected ${EMBEDDING_DIM}. ` +
      `Schema assumes ${EMBEDDING_MODEL} (${EMBEDDING_DIM} dims).`
    );
  }
  return data.embedding;
}
