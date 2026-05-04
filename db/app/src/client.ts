import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "./schema";

type AppDatabase = ReturnType<typeof createNeonDatabase>;

/**
 * Create a new database client instance using Neon HTTP driver.
 * Local dev uses the Docker Postgres TCP connection from dev-services.
 */
export function createClient(): AppDatabase {
  const databaseUrl = resolveDatabaseUrl({
    ssl: !isLocalDatabaseHost(env.DATABASE_HOST),
  });

  if (isLocalDatabaseHost(env.DATABASE_HOST)) {
    const sql = postgres(databaseUrl, { max: 10 });
    return withLocalBatch(
      drizzlePostgres(sql, { schema })
    ) as unknown as AppDatabase;
  }

  return createNeonDatabase(databaseUrl);
}

/**
 * Default database client instance
 */
export const db = createClient();

function createNeonDatabase(databaseUrl: string) {
  // Required: point Neon driver at PlanetScale's HTTP SQL endpoint.
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  const sql = neon(databaseUrl);

  return drizzleNeonHttp({ client: sql, schema });
}

function withLocalBatch<T extends object>(database: T) {
  return Object.assign(database, {
    batch: async (queries: readonly PromiseLike<unknown>[]) =>
      Promise.all(queries),
  });
}

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

function isLocalDatabaseHost(value: string) {
  const hostname = value.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}
