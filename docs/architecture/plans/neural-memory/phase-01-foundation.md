---
title: "Phase 1: Foundation"
description: Database schema, Pinecone namespaces, Inngest events, webhook verification packages
status: in_progress
phase: 1
parent: "./README.md"
depends_on: []
blocks: ["./phase-02-observation-pipeline.md"]
---

# Phase 1: Foundation

**Status**: In Progress
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Establish the foundational infrastructure for neural memory: database tables, Pinecone namespace layers, Inngest event schemas, and webhook verification packages for Vercel and Sentry. This phase creates no user-visible features but enables all subsequent phases.

## Progress

### Completed
- [x] **Vercel Integration Created** - "Lightfast Dev" integration created in Vercel console
  - Integration name: Lightfast Dev
  - Category: DevTools
  - Webhook events: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`
  - OAuth redirect URL configured (ngrok for development)
  - Webhook URL configured (ngrok for development)
  - Featured images and all required fields completed
  - Credentials available: Client Secret ID, Client Integration Secret
  - Documentation: `docs/examples/connectors/vercel-integration-setup.md`

### In Progress
- [ ] Add Vercel credentials to environment variables
- [ ] Implement Vercel webhook verification package
- [ ] Implement Vercel webhook route handler

### Pending
- [ ] Database schema tables (6 tables)
- [ ] Inngest event schemas
- [ ] Sentry webhook verification package
- [ ] Sentry integration setup

## Prerequisites

- [x] Vercel Pro/Enterprise plan (for webhook support)
- [ ] Sentry integration credentials (client ID, client secret)
- [ ] Environment variables configured in `.env.development.local`

## Changes Required

### 1. Database Schema - Neural Observations

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`
**Action**: Create

```typescript
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceNeuralObservations = pgTable(
  "lightfast_workspace_neural_observations",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    storeId: varchar("store_id", { length: 191 }).notNull(),
    clusterId: varchar("cluster_id", { length: 191 }),

    // Temporal
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    // Actor
    actorType: varchar("actor_type", { length: 50 }),
    actorId: varchar("actor_id", { length: 191 }),
    actorName: varchar("actor_name", { length: 255 }),
    actorConfidence: varchar("actor_confidence", { length: 10 }).$type<string>(),

    // Content
    observationType: varchar("observation_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 1000 }).notNull(),
    content: varchar("content", { length: 65535 }).notNull(),

    // Classification
    topics: jsonb("topics").$type<string[]>(),
    significanceScore: varchar("significance_score", { length: 10 }),
    confidenceScore: varchar("confidence_score", { length: 10 }),

    // Source
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceReferences: jsonb("source_references").$type<Record<string, unknown>>(),

    // Embeddings (3 views)
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),

    // Relationships
    relatedEntityIds: jsonb("related_entity_ids").$type<string[]>(),
    parentObservationId: varchar("parent_observation_id", { length: 191 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byWorkspaceOccurred: index("idx_neural_obs_ws_occurred").on(
      t.workspaceId,
      t.occurredAt
    ),
    byCluster: index("idx_neural_obs_cluster").on(t.clusterId),
    byActor: index("idx_neural_obs_actor").on(t.workspaceId, t.actorId),
    byType: index("idx_neural_obs_type").on(t.workspaceId, t.observationType),
    bySource: index("idx_neural_obs_source").on(t.workspaceId, t.sourceType, t.sourceId),
  })
);

export type WorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferSelect;
export type InsertWorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferInsert;
```

**Why**: Core table for storing atomic engineering events from all sources.

### 2. Database Schema - Observation Clusters

**File**: `db/console/src/schema/tables/workspace-observation-clusters.ts`
**Action**: Create

