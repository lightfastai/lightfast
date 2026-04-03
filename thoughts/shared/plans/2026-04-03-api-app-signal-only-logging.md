---
date: 2026-04-03T00:00:00+00:00
author: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "@api/app signal-only logging — subtract noise, codify silence, complete coverage"
tags: [plan, api-app, logging, observability, trpc]
status: ready
---

# `@api/app` Signal-Only Logging

## Overview

The `console.*` → `log` migration is already complete in the working tree. This plan is not about adding more logging — it is about making logging **correct**: removing signal-obscuring noise, completing one genuine gap, and codifying intentional silences so they are never mistaken for future work.

The governing insight: every `log.*` call competes for attention in BetterStack. A `log.info` that fires on every page load is not signal — it is baseline noise that buries the events that actually matter. Subtraction is observability hygiene.

---

## The Three-Rule Contract

All logging decisions in `@api/app` must satisfy exactly one of these rules. If a call satisfies none, it does not belong.

| Rule | Level | Fires when | Examples |
|------|-------|------------|---------|
| **1. State change** | `info` / `error` | A mutation creates, modifies, or destroys persistent state — worth an audit trail | Key created, org created, job restarted, key rotated |
| **2. External service boundary** | `error` | A call to Clerk, GitHub API, or memory service fails — Sentry may lack context if the service itself is down | Clerk org creation fails, GitHub validation fails |
| **3. Security rejection** | `warn` | Auth middleware rejects a request — volume here is a security signal | Missing Authorization header, invalid key, expired key, missing org header |

**The anti-rule — never log request flow:**
Per-request auth type (`userId is clerk-active`) does not satisfy any rule. It fires on every tRPC call, produces 10–20 BetterStack entries per page load, and is fully redundant with Sentry's `trpcMiddleware` (which attaches user + org context to every error event). Timing is the **exception** — `{ path, durationMs }` is unique per call and useful for BetterStack performance dashboards; it stays.

**The silence rule — pure reads are correctly silent:**
A DB `select` failure will propagate as an unhandled exception, get caught by tRPC's error handler, become `INTERNAL_SERVER_ERROR`, and be captured by Sentry's `trpcMiddleware` with full stack, input params, and user context. A manual `log.error` in the catch block adds zero information. The only effect is double-logging in BetterStack and more code to maintain.

---

## Current State Analysis

**Working tree status**: `console.*` migration is complete. Zero raw `console.*` calls in `api/app/src` (two remaining in `env.ts` are inside string literals).

### File-by-file verdict

| File | Current logging | Contract verdict | Change |
|------|----------------|-----------------|--------|
| `trpc.ts` | 3× `log.info` per-request auth + 1× timing | Auth logs violate anti-rule; timing satisfies rule 1 | **DELETE** 3 auth logs |
| `connections.ts` `list` | try/catch + `log.error` | Pure DB read, silence rule applies | **REMOVE** try/catch |
| `connections.ts` `github.validate` | try/catch + `log.error` | External service (GitHub via memory) failure | **KEEP** |
| `connections.ts` `github.detectConfig` | try/catch + `log.error` | External service (GitHub via memory) failure | **KEEP** |
| `organization.ts` `create` | `log.info` + `log.error` | State change + external service (Clerk) | **KEEP** |
| `organization.ts` `updateName` | Nothing | Clerk API mutation, state change — genuine gap | **ADD** |
| `organization.ts` `listUserOrganizations` | Nothing | Pure Clerk read; Sentry has auth context | **SILENCE** (no change) |
| `account.ts` `get` | try/catch + `log.error` | External service (Clerk) read — useful when Clerk is down | **KEEP** |
| `jobs.ts` `restart` | `log.info` | State-change mutation | **KEEP** |
| `jobs.ts` `list` | Nothing | Pure DB read | **SILENCE** (no change) |
| `org-api-keys.ts` create/rotate | `log.info` + `log.error` | Security-critical state change | **KEEP** |
| `org-api-keys.ts` revoke/delete | `log.info` | Security-critical state change | **KEEP** |
| `org-api-keys.ts` list | Nothing | Pure DB read | **SILENCE** (no change) |
| `events.ts` | Nothing | Pure DB read | **SILENCE** + comment |
| `lib/activity.ts` | Full lifecycle | Correct by contract | **KEEP** |
| `lib/jobs.ts` | Full lifecycle | Correct by contract | **KEEP** |
| `lib/token-vault.ts` | Nothing | Low-level utility; callers own error handling | **SILENCE** + comment |
| REST `with-api-key-auth.ts` | Full coverage | Security boundary, rule 3 | **KEEP** |
| REST `with-dual-auth.ts` | Full coverage | Security boundary, rule 3 | **KEEP** |
| Inngest `record-activity.ts` | Full lifecycle | Correct by contract | **KEEP** |

