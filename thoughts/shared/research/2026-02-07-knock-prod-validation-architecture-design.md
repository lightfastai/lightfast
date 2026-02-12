---
date: 2026-02-07
researcher: architect-agent
topic: "Knock Notification Integration - Production Validation"
tags: [research, architecture, knock, notifications, production]
status: complete
based_on:
  - 2026-02-07-knock-prod-validation-codebase-deep-dive.md
  - 2026-02-07-knock-prod-validation-external-research.md
---

# Production Validation: Knock Notification Integration

## Executive Summary

The Knock notification integration (Phase 2) is **architecturally sound** with proper vendor abstractions, server/client separation, and secure token management. The codebase follows established patterns (`@vendor/knock`, t3-env validation, Inngest step isolation) and the security posture is strong with no secret leakage, no PII in payloads, and properly scoped auth boundaries.

However, **one critical bug** and several medium-priority issues must be addressed before production deployment:

- **CRITICAL**: Clerk `getOrganizationMembershipList` lacks pagination — organizations with >10 members will silently lose notifications for members beyond the first page
- **MEDIUM**: `KNOCK_SIGNING_KEY` missing from `turbo.json` globalEnv
- **MEDIUM**: No explicit token expiration set on signed user tokens
- **LOW**: Hardcoded feed channel ID (`lightfast-console-notifications`)
- **LOW**: Unused `apps-console/notification.dispatch` event schema in Inngest client

**Template strategy**: Use Knock templates (not React Email) — batch variables, preference integration, and multi-channel parity make this the clear choice.

**Production readiness**: CONDITIONAL PASS — fix the pagination bug, then deploy following the runbook below.

---

## 1. Production Configuration Checklist

### Environment Variables

| Variable | Type | Where Used | Required | Source |
|----------|------|------------|----------|--------|
| `KNOCK_API_KEY` | Server secret | `@vendor/knock` server client, Inngest dispatch | **Yes** | Knock Dashboard > Developers > API Keys > **Production** secret key (`sk_...`) |
| `KNOCK_SIGNING_KEY` | Server secret | tRPC `notifications.getToken` endpoint | **Yes** | Knock Dashboard > Developers > Signing keys > Base-64 encoded PEM format |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | Client public | `KnockProvider`, `NotificationTrigger` | **Yes** | Knock Dashboard > Developers > API Keys > **Production** public key (`pk_...`) |

**Important notes**:
- Production keys are **separate** from development keys — Knock enforces complete environment isolation
- `KNOCK_SIGNING_KEY` must be the **base-64 encoded PEM** (single-line) format, NOT the multi-line PEM. Wrong format causes: `"secretOrPrivateKey must be an asymmetric key when using RS256"`
- All three variables must be set in Vercel dashboard for production (not `.env` files)
- `KNOCK_SERVICE_TOKEN` is only needed for CLI/CI/CD operations, not runtime

### Knock Dashboard Configuration

- [ ] **Step 1: Verify Production Environment Exists**
  - Dashboard > Settings > Environments — confirm "Production" environment is listed
  - If only "Development" exists, Production is the default second environment

- [ ] **Step 2: Configure Resend Email Channel (Production)**
  - Dashboard > Channels and sources > Select Resend channel
  - Click "Manage configuration" and select **Production** environment
  - Set Resend API key (production key from Resend dashboard)
  - Set "From" email address (must match verified Resend domain)
  - Set "From" name (e.g., "Lightfast")
  - **Disable sandbox mode** for production
  - Consider enabling open/link-click tracking for analytics
  - Optionally configure delivery status webhooks (Resend > Knock)

- [ ] **Step 3: Configure In-App Feed Channel**
  - Dashboard > Channels and sources > Verify in-app feed channel exists
  - Channel ID must be `lightfast-console-notifications` (hardcoded in `vendor/knock/src/components/provider.tsx:12`)
  - Ensure channel is active in Production environment

