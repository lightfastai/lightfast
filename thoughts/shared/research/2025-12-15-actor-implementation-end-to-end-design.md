---
date: 2025-12-15T05:01:47Z
researcher: claude
git_commit: 016fff9bb3145ac1d05270e822174798afd22909
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Actor Implementation End-to-End Design"
tags: [research, design, neural-memory, actor-profiles, identity-resolution, clerk]
status: complete
last_updated: 2025-12-15
last_updated_by: claude
---

# Research: Actor Implementation End-to-End Design

**Date**: 2025-12-15T05:01:47Z
**Researcher**: claude
**Git Commit**: 016fff9bb3145ac1d05270e822174798afd22909
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Comprehensive analysis and design for fixing actor implementation bugs and establishing a long-term identity resolution system. Specifically:
1. Evaluate open questions from previous research and determine best solutions
2. Design simplified actor ID architecture (eliminate double prefix bug)
3. Implement identity resolution with GitHub as root (Tier 1 OAuth via Clerk)
4. Handle multi-organization users correctly
5. Pre-map external contributors for eventual account linking

## Summary

This document provides a complete end-to-end design for the actor system with the following key decisions:

1. **Fix double prefix bug at transformer level** - Remove `github:` prefix from transformers, let actor resolution add single prefix
2. **Use source actor data for display name** - Extract from `sourceActor.name` instead of parsing actorId
3. **Implement OAuth-based resolution via Clerk** - Query `user.externalAccounts` for GitHub connections
4. **Pre-map external contributors** - Create provisional actor profiles that resolve when users create accounts
5. **Workspace-scoped profiles** - Same person gets separate profiles per workspace (existing architecture is correct)

## Design Decisions

### Decision 1: Fix Double Prefix at Transformer Level

**Problem**: Actor IDs are prefixed twice:
1. Transformer adds `github:` → `github:username`
2. Actor resolution adds `source:` → `github:github:username`

**Solution**: Remove prefix from transformers, let actor resolution be the single source of prefixing.

**Why transformer level (not resolution level)**:
- Transformers are the first touch point - fix at source
- SourceEvent already has `source: "github"` field - no need to duplicate in actor.id
- Actor IDs should be source-specific identifiers, not canonical IDs
- Resolution layer is responsible for creating canonical workspace actor IDs

**Implementation**:

```typescript
// packages/console-webhooks/src/transformers/github.ts

// BEFORE (push event, line 78):
id: `github:${payload.pusher.name}`,

// AFTER:
id: payload.pusher.name,  // Just the username

// BEFORE (PR event, line 204):
id: `github:${pr.user.id}`,

// AFTER:
id: String(pr.user.id),  // Just the numeric ID as string
```

**Canonical ID Format** (created by actor resolution):
- Pattern: `{source}:{sourceId}`
- Examples: `github:jeevanpillay`, `github:12345678`

---

### Decision 2: Use Source Actor Data for Display Name

**Problem**: Display name extracted incorrectly from actorId:
```typescript
const displayName = actorId.split(":")[1] ?? actorId;
// Input: "github:github:12345" → Output: "github" (wrong!)
```

**Solution**: Pass source actor data to profile update, extract display name from `sourceActor.name`.

**Implementation**:

```typescript
// api/console/src/inngest/workflow/neural/profile-update.ts

// BEFORE (line 67):
const displayName = actorId.split(":")[1] ?? actorId;

// AFTER - receive sourceActor in event data:
const { actorId, sourceActor } = event.data;
const displayName = sourceActor?.name ?? actorId.split(":")[1] ?? actorId;
```

**Event Data Enhancement**:

```typescript
// api/console/src/inngest/workflow/neural/observation-capture.ts (line 631)
{
  name: "apps-console/neural/profile.update",
  data: {
    workspaceId,
    actorId: resolvedActor.actorId,
    observationId: observation.id,
    sourceActor: resolvedActor.sourceActor,  // ADD: Pass source actor data
  },
}
```

---

### Decision 3: Implement Tier 1 OAuth Resolution via Clerk External Accounts

**Problem**: Tier 1 (OAuth connection match) not implemented. Current system only does Tier 2 (email matching).

**Solution**: Query Clerk's `user.externalAccounts` array to find GitHub connections with matching provider user ID.

**Why Clerk External Accounts**:
- Clerk already stores OAuth connections when users sign in with GitHub
- `externalAccounts` array contains `externalId` (GitHub user ID) for each connection
- No need for separate `user-sources` query for identity resolution
- Provides 1.0 confidence (direct OAuth match)

**Implementation**:

```typescript
// api/console/src/inngest/workflow/neural/actor-resolution.ts

async function resolveByOAuth(
  workspaceId: string,
  clerkOrgId: string,
  source: string,
  actor: SourceActor,
): Promise<{ userId: string } | null> {
  const clerk = await clerkClient();

  // Get organization members
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrgId,
    limit: 100,
  });

  for (const membership of memberships.data) {
    const userId = membership.publicUserData?.userId;
    if (!userId) continue;

    const user = await clerk.users.getUser(userId);

    // Check external accounts for matching GitHub ID
    const githubAccount = user.externalAccounts?.find(
      (acc) => acc.provider === "oauth_github"
    );

    if (githubAccount?.externalId === actor.id) {
      // Cache identity mapping with 1.0 confidence
      await db.insert(workspaceActorIdentities).values({
        workspaceId,
        actorId: userId,  // Clerk user ID
        source,
        sourceId: actor.id,
        sourceUsername: actor.name,
        sourceEmail: actor.email || null,
        mappingMethod: "oauth",
        confidenceScore: 1.0,
      }).onConflictDoNothing();

      return { userId };
    }
  }

  return null;
}
```

**Resolution Order**:
1. Cache lookup (existing)
2. **NEW: OAuth match** (confidence 1.0)
3. Email match (confidence 0.85)
4. Unresolved fallback

---

### Decision 4: Pre-Map External Contributors

**Problem**: External contributors (issue reporters, external PR authors) have no Lightfast account but appear in webhooks.

**Solution**: Create provisional actor profiles that automatically resolve when users create accounts.

**Design**:

```
External Contributor Webhook Flow:
1. GitHub PR from external user "alice" (not in org)
2. Actor resolution: no OAuth match, no email match
3. Create actor profile with:
   - actorId: "github:alice123"  (canonical source ID)
   - displayName: "alice"
   - profileConfidence: 0.0  (unresolved)
   - resolvedUserId: null
4. Store in workspace_actor_profiles

Later - User Creates Lightfast Account:
1. "alice" signs up with GitHub OAuth
2. Background job or on-demand resolution:
   - Query profiles with resolvedUserId: null
   - Check if any sourceId matches user's externalAccounts
   - Update profile with resolved Clerk user ID
   - Update profileConfidence to 1.0
```

**Schema Enhancement** (`workspace-actor-profiles.ts`):

```typescript
// ADD: Track resolved Clerk user ID (null for unresolved external contributors)
resolvedUserId: varchar("resolved_user_id", { length: 191 }),
```

**Implementation - Profile Update**:

```typescript
// api/console/src/inngest/workflow/neural/profile-update.ts

await db
  .insert(workspaceActorProfiles)
  .values({
    workspaceId,
    actorId,
    displayName: sourceActor?.name ?? extractDisplayName(actorId),
    email: sourceActor?.email || null,
    avatarUrl: sourceActor?.avatarUrl || null,
    resolvedUserId: resolvedActor.resolvedUserId,  // null for external contributors
    observationCount: recentActivity.count,
    lastActiveAt: recentActivity.lastActiveAt,
    profileConfidence: resolvedActor.resolvedUserId ? 0.85 : 0.0,
  })
  .onConflictDoUpdate({
    target: [workspaceActorProfiles.workspaceId, workspaceActorProfiles.actorId],
    set: {
      // Only update resolvedUserId if currently null and now resolved
      resolvedUserId: sql`COALESCE(${workspaceActorProfiles.resolvedUserId}, ${resolvedActor.resolvedUserId})`,
      observationCount: recentActivity.count,
      lastActiveAt: recentActivity.lastActiveAt,
      updatedAt: new Date().toISOString(),
    },
  });
```

---

### Decision 5: Workspace-Scoped Actor Profiles (No Change)

**Current Architecture**: Same person gets separate profiles per workspace.

**Why This Is Correct**:
1. **Privacy**: Organizations shouldn't see activity from other organizations
2. **Isolation**: Workspace data should be completely independent
3. **Consistency**: Matches Pinecone namespace isolation pattern
4. **Simplicity**: No cross-org identity linking complexity

**Multi-Org User Scenario**:

```
User: alice@example.com (Clerk ID: user_alice)

Org A (acme-corp):
  Workspace: production
    Actor Profile:
      actorId: "github:12345"
      resolvedUserId: "user_alice"
      observationCount: 50

Org B (startup-inc):
  Workspace: main
    Actor Profile:
      actorId: "github:12345"  (same GitHub user!)
      resolvedUserId: "user_alice"
      observationCount: 10
```

Both profiles are separate, but both resolve to the same Clerk user.

---

### Decision 6: GitHub-Only Login (Recommendation)

**Current State**: Clerk supports Google and GitHub OAuth for sign-in.

**Recommendation**: Consider GitHub-only login for simplicity.

**Benefits**:
- Every console user has a GitHub identity by default
- Tier 1 OAuth resolution works for 100% of users
- No need for fallback email matching for most cases
- Simplifies identity model

**Trade-offs**:
- Excludes users without GitHub accounts
- Some project managers may prefer Google login

**Implementation** (if adopted):

```typescript
// apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx

// Remove Google OAuth option, keep only GitHub
<Button onClick={() => signIn("oauth_github")} ... />
```

