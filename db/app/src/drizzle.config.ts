import { createDrizzleConfig } from "@vendor/db";
import { env } from "./env";

export default createDrizzleConfig({
  database: env.DATABASE_NAME,
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  port: env.DATABASE_PORT,
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  username: env.DATABASE_USERNAME,
});
