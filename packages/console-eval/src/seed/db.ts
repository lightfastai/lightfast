import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/console/schema";
import type { EvalInfraConfig } from "../context/eval-context";

/**
 * Create a database client for eval seeding.
 * Uses postgres-js TCP driver through PgBouncer, same as production.
 * Lower pool size since eval has less concurrent load.
 *
 * Connection: postgresql://{user}:{pass}@{host}:6432/postgres?sslmode=verify-full
 * Matches production pattern in db/console/src/client.ts:9-21
 */
export function createEvalDbClient(infra: EvalInfraConfig) {
  const connectionString = `postgresql://${infra.db.username}:${infra.db.password}@${infra.db.host}:6432/postgres?sslmode=verify-full`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
