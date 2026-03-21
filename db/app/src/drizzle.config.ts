import { defineConfig } from "drizzle-kit";
import { env } from "../env";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: env.DATABASE_HOST,
    port: 5432, // Direct connection for migrations (not pgBouncer)
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: "postgres",
    ssl: true,
  },
  introspect: {
    casing: "camel",
  },
});
