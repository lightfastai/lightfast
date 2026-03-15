---
date: 2026-03-15T06:16:15Z
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Concrete file-exact findings for 4 implementation areas: ingest log FK, entity lifecycle state, junction denorm, edge reinforcement"
tags: [research, codebase, event-store, edge-resolver, ingest-log, entity-lifecycle, junction-table, inngest]
status: complete
last_updated: 2026-03-15
---

# Research: 4 Implementation Areas — Ingest Log FK, Entity Lifecycle, Junction Denorm, Edge Reinforcement

**Date**: 2026-03-15T06:16:15Z
**Git Commit**: 4ec3c541776200e318c670c5064af752d9e142f0
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Find the precise lines that need changing, the exact current values, and what they need to become for 4 areas: (1) ingest log FK links + column pruning, (2) entity lifecycle state, (3) junction table denormalization, (4) edge reinforcement.

---

## Area 1 — Ingest Log FK Links + Column Pruning

### 1.1 Who reads `source` / `sourceType` from `workspaceIngestLogs`

**Consumer A — `workspace.events.list` tRPC procedure**
`api/console/src/router/org/workspace.ts:823-890`

- `source` is used as an **equality filter** column. When `input.source` is supplied, the predicate `eq(workspaceIngestLogs.source, input.source)` is pushed at line 847. This hits the composite `workspace_event_source_idx` index.
- `sourceType` is **returned in the SELECT projection** at line 868. It is NOT used for filtering or ordering.
- Full SELECT projection (lines 865-873): `id, source, sourceType, sourceEvent, ingestionSource, receivedAt, createdAt`
- Additional filters: `workspaceId` (always), `id < cursor` for pagination (line 851), `sourceEvent->>'title' ILIKE %search%` (line 856), `receivedAt >= receivedAfter` (line 861)
- ORDER BY `id DESC` (line 876)

**Consumer B — `/api/gateway/stream` SSE catch-up query**
`apps/console/src/app/api/gateway/stream/route.ts:93-107`

- Neither `source` nor `sourceType` appears in this query at all.
- SELECT reads only `id`, `workspaceId`, `sourceEvent`.
- Filter: `workspaceId = row.id AND id > lastId`, ORDER BY `id ASC`, LIMIT 1000.

**Summary:** `source` is used for filtering in exactly one place (tRPC `events.list`). `sourceType` is only returned in a projection, never filtered. The SSE route ignores both.

---

### 1.2 `"apps-console/event.capture"` Inngest event schema

`api/console/src/inngest/client/client.ts:56-65`

```typescript
// Event name: "apps-console/event.capture"
z.object({
  workspaceId:      z.string(),
  clerkOrgId:       z.string().optional(),
  sourceEvent:      postTransformEventSchema,    // see below
  ingestionSource:  ingestionSourceSchema.optional(),
})
```

**`postTransformEventSchema`** (`packages/console-providers/src/post-transform-event.ts:29-43`):

| Field | Type |
|---|---|
| `deliveryId` | `z.string().min(1)` |
| `sourceId` | `z.string().min(1)` |
| `provider` | `z.string().min(1)` |
| `eventType` | `z.string().min(1)` |
| `occurredAt` | `z.iso.datetime()` |
| `entity` | `{ provider, entityType, entityId, title, url: string\|null, state: string\|null }` |
| `relations` | `Array<{ provider, entityType, entityId, title: string\|null, url: string\|null, relationshipType }>` |
| `title` | `z.string().min(1).max(200)` |
| `body` | `z.string().max(50_000)` |
| `attributes` | `Record<string, string \| number \| boolean \| null>` |

---

### 1.3 Insert into `workspaceIngestLogs` in the ingress route

`apps/console/src/app/api/gateway/ingress/route.ts:71-82`

Inside the `"transform-store-and-fan-out"` context step (line 58). The `.values(...)` call:

| Field | Value |
|---|---|
| `workspaceId` | `workspace.workspaceId` |
| `deliveryId` | `envelope.deliveryId` |
| `source` | `envelope.provider` |
| `sourceType` | `sourceEvent.eventType` |
| `sourceEvent` | `sourceEvent` (full `PostTransformEvent` object) |
| `receivedAt` | `new Date(envelope.receivedAt).toISOString()` |
| `ingestionSource` | `"webhook"` (hardcoded literal) |

