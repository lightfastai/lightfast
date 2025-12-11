# Neural Memory Observation Pipeline Implementation Plan

## Overview

Implement the observation capture pipeline for Lightfast's neural memory system, processing webhook events from GitHub and Vercel into structured observations. This plan focuses on the **write path only** - capturing and storing observations from engineering events.

**Scope:**
- Core database schema (observations + clusters)
- SourceEvent type definitions and transformers
- Observation capture Inngest workflow
- GitHub integration (push, PRs, issues, releases, discussions)
- Vercel integration (deployment events)

**Out of Scope:**
- Entity store and actor profiles (Phase 2)
- Retrieval Governor / read path (Phase 2)
- Cluster summaries and merging (Phase 2)
- LLM relevance filtering (Phase 2)

**Key Architecture Changes (from web analysis 2025-12-11):**
- **Namespace Strategy**: Hybrid approach - workspace-level namespace with layer as metadata (not per-layer namespaces)
- **Embedding Content**: Semantic-only (title + body without verbose labels). Structured fields go to metadata to avoid 30-60% token waste.

## Current State Analysis

### What Exists

**Webhook Infrastructure:**
- GitHub webhook handler: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
  - Handles: push, installation_repositories, installation, repository events
  - Emits `apps-console/github.push` Inngest event
- Vercel webhook handler: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
  - Handles: deployment.* events
  - Has commented-out observation capture code at lines 122-156

**Inngest Infrastructure:**
- Event schemas in `api/console/src/inngest/client/client.ts`
- Workflow patterns established (step.run, step.sendEvent, idempotency, singleton)
- GitHub push handler workflow at `api/console/src/inngest/workflow/providers/github/push-handler.ts`

**Pinecone Infrastructure:**
- Shared index architecture: `lightfast-production-v1`, `lightfast-staging-v1`
- Namespace format: `{orgId}:ws_{workspaceId}:{layer}`
- Cohere embeddings: `embed-english-v3.0`, 1024 dimensions

### What's Missing

1. Database tables for observations and clusters
2. SourceEvent type definitions
3. Source transformers (GitHub/Vercel payloads → SourceEvent)
4. Observation capture Inngest workflow
5. Pinecone namespace layer for observations
6. GitHub webhook routing for PR/issue/release events

## Desired End State

After implementation:

1. **Database**: Two new tables storing observations and clusters
2. **Types**: SourceEvent interface with Zod validation
3. **Transformers**: GitHub and Vercel payload → SourceEvent converters
4. **Workflow**: `neural.observation.capture` Inngest function processing events
5. **Webhooks**: GitHub events (push, PR, issue, release, discussion) captured as observations
6. **Webhooks**: Vercel deployment events captured as observations
7. **Storage**: Observation embeddings stored in Pinecone `observations` namespace

### Success Verification

```bash
# 1. Database schema applied
cd db/console && pnpm db:generate && pnpm db:migrate

# 2. Type checking passes
pnpm typecheck

# 3. Build succeeds
pnpm build:console

# 4. Dev server starts
pnpm dev:console

# 5. Trigger test webhook (GitHub push or Vercel deployment)
# Verify in Inngest dashboard: neural.observation.capture function runs
# Verify in database: observation record created
# Verify in Pinecone: vector upserted to observations namespace
```

---

## What We're NOT Doing

- Entity extraction and entity store
- Actor profiles and identity resolution
- Cluster summaries and LLM-generated summaries
- Retrieval Governor and search API
- LLM relevance filtering (Key 2)
- Multi-view embeddings (title/content/summary) - using single embedding for MVP
- Significance threshold filtering - capturing all events initially

---

## Implementation Approach

**Strategy**: Build from the bottom up - schema first, types second, workflow third, integrations last.

**Key Decisions:**
1. **Single embedding per observation** (not multi-view) for MVP simplicity
2. **No significance filtering** initially - capture all events, filter in read path
3. **Cluster assignment deferred** - observations created without cluster initially
4. **Actor extraction from webhook payload** - no GitHub API calls for author info

---

## Phase 1: Database Schema Foundation

### Overview
Create core database tables for observations and clusters following existing patterns.

### Changes Required:

#### 1. Observations Table
**File**: `db/console/src/schema/tables/workspace-neural-observations.ts` (NEW)

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
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceStores } from "./workspace-stores";

/**
 * Reference to related entities extracted from observation
 */
export interface ObservationReference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project' |
        'cycle' | 'assignee' | 'reviewer' | 'team' | 'label';
  id: string;
  url?: string;
  label?: string;
}

/**
 * Actor who performed the action
 */
export interface ObservationActor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Source-specific metadata
 * NOTE: Use metadata for structured fields (repo, branch, labels, etc.)
 * NOT the content body, to avoid token waste on non-semantic labels.
 * layer field: 'observations' | 'documents' | 'clusters' | 'profiles' (for Pinecone metadata filtering)
 */
export type ObservationMetadata = Record<string, unknown>;

/**
 * Neural observations - atomic engineering events from GitHub, Vercel, etc.
 */
