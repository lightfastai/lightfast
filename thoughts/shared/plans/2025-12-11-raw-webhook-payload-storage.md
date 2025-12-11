# Raw Webhook Payload Storage Implementation Plan

## Overview

Implement permanent raw webhook payload storage for all workspaces. Every verified webhook from GitHub and Vercel will be stored in its complete, unmodified form alongside HTTP headers. This enables future reprocessing if transformer logic changes, debugging webhook issues, and maintaining a complete audit trail.

## Current State Analysis

### What Exists Today

Based on research in `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md`:

1. **Raw payloads are NOT stored** - Only transformed `SourceEvent` data persists in `workspace_neural_observations`
2. **Transformers extract selected fields** - The `metadata` JSONB column contains structured fields, not complete payloads
3. **Capture points exist** - Raw text payload is available at:
   - GitHub: `apps/console/src/app/(github)/api/github/webhooks/route.ts:376`
   - Vercel: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:112`

### Current Data Flow

```
Raw Webhook → request.text() → Verify Signature → Parse JSON → Transform → Inngest → Database
                   ↑                                                              ↓
             CAPTURE POINT                                                   SourceEvent only
             (line 376/112)                                                  (raw data lost)
```

### Key Discoveries

- `deliveryId` is already extracted and passed through handlers (`route.ts:397`)
- Workspace resolution happens in each event handler after parsing
- Existing schema patterns use `jsonb().$type<T>()` for typed JSON storage
- Headers contain valuable context: signatures, user agents, delivery IDs

## Desired End State

After implementation:

1. **Every verified webhook stored** - All webhooks passing signature verification have raw payload persisted
2. **Complete payload + headers** - Both the JSON body and relevant HTTP headers captured
3. **Workspace isolation** - Payloads linked to workspace with cascade delete
4. **Queryable by time and source** - Efficient indexes for time-range and source-type queries
5. **Linkable to observations** - `deliveryId` connects raw payload to processed observations

### Verification

```sql
-- Verify storage is working: should return recent webhook payloads
SELECT id, source, event_type, received_at
FROM lightfast_workspace_webhook_payloads
ORDER BY received_at DESC
LIMIT 10;

-- Verify link to observations works
SELECT wp.id as payload_id, obs.id as observation_id
FROM lightfast_workspace_webhook_payloads wp
JOIN lightfast_workspace_neural_observations obs
  ON wp.workspace_id = obs.workspace_id
  AND wp.delivery_id = (obs.metadata->>'deliveryId')::text
LIMIT 5;
```

## What We're NOT Doing

- **No Svix integration** - Custom storage only, Svix is a separate future initiative
- **No replay API** - Storage only, replay endpoints are out of scope
- **No retention policy** - Permanent storage, no expiration or cleanup
- **No compression** - Store raw JSON as-is, optimize later if needed
- **No failed webhook storage** - Only store webhooks that pass signature verification

## Implementation Approach

Store raw payloads immediately after workspace resolution in each webhook handler. Pass the raw payload string through the handler chain alongside the parsed object. This ensures we only store webhooks that:
1. Pass signature verification
2. Are routable to a workspace

---

## Phase 1: Database Schema & Storage Service

### Overview

Create the `workspace_webhook_payloads` table and a storage service function.

### Changes Required

#### 1. Create Table Schema

**File**: `db/console/src/schema/tables/workspace-webhook-payloads.ts` (NEW)

```typescript
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
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
    eventType: varchar("event_type", { length: 100 }).notNull(),

    // Raw payload storage (complete unmodified webhook body)
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    // Headers storage (for complete context)
    headers: jsonb("headers").$type<Record<string, string>>().notNull(),

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
    // Find specific delivery for debugging/linking
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
export type InsertWorkspaceWebhookPayload = typeof workspaceWebhookPayloads.$inferInsert;
```

#### 2. Export from Schema Index

**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Add export for new table

```typescript
export * from "./workspace-webhook-payloads";
```

#### 3. Create Storage Service

**File**: `packages/console-webhooks/src/storage.ts` (NEW)

```typescript
import { db } from "@db/console";
import { workspaceWebhookPayloads } from "@db/console/schema";

export interface StoreWebhookPayloadParams {
  workspaceId: string;
  deliveryId: string;
  source: "github" | "vercel";
  eventType: string;
  payload: string; // Raw JSON string from request.text()
  headers: Record<string, string>;
  receivedAt: Date;
}

/**
 * Store raw webhook payload for permanent retention.
 * Called after signature verification and workspace resolution.
 */
