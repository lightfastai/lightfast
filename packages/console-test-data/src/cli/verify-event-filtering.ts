#!/usr/bin/env npx tsx
/**
 * Event Filtering Verification
 *
 * Verifies that all event types used in sandbox datasets match the
 * sync.events configuration in seed-integrations.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import type { ProviderName } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";

// Configuration from seed-integrations.ts
// All sources use category-level keys with normalization in getBaseEventType()
const ALLOWED_EVENTS = Object.fromEntries(
  (Object.keys(PROVIDERS) as ProviderName[]).map((key) => [
    key,
    Object.keys(PROVIDERS[key].categories),
  ])
) as Record<ProviderName, string[]>;

interface WebhookPayload {
  eventType: string;
  payload: unknown;
  source: string;
}

interface Dataset {
  name: string;
  webhooks: WebhookPayload[];
}

/**
 * Normalize webhook event type to category level (mirrors getBaseEventType logic)
 */
function normalizeEventType(source: string, eventType: string): string {
  if (source === "github") {
    const dotIndex = eventType.indexOf(".");
    if (dotIndex > 0) {
      const base = eventType.substring(0, dotIndex);
      const configBase = base.replace(/-/g, "_");
      return configBase === "issue" ? "issues" : configBase;
    }
    return eventType;
  }

  if (source === "vercel") {
    return eventType; // Already category level
  }

  if (source === "sentry") {
    if (eventType.startsWith("issue.")) {
      return "issue";
    }
    return eventType; // error, event_alert, metric_alert
  }

  if (source === "linear") {
    const colonIndex = eventType.indexOf(":");
    if (colonIndex > 0) {
      return eventType.substring(0, colonIndex);
    }
    return eventType;
  }

  return eventType;
}

function verifyEventFiltering() {
  console.log("\nVerifying event filtering compatibility...\n");

  const datasetsDir = join(__dirname, "../../datasets");
  const files = readdirSync(datasetsDir).filter(
    (f) => f.startsWith("sandbox-") && f.endsWith(".json")
  );

  let totalEvents = 0;
  let allowedEvents = 0;
  let filteredEvents = 0;
  const issues: string[] = [];

  for (const file of files) {
    const content = readFileSync(join(datasetsDir, file), "utf-8");
    const dataset = JSON.parse(content) as Dataset;

    console.log(`Checking ${dataset.name}...`);

    for (const webhook of dataset.webhooks) {
      totalEvents++;
      const source = webhook.source;
      const eventType = webhook.eventType;
      const normalizedEventType = normalizeEventType(source, eventType);

      if (!(source in ALLOWED_EVENTS)) {
        issues.push(
          `  ❌ ${dataset.name}: Unknown source "${source}" for event "${eventType}"`
        );
        filteredEvents++;
        continue;
      }

      const allowedForSource =
        ALLOWED_EVENTS[source as keyof typeof ALLOWED_EVENTS];
      if (allowedForSource.includes(normalizedEventType)) {
        allowedEvents++;
      } else {
        issues.push(
          `  ❌ ${dataset.name}: Event "${eventType}" (normalized: "${normalizedEventType}") not in ${source} allowed events: [${allowedForSource.join(", ")}]`
        );
        filteredEvents++;
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("Summary:");
  console.log("=".repeat(70));
  console.log(`Total events checked: ${totalEvents}`);
  console.log(`✅ Events that will be processed: ${allowedEvents}`);
  console.log(`🚫 Events that will be filtered: ${filteredEvents}`);

  if (issues.length > 0) {
    console.log("\n❌ Issues found:\n");
    issues.forEach((issue) => console.log(issue));
    console.log(
      "\nThese events will be filtered by observation-capture.ts workflow."
    );
    process.exit(1);
  } else {
    console.log("\n✅ All sandbox events will pass through the filter!");
    console.log("   No events will be accidentally filtered out.");
  }
}

verifyEventFiltering();