---

## Desired End State

After this plan:
1. `trpc.ts` logs timing per procedure — nothing more at context-creation time
2. `connections.list` is a naked DB select — no try/catch boilerplate
3. `organization.updateName` logs the state change and any Clerk failure
4. `events.ts` and `token-vault.ts` carry comments explaining the intentional silence
5. Every `log.*` call in `@api/app/src` satisfies one of the three contract rules

### Verification
- `pnpm --filter @api/app build` passes (no TS errors)
- `pnpm check` passes (no lint errors)
- `grep -r "console\." api/app/src/ --include="*.ts" | grep -v "string"` — zero results (already satisfied)
- Manual: BetterStack production log volume decreases; timing and security entries remain

---

## What We're NOT Doing

- **Not rewriting the logger infrastructure** — `@vendor/observability/log/next` stays as-is
- **Not adding try/catch to read-only procedures** — `events.list`, `jobs.list`, `org-api-keys.list` stay naked
- **Not logging `connections.resources.bulkLink`** — user configuration, not security or lifecycle
- **Not adding a log to `organization.listUserOrganizations`** — pure Clerk read; Sentry user context is guaranteed by `userScopedProcedure`
- **Not adding a log to `token-vault.ts`** — low-level utility; its callers own error handling
- **Not changing log levels on `lib/activity.ts` or `lib/jobs.ts`** — they are correct as-is
- **Not touching `@api/platform`** — it has full adoption and follows the same contract already

---

## Phase 1: Delete Per-Request Auth Noise

### Overview
Remove the three `log.info("[trpc] request", ...)` calls from `createTRPCContext`. These fire on every tRPC call regardless of procedure — auth type is not a domain event, it is infrastructure plumbing that Sentry already captures.

### Changes Required

#### `api/app/src/trpc.ts`

**Delete lines 67–72** (clerk-active branch):
```ts
// DELETE this block:
log.info("[trpc] request", {
  source,
  userId: clerkSession.userId,
  authType: "clerk-active",
});
```

**Delete lines 82–87** (clerk-pending branch):
```ts
// DELETE this block:
log.info("[trpc] request", {
  source,
  userId: clerkSession.userId,
  authType: "clerk-pending",
});
```

**Delete line 97** (unauthenticated branch):
```ts
// DELETE this line:
log.info("[trpc] request", { source, authType: "unauthenticated" });
```

**Keep** the timing middleware at line 181 exactly as-is:
```ts
log.info("[trpc] procedure timing", { path, durationMs: end - start });
```

After the deletions, `createTRPCContext` becomes a clean context factory with no side effects.

### Success Criteria

#### Automated Verification
- [ ] Build passes: `pnpm --filter @api/app build`
- [ ] Lint passes: `pnpm check`

#### Manual Verification
- [ ] BetterStack: No `[trpc] request` entries appear for normal page loads
- [ ] BetterStack: `[trpc] procedure timing` entries still appear per procedure

---

## Phase 2: Remove Redundant DB-Read Catch Block

### Overview
`connections.list` wraps a DB select in try/catch + `log.error`. This satisfies neither the state-change rule (it's a read) nor the external-service rule (it's a DB query). Sentry captures DB failures with full context. Remove the wrapper and simplify to a naked select.

### Changes Required

#### `api/app/src/router/org/connections.ts`

**Current** (lines 60–91):
```ts
list: orgScopedProcedure.query(async ({ ctx }) => {
  try {
    const installations = await ctx.db
      .select()
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.orgId, ctx.auth.orgId),
          eq(gatewayInstallations.status, "active")
        )
      );

    return installations.map((inst) => ({
      id: inst.id,
      sourceType: inst.provider,
      isActive: true,
      connectedAt: inst.createdAt,
      lastSyncAt: inst.updatedAt,
    }));
  } catch (error: unknown) {
    log.error("[connections] list failed", {
      clerkOrgId: ctx.auth.orgId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch integrations",
      cause: error,
    });
  }
}),
```

