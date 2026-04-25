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

const AUTHOR_CONTEXT_KEYS = new Set([
  "author",
  "committer",
  "co-authored-by",
  // GitHub push events use `pusher: { name, email }` for the actor that
  // pushed; treat it as an author context so name/email/username get scrubbed.
  "pusher",
]);

function isAuthorContext(key: string): boolean {
  const lower = key.toLowerCase();
  return AUTHOR_CONTEXT_KEYS.has(lower);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GitHub user/org objects ("actors") have a stable shape: login + id + node_id
// plus a fan of *_url fields. Detect by signature and replace identifying
// fields in-place so committed fixtures contain no real handles.
function isGitHubActor(obj: Record<string, JsonValue>): boolean {
  return (
    typeof obj.login === "string" &&
    typeof obj.node_id === "string" &&
    typeof obj.id === "number"
  );
}

function redactGitHubActor(obj: Record<string, JsonValue>): void {
  // Capture the original login *before* redacting so we can do a bounded
  // replacement of it inside URL fields. A blanket regex against
  // `github.com/[^/]+` would over-match — it would turn
  // `api.github.com/orgs/<org>` into `api.github.com/redacted-user/<org>`.
  const originalLogin = typeof obj.login === "string" ? obj.login : null;
  obj.login = "redacted-user";
  obj.id = 0;
  obj.node_id = "U_REDACTED";
  if (!originalLogin) {
    return;
  }
  const segmentRe = new RegExp(
    `/${escapeRegex(originalLogin)}(?=/|$|[?#])`,
    "g"
  );
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val !== "string") {
      continue;
    }
    if (key === "url" || key === "html_url" || key.endsWith("_url")) {
      obj[key] = val.replace(segmentRe, "/redacted-user");
    }
  }
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

    // GitHub commit author/committer blocks have `name`, `email`, AND
    // `username` — the last is missed by both the actor signature (no node_id
    // on commit author objects) and the blanket `name` rule.
    if (
      key === "username" &&
      typeof value === "string" &&
      isAuthorContext(parentKey)
    ) {
      obj[key] = "redacted-user";
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
      const child = value as Record<string, JsonValue>;
      if (isGitHubActor(child)) {
        redactGitHubActor(child);
      }
      walk(child, key);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const child = item as Record<string, JsonValue>;
          if (isGitHubActor(child)) {
            redactGitHubActor(child);
          }
          walk(child, key);
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

  // Pull all candidate rows newest-first; the in-memory loop below dedupes by
  // (provider, derivedAction). DB-side DISTINCT ON would collapse all of
  // GitHub's pull_request.* variants to a single row before the action key
  // (which lives in payload.action, not eventType) is extracted.
  const rows = await db
    .select({
      provider: gatewayWebhookDeliveries.provider,
      eventType: gatewayWebhookDeliveries.eventType,
      payload: gatewayWebhookDeliveries.payload,
      receivedAt: gatewayWebhookDeliveries.receivedAt,
    })
    .from(gatewayWebhookDeliveries)
    .where(
      and(
        isNotNull(gatewayWebhookDeliveries.payload),
        inArray(gatewayWebhookDeliveries.provider, ["github", "vercel"]),
        gt(gatewayWebhookDeliveries.receivedAt, sql`NOW() - INTERVAL '30 days'`)
      )
    )
    .orderBy(desc(gatewayWebhookDeliveries.receivedAt));

  console.log(`Found ${rows.length} rows with payloads\n`);

  // Group by provider + action, keep first (newest — rows are desc by receivedAt) per group
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
