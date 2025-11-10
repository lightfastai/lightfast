---
title: User Onboarding Flow Architecture (Phase 1)
description: Complete architecture for user onboarding, organizations, workspaces, repositories, and lightfast.yml configuration
status: proposed
owner: product + engineering
audience: engineering
last_updated: 2025-11-07
tags: [onboarding, architecture, phase1, dx]
---

# User Onboarding Flow Architecture

Complete architectural specification for user onboarding in the Lightfast Console, defining the relationship between organizations, workspaces, repositories, and the `lightfast.yml` configuration system.

---

## Executive Summary

**Recommended Approach:** Organization-scoped with implicit workspace resolution

- **One GitHub Organization = One Lightfast Organization = One Workspace** (Phase 1 simplification)
- **Workspace resolution:** Auto-resolved from organization (no user input needed)
- **Repository connection:** Multiple repos can be connected to the organization/workspace
- **lightfast.yml:** Defines stores (datasets) within the workspace, workspace ID optional
- **User journey:** Sign up → Connect GitHub → Claim Organization → Connect Repositories → Automatic ingestion
- **Time to value:** < 5 minutes from repo to searchable docs

---

## 1. Entity Relationships

### 1.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLERK AUTH LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  User (Clerk)                    Organization (Clerk)            │
│  - userId                        - clerkOrgId                    │
│  - email                         - clerkOrgSlug                  │
│  - identities                    - members[]                     │
│                                  - roles[]                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ links to
┌─────────────────────────────────────────────────────────────────┐
│                    LIGHTFAST APPLICATION LAYER                   │
├─────────────────────────────────────────────────────────────────┤
│  Organization (Lightfast)                                        │
│  - id (uuid)                                                     │
│  - githubOrgId (unique, immutable)    ←─────┐                  │
│  - githubInstallationId                      │                  │
│  - githubOrgSlug                             │                  │
│  - githubOrgName                             │                  │
│  - clerkOrgId (unique) ──────────────────────┘                  │
│  - clerkOrgSlug                                                  │
│  - claimedBy (userId)                                            │
│                                                                   │
│  Workspace (Implicit - Phase 1)                                  │
│  - workspaceId = `ws_${githubOrgSlug}`                          │
│  - Derived from organization, not stored                         │
│                                                                   │
│  ConnectedRepository                                             │
│  - id (uuid)                                                     │
│  - organizationId (fk)                                           │
│  - githubRepoId (unique, immutable)                             │
│  - githubInstallationId                                          │
│  - isActive                                                      │
│  - permissions (json)                                            │
│  - metadata (json cache)                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ defines
┌─────────────────────────────────────────────────────────────────┐
│                         DATA/INGESTION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│  Store (lf_stores - Postgres)                                    │
│  - id (uuid)                                                     │
│  - workspaceId (varchar)                                         │
│  - name (varchar) - e.g., "docs-site"                           │
│  - indexName (varchar) - Pinecone namespace                     │
│  - embeddingDim (int)                                            │
│                                                                   │
│  Document (lf_docs_documents)                                    │
│  - id (uuid)                                                     │
│  - storeId (fk)                                                  │
│  - path (repo-relative)                                          │
│  - slug, title, description                                      │
│  - contentHash, commitSha                                        │
│                                                                   │
│  VectorEntry (lf_vector_entries)                                 │
│  - id (vectorId)                                                 │
│  - storeId (fk)                                                  │
│  - docId (fk)                                                    │
│  - chunkIndex                                                    │
│  - indexName (Pinecone)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Relationship Cardinality

```
User (Clerk) ────< Membership >──── Organization (Clerk)
                                           │
                                           │ 1:1 link
                                           ↓
                              Organization (Lightfast)
                                           │
                                           │ 1:1 implicit
                                           ↓
                                    Workspace (virtual)
                                           │
                                           ├── 1:N ──→ ConnectedRepository
                                           ├── 1:N ──→ Store
                                           │
                                           └── Shared namespace for retrieval
```

**Key Design Decisions:**

1. **Organization = Workspace (Phase 1):** Simplification to ship faster. Each organization gets exactly one workspace.
2. **Clerk as source of truth:** User management and organization membership handled by Clerk.
3. **GitHub as identity anchor:** GitHub organization ID is immutable and canonical.
4. **Repositories are organization-scoped:** Multiple repos can be connected to one org/workspace.
5. **Stores are workspace-scoped:** Each lightfast.yml defines stores within the workspace.
6. **Per-repository configuration:** Each repository has its own lightfast.yml that defines stores and file patterns for that repo only.
7. **Workspace resolution is automatic:** Workspace ID is computed as `ws_${githubOrgSlug}` at runtime (no user input needed).
8. **Multiple repos, same workspace:** Different repositories can have different configs but all index to the same workspace.

---

## 2. User Onboarding Flow

### 2.1 Complete User Journey

