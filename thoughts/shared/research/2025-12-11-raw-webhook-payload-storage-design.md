---
date: 2025-12-11T20:00:50+08:00
researcher: Claude
git_commit: 6eb6cc74883fc5f16afd68741c3fd948e4a110e3
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Raw Webhook Payload Storage Design for Replay Capability"
tags: [research, design, webhooks, database, replay, github, vercel]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude
---

# Research: Raw Webhook Payload Storage Design for Replay Capability

**Date**: 2025-12-11T20:00:50+08:00
**Researcher**: Claude
**Git Commit**: 6eb6cc74883fc5f16afd68741c3fd948e4a110e3
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

Design a system to store raw webhook payloads for replay capability. Requirements:
- Store in database
- Retention forever (no expiration)
- Not configurable per workspace - every workspace does this
- Purpose: replay ability for potential future reprocessing

## Summary

This document presents a design for storing raw webhook payloads in a new dedicated table `workspace_webhook_payloads`. The system captures the complete, unmodified webhook JSON immediately after signature verification, linked to the workspace via the same resolution logic used for observations. This enables future reprocessing if transformer logic changes, debugging of webhook issues, and complete audit trail of all received webhooks.

## Current State Analysis

### What EXISTS Today

Based on research in `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md`:

1. **Raw payloads are NOT stored** - Only transformed `SourceEvent` data persists
2. **Transformers extract selected fields** into `metadata` JSONB (not complete payload)
3. **Capture points exist** - Raw text payload available at:
   - GitHub: `apps/console/src/app/(github)/api/github/webhooks/route.ts:376`
   - Vercel: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:112`

### Current Data Flow

```
Raw Webhook → request.text() → Verify Signature → Parse JSON → Transform → Inngest → Database
                    ↑                                               ↓
              CAPTURE POINT                                    SourceEvent only
              (line 376/112)                                   (raw data lost)
```

## Design: Raw Webhook Payload Storage

### New Table: `workspace_webhook_payloads`

```typescript
// db/console/src/schema/tables/workspace-webhook-payloads.ts

import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceWebhookPayloads = pgTable(
  "lightfast_workspace_webhook_payloads",
  {
    // Primary Key
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Workspace reference (cascade delete when workspace deleted)
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Webhook identification
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),
    source: varchar("source", { length: 50 }).notNull(), // "github" | "vercel"
    eventType: varchar("event_type", { length: 100 }).notNull(), // "push", "pull_request", "deployment.succeeded"

    // Raw payload storage
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    // Headers (for complete replay - contains signatures, user agents, etc.)
    headers: jsonb("headers").$type<Record<string, string>>(),

    // Timestamps
    receivedAt: timestamp("received_at", { mode: "string", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary query pattern: find payloads by workspace + time range
    workspaceReceivedIdx: index("webhook_payload_workspace_received_idx").on(
      table.workspaceId,
      table.receivedAt,
    ),
    // Find specific delivery for replay
    deliveryIdx: index("webhook_payload_delivery_idx").on(
      table.deliveryId,
    ),
    // Filter by source/type within workspace
    workspaceSourceIdx: index("webhook_payload_workspace_source_idx").on(
      table.workspaceId,
      table.source,
      table.eventType,
    ),
  }),
);

export type WorkspaceWebhookPayload = typeof workspaceWebhookPayloads.$inferSelect;
export type NewWorkspaceWebhookPayload = typeof workspaceWebhookPayloads.$inferInsert;
```

### Schema Design Rationale

| Column | Type | Purpose |
|--------|------|---------|
| `id` | varchar(191) | Standard nanoid PK |
| `workspaceId` | varchar(191) FK | Links payload to workspace for isolation and cascade delete |
| `deliveryId` | varchar(191) | GitHub/Vercel delivery ID - links to `sourceEvent.metadata.deliveryId` |
| `source` | varchar(50) | "github" or "vercel" - for filtering |
| `eventType` | varchar(100) | Raw event type before transformation |
| `payload` | jsonb | **Complete unmodified webhook body** |
| `headers` | jsonb | Optional: Webhook headers for complete replay |
| `receivedAt` | timestamp | When webhook was received (for ordering/filtering) |
| `createdAt` | timestamp | When record was created (audit) |

### Why Separate Table (Not in `workspace_neural_observations`)

1. **Size**: Raw payloads can be large (GitHub push with many commits = 100KB+)
2. **Query patterns differ**: Observations queried by semantic search; payloads queried for replay
3. **1:N relationship**: One webhook can generate multiple observations (e.g., push with multiple commits in future)
4. **Independent lifecycle**: Payloads stored before observation processing; if processing fails, payload still exists
5. **Indexing**: Observations indexed for semantic search; payloads only need time-based retrieval

## Implementation Plan

### Phase 1: Schema & Storage Service

#### 1.1 Create Table Schema

File: `db/console/src/schema/tables/workspace-webhook-payloads.ts`

```typescript
// See schema definition above
```

Update exports in `db/console/src/schema/tables/index.ts`:
```typescript
export * from "./workspace-webhook-payloads";
```

#### 1.2 Create Storage Service

File: `packages/console-webhooks/src/storage.ts`

```typescript
import { db } from "@db/console";
import { workspaceWebhookPayloads } from "@db/console/schema";

