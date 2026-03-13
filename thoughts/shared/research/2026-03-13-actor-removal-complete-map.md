---
date: 2026-03-13T00:25:04Z
researcher: claude
git_commit: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Actor reconciliation removal — complete codebase map"
tags: [research, codebase, actor, reconciliation, removal, db-schema, console-providers, inngest]
status: complete
last_updated: 2026-03-13
---

# Research: Actor Reconciliation Removal — Complete Codebase Map

**Date**: 2026-03-13T00:25:04Z
**Git Commit**: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Deep research into "actor" in the codebase for complete removal. All actor reconciliation and related code must be deleted — DB tables updated, and all client-side and server files cleaned.

## Summary

The standalone actor identity/profile tables (`workspace_actor_profiles`, `workspace_actor_identities`, `org_actor_identities`) were already dropped in past migrations (0024 and 0041). What remains is "actor as metadata" — actor data that flows from provider webhook payloads through to DB columns, Inngest workflows, validation schemas, AI search filters, and UI rendering.

Hono microservices (relay, gateway, backfill) have **zero** actor references in source code. The heaviest concentration is in `packages/console-providers/` (transformer layer) and `packages/console-validation/` (schema layer).

There is no dedicated actor reconciliation Inngest function — actor was reconciled into standalone tables that are now gone. What remains are actor fields on existing tables and the pipeline that populates them.

---

## Detailed Findings

### 1. Database Schema — Live Actor Columns

The standalone actor tables are gone. These columns survive on two live tables:

#### `workspace_events` table
- `db/console/src/schema/tables/workspace-events.ts:39` — `ObservationActor` interface defined (exported)
- `db/console/src/schema/tables/workspace-events.ts:106` — `actor` column: JSONB typed as `ObservationActor | null`
- `db/console/src/schema/tables/workspace-events.ts:111` — `actorId` column: bigint FK (referenced table was dropped in migration 0041)

#### `workspace_user_activities` table
- `db/console/src/schema/tables/workspace-user-activities.ts:59` — `actorType` varchar column
- `db/console/src/schema/tables/workspace-user-activities.ts:67` — `actorUserId` column
- `db/console/src/schema/tables/workspace-user-activities.ts:74` — `actorEmail` column
- `db/console/src/schema/tables/workspace-user-activities.ts:81` — `actorIp` column
- `db/console/src/schema/tables/workspace-user-activities.ts:182` — `activity_actor_idx` index on `actorUserId`

#### Re-exports to clean up
- `db/console/src/schema/tables/index.ts` — re-exports `ObservationActor`
- `db/console/src/schema/index.ts` — re-exports `ObservationActor`
- `db/console/src/index.ts` — re-exports `ObservationActor` transitively

#### Migration history (read-only — no changes needed to .sql files)
- `0011_sharp_moon_knight.sql` — created `workspace_actor_profiles`, `workspace_actor_identities`, `actor_id` FK on observations
- `0016_watery_sentinels.sql` — recreated `workspace_actor_identities`, recreated `workspace_user_activities` with actor columns
- `0017_first_lady_ursula.sql` — recreated `workspace_actor_profiles`
- `0020_funny_selene.sql` — renamed `actor_id` → `canonical_actor_id` on identities
- `0021_jazzy_edwin_jarvis.sql` — added `clerk_user_id` to profiles, dropped columns
- `0022_brainy_lady_deathstrike.sql` — created `org_actor_identities`
- `0023_dizzy_thunderbolt.sql` — dropped `avatar_url` and `clerk_user_id` from profiles
- `0024_mighty_payback.sql` — **dropped** `workspace_actor_identities`
- `0041_warm_plazm.sql` — **dropped** `org_actor_identities` and `workspace_actor_profiles`

---

### 2. Inngest Workflows — Actor Field Usage

No dedicated actor reconciliation function exists. Actor appears as data fields in 4 files under `api/console/src/inngest/`:

