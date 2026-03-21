import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolves the absolute path to `db/app/src/migrations/` via the
 * `@db/app/migrations` package export (points to meta/_journal.json).
 */
export function getMigrationsPath(): string {
  const journalPath = require.resolve("@db/app/migrations");
  // journalPath → .../src/migrations/meta/_journal.json
  // dirname twice: meta/_journal.json → meta/ → migrations/
  return dirname(dirname(journalPath));
}
