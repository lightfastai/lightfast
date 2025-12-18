---
date: 2025-12-16T18:30:00+08:00
researcher: Claude
git_commit: 82c95f8e40dd8d2d7ca5fe6b2c68b48272c9318e
branch: feat/memory-layer-foundation
repository: lightfast
topic: "GitHub ID as Single Source of Truth - Identity Resolution Architecture Audit"
tags: [research, codebase, actor-identity, clerk, github, vercel, identity-resolution]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
last_updated_note: "Finalized with architectural decisions and implementation summary"
---

# Research: GitHub ID as Single Source of Truth - Identity Resolution Architecture

**Date**: 2025-12-16T18:30:00+08:00
**Researcher**: Claude
**Git Commit**: 82c95f8e40dd8d2d7ca5fe6b2c68b48272c9318e
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Research and document the current identity infrastructure to plan migration to GitHub ID as the single source of truth for actor identity. This includes Clerk integration, Vercel linkage strategy, and removal of mutable identifiers (username/email).

## Summary

The codebase has a well-designed actor identity system with GitHub numeric ID as the primary identifier for GitHub events. Vercel events present a challenge as they only provide usernames, which are resolved to numeric IDs via commit SHA linkage when possible. Clerk provides GitHub numeric ID through `provider_user_id` in external accounts, enabling future Clerk→GitHub actor mapping. The `sourceUsername` and `sourceEmail` fields exist but are minimally used—email index exists but is not queried, username is only used for @mention search.

---

## Detailed Findings

### 1. Clerk GitHub External Account Structure

#### Type Definition Location
`node_modules/@clerk/backend/dist/api/resources/JSON.d.ts:166-181`

#### ExternalAccountJSON Interface
```typescript
export interface ExternalAccountJSON extends ClerkResourceJSON {
    object: typeof ObjectType.ExternalAccount;  // "external_account"
    provider: string;                           // "oauth_github"
    identification_id: string;
    provider_user_id: string;                   // GitHub numeric ID (e.g., "12345678")
    approved_scopes: string;
    email_address: string;
    first_name: string;
    last_name: string;
    image_url?: string;
    username: string | null;                    // GitHub username (e.g., "octocat")
    phone_number: string | null;
    public_metadata?: Record<string, unknown> | null;
    label: string | null;
    verification: VerificationJSON | null;
}
```

#### Key Fields for Identity Resolution

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `provider_user_id` | `string` | **GitHub numeric ID** (stable, canonical) | `"12345678"` |
| `username` | `string \| null` | GitHub username (mutable) | `"octocat"` |
| `email_address` | `string` | Email from GitHub profile | `"octocat@github.com"` |
| `provider` | `string` | Always `"oauth_github"` for GitHub | `"oauth_github"` |

#### Accessing GitHub Data in Webhooks
```typescript
// From user.created or user.updated webhook
const githubAccount = evt.data.external_accounts?.find(
  acc => acc.provider === "oauth_github"
);

if (githubAccount) {
  const githubUserId = githubAccount.provider_user_id;  // Numeric ID as string
  const githubUsername = githubAccount.username;         // Username (may be null)
}
```

**Key Finding**: Clerk provides the **numeric GitHub ID** via `provider_user_id`, which is the stable identifier. No additional GitHub API calls are needed—Clerk stores this mapping automatically on OAuth sign-up.

---

### 2. Google Login Configuration Audit

#### Files Containing Google OAuth Implementation

**Primary Implementation (apps/auth):**
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx` - Google + GitHub OAuth sign-in
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx` - Google + GitHub OAuth sign-up

**Secondary Implementation (apps/chat):**
- `apps/chat/src/app/(auth)/_components/oauth-sign-in.tsx` - Duplicate Google + GitHub
- `apps/chat/src/app/(auth)/_components/oauth-sign-up.tsx` - Duplicate Google + GitHub

**Callback Handlers:**
- `apps/auth/src/app/(app)/(auth)/sign-in/sso-callback/page.tsx` - SSO callback

#### Implementation Pattern
```typescript
// oauth-sign-in.tsx:80-83
onClick={() => signInWith("oauth_google")}
// ...
{loading === "oauth_google" ? <Loader /> : <GoogleIcon />}
```

#### Files to Modify for Google Login Removal

1. **apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx**
   - Remove `"oauth_google"` from loading state type
   - Remove Google button JSX
   - Remove Google SVG icon

2. **apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx**
   - Same changes as oauth-sign-in.tsx

