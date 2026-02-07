import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import type { CollectorOutput, RawFinding } from "../types.js";

export function collectTurboSummary(): CollectorOutput {
  const startTime = performance.now();
  const monorepoRoot = resolve(import.meta.dirname, "../../../..");
  const turboRunsDir = resolve(monorepoRoot, ".turbo", "runs");

  try {
    // Try to read most recent cached summary
    const files = readdirSync(turboRunsDir).filter((f) =>
      f.endsWith(".json")
    );
    if (files.length === 0) {
      // No cached summary, return empty
      return {
        tool: "turbo-summary",
        raw_findings: [],
        duration_ms: Math.round(performance.now() - startTime),
      };
    }

    // Get most recent summary
    const sortedFiles = files.sort().reverse();
    const mostRecentFile = sortedFiles[0];
    if (!mostRecentFile) {
      return {
        tool: "turbo-summary",
        raw_findings: [],
        duration_ms: Math.round(performance.now() - startTime),
      };
    }
    const summaryPath = resolve(turboRunsDir, mostRecentFile);
    const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));

    const raw_findings: RawFinding[] = [];

    // Extract build metrics
    // Check for cache hit rate, build time, task graph depth
    const tasks = summary.tasks || [];
    const totalTasks = tasks.length;
    const cachedTasks = tasks.filter((t: { cache?: { status?: string } }) => t.cache?.status === "HIT").length;
    const cacheHitRate = totalTasks > 0 ? cachedTasks / totalTasks : 0;

    // Warn if cache hit rate is low (< 50%)
    if (cacheHitRate < 0.5 && totalTasks > 0) {
      raw_findings.push({
        rule: "low-cache-hit-rate",
        message: `Cache hit rate is ${(cacheHitRate * 100).toFixed(0)}% (${cachedTasks}/${totalTasks} tasks)`,
        severity: "warn",
        meta: {
          cache_hit_rate: cacheHitRate,
          cached_tasks: cachedTasks,
          total_tasks: totalTasks,
        },
      });
    }

    // Check build times (if available)
    const totalDurationMs = tasks.reduce(
      (sum: number, t: { execution?: { duration?: number } }) => sum + (t.execution?.duration || 0),
      0
    );

    if (totalDurationMs > 60000) {
      // > 60 seconds
      raw_findings.push({
        rule: "long-build-time",
        message: `Total build time is ${(totalDurationMs / 1000).toFixed(1)}s`,
        severity: "info",
        meta: {
          duration_ms: totalDurationMs,
        },
      });
    }

    const duration_ms = Math.round(performance.now() - startTime);

    return {
      tool: "turbo-summary",
      raw_findings,
      duration_ms,
    };
  } catch {
    // No cached summary or failed to parse
    const duration_ms = Math.round(performance.now() - startTime);
    return {
      tool: "turbo-summary",
      raw_findings: [],
      duration_ms,
    };
  }
}
