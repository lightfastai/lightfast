import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../env";
import * as schema from "./schema";

// Required: point Neon driver at PlanetScale's HTTP SQL endpoint
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

/**
 * Create a new database client instance using Neon HTTP driver.
 * Edge-compatible — uses fetch() instead of TCP sockets.
 */
export function createClient() {
  const sql = neon(
    `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}/postgres?sslmode=require`,
  );

  return drizzle({ client: sql, schema });
}

/**
 * Default database client instance
 */
export const db = createClient();
