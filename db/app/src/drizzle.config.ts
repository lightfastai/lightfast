import { createDrizzleConfig } from "@vendor/db";

export default createDrizzleConfig({
  database: "lightfast",
  host: process.env.DATABASE_HOST,
  out: "./src/migrations",
  password: process.env.DATABASE_PASSWORD,
  schema: "./src/schema/index.ts",
  tablesFilter: ["lightfast_*"],
  username: process.env.DATABASE_USERNAME,
});
