# Neural Memory Day 4: Clusters + Actor Resolution Implementation Plan

## Overview

Implement cluster assignment and actor resolution for the neural memory write path. This completes the observation capture pipeline by grouping related observations into clusters and resolving source actors to workspace members via email matching.

**Scope**:
- Cluster assignment algorithm with affinity scoring
- Actor resolution via email matching (Tier 2 only)
- Fire-and-forget workflows for profile updates and cluster summaries
- New event schemas for async processing

## Current State Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Cluster schema | READY | `db/console/src/schema/tables/workspace-observation-clusters.ts` |
| Observation `clusterId` field | READY | `db/console/src/schema/tables/workspace-neural-observations.ts:67` |
| Actor resolution placeholder | READY | `api/console/src/inngest/workflow/neural/actor-resolution.ts:49-61` |
| Actor profile schema | NOT CREATED | Documented in E2E design only |
| Fire-and-forget patterns | READY | Multiple examples in codebase |

### Key Discoveries:
- Cluster assignment can proceed immediately - schema migrated, indexes exist
- Actor profiles require schema creation before resolution can store results
- `observation-capture.ts` has TODO markers at lines 443-444, 456, 516 for Day 4 additions
- Insertion point for cluster assignment: after line 390, before line 395

## Desired End State

After implementation:
1. Each significant observation is assigned to a cluster (new or existing)
2. Actors are resolved to workspace member emails when possible
3. Cluster summaries are generated asynchronously when thresholds are met
4. Actor profiles accumulate activity data over time

### Verification:
- New observations have non-null `clusterId`
- Clusters group semantically related observations
- Actor resolution returns email matches with 0.85 confidence
- Profile and summary workflows trigger on observation capture

## What We're NOT Doing

- OAuth actor resolution (Tier 1) - future enhancement
- Heuristic actor resolution (Tier 3) - future enhancement
- Configurable cluster thresholds - hardcoded at 60/100 for now
- Cluster centroid embedding updates - create once, don't recalculate
- Actor profile expertise extraction - just accumulate observation counts

## Implementation Approach

Three sequential phases:
1. **Phase A**: Cluster assignment - no blockers, can start immediately
2. **Phase B**: Actor profiles - requires schema migration first
3. **Phase C**: Fire-and-forget events - ties phases together

---

## Phase A: Cluster Assignment

### Overview
Implement the cluster assignment algorithm that groups observations by topic similarity, entity overlap, actor overlap, and temporal proximity.

### Changes Required:

#### 1. Create Cluster Assignment Module
**File**: `api/console/src/inngest/workflow/neural/cluster-assignment.ts` (NEW)

