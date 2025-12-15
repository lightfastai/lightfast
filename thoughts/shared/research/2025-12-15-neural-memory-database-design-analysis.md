---
date: 2025-12-15T04:48:53Z
researcher: claude
git_commit: 016fff9bb3145ac1d05270e822174798afd22909
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Database Design Analysis"
tags: [research, codebase, neural-memory, actor-profiles, database-schema]
status: complete
last_updated: 2025-12-15
last_updated_by: claude
---

# Research: Neural Memory Database Design Analysis

**Date**: 2025-12-15T04:48:53Z
**Researcher**: claude
**Git Commit**: 016fff9bb3145ac1d05270e822174798afd22909
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Analysis of the Neural Memory database design, specifically:
1. Why `actor_id` in `lightfast_workspace_actor_profiles` shows values like `github:github:12364` or `vercel:github:bob`
2. Why `display_name` shows "github" on basically everything
3. The relationship between observations and actor profiles
4. The purpose of `lightfast_workspace_actor_identities` vs `lightfast_workspace_actor_profiles`

## Summary

The Neural Memory system has **two bugs in the actor data flow** that explain the confusing database values:

1. **Double prefix bug**: Actor IDs are prefixed twice - once by transformers and again by actor resolution, creating `github:github:username` instead of `github:username`
2. **Display name extraction bug**: Display names are extracted using `actorId.split(":")[1]` which gets the middle segment "github" instead of the actual username

The **actor_profiles** and **actor_identities** tables serve different purposes:
- **Profiles**: Aggregated workspace-level view of each actor (stats, expertise, embeddings)
- **Identities**: Cross-platform identity mapping cache (links source IDs to workspace actors)

## Detailed Findings

### 1. Actor ID Double Prefix Bug

**Root Cause Chain:**

**Step 1**: GitHub webhook transformers add a `github:` prefix to actor IDs:

`packages/console-webhooks/src/transformers/github.ts:76-81` (Push events):
```typescript
actor: payload.pusher?.name
  ? {
      id: `github:${payload.pusher.name}`,  // Creates "github:jeevanpillay"
      name: payload.pusher.name,
      email: payload.pusher.email || undefined,
    }
  : undefined,
```

`packages/console-webhooks/src/transformers/github.ts:202-207` (PR events):
```typescript
actor: pr.user
  ? {
      id: `github:${pr.user.id}`,  // Creates "github:12364" (numeric ID)
      name: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    }
  : undefined,
```

**Step 2**: Actor resolution adds ANOTHER source prefix:

`api/console/src/inngest/workflow/neural/actor-resolution.ts:62`:
```typescript
const actorId = `${sourceEvent.source}:${sourceActor.id}`;
// source="github" + sourceActor.id="github:12364"
// Result: "github:github:12364"
```

**Why Different ID Types:**
- Push events use `pusher.name` (username string) → `github:github:jeevanpillay`
- PR/Issue events use `user.id` (numeric GitHub ID) → `github:github:12364`
- Vercel events use Git author name → `vercel:github:bob`

### 2. Display Name Extraction Bug

**Location**: `api/console/src/inngest/workflow/neural/profile-update.ts:65-67`

```typescript
// Extract display name from actorId (source:id -> id)
const displayName = actorId.split(":")[1] ?? actorId;
```

**Problem**: This assumes `source:id` format but receives `source:source:id` format:

| Actor ID | `split(":")[1]` | Expected | Actual |
|----------|-----------------|----------|--------|
| `github:github:12364` | `"github"` | `"12364"` | `"github"` |
| `github:github:alice` | `"github"` | `"alice"` | `"github"` |
| `vercel:github:bob` | `"github"` | `"bob"` | `"github"` |

### 3. Actor Profiles vs Actor Identities

#### Actor Profiles Table

**Purpose**: Unified aggregated view of actor activity within a workspace.

**Schema** (`db/console/src/schema/tables/workspace-actor-profiles.ts`):
- `actorId`: Canonical actor identifier (unfortunately double-prefixed)
- `displayName`: Display name (unfortunately always "github")
- `observationCount`: Number of observations attributed to actor
- `lastActiveAt`: Most recent activity timestamp
- `profileConfidence`: Confidence score (default 0.5)
- **Future fields**: `expertiseDomains`, `contributionTypes`, `activeHours`, `frequentCollaborators`, `profileEmbeddingId`

**Indexed**: Unique on `(workspaceId, actorId)` for fast lookups

**When created**: Asynchronously via `neural/profile.update` workflow after observation capture

#### Actor Identities Table

**Purpose**: Cross-platform identity mapping cache.

**Schema** (`db/console/src/schema/tables/workspace-actor-identities.ts`):
- `actorId`: Resolved workspace actor ID (e.g., Clerk user ID when matched)
- `source`: Source platform (`github`, `vercel`, `sentry`)
- `sourceId`: Platform-specific user ID
- `sourceUsername`: Username at source
- `sourceEmail`: Email used for matching
- `mappingMethod`: How identity was resolved (`oauth`, `email`, `heuristic`)
- `confidenceScore`: Resolution confidence (0.85 for email matches)

