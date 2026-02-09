---
date: 2026-02-06T12:00:00+08:00
researcher: jeevan
git_commit: b747d596
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Actor System Architecture and Duplicate Actor Analysis"
tags: [research, codebase, actor, identity, deduplication, actor-filter, workspace-actor-profiles, org-actor-identities]
status: complete
last_updated: 2026-02-06
last_updated_by: jeevan
---

# Research: Actor System Architecture and Duplicate Actor Analysis

**Date**: 2026-02-06T12:00:00+08:00
**Researcher**: jeevan
**Git Commit**: b747d596
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Understand the actor system that has been designed in Lightfast. Currently, in actor-filter the same user is repeated multiple times.

## Summary

The Lightfast actor system uses a **two-table architecture** separating org-level identity (`orgActorIdentities`) from workspace-level activity (`workspaceActorProfiles`). Each table has unique constraints, but the same physical person can have multiple `workspaceActorProfiles` rows because:

1. **Vercel-before-GitHub timing**: Creates `github:username` then `github:12345678` as separate canonical IDs
2. **Cross-source identities**: Same person appears as `github:123`, `linear:abc`, `sentry:def`
3. **Observation reconciliation gap**: The reconciliation logic updates observations but does NOT reconcile the profiles table

## Detailed Findings

### Two-Table Actor Architecture

#### Table 1: `orgActorIdentities` (Org-Level Identity)

**File**: `db/console/src/schema/tables/org-actor-identities.ts`

Stores cross-workspace identity data at the organization level. One record per actor per org.

| Column | Type | Purpose |
|--------|------|---------|
| `clerkOrgId` | VARCHAR(191) | Organization scope |
| `canonicalActorId` | VARCHAR(191) | Format: `{source}:{sourceId}` (e.g., `github:12345678`) |
| `source` | VARCHAR(50) | Source system (e.g., "github") |
| `sourceId` | VARCHAR(255) | Source-specific ID |
| `sourceUsername` | VARCHAR(255) | Username from source |
| `sourceEmail` | VARCHAR(255) | Email from source |
| `avatarUrl` | TEXT | Profile avatar |
| `clerkUserId` | VARCHAR(191) | Links to authenticated Clerk user |

**Unique constraint**: `(clerkOrgId, source, sourceId)` at lines 105-109.

#### Table 2: `workspaceActorProfiles` (Workspace-Level Activity)

**File**: `db/console/src/schema/tables/workspace-actor-profiles.ts`

Stores workspace-specific activity metrics. One record per actor per workspace.

| Column | Type | Purpose |
|--------|------|---------|
| `workspaceId` | VARCHAR(191) | FK to `orgWorkspaces` |
| `actorId` | VARCHAR(191) | Canonical actor ID (e.g., `github:12345678`) |
| `displayName` | VARCHAR(255) | Human-readable name |
| `email` | VARCHAR(255) | Actor email |
| `observationCount` | INTEGER | Activity count |
| `lastActiveAt` | TIMESTAMP | Last activity time |

**Unique constraint**: `(workspaceId, actorId)` at lines 120-123.

#### Table 3: Observation Actor Reference

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts`

Observations store actor data in two ways:
- `actor` (JSONB, line 103): Full actor data `{ id, name, email?, avatarUrl? }`
- `actorId` (BIGINT, line 108): Reference to resolved actor profile (currently NULL — Phase 5 pending)

### Canonical Actor ID Format

Constructed in `api/console/src/inngest/workflow/neural/actor-resolution.ts:126-132`:

| Source | Format | Example |
|--------|--------|---------|
| GitHub | `github:{numericId}` | `github:12345678` |
| Vercel (resolved) | `github:{numericId}` | `github:12345678` |
| Vercel (fallback) | `github:{username}` | `github:octocat` |
| Linear | `linear:{uuid}` | `linear:abc-123-def` |
| Sentry | `sentry:{id}` | `sentry:abc123` |

### Actor Resolution Flow

```
Webhook Event (GitHub/Vercel/Linear/Sentry)
    │
    ▼
observation-capture.ts: resolveActor()
    │
    ▼
actor-resolution.ts: Construct canonical ID
    │  ├── GitHub: github:{sender.id}  (always numeric)
    │  ├── Vercel: attempts commit SHA resolution
    │  │     ├── Success: github:{numericId}
    │  │     └── Failure: github:{username}  ← Creates duplicate potential
    │  ├── Linear: linear:{creator.id}
    │  └── Sentry: sentry:{actor.id}
    │
    ▼
observation-capture.ts: Insert observation with actor JSONB
    │
    ▼
Trigger: neural/profile.update Inngest event
    │
    ▼
profile-update.ts:
    ├── Step 3: upsertOrgActorIdentity()  (org-level)
    │     └── UPSERT on (clerkOrgId, source, sourceId)
    └── Step 4: upsert workspaceActorProfiles  (workspace-level)
          └── UPSERT on (workspaceId, actorId)