```
┌─────────────┐
│  STEP 1:    │
│  Sign Up    │  User creates account with Clerk (email or GitHub SSO)
└──────┬──────┘  Session state: AUTHENTICATED (no active org)
       │
       ↓
┌─────────────┐
│  STEP 2:    │
│  Connect    │  User authorizes GitHub App OAuth
│  GitHub     │  Backend stores user access token (cookie)
└──────┬──────┘  Can fetch user's installations
       │
       ↓
┌─────────────┐
│  STEP 3:    │
│  Claim      │  User selects a GitHub organization/installation
│  Org        │  Backend:
└──────┬──────┘  1. Creates Clerk organization (if new)
       │         2. Creates Lightfast organization record
       │         3. Links Clerk ↔ Lightfast via clerkOrgId
       │         4. Sets user as org admin (via Clerk)
       │         5. Activates Clerk session with org
       ↓
┌─────────────┐
│  STEP 4:    │
│  Dashboard  │  User lands on /org/[slug]/settings
│             │  Sees "Connect Repositories" prompt
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  STEP 5:    │
│  Connect    │  User selects repositories to enable
│  Repos      │  Backend:
└──────┬──────┘  1. Creates ConnectedRepository records
       │         2. Checks for lightfast.yml in each repo
       │         3. Shows status (configured/not configured)
       ↓
┌─────────────┐
│  STEP 6:    │
│  Configure  │  For repos without lightfast.yml:
│  (Optional) │  - Show setup wizard (UI or commit to repo)
└──────┬──────┘  - Generate sample lightfast.yml
       │         - Guide user through glob patterns
       ↓
┌─────────────┐
│  STEP 7:    │
│  First      │  On next push to main (or manual trigger):
│  Ingestion  │  1. Webhook receives push event
└──────┬──────┘  2. Fetches lightfast.yml from repo
       │         3. Triggers Inngest workflow
       │         4. Processes matching files
       │         5. Indexes to Pinecone
       ↓
┌─────────────┐
│  DONE!      │
│  Search     │  User can search docs via Console or apps/docs
│  Ready      │  Time elapsed: < 5 minutes 🎉
└─────────────┘
```

### 2.2 Step-by-Step Implementation Details

#### Step 1: Sign Up

**URL:** `/sign-up`

**Flow:**
1. User fills in email or clicks "Continue with GitHub"
2. Clerk handles authentication
3. User is redirected to `/onboarding`

**Session State:** Clerk session is AUTHENTICATED but no active organization (pending state)

**Database Changes:** None (Clerk-only)

**Code:** `apps/console/src/app/(auth)/sign-up/page.tsx`

---

#### Step 2: Connect GitHub

**URL:** `/onboarding/connect-github`

**Flow:**
1. User clicks "Connect GitHub"
2. Redirects to `/api/github/auth?callback=/onboarding/claim-org`
3. GitHub OAuth flow:
   - User authorizes app
   - GitHub redirects to `/api/github/callback`
   - Backend exchanges code for user access token
   - Stores token in httpOnly cookie (`github_user_token`)
4. Redirects to `/onboarding/claim-org`

**Session State:** Still AUTHENTICATED (pending org)

**Database Changes:** None

**Code:**
- `apps/console/src/app/(onboarding)/onboarding/connect-github/page.tsx`
- `apps/console/src/app/(github)/api/github/auth/route.ts`
- `apps/console/src/app/(github)/api/github/callback/route.ts`

---

#### Step 3: Claim Organization

**URL:** `/onboarding/claim-org`

**Flow:**
1. Frontend fetches user's installations: `GET /api/github/installations`
   - Uses `github_user_token` cookie
   - Returns list of GitHub orgs/accounts with app installed
2. User selects an organization/installation
3. Frontend calls `POST /api/organizations/claim` with `installationId`
4. Backend logic (NEW ORGANIZATION):
   ```typescript
   // 1. Verify user has access to this installation
   const installation = await getUserInstallations(userToken);

   // 2. Create Clerk organization (user becomes admin)
   const clerkOrg = await clerk.organizations.createOrganization({
     name: githubOrgName,
     slug: githubOrgSlug,
     createdBy: userId
   });

   // 3. Create Lightfast organization record
   const lightfastOrg = await db.insert(organizations).values({
     githubOrgId: installation.account.id,
     githubInstallationId: installation.id,
     githubOrgSlug: installation.account.slug,
     githubOrgName: installation.account.name,
     clerkOrgId: clerkOrg.id,
     clerkOrgSlug: clerkOrg.slug,
     claimedBy: userId
   });

   // 4. Set as active organization in Clerk session
   await clerk.setActive({ organization: clerkOrg.slug });
   ```

5. Backend logic (EXISTING ORGANIZATION - team member joins):
   ```typescript
   // 1. Verify GitHub membership and get role
   const membership = await getOrganizationMembership(
     userToken,
     githubOrgSlug,
     githubUsername
   );

   // 2. Add user to existing Clerk organization
   await clerk.organizations.createOrganizationMembership({
     organizationId: existingOrg.clerkOrgId,
     userId: userId,
     role: membership.role === 'admin' ? 'org:admin' : 'org:member'
   });

   // 3. Set as active organization
   await clerk.setActive({ organization: existingOrg.clerkOrgSlug });
   ```

6. Redirect to `/org/[clerkOrgSlug]/settings`

**Session State:** Clerk session now ACTIVE with organization

**Database Changes:**
- **New org:** Creates `organizations` row
- **Existing org:** No changes (membership is in Clerk)

**Code:**
- `apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx`
- `apps/console/src/app/(github)/api/organizations/claim/route.ts`
- `packages/console-api-services/src/organizations.ts`

---

#### Step 4: Dashboard Landing

**URL:** `/org/[slug]/settings` or `/org/[slug]/settings/repositories`

