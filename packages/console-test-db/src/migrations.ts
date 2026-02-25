import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolves the absolute path to `db/console/src/migrations/` using
 * the `@db/console/schema` export as an anchor. Works with pnpm symlinks
 * and Vitest's SSR transform (where import.meta.resolve is unavailable).
 */
export function getMigrationsPath(): string {
  const schemaPath = require.resolve("@db/console/schema");
  // schemaPath resolves to db/console/src/schema/index.ts
  // dirname twice: schema/index.ts → schema/ → src/
  const srcDir = dirname(dirname(schemaPath));
  const migrationsDir = join(srcDir, "migrations");

  if (!existsSync(migrationsDir)) {
    throw new Error(
      `Migrations directory not found at ${migrationsDir}. ` +
        `@db/console/schema resolved to ${schemaPath} — ` +
        `verify the export map in @db/console/package.json still points into src/.`,
    );
  }

  return migrationsDir;
}
