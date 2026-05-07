import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { captureException } from "@vendor/observability/sentry-electron-main";
import { app } from "electron";
import { z } from "zod";
import { getDb } from "./db";
import { logger } from "./logger";

export const themeSourceSchema = z.enum(["system", "light", "dark"]);
export type ThemeSource = z.infer<typeof themeSourceSchema>;

export const settingsSchema = z.object({
  themeSource: themeSourceSchema,
  launchAtLogin: z.boolean(),
  showInMenuBar: z.boolean(),
  checkForUpdatesAutomatically: z.boolean(),
});

export type SettingsSnapshot = z.infer<typeof settingsSchema>;
type SettingsKey = keyof SettingsSnapshot;

const DEFAULTS: SettingsSnapshot = {
  themeSource: "system",
  launchAtLogin: false,
  showInMenuBar: true,
  checkForUpdatesAutomatically: true,
};

type Listener = (snapshot: SettingsSnapshot) => void;

let cached: SettingsSnapshot | null = null;
let migrated = false;
const listeners = new Set<Listener>();

function legacyJsonPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function migrateFromJsonIfPresent(): void {
  if (migrated) {
    return;
  }
  // run-once even on failure — a malformed or unreadable file should not
  // re-trigger every getSettings() call for the rest of the session.
  migrated = true;
  const db = getDb();
  if (!db) {
    return;
  }
  const path = legacyJsonPath();
  if (!existsSync(path)) {
    return;
  }
  const countRow = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
    n: number;
  };
  if (countRow.n > 0) {
    return;
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logger.warn(
        "[settings] legacy JSON failed validation; ignoring",
        parsed.error
      );
      return;
    }
    const insert = db.prepare(
      // OR IGNORE: COUNT(*) > 0 guard above already prevents collision in the
      // happy path; this is defensive against a partial-import retry on a
      // future schema where the table starts populated for some keys.
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );
    db.transaction((snapshot: SettingsSnapshot) => {
      for (const [key, value] of Object.entries(snapshot)) {
        insert.run(key, JSON.stringify(value));
      }
    })(parsed.data);
    renameSync(path, `${path}.migrated`);
    logger.info("[settings] imported legacy settings.json");
  } catch (err) {
    logger.error("[settings] migration failed", err);
    captureException(err, { tags: { scope: "settings.migrate" } });
  }
}

function readFromDb(): SettingsSnapshot {
  const db = getDb();
  if (!db) {
    return DEFAULTS;
  }
  migrateFromJsonIfPresent();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const partial: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      partial[row.key] = JSON.parse(row.value);
    } catch {
      // skip malformed row; defaults will fill the gap
    }
  }
  const merged = { ...DEFAULTS, ...partial };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULTS;
}

function writeKey<K extends SettingsKey>(
  key: K,
  value: SettingsSnapshot[K]
): void {
  const db = getDb();
  if (!db) {
    logger.warn("[settings] no db; setting not persisted", { key });
    return;
  }
  try {
    // INSERT OR REPLACE: equivalent to ON CONFLICT(key) DO UPDATE here.
    // Settings has no FKs and no AUTOINCREMENT, so the simpler form is fine.
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
    ).run(key, JSON.stringify(value));
  } catch (err) {
    logger.error("[settings] write failed", err);
    captureException(err, { tags: { scope: "settings.write" } });
  }
}

export function getSettings(): SettingsSnapshot {
  if (!cached) {
    cached = readFromDb();
  }
  return cached;
}

export function updateSetting<K extends SettingsKey>(
  key: K,
  value: SettingsSnapshot[K]
): SettingsSnapshot {
  const next = { ...getSettings(), [key]: value };
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) {
    return getSettings();
  }
  cached = parsed.data;
  writeKey(key, value);
  for (const listener of listeners) {
    listener(parsed.data);
  }
  return parsed.data;
}

export function onSettingsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