**Indexed**: Unique on `(workspaceId, source, sourceId)` for cache lookups

**Design Intent**: Enable cross-platform identity resolution:
```
github:user123  ─┐
vercel:user456  ─┼──> Clerk user_abc123 (same person)
sentry:user789  ─┘
```

**Current State**: Empty (0 rows) because:
1. Test data actors don't have matching emails in Clerk organization
2. OAuth connection (Tier 1) not yet implemented
3. Heuristic matching (Tier 3) not yet implemented

### 4. Observation ↔ Actor Relationship

**Relationship Type**: Soft reference (string-based join, no foreign key)

**In Observations** (`db/console/src/schema/tables/workspace-neural-observations.ts:89-99`):
```typescript
actor: jsonb("actor").$type<ObservationActor | null>(),  // Original JSONB
actorId: varchar("actor_id", { length: 191 }),  // Canonical reference
```

**Key Points**:
- `actor` field stores original source data (name, email, avatarUrl)
- `actorId` stores canonical ID for profile lookup
- No foreign key constraint - observations can exist without profiles
- Profiles are created asynchronously after observations

**Query Pattern** (profile-update.ts:49-56):
```typescript
const observations = await db.query.workspaceNeuralObservations.findMany({
  where: and(
    eq(workspaceNeuralObservations.workspaceId, workspaceId),
    eq(workspaceNeuralObservations.actorId, actorId),  // String equality join
  ),
})
```

### 5. Live Database State (Drizzle Studio Inspection)

| Table | Rows | Key Findings |
|-------|------|--------------|
| `lightfast_workspace_actor_profiles` | 35 | All display_name = "github" or actual names; actor_id double-prefixed |
| `lightfast_workspace_actor_identities` | 0 | Empty - email matching hasn't resolved any actors |
| `lightfast_workspace_neural_observations` | 40 | Rich event data with embeddings, clusters, topics |

**Sample Actor Profile Data**:
- `actor_id`: `github:github:12364`, `github:github:alice`, `vercel:github:bob`
- `display_name`: `github`, `alice`, `bob` (inconsistent due to bug)
- `observation_count`: 1-2
- `profile_confidence`: 0.5 (default)
- All expertise/collaboration fields: NULL

## Code References

### Schema Files
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Observation schema
- `db/console/src/schema/tables/workspace-actor-profiles.ts` - Profile schema
- `db/console/src/schema/tables/workspace-actor-identities.ts` - Identity mapping schema
- `db/console/src/schema/tables/workspace-observation-clusters.ts` - Cluster schema
- `db/console/src/schema/tables/workspace-neural-entities.ts` - Entity extraction schema
- `db/console/src/schema/tables/workspace-temporal-states.ts` - Temporal state tracking

### Workflow Files
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Main capture pipeline
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:62` - Double prefix bug location
- `api/console/src/inngest/workflow/neural/profile-update.ts:67` - Display name bug location

### Transformer Files
- `packages/console-webhooks/src/transformers/github.ts:78,204,296` - First prefix addition
- `packages/console-webhooks/src/transformers/vercel.ts:113` - Vercel actor extraction

## Architecture Documentation

### Three-Tier Identity Resolution (docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md:857-874)

| Tier | Method | Confidence | Status |
|------|--------|------------|--------|
| 1 | OAuth Connection | 1.0 | NOT IMPLEMENTED |
| 2 | Email Matching | 0.85 | Implemented but not triggering |
| 3 | Heuristic Matching | 0.60 | NOT IMPLEMENTED |

### Data Flow

```
GitHub Webhook
    ↓
Transformer (adds github: prefix to actor.id)
    ↓
SourceEvent { actor: { id: "github:12364", name: "alice" } }
    ↓
Observation Capture Workflow
    ↓
Actor Resolution (adds source: prefix again)
    ↓
actorId = "github:github:12364"
    ↓
Store Observation (with actorId)
    ↓
Fire-and-forget: neural/profile.update
    ↓
Profile Update Workflow
    ↓
displayName = actorId.split(":")[1] = "github" (BUG!)
    ↓
Upsert Actor Profile
```

## Historical Context

The design document at `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` specifies the intended architecture but the implementation has diverged:

1. **Design**: Actor IDs should be `source:id` format
2. **Reality**: Actor IDs are `source:source:id` format due to double prefixing

3. **Design**: Display names should be human-readable names
4. **Reality**: Display names are "github" due to incorrect string parsing

## Open Questions

1. Should the transformer prefix be removed (fix at source) or should actor-resolution not add a prefix (fix at resolution)?
2. What's the correct way to extract display name from the actual username in source actor data?
3. Should we backfill/migrate existing actor profiles with corrected data?
4. When will Tier 1 (OAuth) and Tier 3 (Heuristic) identity resolution be implemented?

## Related Research

- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Original E2E design document
