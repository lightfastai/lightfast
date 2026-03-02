import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolves the absolute path to `db/console/src/migrations/` via the
 * `@db/console/migrations` package export (points to meta/_journal.json).
 */
export function getMigrationsPath(): string {
  const journalPath = require.resolve("@db/console/migrations");
  // journalPath → .../src/migrations/meta/_journal.json
  // dirname twice: meta/_journal.json → meta/ → migrations/
  return dirname(dirname(journalPath));
}
