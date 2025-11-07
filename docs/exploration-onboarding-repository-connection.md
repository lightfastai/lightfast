# Lightfast Console - Onboarding & Repository Connection Exploration Report

**Date:** 2025-11-07
**Status:** Current onboarding flow is partially implemented; ready for Phase 1.5 enhancement

---

## Executive Summary

The console app has a **solid foundation for onboarding and repository connection** that's already ~70% implemented:

### What Exists
- ✅ GitHub OAuth flow with user token storage
- ✅ Organization claiming with GitHub App installations
- ✅ Repository connection UI and tRPC mutation
- ✅ Database schema for organizations and connected repositories
- ✅ GitHub webhook handler for push events
- ✅ Settings pages for org management

### What's Missing for Phase 1.5
- ❌ lightfast.yml configuration detection and display
- ❌ Repository configuration status indicator
- ❌ Workspace resolution from organization (implicit, Phase 1 simplification)
- ❌ Configuration wizard UI for repos without lightfast.yml
- ❌ Config commit/PR creation capability
- ❌ Ingestion workflow connection

---

## 1. Current Onboarding Flow (Exists: Steps 1-3 of 7)

### Step 1: Sign Up ✅
- **URL:** `/sign-up`
- **Status:** COMPLETE
- **What it does:** User authenticates with Clerk (email or GitHub SSO)
- **Code:** `apps/console/src/app/(auth)/sign-up/page.tsx`
- **Output:** Authenticated user (pending organization)

### Step 2: Connect GitHub ✅
- **URL:** `/onboarding/connect-github`
- **Status:** COMPLETE
- **What it does:**
  1. Shows GitHub authorization request
  2. Redirects to GitHub OAuth at `/api/github/auth`
  3. Exchanges auth code for user access token
  4. Stores token in httpOnly cookie (`github_user_token`)
  5. Redirects to `/onboarding/claim-org`
- **Code:** 
  - `apps/console/src/app/(onboarding)/onboarding/connect-github/page.tsx`
  - `apps/console/src/app/(github)/api/github/auth/route.ts`
  - `apps/console/src/app/(github)/api/github/callback/route.ts`
- **Key features:**
  - User token stored securely in httpOnly cookies
  - Custom callback support via query param
  - State validation to prevent CSRF

### Step 3: Claim Organization ✅
- **URL:** `/onboarding/claim-org`
- **Status:** COMPLETE
- **What it does:**
  1. Fetches GitHub installations from user token
  2. Shows list of organizations with app installed
  3. User selects an org to claim
  4. Backend creates/links Clerk organization
  5. Adds user to Clerk org with appropriate role
  6. Sets as active session organization
  7. Redirects to `/org/[slug]/settings`

**Flow for NEW organization:**
```
User selects org
  ↓
Create Clerk organization (user becomes admin via createdBy)
  ↓
Create Console organization record with Clerk linking
  ↓
Set as active in Clerk session
  ↓
Redirect to /org/[slug]/settings
```

**Flow for EXISTING organization (team member joins):**
```
User selects org
  ↓
Verify GitHub org membership + get role
  ↓
Add to existing Clerk organization (with verified role)
  ↓
Update installation ID if changed
  ↓
Set as active in Clerk session
  ↓
Redirect to /org/[slug]/settings
```

- **Code:** 
  - `apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx`
  - `apps/console/src/app/(github)/api/organizations/claim/route.ts`
- **Key features:**
  - Comprehensive error handling and logging
  - Automatic Clerk org creation
  - GitHub membership verification
  - Role mapping (admin → org:admin, others → org:member)
  - Rollback on failure (deletes Clerk org if Console org creation fails)

### Step 4: Dashboard Landing (Partial) ⚠️
- **URL:** `/org/[slug]/settings`
- **Status:** PARTIAL - exists but needs work
- **What it shows:** Settings page with navigation
- **Code:** `apps/console/src/app/(app)/org/[slug]/settings/page.tsx`
- **Gap:** No welcome flow or "get started" prompt

