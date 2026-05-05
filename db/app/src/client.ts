import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "./env";
import * as schema from "./schema";

const NEON_HTTP_PROXY_PORT = 4444;

export function createClient() {
  neonConfig.fetchEndpoint = (host) => {
    if (isLocalDatabaseHost(host)) {
      return `http://${host}:${NEON_HTTP_PROXY_PORT}/sql`;
    }
    return `https://${host}/sql`;
  };

  return drizzle({ client: neon(resolveDatabaseUrl()), schema });
}

export const db = createClient();

function resolveDatabaseUrl() {
  const url = new URL("postgresql://localhost");
  url.hostname = env.DATABASE_HOST;
  url.username = env.DATABASE_USERNAME;
  url.password = env.DATABASE_PASSWORD;
  url.pathname = `/${env.DATABASE_NAME ?? "postgres"}`;
  if (!isLocalDatabaseHost(env.DATABASE_HOST)) {
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
