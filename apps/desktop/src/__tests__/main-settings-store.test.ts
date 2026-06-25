import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

vi.mock("../main/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@vendor/observability/sentry-electron-main", () => ({
  captureException: vi.fn(),
}));

async function loadFresh() {
  vi.resetModules();
  const db = await import("../main/db");
  const settings = await import("../main/settings-store");
  db.initDb();
  return { db, settings };
}

async function loadFreshWithoutDb() {
  vi.resetModules();
  const db = await import("../main/db");
  const settings = await import("../main/settings-store");
  // intentionally do NOT call initDb(); getDb() will return null
  return { db, settings };
}

function settingsJsonPath(): string {
  return join(mockedUserData, "settings.json");
}

function migratedJsonPath(): string {
  return join(mockedUserData, "settings.json.migrated");
}

beforeEach(() => {
  mockedUserData = mkdtempSync(join(tmpdir(), "desktop-settings-"));
});

afterEach(() => {
  rmSync(mockedUserData, { recursive: true, force: true });
});

describe("settings-store", () => {
  it("returns DEFAULTS when no settings.json and the table is empty", async () => {
    const { db, settings } = await loadFresh();
    expect(settings.getSettings()).toEqual({
      themeSource: "system",
      launchAtLogin: false,
      showInMenuBar: true,
      checkForUpdatesAutomatically: true,
    });
    db.closeDb();
  });

  it("imports a valid legacy settings.json and renames it to .migrated", async () => {
    writeFileSync(
      settingsJsonPath(),
      JSON.stringify({
        themeSource: "dark",
        launchAtLogin: true,
        showInMenuBar: false,
        checkForUpdatesAutomatically: false,
      }),
      "utf8"
    );
    const { db, settings } = await loadFresh();
    const snapshot = settings.getSettings();
    expect(snapshot).toEqual({
      themeSource: "dark",
      launchAtLogin: true,
      showInMenuBar: false,
      checkForUpdatesAutomatically: false,
    });
    expect(existsSync(settingsJsonPath())).toBe(false);
    expect(existsSync(migratedJsonPath())).toBe(true);
    const conn = db.getDb();
    if (!conn) {
      throw new Error("expected db");
    }
    const rows = conn
      .prepare("SELECT key, value FROM settings ORDER BY key")
      .all() as Array<{ key: string; value: string }>;
    expect(rows.map((r) => r.key)).toEqual([
      "checkForUpdatesAutomatically",
      "launchAtLogin",
      "showInMenuBar",
      "themeSource",
    ]);
    expect(rows.map((r) => JSON.parse(r.value))).toEqual([
      false,
      true,
      false,
      "dark",
    ]);
    db.closeDb();
  });

  it("ignores a malformed legacy settings.json and leaves the file untouched", async () => {
    writeFileSync(settingsJsonPath(), "{ this is not json", "utf8");
    const { db, settings } = await loadFresh();
    expect(settings.getSettings()).toEqual({
      themeSource: "system",
      launchAtLogin: false,
      showInMenuBar: true,
      checkForUpdatesAutomatically: true,
    });
    expect(existsSync(settingsJsonPath())).toBe(true);
    expect(existsSync(migratedJsonPath())).toBe(false);
    db.closeDb();
  });

  it("ignores legacy settings.json failing zod validation; original file untouched", async () => {
    writeFileSync(
      settingsJsonPath(),
      JSON.stringify({ themeSource: "neon", launchAtLogin: "yes" }),
      "utf8"
    );
    const { db, settings } = await loadFresh();
    expect(settings.getSettings()).toEqual({
      themeSource: "system",
      launchAtLogin: false,
      showInMenuBar: true,
      checkForUpdatesAutomatically: true,
    });
    expect(existsSync(settingsJsonPath())).toBe(true);
    expect(existsSync(migratedJsonPath())).toBe(false);
    db.closeDb();
  });

  it("does not re-import when both settings.json and a populated table exist", async () => {
    {
      const { db, settings } = await loadFresh();
      settings.updateSetting("themeSource", "light");
      db.closeDb();
    }
    // Stage a *different* legacy file to prove it is ignored when the table
    // already has rows.
    writeFileSync(
      settingsJsonPath(),
      JSON.stringify({
        themeSource: "dark",
        launchAtLogin: true,
        showInMenuBar: false,
        checkForUpdatesAutomatically: false,
      }),
      "utf8"
    );
    const { db, settings } = await loadFresh();
    expect(settings.getSettings().themeSource).toBe("light");
    expect(existsSync(settingsJsonPath())).toBe(true);
    expect(existsSync(migratedJsonPath())).toBe(false);
    db.closeDb();
  });

  it("updateSetting persists across module reloads", async () => {
    {
      const { db, settings } = await loadFresh();
      settings.updateSetting("themeSource", "dark");
      expect(settings.getSettings().themeSource).toBe("dark");
      db.closeDb();
    }
    const { db, settings } = await loadFresh();
    expect(settings.getSettings().themeSource).toBe("dark");
    db.closeDb();
  });

  it("listeners fire on update with the new snapshot", async () => {
    const { db, settings } = await loadFresh();
    const seen: string[] = [];
    const off = settings.onSettingsChanged((s) => seen.push(s.themeSource));
    settings.updateSetting("themeSource", "light");
    settings.updateSetting("themeSource", "dark");
    off();
    settings.updateSetting("themeSource", "system");
    expect(seen).toEqual(["light", "dark"]);
    db.closeDb();
  });

  it("falls back to DEFAULTS and no-ops writes when db is unavailable", async () => {
    const { db, settings } = await loadFreshWithoutDb();
    expect(db.getDb()).toBeNull();
    expect(settings.getSettings()).toEqual({
      themeSource: "system",
      launchAtLogin: false,
      showInMenuBar: true,
      checkForUpdatesAutomatically: true,
    });
    // updateSetting must not throw even when there is no db connection.
    expect(() => settings.updateSetting("themeSource", "dark")).not.toThrow();
  });

  it("rejects updates that fail zod validation", async () => {
    const { db, settings } = await loadFresh();
    const before = settings.getSettings();
    const after = settings.updateSetting("themeSource", "neon" as never);
    expect(after).toEqual(before);
    db.closeDb();
  });

  it("malformed db row is skipped; remaining keys still hydrate", async () => {
    {
      const { db, settings } = await loadFresh();
      settings.updateSetting("themeSource", "dark");
      const conn = db.getDb();
      if (!conn) {
        throw new Error("expected db");
      }
      // Corrupt the launchAtLogin row's JSON. read() should skip it and the
      // default (false) should fill the gap; themeSource=dark should survive.
      conn
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .run("launchAtLogin", "not-json");
      db.closeDb();
    }
    const { db, settings } = await loadFresh();
    const snapshot = settings.getSettings();
    expect(snapshot.themeSource).toBe("dark");
    expect(snapshot.launchAtLogin).toBe(false);
    db.closeDb();
  });

  it("imported settings persist into a fresh module load (durable, not just cached)", async () => {
    writeFileSync(
      settingsJsonPath(),
      JSON.stringify({
        themeSource: "dark",
        launchAtLogin: true,
        showInMenuBar: false,
        checkForUpdatesAutomatically: false,
      }),
      "utf8"
    );
    {
      const { db, settings } = await loadFresh();
      settings.getSettings();
      db.closeDb();
    }
    // Sanity: file was renamed, db is durable.
    expect(readFileSync(migratedJsonPath(), "utf8")).toContain("dark");
    const { db, settings } = await loadFresh();
    expect(settings.getSettings()).toEqual({
      themeSource: "dark",
      launchAtLogin: true,
      showInMenuBar: false,
      checkForUpdatesAutomatically: false,
    });
    db.closeDb();
  });
});