```

### Source Actor Extraction by Platform

**GitHub** (`packages/console-webhooks/src/transformers/github.ts:76-85`):
- Uses `payload.sender.id` (numeric, immutable)
- Name from `payload.sender.login`
- Email from `payload.pusher?.email`

**Vercel** (`packages/console-webhooks/src/transformers/vercel.ts:122-127`):
- Only has `gitMeta.githubCommitAuthorName` (username, NOT numeric ID)
- No email or avatar available
- Requires commit SHA resolution to get numeric ID

**Linear** (`packages/console-webhooks/src/transformers/linear.ts:463-470`):
- Uses `issue.creator.id` (Linear UUID)
- Name from `issue.creator.displayName`

### How Duplicates Appear in actor-filter

#### The getActors Query

**File**: `api/console/src/router/org/workspace.ts:1406-1444`

```typescript
const actors = await db.query.workspaceActorProfiles.findMany({
  where: and(...conditions),
  limit: input.limit,
  orderBy: [desc(workspaceActorProfiles.observationCount)],
});

return actors.map((a) => ({
  id: a.id,
  displayName: a.displayName,
  observationCount: a.observationCount,
}));
```

No DISTINCT or GROUP BY. Returns all matching profiles. If a person has multiple `actorId` values, each creates a separate profile row.

#### Duplicate Scenario 1: Vercel-Before-GitHub Timing

1. Vercel deployment webhook arrives
2. `resolveVercelActorViaCommitSha()` queries for GitHub push with same commit SHA (`actor-resolution.ts:47-57`)
3. No GitHub push found yet → resolution returns `null`
4. Canonical ID set to `github:octocat` (username-based, `actor-resolution.ts:131`)
5. Profile created: `actorId = "github:octocat"`, `displayName = "octocat"`

Later:

6. GitHub push webhook arrives
7. Canonical ID set to `github:12345678` (numeric, `actor-resolution.ts:132`)
8. **New** profile created: `actorId = "github:12345678"`, `displayName = "octocat"`
9. Reconciliation at `observation-capture.ts:244-329` updates **observations** but NOT profiles

**Result**: Two rows in `workspaceActorProfiles` for the same person, both with `displayName = "octocat"`.

#### Duplicate Scenario 2: Cross-Source Identities

Same person active in GitHub, Linear, and Sentry:
- Profile 1: `actorId = "github:12345678"`, `displayName = "octocat"`
- Profile 2: `actorId = "linear:abc-123"`, `displayName = "Octocat"`
- Profile 3: `actorId = "sentry:def-456"`, `displayName = "octocat@example.com"`

No cross-source identity resolution exists. Each source creates independent profiles.

#### Duplicate Scenario 3: Username Changed on GitHub

If a user changes their GitHub username between Vercel events:
- Profile 1: `actorId = "github:old-username"` (unresolved Vercel event)
- Profile 2: `actorId = "github:new-username"` (another unresolved Vercel event)
- Profile 3: `actorId = "github:12345678"` (GitHub push with numeric ID)

### Profile Update Mechanics

**File**: `api/console/src/inngest/workflow/neural/profile-update.ts:183-213`

- Upserts on conflict target `(workspaceId, actorId)`
- Uses `COALESCE` for `displayName` and `email` at lines 206-207 — preserves existing values
- Updates `observationCount` and `lastActiveAt` on conflict at lines 209-210
- Debounced: 5 minutes per actor (`profile-update.ts:36-39`)
- Concurrency: 5 per workspace (`profile-update.ts:42-45`)

### Observation Reconciliation (Does NOT Fix Profiles)

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:244-329`

The `reconcileVercelActorsForCommit` function:
- Triggered when GitHub push arrives (lines 1023-1047)
- Finds Vercel observations with matching commit SHA via JSONB containment operator
- Updates the `actor` JSONB field in observations to include numeric ID
- Does **NOT** update `workspaceActorProfiles`
- Does **NOT** merge the `github:username` profile into `github:numericId`

### Clerk User Linking

**File**: `api/console/src/lib/actor-linking.ts`

- `ensureActorLinked()` (lines 35-68): Lazily links Clerk user to their GitHub identity at the org level
- `getActorForClerkUser()` (lines 78-99): Looks up actor identity for authenticated user
- Linking targets `orgActorIdentities`, not `workspaceActorProfiles`
- Uses GitHub `externalAccounts.providerUserId` from Clerk

### Actor Search

**File**: `apps/console/src/lib/neural/actor-search.ts:50-196`

Two search modes:
1. **@mentions**: Search `orgActorIdentities` by `sourceUsername` (org-level, cross-workspace)
2. **Name search**: Search `workspaceActorProfiles` by `displayName` (workspace-level)

Avatar URLs come from `orgActorIdentities` (identity), not `workspaceActorProfiles` (activity).

## Code References

