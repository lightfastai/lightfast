import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../env.js";

const CONFIG_DIR = join(homedir(), ".lightfast");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const getBaseUrl = () => env.LIGHTFAST_API_URL;

export interface LightfastConfig {
  orgId: string;
  orgSlug: string;
  orgName: string;
  apiKey: string;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getConfig(): LightfastConfig | null {
  // Env var override for CI/CD
  const envKey = env.LIGHTFAST_API_KEY;
  if (envKey) {
    return { orgId: "", orgSlug: "", orgName: "env", apiKey: envKey };
  }

  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as LightfastConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: LightfastConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
}
