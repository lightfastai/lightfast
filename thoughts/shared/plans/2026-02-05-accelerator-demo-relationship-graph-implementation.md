# Accelerator Demo: True Relationship Graph Implementation Plan

## Overview

This plan implements a **true relationship graph** for cross-source intelligence in the accelerator demo. Rather than relying on ad-hoc JSONB containment queries, we build a proper `observation_relationships` table with materialized edges that enable bidirectional traversal, typed relationships, and graph queries.

The demo will showcase Lightfast's core value proposition: **one search query that connects Sentry errors → Linear issues → GitHub PRs → Vercel deployments** with explicit relationship visualization.

## Current State Analysis

### What Exists Now
- **sourceReferences JSONB column** at `db/console/src/schema/tables/workspace-neural-observations.ts:159` stores outgoing references
- **Transformers** extract references from webhooks:
  - GitHub: commits, branches, PRs, issues, assignees, reviewers, labels (`packages/console-webhooks/src/transformers/github.ts`)
  - Vercel: commit SHA, branch, deployment, project (`packages/console-webhooks/src/transformers/vercel.ts`)
  - Linear: issues, teams, projects, cycles, branches (`packages/console-test-data/src/transformers/linear.ts`)
  - Sentry: issues, projects (`packages/console-test-data/src/transformers/sentry.ts`)
- **Single JSONB query** for actor resolution via commit SHA at `api/console/src/inngest/workflow/neural/observation-capture.ts:257-269`
- **Demo dataset** with 17 cross-linked events at `packages/console-test-data/datasets/demo-incident.json`

### Key Gaps
1. **No bidirectional edges** - can't query "what observations reference this commit?"
2. **No typed relationships** - just "references", not "fixes", "triggers", "deploys"
3. **No graph traversal** - can't walk Sentry → Linear → GitHub → Vercel
4. **Missing webhook fields** in mocks:
   - Sentry: `statusDetails.inCommit` for commit linkage
   - Linear: `attachments` for GitHub PR links
5. **No relationship API** - `/v1/graph` or `/v1/related` endpoints don't exist

### Key Discoveries
- Cross-source linking keys: commit SHA (`merge478sha456`), PR number (`#478`), branch name (`fix/checkout-null-price`), issue IDs (`LIN-892`, `#500`, `CHECKOUT-123`)
- GitHub PR body explicitly references: `Fixes #500`, `Fixes LIN-892`, `Resolves Sentry CHECKOUT-123`
- Vercel deployment contains `meta.githubCommitSha` matching GitHub merge commit
- Actor resolution already uses JSONB `@>` operator for cross-source queries

## Desired End State

After this plan is complete:

1. **Relationship Table**: `lightfast_workspace_observation_relationships` with typed edges between observations
2. **Relationship Extraction**: Observation capture workflow creates edges during ingestion
3. **Graph Query API**: `/v1/graph/{id}` endpoint for traversing relationships
4. **Enhanced Search**: Search results include `references` array showing cross-source links
5. **Related Events API**: `/v1/related/{id}` finds linked observations via graph traversal
6. **Updated Demo Data**: Sentry/Linear mocks include missing cross-reference fields
7. **Demo Reset Script**: Single command resets workspace and injects demo data

### Verification Criteria
- Search for "checkout TypeError" returns results from all 4 sources with visible relationships
- Graph API shows: Sentry CHECKOUT-123 → LIN-892 → PR #478 → Vercel deployment
- Timeline query returns chronological incident flow with relationship context
- Demo can be run end-to-end in under 5 minutes of setup

## What We're NOT Doing

- Production Sentry/Linear OAuth integrations (mock transformers sufficient)
- Real webhook endpoints for Sentry/Linear (using test data injection)
- Complex graph algorithms (simple BFS traversal is sufficient)
- Performance optimizations beyond demo needs (GIN indexes deferred)
- Custom demo UI (using existing console search)
- Full production testing (demo-focused verification)

## Implementation Approach

The plan has **6 phases**:
1. **Database Schema** - Create relationship table with proper indexes
2. **Relationship Extraction** - Modify observation capture to create edges
3. **Demo Data Updates** - Add missing webhook fields to mocks
4. **Search API Enhancement** - Return references in V1 results
5. **Graph & Related APIs** - New endpoints for relationship traversal
6. **Demo Environment & Script** - Reset script and documented demo flow

---

## Phase 1: Database Schema

### Overview
Create the `observation_relationships` table to store typed, bidirectional edges between observations.

### Changes Required:

#### 1.1 Create Relationship Schema
**File**: `db/console/src/schema/tables/observation-relationships.ts` (new file)

```typescript
/**
 * Observation Relationships
 *
 * Stores typed edges between observations for relationship graph traversal.
 * Edges are created during observation capture based on shared linking keys
 * (commit SHAs, issue IDs, branch names).
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Relationship types between observations
 */
export type RelationshipType =
  | "fixes"        // PR/commit fixes an issue
  | "resolves"     // Commit resolves a Sentry issue
  | "triggers"     // Sentry error triggers Linear issue
  | "deploys"      // Vercel deployment deploys a commit
  | "references"   // Generic reference link
  | "same_commit"  // Two observations about the same commit
  | "same_branch"  // Two observations about the same branch
  | "tracked_in";  // GitHub PR tracked in Linear via attachment

/**
 * Relationship metadata
 */
export interface RelationshipMetadata {
  /** How the relationship was detected */
  detectionMethod?: "explicit" | "commit_match" | "branch_match" | "entity_cooccurrence";
  /** Additional context about the relationship */
  context?: string;
}

/**
 * Observation relationships - edges in the relationship graph
 */
export const observationRelationships = pgTable(
  "lightfast_observation_relationships",
  {
    /**
     * Internal BIGINT primary key
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this relationship belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Source observation (edge start)
     */
    sourceObservationId: bigint("source_observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    /**
     * Target observation (edge end)
     */
    targetObservationId: bigint("target_observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    /**
     * Type of relationship
     */
    relationshipType: varchar("relationship_type", { length: 50 })
      .notNull()
      .$type<RelationshipType>(),

    /**
     * The shared reference key that created this relationship
     * e.g., commit SHA, issue ID, branch name
     */
    linkingKey: varchar("linking_key", { length: 500 }),

    /**
     * Type of the linking key
     */
    linkingKeyType: varchar("linking_key_type", { length: 50 }),

    /**
     * Confidence score (1.0 = explicit, 0.7-0.9 = inferred)
     */
    confidence: real("confidence").default(1.0).notNull(),

    /**
     * Additional metadata
     */
    metadata: jsonb("metadata").$type<RelationshipMetadata>(),

    /**
     * When the relationship was created
     */
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // External ID lookup
    externalIdIdx: uniqueIndex("rel_external_id_idx").on(table.externalId),

    // Forward traversal: source → targets
    sourceIdx: index("rel_source_idx").on(
      table.workspaceId,
      table.sourceObservationId,
    ),

    // Reverse traversal: target → sources
    targetIdx: index("rel_target_idx").on(
      table.workspaceId,
      table.targetObservationId,
    ),

    // Find relationships by linking key
    linkingKeyIdx: index("rel_linking_key_idx").on(
      table.workspaceId,
      table.linkingKey,
    ),

    // Unique constraint on edges
    uniqueEdgeIdx: uniqueIndex("rel_unique_edge_idx").on(
      table.workspaceId,
      table.sourceObservationId,
      table.targetObservationId,
      table.relationshipType,
    ),
  }),
);

// Type exports
export type ObservationRelationship = typeof observationRelationships.$inferSelect;
export type InsertObservationRelationship = typeof observationRelationships.$inferInsert;
```

