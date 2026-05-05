import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../schema";

export type NeonHttpDatabase = ReturnType<typeof createNeonHttpClient>;

/**
 * Drizzle client over the Neon HTTP driver, pointed at PlanetScale's
 * HTTP SQL endpoint. Edge-compatible (uses fetch, not TCP). Exposes
 * `.batch([...])` natively for atomic multi-statement execution.
 */
export function createNeonHttpClient(databaseUrl: string) {
  // Required: point Neon driver at PlanetScale's HTTP SQL endpoint.
  // Idempotent assignment — safe to run on every call.
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}