3. **apps/chat/src/app/(auth)/_components/oauth-sign-in.tsx**
   - Same changes (duplicate implementation)

4. **apps/chat/src/app/(auth)/_components/oauth-sign-up.tsx**
   - Same changes (duplicate implementation)

5. **Clerk Dashboard Configuration**
   - Disable Google OAuth provider at https://dashboard.clerk.com/
   - No codebase env vars for Google OAuth (credentials stored in Clerk)

**Note**: No Google-specific environment variables exist in the codebase. All OAuth provider configuration is managed through Clerk Dashboard.

---

### 3. GitHub Username/Email Usage Audit

#### Schema Fields

**workspaceActorIdentities** (`db/console/src/schema/tables/workspace-actor-identities.ts:36-37`):
```typescript
sourceUsername: varchar("source_username", { length: 255 }),
sourceEmail: varchar("source_email", { length: 255 }),
```

**workspaceActorProfiles** (`db/console/src/schema/tables/workspace-actor-profiles.ts:44-45`):
```typescript
displayName: varchar("display_name", { length: 255 }).notNull(),
email: varchar("email", { length: 255 }),
```

#### Index Definitions

**Email Index** (`workspace-actor-identities.ts:65-68`):
```typescript
emailIdx: index("actor_identity_email_idx").on(
  table.workspaceId,
  table.sourceEmail,
),
```
**Status**: Index exists but is **NOT actively queried** in production code.

**No Username Index**: `sourceUsername` has no index. Searches use sequential scan with ILIKE.

#### Query Usage

**Username Queries** (`apps/console/src/lib/neural/actor-search.ts:55-71`):
```typescript
// @mention search - ONLY place sourceUsername is queried
const identities = await db
  .select({
    canonicalActorId: workspaceActorIdentities.canonicalActorId,
    sourceUsername: workspaceActorIdentities.sourceUsername,
  })
  .from(workspaceActorIdentities)
  .where(
    and(
      eq(workspaceActorIdentities.workspaceId, workspaceId),
      or(
        ...mentions.map((m) =>
          ilike(workspaceActorIdentities.sourceUsername, `%${m}%`)
        )
      )
    )
  )
  .limit(topK);
```

**Email Queries**: **NONE FOUND** in active code. Email index is unused.

**Display Name Queries**:
- `api/console/src/router/org/workspace.ts:1414` - LIKE pattern match (case-sensitive)
- `apps/console/src/lib/neural/actor-search.ts:105` - ILIKE pattern match (case-insensitive)

#### Data Flow: Where Username/Email Are Written

| Location | Field | Source |
|----------|-------|--------|
| `transformers/github.ts:80` | `actor.name` | `payload.sender.login` (username) |
| `transformers/github.ts:82` | `actor.email` | `payload.pusher?.email` (push events only) |
| `transformers/vercel.ts:115` | `actor.name` | `gitMeta.githubCommitAuthorName` |
| `profile-update.ts:109` | `displayName` | `sourceActor?.name` |
| `profile-update.ts:110` | `email` | `sourceActor?.email` |

**Key Finding**: Email is only available from GitHub push events via `payload.pusher.email`. All other events (PR, issue, release, discussion) and Vercel events do not provide email.

---

### 4. Vercel → GitHub Commit → Actor Resolution Path

#### Architecture Flow

```
Vercel Webhook (Deployment)
  ├─ gitMeta.githubCommitAuthorName → actor.id (USERNAME)
  └─ gitMeta.githubCommitAuthorName → actor.name
       ↓
transformVercelDeployment() [packages/console-webhooks/src/transformers/vercel.ts:113-118]
       ↓
SourceEvent { actor: { id: username, name: username } }
       ↓
observation-capture workflow
       └─ resolveActor() [api/console/src/inngest/workflow/neural/actor-resolution.ts:86-138]
              ├─ Check source === "vercel"
              ├─ Extract commit SHA from references
              └─ resolveVercelActorViaCommitSha() [lines 37-78]
                     ├─ Query GitHub observations with same commit SHA
                     ├─ JSONB containment: sourceReferences @> [{"type":"commit","id":"<sha>"}]
                     └─ Extract numeric ID from GitHub event's actor.id
       ↓
Canonical Actor ID: "github:{numericId}" (if resolved) or "github:{username}" (if not)
```

#### Vercel Webhook Payload Limitations

**File**: `packages/console-webhooks/src/transformers/vercel.ts:111-118`

