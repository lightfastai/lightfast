# Neural Memory Day 1: Observations In (Pipeline Completion)

## Overview

Complete the observation capture pipeline by adding rule-based significance scoring and regex-based semantic classification. Actor resolution is deferred to Day 4.

## Current State Analysis

The observation capture pipeline (`api/console/src/inngest/workflow/neural/observation-capture.ts`) has 7 working steps but is missing key intelligence:

| Component | Current Status | Day 1 Action |
|-----------|---------------|--------------|
| Significance Scoring | Field exists, never set | Add rule-based scoring |
| Classification | Keyword extraction only | Add regex-based categories |
| Actor Resolution | Passthrough only | Defer to Day 4 |

### Key Discoveries:
- Pipeline configured at lines 152-172 with `retries: 3`, `concurrency: 10` per workspace
- `significanceScore` field is `real` type at schema line 122-123
- `extractTopics()` at lines 73-99 does simple keyword matching
- Actor stored as JSONB passthrough at line 363

## Desired End State

After Day 1 completion:
1. Every observation has a `significanceScore` (0-100) set by rule-based scoring
2. Every observation has enhanced `topics` including semantic categories (bug_fix, feature, refactor, etc.)
3. Actor resolution placeholder exists with `TODO: Day 4` notes
4. Comments document future LLM enhancement path

### Verification:
- Process a test webhook → observe `significanceScore` is populated
- Process a test webhook → observe `topics` includes semantic categories
- Typecheck passes: `pnpm --filter @api/console typecheck`

## What We're NOT Doing

- LLM-based scoring/classification (future enhancement - noted in comments)
- Actor resolution (Day 4)
- Entity extraction (Day 3)
- Cluster assignment (Day 4)
- Multi-view embeddings (future)
- Significance threshold filtering (future - all observations stored for now)

## Implementation Approach

Add rule-based scoring and regex-based classification as synchronous functions (no new Inngest steps needed). Call them in the existing `store-observation` step.

---

## Phase 1: Add Significance Scoring

### Overview
Add rule-based significance scoring based on event type, content signals, and reference count.

### Changes Required:

#### 1. Create Scoring Function
**File**: `api/console/src/inngest/workflow/neural/scoring.ts` (NEW)

```typescript
import type { SourceEvent } from "@repo/console-types/neural";

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
  let score = EVENT_TYPE_WEIGHTS[eventType] ?? EVENT_TYPE_WEIGHTS.default;
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
```

#### 2. Integrate Scoring into Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Add import at top (with other imports):
```typescript
import { scoreSignificance } from "./scoring";
```

In `store-observation` step, calculate score before insert (around line 356):
```typescript
// Calculate significance score
const significance = scoreSignificance(sourceEvent);
```

Update the insert to include significance (around line 367):
```typescript
significanceScore: significance.score,
```

### Success Criteria:

#### Automated Verification:
- [x] New file exists: `api/console/src/inngest/workflow/neural/scoring.ts`
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Trigger a GitHub webhook → observe `significanceScore` is set in database
- [ ] Release event scores higher than push event

---

## Phase 2: Add Semantic Classification

### Overview
Enhance topic extraction with regex-based semantic categories.

### Changes Required:

#### 1. Create Classification Function
**File**: `api/console/src/inngest/workflow/neural/classification.ts` (NEW)

```typescript
import type { SourceEvent } from "@repo/console-types/neural";

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
```

#### 2. Integrate Classification into Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Add import at top:
```typescript
import { classifyObservation } from "./classification";
```

In `store-observation` step, update topics generation (replace existing `extractTopics` call around line 356):
```typescript
// Extract topics and classify
const keywordTopics = extractTopics(sourceEvent);
const classification = classifyObservation(sourceEvent);

// Merge keyword topics with classification
const topics = [
  ...keywordTopics,
  classification.primaryCategory,
  ...classification.secondaryCategories,
].filter((t, i, arr) => arr.indexOf(t) === i); // Deduplicate
```

### Success Criteria:

#### Automated Verification:
- [x] New file exists: `api/console/src/inngest/workflow/neural/classification.ts`
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`
- [x] Build passes: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Trigger a GitHub PR webhook → observe `topics` includes "feature" or "bug_fix"
- [ ] Trigger a release webhook → observe `topics` includes "release"

---

## Phase 3: Add Actor Resolution Placeholder

### Overview
Add TODO notes and placeholder structure for actor resolution (implementation deferred to Day 4).

### Changes Required:

#### 1. Create Placeholder File
**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts` (NEW)