#### Event schema definitions
- `api/console/src/inngest/client/client.ts:45–50` — `apps-console/activity.record` event payload schema: `actorType`, `actorUserId`, `actorEmail` Zod fields
- `api/console/src/inngest/client/client.ts:145–150` — Neural ingest event schema: `actor` object field with `{ id, name, email, avatarUrl }`

#### Workflow write steps
- `api/console/src/inngest/workflow/infrastructure/record-activity.ts:79–81` — DB insert step: passes `actorType`, `actorUserId`, `actorEmail` into `workspace_user_activities`
- `api/console/src/inngest/workflow/neural/event-store.ts:404` — DB insert step: passes `actor: sourceEvent.actor ?? null` into `workspace_events`

#### Workflow read steps
- `api/console/src/inngest/workflow/neural/event-interpret.ts:140` — Drizzle select: `actor: true` field included in observations query
- `api/console/src/inngest/workflow/neural/event-interpret.ts:307` — Reads `obs.actor?.name ?? "unknown"` to build vector metadata for embedding

---

### 3. Provider Transformer Layer — Actor Origin

Actor data originates in `packages/console-providers/` where each provider transformer populates the `actor` field on `PostTransformEvent`.

#### Core actor type
- `packages/console-providers/src/post-transform-event.ts:11` — `postTransformActorSchema` Zod schema definition
- `packages/console-providers/src/post-transform-event.ts:50` — `actor` field on `PostTransformEvent`
- `packages/console-providers/src/post-transform-event.ts:57` — `PostTransformActor` TypeScript type
- `packages/console-providers/src/validation.ts:57–62` — Actor field validation: `avatarUrl` URL format check
- `packages/console-providers/src/index.ts:35,41,86,127` — Barrel exports: `PostTransformActor`, `postTransformActorSchema`, `LinearActor`, `SentryActor`

#### Per-provider actor schemas
- `packages/console-providers/src/providers/sentry/schemas.ts:5,167,174,184,212,225` — `sentryActorSchema`, `SentryActor` type; `actor` field on Sentry issue, resolved, and assignee schemas
- `packages/console-providers/src/providers/linear/schemas.ts:5,213,265` — `linearActorSchema`, `LinearActor` type; `actor` field on Linear event schema

#### Per-provider actor population (transformers)
- `packages/console-providers/src/providers/github/transformers.ts:58,179,266,328,389` — sets `actor` from PR user, issue user, release author, commit author across 5 event types
- `packages/console-providers/src/providers/linear/transformers.ts:136,221,305,393,464` — sets `actor` from issue creator, comment user, project lead across 5 event types
- `packages/console-providers/src/providers/sentry/transformers.ts:95–98,178,248,309` — sets `actor` from `payload.actor` or `errorEvent.user`
- `packages/console-providers/src/providers/vercel/transformers.ts:117` — sets `actor` from `gitMeta.githubCommitAuthorName`
- `packages/console-providers/src/providers/sentry/backfill.ts:93` — sets `actor` in backfill output

#### Test files with actor assertions
- `packages/console-providers/src/providers/github/backfill-round-trip.test.ts:171–174,235–238,271–274`
- `packages/console-providers/src/providers/linear/backfill.test.ts:452–455`
- `packages/console-providers/src/providers/sentry/backfill.test.ts:336–339,455–456`

---

### 4. Validation Schemas

