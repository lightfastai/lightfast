import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RawFinding } from "./types.js";

export interface Suppression {
  rule: string;
  from: string; // File path or glob pattern
  to?: string; // Target path or glob pattern (optional)
  reason: string;
  expires?: string; // YYYY-MM-DD format
}

interface SuppressionConfig {
  suppressions: Suppression[];
}

let cachedSuppressions: Suppression[] | null = null;

export function loadSuppressions(): Suppression[] {
  if (cachedSuppressions !== null) {
    return cachedSuppressions;
  }

  const monorepoRoot = resolve(import.meta.dirname, "../../..");
  const configPath = resolve(monorepoRoot, ".arch-eval-ignore.json");

  if (!existsSync(configPath)) {
    cachedSuppressions = [];
    return cachedSuppressions;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const config: SuppressionConfig = JSON.parse(raw);

    // Filter out expired suppressions
    const now = new Date();
    cachedSuppressions = config.suppressions.filter((s) => {
      if (!s.expires) return true;
      const expiryDate = new Date(s.expires);
      return expiryDate > now;
    });

    return cachedSuppressions;
  } catch (error) {
    console.error("Failed to load .arch-eval-ignore.json:", error);
    cachedSuppressions = [];
    return cachedSuppressions;
  }
}

export function isSuppressed(finding: RawFinding): boolean {
  const suppressions = loadSuppressions();

  for (const suppression of suppressions) {
    // Check rule match
    if (suppression.rule !== finding.rule) {
      continue;
    }

    // Check file path match (support glob-like matching)
    const fromMatch = matchesPattern(finding.file || "", suppression.from);
    if (!fromMatch) {
      continue;
    }

    // If 'to' is specified, check target path match
    if (suppression.to) {
      const toPath = finding.meta?.to as string | undefined;
      if (!toPath || !matchesPattern(toPath, suppression.to)) {
        continue;
      }
    }

    // All conditions met - this finding is suppressed
    return true;
  }

  return false;
}

function matchesPattern(path: string, pattern: string): boolean {
  // Simple glob-like matching - exact match or wildcard
  if (pattern === path) {
    return true;
  }

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.") // Escape dots
    .replace(/\*/g, ".*") // * becomes .*
    .replace(/\?/g, "."); // ? becomes .

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export function filterSuppressedFindings(
  findings: RawFinding[]
): RawFinding[] {
  return findings.filter((f) => !isSuppressed(f));
}
