import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration SQL", () => {
  it("does not emit invalid timestamp precision on-update clauses", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const offenders = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), "utf8");
        const invalid = sql.match(
          /timestamp\(3\)[^;]*ON UPDATE CURRENT_TIMESTAMP(?!\()/gi
        );

        return invalid ? [file] : [];
      });

    expect(offenders).toEqual([]);
  });

  it("does not emit primary key rebuild statements", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const offenders = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), "utf8");
        const invalid = sql.match(/\b(?:DROP|ADD)\s+PRIMARY\s+KEY\b/gi);

        return invalid ? [file] : [];
      });

    expect(offenders).toEqual([]);
  });

  it("keeps the SQL files and journal entries in one-to-one alignment", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    const sqlFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const journalSqlFiles = journal.entries
      .map((entry) => `${entry.tag}.sql`)
      .sort();
    const journalIndexes = journal.entries.map((entry) => entry.idx);

    expect(sqlFiles).toEqual(journalSqlFiles);
    expect(journalIndexes).toEqual(journal.entries.map((_, index) => index));
  });

  it("does not create the same table twice in journaled migrations", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const firstCreateByTable = new Map<string, string>();
    const duplicateCreates: string[] = [];

    for (const entry of journal.entries) {
      const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), "utf8");
      for (const match of sql.matchAll(/CREATE TABLE `([^`]+)`/g)) {
        const tableName = match[1]!;
        const firstCreate = firstCreateByTable.get(tableName);
        if (firstCreate) {
          duplicateCreates.push(`${tableName}: ${firstCreate}, ${entry.tag}`);
        } else {
          firstCreateByTable.set(tableName, entry.tag);
        }
      }
    }

    expect(duplicateCreates).toEqual([]);
  });

  it("does not emit database-side timestamp on-update clauses", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const offenders = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), "utf8");
        const invalid = sql.match(
          /\bON UPDATE\s+CURRENT_TIMESTAMP(?:\(\d+\))?/gi
        );

        return invalid ? [file] : [];
      });

    expect(offenders).toEqual([]);
  });

  it("does not use DDL on-update timestamp helpers in schema files", () => {
    const tablesDir = join(process.cwd(), "src/schema/tables");
    const offenders = readdirSync(tablesDir)
      .filter((file) => file.endsWith(".ts"))
      .flatMap((file) => {
        const source = readFileSync(join(tablesDir, file), "utf8");

        return /^\s*\.onUpdateNow\(\)/m.test(source) ? [file] : [];
      });

    expect(offenders).toEqual([]);
  });
});