```typescript
/**
 * Cluster Assignment for Neural Observations
 *
 * Groups observations into topic clusters based on:
 * 1. Embedding similarity to cluster centroids (0-40 points)
 * 2. Entity overlap (0-30 points)
 * 3. Actor overlap (0-20 points)
 * 4. Temporal proximity (0-10 points)
 *
 * Threshold: 60/100 to join existing cluster
 */

import { db } from "@db/console/client";
import { workspaceObservationClusters } from "@db/console/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { nanoid } from "@repo/lib";
import { differenceInHours, subDays } from "date-fns";

const CLUSTER_AFFINITY_THRESHOLD = 60;
const MAX_RECENT_CLUSTERS = 10;
const CLUSTER_LOOKBACK_DAYS = 7;

interface ClusterAssignmentInput {
  workspaceId: string;
  embeddingVector: number[];
  vectorId: string;
  topics: string[];
  entityIds: string[];
  actorId: string | null;
  occurredAt: string;
  title: string;
  indexName: string;
  namespace: string;
}

interface ClusterAssignmentResult {
  clusterId: string;
  isNew: boolean;
  affinityScore: number | null;
}

/**
 * Assign observation to a cluster (existing or new)
 */
export async function assignToCluster(
  input: ClusterAssignmentInput
): Promise<ClusterAssignmentResult> {
  const { workspaceId, entityIds, actorId, occurredAt, topics, title } = input;

  // 1. Get recent open clusters
  const recentClusters = await db
    .select()
    .from(workspaceObservationClusters)
    .where(
      and(
        eq(workspaceObservationClusters.workspaceId, workspaceId),
        eq(workspaceObservationClusters.status, "open"),
        gte(
          workspaceObservationClusters.lastObservationAt,
          subDays(new Date(), CLUSTER_LOOKBACK_DAYS).toISOString()
        )
      )
    )
    .orderBy(desc(workspaceObservationClusters.lastObservationAt))
    .limit(MAX_RECENT_CLUSTERS);

  if (recentClusters.length === 0) {
    // No recent clusters - create new
    return createNewCluster(input);
  }

  // 2. Calculate affinity scores
  const affinities = await Promise.all(
    recentClusters.map(async (cluster) => ({
      cluster,
      score: await calculateClusterAffinity(cluster, input),
    }))
  );

  // 3. Find best match above threshold
  const bestMatch = affinities
    .filter((a) => a.score >= CLUSTER_AFFINITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];

  if (bestMatch) {
    // Add to existing cluster
    await updateClusterMetrics(bestMatch.cluster.id, {
      entityIds,
      actorId,
      occurredAt,
    });

    log.info("Observation assigned to existing cluster", {
      clusterId: bestMatch.cluster.id,
      affinityScore: bestMatch.score,
      topicLabel: bestMatch.cluster.topicLabel,
    });

    return {
      clusterId: bestMatch.cluster.id,
      isNew: false,
      affinityScore: bestMatch.score,
    };
  }

  // 4. Create new cluster
  return createNewCluster(input);
}

/**
 * Calculate affinity score between observation and cluster
 * Max score: 100 (40 embedding + 30 entity + 20 actor + 10 temporal)
 */
async function calculateClusterAffinity(
  cluster: typeof workspaceObservationClusters.$inferSelect,
  input: ClusterAssignmentInput
): Promise<number> {
  let score = 0;

  // 1. Embedding similarity (0-40 points)
  // Query Pinecone for similarity between observation vector and cluster centroid
  if (cluster.topicEmbeddingId) {
    try {
      const similarity = await getEmbeddingSimilarity(
        input.indexName,
        input.namespace,
        input.embeddingVector,
        cluster.topicEmbeddingId
      );
      score += similarity * 40;
    } catch (error) {
      log.warn("Failed to calculate embedding similarity", {
        clusterId: cluster.id,
        error,
      });
      // Continue without embedding score
    }
  }

  // 2. Entity overlap (0-30 points)
  const clusterEntities = (cluster.primaryEntities as string[]) || [];
  const observationEntities = input.entityIds || [];
  const entityOverlap = calculateOverlap(clusterEntities, observationEntities);
  score += entityOverlap * 30;

  // 3. Actor overlap (0-20 points)
  const clusterActors = (cluster.primaryActors as string[]) || [];
  if (input.actorId && clusterActors.includes(input.actorId)) {
    score += 20;
  }

  // 4. Temporal proximity (0-10 points)
  // Decay: full points if < 1 hour, linear decay to 0 at 10+ hours
  if (cluster.lastObservationAt) {
    const hoursSince = differenceInHours(
      new Date(input.occurredAt),
      new Date(cluster.lastObservationAt)
    );
    score += Math.max(0, 10 - hoursSince);
  }

  return score;
}

/**
 * Get cosine similarity between observation embedding and cluster centroid
 */
async function getEmbeddingSimilarity(
  indexName: string,
  namespace: string,
  observationVector: number[],
  clusterCentroidId: string
): Promise<number> {
  // Query Pinecone with the observation vector, filtering to the cluster centroid
  // The score returned is cosine similarity (0-1)
  const results = await consolePineconeClient.query(
    indexName,
    {
      vector: observationVector,
      topK: 1,
      filter: { layer: { $eq: "clusters" } },
      includeMetadata: false,
    },
    namespace
  );

  // Find the centroid in results
  const centroidMatch = results.matches.find((m) => m.id === clusterCentroidId);
  return centroidMatch?.score ?? 0;
}

/**
 * Calculate Jaccard overlap between two arrays
 */
function calculateOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...arr1, ...arr2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * Create a new cluster for the observation
 */
async function createNewCluster(
  input: ClusterAssignmentInput
): Promise<ClusterAssignmentResult> {
  const { workspaceId, topics, title, entityIds, actorId, occurredAt } = input;
  const { embeddingVector, vectorId, indexName, namespace } = input;

  // Generate topic label from first topic or title
  const topicLabel = topics[0] || title.slice(0, 100);

  // Create cluster centroid embedding ID
  const centroidId = `cluster_${nanoid()}`;

  // Upsert centroid to Pinecone
  await consolePineconeClient.upsertVectors(
    indexName,
    {
      ids: [centroidId],
      vectors: [embeddingVector],
      metadata: [{ layer: "clusters", topicLabel }],
    },
    namespace
  );

  // Insert cluster record
  const [cluster] = await db
    .insert(workspaceObservationClusters)
    .values({
      workspaceId,
      topicLabel,
      topicEmbeddingId: centroidId,
      keywords: topics,
      primaryEntities: entityIds,
      primaryActors: actorId ? [actorId] : [],
      status: "open",
      observationCount: 1,
      firstObservationAt: occurredAt,
      lastObservationAt: occurredAt,
    })
    .returning();

  log.info("Created new cluster", {
    clusterId: cluster.id,
    topicLabel,
    workspaceId,
  });

  return {
    clusterId: cluster.id,
    isNew: true,
    affinityScore: null,
  };
}

/**
 * Update cluster metrics when observation is added
 */
async function updateClusterMetrics(
  clusterId: string,
  observation: {
    entityIds: string[];
    actorId: string | null;
    occurredAt: string;
  }
): Promise<void> {
  const cluster = await db.query.workspaceObservationClusters.findFirst({
    where: eq(workspaceObservationClusters.id, clusterId),
  });

  if (!cluster) return;

  // Merge entities and actors
  const existingEntities = (cluster.primaryEntities as string[]) || [];
  const existingActors = (cluster.primaryActors as string[]) || [];

  const updatedEntities = [
    ...new Set([...existingEntities, ...observation.entityIds]),
  ].slice(0, 20); // Limit to 20 primary entities

  const updatedActors = observation.actorId
    ? [...new Set([...existingActors, observation.actorId])].slice(0, 10)
    : existingActors;

  await db
    .update(workspaceObservationClusters)
    .set({
      primaryEntities: updatedEntities,
      primaryActors: updatedActors,
      observationCount: sql`${workspaceObservationClusters.observationCount} + 1`,
      lastObservationAt: observation.occurredAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workspaceObservationClusters.id, clusterId));
}
```

