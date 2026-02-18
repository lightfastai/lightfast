/**
 * Neural Observation Classification
 *
 * Classifies source events into semantic categories using Claude Haiku.
 * Provides primary category, secondary tags, topics, and confidence scores.
 *
 * Used by observation-capture.ts step.ai.wrap() for inline classification.
 */

import type { SourceEvent } from "@repo/console-types";


/**
 * Build the classification prompt for Claude Haiku
 */
export function buildClassificationPrompt(sourceEvent: SourceEvent): string {
  return `Classify this engineering event into categories.

EVENT DETAILS:
- Source: ${sourceEvent.source}
- Type: ${sourceEvent.sourceType}
- Title: ${sourceEvent.title}
${sourceEvent.body ? `- Description: ${sourceEvent.body.slice(0, 1000)}` : ""}

CATEGORIES (choose the most appropriate primary category):
- bug_fix: Bug fixes, patches, error corrections
- feature: New features, additions, implementations
- refactor: Code restructuring, cleanup, reorganization
- documentation: Docs, README, comments, JSDoc
- testing: Tests, specs, coverage improvements
- infrastructure: CI/CD, pipelines, Docker, config
- security: Security fixes, auth changes, permissions
- performance: Optimizations, speed improvements
- incident: Outages, emergencies, hotfixes
- decision: ADRs, architecture decisions
- discussion: RFCs, proposals, design discussions
- release: Version releases, changelogs
- deployment: Deployments, shipping to production
- other: Doesn't fit other categories

RULES:
1. Choose ONE primary category that best fits
2. Add up to 3 secondary categories if clearly relevant
3. Extract up to 5 topic keywords from the content
4. Provide confidence (0.0-1.0) based on clarity of classification
5. For ambiguous cases (e.g., "refactor that fixes a bug"), choose the dominant intent

Classify this event.`;
}

/**
 * Category detection patterns for fallback classification.
 * Order matters - first match wins for primary category.
 */
const CATEGORY_PATTERNS: { category: string; patterns: RegExp[] }[] = [
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
 * Fallback regex-based classification for when LLM is unavailable
 * or for low-priority events that don't warrant LLM cost.
 */
export function classifyObservationFallback(sourceEvent: SourceEvent): {
  primaryCategory: string;
  secondaryCategories: string[];
} {
  const body = sourceEvent.body || "";
  const text = `${sourceEvent.sourceType} ${sourceEvent.title} ${body}`.toLowerCase();

  // Priority-ordered patterns - first match wins
  let primaryCategory = "other";
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(text))) {
      primaryCategory = category;
      break;
    }
  }

  // Extract secondary categories (all matches except primary)
  const secondaryCategories = CATEGORY_PATTERNS
    .filter(({ category, patterns }) =>
      category !== primaryCategory && patterns.some((p) => p.test(text))
    )
    .map(({ category }) => category)
    .slice(0, 3);

  return { primaryCategory, secondaryCategories };
}