The insert uses `.returning({ id: workspaceIngestLogs.id })` at line 82 — only `id` is returned. That `record.id` is passed to `publishEventNotification` as `eventId` at lines 94-96.

---

### 1.4 The `store-observation` step in `event-store.ts`

`api/console/src/inngest/workflow/neural/event-store.ts:380-416`

The step inserts into `workspaceEvents` (not `workspaceIngestLogs`). The `.values(...)` call at lines 388-402:

| Field | Source |
|---|---|
| `externalId` | `externalId` (nanoid from `"generate-replay-safe-ids"` step, line 159) |
| `workspaceId` | `workspaceId` (from event data) |
| `occurredAt` | `sourceEvent.occurredAt` |
| `observationType` | `deriveObservationType(sourceEvent.provider, sourceEvent.eventType)` — line 381 |
| `title` | `sourceEvent.title` |
| `content` | `sourceEvent.body` |
| `source` | `sourceEvent.provider` |
| `sourceType` | `sourceEvent.eventType` |
| `sourceId` | `sourceEvent.sourceId` |
| `sourceReferences` | `sourceEvent.relations` |
| `metadata` | `sourceEvent.attributes` |
| `ingestionSource` | `event.data.ingestionSource ?? "webhook"` |
| `significanceScore` | `significance.score` (from `"evaluate-significance"` step, line 337) |

Insert uses `.returning()` (full row) at line 403, into variable `obs`. `obs` is assigned at line 416.

**What immediately follows this step:**
- `"upsert-entities-and-junctions"` step at line 419 — uses `observation.id` as FK for junction rows
- `entityRefs` built at lines 502-513 (local variable, not a step)
- `step.sendEvent("emit-downstream-events", ...)` at line 516 — conditional on `entityUpsertResult.primaryEntityExternalId` being truthy
- `step.sendEvent("emit-event-stored", ...)` at line 532 — always
- `step.run("complete-job-success", ...)` at line 545

---

### 1.5 All calls to `inngest.send("apps-console/event.capture", ...)`

**Call site 1 — ingress route notify helper**
`apps/console/src/app/api/gateway/ingress/_lib/notify.ts:19-27`

```typescript
// Function: publishInngestNotification
// Called from: apps/console/src/app/api/gateway/ingress/route.ts:90
{
  name: "apps-console/event.capture",
  data: {
    workspaceId:      workspace.workspaceId,
    clerkOrgId:       workspace.clerkOrgId,
    sourceEvent:      sourceEvent,           // after sanitizePostTransformEvent()
    ingestionSource:  "webhook",             // hardcoded
  }
}
```

**Call site 2 — console-test-data trigger utility**
`packages/console-test-data/src/trigger/trigger.ts:66-73`

```typescript
// Function: triggerEventCapture (batch, per event)
{
  name: "apps-console/event.capture",
  id:   `${runId}:${event.sourceId}`,    // top-level Inngest idempotency key
  data: {
    workspaceId:  options.workspaceId,
    sourceEvent:  event,                  // raw PostTransformEvent, no sanitization
    // clerkOrgId: absent — consumer falls back to DB lookup
    // ingestionSource: absent — consumer defaults to "webhook"
  }
}
```

---

## Area 2 — Entity Lifecycle State

### 2.1 `entity.state` values per provider transformer

#### GitHub (`packages/console-providers/src/providers/github/transformers.ts`)

| Transformer | `entity.state` value | Notes |
|---|---|---|
| `transformGitHubPush` | `null` | line 63 |
| `transformGitHubPullRequest` | `pr.merged ? "merged" : pr.state` | Values: `"merged"`, `"open"`, `"closed"`. Line 165, 181. |
| `transformGitHubIssue` | `issue.state` | Raw GitHub string: `"open"`, `"closed"`. Line 240. |
| `transformGitHubRelease` | `release.draft ? "draft" : release.prerelease ? "prerelease" : "published"` | Values: `"draft"`, `"prerelease"`, `"published"`. Lines 303-307. |
| `transformGitHubDiscussion` | `discussion.answer_html_url !== null ? "answered" : "open"` | Values: `"answered"`, `"open"`. Line 361. |

