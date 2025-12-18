import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Create a new database client instance using postgres-js
 */
export function createClient() {
  const connectionString = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:6432/postgres?sslmode=verify-full`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 20,              // Match PlanetScale default_pool_size
    prepare: false,       // Required for PgBouncer transaction mode
    idle_timeout: 20,     // Serverless: close idle connections after 20s
    connect_timeout: 10,  // Fail fast on connection issues
  });

  return drizzle(client, { schema });
}

/**
 * Default database client instance
 */
export const db = createClient();