#### 2. Update Observation Capture Pipeline
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Change 1**: Add import (after line 35)
```typescript
import { assignToCluster } from "./cluster-assignment";
```

**Change 2**: Add cluster assignment step (after line 393, before line 395)
```typescript
  // Step 5.5: Assign to cluster
  const clusterResult = await step.run("assign-cluster", async () => {
    // Build actor ID from source actor
    const actorId = sourceEvent.actor
      ? `${sourceEvent.source}:${sourceEvent.actor.id}`
      : null;

    // Extract entity IDs from extracted entities
    const entityIds = extractedEntities.map(
      (e) => `${e.category}:${e.key}`
    );

    return assignToCluster({
      workspaceId,
      embeddingVector,
      vectorId,
      topics,
      entityIds,
      actorId,
      occurredAt: sourceEvent.occurredAt,
      title: sourceEvent.title,
      indexName: workspace.indexName!,
      namespace: buildWorkspaceNamespace(workspace.clerkOrgId, workspaceId),
    });
  });
```

**Change 3**: Update store step to include clusterId (line 456)
Replace:
```typescript
            // TODO (Day 4): Add clusterId after cluster assignment
```
With:
```typescript
            clusterId: clusterResult.clusterId,
```

**Change 4**: Update emit-captured event (after line 515)
Replace:
```typescript
            // TODO (Day 4): Add actorId, clusterId
```
With:
```typescript
            clusterId: clusterResult.clusterId,
            clusterIsNew: clusterResult.isNew,
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @api/console build`
- [x] Lint passes: `pnpm lint` (for cluster-assignment.ts)
- [x] Typecheck passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Trigger a GitHub push webhook and verify observation is assigned a cluster
- [ ] Verify new cluster is created for first observation
- [ ] Trigger related events and verify they join the same cluster
- [ ] Check Pinecone for cluster centroid vectors with `layer: "clusters"`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase B.

---

## Phase B: Actor Profiles + Resolution

### Overview
Create actor profile schema and implement email-based actor resolution (Tier 2 only).

### Changes Required:

#### 1. Create Actor Profile Schema
**File**: `db/console/src/schema/tables/workspace-actor-profiles.ts` (NEW)

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Actor profiles - unified profiles for workspace contributors
 */
