import type { SourceEvent } from "@repo/console-types";

/**
 * Significance scoring for neural observations.
 *
 * Current implementation: Rule-based scoring using event type weights,
 * content signals, and reference density.
 *
 * TODO (Future Enhancement): Replace with LLM-based scoring using Claude Haiku
 * for semantic understanding of importance. The LLM approach would:
 * - Understand context and nuance in commit messages
 * - Score based on actual impact rather than keyword matching
 * - Adapt to team-specific patterns over time
 *
 * Example future implementation:
 * ```typescript
 * import { generateObject } from "@repo/ai/ai";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const { object } = await generateObject({
 *   model: anthropic("claude-3-5-haiku-latest"),
 *   schema: z.object({ score: z.number(), reasoning: z.string() }),
 *   prompt: `Score significance 0-100: ${sourceEvent.title}`,
 * });
 * ```
 */

export interface SignificanceResult {
  score: number;
  factors: string[];
}

/**
 * Event type base weights.
 * Higher weights for events that typically indicate important changes.
 */
const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  // High significance (60-80 base)
  release_published: 75,
  release_created: 70,
  "deployment.error": 70,
  "deployment.canceled": 65,
  pull_request_merged: 60,

  // Medium significance (40-60 base)
  pull_request_opened: 50,
  pull_request_closed: 45,
  issue_opened: 45,
  issue_closed: 40,
  "deployment.succeeded": 40,
  "deployment.ready": 40,

  // Lower significance (20-40 base)
  push: 30,
  "deployment.created": 30,
  discussion_created: 35,
  discussion_answered: 40,

  // Default
  default: 35,
};

/**
 * Content signals that increase significance.
 * Each match adds to the score.
 */
const SIGNIFICANCE_SIGNALS: Array<{ pattern: RegExp; weight: number; factor: string }> = [
  // Critical keywords (high weight)
  { pattern: /\b(breaking|critical|urgent|security|vulnerability|CVE-\d+)\b/i, weight: 20, factor: "critical_keyword" },
  { pattern: /\b(hotfix|emergency|incident|outage|downtime)\b/i, weight: 15, factor: "incident_keyword" },

  // Important keywords (medium weight)
  { pattern: /\b(major|important|significant|release|deploy)\b/i, weight: 10, factor: "important_keyword" },
  { pattern: /\b(feature|feat|new)\b/i, weight: 8, factor: "feature_keyword" },
  { pattern: /\b(fix|bug|patch|resolve)\b/i, weight: 5, factor: "fix_keyword" },

  // Routine keywords (negative weight)
  { pattern: /\b(chore|deps|dependencies|bump|update|upgrade)\b/i, weight: -10, factor: "routine_keyword" },
  { pattern: /\b(typo|whitespace|formatting|lint)\b/i, weight: -15, factor: "trivial_keyword" },
  { pattern: /\b(wip|draft|temp|test)\b/i, weight: -10, factor: "wip_keyword" },
];

/**
 * Calculate significance score for an observation.
 *
 * Scoring formula:
 * 1. Start with event type base weight
 * 2. Add/subtract based on content signals
 * 3. Add bonus for references (linked issues/PRs)
 * 4. Add bonus for substantial content
 * 5. Clamp to 0-100 range
 */
export function scoreSignificance(sourceEvent: SourceEvent): SignificanceResult {
  const factors: string[] = [];

  // 1. Event type base weight
  const eventType = sourceEvent.sourceType.toLowerCase();
  const defaultWeight = 35;
  let score = EVENT_TYPE_WEIGHTS[eventType] ?? defaultWeight;
  factors.push(`base:${eventType}`);

  // 2. Content signal matching
  const textToAnalyze = `${sourceEvent.title} ${sourceEvent.body || ""}`.toLowerCase();

  for (const signal of SIGNIFICANCE_SIGNALS) {
    if (signal.pattern.test(textToAnalyze)) {
      score += signal.weight;
      factors.push(signal.factor);
    }
  }

  // 3. Reference density bonus (linked issues, PRs)
  const refCount = sourceEvent.references.length;
  if (refCount > 0) {
    const refBonus = Math.min(refCount * 3, 15); // Max 15 points for references
    score += refBonus;
    factors.push(`references:${refCount}`);
  }

  // 4. Content substance bonus
  const bodyLength = sourceEvent.body?.length || 0;
  if (bodyLength > 500) {
    score += 5;
    factors.push("substantial_content");
  } else if (bodyLength > 200) {
    score += 2;
    factors.push("moderate_content");
  }

  // 5. Clamp to valid range
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, factors };
}
