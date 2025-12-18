# Org-Level Actor Identities Implementation Plan

## Overview

Migrate actor identity mapping from workspace scope to organization scope. This separates **identity** (org-invariant: who is who) from **activity** (workspace-specific: what they did). The change eliminates duplicate identity records across workspaces and simplifies Clerk user linking.

## Current State Analysis

### Current Architecture (Problematic)

```
workspaceActorIdentities (workspace-scoped)
│ workspaceId  │ source │ sourceId │ canonicalActorId │ sourceUsername │
├──────────────┼────────┼──────────┼──────────────────┼────────────────┤
│ ws_prod      │ github │ 12345678 │ github:12345678  │ octocat        │
│ ws_staging   │ github │ 12345678 │ github:12345678  │ octocat        │ ← DUPLICATE
│ ws_dev       │ github │ 12345678 │ github:12345678  │ octocat        │ ← DUPLICATE
```

**Problems:**
1. **Identity duplication**: Same person's identity is stored N times (once per workspace)
2. **Clerk linking per-workspace**: `clerkUserId` on profiles requires lazy linking in each workspace
3. **Username updates**: When GitHub user renames, update N records instead of 1
4. **@mention search**: Scans workspace-scoped table, may miss identities from other workspaces

### Key Files (Current)

| File | Purpose |
|------|---------|
| `db/console/src/schema/tables/workspace-actor-identities.ts:64-112` | Identity table definition |
| `db/console/src/schema/tables/workspace-actor-profiles.ts:80-159` | Profile table with `clerkUserId` |
| `db/console/src/schema/relations.ts:99-118` | Drizzle relations |
| `api/console/src/lib/actor-linking.ts:30-63` | Lazy Clerk user linking |
| `api/console/src/inngest/workflow/neural/profile-update.ts:100-148` | Profile upsert |
| `apps/console/src/lib/neural/actor-search.ts:55-95` | @mention search |

## Desired End State

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Clerk Organization (clerkOrgId)                                         │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ orgActorIdentities (org-scoped - NEW)                           │   │
│   │   clerkOrgId: "org_abc"                                         │   │
│   │   canonicalActorId: "github:12345678"                           │   │
│   │   source: "github"                                              │   │
│   │   sourceId: "12345678"                                          │   │
│   │   sourceUsername: "octocat"                                     │   │
│   │   clerkUserId: "user_xyz" ← MOVED from profiles                 │   │
│   │   avatarUrl: "https://..." ← MOVED from profiles                │   │
│   │   UNIQUE(clerkOrgId, source, sourceId)                          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ canonicalActorId (logical ref)           │
│                              ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ orgWorkspaces                                                   │   │
│   │   ┌─────────────────────────────────────────────────────────┐   │   │
│   │   │ workspaceActorProfiles (workspace-scoped - SIMPLIFIED)  │   │   │
│   │   │   workspaceId: "ws_prod"                                │   │   │
│   │   │   actorId: "github:12345678"                            │   │   │
│   │   │   displayName: "octocat"                                │   │   │
│   │   │   observationCount: 42                                  │   │   │
│   │   │   lastActiveAt: "2025-12-16T..."                        │   │   │
│   │   │   ← clerkUserId REMOVED                                 │   │   │
│   │   │   ← avatarUrl REMOVED                                   │   │   │
│   │   │   UNIQUE(workspaceId, actorId)                          │   │   │
│   │   └─────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Verification Criteria

1. Identity records are unique per (clerkOrgId, source, sourceId)
2. Clerk user linking happens once per org, not per workspace
3. @mention search works via org-level identities
4. Profile activity metrics remain workspace-scoped
5. All existing queries continue to function correctly

## What We're NOT Doing

1. **NOT changing observations table** - `actorId` field on observations stays as-is
2. **NOT implementing Lightfast usernames** - Deferred to future phase
3. **NOT adding foreign key from profiles to identities** - Keep logical relationship
4. **NOT changing canonical actor ID format** - Keep `{source}:{sourceId}` format
5. **NOT migrating existing data** - System is pre-production; tables can be recreated

