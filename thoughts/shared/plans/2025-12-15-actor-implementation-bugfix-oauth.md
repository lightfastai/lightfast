# Actor Implementation Bugfix Plan

## Overview

This plan addresses bugs in the actor identity system and implements simplified identity resolution leveraging Clerk's existing GitHub OAuth data. The key insight: **users sign up via Clerk with GitHub OAuth, so Clerk already has the `clerkUserId ↔ githubId` mapping**. No per-workspace OAuth dance or identity tables required.

### Core Architecture Insight

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     IDENTITY RESOLUTION (Simplified)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  GitHub is the ONLY sign-in method → Every user has GitHub ID in Clerk  │
│                                                                         │
│  GitHub Events:                                                         │
│    sender.id: 12345 → github_clerk_mappings lookup → clerkUserId        │
│                                                                         │
│  Vercel Events:                                                         │
│    commitSha → GitHub push event → sender.id → clerkUserId              │
│                                                                         │
│  Linear/Sentry Events (future):                                         │
│    commitSha → GitHub commit → GitHub ID → clerkUserId                  │
│                                                                         │
│  Everything traces back to commits. Commits have GitHub IDs.            │
│  GitHub IDs are already linked to Clerk via signup OAuth.               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The system currently has a double-prefix bug and incorrect display name extraction that need fixing before production deployment.

## Current State Analysis

### Bug 1: Double Prefix in Actor IDs

**Problem**: Actor IDs are being prefixed twice, creating malformed canonical IDs.

**Data Flow**:
1. GitHub transformer adds `github:` prefix → `actor.id = "github:12345"`
2. Actor resolution adds `source:` prefix → `actorId = "github:github:12345"`

**Evidence** (from codebase analysis):
- `packages/console-webhooks/src/transformers/github.ts:78` - Push: `id: \`github:${payload.pusher.name}\``
- `packages/console-webhooks/src/transformers/github.ts:204` - PR: `id: \`github:${pr.user.id}\``
- `packages/console-webhooks/src/transformers/github.ts:296` - Issue: `id: \`github:${issue.user.id}\``
- `packages/console-webhooks/src/transformers/github.ts:361` - Release: `id: \`github:${release.author.id}\``
- `packages/console-webhooks/src/transformers/github.ts:431` - Discussion: `id: \`github:${discussion.user.id}\``
- `packages/console-webhooks/src/transformers/vercel.ts:113` - Deployment: `id: \`github:${gitMeta.githubCommitAuthorName}\``
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:62` - `const actorId = \`${sourceEvent.source}:${sourceActor.id}\``

### Bug 2: Incorrect Display Name Extraction

**Problem**: Display name extracted from actorId suffix, which contains the prefixed value.

**Evidence**:
- `api/console/src/inngest/workflow/neural/profile-update.ts:67` - `const displayName = actorId.split(":")[1] ?? actorId;`
- With double prefix `github:github:12345`, this extracts `"github"` instead of `"12345"` or proper name

**Correct Approach**: Use `sourceActor.name` from the original event data.

### Bug 3: Inconsistent Actor ID Types

**Problem**: Push events use `payload.pusher.name` (username), while other events use numeric user ID.

**Impact**: Same user appears as two different actors based on event type.

**Fix**: Use `payload.sender.id` for push events (sender has full GitHub user object with numeric ID).

### Missing Feature: Direct Clerk Identity Resolution

**Current State**: Only Tier 2 (email matching) implemented with 0.85 confidence.

**Required**: Direct lookup via Clerk's `externalAccounts` - users who signed up with GitHub OAuth already have the mapping stored in Clerk. No iteration through org members needed.

## Desired End State

After implementation:

1. **Actor IDs use single prefix**: `github:12345` (not `github:github:12345`)
2. **Consistent ID format**: All GitHub events use numeric user ID (via `sender.id` or `user.id`)
3. **Correct display names**: Profile shows `"Alice Smith"` (from `sourceActor.name`)
4. **OAuth resolution working**: Users with GitHub OAuth get confidence 1.0 matches
5. **Vercel actors reconciled**: Vercel username-based actors linked to GitHub numeric IDs via commit SHA

### Verification Criteria

```sql
-- No double prefixes in actor IDs
SELECT COUNT(*) FROM lightfast_workspace_actor_profiles
WHERE actor_id LIKE '%:%:%';
-- Expected: 0

-- All GitHub actors use numeric format
SELECT COUNT(*) FROM lightfast_workspace_neural_observations
WHERE source = 'github'
  AND actor_id LIKE 'github:%'
  AND actor_id NOT REGEXP '^github:[0-9]+$';
-- Expected: 0

-- Vercel actors use numeric format (after reconciliation via commit SHA)
SELECT COUNT(*) FROM lightfast_workspace_neural_observations
WHERE source = 'vercel'
  AND actor_id LIKE 'github:%'
  AND actor_id NOT REGEXP '^github:[0-9]+$';
-- Expected: 0 (username-based actors get updated when GitHub push arrives)

-- Actor profiles have display names (not numeric IDs)
SELECT actor_id, display_name FROM lightfast_workspace_actor_profiles
WHERE display_name REGEXP '^[0-9]+$';
-- Expected: 0 (display names should be usernames like "alice", not "12345")
```