**UI:**
```
┌────────────────────────────────────────────────────┐
│  Welcome to [Organization Name]                    │
├────────────────────────────────────────────────────┤
│                                                     │
│  📦 Connected Repositories: 0                      │
│                                                     │
│  Get started by connecting a repository:           │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  🔗 Connect Repository                       │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  or install the GitHub App on more organizations:  │
│  🔗 Install GitHub App                             │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Code:** `apps/console/src/app/(app)/org/[slug]/settings/repositories/page.tsx` (needs creation)

---

#### Step 5: Connect Repositories

**URL:** `/org/[slug]/settings/repositories/connect`

**Flow:**
1. Frontend fetches available repositories: `GET /api/github/repositories?githubOrgId=[id]`
   - Uses GitHub App installation ID to fetch repos
   - Returns list of repositories user has access to
2. Shows list with checkboxes
3. For each selected repository:
   ```typescript
   POST /api/repositories/connect
   {
     organizationId: clerkOrgId,
     githubRepoId: repo.id,
     githubInstallationId: installation.id,
     permissions: { admin: true, push: true, pull: true },
     metadata: {
       fullName: repo.full_name,
       defaultBranch: repo.default_branch
     }
   }
   ```
4. Backend checks if `lightfast.yml` exists at repo root:
   ```typescript
   const hasConfig = await checkLightfastConfig(
     githubRepoId,
     installationId
   );
   ```
5. Shows status for each repo:
   - ✅ Connected + Configured
   - ⚠️ Connected (no lightfast.yml) - show setup wizard link

**Database Changes:**
- Creates `DeusConnectedRepository` rows (one per repo)

**Code:**
- `apps/console/src/app/(app)/org/[slug]/settings/repositories/connect/page.tsx` (needs creation)
- Uses existing `api/console/src/router/repository.ts`

---

#### Step 6: Configuration (Optional)

**Scenario A: lightfast.yml exists in repo**
- No action needed
- Shows preview of configuration
- User can edit via GitHub (we show link)

**Scenario B: lightfast.yml missing**

**Option 1: Setup Wizard (Recommended UX)**
```
┌────────────────────────────────────────────────────┐
│  Configure [repo-name]                             │
├────────────────────────────────────────────────────┤
│                                                     │
│  1. Store Name                                     │
│     ┌────────────────────────────────────────┐    │
│     │ docs-site                              │    │
│     └────────────────────────────────────────┘    │
│                                                     │
│  2. What should we index?                          │
│     ☑ Documentation files (*.md, *.mdx)           │
│     ☐ README files                                │
│     ☐ API documentation                           │
│                                                     │
│  3. Where are your docs? (optional)                │
│     ┌────────────────────────────────────────┐    │
│     │ docs/**/*.md                           │    │
│     └────────────────────────────────────────┘    │
│     ┌────────────────────────────────────────┐    │
│     │ apps/docs/content/**/*.mdx             │    │
│     └────────────────────────────────────────┘    │
│     + Add path                                     │
│                                                     │
│  Preview:                                          │
│  Found 47 matching files in main branch           │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Generate lightfast.yml                      │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
└────────────────────────────────────────────────────┘
```

Backend generates config and commits to repo:
```typescript
// Use GitHub App to create PR with lightfast.yml
await createConfigPullRequest({
  repoId: githubRepoId,
  installationId: githubInstallationId,
  config: {
    version: 1,
    store: storeName,
    include: globs
  }
});
```

**Option 2: Manual (for advanced users)**
- Show sample `lightfast.yml`
- User copies and commits manually
- We detect it on next push

**Sample lightfast.yml:**
```yaml
version: 1
store: docs-site
include:
  - docs/**/*.md
  - apps/docs/content/**/*.mdx
```

---

#### Step 7: First Ingestion

**Trigger:** Push to default branch OR manual trigger button

**Webhook Flow:**
1. GitHub sends push event to `/api/github/webhooks`
2. Webhook handler:
   ```typescript
   // 1. Verify it's push to default branch
   if (branch !== repo.default_branch) return;

   // 2. Fetch lightfast.yml from repo
   const config = await fetchLightfastConfig(
     githubRepoId,
     installationId,
     afterSha
   );

   if (!config) {
     console.log('No lightfast.yml found, skipping');
     return;
   }

   // 3. Filter changed files against globs
   const matchedFiles = filterFilesByGlobs(
     changedFiles,
     config.include
   );

   // 4. Resolve workspace from organization
   const org = await getOrgByGithubInstallation(installationId);
   const workspaceId = `ws_${org.githubOrgSlug}`;

   // 5. Trigger Inngest workflow
   await inngest.send({
     name: 'apps-console/docs.push',
     data: {
       workspaceId,
       storeName: config.store,
       beforeSha,
       afterSha,
       deliveryId,
       changedFiles: matchedFiles
     }
   });
   ```

3. Inngest workflow (`docs-ingestion`):
   - For each file: fetch content, parse frontmatter, chunk, embed
   - Upsert to PlanetScale + Pinecone
   - Track progress in `lf_ingestion_commits`

4. Show progress in UI (via polling or websocket)

**Database Changes:**
- Creates/updates `lf_stores` row
- Creates/updates `lf_docs_documents` rows
- Creates `lf_vector_entries` rows
- Creates `lf_ingestion_commits` row

**Code:**
- `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- `api/console/src/inngest/workflow/docs-ingestion.ts`

---

## 3. Database Schema Requirements

### 3.1 Existing Schemas (Keep As-Is)

✅ **lf_stores** (Postgres)
- Already supports workspace-scoped stores
- `workspaceId` will be auto-populated from organization

✅ **lf_docs_documents** (Postgres)
- Already supports document tracking per store

✅ **lf_vector_entries** (Postgres)
- Already supports chunk → vector mapping

✅ **lf_ingestion_commits** (Postgres)
- Already supports idempotent ingestion tracking

✅ **lightfast_deus_organizations** (MySQL)
- Already supports GitHub ↔ Clerk org mapping
- Has all required fields

✅ **lightfast_deus_connected_repository** (MySQL)
- Already supports repository connections
- Has organization FK

### 3.2 Required Schema Changes

**NONE for Phase 1!** 🎉

The existing schemas already support the recommended architecture. We just need to:

1. **Use existing tables:** No new migrations needed
2. **Workspace resolution:** Compute `workspaceId = ws_${githubOrgSlug}` at runtime
3. **Update webhook handler:** Fetch `lightfast.yml` and resolve workspace before triggering ingestion
4. **Update Inngest workflow:** Accept workspace from webhook instead of hardcoding

