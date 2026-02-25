import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "@db/console/schema";

const connectionString = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:6432/postgres?sslmode=verify-full`;

const client = postgres(connectionString, {
  ssl: "require",
  max: 10, // Gateway has lower connection needs than Console
  prepare: false, // Required for PgBouncer transaction mode
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