## Implementation Approach

Since the system is pre-production with no real user data, we'll use a **replace strategy** rather than a migration strategy. This is cleaner and avoids complex data migration scripts.

---

## Phase 1: Create Org-Level Identity Table

### Overview

Create the new `orgActorIdentities` table scoped by `clerkOrgId` instead of `workspaceId`.

### Changes Required:

#### 1. New Table Definition

**File**: `db/console/src/schema/tables/org-actor-identities.ts` (NEW)
**Changes**: Create new org-scoped identity table

```typescript
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Org-Level Actor Identities - Cross-Platform Identity Mapping
 *
 * ## Architecture Overview
 *
 * This table maps external identities (GitHub usernames, Vercel accounts, future Lightfast
 * usernames) to canonical actor IDs at the ORGANIZATION level.
 *
 * Identity is org-invariant: "octocat" in workspace A is the same person as in workspace B.
 * Activity is workspace-specific: tracked separately in workspaceActorProfiles.
 *
 * ```
 * orgActorIdentities (this table)              workspaceActorProfiles
 * ┌─────────────────────────────────────┐      ┌─────────────────────────────┐
 * │ clerkOrgId: "org_abc"               │      │ workspaceId: "ws_prod"      │
 * │ source: "github"                    │      │ actorId: "github:12345678"  │
 * │ sourceId: "12345678"                │──────│ displayName: "octocat"      │
 * │ canonicalActorId: "github:12345678" │      │ observationCount: 42        │
 * │ sourceUsername: "octocat"           │      └─────────────────────────────┘
 * │ clerkUserId: "user_xyz"             │
 * └─────────────────────────────────────┘
 * ```
 *
 * ## Why Org-Level?
 *
 * - **Single source of truth**: Identity mapping is an organizational fact
 * - **No duplication**: One record per actor per org, not per workspace
 * - **Simpler Clerk linking**: Link once per org, not per workspace
 * - **Better @mention search**: Search org-level for all known actors
 *
 * ## Clerk User Linking
 *
 * The `clerkUserId` field links authenticated Clerk users to their identity:
 * - Clerk provides GitHub numeric ID via `externalAccounts[].providerUserId`
 * - Linking happens once when user first accesses ANY workspace in the org
 * - All workspaces automatically know this user's identity
 *
 * @see workspaceActorProfiles - Workspace-specific activity tracking
 * @see api/console/src/lib/actor-linking.ts - Org-level Clerk user linking
 */
export const orgActorIdentities = pgTable(
  "lightfast_org_actor_identities",
  {
    /**
     * Internal BIGINT primary key - maximum performance for identity mapping
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     * Scoping is at org level, not workspace level
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Canonical actor ID (links to profiles.actorId, format: "source:sourceId")
     * Example: "github:12345678"
     */
    canonicalActorId: varchar("canonical_actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),

    /**
     * Avatar URL - moved from profiles since it's identity, not activity
     */
    avatarUrl: text("avatar_url"),

    /**
     * Clerk user ID - links authenticated Clerk user to this identity
     * Moved from profiles: linking is org-level, not workspace-level
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

    // Mapping metadata
    mappingMethod: varchar("mapping_method", { length: 50 }).notNull(),
    confidenceScore: real("confidence_score").notNull(),
    mappedBy: varchar("mapped_by", { length: 191 }),
    mappedAt: timestamp("mapped_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint on org + source + sourceId (one identity per actor per org)
    uniqueIdentityIdx: uniqueIndex("org_actor_identity_unique_idx").on(
      table.clerkOrgId,
      table.source,
      table.sourceId,
    ),

    // Index for finding identities by canonical actor ID
    canonicalActorIdx: index("org_actor_identity_canonical_idx").on(
      table.clerkOrgId,
      table.canonicalActorId,
    ),

    // Index for Clerk user lookup (org-level)
    clerkUserIdx: index("org_actor_identity_clerk_user_idx").on(
      table.clerkOrgId,
      table.clerkUserId,
    ),

    // Index for @mention search by username
    usernameIdx: index("org_actor_identity_username_idx").on(
      table.clerkOrgId,
      table.sourceUsername,
    ),
  }),
);

export type OrgActorIdentity = typeof orgActorIdentities.$inferSelect;
export type InsertOrgActorIdentity = typeof orgActorIdentities.$inferInsert;
```