## What We're NOT Doing

1. **No Tier 2/3 fallback matching** - Not needed; GitHub-only auth means every user has GitHub ID
2. **No Google OAuth login** - Removing entirely; GitHub is the only sign-in method
3. **No late resolution background job for external contributors** - Deferred; can be added later if needed
4. **No migration of existing data** - Not in production; test data can be cleared
5. **No new identity resolution via `workspace_actor_identities`** - Clerk external accounts IS the identity mapping; the existing table is retained for username/email search (see Phase 0)
6. **No per-workspace OAuth flows** - Identity resolution uses Clerk's existing GitHub OAuth data from signup
7. **No `github_clerk_mappings` cache table** - Deferred; use GitHub-provided profile data for now, resolve lazily if needed

## Implementation Approach

The fix follows the "fix at source" principle: remove prefixes from transformers since `sourceEvent.source` already contains the source identifier. Actor resolution becomes the single point where canonical IDs are constructed.

---

## Phase 0: Schema Clarity - Rename Identity Table Column

### Overview

Rename `actorId` to `canonicalActorId` in `workspaceActorIdentities` table to clarify its purpose and prevent confusion with Clerk user IDs.

### Background

The `workspaceActorIdentities` table has an `actorId` column with ambiguous semantics:
- **Original design intent**: Store Clerk user IDs for identity resolution
- **Actual usage**: Stores canonical actor IDs (`source:sourceId` format) to link to profiles
- **Current code**: `actor-search.ts` joins `identities.actorId` to `profiles.actorId`

This naming collision causes confusion because:
- `workspaceActorProfiles.actorId` = canonical format (`github:12345678`)
- `workspaceActorIdentities.actorId` = also canonical format (despite design docs suggesting Clerk ID)

### Decision

Rename to `canonicalActorId` because:
1. **Matches actual usage**: The column stores canonical actor IDs, not Clerk user IDs
2. **Makes joins obvious**: `identities.canonicalActorId` = `profiles.actorId`
3. **Future-proof**: Can add `resolvedClerkUserId` as separate column later if needed
4. **Minimal change**: Just a rename, existing logic continues to work

### Changes Required

#### 1. Schema Definition
**File**: `db/console/src/schema/tables/workspace-actor-identities.ts`

```typescript
// BEFORE:
// Actor reference (links to profile)
actorId: varchar("actor_id", { length: 191 }).notNull(),

// AFTER:
// Canonical actor ID (links to profiles.actorId, format: "source:sourceId")
canonicalActorId: varchar("canonical_actor_id", { length: 191 }).notNull(),
```

#### 2. Index Rename
**File**: `db/console/src/schema/tables/workspace-actor-identities.ts`

```typescript
// BEFORE:
actorIdx: index("actor_identity_actor_idx").on(
  table.workspaceId,
  table.actorId,
),

// AFTER:
canonicalActorIdx: index("actor_identity_canonical_actor_idx").on(
  table.workspaceId,
  table.canonicalActorId,
),
```

#### 3. Code Reference Updates
**File**: `apps/console/src/lib/neural/actor-search.ts`

```typescript
// BEFORE (line 57):
actorId: workspaceActorIdentities.actorId,

// AFTER:
canonicalActorId: workspaceActorIdentities.canonicalActorId,

// BEFORE (line 73):
const actorIds = identities.map((i) => i.actorId);

// AFTER:
const actorIds = identities.map((i) => i.canonicalActorId);
```

#### 4. Generate Migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [ ] Migration generates successfully: `pnpm db:generate`
- [ ] Migration applies cleanly: `pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Actor search by @mention still works
- [ ] No broken foreign key references

**Implementation Note**: This is a rename-only change with no behavior modification. Complete this phase first to establish clear schema semantics before proceeding.

---

## Phase 1: Fix Double Prefix Bug and Normalize IDs (No Schema Changes)

### Overview
Remove `github:` prefix from all transformers. Use numeric GitHub user IDs consistently for GitHub events. Actor resolution constructs the canonical ID format.

### Changes Required:

#### 1. GitHub Transformer - Push Events (Use sender.id for consistency)
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Lines**: 76-82

```typescript
// BEFORE:
actor: payload.pusher?.name
  ? {
      id: `github:${payload.pusher.name}`,
      name: payload.pusher.name,
      email: payload.pusher.email || undefined,
    }
  : undefined,

