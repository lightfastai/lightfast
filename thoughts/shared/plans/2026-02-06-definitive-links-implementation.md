# Definitive Links: Strict Cross-Source Relationship Graph

## Overview

Promote Linear and Sentry transformers from mock (`console-test-data`) to production (`console-webhooks`), add Vercel PR extraction, and enforce strict relationship type assignment in the detection engine so that edges match the definitive linking diagram from the research document.

## Current State Analysis

### What Works
- Relationship graph schema, detection engine, and APIs (`/v1/graph`, `/v1/related`) are implemented
- GitHub and Vercel have production webhook handlers + transformers
- Linear and Sentry have mock transformers with correct definitive link extraction:
  - Linear: `attachments.nodes[]` for GitHub PR (`tracked_in`) and Sentry issue (`linked`)
  - Sentry: `statusDetails.inCommit` for commit resolution (`resolved_by`)
- Relationship detection handles commit SHA, branch name, issue ID, and PR number matching

### What's Wrong
1. **Transformers not in production package** — Linear/Sentry transformers are in `console-test-data`, not `console-webhooks`
2. **SourceType enum missing entries** — `"linear"` and `"sentry"` not in `sourceTypeSchema`
3. **`determineCommitRelationType` is imprecise** — Treats ANY sentry source as `resolves` instead of checking the `resolved_by` label on the commit reference
4. **No cross-source issue reference matching** — Linear's Sentry attachment (`label: "linked"`) creates an issue reference, but detection only uses ILIKE on title/sourceId, not JSONB reference containment for issue IDs
5. **Missing Vercel → PR reference** — Vercel webhook `meta` doesn't include `githubPrId` (confirmed by docs), but the commit ref often follows PR patterns; alternatively, we can match through commit SHA which already provides the link
6. **No `resolves` detection for labeled commit refs** — When Sentry provides a commit with `label: "resolved_by"`, this explicit signal should produce a `resolves` edge with confidence 1.0 and `detectionMethod: "explicit"`, not the generic `commit_match`
7. **No `triggers` relationship detection** — The research defines `triggers` (Sentry error → Linear issue) but no code creates it

### Key Discoveries
- Vercel REST API has `gitSource.prId` but webhook payloads do not expose `githubPrId` in `meta`
- The commit SHA link between Vercel and GitHub already provides 1.0 confidence; PR link would be additive but not critical
- Linear `branchName` matches GitHub `head.ref` for `same_branch` (0.9 confidence) — already works
- The `extractLinkedIssues()` in GitHub transformer correctly parses `Fixes LIN-892` and `Resolves Sentry CHECKOUT-123` patterns

## Desired End State

After implementation:

1. `sourceTypeSchema` includes `"linear"` and `"sentry"`
2. Linear and Sentry transformers live in `packages/console-webhooks/src/transformers/`
3. Vercel transformer extracts PR reference when available via undocumented `meta.githubPrId` field (best-effort)
4. Relationship detection strictly assigns types per the definitive links research:
   - **`same_commit` (1.0)** — Two observations sharing a commit SHA, same source platform (e.g., GitHub push ↔ GitHub PR)
   - **`deploys` (1.0)** — Vercel deployment ↔ GitHub commit (via `meta.githubCommitSha`)
   - **`resolves` (1.0, explicit)** — Sentry issue → GitHub commit (only when Sentry `statusDetails.inCommit` provides the commit, detected via `label: "resolved_by"`)
   - **`fixes` (1.0, explicit)** — GitHub PR → issue (via `extractLinkedIssues` with `Fixes/Closes/Resolves`)
   - **`tracked_in` (1.0, explicit)** — Linear issue → GitHub PR (via `attachments.sourceType === "githubPr"`)
   - **`references` (0.8)** — Generic issue co-occurrence (ILIKE or JSONB match without explicit label)
   - **`same_branch` (0.9)** — Shared branch name across sources
   - **`triggers` (0.8)** — Sentry issue → Linear issue (via Linear `attachments.sourceType === "sentryIssue"`)