export interface StoreWebhookPayloadParams {
  workspaceId: string;
  deliveryId: string;
  source: "github" | "vercel";
  eventType: string;
  payload: string; // Raw JSON string
  headers?: Record<string, string>;
  receivedAt: Date;
}

export async function storeWebhookPayload(params: StoreWebhookPayloadParams): Promise<string> {
  const [record] = await db
    .insert(workspaceWebhookPayloads)
    .values({
      workspaceId: params.workspaceId,
      deliveryId: params.deliveryId,
      source: params.source,
      eventType: params.eventType,
      payload: JSON.parse(params.payload),
      headers: params.headers,
      receivedAt: params.receivedAt.toISOString(),
    })
    .returning({ id: workspaceWebhookPayloads.id });

  return record.id;
}
```

### Phase 2: Webhook Route Handler Modifications

#### 2.1 GitHub Webhook Handler

File: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

**Key modification points:**

```typescript
// After line 397 (after signature verification succeeds)
const deliveryId = request.headers.get("x-github-delivery") ?? "unknown";

// Store raw payload AFTER verification but BEFORE event routing
// This requires workspace resolution first

// For observation-generating events (push, pull_request, issues, release, discussion)
// Store after workspace is resolved in each handler

// Example modification to handlePushObservation (lines 163-200):
async function handlePushObservation(payload: PushEvent, deliveryId: string) {
  const receivedAt = new Date();
  // ... existing branch filter logic ...

  const workspace = await workspacesService.findWorkspaceByGitHubOrgSlug(/*...*/);
  if (!workspace) return;

  // NEW: Store raw webhook payload
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "push",
    payload: JSON.stringify(payload), // Re-serialize the parsed payload
    headers: extractRelevantHeaders(request.headers),
    receivedAt,
  });

  // Existing: Send to Inngest for observation processing
  await inngest.send({/*...*/});
}
```

**Challenge**: The raw payload (`request.text()`) is consumed at line 376, then parsed. By the time we reach event handlers, we have the parsed object. Solutions:

**Option A** (Recommended): Pass raw payload string through handlers
```typescript
// Line 376
const rawPayload = await request.text();
// Line 399
const body = JSON.parse(rawPayload);
// Pass rawPayload to handlers alongside parsed body
await handlePushObservation(body as PushEvent, deliveryId, rawPayload);
```

**Option B**: Re-serialize the parsed object (slight overhead, maintains exact JSON)
```typescript
// In handlers
payload: JSON.stringify(payload)
```

**Option C**: Store payload earlier, before parsing
```typescript
// After verification at line 381, before parsing
// Requires early workspace resolution or storing without workspace reference
```

#### 2.2 Vercel Webhook Handler

File: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

Similar pattern - store after workspace resolution in `handleDeploymentEvent`:

```typescript
async function handleDeploymentEvent(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
  rawPayload: string, // NEW parameter
) {
  const receivedAt = new Date();
  // ... existing logic ...

  const workspaceId = await findWorkspaceForVercelProject(/*...*/);
  if (!workspaceId) return;

  // NEW: Store raw webhook payload
  await storeWebhookPayload({
    workspaceId,
    deliveryId: payload.id,
    source: "vercel",
    eventType,
    payload: rawPayload,
    receivedAt,
  });

  // Existing: Send to Inngest
  await inngest.send({/*...*/});
}
```

### Phase 3: Data Flow (After Implementation)

```
Raw Webhook
     ↓
request.text() ─────────────────────────────────────────────┐
     ↓                                                      │
Verify Signature                                            │
     ↓                                                      │
Parse JSON                                                  │
     ↓                                                      │
Resolve Workspace ──────────────────────────────────────────┤
     ↓                                                      │
┌────┴────┐                                                 │
│ NEW     │                                                 │
│ Store   │◄────────────────────────────────────────────────┘
│ Payload │  (workspaceId + deliveryId + rawPayload + headers)
└────┬────┘
     ↓
Transform to SourceEvent
     ↓
Send to Inngest
     ↓
Store Observation (with deliveryId in metadata)
```

### Phase 4: Future Replay API (Optional)

```typescript
// api/console/src/router/admin/replay.ts (future)

