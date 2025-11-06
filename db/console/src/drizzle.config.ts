import { defineConfig } from "drizzle-kit";
import { env } from "../env";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: env.DATABASE_HOST,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: "lightfast-app",
    ssl: true,
  },
  introspect: {
    casing: "camel",
  },
});
