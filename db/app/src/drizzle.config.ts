import { defineConfig } from "drizzle-kit";
import { env } from "./env";

const isLocalDatabase =
  env.DATABASE_HOST === "localhost" ||
  env.DATABASE_HOST === "127.0.0.1" ||
  env.DATABASE_HOST === "::1";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT ?? 5432, // Direct connection for migrations (not pgBouncer)
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME ?? "postgres",
    ssl: !isLocalDatabase,
  },
  introspect: {
    casing: "camel",
  },
});