// AFTER:
// Use sender (has numeric ID) instead of pusher (only has username)
// This ensures consistency with PR/Issue/Release/Discussion events
actor: payload.sender
  ? {
      id: String(payload.sender.id),
      name: payload.sender.login,
      email: payload.pusher?.email || undefined,  // Get email from pusher
      avatarUrl: payload.sender.avatar_url,
    }
  : undefined,
```

**Note**: `payload.pusher` only has `name` and `email`. `payload.sender` has the full GitHub user object including numeric `id`. Using sender ensures all GitHub events use the same ID format.

#### 2. GitHub Transformer - Pull Request Events
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Lines**: 202-208

```typescript
// BEFORE:
actor: pr.user
  ? {
      id: `github:${pr.user.id}`,
      name: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    }
  : undefined,

// AFTER:
actor: pr.user
  ? {
      id: String(pr.user.id),
      name: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    }
  : undefined,
```

#### 3. GitHub Transformer - Issue Events
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Lines**: 294-300

```typescript
// BEFORE:
actor: issue.user
  ? {
      id: `github:${issue.user.id}`,
      name: issue.user.login,
      avatarUrl: issue.user.avatar_url,
    }
  : undefined,

// AFTER:
actor: issue.user
  ? {
      id: String(issue.user.id),
      name: issue.user.login,
      avatarUrl: issue.user.avatar_url,
    }
  : undefined,
```

#### 4. GitHub Transformer - Release Events
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Lines**: 359-365

```typescript
// BEFORE:
actor: release.author
  ? {
      id: `github:${release.author.id}`,
      name: release.author.login,
      avatarUrl: release.author.avatar_url,
    }
  : undefined,

// AFTER:
actor: release.author
  ? {
      id: String(release.author.id),
      name: release.author.login,
      avatarUrl: release.author.avatar_url,
    }
  : undefined,
```

#### 5. GitHub Transformer - Discussion Events
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Lines**: 429-435

```typescript
// BEFORE:
actor: discussion.user
  ? {
      id: `github:${discussion.user.id}`,
      name: discussion.user.login,
      avatarUrl: discussion.user.avatar_url,
    }
  : undefined,

// AFTER:
actor: discussion.user
  ? {
      id: String(discussion.user.id),
      name: discussion.user.login,
      avatarUrl: discussion.user.avatar_url,
    }
  : undefined,
```

#### 6. Vercel Transformer - Deployment Events
**File**: `packages/console-webhooks/src/transformers/vercel.ts`
**Lines**: 111-116

```typescript
// BEFORE:
actor: gitMeta?.githubCommitAuthorName
  ? {
      id: `github:${gitMeta.githubCommitAuthorName}`,
      name: gitMeta.githubCommitAuthorName,
    }
  : undefined,

// AFTER:
// Note: Vercel only provides username, not numeric GitHub ID
// This creates username-based actor IDs (see Known Limitations)
actor: gitMeta?.githubCommitAuthorName
  ? {
      id: gitMeta.githubCommitAuthorName,
      name: gitMeta.githubCommitAuthorName,
    }
  : undefined,
```

#### 7. GitHub Transformer - Add Merge Commit SHA to PR References
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Location**: In `transformGitHubPullRequest`, after the head SHA reference (around line 136)

**Why**: When a PR is merged, Vercel deploys the **merge commit** (not the head commit). Without `merge_commit_sha` in references, we can't link Vercel deployments back to their source PR.

```typescript
// EXISTING (keep this):
if (pr.head.sha) {
  refs.push({
    type: "commit",
    id: pr.head.sha,
    url: `${payload.repository.html_url}/commit/${pr.head.sha}`,
  });
}

// ADD: Merge commit SHA for cross-source linkage (Vercel deploy → PR)
if (pr.merge_commit_sha) {
  refs.push({
    type: "commit",
    id: pr.merge_commit_sha,
    url: `${payload.repository.html_url}/commit/${pr.merge_commit_sha}`,
    label: "merge",  // Distinguish from head commit
  });
}
```

**Data flow**:
```
PR #42 merged → merge_commit_sha: "fff789" stored in references
Vercel deploys "fff789" → lookup observations with commit "fff789" in references
Result: Found PR #42 → "This deploy shipped PR #42"
```

### Success Criteria:

#### Automated Verification:
- [ ] Package builds successfully: `pnpm --filter @repo/console-webhooks build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Send test GitHub push webhook, verify actor.id is numeric (from sender.id)
- [ ] Send test GitHub PR webhook, verify actor.id is numeric
- [ ] Verify stored observation has single-prefix actorId (`github:12345`)
- [ ] Merge a test PR, verify `merge_commit_sha` appears in sourceReferences with label "merge"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Fix Display Name Extraction

### Overview
Pass sourceActor data through to profile update workflow and use `sourceActor.name` for display name.

### Changes Required:

#### 1. Update Event Schema
**File**: `api/console/src/inngest/client/client.ts`
**Location**: Event schema for `apps-console/neural/profile.update`