**Alternative**: Keep both, but display GitHub connection prompt for Google users.

---

## Implementation Plan

### Phase 1: Fix Bugs (No Schema Changes)

1. **Remove prefix from transformers** (`packages/console-webhooks/src/transformers/github.ts`)
   - Lines 78, 204, 296, 361, 431 - Remove `github:` prefix
   - Also update Vercel transformer if applicable

2. **Fix display name extraction** (`api/console/src/inngest/workflow/neural/profile-update.ts`)
   - Pass sourceActor in event data
   - Use sourceActor.name for display name

3. **No migration needed** - Not in production, can ignore existing bad data

### Phase 2: Implement OAuth Resolution

1. **Add resolveByOAuth function** (`api/console/src/inngest/workflow/neural/actor-resolution.ts`)
   - Query Clerk external accounts
   - Match by GitHub provider + externalId

2. **Update resolution order**
   - Cache → OAuth → Email → Unresolved

### Phase 3: Pre-Map External Contributors

1. **Add resolvedUserId column** (`db/console/src/schema/tables/workspace-actor-profiles.ts`)
   - Nullable varchar for Clerk user ID

2. **Generate migration**
   ```bash
   cd db/console && pnpm db:generate
   ```

3. **Update profile upsert logic**
   - Store resolvedUserId from actor resolution
   - Set profileConfidence based on resolution status

### Phase 4: (Optional) Late Resolution

1. **Create background job** for resolving previously unresolved actors
   - Trigger when user joins organization
   - Query unresolved profiles matching user's external accounts
   - Update resolvedUserId and confidence

---

## Code References

### Files to Modify

| File | Changes |
|------|---------|
| `packages/console-webhooks/src/transformers/github.ts` | Remove `github:` prefix from actor IDs (lines 78, 204, 296, 361, 431) |
| `packages/console-webhooks/src/transformers/vercel.ts` | Remove `github:` prefix (line 113) |
| `api/console/src/inngest/workflow/neural/actor-resolution.ts` | Add resolveByOAuth function, update resolution order |
| `api/console/src/inngest/workflow/neural/profile-update.ts` | Use sourceActor.name for display name |
| `api/console/src/inngest/workflow/neural/observation-capture.ts` | Pass sourceActor in profile.update event |
| `db/console/src/schema/tables/workspace-actor-profiles.ts` | Add resolvedUserId column |

### Key Existing Code

| Location | Description |
|----------|-------------|
| `api/console/src/trpc.ts:725-774` | verifyOrgMembership helper |
| `packages/console-types/src/neural/source-event.ts:42-47` | SourceActor interface |
| `db/console/src/schema/tables/workspace-actor-identities.ts` | Identity cache schema |
| `vendor/clerk/src/server.ts` | Clerk SDK re-export |

---

## Open Questions (Resolved)

### Q1: Should the transformer prefix be removed or should actor-resolution not add a prefix?

**Answer**: Remove from transformers. Actor resolution should be the single source of canonical ID creation.

### Q2: What's the correct way to extract display name?

**Answer**: Pass sourceActor through to profile update, use `sourceActor.name`.

### Q3: Should we backfill/migrate existing actor profiles?

**Answer**: No. Not in production, existing test data can be ignored or manually cleared.

### Q4: When will Tier 1 (OAuth) and Tier 3 (Heuristic) identity resolution be implemented?

**Answer**:
- Tier 1 (OAuth): Phase 2 of this implementation
- Tier 3 (Heuristic): Deferred - not needed with GitHub-only login strategy

---

## Related Research

- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Original bug identification
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Original architecture design

---

## Architecture Diagrams

### Actor Resolution Flow (Updated)

```
GitHub Webhook
    ↓
Transformer
    ↓ actor: { id: "12345", name: "alice" }  (no prefix!)
SourceEvent
    ↓
Observation Capture Workflow
    ↓
Actor Resolution
    ├─ Cache lookup (workspaceId + source + sourceId)
    │   ↓ hit → return cached identity
    │   ↓ miss
    ├─ OAuth match (Clerk externalAccounts)
    │   ↓ match → cache + return userId
    │   ↓ no match
    ├─ Email match (existing)
    │   ↓ match → cache + return userId
    │   ↓ no match
    └─ Unresolved → return null
    ↓
actorId = "github:12345"  (single prefix added here)
    ↓
Store Observation
    ↓
Emit profile.update event (with sourceActor data)
    ↓
Profile Update Workflow
    ↓
displayName = sourceActor.name  (correct!)
    ↓
Upsert Actor Profile
```

### Identity Resolution Tiers (Final)

| Tier | Method | Confidence | Status |
|------|--------|------------|--------|
| 1 | OAuth (Clerk externalAccounts) | 1.0 | **Implement in Phase 2** |
| 2 | Email Matching | 0.85 | Existing |
| 3 | Heuristic | 0.60 | Deferred |