export const replayRouter = createTRPCRouter({
  // Replay a single webhook
  replayWebhook: adminProcedure
    .input(z.object({ payloadId: z.string() }))
    .mutation(async ({ input }) => {
      const payload = await db.query.workspaceWebhookPayloads.findFirst({
        where: eq(workspaceWebhookPayloads.id, input.payloadId),
      });

      if (!payload) throw new TRPCError({ code: "NOT_FOUND" });

      // Re-run transformation with current transformer logic
      const sourceEvent = await transformWebhookPayload(
        payload.source,
        payload.eventType,
        payload.payload,
      );

      // Re-trigger observation capture
      await inngest.send({
        name: "apps-console/neural/observation.capture",
        data: {
          workspaceId: payload.workspaceId,
          sourceEvent,
          isReplay: true,
        },
      });
    }),

  // Bulk replay for a time range
  replayRange: adminProcedure
    .input(z.object({
      workspaceId: z.string(),
      source: z.enum(["github", "vercel"]).optional(),
      from: z.string().datetime(),
      to: z.string().datetime(),
    }))
    .mutation(async ({ input }) => {
      // ... batch replay logic
    }),
});
```

## Linking Strategy

### deliveryId as Primary Link

The `deliveryId` serves as the connection between:
1. **Raw payload storage**: `workspace_webhook_payloads.deliveryId`
2. **Observation storage**: `workspace_neural_observations.metadata.deliveryId`

This enables:
- Finding the raw payload for any observation
- Finding all observations created from a single webhook
- Debugging by correlating raw input to processed output

```sql
-- Find raw payload for an observation
SELECT wp.*
FROM lightfast_workspace_webhook_payloads wp
JOIN lightfast_workspace_neural_observations obs
  ON wp.workspace_id = obs.workspace_id
  AND wp.delivery_id = (obs.metadata->>'deliveryId')::text
WHERE obs.id = 'observation_id';
```

## Storage Considerations

### Payload Size Estimates

| Source | Event Type | Typical Size | Max Size |
|--------|------------|--------------|----------|
| GitHub | Push (1 commit) | 3-5 KB | ~100 KB (100+ commits) |
| GitHub | Pull Request | 5-10 KB | ~50 KB (large PR) |
| GitHub | Issue | 2-5 KB | ~20 KB (long description) |
| Vercel | Deployment | 2-4 KB | ~10 KB |

### Database Storage Impact

Assuming 1000 webhooks/day, average 5KB each:
- Daily: ~5 MB
- Monthly: ~150 MB
- Yearly: ~1.8 GB

This is well within PlanetScale/PostgreSQL capabilities without special handling.

### Headers Storage (Optional)

Storing headers enables complete webhook replay including:
- User-Agent for debugging
- X-Forwarded-For for origin tracking
- Content-Type for payload format verification
- Signature headers for verification replay

Recommended headers to capture:
```typescript
function extractRelevantHeaders(headers: Headers): Record<string, string> {
  const relevant = [
    "user-agent",
    "content-type",
    "x-forwarded-for",
    "x-github-delivery",
    "x-github-event",
    "x-github-hook-id",
    "x-hub-signature-256",
    "x-vercel-signature",
    "x-vercel-id",
  ];

  const result: Record<string, string> = {};
  for (const key of relevant) {
    const value = headers.get(key);
    if (value) result[key] = value;
  }
  return result;
}
```

## Success Criteria

1. **All verified webhooks stored**: Every webhook that passes signature verification has its payload persisted
2. **Workspace isolation**: Payloads linked to correct workspace with cascade delete
3. **Queryable by time**: Can retrieve all payloads for a workspace in a time range
4. **Linkable to observations**: Can find raw payload for any observation via `deliveryId`
5. **No performance impact**: Storage is async/non-blocking to webhook response time

## Open Questions

1. **Store failed verification attempts?** Currently designed to store only verified webhooks. If debugging requires seeing invalid webhooks, a separate `webhook_failures` table could be added.

2. **Compression?** For very high volume, consider `pg_lz` compression or storing in external blob storage with reference. Not needed initially.

3. **Index on payload content?** PostgreSQL GIN indexes on JSONB enable querying inside payloads. Not included in initial design but can be added if query patterns emerge.

## Code References

- `apps/console/src/app/(github)/api/github/webhooks/route.ts:376` - GitHub raw payload capture point
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:112` - Vercel raw payload capture point
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Existing observation schema pattern
- `packages/console-webhooks/src/transformers/` - Transformer functions that would consume replayed payloads
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Observation capture workflow for replay target

## Related Research

- `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md` - Transformer architecture analysis
- `thoughts/shared/research/2025-12-11-github-events-neural-memory-correctness.md` - Event processing correctness