5. All edges stored with correct `detectionMethod`: `explicit`, `commit_match`, `branch_match`, `pr_match`, `entity_cooccurrence`

### Verification
- TypeScript compiles: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Build succeeds: `pnpm build:console`
- Inject demo data → relationships created with correct types matching the graph diagram
- No `resolves` edges from generic commit matching — only from explicit `resolved_by` labels

## What We're NOT Doing

- Production webhook route handlers for Linear/Sentry (no signature verification, OAuth, workspace resolution routes)
- Vercel REST API call to fetch `gitSource.prId` (too much complexity for minimal gain over commit SHA)
- Reverse relationship reconciliation (out-of-order webhook delivery)
- Branch name normalization (stripping `feat/` prefixes)
- GIN indexes for JSONB containment queries
- UI changes

## Implementation Approach

3 phases:
1. **Transformer Promotion** — Move Linear/Sentry to `console-webhooks`, add SourceType entries
2. **Vercel PR Gap** — Extract `githubPrId` from Vercel meta (best-effort)
3. **Strict Relationship Detection** — Rewrite `determineCommitRelationType` and add new detection methods for the full graph

---

## Phase 1: Transformer Promotion

### Overview
Move Linear and Sentry transformers from `console-test-data` to `console-webhooks` and register the source types.

### Changes Required:

#### 1.1 Add `linear` and `sentry` to SourceType
**File**: `packages/console-validation/src/schemas/sources.ts`
**Changes**: Add new source types to the enum

```typescript
export const sourceTypeSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
  "linear",      // ✅ Transformer ready
  "sentry",      // ✅ Transformer ready
]);
```

#### 1.2 Create Linear transformer in console-webhooks
**File**: `packages/console-webhooks/src/transformers/linear.ts` (new file)
**Changes**: Copy `packages/console-test-data/src/transformers/linear.ts` to production package

The file should be copied as-is with these adjustments:
- Change `source: "linear"` — already correct
- Add `validateSourceEvent()` call (matching GitHub/Vercel pattern)
- Add `sanitizeTitle()` and `sanitizeBody()` calls
- Import from `../validation.js` and `../sanitize.js`

#### 1.3 Create Sentry transformer in console-webhooks
**File**: `packages/console-webhooks/src/transformers/sentry.ts` (new file)
**Changes**: Copy `packages/console-test-data/src/transformers/sentry.ts` to production package

Same adjustments as Linear:
- Add `validateSourceEvent()` call
- Add `sanitizeTitle()` and `sanitizeBody()` calls

#### 1.4 Create Linear webhook types
**File**: `packages/console-webhooks/src/linear.ts` (new file)
**Changes**: Export the Linear webhook types (interfaces only, not the full data types which stay in the transformer file)

Re-export the types from the transformer file for consistency with the github.ts/vercel.ts pattern.

#### 1.5 Create Sentry webhook types
**File**: `packages/console-webhooks/src/sentry.ts` (new file)
**Changes**: Export the Sentry webhook types

#### 1.6 Export from package index
**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Add exports for linear and sentry transformers

