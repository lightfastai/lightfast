# PR #525 Merge Readiness Plan

## Overview

Get PR #525 (`refactor/relay-drop-redis-cache` → `main`) — the 93-commit infrastructure overhaul — ready to merge. Currently blocked by merge conflicts, Vercel build failures, and CodeQL alerts.

## Current State

| Check | Status | Root Cause |
|-------|--------|------------|
| Review | **APPROVED** | — |
| Merge state | **CONFLICTING** | 2 modify/delete conflicts from PR #529 landing on main |
| CodeQL | **FAILURE** | 12 new alerts (9 high severity) |
| lightfast-app | **FAILURE** | Missing env vars on Vercel project (ARCJET_KEY, etc.) |
| lightfast-platform | **FAILURE** | Missing env vars on Vercel project |
| lightfast-auth | **FAILURE** | Root dir `apps/auth` no longer exists (merged into `apps/app`) |
| lightfast-docs | **FAILURE** | Root dir `apps/docs` no longer exists (merged into `apps/www`) |
| lightfast-www | **PASS** | — |
| lightfast-console | **PASS** | Legacy project, still resolves |
| lightfast-relay | **PASS** | Legacy project, still resolves |
| lightfast-backfill | **PASS** | Legacy project, still resolves |
| lightfast-gateway | **PASS** | Legacy project, still resolves |

## Desired End State

- All merge conflicts resolved
- CodeQL check passes (or only pre-existing alerts remain)
- lightfast-app and lightfast-platform build successfully on Vercel
- lightfast-auth and lightfast-docs no longer block merge
- PR is mergeable

## What We're NOT Doing

- Deleting obsolete Vercel projects (relay, gateway, backfill, console) — post-merge cleanup
- Fixing pre-existing CodeQL alerts (unpinned actions, missing workflow permissions, ReDoS in workspace-names.ts)
- Modifying PR scope or rebasing commit history

---

## Phase 1: Resolve Merge Conflicts

### Overview
Merge `main` into the PR branch to resolve the 2 modify/delete conflicts.

### Conflicts:

1. **`apps/console/public/llms.txt`** — deleted in PR (console→app rename), modified on main by PR #529
   - **Resolution**: Accept deletion. Content lives at `apps/app/public/llms.txt`

2. **`apps/docs/src/content/docs/meta.json`** — deleted in PR (docs→www merge), modified on main by PR #529
   - **Resolution**: Accept deletion. Content lives in `apps/www`

### Steps:
```bash
git checkout refactor/relay-drop-redis-cache
git fetch origin main
git merge origin/main
# Resolve conflicts: accept deletions for both files
git rm apps/console/public/llms.txt
git rm apps/docs/src/content/docs/meta.json
git commit  # merge commit
git push origin refactor/relay-drop-redis-cache
```

### Success Criteria:

#### Automated Verification:
- [x] `git merge-tree` shows no conflicts after merge
- [x] `git push` succeeds
- [ ] PR status changes from CONFLICTING to MERGEABLE

---

## Phase 2: Fix CodeQL Alerts

### Overview
Address the 12 new CodeQL alerts. Most are false positives from CMS content; 1 is a real escaping bug.

### Alert Assessment:

| # | File | Alert | Verdict | Action |
|---|------|-------|---------|--------|
| 59 | `changelog-preview.tsx:51` | XSS | False positive — CMS slug in Next.js `<Link>`, prefixed with `/changelog/` | Dismiss |
| 58,57 | `blog/[slug]/page.tsx:306,429` | XSS | False positive — BaseHub `RichText` uses React component mapping, no `dangerouslySetInnerHTML` | Dismiss |
| 56 | `app-config/src/glob.ts:132` | Incomplete escaping | **Real** — glob-to-regex chain escapes dots after injecting `.*` metacharacters; never escapes `[]()` etc. | **Fix** |
| 54,53,52 | changelog/blog files | URL redirect | False positive — CMS-sourced URLs, not user input | Dismiss |
| 82,81,51,50,49,48,47 | GitHub workflows | Unpinned tags | Pre-existing, not new to this PR | Ignore |
| 44,43,42,41,40,39 | GitHub workflows | Missing permissions | Pre-existing, not new to this PR | Ignore |

### Changes Required:

#### 1. Fix glob-to-regex escaping
**File**: `packages/app-config/src/glob.ts` (line 132)

The current chain replaces `**`→`.*`, `*`→`[^/]*`, `?`→`[^/]`, then `.`→`\\.` — but the last step corrupts the `.*` already inserted. Also, regex-special characters like `[`, `]`, `(`, `)`, `+`, `$`, `^`, `{`, `}`, `|` are never escaped.

**Fix**: Escape all regex-special characters FIRST, then replace glob wildcards:

```typescript
const pattern = new RegExp(
  glob
    // 1. Mark glob wildcards with placeholders
    .replace(/\*\*/g, "\0GLOBSTAR\0")
    .replace(/\*/g, "\0STAR\0")
    .replace(/\?/g, "\0QUESTION\0")
    // 2. Escape all regex-special characters in the remaining literal text
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // 3. Restore glob wildcards as regex equivalents
    .replace(/\0GLOBSTAR\0/g, ".*")
    .replace(/\0STAR\0/g, "[^/]*")
    .replace(/\0QUESTION\0/g, "[^/]")
);
```

