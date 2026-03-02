import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@db/console/schema";
import { getMigrationsPath } from "./migrations";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let instance: { client: PGlite; db: TestDb } | null = null;

/**
 * Creates an in-memory PGlite database with all Drizzle migrations applied.
 * Singleton per vitest worker — subsequent calls return the same instance.
 */
export async function createTestDb(): Promise<TestDb> {
  if (instance) return instance.db;

  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: getMigrationsPath() });

  instance = { client, db };
  return db;
}

/**
 * Truncates all public tables with CASCADE.
 * Uses dynamic discovery via pg_tables — no hardcoded table list needed.
 */
export async function resetTestDb(): Promise<void> {
  if (!instance) throw new Error("createTestDb() must be called first");

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
  if (!instance) return;
  await instance.client.close();
  instance = null;
}
