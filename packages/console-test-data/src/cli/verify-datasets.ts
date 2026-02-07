#!/usr/bin/env npx tsx
/**
 * Dataset Verification (Pre-flight Check)
 *
 * Validates all sandbox datasets for:
 * - Required fields on every event
 * - Test data markers (:test: suffix, testData metadata)
 * - Chronological timeline ordering
 * - Cross-source reference consistency (SHAs, issue numbers, identifiers)
 * - Title format correctness per source type
 * - Source distribution sanity
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data verify
 *   npx tsx src/cli/verify-datasets.ts [dataset-name]
 */

import { loadDataset, listDatasets } from "../loader/index.js";
import type { SourceEvent } from "@repo/console-types";

interface VerifyResult {
  dataset: string;
  eventCount: number;
  errors: string[];
  warnings: string[];
  sources: Record<string, number>;
}

function verifyDataset(name: string): VerifyResult {
  const result: VerifyResult = {
    dataset: name,
    eventCount: 0,
    errors: [],
    warnings: [],
    sources: {},
  };

  let ds;
  try {
    ds = loadDataset(name);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to load: ${message}`);
    return result;
  }

  result.eventCount = ds.events.length;

  // === Required fields ===
  for (let i = 0; i < ds.events.length; i++) {
    const e = ds.events[i];
    if (!e) continue;
    const prefix = `event[${i}]`;

    // Cast to partial to validate fields that the type claims are required
    const raw = e as Partial<SourceEvent>;
    if (!raw.source) result.errors.push(`${prefix}: missing source`);
    if (!raw.sourceType) result.errors.push(`${prefix}: missing sourceType`);
    if (!raw.sourceId) result.errors.push(`${prefix}: missing sourceId`);
    if (!raw.title?.length)
      result.errors.push(`${prefix}: missing or empty title`);
    if (!raw.body?.length)
      result.errors.push(`${prefix}: missing or empty body`);

    // Test data markers
    if (!e.sourceId.includes(":test:"))
      result.errors.push(
        `${prefix}: sourceId missing :test: suffix (got: ${e.sourceId})`
      );
    if (!e.metadata.testData)
      result.errors.push(`${prefix}: missing testData: true in metadata`);

    // Track source distribution
    result.sources[e.source] = (result.sources[e.source] ?? 0) + 1;
  }

  // === Title format checks ===
  for (let i = 0; i < ds.events.length; i++) {
    const e = ds.events[i];
    if (!e) continue;
    const prefix = `event[${i}]`;

    if (e.source === "sentry") {
      const validPrefixes = [
        "[Issue Created]",
        "[Issue Resolved]",
        "[Issue Assigned]",
        "[Issue Ignored]",
        "[Error]",
        "[Alert Triggered]",
        "[Metric Alert Triggered]",
        "[Metric Alert Resolved]",
      ];
      if (!validPrefixes.some((p) => e.title.startsWith(p)))
        result.errors.push(
          `${prefix}: Sentry title has unexpected format: "${e.title.slice(0, 50)}"`
        );
    }

    if (e.source === "linear") {
      const validPrefixes = [
        "[Issue Created]",
        "[Issue Updated]",
        "[Issue Deleted]",
        "[Comment Added]",
        "[Comment Updated]",
        "[Comment Deleted]",
        "[Project Created]",
        "[Project Updated]",
        "[Project Deleted]",
        "[Cycle Created]",
        "[Cycle Updated]",
        "[Cycle Deleted]",
        "[Project Update Posted]",
        "[Project Update Edited]",
        "[Project Update Deleted]",
      ];
      if (!validPrefixes.some((p) => e.title.startsWith(p)))
        result.errors.push(
          `${prefix}: Linear title has unexpected format: "${e.title.slice(0, 50)}"`
        );
    }

    if (e.source === "github") {
      const validPrefixes = [
        "[Push]",
        "[PR Opened]",
        "[PR Merged]",
        "[PR Closed]",
        "[Issue Opened]",
        "[Issue Closed]",
        "[Release",
        "[Discussion",
      ];
      if (!validPrefixes.some((p) => e.title.startsWith(p)))
        result.errors.push(
          `${prefix}: GitHub title has unexpected format: "${e.title.slice(0, 50)}"`
        );
    }

    if (e.source === "vercel") {
      const validPrefixes = [
        "[Deployment Started]",
        "[Deployment Succeeded]",
        "[Deployment Ready]",
        "[Deployment Failed]",
        "[Deployment Canceled]",
      ];
      if (!validPrefixes.some((p) => e.title.startsWith(p)))
        result.errors.push(
          `${prefix}: Vercel title has unexpected format: "${e.title.slice(0, 50)}"`
        );
    }
  }

  // === Chronological ordering ===
  const timestamps = ds.events
    .map((e, i) => ({
      index: i,
      time: e.occurredAt ? new Date(e.occurredAt).getTime() : NaN,
      raw: e.occurredAt,
    }))
    .filter((t) => !isNaN(t.time));

  for (let i = 1; i < timestamps.length; i++) {
    const prev = timestamps[i - 1];
    const curr = timestamps[i];
    if (prev && curr && curr.time < prev.time) {
      result.errors.push(
        `Timeline out of order: event[${prev.index}] (${prev.raw}) > event[${curr.index}] (${curr.raw})`
      );
    }
  }

  // === Cross-source reference consistency ===
  verifyCrossReferences(ds.events, result);

  return result;
}

/**
 * Extract identifiers mentioned across all events and verify consistency
 */
function verifyCrossReferences(
  events: SourceEvent[],
  result: VerifyResult
): void {
  // Collect all identifiers mentioned in titles, bodies, and references
  const allText = events
    .map((e) => `${e.title} ${e.body} ${JSON.stringify(e.references)}`)
    .join(" ");

  // Extract SHA patterns (16+ hex chars that appear in multiple events)
  const shaPattern = /\b([a-f0-9]{16,40})\b/gi;
  const shaMatches = allText.match(shaPattern) ?? [];
  const shaCounts = new Map<string, number>();
  for (const sha of shaMatches) {
    shaCounts.set(sha, (shaCounts.get(sha) ?? 0) + 1);
  }

  // SHAs that appear in multiple places should be consistent
  const crossRefShas = [...shaCounts.entries()].filter(
    ([, count]) => count >= 2
  );
  if (crossRefShas.length > 0) {
    for (const [sha] of crossRefShas) {
      const eventsWithSha = events.filter(
        (e) =>
          e.title.includes(sha) ||
          e.body.includes(sha) ||
          JSON.stringify(e.references).includes(sha) ||
          JSON.stringify(e.metadata).includes(sha)
      );
      if (eventsWithSha.length < 2) {
        result.warnings.push(
          `SHA ${sha.slice(0, 12)}... appears in text but only ${eventsWithSha.length} event(s) reference it in structured data`
        );
      }
    }
  }

  // Extract issue/PR number patterns like #NNN
  const issuePattern = /#(\d{2,4})\b/g;
  const issueNumbers = new Set<string>();
  let match;
  while ((match = issuePattern.exec(allText)) !== null) {
    const num = match[1];
    if (num) issueNumbers.add(num);
  }

  // For each issue number, verify it appears in at least 2 events (cross-referenced)
  for (const num of issueNumbers) {
    const eventsWithNum = events.filter(
      (e) =>
        e.title.includes(`#${num}`) ||
        e.body.includes(`#${num}`) ||
        JSON.stringify(e.metadata).includes(`"${num}"`)
    );
    if (eventsWithNum.length < 2) {
      result.warnings.push(
        `Issue/PR #${num} only referenced in ${eventsWithNum.length} event(s) - may lack cross-source linking`
      );
    }
  }

  // Extract Linear identifiers like LF-NNN
  const linearPattern = /\b([A-Z]{2,}-\d+)\b/g;
  const linearIds = new Set<string>();
  while ((match = linearPattern.exec(allText)) !== null) {
    const id = match[1];
    if (id) linearIds.add(id);
  }

  for (const id of linearIds) {
    const eventsWithId = events.filter(
      (e) =>
        e.title.includes(id) ||
        e.body.includes(id) ||
        JSON.stringify(e.references).includes(id)
    );
    if (eventsWithId.length < 2) {
      result.warnings.push(
        `Linear identifier ${id} only referenced in ${eventsWithId.length} event(s)`
      );
    }
  }

  // Extract Sentry short IDs like NEURAL-847
  const sentryPattern = /\b([A-Z]+-\d{3,})\b/g;
  const sentryIds = new Set<string>();
  while ((match = sentryPattern.exec(allText)) !== null) {
    const id = match[1];
    // Filter out Linear identifiers (already tracked)
    if (id && !linearIds.has(id)) {
      sentryIds.add(id);
    }
  }

  for (const id of sentryIds) {
    const eventsWithId = events.filter(
      (e) =>
        e.title.includes(id) ||
        e.body.includes(id) ||
        JSON.stringify(e.references).includes(id) ||
        JSON.stringify(e.metadata).includes(id)
    );
    if (eventsWithId.length < 2) {
      result.warnings.push(
        `Sentry identifier ${id} only referenced in ${eventsWithId.length} event(s)`
      );
    }
  }
}

