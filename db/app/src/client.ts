import {
  createNeonHttpClient,
  type NeonHttpDatabase,
} from "./drivers/neon-http";
import { createPostgresClient } from "./drivers/postgres";
import { env } from "./env";
import { withBatchPolyfill } from "./polyfills/batch";

// Canonical DB surface. Both drivers must satisfy this type — neon-http
// does so natively; postgres-js + withBatchPolyfill is bridged by an
// `as unknown as AppDatabase` cast in the local branch below.
type AppDatabase = NeonHttpDatabase;

/**
 * Create a new database client.
 *
 * Routing:
 *   - Local dev (DATABASE_HOST is localhost / 127.0.0.1 / ::1)
 *       → postgres-js over TCP against the dev-services Docker Postgres,
 *         wrapped with `withBatchPolyfill` so `.batch()` call sites work.
 *   - Everything else
 *       → neon-http against PlanetScale's HTTP SQL endpoint.
 */
export function createClient(): AppDatabase {
  const databaseUrl = resolveDatabaseUrl({
    ssl: !isLocalDatabaseHost(env.DATABASE_HOST),
  });

  if (isLocalDatabaseHost(env.DATABASE_HOST)) {
    return withBatchPolyfill(
      createPostgresClient(databaseUrl)
    ) as unknown as AppDatabase;
  }

  return createNeonHttpClient(databaseUrl);
}

/**
 * Default database client instance.
 */
export const db = createClient();

// URL construction lives here (not in drivers/) because both drivers
// take a connection URL and the build logic — including ssl=require for
// remote hosts — is shared. Using URL/URL avoids string-interpolation
// bugs with special characters in passwords.
function resolveDatabaseUrl({ ssl }: { ssl: boolean }) {
  const url = new URL("postgresql://localhost");
  url.hostname = env.DATABASE_HOST;
  url.port = env.DATABASE_PORT ? String(env.DATABASE_PORT) : "";
  url.username = env.DATABASE_USERNAME;
  url.password = env.DATABASE_PASSWORD;
  url.pathname = `/${env.DATABASE_NAME ?? "postgres"}`;
  if (ssl) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

// Driver-routing predicate lives here (not in env.ts, not in drivers/)
// because picking a driver is the orchestrator's job. Drivers don't
// know what "local" means — they just connect to the URL they're given.
// Note: drizzle.config.ts intentionally duplicates this 3-line check
// because drizzle-kit runs at build time with its own sync config and
// shouldn't depend on the runtime client module.
function isLocalDatabaseHost(value: string) {
  const hostname = value.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}
