import { createDatabase } from "@vendor/db";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";
import { env } from "./env";

const db = createDatabase({
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  username: env.DATABASE_USERNAME,
});

await migrate(db, { migrationsFolder: "./src/migrations" });

console.log("Drizzle migrations applied.");