```typescript
// Note: Vercel only provides username, not numeric GitHub ID
// This creates username-based actor IDs (see Known Limitations in plan)
actor: gitMeta?.githubCommitAuthorName
  ? {
      id: gitMeta.githubCommitAuthorName,    // USERNAME not numeric ID
      name: gitMeta.githubCommitAuthorName,
    }
  : undefined,
```

**Available Vercel Git Metadata**:
- `gitMeta.githubCommitSha` - Commit SHA (used for resolution)
- `gitMeta.githubCommitAuthorName` - Username (NOT numeric ID)
- `gitMeta.githubCommitRef` - Branch name
- `gitMeta.githubCommitMessage` - Commit message
- `gitMeta.githubOrg` - Organization name
- `gitMeta.githubRepo` - Repository name

**NOT Available**: GitHub numeric user ID, email, avatar URL

#### Resolution Strategy

**resolveVercelActorViaCommitSha** (`actor-resolution.ts:37-78`):
```typescript
async function resolveVercelActorViaCommitSha(
  workspaceId: string,
  commitSha: string,
  _username: string,
): Promise<{ numericId: string } | null> {
  // Find GitHub observation with same commit SHA
  const githubEvent = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.source, "github"),
      sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "commit", id: commitSha }])}::jsonb`,
    ),
    columns: { actor: true },
  });

  // Validate numeric ID format
  const numericId = githubEvent?.actor?.id;
  if (!numericId || !/^\d+$/.test(numericId)) return null;
  return { numericId };
}
```

#### Bidirectional Reconciliation

**Forward Resolution** (Vercel → GitHub): At observation capture time, Vercel events try to resolve username to numeric ID via commit SHA.

**Backward Reconciliation** (`observation-capture.ts:800-828`): When a GitHub push event arrives, existing Vercel observations with the same commit SHA are updated with the numeric GitHub ID:

```typescript
// Step 7.5: For GitHub push events, reconcile Vercel observations
if (sourceEvent.source === "github" && sourceEvent.sourceType === "push") {
  const commitShas = references.filter(r => r.type === "commit").map(r => r.id);
  for (const sha of commitShas) {
    await reconcileVercelActorsForCommit(workspaceId, sha, numericActorId, sourceActor);
  }
}
```

---

### 5. Performance Considerations

#### Current Index Structure

**workspaceActorIdentities**:
| Index Name | Columns | Type | Used |
|------------|---------|------|------|
| `actor_identity_unique_idx` | `(workspace_id, source, source_id)` | UNIQUE | Yes |
| `actor_identity_canonical_actor_idx` | `(workspace_id, canonical_actor_id)` | INDEX | Yes |
| `actor_identity_email_idx` | `(workspace_id, source_email)` | INDEX | **NO** |

**workspaceActorProfiles**:
| Index Name | Columns | Type | Used |
|------------|---------|------|------|
| `actor_profile_unique_idx` | `(workspace_id, actor_id)` | UNIQUE | Yes |
| `actor_profile_workspace_idx` | `(workspace_id)` | INDEX | Yes |
| `actor_profile_last_active_idx` | `(workspace_id, last_active_at)` | INDEX | Yes |

#### Missing Indexes

1. **No index on `displayName`**: Queries at `actor-search.ts:105` and `workspace.ts:1414` perform sequential scans with LIKE/ILIKE.

2. **No index on `sourceUsername`**: Query at `actor-search.ts:66` performs sequential scan with ILIKE.

#### Query Performance Analysis

**@mention Search** (`actor-search.ts:55-96`):
- Pattern: `ILIKE '%username%'`
- Index used: None (sequential scan)
- Impact: O(n) where n = identities per workspace
- Risk: Slow for workspaces with many contributors

**Vercel Actor Resolution** (`actor-resolution.ts:47-57`):
- Pattern: JSONB containment `@>` operator
- Index used: None (GIN index would help)
- Impact: O(n) where n = GitHub observations
- Risk: Slow for workspaces with many observations

**Cluster API Calls**: **NONE** during webhook processing. Actor resolution uses database queries only.

#### N+1 Query Risks

**Identified in actor-search.ts**:
```typescript
// First query: Get identities
const identities = await db.select()...from(workspaceActorIdentities)...

// Second query: Get profiles for found actor IDs
const profiles = await db.select()...from(workspaceActorProfiles)
  .where(inArray(workspaceActorProfiles.actorId, actorIds));
