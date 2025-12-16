---
date: 2025-12-16T08:52:42Z
researcher: Claude
git_commit: 93499d530d221af22f6bdf914bbb7c7654359b62
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Actor Identity Scope Analysis: Workspace vs Organization Level"
tags: [research, codebase, actor-identity, architecture, database-design]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
last_updated_note: "Updated with long-term best practice recommendation: org-level identities"
---

# Research: Actor Identity Scope Analysis - Workspace vs Organization Level

**Date**: 2025-12-16T08:52:42Z
**Researcher**: Claude
**Git Commit**: 93499d530d221af22f6bdf914bbb7c7654359b62
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Should the `workspaceActorIdentities` table be scoped at the organization level instead of the workspace level? What are the trade-offs of the current workspace-scoped design?

## Summary

**Long-term best practice: Identity at organization level, activity at workspace level.**

The current workspace-scoped design conflates two different data types:
- **Identity mapping** (who is who) - invariant within an org, should be org-scoped
- **Activity tracking** (what they did) - workspace-specific, correctly workspace-scoped

The table should be renamed to `orgActorIdentities` and scoped to `clerkOrgId`. This aligns with domain semantics, Clerk's model, industry patterns, and future feature requirements.

---

## The Fundamental Question

What is the **natural scope** of each piece of data?

| Data | Nature | Natural Scope |
|------|--------|---------------|
| "github:12345678 is octocat" | Fact about the world | **Organization** (or global) |
| "octocat made 50 commits in workspace X" | Activity in a context | **Workspace** |
| "Clerk user_abc is github:12345678" | Auth linking | **Organization** |

The current design conflates these by putting everything at workspace level.

---

## Current Architecture (Problematic)

### What's Happening Now

```
workspace_id  | source | source_id | canonical_actor_id | source_username
--------------|--------|-----------|--------------------|-----------------
ws_prod       | github | 12345678  | github:12345678    | octocat
ws_staging    | github | 12345678  | github:12345678    | octocat  ← DUPLICATE
ws_dev        | github | 12345678  | github:12345678    | octocat  ← DUPLICATE
```

The same identity mapping is duplicated across every workspace. This data is **invariant within an org** - octocat in workspace A is the same person as octocat in workspace B.

### Current Schema

```
orgWorkspaces (workspaceId, clerkOrgId)
    │
    ├── workspaceActorIdentities (workspaceId FK)  ← WRONG SCOPE
    └── workspaceActorProfiles (workspaceId FK)    ← CORRECT SCOPE
```

---

## Domain Modeling Analysis

### Identity vs Activity

**Identity** answers: "Who is this external actor?"
- GitHub user 12345678 → username "octocat"
- This is **invariant within an org**
- Never changes based on workspace context

**Activity** answers: "What did this actor do here?"
- Observation count, last active timestamp
- This is **inherently workspace-specific**

**The current design stores both at workspace level, but only activity needs to be there.**

---

## Long-Term Implications

### 1. Clerk User Linking

**Current (workspace-level)**:
```
User signs in with GitHub OAuth
→ Access workspace A → lazy link clerkUserId to profile A
→ Access workspace B → lazy link clerkUserId to profile B
→ Access workspace C → lazy link clerkUserId to profile C
```

**Org-level**:
```
User signs in with GitHub OAuth
→ Link clerkUserId to identity once
→ All workspaces automatically know this user
```

This is a **significant UX improvement**. The first workspace access shouldn't be special.

### 2. Future: Lightfast Usernames

The existing docs mention Lightfast usernames as a deferred feature:

```
orgActorIdentities:
│ source      │ sourceUsername │ canonicalActorId    │
├─────────────┼────────────────┼─────────────────────┤
│ github      │ octocat        │ github:12345678     │
│ lightfast   │ john-doe       │ github:12345678     │  ← future
```