- `packages/console-validation/src/schemas/activities.ts:20,22` — `actorTypeSchema` enum (`"user" | "system" | "webhook" | "api"`), `ActorType` TypeScript type
- `packages/console-validation/src/schemas/activities.ts:634–637` — Activity schema fields: `actorType`, `actorUserId`, `actorEmail`, `actorIp`
- `packages/console-validation/src/schemas/neural.ts:1` — imports `PostTransformActor` from `@repo/console-providers`
- `packages/console-validation/src/schemas/neural.ts:15–20` — `resolvedActorSchema` with `actorId` (nullable string) and `sourceActor`; `ResolvedActor` type
- `packages/console-validation/src/schemas/neural.ts:26` — `actorName` field
- `packages/console-validation/src/schemas/api/v1/search.ts:27,164,197,230` — `actorNames` filter input, `relevantActors` in response, `actorSearch` timing metric, `actor` in path tracking
- `packages/console-validation/src/schemas/api/v2/common.ts:20` — `actorNames` filter field in v2 common schema
- `packages/console-validation/src/schemas/api/v1/findsimilar.ts:61` — "actors" in description comment only

---

### 5. AI Search Layer

- `packages/console-ai-types/src/index.ts:16` — `actorNames?: string[]` on search input type
- `packages/console-ai/src/workspace-search.ts:27–30` — `actorNames` Zod tool parameter: `"Filter by actor name"`

---

### 6. Client-Side Components (apps/console/src/)