```typescript
export * from "./transformers/linear.js";
export * from "./transformers/sentry.js";
export * from "./linear.js";
export * from "./sentry.js";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Build succeeds: `pnpm --filter @repo/console-webhooks build`

#### Manual Verification:
- [ ] `@repo/console-webhooks` exports `linearTransformers` and `sentryTransformers`
- [ ] `sourceTypeSchema.parse("linear")` and `sourceTypeSchema.parse("sentry")` succeed
- [ ] Existing GitHub/Vercel transformers unaffected

**Implementation Note**: After this phase, verify that adding "linear" and "sentry" to `sourceTypeSchema` doesn't break existing validation anywhere. The observation capture workflow uses this schema — ensure `source: "linear"` events pass validation.

---

## Phase 2: Vercel PR Reference (Best-Effort)

### Overview
Add PR reference extraction to the Vercel transformer. Vercel's webhook `meta` object is loosely typed — while `githubPrId` is not officially documented, it may be present in practice. We'll extract it best-effort.

### Changes Required:

#### 2.1 Extend Vercel meta type
**File**: `packages/console-webhooks/src/vercel.ts`
**Changes**: Add `githubPrId` to the meta type (optional)

At line 147, add to the `meta` interface:
```typescript
meta?: {
  // ... existing fields ...
  githubPrId?: string;  // PR number (undocumented but may be present)
};
```

#### 2.2 Extract PR reference in transformer
**File**: `packages/console-webhooks/src/transformers/vercel.ts`
**Changes**: After the branch reference extraction (line 56), add PR extraction

```typescript
// Add PR reference (best-effort - githubPrId may not always be present)
if (gitMeta?.githubPrId && gitMeta?.githubOrg && gitMeta?.githubRepo) {
  refs.push({
    type: "pr",
    id: `#${gitMeta.githubPrId}`,
    url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/pull/${gitMeta.githubPrId}`,
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Build succeeds: `pnpm --filter @repo/console-webhooks build`

#### Manual Verification:
- [ ] Vercel transformer extracts PR reference when `githubPrId` is present in meta
- [ ] Vercel transformer works correctly when `githubPrId` is absent (no regression)

---

## Phase 3: Strict Relationship Detection

### Overview
Rewrite the relationship detection engine to strictly follow the definitive links graph. Each relationship type must be assigned based on precise criteria, not generic source-pair heuristics.

### Changes Required:

#### 3.1 Rewrite `determineCommitRelationType`
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: Replace the current `determineCommitRelationType` with label-aware logic

Current (lines 371-384):
```typescript
function determineCommitRelationType(
  sourceType: string,
  targetType: string
): RelationshipType {
  if (sourceType === "vercel" && targetType === "github") return "deploys";
  if (sourceType === "github" && targetType === "vercel") return "deploys";
  if (sourceType === "sentry" || targetType === "sentry") return "resolves";
  return "same_commit";
}
```

New — pass the commit reference to determine if this is an explicit resolution:
```typescript
function determineCommitRelationType(
  newSource: string,
  matchSource: string,
  commitRef: SourceReference | undefined
): RelationshipType {
  // Explicit Sentry → commit resolution (statusDetails.inCommit)
  // Only when the new observation is Sentry AND the commit ref has "resolved_by" label
  if (newSource === "sentry" && commitRef?.label === "resolved_by") {
    return "resolves";
  }
  // Or when the matched observation is Sentry with resolved_by
  if (matchSource === "sentry" && commitRef?.label === "resolved_by") {
    return "resolves";
  }

  // Vercel ↔ GitHub commit = deploys
  if (
    (newSource === "vercel" && matchSource === "github") ||
    (newSource === "github" && matchSource === "vercel")
  ) {
    return "deploys";
  }

  // Default: same commit SHA across any sources
  return "same_commit";
}
```

#### 3.2 Update commit matching to pass reference context
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: In the commit SHA matching section (lines 70-94), pass the original commit reference to `determineCommitRelationType`

```typescript
// 1. Find observations with matching commit SHAs
if (commitShas.length > 0) {
  const commitMatches = await findObservationsByReference(
    workspaceId,
    observationId,
    "commit",
    commitShas
  );

  for (const match of commitMatches) {
    // Find the original commit reference that linked to this match
    const commitRef = references.find(
      (r) => r.type === "commit" && r.id === match.linkingKey
    );

    const relType = determineCommitRelationType(
      sourceEvent.source,
      match.source,
      commitRef
    );

    // Explicit resolution gets "explicit" detection method
    const detectionMethod = commitRef?.label === "resolved_by" ? "explicit" : "commit_match";

    detectedRelationships.push({
      targetObservationId: match.id,
      relationshipType: relType,
      linkingKey: match.linkingKey,
      linkingKeyType: "commit",
      confidence: 1.0,
      metadata: { detectionMethod },
    });
  }
}
```

#### 3.3 Add `triggers` relationship detection for Linear ↔ Sentry
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: After PR matching (section 4, lines 170-189), add a new section for detecting `triggers` relationships

Linear issues with `attachments.sourceType === "sentryIssue"` produce issue references with `label: "linked"`. When a Linear observation has an issue reference with label `"linked"`, it should create a `triggers` relationship to any Sentry observation with that issue ID.

```typescript
// 5. Detect "triggers" relationships (Sentry → Linear via attachments)
// When a Linear issue has a Sentry attachment, it means the Sentry issue triggered the Linear work
const linkedSentryIssues = references
  .filter(
    (r) =>
      r.type === "issue" &&
      r.label === "linked" &&
      sourceEvent.source === "linear"
  )
  .map((r) => r.id);

if (linkedSentryIssues.length > 0) {
  // Find Sentry observations matching these issue IDs
  const sentryMatches = await findObservationsByReference(
    workspaceId,
    observationId,
    "issue",
    linkedSentryIssues
  );

  // Also check by title/sourceId for Sentry observations
  const sentryTitleMatches = await findObservationsByIssueId(
    workspaceId,
    observationId,
    linkedSentryIssues
  );

  // Combine and deduplicate
  const allSentryMatches = new Map<number, { id: number; linkingKey: string }>();
  for (const m of [...sentryMatches, ...sentryTitleMatches]) {
    if (!allSentryMatches.has(m.id)) {
      allSentryMatches.set(m.id, { id: m.id, linkingKey: m.linkingKey });
    }
  }

  for (const match of allSentryMatches.values()) {
    detectedRelationships.push({
      targetObservationId: match.id,
      relationshipType: "triggers",
      linkingKey: match.linkingKey,
      linkingKeyType: "issue",
      confidence: 0.8,
      metadata: { detectionMethod: "explicit" },
    });
  }
}
```

#### 3.4 Add `pr_match` detection method to metadata type
**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts`
**Changes**: Add `pr_match` to the `RelationshipMetadata` interface

```typescript
export interface RelationshipMetadata {
  detectionMethod?:
    | "explicit"
    | "commit_match"
    | "branch_match"
    | "pr_match"
    | "entity_cooccurrence";
  context?: string;
}
```

#### 3.5 Update PR matching detection method
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: In section 4 (PR matching, lines 170-189), change detection method from `"explicit"` to `"pr_match"` for clarity

```typescript
for (const match of prMatches) {
  detectedRelationships.push({
    targetObservationId: match.id,
    relationshipType: "tracked_in",
    linkingKey: match.linkingKey,
    linkingKeyType: "pr",
    confidence: 1.0,
    metadata: { detectionMethod: "pr_match" },
  });
}
```

#### 3.6 Add JSONB reference matching for issue IDs
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
**Changes**: Enhance `findObservationsByIssueId` to also search `sourceReferences` JSONB in addition to title/sourceId

Currently, issue matching only uses ILIKE on title/sourceId. This misses observations that have the issue ID in their `sourceReferences` array (e.g., a Sentry observation with `{ type: "issue", id: "CHECKOUT-123" }`). Add JSONB containment as an additional condition:

```typescript
async function findObservationsByIssueId(
  workspaceId: string,
  excludeId: number,
  issueIds: string[]
): Promise<{ id: number; linkingKey: string }[]> {
  if (issueIds.length === 0) return [];

  // JSONB containment conditions for issue references
  const jsonbConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "issue", id }])}::jsonb`
  );

  // Title/sourceId ILIKE conditions
  const titleConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.title} ILIKE ${"%" + id + "%"}`
  );
  const sourceIdConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceId} ILIKE ${"%" + id + "%"}`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      sourceId: workspaceNeuralObservations.sourceId,
      sourceReferences: workspaceNeuralObservations.sourceReferences,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...jsonbConditions, ...titleConditions, ...sourceIdConditions)
      )
    )
    .limit(50);

  return results.map((r) => {
    // Check JSONB references first (higher quality match)
    const refs = (r.sourceReferences ?? []) as SourceReference[];
    const jsonbMatch = refs.find(
      (ref) => ref.type === "issue" && issueIds.includes(ref.id)
    );
    if (jsonbMatch) {
      return { id: r.id, linkingKey: jsonbMatch.id };
    }
    // Fall back to title/sourceId match
    const matchingId = issueIds.find(
      (id) => r.title.includes(id) || r.sourceId.includes(id)
    );
    return {
      id: r.id,
      linkingKey: matchingId ?? issueIds[0] ?? "",
    };
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Inject demo data with Sentry `statusDetails.inCommit` → observe `resolves` edges (not generic `same_commit`)
- [ ] Inject Linear issue with Sentry attachment → observe `triggers` edge
- [ ] Inject Linear issue with GitHub PR attachment → observe `tracked_in` edge
- [ ] Inject Vercel deployment with commit SHA matching GitHub push → observe `deploys` edge
- [ ] Inject GitHub PR with "Fixes #123" → observe `fixes` edge
- [ ] No Sentry `resolves` edges without explicit `resolved_by` label
- [ ] Graph API `/v1/graph/{id}` shows correct typed edges

---

## Strict Relationship Type Assignment Matrix

This is the authoritative reference for which relationship types should be assigned based on source pairs and linking mechanisms:

| Source | Target | Linking Key | Relationship | Confidence | Detection |
|--------|--------|-------------|-------------|------------|-----------|
| Vercel | GitHub | commit SHA | `deploys` | 1.0 | `commit_match` |
| GitHub (push) | GitHub (PR) | commit SHA | `same_commit` | 1.0 | `commit_match` |
| Sentry (resolved) | GitHub | commit SHA + `resolved_by` label | `resolves` | 1.0 | `explicit` |
| GitHub (PR) | GitHub/Linear issue | `Fixes #N` / `Fixes LIN-N` | `fixes` | 1.0 | `explicit` |
| Linear | GitHub (PR) | attachment `githubPr` | `tracked_in` | 1.0 | `pr_match` |
| Linear | Sentry | attachment `sentryIssue` | `triggers` | 0.8 | `explicit` |
| Any | Any | branch name | `same_branch` | 0.9 | `branch_match` |
| Any | Any | issue ID (no label) | `references` | 0.8 | `entity_cooccurrence` |

---

## Testing Strategy

### Integration Tests (via demo data injection):
1. Inject full demo-incident dataset
2. Verify relationship count matches expected edges
3. Verify each edge type appears with correct source/target pairs
4. Verify confidence scores match the matrix above
5. Verify `detectionMethod` metadata is set correctly

### Manual Testing Steps:
1. Reset workspace: `pnpm --filter @repo/console-test-data reset-demo -- -w <id> -i`
2. Wait for Inngest workflows to complete
3. Query `/v1/graph/{sentry_id}?depth=2` — verify Sentry → GitHub commit (resolves), not same_commit
4. Query `/v1/related/{linear_id}` — verify Linear → GitHub PR (tracked_in) + Linear → Sentry (triggers)
5. Query `/v1/graph/{pr_id}?depth=3` — verify full traversal: PR → issues (fixes) → Sentry → commit

## Performance Considerations

- Adding JSONB containment to `findObservationsByIssueId` adds one more OR condition per query
- The `triggers` detection adds a new database query per observation with linked Sentry issues (typically 0-1)
- Overall impact: negligible for demo-scale data; consider GIN index for production scale

## References

- Research: `thoughts/shared/research/2026-02-06-relationship-graph-definitive-links.md`
- Previous plan: `thoughts/shared/plans/2026-02-05-accelerator-demo-relationship-graph-implementation.md`
- GitHub transformer: `packages/console-webhooks/src/transformers/github.ts`
- Vercel transformer: `packages/console-webhooks/src/transformers/vercel.ts`
- Linear mock transformer: `packages/console-test-data/src/transformers/linear.ts`
- Sentry mock transformer: `packages/console-test-data/src/transformers/sentry.ts`
- Relationship detection: `api/console/src/inngest/workflow/neural/relationship-detection.ts`
- Relationship schema: `db/console/src/schema/tables/workspace-observation-relationships.ts`
