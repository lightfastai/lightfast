import { createDatabase } from "@vendor/db";
import { env } from "./env";
import * as schema from "./schema";

export function createClient() {
  const host = requireEnv("DATABASE_HOST", env.DATABASE_HOST);
  const username = requireEnv("DATABASE_USERNAME", env.DATABASE_USERNAME);
  const password = requireEnv("DATABASE_PASSWORD", env.DATABASE_PASSWORD);
  return createDatabase({ host, password, username }, schema);
}

export const db = createClient();

/**
 * The Drizzle database client type. Repository helpers accept this so they
 * stay testable and transport-agnostic — callers pass `ctx.db`.
 */
export type Database = typeof db;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required to create the PlanetScale client.`);
  }
  return value;
}
