/**
 * JSON Dataset Loader
 *
 * Loads JSON datasets, resolves relative timestamps, generates unique sourceIds.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { SourceEvent } from "@repo/console-types";

export interface Dataset {
  name: string;
  description?: string;
  events: SourceEvent[];
}

interface RawDataset {
  name: string;
  description?: string;
  events: RawSourceEvent[];
}

interface RawSourceEvent extends Omit<SourceEvent, "occurredAt"> {
  occurredAt: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const RELATIVE_TIMESTAMP_PATTERN = /^-(\d+)([dhwm])$/;

/**
 * Resolve relative timestamp expressions to ISO strings
 * Supports: "-2d" (2 days ago), "-1w" (1 week ago), "-3h" (3 hours ago)
 */
const resolveTimestamp = (value: string): string => {
  if (ISO_DATE_PATTERN.exec(value)) {
    return value;
  }

  const match = RELATIVE_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid timestamp: ${value}. Use ISO or relative like "-2d"`);
  }

  const amount = match[1];
  const unit = match[2];
  if (!amount || !unit) {
    throw new Error(`Invalid timestamp: ${value}. Use ISO or relative like "-2d"`);
  }

  const now = new Date();

  switch (unit) {
    case "h":
      now.setHours(now.getHours() - parseInt(amount, 10));
      break;
    case "d":
      now.setDate(now.getDate() - parseInt(amount, 10));
      break;
    case "w":
      now.setDate(now.getDate() - parseInt(amount, 10) * 7);
      break;
    case "m":
      now.setMonth(now.getMonth() - parseInt(amount, 10));
      break;
  }

  return now.toISOString();
};

const generateSuffix = (): string => Math.random().toString(36).substring(2, 8);

const processEvents = (events: RawSourceEvent[]): SourceEvent[] => {
  const suffix = generateSuffix();
  return events.map((event, index) => ({
    ...event,
    sourceId: `${event.sourceId}:${suffix}:${index}`,
    occurredAt: resolveTimestamp(event.occurredAt),
  }));
};

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "..", "datasets");
};

/**
 * Load a dataset by name or file path
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
  if (!Array.isArray(raw.events) || raw.events.length === 0) {
    throw new Error(`Dataset must have at least one event`);
  }

  return {
    name: raw.name,
    description: raw.description,
    events: processEvents(raw.events),
  };
};

/**
 * List available dataset names
 */
export const listDatasets = (): string[] => {
  const datasetsDir = getDatasetsDir();
  if (!existsSync(datasetsDir)) return [];

  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json") && f !== "schema.json")
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

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:stress:${events.length}`,
        occurredAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return events;
};
