# Accelerator Demo: Cross-Source Search Showcase Implementation Plan

## Overview

This plan prepares Lightfast for an accelerator demo that showcases the unique value proposition: **cross-source intelligence that connects Sentry errors → Linear issues → GitHub PRs → Vercel deployments** in a single search query.

The demo will show how Lightfast gives every developer a "photographic memory" of their engineering stack - answering questions that would normally require searching 4+ tools in seconds.

## Current State Analysis

### What Works Now
- Four-path parallel search (vector, entity, cluster, actor) at `apps/console/src/lib/neural/four-path-search.ts`
- Cross-source references ARE extracted and stored in `sourceReferences` JSONB column
- Entity extraction captures issue IDs (LIN-892, #500, CHECKOUT-123) via patterns at `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- demo-incident.json has 17 cross-linked events across Sentry + Linear + GitHub + Vercel
- Mock transformers for Sentry/Linear exist in `packages/console-test-data/src/transformers/`
- V1 Search API at `apps/console/src/app/(api)/v1/search/route.ts`

### Key Gaps for Demo
1. **sourceReferences not in search response** - stored but not returned in V1SearchResult
2. **No unified cleanup script** - need to reset DB + Pinecone for clean demo environment
3. **No timeline visualization** - events are temporal but not shown as a connected timeline
4. **No "related events" feature** - can't click a result to see linked observations
5. **Search response doesn't highlight cross-source links** - need to surface these prominently

### Key Discoveries
- `workspaceNeuralObservations.sourceReferences`: JSONB array stores cross-source links (`db/console/src/schema/tables/workspace-neural-observations.ts:159`)
- Entity extraction pattern for Linear IDs: `/\b([A-Z]{2,10}-\d{1,6})\b/g` (`api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:36`)
- V1SearchResult schema at `packages/console-types/src/api/v1/search.ts:88-121` - missing `references` field
- Four-path search enrichment at `apps/console/src/lib/neural/four-path-search.ts:552-650` - fetches metadata but not sourceReferences

## Desired End State

After this plan is complete:
1. **Clean Demo Environment**: Single command resets workspace and injects demo data
2. **Enhanced Search Response**: Returns `references` showing cross-source links in every result
3. **Related Events API**: Fetch all observations linked by shared references (entity or sourceRef)
4. **Timeline API**: Endpoint for fetching chronological incident flow across sources
5. **Demo Script**: Documented demo flow using existing console search UI
6. **Fully Tested**: End-to-end demo script with expected results documented

### Verification Criteria
- Search for "checkout bug" returns all 4 sources with visible cross-references
- Related Events API returns linked observations from other sources
- Timeline API returns chronological incident flow: Sentry alert → Linear issue → GitHub PR → Vercel deployment
- Demo can be run end-to-end in under 5 minutes of setup using existing console search UI

## What We're NOT Doing

- Production Sentry/Linear OAuth integrations (mock transformers sufficient for demo)
- Real webhook endpoints for Sentry/Linear (using test data injection)
- Complex reranking improvements
- Performance optimizations beyond demo needs
- Custom demo page (using existing console search UI)
- Full production-ready testing (demo-focused)

## Implementation Approach

The plan has **4 phases** (all required):
1. **Demo Environment Setup** - Cleanup script + injection command
2. **Search API Enhancement** - Return references in results
3. **Related Events API** - Find linked observations
4. **Timeline API & Demo Script** - Timeline endpoint + documented demo flow using existing UI

---

## Phase 1: Demo Environment Setup

### Overview
Create a unified cleanup and injection workflow for demo preparation.

### Changes Required:

#### 1.1 Create Demo Reset Script
**File**: `packages/console-test-data/src/cli/reset-demo.ts` (new file)

```typescript
#!/usr/bin/env tsx
/**
 * Reset Demo Environment
 *
 * Cleans workspace observations, entities, clusters, and Pinecone vectors,
 * then optionally injects demo dataset.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data reset-demo -- -w <workspaceId> [-i] [--dry-run]
 *
 * Flags:
 *   -w, --workspace  Workspace ID to reset (required)
 *   -i, --inject     Inject demo-incident dataset after cleanup
 *   --dry-run        Show what would be deleted without executing
 */

import { sql } from "drizzle-orm";
import { db, eq } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
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

  console.log(`📊 Found:`);
  console.log(`   - ${obsResult?.count ?? 0} observations`);
  console.log(`   - ${entityResult?.count ?? 0} entities`);
  console.log(`   - ${clusterResult?.count ?? 0} clusters`);

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

  // Delete entities first (FK to observations)
  const deletedEntities = await db
    .delete(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));
  console.log(`   ✓ Deleted entities`);

  // Delete observations
  const deletedObs = await db
    .delete(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));
  console.log(`   ✓ Deleted observations`);

  // Delete clusters
  const deletedClusters = await db
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
      delayMs: 500, // Slower for demo to ensure proper processing
      onProgress: (completed, total) => {
        process.stdout.write(`\r   Progress: ${completed}/${total} events`);
      },
    });

    console.log(`\n\n✅ Injected ${result.triggered} events in ${result.duration}ms`);
    console.log("\n⏳ Wait 60-90 seconds for Inngest workflows to complete indexing.");
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

#### 1.2 Add Script to package.json
**File**: `packages/console-test-data/package.json`
**Changes**: Add reset-demo script to scripts section

```json
{
  "scripts": {
    "inject": "pnpm with-env tsx src/cli/inject.ts",
    "reset-demo": "pnpm with-env tsx src/cli/reset-demo.ts"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [ ] Linting passes: `pnpm --filter @repo/console-test-data lint`
- [ ] Script runs with --help flag

#### Manual Verification:
- [ ] `pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> --dry-run` shows counts
- [ ] Running with `-i` flag injects 17 demo events after cleanup
- [ ] Inngest dev server shows 17 workflow completions

**Implementation Note**: After completing this phase, verify the reset script works with a real workspace before proceeding to Phase 2.

---

## Phase 2: Search API Enhancement

### Overview
Enhance the V1 Search API to return `references` in results, enabling the UI to show cross-source links.

### Changes Required:

#### 2.1 Update V1SearchResult Schema
**File**: `packages/console-types/src/api/v1/search.ts`
**Changes**: Add references field to V1SearchResultSchema after entities (around line 113)

```typescript
// Add this new schema before V1SearchResultSchema (around line 85)
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
  id: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  score: z.number(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().datetime().optional(),
  entities: z
    .array(
      z.object({
        key: z.string(),
        category: z.string(),
      })
    )
    .optional(),
  // NEW: Cross-source references
  references: z.array(SourceReferenceSchema).optional(),
  highlights: z
    .object({
      title: z.string().optional(),
      snippet: z.string().optional(),
    })
    .optional(),
});
```

#### 2.2 Update EnrichedResult Interface
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Add references to the EnrichedResult interface

Find the EnrichedResult type definition (used around line 625) and ensure it includes references. Create explicit interface if not exists:

```typescript
// Add near the top of the file, after imports (around line 26)
export interface EnrichedResult {
  id: string;
  title: string;
  url: string | null;
  snippet: string;
  score: number;
  source: string;
  type: string;
  occurredAt: string | null;
  entities: Array<{ key: string; category: string }>;
  references: Array<{
    type: string;
    id: string;
    url?: string;
    label?: string;
  }>;
}
```

#### 2.3 Fetch sourceReferences in enrichSearchResults
**File**: `apps/console/src/lib/neural/four-path-search.ts`
**Changes**: Update the observation query to include sourceReferences

Find the enrichSearchResults function and update the select statement (around line 568-584):

```typescript
// Update the select to include sourceReferences
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
// Update the mapping to include references
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
    occurredAt: obs?.occurredAt?.toISOString() || null,
    entities: obsEntities,
    // NEW: Include sourceReferences
    references: (obs?.sourceReferences as Array<{
      type: string;
      id: string;
      url?: string;
      label?: string;
    }>) || [],
  };
});
```

#### 2.4 Update API Route Response
**File**: `apps/console/src/app/(api)/v1/search/route.ts`
**Changes**: Include references in the response mapping

Find the result mapping (around line 173-186) and add references:

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
- [ ] Commit results show `references: [{ type: "branch", id: "main" }, { type: "commit", id: "sha..." }]`

**Implementation Note**: After completing this phase, test with demo data to verify references appear correctly before proceeding to Phase 3.

---

## Phase 3: Related Events API

### Overview
Create an API endpoint that fetches observations linked by shared references or entities, enabling "show me everything connected to this event" functionality.

### Changes Required:

#### 3.1 Create Related Events API Route
**File**: `apps/console/src/app/(api)/v1/related/[id]/route.ts` (new file)

```typescript
/**
 * Related Events API
 *
 * GET /v1/related/{observationId}
 *
 * Returns observations that share references or entities with the given observation.
 * This enables the "Related Events" panel showing cross-source connections.
 */

import { NextRequest, NextResponse } from "next/server";
import { withDualAuth } from "@/lib/auth/dual-auth";
import { db, eq, and, ne, or, sql, desc } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
} from "@db/console/schema";
import { nanoid } from "nanoid";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = nanoid(10);
  const startTime = Date.now();

  // Auth
  const authResult = await withDualAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error, requestId },
      { status: 401 }
    );
  }

  const { workspaceId } = authResult;
  const observationId = params.id;

  try {
    // Step 1: Fetch the source observation
    const sourceObs = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.externalId, observationId)
      ),
      columns: {
        id: true,
        externalId: true,
        sourceReferences: true,
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

    // Step 2: Get entities for this observation
    const entities = await db
      .select({
        category: workspaceNeuralEntities.category,
        key: workspaceNeuralEntities.key,
      })
      .from(workspaceNeuralEntities)
      .where(
        and(
          eq(workspaceNeuralEntities.workspaceId, workspaceId),
          eq(workspaceNeuralEntities.sourceObservationId, sourceObs.id)
        )
      );

    // Step 3: Find observations with matching references
    const refs = (sourceObs.sourceReferences as Array<{ type: string; id: string }>) || [];
    const refIds = refs.map((r) => r.id).filter(Boolean);

    // Build JSONB containment queries for each reference
    const refConditions = refIds.map(
      (id) => sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ id }])}::jsonb`
    );

    // Step 4: Find observations with matching entities
    const entityKeys = entities.map((e) => e.key);

    // Query for entity-linked observations
    let entityLinkedObsIds: bigint[] = [];
    if (entityKeys.length > 0) {
      const entityLinked = await db
        .selectDistinct({ observationId: workspaceNeuralEntities.sourceObservationId })
        .from(workspaceNeuralEntities)
        .where(
          and(
            eq(workspaceNeuralEntities.workspaceId, workspaceId),
            sql`${workspaceNeuralEntities.key} = ANY(${entityKeys})`
          )
        );
      entityLinkedObsIds = entityLinked
        .map((e) => e.observationId)
        .filter((id): id is bigint => id !== null);
    }

    // Step 5: Fetch related observations
    const relatedObs = await db
      .select({
        id: workspaceNeuralObservations.id,
        externalId: workspaceNeuralObservations.externalId,
        title: workspaceNeuralObservations.title,
        source: workspaceNeuralObservations.source,
        sourceType: workspaceNeuralObservations.sourceType,
        occurredAt: workspaceNeuralObservations.occurredAt,
        sourceReferences: workspaceNeuralObservations.sourceReferences,
        metadata: workspaceNeuralObservations.metadata,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          ne(workspaceNeuralObservations.externalId, observationId), // Exclude self
          or(
            // Match by references
            ...(refConditions.length > 0 ? refConditions : [sql`false`]),
            // Match by entity-linked observation IDs
            entityLinkedObsIds.length > 0
              ? sql`${workspaceNeuralObservations.id} = ANY(${entityLinkedObsIds})`
              : sql`false`
          )
        )
      )
      .orderBy(desc(workspaceNeuralObservations.occurredAt))
      .limit(20);

    // Step 6: Format response
    const related = relatedObs.map((obs) => ({
      id: obs.externalId,
      title: obs.title,
      source: obs.source,
      type: obs.sourceType,
      occurredAt: obs.occurredAt?.toISOString() || null,
      url: (obs.metadata as Record<string, unknown>)?.url as string || null,
      references: obs.sourceReferences || [],
      // Determine link type
      linkType: refIds.some((refId) =>
        (obs.sourceReferences as Array<{ id: string }>)?.some((r) => r.id === refId)
      )
        ? "reference"
        : "entity",
    }));

    // Group by source for better display
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
        sharedReferences: refIds,
        sharedEntities: entityKeys,
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

#### 3.2 Add TypeScript Types
**File**: `packages/console-types/src/api/v1/related.ts` (new file)

```typescript
/**
 * /v1/related API schemas
 */

import { z } from "zod";
import { SourceReferenceSchema } from "./search";

export const RelatedEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  occurredAt: z.string().datetime().nullable(),
  url: z.string().nullable(),
  references: z.array(SourceReferenceSchema),
  linkType: z.enum(["reference", "entity"]),
});

export type RelatedEvent = z.infer<typeof RelatedEventSchema>;

export const RelatedEventsResponseSchema = z.object({
  data: z.object({
    source: z.object({
      id: z.string(),
      title: z.string(),
      source: z.string(),
    }),
    related: z.array(RelatedEventSchema),
    bySource: z.object({
      github: z.array(RelatedEventSchema),
      vercel: z.array(RelatedEventSchema),
      sentry: z.array(RelatedEventSchema),
      linear: z.array(RelatedEventSchema),
    }),
    sharedReferences: z.array(z.string()),
    sharedEntities: z.array(z.string()),
  }),
  meta: z.object({
    total: z.number(),
    took: z.number(),
  }),
  requestId: z.string(),
});

export type RelatedEventsResponse = z.infer<typeof RelatedEventsResponseSchema>;
```

#### 3.3 Export from index
**File**: `packages/console-types/src/api/v1/index.ts`
**Changes**: Add export for related types

```typescript
export * from "./search";
export * from "./related"; // ADD THIS
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] `GET /v1/related/{id}` returns related observations
- [ ] PR observation shows related Sentry issue, Linear issue, and Vercel deployment
- [ ] Results grouped by source (bySource object)

**Implementation Note**: After completing this phase, test with the GitHub PR from demo-incident.json to verify it finds linked Sentry and Linear events.

---

## Phase 4: Timeline API & Demo Script

### Overview
Create the Timeline API endpoint and document the demo flow using the existing console search UI.

### Changes Required:

#### 4.1 Create Timeline API Route
**File**: `apps/console/src/app/(api)/v1/timeline/route.ts` (new file)

```typescript
/**
 * Timeline API
 *
 * GET /v1/timeline?entity=LIN-892&hours=24
 *
 * Returns observations ordered by time, optionally filtered by shared entity.
 * Used for incident timeline visualization.
 */

import { NextRequest, NextResponse } from "next/server";
import { withDualAuth } from "@/lib/auth/dual-auth";
import { db, eq, and, gte, sql, desc, or } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const requestId = nanoid(10);
  const startTime = Date.now();

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity"); // e.g., "LIN-892", "CHECKOUT-123", "#478"
  const hours = parseInt(searchParams.get("hours") || "24", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const authResult = await withDualAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error, requestId },
      { status: 401 }
    );
  }

  const { workspaceId } = authResult;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    // Build query conditions
    const conditions = [
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      gte(workspaceNeuralObservations.occurredAt, since),
    ];

    // If entity specified, filter by reference or title/content containing entity
    if (entity) {
      conditions.push(
        or(
          // Match in sourceReferences
          sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ id: entity }])}::jsonb`,
          // Match in title
          sql`${workspaceNeuralObservations.title} ILIKE ${"%" + entity + "%"}`,
          // Match in sourceId
          sql`${workspaceNeuralObservations.sourceId} ILIKE ${"%" + entity + "%"}`
        )!
      );
    }

    const observations = await db
      .select({
        id: workspaceNeuralObservations.externalId,
        title: workspaceNeuralObservations.title,
        source: workspaceNeuralObservations.source,
        sourceType: workspaceNeuralObservations.sourceType,
        occurredAt: workspaceNeuralObservations.occurredAt,
        sourceReferences: workspaceNeuralObservations.sourceReferences,
        actor: workspaceNeuralObservations.actor,
        metadata: workspaceNeuralObservations.metadata,
      })
      .from(workspaceNeuralObservations)
      .where(and(...conditions))
      .orderBy(desc(workspaceNeuralObservations.occurredAt))
      .limit(limit);

    // Format timeline events
    const timeline = observations.map((obs) => ({
      id: obs.id,
      title: obs.title,
      source: obs.source,
      type: obs.sourceType,
      occurredAt: obs.occurredAt?.toISOString() || null,
      references: obs.sourceReferences || [],
      actor: obs.actor as { name?: string; avatarUrl?: string } | null,
      url: (obs.metadata as Record<string, unknown>)?.url as string || null,
      // Check if this event contains the searched entity
      containsEntity: entity
        ? (obs.sourceReferences as Array<{ id: string }>)?.some((r) => r.id === entity) ||
          obs.title?.includes(entity)
        : false,
    }));

    return NextResponse.json({
      data: timeline,
      meta: {
        entity,
        hours,
        total: timeline.length,
        took: Date.now() - startTime,
      },
      requestId,
    });
  } catch (error) {
    console.error("[/v1/timeline] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
```

