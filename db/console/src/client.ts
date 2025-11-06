import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Create a new database client instance using postgres-js
 */
export function createClient() {
  const connectionString = `postgres://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}/lightfast-app?sslmode=require`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 10, // Connection pool size
  });

  return drizzle(client, { schema });
}

/**
 * Default database client instance
 */
export const db = createClient();
