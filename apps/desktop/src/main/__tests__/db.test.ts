import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockedUserData = "";

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") {
        return mockedUserData;
      }
      throw new Error(`unexpected getPath(${name})`);
    },
  },
}));

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

async function loadDbFresh() {
  vi.resetModules();
  return import("../db");
}

async function loadSchemaFresh() {
  vi.resetModules();
  return import("../db/schema");
}

beforeEach(() => {
  mockedUserData = mkdtempSync(join(tmpdir(), "desktop-db-"));
});

afterEach(() => {
  rmSync(mockedUserData, { recursive: true, force: true });
});

describe("db", () => {
  it("initDb() creates app.db_v1 in userData", async () => {
    const { initDb, closeDb } = await loadDbFresh();
    initDb();
    expect(existsSync(join(mockedUserData, "app.db_v1"))).toBe(true);
    closeDb();
  });

  it("getDb() returns null before init, connection after", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    expect(getDb()).toBeNull();
    initDb();
    expect(getDb()).not.toBeNull();
    closeDb();
  });

  it("initDb() is idempotent", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    initDb();
    const first = getDb();
    initDb();
    expect(getDb()).toBe(first);
    closeDb();
  });

  it("settings table exists after init", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    initDb();
    const db = getDb();
    if (!db) {
      throw new Error("expected db");
    }
    const rows = db.pragma("table_info(settings)") as Array<{ name: string }>;
    const names = rows.map((r) => r.name);
    expect(names).toEqual(["key", "value"]);
    closeDb();
  });

  it("WAL journal mode is applied", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    initDb();
    const db = getDb();
    if (!db) {
      throw new Error("expected db");
    }
    const result = db.pragma("journal_mode", { simple: true });
    expect(result).toBe("wal");
    closeDb();
  });

  it("foreign_keys pragma is on", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    initDb();
    const db = getDb();
    if (!db) {
      throw new Error("expected db");
    }
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    closeDb();
  });

  it("user_version equals migrations.length after init", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    const { migrations } = await import("../db/schema");
    initDb();
    const db = getDb();
    if (!db) {
      throw new Error("expected db");
    }
    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
    closeDb();
  });

  it("re-opening a migrated DB is a no-op (version unchanged)", async () => {
    {
      const { initDb, closeDb } = await loadDbFresh();
      initDb();
      closeDb();
    }
    // Re-open the same userData. user_version should match migrations.length
    // and applyMigrations should perform no work (no new entries to apply).
    const { initDb, getDb, closeDb } = await loadDbFresh();
    const { migrations } = await import("../db/schema");
    initDb();
    const db = getDb();
    if (!db) {
      throw new Error("expected db");
    }
    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
    closeDb();
  });

  it("closeDb() resets the connection", async () => {
    const { initDb, getDb, closeDb } = await loadDbFresh();
    initDb();
    expect(getDb()).not.toBeNull();
    closeDb();
    expect(getDb()).toBeNull();
  });
});

describe("applyMigrations", () => {
  it("applies pending migrations and bumps user_version", async () => {
    const { applyMigrations } = await loadSchemaFresh();
    const db = new Database(":memory:");
    const registry = [
      "CREATE TABLE a (k TEXT PRIMARY KEY) STRICT;",
      "CREATE TABLE b (k TEXT PRIMARY KEY) STRICT;",
    ];
    applyMigrations(db, registry);
    expect(db.pragma("user_version", { simple: true })).toBe(2);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toEqual(["a", "b"]);
    db.close();
  });

  it("rolls back schema and user_version when a migration throws", async () => {
    const { applyMigrations } = await loadSchemaFresh();
    const db = new Database(":memory:");
    const registry = [
      "CREATE TABLE a (k TEXT PRIMARY KEY) STRICT;",
      "this is not valid SQL;",
    ];
    expect(() => applyMigrations(db, registry)).toThrow();
    // v1 must have applied (its transaction committed); v2 must not have.
    expect(db.pragma("user_version", { simple: true })).toBe(1);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name).sort()).toEqual(["a"]);
    db.close();
  });

  it("v1->v2 ALTER preserves existing rows", async () => {
    const { applyMigrations } = await loadSchemaFresh();
    const db = new Database(":memory:");
    applyMigrations(db, ["CREATE TABLE t (k TEXT PRIMARY KEY) STRICT;"]);
    db.prepare("INSERT INTO t (k) VALUES (?)").run("preserved");
    applyMigrations(db, [
      "CREATE TABLE t (k TEXT PRIMARY KEY) STRICT;",
      "ALTER TABLE t ADD COLUMN extra TEXT;",
    ]);
    expect(db.pragma("user_version", { simple: true })).toBe(2);
    const row = db
      .prepare("SELECT k, extra FROM t WHERE k = ?")
      .get("preserved") as { k: string; extra: string | null } | undefined;
    expect(row?.k).toBe("preserved");
    expect(row?.extra).toBeNull();
    db.close();
  });
});
