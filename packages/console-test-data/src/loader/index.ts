/**
 * Webhook Dataset Loader
 *
 * Loads raw webhook datasets and transforms them to SourceEvents
 * using production transformers.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { SourceEvent } from "@repo/console-types";
import type { WebhookPayload } from "./transform.js";
import { transformWebhook } from "./transform.js";

export interface Dataset {
  name: string;
  description?: string;
  events: SourceEvent[];
}

interface RawDataset {
  name: string;
  description?: string;
  webhooks: WebhookPayload[];
}

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "..", "datasets");
};

/**
 * Load a dataset by name or file path
 * Transforms raw webhooks to SourceEvents using production transformers
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

  if (!raw.name) throw new Error(`Dataset missing: name`);
  if (!Array.isArray(raw.webhooks) || raw.webhooks.length === 0) {
    throw new Error(`Dataset must have at least one webhook`);
  }

  // Transform webhooks to SourceEvents using production transformers
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
  if (!existsSync(datasetsDir)) return [];

  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json") && !f.includes("schema"))
    .map((f) => f.replace(".json", ""));
};

/**
 * Load all datasets and return combined events
 */
export const loadAllDatasets = (): SourceEvent[] => {
  const names = listDatasets();
  const events: SourceEvent[] = [];
  for (const name of names) {
    events.push(...loadDataset(name).events);
  }
  return events;
};

/**
 * Generate balanced scenario: shuffle all events, slice to count
 */
export const balancedScenario = (count: number): SourceEvent[] => {
  const all = loadAllDatasets();
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Generate stress scenario: repeat events to reach count
 */
export const stressScenario = (count: number): SourceEvent[] => {
  const base = loadAllDatasets();
  const events: SourceEvent[] = [];
  let stressIndex = 0;

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:stress:${stressIndex++}`,
      });
    }
  }

  return events;
};

// Re-export transform types
export type {
  WebhookPayload,
  SentryWebhookPayload,
  LinearWebhookPayload,
} from "./transform.js";

// Re-export canonical event types from console-webhooks
export type { GitHubWebhookEventType, SentryWebhookEventType, LinearWebhookEventType } from "@repo/console-webhooks/transformers";
export type { VercelWebhookEventType } from "@repo/console-webhooks";
