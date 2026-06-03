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
});
