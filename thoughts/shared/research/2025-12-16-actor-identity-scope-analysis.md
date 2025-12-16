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

The current workspace-scoped design for actor identities and profiles is **intentional and documented**. The existing research (`2025-12-15-actor-implementation-end-to-end-design.md`, Decision 5) explicitly chose workspace-scoped profiles for isolation, privacy, and simplicity. While identity mapping (who is who) could theoretically be org-level since it's the same mapping everywhere, keeping both tables at workspace level provides consistency, simplicity, and better isolation between workspaces.

---

## Current Architecture

### Hierarchy

```
Clerk Organization (external, not in DB)
    │
    └── orgWorkspaces (table)
            clerkOrgId: "org_abc123"
            │
            ├── Workspace: production
            │       ├── workspaceActorProfiles (activity metrics)
            │       └── workspaceActorIdentities (identity mapping)
            │
            └── Workspace: staging
                    ├── workspaceActorProfiles (separate activity metrics)
                    └── workspaceActorIdentities (separate identity mapping)
```

### Two Tables, Two Purposes

| Table | Purpose | Data Type |
|-------|---------|-----------|
| `workspaceActorIdentities` | Maps external identities → canonical actor ID | Identity mapping (who is who) |
| `workspaceActorProfiles` | Stores profile + activity metrics per actor | Activity tracking (what they did) |

### Current Unique Constraints

**workspaceActorIdentities** (`db/console/src/schema/tables/workspace-actor-identities.ts:100-104`):
```typescript
uniqueIdentityIdx: uniqueIndex("actor_identity_unique_idx").on(
  table.workspaceId,
  table.source,
  table.sourceId,
)
```

**workspaceActorProfiles** (`db/console/src/schema/tables/workspace-actor-profiles.ts:139-142`):
```typescript
uniqueActorIdx: uniqueIndex("actor_profile_unique_idx").on(
  table.workspaceId,
  table.actorId,
)
```

---

## Analysis: What Each Table Stores

### Identity Mapping (workspaceActorIdentities)

This table answers: **"Who is github:12345678?"**

Example records:
```
workspace_id | source   | source_id  | canonical_actor_id | source_username
-------------|----------|------------|--------------------|-----------------
ws_prod      | github   | 12345678   | github:12345678    | octocat
ws_staging   | github   | 12345678   | github:12345678    | octocat  ← DUPLICATE
```

**Observation**: The same mapping (`github:12345678 = octocat`) is repeated across workspaces. This is identical data.

### Activity Tracking (workspaceActorProfiles)

This table answers: **"What did github:12345678 do in this workspace?"**

Example records:
```
workspace_id | actor_id        | display_name | observation_count | last_active_at
-------------|-----------------|--------------|-------------------|----------------
ws_prod      | github:12345678 | octocat      | 50                | 2025-12-16
ws_staging   | github:12345678 | octocat      | 10                | 2025-12-10  ← DIFFERENT
```

**Observation**: Activity metrics are inherently workspace-specific. A person has different activity levels in different workspaces.

---

## Arguments For Organization-Level Identities

### Potential Benefits

1. **No Duplication**: Identity mapping would be stored once per org instead of per workspace
2. **Simpler Clerk Linking**: Link `clerkUserId` once at org level, not per workspace
3. **Consistent @mention Resolution**: `@octocat` resolves the same way across all workspaces in an org

### What Org-Level Would Look Like

```
Clerk Organization (org_abc123)
    │
    └── orgActorIdentities (NEW - org-scoped)
            source: "github", source_id: "12345678", canonical_actor_id: "github:12345678"
            │
            └── orgWorkspaces
                    ├── Workspace: production
                    │       └── workspaceActorProfiles (activity only)
                    │
                    └── Workspace: staging
                            └── workspaceActorProfiles (activity only)
```

---

## Arguments Against (Why Current Design Was Chosen)

### Documented Decision

From `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md`, Decision 5:

> **Decision 5: Workspace-Scoped Actor Profiles (No Change)**
>
> **Current Architecture**: Same person gets separate profiles per workspace.
>
> **Why This Is Correct**:
> 1. **Privacy**: Organizations shouldn't see activity from other organizations
> 2. **Isolation**: Workspace data should be completely independent
> 3. **Consistency**: Matches Pinecone namespace isolation pattern
> 4. **Simplicity**: No cross-org identity linking complexity