// === Main ===
function main() {
  const targetDataset = process.argv[2];
  const names = targetDataset ? [targetDataset] : listDatasets();

  console.log(`\nVerifying ${names.length} dataset(s)...\n`);

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const name of names) {
    const result = verifyDataset(name);

    const status =
      result.errors.length === 0
        ? "\x1b[32mPASS\x1b[0m"
        : "\x1b[31mFAIL\x1b[0m";
    console.log(
      `${status} ${result.dataset} (${result.eventCount} events)`
    );

    if (Object.keys(result.sources).length > 0) {
      const sourceSummary = Object.entries(result.sources)
        .map(([s, c]) => `${s}:${c}`)
        .join(", ");
      console.log(`     Sources: ${sourceSummary}`);
    }

    for (const err of result.errors) {
      console.log(`     \x1b[31mERROR\x1b[0m ${err}`);
    }
    for (const warn of result.warnings) {
      console.log(`     \x1b[33mWARN\x1b[0m  ${warn}`);
    }

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    console.log();
  }

  console.log("---");
  console.log(
    `Total: ${names.length} dataset(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`
  );

  if (totalErrors > 0) {
    console.log("\n\x1b[31mVerification FAILED\x1b[0m");
    process.exit(1);
  } else {
    console.log("\n\x1b[32mAll datasets verified successfully\x1b[0m");
  }
}

main();