- [ ] **Step 4: Verify Domain in Resend**
  - Resend Dashboard > Domains > Verify sending domain is "Verified" status
  - SPF and DKIM records must be properly configured in DNS
  - DMARC record recommended for deliverability

- [ ] **Step 5: Enable Enhanced Security Mode (Production)**
  - Dashboard > Platform > API Keys > Enable enhanced security
  - This requires client-side requests to include the signed JWT user token
  - The codebase already supports this — `ConsoleNotificationsProvider` fetches tokens via tRPC
  - **Note**: Can be deferred if in-app feed is not yet active in production

- [ ] **Step 6: Set Default Notification Preferences**
  - Dashboard > Workflow > `observation-captured` > Default preferences
  - Configure per-channel defaults (email on/off, in-app on/off)
  - These defaults apply to users who haven't set explicit preferences

- [ ] **Step 7: Verify Resend Tier**
  - Free tier: 100 emails/day — likely insufficient for production
  - Pro tier ($20/mo): 50,000 emails/month — recommended minimum
  - Check expected notification volume against tier limits

### Workflow Promotion

Knock workflows are version-controlled content that must be committed in Development and promoted to Production.

1. **Verify workflow exists in Development**: Dashboard > Workflows > `observation-captured`
2. **Review workflow steps**: Ensure email step, batch window (5 min), and in-app step are configured
3. **Commit changes**: Dashboard > Commits > Review pending changes > Commit with message
4. **Promote to Production**: Dashboard > Commits > Select commit(s) > Promote to Production
5. **Verify in Production**: Switch to Production environment and confirm workflow is active

**CLI alternative** (recommended for CI/CD):
```bash
# Install CLI
npm install -g @knocklabs/cli

# Commit all pending changes in development
knock commit --message "Phase 2: observation-captured workflow" \
  --service-token=$KNOCK_SERVICE_TOKEN

# Promote to production
knock commit promote --to=production \
  --service-token=$KNOCK_SERVICE_TOKEN
```

### Vercel Environment Variables

Set these in Vercel Dashboard > Project > Settings > Environment Variables (Production scope):

```
KNOCK_API_KEY=sk_prod_...
KNOCK_SIGNING_KEY=LS0tLS1CRUdJTi...  (base-64 encoded PEM)
NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY=pk_prod_...
```

---

## 2. Resend Template Strategy Recommendation

### Recommendation: Use Knock Templates

### Rationale

Based on both codebase analysis and external research, **Knock templates are the clear choice** for notification emails in this integration. The decision is driven by three factors that would require significant re-implementation if bypassed:

1. **Batch variable integration**: The `observation-captured` workflow uses a Knock batch step (5-minute window). Knock's template engine provides `{{ total_activities }}`, `{{ activities }}`, and `{{ actors }}` variables that are **only available inside Knock's rendering pipeline**. Using React Email would require manually aggregating batch data before rendering — defeating the purpose of Knock's batch orchestration.

2. **Automatic preference enforcement**: Knock templates only render if the recipient's preferences allow the channel. The codebase already implements preference management via `useKnockPreferences()` in `vendor/knock/src/components/preferences.tsx`. Bypassing Knock templates means re-implementing preference checking in the dispatch workflow.

3. **Multi-channel consistency**: The same workflow serves both in-app feed and email channels. Knock templates ensure message consistency across channels with a single data payload. React Email would only cover the email channel, requiring separate template logic for in-app notifications.

### Trade-off Summary

| Factor | Knock Templates (Recommended) | React Email (Not Recommended) |
|--------|-------------------------------|-------------------------------|
| Batch variables | Native support | Must manually aggregate |
| Preference enforcement | Automatic | Must re-implement |
| Multi-channel parity | Same system | Email-only; separate for in-app |
| Version control | CLI pull/push + Git | Native Git |
| Developer experience | Liquid syntax + visual editor | React/TypeScript + full IDE |
| Non-dev editing | Yes (dashboard) | No (requires deployment) |
| CSS email compat | Auto-inlined by Knock | Manual handling required |
| Template complexity | Limited to Liquid | Full React expressiveness |

