/**
 * Webhook Dataset Loader
 *
 * Loads raw webhook datasets and transforms them to PostTransformEvents
 * using production transformers.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PostTransformEvent } from "@repo/console-providers/contracts";
import type { WebhookPayload } from "./transform";
import { transformWebhook } from "./transform";

export interface Dataset {
  description?: string;
  events: PostTransformEvent[];
  name: string;
}

interface RawDataset {
  description?: string;
  name: string;
  webhooks: WebhookPayload[];
}

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "..", "datasets");
};

/**
 * Load a dataset by name or file path
 * Transforms raw webhooks to PostTransformEvents using production transformers
 */
export const loadDataset = (nameOrPath: string): Dataset => {
  const datasetsDir = getDatasetsDir();

  const filePath = nameOrPath.endsWith(".json")
    ? resolve(nameOrPath)
    : join(datasetsDir, `${nameOrPath}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as RawDataset;

  if (!raw.name) {
    throw new Error("Dataset missing: name");
  }
  if (!Array.isArray(raw.webhooks) || raw.webhooks.length === 0) {
    throw new Error("Dataset must have at least one webhook");
  }

  // Transform webhooks to PostTransformEvents using production transformers
  const events = raw.webhooks.map((webhook, index) =>
    transformWebhook(webhook, index)
  );

  return {
    name: raw.name,
    description: raw.description,
    events,
  };
};

/**
 * List available dataset names
 */
export const listDatasets = (): string[] => {
  const datasetsDir = getDatasetsDir();
  if (!existsSync(datasetsDir)) {
    return [];
  }

  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json") && !f.includes("schema"))
    .map((f) => f.replace(".json", ""));
};

/**
 * Load all datasets and return combined events
 */
export const loadAllDatasets = (): PostTransformEvent[] => {
  const names = listDatasets();
  const events: PostTransformEvent[] = [];
  for (const name of names) {
    events.push(...loadDataset(name).events);
  }
  return events;
};

/**
 * Generate balanced scenario: shuffle all events, slice to count
 */
export const balancedScenario = (count: number): PostTransformEvent[] => {
  const all = loadAllDatasets();
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Generate stress scenario: repeat events to reach count
 */
export const stressScenario = (count: number): PostTransformEvent[] => {
  const base = loadAllDatasets();
  const events: PostTransformEvent[] = [];
  let stressIndex = 0;

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) {
        break;
      }
      events.push({
        ...event,
        sourceId: `${event.sourceId}:stress:${stressIndex++}`,
      });
    }
  }

  return events;
};

// Re-export transform types
export type { WebhookPayload } from "./transform";