export const workspaceActorProfiles = pgTable(
  "lightfast_workspace_actor_profiles",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Identity
    actorId: varchar("actor_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    avatarUrl: text("avatar_url"),

    // Expertise (future enhancement)
    expertiseDomains: jsonb("expertise_domains").$type<string[]>(),
    contributionTypes: jsonb("contribution_types").$type<string[]>(),
    activeHours: jsonb("active_hours").$type<Record<string, number>>(),
    frequentCollaborators: jsonb("frequent_collaborators").$type<string[]>(),

    // Embedding (future enhancement)
    profileEmbeddingId: varchar("profile_embedding_id", { length: 191 }),

    // Stats
    observationCount: integer("observation_count").notNull().default(0),
    lastActiveAt: timestamp("last_active_at", {
      mode: "string",
      withTimezone: true,
    }),
    profileConfidence: real("profile_confidence"),

    // Timestamps
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint on workspace + actor
    uniqueActorIdx: uniqueIndex("actor_profile_unique_idx").on(
      table.workspaceId,
      table.actorId
    ),

    // Index for finding profiles in workspace
    workspaceIdx: index("actor_profile_workspace_idx").on(table.workspaceId),

    // Index for finding recently active profiles
    lastActiveIdx: index("actor_profile_last_active_idx").on(
      table.workspaceId,
      table.lastActiveAt
    ),
  })
);

export type WorkspaceActorProfile = typeof workspaceActorProfiles.$inferSelect;
export type InsertWorkspaceActorProfile = typeof workspaceActorProfiles.$inferInsert;
```

#### 2. Create Actor Identities Schema
**File**: `db/console/src/schema/tables/workspace-actor-identities.ts` (NEW)

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Actor identities - cross-platform identity mapping
 */
export const workspaceActorIdentities = pgTable(
  "lightfast_workspace_actor_identities",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Actor reference (links to profile)
    actorId: varchar("actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),

    // Mapping metadata
    mappingMethod: varchar("mapping_method", { length: 50 }).notNull(),
    confidenceScore: real("confidence_score").notNull(),
    mappedBy: varchar("mapped_by", { length: 191 }),
    mappedAt: timestamp("mapped_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint on workspace + source + sourceId
    uniqueIdentityIdx: uniqueIndex("actor_identity_unique_idx").on(
      table.workspaceId,
      table.source,
      table.sourceId
    ),

    // Index for finding identities by actor
    actorIdx: index("actor_identity_actor_idx").on(
      table.workspaceId,
      table.actorId
    ),

    // Index for email-based lookups
    emailIdx: index("actor_identity_email_idx").on(
      table.workspaceId,
      table.sourceEmail
    ),
  })
);

export type WorkspaceActorIdentity = typeof workspaceActorIdentities.$inferSelect;
export type InsertWorkspaceActorIdentity = typeof workspaceActorIdentities.$inferInsert;
```

#### 3. Update Schema Exports
**File**: `db/console/src/schema/tables/index.ts`

Add exports:
```typescript
export * from "./workspace-actor-profiles";
export * from "./workspace-actor-identities";
```

#### 4. Add Schema Relations
**File**: `db/console/src/schema/relations.ts`

Add relations (after existing neural relations):
```typescript
// Actor Profile relations
export const workspaceActorProfilesRelations = relations(
  workspaceActorProfiles,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceActorProfiles.workspaceId],
      references: [orgWorkspaces.id],
    }),
    identities: many(workspaceActorIdentities),
  })
);

export const workspaceActorIdentitiesRelations = relations(
  workspaceActorIdentities,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceActorIdentities.workspaceId],
      references: [orgWorkspaces.id],
    }),
  })
);
```

#### 5. Generate Migration
**Command**: Run from `db/console/`:
```bash
pnpm db:generate
```

#### 6. Apply Migration
**Command**: Run from `db/console/`:
```bash
pnpm db:migrate
```

#### 7. Implement Actor Resolution (Email Matching)
**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`

Replace entire file:
```typescript
import type { SourceEvent, SourceActor } from "@repo/console-types";
import { db } from "@db/console/client";
import { workspaceActorIdentities } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { clerkClient } from "@vendor/clerk/server";

/**
 * Actor Resolution for Neural Observations
 *
 * Currently implements Tier 2 (email matching) only.
 *
 * Resolution Tiers (from E2E design):
 * - Tier 1 (confidence 1.0): OAuth connection match
 *   TODO: Match sourceEvent.actor.id to user-sources.providerAccountId
 *   Requires adding providerAccountId field to user-sources table
 *
 * - Tier 2 (confidence 0.85): Email matching [IMPLEMENTED]
 *   Match sourceEvent.actor.email to workspace member emails via Clerk API
 *
 * - Tier 3 (confidence 0.60): Heuristic matching
 *   TODO: Match by username similarity, display name
 *   Lower confidence, use as fallback
 */

