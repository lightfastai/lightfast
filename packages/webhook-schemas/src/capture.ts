/**
 * Capture Script
 *
 * Queries `gateway_webhook_deliveries` for real webhook payloads,
 * sanitizes PII, and writes one fixture file per {eventType}.{action}.json.
 *
 * Usage:
 *   cd packages/webhook-schemas && pnpm capture
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@db/app/client";
import { gatewayWebhookDeliveries } from "@db/app/schema";
import { and, desc, gt, inArray, isNotNull, sql } from "drizzle-orm";

// ── Types ───────────────────────────────────────────────────────────────────

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ── PII Sanitization ────────────────────────────────────────────────────────

const AUTHOR_CONTEXT_KEYS = new Set(["author", "committer", "co-authored-by"]);

function isAuthorContext(key: string): boolean {
  const lower = key.toLowerCase();
  return AUTHOR_CONTEXT_KEYS.has(lower);
}

function walk(
  obj: Record<string, JsonValue>,
  parentKey = ""
): Record<string, JsonValue> {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "avatar_url" && typeof value === "string") {
      obj[key] = "https://avatars.githubusercontent.com/u/0";
      continue;
    }

    if (key === "email" && typeof value === "string") {
      obj[key] = "redacted@example.com";
      continue;
    }

    if (
      key === "name" &&
      typeof value === "string" &&
      isAuthorContext(parentKey)
    ) {
      obj[key] = "Redacted User";
      continue;
    }

    // Vercel meta fields — author identity inside deployment.meta
    if (key === "githubCommitAuthorName" && typeof value === "string") {
      obj[key] = "Redacted User";
      continue;
    }

    if (key === "githubCommitAuthorEmail" && typeof value === "string") {
      obj[key] = "redacted@example.com";
      continue;
    }

    if (key === "githubCommitAuthorLogin" && typeof value === "string") {
      obj[key] = "redacted-user";
      continue;
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      walk(value as Record<string, JsonValue>, key);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          walk(item as Record<string, JsonValue>, key);
        }
      }
    }
  }
  return obj;
}

function sanitize(
  payload: Record<string, JsonValue>
): Record<string, JsonValue> {
  const clone = structuredClone(payload);
  return walk(clone);
}

// ── Derive action from payload ──────────────────────────────────────────────

function deriveAction(
  provider: string,
  eventType: string,
  payload: Record<string, JsonValue>
): string {
  if (provider === "github") {
    const action = payload.action;
    if (typeof action === "string") {
      return `${eventType}.${action}`;
    }
    return eventType;
  }

  if (provider === "vercel") {
    // eventType is already like "deployment.created"
    return eventType;
  }

  return eventType;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Querying gateway_webhook_deliveries...\n");

  const rows = await db
    .selectDistinctOn(
      [gatewayWebhookDeliveries.provider, gatewayWebhookDeliveries.eventType],
      {
        provider: gatewayWebhookDeliveries.provider,
        eventType: gatewayWebhookDeliveries.eventType,
        payload: gatewayWebhookDeliveries.payload,
        receivedAt: gatewayWebhookDeliveries.receivedAt,
      }
    )
    .from(gatewayWebhookDeliveries)
    .where(
      and(
        isNotNull(gatewayWebhookDeliveries.payload),
        inArray(gatewayWebhookDeliveries.provider, ["github", "vercel"]),
        gt(gatewayWebhookDeliveries.receivedAt, sql`NOW() - INTERVAL '30 days'`)
      )
    )
    .orderBy(
      gatewayWebhookDeliveries.provider,
      gatewayWebhookDeliveries.eventType,
      desc(gatewayWebhookDeliveries.receivedAt)
    );

  console.log(`Found ${rows.length} rows with payloads\n`);

  // Group by provider + action, keep first (oldest) per group
  const grouped = new Map<string, Record<string, JsonValue>>();
  const providerCounts: Record<string, number> = {};

  for (const row of rows) {
    if (!row.payload) {
      continue;
    }

    let parsed: Record<string, JsonValue>;
    try {
      parsed = JSON.parse(row.payload) as Record<string, JsonValue>;
    } catch {
      console.log(
        `  Skipping unparseable payload for ${row.provider}/${row.eventType}`
      );
      continue;
    }

    const action = deriveAction(row.provider, row.eventType, parsed);
    const key = `${row.provider}:${action}`;

    if (!grouped.has(key)) {
      grouped.set(key, sanitize(parsed));
      providerCounts[row.provider] = (providerCounts[row.provider] ?? 0) + 1;
    }
  }

  // Write fixtures
  const fixturesDir = join(import.meta.dirname, "..", "fixtures");

  for (const [key, payload] of grouped) {
    const colonIdx = key.indexOf(":");
    const provider = key.slice(0, colonIdx);
    const eventAction = key.slice(colonIdx + 1);

    const dir = join(fixturesDir, provider);
    mkdirSync(dir, { recursive: true });

    const filePath = join(dir, `${eventAction}.json`);
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  // Summary
  console.log("Fixtures written:");
  for (const [provider, count] of Object.entries(providerCounts)) {
    console.log(`  ${provider}: ${count} fixture(s)`);
  }
  console.log(`\nTotal: ${grouped.size} fixture file(s)`);

  // List all written files
  console.log("\nFiles:");
  for (const key of grouped.keys()) {
    const colonIdx = key.indexOf(":");
    const provider = key.slice(0, colonIdx);
    const eventAction = key.slice(colonIdx + 1);
    console.log(`  fixtures/${provider}/${eventAction}.json`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