#### Vercel (`packages/console-providers/src/providers/vercel/transformers.ts`)

| Transformer | `entity.state` value | Notes |
|---|---|---|
| `transformVercelDeployment` | `deployment.readyState?.toLowerCase() ?? null` | Lowercased Vercel `readyState`, or `null` if absent. Lines 63, 81. |

#### Linear (`packages/console-providers/src/providers/linear/transformers.ts`)

| Transformer | `entity.state` value | Notes |
|---|---|---|
| `transformLinearIssue` | `issue.state.name` | Raw Linear state name string (e.g. `"In Progress"`, `"Done"`). Line 110. |
| `transformLinearComment` | `null` | Line 199. |
| `transformLinearProject` | `project.state` | Raw string from payload. Line 263. |
| `transformLinearCycle` | `null` | Line 327. |
| `transformLinearProjectUpdate` | `update.health` | Health field string: `"onTrack"`, `"atRisk"`, `"offTrack"`. Line 404. |

#### Sentry (`packages/console-providers/src/providers/sentry/transformers.ts`)

| Transformer | `entity.state` value | Notes |
|---|---|---|
| `transformSentryIssue` | `issue.status` | Raw Sentry status: `"resolved"`, `"unresolved"`, `"ignored"`. Line 66. |
| `transformSentryError` | `null` | Line 143. |
| `transformSentryEventAlert` | `null` | Line 201. |
| `transformSentryMetricAlert` | `payload.action` | Webhook action: `"critical"`, `"warning"`, `"resolved"`. Line 267. |

---

### 2.2 `onConflictDoUpdate` in `upsert-entities-and-junctions`

`api/console/src/inngest/workflow/neural/event-store.ts:440-451`

Conflict target: composite unique index on `(workspaceId, category, key)` — lines 441-445.

Fields SET on conflict:

| Field | Value | Line |
|---|---|---|
| `lastSeenAt` | `new Date().toISOString()` | 447 |
| `occurrenceCount` | `sql\`${workspaceEntities.occurrenceCount} + 1\`` | 448 |
| `updatedAt` | `new Date().toISOString()` | 449 |

Fields **not** updated on conflict (retain original insert values): `workspaceId`, `category`, `key`, `value`, `evidenceSnippet`, `confidence`, `externalId`.

---

### 2.3 `entityCategorySchema` and `STRUCTURAL_TYPES`

**`entityCategorySchema`** — `packages/console-validation/src/schemas/entities.ts:9-24`

```
// Structural types (line 10):
"commit" | "branch" | "pr" | "issue" | "deployment"

// Semantic types (line 16):
"engineer" | "project" | "endpoint" | "config" | "definition" | "service" | "reference"
```

`ENTITY_CATEGORIES = entityCategorySchema.options` — line 31.

**`STRUCTURAL_TYPES` in `event-store.ts`** — `api/console/src/inngest/workflow/neural/event-store.ts:52-58`

```typescript
new Set(["commit", "branch", "pr", "issue", "deployment"])
```

Used at line 478 to decide `refLabel`: `STRUCTURAL_TYPES.has(entity.category) ? (entity.value ?? null) : null`.

**`STRUCTURAL_TYPES` in `edge-resolver.ts`** — `api/console/src/inngest/workflow/neural/edge-resolver.ts:14`

```typescript
["commit", "branch", "pr", "issue", "deployment"]  // array, not Set
```

Used at line 33: `STRUCTURAL_TYPES.includes(r.type)` to filter `entityRefs` to structural refs only before the co-occurrence query.

Both definitions contain the same five members.

---

### 2.4 `sourceId` and `domainEntityId` construction per provider

There is no explicit `domainEntityId` field in the `PostTransformEvent` type or emitted by any transformer. The stable-identity portion is `entity.entityId`, which is the `sourceId` prefix before the trailing `:action` segment.

