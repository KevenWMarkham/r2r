import pg from "pg";
import pgvector from "pgvector/pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://noah:noah@localhost:5434/noah";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

// Register pgvector type parser so VECTOR columns round-trip as number[]
pool.on("connect", async (client) => {
  await pgvector.registerTypes(client);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