### Step 5: Connect Repositories ✅
- **URL:** `/org/[slug]/settings/repositories`
- **Status:** MOSTLY COMPLETE
- **What it does:**
  1. Fetches list of connected repositories
  2. Shows "Add repository" button
  3. Opens `ConnectRepositoryDialog`
  4. Dialog fetches available repos from GitHub: `GET /api/github/repositories?githubOrgId=[id]`
  5. User selects repo(s)
  6. Calls `repository.connect` tRPC mutation
  7. Creates `DeusConnectedRepository` record
- **Code:**
  - `apps/console/src/app/(app)/org/[slug]/settings/repositories/page.tsx`
  - `apps/console/src/components/repositories-settings.tsx`
  - `apps/console/src/components/connect-repository-dialog.tsx`
  - `api/console/src/router/repository.ts` (tRPC)
  - `apps/console/src/app/(github)/api/github/repositories/route.ts`
- **Key features:**
  - Optimistic updates with rollback
  - Repository metadata caching (fullName, description, etc.)
  - Shows private/public badge
  - Links to GitHub repos
  - Shows language, stars, last updated
  - Fetches repos from GitHub App installation
  - Stores only immutable data (githubRepoId, installationId)

---

## 2. Repository Connection UX - What's Already Built

### ConnectRepositoryDialog Component ✅
**File:** `/apps/console/src/components/connect-repository-dialog.tsx`

**Features:**
- Opens as dialog when "Add repository" clicked
- Fetches repos from GitHub API via installation ID
- Shows scrollable list of available repos
- Selection UI with checkmarks
- Handles already-connected repos (shows banner)
- Loading state with spinner
- Empty state if no repos found
- Optimistic updates with error rollback

**Data stored in database:**
```typescript
{
  id: uuid,
  organizationId: string,         // Clerk org ID
  githubRepoId: string,           // Immutable GitHub ID
  githubInstallationId: string,   // Installation ID for API access
  permissions: { admin, push, pull },
  isActive: boolean,
  metadata: {                     // Cached, can be stale
    fullName: "owner/repo",
    description: "...",
    language: "TypeScript",
    private: boolean,
    owner: string,
    ownerAvatar: string,
    stargazersCount: number,
    updatedAt: ISO8601
  },
  connectedAt: ISO8601,
  lastSyncedAt: ISO8601 | null,
  createdAt: ISO8601
}
```

### RepositoriesSettings Component ✅
**File:** `/apps/console/src/components/repositories-settings.tsx`

**Features:**
- Lists all connected repositories
- Shows repo details (name, description, language, stars)
- Link to GitHub
- Remove button (not implemented)
- Empty state with "Connect your first repository" button
- Uses prefetch for zero loading state (via tRPC server utilities)

---

## 3. Database Schema - Repository Management

### DeusConnectedRepository Table ✅
**File:** `/db/console/src/schema/tables/connected-repository.ts`

**Design principle:** Organization-scoped via GitHub App

**Fields:**
- `id` (uuid) - primary key
- `organizationId` (string) - FK to organizations (implicit Clerk org ID)
- `githubRepoId` (string, unique) - immutable GitHub ID (single source of truth)
- `githubInstallationId` (string) - for GitHub API access
- `permissions` (json) - what we're allowed to do
- `isActive` (boolean) - soft delete for disconnection
- `connectedAt` (datetime) - when connected
- `lastSyncedAt` (datetime) - last GitHub API interaction
- `metadata` (json) - cached data (fullName, description, language, stars, etc.)
- `createdAt` (datetime) - creation timestamp

**Indexes:**
- `org_id_idx` - fast lookups by organization
- `org_active_idx` - fast lookups of active repos by org
- `installation_idx` - fast lookups by installation

**Key design decisions:**
- ✅ Only stores immutable data (githubRepoId never changes)
- ✅ Metadata is cached and can be stale
- ✅ Fresh data fetched from GitHub API when needed
- ✅ No sync logic or webhooks needed for freshness
- ✅ Single source of truth = GitHub API

### Organizations Table ✅
**File:** `/db/console/src/schema/tables/organizations.ts`