Find the event definition and add `sourceActor` to the data schema:

```typescript
"apps-console/neural/profile.update": {
  data: z.object({
    workspaceId: z.string(),
    actorId: z.string(),
    observationId: z.string(),
    sourceActor: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional(),
      avatarUrl: z.string().optional(),
    }).optional(),
  }),
},
```

#### 2. Pass sourceActor in Event Emission
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Lines**: 628-640

```typescript
// BEFORE:
...(resolvedActor.actorId
  ? [
      {
        name: "apps-console/neural/profile.update" as const,
        data: {
          workspaceId,
          actorId: resolvedActor.actorId,
          observationId: observation.id,
        },
      },
    ]
  : []),

// AFTER:
...(resolvedActor.actorId
  ? [
      {
        name: "apps-console/neural/profile.update" as const,
        data: {
          workspaceId,
          actorId: resolvedActor.actorId,
          observationId: observation.id,
          sourceActor: resolvedActor.sourceActor ?? undefined,
        },
      },
    ]
  : []),
```

#### 3. Use sourceActor in Profile Update
**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`
**Lines**: 44-89

```typescript
// BEFORE:
async ({ event, step }) => {
  const { workspaceId, actorId } = event.data;
  // ...
  // Step 2: Upsert profile
  await step.run("upsert-profile", async () => {
    // Extract display name from actorId (source:id -> id)
    const displayName = actorId.split(":")[1] ?? actorId;
    // ...
  });
}