```typescript
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceObservationClusters = pgTable(
  "lightfast_workspace_observation_clusters",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Topic
    topicLabel: varchar("topic_label", { length: 255 }).notNull(),
    topicEmbeddingId: varchar("topic_embedding_id", { length: 191 }),
    keywords: jsonb("keywords").$type<string[]>(),

    // Scope
    primaryEntities: jsonb("primary_entities").$type<string[]>(),
    primaryActors: jsonb("primary_actors").$type<string[]>(),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("open"),

    // Summary
    summary: varchar("summary", { length: 10000 }),
    summaryGeneratedAt: timestamp("summary_generated_at", { withTimezone: true }),

    // Metrics
    observationCount: varchar("observation_count", { length: 10 }).notNull().default("0"),
    firstObservationAt: timestamp("first_observation_at", { withTimezone: true }),
    lastObservationAt: timestamp("last_observation_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byWorkspaceStatus: index("idx_cluster_ws_status").on(t.workspaceId, t.status),
    byLastObs: index("idx_cluster_last_obs").on(t.workspaceId, t.lastObservationAt),
  })
);

export type WorkspaceObservationCluster = typeof workspaceObservationClusters.$inferSelect;
export type InsertWorkspaceObservationCluster = typeof workspaceObservationClusters.$inferInsert;
```

**Why**: Groups related observations by topic for contextual retrieval.

### 3. Database Schema - Neural Entities

**File**: `db/console/src/schema/tables/workspace-neural-entities.ts`
**Action**: Create

```typescript
import { index, jsonb, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceNeuralEntities = pgTable(
  "lightfast_workspace_neural_entities",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    storeId: varchar("store_id", { length: 191 }).notNull(),

    // Entity
    category: varchar("category", { length: 50 }).notNull(),
    key: varchar("key", { length: 500 }).notNull(),
    value: varchar("value", { length: 10000 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>(),

    // Provenance
    sourceObservationId: varchar("source_observation_id", { length: 191 }),
    evidenceSnippet: varchar("evidence_snippet", { length: 1000 }),
    confidence: varchar("confidence", { length: 10 }).notNull().default("0.8"),

    // Metadata
    extractedAt: timestamp("extracted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    occurrenceCount: varchar("occurrence_count", { length: 10 }).notNull().default("1"),
  },
  (t) => ({
    byWorkspaceCat: index("idx_entity_ws_cat").on(t.workspaceId, t.category),
    byKey: index("idx_entity_key").on(t.workspaceId, t.key),
    uniqueKey: uniqueIndex("uq_entity_ws_cat_key").on(t.workspaceId, t.category, t.key),
  })
);

export type WorkspaceNeuralEntity = typeof workspaceNeuralEntities.$inferSelect;
export type InsertWorkspaceNeuralEntity = typeof workspaceNeuralEntities.$inferInsert;
```

**Why**: Structured storage for exact-match retrieval of engineers, projects, APIs, etc.

### 4. Database Schema - Actor Profiles

**File**: `db/console/src/schema/tables/workspace-actor-profiles.ts`
**Action**: Create

```typescript
import { index, jsonb, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceActorProfiles = pgTable(
  "lightfast_workspace_actor_profiles",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Identity
    actorId: varchar("actor_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 1000 }),

    // Expertise
    expertiseDomains: jsonb("expertise_domains").$type<Record<string, number>>(),
    contributionTypes: jsonb("contribution_types").$type<Record<string, number>>(),
    activeHours: jsonb("active_hours").$type<number[]>(),
    frequentCollaborators: jsonb("frequent_collaborators").$type<string[]>(),

    // Embedding
    profileEmbeddingId: varchar("profile_embedding_id", { length: 191 }),

    // Stats
    observationCount: varchar("observation_count", { length: 10 }).notNull().default("0"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    profileConfidence: varchar("profile_confidence", { length: 10 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byWorkspace: index("idx_profile_ws").on(t.workspaceId),
    byActive: index("idx_profile_active").on(t.workspaceId, t.lastActiveAt),
    uniqueActor: uniqueIndex("uq_profile_ws_actor").on(t.workspaceId, t.actorId),
  })
);

export type WorkspaceActorProfile = typeof workspaceActorProfiles.$inferSelect;
export type InsertWorkspaceActorProfile = typeof workspaceActorProfiles.$inferInsert;
```

