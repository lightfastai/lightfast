import * as schema from "@db/console/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getMigrationsPath } from "./migrations";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let instance: { client: PGlite; db: TestDb } | null = null;

/**
 * Applies Drizzle migrations using PGlite's `exec()` instead of prepared
 * statements. PGlite cannot execute multiple SQL commands in a single
 * prepared statement, but some Drizzle-generated migration files contain
 * multi-statement segments (missing `--> statement-breakpoint` separators).
 * Using `exec()` handles this transparently.
 */
async function migrateWithExec(client: PGlite, migrationsFolder: string) {
  const migrations = readMigrationFiles({ migrationsFolder });

  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS "drizzle";
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  const dbMigrations = await client.query<{
    id: number;
    hash: string;
    created_at: string;
  }>(
    "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1"
  );
  const lastDbMigration = dbMigrations.rows[0];

  for (const migration of migrations) {
    if (
      !lastDbMigration ||
      Number(lastDbMigration.created_at) < migration.folderMillis
    ) {
      for (const stmt of migration.sql) {
        const trimmed = stmt.trim();
        if (trimmed) {
          await client.exec(trimmed);
        }
      }
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [migration.hash, migration.folderMillis]
      );
    }
  }
}

/**
 * Creates an in-memory PGlite database with all Drizzle migrations applied.
 * Singleton per vitest worker — subsequent calls return the same instance.
 */
export async function createTestDb(): Promise<TestDb> {
  if (instance) {
    return instance.db;
  }

  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrateWithExec(client, getMigrationsPath());

  instance = { client, db };
  return db;
}

/**
 * Truncates all public tables with CASCADE.
 * Uses dynamic discovery via pg_tables — no hardcoded table list needed.
 */
export async function resetTestDb(): Promise<void> {
  if (!instance) {
    throw new Error("createTestDb() must be called first");
  }

  await instance.client.exec(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

/**
 * Closes the PGlite instance and resets the singleton.
 */
export async function closeTestDb(): Promise<void> {
  if (!instance) {
    return;
  }
  await instance.client.close();
  instance = null;
}