#### 4.2 Create Demo Script Document
**File**: `thoughts/shared/plans/2026-02-05-accelerator-demo-script.md` (new file)

```markdown
# Accelerator Demo Script: Lightfast Cross-Source Intelligence

## Pre-Demo Setup (5 minutes before)

1. **Reset demo environment**:
   ```bash
   pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i
   ```

2. **Wait for indexing** (60-90 seconds):
   - Check Inngest at http://localhost:8288
   - All 17 workflows should show "completed"

3. **Open console search**:
   - Navigate to your workspace search in the existing console UI
   - Verify search works with a test query

4. **Have backup ready**:
   - Keep terminal open for any quick fixes
   - Have Inngest dashboard in another tab

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

**Click on the GitHub PR result to expand**:
> "See these references? Commit SHA, branch name, linked issues. All extracted automatically from webhooks and stored as structured data."

### Demo 2: Expertise Query (45 seconds)

**Search**: `Who fixed the checkout bug?`

> "Lightfast doesn't just find documents — it understands who did what.
>
> Alice Chen fixed the bug. She's the PR author, the Linear assignee, and the one who resolved the Sentry issue.
>
> Charlie merged it. Next time there's a checkout issue at 2 AM, you know exactly who to call."

### Demo 3: Security Audit (45 seconds)

**Search**: `security changes this month`

> "Here's where this gets powerful for engineering teams.
>
> One query gives you an instant security audit. Every commit, PR, and issue related to security — across all your tools.
>
> Compliance teams love this. No more digging through 4 different search bars."

### The Value Prop (30 seconds)

> "The core insight is simple: **Your engineering stack already has all the context.** It's just scattered across tools.
>
> Lightfast connects everything via webhooks, extracts the relationships, and makes it all searchable.
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

### Technical Questions

**Q: How does it connect information across sources?**
> "Two mechanisms. First, we store structured 'sourceReferences' — when a PR says 'Fixes #123', we parse that and store the relationship. Second, we extract entities from text — issue IDs, commit SHAs, usernames — and index them separately. Both paths feed into search."

**Q: How fast is it?**
> "100-300ms for balanced mode. We run four retrieval paths in parallel — vector similarity, entity matching, topic clusters, and actor profiles — then merge and rerank results."

**Q: What's the architecture?**
> "Webhooks from each source → Inngest workflows for processing → Multi-view embeddings stored in Pinecone → Relational data in PlanetScale. The key insight is storing structured references alongside semantic embeddings."

**Q: Why not just use ChatGPT/Claude?**
> "General LLMs don't have access to your private data, and they can't understand the relationships between your tools. We're purpose-built for engineering context."

### Business Questions

**Q: What's the go-to-market?**
> "Starting with dev-focused founders and small engineering teams. Free tier with limited integrations, paid tiers for more sources and workflow runs. Long-term, marketplace for community integrations."

**Q: How do you compete with Zapier/Make?**
> "They're trigger-action automation. We're AI-native search and orchestration. They connect tools; we understand context across tools."

**Q: What's the moat?**
> "MCP-first architecture and data network effects. Every webhook indexed makes search smarter. The more sources connected, the more valuable the cross-source intelligence."

---

## Backup Queries

If primary queries don't return good results:

1. `authentication issues` — Should return OAuth/auth commits
2. `database performance` — Should return caching/optimization commits
3. `recent deployments` — Should return Vercel events
4. `LIN-892` — Direct entity search for the Linear issue

---

## Troubleshooting

**No results returning**:
- Check if Inngest workflows completed
- Verify workspace ID is correct
- Try a more specific query like "LIN-892"

**Slow search**:
- Check Pinecone latency in response
- Verify dev server isn't overloaded
- Consider using "fast" mode for demo
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Timeline API returns valid JSON

#### Manual Verification:
- [ ] Timeline API returns events in chronological order
- [ ] Demo script can be followed end-to-end with existing console search UI
- [ ] All 4 demo queries return results from multiple sources
- [ ] Cross-source references visible in results

**Implementation Note**: After completing this phase, do a full dry-run of the demo script using the existing console search to ensure everything works smoothly.

---

## Testing Strategy

### Unit Tests
- V1SearchResult schema validates with references field
- SourceReferenceSchema validates all reference types
- Timeline API returns properly formatted data

### Integration Tests
- Reset script clears all workspace data
- Demo injection creates 17 events across 4 sources
- Search returns results with cross-source references
- Related events API finds linked observations
- Timeline API returns chronological events

### Manual Testing Steps
1. Run `pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i`
2. Wait 90 seconds for Inngest workflows
3. Open existing console search UI
4. Search "What happened with the checkout TypeError?"
5. Verify 4 source types in results (github, vercel, sentry, linear)
6. Verify references array in each result
7. Run through full demo script
8. Time the complete demo (target: under 5 minutes)

## Performance Considerations

- enrichSearchResults now fetches additional `sourceReferences` column — minimal impact
- Related events API uses JSONB containment queries — may need GIN index for large datasets:
  ```sql
  CREATE INDEX idx_observations_references_gin
  ON workspace_neural_observations
  USING GIN (source_references jsonb_path_ops);
  ```
- Timeline query with ILIKE may be slow — consider full-text search index if needed

## Migration Notes

- No database migrations required — sourceReferences column already exists
- Existing observations have sourceReferences populated by transformers
- All schema changes are additive (new optional field in API response)
- New API routes (/v1/related, /v1/timeline) don't affect existing functionality

## References

- Research: `thoughts/shared/research/2026-02-05-accelerator-demo-search-scenarios.md`
- Demo dataset: `packages/console-test-data/datasets/demo-incident.json`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts`
- V1 Search API: `apps/console/src/app/(api)/v1/search/route.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Search types: `packages/console-types/src/api/v1/search.ts`

## Implementation Order & Dependencies

```
Phase 1 (Demo Environment Setup)
    │
    ▼
Phase 2 (Search API Enhancement) ─────┐
    │                                  │
    ▼                                  │
Phase 3 (Related Events API)          │
    │                                  │
    ▼                                  │
Phase 4 (Timeline API & Demo Script) ◄┘
```

- Phase 2 can start immediately after Phase 1
- Phase 3 and 4 can be worked on in parallel after Phase 2
- Demo uses existing console search UI (no custom page needed)

## Estimated Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Demo Environment Setup | ~2 hours |
| Phase 2 | Search API Enhancement | ~2 hours |
| Phase 3 | Related Events API | ~2 hours |
| Phase 4 | Timeline API & Demo Script | ~2 hours |

**Total**: ~8 hours

With a few days timeline, this is comfortably achievable with time for testing and polish.