#### 1.2 Export from Schema Index
**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Add export for new table

```typescript
// Add with other exports
export * from "./observation-relationships";
```

#### 1.3 Add to Relations
**File**: `db/console/src/schema/relations.ts`
**Changes**: Add relations for the new table (after workspaceNeuralObservations relations)

```typescript
import { observationRelationships } from "./tables/observation-relationships";

// Add after existing relations
export const observationRelationshipsRelations = relations(
  observationRelationships,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [observationRelationships.workspaceId],
      references: [orgWorkspaces.id],
    }),
    sourceObservation: one(workspaceNeuralObservations, {
      fields: [observationRelationships.sourceObservationId],
      references: [workspaceNeuralObservations.id],
    }),
    targetObservation: one(workspaceNeuralObservations, {
      fields: [observationRelationships.targetObservationId],
      references: [workspaceNeuralObservations.id],
    }),
  }),
);
```

#### 1.4 Generate Migration
**Command**: Run from `db/console/` directory

```bash
pnpm db:generate
```

### Success Criteria:

#### Automated Verification:
- [x] Migration generates successfully: `pnpm db:generate`
- [x] TypeScript compiles: `pnpm --filter @db/console typecheck`
- [x] Migration applies: `pnpm db:migrate`

#### Manual Verification:
- [ ] Table exists in database with correct columns
- [ ] Indexes created for bidirectional traversal
- [ ] Drizzle Studio shows the new table: `pnpm db:studio`

**Implementation Note**: After completing this phase and verifying the migration applies cleanly, proceed to Phase 2.

---

## Phase 2: Relationship Extraction

### Overview
Modify the observation capture workflow to create relationship edges during ingestion.

### Changes Required:

#### 2.1 Create Relationship Detection Module
**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts` (new file)

```typescript
/**
 * Relationship Detection
 *
 * Detects and creates relationships between observations based on:
 * 1. Explicit references (PR body contains "Fixes #123")
 * 2. Commit SHA matching (GitHub push → Vercel deployment)
 * 3. Branch name matching (Linear issue → GitHub PR)
 * 4. Issue ID co-occurrence (same issue mentioned in multiple observations)
 */

import { db, eq, and, or, sql } from "@db/console/client";
import {
  workspaceNeuralObservations,
  observationRelationships,
} from "@db/console/schema";
import type { InsertObservationRelationship, RelationshipType } from "@db/console/schema";
import type { SourceReference, SourceEvent } from "@repo/console-types";
import { log } from "@vendor/observability/log";
import { nanoid } from "nanoid";

/**
 * Detected relationship before database insertion
 */
interface DetectedRelationship {
  targetObservationId: bigint;
  relationshipType: RelationshipType;
  linkingKey: string;
  linkingKeyType: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Detect relationships for a new observation
 *
 * @param workspaceId - Workspace ID
 * @param observationId - Internal ID of the new observation
 * @param sourceEvent - The source event that created this observation
 * @returns Number of relationships created
 */
export async function detectAndCreateRelationships(
  workspaceId: string,
  observationId: bigint,
  sourceEvent: SourceEvent
): Promise<number> {
  const references = (sourceEvent.references || []) as SourceReference[];
  if (references.length === 0) return 0;

  const detectedRelationships: DetectedRelationship[] = [];

  // Extract linking keys from references
  const commitShas = references
    .filter((r) => r.type === "commit")
    .map((r) => r.id);
  const branchNames = references
    .filter((r) => r.type === "branch")
    .map((r) => r.id);
  const issueIds = references
    .filter((r) => r.type === "issue")
    .map((r) => r.id);
  const prIds = references
    .filter((r) => r.type === "pr")
    .map((r) => r.id);

  // 1. Find observations with matching commit SHAs
  if (commitShas.length > 0) {
    const commitMatches = await findObservationsByReference(
      workspaceId,
      observationId,
      "commit",
      commitShas
    );

    for (const match of commitMatches) {
      // Determine relationship type based on sources
      const relType = determineCommitRelationType(
        sourceEvent.source,
        match.source
      );

      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: relType,
        linkingKey: match.linkingKey,
        linkingKeyType: "commit",
        confidence: 1.0,
        metadata: { detectionMethod: "commit_match" },
      });
    }
  }

  // 2. Find observations with matching branch names
  if (branchNames.length > 0) {
    const branchMatches = await findObservationsByReference(
      workspaceId,
      observationId,
      "branch",
      branchNames
    );

    for (const match of branchMatches) {
      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: "same_branch",
        linkingKey: match.linkingKey,
        linkingKeyType: "branch",
        confidence: 0.9,
        metadata: { detectionMethod: "branch_match" },
      });
    }
  }

  // 3. Find observations with matching issue IDs (explicit "fixes" relationships)
  if (issueIds.length > 0) {
    // Check if this is a PR with explicit "fixes" labels
    const fixesIssues = references
      .filter((r) => r.type === "issue" && r.label && ["fixes", "closes", "resolves"].includes(r.label.toLowerCase()))
      .map((r) => r.id);

    if (fixesIssues.length > 0) {
      const issueMatches = await findObservationsByIssueId(
        workspaceId,
        observationId,
        fixesIssues
      );

      for (const match of issueMatches) {
        detectedRelationships.push({
          targetObservationId: match.id,
          relationshipType: "fixes",
          linkingKey: match.linkingKey,
          linkingKeyType: "issue",
          confidence: 1.0,
          metadata: { detectionMethod: "explicit" },
        });
      }
    }

    // Also create generic reference relationships for other issue mentions
    const otherIssues = issueIds.filter((id) => !fixesIssues.includes(id));
    if (otherIssues.length > 0) {
      const issueMatches = await findObservationsByIssueId(
        workspaceId,
        observationId,
        otherIssues
      );

      for (const match of issueMatches) {
        detectedRelationships.push({
          targetObservationId: match.id,
          relationshipType: "references",
          linkingKey: match.linkingKey,
          linkingKeyType: "issue",
          confidence: 0.8,
          metadata: { detectionMethod: "entity_cooccurrence" },
        });
      }
    }
  }

  // Deduplicate relationships (prefer higher confidence for same target)
  const deduped = deduplicateRelationships(detectedRelationships);

  // Insert relationships
  if (deduped.length === 0) return 0;

  const inserts: InsertObservationRelationship[] = deduped.map((rel) => ({
    externalId: nanoid(),
    workspaceId,
    sourceObservationId: observationId,
    targetObservationId: rel.targetObservationId,
    relationshipType: rel.relationshipType,
    linkingKey: rel.linkingKey,
    linkingKeyType: rel.linkingKeyType,
    confidence: rel.confidence,
    metadata: rel.metadata,
  }));

  try {
    await db
      .insert(observationRelationships)
      .values(inserts)
      .onConflictDoNothing(); // Ignore duplicates

    log.info("Created observation relationships", {
      workspaceId,
      observationId: observationId.toString(),
      count: inserts.length,
      types: [...new Set(inserts.map((i) => i.relationshipType))],
    });

    return inserts.length;
  } catch (error) {
    log.error("Failed to create relationships", { error, workspaceId });
    return 0;
  }
}

