import { createDatabase } from "@vendor/db";
import { env } from "./env";
import * as schema from "./schema";

export function createClient() {
  const host = requireEnv("DATABASE_HOST", env.DATABASE_HOST);
  const username = requireEnv("DATABASE_USERNAME", env.DATABASE_USERNAME);
  const password = requireEnv("DATABASE_PASSWORD", env.DATABASE_PASSWORD);
  return createDatabase({ host, password, username }, schema);
}

/**
 * The Drizzle database client type. Repository helpers accept this so they
 * stay testable and transport-agnostic — callers pass `ctx.db`.
 */
export type Database = ReturnType<typeof createClient>;

let client: Database | undefined;

export function getClient(): Database {
  client ??= createClient();
  return client;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const database = getClient();
    const value = Reflect.get(database as object, prop, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required to create the PlanetScale client.`);
  }
  return value;
}