// AFTER:
async ({ event, step }) => {
  const { workspaceId, actorId, sourceActor } = event.data;
  // ...
  // Step 2: Upsert profile
  await step.run("upsert-profile", async () => {
    // Use source actor name if available, fallback to actorId suffix
    const displayName = sourceActor?.name ?? actorId.split(":")[1] ?? actorId;

    await db
      .insert(workspaceActorProfiles)
      .values({
        workspaceId,
        actorId,
        displayName,
        email: sourceActor?.email ?? null,
        avatarUrl: sourceActor?.avatarUrl ?? null,
        observationCount: recentActivity.count,
        lastActiveAt: recentActivity.lastActiveAt,
        profileConfidence: 0.5,
      })
      .onConflictDoUpdate({
        target: [
          workspaceActorProfiles.workspaceId,
          workspaceActorProfiles.actorId,
        ],
        set: {
          // Update name/email/avatar only if provided and currently null
          displayName: sql`COALESCE(${workspaceActorProfiles.displayName}, ${displayName})`,
          email: sql`COALESCE(${workspaceActorProfiles.email}, ${sourceActor?.email ?? null})`,
          avatarUrl: sql`COALESCE(${workspaceActorProfiles.avatarUrl}, ${sourceActor?.avatarUrl ?? null})`,
          observationCount: recentActivity.count,
          lastActiveAt: recentActivity.lastActiveAt,
          updatedAt: new Date().toISOString(),
        },
      });
    // ...
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] API builds successfully: `pnpm --filter @api/console build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Trigger profile update via webhook
- [ ] Verify profile has correct displayName (not numeric ID)
- [ ] Verify email and avatarUrl populated when available

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Simplified Actor Storage (No Resolution at Write Time)

### Overview

Since GitHub is the only sign-in method, we don't need to resolve actors to Clerk users at webhook ingestion time. We simply store the GitHub ID and use GitHub-provided profile data for display.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Webhook Ingestion (simplified):                                        │
│                                                                         │
│  1. GitHub webhook arrives with sender.id: 12345, sender.login: "alice" │
│  2. Store observation with actorId: "github:12345"                      │
│  3. Store profile with displayName: "alice", avatarUrl from GitHub      │
│  4. Done! No Clerk lookup needed at write time.                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Changes Required

#### 1. Simplify Actor Resolution (Remove Clerk Lookup)

**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`

The actor resolution no longer tries to resolve to Clerk user. It just constructs the canonical actor ID:

```typescript
/**
 * Actor Resolution for Neural Observations
 *
 * For MVP, we don't resolve actors to Clerk users at webhook time.
 * We simply store the GitHub ID and use GitHub-provided profile data.
 *
 * Resolution to Clerk users can happen lazily when needed.
 *
 * Future: Add github_clerk_mappings cache table for O(1) reverse lookups.
 */
export async function resolveActor(
  workspaceId: string,
  sourceEvent: SourceEvent,
): Promise<ResolvedActor> {
  const sourceActor = sourceEvent.actor;

  if (!sourceActor) {
    return { actorId: null, sourceActor: null };
  }

  // Construct canonical actor ID: source:id
  const actorId = `${sourceEvent.source}:${sourceActor.id}`;

  return {
    actorId,
    sourceActor,
    // No resolvedUserId - we don't resolve at write time
  };
}
```

#### 2. Profile Uses GitHub-Provided Data

**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`

Profile already stores GitHub-provided data (from Phase 2). No Clerk lookup needed:

```typescript
// Profile is populated from sourceActor (GitHub-provided data)
await db.insert(workspaceActorProfiles).values({
  workspaceId,
  actorId,                              // "github:12345"
  displayName: sourceActor.name,        // "alice" (from GitHub)
  avatarUrl: sourceActor.avatarUrl,     // GitHub avatar URL
  // No resolvedClerkUserId - deferred
});
```

### Success Criteria

#### Automated Verification:
- [ ] API builds successfully: `pnpm --filter @api/console build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Send GitHub webhook, verify observation stored with `actorId: "github:12345"`
- [ ] Verify actor profile has displayName from GitHub (not numeric ID)
- [ ] Verify no Clerk API calls during webhook processing

---

## Phase 4: Cross-Source Actor Reconciliation

### Overview

Resolve Vercel username-based actor IDs to GitHub numeric IDs via commit SHA linkage. This uses bi-directional reconciliation to handle race conditions where webhooks may arrive in either order.

### Problem: Webhook Arrival Order Race Condition

```
Timeline A (expected):          Timeline B (race condition):
─────────────────────           ──────────────────────────────
1. git push                     1. git push
2. GitHub webhook ✓             2. Vercel build starts
3. Vercel build starts          3. Vercel build completes (fast/cached)
4. Vercel build completes       4. Vercel webhook arrives ← no GitHub event yet
5. Vercel webhook arrives       5. GitHub webhook arrives (delayed/queued)
```

### Solution: Bi-Directional Reconciliation

When **either** event arrives, check for the other:

1. **Vercel webhook arrives first**: Store with username-based actor, reconcile when GitHub arrives
2. **GitHub webhook arrives first**: Vercel can look up numeric ID immediately
3. **GitHub webhook triggers actor update**: Update Vercel observation's actorId to use numeric ID

### Data Flow

```
Vercel Deployment                    GitHub Push (same commit)
─────────────────                    ────────────────────────
meta.githubCommitSha: "abc123"   ═══ after: "abc123"
meta.githubCommitAuthorName: "alice"  sender.id: 12345678
                                      sender.login: "alice"

Resolution via commit SHA:
  1. Vercel arrives first → actorId = "github:alice" (temporary)
  2. GitHub arrives → look up "alice" in github_clerk_mappings
  3. Update Vercel observation → actorId = "github:12345678"
  4. Both now resolve to same Clerk user via github_clerk_mappings
```

### Changes Required:

#### 1. Add Vercel Actor Lookup via Commit SHA

**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`

```typescript
/**
 * Attempt to resolve Vercel actor to numeric GitHub ID via commit SHA.
 *
 * When a Vercel deployment arrives, we have username but not numeric ID.
 * If a GitHub push event with the same commit SHA already exists, we can
 * extract the numeric ID from that event.
 *
 * @returns Numeric GitHub user ID if found, null otherwise
 */
async function resolveVercelActorViaCommitSha(
  workspaceId: string,
  commitSha: string,
  username: string,
): Promise<{ numericId: string; githubActorId: string } | null> {
  if (!commitSha) return null;

  // Find GitHub push event with same commit SHA
  const githubEvent = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.source, "github"),
      sql`JSON_EXTRACT(${workspaceNeuralObservations.sourceReferences}, '$[*].id') LIKE ${`%${commitSha}%`}`,
    ),
    columns: {
      actorId: true,
    },
  });

  if (!githubEvent?.actorId) return null;

  // Extract numeric ID from GitHub actor (format: "github:12345678")
  const numericId = githubEvent.actorId.split(":")[1];
  if (!numericId || !/^\d+$/.test(numericId)) return null;

  log.info("Resolved Vercel actor via commit SHA", {
    commitSha,
    username,
    numericId,
    githubActorId: githubEvent.actorId,
  });

  return { numericId, githubActorId: githubEvent.actorId };
}
```

#### 2. Update Vercel Actor Resolution

**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`

In the `resolveActor` function, add commit SHA lookup for Vercel source:

```typescript
// In resolveActor, for Vercel source:
if (sourceEvent.source === "vercel" && sourceActor) {
  // Extract commit SHA from source references
  const commitRef = sourceEvent.sourceReferences?.find(
    ref => ref.type === "commit"
  );

  if (commitRef?.id) {
    const resolved = await resolveVercelActorViaCommitSha(
      workspaceId,
      commitRef.id,
      sourceActor.id, // username
    );

    if (resolved) {
      // Use numeric ID instead of username - this makes the actorId
      // match the format used by GitHub events, allowing unified queries
      sourceActor = {
        ...sourceActor,
        id: resolved.numericId,
      };

      log.info("Vercel actor upgraded to numeric ID", {
        originalUsername: sourceActor.name,
        numericId: resolved.numericId,
      });
    }
  }
}
```

