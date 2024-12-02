import { join } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// Get the directory path of the current module
const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * To run migrations, use the following:
 * @usage void runMigrate(env.POSTGRES_URL);
 */
export const runMigrate = async (uri: string) => {
  try {
    console.log("⏳ Running migrations...");

    const sql = neon(uri);
    const db = drizzle(sql);

    // Resolve migrations path relative to this file
    const migrationsFolder = join(__dirname, "migrations");

    const start = Date.now();
    await migrate(db, { migrationsFolder });
    const end = Date.now();

    console.log("✅ Migrations completed in", end - start, "ms");
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Migration failed:", error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.error("❌ Migration failed with unknown error:", error);
    }
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection during migration:");
  console.error(error);
  process.exit(1);
});
