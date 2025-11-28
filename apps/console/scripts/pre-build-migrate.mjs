#!/usr/bin/env node

/**
 * Pre-Build Migration Script
 * Runs database migrations before building the console app
 * Ensures schema is up-to-date before code deployment
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");

console.log("🗃️  Pre-Build Migration Script");
console.log("================================");

// Check if we're in production build (need database credentials)
const DATABASE_HOST = process.env.DATABASE_HOST;
const DATABASE_USERNAME = process.env.DATABASE_USERNAME;
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;

if (!DATABASE_HOST || !DATABASE_USERNAME || !DATABASE_PASSWORD) {
  console.log("⚠️  Database credentials not set");
  console.log("Skipping migrations (likely local development)");
  process.exit(0);
}

// Check if this is a Vercel production deployment
const VERCEL_ENV = process.env.VERCEL_ENV;

if (VERCEL_ENV !== "production") {
  console.log(`📝 Environment: ${VERCEL_ENV || "unknown"} (not production)`);
  console.log("Skipping migrations for non-production deployment");
  process.exit(0);
}

console.log("🌍 Environment: Production");
console.log("📍 Running migrations for console database...");
console.log("");

// Navigate to db/console directory
const dbConsolePath = join(__dirname, "..", "..", "db", "console");

if (!existsSync(dbConsolePath)) {
  console.log("❌ Failed to find db/console directory");
  console.log(`Expected path: ${dbConsolePath}`);
  process.exit(1);
}

// Check if migrations directory exists
const migrationsPath = join(dbConsolePath, "src", "migrations");

if (!existsSync(migrationsPath)) {
  console.log("✅ No migrations directory found - skipping");
  process.exit(0);
}

// Check if there are any migration files
let migrationFiles = [];
try {
  const files = readdirSync(migrationsPath);
  migrationFiles = files.filter((file) => file.endsWith(".sql"));
} catch (error) {
  console.log("✅ No migration files found - skipping");
  process.exit(0);
}

if (migrationFiles.length === 0) {
  console.log("✅ No migration files found - skipping");
  process.exit(0);
}

console.log(`📋 Found ${migrationFiles.length} migration file(s)`);
console.log("");

// Run migrations with error handling
console.log("🚀 Applying migrations...");

try {
  // Run drizzle-kit migrate directly (not through pnpm with-env)
  // Vercel provides env vars directly, no need for dotenv-cli
  execSync("npx drizzle-kit migrate --config=./src/drizzle.config.ts", {
    cwd: dbConsolePath,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_HOST,
      DATABASE_USERNAME,
      DATABASE_PASSWORD,
    },
  });

  console.log("");
  console.log("✅ Migrations applied successfully!");
} catch (error) {
  console.log("");
  console.log("❌ Migration failed!");
  console.log("");
  console.log("This usually means:");
  console.log("  1. Database connection issue");
  console.log("  2. Migration syntax error");
  console.log("  3. Schema conflict");
  console.log("");
  console.log("Check the error above for details.");
  process.exit(1);
}

console.log("");
console.log("================================");
console.log("✅ Pre-build migration complete");
console.log("");