#### 3. Add GitHub Reconciliation for Orphaned Vercel Actors

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

When GitHub push arrives, update any Vercel observations that used username-based actor:

```typescript
/**
 * Update orphaned Vercel actors when GitHub push arrives.
 *
 * When a GitHub push webhook arrives AFTER a Vercel deployment with the same
 * commit, we update the Vercel observation's actorId to use the numeric format.
 */
async function reconcileVercelActorsForCommit(
  workspaceId: string,
  commitSha: string,
  githubActorId: string, // "github:12345678"
  githubUsername: string,
): Promise<void> {
  // Find Vercel observations with same commit but username-based actor
  const orphanedVercel = await db.query.workspaceNeuralObservations.findMany({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.source, "vercel"),
      sql`JSON_EXTRACT(${workspaceNeuralObservations.sourceReferences}, '$[*].id') LIKE ${`%${commitSha}%`}`,
      // Username-based actor (not numeric) - matches the username
      eq(workspaceNeuralObservations.actorId, `github:${githubUsername}`),
    ),
    columns: {
      id: true,
      actorId: true,
    },
  });

  if (orphanedVercel.length === 0) return;

  log.info("Reconciling orphaned Vercel actors", {
    commitSha,
    githubActorId,
    orphanedCount: orphanedVercel.length,
  });

  // Update actorId to use numeric format
  await db
    .update(workspaceNeuralObservations)
    .set({ actorId: githubActorId })
    .where(
      inArray(
        workspaceNeuralObservations.id,
        orphanedVercel.map((o) => o.id)
      )
    );
}
```

#### 4. Call Reconciliation in GitHub Push Handler

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

```typescript
// After observation is captured and actor is resolved for GitHub push:
if (sourceEvent.source === "github" && sourceEvent.action === "push") {
  const commitRef = sourceEvent.sourceReferences?.find(
    ref => ref.type === "commit"
  );

  if (commitRef?.id && resolvedActor.actorId && sourceEvent.actor?.name) {
    await reconcileVercelActorsForCommit(
      workspaceId,
      commitRef.id,
      resolvedActor.actorId,
      sourceEvent.actor.name, // GitHub username
    );
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] API builds successfully: `pnpm --filter @api/console build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] **Scenario A (GitHub first)**: Push webhook, then Vercel deployment - Vercel actor uses numeric ID
- [ ] **Scenario B (Vercel first)**: Vercel deployment, then push webhook - Vercel observation updated to numeric ID
- [ ] Verify unified queries work: `SELECT * FROM observations WHERE actorId = 'github:12345'` returns both GitHub and Vercel events

**Implementation Note**: This phase depends on Phases 1-3 being complete. The commit SHA must be stored in `sourceReferences` for the lookup to work.

---

## Testing Strategy

### Unit Tests

- Test transformer output has no prefix in actor.id
- Test push event uses sender.id (numeric) not pusher.name (username)
- Test actor resolution returns correct actorId format
- Test display name extraction from sourceActor

### Integration Tests

1. **GitHub Push webhook** → Actor profile created with numeric ID and correct displayName
2. **GitHub PR webhook** → Actor profile created with numeric ID
3. **External contributor PR** → Actor profile created (displayName from GitHub)
4. **Vercel deployment (GitHub first)** → Actor uses numeric ID via commit SHA lookup
5. **Vercel deployment (Vercel first)** → Actor uses username, observation updated when GitHub arrives

### Manual Testing Steps

1. Create test webhook payload with known GitHub user
2. Verify actor ID format in database: `github:12345` (not `github:github:12345`)
3. Verify display name shows username (e.g., "alice"), not numeric ID
4. Verify no Clerk API calls during webhook processing (check logs)

---

## Edge Cases

### Day 1: Must Handle

#### 1. Push Event Using Username Instead of Numeric ID
**Status**: 🔴 Bug - Fixed in Phase 1

The current code uses `payload.pusher.name` (username string) instead of `payload.sender.id` (numeric ID):
```typescript
// BUGGY (current):
id: `github:${payload.pusher.name}`  // "github:alice"

// FIXED (Phase 1):
id: String(payload.sender.id)         // "12345" → actorId: "github:12345"
```

**Impact**: Same user appears as different actors between push events (username) and PR/Issue events (numeric ID).

**Fix**: Use `payload.sender.id` for all GitHub events (covered in Phase 1).

---

### Future: Document But Defer

#### 2. Squash Merges - Attribution Loss
**Severity**: 🟡 Limitation

When someone squashes and merges a PR, original commit authors are lost:
```
Original PR commits:
  - alice: feat: add auth
  - bob: fix: typo
  - alice: chore: cleanup

Squash merge by charlie:
  - charlie: feat: add auth (#42)  ← only charlie credited
```

**Current behavior**: PR itself tracks original author (`pr.user`). Squash commit tracks merger.

