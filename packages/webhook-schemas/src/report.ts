/**
 * Report Script
 *
 * Analyzes committed fixtures to answer research questions about
 * Vercel `meta.github*` field presence/types and GitHub field coverage.
 *
 * Usage:
 *   cd packages/webhook-schemas && pnpm report
 */

import {
  preTransformVercelWebhookPayloadSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubIssueCommentEventSchema,
} from "@repo/app-providers";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";

// ── Types ───────────────────────────────────────────────────────────────────

interface Fixture {
  provider: string;
  eventType: string;
  path: string;
  data: Record<string, unknown>;
}

// ── Deep key extraction (shared with validate) ──────────────────────────────

function deepKeys(obj: unknown, prefix: string = ""): Set<string> {
  const keys = new Set<string>();

  if (obj === null || obj === undefined || typeof obj !== "object") {
    return keys;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i];
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

// ── Load fixtures ───────────────────────────────────────────────────────────

function loadFixtures(provider: string): Fixture[] {
  const fixturesDir = join(import.meta.dirname, "..", "fixtures", provider);
  const fixtures: Fixture[] = [];

  let files: string[];
  try {
    files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  } catch {
    return fixtures;
  }

  for (const file of files) {
    const filePath = join(fixturesDir, file);
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

  return fixtures;
}

// ── Safely navigate nested objects ──────────────────────────────────────────

function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Section A: Vercel meta.github* Analysis ─────────────────────────────────

const VERCEL_META_GITHUB_FIELDS = [
  "githubCommitSha",
  "githubCommitRef",
  "githubCommitMessage",
  "githubCommitAuthorName",
  "githubCommitAuthorLogin",
  "githubOrg",
  "githubRepo",
  "githubDeployment",
  "githubCommitOrg",
  "githubCommitRepo",
  "githubCommitRepoId",
  "githubPrId",
  "githubRepoId",
  "githubRepoOwnerType",
];

function analyzeVercelFixtures(fixtures: Fixture[]) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Section A: Vercel meta.github* Field Analysis");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (fixtures.length === 0) {
    console.log("  No Vercel fixtures found. Run 'pnpm capture' first.\n");
    return;
  }

  console.log(`Analyzing ${fixtures.length} Vercel fixture(s):\n`);

  // Collect meta.github* field presence across all fixtures
  const fieldStats = new Map<
    string,
    { present: number; values: string[]; types: Set<string> }
  >();

  for (const field of VERCEL_META_GITHUB_FIELDS) {
    fieldStats.set(field, { present: 0, values: [], types: new Set() });
  }

  for (const fixture of fixtures) {
    const meta = getNestedValue(fixture.data, "payload.deployment.meta");
    if (!meta || typeof meta !== "object") continue;

    const metaObj = meta as Record<string, unknown>;
    for (const field of VERCEL_META_GITHUB_FIELDS) {
      const value = metaObj[field];
      const stats = fieldStats.get(field);
      if (!stats) continue;

      if (value !== undefined && value !== null) {
        stats.present++;
        stats.types.add(typeof value);
        stats.values.push(String(value));
      }
    }
  }

  // Print field presence table
  const header = `${"Field".padEnd(35)} ${"Present".padEnd(10)} ${"Type".padEnd(12)} Example Value`;
  console.log(header);
  console.log("─".repeat(90));

  for (const [field, stats] of fieldStats) {
    const present = stats.present > 0 ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const ratio = `${stats.present}/${fixtures.length}`;
    const type = stats.types.size > 0 ? [...stats.types].join("|") : "-";
    const example =
      stats.values.length > 0
        ? stats.values[0]!.length > 30
          ? `"${stats.values[0]!.slice(0, 27)}..."`
          : `"${stats.values[0]}"`
        : "-";

    console.log(
      `meta.${field.padEnd(30)} ${present} ${ratio.padEnd(8)} ${type.padEnd(12)} ${example}`
    );
  }

  // Answer research questions
  console.log("\n\n─── Research Questions ─────────────────────────────────\n");

  const questions = [
    {
      q: "Is meta.githubPrId always present on deployments?",
      answer: () => {
        const total = fixtures.length;
        const withPrId = fixtures.filter((f) => {
          const meta = getNestedValue(f.data, "payload.deployment.meta");
          return meta && typeof meta === "object" && (meta as Record<string, unknown>).githubPrId;
        }).length;
        return `${withPrId}/${total} fixtures have githubPrId`;
      },
    },
    {
      q: "Is meta.githubPrId a PR number or PR node ID?",
      answer: () => {
        const values = fixtures
          .map((f) => {
            const meta = getNestedValue(f.data, "payload.deployment.meta");
            return meta && typeof meta === "object"
              ? (meta as Record<string, unknown>).githubPrId
              : undefined;
          })
          .filter((v): v is string => typeof v === "string");

        if (values.length === 0) return "No githubPrId values found";

        const allSmallInts = values.every(
          (v) => /^\d+$/.test(v) && parseInt(v) < 100000
        );
        return allSmallInts
          ? `PR number (small integer as string) — values: [${values.join(", ")}]`
          : `Unclear — values: [${values.join(", ")}]`;
      },
    },
    {
      q: "Does meta.githubCommitSha match GitHub PR head.sha format?",
      answer: () => {
        const shas = fixtures
          .map((f) => {
            const meta = getNestedValue(f.data, "payload.deployment.meta");
            return meta && typeof meta === "object"
              ? (meta as Record<string, unknown>).githubCommitSha
              : undefined;
          })
          .filter((v): v is string => typeof v === "string");

        if (shas.length === 0) return "No githubCommitSha values found";

        const allFull = shas.every((s) => /^[a-f0-9]{40}$/.test(s));
        return allFull
          ? "Yes — full 40-char hex SHA"
          : `Mixed formats — examples: [${shas.slice(0, 3).join(", ")}]`;
      },
    },
    {
      q: "Are there deployments with githubCommitSha but no githubPrId?",
      answer: () => {
        const withShaNopr = fixtures.filter((f) => {
          const meta = getNestedValue(f.data, "payload.deployment.meta");
          if (!meta || typeof meta !== "object") return false;
          const m = meta as Record<string, unknown>;
          return m.githubCommitSha && !m.githubPrId;
        });
        return `${withShaNopr.length} fixture(s) have SHA but no PR ID (likely direct-push deploys)`;
      },
    },
  ];

  for (const { q, answer } of questions) {
    console.log(`Q: ${q}`);
    console.log(`A: ${answer()}\n`);
  }
}