### 3.3 Phase 2 Schema Additions (Future)

When we need multi-workspace support per organization:

```sql
-- NEW: Explicit workspace table
CREATE TABLE lightfast_workspaces (
  id VARCHAR(191) PRIMARY KEY,
  organization_id VARCHAR(191) NOT NULL,  -- FK to organizations
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_org_slug (organization_id, slug),
  INDEX idx_org (organization_id)
);

-- NEW: Repository → Workspace mapping
CREATE TABLE lightfast_repository_workspaces (
  id VARCHAR(191) PRIMARY KEY,
  repository_id VARCHAR(191) NOT NULL,  -- FK to connected_repository
  workspace_id VARCHAR(191) NOT NULL,    -- FK to workspaces
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_repo_workspace (repository_id, workspace_id),
  INDEX idx_workspace (workspace_id)
);
```

---

## 4. Workspace Resolution Strategy

### 4.1 Workspace ID Computation (Phase 1)

**Automatic Workspace Resolution**

In Phase 1, workspaces are **implicitly derived** from the organization. No user configuration or selection is needed.

**Workspace ID Format:**
```typescript
workspaceId = `ws_${githubOrgSlug}`
```

**Example:**
- GitHub Organization: `acme-corp` (slug)
- Computed Workspace ID: `ws_acme-corp`
- All repositories in `acme-corp` index to this workspace

**Resolution Flow:**
```typescript
// 1. Webhook receives push from repo
const { githubRepoId, installationId } = webhookPayload;

// 2. Look up connected repository
const repo = await getConnectedRepositoryByGithubId(githubRepoId);

// 3. Get organization from repository
const org = await getOrganizationById(repo.organizationId);

// 4. Compute workspace ID
const workspaceId = `ws_${org.githubOrgSlug}`;

// 5. Use for store creation and indexing
await processIngestion({ workspaceId, storeName, files });
```

**Key Properties:**
- **Deterministic:** Same organization always produces same workspace ID
- **Stable:** Survives app reinstalls, repository reconnections
- **Simple:** No user input or configuration needed
- **Consistent:** All repos in org share the same workspace

### 4.2 lightfast.yml Resolution Strategy

**Per-Repository Configuration**

Each repository's `lightfast.yml` is **scoped to that repository only**. The configuration defines:
- Which store(s) this repo contributes to
- Which files from this repo should be indexed
- How files should be processed (chunking, metadata)

```yaml
# repo-1/lightfast.yml (minimal config)
version: 1
store: docs-site
include:
  - docs/**/*.md
  - apps/docs/content/**/*.mdx
```

**Repository Independence:**
```yaml
# repo-1/lightfast.yml
version: 1
store: api-docs
include:
  - docs/api/**/*.md

# repo-2/lightfast.yml
version: 1
store: user-guides
include:
  - guides/**/*.mdx
```

**Result:** Two separate stores (`api-docs`, `user-guides`) in the **same workspace** (`ws_acme-corp`)

**Resolution Logic:**
1. Webhook receives push from repo
2. Look up `ConnectedRepository` by `githubRepoId`
3. Get `organizationId` from repository
4. Look up `Organization` by `id`
5. Compute `workspaceId = ws_${organization.githubOrgSlug}`
6. Fetch `lightfast.yml` from the specific repository
7. Parse store name and file patterns from config
8. Use `workspaceId` + `storeName` for indexing

**Pros:**
- ✅ Zero configuration overhead for users
- ✅ Simple mental model (org = workspace)
- ✅ Fast time to value (< 5 min setup)
- ✅ No breaking changes needed
- ✅ Aligns with Phase 1 scope (docs-only)

**Cons:**
- ❌ Can't have multiple workspaces per org (acceptable for Phase 1)
- ❌ Migration needed for Phase 2 multi-workspace support

### 4.2 Alternative: Explicit Workspace (Phase 2+)

```yaml
version: 1
workspace: engineering  # Explicit workspace name
store: docs-site
include:
  - docs/**/*.md
```

**Resolution:**
1. Parse `workspace` field from config
2. Look up or create workspace under organization
3. Use explicit workspace ID

**When to use:**
- Phase 2: When organizations want to separate projects/teams
- Multi-repo monorepo scenarios (different stores per workspace)

### 4.3 Store Naming and Uniqueness

**Constraint:** `(workspaceId, storeName)` must be unique

**Validation:**
```typescript
// On ingestion start
const existingStore = await db.query.stores.findFirst({
  where: and(
    eq(stores.workspaceId, workspaceId),
    eq(stores.name, config.store)
  )
});

if (existingStore) {
  // Use existing store
  storeId = existingStore.id;
} else {
  // Create new store
  storeId = await createStore({
    workspaceId,
    name: config.store,
    indexName: `ws_${workspaceId}__store_${config.store}`
  });
}
```

**Store rename handling (Phase 1):**
- Changing `store` name creates a new store
- Old store remains searchable but won't get new updates
- Admin UI for cleanup (Phase 2)

---

## 5. Multi-Tenant Architecture

