# GitHub Integration Analysis: Lightfast Console vs. Vercel

**Date:** 2025-11-19
**Purpose:** Deep analysis of our GitHub integration flow compared to Vercel's architecture and industry best practices

---

## Table of Contents

1. [Vercel's Architecture (The Goal)](#vercels-architecture-the-goal)
2. [Our Current Implementation](#our-current-implementation)
3. [Security Analysis](#security-analysis)
4. [Gap Analysis](#gap-analysis)
5. [Recommended End-to-End Solution](#recommended-end-to-end-solution)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Vercel's Architecture (The Goal)

### How Vercel Handles GitHub Integration

**One-Time Connection, Persistent Access:**
1. User connects GitHub account once via OAuth
2. User installs Vercel GitHub App on one or more organizations
3. Installation IDs are stored in Vercel's database
4. User can access repositories from all installed organizations forever (until disconnected)
5. No re-authentication required when importing new projects

**Multi-Organization Support:**
- User can have Vercel installed on personal account + multiple orgs
- Each installation is independent but managed under one user account
- Can switch between organizations seamlessly
- One user → many GitHub installations → many repositories

**Key Characteristics:**
- **Persistent storage:** Installation IDs stored in database
- **Token lifecycle:** Short-lived user OAuth tokens for initial setup, long-lived installation access via GitHub App
- **Security:** Validates installation ownership via `/user/installations` API
- **Simplicity:** User never thinks about "installations" - just selects org and repo

---

## Our Current Implementation

### Current Flow

**Step 1: OAuth Authentication**
```
User clicks "Continue with GitHub"
  ↓
Popup opens → /api/github/auth
  ↓
Redirects to GitHub OAuth authorize
  ↓
User approves
  ↓
GitHub redirects → /api/github/callback
  ↓
Exchanges code for user access_token
  ↓
Stores token in httpOnly cookie (5-min expiry)
  ↓
Redirects to /new/auth-callback
  ↓
Sends "github-oauth-success" message to parent window
  ↓
Parent window receives message, fetches installations
```

**Step 2: Installation Discovery**
```
Frontend calls /api/github/installations
  ↓
Uses github_user_token cookie
  ↓
Calls GitHub API: GET /user/installations
  ↓
Returns list of installations
  ↓
User selects organization from dropdown
```

**Step 3: Repository Selection**
```
Frontend calls /api/github/repositories?installationId={id}
  ↓
Creates GitHub App installation token (1-hour expiry)
  ↓
Calls GitHub API: GET /installation/repositories
  ↓
Returns repository list
  ↓
User selects repository
```

**Step 4: Repository Import**
```
User clicks "Import" → redirects to /new/import
  ↓
Configures project settings (name, framework, etc.)
  ↓
Clicks "Import" button
  ↓
Calls tRPC: repository.connect mutation
  ↓
Stores in DB: githubRepoId, githubInstallationId, clerkOrgId
  ↓
Redirects to organization dashboard
```

### What We Store in Database

**DeusConnectedRepository table:**
```typescript
{
  id: string (nanoid)
  clerkOrgId: string           // Clerk organization ID
  githubRepoId: string         // GitHub's immutable repo ID (UNIQUE)
  githubInstallationId: string // GitHub App installation ID
  workspaceId: string          // Lightfast workspace ID
  configStatus: enum           // configured | unconfigured | ingesting | error | pending
  configPath: string?          // Path to lightfast.yml (if detected)
  metadata: jsonb              // Cached repo data (full_name, owner, etc.)
  isActive: boolean
  connectedAt: timestamp
  lastSyncedAt: timestamp
  // ... other fields
}
```

**What we DON'T store:**
- User's GitHub OAuth token (intentionally short-lived)
- GitHub App private key in DB (stored in env vars)
- Mutable repository data (fetched fresh from API)

### Current Strengths

✅ **Security-first approach:**
- CSRF protection with state parameter
- Webhook signature verification
- httpOnly cookies for tokens
- Short-lived user OAuth tokens (5 minutes)
- Never trust installation IDs from client URLs

✅ **Immutable data strategy:**
- Store githubRepoId (immutable) not repo name (mutable)
- Store githubInstallationId for installation-scoped access
- Fetch mutable data from API when needed

✅ **Clean architecture:**
- Separation of concerns (OAuth vs GitHub App tokens)
- Service layer for business logic
- tRPC for type-safe API calls
- Webhook handlers for GitHub events

✅ **Multi-organization support:**
- Users can install on multiple GitHub orgs
- Each org gets separate Clerk organization
- Proper isolation via workspaces

---

## Security Analysis

### What We Do Well

**1. OAuth Security**
- ✅ Random state parameter prevents CSRF attacks
- ✅ httpOnly cookies prevent XSS attacks
- ✅ Short token expiry (5 minutes) limits exposure
- ✅ Secure cookies in production (HTTPS-only)

**2. Webhook Security**
- ✅ HMAC-SHA256 signature verification
- ✅ Timing-safe comparison prevents timing attacks
- ✅ Validates webhook secret

**3. Installation Security**
- ✅ Uses GitHub App tokens (installation-scoped) not user tokens
- ✅ Cannot access repositories outside installation
- ✅ Installation tokens auto-expire (1 hour)

**4. Data Security**
- ✅ Uses immutable GitHub IDs (not names/slugs)
- ✅ Validates ownership before mutations
- ✅ Multi-tenant isolation via Clerk orgs

### Security Gaps & Improvements Needed

**1. Installation ID Validation** ⚠️
- **Current:** We trust installation IDs from client-side after OAuth
- **Issue:** Potential for manipulation if state is compromised
- **Fix:** After OAuth, call `/user/installations` and ONLY allow selecting from that list

**2. Token Storage** ⚠️
- **Current:** User OAuth token in httpOnly cookie (5-min expiry)
- **Issue:** Very short window to fetch installations
- **Consideration:** Should we extend expiry OR fetch installations server-side immediately after OAuth?

**3. Re-authentication** ⚠️
- **Current:** User must re-authenticate every time they want to add a new repo from a different installation
- **Issue:** Poor UX compared to Vercel (one-time auth)
- **Fix:** Store installation metadata in database after initial OAuth

---

## Gap Analysis

### What Vercel Does That We Don't

**1. Persistent Installation Storage**
- **Vercel:** Stores all user's GitHub installations in database
- **Us:** Only store installation ID when connecting specific repository
- **Impact:** User must re-authenticate to see available installations

**2. Installation Management UI**
- **Vercel:** Users can view all connected orgs, add/remove installations
- **Us:** No way to view or manage GitHub installations outside of import flow
- **Impact:** No visibility into connected organizations

**3. Installation Metadata**
- **Vercel:** Caches organization names, avatars, account types
- **Us:** Only cache repository metadata, not installation/org metadata
- **Impact:** Must fetch from GitHub API every time

**4. Proactive Installation Tracking**
- **Vercel:** Tracks when app is installed/uninstalled via webhooks
- **Us:** Only track repository-level events (push, rename, delete)
- **Impact:** If user installs app but never connects a repo, we have no record

### What We Do Better Than Minimum

**1. Immutable ID Strategy**
- ✅ Use githubRepoId instead of full_name (survives renames/transfers)
- ✅ No sync issues with stale data

**2. Config Detection**
- ✅ Auto-detect lightfast.yml configuration files
- ✅ Track config status in database
- ✅ Re-detect on push events

**3. Workspace Isolation**
- ✅ Multi-workspace support from day one
- ✅ Repository → Workspace assignment
- ✅ Default workspace auto-creation

---

## Recommended End-to-End Solution

### Architecture Goals

1. **Vercel-like UX:** One-time OAuth, persistent access to all installations
2. **Security-first:** Validate installation ownership, don't trust client data
3. **Multi-org support:** Users can manage multiple GitHub organizations
4. **Minimal re-auth:** Only re-authenticate when adding new installation, not when importing repos

### Proposed Database Schema Changes

**New Table: `githubInstallations`**
```typescript
{
  id: string (nanoid)
  userId: string                    // Clerk user ID who connected this
  githubInstallationId: string      // GitHub App installation ID (UNIQUE)
  githubAccountId: string           // GitHub account/org ID
  accountType: "User" | "Organization"
  accountLogin: string              // GitHub username or org slug
  avatarUrl: string
  permissions: jsonb                // GitHub App permissions granted
  isActive: boolean
  installedAt: timestamp            // When user first connected
  lastAccessedAt: timestamp         // Last time user accessed this installation
  lastValidatedAt: timestamp        // Last time we validated via /user/installations
  createdAt: timestamp
  updatedAt: timestamp
}

Indexes:
- user_id_idx: Fast user lookups
- installation_id_idx: Fast installation lookups (UNIQUE)
- user_active_idx: (userId, isActive)
```

**Update: `DeusConnectedRepository`**
```typescript
{
  // ... existing fields ...
  connectedByUserId: string         // NEW: Which user connected this repo
  installationRef: string FK        // NEW: Reference to githubInstallations.id
}
```

### Proposed API Flow Changes

**Flow 1: Initial OAuth + Installation Discovery (One-Time)**

```
1. User clicks "Continue with GitHub"
   ↓
2. OAuth flow (existing /api/github/auth + /api/github/callback)
   ↓
3. NEW: Server-side after OAuth callback:
   - Call GET /user/installations with user token
   - Store ALL installations in githubInstallations table
   - Associate with current user (Clerk userId)
   ↓
4. Redirect to /new with success message
   ↓
5. Frontend fetches installations from OUR database (not GitHub)
   - NEW endpoint: /api/installations (requires Clerk auth)
   - Returns user's saved installations
```

**Flow 2: Repository Import (Anytime, Forever)**

```
1. User opens /new page
   ↓
2. Frontend calls /api/installations (Clerk authenticated)
   - Returns installations from OUR database
   - No GitHub API call needed!
   ↓
3. User selects organization from dropdown
   ↓
4. Frontend calls /api/github/repositories?installationId={id}
   - Validates user owns this installation (check DB)
   - Creates GitHub App installation token
   - Fetches repositories from GitHub
   ↓
5. User selects repository and imports
   (existing flow)
```

**Flow 3: Add New Organization (Rare)**

```
1. User clicks "Add another organization"
   ↓
2. Opens GitHub App installation URL in popup
   - https://github.com/apps/lightfastai-dev/installations/new
   ↓
3. GitHub redirects to /api/github/setup after installation
   ↓
4. NEW: Setup handler:
   - Validates user authentication (Clerk)
   - Stores new installation in githubInstallations table
   - Redirects back to /new
   ↓
5. Frontend refreshes installation list
```

**Flow 4: Validate Installation Ownership (Periodic)**

```
Run periodic validation (e.g., when user accesses /new):

1. Check lastValidatedAt for user's installations
   ↓
2. If > 24 hours old:
   - Refresh user OAuth token (if expired)
   - Call GET /user/installations
   - Compare with stored installations
   - Mark removed installations as inactive
   - Add any new installations
   ↓
3. Update lastValidatedAt timestamps
```

### New API Endpoints

**GET /api/installations**
```typescript
// Returns user's GitHub installations from database
Response: {
  installations: [
    {
      id: string                    // Our internal ID
      githubInstallationId: string
      accountLogin: string
      accountType: "User" | "Organization"
      avatarUrl: string
      installedAt: timestamp
      isActive: boolean
    }
  ]
}

Auth: Clerk user authentication required
Source: Our database (githubInstallations table)
```

**POST /api/installations/validate**
```typescript
// Validates user's installations against GitHub API
// Called automatically on /new page load if stale

Request: {} (empty, uses Clerk auth)

Flow:
1. Get user's OAuth token (or refresh if needed)
2. Call GET /user/installations
3. Reconcile with database
4. Return updated list

Response: {
  installations: [...],
  added: number,
  removed: number
}
```

**POST /api/installations/add**
```typescript
// Manually trigger installation addition
// Used after user installs app on new org

Request: {
  githubInstallationId: string
}

Flow:
1. Validate user has access (call GET /user/installations)
2. If found in user's installations, add to database
3. Return success

Response: {
  installation: {...}
}
```

**DELETE /api/installations/:id**
```typescript
// Remove installation from user's saved list
// Does NOT uninstall from GitHub (user does that on GitHub.com)

Request: {} (ID in URL)

Flow:
1. Validate ownership (check userId in DB)
2. Mark isActive = false
3. Mark all connected repositories as inactive

Response: { success: true }
```

### Updated Frontend Flow

**New Page: `/new/page.tsx` (Updated)**

```typescript
"use client";

export default function NewProjectPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // On mount: Load installations from database
  useEffect(() => {
    loadInstallations();
  }, []);

  async function loadInstallations() {
    const response = await fetch("/api/installations");
    const data = await response.json();
    setInstallations(data.installations);
    setIsConnected(data.installations.length > 0);

    // Auto-validate if stale (> 24 hours)
    const needsValidation = data.installations.some(
      i => Date.now() - new Date(i.lastValidatedAt).getTime() > 24 * 60 * 60 * 1000
    );

    if (needsValidation && !isValidating) {
      validateInstallations();
    }
  }

  async function validateInstallations() {
    setIsValidating(true);
    const response = await fetch("/api/installations/validate", { method: "POST" });
    const data = await response.json();
    setInstallations(data.installations);
    setIsValidating(false);
  }

  async function handleOAuthClick() {
    // Open OAuth popup (existing flow)
    const popup = window.open("/api/github/auth", "github-oauth", "width=600,height=800");

    window.addEventListener("message", async (event) => {
      if (event.data === "github-oauth-success") {
        popup?.close();
        await loadInstallations(); // Refresh from database
      }
    });
  }

  async function handleAddOrganization() {
    // Open GitHub App installation page
    const popup = window.open(
      "https://github.com/apps/lightfastai-dev/installations/new",
      "github-install",
      "width=600,height=800"
    );

    // Poll or listen for setup completion
    const interval = setInterval(async () => {
      const response = await fetch("/api/installations/validate", { method: "POST" });
      const data = await response.json();
      if (data.added > 0) {
        clearInterval(interval);
        await loadInstallations();
        popup?.close();
      }
    }, 2000);
  }

  if (!isConnected) {
    return (
      <div>
        <h1>Connect GitHub</h1>
        <Button onClick={handleOAuthClick}>Continue with GitHub</Button>
      </div>
    );
  }

  return (
    <div>
      <h1>Import Repository</h1>

      <Select
        value={selectedInstallation}
        onValueChange={setSelectedInstallation}
      >
        {installations.map(i => (
          <SelectItem key={i.id} value={i.githubInstallationId}>
            {i.accountLogin}
          </SelectItem>
        ))}
      </Select>

      <Button onClick={handleAddOrganization}>
        Add another organization
      </Button>

      {selectedInstallation && (
        <RepositoryList installationId={selectedInstallation} />
      )}
    </div>
  );
}
```

### Updated tRPC Procedures

**New: `installation` router**

```typescript
// api/console/src/router/installation.ts

export const installationRouter = {
  list: protectedProcedure
    .query(async ({ ctx }) => {
      // Return user's GitHub installations from database
      const installations = await ctx.db
        .select()
        .from(githubInstallations)
        .where(
          and(
            eq(githubInstallations.userId, ctx.session.userId),
            eq(githubInstallations.isActive, true)
          )
        );

      return installations;
    }),

  validate: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 1. Get user's OAuth token (refresh if needed)
      const userToken = await getUserOAuthToken(ctx.session.userId);

      // 2. Fetch installations from GitHub
      const githubInstallations = await getUserInstallations(userToken);

      // 3. Reconcile with database
      const currentIds = new Set(
        githubInstallations.installations.map(i => String(i.id))
      );

      // Mark removed installations as inactive
      await ctx.db
        .update(githubInstallations)
        .set({ isActive: false })
        .where(
          and(
            eq(githubInstallations.userId, ctx.session.userId),
            not(inArray(githubInstallations.githubInstallationId, [...currentIds]))
          )
        );

      // Add new installations
      const existing = await ctx.db
        .select({ githubInstallationId: githubInstallations.githubInstallationId })
        .from(githubInstallations)
        .where(eq(githubInstallations.userId, ctx.session.userId));

      const existingIds = new Set(existing.map(i => i.githubInstallationId));

      const newInstallations = githubInstallations.installations
        .filter(i => !existingIds.has(String(i.id)))
        .map(i => ({
          id: nanoid(),
          userId: ctx.session.userId,
          githubInstallationId: String(i.id),
          githubAccountId: String(i.account.id),
          accountType: i.account.type,
          accountLogin: i.account.login,
          avatarUrl: i.account.avatar_url,
          permissions: i.permissions,
          isActive: true,
          installedAt: new Date(),
          lastValidatedAt: new Date(),
        }));

      if (newInstallations.length > 0) {
        await ctx.db.insert(githubInstallations).values(newInstallations);
      }

      // Update lastValidatedAt for all active installations
      await ctx.db
        .update(githubInstallations)
        .set({ lastValidatedAt: new Date() })
        .where(
          and(
            eq(githubInstallations.userId, ctx.session.userId),
            eq(githubInstallations.isActive, true)
          )
        );

      return {
        added: newInstallations.length,
        removed: currentIds.size - existingIds.size,
      };
    }),

  disconnect: protectedProcedure
    .input(z.object({ installationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify ownership
      const installation = await ctx.db
        .select()
        .from(githubInstallations)
        .where(
          and(
            eq(githubInstallations.id, input.installationId),
            eq(githubInstallations.userId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!installation[0]) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // 2. Mark installation as inactive
      await ctx.db
        .update(githubInstallations)
        .set({ isActive: false })
        .where(eq(githubInstallations.id, input.installationId));

      // 3. Mark all connected repositories as inactive
      await ctx.db
        .update(DeusConnectedRepository)
        .set({ isActive: false })
        .where(
          eq(
            DeusConnectedRepository.githubInstallationId,
            installation[0].githubInstallationId
          )
        );

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
```

### OAuth Token Management

**Challenge:** We need user OAuth tokens for `/user/installations` API, but we currently discard them after 5 minutes.

**Solution Options:**

**Option 1: Extend Cookie Expiry**
- Store user token in httpOnly cookie for 24-48 hours
- Use for periodic validation
- Cons: Token in browser longer (security tradeoff)

**Option 2: Server-Side Token Storage**
- Store encrypted tokens in database
- Refresh when needed
- Cons: More complex, need encryption key management

**Option 3: Just-In-Time OAuth** (RECOMMENDED)
- When user visits /new, check if validation needed
- If needed, trigger OAuth flow again (seamless popup)
- Store installations immediately
- Cons: Occasional re-auth, but transparent to user

**Recommendation:** Option 3 with smart caching
- Cache installations in database (already proposed)
- Only re-validate if > 24 hours old
- Most visits won't need OAuth
- When needed, OAuth happens in background popup

---

## Implementation Roadmap

### Phase 1: Database Foundation (Week 1)

**1.1 Create Migration**
- [ ] Create `githubInstallations` table
- [ ] Add `connectedByUserId` to `DeusConnectedRepository`
- [ ] Add `installationRef` FK to `DeusConnectedRepository`
- [ ] Run migration

**1.2 Update Schema Types**
- [ ] Generate new Drizzle types
- [ ] Update TypeScript imports
- [ ] Add validation schemas (Zod)

**1.3 Create Service Layer**
- [ ] `InstallationsService.create()`
- [ ] `InstallationsService.findByUserId()`
- [ ] `InstallationsService.findByGithubId()`
- [ ] `InstallationsService.validateOwnership()`
- [ ] `InstallationsService.markInactive()`

### Phase 2: Backend API (Week 1-2)

**2.1 Update OAuth Callback**
- [ ] After token exchange, fetch `/user/installations`
- [ ] Store all installations in database
- [ ] Associate with current user
- [ ] Return success

**2.2 Create Installation Endpoints**
- [ ] `GET /api/installations` - list user's installations
- [ ] `POST /api/installations/validate` - sync with GitHub
- [ ] `DELETE /api/installations/:id` - disconnect installation

**2.3 Create tRPC Router**
- [ ] `installation.list` query
- [ ] `installation.validate` mutation
- [ ] `installation.disconnect` mutation

**2.4 Update Setup Handler**
- [ ] `/api/github/setup` should store installation immediately
- [ ] Associate with authenticated user
- [ ] Return to /new with success

### Phase 3: Frontend Updates (Week 2)

**3.1 Update New Page**
- [ ] Fetch installations from database (not GitHub API)
- [ ] Add "Add another organization" button
- [ ] Show installation list with avatars
- [ ] Handle OAuth success message
- [ ] Auto-validate if stale

**3.2 Add Installation Management UI**
- [ ] Settings page: `/settings/integrations/github`
- [ ] List all connected installations
- [ ] Show last validated timestamp
- [ ] "Disconnect" button per installation
- [ ] "Validate now" button

**3.3 Update Repository List**
- [ ] Validate installation ownership before fetching repos
- [ ] Show error if user doesn't own installation
- [ ] Handle installation not found gracefully

### Phase 4: Webhook Updates (Week 2)

**4.1 Handle Installation Events**
- [ ] `installation.created` → add to user's installations
- [ ] `installation.deleted` → mark inactive + mark repos inactive
- [ ] `installation.suspend` → mark inactive
- [ ] `installation.unsuspend` → mark active

**4.2 Installation Repositories Events**
- [ ] `installation_repositories.added` → refresh available repos
- [ ] `installation_repositories.removed` → mark repos inactive

### Phase 5: Testing & Validation (Week 3)

**5.1 Security Testing**
- [ ] Test CSRF protection
- [ ] Test installation ownership validation
- [ ] Test webhook signature verification
- [ ] Test token expiration handling

**5.2 Flow Testing**
- [ ] Fresh user OAuth flow
- [ ] Multi-org installation flow
- [ ] Repository import flow
- [ ] Disconnect flow
- [ ] Re-validate flow

**5.3 Edge Cases**
- [ ] Installation deleted on GitHub (not via our UI)
- [ ] User loses access to org
- [ ] Token expired/invalid
- [ ] Network errors during OAuth

### Phase 6: Migration & Rollout (Week 3-4)

**6.1 Data Migration**
- [ ] Script to backfill `githubInstallations` from existing repositories
- [ ] Associate with repository creator (connectedByUserId)
- [ ] Validate data integrity

**6.2 Feature Flag**
- [ ] Add feature flag for new flow
- [ ] Enable for internal testing
- [ ] Enable for beta users
- [ ] Enable for all users

**6.3 Monitoring**
- [ ] Track OAuth success/failure rates
- [ ] Track installation validation frequency
- [ ] Track API errors
- [ ] Set up alerts for failures

---

## Success Metrics

**User Experience:**
- [ ] Time from "Connect GitHub" to "Import Repository" < 30 seconds
- [ ] Number of OAuth flows per user per month < 2
- [ ] Repository import success rate > 95%

**Security:**
- [ ] Zero installation ownership bypass incidents
- [ ] Zero CSRF incidents
- [ ] 100% webhook signature validation

**Performance:**
- [ ] Installation list load time < 500ms (database)
- [ ] Repository list load time < 2s (GitHub API)
- [ ] Validation check time < 3s (GitHub API)

---

## Questions & Decisions

### Q1: Should we support GitHub OAuth App AND GitHub App?

**Background:** Some platforms use OAuth App for user auth + GitHub App for installation access (hybrid approach).

**Current:** We only use GitHub App with OAuth flow enabled.

**Decision:** Stick with GitHub App only. Simpler architecture, better permissions model.

### Q2: How often should we validate installations?

**Options:**
- A) On every page load (expensive, but always fresh)
- B) Every 24 hours (balanced)
- C) Only when user manually refreshes (lazy)

**Recommendation:** Option B with manual refresh button. Background validation every 24 hours, plus manual button in settings.

### Q3: Should we store user OAuth tokens long-term?

**Trade-offs:**
- **Yes:** Can validate anytime without re-auth
- **No:** Reduces security risk, smaller blast radius

**Recommendation:** No. Use just-in-time OAuth when validation needed (>24h since last).

### Q4: What happens if user uninstalls app on GitHub?

**Webhook Flow:**
1. GitHub sends `installation.deleted` webhook
2. We mark installation as inactive
3. We mark all connected repositories as inactive
4. Repositories disappear from user's dashboard
5. Ingestion stops for those repositories

**User Flow:**
1. User sees "GitHub connection lost" message
2. User clicks "Reconnect"
3. Re-installs GitHub App
4. New installation created
5. Re-connect repositories

### Q5: Can multiple users share one installation?

**Scenario:** Org has 3 team members, all want to connect repositories.

**Current Approach:** Each user goes through OAuth → each gets copy of installation in their list.

**Better Approach:** Store at org level, not user level.

**New Table: `organizationGithubInstallations`**
```typescript
{
  id: string
  clerkOrgId: string               // Clerk org
  githubInstallationId: string     // GitHub installation
  connectedByUserId: string        // First user who connected
  isActive: boolean
}
```

**Trade-off:** More complex, but better for team collaboration.

**Recommendation:** Start with user-level (simpler), upgrade to org-level in Phase 2.

---

## Conclusion

**Current State:**
- ✅ Secure OAuth flow
- ✅ Proper GitHub App integration
- ✅ Immutable ID strategy
- ⚠️ Re-authentication required too often
- ⚠️ No installation management UI
- ⚠️ No persistent installation storage

**Target State:**
- ✅ Vercel-like UX: one-time OAuth, persistent access
- ✅ Multi-org support out of the box
- ✅ Installation management UI
- ✅ Secure validation via `/user/installations`
- ✅ Database-backed installation list (fast!)

**Next Steps:**
1. Review and approve this proposal
2. Create GitHub issues for Phase 1 tasks
3. Begin database migration work
4. Implement backend endpoints
5. Update frontend
6. Test and deploy

**Estimated Timeline:** 3-4 weeks for full implementation and testing.

---

**Document Status:** Draft for Review
**Last Updated:** 2025-11-19
**Author:** Claude Code
**Reviewers:** @jeevanpillay
