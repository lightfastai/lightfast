---
date: 2025-12-11T17:45:00+08:00
researcher: Claude
git_commit: 6eb6cc74883fc5f16afd68741c3fd948e4a110e3
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Webhook Transformer Architecture and Raw Data Storage"
tags: [research, codebase, webhooks, transformers, github, vercel, neural-memory]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude
---

# Research: Webhook Transformer Architecture and Raw Data Storage

**Date**: 2025-12-11T17:45:00+08:00
**Researcher**: Claude
**Git Commit**: 6eb6cc74883fc5f16afd68741c3fd948e4a110e3
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

Understand the transformer architecture that transforms Vercel & GitHub webhook data before processing, and verify whether raw webhook data is already stored.

## Summary

The codebase has a well-structured transformer architecture in `packages/console-webhooks/src/transformers/` that converts raw webhook payloads into a standardized `SourceEvent` format. **Raw webhook data is NOT currently stored** - only the transformed `SourceEvent` data is persisted in the `workspace_neural_observations` table.

## Detailed Findings

### Transformer Architecture

The transformer system follows a consistent pattern:

```
Raw Webhook JSON → Transformer Function → SourceEvent → Inngest Event → Database
```

#### Package Structure

```
packages/console-webhooks/
├── src/
│   ├── transformers/
│   │   ├── github.ts         # 5 transformer functions
│   │   ├── vercel.ts         # 1 transformer function
│   │   └── index.ts          # Re-exports
│   ├── github.ts             # Signature verification
│   ├── vercel.ts             # Signature verification
│   ├── common.ts             # Shared utilities
│   ├── types.ts              # Type definitions
│   └── index.ts              # Main entry
```

#### GitHub Transformers (`packages/console-webhooks/src/transformers/github.ts`)

| Function | Event Type | Lines |
|----------|------------|-------|
| `transformGitHubPush` | Push events | 17-79 |
| `transformGitHubPullRequest` | PR events | 84-198 |
| `transformGitHubIssue` | Issue events | 203-272 |
| `transformGitHubRelease` | Release events | 277-329 |
| `transformGitHubDiscussion` | Discussion events | 334-388 |

#### Vercel Transformer (`packages/console-webhooks/src/transformers/vercel.ts`)

| Function | Event Type | Lines |
|----------|------------|-------|
| `transformVercelDeployment` | All deployment events | 14-133 |

### SourceEvent Interface

The standardized event format (`packages/console-types/src/neural/source-event.ts:5-26`):

```typescript
interface SourceEvent {
  source: "github" | "vercel" | "linear" | "sentry";
  sourceType: string;      // e.g., "pull_request_merged"
  sourceId: string;        // Unique: "pr:lightfastai/lightfast#123"
  title: string;           // <=120 chars, embeddable headline
  body: string;            // Full semantic content
  actor?: SourceActor;     // Who performed the action
  occurredAt: string;      // ISO timestamp
  references: SourceReference[];  // Related entities
  metadata: Record<string, unknown>;  // Structured fields
}
```

### Data Flow

#### 1. Webhook Receipt (`apps/console/src/app/(github)/api/github/webhooks/route.ts`)

```typescript
// Line 373-408: POST handler
const payload = await request.text();  // Raw JSON string
const result = await verifyGitHubWebhookFromHeaders(payload, headers, secret);
const body = JSON.parse(payload);  // Parsed but NOT stored
```

#### 2. Transformation (in route handler)

```typescript
// Line 186-194: Transform and send to Inngest
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    sourceEvent: transformGitHubPush(payload, { deliveryId, receivedAt }),
  },
});
```

#### 3. Storage (`api/console/src/inngest/workflow/neural/observation-capture.ts`)

```typescript
// Line 258-279: Store observation
const [obs] = await db.insert(workspaceNeuralObservations).values({
  workspaceId,
  occurredAt: sourceEvent.occurredAt,
  actor: sourceEvent.actor || null,
  observationType,
  title: sourceEvent.title,
  content: sourceEvent.body,        // Semantic content only
  topics,
  source: sourceEvent.source,
  sourceType: sourceEvent.sourceType,
  sourceId: sourceEvent.sourceId,
  sourceReferences: sourceEvent.references,
  metadata: sourceEvent.metadata,   // Structured fields, NOT raw payload
  embeddingVectorId: vectorId,
});
```

### What IS Stored

The `workspace_neural_observations` table (`db/console/src/schema/tables/workspace-neural-observations.ts`) stores:

| Column | Type | Description |
|--------|------|-------------|
| `title` | text | Short summary (<=120 chars) |
| `content` | text | Semantic body (commit message, PR body, etc.) |
| `metadata` | jsonb | **Structured fields extracted during transformation** |
| `sourceReferences` | jsonb | Related entities (commits, branches, PRs) |
| `source` | varchar | Source system (github, vercel) |
| `sourceType` | varchar | Event type |
| `sourceId` | varchar | Unique ID for deduplication |

### What is NOT Stored

**Raw webhook payloads are NOT persisted anywhere.**

For a GitHub push event, the `metadata` field contains:

```typescript
// From transformGitHubPush (lines 66-78)
metadata: {
  deliveryId: context.deliveryId,
  repoFullName: payload.repository.full_name,
  repoId: payload.repository.id,
  branch,
  beforeSha: payload.before,
  afterSha: payload.after,
  commitCount: payload.commits.length,
  fileCount,
  forced: payload.forced,
}
```

**Missing from storage:**
- Full commits array with author details, timestamps, patch data
- Complete repository object (owner, settings, URLs)
- Sender details
- Organization details
- Compare URLs
- Installation details

## Code References

- `packages/console-webhooks/src/transformers/github.ts` - GitHub transformer functions
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel transformer function
- `packages/console-types/src/neural/source-event.ts` - SourceEvent interface
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` - GitHub webhook route handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Vercel webhook route handler
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Observation storage workflow
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Database schema

## Architecture Documentation

### Current Pattern

1. **Verification Layer** (`packages/console-webhooks/src/{github,vercel}.ts`)
   - Signature verification
   - Header extraction (delivery ID, event type)

2. **Transformation Layer** (`packages/console-webhooks/src/transformers/`)
   - Raw payload → SourceEvent
   - Semantic content extraction (title, body)
   - Structured field extraction (metadata)
   - Reference extraction (commits, branches, PRs)

3. **Processing Layer** (`api/console/src/inngest/workflow/neural/`)
   - Idempotency checking via `sourceId`
   - Embedding generation
   - Vector storage (Pinecone)
   - Database storage

### Design Decisions

- **Semantic-first storage**: Only meaningful content is stored for embedding
- **Metadata for structure**: Structured fields in JSONB for flexible querying
- **Idempotency via sourceId**: Prevents duplicate observations
- **Transformation at receipt**: Raw data is discarded after transformation

## Key Finding: Raw Webhook Data Gap

**Raw webhook payloads are NOT stored.** If the transformation logic changes or new fields become relevant, historical raw data cannot be reprocessed. This is a potential limitation if:

1. New use cases require fields not currently extracted
2. Transformer bugs cause data loss
3. Future features need full webhook replay capability
4. Debugging requires seeing the original webhook payload

## Open Questions

1. Should raw webhook payloads be stored for replay/debugging purposes?
2. If so, where should they be stored (same DB, separate storage, S3)?
3. What retention policy should apply to raw webhook data?
4. Should this be configurable per workspace?
