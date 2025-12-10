# Vercel Integration: Multi-Project Connection Flow Audit

**Date**: 2024-12-10
**Status**: Research Complete
**Next Step**: Implementation Plan

---

## Executive Summary

The current Vercel integration has a solid foundation (OAuth, webhooks, database schema) but lacks the critical UX flow for users to discover and select their Vercel projects. Users currently need to manually provide project IDs rather than browsing their available projects.

**Recommendation**: Implement a project selector UI that calls Vercel's `/v9/projects` API and allows multi-select project connection.

---

## Current Implementation Audit

### What Exists (Working)

| Component | Status | Location |
|-----------|--------|----------|
| OAuth Authorize | :white_check_mark: | `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts` |
| OAuth Callback | :white_check_mark: | `apps/console/src/app/(vercel)/api/vercel/callback/route.ts` |
| Webhook Handler | :white_check_mark: | `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` |
| User Source Storage | :white_check_mark: | `db/console/src/schema/tables/user-sources.ts` |
| Workspace Integration | :white_check_mark: | `db/console/src/schema/tables/workspace-integrations.ts` |
| Single Project Link | :white_check_mark: | `api/console/src/router/org/workspace.ts:893-998` |
| Webhook Signature Verify | :white_check_mark: | `packages/console-webhooks/src/vercel.ts:281-347` |

### What's Missing (Gaps)

| Component | Status | Impact |
|-----------|--------|--------|
| List User's Projects API | :x: Missing | Users can't browse available projects |
| Project Selector UI | :x: Missing | No multi-select interface |
| Bulk Project Linking | :x: Missing | Can only link one at a time |
| Project Disconnect UI | :x: Missing | No way to unlink projects |

---

## Database Architecture (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TWO-TIER INTEGRATION MODEL                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  lightfast_user_sources (User Level - OAuth Credentials)                    │
│  ───────────────────────────────────────────────────────                    │
│  - id: nanoid                                                               │
│  - userId: clerk user ID                                                    │
│  - provider: "vercel"                                                       │
│  - accessToken: encrypted OAuth token                                       │
│  - providerMetadata: { teamId, teamSlug, userId, configurationId }          │
│  - isActive: boolean                                                        │
│  - connectedAt: timestamp                                                   │
│                                                                             │
│  ONE user source per user per provider (unique constraint)                  │
│                                                                             │
│  lightfast_workspace_integrations (Workspace Level - Project Links)         │
│  ─────────────────────────────────────────────────────────────────          │
│  - id: nanoid                                                               │
│  - workspaceId: FK to orgWorkspaces (cascade delete)                        │
│  - userSourceId: FK to userSources (cascade delete)                         │
│  - connectedBy: clerk user ID                                               │
│  - providerResourceId: projectId (indexed for webhook lookups)              │
│  - sourceConfig: { projectId, projectName, teamId, sync: { events } }       │
│  - isActive: boolean                                                        │
│  - lastSyncedAt: timestamp                                                  │
│                                                                             │
│  MANY workspace integrations per workspace (one per connected project)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