**Why**: Stores computed expertise and patterns for actor-aware retrieval.

### 5. Database Schema - Actor Identities

**File**: `db/console/src/schema/tables/workspace-actor-identities.ts`
**Action**: Create

```typescript
import { index, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceActorIdentities = pgTable(
  "lightfast_workspace_actor_identities",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),

    // Mapping metadata
    mappingMethod: varchar("mapping_method", { length: 50 }).notNull(),
    confidenceScore: varchar("confidence_score", { length: 10 }).notNull(),
    mappedBy: varchar("mapped_by", { length: 191 }),
    mappedAt: timestamp("mapped_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byActor: index("idx_identity_actor").on(t.workspaceId, t.actorId),
    byEmail: index("idx_identity_email").on(t.workspaceId, t.sourceEmail),
    uniqueIdentity: uniqueIndex("uq_identity_ws_source").on(t.workspaceId, t.source, t.sourceId),
  })
);

export type WorkspaceActorIdentity = typeof workspaceActorIdentities.$inferSelect;
export type InsertWorkspaceActorIdentity = typeof workspaceActorIdentities.$inferInsert;
```

**Why**: Maps cross-platform identities (GitHub, Vercel, Sentry) to unified actors.

### 6. Database Schema - Temporal States

**File**: `db/console/src/schema/tables/workspace-temporal-states.ts`
**Action**: Create

```typescript
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceTemporalStates = pgTable(
  "lightfast_workspace_temporal_states",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => nanoid()),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Entity
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 191 }).notNull(),
    entityName: varchar("entity_name", { length: 255 }),

    // State
    stateType: varchar("state_type", { length: 50 }).notNull(),
    stateValue: varchar("state_value", { length: 255 }).notNull(),
    stateMetadata: jsonb("state_metadata").$type<Record<string, unknown>>(),

    // Temporal
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isCurrent: varchar("is_current", { length: 5 }).notNull().default("true"),

    // Change
    changedByActorId: varchar("changed_by_actor_id", { length: 191 }),
    changeReason: varchar("change_reason", { length: 1000 }),
    relatedObservationId: varchar("related_observation_id", { length: 191 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byEntity: index("idx_state_entity").on(t.entityType, t.entityId, t.validFrom),
    byCurrent: index("idx_state_current").on(t.workspaceId, t.isCurrent),
  })
);

export type WorkspaceTemporalState = typeof workspaceTemporalStates.$inferSelect;
export type InsertWorkspaceTemporalState = typeof workspaceTemporalStates.$inferInsert;
```

**Why**: Enables point-in-time queries like "what was the status last month?"

### 7. Export Schema Tables

**File**: `db/console/src/schema/tables/index.ts`
**Action**: Modify (add exports)

```typescript
// Add these exports after existing exports:

// Neural Memory Tables
export * from "./workspace-neural-observations";
export * from "./workspace-observation-clusters";
export * from "./workspace-neural-entities";
export * from "./workspace-actor-profiles";
export * from "./workspace-actor-identities";
export * from "./workspace-temporal-states";
```

**Why**: Make new tables available for import throughout the codebase.

### 8. Inngest Event Schemas

**File**: `api/console/src/inngest/client/client.ts`
**Action**: Modify (add to eventsMap)

Add after line ~627 (after existing event definitions):