#### 2. Update Schema Index Exports

**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Add export for new table

```typescript
// Add to existing exports
export * from "./org-actor-identities";
```

#### 3. Update Drizzle Relations

**File**: `db/console/src/schema/relations.ts`
**Changes**: Add relations for new table, keep old for backward compatibility during transition

```typescript
import { orgActorIdentities } from "./tables/org-actor-identities";

// Add new relations
export const orgActorIdentitiesRelations = relations(
  orgActorIdentities,
  ({ one }) => ({
    // No direct FK to orgWorkspaces - clerkOrgId is logical reference
  }),
);

// Update workspaceActorProfilesRelations to reference both tables during transition
// (Can simplify after old table is removed)
```

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @db/console build`
- [ ] New table visible in Drizzle Studio: `cd db/console && pnpm db:studio`

#### Manual Verification:
- [ ] Table `lightfast_org_actor_identities` exists with correct columns
- [ ] Indexes exist: `org_actor_identity_unique_idx`, `org_actor_identity_canonical_idx`, `org_actor_identity_clerk_user_idx`, `org_actor_identity_username_idx`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update Actor Resolution to Use Org-Level Identities

### Overview

Modify actor resolution to create org-level identity records alongside workspace-level profiles.

### Changes Required:

#### 1. Add Identity Upsert Function

**File**: `api/console/src/lib/actor-identity.ts` (NEW)
**Changes**: Create function to upsert org-level identities

```typescript
import { and, eq } from "drizzle-orm";
import { db, orgActorIdentities } from "@db/console";
import type { SourceActor } from "@repo/console-types";

export interface UpsertIdentityInput {
  clerkOrgId: string;
  canonicalActorId: string;
  source: string;
  sourceId: string;
  sourceActor: SourceActor | null;
  mappingMethod: string;
  confidenceScore: number;
}

/**
 * Upsert org-level actor identity.
 * Creates or updates identity mapping at organization level.
 */
export async function upsertOrgActorIdentity(input: UpsertIdentityInput): Promise<void> {
  const {
    clerkOrgId,
    canonicalActorId,
    source,
    sourceId,
    sourceActor,
    mappingMethod,
    confidenceScore,
  } = input;

  await db
    .insert(orgActorIdentities)
    .values({
      clerkOrgId,
      canonicalActorId,
      source,
      sourceId,
      sourceUsername: sourceActor?.name ?? null,
      sourceEmail: sourceActor?.email ?? null,
      avatarUrl: sourceActor?.avatarUrl ?? null,
      mappingMethod,
      confidenceScore,
    })
    .onConflictDoUpdate({
      target: [
        orgActorIdentities.clerkOrgId,
        orgActorIdentities.source,
        orgActorIdentities.sourceId,
      ],
      set: {
        // Update username/email/avatar if changed
        sourceUsername: sourceActor?.name ?? null,
        sourceEmail: sourceActor?.email ?? null,
        avatarUrl: sourceActor?.avatarUrl ?? null,
        mappedAt: new Date().toISOString(),
      },
    });
}

/**
 * Get identity by canonical actor ID.
 */
export async function getOrgActorIdentity(
  clerkOrgId: string,
  canonicalActorId: string,
): Promise<{ clerkUserId: string | null; sourceUsername: string | null } | null> {
  const identity = await db.query.orgActorIdentities.findFirst({
    where: and(
      eq(orgActorIdentities.clerkOrgId, clerkOrgId),
      eq(orgActorIdentities.canonicalActorId, canonicalActorId),
    ),
    columns: {
      clerkUserId: true,
      sourceUsername: true,
    },
  });

  return identity ?? null;
}
```

#### 2. Update Profile Update Workflow

**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`
**Changes**: Add identity upsert step, remove `avatarUrl` from profile upsert