RELATIONSHIP FLOW:
User → OAuth → userSource (1) → workspaceIntegrations (many) → Webhook lookup
```

---

## Vercel API Research

### Key Endpoints for Multi-Project Flow

#### 1. List Projects (Required)

```http
GET https://api.vercel.com/v9/projects
Authorization: Bearer {access_token}
Query: ?teamId={team_id}&limit=100
```

**Response**:
```json
{
  "projects": [
    {
      "id": "prj_xxx",
      "name": "my-app",
      "framework": "nextjs",
      "latestDeployments": [...],
      "targets": { "production": {...} }
    }
  ],
  "pagination": {
    "count": 20,
    "next": "cursor_value"
  }
}
```

#### 2. Get Single Project (Optional - for details)

```http
GET https://api.vercel.com/v9/projects/{projectId}
Authorization: Bearer {access_token}
```

#### 3. Webhook Events Available

- `deployment.created` - Deployment initiated
- `deployment.succeeded` - Build completed
- `deployment.ready` - Ready to serve traffic
- `deployment.error` - Deployment failed
- `deployment.canceled` - User canceled
- `project.created` - New project
- `project.removed` - Project deleted
- `integration-configuration.removed` - User removed integration

---

## Recommended Flow Design

### User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: CONNECT VERCEL (One Time)                                          │
│  ─────────────────────────────────                                          │
│                                                                             │
│  [Workspace Sources Page]                                                   │
│       │                                                                     │
│       ▼                                                                     │
│  User sees: "Connect Vercel" button                                         │
│       │                                                                     │
│       ▼                                                                     │
│  Click → Redirect to Vercel OAuth                                           │
│       │                                                                     │
│       ▼                                                                     │
│  User authorizes → Callback → userSource created                            │
│       │                                                                     │
│       ▼                                                                     │
│  Auto-open Project Selector modal                                           │
│                                                                             │
│  STEP 2: SELECT PROJECTS (Repeatable)                                       │
│  ────────────────────────────────────                                       │
│                                                                             │
│  [Project Selector Modal]                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Select Vercel Projects                            │   │
│  │  Choose which projects to connect to "My Workspace"                  │   │
│  │                                                                      │   │
│  │  □ my-marketing-site          Next.js    prod ●                     │   │
│  │  ☑ my-app-frontend            Next.js    prod ●                     │   │
│  │  ☑ my-api-backend             Node.js    prod ●                     │   │
│  │  □ staging-preview            Next.js    preview                     │   │
│  │  ✓ already-connected          Next.js    prod ●    [Connected]      │   │
│  │                                                                      │   │
│  │                         [Connect 2 Projects]                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  Click "Connect" → Bulk create workspaceIntegrations                        │
│       │                                                                     │
│       ▼                                                                     │
│  Success toast → Projects appear in Sources list                            │
│                                                                             │
│  STEP 3: MANAGE CONNECTED PROJECTS                                          │
│  ─────────────────────────────────                                          │
│                                                                             │
│  [Workspace Sources Page - Updated]                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Connected Sources                                                   │   │
│  │                                                                      │   │
│  │  ┌── Vercel ──────────────────────────────────────────────────────┐ │   │
│  │  │ my-app-frontend       ● Active    Last sync: 2 min ago    [⋮] │ │   │
│  │  │ my-api-backend        ● Active    Last sync: 5 min ago    [⋮] │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │                           [+ Add Projects]                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  STEP 4: WEBHOOKS PROCESS AUTOMATICALLY                                     │
│  ─────────────────────────────────────                                      │
│                                                                             │
│  Vercel deployment → Webhook with projectId                                 │
│       │                                                                     │
│       ▼                                                                     │
│  Query workspaceIntegrations WHERE providerResourceId = projectId           │
│       │                                                                     │
│       ▼                                                                     │
│  Process event → Update workspace activity                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌──────────────┐                    ┌───────────────────────────────────┐
│    User      │                    │          Vercel Platform          │
│  (Browser)   │                    │                                   │
└──────┬───────┘                    └─────────────────┬─────────────────┘
       │                                              │
       │ 1. Click "Connect Vercel"                    │
       ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│                          /api/vercel/authorize                           │
│  - Generate OAuth state with CSRF nonce                                  │
│  - Store state in cookie                                                 │
│  - Redirect to https://vercel.com/oauth/authorize                        │
└──────────────────────────────────────────────────────────────────────────┘
       │                                              │
       │ 2. User authorizes in Vercel UI              │
       │◄─────────────────────────────────────────────┤
       │                                              │
       ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│                          /api/vercel/callback                            │
│  - Validate state (CSRF protection)                                      │
│  - Exchange code for access_token                                        │
│  - Encrypt and store token in userSources                                │
│  - Redirect to success page                                              │
└──────────────────────────────────────────────────────────────────────────┘
       │                                              │
       │ 3. Open Project Selector                     │
       ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│                     tRPC: listVercelProjects                             │
│  - Decrypt access token from userSource                                  │
│  - Call GET https://api.vercel.com/v9/projects  ───────────────────────►│
│  - Get already-connected projects for workspace    │◄─────── projects[] │
│  - Return projects with isConnected status                               │
└──────────────────────────────────────────────────────────────────────────┘
       │                                              │
       │ 4. User selects projects, clicks Connect     │
       ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│                  tRPC: bulkLinkVercelProjects                            │
│  - Verify workspace ownership                                            │
│  - Verify userSource ownership                                           │
│  - Batch INSERT into workspaceIntegrations                               │
│  - Set providerResourceId = projectId for each                           │
└──────────────────────────────────────────────────────────────────────────┘
       │                                              │
       │                                              │ 5. Deployment occurs
       │                                              │
       │                                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        /api/vercel/webhooks                              │
│  - Verify signature (HMAC-SHA1)                   ◄───── POST webhook    │
│  - Extract projectId from payload                                        │
│  - Query: WHERE providerResourceId = projectId                           │
│  - Process event for matched workspace                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Requirements

### New tRPC Procedures

#### 1. `userSources.vercel.listProjects`

**Location**: `api/console/src/router/user/user-sources.ts`

**Purpose**: Fetch user's Vercel projects using stored OAuth token

```typescript
export const listVercelProjects = userProcedure
  .input(z.object({
    userSourceId: z.string(),
    workspaceId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // 1. Verify user owns this source
    const source = await ctx.db.query.userSources.findFirst({
      where: and(
        eq(userSources.id, input.userSourceId),
        eq(userSources.userId, ctx.user.id),
        eq(userSources.provider, "vercel"),
        eq(userSources.isActive, true),
      ),
    });

    if (!source) throw new TRPCError({ code: "NOT_FOUND" });

    // 2. Decrypt token
    const accessToken = decrypt(source.accessToken);

    // 3. Get team ID from metadata
    const teamId = source.providerMetadata?.teamId;

    // 4. Call Vercel API
    const url = new URL("https://api.vercel.com/v9/projects");
    if (teamId) url.searchParams.set("teamId", teamId);
    url.searchParams.set("limit", "100");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch Vercel projects",
      });
    }

    const data = await response.json();

    // 5. Get already-connected projects
    const connected = await ctx.db.query.workspaceIntegrations.findMany({
      where: and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.userSourceId, input.userSourceId),
        eq(workspaceIntegrations.isActive, true),
      ),
      columns: { providerResourceId: true },
    });

    const connectedIds = new Set(connected.map(c => c.providerResourceId));

    // 6. Return with connection status
    return {
      projects: data.projects.map((p: VercelProject) => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
        updatedAt: p.updatedAt,
        isConnected: connectedIds.has(p.id),
      })),
      pagination: data.pagination,
    };
  });
