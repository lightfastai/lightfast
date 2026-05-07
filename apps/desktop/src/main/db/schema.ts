import type Database from "better-sqlite3";

// Each entry's index + 1 is the target user_version it advances to.
// To add migration N: append the SQL at index N-1. Never reorder or edit
// shipped entries — that would silently desync deployed databases.
export const migrations: string[] = [
  // v1: initial settings table.
  // STRICT TEXT PK is nullable by default; explicit NOT NULL required
  // (STRICT only auto-NOT-NULLs INTEGER PKs).
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   ) STRICT;`,
];

export function applySchema(db: Database.Database): void {
  applyMigrations(db, migrations);
}

export function applyMigrations(
  db: Database.Database,
  registry: string[] = migrations
): void {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  for (let target = current + 1; target <= registry.length; target++) {
    const sql = registry[target - 1];
    if (sql === undefined) {
      continue;
    }
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${target}`);
    })();
  }
}
