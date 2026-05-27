import { createDrizzleConfig } from "@vendor/db";
import { env } from "./env";

export default createDrizzleConfig({
  database: "lightfast",
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  tablesFilter: ["lightfast_*"],
  username: env.DATABASE_USERNAME,
});