The `entity` object fields available in every transformer: `provider`, `entityType`, `entityId`, `title`, `url`, `state`.

#### GitHub (`packages/console-providers/src/providers/github/transformers.ts`)

| Transformer | `sourceId` | `entity.entityId` |
|---|---|---|
| `transformGitHubPush` | `` `github:commit:${payload.after}:push` `` (line 51) | `payload.after` (SHA) |
| `transformGitHubPullRequest` | `` `github:pr:${repoId}#${pr.number}:pull-request.${effectiveAction}` `` (line 169) | `` `${repoId}#${pr.number}` `` |
| `transformGitHubIssue` | `` `github:issue:${repoId}#${issue.number}:issue.${payload.action}` `` (line 228) | `` `${repoId}#${issue.number}` `` |
| `transformGitHubRelease` | `` `github:release:${repoId}:${release.tag_name}:release.${payload.action}` `` (line 289) | `` `${repoId}:${release.tag_name}` `` |
| `transformGitHubDiscussion` | `` `github:discussion:${repoId}#${discussion.number}:discussion.${payload.action}` `` (line 349) | `` `${repoId}#${discussion.number}` `` |

`repoId = String(payload.repository.id)` per transformer. `effectiveAction = payload.action === "closed" && pr.merged ? "merged" : payload.action`.

#### Vercel (`packages/console-providers/src/providers/vercel/transformers.ts`)

| Transformer | `sourceId` | `entity.entityId` |
|---|---|---|
| `transformVercelDeployment` | `` `vercel:deployment:${deployment.id}:${eventType}` `` (line 67) | `deployment.id` (line 78) |

#### Linear (`packages/console-providers/src/providers/linear/transformers.ts`)

`ACTION_SUFFIX = { create: "created", update: "updated", remove: "deleted" }` (lines 19-23). Fallback: raw `payload.action`.

| Transformer | `sourceId` | `entity.entityId` |
|---|---|---|
| `transformLinearIssue` | `` `linear:issue:${issue.identifier}:issue.${ACTION_SUFFIX[...] ?? payload.action}` `` (line 96) | `issue.identifier` (line 107) |
| `transformLinearComment` | `` `linear:comment:${comment.id}:comment.${ACTION_SUFFIX[...] ?? payload.action}` `` (line 185) | `comment.id` (line 196) |
| `transformLinearProject` | `` `linear:project:${project.id}:project.${ACTION_SUFFIX[...] ?? payload.action}` `` (line 249) | `project.id` (line 260) |
| `transformLinearCycle` | `` `linear:cycle:${cycle.id}:cycle.${ACTION_SUFFIX[...] ?? payload.action}` `` (line 313) | `cycle.id` (line 323) |
| `transformLinearProjectUpdate` | `` `linear:project-update:${update.id}:project-update.${ACTION_SUFFIX[...] ?? payload.action}` `` (line 390) | `update.id` (line 401) |

#### Sentry (`packages/console-providers/src/providers/sentry/transformers.ts`)

| Transformer | `sourceId` | `entity.entityId` |
|---|---|---|
| `transformSentryIssue` | `` `sentry:issue:${issue.project.id}:${issue.shortId}:issue.${payload.action}` `` (line 52) | `` `${issue.project.id}:${issue.shortId}` `` (line 63) |
| `transformSentryError` | `` `sentry:error:${errorEvent.project}:${errorEvent.event_id}:error.created` `` (line 127) | `` `${errorEvent.project}:${errorEvent.event_id}` `` (line 139) |
| `transformSentryEventAlert` | `` `sentry:alert:${event.project}:${event.event_id}:event-alert.triggered` `` (line 186) | `` `${event.project}:${event.event_id}` `` (line 198) |
| `transformSentryMetricAlert` | `` `sentry:metric-alert:${alertRule.organization_id}:${metric_alert.id}:metric-alert.${payload.action}` `` (line 255) | `` `${alertRule.organization_id}:${metric_alert.id}` `` (line 264) |

**Pattern**: Every `sourceId` = `{provider}:{entityType}:{stableKey}:{action}`. The stable portion (everything before the trailing `:action`) matches `entity.entityId`.