```typescript
import { upsertOrgActorIdentity } from "../../../lib/actor-identity";

// In profileUpdate function, add after gathering activity:

// Step: Upsert org-level identity
await step.run("upsert-identity", async () => {
  await upsertOrgActorIdentity({
    clerkOrgId,
    canonicalActorId: actorId,
    source: actorId.split(":")[0] ?? "unknown",
    sourceId: actorId.split(":")[1] ?? actorId,
    sourceActor,
    mappingMethod: "webhook",
    confidenceScore: 1.0,
  });
});

// Update profile upsert to remove avatarUrl
await db
  .insert(workspaceActorProfiles)
  .values({
    workspaceId,
    actorId,
    displayName,
    email: sourceActor?.email ?? null,
    // avatarUrl removed - now in identity table
    observationCount: recentActivity.count,
    lastActiveAt: recentActivity.lastActiveAt,
    profileConfidence: 0.5,
  })
  // ... rest of onConflictDoUpdate without avatarUrl
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @api/console build`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files, new code is clean)
- [ ] Run dev server and trigger a webhook: identity record created in `orgActorIdentities`

#### Manual Verification:
- [ ] After GitHub webhook, check `orgActorIdentities` table has one record per actor per org
- [ ] Verify `sourceUsername`, `sourceEmail`, `avatarUrl` populated correctly
- [ ] Verify `workspaceActorProfiles` still created (but without duplicated identity data)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update Clerk User Linking to Org-Level

### Overview

Modify Clerk user linking to link at org level instead of workspace level.

### Changes Required:

#### 1. Update Actor Linking Library

**File**: `api/console/src/lib/actor-linking.ts`
**Changes**: Link to org-level identity instead of workspace profile

```typescript
import { and, eq, isNull } from "drizzle-orm";
import { db, orgActorIdentities, workspaceActorProfiles } from "@db/console";

/**
 * Lazily links a Clerk user to their GitHub-based actor identity.
 * Called when an authenticated user accesses ANY workspace in the org.
 *
 * Changed from workspace-level to org-level linking:
 * - Previous: Updated workspaceActorProfiles.clerkUserId per workspace
 * - Now: Updates orgActorIdentities.clerkUserId once per org
 */
export async function ensureActorLinked(
  clerkOrgId: string,
  clerkUser: ClerkUserForLinking,
): Promise<{ linked: boolean; actorId: string | null }> {
  // Find GitHub external account
  const githubAccount = clerkUser.externalAccounts?.find(
    (acc: ClerkExternalAccount) => acc.provider === "oauth_github",
  );

  if (!githubAccount?.providerUserId) {
    return { linked: false, actorId: null };
  }

  const githubNumericId = githubAccount.providerUserId;
  const canonicalActorId = `github:${githubNumericId}`;

  // Lazy link at ORG level: Update identity if clerkUserId not set
  const result = await db
    .update(orgActorIdentities)
    .set({ clerkUserId: clerkUser.id })
    .where(
      and(
        eq(orgActorIdentities.clerkOrgId, clerkOrgId),
        eq(orgActorIdentities.canonicalActorId, canonicalActorId),
        isNull(orgActorIdentities.clerkUserId),
      ),
    )
    .returning({ actorId: orgActorIdentities.canonicalActorId });

  return {
    linked: result.length > 0,
    actorId: result[0]?.actorId ?? null,
  };
}

/**
 * Get actor identity for a Clerk user in an org.
 * Returns null if user has no linked actor identity.
 */
export async function getActorForClerkUser(
  clerkOrgId: string,
  clerkUserId: string,
): Promise<{ actorId: string; sourceUsername: string | null } | null> {
  const identity = await db.query.orgActorIdentities.findFirst({
    where: and(
      eq(orgActorIdentities.clerkOrgId, clerkOrgId),
      eq(orgActorIdentities.clerkUserId, clerkUserId),
    ),
    columns: {
      canonicalActorId: true,
      sourceUsername: true,
    },
  });

  if (!identity) return null;

  return {
    actorId: identity.canonicalActorId,
    sourceUsername: identity.sourceUsername,
  };
}
```