```typescript
// ============================================================================
// NEURAL MEMORY EVENTS
// ============================================================================

/**
 * Capture neural observation from source event
 * Emitted by: Webhook handlers (GitHub, Vercel, Sentry)
 * Consumed by: Observation capture workflow
 */
"apps-console/neural/observation.capture": {
  data: z.object({
    workspaceId: z.string(),
    storeId: z.string(),
    sourceEvent: z.object({
      source: z.enum(["github", "vercel", "sentry"]),
      sourceType: z.string(),
      sourceId: z.string(),
      title: z.string(),
      body: z.string().optional(),
      actor: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().optional(),
        avatarUrl: z.string().optional(),
      }).optional(),
      occurredAt: z.string().datetime(),
      references: z.array(z.object({
        type: z.string(),
        id: z.string(),
        url: z.string().optional(),
      })).optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  }),
},

/**
 * Update actor profile (fire-and-forget)
 * Emitted by: Observation capture workflow
 * Consumed by: Profile update workflow
 */
"apps-console/neural/profile.update": {
  data: z.object({
    workspaceId: z.string(),
    actorId: z.string(),
    observationId: z.string(),
  }),
},

/**
 * Check cluster for summary generation
 * Emitted by: Observation capture workflow
 * Consumed by: Cluster summary workflow
 */
"apps-console/neural/cluster.check-summary": {
  data: z.object({
    workspaceId: z.string(),
    clusterId: z.string(),
  }),
},
```

**Why**: Type-safe event contracts for neural memory workflows.

### 9. Vercel Webhook Verification

**File**: `packages/console-webhooks/src/vercel.ts`
**Action**: Create

```typescript
import crypto from "crypto";

export interface VercelWebhookPayload {
  type: string;
  id: string;
  createdAt: number;
  region: string;
  payload: {
    team?: { id: string };
    deployment?: {
      id: string;
      name: string;
      url: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubOrg?: string;
        githubRepo?: string;
      };
    };
    project?: {
      id: string;
      name: string;
    };
  };
}

export interface VercelWebhookVerificationResult {
  verified: boolean;
  error?: string;
  payload?: VercelWebhookPayload;
}

/**
 * Verify Vercel webhook signature using HMAC-SHA1
 * Header: x-vercel-signature
 *
 * NOTE: For Vercel Integration webhooks, use the CLIENT_INTEGRATION_SECRET
 * (not a separate webhook secret, per Vercel documentation)
 */
export async function verifyVercelWebhook(
  rawBody: string,
  signature: string | null,
  clientSecret: string
): Promise<VercelWebhookVerificationResult> {
  if (!signature) {
    return { verified: false, error: "Missing x-vercel-signature header" };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha1", clientSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return { verified: false, error: "Signature length mismatch" };
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { verified: false, error: "Invalid signature" };
    }

    const payload = JSON.parse(rawBody) as VercelWebhookPayload;
    return { verified: true, payload };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export type VercelDeploymentEvent =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.error"
  | "deployment.canceled"
  | "deployment.ready";
```

**Why**: Secure webhook verification following Vercel's HMAC-SHA1 pattern.

### 10. Sentry Webhook Verification

**File**: `packages/console-webhooks/src/sentry.ts`
**Action**: Create

```typescript
import crypto from "crypto";

export interface SentryWebhookPayload {
  action: "created" | "resolved" | "assigned" | "ignored" | "unresolved";
  data: {
    issue?: {
      id: string;
      title: string;
      culprit: string;
      permalink: string;
      shortId: string;
      metadata?: {
        type?: string;
        value?: string;
        filename?: string;
        function?: string;
      };
      status: "unresolved" | "resolved" | "ignored";
      platform: string;
      project: {
        id: string;
        name: string;
        slug: string;
      };
      firstSeen: string;
      lastSeen: string;
      count: string;
      userCount: string;
      level: "error" | "warning" | "info" | "fatal";
      assignedTo?: {
        id: string;
        name: string;
        email: string;
      } | null;
    };
    event?: {
      eventId: string;
      release?: { version: string } | null;
      environment?: string;
      platform?: string;
      message?: string;
      datetime?: string;
      tags?: Array<[string, string]>;
      user?: {
        id?: string;
        email?: string;
        username?: string;
        ipAddress?: string;
      } | null;
      exception?: {
        values?: Array<{
          type?: string;
          value?: string;
          stacktrace?: {
            frames?: Array<{
              filename?: string;
              function?: string;
              lineno?: number;
              colno?: number;
              contextLine?: string;
              inApp?: boolean;
            }>;
          };
        }>;
      };
    };
  };
  installation?: {
    uuid: string;
  };
}

export interface SentryWebhookVerificationResult {
  verified: boolean;
  error?: string;
  payload?: SentryWebhookPayload;
}

/**
 * Verify Sentry webhook signature using HMAC-SHA256
 * Header: sentry-hook-signature
 */
export async function verifySentryWebhook(
  rawBody: string,
  signature: string | null,
  clientSecret: string
): Promise<SentryWebhookVerificationResult> {
  if (!signature) {
    return { verified: false, error: "Missing sentry-hook-signature header" };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", clientSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return { verified: false, error: "Signature length mismatch" };
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { verified: false, error: "Invalid signature" };
    }

    const payload = JSON.parse(rawBody) as SentryWebhookPayload;
    return { verified: true, payload };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export type SentryIssueEvent =
  | "issue.created"
  | "issue.resolved"
  | "issue.assigned"
  | "issue.ignored"
  | "issue.unresolved";
```

