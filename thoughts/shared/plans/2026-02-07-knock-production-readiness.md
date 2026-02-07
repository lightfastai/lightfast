# Knock Notification Production Readiness Implementation Plan

## Overview

Fix three critical issues blocking production deployment of the Knock notification integration: (1) Clerk member pagination bug that silently drops notifications for orgs with >10 members, (2) change notification routing from org-level to workspace-level so preferences/batching are scoped per-workspace, (3) add `KNOCK_SIGNING_KEY` to turbo.json. Also enrich the Knock data payload with `workspaceName` for human-readable email templates.

## Current State Analysis

The Phase 1+2 Knock integration is architecturally sound — proper vendor abstraction (`@vendor/knock`), server/client separation, t3-env validation, Inngest step isolation, and secure token management. However, three issues prevent production deployment:

1. **Clerk pagination bug** (`dispatch.ts:73`): `getOrganizationMembershipList` called without `limit` — Clerk defaults to 10 members per page. Orgs with >10 members silently lose notifications. The same pattern exists in 4 other call sites.
2. **Org-level routing**: `tenant: clerkOrgId` scopes notifications at the org level. Since observations are workspace-specific (backfill, GitHub webhooks), preferences/batching should be per-workspace.
3. **turbo.json gap**: `KNOCK_SIGNING_KEY` missing from `globalEnv` array while the other two Knock vars are present.

### Key Discoveries:
- `dispatch.ts:73` — no pagination on Clerk `getOrganizationMembershipList`
- `dispatch.ts:134` — `tenant: clerkOrgId` should be `tenant: workspaceId`
- `dispatch.ts:135-142` — data payload lacks `workspaceName`
- `turbo.json:132-134` — `KNOCK_SIGNING_KEY` not listed
- `router/user/organization.ts:28`, `router/user/workspace.ts:56,129`, `router/org/workspace.ts:77,243` — same pagination bug
- `observation-capture.ts:1057` — `workspaceId` already propagated in event data
- `db/console/src/schema/tables/org-workspaces.ts:59` — `name` column available for lookup
- `notification-preferences.tsx:104` — "Batched emails every 5 minutes" hardcoded in UI

## Desired End State

After this plan is complete:

1. All Clerk `getOrganizationMembershipList` calls across the codebase paginate correctly (no silent member drops)
2. Knock notifications are scoped per-workspace (`tenant: workspaceId`), enabling per-workspace preference management
3. Knock data payload includes `workspaceName` for human-readable email templates
4. `KNOCK_SIGNING_KEY` is registered in `turbo.json` globalEnv
5. Token signing includes explicit `expiresInSeconds` for clarity

### Verification:
- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm build:console` succeeds
- Notification dispatch correctly fetches ALL org members (>10 member test)
- Knock triggers use `workspaceId` as tenant
- Knock data payload includes `workspaceName`

## What We're NOT Doing

- CI/CD automation for Knock workflow promotion (manual dashboard promotion is sufficient)
- Domain verification setup (already verified)
- Resend channel reconfiguration (already working)
- Per-workflow notification preferences UI (future enhancement)
- React Email templates (using Knock templates)
- Enhanced security mode changes (already configured)
- Knock dashboard workflow changes (templates updated separately)

## Implementation Approach

Three focused phases:
1. Fix Clerk pagination across all call sites (biggest risk)
2. Change notification routing to workspace-level + add workspaceName
3. Config fixes (turbo.json, token expiration)

---

## Phase 1: Fix Clerk Pagination Across All Call Sites

### Overview
Add `limit: 100` to all `getOrganizationMembershipList` calls. For the notification dispatch, implement a full pagination loop to guarantee all members receive notifications. Other call sites get the simpler `limit: 100` fix since they're used in UI contexts where >100 members is extremely unlikely for current customers.

### Changes Required:

#### 1. Notification Dispatch — Full Pagination
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts`
**Lines**: 70-108
**Changes**: Replace the single Clerk fetch with a pagination loop

Replace the fetch-org-members step with a paginated version:

```typescript
// Fetch ALL organization members from Clerk (paginated)
const orgMembers = await step.run("fetch-org-members", async () => {
  try {
    const clerk = await clerkClient();
    const allRecipients: Array<{ id: string; email: string; name: string | undefined }> = [];
    let offset = 0;
    const limit = 100;

    // Paginate through all org members
    while (true) {
      const membershipList = await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
        limit,
        offset,
      });

      const recipients = membershipList.data
        .filter((membership) =>
          membership.publicUserData?.userId &&
          membership.publicUserData?.identifier
        )
        .map((membership) => {
          const userData = membership.publicUserData!;
          return {
            id: userData.userId!,
            email: userData.identifier!,
            name: userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : userData.firstName || undefined,
          };
        });

      allRecipients.push(...recipients);

      // Stop if we got fewer results than the limit (last page)
      if (membershipList.data.length < limit) {
        break;
      }
      offset += limit;
    }

    log.info("Fetched org members for notification", {
      clerkOrgId,
      memberCount: allRecipients.length,
    });

    return allRecipients;
  } catch (error) {
    log.error("Failed to fetch org members from Clerk", {
      clerkOrgId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
```

#### 2. User Organization Router
**File**: `api/console/src/router/user/organization.ts`
**Line**: 28
**Changes**: Add `limit: 100` to `getOrganizationMembershipList`

```typescript
const { data: memberships } =
  await clerk.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  });
```

#### 3. User Workspace Router — Two Call Sites
**File**: `api/console/src/router/user/workspace.ts`
**Lines**: 56 and 129
**Changes**: Add `limit: 100` to both calls

At line ~56:
```typescript
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrg.id,
  limit: 100,
});
```

At line ~129:
```typescript
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrg.id,
  limit: 100,
});
```

#### 4. Org Workspace Router — Two Call Sites
**File**: `api/console/src/router/org/workspace.ts`
**Lines**: 77 and 243
**Changes**: Add `limit: 100` to both calls

At line ~77:
```typescript
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: input.clerkOrgId,
  limit: 100,
});
```

At line ~243:
```typescript
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: input.clerkOrgId,
  limit: 100,
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Notification dispatch correctly fetches all members (test with Inngest dev dashboard)
- [ ] Organization listing still works in the UI
- [ ] Workspace access checks still function correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Workspace-Level Notification Routing + workspaceName

### Overview
Change the Knock tenant from `clerkOrgId` to `workspaceId` so preferences and batching are scoped per-workspace. Add a DB lookup to include `workspaceName` in the data payload for human-readable email templates.

### Changes Required:

#### 1. Add workspaceName Lookup and Change Tenant
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts`
**Changes**:
- Add import for `db`, `orgWorkspaces`, `eq` from drizzle
- Add a step to look up workspace name before the Knock trigger
- Change `tenant` from `clerkOrgId` to `workspaceId`
- Add `workspaceName` to the data payload

Add imports at top of file:
```typescript
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
```

Add workspace lookup step BEFORE the "trigger-knock-workflow" step (after the orgMembers guard):
```typescript
// Look up workspace name for human-readable templates
const workspaceName = await step.run("lookup-workspace-name", async () => {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { name: true },
  });
  return workspace?.name ?? workspaceId;
});
```