/**
 * Find observations with matching reference type and IDs
 */
async function findObservationsByReference(
  workspaceId: string,
  excludeId: bigint,
  refType: string,
  refIds: string[]
): Promise<Array<{ id: bigint; source: string; linkingKey: string }>> {
  if (refIds.length === 0) return [];

  // Build JSONB containment conditions for each ref ID
  const conditions = refIds.map(
    (id) => sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: refType, id }])}::jsonb`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      source: workspaceNeuralObservations.source,
      sourceReferences: workspaceNeuralObservations.sourceReferences,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...conditions)
      )
    )
    .limit(50);

  // Extract matching linking keys
  return results.map((r) => {
    const refs = (r.sourceReferences as SourceReference[]) || [];
    const matchingRef = refs.find(
      (ref) => ref.type === refType && refIds.includes(ref.id)
    );
    return {
      id: BigInt(r.id),
      source: r.source,
      linkingKey: matchingRef?.id || refIds[0],
    };
  });
}

/**
 * Find observations that mention specific issue IDs in title or sourceId
 */
async function findObservationsByIssueId(
  workspaceId: string,
  excludeId: bigint,
  issueIds: string[]
): Promise<Array<{ id: bigint; linkingKey: string }>> {
  if (issueIds.length === 0) return [];

  // Build conditions for title/sourceId matching
  const titleConditions = issueIds.map(
    (id) => sql`${workspaceNeuralObservations.title} ILIKE ${"%" + id + "%"}`
  );
  const sourceIdConditions = issueIds.map(
    (id) => sql`${workspaceNeuralObservations.sourceId} ILIKE ${"%" + id + "%"}`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      sourceId: workspaceNeuralObservations.sourceId,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...titleConditions, ...sourceIdConditions)
      )
    )
    .limit(50);

  // Find which issue ID matched
  return results.map((r) => {
    const matchingId = issueIds.find(
      (id) =>
        r.title?.includes(id) || r.sourceId?.includes(id)
    );
    return {
      id: BigInt(r.id),
      linkingKey: matchingId || issueIds[0],
    };
  });
}

/**
 * Determine relationship type based on source types
 */
function determineCommitRelationType(
  sourceType: string,
  targetType: string
): RelationshipType {
  // Vercel deployment deploys a commit
  if (sourceType === "vercel" && targetType === "github") return "deploys";
  if (sourceType === "github" && targetType === "vercel") return "deploys";

  // Sentry resolved by commit
  if (sourceType === "sentry" || targetType === "sentry") return "resolves";

  // Default to same_commit for GitHub-to-GitHub
  return "same_commit";
}

/**
 * Deduplicate relationships, keeping highest confidence for each target
 */
function deduplicateRelationships(
  relationships: DetectedRelationship[]
): DetectedRelationship[] {
  const byTarget = new Map<string, DetectedRelationship>();

  for (const rel of relationships) {
    const key = `${rel.targetObservationId}-${rel.relationshipType}`;
    const existing = byTarget.get(key);

    if (!existing || rel.confidence > existing.confidence) {
      byTarget.set(key, rel);
    }
  }

  return Array.from(byTarget.values());
}
```

#### 2.2 Integrate into Observation Capture Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Call relationship detection after observation insertion

Find the observation storage section (around line 946) and add relationship detection after the transaction:

```typescript
// Add import at top of file
import { detectAndCreateRelationships } from "./relationship-detection";

// After observation insertion (around line 1000, after the returning statement)
// Add a new step for relationship detection:

// Detect and create relationships
const relationshipsCreated = await step.run(
  "detect-relationships",
  async () => {
    return detectAndCreateRelationships(
      workspaceId,
      BigInt(observation.id),
      sourceEvent
    );
  }
);

log.info("Observation capture complete", {
  observationId: observation.externalId,
  relationshipsCreated,
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (no new errors in relationship-detection.ts)
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Inject a demo event and verify relationship rows created
- [ ] Check Inngest dashboard shows "detect-relationships" step completing
- [ ] Query `lightfast_workspace_observation_relationships` table shows edges with correct types

**Implementation Note**: After completing this phase, verify relationships are being created by injecting a few test events. Proceed to Phase 3 once relationships appear in the database.

---

## Phase 3: Demo Data Updates

### Overview
Update `demo-incident.json` with missing webhook fields for accurate cross-source linking.

### Changes Required:

#### 3.1 Update Sentry issue.resolved Webhook
**File**: `packages/console-test-data/datasets/demo-incident.json`
**Changes**: Add `statusDetails` to the Sentry resolved event (webhook index 11, around line 623)

Find the `sentry` webhook with `eventType: "issue.resolved"` and update the `issue` object to include:

```json
{
  "source": "sentry",
  "eventType": "issue.resolved",
  "payload": {
    "action": "resolved",
    "data": {
      "issue": {
        "id": "4821593046",
        "shortId": "CHECKOUT-123",
        "title": "TypeError: price.toFixed is not a function",
        "status": "resolved",
        "statusDetails": {
          "inCommit": {
            "repository": "acme/platform",
            "commit": "merge478sha456"
          },
          "inRelease": "v2.4.2",
          "inNextRelease": false
        }
      }
    }
  }
}
```

#### 3.2 Update Linear Issue with Attachments
**File**: `packages/console-test-data/datasets/demo-incident.json`
**Changes**: Add `attachments` to the Linear issue update event (webhook index 12, around line 680)

Find the final `linear` webhook with `eventType: "Issue"` and `action: "update"` (state → Done) and add attachments to the `data` object:

```json
{
  "data": {
    "id": "issue_lin_892",
    "identifier": "LIN-892",
    "attachments": {
      "nodes": [
        {
          "id": "attachment_gh_pr_478",
          "title": "PR #478: fix: Handle null prices",
          "url": "https://github.com/acme/platform/pull/478",
          "source": "github",
          "sourceType": "githubPr",
          "metadata": {
            "state": "merged",
            "number": 478
          }
        },
        {
          "id": "attachment_sentry_checkout_123",
          "title": "CHECKOUT-123: TypeError: price.toFixed is not a function",
          "url": "https://sentry.io/organizations/acme/issues/4821593046/",
          "source": "sentry",
          "sourceType": "sentryIssue",
          "metadata": {
            "shortId": "CHECKOUT-123"
          }
        }
      ]
    }
  }
}
```

#### 3.3 Update Sentry Transformer to Extract statusDetails
**File**: `packages/console-test-data/src/transformers/sentry.ts`
**Changes**: Extract commit reference from `statusDetails.inCommit`

Find the `issue.resolved` handling (around line 228-250) and add:

```typescript
// In the transformSentryIssue function, after extracting issue reference:

// Extract commit from resolution (if resolved via commit)
const statusDetails = issue.statusDetails as {
  inCommit?: { repository?: string; commit?: string };
  inRelease?: string;
} | undefined;

if (statusDetails?.inCommit?.commit) {
  refs.push({
    type: "commit",
    id: statusDetails.inCommit.commit,
    url: statusDetails.inCommit.repository
      ? `https://github.com/${statusDetails.inCommit.repository}/commit/${statusDetails.inCommit.commit}`
      : undefined,
    label: "resolved_by",
  });
}
```

#### 3.4 Update Linear Transformer to Extract Attachments
**File**: `packages/console-test-data/src/transformers/linear.ts`
**Changes**: Extract GitHub PR and Sentry references from attachments

Find the Linear issue transformer and add attachment extraction (after line 372):

```typescript
// Extract references from attachments (GitHub PRs, Sentry issues, etc.)
const attachments = issue.attachments as {
  nodes?: Array<{
    id: string;
    title: string;
    url?: string;
    source?: string;
    sourceType?: string;
    metadata?: { number?: number; shortId?: string };
  }>;
} | undefined;