**Fields:**
- `id` (uuid) - primary key
- `githubOrgId` (int, unique) - immutable GitHub org ID
- `githubInstallationId` (int) - can change if app reinstalled
- `githubOrgSlug` (string) - can change if org renamed
- `githubOrgName` (string) - can change if org renamed
- `githubOrgAvatarUrl` (text) - for UI display
- `clerkOrgId` (string, unique) - links to Clerk for user management
- `clerkOrgSlug` (string) - Clerk org slug
- `claimedBy` (string) - Clerk userId who claimed it
- `claimedAt` (datetime)
- `createdAt` / `updatedAt` (datetime)

**Why this design:**
- Single Clerk org = single Lightfast org = single workspace (Phase 1)
- GitHub org ID is immutable → reliable anchor
- Installation ID can change (app reinstall)
- Slug can change (org rename)

---

## 4. tRPC API Layer - Repository Operations

### repository.ts Router ✅
**File:** `/api/console/src/router/repository.ts`

**Status:** Has TODO: TypeScript errors disabled (@ts-nocheck), but implementation is complete

**Procedures:**

#### Query: `list`
- Input: `{ organizationId: string, includeInactive?: boolean }`
- Returns: Array of connected repositories
- Uses prefetch for zero loading in UI
- Filters by org and active status

#### Query: `get`
- Input: `{ repositoryId: string, organizationId: string }`
- Returns: Single repository with all details
- Verifies ownership

#### Mutation: `connect`
- Input: `{ organizationId, githubRepoId, githubInstallationId, permissions?, metadata? }`
- Returns: Created/updated repository
- Creates new connection or reactivates previous
- Stores immutable data + optional metadata cache
- NO lightfast.yml checking yet (needs implementation)

#### Internal Procedures (for webhooks):
- `findActiveByGithubRepoId` - used by webhooks
- `markInactive` - soft delete
- `markInstallationInactive` - disable whole installation
- `updateMetadata` - cache updates
- `markDeleted` - mark as deleted on GitHub

---

## 5. GitHub Integration - What's Implemented

### GitHub OAuth Flow ✅
**Files:**
- `/apps/console/src/app/(github)/api/github/auth/route.ts` - initiates OAuth
- `/apps/console/src/app/(github)/api/github/callback/route.ts` - handles callback
- `/apps/console/src/app/(github)/api/github/installations/route.ts` - fetches user's installations

**Flow:**
1. User click "Connect GitHub" → `/api/github/auth?callback=/onboarding/claim-org`
2. Redirects to GitHub with state parameter
3. User authorizes app
4. GitHub redirects to `/api/github/callback` with code
5. Backend exchanges code for user access token
6. Stores in httpOnly cookie (`github_user_token`)
7. Redirects to callback URL or success page