```
- Pattern: 2 sequential queries (acceptable)
- NOT an N+1 pattern (uses `inArray` for batch)

---

### 6. Schema Migration Requirements

#### Columns to Consider for Removal

**workspaceActorIdentities**:
- `sourceUsername` - Only used for @mention search (could move to profiles)
- `sourceEmail` - Index exists but never queried

**workspaceActorProfiles**:
- `email` - Written from webhook but rarely used

#### Columns to Add

**workspaceActorProfiles** (for Clerk user linking):
```typescript
clerkUserId: varchar("clerk_user_id", { length: 191 }),  // Optional: link to Clerk user
```

**New Index**:
```typescript
clerkUserIdx: index("actor_profile_clerk_user_idx").on(
  table.workspaceId,
  table.clerkUserId,
),
```

#### Impact on @mention Search

Current implementation (`actor-search.ts:55-71`) queries `sourceUsername` from identities table. Options:

1. **Keep as-is**: `sourceUsername` remains in identities table
2. **Move to profiles**: Store username in `workspaceActorProfiles.displayName` (already exists)
3. **Derive from actorId**: Parse GitHub username from API on demand

**Recommended**: Keep `sourceUsername` for @mention search but document it as display-only (not for identity resolution).

#### Foreign Key Relationships

Current state: No explicit FK between `workspaceActorIdentities.canonicalActorId` and `workspaceActorProfiles.actorId`.

Migration options:
1. **Keep soft reference** (current): Application-level enforcement
2. **Add FK constraint**: Requires ensuring profile exists before identity

---

## Code References

### Clerk External Account Types
- `node_modules/@clerk/backend/dist/api/resources/JSON.d.ts:166-181` - ExternalAccountJSON interface
- `node_modules/@clerk/backend/dist/api/resources/ExternalAccount.d.ts:8-123` - ExternalAccount class

### Google OAuth Implementation
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx:80-83` - Google sign-in button
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx` - Google sign-up button
- `apps/chat/src/app/(auth)/_components/oauth-sign-in.tsx:79-82` - Chat app duplicate

### Actor Identity Schema
- `db/console/src/schema/tables/workspace-actor-identities.ts:16-75` - Full table definition
- `db/console/src/schema/tables/workspace-actor-profiles.ts:20-103` - Full table definition

### GitHub Webhook Transformer
- `packages/console-webhooks/src/transformers/github.ts:78-85` - Push event actor extraction
- `packages/console-webhooks/src/transformers/github.ts:215-221` - PR event actor extraction

### Vercel Webhook Transformer
- `packages/console-webhooks/src/transformers/vercel.ts:111-118` - Deployment actor extraction

### Actor Resolution
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:37-78` - Vercel→GitHub resolution
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:86-138` - Main resolution function

### @mention Search
- `apps/console/src/lib/neural/actor-search.ts:55-71` - Username-based search
- `apps/console/src/lib/neural/actor-search.ts:99-109` - Display name search

---

## Historical Context (from thoughts/)

### Related Research Documents
- `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md` - Actor Implementation Bugfix Plan
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` - End-to-End Design
- `thoughts/shared/research/2025-12-15-webhook-actor-shape-verification.md` - Webhook Actor Shape Verification
- `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md` - Cross-Source Linkage Architecture
- `thoughts/shared/research/2025-12-16-clerkorgid-propagation-architecture.md` - clerkOrgId Propagation (NEW)

### Key Historical Decisions
1. **Numeric ID preference**: Decision to use `payload.sender.id` instead of `payload.pusher.name` for consistency across event types
2. **Commit SHA linkage**: Strategy for resolving Vercel usernames to GitHub IDs via commit SHA matching
3. **COALESCE pattern**: Profile updates preserve existing values to avoid data loss from events without complete data

---

## Recommended Migration Approach

### Phase 1: Clerk Webhook Handler (Low Risk)
1. Add webhook handler for `user.created` event
2. Extract `provider_user_id` from GitHub external account
3. Emit `apps-console/actor/late-resolution` event for Clerk→GitHub mapping
4. Store mapping in new `github_clerk_mappings` cache table (optional)

### Phase 2: Google Login Removal (Low Risk)
1. Disable Google OAuth in Clerk Dashboard
2. Remove Google buttons from `oauth-sign-in.tsx` and `oauth-sign-up.tsx` (4 files)
3. No database migration required

### Phase 3: Schema Cleanup (Medium Risk)
1. Add `clerkUserId` column to `workspaceActorProfiles`
2. Deprecate `sourceEmail` field (keep for backward compatibility)
3. Keep `sourceUsername` for @mention search
4. Add GIN index on `sourceReferences` for faster commit SHA lookups