#### 2. Update Workspace Router Call Site

**File**: `api/console/src/router/org/workspace.ts`
**Changes**: Pass `clerkOrgId` instead of `workspaceId` to `ensureActorLinked`

```typescript
// In workspace.getByName procedure:
// Change from:
void ensureActorLinked(workspace.id, clerkUser);
// To:
void ensureActorLinked(workspace.clerkOrgId, clerkUser);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @api/console build`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files, new code is clean)

#### Manual Verification:
- [ ] Sign in with GitHub OAuth
- [ ] Access workspace - verify `clerkUserId` set on `orgActorIdentities` record
- [ ] Access second workspace in same org - verify same identity record (no new record)
- [ ] Verify only ONE identity record per actor per org

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Update @Mention Search to Use Org-Level Identities

### Overview

Modify @mention search to query org-level identities instead of workspace-level.

### Changes Required:

#### 1. Update Actor Search

**File**: `apps/console/src/lib/neural/actor-search.ts`
**Changes**: Query `orgActorIdentities` instead of `workspaceActorIdentities`

```typescript
import { and, desc, eq, ilike, or, inArray } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceActorProfiles, orgActorIdentities, orgWorkspaces } from "@db/console/schema";

/**
 * Search for relevant actor profiles based on query.
 *
 * Changed from workspace-level to org-level identity search:
 * - @mentions search org-level identities (all actors known to org)
 * - Profile data still filtered by workspace (activity is workspace-specific)
 */
export async function searchActorProfiles(
  workspaceId: string,
  query: string,
  topK = 5
): Promise<{ results: ActorSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    // Get clerkOrgId for this workspace
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: { clerkOrgId: true },
    });

    if (!workspace) {
      return { results: [], latency: Date.now() - startTime };
    }

    const mentions = extractActorMentions(query);
    const queryLower = query.toLowerCase();

    // 1. Search by explicit @mentions (ORG-LEVEL)
    let mentionMatches: ActorSearchResult[] = [];
    if (mentions.length > 0) {
      const identities = await db
        .select({
          canonicalActorId: orgActorIdentities.canonicalActorId,
          sourceUsername: orgActorIdentities.sourceUsername,
          avatarUrl: orgActorIdentities.avatarUrl,
        })
        .from(orgActorIdentities)
        .where(
          and(
            eq(orgActorIdentities.clerkOrgId, workspace.clerkOrgId),
            or(
              ...mentions.map((m) =>
                ilike(orgActorIdentities.sourceUsername, `%${m}%`)
              )
            )
          )
        )
        .limit(topK);

      const actorIds = identities.map((i) => i.canonicalActorId);

      if (actorIds.length > 0) {
        // Get profiles for these actors in this workspace
        const profiles = await db
          .select()
          .from(workspaceActorProfiles)
          .where(
            and(
              eq(workspaceActorProfiles.workspaceId, workspaceId),
              inArray(workspaceActorProfiles.actorId, actorIds)
            )
          );

        // Build map of actorId -> profile for quick lookup
        const profileMap = new Map(profiles.map(p => [p.actorId, p]));

        // Combine identity data with profile data
        mentionMatches = identities
          .filter(i => profileMap.has(i.canonicalActorId))
          .map((i) => {
            const profile = profileMap.get(i.canonicalActorId)!;
            return {
              actorId: i.canonicalActorId,
              displayName: profile.displayName,
              avatarUrl: i.avatarUrl, // From identity, not profile
              expertiseDomains: profile.expertiseDomains ?? [],
              observationCount: profile.observationCount,
              lastActiveAt: profile.lastActiveAt,
              matchType: "mention" as const,
              score: 0.95,
            };
          });
      }
    }

    // 2. Search by display name (WORKSPACE-LEVEL - profiles)
    // ... rest of function unchanged, but remove avatarUrl from profile query
    // since it's now in identity table

    // ... combine results and return
  } catch (error) {
    console.error("Actor search failed:", error);
    return { results: [], latency: Date.now() - startTime };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/console build`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files, new code is clean)