**Security:**
- State parameter for CSRF protection
- httpOnly cookies (can't be stolen by XSS)
- Token expires after 24 hours
- Secure cookies in production

### GitHub App Installation Fetching ✅
**File:** `/apps/console/src/app/(github)/api/github/installations/route.ts`

**What it does:**
- Takes user access token from cookie
- Calls GitHub API to get user's installations
- Returns list of GitHub organizations/accounts where app is installed

**Used by:** Claim org page to show list of orgs to claim

### GitHub Repository Fetching ✅
**File:** `/apps/console/src/app/(github)/api/github/repositories/route.ts`

**What it does:**
- Takes either `installationId` or `githubOrgId` as parameter
- Fetches repositories accessible through that installation
- Returns full GitHub repository objects

**Used by:** ConnectRepositoryDialog to show repos available to connect

### GitHub Webhook Handler ✅
**File:** `/apps/console/src/app/(github)/api/github/webhooks/route.ts`

**Events handled:**
- `push` - triggers ingestion workflow
- `installation_repositories.removed` - marks repos as inactive
- `installation.deleted` - marks all repos from installation as inactive
- `repository.deleted` - marks repo as deleted
- `repository.renamed` - updates cached repo name

**Current push event handling:**
- Verifies webhook signature (HMAC-SHA256)
- Extracts changed files from commits
- Triggers Inngest workflow with:
  ```typescript
  {
    workspaceId: repository.full_name,      // ← Should be ws_${orgSlug}
    storeName: "docs",                       // ← Should be from lightfast.yml
    repoFullName: repository.full_name,
    githubInstallationId: installation.id,
    beforeSha: commit_before,
    afterSha: commit_after,
    deliveryId: webhook_id,
    changedFiles: [{ path, status }, ...]
  }
  ```

**Gap:** Doesn't fetch lightfast.yml config yet (Phase 1.5 work)

---

## 6. Workspace Resolution - Currently Missing

**Current state:** ⚠️ NOT IMPLEMENTED YET

**What exists:**
- Organizations table exists
- GitHub org slug available
- Webhook has installation ID

**What's missing:**
- Workspace ID resolution logic
- Workspace ID should be: `ws_${organization.githubOrgSlug}`
- This should happen in:
  1. Webhook handler (before triggering Inngest)
  2. Inngest workflow (to create/access store)

**Current problem:** Webhook uses `repository.full_name` as workspace, but it should use org slug

**Fix location:** In webhook handler `handlePushEvent()`:
```typescript
// 1. Find connected repository
const connRepo = await getConnectedRepositoryByGithubRepoId(githubRepoId);

// 2. Get organization
const org = await getOrganizationById(connRepo.organizationId);

// 3. Compute workspace ID
const workspaceId = `ws_${org.githubOrgSlug}`;

// 4. Send to Inngest with computed workspaceId
await inngest.send({
  name: "apps-console/docs.push",
  data: {
    workspaceId,  // ← computed workspace ID
    // ... rest
  }
});
```

---

## 7. lightfast.yml Configuration - What's Missing

### Current State ❌
**No configuration detection or display**

### What Phase 1.5 Needs

#### 7a. Configuration Detection
When repository is connected, check if `lightfast.yml` exists:
```typescript
// In ConnectRepositoryDialog after repo selection
const hasConfig = await checkLightfastYmlExists({
  githubRepoId: repo.id,
  githubInstallationId,
  branch: repo.default_branch
});

// Show status indicator
// ✅ Configured
// ⚠️ Not configured (show setup option)
```

#### 7b. Configuration Display
Show config status in RepositoriesSettings:
```
📦 Repository Name
├─ ✅ Configured
│  └─ Stores: ["docs-site"]
│     Includes: ["docs/**/*.md", "apps/docs/**/*.mdx"]
│
└─ ⚠️ Not Configured
   └─ [Setup] [View template] [Edit on GitHub]
```

#### 7c. Configuration UI Options
For repos without lightfast.yml, offer two paths:

**Option 1: Setup Wizard (Recommended)**
- Select store name
- Choose what to index (docs, READMEs, API docs)
- Specify glob patterns (optional)
- Preview matching files
- Generate lightfast.yml
- Create PR or direct commit

**Option 2: Manual**
- Show template
- User copies/commits manually
- We detect on next push

#### 7d. Config Commit/PR Creation
Use GitHub App to create PR with lightfast.yml:
```typescript
await createConfigPullRequest({
  repoId: githubRepoId,
  installationId: githubInstallationId,
  branch: "main",
  config: {
    version: 1,
    store: "docs-site",
    include: ["docs/**/*.md"]
  }
});
```

---

## 8. Gap Analysis - What Exists vs. What's Needed

### For Phase 1.5 (Repository Configuration)

| Component | Exists | Needed |
|-----------|--------|--------|
| Org claiming flow | ✅ | - |
| Repo connection UI | ✅ | Minor UX tweaks |
| Repo database schema | ✅ | - |
| GitHub API integration | ✅ | - |
| Webhook handler | ✅ | lightfast.yml fetching |
| **lightfast.yml detection** | ❌ | ✅ NEW |
| **Config UI display** | ❌ | ✅ NEW |
| **Config wizard** | ❌ | ✅ OPTIONAL |
| **Config commit/PR** | ❌ | ✅ OPTIONAL |
| **Workspace resolution** | ❌ | ✅ NEW |
| **Inngest integration** | ✅ | lightfast.yml reading |
| tRPC repository ops | ✅ | Minor additions |

### For Phase 1.5 - Minimum Viable Changes

**MUST HAVE:**
1. Workspace ID resolution in webhook (compute from org)
2. lightfast.yml detection after repo connect
3. Config status display in repositories list
4. Update webhook to fetch and use lightfast.yml

**NICE TO HAVE:**
1. Setup wizard for repos without config
2. Config commit/PR creation UI
3. Config template preview

**NOT NEEDED YET:**
1. Multi-workspace support (Phase 2)
2. Config editing in UI (Phase 2)
3. Config versioning (Phase 2)

---

## 9. Recommended UX Changes

### For Minimum Phase 1.5

#### Option A: Inline Setup Prompt (Simplest)
```
After connecting repo:
┌─────────────────────────────────┐
│ ✅ repo-name connected!          │
├─────────────────────────────────┤
│                                  │
│ ⚠️ No lightfast.yml found        │
│ Setup instructions:              │
│ 1. Copy sample lightfast.yml     │
│ 2. Commit to main branch         │
│ 3. Next push will trigger index  │
│                                  │
│ [Copy template] [Learn more]     │
└─────────────────────────────────┘
```

**Pros:** Minimal code, immediate feedback
**Cons:** Not as polished

#### Option B: Settings Page Status (Recommended)
```
Connected Repositories
│
├─ repo-name (✅ Configured)
│  └─ Store: "docs-site"
│     Files: docs/**/*.md, apps/**/*.mdx
│     [View config] [Edit on GitHub]
│
└─ other-repo (⚠️ Setup needed)
   └─ [Setup] [View template] [Skip for now]
```

**Pros:** Clear status, doesn't interrupt flow
**Cons:** User might miss it

#### Option C: Welcome Card on Dashboard
```
/org/[slug]/settings - shows welcome card:
┌──────────────────────────────────┐
│ Welcome to [org]!                │
├──────────────────────────────────┤
│ Get started in 2 steps:          │
│                                  │
│ 1. ✅ Connect repositories       │
│    2 repositories connected      │
│                                  │
│ 2. ⏳ Configure for indexing     │
│    1 configured, 1 needs setup   │
│    [View setup instructions]     │
└──────────────────────────────────┘
```

**Pros:** Visible, guides user through next steps
**Cons:** Requires dashboard changes

### Recommended Approach
**Use Option B + C combination:**
- Show welcome card on dashboard (brief)
- Show detailed status in repositories page
- Inline template copy option for setup

---

## 10. Code Paths to Modify/Create

### Files to Modify

1. **Webhook Handler** - MUST CHANGE
   - `/apps/console/src/app/(github)/api/github/webhooks/route.ts`
   - Add: workspace ID resolution from organization
   - Add: lightfast.yml fetching
   - Add: file filtering based on config

2. **ConnectRepositoryDialog** - SHOULD CHANGE
   - `/apps/console/src/components/connect-repository-dialog.tsx`
   - Add: config detection after selection
   - Add: config status display
   - Add: setup prompt

3. **RepositoriesSettings** - SHOULD CHANGE
   - `/apps/console/src/components/repositories-settings.tsx`
   - Add: config status badges
   - Add: setup links for unconfigured repos
   - Add: remove repository button

4. **Repository tRPC Router** - MIGHT CHANGE
   - `/api/console/src/router/repository.ts`
   - Add: configuration status query (optional)
   - Add: configuration update mutation (Phase 2)

5. **Dashboard/Settings Layout** - OPTIONAL
   - `/apps/console/src/app/(app)/org/[slug]/settings/page.tsx`
   - Add: welcome card with setup progress
   - Add: quick links to next steps

### Files to Create

1. **lightfast.yml Parser/Validator**
   - Location: `@repo/console-config` (new or existing package)
   - Purpose: Parse and validate lightfast.yml
   - Exports: `parseLightfastConfig()`, `validateConfig()`

2. **GitHub File Fetcher**
   - Location: `@repo/console-octokit-github` (extend existing)
   - Purpose: Fetch files from GitHub repos using App token
   - Exports: `getFileContent()`, `fileExists()`

3. **Configuration UI Components** (Optional)
   - Location: `/apps/console/src/components/`
   - Components:
     - `config-setup-dialog.tsx` - wizard for config creation
     - `config-status-badge.tsx` - status indicator
     - `config-template-preview.tsx` - show sample config

4. **Inngest Workflow Updates**
   - Location: `@api/console/inngest` (modifications)
   - Updates: Accept workspace ID from webhook
   - Updates: Accept store name from lightfast.yml
   - Updates: Use config to filter files

---

## 11. Implementation Priority for Phase 1.5

### Critical Path (Phase 1.5 MVP)
1. **Workspace ID resolution** in webhook - enables proper store creation
2. **lightfast.yml detection** - know if config exists
3. **Config status display** - simple badge in repo list
4. **Webhook lightfast.yml fetching** - read actual config
5. **File filtering in Inngest** - use globs from config

### Should Have (if time permits)
6. **Setup instructions/template** - help users create config
7. **Repository remove button** - complete repo management
8. **Config validation** - validate config on fetch

### Can Defer to Phase 2
- Setup wizard UI
- Config commit/PR creation
- Config editing in UI
- Config versioning/history
- Multi-workspace support

---

## 12. Testing Scenarios for Phase 1.5

### Happy Path
1. User claims organization ✅
2. User connects repository ✅
3. System detects lightfast.yml exists
4. Webhook triggers on push to main
5. Workspace ID resolves correctly
6. Inngest reads lightfast.yml
7. Files filter by globs in config
8. Ingestion proceeds normally
9. Documents appear in search

### Error Cases
1. Repository has no lightfast.yml
   - Show setup prompt
   - Don't trigger ingestion until config added

2. lightfast.yml is invalid YAML
   - Show error message
   - Log to monitoring
   - Skip repo for this push

3. Glob patterns match no files
   - Log warning
   - Still create store (for future updates)
   - Show 0 files indexed

4. Workspace ID resolution fails
   - Log error
   - Fall back to repo name (current behavior)
   - Alert team

---

## 13. Files Used in This Exploration

### Onboarding Flow
- `/apps/console/src/app/(onboarding)/layout.tsx`
- `/apps/console/src/app/(onboarding)/onboarding/page.tsx`
- `/apps/console/src/app/(onboarding)/onboarding/connect-github/page.tsx`
- `/apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx`

### GitHub Integration
- `/apps/console/src/app/(github)/api/github/auth/route.ts`
- `/apps/console/src/app/(github)/api/github/callback/route.ts`
- `/apps/console/src/app/(github)/api/github/installations/route.ts`
- `/apps/console/src/app/(github)/api/github/repositories/route.ts`
- `/apps/console/src/app/(github)/api/github/webhooks/route.ts` [MODIFIED - has TODO]
- `/apps/console/src/app/(github)/api/organizations/claim/route.ts`

### Repository Management
- `/apps/console/src/app/(app)/org/[slug]/settings/repositories/page.tsx`
- `/apps/console/src/app/(app)/org/[slug]/settings/github-integration/page.tsx`
- `/apps/console/src/components/repositories-settings.tsx`
- `/apps/console/src/components/connect-repository-dialog.tsx`
- `/apps/console/src/components/github-integration-settings.tsx`

### Database Schemas
- `/db/console/src/schema/tables/connected-repository.ts`
- `/db/console/src/schema/tables/organizations.ts`

### tRPC API
- `/api/console/src/router/repository.ts` [TODO: TypeScript check disabled]
- `/api/console/src/router/organization.ts`

### Architecture Documentation
- `/docs/architecture/phase1/user-flow-architecture.md` - TARGET state spec
- `/docs/architecture/phase1/user-flow-summary.md`
- `/docs/architecture/phase1/user-flow-diagrams.md`

---

## Conclusion

The onboarding flow is **~70% complete** with a solid foundation:

- GitHub OAuth + installation flow is excellent ✅
- Organization claiming is comprehensive ✅
- Repository connection UI is intuitive ✅
- Database schema is well-designed ✅
- Webhook infrastructure is in place ✅

**For Phase 1.5, focus on:**
1. Workspace ID resolution (quick win, 1 hour)
2. lightfast.yml detection (medium, 3-4 hours)
3. Config status display (quick win, 2 hours)
4. Setup instructions/template (medium, 3-4 hours)

**Total effort for MVP: ~8-10 hours of engineering work**

The architecture is solid and ready to extend with configuration support.