**Replace with**:
```ts
list: orgScopedProcedure.query(async ({ ctx }) => {
  const installations = await ctx.db
    .select()
    .from(gatewayInstallations)
    .where(
      and(
        eq(gatewayInstallations.orgId, ctx.auth.orgId),
        eq(gatewayInstallations.status, "active")
      )
    );

  return installations.map((inst) => ({
    id: inst.id,
    sourceType: inst.provider,
    isActive: true,
    connectedAt: inst.createdAt,
    lastSyncAt: inst.updatedAt,
  }));
}),
```

The `log` import at line 16 must be checked after this change — if `connections.ts` still uses `log` elsewhere (it does: `github.validate` and `github.detectConfig`), the import stays.

### Success Criteria

#### Automated Verification
- [ ] Build passes: `pnpm --filter @api/app build`
- [ ] Lint passes: `pnpm check`

---

## Phase 3: Complete the Mutation Coverage

### Overview
`organization.updateName` calls Clerk's `updateOrganization` — a state-changing mutation on an external service — with zero logging. It satisfies both rule 1 (state change) and rule 2 (Clerk API boundary). Add `log.info` on success and `log.error` on Clerk failure.

### Changes Required

#### `api/app/src/router/user/organization.ts`

The `updateName` mutation currently has a try/catch that handles Clerk-specific error codes but has no logging. Add structured logs at the decision points.

**Add `log.info` after the successful `updateOrganization` call** (after line 158):
```ts
await clerk.organizations.updateOrganization(org.id, {
  name: input.name,
  slug: input.name,
});

// ADD:
log.info("[organization] updateName success", {
  organizationId: org.id,
  slug: input.name,
  userId: ctx.auth.userId,
});
```

**Add `log.error` in the catch block** before the Clerk-specific error check (currently line 169):
```ts
} catch (error: unknown) {
  // ADD at the top of the catch block:
  if (!(error instanceof TRPCError)) {
    log.error("[organization] updateName failed", {
      slug: input.slug,
      userId: ctx.auth.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Re-throw TRPCError as-is (already present)
  if (error instanceof TRPCError) {
    throw error;
  }
  // ... rest of existing error handling
```

Note: The `log` import already exists at line 5 of this file — no new import needed.

### Success Criteria

#### Automated Verification
- [ ] Build passes: `pnpm --filter @api/app build`
- [ ] Lint passes: `pnpm check`

#### Manual Verification
- [ ] BetterStack: `[organization] updateName success` appears when renaming an org
- [ ] BetterStack: `[organization] updateName failed` appears when a duplicate name is attempted (if Clerk throws before our duplicate check)

---

## Phase 4: Codify the Intentional Silences

### Overview
The research identified `events.ts` and `token-vault.ts` as "no logging" gaps. They are correct as-is, but their silence is invisible — a future engineer will see no `log.*` calls and add them, thinking it's an oversight. One JSDoc comment per file closes the loop.

### Changes Required

#### `api/app/src/router/org/events.ts`

Add a comment at the top of the `list` procedure body:
```ts
list: orgScopedProcedure
  .input(...)
  .query(async ({ ctx, input }) => {
    // No error handling: pure DB read. Sentry's trpcMiddleware captures
    // failures with full stack + input context. A manual log.error here
    // would be redundant and increase BetterStack noise.
    const clerkOrgId = ctx.auth.orgId;
    // ...
```

#### `api/app/src/lib/token-vault.ts`

Add a comment at the module level:
```ts
/**
 * Get a decrypted access token for an installation.
 *
 * No logging here: callers own error handling. Logging at this layer
 * would create unpredictable double-logging for callers that also log.
 * Failures propagate as thrown Errors and are handled upstream.
 */
export async function getInstallationToken(
```

### Success Criteria

#### Automated Verification
- [ ] Build passes: `pnpm --filter @api/app build`

---

## Testing Strategy

### Automated
```bash
pnpm --filter @api/app build   # Type checking
pnpm check                     # Biome lint
```

### Manual
1. Load the app dashboard — confirm BetterStack shows `[trpc] procedure timing` entries but NO `[trpc] request` auth entries
2. Create a new API key — confirm `[org-api-keys] created` appears in BetterStack
3. Rename an org — confirm `[organization] updateName success` appears
4. Trigger a connections.list fetch — confirm NO log entry appears (Sentry-only coverage)

---

## References

- Research: `thoughts/shared/research/2026-04-03-api-app-log-gap.md`
- Logger: `vendor/observability/src/log/next.ts`
- Platform reference: `api/platform/src/trpc.ts`