### Migration Path

No migration needed — the current implementation correctly delegates template rendering to Knock. The workflow trigger passes only data payload fields (`observationId`, `observationType`, `significanceScore`, `topics`, `clusterId`, `workspaceId`), which Knock templates consume via `{{ data.* }}` variables.

**Future consideration**: If template complexity grows beyond Liquid's capabilities, consider Knock's "code editor" mode (raw HTML + Liquid) before resorting to React Email. The code editor provides full HTML control while retaining batch variables and preference integration.

### Template Version Control Setup

To bring Knock templates into Git version control:
```bash
# Pull all workflows (including template content) to local files
knock workflow pull --all --service-token=$KNOCK_SERVICE_TOKEN

# After editing locally, push back to Knock
knock workflow push --all --commit --service-token=$KNOCK_SERVICE_TOKEN
```

This enables PR reviews for template changes while keeping the dashboard visual editor available for non-developers.

---

## 3. Workspace Notification Routing Validation

### Architecture Context

The notification dispatch flow routes at the **organization level** (`clerkOrgId`), not the workspace level. Each Knock trigger sends to all members of the Clerk organization, with `workspaceId` passed only in the data payload for template rendering.

```
Event (with workspaceId + clerkOrgId)
  → dispatch.ts guards (significance >= 70, clerkOrgId present)
  → Clerk API: fetch org members by clerkOrgId
  → Knock trigger: recipients = all org members, tenant = clerkOrgId
```

### Test Case 1: Single Workspace, Multiple Members

**Code Path**: `dispatch.ts:70-108` → `clerk.organizations.getOrganizationMembershipList({ organizationId: clerkOrgId })`

**Expected Behavior**: All org members receive the notification when an observation with `significanceScore >= 70` is captured in their workspace.

**Risk Assessment**: **HIGH** (due to pagination bug)

**Concerns**:
- **CRITICAL BUG — Pagination Missing**: The Clerk API call at `dispatch.ts:73` does not specify a `limit` parameter. Clerk's `getOrganizationMembershipList` defaults to returning **only the first 10 members**. Organizations with >10 members will have members silently excluded from notifications.
- The same unpaginated pattern exists elsewhere in the codebase (`router/user/workspace.ts:56,129`, `router/org/workspace.ts:77,243`), but notifications have the highest impact because silent notification loss is invisible to affected users.
- **Fix required**: Implement pagination loop or set `limit: 500` (Clerk max per page) to fetch all members.

**Recommended fix**:
```typescript
// Replace single fetch with paginated fetch
const allMembers = [];
let offset = 0;
const limit = 100;
let hasMore = true;

while (hasMore) {
  const page = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrgId,
    limit,
    offset,
  });
  allMembers.push(...page.data);
  hasMore = page.data.length === limit;
  offset += limit;
}
```

### Test Case 2: Multiple Workspaces, Isolation

**Code Path**: Each workspace generates its own `observation.captured` event with its own `workspaceId` and the parent org's `clerkOrgId`.

**Expected Behavior**: Notifications from Workspace A and Workspace B both route to the same org's members (since they share `clerkOrgId`). The notifications are distinguished by `data.workspaceId` in the template.

**Risk Assessment**: **MEDIUM**

**Concerns**:
- **Not a true isolation issue**: Because routing is org-level, all members of an org receive notifications from ALL workspaces in that org. This is by design — the current implementation does not support per-workspace notification filtering.
- **Potential confusion**: If a user has access to Workspace A but not Workspace B (sub-org permissions), they will still receive notifications for Workspace B because Knock routing uses `clerkOrgId`, not workspace-level membership.
- **Batch window interaction**: If both workspaces generate observations within the 5-minute batch window, they'll be batched together per-recipient since tenant is `clerkOrgId`. The template should differentiate via `{{ data.workspaceId }}`.
- **Pagination bug applies**: Same >10 member issue from TC1 affects all workspaces.

