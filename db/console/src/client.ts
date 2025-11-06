import { drizzle } from "drizzle-orm/planetscale-serverless";
import { Client } from "@planetscale/database";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Create a new database client instance
 */
export function createClient() {
  const client = new Client({
    host: env.DATABASE_HOST,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
  });

  return drizzle(client, { schema });
}

/**
 * Default database client instance
 */
export const db = createClient();