**Why**: Secure webhook verification following Sentry's HMAC-SHA256 pattern.

### 11. Export Webhook Handlers

**File**: `packages/console-webhooks/src/index.ts`
**Action**: Modify (add exports)

```typescript
// Add these exports:
export * from "./vercel";
export * from "./sentry";
```

**Why**: Make webhook handlers available throughout the codebase.

### 12. Add Vercel Provider to Validation Schema

**File**: `packages/console-validation/src/schemas/sources.ts`
**Action**: Modify

Find `integrationProviderSchema` and add `"vercel"`:

```typescript
export const integrationProviderSchema = z.enum([
  "github",
  "linear",
  "notion",
  "sentry",
  "vercel", // Add this
]);
```

**Why**: Enable Vercel as a valid integration provider type.

### 13. Environment Variables

**File**: `apps/console/src/env.ts`
**Action**: Modify (add variables)

```typescript
// Add to the schema:
// Note: Vercel webhooks use VERCEL_CLIENT_INTEGRATION_SECRET (no separate webhook secret)
SENTRY_CLIENT_SECRET: z.string().optional(),
```

**File**: `api/console/src/env.ts`
**Action**: Modify (add same variables)

```typescript
// Add to the schema:
// Note: Vercel webhooks use VERCEL_CLIENT_INTEGRATION_SECRET (no separate webhook secret)
SENTRY_CLIENT_SECRET: z.string().optional(),
```

**Why**: Sentry webhook secret needed for signature verification. Vercel uses client integration secret.

## Database Changes

```sql
-- Migration: add_neural_memory_tables
-- Description: Create tables for neural memory observations, clusters, entities, profiles, and temporal states

-- See individual table definitions above
-- Migration will be auto-generated by `pnpm db:generate`
```

## Success Criteria

### Automated Verification:
- [ ] Database migration applies cleanly: `cd db/console && pnpm db:generate && pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Webhook packages export correctly: `import { verifyVercelWebhook, verifySentryWebhook } from "@repo/console-webhooks"`
- [ ] Event types are available: `Events["apps-console/neural/observation.capture"]` compiles

### Manual Verification:
- [ ] Drizzle Studio shows new tables: `cd db/console && pnpm db:studio`
- [ ] Tables have correct columns and indexes
- [ ] Environment variables load without errors

## Rollback Plan

1. Run migration rollback (if Drizzle supports) or manually drop tables:
   ```sql
   DROP TABLE IF EXISTS lightfast_workspace_temporal_states;
   DROP TABLE IF EXISTS lightfast_workspace_actor_identities;
   DROP TABLE IF EXISTS lightfast_workspace_actor_profiles;
   DROP TABLE IF EXISTS lightfast_workspace_neural_entities;
   DROP TABLE IF EXISTS lightfast_workspace_observation_clusters;
   DROP TABLE IF EXISTS lightfast_workspace_neural_observations;
   ```

2. Revert code changes via git

3. Remove environment variables

---

**CHECKPOINT**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to [Phase 2](./phase-02-observation-pipeline.md).

---

**Next Phase**: [Phase 2: Observation Pipeline](./phase-02-observation-pipeline.md)