If Lightfast usernames are **org-level** (which they should be - your Lightfast username shouldn't change per workspace), then the identity table must also be org-level.

### 3. Cross-Workspace Features

Future features that become easier with org-level identity:
- "Show all of octocat's activity across the org"
- "Assign octocat as maintainer for all production workspaces"
- "Notify octocat about issues in any workspace they've contributed to"

With workspace-level identity, these require deduplication logic. With org-level, they're natural queries.

### 4. Username Changes

When a GitHub user changes their username:
- **Current**: Update N identity records (one per workspace)
- **Org-level**: Update 1 identity record

### 5. @mention Search

Current query:
```sql
SELECT * FROM workspaceActorIdentities
WHERE workspaceId = ? AND sourceUsername ILIKE ?
```

Org-level query:
```sql
SELECT * FROM orgActorIdentities
WHERE clerkOrgId = ? AND sourceUsername ILIKE ?
```

**Same complexity, fewer records to scan, better index utilization.**

---

## Industry Patterns

| Product | Identity Scope | Activity Scope |
|---------|---------------|----------------|
| **GitHub** | Global (user ID) | Repository (contributions) |
| **Linear** | Organization | Team/Project |
| **Notion** | Workspace → moving to account | Page/Database |
| **Slack** | Workspace (problematic) | Channel |

GitHub's model is instructive: your identity is global, your contributions are scoped to where you made them. Lightfast should follow this pattern: **identity at org, activity at workspace**.

---

## Recommended Schema (Long-Term Best Practice)

```
┌─────────────────────────────────────────────────────────────────┐
│ Clerk Organization (clerkOrgId)                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ orgActorIdentities                                      │   │
│   │   clerkOrgId (scope)                                    │   │
│   │   canonicalActorId ("github:12345678")                  │   │
│   │   source ("github" | "vercel" | "lightfast")            │   │
│   │   sourceId (numeric ID or username)                     │   │
│   │   sourceUsername (for @mention search)                  │   │
│   │   clerkUserId (nullable - linked auth user)             │   │
│   │   UNIQUE(clerkOrgId, source, sourceId)                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ canonicalActorId (logical ref)   │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ orgWorkspaces                                           │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │ workspaceActorProfiles                          │   │   │
│   │   │   workspaceId (scope)                           │   │   │
│   │   │   actorId (refs canonicalActorId)               │   │   │
│   │   │   displayName                                   │   │   │
│   │   │   observationCount                              │   │   │
│   │   │   lastActiveAt                                  │   │   │
│   │   │   profileConfidence                             │   │   │
│   │   │   UNIQUE(workspaceId, actorId)                  │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Field Migration

| Field | Current Location | Should Be | Reason |
|-------|------------------|-----------|--------|
| `clerkUserId` | Profile | **Identity** | Auth linking is org-level |
| `sourceUsername` | Identity | Identity | Already correct |
| `sourceEmail` | Identity | Identity | Already correct |
| `avatarUrl` | Profile | **Identity** | Avatar is identity, not activity |
| `observationCount` | Profile | Profile | Workspace-specific activity |
| `lastActiveAt` | Profile | Profile | Workspace-specific activity |
| `profileConfidence` | Profile | Profile | Workspace-specific calculation |
| `displayName` | Profile | Profile | Allows workspace-specific display if needed |

### Proposed Table Definitions

**orgActorIdentities** (NEW - replaces workspaceActorIdentities):
```typescript
export const orgActorIdentities = pgTable(
  "lightfast_org_actor_identities",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    // Org scope (not workspace!)
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    // Canonical actor ID (format: "source:sourceId")
    canonicalActorId: varchar("canonical_actor_id", { length: 191 }).notNull(),

    // Source identity
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUsername: varchar("source_username", { length: 255 }),
    sourceEmail: varchar("source_email", { length: 255 }),
    avatarUrl: text("avatar_url"),

    // Clerk user linking (org-level, not workspace!)
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

    // Mapping metadata
    mappingMethod: varchar("mapping_method", { length: 50 }).notNull(),
    confidenceScore: real("confidence_score").notNull(),
    mappedAt: timestamp("mapped_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique identity per org
    uniqueIdentityIdx: uniqueIndex("org_actor_identity_unique_idx").on(
      table.clerkOrgId,
      table.source,
      table.sourceId,
    ),

    // Find identities by canonical actor ID
    canonicalActorIdx: index("org_actor_identity_canonical_idx").on(
      table.clerkOrgId,
      table.canonicalActorId,
    ),

    // Clerk user lookup (org-level)
    clerkUserIdx: index("org_actor_identity_clerk_user_idx").on(
      table.clerkOrgId,
      table.clerkUserId,
    ),

    // @mention search by username
    usernameIdx: index("org_actor_identity_username_idx").on(
      table.clerkOrgId,
      table.sourceUsername,
    ),
  }),
);
```

**workspaceActorProfiles** (SIMPLIFIED - activity only):
```typescript
export const workspaceActorProfiles = pgTable(
  "lightfast_workspace_actor_profiles",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Links to orgActorIdentities.canonicalActorId (logical, not FK)
    actorId: varchar("actor_id", { length: 191 }).notNull(),

    // Display (can be workspace-specific if needed)
    displayName: varchar("display_name", { length: 255 }).notNull(),

    // Activity metrics (workspace-specific)
    observationCount: integer("observation_count").notNull().default(0),
    lastActiveAt: timestamp("last_active_at", { mode: "string", withTimezone: true }),
    profileConfidence: real("profile_confidence"),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("actor_profile_external_id_idx").on(table.externalId),
    uniqueActorIdx: uniqueIndex("actor_profile_unique_idx").on(
      table.workspaceId,
      table.actorId,
    ),
    workspaceIdx: index("actor_profile_workspace_idx").on(table.workspaceId),
    lastActiveIdx: index("actor_profile_last_active_idx").on(
      table.workspaceId,
      table.lastActiveAt,
    ),
  }),
);
```

---

## Migration Path

Since the system is not in production, this is the ideal time for this change:

### Phase 1: Create New Table
1. Create `orgActorIdentities` table with `clerkOrgId` scope
2. Add indexes for @mention search and Clerk user lookup

### Phase 2: Update Actor Resolution
1. Modify `actor-resolution.ts` to write org-level identities
2. Query by `clerkOrgId` instead of `workspaceId`
3. Update identity cache lookups

### Phase 3: Update @mention Search
1. Modify `actor-search.ts` to query org-level identities
2. Join with workspace profiles for activity data

### Phase 4: Update Clerk Linking
1. Move `clerkUserId` from profiles to identities
2. Update `ensureActorLinked()` to link at org level
3. Remove per-workspace lazy linking

### Phase 5: Simplify Profiles
1. Remove `clerkUserId` from profiles (now in identities)
2. Remove `avatarUrl` from profiles (now in identities)
3. Keep `email` in profiles or move to identities (TBD)

### Phase 6: Cleanup
1. Drop old `workspaceActorIdentities` table
2. Update Drizzle relations
3. Update types and exports

---

## Code References

### Files to Modify

| File | Changes |
|------|---------|
| `db/console/src/schema/tables/workspace-actor-identities.ts` | Rename to `org-actor-identities.ts`, change scope to `clerkOrgId` |
| `db/console/src/schema/tables/workspace-actor-profiles.ts` | Remove `clerkUserId`, `avatarUrl` |
| `db/console/src/schema/relations.ts` | Update relations for new table |
| `api/console/src/inngest/workflow/neural/actor-resolution.ts` | Query/write org-level identities |
| `api/console/src/inngest/workflow/neural/profile-update.ts` | Separate identity vs profile updates |
| `api/console/src/lib/actor-linking.ts` | Link at org level |
| `apps/console/src/lib/neural/actor-search.ts` | Query org-level identities |

### Current Schema Locations
- `db/console/src/schema/tables/workspace-actor-identities.ts:64-112` - Current identity table
- `db/console/src/schema/tables/workspace-actor-profiles.ts:80-159` - Current profile table
- `db/console/src/schema/tables/org-workspaces.ts:35-121` - Workspace table with `clerkOrgId`

---

## Historical Context (from thoughts/)

### Why Current Design Exists

The original design (`2025-12-15-actor-implementation-end-to-end-design.md`, Decision 5) chose workspace-scoped profiles for:
1. Privacy between organizations
2. Isolation consistency
3. Simplicity

**However**, this conflated identity (org-invariant) with activity (workspace-specific). The privacy and isolation arguments apply to **activity data**, not **identity mapping**.

### Related Documents
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` - Original design decisions
- `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md` - Identity resolution architecture
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Database design context

---

## Conclusion

**Rename `workspaceActorIdentities` → `orgActorIdentities` and scope to `clerkOrgId`.**

The current design chose "consistency" (everything workspace-scoped) over "correctness" (scope matches data semantics). For a pre-production system, correctness should win.

Reasons:
1. **Domain truth**: Identity mapping is an organizational fact, not a workspace fact
2. **Normalization**: Eliminates duplication without query complexity overhead
3. **Clerk alignment**: Matches Clerk's org-level user management model
4. **Future-proof**: Better supports Lightfast usernames, cross-workspace analytics, team management
5. **Simpler linking**: Clerk user linking happens once per org, not per workspace
6. **Industry alignment**: Follows patterns from GitHub, Linear where identity is high-scope

---

## Open Questions

1. **Should `displayName` move to identities?** Could allow org-wide display name, but workspace-specific display might be useful for enterprise scenarios.

2. **Should `email` move to identities?** Email is identity, not activity. But it's also rarely used (only from push events). Consider moving or removing.

3. **Foreign key to identities?** Currently `actorId` in profiles is a logical reference to `canonicalActorId` in identities. Should this be a proper FK? Adds referential integrity but requires identity to exist before profile.