### Phase 4: Performance Optimization (Low Risk)
1. Add index on `displayName` for profile search
2. Consider removing unused `actor_identity_email_idx`
3. Monitor query performance after changes

---

## Design Decisions

### 0. Table Architecture

**Decision**: Keep both `workspaceActorIdentities` and `workspaceActorProfiles` tables.

**Rationale**: Separation of concerns and future multi-source support.

#### Current Usage

| Table | Current Role |
|-------|--------------|
| `workspaceActorIdentities` | Maps GitHub username → canonical actor ID |
| `workspaceActorProfiles` | Unified profile with stats and `clerkUserId` |

#### @mention Resolution (Current)

```
GitHub Issue: "@octocat can you review?"
  → Parse @octocat
  → Query identities WHERE sourceUsername ILIKE '%octocat%'
  → Get canonicalActorId = 'github:12345678'
  → Return actor profile

Lightfast Search: "@octocat"
  → Same flow (uses GitHub username)
```

#### Future Multi-Source Support (Deferred)

When we add Lightfast usernames, the identities table will support:

```
workspaceActorIdentities:
┌─────────────┬────────────────┬─────────────────────┐
│ source      │ sourceUsername │ canonicalActorId    │
├─────────────┼────────────────┼─────────────────────┤
│ github      │ octocat        │ github:12345678     │  ← GitHub @mentions
│ lightfast   │ john-doe       │ github:12345678     │  ← Lightfast @mentions (future)
└─────────────┴────────────────┴─────────────────────┘
```

**Same person, multiple usernames, one canonical ID.**

This architecture is in place but Lightfast usernames are **deferred**.

**Trade-off accepted**: Extra join for @mention search (identities → profiles), but preserves future flexibility.

### 1. Vercel Actor Resolution Strategy

**Decision**: Keep current commit SHA linkage approach. No Vercel API changes needed.

**Rationale**: Causality guarantees ordering—GitHub push webhooks arrive before or simultaneously with Vercel deployment webhooks:
```
User pushes code → GitHub webhook fires → Vercel builds → Vercel webhook fires
```

The GitHub push event will *always* exist when resolving Vercel actors. Current architecture is correct.

### 2. @mention UX

**Decision**: Keep username-only search. No numeric ID support needed.

**Rationale**:
- Users type `@octocat` not `@12345678`
- Nobody memorizes numeric IDs
- Current ILIKE on `sourceUsername` matches user expectations

The code already handles both:
1. `@mention` → searches `sourceUsername` (identities table)
2. Name search → searches `displayName` (profiles table)

### 3. Clerk User Visibility

**Decision**: Contributors only. Clerk enriches existing profiles, doesn't create new ones.

**Rationale**:
- **Actor list = people who have contributed** (activity-based, not membership-based)
- No ghost profiles for inactive users
- Actor list stays relevant

**Behavior**:
- Clerk user links to existing contributor → Upgrade `displayName` from "octocat" to "John Doe"
- Clerk user has NO contributions → Don't create profile (they appear when they contribute)
- Team membership → Separate feature (Clerk org members, not actor system)

### 4. Email Index

**Decision**: Remove unused `actor_identity_email_idx`. Keep column for display only.

**Rationale**:
- Index is never queried in production
- GitHub ID strategy makes email-based matching obsolete
- Email matching is unreliable (people use different emails across services)
- Clerk gives us GitHub ID directly—no need for email-based resolution

### 5. Profile Linking Strategy

**Decision**: Lazy resolution via Clerk user ID. No webhooks needed.

**Scenario**:
1. `octocat` pushes code → Profile created: `github:12345678`
2. `octocat` signs up via Clerk with GitHub OAuth
3. User accesses workspace → Lazy link: `clerkUserId` set on profile

**Implementation** (lazy resolution in authenticated context):
```typescript
// Called in authenticated tRPC procedures or middleware
async function ensureActorLinked(ctx: AuthenticatedContext) {
  const clerkUser = ctx.auth.user;
  const githubAccount = clerkUser.externalAccounts?.find(
    a => a.provider === "oauth_github"
  );
  if (!githubAccount) return;

  const githubId = githubAccount.providerUserId;
  const canonicalActorId = `github:${githubId}`;

  // Lazy link: Update profile if clerkUserId not set
  await db.update(workspaceActorProfiles)
    .set({ clerkUserId: clerkUser.id })
    .where(
      and(
        eq(workspaceActorProfiles.workspaceId, ctx.workspaceId),
        eq(workspaceActorProfiles.actorId, canonicalActorId),
        isNull(workspaceActorProfiles.clerkUserId)  // Only if not already linked
      )
    );
}
```