export interface ResolvedActor {
  /** Original actor from source event */
  sourceActor: SourceActor | null;
  /** Resolved workspace user ID (Clerk user ID) - null if unresolved */
  resolvedUserId: string | null;
  /** Canonical actor ID for this workspace (source:id format) */
  actorId: string | null;
  /** Resolution confidence: 0.85 (email), 0 (unresolved) */
  confidence: number;
  /** Resolution method used */
  method: "oauth" | "email" | "heuristic" | "unresolved";
}

/**
 * Resolve source actor to workspace user.
 *
 * Currently implements email matching only (Tier 2).
 */
export async function resolveActor(
  workspaceId: string,
  clerkOrgId: string,
  sourceEvent: SourceEvent
): Promise<ResolvedActor> {
  const sourceActor = sourceEvent.actor || null;

  if (!sourceActor) {
    return {
      sourceActor: null,
      resolvedUserId: null,
      actorId: null,
      confidence: 0,
      method: "unresolved",
    };
  }

  // Generate canonical actor ID
  const actorId = `${sourceEvent.source}:${sourceActor.id}`;

  // Check if we already have a cached identity mapping
  const existingIdentity = await db.query.workspaceActorIdentities.findFirst({
    where: and(
      eq(workspaceActorIdentities.workspaceId, workspaceId),
      eq(workspaceActorIdentities.source, sourceEvent.source),
      eq(workspaceActorIdentities.sourceId, sourceActor.id)
    ),
  });

  if (existingIdentity && existingIdentity.actorId) {
    log.debug("Using cached actor identity", {
      actorId: existingIdentity.actorId,
      method: existingIdentity.mappingMethod,
    });

    return {
      sourceActor,
      resolvedUserId: existingIdentity.actorId, // This is the resolved user ID
      actorId,
      confidence: existingIdentity.confidenceScore,
      method: existingIdentity.mappingMethod as ResolvedActor["method"],
    };
  }

  // Tier 2: Email matching
  if (sourceActor.email) {
    const resolved = await resolveByEmail(
      workspaceId,
      clerkOrgId,
      sourceEvent.source,
      sourceActor
    );

    if (resolved) {
      return {
        sourceActor,
        resolvedUserId: resolved.userId,
        actorId,
        confidence: 0.85,
        method: "email",
      };
    }
  }

  // TODO (Future): Tier 1 - OAuth connection match
  // Would need to query user-sources table for providerAccountId match
  // Return confidence 1.0 if matched

  // TODO (Future): Tier 3 - Heuristic matching
  // Match by username similarity, display name
  // Return confidence 0.60 if matched

  // No match found
  return {
    sourceActor,
    resolvedUserId: null,
    actorId,
    confidence: 0,
    method: "unresolved",
  };
}

/**
 * Resolve actor by email matching against Clerk organization members
 */
async function resolveByEmail(
  workspaceId: string,
  clerkOrgId: string,
  source: string,
  actor: SourceActor
): Promise<{ userId: string } | null> {
  if (!actor.email) return null;

  try {
    // Get organization members from Clerk
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
      limit: 100,
    });

    // Find member with matching email
    for (const membership of memberships.data) {
      const userId = membership.publicUserData?.userId;
      if (!userId) continue;

      // Get user details to check email
      const user = await clerkClient.users.getUser(userId);
      const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());

      if (userEmails.includes(actor.email.toLowerCase())) {
        // Cache the identity mapping
        await db
          .insert(workspaceActorIdentities)
          .values({
            workspaceId,
            actorId: userId,
            source,
            sourceId: actor.id,
            sourceUsername: actor.name,
            sourceEmail: actor.email,
            mappingMethod: "email",
            confidenceScore: 0.85,
          })
          .onConflictDoNothing();

        log.info("Resolved actor by email", {
          sourceActor: actor.id,
          resolvedUserId: userId,
          email: actor.email,
        });

        return { userId };
      }
    }
  } catch (error) {
    log.warn("Failed to resolve actor by email", {
      actorEmail: actor.email,
      error,
    });
  }

  return null;
}
```

#### 8. Update Observation Capture to Use Actor Resolution
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Change 1**: Add import (after existing imports)
```typescript
import { resolveActor } from "./actor-resolution";
```

**Change 2**: Add actor resolution to parallel processing (inside Promise.all, after line 389)
Add as 4th parallel task:
```typescript
      // Actor resolution (Tier 2: email matching)
      step.run("resolve-actor", async () => {
        return resolveActor(workspaceId, workspace.clerkOrgId, sourceEvent);
      }),
