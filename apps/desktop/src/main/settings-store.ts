import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { z } from "zod";

export const themeSourceSchema = z.enum(["system", "light", "dark"]);
export type ThemeSource = z.infer<typeof themeSourceSchema>;

export const settingsSchema = z.object({
  themeSource: themeSourceSchema,
  launchAtLogin: z.boolean(),
  showInMenuBar: z.boolean(),
  checkForUpdatesAutomatically: z.boolean(),
});

export type SettingsSnapshot = z.infer<typeof settingsSchema>;

const DEFAULTS: SettingsSnapshot = {
  themeSource: "system",
  launchAtLogin: false,
  showInMenuBar: true,
  checkForUpdatesAutomatically: true,
};

type Listener = (snapshot: SettingsSnapshot) => void;

let cached: SettingsSnapshot | null = null;
const listeners = new Set<Listener>();

function storePath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function read(): SettingsSnapshot {
  try {
    const raw = readFileSync(storePath(), "utf8");
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // file missing or malformed — fall back to defaults
  }
  return DEFAULTS;
}

function write(snapshot: SettingsSnapshot): void {
  try {
    writeFileSync(storePath(), JSON.stringify(snapshot, null, 2), "utf8");
  } catch (error) {
    console.error("[settings] failed to write", error);
  }
}

export function getSettings(): SettingsSnapshot {
  if (!cached) {
    cached = read();
  }
  return cached;
}

export function updateSetting<K extends keyof SettingsSnapshot>(
  key: K,
  value: SettingsSnapshot[K]
): SettingsSnapshot {
  const next = { ...getSettings(), [key]: value };
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) {
    return getSettings();
  }
  cached = parsed.data;
  write(parsed.data);
  for (const listener of listeners) {
    listener(parsed.data);
  }
  return parsed.data;
}

export function onSettingsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