### 5.1 Isolation Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Clerk Session                             │
│  - User → Organization membership                   │
│  - Role-based access (admin/member)                 │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Layer 2: Lightfast Organization                    │
│  - Organization data scoped by clerkOrgId           │
│  - All queries filter: WHERE clerkOrgId = ?         │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Layer 3: Workspace (implicit)                      │
│  - Computed from organization                       │
│  - workspaceId = ws_${githubOrgSlug}               │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Layer 4: Data Isolation                            │
│  - Stores: WHERE workspaceId = ?                    │
│  - Documents: JOIN stores WHERE workspaceId = ?     │
│  - Vectors: Pinecone namespace = ws_${workspace}_*  │
└─────────────────────────────────────────────────────┘
```

### 5.2 Role-Based Access Control

**Roles (Clerk):**
- `org:admin` - Full access to organization settings
- `org:member` - Read-only access to organization data

**Permission Matrix:**
```
Action                          | Admin | Member
--------------------------------|-------|--------
View organization               |  ✓    |  ✓
View repositories               |  ✓    |  ✓
Connect repositories            |  ✓    |  ✗
Disconnect repositories         |  ✓    |  ✗
Trigger manual ingestion        |  ✓    |  ✗
View stores & search results    |  ✓    |  ✓
Manage API keys                 |  ✓    |  ✗
Invite team members             |  ✓    |  ✗
Manage billing                  |  ✓    |  ✗
```

**Implementation:**
```typescript
// In tRPC procedures
export const connectRepositoryProcedure = protectedProcedure
  .input(z.object({ ... }))
  .mutation(async ({ ctx, input }) => {
    // 1. Get active organization from Clerk session
    const orgId = ctx.session.orgId;

    // 2. Check user's role in organization
    const membership = await ctx.clerk.organizations
      .getOrganizationMembershipList({
        organizationId: orgId,
        userId: ctx.session.userId
      });

    if (membership.role !== 'org:admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only admins can connect repositories'
      });
    }

    // 3. Proceed with operation
    // ...
  });
```

### 5.3 Multi-User Scenarios

**Scenario 1: Team Member Joins Existing Organization**

Flow:
1. User signs up with Clerk
2. Connects GitHub
3. On "Claim Organization" screen, sees org already claimed
4. Backend verifies GitHub membership
5. Adds user to Clerk organization with appropriate role
6. User gets access immediately

**Scenario 2: User with Multiple Organizations**

Flow:
1. User can be member of multiple GitHub orgs
2. Each org that has the GitHub App installed shows in claim screen
3. User can claim/join multiple organizations
4. Clerk organization switcher shows all orgs
5. Active org determines which workspace/stores are visible

**Scenario 3: Organization Transfer**

If GitHub org ownership changes:
1. GitHub sends `repository.transferred` webhook
2. We update `metadata.fullName` in `ConnectedRepository`
3. Organization record stays the same (linked via immutable `githubOrgId`)
4. No data loss or migration needed

---

## 6. Edge Cases and Error Handling

### 6.1 GitHub App Issues

| Scenario | Detection | Handling |
|----------|-----------|----------|
| App uninstalled | `installation.deleted` webhook | Mark all repos inactive, show reconnect banner |
| App permissions revoked | API call returns 403 | Show permission request banner |
| Installation ID changed | App reinstalled | Update `githubInstallationId` on claim |
| Org renamed on GitHub | `repository.renamed` webhook | Update cached `metadata.fullName` |
| Repo deleted on GitHub | `repository.deleted` webhook | Mark repo inactive, preserve historical data |

### 6.2 lightfast.yml Issues

| Issue | Detection | Resolution |
|-------|-----------|------------|
| File missing | Fetch returns 404 | Show setup wizard, skip ingestion |
| Invalid YAML syntax | Parse error | Show error in UI, skip ingestion |
| Invalid schema | Validation error | Show specific field errors, skip ingestion |
| Empty include globs | Zero files matched | Show warning, don't create store |
| Duplicate store name | DB unique constraint | Show error, suggest rename |

### 6.3 Ingestion Failures

| Failure Type | Detection | Recovery |
|--------------|-----------|----------|
| Network timeout | Inngest step timeout | Automatic retry (3x with backoff) |
| Rate limit hit | GitHub API 429 | Exponential backoff, continue later |
| Parse error | Markdown parsing fails | Skip file, log error, continue |
| Embedding error | OpenAI API error | Retry with backoff, fallback to cached |
| Pinecone error | Upsert fails | Retry, rollback DB changes if needed |

### 6.4 Multi-Repo Scenarios

**Scenario 1: Multiple repos, same workspace, different stores**

```yaml
# repo-1/lightfast.yml (indexes to ws_acme-corp)
version: 1
store: api-docs
include:
  - docs/api/**/*.md

# repo-2/lightfast.yml (indexes to ws_acme-corp)
version: 1
store: user-guides
include:
  - docs/guides/**/*.md
```

**Result:**
- Both repos belong to organization `acme-corp`
- Both index to workspace `ws_acme-corp`
- Two separate stores: `api-docs` and `user-guides`
- Each store can be searched independently
- Cross-store search across the workspace is supported

**Scenario 2: Multiple repos, same workspace, same store**

```yaml
# repo-1/lightfast.yml (indexes to ws_acme-corp)
version: 1
store: docs-site
include:
  - docs/**/*.md

# repo-2/lightfast.yml (indexes to ws_acme-corp)
version: 1
store: docs-site
include:
  - guides/**/*.mdx