if (attachments?.nodes) {
  for (const attachment of attachments.nodes) {
    if (attachment.sourceType === "githubPr" && attachment.metadata?.number) {
      refs.push({
        type: "pr",
        id: `#${attachment.metadata.number}`,
        url: attachment.url,
        label: "tracked_in",
      });
    }
    if (attachment.sourceType === "sentryIssue" && attachment.metadata?.shortId) {
      refs.push({
        type: "issue",
        id: attachment.metadata.shortId,
        url: attachment.url,
        label: "linked",
      });
    }
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck` (pre-existing errors for sentry/linear source types not in production SourceType)
- [x] JSON is valid: parse `demo-incident.json` without errors
- [x] Linting passes: `pnpm --filter @repo/console-test-data lint` (no new errors from changes)

#### Manual Verification:
- [ ] Sentry resolved event contains `statusDetails.inCommit.commit`
- [ ] Linear done event contains `attachments.nodes` with GitHub PR
- [ ] Inject updated demo data and verify new references extracted

**Implementation Note**: After completing this phase, verify the transformers correctly extract the new fields by running a test injection.

---

## Phase 4: Search API Enhancement

### Overview
Enhance the V1 Search API to return `references` in results, enabling the UI to show cross-source links.

### Changes Required:

#### 4.1 Update V1SearchResult Schema
**File**: `packages/console-types/src/api/v1/search.ts`
**Changes**: Add `references` field to V1SearchResultSchema (after line 113)

```typescript
// Add SourceReferenceSchema before V1SearchResultSchema (around line 85)
export const SourceReferenceSchema = z.object({
  type: z.enum([
    "commit",
    "branch",
    "pr",
    "issue",
    "deployment",
    "project",
    "cycle",
    "assignee",
    "reviewer",
    "team",
    "label",
  ]),
  id: z.string(),
  url: z.string().optional(),
  label: z.string().optional(),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// Update V1SearchResultSchema to add references field after entities
export const V1SearchResultSchema = z.object({
  // ... existing fields ...
  entities: z
    .array(
      z.object({
        key: z.string(),
        category: z.string(),
      })
    )
    .optional(),
  /** Cross-source references extracted from this observation */
  references: z.array(SourceReferenceSchema).optional(),
  highlights: z
    .object({
      title: z.string().optional(),
      snippet: z.string().optional(),
    })
    .optional(),
});
```

#### 4.2 Update Four-Path Search Enrichment
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Fetch and include `sourceReferences` in enriched results

Find the `enrichSearchResults` function and update the select (around line 568-584):

```typescript
const observations = await db
  .select({
    id: workspaceNeuralObservations.id,
    externalId: workspaceNeuralObservations.externalId,
    title: workspaceNeuralObservations.title,
    source: workspaceNeuralObservations.source,
    observationType: workspaceNeuralObservations.observationType,
    occurredAt: workspaceNeuralObservations.occurredAt,
    metadata: workspaceNeuralObservations.metadata,
    sourceReferences: workspaceNeuralObservations.sourceReferences, // ADD THIS
  })
  .from(workspaceNeuralObservations)
  .where(inArray(workspaceNeuralObservations.externalId, externalIds));
```

Then update the result mapping (around line 625-649):

```typescript
return candidates.map((candidate) => {
  const obs = observationMap.get(candidate.observationId);
  const obsEntities = entitiesByObservation.get(candidate.observationId) || [];

  return {
    id: candidate.observationId,
    title: obs?.title || "Unknown",
    url: (obs?.metadata as Record<string, unknown>)?.url as string || null,
    snippet: candidate.snippet,
    score: candidate.score,
    source: obs?.source || "unknown",
    type: obs?.observationType || "unknown",
    occurredAt: obs?.occurredAt || null,
    entities: obsEntities,
    // ADD THIS: Include sourceReferences
    references: (obs?.sourceReferences as Array<{
      type: string;
      id: string;
      url?: string;
      label?: string;
    }>) || [],
  };
});
```

#### 4.3 Update V1 Search Route
**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Changes**: Include references in response mapping (around line 173-186)

```typescript
const results: V1SearchResult[] = enrichedResults
  .slice(offset, offset + limit)
  .map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url || "",
    snippet: r.snippet,
    score: r.score,
    source: r.source,
    type: r.type,
    occurredAt: r.occurredAt || undefined,
    entities: r.entities,
    references: r.references, // ADD THIS
    highlights: includeHighlights
      ? {
          title: r.title,
          snippet: r.snippet,
        }
      : undefined,
  }));
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Search API returns `references` array in results
- [ ] PR results show `references: [{ type: "issue", id: "LIN-892", label: "fixes" }]`
- [ ] Commit results show branch and commit references

**Implementation Note**: After completing this phase, test the search API with demo data to verify references appear in results.

---

## Phase 5: Graph & Related APIs

### Overview
Create API endpoints for relationship graph traversal and related events lookup.

### Changes Required:

#### 5.1 Create Graph API Route
**File**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts` (new file)

```typescript
/**
 * Graph API
 *
 * GET /v1/graph/{observationId}?depth=2&types=fixes,deploys
 *
 * Traverses the relationship graph from a starting observation.
 * Returns connected observations with relationship edges.
 */

import { NextRequest, NextResponse } from "next/server";
import { withDualAuth } from "../lib/with-dual-auth";
import { db, eq, and, or, inArray } from "@db/console/client";
import {
  workspaceNeuralObservations,
  observationRelationships,
} from "@db/console/schema";
import { nanoid } from "nanoid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = nanoid(10);
  const startTime = Date.now();
  const { id: observationId } = await params;

  // Parse query params
  const { searchParams } = new URL(request.url);
  const depth = Math.min(parseInt(searchParams.get("depth") || "2", 10), 3);
  const typesParam = searchParams.get("types");
  const allowedTypes = typesParam ? typesParam.split(",") : null;

  // Auth
  const authResult = await withDualAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error, requestId },
      { status: 401 }
    );
  }

  const { workspaceId } = authResult;

  try {
    // Step 1: Get the root observation
    const rootObs = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.externalId, observationId)
      ),
      columns: {
        id: true,
        externalId: true,
        title: true,
        source: true,
        observationType: true,
        occurredAt: true,
        metadata: true,
      },
    });

    if (!rootObs) {
      return NextResponse.json(
        { error: "Observation not found", requestId },
        { status: 404 }
      );
    }

    // Step 2: BFS traversal to find connected observations
    const visited = new Set<number>([rootObs.id]);
    const edges: Array<{
      source: string;
      target: string;
      type: string;
      linkingKey: string | null;
      confidence: number;
    }> = [];
    const nodeMap = new Map<number, typeof rootObs>();
    nodeMap.set(rootObs.id, rootObs);

    let frontier = [rootObs.id];

    for (let d = 0; d < depth && frontier.length > 0; d++) {
      // Find all relationships involving frontier nodes
      const relationships = await db
        .select()
        .from(observationRelationships)
        .where(
          and(
            eq(observationRelationships.workspaceId, workspaceId),
            or(
              inArray(observationRelationships.sourceObservationId, frontier),
              inArray(observationRelationships.targetObservationId, frontier)
            )
          )
        );

      // Filter by allowed types if specified
      const filteredRels = allowedTypes
        ? relationships.filter((r) => allowedTypes.includes(r.relationshipType))
        : relationships;

      // Collect new node IDs
      const newNodeIds = new Set<number>();
      for (const rel of filteredRels) {
        if (!visited.has(rel.sourceObservationId)) {
          newNodeIds.add(rel.sourceObservationId);
        }
        if (!visited.has(rel.targetObservationId)) {
          newNodeIds.add(rel.targetObservationId);
        }
      }

      // Fetch new nodes
      if (newNodeIds.size > 0) {
        const newNodes = await db
          .select({
            id: workspaceNeuralObservations.id,
            externalId: workspaceNeuralObservations.externalId,
            title: workspaceNeuralObservations.title,
            source: workspaceNeuralObservations.source,
            observationType: workspaceNeuralObservations.observationType,
            occurredAt: workspaceNeuralObservations.occurredAt,
            metadata: workspaceNeuralObservations.metadata,
          })
          .from(workspaceNeuralObservations)
          .where(inArray(workspaceNeuralObservations.id, Array.from(newNodeIds)));

        for (const node of newNodes) {
          nodeMap.set(node.id, node);
          visited.add(node.id);
        }
      }

      // Record edges
      for (const rel of filteredRels) {
        const sourceNode = nodeMap.get(rel.sourceObservationId);
        const targetNode = nodeMap.get(rel.targetObservationId);
        if (sourceNode && targetNode) {
          edges.push({
            source: sourceNode.externalId,
            target: targetNode.externalId,
            type: rel.relationshipType,
            linkingKey: rel.linkingKey,
            confidence: rel.confidence ?? 1.0,
          });
        }
      }

      // Update frontier
      frontier = Array.from(newNodeIds);
    }

    // Step 3: Format response
    const nodes = Array.from(nodeMap.values()).map((node) => ({
      id: node.externalId,
      title: node.title,
      source: node.source,
      type: node.observationType,
      occurredAt: node.occurredAt,
      url: (node.metadata as Record<string, unknown>)?.url as string || null,
      isRoot: node.id === rootObs.id,
    }));

    return NextResponse.json({
      data: {
        root: {
          id: rootObs.externalId,
          title: rootObs.title,
          source: rootObs.source,
          type: rootObs.observationType,
        },
        nodes,
        edges,
      },
      meta: {
        depth,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        took: Date.now() - startTime,
      },
      requestId,
    });
  } catch (error) {
    console.error("[/v1/graph] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
```

#### 5.2 Create Related Events API Route
**File**: `apps/console/src/app/(api)/v1/related/[id]/route.ts` (new file)

```typescript
/**
 * Related Events API
 *
 * GET /v1/related/{observationId}
 *
 * Returns observations directly connected to the given observation
 * via the relationship graph. Simpler than full graph traversal.
 */

import { NextRequest, NextResponse } from "next/server";
import { withDualAuth } from "../lib/with-dual-auth";
import { db, eq, and, or, desc } from "@db/console/client";
import {
  workspaceNeuralObservations,
  observationRelationships,
} from "@db/console/schema";
import { nanoid } from "nanoid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = nanoid(10);
  const startTime = Date.now();
  const { id: observationId } = await params;

  const authResult = await withDualAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error, requestId },
      { status: 401 }
    );
  }

  const { workspaceId } = authResult;

  try {
    // Step 1: Get the source observation
    const sourceObs = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.externalId, observationId)
      ),
      columns: {
        id: true,
        externalId: true,
        title: true,
        source: true,
      },
    });

    if (!sourceObs) {
      return NextResponse.json(
        { error: "Observation not found", requestId },
        { status: 404 }
      );
    }

    // Step 2: Find direct relationships (both directions)
    const relationships = await db
      .select()
      .from(observationRelationships)
      .where(
        and(
          eq(observationRelationships.workspaceId, workspaceId),
          or(
            eq(observationRelationships.sourceObservationId, sourceObs.id),
            eq(observationRelationships.targetObservationId, sourceObs.id)
          )
        )
      );

    // Step 3: Collect related observation IDs
    const relatedIds = new Set<number>();
    const relMap = new Map<number, { type: string; direction: "outgoing" | "incoming" }>();

    for (const rel of relationships) {
      if (rel.sourceObservationId === sourceObs.id) {
        relatedIds.add(rel.targetObservationId);
        relMap.set(rel.targetObservationId, {
          type: rel.relationshipType,
          direction: "outgoing",
        });
      } else {
        relatedIds.add(rel.sourceObservationId);
        relMap.set(rel.sourceObservationId, {
          type: rel.relationshipType,
          direction: "incoming",
        });
      }
    }

    // Step 4: Fetch related observations
    const relatedObs = relatedIds.size > 0
      ? await db
          .select({
            id: workspaceNeuralObservations.id,
            externalId: workspaceNeuralObservations.externalId,
            title: workspaceNeuralObservations.title,
            source: workspaceNeuralObservations.source,
            sourceType: workspaceNeuralObservations.sourceType,
            occurredAt: workspaceNeuralObservations.occurredAt,
            metadata: workspaceNeuralObservations.metadata,
            sourceReferences: workspaceNeuralObservations.sourceReferences,
          })
          .from(workspaceNeuralObservations)
          .where(
            and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              or(
                ...Array.from(relatedIds).map((id) =>
                  eq(workspaceNeuralObservations.id, id)
                )
              )
            )
          )
          .orderBy(desc(workspaceNeuralObservations.occurredAt))
      : [];

    // Step 5: Format response
    const related = relatedObs.map((obs) => {
      const relInfo = relMap.get(obs.id);
      return {
        id: obs.externalId,
        title: obs.title,
        source: obs.source,
        type: obs.sourceType,
        occurredAt: obs.occurredAt,
        url: (obs.metadata as Record<string, unknown>)?.url as string || null,
        references: obs.sourceReferences || [],
        relationshipType: relInfo?.type || "references",
        direction: relInfo?.direction || "outgoing",
      };
    });

    // Group by source
    const bySource = {
      github: related.filter((r) => r.source === "github"),
      vercel: related.filter((r) => r.source === "vercel"),
      sentry: related.filter((r) => r.source === "sentry"),
      linear: related.filter((r) => r.source === "linear"),
    };

    return NextResponse.json({
      data: {
        source: {
          id: sourceObs.externalId,
          title: sourceObs.title,
          source: sourceObs.source,
        },
        related,
        bySource,
      },
      meta: {
        total: related.length,
        took: Date.now() - startTime,
      },
      requestId,
    });
  } catch (error) {
    console.error("[/v1/related] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
```

#### 5.3 Add Type Definitions
**File**: `packages/console-types/src/api/v1/graph.ts` (new file)

```typescript
/**
 * /v1/graph API schemas
 */

import { z } from "zod";

export const GraphNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().nullable(),
  url: z.string().nullable(),
  isRoot: z.boolean().optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  linkingKey: z.string().nullable(),
  confidence: z.number(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphResponseSchema = z.object({
  data: z.object({
    root: z.object({
      id: z.string(),
      title: z.string(),
      source: z.string(),
      type: z.string(),
    }),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
  }),
  meta: z.object({
    depth: z.number(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    took: z.number(),
  }),
  requestId: z.string(),
});

export type GraphResponse = z.infer<typeof GraphResponseSchema>;
```

#### 5.4 Export Types
**File**: `packages/console-types/src/api/v1/index.ts`
**Changes**: Add exports

```typescript
export * from "./search";
export * from "./graph"; // ADD THIS
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/v1/graph/{id}` returns connected observations with edges
- [ ] `/v1/related/{id}` returns directly connected observations grouped by source
- [ ] PR observation shows related Sentry, Linear, and Vercel observations

**Implementation Note**: After completing this phase, test the graph API with demo data to verify relationships traverse correctly.

---

## Phase 6: Demo Environment & Script

### Overview
Create the demo reset script and documented demo flow.

### Changes Required:

#### 6.1 Create Demo Reset Script
**File**: `packages/console-test-data/src/cli/reset-demo.ts` (new file)

```typescript
#!/usr/bin/env tsx
/**
 * Reset Demo Environment
 *
 * Cleans workspace observations, entities, clusters, relationships,
 * and Pinecone vectors, then optionally injects demo dataset.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data reset-demo -- -w <workspaceId> [-i] [--dry-run]
 */

import { sql } from "drizzle-orm";
import { db, eq } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  observationRelationships,
  orgWorkspaces,
} from "@db/console/schema";
import { ConsolePineconeClient } from "@repo/console-pinecone";
import { loadDataset } from "../loader/index.js";
import { triggerObservationCapture } from "../trigger/trigger.js";

interface ResetOptions {
  workspaceId: string;
  inject: boolean;
  dryRun: boolean;
}

async function resetDemoEnvironment(options: ResetOptions) {
  const { workspaceId, inject, dryRun } = options;

  console.log(`\n🧹 Resetting demo environment for workspace: ${workspaceId}`);
  if (dryRun) console.log("   (DRY RUN - no changes will be made)\n");

  // Step 1: Count existing data
  const [obsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  const [entityResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));

  const [clusterResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));

  const [relResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(observationRelationships)
    .where(eq(observationRelationships.workspaceId, workspaceId));

  console.log(`📊 Found:`);
  console.log(`   - ${obsResult?.count ?? 0} observations`);
  console.log(`   - ${entityResult?.count ?? 0} entities`);
  console.log(`   - ${clusterResult?.count ?? 0} clusters`);
  console.log(`   - ${relResult?.count ?? 0} relationships`);

  if (dryRun) {
    console.log("\n🔍 Dry run complete. Would delete all of the above + Pinecone vectors.");
    return;
  }

  // Step 2: Get workspace settings for Pinecone
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    console.error(`❌ Workspace not found: ${workspaceId}`);
    process.exit(1);
  }

  // Step 3: Delete Pinecone vectors
  const settings = workspace.settings as { embedding?: { indexName: string; namespaceName: string } } | null;
  if (settings?.embedding) {
    console.log("\n🗑️  Clearing Pinecone vectors...");
    const pinecone = new ConsolePineconeClient();
    const { indexName, namespaceName } = settings.embedding;
    try {
      await pinecone.deleteByMetadata(indexName, namespaceName, {
        layer: { $eq: "observations" },
      });
      console.log(`   ✓ Cleared vectors from ${indexName}/${namespaceName}`);
    } catch (error) {
      console.log(`   ⚠ Could not clear Pinecone: ${error}`);
    }
  }

  // Step 4: Delete database records (order matters for FKs)
  console.log("\n🗑️  Clearing database records...");

  // Delete relationships first (FK to observations)
  await db
    .delete(observationRelationships)
    .where(eq(observationRelationships.workspaceId, workspaceId));
  console.log(`   ✓ Deleted relationships`);

  // Delete entities (FK to observations)
  await db
    .delete(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));
  console.log(`   ✓ Deleted entities`);

  // Delete observations
  await db
    .delete(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));
  console.log(`   ✓ Deleted observations`);

  // Delete clusters
  await db
    .delete(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));
  console.log(`   ✓ Deleted clusters`);

  console.log("\n✅ Cleanup complete!");

  // Step 5: Optionally inject demo data
  if (inject) {
    console.log("\n📥 Injecting demo-incident dataset...");
    const dataset = loadDataset("demo-incident");
    console.log(`   Found ${dataset.events.length} events to inject`);

    const result = await triggerObservationCapture(dataset.events, {
      workspaceId,
      batchSize: 5,
      delayMs: 500,
      onProgress: (completed, total) => {
        process.stdout.write(`\r   Progress: ${completed}/${total} events`);
      },
    });

    console.log(`\n\n✅ Injected ${result.triggered} events in ${result.duration}ms`);
    console.log("\n⏳ Wait 90-120 seconds for Inngest workflows to complete indexing.");
    console.log("   Check status at: http://localhost:8288 (Inngest Dev Server)");
    console.log("\n🎯 Demo ready! Try searching for: 'checkout TypeError'");
  }
}