### Technical Reasons

1. **Query Simplicity**: All workspace queries stay in workspace scope
   - Current: `WHERE workspaceId = ?` on both tables
   - Org-level: Join across org and workspace scopes

2. **Isolation Consistency**: Every workspace resource references `workspaceId`
   - Documents, observations, clusters all use `workspaceId` FK
   - Actor tables follow the same pattern

3. **Multi-Org Users**: Same person in multiple orgs works naturally
   ```
   Org A: actor profile for github:12345678 (workspace A1)
   Org B: actor profile for github:12345678 (workspace B1)
   ```
   - No cross-org identity complexity
   - Each org is fully isolated

4. **Cascade Delete**: Workspace deletion cleanly removes all related data
   - Both tables use `onDelete: "cascade"` referencing `orgWorkspaces.id`

5. **Future Flexibility**: Different workspaces might have different integration contexts
   - Workspace A connected to GitHub repo X
   - Workspace B connected to GitHub repo Y
   - Same person might have different usernames/activity in each context

### Multi-Org User Scenario (from design doc)

```
User: alice@example.com (Clerk ID: user_alice)

Org A (acme-corp):
  Workspace: production
    Actor Profile:
      actorId: "github:12345"
      clerkUserId: "user_alice"
      observationCount: 50

Org B (startup-inc):
  Workspace: main
    Actor Profile:
      actorId: "github:12345"  (same GitHub user!)
      clerkUserId: "user_alice"
      observationCount: 10
```

**Both profiles are separate, but both resolve to the same Clerk user.**

---

## Cost-Benefit Analysis

### If We Moved Identities to Org Level

| Benefit | Cost |
|---------|------|
| Less duplication of identity mappings | Schema migration required |
| Simpler Clerk user linking | Query complexity increases (join across scopes) |
| | Breaks consistency with other workspace-scoped tables |
| | Less isolation between workspaces |
| | More complex cascade delete logic |

### Keeping Current Design

| Benefit | Cost |
|---------|------|
| Simple, consistent scoping | Some identity data duplication |
| Clean isolation | Clerk linking per-workspace |
| Easy cascade delete | |
| Query simplicity | |
| Follows existing patterns | |

---

## Conclusion

The current workspace-scoped design is **intentional and correct** for this codebase. The minor duplication of identity mappings across workspaces is an acceptable trade-off for:

1. **Consistency**: All workspace resources follow the same scoping pattern
2. **Simplicity**: No cross-scope joins or complex cascade logic
3. **Isolation**: Complete workspace independence
4. **Future-proofing**: Flexibility for workspace-specific integration contexts

### When Org-Level Would Make Sense

Org-level identities would be more appropriate if:
- The product model emphasized org-wide identity management (like Slack)
- Workspaces shared significant data across boundaries
- @mention resolution needed to work across workspaces
- The overhead of duplicate identity records became significant (thousands per workspace)

None of these conditions currently apply to Lightfast.

---

## Code References

### Schema Definitions
- `db/console/src/schema/tables/workspace-actor-identities.ts:64-112` - Identity table schema
- `db/console/src/schema/tables/workspace-actor-profiles.ts:80-159` - Profile table schema
- `db/console/src/schema/tables/org-workspaces.ts:35-121` - Workspace table schema

### Usage Patterns
- `apps/console/src/lib/neural/actor-search.ts:41-140` - @mention search (workspace-scoped)
- `api/console/src/lib/actor-linking.ts:30-63` - Clerk user linking (workspace-scoped)
- `api/console/src/inngest/workflow/neural/profile-update.ts:100-148` - Profile upsert (workspace-scoped)

### Drizzle Relations
- `db/console/src/schema/relations.ts:98-118` - Both tables relate to workspaces

---

## Historical Context (from thoughts/)

### Key Documents
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` - Original design decisions (Decision 5)
- `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md` - Identity resolution architecture
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Database design context

### Design Decision Trail
1. Original architecture chose workspace isolation for Pinecone namespaces
2. Actor tables followed the same pattern for consistency
3. Design explicitly considered and rejected org-level for simplicity

---

## Open Questions

None - the design rationale is well-documented and the current implementation is intentional.