---

## Area 3 — Junction Table Denormalization

### 3.1 Two queries in `edge-resolver.ts` that fetch entity categories

**Query A — "ourEntities" (`edge-resolver.ts:46-58`)**

```typescript
SELECT
  workspaceEntities.id,
  workspaceEntities.category,
  workspaceEntities.key
FROM workspaceEntities
WHERE
  workspaceEntities.workspaceId = <workspaceId>
  AND (
    (category = <ref.type> AND key = <ref.key>)
    OR ...   -- one clause per structuralRef
  )
```

- Table: `workspaceEntities` (direct lookup)
- WHERE: `eq(workspaceEntities.workspaceId, workspaceId)` AND SQL OR over `structuralRefs` (built at lines 41-44)
- No JOIN, no LIMIT

**Query B — "allCoEntities" (`edge-resolver.ts:130-137`)**

```typescript
SELECT
  workspaceEntities.id,
  workspaceEntities.category,
  workspaceEntities.key
FROM workspaceEntities
WHERE workspaceEntities.id IN (<coEntityIds>)
```

- Table: `workspaceEntities` (second lookup to get category for co-occurring entity IDs)
- The `coEntityIds` come from the junction fetch at lines 112-119 (see below)
- No JOIN, no LIMIT

**The junction fetch that makes Query B necessary (`edge-resolver.ts:112-119`):**

```typescript
SELECT eventId, entityId, refLabel
FROM workspaceEventEntities
WHERE eventId IN (<coEventIds>)
```

This returns entity IDs without their categories. Because the junction table has no `category` column, a second round-trip (Query B) to `workspaceEntities` is required to get categories for those IDs.

---

### 3.2 Junction table insert in `event-store.ts`

`api/console/src/inngest/workflow/neural/event-store.ts:465-489`

The `.values(junctionRows)` shape — built at lines 465-483, each row contains:

| Field | Source |
|---|---|
| `entityId` | `result[0]?.id` — bigint PK returned by entity upsert `.returning()` at lines 452-455 |
| `eventId` | `observation.id` — bigint PK of the just-inserted `workspaceEvents` row (line 403) |
| `workspaceId` | `workspaceId` — from outer Inngest function closure (line 151) |
| `refLabel` | `STRUCTURAL_TYPES.has(entity.category) ? (entity.value ?? null) : null` — lines 478-480. `entity.value` is the `rel.relationshipType` string for structural types; `null` for all others. |

Insert uses `.onConflictDoNothing()` at line 489. Unique constraint: `uniqueEntityEvent` on `(entityId, eventId)` — defined at `db/console/src/schema/tables/workspace-event-entities.ts:54-57`.

---

### 3.3 All reads of `workspaceEventEntities` across the codebase

**No read anywhere filters or queries by `"reference"` category.** The junction table schema (`db/console/src/schema/tables/workspace-event-entities.ts`) defines only: `id`, `entityId`, `eventId`, `workspaceId`, `refLabel`, `createdAt`. There is no `category` column.

Every location querying `workspaceEventEntities`:

| Location | Type | Query |
|---|---|---|
| `api/console/src/inngest/workflow/neural/event-store.ts:487-489` | INSERT | `.insert(workspaceEventEntities).values(junctionRows).onConflictDoNothing()` |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts:74-87` | SELECT | `SELECT eventId, entityId FROM ... WHERE entityId IN (<ourEntityIds>) AND eventId != <eventId> ORDER BY eventId DESC LIMIT 100` |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts:112-119` | SELECT | `SELECT eventId, entityId, refLabel FROM ... WHERE eventId IN (<coEventIds>)` |
| `api/console/src/inngest/workflow/neural/entity-embed.ts:106-119` | SELECT+JOIN | Genesis event: `SELECT workspaceEvents.title, sourceType, occurredAt JOIN workspaceEvents ON eventId = workspaceEvents.id WHERE entityId = <entity.id> ORDER BY occurredAt ASC LIMIT 1` |
| `api/console/src/inngest/workflow/neural/entity-embed.ts:121-135` | SELECT+JOIN | Recent events: same join, `ORDER BY occurredAt DESC LIMIT 3` |
| `api/console/src/inngest/workflow/neural/entity-embed.ts:169-179` | SELECT+JOIN | `SELECT MAX(significanceScore) JOIN workspaceEvents ON ... WHERE entityId = <entity.id>` |
| `packages/integration-tests/src/neural-pipeline.integration.test.ts:366` | SELECT | `SELECT * FROM workspaceEventEntities` — full scan for test assertion |
| `db/console/src/schema/relations.ts:88-100` | Schema only | Drizzle relational config (not a runtime query) |