export const workspaceNeuralObservations = pgTable(
  "lightfast_workspace_neural_observations",
  {
    /**
     * Unique observation identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this observation belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Store where observation vectors are stored
     */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => workspaceStores.id, { onDelete: "cascade" }),

    /**
     * Cluster this observation is assigned to (nullable until clustering runs)
     */
    clusterId: varchar("cluster_id", { length: 191 }),

    // ========== TEMPORAL ==========

    /**
     * When the event occurred in the source system
     */
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When the observation was captured
     */
    capturedAt: timestamp("captured_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // ========== ACTOR ==========

    /**
     * Actor who performed the action
     */
    actor: jsonb("actor").$type<ObservationActor | null>(),

    // ========== CONTENT ==========

    /**
     * Observation type (e.g., "pr_merged", "deployment_succeeded")
     */
    observationType: varchar("observation_type", { length: 100 }).notNull(),

    /**
     * Short title (≤120 chars, embeddable headline)
     */
    title: text("title").notNull(),

    /**
     * Full content for detailed embedding
     */
    content: text("content").notNull(),

    // ========== CLASSIFICATION ==========

    /**
     * Topics extracted from content
     */
    topics: jsonb("topics").$type<string[]>(),

    /**
     * Significance score (0-100)
     */
    significanceScore: real("significance_score"),

    // ========== SOURCE ==========

    /**
     * Source system (github, vercel, linear, sentry)
     */
    source: varchar("source", { length: 50 }).notNull(),

    /**
     * Source-specific event type (e.g., "pull_request_merged")
     */
    sourceType: varchar("source_type", { length: 100 }).notNull(),

    /**
     * Unique source identifier (e.g., "pr:lightfastai/lightfast#123")
     */
    sourceId: varchar("source_id", { length: 255 }).notNull(),

    /**
     * References to related entities
     */
    sourceReferences: jsonb("source_references").$type<ObservationReference[]>(),

    /**
     * Source-specific metadata
     */
    metadata: jsonb("metadata").$type<ObservationMetadata>(),

    // ========== EMBEDDINGS ==========

    /**
     * Pinecone vector ID for content embedding
     */
    embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding observations by workspace and time
    workspaceOccurredIdx: index("obs_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),

    // Index for finding observations by cluster
    clusterIdx: index("obs_cluster_idx").on(table.clusterId),

    // Index for finding observations by source
    sourceIdx: index("obs_source_idx").on(
      table.workspaceId,
      table.source,
      table.sourceType,
    ),

    // Index for deduplication by source ID
    sourceIdIdx: index("obs_source_id_idx").on(
      table.workspaceId,
      table.sourceId,
    ),

    // Index for finding observations by type
    typeIdx: index("obs_type_idx").on(
      table.workspaceId,
      table.observationType,
    ),
  }),
);

// Type exports
export type WorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferSelect;
export type InsertWorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferInsert;
```

#### 2. Clusters Table
**File**: `db/console/src/schema/tables/workspace-observation-clusters.ts` (NEW)

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Observation clusters - topic-grouped collections of related observations
 */
export const workspaceObservationClusters = pgTable(
  "lightfast_workspace_observation_clusters",
  {
    /**
     * Unique cluster identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this cluster belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== TOPIC ==========

    /**
     * Human-readable topic label
     */
    topicLabel: varchar("topic_label", { length: 255 }).notNull(),

    /**
     * Pinecone vector ID for cluster centroid embedding
     */
    topicEmbeddingId: varchar("topic_embedding_id", { length: 191 }),

    /**
     * Keywords for fast retrieval
     */
    keywords: jsonb("keywords").$type<string[]>(),

    // ========== SCOPE ==========

    /**
     * Primary entities involved (project IDs, repo names)
     */
    primaryEntities: jsonb("primary_entities").$type<string[]>(),

    /**
     * Primary actors involved (actor IDs)
     */
    primaryActors: jsonb("primary_actors").$type<string[]>(),

    // ========== STATUS ==========

    /**
     * Cluster status: open (receiving observations) or closed
     */
    status: varchar("status", { length: 50 }).notNull().default("open"),

    // ========== SUMMARY ==========

    /**
     * LLM-generated cluster summary
     */
    summary: text("summary"),

    /**
     * When summary was last generated
     */
    summaryGeneratedAt: timestamp("summary_generated_at", {
      mode: "string",
      withTimezone: true,
    }),

    // ========== METRICS ==========

    /**
     * Number of observations in cluster
     */
    observationCount: integer("observation_count").notNull().default(0),

    /**
     * Timestamp of first observation
     */
    firstObservationAt: timestamp("first_observation_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Timestamp of most recent observation
     */
    lastObservationAt: timestamp("last_observation_at", {
      mode: "string",
      withTimezone: true,
    }),

    // ========== TIMESTAMPS ==========

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
    // Index for finding open clusters in workspace
    workspaceStatusIdx: index("cluster_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),

    // Index for finding recently active clusters
    lastObservationIdx: index("cluster_last_observation_idx").on(
      table.workspaceId,
      table.lastObservationAt,
    ),
  }),
);

// Type exports
export type WorkspaceObservationCluster = typeof workspaceObservationClusters.$inferSelect;
export type InsertWorkspaceObservationCluster = typeof workspaceObservationClusters.$inferInsert;
```

#### 3. Export Tables
**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Add exports for new tables

```typescript
// ... existing exports ...

// Neural memory tables
export * from "./workspace-neural-observations";
export * from "./workspace-observation-clusters";
```

#### 4. Define Relations
**File**: `db/console/src/schema/relations.ts`
**Changes**: Add relations for new tables

```typescript
import { workspaceNeuralObservations } from "./tables/workspace-neural-observations";
import { workspaceObservationClusters } from "./tables/workspace-observation-clusters";

// ... existing relations ...

export const workspaceNeuralObservationsRelations = relations(
  workspaceNeuralObservations,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceNeuralObservations.workspaceId],
      references: [orgWorkspaces.id],
    }),
    store: one(workspaceStores, {
      fields: [workspaceNeuralObservations.storeId],
      references: [workspaceStores.id],
    }),
    cluster: one(workspaceObservationClusters, {
      fields: [workspaceNeuralObservations.clusterId],
      references: [workspaceObservationClusters.id],
    }),
  }),
);

export const workspaceObservationClustersRelations = relations(
  workspaceObservationClusters,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceObservationClusters.workspaceId],
      references: [orgWorkspaces.id],
    }),
    observations: many(workspaceNeuralObservations),
  }),
);
```