// ── Section B: GitHub Field Coverage ────────────────────────────────────────

function getSchema(eventType: string): ZodType | null {
  if (eventType.startsWith("pull_request"))
    return preTransformGitHubPullRequestEventSchema;
  if (eventType.startsWith("issues"))
    return preTransformGitHubIssuesEventSchema;
  if (eventType.startsWith("issue_comment"))
    return preTransformGitHubIssueCommentEventSchema;
  return null;
}

function analyzeGitHubFixtures(fixtures: Fixture[]) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Section B: GitHub Field Coverage");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (fixtures.length === 0) {
    console.log("  No GitHub fixtures found. Run 'pnpm capture' first.\n");
    return;
  }

  console.log(`Analyzing ${fixtures.length} GitHub fixture(s):\n`);

  // Categorize dropped fields
  const categories: Record<string, string[]> = {
    identifiers: [],
    timestamps: [],
    urls: [],
    users: [],
    metadata: [],
    other: [],
  };

  function categorize(field: string): string {
    if (field.match(/\bid\b|_id|node_id|number/i)) return "identifiers";
    if (field.match(/\bat\b|_at|date|time/i)) return "timestamps";
    if (field.match(/url|href|link/i)) return "urls";
    if (field.match(/user|author|owner|sender|assignee|reviewer|committer/i))
      return "users";
    if (
      field.match(
        /label|milestone|description|permissions|events|type|state|locked|active_lock_reason/i
      )
    )
      return "metadata";
    return "other";
  }

  for (const fixture of fixtures) {
    const schema = getSchema(fixture.eventType);
    if (!schema) {
      console.log(`\x1b[33m⚠\x1b[0m No schema for ${fixture.path}`);
      continue;
    }

    const result = schema.safeParse(fixture.data);
    if (!result.success) {
      console.log(`\x1b[31m✗\x1b[0m ${fixture.path} — PARSE FAILED`);
      continue;
    }

    const inputKeys = deepKeys(fixture.data);
    const outputKeys = deepKeys(result.data);
    const dropped = [...inputKeys].filter((k) => !outputKeys.has(k));
    const captured = [...inputKeys].filter((k) => outputKeys.has(k));

    console.log(`\x1b[36m${fixture.path}\x1b[0m`);
    console.log(`  Captured: ${captured.length}  |  Dropped: ${dropped.length}\n`);

    // Group dropped fields by category
    const grouped: Record<string, string[]> = {};
    for (const field of dropped) {
      const cat = categorize(field);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(field);
    }

    for (const [cat, fields] of Object.entries(grouped)) {
      if (fields.length === 0) continue;
      console.log(`  \x1b[33m${cat}\x1b[0m (${fields.length}):`);
      for (const field of fields.slice(0, 15)) {
        console.log(`    - ${field}`);
      }
      if (fields.length > 15) {
        console.log(`    ... and ${fields.length - 15} more`);
      }
    }

    // Accumulate global stats
    for (const field of dropped) {
      const cat = categorize(field);
      if (!categories[cat]!.includes(field)) {
        categories[cat]!.push(field);
      }
    }

    console.log();
  }

  // Global summary
  console.log("─── Dropped Fields Summary (across all GitHub fixtures) ──\n");
  for (const [cat, fields] of Object.entries(categories)) {
    if (fields.length === 0) continue;
    console.log(`  ${cat}: ${fields.length} unique field(s)`);
  }
  const totalUnique = Object.values(categories).reduce(
    (sum, f) => sum + f.length,
    0
  );
  console.log(`\n  Total unique dropped fields: ${totalUnique}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("\n╔═════════════════════════════════════════════════════════╗");
  console.log("║  Webhook Schema Analysis Report                       ║");
  console.log("╚═════════════════════════════════════════════════════════╝\n");

  const vercelFixtures = loadFixtures("vercel");
  const githubFixtures = loadFixtures("github");

  analyzeVercelFixtures(vercelFixtures);
  analyzeGitHubFixtures(githubFixtures);
}

main();