---

## Area 4 — Edge Reinforcement

### 4.1 Edge insert in `edge-resolver.ts`

`api/console/src/inngest/workflow/neural/edge-resolver.ts:249-261`

`.values(inserts)` shape — each row (built by mapping `deduped` at lines 249-258):

| Field | Source |
|---|---|
| `externalId` | `nanoid()` — fresh per edge (line 250) |
| `workspaceId` | outer function argument `workspaceId` (line 28) |
| `sourceEntityId` | `edge.sourceEntityId` — canonically lower entity ID (via `deduplicateEdgeCandidates`, line 330) |
| `targetEntityId` | `edge.targetEntityId` — canonically higher entity ID |
| `relationshipType` | `edge.relationshipType` — from matched `EdgeRule.relationshipType` |
| `sourceEventId` | `eventId` — integer ID of triggering event, passed to `resolveEdges()` at line 29 |
| `confidence` | `edge.confidence` — from matched `EdgeRule.confidence` |
| `metadata` | `{ detectionMethod: "entity_cooccurrence" }` (literal, line 257) |

**Conflict strategy**: `.onConflictDoNothing()` at line 261. No `onConflictDoUpdate`.

**Conflict target**: unique index `edge_unique_idx` on `(workspaceId, sourceEntityId, targetEntityId, relationshipType)` — defined at `db/console/src/schema/tables/workspace-entity-edges.ts:75-80`.

---

### 4.2 All reads from `workspaceEntityEdges` across the codebase

No location reads from `workspaceEntityEdges` with a confidence or weight filter.

| Location | Type | Query |
|---|---|---|
| `api/console/src/inngest/workflow/neural/edge-resolver.ts:261` | INSERT | `.insert(workspaceEntityEdges).values(inserts).onConflictDoNothing()` |
| `api/console/src/inngest/workflow/neural/entity-embed.ts:140-167` | SELECT+JOIN (UNION) | Outgoing: `SELECT relationshipType, target.category, target.key JOIN workspaceEntities WHERE sourceEntityId = <entity.id> LIMIT 3`; Incoming: `SELECT ... WHERE targetEntityId = <entity.id> LIMIT 3`. No confidence filter. |
| `packages/console-test-data/src/cli/reset-demo.ts:49-52` | SELECT COUNT | `SELECT count(*)::int WHERE workspaceId = <workspaceId>`. No confidence filter. |
| `packages/console-test-data/src/cli/reset-demo.ts:80-82` | DELETE | `DELETE WHERE workspaceId = <workspaceId>`. |
| `packages/integration-tests/src/event-ordering.integration.test.ts:1031` | SELECT | `SELECT * FROM workspaceEntityEdges` — full scan for test assertions. No confidence filter. |

---

### 4.3 `EdgeRule` type and all defined rules

**`EdgeRule` interface** — `packages/console-providers/src/types.ts:59-72`

```typescript
interface EdgeRule {
  confidence:       number;   // score for created edge
  matchProvider:    string;   // provider to match against ("*" = any)
  matchRefType:     string;   // entity type on the OTHER observation
  refType:          string;   // reference type on THIS observation's entities
  relationshipType: string;   // relationship type to create
  selfLabel?:       string;   // optional: match only when this obs's ref has this label
}
```

Declared as `readonly edgeRules?: EdgeRule[]` on `ProviderDefinition` at `packages/console-providers/src/define.ts:382`.

**All defined rules:**

**GitHub** — `packages/console-providers/src/providers/github/index.ts:395-421`