```

**Change 3**: Update destructuring (line 330)
Change from:
```typescript
    const [classificationResult, embeddingResult, extractedEntities] = await Promise.all([
```
To:
```typescript
    const [classificationResult, embeddingResult, extractedEntities, resolvedActor] = await Promise.all([
```

**Change 4**: Update store step to use resolved actor (line 443-444)
Replace:
```typescript
            // TODO (Day 4): Replace passthrough with resolveActor() call
            actor: sourceEvent.actor || null,
```
With:
```typescript
            actor: sourceEvent.actor || null,
            // Resolved actor ID for workspace-level tracking
            actorId: resolvedActor.actorId,
```

**Note**: This requires adding `actorId` field to observations schema if not present. Check if it exists.

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] Migration applies: `cd db/console && pnpm db:migrate`
- [ ] TypeScript compiles: `pnpm --filter @api/console build`
- [ ] Lint passes: `pnpm lint`
- [ ] Typecheck passes: `pnpm typecheck`

#### Manual Verification:
- [ ] New tables exist in database: `workspace_actor_profiles`, `workspace_actor_identities`
- [ ] Trigger webhook from GitHub user with email matching Clerk member
- [ ] Verify `workspaceActorIdentities` record is created with `method: "email"`
- [ ] Verify observation has resolved `actorId`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase C.

---

## Phase C: Fire-and-Forget Events

### Overview
Create async workflows for profile updates and cluster summary generation, triggered after observation capture.

### Changes Required:

#### 1. Add Event Schemas
**File**: `api/console/src/inngest/client/client.ts`

Add after line 635 (after `observation.captured` schema):
```typescript
  /**
   * Profile update event (fire-and-forget)
   * Triggers async profile recalculation for actor
   */
  "apps-console/neural/profile.update": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical actor ID (source:id format) */
      actorId: z.string(),
      /** Observation that triggered update */
      observationId: z.string(),
    }),
  },

  /**
   * Cluster summary check event (fire-and-forget)
   * Triggers async summary generation if threshold met
   */
  "apps-console/neural/cluster.check-summary": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Cluster to check */
      clusterId: z.string(),
      /** Current observation count */
      observationCount: z.number(),
    }),
  },
