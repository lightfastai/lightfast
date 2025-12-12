import type { SourceEvent } from "@repo/console-types";

/**
 * Semantic classification for neural observations.
 *
 * Current implementation: Regex-based pattern matching to categorize
 * events into semantic types.
 *
 * TODO (Future Enhancement): Replace with LLM-based classification using
 * Claude Haiku for semantic understanding. The LLM approach would:
 * - Understand intent beyond keyword matching
 * - Handle ambiguous cases (e.g., "refactor that fixes a bug")
 * - Provide confidence scores
 * - Extract secondary categories contextually
 *
 * Example future implementation:
 * ```typescript
 * import { generateObject } from "@repo/ai/ai";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const { object } = await generateObject({
 *   model: anthropic("claude-3-5-haiku-latest"),
 *   schema: classificationSchema,
 *   prompt: `Classify this event: ${sourceEvent.title}`,
 * });
 * ```
 */

/**
 * Primary semantic categories for observations.
 */
export type PrimaryCategory =
  | "bug_fix"
  | "feature"
  | "refactor"
  | "documentation"
  | "testing"
  | "infrastructure"
  | "security"
  | "performance"
  | "incident"
  | "decision"
  | "discussion"
  | "release"
  | "deployment"
  | "other";

export interface ClassificationResult {
  primaryCategory: PrimaryCategory;
  secondaryCategories: string[];
}

/**
 * Category detection patterns.
 * Order matters - first match wins for primary category.
 */
const CATEGORY_PATTERNS: Array<{ category: PrimaryCategory; patterns: RegExp[] }> = [
  // Release/deployment (check first - specific event types)
  {
    category: "release",
    patterns: [/^release_/, /\brelease\b/i, /\bversion\s+\d/i, /\bv\d+\.\d+/i],
  },
  {
    category: "deployment",
    patterns: [/^deployment\./, /\bdeploy/i, /\bshippe?d?\b/i],
  },

  // Security (high priority)
  {
    category: "security",
    patterns: [/\bsecurity\b/i, /\bvulnerability\b/i, /\bCVE-\d+/i, /\bauth\b/i, /\bpermission/i],
  },

  // Incident (high priority)
  {
    category: "incident",
    patterns: [/\bincident\b/i, /\boutage\b/i, /\bdowntime\b/i, /\bemergency\b/i, /\bhotfix\b/i],
  },

  // Bug fixes
  {
    category: "bug_fix",
    patterns: [/\bfix(es|ed|ing)?\b/i, /\bbug\b/i, /\bpatch\b/i, /\bresolve[sd]?\b/i, /\bcorrect/i],
  },

  // Features
  {
    category: "feature",
    patterns: [/\bfeat(ure)?[:\s]/i, /\badd(s|ed|ing)?\b/i, /\bnew\b/i, /\bimplement/i, /\bintroduce/i],
  },

  // Performance
  {
    category: "performance",
    patterns: [/\bperf(ormance)?\b/i, /\boptimiz/i, /\bspeed/i, /\bfaster\b/i, /\bslow/i],
  },

  // Testing
  {
    category: "testing",
    patterns: [/\btest(s|ing)?\b/i, /\bspec\b/i, /\bcoverage\b/i, /\be2e\b/i, /\bunit\b/i],
  },

  // Documentation
  {
    category: "documentation",
    patterns: [/\bdocs?\b/i, /\breadme\b/i, /\bcomment/i, /\bjsdoc\b/i, /\bdocumentation\b/i],
  },

  // Infrastructure
  {
    category: "infrastructure",
    patterns: [/\bci\b/i, /\bcd\b/i, /\bpipeline\b/i, /\bworkflow\b/i, /\bdocker/i, /\bconfig/i, /\binfra/i],
  },

  // Refactoring
  {
    category: "refactor",
    patterns: [/\brefactor/i, /\brestructure/i, /\breorganize/i, /\bcleanup\b/i, /\bchore\b/i],
  },

  // Discussion
  {
    category: "discussion",
    patterns: [/^discussion_/, /\brfc\b/i, /\bproposal\b/i, /\bdiscuss/i],
  },

  // Decision
  {
    category: "decision",
    patterns: [/\bdecision\b/i, /\bdecide[sd]?\b/i, /\badr\b/i, /\barchitecture\b/i],
  },
];

/**
 * Secondary category patterns for additional context.
 */
const SECONDARY_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  // Technical areas
  { tag: "api", pattern: /\bapi\b/i },
  { tag: "frontend", pattern: /\b(frontend|ui|ux|react|vue|angular)\b/i },
  { tag: "backend", pattern: /\b(backend|server|api|endpoint)\b/i },
  { tag: "database", pattern: /\b(database|db|sql|postgres|mysql|mongo)\b/i },
  { tag: "auth", pattern: /\b(auth|login|session|jwt|oauth)\b/i },

  // Platforms
  { tag: "github", pattern: /\bgithub\b/i },
  { tag: "vercel", pattern: /\bvercel\b/i },
  { tag: "aws", pattern: /\baws\b/i },

  // Languages/frameworks
  { tag: "typescript", pattern: /\b(typescript|tsx?)\b/i },
  { tag: "react", pattern: /\breact\b/i },
  { tag: "nextjs", pattern: /\bnext\.?js\b/i },
];

/**
 * Classify an observation into semantic categories.
 */
export function classifyObservation(sourceEvent: SourceEvent): ClassificationResult {
  const textToAnalyze = `${sourceEvent.sourceType} ${sourceEvent.title} ${sourceEvent.body || ""}`;

  // Find primary category (first match wins)
  let primaryCategory: PrimaryCategory = "other";
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(textToAnalyze))) {
      primaryCategory = category;
      break;
    }
  }

  // Find secondary categories (all matches)
  const secondaryCategories: string[] = [];
  for (const { tag, pattern } of SECONDARY_PATTERNS) {
    if (pattern.test(textToAnalyze) && !secondaryCategories.includes(tag)) {
      secondaryCategories.push(tag);
    }
  }

  // Limit to 3 secondary categories
  return {
    primaryCategory,
    secondaryCategories: secondaryCategories.slice(0, 3),
  };
}