| refType | selfLabel | matchProvider | matchRefType | relationshipType | confidence |
|---|---|---|---|---|---|
| `"commit"` | (none) | `"vercel"` | `"deployment"` | `"deploys"` | `1.0` |
| `"issue"` | `"fixes"` | `"*"` | `"issue"` | `"fixes"` | `1.0` |
| `"issue"` | (none) | `"*"` | `"issue"` | `"references"` | `0.8` |

**Linear** — `packages/console-providers/src/providers/linear/index.ts:348-357`

| refType | selfLabel | matchProvider | matchRefType | relationshipType | confidence |
|---|---|---|---|---|---|
| `"issue"` | (none) | `"*"` | `"issue"` | `"references"` | `0.8` |

**Sentry** — `packages/console-providers/src/providers/sentry/index.ts:231`
Empty array: `edgeRules: []`

**Vercel** — `packages/console-providers/src/providers/vercel/index.ts:241`
Empty array: `edgeRules: []`

`EdgeRule` exported from `@repo/console-providers` via `packages/console-providers/src/index.ts`, imported in `edge-resolver.ts:8`.

---

## Code References Summary

| File | Lines | What |
|---|---|---|
| `api/console/src/router/org/workspace.ts` | 823-890 | Only `source` filter consumer; `sourceType` in SELECT only |
| `apps/console/src/app/api/gateway/stream/route.ts` | 93-107 | SSE catch-up — ignores `source`, `sourceType` entirely |
| `api/console/src/inngest/client/client.ts` | 56-65 | `"apps-console/event.capture"` Inngest schema |
| `packages/console-providers/src/post-transform-event.ts` | 29-43 | `postTransformEventSchema` fields |
| `apps/console/src/app/api/gateway/ingress/route.ts` | 71-82 | `workspaceIngestLogs` insert |
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` | 19-27 | Production Inngest send call |
| `packages/console-test-data/src/trigger/trigger.ts` | 66-73 | Test-data Inngest send call |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 380-416 | `store-observation` step insert |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 440-451 | `onConflictDoUpdate` block (entity upsert) |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 465-489 | Junction table insert |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 52-58 | `STRUCTURAL_TYPES` Set |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 14 | `STRUCTURAL_TYPES` array |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 46-58 | "ourEntities" entity lookup query |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 74-87 | Junction co-occurrence query |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 112-119 | Junction co-event fetch |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 130-137 | "allCoEntities" entity lookup query |
| `api/console/src/inngest/workflow/neural/edge-resolver.ts` | 249-261 | Edge insert + `.onConflictDoNothing()` |
| `api/console/src/inngest/workflow/neural/entity-embed.ts` | 106-179 | All reads of both `workspaceEventEntities` and `workspaceEntityEdges` |
| `packages/console-validation/src/schemas/entities.ts` | 9-31 | `entityCategorySchema` enum values |
| `packages/console-providers/src/types.ts` | 59-72 | `EdgeRule` interface |
| `packages/console-providers/src/providers/github/index.ts` | 395-421 | GitHub edge rules |
| `packages/console-providers/src/providers/linear/index.ts` | 348-357 | Linear edge rule |
| `packages/console-providers/src/providers/sentry/index.ts` | 231 | Sentry edge rules (empty) |
| `packages/console-providers/src/providers/vercel/index.ts` | 241 | Vercel edge rules (empty) |
| `db/console/src/schema/tables/workspace-event-entities.ts` | 54-57 | Junction unique constraint `(entityId, eventId)` |
| `db/console/src/schema/tables/workspace-entity-edges.ts` | 75-80 | Edge unique index `edge_unique_idx` on `(workspaceId, sourceEntityId, targetEntityId, relationshipType)` |
| `packages/console-providers/src/providers/github/transformers.ts` | multiple | GitHub `entity.state` values |
| `packages/console-providers/src/providers/vercel/transformers.ts` | multiple | Vercel `entity.state` values |
| `packages/console-providers/src/providers/linear/transformers.ts` | multiple | Linear `entity.state` values |
| `packages/console-providers/src/providers/sentry/transformers.ts` | multiple | Sentry `entity.state` values |