### Success Criteria:

#### Automated Verification:
- [ ] Schema generation succeeds: `cd db/console && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Tables visible in Drizzle Studio: `cd db/console && pnpm db:studio`
- [ ] Tables created in PlanetScale database

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Core Types and Transformers

### Overview
Define SourceEvent types and create transformers for GitHub and Vercel webhooks.

### Changes Required:

#### 1. SourceEvent Types
**File**: `packages/console-types/src/neural/source-event.ts` (NEW)

```typescript
/**
 * Standardized event format from any source.
 * This is what webhook handlers produce and the pipeline consumes.
 */
export interface SourceEvent {
  // Source identification
  source: 'github' | 'vercel' | 'linear' | 'sentry';
  sourceType: string;        // e.g., "pull_request_merged", "deployment.succeeded"
  sourceId: string;          // Unique ID: "pr:lightfastai/lightfast#123"

  // Content
  title: string;             // ≤120 chars, embeddable headline
  body: string;              // Full content for detailed embedding

  // Actor (source-specific, resolved later)
  actor?: {
    id: string;              // Source-specific ID (e.g., GitHub user ID)
    name: string;            // Display name
    email?: string;          // For cross-source identity resolution
    avatarUrl?: string;
  };

  // Temporal
  occurredAt: string;        // ISO timestamp when event happened

  // Relationships
  references: SourceReference[];

  // Source-specific metadata (passed through to observation)
  metadata: Record<string, unknown>;
}

/**
 * Relationship reference extracted from source event.
 */
export interface SourceReference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project' |
        'cycle' | 'assignee' | 'reviewer' | 'team' | 'label';
  id: string;
  url?: string;
  label?: string;  // Relationship qualifier: "fixes", "closes", "blocks"
}

/**
 * Context for transformation
 */
export interface TransformContext {
  deliveryId: string;        // Webhook delivery ID for idempotency
  receivedAt: Date;          // When webhook was received
}
```

#### 2. Export Types
**File**: `packages/console-types/src/neural/index.ts` (NEW)

```typescript
export * from "./source-event";
```

**File**: `packages/console-types/src/index.ts`
**Changes**: Add neural types export

```typescript
// ... existing exports ...

// Neural memory types
export * from "./neural";
```

#### 3. GitHub Transformer
**File**: `packages/console-webhooks/src/transformers/github.ts` (NEW)

```typescript
import type { SourceEvent, SourceReference, TransformContext } from "@repo/console-types";
import type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";

/**
 * Transform GitHub push event to SourceEvent
 */
export function transformGitHubPush(
  payload: PushEvent,
  context: TransformContext
): SourceEvent {
  const refs: SourceReference[] = [];
  const branch = payload.ref.replace("refs/heads/", "");

  // Add commit references
  refs.push({
    type: "commit",
    id: payload.after,
    url: `${payload.repository.html_url}/commit/${payload.after}`,
  });

  refs.push({
    type: "branch",
    id: branch,
    url: `${payload.repository.html_url}/tree/${branch}`,
  });

  // Add changed file count to title
  const fileCount = payload.commits.reduce(
    (sum, c) => sum + c.added.length + c.modified.length + c.removed.length,
    0
  );

  const title = payload.head_commit?.message?.split("\n")[0]?.slice(0, 100) ||
    `Push to ${branch}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata
  const body = payload.head_commit?.message || "";

  return {
    source: "github",
    sourceType: "push",
    sourceId: `push:${payload.repository.full_name}:${payload.after}`,
    title: `[Push] ${title}`,
    body,  // Semantic content only
    actor: payload.pusher?.name ? {
      id: `github:${payload.pusher.name}`,
      name: payload.pusher.name,
      email: payload.pusher.email || undefined,
    } : undefined,
    occurredAt: payload.head_commit?.timestamp || new Date().toISOString(),
    references: refs,
    metadata: {
      // All structured fields moved to metadata
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      branch,
      beforeSha: payload.before,
      afterSha: payload.after,
      commitCount: payload.commits.length,
      fileCount,
      forced: payload.forced,
    },
  };
}

/**
 * Transform GitHub pull request event to SourceEvent
 */
export function transformGitHubPullRequest(
  payload: PullRequestEvent,
  context: TransformContext
): SourceEvent {
  const pr = payload.pull_request;
  const refs: SourceReference[] = [];

  refs.push({
    type: "pr",
    id: `#${pr.number}`,
    url: pr.html_url,
  });

  refs.push({
    type: "branch",
    id: pr.head.ref,
    url: `${payload.repository.html_url}/tree/${pr.head.ref}`,
  });

  if (pr.head.sha) {
    refs.push({
      type: "commit",
      id: pr.head.sha,
      url: `${payload.repository.html_url}/commit/${pr.head.sha}`,
    });
  }

  // Extract linked issues from body
  const linkedIssues = extractLinkedIssues(pr.body || "");
  for (const issue of linkedIssues) {
    refs.push({
      type: "issue",
      id: issue.id,
      url: issue.url,
      label: issue.label, // "fixes", "closes", etc.
    });
  }

  // Add reviewers
  for (const reviewer of pr.requested_reviewers || []) {
    if ("login" in reviewer) {
      refs.push({
        type: "reviewer",
        id: reviewer.login,
        url: `https://github.com/${reviewer.login}`,
      });
    }
  }

  // Add assignees
  for (const assignee of pr.assignees || []) {
    refs.push({
      type: "assignee",
      id: assignee.login,
      url: `https://github.com/${assignee.login}`,
    });
  }

  // Add labels
  for (const label of pr.labels || []) {
    refs.push({
      type: "label",
      id: typeof label === "string" ? label : label.name || "",
    });
  }

  const actionMap: Record<string, string> = {
    opened: "PR Opened",
    closed: pr.merged ? "PR Merged" : "PR Closed",
    reopened: "PR Reopened",
    review_requested: "Review Requested",
    ready_for_review: "Ready for Review",
  };

  const actionTitle = actionMap[payload.action] || `PR ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata to avoid token waste on non-semantic labels
  const body = [
    pr.title,
    pr.body || "",
  ].join("\n");

  return {
    source: "github",
    sourceType: `pull_request_${payload.action}`,
    sourceId: `pr:${payload.repository.full_name}#${pr.number}`,
    title: `[${actionTitle}] ${pr.title.slice(0, 100)}`,
    body,  // Semantic content only
    actor: pr.user ? {
      id: `github:${pr.user.id}`,
      name: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    } : undefined,
    occurredAt: pr.updated_at || pr.created_at,
    references: refs,
    metadata: {
      // All structured fields moved to metadata (not in body)
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      prNumber: pr.number,
      action: payload.action,
      merged: pr.merged,
      draft: pr.draft,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
      authorLogin: pr.user?.login,
      authorId: pr.user?.id,
    },
  };
}