#### 2. Dismiss false-positive alerts
The XSS and URL redirect alerts on CMS-sourced content can be dismissed via the GitHub API or CodeQL inline suppressions. Since these are CMS content from BaseHub (internal trust boundary), they are not exploitable.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (3 pre-existing format errors in www/openapi unrelated to this PR)
- [ ] CodeQL re-run shows fewer than 12 new alerts (ideally 0 new high-severity)

#### Manual Verification:
- [ ] Verify glob matching still works correctly for existing patterns

**Implementation Note**: After completing this phase and automated verification passes, push and wait for CodeQL re-run.

---

## Phase 3: Fix Vercel Build Failures

### Overview
The lightfast-app and lightfast-platform Vercel projects are missing environment variables. The lightfast-auth and lightfast-docs projects point to deleted directories.

### 3a. lightfast-auth and lightfast-docs — Disable or Ignore

These Vercel projects point to `apps/auth` and `apps/docs` which no longer exist. Options:

1. **Option A (recommended)**: Delete these Vercel projects from the dashboard — they will never build again
2. **Option B**: Add `"ignored builds"` config in the Vercel project settings to skip builds for this branch
3. **Option C**: Set `VERCEL_FORCE_NO_BUILD_CACHE=1` and add an `ignoreBuildStep` script

**Action**: User deletes `lightfast-auth` and `lightfast-docs` projects from Vercel dashboard.

### 3b. lightfast-app — Missing Environment Variables

Build fails at `/early-access` page with "Invalid environment variables". The `apps/app/src/env.ts` validates a large set of env vars at build time (imported by `next.config.ts`).

**Key missing vars** (required, non-optional):
- `ENCRYPTION_KEY` (min 44 chars, hex/base64)
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `NEXT_PUBLIC_GITHUB_APP_SLUG`
- `VERCEL_INTEGRATION_SLUG`, `VERCEL_CLIENT_SECRET_ID`, `VERCEL_CLIENT_INTEGRATION_SECRET`, `NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- `KNOCK_API_KEY`, `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`, `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`
- `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN`
- `ARCJET_KEY` (starts with `ajkey_`)

**Note**: The old `lightfast-console` project (same project ID `prj_xCPWTpgHXaGOJdNry3D8vyfQhwt0`) already has most env vars configured. The `lightfast-app` project entry shares the same project ID — so env vars should already be present. The failure may be because the project's root directory changed from `apps/console` to `apps/app` and env var scoping needs updating.

**Action**: User verifies env vars in Vercel dashboard for the project, ensuring they're available for the `apps/app` root directory. Likely just needs `ARCJET_KEY` added (new dependency from `@vendor/security`).

### 3c. lightfast-platform — Missing Environment Variables

Build fails loading `next.config.ts` with "Invalid environment variables". Even though `next.config.ts` doesn't import `env.ts` directly, the `withSentry` and `withBetterStack` wrappers from `@vendor/next/next-config-builder` likely trigger env validation.

**Required vars for platform** (from `apps/platform/src/env.ts` extends):
- `SERVICE_JWT_SECRET` (min 32 chars)
- `ENCRYPTION_KEY` (min 44 chars)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- Sentry/BetterStack vars (mostly optional)

**Action**: User configures env vars on the `lightfast-platform` Vercel project. This is a new project that needs initial env var setup.

### Success Criteria:

#### Manual Verification:
- [ ] lightfast-auth and lightfast-docs projects deleted from Vercel dashboard
- [ ] lightfast-app builds successfully on next push
- [ ] lightfast-platform builds successfully on next push
- [ ] All Vercel preview deployments show green

---

## Phase 4: Verify and Merge

### Overview
Final verification that all checks pass, then merge.

### Steps:
1. Wait for all CI checks to complete after Phase 1-3 changes
2. Verify PR status is MERGEABLE
3. Confirm all required checks pass
4. Merge via GitHub

### Success Criteria:

#### Automated Verification:
- [ ] GitHub shows PR as MERGEABLE
- [ ] All required checks pass (CodeQL, Vercel deployments)
- [ ] No new review comments blocking merge

#### Manual Verification:
- [ ] Preview deployments for lightfast-app, lightfast-platform, lightfast-www all load correctly
- [ ] Quick smoke test of core flows on preview URLs

---

## Post-Merge Cleanup (separate PR/tasks)

After merge, these obsolete Vercel projects should be deleted:
- `lightfast-console` (renamed to lightfast-app)
- `lightfast-relay` (consolidated into platform)
- `lightfast-gateway` (consolidated into platform)
- `lightfast-backfill` (consolidated into platform)

---

## References

- PR: https://github.com/lightfastai/lightfast/pull/525
- Branch: `refactor/relay-drop-redis-cache`
- Env validation: `apps/app/src/env.ts`, `apps/platform/src/env.ts`
- CodeQL glob issue: `packages/app-config/src/glob.ts:132`
