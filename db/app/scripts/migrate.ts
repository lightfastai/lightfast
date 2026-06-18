import { createDatabase } from "@vendor/db";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";

import { env } from "../src/env";

const db = createDatabase({
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  username: env.DATABASE_USERNAME,
});

console.log(`Applying migrations against ${env.DATABASE_HOST} ...`);

try {
  await migrate(db, { migrationsFolder: "./src/migrations" });
  console.log("Drizzle migrations applied.");
} catch (error) {
  console.error(
    "Migration failed:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