```

**Result:**
- Both repos contribute to the **same store** (`docs-site`)
- Store `docs-site` contains documents from both repositories
- Single unified search across all documents
- Documents maintain their repo-relative paths for identification

**Scenario 3: Monorepo with multiple stores**

```yaml
# monorepo/lightfast.yml
version: 1
store: main-docs
include:
  - apps/*/docs/**/*.md
  - packages/*/README.md
```

**Result:** Single store aggregating from multiple paths within one repo

**Scenario 4: Repo with config vs. repo without config**

```
acme-corp (organization)
├── repo-1/ (has lightfast.yml) → indexes to ws_acme-corp
└── repo-2/ (no lightfast.yml) → not indexed
```

**Result:** Only repos with `lightfast.yml` trigger ingestion

**Key Principles:**
1. **Per-repo configuration:** Each `lightfast.yml` only controls that repo's files
2. **Workspace sharing:** All repos in org share the same workspace
3. **Store flexibility:** Multiple repos can contribute to same store or different stores
4. **No conflicts:** Different configs in different repos don't interfere with each other

**Not supported (Phase 1):** Multiple `lightfast.yml` files in same repo

---

## 7. Console UI Flow

### 7.1 Site Map

```
/
├── sign-in
├── sign-up
├── onboarding
│   ├── connect-github        (Step 2)
│   └── claim-org              (Step 3)
│
├── org/[slug]                 (Protected - requires active org)
│   ├── /                      (Dashboard/Overview)
│   ├── search                 (Search across stores)
│   ├── stores                 (List stores in workspace)
│   │   └── [storeName]        (Store details + search)
│   ├── repositories           (List connected repos)
│   │   ├── connect            (Connect new repos)
│   │   └── [repoId]           (Repo details + config)
│   │       ├── configure      (lightfast.yml wizard)
│   │       └── ingestion      (Ingestion history)
│   ├── settings
│   │   ├── general            (Org settings)
│   │   ├── members            (Team management - Clerk UI)
│   │   ├── github-integration (Manage GitHub App)
│   │   └── api-keys           (API key management)
│   └── billing                (Billing - future)
│
└── docs                       (Public documentation)
```

### 7.2 Screen-by-Screen Navigation

#### A. Landing Page (`/`)

**State:** Not authenticated

```
┌─────────────────────────────────────────────────────┐
│  [Logo] Lightfast Console                          │
│                                                     │
│  Memory built for teams                            │
│                                                     │
│  Make your team's knowledge instantly searchable   │
│  and trustworthy. From GitHub to production docs   │
│  in under 5 minutes.                               │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Get Started                                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Sign In                                     │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### B. Connect GitHub (`/onboarding/connect-github`)

**State:** Authenticated, no active org

(See Step 2 implementation details above)

#### C. Claim Organization (`/onboarding/claim-org`)

**State:** Authenticated, GitHub connected, no active org

(See Step 3 implementation details above)

#### D. Organization Dashboard (`/org/[slug]`)

**State:** Active organization

```
┌─────────────────────────────────────────────────────┐
│  [Logo] [Org Switcher ▼]  Search...  [User Menu] │
├─────────────────────────────────────────────────────┤
│  Sidebar:                   Main Content:           │
│  > Overview                                         │
│    Repositories            📊 Overview              │
│    Stores                                           │
│    Search                  Connected Repos: 2       │
│    Settings                Active Stores: 1         │
│                            Total Documents: 47      │
│                            Last Ingestion: 5m ago   │
│                                                     │
│                            Recent Activity:         │
│                            • Ingested 12 files      │
│                            • Connected repo-2       │
│                                                     │
│                            Quick Actions:           │
│                            🔗 Connect Repository    │
│                            🔍 Search Docs           │
└─────────────────────────────────────────────────────┘
```

#### E. Repositories List (`/org/[slug]/repositories`)

```
┌─────────────────────────────────────────────────────┐
│  Repositories                    [+ Connect Repo]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  📦 owner/repo-1                             │ │
│  │  ✅ Configured (store: docs-site)           │ │
│  │  Last sync: 5 minutes ago                   │ │
│  │  47 documents indexed                       │ │
│  │                                              │ │
│  │  [View Details]  [Trigger Sync]             │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  📦 owner/repo-2                             │ │
│  │  ⚠️ Not configured                          │ │
│  │  No lightfast.yml found                     │ │
│  │                                              │ │
│  │  [Configure]  [Disconnect]                  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### F. Connect Repositories (`/org/[slug]/repositories/connect`)

```
┌─────────────────────────────────────────────────────┐
│  Connect Repositories                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Select repositories to connect:                   │
│                                                     │
│  ☑ owner/docs-site                                 │
│    Public • Default branch: main                   │
│    "Documentation website"                         │
│                                                     │
│  ☑ owner/api-docs                                  │
│    Private • Default branch: main                  │
│    "API reference documentation"                   │
│                                                     │
│  ☐ owner/backend                                   │
│    Private • Default branch: main                  │
│    "Backend services"                              │
│                                                     │
│  ☐ owner/frontend                                  │
│    Private • Default branch: main                  │
│    "React frontend application"                    │
│                                                     │
│  [Back]  [Connect Selected (2)]                    │
└─────────────────────────────────────────────────────┘
```

#### G. Repository Configuration (`/org/[slug]/repositories/[id]/configure`)

(See Step 6 implementation details above for wizard UI)

#### H. Stores List (`/org/[slug]/stores`)

```
┌─────────────────────────────────────────────────────┐
│  Stores                                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  📚 docs-site                                │ │
│  │  47 documents • Updated 5m ago              │ │
│  │  From: owner/docs-site                      │ │
│  │                                              │ │
│  │  [Search]  [View Details]                   │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  📚 api-docs                                 │ │
│  │  23 documents • Updated 2h ago              │ │
│  │  From: owner/api-docs                       │ │
│  │                                              │ │
│  │  [Search]  [View Details]                   │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### I. Store Search (`/org/[slug]/stores/[storeName]`)

```
┌─────────────────────────────────────────────────────┐
│  Store: docs-site                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Search this store:                                │
│  ┌──────────────────────────────────────────────┐ │
│  │  How do I authenticate with the API?  [🔍]  │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  Results:                                          │
│                                                     │
│  1. Authentication Guide                           │
│     ...use the API key in the Authorization...    │
│     docs/guides/authentication.md                  │
│                                                     │
│  2. API Reference - Auth                           │
│     ...POST /v1/auth endpoint accepts...          │
│     docs/api/auth.md                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 8. Migration Plan

### 8.1 Current State Assessment

**Existing Components:**
- ✅ User auth via Clerk
- ✅ GitHub OAuth flow
- ✅ Organization claiming flow
- ✅ Database schemas (organizations, repositories, stores, docs)
- ✅ Webhook handler (push events)
- ✅ Inngest workflow (docs ingestion)
- ✅ tRPC API (organization, repository routers)

**Missing Components:**
- ❌ Repository connection UI
- ❌ lightfast.yml wizard/setup flow
- ❌ lightfast.yml fetching in webhook handler
- ❌ Workspace resolution logic
- ❌ Store management UI
- ❌ Ingestion status/progress UI

### 8.2 Implementation Phases

#### Phase 1.4: Repository Connection (Week 1)

**Tasks:**
1. Create repository connection UI (`/org/[slug]/repositories/connect`)
2. Implement repository list UI (`/org/[slug]/repositories`)
3. Add "Check for lightfast.yml" function
4. Show configuration status per repo
5. Test: User can connect repos and see status

**Files to Create/Modify:**
- `apps/console/src/app/(app)/org/[slug]/repositories/page.tsx` (NEW)
- `apps/console/src/app/(app)/org/[slug]/repositories/connect/page.tsx` (NEW)
- Re-enable `repository` router in `api/console/src/root.ts`

#### Phase 1.5: Configuration Wizard (Week 2)

**Tasks:**
1. Create lightfast.yml setup wizard UI
2. Implement config generation logic
3. Add config validation
4. Create PR to repo with generated config
5. Test: User can configure repo without leaving Console

**Files to Create/Modify:**
- `apps/console/src/app/(app)/org/[slug]/repositories/[id]/configure/page.tsx` (NEW)
- `packages/console-services/src/github-config.ts` (NEW - config generation)
- `packages/console-services/src/github-pr.ts` (NEW - create PR)

#### Phase 1.6: Workspace Resolution (Week 3)

**Tasks:**
1. Update webhook handler to fetch lightfast.yml
2. Implement workspace resolution from organization
3. Update Inngest workflow to use resolved workspace
4. Add store auto-creation logic
5. Test: Push to repo triggers ingestion with correct workspace

**Files to Modify:**
- `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- `api/console/src/inngest/workflow/docs-ingestion.ts`
- `packages/console-services/src/workspace-resolver.ts` (NEW)

#### Phase 1.7: Store Management UI (Week 4)

**Tasks:**
1. Create stores list UI (`/org/[slug]/stores`)
2. Create store detail UI (`/org/[slug]/stores/[name]`)
3. Integrate search interface per store
4. Add ingestion history view
5. Test: User can view stores and search

**Files to Create:**
- `apps/console/src/app/(app)/org/[slug]/stores/page.tsx`
- `apps/console/src/app/(app)/org/[slug]/stores/[name]/page.tsx`

#### Phase 1.8: Polish & Testing (Week 5)

**Tasks:**
1. Add loading states and error handling
2. Add progress indicators for ingestion
3. Implement manual sync trigger
4. Add analytics tracking
5. End-to-end testing
6. Documentation updates

---

## 9. Success Metrics

### 9.1 Onboarding Funnel

```
Stage                    | Target | Measurement
-------------------------|--------|-------------
1. Sign Up               | 100%   | Clerk analytics
2. GitHub Connect        | 95%    | OAuth completion rate
3. Org Claimed           | 90%    | Organizations created
4. Repo Connected        | 85%    | Repositories table
5. lightfast.yml Added   | 70%    | Config detection
6. First Ingestion       | 65%    | Successful ingestion
7. First Search          | 60%    | Search API calls
```

### 9.2 Time to Value

**Target:** < 5 minutes from sign up to first search

**Breakdown:**
- Sign up: 30 seconds
- GitHub connect: 30 seconds
- Org claim: 20 seconds
- Repo connect: 1 minute
- Config setup: 2 minutes
- First ingestion: 1 minute
- **Total:** 5 minutes

**Measurement:**
```typescript
// Track timestamps
{
  signUpAt: timestamp,
  githubConnectAt: timestamp,
  orgClaimedAt: timestamp,
  repoConnectedAt: timestamp,
  configAddedAt: timestamp,
  firstIngestionAt: timestamp,
  firstSearchAt: timestamp,
  timeToValue: firstSearchAt - signUpAt  // Target: < 300s
}
```

### 9.3 Quality Metrics

```
Metric                          | Target | Measurement
--------------------------------|--------|-------------
Webhook processing success rate | > 99%  | Inngest success rate
Ingestion error rate            | < 1%   | Failed docs / total docs
Config validation success       | > 95%  | Valid configs / total
User-reported issues            | < 5%   | Support tickets
Organization activation rate    | > 80%  | Active orgs / claimed orgs
```

---

## 10. Open Questions & Future Work

### 10.1 Phase 1 Open Questions

**Q1: Should we allow multiple lightfast.yml files per repo?**
- **Recommendation:** No for Phase 1. Single config at repo root.
- **Rationale:** Simplifies implementation, covers 95% of use cases
- **Phase 2:** Consider supporting monorepo patterns

**Q2: How do we handle config changes (editing lightfast.yml)?**
- **Recommendation:** Detect on push, trigger re-indexing if store definition changes
- **Rationale:** Mirrors GitHub workflow, no separate UI needed
- **UI:** Show diff of what will change before committing

**Q3: Should users be able to manually trigger ingestion?**
- **Recommendation:** Yes, add "Sync Now" button in repository details
- **Rationale:** Useful for testing and recovering from failures
- **Implementation:** POST /api/repositories/[id]/trigger-sync

**Q4: How do we show ingestion progress?**
- **Recommendation:** Polling-based status endpoint initially
- **Rationale:** Simple, works without websockets
- **Phase 2:** Real-time via Inngest webhooks or Supabase realtime

### 10.2 Future Enhancements (Phase 2+)

**Multi-Workspace Support**
- Allow multiple workspaces per organization
- Explicit workspace mapping in UI
- Repository can be in multiple workspaces

**Advanced Configuration**
- Exclude patterns (blacklist globs)
- Custom chunking strategies
- Metadata extraction rules
- Frontmatter validation

**Search Improvements**
- Cross-store search
- Semantic search within organization
- Search analytics and popular queries
- Custom ranking/boosting rules

**Team Features**
- Per-repository access control
- Workspace-level permissions
- Audit logs for admin actions
- Team activity feed

**Integrations**
- Slack notifications for ingestion
- Linear/Jira for observation linking
- Notion for additional docs
- Discord bot for search

---

## 11. Summary & Recommendations

### 11.1 Key Architectural Decisions

1. **Organization = Workspace (Phase 1)**
   - Simplifies mental model and implementation
   - Fast time to value (< 5 min)
   - Easy to extend to multi-workspace in Phase 2

2. **Implicit Workspace Resolution**
   - No user configuration needed in lightfast.yml
   - Computed from GitHub organization slug
   - Consistent and predictable

3. **Clerk as Authentication Source of Truth**
   - User management handled by Clerk
   - Organization membership via Clerk
   - Lightfast organizations link via clerkOrgId

4. **GitHub as Identity Anchor**
   - githubOrgId is immutable and canonical
   - Survives renames, transfers, app reinstalls
   - Single source of truth for permissions

5. **Minimal Database Changes**
   - Use existing schemas (no migrations needed!)
   - Compute workspace at runtime
   - Store only immutable data

### 11.2 Implementation Priority

**Must Have (Phase 1.4-1.6):**
- ✅ Repository connection UI
- ✅ lightfast.yml wizard
- ✅ Workspace resolution in webhook
- ✅ Auto-ingestion on push

**Should Have (Phase 1.7):**
- ✅ Store management UI
- ✅ Ingestion status/history
- ✅ Manual sync trigger

**Nice to Have (Phase 1.8):**
- ✅ Progress indicators
- ✅ Search interface per store
- ✅ Error recovery flows
- ✅ Analytics tracking

**Future (Phase 2+):**
- Multiple workspaces per org
- Advanced configuration options
- Cross-store search
- Team permissions

### 11.3 Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Config syntax errors | Medium | High | Validation wizard + preview |
| GitHub rate limits | High | Medium | Exponential backoff + queue |
| Ingestion failures | High | Low | Retry logic + manual trigger |
| Workspace migration (Phase 2) | Low | High | Design migration path now |
| User confusion (org vs workspace) | Medium | Low | Clear UI copy + docs |

### 11.4 Success Criteria

**Phase 1 is successful if:**
1. ✅ Users can go from sign-up to searchable docs in < 5 minutes
2. ✅ 80%+ of claimed organizations successfully index at least one repository
3. ✅ 95%+ of push events successfully trigger ingestion
4. ✅ < 5% user-reported issues during onboarding
5. ✅ Zero breaking changes needed for Phase 2 multi-workspace support

---

## Appendices

### Appendix A: API Endpoints Summary

```
Authentication:
GET  /api/github/auth                     # Start GitHub OAuth
GET  /api/github/callback                 # OAuth callback
GET  /api/github/installations            # List user's installations
GET  /api/github/repositories             # List installation repos

Organizations:
POST /api/organizations/claim             # Claim organization
GET  /api/organizations/[id]              # Get organization details

Repositories:
GET  /api/repositories                    # List org repositories
POST /api/repositories/connect            # Connect repository
GET  /api/repositories/[id]               # Get repository details
POST /api/repositories/[id]/sync          # Trigger manual sync
GET  /api/repositories/[id]/config        # Get lightfast.yml
POST /api/repositories/[id]/config        # Create/update config

Stores:
GET  /api/stores                          # List workspace stores
GET  /api/stores/[name]                   # Get store details
GET  /api/stores/[name]/documents         # List store documents

Webhooks:
POST /api/github/webhooks                 # GitHub webhook handler
```

### Appendix B: Database Queries Reference

```typescript
// Get organization by Clerk org ID
const org = await db.query.organizations.findFirst({
  where: eq(organizations.clerkOrgId, clerkOrgId)
});

// Get organization repositories
const repos = await db.select()
  .from(DeusConnectedRepository)
  .where(and(
    eq(DeusConnectedRepository.organizationId, org.id),
    eq(DeusConnectedRepository.isActive, true)
  ));

// Resolve workspace from organization
const workspaceId = `ws_${org.githubOrgSlug}`;

// Get or create store
const store = await db.query.stores.findFirst({
  where: and(
    eq(stores.workspaceId, workspaceId),
    eq(stores.name, storeName)
  )
});

// List store documents
const docs = await db.select()
  .from(docsDocuments)
  .where(eq(docsDocuments.storeId, storeId))
  .orderBy(desc(docsDocuments.updatedAt))
  .limit(100);
```

### Appendix C: Environment Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# GitHub App
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=abc123def456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=abc123def456

# Database
DATABASE_URL=mysql://...              # MySQL for organizations, repos
POSTGRES_URL=postgresql://...         # Postgres for stores, docs, vectors

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...

# OpenAI
OPENAI_API_KEY=...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Proposed - Ready for Review
**Next Steps:** Review with team → Approve → Implement Phase 1.4