```typescript
import type { SourceEvent, SourceActor } from "@repo/console-types/neural";

/**
 * Actor Resolution for Neural Observations
 *
 * STATUS: PLACEHOLDER - Full implementation in Day 4
 *
 * TODO (Day 4 Implementation):
 * 1. Create actor profile tables:
 *    - workspace_actor_profiles (unified profiles with expertise domains)
 *    - workspace_actor_identities (cross-platform identity mapping)
 *
 * 2. Implement three-tier resolution:
 *    - Tier 1 (confidence 1.0): OAuth connection match
 *      - Match sourceEvent.actor.id to user-sources.providerAccountId
 *      - Return linked Clerk user ID
 *
 *    - Tier 2 (confidence 0.85): Email matching
 *      - Match sourceEvent.actor.email to workspace member emails via Clerk API
 *      - Return matched Clerk user ID
 *
 *    - Tier 3 (confidence 0.60): Heuristic matching
 *      - Match by username similarity, display name
 *      - Return best-guess Clerk user ID with low confidence
 *
 * 3. Update observation-capture.ts to call resolveActor()
 *
 * 4. Fire profile update events for actor activity tracking
 *
 * Current behavior: Passthrough - returns source actor as-is
 */

export interface ResolvedActor {
  /** Original actor from source event */
  sourceActor: SourceActor | null;
  /** Resolved workspace user ID (Clerk user ID) - null if unresolved */
  resolvedUserId: string | null;
  /** Resolution confidence: 1.0 (OAuth), 0.85 (email), 0.60 (heuristic), 0 (unresolved) */
  confidence: number;
  /** Resolution method used */
  method: "oauth" | "email" | "heuristic" | "unresolved";
}

/**
 * Resolve source actor to workspace user.
 *
 * PLACEHOLDER: Returns passthrough until Day 4 implementation.
 */
export async function resolveActor(
  _workspaceId: string,
  sourceEvent: SourceEvent
): Promise<ResolvedActor> {
  // TODO (Day 4): Implement three-tier resolution
  // For now, passthrough source actor
  return {
    sourceActor: sourceEvent.actor || null,
    resolvedUserId: null,
    confidence: 0,
    method: "unresolved",
  };
}
```

#### 2. Add Note in Observation Capture
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Location**: Near actor storage in `store-observation` step (around line 363)

Add comment above actor field:
```typescript
// TODO (Day 4): Replace passthrough with resolveActor() call
// See: api/console/src/inngest/workflow/neural/actor-resolution.ts
actor: sourceEvent.actor || null,
```

### Success Criteria:

#### Automated Verification:
- [x] New file exists: `api/console/src/inngest/workflow/neural/actor-resolution.ts`
- [x] Typecheck passes: `pnpm --filter @api/console typecheck`

#### Manual Verification:
- [ ] Placeholder file has comprehensive TODO documentation for Day 4

---

## Testing Strategy

### Unit Tests (Future):
- Test `scoreSignificance()` with various event types
- Test `classifyObservation()` with edge cases

### Integration Tests:
- Trigger webhook → verify full pipeline completes
- Verify significance score stored in database
- Verify topics include semantic categories

### Manual Testing Steps:
1. Start dev server: `pnpm dev:console`
2. Use ngrok URL to receive GitHub webhooks
3. Create a test PR or push to trigger webhook
4. Check Inngest dashboard for workflow execution
5. Query database to verify `significanceScore` and `topics` populated

---

## Performance Considerations

### No LLM Latency:
- Rule-based scoring: <1ms
- Regex classification: <1ms
- No additional latency to pipeline

### Future LLM Migration:
- When migrating to LLM-based approach, expect ~200-500ms per call
- May want to add as separate Inngest steps for better observability
- Consider batching or async processing for high-volume workspaces

---

## Migration Notes

No database migrations required - `significanceScore` field already exists.

---

## References

- Research doc: `thoughts/shared/research/2025-12-11-neural-memory-implementation-infrastructure-map.md`
- E2E design: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
- LLM patterns (for future): `packages/cms-workflows/src/workflows/blog.ts:176-186`
- Observation schema: `db/console/src/schema/tables/workspace-neural-observations.ts:46-197`
- Workflow file: `api/console/src/inngest/workflow/neural/observation-capture.ts:152-407`