```

#### 2. Create Profile Update Workflow
**File**: `api/console/src/inngest/workflow/neural/profile-update.ts` (NEW)

```typescript
/**
 * Profile Update Workflow
 *
 * Async workflow triggered after observation capture.
 * Updates actor profile with activity metrics.
 *
 * Debounce: 5 minutes per actor (via concurrency + singleton)
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import { workspaceActorProfiles, workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { log } from "@vendor/observability/log";

export const profileUpdate = inngest.createFunction(
  {
    id: "apps-console/neural.profile.update",
    name: "Neural Profile Update",
    description: "Updates actor profile after observation capture",
    retries: 2,

    // Debounce: only process latest event per actor (5 min window)
    debounce: {
      key: "event.data.actorId",
      period: "5m",
    },

    // Limit concurrent profile updates per workspace
    concurrency: {
      limit: 5,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId } = event.data;

    // Step 1: Get recent observations for this actor
    const recentActivity = await step.run("gather-activity", async () => {
      const observations = await db.query.workspaceNeuralObservations.findMany({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.actorId, actorId)
        ),
        orderBy: desc(workspaceNeuralObservations.occurredAt),
        limit: 100,
      });

      return {
        count: observations.length,
        lastActiveAt: observations[0]?.occurredAt || null,
        // Future: extract topics, contribution types, etc.
      };
    });

    // Step 2: Upsert profile
    await step.run("upsert-profile", async () => {
      // Extract display name from actorId (source:id -> id)
      const displayName = actorId.split(":")[1] || actorId;

      await db
        .insert(workspaceActorProfiles)
        .values({
          workspaceId,
          actorId,
          displayName,
          observationCount: recentActivity.count,
          lastActiveAt: recentActivity.lastActiveAt,
          profileConfidence: 0.5, // Default until more sophisticated analysis
        })
        .onConflictDoUpdate({
          target: [
            workspaceActorProfiles.workspaceId,
            workspaceActorProfiles.actorId,
          ],
          set: {
            observationCount: recentActivity.count,
            lastActiveAt: recentActivity.lastActiveAt,
            updatedAt: new Date().toISOString(),
          },
        });

      log.info("Updated actor profile", {
        workspaceId,
        actorId,
        observationCount: recentActivity.count,
      });
    });

    return { actorId, observationCount: recentActivity.count };
  }
);
```

#### 3. Create Cluster Summary Workflow
**File**: `api/console/src/inngest/workflow/neural/cluster-summary.ts` (NEW)

```typescript
/**
 * Cluster Summary Workflow
 *
 * Async workflow triggered after observation is added to cluster.
 * Generates LLM summary when cluster reaches threshold.
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceObservationClusters,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const SUMMARY_THRESHOLD = 5; // Generate summary after 5 observations
const SUMMARY_AGE_HOURS = 24; // Regenerate if summary > 24 hours old

const clusterSummarySchema = z.object({
  summary: z.string().max(500).describe("Concise summary of cluster activity"),
  keyTopics: z
    .array(z.string())
    .max(5)
    .describe("Top 5 topics or themes in this cluster"),
  keyContributors: z
    .array(z.string())
    .max(5)
    .describe("Top contributors to this cluster"),
  status: z
    .enum(["active", "completed", "stalled"])
    .describe("Cluster activity status"),
});

export const clusterSummaryCheck = inngest.createFunction(
  {
    id: "apps-console/neural.cluster.check-summary",
    name: "Neural Cluster Summary Check",
    description: "Generates cluster summary when threshold met",
    retries: 2,

    // Debounce: only process latest event per cluster (10 min window)
    debounce: {
      key: "event.data.clusterId",
      period: "10m",
    },

    // Limit concurrent summary generations per workspace
    concurrency: {
      limit: 3,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "3m",
    },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clusterId, observationCount } = event.data;

    // Step 1: Check if summary needed
    const needsSummary = await step.run("check-threshold", async () => {
      // Below threshold
      if (observationCount < SUMMARY_THRESHOLD) {
        return { needed: false, reason: "below_threshold" };
      }

      // Check existing summary age
      const cluster = await db.query.workspaceObservationClusters.findFirst({
        where: eq(workspaceObservationClusters.id, clusterId),
      });

      if (!cluster) {
        return { needed: false, reason: "cluster_not_found" };
      }

      if (cluster.summaryGeneratedAt) {
        const hoursSinceSummary =
          (Date.now() - new Date(cluster.summaryGeneratedAt).getTime()) /
          (1000 * 60 * 60);

        if (hoursSinceSummary < SUMMARY_AGE_HOURS) {
          return { needed: false, reason: "summary_recent" };
        }
      }

      return { needed: true, reason: "threshold_met", cluster };
    });

    if (!needsSummary.needed) {
      log.debug("Cluster summary not needed", {
        clusterId,
        reason: needsSummary.reason,
      });
      return { status: "skipped", reason: needsSummary.reason };
    }

    // Step 2: Gather cluster observations
    const observations = await step.run("gather-observations", async () => {
      return db.query.workspaceNeuralObservations.findMany({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.clusterId, clusterId)
        ),
        orderBy: desc(workspaceNeuralObservations.occurredAt),
        limit: 20, // Limit context size
      });
    });

    if (observations.length === 0) {
      return { status: "skipped", reason: "no_observations" };
    }

    // Step 3: Generate summary with LLM
    const summary = await step.run("generate-summary", async () => {
      const observationSummaries = observations.map((obs) => ({
        type: obs.observationType,
        title: obs.title,
        actor: (obs.actor as { name?: string })?.name || "unknown",
        date: obs.occurredAt,
        snippet: obs.content?.slice(0, 200) || "",
      }));

      const { object } = await generateObject({
        model: gateway("openai/gpt-5.1-instant"),
        schema: clusterSummarySchema,
        prompt: `Summarize this cluster of engineering activity observations.

Cluster topic: ${(needsSummary as { cluster?: { topicLabel?: string } }).cluster?.topicLabel || "Unknown"}
Observation count: ${observationCount}

Recent observations:
${JSON.stringify(observationSummaries, null, 2)}

Generate a concise summary, key topics, key contributors, and activity status.`,
        temperature: 0.3,
      });

      return object;
    });

    // Step 4: Update cluster with summary
    await step.run("update-cluster", async () => {
      await db
        .update(workspaceObservationClusters)
        .set({
          summary: summary.summary,
          summaryGeneratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workspaceObservationClusters.id, clusterId));

      log.info("Generated cluster summary", {
        clusterId,
        status: summary.status,
        keyTopics: summary.keyTopics,
      });
    });

    return {
      status: "generated",
      summary: summary.summary,
      keyTopics: summary.keyTopics,
    };
  }
);
```

#### 4. Register New Workflows
**File**: `api/console/src/inngest/workflow/neural/index.ts`

Replace contents:
```typescript
/**
 * Neural Memory Workflows
 *
 * Observation pipeline:
 * 1. observationCapture - Main write path (sync)
 * 2. profileUpdate - Actor profile updates (async, fire-and-forget)
 * 3. clusterSummaryCheck - Cluster summary generation (async, fire-and-forget)
 */

