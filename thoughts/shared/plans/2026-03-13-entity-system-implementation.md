---
date: 2026-03-13
researcher: claude
git_commit: 81a096f366dafb53ec8dfee1b94315dd7b6e1d6d
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Entity System Redesign — Implementation Plan"
tags: [plan, entity-system, post-transform-event, providers, implementation]
status: draft
last_updated: 2026-03-13
depends_on: thoughts/shared/plans/2026-03-13-entity-system-redesign.md
---

# Entity System Redesign — Implementation Plan

## Overview

Replace the flat `PostTransformEvent` schema (`source`, `sourceType`, `sourceId`, `references[]`, `metadata{}`) with a rich entity-oriented schema (`provider`, `eventType`, `entity: EntityRef`, `relations: EntityRelation[]`, `attributes{}`). This touches 15 transformer functions across 4 providers and all downstream consumers.

Design spec: `thoughts/shared/plans/2026-03-13-entity-system-redesign.md`

## Current State Analysis

- `PostTransformEvent` defined at `packages/console-providers/src/post-transform-event.ts:37-46`
- 15 transformer functions: GitHub (5), Linear (5), Vercel (1), Sentry (4)
- `sourceId` encodes action suffix (e.g., `pr:org/repo#123:merged`) — unstable per entity
- `references[]` flat array mixes entities, actors, labels with no semantic distinction
- `metadata` is `Record<string, unknown>` — no type safety
- `deliveryId` buried in metadata
- Entity IDs use `repoFullName` which can change on repo rename

### Key Discoveries:
- `event-store.ts:241-260` reads `metadata.repoId`/`.projectId`/`.teamId` for integration lookup — must preserve these as attributes
- `edge-resolver.ts:14` uses `STRUCTURAL_TYPES` matching against reference `.type` field — maps cleanly to `EntityRelation.entityType`
- `entity-extraction-patterns.ts:181-231` maps reference `.type`/`.id`/`.label` to extracted entities — needs remapping to relation fields
- `sanitizePostTransformEvent` at `validation.ts:43-62` only sanitizes `references[].url` — needs to also sanitize `entity.url` and `relations[].url`
- DB columns `source`, `sourceType`, `sourceId` on `workspaceEvents` and `workspaceIngestLog` are denormalized strings — column names stay, values change

## Desired End State

All webhook events produce structured `PostTransformEvent` objects with:
- Stable `sourceId` derived as `{provider}:{entity.entityType}:{entity.entityId}:{eventType}`
- First-class `entity: EntityRef` with stable ID, lifecycle `state`, `title`, `url`
- Typed `relations: EntityRelation[]` with `relationshipType` semantics
- `attributes: Record<string, string | number | boolean | null>` (typed, no nested objects)
- `deliveryId` promoted to top-level field
- Entity IDs use numeric/stable identifiers (GitHub `repoId` not `repoFullName`, Linear UUIDs not slugs, Sentry `projectId` not `projectSlug`)
- **Zero type assertions** — no `as` casts, no `as unknown as`, no `any` types anywhere in the entity system pipeline

### Verification:
- `pnpm typecheck` passes across entire monorepo
- `pnpm check` passes (biome lint/format)
- All existing tests updated and passing
- New events ingested via `pnpm dev:app` produce correct entity structure in `workspaceIngestLog.sourceEvent` JSONB

## What We're NOT Doing

- Actor extraction (Phase 2 in design spec)
- Cross-provider relations (Phase 3 in design spec)
- AI-extracted entities (Phase 4 in design spec)
- DB migration for existing JSONB rows in `workspaceIngestLog` — old rows keep old format
- Backward compatibility in UI for old-format `sourceEvent` JSONB — straight drop
- Renaming DB columns (`source`, `sourceType`, `sourceId`) — values change, column names stay

## Key Design Decisions

### 1. Stable `sourceId` — Added Back to Schema

The design spec removes `sourceId`. We ADD IT BACK as a derived field to minimize downstream migration and preserve dedup/logging/display semantics:

```
sourceId = {provider}:{entity.entityType}:{entity.entityId}:{eventType}
```

Examples:
- `github:pr:12345678#123:pull-request.merged`
- `linear:issue:ENG-42:issue.updated`
- `vercel:deployment:dpl_abc123:deployment.succeeded`
- `sentry:issue:12345:PROJ-123:issue.created`

Each transformer computes this deterministically.

### 2. Entity IDs Use Stable Identifiers

GitHub entities use numeric `repoId` (not mutable `repoFullName`):

| Provider | entityType | entityId format | Example |
|---|---|---|---|
| github | pr | `{repoId}#{number}` | `12345678#123` |
| github | issue | `{repoId}#{number}` | `12345678#7` |
| github | commit | `{sha}` | `abc1234567890abcd` |
| github | branch | `{repoId}:{ref}` | `12345678:feature/auth` |
| github | release | `{repoId}:{tag}` | `12345678:v1.2.0` |
| github | discussion | `{repoId}#{number}` | `12345678#5` |
| vercel | deployment | `{deploymentId}` | `dpl_abc123xyz` |
| vercel | project | `{projectId}` | `prj_def456uvw` |
| linear | issue | `{identifier}` | `ENG-42` |
| linear | project | `{id}` | `uuid-abc` |
| linear | cycle | `{id}` | `cycle-uuid` |
| linear | comment | `{id}` | `comment-uuid` |
| linear | project-update | `{id}` | `update-uuid` |
| sentry | issue | `{projectId}:{shortId}` | `12345:PROJ-123` |
| sentry | error | `{projectId}:{eventId}` | `12345:uuid-abc` |
| sentry | alert | `{organizationId}:{alertId}` | `org-uuid:alert-id` |
| sentry | metric-alert | `{organizationId}:{alertId}` | `org-uuid:metric-id` |