```

#### 2. `workspace.integrations.bulkLinkVercelProjects`

**Location**: `api/console/src/router/org/workspace.ts`

**Purpose**: Connect multiple projects to workspace in single operation

```typescript
export const bulkLinkVercelProjects = protectedProcedure
  .input(z.object({
    workspaceId: z.string(),
    userSourceId: z.string(),
    projects: z.array(z.object({
      projectId: z.string(),
      projectName: z.string(),
    })).min(1).max(50),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Verify workspace access
    const workspace = await verifyWorkspaceAccess(ctx, input.workspaceId);

    // 2. Verify user source ownership
    const source = await ctx.db.query.userSources.findFirst({
      where: and(
        eq(userSources.id, input.userSourceId),
        eq(userSources.userId, ctx.user.id),
        eq(userSources.provider, "vercel"),
      ),
    });

    if (!source) throw new TRPCError({ code: "NOT_FOUND" });

    // 3. Get existing connections to avoid duplicates
    const existing = await ctx.db.query.workspaceIntegrations.findMany({
      where: and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.userSourceId, input.userSourceId),
      ),
    });

    const existingIds = new Set(existing.map(e => e.providerResourceId));

    // 4. Filter to only new projects
    const newProjects = input.projects.filter(p => !existingIds.has(p.projectId));

    if (newProjects.length === 0) {
      return { created: 0, skipped: input.projects.length };
    }

    // 5. Batch insert
    const integrations = newProjects.map(p => ({
      id: createId(),
      workspaceId: input.workspaceId,
      userSourceId: input.userSourceId,
      connectedBy: ctx.user.id,
      providerResourceId: p.projectId,
      sourceConfig: {
        provider: "vercel" as const,
        type: "project" as const,
        projectId: p.projectId,
        projectName: p.projectName,
        teamId: source.providerMetadata?.teamId,
        teamSlug: source.providerMetadata?.teamSlug,
        configurationId: source.providerMetadata?.configurationId,
        sync: {
          events: [
            "deployment.created",
            "deployment.succeeded",
            "deployment.ready",
            "deployment.error",
            "deployment.canceled",
          ],
          autoSync: true,
        },
      },
      isActive: true,
    }));

    await ctx.db.insert(workspaceIntegrations).values(integrations);

    return {
      created: integrations.length,
      skipped: input.projects.length - newProjects.length,
    };
  });