/**
 * Transform GitHub issues event to SourceEvent
 */
export function transformGitHubIssue(
  payload: IssuesEvent,
  context: TransformContext
): SourceEvent {
  const issue = payload.issue;
  const refs: SourceReference[] = [];

  refs.push({
    type: "issue",
    id: `#${issue.number}`,
    url: issue.html_url,
  });

  // Add assignees
  for (const assignee of issue.assignees || []) {
    refs.push({
      type: "assignee",
      id: assignee.login,
      url: `https://github.com/${assignee.login}`,
    });
  }

  // Add labels
  for (const label of issue.labels || []) {
    refs.push({
      type: "label",
      id: typeof label === "string" ? label : label.name || "",
    });
  }

  const actionMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
    assigned: "Issue Assigned",
    labeled: "Issue Labeled",
  };

  const actionTitle = actionMap[payload.action] || `Issue ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = [
    issue.title,
    issue.body || "",
  ].join("\n");

  return {
    source: "github",
    sourceType: `issue_${payload.action}`,
    sourceId: `issue:${payload.repository.full_name}#${issue.number}`,
    title: `[${actionTitle}] ${issue.title.slice(0, 100)}`,
    body,  // Semantic content only
    actor: issue.user ? {
      id: `github:${issue.user.id}`,
      name: issue.user.login,
      avatarUrl: issue.user.avatar_url,
    } : undefined,
    occurredAt: issue.updated_at || issue.created_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      issueNumber: issue.number,
      action: payload.action,
      state: issue.state,
      authorLogin: issue.user?.login,
      authorId: issue.user?.id,
    },
  };
}

/**
 * Transform GitHub release event to SourceEvent
 */
export function transformGitHubRelease(
  payload: ReleaseEvent,
  context: TransformContext
): SourceEvent {
  const release = payload.release;
  const refs: SourceReference[] = [];

  refs.push({
    type: "branch",
    id: release.target_commitish,
    url: `${payload.repository.html_url}/tree/${release.target_commitish}`,
  });

  const actionMap: Record<string, string> = {
    published: "Release Published",
    created: "Release Created",
    released: "Release Released",
  };

  const actionTitle = actionMap[payload.action] || `Release ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = release.body || "";

  return {
    source: "github",
    sourceType: `release_${payload.action}`,
    sourceId: `release:${payload.repository.full_name}:${release.tag_name}`,
    title: `[${actionTitle}] ${release.name || release.tag_name}`,
    body,  // Semantic content only
    actor: release.author ? {
      id: `github:${release.author.id}`,
      name: release.author.login,
      avatarUrl: release.author.avatar_url,
    } : undefined,
    occurredAt: release.published_at || release.created_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      action: payload.action,
      prerelease: release.prerelease,
      draft: release.draft,
      authorLogin: release.author?.login,
      authorId: release.author?.id,
    },
  };
}

/**
 * Transform GitHub discussion event to SourceEvent
 */
export function transformGitHubDiscussion(
  payload: DiscussionEvent,
  context: TransformContext
): SourceEvent {
  const discussion = payload.discussion;
  const refs: SourceReference[] = [];

  // Add category
  if (discussion.category) {
    refs.push({
      type: "label",
      id: discussion.category.name,
    });
  }

  const actionMap: Record<string, string> = {
    created: "Discussion Created",
    answered: "Discussion Answered",
    closed: "Discussion Closed",
  };

  const actionTitle = actionMap[payload.action] || `Discussion ${payload.action}`;

  // SEMANTIC CONTENT ONLY (for embedding)
  const body = [
    discussion.title,
    discussion.body || "",
  ].join("\n");

  return {
    source: "github",
    sourceType: `discussion_${payload.action}`,
    sourceId: `discussion:${payload.repository.full_name}#${discussion.number}`,
    title: `[${actionTitle}] ${discussion.title.slice(0, 100)}`,
    body,  // Semantic content only
    actor: discussion.user ? {
      id: `github:${discussion.user.id}`,
      name: discussion.user.login,
      avatarUrl: discussion.user.avatar_url,
    } : undefined,
    occurredAt: discussion.updated_at || discussion.created_at,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      discussionNumber: discussion.number,
      action: payload.action,
      category: discussion.category?.name,
      answered: discussion.answer_html_url !== null,
      authorLogin: discussion.user?.login,
      authorId: discussion.user?.id,
    },
  };
}

/**
 * Extract linked issues from PR/issue body
 * Matches: fixes #123, closes #123, resolves #123
 */
