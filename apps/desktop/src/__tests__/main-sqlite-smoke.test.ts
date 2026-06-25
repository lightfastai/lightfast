import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("better-sqlite3 binding", () => {
  it("opens an in-memory database and round-trips a row", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE t (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    db.prepare("INSERT INTO t (k, v) VALUES (?, ?)").run("hello", "world");
    const row = db.prepare("SELECT v FROM t WHERE k = ?").get("hello") as
      | { v: string }
      | undefined;
    expect(row?.v).toBe("world");
    db.close();
  });
});
