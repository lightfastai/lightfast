/**
 * Validate Script
 *
 * Loads all fixture files and parses each through the matching preTransform*
 * Zod schema from @repo/app-providers. Reports pass/fail per fixture and
 * which fields are dropped by schema parsing.
 *
 * Usage:
 *   cd packages/webhook-schemas && pnpm validate
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  preTransformGitHubIssueCommentEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformVercelWebhookPayloadSchema,
} from "@repo/app-providers";
import type { ZodType } from "zod";

// ── Types ───────────────────────────────────────────────────────────────────

interface Fixture {
  data: Record<string, unknown>;
  eventType: string;
  path: string;
  provider: string;
}

// ── Deep key extraction ─────────────────────────────────────────────────────

function deepKeys(obj: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();

  if (obj === null || obj === undefined || typeof obj !== "object") {
    return keys;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item !== null && typeof item === "object") {
        for (const k of deepKeys(item, `${prefix}[]`)) {
          keys.add(k);
        }
      }
    }
    return keys;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);

    if (value !== null && typeof value === "object") {
      for (const k of deepKeys(value, fullKey)) {
        keys.add(k);
      }
    }
  }

  return keys;
}

// ── Schema mapping ──────────────────────────────────────────────────────────

function getSchema(provider: string, eventType: string): ZodType | null {
  if (provider === "vercel") {
    return preTransformVercelWebhookPayloadSchema;
  }
  if (provider === "github") {
    if (eventType.startsWith("pull_request")) {
      return preTransformGitHubPullRequestEventSchema;
    }
    if (eventType.startsWith("issues")) {
      return preTransformGitHubIssuesEventSchema;
    }
    if (eventType.startsWith("issue_comment")) {
      return preTransformGitHubIssueCommentEventSchema;
    }
  }
  return null;
}

// ── Load fixtures ───────────────────────────────────────────────────────────

function loadFixtures(): Fixture[] {
  const fixturesDir = join(import.meta.dirname, "..", "fixtures");
  const fixtures: Fixture[] = [];

  for (const provider of ["github", "vercel"]) {
    const dir = join(fixturesDir, provider);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      console.log(`  No fixtures found for ${provider}`);
      continue;
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as Record<string, unknown>;
      const eventType = file.replace(".json", "");

      fixtures.push({
        provider,
        eventType,
        path: `fixtures/${provider}/${file}`,
        data,
      });
    }
  }

  return fixtures;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const fixtures = loadFixtures();
  console.log(`\nLoaded ${fixtures.length} fixture(s)\n`);

  let passCount = 0;
  let failCount = 0;
  let noSchemaCount = 0;
  let totalDropped = 0;

  for (const fixture of fixtures) {
    const schema = getSchema(fixture.provider, fixture.eventType);

    if (!schema) {
      console.log(`\x1b[33m⚠\x1b[0m No schema for ${fixture.path}`);
      noSchemaCount++;
      continue;
    }

    const result = schema.safeParse(fixture.data);

    if (result.success) {
      const inputKeys = deepKeys(fixture.data);
      const outputKeys = deepKeys(result.data);
      const dropped = [...inputKeys].filter((k) => !outputKeys.has(k));
      totalDropped += dropped.length;

      console.log(
        `\x1b[32m✓\x1b[0m ${fixture.path} — ${dropped.length} field(s) dropped by schema`
      );
      if (dropped.length > 0) {
        for (const field of dropped) {
          console.log(`    \x1b[90m- ${field}\x1b[0m`);
        }
      }
      passCount++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${fixture.path} — PARSE FAILED`);
      for (const issue of result.error.issues) {
        console.log(`    ${issue.path.join(".")}: ${issue.message}`);
      }
      failCount++;
    }
  }

  // Summary
  console.log("\n─── Summary ───────────────────────────────────────────");
  console.log(`Total fixtures:  ${fixtures.length}`);
  console.log(`Passed:          \x1b[32m${passCount}\x1b[0m`);
  console.log(`Failed:          \x1b[31m${failCount}\x1b[0m`);
  console.log(`No schema:       \x1b[33m${noSchemaCount}\x1b[0m`);
  console.log(`Fields dropped:  ${totalDropped}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