function extractLinkedIssues(body: string): Array<{ id: string; url?: string; label: string }> {
  const pattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  const matches: Array<{ id: string; url?: string; label: string }> = [];
  let match;

  while ((match = pattern.exec(body)) !== null) {
    matches.push({
      id: `#${match[2]}`,
      label: match[1]?.toLowerCase().replace(/e?s$/, "") || "fixes",
    });
  }

  return matches;
}

// Export all transformers
export const githubTransformers = {
  push: transformGitHubPush,
  pull_request: transformGitHubPullRequest,
  issues: transformGitHubIssue,
  release: transformGitHubRelease,
  discussion: transformGitHubDiscussion,
};
```

#### 4. Vercel Transformer
**File**: `packages/console-webhooks/src/transformers/vercel.ts` (NEW)

```typescript
import type { SourceEvent, SourceReference, TransformContext } from "@repo/console-types";
import type { VercelWebhookPayload, VercelDeploymentEvent } from "../vercel";

/**
 * Transform Vercel deployment event to SourceEvent
 */
export function transformVercelDeployment(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
  context: TransformContext
): SourceEvent {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;
  const gitMeta = deployment.meta;

  const refs: SourceReference[] = [];

  // Add commit reference
  if (gitMeta?.githubCommitSha) {
    refs.push({
      type: "commit",
      id: gitMeta.githubCommitSha,
      url: gitMeta.githubOrg && gitMeta.githubRepo
        ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`
        : undefined,
    });
  }

  // Add branch reference
  if (gitMeta?.githubCommitRef) {
    refs.push({
      type: "branch",
      id: gitMeta.githubCommitRef,
      url: gitMeta.githubOrg && gitMeta.githubRepo
        ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/tree/${gitMeta.githubCommitRef}`
        : undefined,
    });
  }

  // Add deployment reference
  refs.push({
    type: "deployment",
    id: deployment.id,
    url: deployment.url ? `https://${deployment.url}` : undefined,
  });

  // Add project reference
  refs.push({
    type: "project",
    id: project.id,
  });

  const eventTitleMap: Record<VercelDeploymentEvent, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.ready": "Deployment Ready",
    "deployment.canceled": "Deployment Canceled",
    "deployment.error": "Deployment Failed",
  };

  const actionTitle = eventTitleMap[eventType] || "Deployment";
  const branch = gitMeta?.githubCommitRef || "unknown";
  const isProduction = deployment.url?.includes(project.name) && !deployment.url?.includes("-");

  const emoji = eventType === "deployment.succeeded" || eventType === "deployment.ready"
    ? "✅"
    : eventType === "deployment.error"
    ? "❌"
    : eventType === "deployment.canceled"
    ? "⚠️"
    : "🚀";

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata
  const body = [
    `${emoji} ${actionTitle}`,
    gitMeta?.githubCommitMessage ? gitMeta.githubCommitMessage : "",
  ].filter(Boolean).join("\n");

  return {
    source: "vercel",
    sourceType: eventType,
    sourceId: `deployment:${deployment.id}`,
    title: `[${actionTitle}] ${project.name} from ${branch}`,
    body,
    actor: gitMeta?.githubCommitAuthorName ? {
      id: `github:${gitMeta.githubCommitAuthorName}`,
      name: gitMeta.githubCommitAuthorName,
    } : undefined,
    occurredAt: new Date(payload.createdAt).toISOString(),
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      webhookId: payload.id,
      deploymentId: deployment.id,
      deploymentUrl: deployment.url,
      projectId: project.id,
      projectName: project.name,
      teamId: team?.id,
      environment: isProduction ? "production" : "preview",
      branch,
      region: payload.region,
      gitCommitSha: gitMeta?.githubCommitSha,
      gitCommitRef: gitMeta?.githubCommitRef,
      gitCommitMessage: gitMeta?.githubCommitMessage,
      gitCommitAuthor: gitMeta?.githubCommitAuthorName,
      gitRepo: gitMeta?.githubRepo,
      gitOrg: gitMeta?.githubOrg,
    },
  };
}

export const vercelTransformers = {
  deployment: transformVercelDeployment,
};
```

#### 5. Export Transformers
**File**: `packages/console-webhooks/src/transformers/index.ts` (NEW)

```typescript
export * from "./github";
export * from "./vercel";
```

**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Add transformers export

```typescript
// ... existing exports ...

// Transformers
export * from "./transformers";
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Package builds: `pnpm --filter @repo/console-webhooks build`
- [ ] Console types build: `pnpm --filter @repo/console-types build`

#### Manual Verification:
- [ ] Import works from consumer package

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Observation Capture Workflow

### Overview
Create Inngest workflow that processes SourceEvents into observations with embeddings.

### Changes Required:

#### 1. Inngest Event Schema
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Add neural observation events

```typescript
// Add to eventsMap object (around line 19)

/**
 * Neural observation capture event
 */
"apps-console/neural/observation.capture": {
  data: z.object({
    workspaceId: z.string(),
    storeId: z.string(),
    sourceEvent: z.object({
      source: z.enum(["github", "vercel", "linear", "sentry"]),
      sourceType: z.string(),
      sourceId: z.string(),
      title: z.string(),
      body: z.string(),
      actor: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().optional(),
        avatarUrl: z.string().optional(),
      }).optional(),
      occurredAt: z.string().datetime(),
      references: z.array(z.object({
        type: z.enum([
          "commit", "branch", "pr", "issue", "deployment", "project",
          "cycle", "assignee", "reviewer", "team", "label"
        ]),
        id: z.string(),
        url: z.string().optional(),
        label: z.string().optional(),
      })),
      metadata: z.record(z.unknown()),
    }),
  }),
},

/**
 * Neural observation captured (completion event)
 */
"apps-console/neural/observation.captured": {
  data: z.object({
    workspaceId: z.string(),
    observationId: z.string(),
    sourceId: z.string(),
    observationType: z.string(),
  }),
},
```