#### Events feature
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx:282` — "Actor" `<TableHead>` column header
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-detail.tsx:36–56` — renders `sourceEvent.actor`: `avatarUrl`, `name`, `email`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-row.tsx:83` — displays `event.sourceEvent.actor?.name`

#### Search results
- `apps/console/src/components/search-results-list.tsx:41,58–62` — renders `searchResults.context.relevantActors`

#### Type re-export
- `apps/console/src/types/index.ts:99` — `export type ActorType = WorkspaceActivity["actorType"]` derived from DB schema

---

### 7. Hono Microservices

**Zero source code actor references** in `apps/relay/`, `apps/gateway/`, or `apps/backfill/`.

Only in fixture files (test data — no changes needed):
- `apps/relay/src/__fixtures__/sentry-issue.json:6` — `"actor"` field in sample Sentry payload
- `apps/relay/src/__fixtures__/linear-issue-create.json:9` — `"actor"` field in sample Linear payload

---

## Actor Type Summary

| Type / Schema | Defined In |
|---|---|
| `PostTransformActor` / `postTransformActorSchema` | `packages/console-providers/src/post-transform-event.ts` |
| `SentryActor` / `sentryActorSchema` | `packages/console-providers/src/providers/sentry/schemas.ts` |
| `LinearActor` / `linearActorSchema` | `packages/console-providers/src/providers/linear/schemas.ts` |
| `ObservationActor` | `db/console/src/schema/tables/workspace-events.ts` |
| `ActorType` (enum) | `packages/console-validation/src/schemas/activities.ts` |
| `ResolvedActor` / `resolvedActorSchema` | `packages/console-validation/src/schemas/neural.ts` |
| `actorNames` (search input) | `packages/console-ai-types/src/index.ts`, `packages/console-ai/src/workspace-search.ts`, `packages/console-validation/src/schemas/api/v1/search.ts`, `packages/console-validation/src/schemas/api/v2/common.ts` |
| `ActorType` (app re-export) | `apps/console/src/types/index.ts` |

---

## Removal Checklist by Layer

### DB Schema (`db/console/`) — new migration required
- [ ] Drop `actor` JSONB column from `workspace_events`
- [ ] Drop `actorId` bigint column from `workspace_events`
- [ ] Drop `actorType`, `actorUserId`, `actorEmail`, `actorIp` columns from `workspace_user_activities`
- [ ] Drop `activity_actor_idx` index
- [ ] Remove `ObservationActor` interface from `workspace-events.ts`
- [ ] Remove re-exports from `schema/tables/index.ts`, `schema/index.ts`
- [ ] Run `pnpm db:generate` from `db/console/`

### Inngest (`api/console/src/inngest/`)
- [ ] Remove `actorType`, `actorUserId`, `actorEmail` from `activity.record` event schema in `client.ts`
- [ ] Remove `actor` object field from neural ingest event schema in `client.ts`
- [ ] Remove actor insert fields from `record-activity.ts`
- [ ] Remove `actor: sourceEvent.actor` from `event-store.ts`
- [ ] Remove `actor: true` from Drizzle select in `event-interpret.ts`
- [ ] Remove `obs.actor?.name` read in `event-interpret.ts` (update vector metadata fallback)

### Provider Transformers (`packages/console-providers/`)
- [ ] Delete or clear `postTransformActorSchema` and `PostTransformActor` from `post-transform-event.ts`
- [ ] Remove `actor` field from `PostTransformEvent`
- [ ] Remove actor validation from `validation.ts`
- [ ] Remove `sentryActorSchema`, `SentryActor` from `providers/sentry/schemas.ts`
- [ ] Remove `linearActorSchema`, `LinearActor` from `providers/linear/schemas.ts`
- [ ] Remove `actor` population from all 4 provider transformers (GitHub, Linear, Sentry, Vercel)
- [ ] Remove `actor` from `sentry/backfill.ts`
- [ ] Update barrel exports in `index.ts`
- [ ] Update test assertions in `github/backfill-round-trip.test.ts`, `linear/backfill.test.ts`, `sentry/backfill.test.ts`

### Validation (`packages/console-validation/`)
- [ ] Remove `actorTypeSchema`, `ActorType` from `schemas/activities.ts`
- [ ] Remove actor columns from activity schema
- [ ] Remove `resolvedActorSchema`, `ResolvedActor`, `actorId`, `sourceActor`, `actorName` from `schemas/neural.ts`
- [ ] Remove `actorNames`, `relevantActors`, `actorSearch`, `actor` path tracking from `schemas/api/v1/search.ts`
- [ ] Remove `actorNames` from `schemas/api/v2/common.ts`

### AI Search (`packages/console-ai-types/`, `packages/console-ai/`)
- [ ] Remove `actorNames` from `console-ai-types/src/index.ts`
- [ ] Remove `actorNames` tool parameter from `console-ai/src/workspace-search.ts`

### Client (`apps/console/src/`)
- [ ] Remove `ActorType` export from `types/index.ts`
- [ ] Remove "Actor" column from `events-table.tsx`
- [ ] Remove actor rendering from `event-detail.tsx`
- [ ] Remove actor cell from `event-row.tsx`
- [ ] Remove `relevantActors` rendering from `search-results-list.tsx`

### Hono Services — no changes needed
- Fixture files (`sentry-issue.json`, `linear-issue-create.json`) are test data representing external payloads — no changes required

---

## Architecture Documentation

Actor data followed this flow:

```
External webhook payload (Sentry/Linear/GitHub/Vercel)
  ↓ apps/relay/ (HMAC verify → QStash dispatch)
  ↓ api/console/src/inngest/ (neural ingest event)
  ↓ packages/console-providers/ transformer sets actor on PostTransformEvent
  ↓ event-store.ts writes actor JSONB → workspace_events.actor
  ↓ record-activity.ts writes actorType/actorUserId/actorEmail → workspace_user_activities
  ↓ event-interpret.ts reads actor.name → vector metadata for embedding
  ↓ apps/console/src/components/ renders actor name/avatar in UI
  ↓ packages/console-ai/ exposes actorNames as search filter → relevantActors in results
```

The earlier actor reconciliation system (matching raw actor data to canonical identity records across `workspace_actor_profiles` / `workspace_actor_identities` / `org_actor_identities`) has already been removed. What remains is actor as raw metadata on events and activities.

## Open Questions

- Should `actorIp` on `workspace_user_activities` be kept for audit/compliance purposes even if other actor fields are removed?
- The `actorId` bigint FK on `workspace_events` referenced the now-dropped actor profiles table — this is effectively a dead column with a dangling reference. Needs verification of whether any FK constraint remains.
- When removing `obs.actor?.name` from `event-interpret.ts:307`, what fallback should be used for vector metadata author attribution?