export { observationCapture } from "./observation-capture";
export { profileUpdate } from "./profile-update";
export { clusterSummaryCheck } from "./cluster-summary";
```

#### 5. Update Main Inngest Export
**File**: `api/console/src/inngest/index.ts`

Find the neural workflows section and ensure all three are exported:
```typescript
// Neural Memory
export {
  observationCapture,
  profileUpdate,
  clusterSummaryCheck,
} from "./workflow/neural";
```

Also ensure they're included in the functions array passed to `serve()`.

#### 6. Add Fire-and-Forget Events to Observation Capture
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Change**: Update emit step (replace the existing sendEvent at line 505-518)
```typescript
    // Step 8: Fire-and-forget events
    await step.sendEvent("emit-events", [
      // Completion event for downstream systems
      {
        name: "apps-console/neural/observation.captured",
        data: {
          workspaceId,
          observationId: observation.id,
          sourceId: sourceEvent.sourceId,
          observationType: observation.observationType,
          significanceScore: significance.score,
          topics,
          entitiesExtracted: extractedEntities.length,
          clusterId: clusterResult.clusterId,
          clusterIsNew: clusterResult.isNew,
        },
      },
      // Profile update (if actor resolved)
      ...(resolvedActor.actorId
        ? [
            {
              name: "apps-console/neural/profile.update" as const,
              data: {
                workspaceId,
                actorId: resolvedActor.actorId,
                observationId: observation.id,
              },
            },
          ]
        : []),
      // Cluster summary check
      {
        name: "apps-console/neural/cluster.check-summary" as const,
        data: {
          workspaceId,
          clusterId: clusterResult.clusterId,
          observationCount: clusterResult.isNew ? 1 : 0, // Will be fetched in workflow
        },
      },
    ]);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @api/console build`
- [ ] Lint passes: `pnpm lint`
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Inngest dev server shows new workflows: `pnpm dev:console` then check Inngest dashboard

#### Manual Verification:
- [ ] Trigger webhook and verify profile update workflow fires
- [ ] Trigger 5+ webhooks to same cluster and verify summary generation
- [ ] Check cluster record has `summary` and `summaryGeneratedAt` populated
- [ ] Check actor profile record has `observationCount` incremented

---

## Testing Strategy

### Unit Tests:
- Test `calculateClusterAffinity()` with mock cluster and observation data
- Test `calculateOverlap()` with various array inputs
- Test `resolveByEmail()` with mock Clerk responses

### Integration Tests:
- Test full observation capture with cluster assignment
- Test actor resolution with known email match
- Test cluster summary generation with 5+ observations

### Manual Testing Steps:
1. Clear existing clusters and observations in test workspace
2. Trigger GitHub push webhook
3. Verify observation created with `clusterId` populated
4. Trigger 4 more related webhooks (same repo)
5. Verify all 5 observations have same `clusterId`
6. Wait 10 minutes (debounce) and verify cluster has summary
7. Verify actor profile exists with `observationCount: 5`

---

## Performance Considerations

| Operation | Target | Notes |
|-----------|--------|-------|
| Cluster assignment | <100ms | Query 10 clusters + calculate affinity |
| Actor resolution | <200ms | Clerk API call (cacheable) |
| Profile update | <1000ms | Fire-and-forget, debounced |
| Cluster summary | <3000ms | LLM call, debounced |

**Optimizations:**
- Identity mapping cached in `workspaceActorIdentities`
- Cluster affinity only queries last 10 open clusters
- Profile/summary workflows debounced to prevent spam

---

## Migration Notes

1. Phase A requires no migrations (cluster schema already exists)
2. Phase B requires running `pnpm db:generate` and `pnpm db:migrate`
3. All changes are additive - no breaking changes to existing observations

---

## References

- Research doc: `thoughts/shared/research/2025-12-13-neural-memory-day4-implementation-infrastructure.md`
- E2E design: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
- Day 3.5 plan: `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Cluster schema: `db/console/src/schema/tables/workspace-observation-clusters.ts`

---

_Last updated: 2025-12-13_
