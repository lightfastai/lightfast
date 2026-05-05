import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";

export type PostgresJsDatabase = ReturnType<typeof createPostgresClient>;

/**
 * Drizzle client over postgres-js, used for local development against
 * the dev-services Docker Postgres (TCP). Does NOT expose `.batch()` —
 * apply `withBatchPolyfill` in `client.ts` to bridge the surface.
 */
export function createPostgresClient(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 10 });
  return drizzle(sql, { schema });
}