#### 2. Observation Capture Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` (NEW)

```typescript
import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceStores, orgWorkspaces } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { NonRetriableError } from "inngest";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import type { SourceEvent } from "@repo/console-types";

/**
 * Map source event types to observation types
 */
function deriveObservationType(sourceEvent: SourceEvent): string {
  // For GitHub events, use sourceType directly
  // e.g., "push", "pull_request_merged", "issue_opened"
  if (sourceEvent.source === "github") {
    return sourceEvent.sourceType;
  }

  // For Vercel events, simplify the type
  // e.g., "deployment.succeeded" → "deployment_succeeded"
  if (sourceEvent.source === "vercel") {
    return sourceEvent.sourceType.replace(".", "_");
  }

  return sourceEvent.sourceType;
}

/**
 * Extract topics from source event
 * Simple keyword extraction for MVP
 */
function extractTopics(sourceEvent: SourceEvent): string[] {
  const topics: string[] = [];

  // Add source as topic
  topics.push(sourceEvent.source);

  // Add observation type
  topics.push(deriveObservationType(sourceEvent));

  // Extract from labels
  for (const ref of sourceEvent.references) {
    if (ref.type === "label") {
      topics.push(ref.id.toLowerCase());
    }
  }

  // Extract common keywords from title
  const keywords = ["fix", "feat", "refactor", "test", "docs", "chore", "ci", "perf"];
  const titleLower = sourceEvent.title.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return [...new Set(topics)]; // Deduplicate
}

/**
 * Build namespace for workspace (hybrid approach)
 * Use single namespace per workspace with layer as metadata field (not namespace suffix)
 * See: https://github.com/lightfastai/lightfast/blob/main/thoughts/shared/research/2025-12-11-web-analysis-neural-memory-architecture-implications.md
 */
function buildWorkspaceNamespace(clerkOrgId: string, workspaceId: string): string {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 */
export const observationCapture = inngest.createFunction(
  {
    id: "apps-console/neural.observation.capture",
    name: "Neural Observation Capture",
    description: "Captures engineering events as neural observations",
    retries: 3,

    // Idempotency by source ID to prevent duplicate observations
    idempotency: "event.data.sourceEvent.sourceId",

    // Concurrency limit per workspace
    concurrency: {
      limit: 10,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "1m",
      finish: "5m",
    },
  },
  { event: "apps-console/neural/observation.capture" },
  async ({ event, step }) => {
    const { workspaceId, storeId, sourceEvent } = event.data;
    const startTime = Date.now();

    log.info("Capturing neural observation", {
      workspaceId,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      sourceId: sourceEvent.sourceId,
    });

    // Step 1: Check for duplicate
    const existing = await step.run("check-duplicate", async () => {
      const obs = await db.query.workspaceNeuralObservations.findFirst({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.sourceId, sourceEvent.sourceId),
        ),
      });

      if (obs) {
        log.info("Observation already exists, skipping", {
          observationId: obs.id,
          sourceId: sourceEvent.sourceId,
        });
      }

      return obs ?? null;
    });

    if (existing) {
      return {
        status: "duplicate",
        observationId: existing.id,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Fetch workspace and store
    const { workspace, store } = await step.run("fetch-context", async () => {
      const [ws, st] = await Promise.all([
        db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        }),
        db.query.workspaceStores.findFirst({
          where: eq(workspaceStores.id, storeId),
        }),
      ]);

      if (!ws) {
        throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
      }
      if (!st) {
        throw new NonRetriableError(`Store not found: ${storeId}`);
      }

      return { workspace: ws, store: st };
    });

    // Step 3: Generate embedding
    const { embeddingVector, vectorId } = await step.run("generate-embedding", async () => {
      const embeddingProvider = createEmbeddingProviderForStore({
        apiKey: process.env.COHERE_API_KEY!,
        model: "embed-english-v3.0",
        dimension: 1024,
        inputType: "search_document",
      });

      // Combine title and body for embedding
      const textToEmbed = `${sourceEvent.title}\n\n${sourceEvent.body}`;
      const result = await embeddingProvider.embed([textToEmbed]);

      if (!result.embeddings[0]) {
        throw new Error("Failed to generate embedding");
      }

      // Generate vector ID
      const vectorId = `obs_${sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;

      return {
        embeddingVector: result.embeddings[0],
        vectorId,
      };
    });

    // Step 4: Upsert to Pinecone
    await step.run("upsert-vector", async () => {
      const namespace = buildWorkspaceNamespace(
        workspace.clerkOrgId,
        workspaceId
      );

      await consolePineconeClient.upsertVectors(
        store.indexName,
        [
          {
            id: vectorId,
            values: embeddingVector,
            metadata: {
              layer: "observations", // Hybrid approach: filter by layer in metadata
              observationType: deriveObservationType(sourceEvent),
              source: sourceEvent.source,
              sourceType: sourceEvent.sourceType,
              sourceId: sourceEvent.sourceId,
              title: sourceEvent.title,
              snippet: sourceEvent.body.slice(0, 500),
              occurredAt: sourceEvent.occurredAt,
              actorName: sourceEvent.actor?.name || "unknown",
            },
          },
        ],
        namespace
      );

      log.info("Vector upserted to Pinecone", {
        vectorId,
        namespace,
        indexName: store.indexName,
      });
    });

    // Step 5: Store observation in database
    const observation = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(sourceEvent);
      const topics = extractTopics(sourceEvent);

      const [obs] = await db
        .insert(workspaceNeuralObservations)
        .values({
          workspaceId,
          storeId,
          occurredAt: sourceEvent.occurredAt,
          actor: sourceEvent.actor || null,
          observationType,
          title: sourceEvent.title,
          content: sourceEvent.body,
          topics,
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          sourceId: sourceEvent.sourceId,
          sourceReferences: sourceEvent.references,
          metadata: sourceEvent.metadata,
          embeddingVectorId: vectorId,
        })
        .returning();

      log.info("Observation stored in database", {
        observationId: obs.id,
        observationType,
      });

      return obs;
    });

    // Step 6: Emit completion event
    await step.sendEvent("emit-captured", {
      name: "apps-console/neural/observation.captured",
      data: {
        workspaceId,
        observationId: observation.id,
        sourceId: sourceEvent.sourceId,
        observationType: observation.observationType,
      },
    });

    return {
      status: "captured",
      observationId: observation.id,
      observationType: observation.observationType,
      duration: Date.now() - startTime,
    };
  }
);
```

#### 3. Export Workflow
**File**: `api/console/src/inngest/workflow/neural/index.ts` (NEW)

```typescript
export { observationCapture } from "./observation-capture";
```

**File**: `api/console/src/inngest/index.ts`
**Changes**: Register neural workflow

```typescript
import { observationCapture } from "./workflow/neural";