### 3. Resource IDs in Attributes

Every transformer MUST include the provider-specific resource ID in `attributes` for integration lookup in `event-store.ts`:

- GitHub: `repoId: payload.repository.id` (number)
- Vercel: `projectId: project.id` (string)
- Linear: `teamId: issue.team.id` (string)
- Sentry: `projectId: issue.project.id` (number)

### 4. Zero Type Assertions — Eliminate All `as` Casts

The current codebase has 8 type assertion instances across the entity pipeline. This redesign eliminates ALL of them:

| File | Current Cast | Fix |
|---|---|---|
| `event-store.ts:247-256` | `metadata.repoId as string \| undefined` (x4) | Typed `attributes` schema eliminates cast |
| `event-store.ts:290` | `providerConfig as { sync?: ... }` | Change `isEventAllowed` to accept `ProviderConfig` directly |
| `event-store.ts:368` | `references as { type, id, label? }[]` | New `extractFromRelations` accepts `EntityRelation[]` directly |
| `event-interpret.ts:160` | `ws.settings.version as number` | Remove cast — `WorkspaceSettings.version` is `z.literal(1)`, already typed |
| `event-interpret.ts:178` | `as unknown as PostTransformEvent` | Introduce `ClassificationInput` type, narrow function signatures |
| `event-interpret.ts:197-198` | `as Parameters<typeof generateObject>[0]` + `as { object: ClassificationResponse }` | Type the Inngest `step.ai.wrap` call with explicit generics |
| `event-interpret.ts:234` | `as ClassificationResponse` | Use `satisfies ClassificationResponse` — object literal already matches shape |
| `scoring.ts:105` | `` `${source}:${sourceType}` as EventKey `` | Use `getEventKey()` helper that returns `EventKey \| undefined` with registry lookup |
| `vercel/transformers.ts:21` | `eventType as VercelWebhookEventType` | Accept `VercelWebhookEventType` in function signature instead of `string` |

**Rule**: No code snippet in this plan may contain `as `, `as unknown`, `: any`, or `<any>`. Every type must be derived from schemas or narrowed via control flow.

---

## Phase 1: Core Schema + All Producers

Replace the schema and rewrite all 15 transformer functions. After this phase, `pnpm --filter @repo/console-providers typecheck` passes.

### Changes Required:

#### 1. Schema: `packages/console-providers/src/post-transform-event.ts`

**Replace entire file** with new EntityRef, EntityRelation, PostTransformEvent schemas:

```typescript
import { z } from "zod";

export const entityRefSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string(),
  url: z.string().url().nullable(),
  state: z.string().nullable(),
});

export const entityRelationSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string().nullable(),
  url: z.string().url().nullable(),
  relationshipType: z.string().min(1),
});

export const postTransformEventSchema = z.object({
  deliveryId: z.string().min(1),
  sourceId: z.string().min(1),
  provider: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.iso.datetime(),
  entity: entityRefSchema,
  relations: z.array(entityRelationSchema),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000),
  attributes: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  ),
});

export type EntityRef = z.infer<typeof entityRefSchema>;
export type EntityRelation = z.infer<typeof entityRelationSchema>;
export type PostTransformEvent = z.infer<typeof postTransformEventSchema>;

/**
 * Narrow input type for classification functions.
 * These functions only need provider, eventType, title, body — not the full event.
 * Eliminates the `as unknown as PostTransformEvent` double cast in event-interpret.ts.
 */
export type ClassificationInput = Pick<
  PostTransformEvent,
  "provider" | "eventType" | "title" | "body"
>;
```

**Removed types**: `PostTransformReference`, `postTransformReferenceSchema`

#### 2. Validation: `packages/console-providers/src/validation.ts`

Update `logValidationErrors` to log `event.sourceId` (field name unchanged).

Update `sanitizePostTransformEvent` to sanitize URLs on the new structure:

```typescript
export function sanitizePostTransformEvent(
  event: PostTransformEvent
): PostTransformEvent {
  const isValidUrl = (u: string): boolean => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  };

  return {
    ...event,
    entity: {
      ...event.entity,
      url: event.entity.url && isValidUrl(event.entity.url) ? event.entity.url : null,
    },
    relations: event.relations.map((rel) => ({
      ...rel,
      url: rel.url && isValidUrl(rel.url) ? rel.url : null,
    })),
  };
}
```

#### 3. Exports: `packages/console-providers/src/index.ts`

Update export block to replace `PostTransformReference` / `postTransformReferenceSchema` with `EntityRef`, `EntityRelation`, `entityRefSchema`, `entityRelationSchema`:

```typescript
// ── Post-Transform Event (canonical source of truth) ──
export type {
  PostTransformEvent,
  ClassificationInput,
  EntityRef,
  EntityRelation,
} from "./post-transform-event";
export {
  postTransformEventSchema,
  entityRefSchema,
  entityRelationSchema,
} from "./post-transform-event";
```

#### 4. GitHub Transformers: `packages/console-providers/src/providers/github/transformers.ts`

Rewrite all 5 functions following the design spec. Key differences from spec:

- **Entity IDs use `repoId`** (numeric) not `repoFullName`:
  ```typescript
  const repoId = String(payload.repository.id);
  // entityId: `${repoId}#${pr.number}` not `${repoFullName}#${pr.number}`
  ```

- **`sourceId` computed** in every transformer:
  ```typescript
  sourceId: `github:pr:${repoId}#${pr.number}:pull-request.${effectiveAction}`,
  ```

- **`attributes` include `repoId`** (not `repoFullName`):
  ```typescript
  attributes: {
    repoId: payload.repository.id, // number — for integration lookup
    prNumber: pr.number,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    isDraft: pr.draft,
    isMerged: pr.merged ?? false,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    headSha: pr.head.sha,
  },
  ```

- **`extractLinkedIssues` updated** to use `repoId`:
  ```typescript
  function extractLinkedIssues(
    body: string,
    repoId: string,  // numeric ID as string
    repoUrl: string
  ): { entityId: string; url: string | null; relationshipType: string }[]
  ```
  Produces `entityId: "${repoId}#${issueNumber}"`.

- **Drop all actor/label references** — no `reviewer`, `assignee`, or `label` refs in relations.

Full transform function list:
1. `transformGitHubPush` — entity: commit, relations: [branch:pushed_to]
2. `transformGitHubPullRequest` — entity: pr, relations: [commit:head_commit, commit:merge_commit, branch:from_branch, branch:to_branch, issue:fixes/closes/resolves]
3. `transformGitHubIssue` — entity: issue, relations: []
4. `transformGitHubRelease` — entity: release, relations: [branch:from_branch]
5. `transformGitHubDiscussion` — entity: discussion, relations: []

#### 5. Linear Transformers: `packages/console-providers/src/providers/linear/transformers.ts`

Rewrite all 5 functions. Key differences from design spec:

- **Entity IDs use UUIDs** for project, cycle, comment, project-update:
  ```typescript
  // Project: use id (UUID) not slugId
  entityId: project.id,
  // Cycle: use id (UUID) not team.key:number
  entityId: cycle.id,
  // Comment: use id (UUID) not issueIdentifier:commentId
  entityId: comment.id,
  // Project-update: use id (UUID) not projectId:updateId
  entityId: update.id,
  ```

- **Issue identifier** stays as `ENG-42` (Linear's canonical stable identifier)

- **`attributes` include `teamId`** for integration lookup:
  ```typescript
  attributes: {
    teamId: issue.team.id,   // for integration lookup
    teamKey: issue.team.key,
    teamName: issue.team.name,
    // ...
  },
  ```

- **sourceId** uses stable entity IDs:
  ```typescript
  sourceId: `linear:issue:${issue.identifier}:issue.${mapLinearAction(payload.action)}`,
  ```

Full transform function list:
1. `transformLinearIssue` — entity: issue, relations: [project:belongs_to, cycle:in_cycle, issue:parent]
2. `transformLinearComment` — entity: comment, relations: [issue:belongs_to, comment:parent]
3. `transformLinearProject` — entity: project, relations: []
4. `transformLinearCycle` — entity: cycle, relations: []
5. `transformLinearProjectUpdate` — entity: project-update, relations: [project:belongs_to]

#### 6. Vercel Transformer: `packages/console-providers/src/providers/vercel/transformers.ts`

Rewrite single `transformVercelDeployment` per design spec. Key addition:

- **`attributes` include `projectId`** for integration lookup
- **Drop GitHub cross-provider refs** from relations (stored as attributes for Phase 3)
- **sourceId**: `vercel:deployment:${deployment.id}:${eventType}`
- **Fix `eventType` cast**: Change function signature from `eventType: string` to `eventType: VercelWebhookEventType`. The caller already knows the specific event type — push the narrowing to the call site instead of casting inside the function:
  ```typescript
  export function transformVercelDeployment(
    payload: PreTransformVercelWebhookPayload,
    context: TransformContext,
    eventType: VercelWebhookEventType  // was: string (cast inside with `as`)
  ): PostTransformEvent {
    // No cast needed — eventType is already narrowed
  ```

#### 7. Sentry Transformers: `packages/console-providers/src/providers/sentry/transformers.ts`

Rewrite all 4 functions. Key differences from spec:

- **Entity IDs use numeric `projectId`** (not `projectSlug`):
  ```typescript
  entityId: `${issue.project.id}:${issue.shortId}`, // "12345:PROJ-123"
  ```

- **`attributes` include `projectId`** for integration lookup

- **sourceId**: `sentry:issue:${issue.project.id}:${issue.shortId}:issue.${payload.action}`

Full transform function list:
1. `transformSentryIssue` — entity: issue, relations: []
2. `transformSentryError` — entity: error, relations: []
3. `transformSentryEventAlert` — entity: alert, relations: []
4. `transformSentryMetricAlert` — entity: metric-alert, relations: []

#### 8. Backfill Adapters

- `packages/console-providers/src/providers/vercel/backfill.ts` — no changes needed (adapters produce pre-transform payloads that feed into the rewritten transformers)
- `packages/console-providers/src/providers/sentry/backfill.ts` — same, no changes needed

#### 9. Provider Definitions: edgeRules

Update edgeRules values in all 4 provider `index.ts` files. The `EdgeRule` interface (`types.ts:59-72`) stays unchanged — `refType` maps to `entityType`, `selfLabel` maps to `relationshipType`.

**GitHub** `packages/console-providers/src/providers/github/index.ts:343-386`:
Current `selfLabel: "resolved_by"` → stays (matches new `relationshipType: "resolved_by"` on commit relations... but wait, Sentry resolved_by commit is a cross-provider ref stored in attributes in Phase 1). Edge rules that depend on cross-provider refs from `references` that are now omitted from `relations` need to be reviewed:

- `commit` ↔ `deployment` (vercel) — commit is in GitHub push event's entity, deployment is Vercel's entity. These are discovered via co-occurrence in junction table. Still works because both entities are extracted.
- `commit` with `selfLabel: "resolved_by"` ↔ sentry `issue` — in the OLD schema, Sentry issue transformer adds a `"commit"` reference with `label: "resolved_by"`. In the NEW schema, this is stored in `attributes.resolvedByCommit` instead (Phase 3). **This edgeRule will stop matching.** Remove it — it will be restored in Phase 3 when cross-provider relations are implemented.
- `pr` ↔ linear `issue` — in OLD schema, Linear issue transformer adds `"pr"` reference with `label: "tracked_in"`. In NEW schema, this is stored in `attributes.githubPrNumber`. **This edgeRule will stop matching.** Remove — restored in Phase 3.

Updated edgeRules per provider:

**GitHub** — keep commit↔deployment (both are primary entities), keep issue↔issue. Remove commit:resolved_by↔sentry:issue and pr↔linear:issue:
```typescript
edgeRules: [
  // GitHub commit deploys to Vercel deployment (entity co-occurrence)
  {
    refType: "commit",
    matchProvider: "vercel",
    matchRefType: "deployment",
    relationshipType: "deploys",
    confidence: 1.0,
  },
  // GitHub issue fixes another issue (self-referential, from extractLinkedIssues)
  {
    refType: "issue",
    selfLabel: "fixes",
    matchProvider: "*",
    matchRefType: "issue",
    relationshipType: "fixes",
    confidence: 1.0,
  },
  // GitHub issue references another issue
  {
    refType: "issue",
    matchProvider: "*",
    matchRefType: "issue",
    relationshipType: "references",
    confidence: 0.8,
  },
],
```

**Linear** — remove issue↔sentry:issue (cross-provider), remove issue↔github:pr (cross-provider). Keep issue↔issue:
```typescript
edgeRules: [
  {
    refType: "issue",
    matchProvider: "*",
    matchRefType: "issue",
    relationshipType: "references",
    confidence: 0.8,
  },
],
```

**Sentry** — remove issue↔commit (cross-provider), remove issue↔linear:issue (cross-provider):
```typescript
edgeRules: [],
```

**Vercel** — keep deployment↔commit (entity co-occurrence still works):
```typescript
edgeRules: [
  {
    refType: "deployment",
    matchProvider: "github",
    matchRefType: "commit",
    relationshipType: "deploys",
    confidence: 1.0,
  },
],
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-providers typecheck` passes
- [x] `pnpm --filter @repo/console-providers check` passes (biome)

**Implementation Note**: After this phase, downstream packages will have type errors. Proceed directly to Phase 2.

---

## Phase 2: Pipeline Consumers

Update all Inngest workflow code and the ingress route to use the new schema. After this phase, `api/console` and the ingress route compile.

### Changes Required:

#### 1. Ingress Route: `apps/console/src/app/api/gateway/ingress/route.ts`

Field renames in the `workspaceIngestLog.values()` call:

```typescript
// Old:
sourceType: sourceEvent.sourceType,
// New:
sourceType: sourceEvent.eventType,
```

The `source` column continues to use `envelope.provider` (unchanged).

#### 2. DB Schema Type: `db/console/src/schema/tables/workspace-ingest-log.ts`

The JSONB column type annotation changes because `PostTransformEvent` changed shape. No migration needed — the column is JSONB, the TS type annotation is compile-time only:

```typescript
sourceEvent: jsonb("source_event").$type<PostTransformEvent>().notNull(),
// Already correct — PostTransformEvent is the same import, just different shape
```

#### 3. DB Schema Type: `db/console/src/schema/tables/workspace-events.ts`

Same — `sourceReferences` column stores `PostTransformReference[]` or `EntityRelation[]`. Update the `$type<>` annotation:

```typescript
// Old:
sourceReferences: jsonb("source_references").$type<PostTransformReference[]>(),
// New:
sourceReferences: jsonb("source_references").$type<EntityRelation[]>(),
```

The `metadata` column type changes too:
```typescript
// Old:
metadata: jsonb("metadata").$type<Record<string, unknown>>(),
// New:
metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
```

#### 4. Event Store: `api/console/src/inngest/workflow/neural/event-store.ts`

Field renames throughout:

| Old field access | New field access |
|---|---|
| `sourceEvent.source` | `sourceEvent.provider` |
| `sourceEvent.sourceType` | `sourceEvent.eventType` |
| `sourceEvent.sourceId` | `sourceEvent.sourceId` (unchanged) |
| `sourceEvent.references` | `sourceEvent.relations` |
| `sourceEvent.metadata` | `sourceEvent.attributes` |

**`check-event-allowed` step** (lines 241-306):

```typescript
// Old:
const metadata = sourceEvent.metadata;
let resourceId: string | undefined;
switch (sourceEvent.source) {
  case "github":
    resourceId = (metadata.repoId as string | undefined)?.toString();
    break;
  // ...
}

// New:
const attributes = sourceEvent.attributes;
let resourceId: string | undefined;
switch (sourceEvent.provider) {
  case "github":
    resourceId = attributes.repoId != null ? String(attributes.repoId) : undefined;
    break;
  case "vercel":
    resourceId = attributes.projectId != null ? String(attributes.projectId) : undefined;
    break;
  case "sentry":
    resourceId = attributes.projectId != null ? String(attributes.projectId) : undefined;
    break;
  case "linear":
    resourceId = attributes.teamId != null ? String(attributes.teamId) : undefined;
    break;
  default:
    resourceId = undefined;
}
```

Note: no more `as string | undefined` casts — attributes values are typed.

**`isEventAllowed` signature** — eliminate the `providerConfig as { sync?: ... }` cast:

```typescript
// Old signature + call site:
function isEventAllowed(
  providerConfig: { sync?: { events?: string[] } } | null | undefined,
  baseEventType: string
): boolean { ... }
// Called as: isEventAllowed(integration.providerConfig as { sync?: ... }, baseEventType)

// New signature + call site:
import type { ProviderConfig } from "@repo/console-providers";

function isEventAllowed(
  providerConfig: ProviderConfig | null | undefined,
  baseEventType: string
): boolean {
  const events = providerConfig?.sync?.events;
  if (!events || events.length === 0) return true;
  return events.includes(baseEventType);
}
// Called as: isEventAllowed(integration.providerConfig, baseEventType)
```

This works because all `ProviderConfig` variants (github, linear, vercel, sentry) have a `sync: syncSchema` field where `syncSchema = z.object({ events: z.array(z.string()).optional(), autoSync: z.boolean() })`. No cast needed.

**`extract-entities` step** (lines 366-388):

```typescript
// Old:
const references = sourceEvent.references as { type: string; id: string; label?: string }[];
const refEntities = extractFromReferences(references);

// New:
const refEntities = extractFromRelations(sourceEvent.relations);
```

**`store-observation` step** (lines 398-414):

```typescript
// Old:
source: sourceEvent.source,
sourceType: sourceEvent.sourceType,
sourceReferences: sourceEvent.references,
metadata: sourceEvent.metadata,

// New:
source: sourceEvent.provider,
sourceType: sourceEvent.eventType,
sourceReferences: sourceEvent.relations,
metadata: sourceEvent.attributes,
```

**`getBaseEventType` call** (line 286-289):
```typescript
// Old:
const baseEventType = getBaseEventType(sourceEvent.source, sourceEvent.sourceType);

// New:
const baseEventType = getBaseEventType(sourceEvent.provider, sourceEvent.eventType);
```

**`emit-event-stored`** — rename `sourceEvent.source` → `sourceEvent.provider`, `sourceEvent.sourceType` → `sourceEvent.eventType` in the event payload.

#### 5. Entity Extraction: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`

Rename `extractFromReferences` → `extractFromRelations` and update field access:

```typescript
export function extractFromRelations(
  relations: { entityType: string; entityId: string; relationshipType: string }[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const rel of relations) {
    let category: EntityCategory;
    let key: string;

    switch (rel.entityType) {
      case "commit":
        category = "commit";
        key = rel.entityId.substring(0, 7);
        break;
      case "branch":
        category = "branch";
        key = rel.entityId;
        break;
      case "pr":
        category = "pr";
        key = rel.entityId;
        break;
      case "issue":
        category = "issue";
        key = rel.entityId;
        break;
      case "deployment":
        category = "deployment";
        key = rel.entityId;
        break;
      default:
        category = "reference";
        key = rel.entityId;
    }

    entities.push({
      category,
      key,
      value: rel.relationshipType,
      confidence: 0.98,
      evidence: `Relation: ${rel.entityType}`,
    });
  }

  return entities;
}
```

Note: `"assignee"` and `"reviewer"` cases removed (actors excluded in Phase 1).

#### 6. Scoring: `api/console/src/inngest/workflow/neural/scoring.ts`

Field renames:
- `sourceEvent.source` → `sourceEvent.provider`
- `sourceEvent.sourceType` → `sourceEvent.eventType`
- `sourceEvent.references.length` → `sourceEvent.relations.length`

**Fix `EventKey` cast** — replace bare `as EventKey` with a `Map` lookup (zero casts):

```typescript
// Old:
const eventKey = `${sourceEvent.source}:${sourceEvent.sourceType}` as EventKey;
let score = EVENT_REGISTRY[eventKey].weight;

// New — derive a Map at module level for type-safe runtime lookup:
const EVENT_WEIGHT_MAP = new Map<string, number>(
  Object.entries(EVENT_REGISTRY).map(([k, v]) => [k, v.weight])
);
const DEFAULT_EVENT_WEIGHT = 50;

// In scoreSignificance:
const eventKey = `${sourceEvent.provider}:${sourceEvent.eventType}`;
let score = EVENT_WEIGHT_MAP.get(eventKey) ?? DEFAULT_EVENT_WEIGHT;
```

`Map.get()` returns `number | undefined` — the `??` fallback handles unknown event types at runtime without any cast. Explicit `Map<string, number>` generic eliminates the need for `as const` on the tuple.

#### 7. Classification: `api/console/src/inngest/workflow/neural/classification.ts`

**Change parameter types** from `PostTransformEvent` to `ClassificationInput`. Both functions only access `provider`, `eventType`, `title`, `body` — they never touch `entity`, `relations`, `attributes`, or other fields. This eliminates the `as unknown as PostTransformEvent` double cast in `event-interpret.ts`:

```typescript
import type { ClassificationInput } from "@repo/console-providers";

export function buildClassificationPrompt(
  sourceEvent: ClassificationInput  // was: PostTransformEvent
): string {
  return `Classify this engineering event into categories.

EVENT DETAILS:
- Source: ${sourceEvent.provider}
- Type: ${sourceEvent.eventType}
- Title: ${sourceEvent.title}
${sourceEvent.body ? `- Description: ${sourceEvent.body.slice(0, 1000)}` : ""}
...`;
}

export function classifyObservationFallback(
  sourceEvent: ClassificationInput  // was: PostTransformEvent
): {
  primaryCategory: string;
  secondaryCategories: string[];
} {
  const body = sourceEvent.body || "";
  const text = `${sourceEvent.eventType} ${sourceEvent.title} ${body}`.toLowerCase();
  // ... rest unchanged
}
```

Note: `PostTransformEvent` satisfies `ClassificationInput` (it's a `Pick`), so call sites passing full events still work without changes.

#### 8. Event Interpret: `api/console/src/inngest/workflow/neural/event-interpret.ts`

**Eliminate all 5 type assertions** in this file:

**Cast 1 — `ws.settings.version as number`** (line 160): Remove cast entirely. `WorkspaceSettings.version` is typed as `z.literal(1)` which infers to the literal type `1`. The comparison `ws.settings.version !== 1` works without a cast:

```typescript
// Old:
if ((ws.settings.version as number) !== 1) {

// New:
if (ws.settings.version !== 1) {
```

**Cast 2 — `as unknown as PostTransformEvent`** (line 178): Now that `buildClassificationPrompt` and `classifyObservationFallback` accept `ClassificationInput` (updated in Item 7 above), the partial object satisfies the type directly:

```typescript
import type { ClassificationInput } from "@repo/console-providers";

// Old:
const sourceEventLike = {
  source: obs.source,
  sourceType: obs.sourceType,
  title: obs.title,
  body: obs.content,
} as unknown as PostTransformEvent;

// New:
const classificationInput: ClassificationInput = {
  provider: obs.source,
  eventType: obs.sourceType,
  title: obs.title,
  body: obs.content,
};
```

No cast. The object literal satisfies `ClassificationInput` directly because it has all 4 required fields (`provider`, `eventType`, `title`, `body`).

**Cast 3 — `as Parameters<typeof generateObject>[0]`** (line 197): Extract the options object into a typed variable. The `step.ai.wrap` call takes a function and its arguments — type the arguments explicitly:

```typescript
// Old:
const llmResult = (await step.ai.wrap(
  "classify-observation",
  generateObject,
  {
    model: createTracedModel("anthropic/claude-3-5-haiku-latest"),
    schema: classificationResponseSchema,
    prompt: buildClassificationPrompt(sourceEventLike),
    temperature: 0.2,
    experimental_telemetry: buildNeuralTelemetry(...),
  } as Parameters<typeof generateObject>[0]
)) as { object: ClassificationResponse };

// New:
const generateOptions: Parameters<typeof generateObject>[0] = {
  model: createTracedModel("anthropic/claude-3-5-haiku-latest"),
  schema: classificationResponseSchema,
  prompt: buildClassificationPrompt(classificationInput),
  temperature: 0.2,
  experimental_telemetry: buildNeuralTelemetry(
    "neural-classification",
    {
      workspaceId,
      sourceType: obs.sourceType,
      source: obs.source,
    }
  ),
};
const llmResult = await step.ai.wrap(
  "classify-observation",
  generateObject,
  generateOptions
);
```

**Cast 4 — `as { object: ClassificationResponse }`** (line 198): The `step.ai.wrap` return type includes `{ object: T }` where `T` is inferred from the schema parameter. With `schema: classificationResponseSchema`, the return type should infer `{ object: ClassificationResponse }`. If Inngest's types don't infer this correctly, use a Zod parse at the access site instead of a cast:

```typescript
// If step.ai.wrap return type is broad:
const classification = classificationResponseSchema.parse(llmResult.object);
```

**Cast 5 — `as ClassificationResponse`** (line 234): Use `satisfies` instead of `as` for the fallback object. `satisfies` validates the shape at compile time without widening the type:

```typescript
// Old:
return {
  topics,
  classification: {
    primaryCategory: fallback.primaryCategory,
    secondaryCategories: fallback.secondaryCategories,
    topics: [],
    confidence: 0.5,
    reasoning: "Fallback regex classification",
  } as ClassificationResponse,
};

// New:
return {
  topics,
  classification: {
    primaryCategory: fallback.primaryCategory,
    secondaryCategories: fallback.secondaryCategories,
    topics: [],
    confidence: 0.5,
    reasoning: "Fallback regex classification",
  } satisfies ClassificationResponse,
};
```

#### 9. Edge Resolver: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

The function signature at line 30 receives:
```typescript
entityRefs: Array<{ type: string; key: string; label: string | null }>
```

The CALLER (event-store.ts) builds this from `sourceEvent.references`. Update the caller to build from `sourceEvent.relations` + `sourceEvent.entity`:

In event-store.ts where `resolveEdges` is called, build entityRefs from the new schema:

```typescript
// Build entityRefs from primary entity + relations
const entityRefs = [
  {
    type: sourceEvent.entity.entityType,
    key: sourceEvent.entity.entityId,
    label: null,
  },
  ...sourceEvent.relations.map((rel) => ({
    type: rel.entityType,
    key: rel.entityId,
    label: rel.relationshipType,
  })),
];
```

The `edge-resolver.ts` itself doesn't need changes — it already works with `{ type, key, label }` objects and the `EdgeRule` matching logic is unchanged.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/console typecheck` passes
- [x] `pnpm --filter @api/console check` passes

**Implementation Note**: After this phase, UI and test files may still have type errors. Proceed to Phase 3.

---

## Phase 3: UI + CLI + Test Data

Update presentation layer and test infrastructure.

### Changes Required:

#### 1. Events Table: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx`

Field renames in live filter matching and event construction:
- `notification.sourceEvent.source` → `notification.sourceEvent.provider`
- `e.sourceEvent.source` → `e.sourceEvent.provider`
- `e.sourceEvent.sourceType` → `e.sourceEvent.eventType`

#### 2. Event Row: same directory `event-row.tsx`

- `event.sourceEvent.title` — unchanged
- `event.sourceEvent.occurredAt` — unchanged
- No other field access changes needed

#### 3. Event Detail: same directory `event-detail.tsx`

Major changes — this renders references and metadata:

```typescript
// Old:
sourceEvent.references.length
sourceEvent.references.map(ref => ref.type, ref.url, ref.label, ref.id)
Object.entries(sourceEvent.metadata)
sourceEvent.sourceId

// New:
sourceEvent.relations.length
sourceEvent.relations.map(rel => rel.entityType, rel.url, rel.relationshipType, rel.entityId)
// Add entity display:
sourceEvent.entity.entityType, sourceEvent.entity.entityId, sourceEvent.entity.state
Object.entries(sourceEvent.attributes)
sourceEvent.sourceId
```

Add an "Entity" section above relations showing the primary entity's type, ID, state, and title.

#### 4. CLI Listen: `core/cli/src/commands/listen.ts`

Update the local inline type `SourceEventNotification` at line 7-17:

```typescript
// Old fields:
sourceEvent.source → sourceEvent.provider
sourceEvent.sourceType → sourceEvent.eventType
// sourceEvent.actor?.name — remove (actor not in schema)
```

#### 5. Test Data: `packages/console-test-data/src/loader/transform.ts`

Update sourceId mutation:
```typescript
// Old:
event.sourceId = `${event.sourceId}:test:${index}`;
event.metadata = { ...event.metadata, testData: true };

// New:
event.sourceId = `${event.sourceId}:test:${index}`;
event.attributes = { ...event.attributes, testData: true };
```

#### 6. Test Data: `packages/console-test-data/src/loader/index.ts`

Update stress scenario sourceId mutation:
```typescript
event.sourceId = `${event.sourceId}:stress:${index}`;
```
(same field, no rename needed)

#### 7. Test Data: `packages/console-test-data/src/cli/verify-datasets.ts`

Update field access:
- `raw.source` → `raw.provider`
- `raw.sourceType` → `raw.eventType`
- `e.metadata.testData` → `e.attributes.testData`
- `e.source` → `e.provider`
- `e.references` → `e.relations`

#### 8. Test Data: `packages/console-test-data/src/trigger/trigger.ts`

- `event.sourceId` — unchanged
- `sourceEvent: event` — passes full PostTransformEvent, unchanged

#### 9. Provider Tests

All test files in `packages/console-providers/src/providers/*/index.test.ts` need updating. Tests assert on the old shape (`source`, `sourceType`, `sourceId`, `references`, `metadata`). Update all assertions to the new shape (`provider`, `eventType`, `sourceId`, `entity`, `relations`, `attributes`).

For each test:
- Assert `result.provider === "github"` (not `result.source`)
- Assert `result.eventType === "pull-request.merged"` (not `result.sourceType`)
- Assert `result.entity.entityType === "pr"`
- Assert `result.entity.entityId === "{repoId}#{number}"`
- Assert `result.entity.state === "merged"`
- Assert `result.relations` array contains expected EntityRelation entries
- Assert `result.attributes.repoId === payload.repository.id`
- Assert `result.deliveryId === context.deliveryId`

#### 10. SSE Stream: `apps/console/src/app/api/gateway/stream/route.ts`

The SSE endpoint reads `sourceEvent` from `workspaceIngestLog` and streams it as raw JSON. No field access changes needed — it passes through the JSONB as-is. Clients (events-table.tsx) already updated in step 1 above.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (full monorepo, only pre-existing @repo/console-openapi failure)
- [x] `pnpm check` passes (full monorepo)
- [x] All existing tests pass with updated assertions

#### Manual Verification:
- [ ] Run `pnpm dev:app`, trigger a GitHub webhook → verify `workspaceIngestLog.sourceEvent` JSONB has new shape
- [ ] Events table in console UI renders correctly for new events
- [ ] Event detail panel shows entity info, relations, and attributes correctly

**Implementation Note**: After completing all automated verification, pause for manual confirmation before considering this plan complete.

---

## Testing Strategy

### Unit Tests:
- Each transformer function tested with representative payloads
- Assert entity.entityId uses numeric IDs (GitHub) / stable identifiers (Linear)
- Assert sourceId format: `{provider}:{entityType}:{entityId}:{eventType}`
- Assert attributes contain resource ID fields (repoId, projectId, teamId)
- Assert relations contain expected entity type + relationship type combinations
- Assert entity.state matches lifecycle state derivation

### Integration Tests:
- Transform → sanitize → validate pipeline produces valid PostTransformEvent
- Entity extraction from relations produces correct ExtractedEntity objects
- Edge resolver matches rules against new relation entityType/relationshipType values

### Manual Testing Steps:
1. Start dev server with `pnpm dev:app`
2. Trigger a GitHub PR webhook (create/merge a PR in test repo)
3. Check `workspaceIngestLog.sourceEvent` in DB studio — verify new schema
4. Check events table in console UI — verify rendering
5. Check event detail panel — verify entity, relations, attributes display
6. Trigger Linear issue webhook — verify Linear transformer output
7. Trigger Vercel deployment — verify Vercel transformer output

## Performance Considerations

None. This is a schema change with no algorithmic impact. The new schema has slightly more structure (nested `entity` object, typed `relations` vs flat `references`) but JSONB storage/retrieval performance is unchanged.

## Migration Notes

- Old `workspaceIngestLog` rows keep their old-format `sourceEvent` JSONB. No migration.
- Old `workspaceEvents` rows keep their old `sourceReferences` and `metadata` JSONB. No migration.
- The UI will show raw JSONB for old events — fields will have old names (`source`, `sourceType`, `references`, `metadata`). This is acceptable per "no backward compat" decision.
- Cross-provider edge rules (commit↔sentry:issue, pr↔linear:issue) temporarily stop matching until Phase 3 (cross-provider relations). Self-referential edges within the same provider still work.

## References

- Design spec: `thoughts/shared/plans/2026-03-13-entity-system-redesign.md`
- Pipeline research: `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md`

---

## Update Log

### 2026-03-13 — Eliminate all type assertions (`as` casts) from entity pipeline

- **Trigger**: Audit revealed 8 `as` casts across the pipeline; plan originally addressed 5 (removing old casts) but retained 1 (`as unknown as PostTransformEvent`) and missed 5 others entirely.
- **Changes**:
  - Added Key Design Decision #4: "Zero Type Assertions" with full inventory of all 8 casts and their fixes
  - Added `ClassificationInput` type to Phase 1 schema (`Pick<PostTransformEvent, "provider" | "eventType" | "title" | "body">`)
  - Phase 1, Item 6 (Vercel): Changed `eventType` parameter from `string` to `VercelWebhookEventType` — eliminates `eventType as VercelWebhookEventType` cast
  - Phase 2, Item 4 (Event Store): Added `isEventAllowed` signature change to accept `ProviderConfig` directly — eliminates `providerConfig as { sync?: ... }` cast
  - Phase 2, Item 6 (Scoring): Replaced `as EventKey` cast with `Map` lookup + `DEFAULT_EVENT_WEIGHT` fallback
  - Phase 2, Item 7 (Classification): Changed `buildClassificationPrompt` and `classifyObservationFallback` to accept `ClassificationInput` instead of `PostTransformEvent`
  - Phase 2, Item 8 (Event Interpret): Rewrote to eliminate all 5 casts — `ws.settings.version as number`, `as unknown as PostTransformEvent`, `as Parameters<typeof generateObject>[0]`, `as { object: ClassificationResponse }`, `as ClassificationResponse`
  - Added "zero assertions" bullet to Desired End State
- **Impact on remaining work**: Phase 3 (UI/CLI/tests) is unaffected — no casts exist in those files. All cast fixes are in Phase 1 (schema + Vercel transformer) and Phase 2 (pipeline consumers).
