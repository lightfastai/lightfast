/**
 * Raw webhook dataset loader.
 *
 * Returns untransformed webhook payloads directly from JSON datasets.
 * No dependencies on console-webhooks or console-types — suitable for
 * lightweight consumers like gateway unit tests.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

export interface RawWebhook {
  source: "github" | "vercel" | "linear" | "sentry";
  eventType: string;
  payload: Record<string, unknown>;
}

interface RawDataset {
  name: string;
  description?: string;
  webhooks: RawWebhook[];
}

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "datasets");
};

/** Load raw webhooks from a single dataset by name */
export const loadRawDataset = (name: string): { name: string; webhooks: RawWebhook[] } => {
  const filePath = join(getDatasetsDir(), `${name}.json`);
  if (!existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as RawDataset;
  return { name: raw.name, webhooks: raw.webhooks };
};

/** Load raw webhooks from all sandbox datasets */
export const loadAllRawWebhooks = (): RawWebhook[] => {
  const datasetsDir = getDatasetsDir();
  if (!existsSync(datasetsDir)) return [];

  return readdirSync(datasetsDir)
    .filter((f) => f.startsWith("sandbox-") && f.endsWith(".json"))
    .flatMap((f) => {
      const raw = JSON.parse(readFileSync(join(datasetsDir, f), "utf-8")) as RawDataset;
      return raw.webhooks;
    });
};
