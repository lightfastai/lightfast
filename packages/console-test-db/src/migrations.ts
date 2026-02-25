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
  return join(srcDir, "migrations");
}