// Add to functions array (around line 93-117)
export const functions = [
  // ... existing functions ...
  observationCapture,
];
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] API builds: `pnpm --filter @api/console build`
- [ ] Console builds: `pnpm build:console`

#### Manual Verification:
- [ ] Inngest function appears in Inngest dashboard
- [ ] Function schema validates correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Webhook Integration

### Overview
Wire up webhook handlers to emit observation capture events.

### Changes Required:

#### 1. Update Vercel Webhook Handler
**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
**Changes**: Enable observation capture (uncomment and modify existing code)

At the top of the file, add import:
```typescript
import { inngest } from "@api/console/inngest";
import { transformVercelDeployment } from "@repo/console-webhooks";
```

Replace lines 103-156 (the commented-out code) with:

```typescript
    // Emit observation capture event
    await inngest.send({
      name: "apps-console/neural/observation.capture",
      data: {
        workspaceId,
        storeId: store.id,
        sourceEvent: transformVercelDeployment(
          payload,
          eventType as VercelDeploymentEvent,
          {
            deliveryId: payload.id,
            receivedAt: new Date(),
          }
        ),
      },
    });

    log.info("[Vercel Webhook] Observation capture triggered", {
      workspaceId,
      eventType,
      deploymentId: deployment.id,
    });
```

#### 2. Update GitHub Webhook Handler
**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Changes**: Add handling for PR, issue, release, discussion events

Add imports at top:
```typescript
import { inngest } from "@api/console/inngest";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "@repo/console-webhooks";
```

Add new handler functions:

```typescript
/**
 * Handle GitHub pull request events
 */
async function handlePullRequestEvent(
  payload: PullRequestEvent,
  deliveryId: string
): Promise<void> {
  // Only capture significant PR actions
  const significantActions = ["opened", "closed", "reopened", "ready_for_review"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  if (!workspace) {
    console.log(`[Webhook] No workspace for GitHub org: ${ownerLogin}`);
    return;
  }

  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspace.workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) {
    console.log(`[Webhook] No default store for workspace: ${workspace.workspaceId}`);
    return;
  }

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      storeId: store.id,
      sourceEvent: transformGitHubPullRequest(payload, {
        deliveryId,
        receivedAt: new Date(),
      }),
    },
  });
}

/**
 * Handle GitHub issues events
 */
async function handleIssuesEvent(
  payload: IssuesEvent,
  deliveryId: string
): Promise<void> {
  // Only capture significant issue actions
  const significantActions = ["opened", "closed", "reopened"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  if (!workspace) return;

  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspace.workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) return;

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      storeId: store.id,
      sourceEvent: transformGitHubIssue(payload, {
        deliveryId,
        receivedAt: new Date(),
      }),
    },
  });
}

/**
 * Handle GitHub release events
 */
async function handleReleaseEvent(
  payload: ReleaseEvent,
  deliveryId: string
): Promise<void> {
  // Only capture published releases
  if (payload.action !== "published") {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  if (!workspace) return;

  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspace.workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) return;

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      storeId: store.id,
      sourceEvent: transformGitHubRelease(payload, {
        deliveryId,
        receivedAt: new Date(),
      }),
    },
  });
}

/**
 * Handle GitHub discussion events
 */
async function handleDiscussionEvent(
  payload: DiscussionEvent,
  deliveryId: string
): Promise<void> {
  // Only capture created and answered discussions
  const significantActions = ["created", "answered"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  if (!workspace) return;

  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspace.workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) return;

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      storeId: store.id,
      sourceEvent: transformGitHubDiscussion(payload, {
        deliveryId,
        receivedAt: new Date(),
      }),
    },
  });
}
```

Update the event routing in `POST` handler (around line 184-238):

```typescript
    // Route to appropriate handler
    switch (eventType) {
      case "push":
        await handlePushEvent(payload as PushEvent, deliveryId);
        // Also capture as observation
        await handlePushObservation(payload as PushEvent, deliveryId);
        break;

      case "pull_request":
        await handlePullRequestEvent(payload as PullRequestEvent, deliveryId);
        break;

      case "issues":
        await handleIssuesEvent(payload as IssuesEvent, deliveryId);
        break;

      case "release":
        await handleReleaseEvent(payload as ReleaseEvent, deliveryId);
        break;

      case "discussion":
        await handleDiscussionEvent(payload as DiscussionEvent, deliveryId);
        break;

      case "installation_repositories":
        await handleInstallationRepositoriesEvent(
          payload as InstallationRepositoriesEvent
        );
        break;

      case "installation":
        // ... existing code ...
        break;

      case "repository":
        // ... existing code ...
        break;

      default:
        console.log(`[Webhook] Unhandled GitHub event type: ${eventType}`);
    }
```