```

### New UI Components

#### 1. `VercelProjectSelector`

**Location**: `apps/console/src/components/integrations/vercel-project-selector.tsx`

**Features**:
- Fetches projects from Vercel API via tRPC
- Shows checkbox list with project details (name, framework)
- Indicates already-connected projects
- Multi-select with "Select All" option
- Loading and error states
- Pagination for large project lists

#### 2. `ConnectVercelButton`

**Location**: `apps/console/src/components/integrations/connect-vercel-button.tsx`

**Features**:
- Opens OAuth flow in popup window
- Detects when popup closes
- Refetches user sources
- Opens project selector after successful connection

### Updated Pages

#### Sources Page Updates

**Location**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/`

**Changes**:
1. Show "Connect Vercel" if no userSource
2. Show "Add Projects" button if userSource exists
3. Group connected projects by provider
4. Add disconnect option per project

---

## Edge Cases to Handle

### OAuth Edge Cases

| Scenario | Handling |
|----------|----------|
| User denies OAuth | Redirect with `?error=access_denied` |
| Token expired | Re-prompt OAuth flow |
| Team vs Personal | Store `teamId` in metadata, use in API calls |
| Multiple Vercel accounts | Currently one per user (by design) |

### Project Selection Edge Cases

| Scenario | Handling |
|----------|----------|
| Project already connected | Show as disabled with "Connected" badge |
| Project connected to different workspace | Allow (projects can be in multiple workspaces) |
| 100+ projects | Implement pagination with load more |
| Network error fetching projects | Show error state with retry |

### Webhook Edge Cases

| Scenario | Handling |
|----------|----------|
| Project not connected | Log and ignore event |
| Multiple workspaces for same project | Process for all matching workspaces |
| Invalid signature | Return 401, log attempt |
| User disconnected integration | No match found, ignore event |

---

## Implementation Phases

### Phase 1: Core API (P0)

1. Add `listVercelProjects` tRPC procedure
2. Add `bulkLinkVercelProjects` tRPC mutation
3. Add types for Vercel API responses
4. Unit tests for new procedures

**Estimated effort**: 4-6 hours

### Phase 2: UI Components (P0)

1. Create `VercelProjectSelector` component
2. Create `ConnectVercelButton` component
3. Update Sources page layout
4. Add loading/error states

**Estimated effort**: 4-6 hours

### Phase 3: Polish (P1)

1. Add disconnect project functionality
2. Add refresh project list button
3. Add project search/filter
4. Improve empty states

**Estimated effort**: 2-3 hours

### Phase 4: Testing (P1)

1. E2E test for OAuth flow
2. E2E test for project selection
3. Integration test for webhooks
4. Manual testing with real Vercel account

**Estimated effort**: 2-3 hours

---

## Open Questions

1. **Should we support connecting the same project to multiple workspaces?**
   - Current design: Yes, allows it
   - Alternative: Warn user if project already connected elsewhere

2. **Should we auto-refresh the project list?**
   - Option A: Manual refresh button only
   - Option B: Auto-refresh on modal open
   - Option C: Cache for X minutes

3. **How to handle Vercel team switching?**
   - Current: One userSource per user, includes teamId
   - Issue: What if user is on multiple teams?
   - Suggestion: Allow multiple userSources per user (remove unique constraint)

4. **What happens when user removes integration from Vercel side?**
   - Webhook: `integration-configuration.removed` event
   - Action: Mark all related workspaceIntegrations as inactive?

---

## Related Files

### Core Implementation
- `api/console/src/router/user/user-sources.ts` - User source procedures
- `api/console/src/router/org/workspace.ts` - Workspace integration procedures
- `apps/console/src/app/(vercel)/` - Vercel OAuth routes
- `packages/console-webhooks/src/vercel.ts` - Webhook handling

### Database Schema
- `db/console/src/schema/tables/user-sources.ts`
- `db/console/src/schema/tables/workspace-integrations.ts`

### UI Components
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/`
- `apps/console/src/components/connected-sources-overview.tsx`

---

## References

- [Vercel Integration Documentation](https://vercel.com/docs/integrations/create-integration)
- [Vercel REST API - Projects](https://vercel.com/docs/rest-api/reference/endpoints/projects)
- [Vercel OAuth Guide](https://vercel.com/docs/sign-in-with-vercel/getting-started)
- [Vercel Webhooks Overview](https://vercel.com/docs/observability/webhooks-overview)