Modify the Knock trigger step to use `workspaceId` as tenant and include `workspaceName`:
```typescript
await step.run("trigger-knock-workflow", async () => {
  if (!notifications) return;

  await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
    recipients: orgMembers,
    tenant: workspaceId,  // Changed from clerkOrgId — scopes preferences per-workspace
    data: {
      observationId,
      observationType,
      significanceScore,
      topics: topics ?? [],
      clusterId,
      workspaceId,
      workspaceName,  // Human-readable workspace name for templates
    },
  });

  log.info("Knock notification triggered", {
    workspaceId,
    workspaceName,
    observationId,
    clerkOrgId,
    recipientCount: orgMembers.length,
    significanceScore,
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Knock trigger in Inngest dev dashboard shows `tenant: workspaceId` (not clerkOrgId)
- [ ] Knock trigger data payload includes `workspaceName`
- [ ] Notification preferences in the workspace settings page still function correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Config Fixes

### Overview
Add `KNOCK_SIGNING_KEY` to turbo.json globalEnv for cache invalidation consistency. Add explicit token expiration to the signing call for clarity.

### Changes Required:

#### 1. Add KNOCK_SIGNING_KEY to turbo.json
**File**: `turbo.json`
**Line**: 134 (after `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`)
**Changes**: Add `KNOCK_SIGNING_KEY` to the Notifications section

```json
// Notifications
"KNOCK_API_KEY",
"KNOCK_SIGNING_KEY",
"NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY",
```

#### 2. Add Explicit Token Expiration
**File**: `api/console/src/router/user/notifications.ts`
**Lines**: 8-10
**Changes**: Add `expiresInSeconds` parameter for documentation clarity

```typescript
const token = await signUserToken(ctx.auth.userId, {
  signingKey: env.KNOCK_SIGNING_KEY,
  expiresInSeconds: 3600, // 1 hour — client refetches every 5 min via staleTime
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Token signing still works (bell icon loads, notifications appear)
- [ ] `turbo.json` includes all three Knock env vars in the Notifications section

---

## Testing Strategy

### Unit Tests:
- No new unit tests required — changes are to existing code paths

### Integration Tests:
- End-to-end: GitHub push → observation captured (score >= 70) → notification dispatch → Knock workflow triggered with `tenant: workspaceId` and `workspaceName` in payload

### Manual Testing Steps:
1. Start dev server with `pnpm dev:app`
2. Trigger an observation with `significanceScore >= 70`
3. Verify in Inngest dashboard that `notification.dispatch` runs successfully
4. Verify in Knock dashboard that the workflow trigger shows:
   - `tenant` = workspaceId (not clerkOrgId)
   - `data.workspaceName` = human-readable name
5. Verify notification appears in bell icon feed
6. Navigate to workspace Settings > Notifications and toggle email preference
7. Trigger another notification — verify preference is respected

## Performance Considerations

- Pagination loop in dispatch adds ~1 API call per 100 members. For current customer sizes (<50 members), this means 1 call (no regression).
- Workspace name lookup is a single indexed DB query on primary key — negligible overhead.
- `limit: 100` on other call sites doesn't change behavior for orgs with <100 members.

## Migration Notes

- No database migrations needed
- Changing `tenant` from `clerkOrgId` to `workspaceId` in Knock means existing preferences stored against the old tenant will not carry over. Since this is pre-production, there is no data to migrate.
- If Knock dashboard templates reference `{{ tenant }}`, they'll now receive `workspaceId` instead of `clerkOrgId`. Update templates accordingly.

## Knock Dashboard Configuration (Manual — Not Automated)

Before production deployment:

1. **Verify workflow exists**: Dashboard > Workflows > `observation-captured`
2. **Update email template** to use `{{ data.workspaceName }}` for workspace display
3. **Commit changes** in Development environment
4. **Promote to Production**: Dashboard > Commits > Promote
5. **Configure Resend channel** in Production environment (API key, from address)
6. **Set default notification preferences** per-workflow

## References

- Research: `thoughts/shared/research/2026-02-07-knock-prod-validation-architecture-design.md`
- Research: `thoughts/shared/research/2026-02-07-knock-prod-validation-codebase-deep-dive.md`
- Research: `thoughts/shared/research/2026-02-07-knock-prod-validation-external-research.md`
- Phase 1 Plan: `thoughts/shared/plans/2026-02-06-knock-notification-integration-phase-1.md`
- Dispatch workflow: `api/console/src/inngest/workflow/notifications/dispatch.ts:25-161`
- Workspace schema: `db/console/src/schema/tables/org-workspaces.ts:35-121`
- Notification preferences UI: `apps/console/.../settings/notifications/_components/notification-preferences.tsx`
- turbo.json: `turbo.json:132-134`
- Token signing: `api/console/src/router/user/notifications.ts:1-13`