// CLI parsing
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: ResetOptions = {
    workspaceId: "",
    inject: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] || "";
    } else if (arg === "-i" || arg === "--inject") {
      options.inject = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Usage: reset-demo -w <workspaceId> [-i] [--dry-run]

Options:
  -w, --workspace  Workspace ID to reset (required)
  -i, --inject     Inject demo-incident dataset after cleanup
  --dry-run        Show what would be deleted without executing
  -h, --help       Show this help message

Example:
  pnpm --filter @repo/console-test-data reset-demo -- -w ws_abc123 -i
`);
      process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();

if (!options.workspaceId) {
  console.error("Error: --workspace (-w) is required");
  console.error("Run with --help for usage information");
  process.exit(1);
}

resetDemoEnvironment(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

#### 6.2 Add Script to package.json
**File**: `packages/console-test-data/package.json`
**Changes**: Add reset-demo script

```json
{
  "scripts": {
    "inject": "pnpm with-env tsx src/cli/inject.ts",
    "reset-demo": "pnpm with-env tsx src/cli/reset-demo.ts"
  }
}
```

#### 6.3 Create Demo Script Document
**File**: `thoughts/shared/plans/2026-02-05-accelerator-demo-script.md` (new file)

```markdown
# Accelerator Demo Script: Lightfast Cross-Source Intelligence

## Pre-Demo Setup (5 minutes before)

1. **Reset demo environment**:
   ```bash
   pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i
   ```

2. **Wait for indexing** (90-120 seconds):
   - Check Inngest at http://localhost:8288
   - All 17 workflows should show "completed"
   - Relationship edges should be visible in database

3. **Verify setup**:
   ```bash
   # Check relationship count
   curl -H "Authorization: Bearer <api_key>" \
     "http://localhost:4107/v1/graph/<any_obs_id>?depth=2"
   ```

4. **Open console search**:
   - Navigate to workspace search in console UI

---

## Demo Flow (5 minutes)

### Opening Hook (30 seconds)

> "Imagine it's 2 AM. You're on-call. Alerts are firing. Users can't checkout.
>
> You need to understand what's happening — but the information is scattered across Sentry, Linear, GitHub, and Vercel.
>
> Today, that means 10 minutes of context switching between 4 different tools.
>
> With Lightfast, you ask one question."

### Demo 1: The Incident Query (90 seconds)

**Search**: `What happened with the checkout TypeError?`

**Talk through results**:
> "Watch what comes back. One query — four sources.
>
> We have the **Sentry alert** that detected the error, the **Linear issue** tracking it, the **GitHub PR** that fixed it, and the **Vercel deployment** that shipped the fix.
>
> Notice the cross-source links — the PR explicitly says 'Fixes LIN-892' and 'Resolves CHECKOUT-123'. Lightfast understands these connections."

**Show relationship graph**:
> "Let me show you the relationship graph."
>
> Click on a result, call `/v1/graph/{id}`, show:
> - Sentry CHECKOUT-123 → triggers → Linear LIN-892
> - Linear LIN-892 ← fixes ← GitHub PR #478
> - GitHub PR #478 ← deploys ← Vercel deployment

### Demo 2: Expertise Query (45 seconds)

**Search**: `Who fixed the checkout bug?`

> "Lightfast doesn't just find documents — it understands who did what.
>
> Alice Chen fixed the bug. She's the PR author, the Linear assignee, and the one who resolved the Sentry issue.
>
> Charlie merged it. Next time there's a checkout issue at 2 AM, you know exactly who to call."

### Demo 3: Related Events (45 seconds)

**API call**: `GET /v1/related/{github_pr_id}`

> "Here's the power of the relationship graph.
>
> Starting from the PR, I can see all connected events: the Sentry issue that triggered the work, the Linear issue tracking it, and the Vercel deployment that shipped it.
>
> This is automatic — Lightfast builds the graph from webhook data."

### The Value Prop (30 seconds)

> "The core insight is simple: **Your engineering stack already has all the context.** It's just scattered across tools.
>
> Lightfast connects everything via webhooks, builds a relationship graph, and makes it all searchable.
>
> The more your team uses their normal tools, the smarter Lightfast gets."

### Closing (30 seconds)

> "We're building the universal search for engineering teams.
>
> Today we support GitHub and Vercel in production, with Sentry and Linear ready. The architecture supports any tool with webhooks.
>
> Our vision: Every tool becomes AI-searchable. Every incident has instant context. Every developer has a photographic memory of their stack."

---

## Q&A Preparation

**Q: How does it connect information across sources?**
> "We build a relationship graph. When a PR says 'Fixes LIN-892', we create an edge. When a Vercel deployment includes a commit SHA, we link it to the GitHub push. The graph materializes these relationships during ingestion, enabling fast traversal at query time."

**Q: Why build a graph instead of just searching?**
> "Search finds documents. The graph finds connections. When you're debugging an incident, you need to know: what triggered this? what fixed it? who deployed the fix? The graph answers these questions that pure text search can't."

**Q: What relationship types do you track?**
> "Eight types: fixes, resolves, triggers, deploys, references, same_commit, same_branch, and tracked_in. Each captures a specific engineering workflow pattern."

---

## Backup Queries

If primary queries don't return good results:
1. `LIN-892` — Direct entity search
2. `checkout bug fix` — Should return PR #478
3. `deployment merge478sha456` — Should return Vercel events
4. `alice chen checkout` — Should return Alice's contributions

---

## Troubleshooting

**No relationships appearing**:
- Check `observation_relationships` table has rows
- Verify Inngest "detect-relationships" step completed
- Ensure demo data has cross-reference fields

**Graph API returning empty**:
- Verify observation ID exists
- Check workspace ID matches
- Try increasing depth parameter
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [ ] Script runs with --help: `pnpm --filter @repo/console-test-data reset-demo -- --help`

#### Manual Verification:
- [ ] Reset script clears all workspace data including relationships
- [ ] Demo injection creates 17 events and ~50+ relationship edges
- [ ] Demo script can be followed end-to-end
- [ ] All 4 demo queries return cross-source results with visible relationships

**Implementation Note**: After completing this phase, do a full dry-run of the demo to ensure everything works smoothly.

---

## Testing Strategy

### Unit Tests
- Relationship detection correctly identifies commit SHA matches
- Relationship type determination based on source types
- Deduplication preserves highest confidence relationships

### Integration Tests
- Reset script clears all workspace data including relationships
- Demo injection creates relationship edges during capture
- Graph API returns connected observations via BFS traversal
- Related API returns directly connected observations

### Manual Testing Steps
1. Run `pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i`
2. Wait 90-120 seconds for Inngest workflows
3. Verify relationships created: check `observation_relationships` table
4. Test Graph API: `GET /v1/graph/{pr_id}?depth=2`
5. Test Related API: `GET /v1/related/{sentry_id}`
6. Test Search API: verify `references` in results
7. Run through full demo script
8. Time complete demo (target: under 5 minutes)

## Performance Considerations

- Relationship detection runs during observation capture — adds ~50-100ms per observation
- Graph traversal uses BFS with depth limit (max 3) to prevent runaway queries
- JSONB containment queries may need GIN index for large datasets:
  ```sql
  CREATE INDEX idx_observations_references_gin
  ON lightfast_workspace_neural_observations
  USING GIN (source_references jsonb_path_ops);
  ```
- Consider adding GIN index if relationship detection becomes slow

## Migration Notes

- New `observation_relationships` table requires migration
- Existing observations won't have relationships — only new captures
- Demo reset + inject will create fresh data with relationships
- All schema changes are additive — no breaking changes

## References

- Research: `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md`
- Original demo plan: `thoughts/shared/plans/2026-02-05-accelerator-demo-search-showcase.md`
- Demo dataset: `packages/console-test-data/datasets/demo-incident.json`
- Observation schema: `db/console/src/schema/tables/workspace-neural-observations.ts`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts`
- V1 Search API: `apps/console/src/app/(api)/v1/search/route.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`

## Implementation Order & Dependencies

```
Phase 1 (Database Schema)
    │
    ▼
Phase 2 (Relationship Extraction)
    │
    ├────────────────┐
    ▼                ▼
Phase 3 (Demo Data)  Phase 4 (Search API)
    │                │
    └────────┬───────┘
             ▼
Phase 5 (Graph & Related APIs)
             │
             ▼
Phase 6 (Demo Environment & Script)
```

- Phase 1 must complete before Phase 2 (schema dependency)
- Phase 2 must complete before Phases 3-5 (relationship extraction)
- Phases 3 and 4 can run in parallel after Phase 2
- Phase 5 depends on relationships existing (Phase 2)
- Phase 6 depends on all previous phases

## Estimated Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Database Schema | ~2 hours |
| Phase 2 | Relationship Extraction | ~4 hours |
| Phase 3 | Demo Data Updates | ~2 hours |
| Phase 4 | Search API Enhancement | ~2 hours |
| Phase 5 | Graph & Related APIs | ~4 hours |
| Phase 6 | Demo Environment & Script | ~2 hours |

**Total**: ~16-20 hours

With a 1 week+ timeline, this is comfortably achievable with time for testing, iteration, and polish.