#### Manual Verification:
- [ ] Test @mention search in console UI
- [ ] Verify actors are found by username
- [ ] Verify avatar URL displays correctly (from identity table)
- [ ] Verify observation counts still show correctly (from profile table)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Simplify Profile Table

### Overview

Remove fields from `workspaceActorProfiles` that are now in `orgActorIdentities`.

### Changes Required:

#### 1. Update Profile Table Schema

**File**: `db/console/src/schema/tables/workspace-actor-profiles.ts`
**Changes**: Remove `clerkUserId`, `avatarUrl` fields and related indexes

```typescript
// Remove these fields:
// - clerkUserId (moved to orgActorIdentities)
// - avatarUrl (moved to orgActorIdentities)

// Remove this index:
// - clerkUserIdx (no longer needed - Clerk lookup is org-level)
```

#### 2. Update tRPC Router

**File**: `api/console/src/router/org/workspace.ts`
**Changes**: Update `getActors` procedure to join with identities for avatar URL

```typescript
// In getActors procedure, join with orgActorIdentities to get avatarUrl
// Or modify return type to exclude avatarUrl (fetch separately when needed)
```

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @lightfast/console build`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files, new code is clean)

#### Manual Verification:
- [ ] Verify `clerkUserId` and `avatarUrl` columns removed from `lightfast_workspace_actor_profiles`
- [ ] Verify `actor_profile_clerk_user_idx` index removed
- [ ] UI still displays avatar URLs correctly (from identity table)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Cleanup Old Table

### Overview

Remove the old `workspaceActorIdentities` table after migration is complete.

### Changes Required:

#### 1. Delete Old Table File

**File**: `db/console/src/schema/tables/workspace-actor-identities.ts`
**Changes**: Delete file entirely

#### 2. Update Schema Exports

**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Remove export of old table

#### 3. Update Relations

**File**: `db/console/src/schema/relations.ts`
**Changes**: Remove `workspaceActorIdentitiesRelations`

#### 4. Generate Migration

Run `pnpm db:generate` to generate migration that drops old table

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @lightfast/console build`
- [ ] Full test suite passes: `pnpm test` (if applicable)

#### Manual Verification:
- [ ] Verify `lightfast_workspace_actor_identities` table no longer exists
- [ ] Verify all actor-related features still work in UI
- [ ] Verify @mention search works correctly
- [ ] Verify Clerk user linking works correctly

---

## Testing Strategy

### Unit Tests:
- Test `upsertOrgActorIdentity` creates/updates correctly
- Test `ensureActorLinked` links at org level
- Test `getActorForClerkUser` returns correct identity
- Test `searchActorProfiles` finds actors by @mention

### Integration Tests:
- End-to-end: GitHub webhook → identity + profile created
- End-to-end: Clerk OAuth → identity linked
- End-to-end: @mention search finds actor across workspaces

### Manual Testing Steps:
1. Create GitHub webhook event → verify identity in `orgActorIdentities`
2. Sign in with GitHub OAuth → verify `clerkUserId` on identity
3. Access second workspace → verify no duplicate identity created
4. Test @mention search → verify actors found
5. Verify avatar URLs display correctly in UI

## Performance Considerations

**Index Strategy:**
- `(clerkOrgId, source, sourceId)` - Unique identity lookup
- `(clerkOrgId, canonicalActorId)` - Find identities by actor
- `(clerkOrgId, clerkUserId)` - Clerk user → actor lookup
- `(clerkOrgId, sourceUsername)` - @mention search

**Query Performance:**
- @mention search now scans fewer records (one per actor per org, not per workspace)
- Clerk user lookup is O(1) via index
- Profile queries unchanged (still workspace-scoped)

## Migration Notes

Since the system is pre-production:
1. No data migration scripts needed
2. Simply create new table, update code, then drop old table
3. Any test data can be regenerated via webhooks

## References

- Original research: `thoughts/shared/research/2025-12-16-actor-identity-scope-analysis.md`
- Previous design: `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md`
- Identity resolution: `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md`