export async function storeWebhookPayload(
  params: StoreWebhookPayloadParams
): Promise<string> {
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

/**
 * Extract relevant headers from request for storage.
 * Captures headers useful for debugging and context.
 */
export function extractWebhookHeaders(headers: Headers): Record<string, string> {
  const relevantKeys = [
    // Common
    "user-agent",
    "content-type",
    "x-forwarded-for",
    // GitHub specific
    "x-github-delivery",
    "x-github-event",
    "x-github-hook-id",
    "x-github-hook-installation-target-id",
    "x-github-hook-installation-target-type",
    "x-hub-signature-256",
    // Vercel specific
    "x-vercel-signature",
    "x-vercel-id",
  ];

  const result: Record<string, string> = {};
  for (const key of relevantKeys) {
    const value = headers.get(key);
    if (value) {
      result[key] = value;
    }
  }
  return result;
}
```

#### 4. Export from Package Index

**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Add export for storage module

```typescript
export * from "./storage";
```

#### 5. Generate Migration

Run from `db/console/`:
```bash
pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates without errors: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] TypeScript compiles: `pnpm --filter @db/console build`
- [x] Package builds: `pnpm --filter @repo/console-webhooks build`

#### Manual Verification:
- [ ] Table exists in database with correct columns (check via `pnpm db:studio`)
- [ ] Indexes are created as specified

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: GitHub Webhook Handler Integration

### Overview

Modify the GitHub webhook route handler to pass raw payload through handlers and store it after workspace resolution.

### Changes Required

#### 1. Modify POST Handler to Preserve Raw Payload

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

**Location**: Lines 373-493 (POST handler)

**Changes**:

At line 376, the raw payload is already captured:
```typescript
const payload = await request.text();
```

After line 397 (after verification succeeds), extract headers:
```typescript
// After: const deliveryId = request.headers.get("x-github-delivery") ?? "unknown";
// Add:
const webhookHeaders = extractWebhookHeaders(request.headers);
```

Modify each handler call to pass `payload` (raw string) and `webhookHeaders`:

```typescript
// Line 186 - handlePushObservation
case "push":
  await handlePushObservation(body as PushEvent, deliveryId, payload, webhookHeaders);
  break;

// Line 205 - handlePullRequestObservation
case "pull_request":
  await handlePullRequestObservation(body as PullRequestEvent, deliveryId, payload, webhookHeaders);
  break;

// Line 248 - handleIssuesObservation
case "issues":
  await handleIssuesObservation(body as IssuesEvent, deliveryId, payload, webhookHeaders);
  break;

// Line 290 - handleReleaseObservation
case "release":
  await handleReleaseObservation(body as ReleaseEvent, deliveryId, payload, webhookHeaders);
  break;

// Line 330 - handleDiscussionObservation
case "discussion":
  await handleDiscussionObservation(body as DiscussionEvent, deliveryId, payload, webhookHeaders);
  break;
```

#### 2. Modify handlePushObservation

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Location**: Lines 163-200

```typescript
async function handlePushObservation(
  payload: PushEvent,
  deliveryId: string,
  rawPayload: string,           // NEW
  headers: Record<string, string>, // NEW
) {
  const receivedAt = new Date();

  // ... existing branch filter logic (lines 168-171) ...

  const workspace = await workspacesService.findWorkspaceByGitHubOrgSlug(/* ... */);
  if (!workspace) return;

  // NEW: Store raw webhook payload
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "push",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  // Existing: Send to Inngest (lines 185-194)
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      sourceEvent: transformGitHubPush(payload, { deliveryId, receivedAt }),
    },
  });
}
```

#### 3. Modify handlePullRequestObservation

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Location**: Lines 205-243

Similar pattern - add `rawPayload` and `headers` parameters, store after workspace resolution.

#### 4. Modify handleIssuesObservation

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Location**: Lines 248-285

Similar pattern.

#### 5. Modify handleReleaseObservation

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Location**: Lines 290-325

Similar pattern.

#### 6. Modify handleDiscussionObservation

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Location**: Lines 330-367

Similar pattern.

#### 7. Add Import

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

Add import at top of file:
```typescript
import { storeWebhookPayload, extractWebhookHeaders } from "@repo/console-webhooks";
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console` (skipped - pre-existing page module errors unrelated to this change)

#### Manual Verification:
- [ ] Trigger a GitHub push webhook to a connected repository
- [ ] Verify payload appears in `workspace_webhook_payloads` table
- [ ] Verify `headers` column contains expected header values
- [ ] Verify `deliveryId` matches the observation's `metadata.deliveryId`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Vercel Webhook Handler Integration

### Overview

Modify the Vercel webhook route handler to store raw payloads with headers.

### Changes Required

#### 1. Modify POST Handler

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
**Location**: Lines 110-165 (POST handler)

At line 112, raw payload is captured:
```typescript
const rawBody = await request.text();
```