**Why lazy resolution**:
- No Clerk webhook infrastructure needed
- Links happen on-demand when user accesses workspace
- Simpler implementation, same end result

**The Simple Model**:

| Concept | Storage | Source |
|---------|---------|--------|
| Actor identity | `actorId = "github:12345678"` | GitHub numeric ID (immutable) |
| Display name | `displayName` | GitHub username (for now) |
| Clerk link | `clerkUserId` | Lazy-linked on first authenticated access |
| @mention | `sourceUsername` | GitHub username (existing behavior) |
| Activity | `observationCount`, `lastActiveAt` | From observations |

### Deferred Features

| Feature | Status | When |
|---------|--------|------|
| Lightfast usernames | Deferred | When we need custom @mentions |
| Clerk webhooks | Deferred | When we need real-time sync |
| Display name upgrade | Deferred | When we want "John Doe" instead of "octocat" |
| Lightfast identity records | Deferred | When we implement Lightfast usernames |

---

## Known Limitations (Accepted)

### Vercel Edge Cases with Username-Based Actor IDs

The following Vercel scenarios will have **username-based actor IDs** (`github:octocat`) instead of numeric IDs (`github:12345678`):

1. **Manual Redeploys**: Vercel dashboard "Redeploy" button—no new Git commit
2. **Rollbacks**: Reverting to previous deployment—no new Git commit
3. **GitHub Webhook Failures**: If GitHub push webhook fails to deliver/process
4. **Race Conditions**: Vercel webhook arrives before GitHub webhook (rare)

**Impact**: These actors cannot be linked to their numeric GitHub ID or Clerk user.

**Acceptance Rationale**:
- These are rare edge cases (<5% of deployments)
- Username-based IDs still work for display and basic tracking
- Manual reconciliation possible if needed later
- Complexity of handling these cases outweighs benefit

**Future Option**: If this becomes a problem, we could add a background job that periodically:
1. Finds actors with username-based IDs
2. Calls GitHub API to resolve username → numeric ID
3. Updates actor ID

This is **not planned** for initial implementation.

---

## Final Schema Changes

### Add to `workspaceActorProfiles`

```typescript
clerkUserId: varchar("clerk_user_id", { length: 191 }),

// Index for reverse lookup (Clerk → Actor)
clerkUserIdx: uniqueIndex("actor_profile_clerk_user_idx").on(
  table.workspaceId,
  table.clerkUserId,
),
```

### Remove (Future Cleanup)

```sql
-- Remove unused email index
DROP INDEX actor_identity_email_idx;
```

### Keep (Display Only)

- `sourceEmail` column - For display, not identity resolution
- `sourceUsername` column - For @mention search

---

## Implementation Summary

**Context**: Not in production. No migration concerns for existing users.

### Schema Changes

| Change | Type | Table |
|--------|------|-------|
| Add `clerkUserId` column | ADD COLUMN | `workspaceActorProfiles` |
| Add `actor_profile_clerk_user_idx` | ADD INDEX | `workspaceActorProfiles` |
| Drop `actor_identity_email_idx` | DROP INDEX | `workspaceActorIdentities` |

**No tables dropped. No columns dropped.**

### Code Changes

| Task | Effort | Priority |
|------|--------|----------|
| Add `clerkUserId` column + index | ~10 lines | High |
| Lazy linking function (`ensureActorLinked`) | ~20 lines | High |
| Hard remove Google OAuth (4 files) | ~40 lines removed | High |
| Disable Google in Clerk Dashboard | Config change | High |

**Total new code**: ~30 lines
**Total removed code**: ~40 lines

### Key Insight

**GitHub ID is the canonical identity. Clerk user ID links authenticated users to their actor profile.**

```
Clerk User (user_abc)
    │
    └── externalAccounts[oauth_github].providerUserId = "12345678"
                                                            │
                                                            ▼
                                        actorId = "github:12345678" ──→ Profile
```

**Implementation requires:**
1. Add `clerkUserId` column to profiles
2. Lazy link Clerk users to their GitHub-based actor profile
3. Remove unused infrastructure (email index, Google OAuth)

**Deferred:**
- Clerk webhooks
- Lightfast usernames
- Display name upgrades

---

## Ready for Implementation

This research is complete. Next step: Create implementation plan at `thoughts/shared/plans/2025-12-16-github-id-identity-resolution.md`