### Database Schema
- `db/console/src/schema/tables/org-actor-identities.ts` — Org-level identity table
- `db/console/src/schema/tables/workspace-actor-profiles.ts` — Workspace-level activity table
- `db/console/src/schema/tables/workspace-neural-observations.ts:28-35,100-108` — Actor fields in observations
- `db/console/src/schema/relations.ts:73-85,99-108,122-128` — Drizzle relations

### Actor Resolution & Creation
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:86-138` — Canonical ID construction
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:37-78` — Vercel→GitHub commit SHA resolution
- `api/console/src/inngest/workflow/neural/observation-capture.ts:244-329` — Vercel actor reconciliation (observations only)
- `api/console/src/inngest/workflow/neural/observation-capture.ts:1023-1047` — Reconciliation trigger
- `api/console/src/inngest/workflow/neural/profile-update.ts:157-232` — Profile upsert workflow
- `api/console/src/lib/actor-identity.ts:23-63` — Org identity upsert

### Webhook Transformers
- `packages/console-webhooks/src/transformers/github.ts:76-85` — GitHub actor extraction
- `packages/console-webhooks/src/transformers/vercel.ts:122-127` — Vercel actor extraction (username only)
- `packages/console-webhooks/src/transformers/linear.ts:463-470` — Linear actor extraction

### Clerk Integration
- `api/console/src/lib/actor-linking.ts:35-68` — Lazy actor linking
- `api/console/src/lib/actor-linking.ts:78-99` — Clerk user → actor lookup

### UI & API
- `apps/console/src/components/actor-filter.tsx:24-123` — Actor filter component
- `api/console/src/router/org/workspace.ts:1406-1444` — getActors tRPC procedure
- `apps/console/src/lib/neural/actor-search.ts:50-196` — Actor search logic

## Architecture Documentation

### Identity Resolution Tiers

The actor system operates on a tiered identity model:

1. **Source-Level**: Raw actor data from webhooks (GitHub sender ID, Linear creator ID, Vercel username)
2. **Canonical-Level**: Formatted as `{source}:{sourceId}` — the unique key for profiles
3. **Org-Level**: `orgActorIdentities` maps canonical IDs to Clerk users and stores avatar/username
4. **Workspace-Level**: `workspaceActorProfiles` tracks per-workspace activity metrics

### Cross-Source Identity Gap

There is currently no mechanism to link identities across sources. A person who is `github:12345678` and `linear:abc-123` exists as two separate profiles. The `orgActorIdentities` table stores each source identity independently with the unique constraint `(clerkOrgId, source, sourceId)`.

### Vercel Resolution Strategy

Vercel events carry only a username, not a numeric GitHub ID. The system attempts to resolve this by:
1. Looking up existing GitHub observations with the same commit SHA
2. Extracting the numeric ID from the matched GitHub observation's actor data
3. Falling back to username-based ID if no match found

This creates a race condition where Vercel events processed before their corresponding GitHub push will get username-based IDs that are never reconciled at the profile level.

## Historical Context (from thoughts/)

The actor system has extensive historical documentation:

### Core Design Documents
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` — End-to-end design for actor resolution including OAuth and identity tiers
- `thoughts/shared/research/2025-12-16-actor-identity-scope-analysis.md` — Research on workspace vs org level actor identity architecture
- `thoughts/shared/plans/2025-12-16-org-level-actor-identities.md` — Plan for migrating from workspace-level to org-level identities

### Bug Analysis
- `thoughts/shared/research/2025-12-15-actor-implementation-plan-analysis.md` — Analysis covering bugs, edge cases, and future integrations
- `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md` — Bugfix plan for double prefix, display names, and OAuth resolution
- `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md` — Audit of GitHub ID as single source of truth

### Integration Context
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` — Linear integration with actor handling
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` — Sentry integration with actor tracking

### Recent Search/Filter Work
- `thoughts/shared/plans/2026-02-06-workspace-search-component-decomposition.md` — Search component decomposition including ActorFilter extraction
- `thoughts/shared/research/2026-02-06-workspace-search-composable-decomposition.md` — Composable search components including actor filters

## Related Research
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` — Database design covering actor ID bugs and profiles vs identities
- `thoughts/shared/research/2026-02-06-relationship-graph-definitive-links.md` — Relationship graph with actor connections

## Open Questions

1. **Profile reconciliation**: When the observation reconciliation runs (`observation-capture.ts:244-329`), it updates observations but not profiles — the `github:username` profile persists alongside `github:numericId`
2. **Cross-source linking**: No mechanism exists to merge `github:123`, `linear:abc`, and `sentry:def` into a single profile for the same person
3. **Phase 5 migration**: The `actorId` BIGINT field on observations (line 108) is currently NULL — the migration to link observations to resolved profiles is pending
4. **observationCount accuracy**: The profile-update workflow counts observations by querying `workspaceNeuralObservations` with the numeric `actorId`, but observations created with username-based IDs may not be counted (since the JSONB actor.id won't match the profile's numeric actorId)