**Future enhancement**: Parse PR description for original contributor mentions, or track "original author" vs "merger" separately.

#### 3. Co-Authored Commits
**Severity**: 🟡 Limitation

Git trailers for co-authors are not structured in webhook:
```
feat: implement auth

Co-authored-by: Alice <alice@example.com>
Co-authored-by: Bob <bob@example.com>
```

**Current behavior**: Only `sender.id` captured. Co-authors exist only as body text.

**Future enhancement**: Parse `Co-authored-by:` trailers, resolve email → GitHub user.

#### 4. Webhook Retry Deduplication
**Severity**: 🟡 Verify

GitHub retries failed webhook deliveries. Same event may arrive multiple times.

**Current behavior**: `sourceId` includes unique identifiers:
```typescript
sourceId: `pr:${repo}#${prNumber}:${action}`
```

**Assumption**: Upsert on `sourceId` handles duplicates. Need to verify this is implemented.

**Future**: Add explicit dedup logging/metrics to confirm.

#### 5. Username Changes - Stale Display Names
**Severity**: 🟡 Minor

User changes GitHub username (but numeric ID stays same):
```
Before: alice (id: 12345)
After:  alice-dev (id: 12345)
```

**Current behavior**: `actorId: "github:12345"` is correct. But `sourceActor.name` stored in profile shows old username until profile is updated.

**Future enhancement**: Refresh display name from GitHub API at read time, or on profile view.

#### 6. User Disconnects GitHub from Clerk
**Severity**: 🟡 Rare Edge Case

User signs up with GitHub OAuth, later disconnects GitHub from Clerk account settings.

**Impact**:
- Historical observations still have `github:12345`
- User-specific queries would fail - no GitHub ID in Clerk profile
- Work becomes "orphaned"

**Future enhancement**: Track last-known GitHub ID in user metadata, or prompt user to reconnect.

---

### Don't Care: Works As-Is or Acceptable

#### 7. Bot Accounts (dependabot, renovate, etc.)
**Status**: ✅ Works

Bots have numeric IDs like regular users:
```json
{
  "sender": {
    "login": "dependabot[bot]",
    "id": 49699333,
    "type": "Bot"
  }
}
```

**Behavior**: Stored as `github:49699333`. Won't resolve to Clerk user - which is correct.

**Optional future**: Add `type: "bot"` to metadata if filtering is desired.

#### 8. External Contributors (Not in Org)
**Status**: ✅ Works

Someone outside the organization submits a PR.

**Behavior**: Stored as `github:999999` with GitHub-provided profile data. Semantic search finds their work.

**No action needed**: This is expected behavior.

#### 9. Force Push - History Rewrite
**Status**: ✅ Acceptable

Force push rewrites commit history:
```
Before: branch has commit abc123
After:  branch has commit def456 (abc123 deleted)
```

**Behavior**: Old observations reference stale commit SHA. Cross-source linkage for old commit won't find new commits.

**Philosophy**: Observations are historical snapshots of "what happened at the time." Don't try to reconcile history rewrites.

#### 10. Vercel Deploy Without Commit SHA
**Status**: ✅ Acceptable

Manual Vercel deployments (not git-triggered) have no commit SHA.

**Behavior**: Can't do cross-source linkage. Actor stored as `actorId: null` or whatever Vercel provides.

**No action needed**: These become anonymous observations.

#### 11. Mentions in PR Body (`@username`)
**Status**: ✅ Acceptable

User mentions in body are just text, not structured:
```markdown
cc @alice for review
```

**Behavior**: `@alice` is searchable via semantic search ("find PRs mentioning alice"). Not resolved to actor.

**Future enhancement**: Extract mentions, resolve via GitHub API. Deferred - low value.

---

## Known Limitations

### 1. Vercel Events Without Matching GitHub Push

**Issue**: Some Vercel deployments may not have a corresponding GitHub push event in our system.

**Scenarios**:
- Manual deployments from Vercel dashboard
- Deployments from forked repositories where we don't have webhook access
- Redeployments of existing commits
- Webhook delivery failures

**Impact**: These Vercel actors will retain username-based IDs (`github:alice`) without reconciliation to numeric IDs.

**Mitigation**: The system gracefully handles unresolved actors. They appear as separate actors but don't break functionality.

### 2. External Contributors (Not Lightfast Users)

**Issue**: Contributors who haven't signed up for Lightfast won't have a `github_clerk_mappings` entry.

**Impact**: Their activity is tracked but not linked to a Clerk user until they sign up.

**Behavior**: Actor profiles are created with their GitHub ID. When they sign up via GitHub OAuth, the `github_clerk_mappings` entry is created and their activity becomes resolvable.

### 3. Temporary Split Profiles During Race Condition

**Issue**: If Vercel webhook arrives before GitHub push, a temporary username-based profile may be created before reconciliation occurs.

**Impact**: Brief window where activity appears under username-based actor until GitHub webhook triggers reconciliation and updates the observation.

**Behavior**: Once GitHub push arrives, the Vercel observation's actorId is updated to the numeric format. All queries then return unified results.

**Note**: This is acceptable eventual consistency. The reconciliation happens automatically when the GitHub push webhook arrives (typically within seconds to minutes).

---

## Future Considerations

### GitHub-Clerk Mappings Cache Table

For O(1) reverse lookups (GitHub ID → Clerk User), add a cache table:

```typescript
// db/console/src/schema/tables/github-clerk-mappings.ts
export const githubClerkMappings = mysqlTable("lightfast_github_clerk_mappings", {
  githubId: varchar("github_id", { length: 50 }).primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
  githubUsername: varchar("github_username", { length: 255 }),
});
```

Populated via Clerk webhook on `user.created`. Enables:
- "Is this actor an org member?" - O(1) instead of N Clerk API calls
- Reverse lookup for "who worked on this?" queries
- Late resolution when external contributors sign up

**Decision**: Deferred. GitHub-provided profile data is sufficient for MVP.

### Late Resolution for External Contributors

When external contributors later sign up for Lightfast with GitHub OAuth:

1. Clerk webhook fires `user.created`
2. We populate `github_clerk_mappings` with their GitHub ID
3. Background job could query existing observations with that GitHub ID
4. Update actor profiles to mark them as "resolved"

```typescript
// On user.created webhook:
async function onUserCreated(user: UserJSON) {
  await syncGithubMapping(user);

  // Optional: trigger late resolution
  const githubAccount = user.external_accounts?.find(a => a.provider === "oauth_github");
  if (githubAccount) {
    await inngest.send({
      name: "apps-console/actor/late-resolution",
      data: {
        clerkUserId: user.id,
        githubId: githubAccount.provider_user_id,
      },
    });
  }
}
```

**Decision**: Deferred. Implement if/when external contributor resolution becomes a priority.

### Linear/Sentry Resolution via Commit SHA

The same commit-based resolution pattern works for Linear and Sentry:

```
Linear Issue → linked PR → commits → GitHub user ID → Clerk
Sentry Error → suspect commit → GitHub user ID → Clerk
```

**Implementation**: Add similar `resolveLinearActorViaCommit()` and `resolveSentryActorViaCommit()` functions when those sources are integrated.

**Decision**: Deferred until Linear/Sentry webhooks are implemented.

### Denormalized `resolvedClerkUserId` on Actor Profiles

For query performance, consider adding resolved Clerk user ID directly on profiles:

```typescript
// workspace_actor_profiles table
resolvedClerkUserId: varchar("resolved_clerk_user_id", { length: 191 }),
```

Currently, resolution requires:
1. Extract GitHub ID from actorId (`github:12345` → `12345`)
2. Query `github_clerk_mappings` for Clerk user

With denormalization, it's a direct column access.

**Trade-offs**:
- **Pro**: Faster queries, no JOIN needed
- **Con**: Two sources of truth to keep in sync
- **Con**: Requires updating profiles when mappings change

**Decision**: Defer. Current approach is simple and performant enough. Consider if query latency becomes an issue.

---

## References

- Original research: `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md`
- Database design: `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md`
- Cross-source linkage: `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md`
- E2E architecture: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
- [Clerk User object reference](https://clerk.com/docs/reference/javascript/user)
- [GitHub webhook push event](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push)

## Files Modified Summary

| Phase | File | Changes |
|-------|------|---------|
| 0 | `db/console/src/schema/tables/workspace-actor-identities.ts` | Rename `actorId` → `canonicalActorId`, rename index |
| 0 | `apps/console/src/lib/neural/actor-search.ts` | Update column references (2 locations) |
| 1 | `packages/console-webhooks/src/transformers/github.ts` | Remove prefix, use `sender.id` for push events (5 locations), add `merge_commit_sha` to PR references |
| 1 | `packages/console-webhooks/src/transformers/vercel.ts` | Remove `github:` prefix (1 location) |
| 2 | `api/console/src/inngest/client/client.ts` | Add sourceActor to event schema |
| 2 | `api/console/src/inngest/workflow/neural/observation-capture.ts` | Pass sourceActor in event |
| 2 | `api/console/src/inngest/workflow/neural/profile-update.ts` | Use sourceActor.name for displayName |
| 3 | `api/console/src/inngest/workflow/neural/actor-resolution.ts` | Simplify to just construct actorId (no Clerk resolution) |
| 4 | `api/console/src/inngest/workflow/neural/actor-resolution.ts` | Add `resolveVercelActorViaCommitSha`, update Vercel actor resolution |
| 4 | `api/console/src/inngest/workflow/neural/observation-capture.ts` | Add `reconcileVercelActorsForCommit`, call on GitHub push |