Add push observation handler (separate from sync routing):

```typescript
/**
 * Capture push event as observation (separate from sync routing)
 */
async function handlePushObservation(
  payload: PushEvent,
  deliveryId: string
): Promise<void> {
  // Only capture pushes to default branch
  const branch = payload.ref.replace("refs/heads/", "");
  if (branch !== payload.repository.default_branch) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  if (!workspace) return;

  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspace.workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) return;

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      storeId: store.id,
      sourceEvent: transformGitHubPush(payload, {
        deliveryId,
        receivedAt: new Date(),
      }),
    },
  });
}
```

#### 3. Update GitHub App Webhook Subscriptions
**Action Required**: Update GitHub App settings to receive additional events

Navigate to GitHub App settings and enable these webhook events:
- `Pull requests` (pull_request)
- `Issues` (issues)
- `Releases` (release)
- `Discussions` (discussion)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Console builds: `pnpm build:console`
- [ ] Dev server starts: `pnpm dev:console`

#### Manual Verification:
- [ ] Trigger a Vercel deployment → observation captured
- [ ] Push to GitHub repo → observation captured
- [ ] Open a PR → observation captured
- [ ] Open an issue → observation captured
- [ ] Observations visible in database
- [ ] Vectors visible in Pinecone (observations namespace)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Verification and Testing

### Overview
End-to-end verification of the observation pipeline.

### Test Scenarios:

#### 1. Vercel Deployment Test
```bash
# 1. Trigger a deployment (push to Vercel-connected repo)
git commit --allow-empty -m "test: trigger vercel deployment"
git push

# 2. Check Inngest dashboard for neural.observation.capture function run

# 3. Query database for observation
psql -c "SELECT id, observation_type, title FROM lightfast_workspace_neural_observations WHERE source = 'vercel' ORDER BY created_at DESC LIMIT 5;"
```

#### 2. GitHub Push Test
```bash
# 1. Push to GitHub repo
git commit --allow-empty -m "test: trigger github push observation"
git push

# 2. Check Inngest dashboard

# 3. Query database
psql -c "SELECT id, observation_type, title FROM lightfast_workspace_neural_observations WHERE source = 'github' AND observation_type = 'push' ORDER BY created_at DESC LIMIT 5;"
```

#### 3. GitHub PR Test
```bash
# 1. Create a PR via GitHub CLI
gh pr create --title "Test PR for observation" --body "Testing neural memory capture"

# 2. Check Inngest dashboard

# 3. Query database
psql -c "SELECT id, observation_type, title FROM lightfast_workspace_neural_observations WHERE source = 'github' AND observation_type LIKE 'pull_request%' ORDER BY created_at DESC LIMIT 5;"
```

#### 4. Pinecone Verification
```bash
# Check vector count in observations namespace
# Use Pinecone console or API to verify vectors exist
```

### Success Criteria:

#### Automated Verification:
- [ ] All builds pass: `pnpm build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Vercel deployment creates observation
- [ ] GitHub push creates observation
- [ ] GitHub PR creates observation
- [ ] GitHub issue creates observation (if enabled)
- [ ] All observations have embeddings in Pinecone
- [ ] No duplicate observations for same source event
- [ ] Idempotency works (re-processing same webhook doesn't create duplicate)

---

## Testing Strategy

### Unit Tests

Create tests for transformers:

**File**: `packages/console-webhooks/src/transformers/__tests__/github.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { transformGitHubPush, transformGitHubPullRequest } from "../github";

describe("GitHub Transformers", () => {
  describe("transformGitHubPush", () => {
    it("should transform push event to SourceEvent", () => {
      const payload = {
        ref: "refs/heads/main",
        after: "abc123",
        before: "def456",
        repository: {
          full_name: "lightfastai/lightfast",
          html_url: "https://github.com/lightfastai/lightfast",
        },
        commits: [
          { added: ["a.ts"], modified: ["b.ts"], removed: [] },
        ],
        head_commit: {
          message: "feat: add feature",
          timestamp: "2025-01-01T00:00:00Z",
        },
        pusher: { name: "user", email: "user@example.com" },
      };

      const result = transformGitHubPush(payload as any, {
        deliveryId: "test-123",
        receivedAt: new Date(),
      });

      expect(result.source).toBe("github");
      expect(result.sourceType).toBe("push");
      expect(result.title).toContain("[Push]");
      expect(result.references).toHaveLength(2); // commit + branch
    });
  });
});
```

### Integration Tests

Test the full pipeline with mock webhooks:

```typescript
// Test that webhook → Inngest → database → Pinecone flow works
```

---

## Performance Considerations

1. **Embedding Generation**: Cohere API has rate limits. The workflow handles this via Inngest retries.

2. **Database Writes**: Single observation insert per event. No batch optimization needed initially.

3. **Pinecone Upserts**: Single vector per observation. Batch optimization can be added later if needed.

4. **Concurrency**: Limited to 10 concurrent observations per workspace to prevent overload.

---

## Migration Notes

This is a greenfield implementation - no existing data to migrate.

Future considerations:
- Backfill historical events from GitHub/Vercel APIs
- Migrate existing knowledge documents to observations (if desired)

---

## References

- Design document: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
- Vercel webhook handler: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
- GitHub webhook handler: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- Existing Inngest patterns: `api/console/src/inngest/workflow/`
- Database schema patterns: `db/console/src/schema/tables/`