**Future consideration**: If per-workspace notification routing is needed, the dispatch workflow would need to filter recipients by workspace membership (requires a workspace-level access check, not just org membership).

### Test Case 3: Member Removal

**Code Path**: Clerk member removal is an org-level operation. The next notification dispatch fetches the current member list from Clerk.

**Expected Behavior**: Removed members are excluded from subsequent notifications because the dispatch workflow fetches the live member list on every invocation. No stale data.

**Risk Assessment**: **LOW**

**Concerns**:
- **Correct behavior**: Since members are fetched from Clerk in real-time (not cached), removal takes effect immediately for new dispatches. Knock also separately manages its own user records, but the dispatch uses inline recipients (not pre-registered Knock users).
- **In-flight notifications**: If a notification is already queued in Knock's batch window when a member is removed, the member may still receive that batched notification. This is expected behavior — Knock processes batch windows independently.
- **Knock user cleanup**: Removed org members may still have Knock user records and preferences. This is harmless (orphaned Knock records don't receive notifications unless explicitly targeted) but represents data hygiene concern.
- **Pagination bug applies**: If >10 members exist, removed members could be in the "invisible" set beyond page 1, making the removal appear to have no effect on notifications (since they weren't receiving them anyway).

### Test Case 4: Batch Window Behavior

**Code Path**: Configured in Knock dashboard, not in code. Referenced as "5 minutes" in `notification-preferences.tsx:105` UI text.

**Expected Behavior**: Multiple observations within a 5-minute window are batched into a single notification per recipient. The email template receives `{{ total_activities }}` and `{{ activities }}` array to render a digest.

**Risk Assessment**: **LOW**

**Concerns**:
- **Dashboard-code alignment**: The 5-minute batch window is configured in the Knock dashboard workflow, not controlled by code. The UI text hardcodes "every 5 minutes" — if the dashboard batch window changes, the UI text becomes misleading.
- **Inngest concurrency**: The dispatch function has `concurrency: 20 per workspaceId` (`dispatch.ts:31-34`). This limits parallel Knock triggers per workspace but doesn't affect Knock's internal batch window behavior.
- **Batch data flattening**: External research confirms that batch payloads flatten nested structures and retain only scalar values (most-recent wins). The current data payload (`observationId`, `observationType`, `significanceScore`, `topics`, `clusterId`, `workspaceId`) is all scalar/array — no nested objects, so this is safe.
- **Activity rendering limit**: Standard Knock plans render up to 10 activities in `{{ activities }}` array. Enterprise allows up to 100. If >10 observations batch in a 5-minute window, only the 10 most recent are available for template iteration.
- **Promotion required**: The batch window configuration is part of the workflow definition, which must be committed and promoted from Development to Production.

---

## 4. Security Report

### Environment Variable Exposure

| Finding | Severity | Status |
|---------|----------|--------|
| `KNOCK_API_KEY` in server-only t3-env block | Low | **PASS** — cannot leak to client bundle |
| `KNOCK_SIGNING_KEY` in server-only t3-env block | Low | **PASS** — cannot leak to client bundle |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` exposed to client | Info | **PASS** — public key by design, read-only operations |
| `KNOCK_SIGNING_KEY` missing from `turbo.json` globalEnv | Medium | **NEEDS FIX** — add to `turbo.json:134` |
| All env vars validated with `z.string().min(1)` | Info | **PASS** — empty values caught at startup |
| `skipValidation` on CI/lint runs | Info | **PASS** — prevents CI failures for missing vars |

### Token Security

| Finding | Severity | Status |
|---------|----------|--------|
| Token signed server-side via `userScopedProcedure` | Low | **PASS** — requires Clerk auth |
| No `expiresInSeconds` set on `signUserToken` call | Medium | **NEEDS ATTENTION** — defaults to library default (1 hour per `@knocklabs/node`) |
| Client-side staleTime is 5 min (refetch interval), independent of token expiry | Info | **ACCEPTABLE** — token refetched every 5 min, well within 1-hour default expiry |
| No `onUserTokenExpiring` callback configured | Low | **ACCEPTABLE** — React Query refetch handles renewal |
| Token held in React Query memory cache only | Low | **PASS** — not persisted to localStorage/sessionStorage |
| Enhanced security mode ready but not enforced | Medium | **RECOMMENDED** — enable in production dashboard |

### Logging Safety

| Finding | Severity | Status |
|---------|----------|--------|
| Error logs contain `clerkOrgId` + `error.message` only | Low | **PASS** — no secrets in logs |
| Success logs contain `workspaceId`, `observationId`, `recipientCount` | Low | **PASS** — operational data only |
| No `console.log` with env var values | Low | **PASS** — grep confirmed |
| Inngest step results not logged by default | Info | **PASS** — Inngest platform behavior |
| `scripts/test-notification.ts` references `grep KNOCK_API_KEY` | Info | **PASS** — dev-only script, not production code |

### PII Handling

| Finding | Severity | Status |
|---------|----------|--------|
| Knock recipients include `id`, `email`, `name` | Medium | **ACCEPTABLE** — required by Knock for delivery. Knock is SOC 2 Type 2, GDPR, HIPAA, CCPA certified |
| Knock data payload contains zero PII | Low | **PASS** — only observation metadata |
| No sensitive PII accessed (phone, address, metadata) | Low | **PASS** — only `publicUserData` fields |
| Error handlers don't log recipient data | Low | **PASS** — only IDs and error messages |
| Clerk `publicUserData` fields are designed for sharing | Info | **PASS** — Clerk's intended use pattern |

### Overall Security Posture: **PASS (with minor items)**

The security implementation is strong. Two items to address:
1. Add `KNOCK_SIGNING_KEY` to `turbo.json` globalEnv (consistency fix)
2. Consider adding explicit `expiresInSeconds: 3600` to `signUserToken` call for documentation clarity (current behavior is correct via library default)

---

## 5. Deployment Runbook

### Pre-Deployment

- [ ] **Fix pagination bug** in `dispatch.ts:73` — add `limit` parameter or implement pagination loop for Clerk member fetch
- [ ] **Add `KNOCK_SIGNING_KEY` to `turbo.json`** globalEnv array (line 134)
- [ ] **Verify Resend domain** is verified in Resend dashboard (SPF + DKIM records in DNS)
- [ ] **Check Resend tier** — ensure plan supports expected email volume (Pro at $20/mo for >100/day)
- [ ] **Commit Knock workflow** in Development environment
- [ ] **Test workflow** in Development with test notification script (`scripts/test-notification.ts`)
- [ ] **Verify batch window** configuration in Knock dashboard (should be 5 minutes)
- [ ] **Review email template** content in Knock dashboard for production-appropriate copy
- [ ] **Code review and merge** the pagination fix + turbo.json fix to the feature branch

### Deployment Steps

1. **Set Vercel production environment variables**:
   ```
   KNOCK_API_KEY=sk_prod_...         (from Knock Dashboard > Developers > Production API Keys)
   KNOCK_SIGNING_KEY=LS0tLS1CRUdJTi... (from Knock Dashboard > Developers > Signing Keys, base-64 encoded)
   NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY=pk_prod_... (from Knock Dashboard > Developers > Production API Keys)
   ```

2. **Configure Resend channel in Knock (Production environment)**:
   - Dashboard > Channels and sources > Resend > Manage configuration (Production)
   - Set production Resend API key
   - Set "From" email address matching verified domain
   - Disable sandbox mode
   - Optionally enable tracking

3. **Promote Knock workflow to Production**:
   ```bash
   knock commit promote --to=production --service-token=$KNOCK_SERVICE_TOKEN
   ```
   OR via Dashboard: Commits > Select committed changes > Promote to Production

4. **Enable enhanced security mode** (if in-app feed is active):
   - Dashboard > Platform > API Keys > Enable enhanced security (Production)

5. **Deploy code to production**:
   - Merge feature branch to `main`
   - Vercel auto-deploys from `main`

6. **Verify Inngest function registration**:
   - Check Inngest dashboard for `apps-console/notification.dispatch` function
   - Confirm it's active and receiving events in production

### Post-Deployment Verification

1. **Trigger a test notification**:
   - Create or trigger a high-significance observation (`significanceScore >= 70`) in a production workspace
   - OR use Inngest dashboard to manually send an `observation.captured` event

2. **Verify email delivery**:
   - Check recipient inboxes for the notification email
   - Verify "From" address and domain are correct
   - Check email renders correctly (template variables populated)

3. **Verify in-app feed** (if active):
   - Open Console in browser, check notification bell icon
   - Verify real-time notification appears in feed popover

4. **Check Knock dashboard**:
   - Dashboard > Logs > Verify workflow runs show "Delivered" status
   - Check for any "Bounced" or "Failed" deliveries

5. **Check Inngest dashboard**:
   - Verify `notification.dispatch` function runs complete successfully
   - No failed steps or retries

6. **Verify notification preferences**:
   - Navigate to workspace Settings > Notifications
   - Toggle email preferences on/off
   - Trigger another notification — verify preference is respected

7. **Test with org >10 members** (after pagination fix):
   - Verify all members receive notifications, not just the first 10

### Rollback Procedure

**Code rollback** (if deployment introduces bugs):
1. Revert the merge commit on `main` via `git revert`
2. Vercel auto-deploys the revert
3. Notifications gracefully degrade — `if (!notifications)` guard returns `skipped/knock_not_configured` if Knock env vars are removed

**Knock workflow rollback**:
1. Dashboard > Commits > Find the promotion commit > "Revert commit" in Development
2. Commit the revert in Development
3. Promote the revert commit to Production
4. **Note**: Reverting must go through Development first — you cannot directly edit Production

**Emergency disable** (stop all notifications without code change):
1. Remove `KNOCK_API_KEY` from Vercel production env vars → dispatch returns `skipped/knock_not_configured`
2. OR: Enable sandbox mode on the Resend channel in Knock Production → emails are suppressed but logged
3. OR: Deactivate the `observation-captured` workflow in Knock Production dashboard

**Resend delivery issues**:
1. Check Resend dashboard for delivery failures / bounces
2. Verify domain verification status hasn't expired
3. Check Resend rate limit usage (2 req/s default, 100/day on free tier)
4. Enable sandbox mode in Knock to stop deliveries while investigating

---

## Open Questions

Items requiring user input or further investigation:

1. **Pagination bug fix scope**: Should the pagination fix be applied only to `dispatch.ts`, or should all Clerk `getOrganizationMembershipList` calls across the codebase be updated? (4 other call sites identified in workspace routers)

2. **Enhanced security mode timing**: Should enhanced security be enabled for production at Phase 2 launch, or deferred until in-app feed is the primary channel? The codebase supports it, but it adds a dependency on token signing availability.

3. **Resend tier**: What Resend plan is Lightfast on? Free tier (100/day) will likely be insufficient for production notification volume.

4. **Knock plan**: What Knock plan/tier is in use? This affects batch activity rendering limits (10 vs 100) and throttle capabilities.

5. **CI/CD automation**: Should workflow promotion be automated via GitHub Actions, or remain manual via dashboard? The CLI supports it (`knock commit promote --to=production`), but requires `KNOCK_SERVICE_TOKEN` as a GitHub secret.

6. **Per-workspace notification routing**: The current implementation notifies all org members for all workspace events. Is this the intended behavior, or should notifications be filtered by workspace membership?

7. **Delivery status webhooks**: Should Resend > Knock delivery webhooks be configured for bounce/delivery tracking? This provides visibility but requires setup in both dashboards.