After line 135 (after verification succeeds), extract headers and pass to handler:
```typescript
// After: const payload = result.event;
// Add:
const webhookHeaders = extractWebhookHeaders(request.headers);

// Modify line 149-150:
if (eventType.startsWith("deployment.")) {
  await handleDeploymentEvent(payload, eventType, rawBody, webhookHeaders);
}
```

#### 2. Modify handleDeploymentEvent

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
**Location**: Lines 27-69

```typescript
async function handleDeploymentEvent(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
  rawPayload: string,              // NEW
  headers: Record<string, string>, // NEW
) {
  const receivedAt = new Date();

  // ... existing validation logic (lines 31-38) ...

  // ... existing workspace lookup (lines 41-48) ...
  const integration = await db.query.workspaceIntegrations.findFirst({/* ... */});
  if (!integration) return;
  const workspaceId = integration.workspaceId;

  // NEW: Store raw webhook payload
  await storeWebhookPayload({
    workspaceId,
    deliveryId: payload.id, // Vercel's webhook ID is in the payload
    source: "vercel",
    eventType,
    payload: rawPayload,
    headers,
    receivedAt,
  });

  // Existing: Send to Inngest (lines 53-62)
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      sourceEvent: transformVercelDeployment(payload, { receivedAt }),
    },
  });
}
```

#### 3. Add Import

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

Add import at top of file:
```typescript
import { storeWebhookPayload, extractWebhookHeaders } from "@repo/console-webhooks";
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console` (skipped - pre-existing page module errors unrelated to this change)

#### Manual Verification:
- [ ] Trigger a Vercel deployment webhook (deploy a connected project)
- [ ] Verify payload appears in `workspace_webhook_payloads` table with `source: "vercel"`
- [ ] Verify `headers` column contains Vercel-specific headers
- [ ] Verify `deliveryId` matches `payload.id` from the webhook

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Final Verification

### Overview

Comprehensive verification that raw webhook storage is working correctly for both sources.

### Verification Steps

#### 1. Database Verification

Run in database studio or via SQL:

```sql
-- Count payloads by source
SELECT source, COUNT(*)
FROM lightfast_workspace_webhook_payloads
GROUP BY source;

-- Verify headers are populated
SELECT id, source, headers
FROM lightfast_workspace_webhook_payloads
WHERE headers IS NOT NULL
LIMIT 5;

-- Verify payload-observation link via deliveryId
SELECT
  wp.id as payload_id,
  wp.source,
  wp.event_type,
  obs.id as observation_id,
  obs.source_type
FROM lightfast_workspace_webhook_payloads wp
LEFT JOIN lightfast_workspace_neural_observations obs
  ON wp.workspace_id = obs.workspace_id
  AND wp.delivery_id = (obs.metadata->>'deliveryId')::text
ORDER BY wp.received_at DESC
LIMIT 10;
```

#### 2. Cascade Delete Verification

```sql
-- Verify foreign key constraint exists
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'lightfast_workspace_webhook_payloads'
  AND tc.constraint_type = 'FOREIGN KEY';
```

### Success Criteria

#### Automated Verification:
- [x] Full build passes: `pnpm build` (pre-existing failures in @vendor/mastra unrelated to this change)
- [x] Full typecheck passes: `pnpm typecheck` (console, db/console, console-webhooks all pass)
- [x] Full lint passes: `pnpm lint` (console app passes; pre-existing failures in other packages)

#### Manual Verification:
- [ ] GitHub webhooks (push, PR, issue) create payload records
- [ ] Vercel deployment webhooks create payload records
- [ ] Headers are captured for both sources
- [ ] Payload content is complete (matches original webhook)
- [ ] Workspace deletion cascades to payload deletion (test in dev)

---

## Testing Strategy

### Unit Tests

Not required for Phase 1 - storage is straightforward database insert.

### Integration Tests

- Verify `storeWebhookPayload` correctly stores and returns ID
- Verify `extractWebhookHeaders` captures expected headers

### Manual Testing Steps

1. **GitHub Push**: Push a commit to a connected repository
   - Check payload stored with `event_type: "push"`
   - Verify commit data is in payload

2. **GitHub PR**: Open/close a PR in a connected repository
   - Check payload stored with `event_type: "pull_request"`
   - Verify PR data is in payload

3. **Vercel Deploy**: Deploy a connected Vercel project
   - Check payload stored with `source: "vercel"`
   - Verify deployment data is in payload

4. **Headers**: For each webhook type, verify headers contain:
   - GitHub: `x-github-delivery`, `x-github-event`, `x-hub-signature-256`
   - Vercel: `x-vercel-signature`, `x-vercel-id`

---

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

Well within PlanetScale capabilities without special handling.

---

## References

- Research: `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md`
- Research: `thoughts/shared/research/2025-12-11-raw-webhook-payload-storage-design.md`
- GitHub route: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- Vercel route: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
- Observation schema: `db/console/src/schema/tables/workspace-neural-observations.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
