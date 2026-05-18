# Lightfast Tasks Primitive — Implementation Plan

## Overview

Introduce a per-org **Lightfast Tasks** primitive as a first-class, **orthogonal** dimension of `AuthContext` — composed with, not coupled to, Clerk identity. v1 ships one task — `connect-github` — backed by a dedicated `org_lightfast_tasks` Drizzle table. The existing `pendingNotAllowedProcedure` carries both gates (active identity AND cleared readiness) by **default**; a new opt-out procedure exists only for the tasks router itself. All transports (cookie, Bearer for desktop/CLI) inherit the gate from a single chokepoint at the procedure layer.

**Architectural decision (v1)**: identity and readiness are modelled as **two independent vendor-agnostic primitives** that compose into a dual `AuthContext`. Each owns its own state type, resolver, and middleware. Clerk is the *implementation* of the identity dimension; Lightfast tasks are the *implementation* of the readiness dimension. Neither type carries vendor-specific information; the resolvers do. Clerk does not support custom session tasks at any shipped version (`@clerk/shared@4.10.2` `SessionTask['key']` is a closed union; the runtime `INTERNAL_SESSION_TASK_ROUTE_BY_KEY` map is hardcoded `@internal`) — so the readiness primitive must be ours. We pick vendor-agnostic naming because it future-proofs against (a) Clerk schema changes, (b) additional readiness implementations (billing-active, terms-accepted, workspace-quota-ok), (c) swapping the identity IdP, and makes "forgot to think about readiness on a new router" a TypeScript narrowing error instead of a silent bypass.

**Cross-transport enforcement (v1)**: gate is single-chokepoint at `pendingNotAllowedProcedure`, which all org-scoped procedures already inherit. Web, desktop (Bearer), and future CLI (Bearer) all hit the same middleware. The web cookie path additionally gets a layout-level redirect for UX (avoid SSR error pages); Bearer clients get a structured `error.data.lightfastTasksPending = { current, remaining, redirectUrl }` payload via a custom tRPC `errorFormatter` — machine-readable, not a prose 403.

**Storage (v1)**: dedicated Drizzle table `org_lightfast_tasks (org_id, task_key, cleared_at)` with PK on `(org_id, task_key)`. Atomic upserts, transactional, indexable. Source of truth lives in our DB, not Clerk org `publicMetadata` — publicMetadata has no atomicity, no ETags, no indexing, and is the wrong substrate for authorization state. JWT carries no readiness state; the resolver reads DB directly on every authenticated request (PK lookup, sub-ms). Redis caching is a follow-up if measurement demands it.

**Registry shape (v1)**: `LIGHTFAST_TASKS` is a metadata-only registry (`{ key, label, required? }`). Each concrete task gets its own concrete `tasks.*` mutation rather than a generic `complete({ key })` dispatched through a per-entry method table. When the second task lands we promote to a richer registry; until then, premature abstraction earns no rent.

## Current State Analysis

### Sibling rename plan — completed prerequisite

`thoughts/shared/plans/2026-05-14-pending-allowed-not-allowed-scopes.md` renamed `userScopedProcedure → pendingAllowedProcedure` and `orgScopedProcedure → pendingNotAllowedProcedure`, moved the matching router and Next.js route group folders, and updated all 16 callers. Phase 1 (API) and Phase 2 (route folders) automated checks are green; only Phase 2 human-review smoke remains. This plan **inherits** that state and does not redo any renames — `pendingNotAllowedProcedure` keeps its name and gains a second gate. The name still reads correctly under the new semantics: "this procedure does not admit any pending state" — pending identity OR pending readiness. JSDoc is updated to make this explicit.

### Auth context (api/app/src/auth/)

`AuthContext` is currently a 3-state discriminated union (`api/app/src/auth/context.ts:13-16`):

```ts
export type AuthContext =
  | { type: "clerk-pending"; userId: string }
  | { type: "clerk-active"; userId: string; orgId: string }
  | { type: "unauthenticated" };
```

This shape collapses two independent dimensions (identity, readiness) into one and leaks Clerk into the type vocabulary. The new shape splits them — see Desired End State.

`resolveAuth(headers)` (`api/app/src/auth/resolve.ts:69-72`) tries Bearer first, then cookies, producing the union. Bearer absent → falls through to cookie. Bearer present-but-empty → returns `UNAUTH` without falling through (`resolve.ts:35-36`). Bearer `verifyToken` throw → logs warn and returns `UNAUTH`, no cookie fallback (`resolve.ts:43-52`). Both successful transports collapse to `clerkAuth(userId, orgId)` (`context.ts:33-40`).

### tRPC procedure ladder (api/app/src/trpc.ts)

Current ladder:

| Procedure | Line | Composition | Admits |
|---|---|---|---|
| `publicProcedure` | 149 | base + observability | anyone |
| `pendingAllowedProcedure` | 172 | `+ requireAuth` | identity pending OR active |
| `pendingNotAllowedProcedure` | 191 | `+ requireOrg` | identity active only |

`requireAuth` middleware (`trpc.ts:115-124`) and `requireOrg` middleware (`trpc.ts:126-136`) — each is a one-line `.use()` composition. Both call `next({ ctx: { ...ctx, auth: ctx.auth } })`, which re-spreads `ctx.auth` so TypeScript narrows the union for downstream middleware. The pattern is well-established and survives the move to a composite `AuthContext` (we narrow `ctx.auth.identity` instead of `ctx.auth`).

### Default tRPC error formatter

`trpc.ts:49-65` defines an `errorFormatter` that surfaces `data.zodError` for `BAD_REQUEST` with a `ZodError` cause. It does NOT propagate custom `cause` objects on the wire — every existing `TRPCError` with a cause (`organization.ts:133,229`; `account.ts:94`) treats `cause: error` as opaque-exception passthrough. The plan extends this formatter to surface a structured `data.lightfastTasksPending` payload for `FORBIDDEN` errors thrown by `requireClearedReadiness`, giving Bearer clients a machine-readable contract instead of a prose message.

### Router grouping (api/app/src/root.ts)

```ts
export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({ organization, account }),
  pendingNotAllowed: createTRPCRouter({ orgApiKeys }),
});
```

Currently `(pending-not-allowed)` group contains exactly one router: `org-api-keys.ts` (4 procedures: `list`, `create`, `revoke`, `delete`).

Client call-site footprint (post-rename):
- `trpc.pendingAllowed.*` — 11 sites across 8 files in `apps/app/src/`, 3 sites across 3 files in `apps/desktop/src/`, 1 string in `apps/app/src/proxy.ts:69`.
- `trpc.pendingNotAllowed.*` — 5 sites across 2 files (api-keys settings only).

**Zero call-site moves in this plan.** `orgApiKeysRouter` stays on `pendingNotAllowedProcedure`; that procedure now carries the readiness gate. The tasks router uses a new `activeIdentityProcedure` and lives under a new `pendingNotAllowed.tasks` namespace.

### App route groups (apps/app/src/app/(app)/)

```
(app)/
  layout.tsx                            (prefetches pendingAllowed.account.get + listUserOrganizations)
  (pending-allowed)/account/...         (user-level)
  (pending-not-allowed)/[slug]/
    layout.tsx                          (requireOrgAccess → notFound() on failure)
    (workspace)/
      page.tsx                          /[slug] (workspace home)
      (manage)/settings/
        page.tsx
        layout.tsx
        api-keys/page.tsx
        api-keys/_components/...
        _components/team-general-settings-client.tsx
```

`[slug]/layout.tsx:32-41` calls `requireOrgAccess(slug)` via `apps/app/src/lib/org-access-clerk.ts` inside a try/catch and `notFound()`s on failure. This is the existing layout-level gate pattern; the readiness redirect extends it (same layout, additional check) — no new route group, no `git mv` of `(workspace)`.

### Clerk SDK pins and custom-task verdict

`@clerk/shared@4.10.2`, `@clerk/backend@3.4.7`, `@clerk/nextjs@7.3.3`. `SessionTask['key']` is a closed union (`'choose-organization' | 'reset-password' | 'setup-mfa'`) at this version and on Clerk's `main` branch as of investigation date (2026-05-18). The runtime `INTERNAL_SESSION_TASK_ROUTE_BY_KEY` map at `node_modules/.pnpm/@clerk+shared@4.10.2.../dist/runtime/internal/clerk-js/sessionTasks.js:21-25` hardcodes the same three keys and is `@internal` annotated. No Backend API endpoint, no dashboard surface, no roadmap signal. The Lightfast primitive must be parallel — not literally piggybacked on Clerk's task array. This plan stops pretending otherwise: readiness is its own vendor-agnostic type, owned by Lightfast, with zero Clerk vocabulary in its surface.

Clerk dashboard inventory (`thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md`) confirms `force_organization_selection=true`, so Clerk injects its own `choose-organization` SessionTask for every user with ≥1 org. The two systems compose naturally because they're orthogonal: Clerk's `choose-organization` runs while the Clerk session is `pending`; readiness gate runs at `identity.type === "active"` — by definition Clerk's task is done.

## Desired End State

After this plan:

1. **`AuthContext` is a composite of two orthogonal, vendor-agnostic primitives.** `AuthIdentity` (3-state) and `AuthReadiness` (3-state) compose as fields:
   ```ts
   interface AuthContext { identity: AuthIdentity; readiness: AuthReadiness }
   ```
   Each primitive owns its own state type, resolver, and middleware. `AuthReadiness` has zero Lightfast-specific types in its surface (it accepts arbitrary string keys); `AuthIdentity` has zero Clerk-specific types in its surface (vendor specifics live in the resolver).

2. **Two independent resolvers feed the composite.** `resolveIdentityFromClerk(headers)` returns `AuthIdentity` from Clerk Bearer + cookie unification. `resolveReadinessFromTasks(orgId)` returns `AuthReadiness` by reading the new `org_lightfast_tasks` DB table and diffing against the `LIGHTFAST_TASKS` registry. The composite `resolveAuth(headers)` calls both and merges:
   ```ts
   const identity = await resolveIdentityFromClerk(headers);
   const readiness = identity.type === "active"
     ? await resolveReadinessFromTasks(identity.orgId)
     : ({ type: "n/a" } as const);
   return { identity, readiness };
   ```

3. **Two atomic middlewares + one default-safe chokepoint.** `requireActiveIdentity` (renamed from `requireOrg`, narrows `ctx.auth.identity` to active variant) and `requireClearedReadiness` (new, narrows `ctx.auth.readiness` to cleared variant). The existing `pendingNotAllowedProcedure` composes BOTH. A new `activeIdentityProcedure` composes only the identity gate — used **exclusively** by the tasks router so users can complete tasks. Adding a new org-scoped router and forgetting to think about readiness → TypeScript narrowing error (because `ctx.auth.readiness` isn't narrowed to `cleared`), not silent bypass.

4. **Source of truth lives in a dedicated DB table.** `org_lightfast_tasks(org_id text, task_key text, cleared_at timestamptz, PRIMARY KEY (org_id, task_key))`. Atomic upserts via Drizzle. `org.publicMetadata` is NOT touched by this plan. The JWT carries no readiness state; the resolver reads DB on every authenticated org-scoped request.

5. **Tasks router lives at `pendingNotAllowed.tasks`** using the opt-out procedure. `orgApiKeysRouter` stays exactly where it is — zero call-site changes, zero `root.ts` restructuring. Wire layout:
   ```ts
   createTRPCRouter({
     pendingAllowed:    createTRPCRouter({ organization, account }),
     pendingNotAllowed: createTRPCRouter({ orgApiKeys, tasks }),
   });
   ```

6. **v1 task `connect-github`** is registered (key + label only). A concrete `tasks.completeConnectGithub` mutation inserts a row into `org_lightfast_tasks` (idempotent on the PK). No `publicMetadata` write. No `session.reload()` race — the DB read on the next request reflects the write immediately.

7. **The gate fires at two layers**:
   - tRPC (all transports): `requireClearedReadiness` throws `TRPCError({ code: "FORBIDDEN" })`. A custom `errorFormatter` extension surfaces `data.lightfastTasksPending = { current, remaining, redirectUrl }` on the wire — Bearer clients (desktop, CLI) parse this and act.
   - Cookie/web UX (defensive, not load-bearing): `[slug]/layout.tsx` adds a server-side `redirect()` to `/[slug]/tasks/{current}` when readiness is pending. Prevents SSR pages from rendering an error UI. The tRPC gate is still the authority — the redirect just avoids showing a broken page to web users.

### Key Discoveries

- **Clerk does not support custom session tasks at any shipped version.** Confirmed via local `@clerk/shared@4.10.2` source: `SessionTask['key']` is a closed union, `INTERNAL_SESSION_TASK_ROUTE_BY_KEY` is hardcoded with `@internal`, `taskUrls` config is bounded to the same union. No Backend API endpoint to inject custom keys. The readiness primitive must be ours; pretending otherwise (the original plan's "mirrors Clerk's SessionTask shape" framing) was misleading — the new plan owns the primitive explicitly with vendor-agnostic naming.
- **Vendor-agnostic naming forces honest decoupling.** The types `AuthIdentity` and `AuthReadiness` live in `auth/identity.ts` and `auth/readiness.ts` respectively. Clerk-specific knowledge lives in `auth/resolve-identity-clerk.ts` (Bearer + cookie + JWT parsing). Lightfast-tasks-specific knowledge lives in `auth/resolve-readiness-tasks.ts` (DB lookup + registry diff). Swapping Clerk for another IdP changes one file; adding billing-readiness adds one file. The types and middlewares are stable.
- **Decoupling at the type/state level forces honest narrowing.** With `AuthContext = { identity, readiness }`, downstream code cannot pretend "identity active implies readiness cleared". TypeScript narrows each dimension independently. The composition happens at the procedure layer (one `.use()` per gate) for ergonomics, not at the type layer.
- **`org.publicMetadata` is the wrong substrate for authorization state.** No atomicity (read-modify-write race for two concurrent writes), no ETag/version conditional, no indexing, no transactions. The original plan acknowledged this and accepted the race; the new plan uses a Drizzle table with PK upserts which is both simpler and safer.
- **DB-as-source-of-truth eliminates the JWT staleness race.** Original plan needed `session.reload()` before navigation to refresh the JWT claim, with a ~50s natural-refresh fallback. New plan reads DB on every authenticated request → the next request reflects the write immediately. No `session.reload()` needed on the client. Cost is one extra DB query per authenticated request (PK lookup on a small table, sub-millisecond).
- **`TRPCError.cause` does not survive serialization** — but `errorFormatter` can extend `data`. Every existing `TRPCError` with a cause in the codebase (`organization.ts:133,229`; `account.ts:94`) uses `cause: error` as opaque-exception passthrough; the default formatter (`trpc.ts:49-65`) strips ZodError into `data.zodError` but does not surface custom cause objects. The new plan extends `errorFormatter` to add `data.lightfastTasksPending` when the shape we threw includes it — same mechanism Zod uses, machine-readable on the wire for Bearer clients.
- **`requireOrgAccess` (`apps/app/src/lib/org-access-clerk.ts:45-82`) is the existing template for "fetch fresh org, check membership, throw to surface notFound()"**. The readiness layout redirect lives in the same `[slug]/layout.tsx` that already calls `requireOrgAccess`, immediately after the access check. No new layout file, no new route group.
- **Boundary placement for `AuthReadiness` and `deriveReadiness`.** Both api/app and apps/app need to consume the type + the registry. `@vendor/clerk` is a thin SDK shim that owns zero domain types — wrong home. `@api/app/src/...` deep-path imports from `apps/app` have zero precedent (all current cross-app imports go via package-barrel `exports` paths, e.g. `@api/app/inngest` mapped in `api/app/package.json`). **Decision**: add a new `@api/app/auth` named subpath export to `api/app/package.json` mirroring the `@api/app/inngest` pattern. Vendor-agnostic types and the pure derivation function live behind it.
- **The settings page tree is deeper than the brief suggested**: `(workspace)/(manage)/settings/{page,layout,api-keys/...}`. No moves needed under the new plan — the gate is structural at tRPC; the layout redirect protects the entire `[slug]/` subtree in one place.

## What We're NOT Doing

- **Real GitHub OAuth wiring.** v1's `connect-github` mutation inserts a row in `org_lightfast_tasks` to mark the task complete. Real GitHub App install check is a follow-up — concrete mutation body changes (e.g. verify install via GitHub API, write only on success), no schema change.
- **Un-clearing tasks (any path).** v1 is one-way: once `connect-github` is cleared, the only ways back to pending state are (a) manually `DELETE FROM org_lightfast_tasks WHERE org_id = ? AND task_key = ?` via psql or Drizzle Studio, or (b) a follow-up plan that wires real webhooks → Inngest → DB writeback (e.g. for GitHub `installation.deleted`).
- **CLI / desktop client-side recovery UX from the 403.** The structured `data.lightfastTasksPending` payload is shipped from day one (that's the cross-transport contract); the actual CLI/desktop handlers that consume it (open browser to redirectUrl, retry on user action, etc.) are out of scope for v1. v1 ensures the contract exists; v2 builds the consumers.
- **Generic `tasks.complete({ key })` dispatch.** v1 ships a **concrete per-task mutation** (`tasks.completeConnectGithub`). The registry exists for UI metadata (label, ordering) but is not a dispatch table. Promote to a generic mutation when there are ≥2 tasks with shared writeback semantics.
- **Redis caching of `AuthReadiness`.** v1 reads DB on every request. PK lookup on a small table is cheap. Add Redis cache (with explicit invalidation on writeback) when load measurement shows the need.
- **Additional readiness implementations (billing, terms, quota).** v1 ships exactly one: Lightfast tasks. The `AuthReadiness` type is vendor-agnostic and the composition pattern accommodates more, but adding them is out of scope.
- **Bidirectional reconciliation in `tasks.getStatus`.** v1's read is metadata-only — derived from DB rows + registry. No live state to disagree with the DB. The reconciliation loop is dead code until a real webhook-driven `check()` exists; add it then.
- **Multi-task ordering / dependencies.** v1 has one task.
- **Touching `org.publicMetadata`.** State lives entirely in the new Drizzle table. The custom Clerk JWT template change the original plan required is no longer needed.

## Implementation Approach

Five phases:
1. Types (composite `AuthContext` + `AuthIdentity` + `AuthReadiness`) + registry + DB schema/migration + repository + `@api/app/auth` subpath export.
2. Resolver split — `resolveIdentityFromClerk` + `resolveReadinessFromTasks` + composite `resolveAuth`. No JWT template config.
3. Middleware split — `requireActiveIdentity` + `requireClearedReadiness` — composed into `pendingNotAllowedProcedure` (default-safe). Add `activeIdentityProcedure` for tasks router. Extend `errorFormatter` with `data.lightfastTasksPending`.
4. Tasks router (concrete `getStatus` + `completeConnectGithub`).
5. UI — layout-level redirect in existing `[slug]/layout.tsx` (defensive UX) + checklist page + connect-github task page. No route group restructure.

Phases 1–4 are server-only. Phase 5 changes user-facing flow. Tests land with the phase that introduces them — no test-debt phase. No Clerk dashboard config required (DB is source of truth; JWT carries no readiness state).

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Types, Registry, DB Schema, Repository, `@api/app/auth` Subpath Export

### Overview

Define the two orthogonal, vendor-agnostic primitives (`AuthIdentity`, `AuthReadiness`), the composite `AuthContext`, the Lightfast-tasks registry, the Drizzle schema + migration for `org_lightfast_tasks`, the repository module, and the pure derivation function. Add a new `@api/app/auth` package subpath export so `apps/app` can import the vendor-agnostic types without crossing the `src/` boundary. No runtime behavior changes yet — Phase 2 wires the resolvers; Phase 3 wires the middleware.

### Changes Required

#### 1. Readiness primitive — type + pure derivation (vendor-agnostic)

**File**: `api/app/src/auth/readiness.ts` (new)
**Changes**: The readiness dimension's type and pure derivation function. **Zero Lightfast-specific types** — accepts arbitrary string keys. Future readiness implementations (billing, terms, quota) reuse this exact type.

```ts
/**
 * Authorization readiness — the answer to "is this principal qualified to
 * proceed?". Orthogonal to identity. The "n/a" variant is what the composite
 * resolver emits when there is no active identity (so readiness is not
 * applicable). Vendor-agnostic — keys are arbitrary strings; specific
 * readiness implementations (Lightfast tasks, billing, etc.) supply the
 * required-keys set to `deriveReadiness`.
 */
export type AuthReadiness =
  | { type: "n/a" }
  | { type: "pending"; current: string; remaining: string[] }
  | { type: "cleared" };

/**
 * Pure derivation from a list of required keys + a set of cleared keys.
 * No IO, no vendor coupling. The Lightfast-tasks resolver (and any future
 * readiness resolver) supplies the inputs.
 */
export function deriveReadiness(
  requiredKeys: readonly string[],
  cleared: ReadonlySet<string>
): AuthReadiness {
  const remaining = requiredKeys.filter((k) => !cleared.has(k));
  if (remaining.length === 0) return { type: "cleared" };
  return { type: "pending", current: remaining[0]!, remaining };
}
```

#### 2. Identity primitive — type + factory (vendor-agnostic)

**File**: `api/app/src/auth/identity.ts` (new)
**Changes**: The identity dimension's type and factory. **Zero Clerk-specific types** — the JWT claims schema and Clerk SDK calls live in the resolver (Phase 2). Future IdPs (Lightfast-owned API keys, another OAuth provider) reuse this exact type.

```ts
/**
 * Authorization identity — the answer to "who is this request from?".
 * Orthogonal to readiness. Vendor-agnostic — specific identity resolvers
 * (Clerk Bearer/cookie, future IdPs) construct one of these variants via
 * the `authIdentity` factory.
 */
export type AuthIdentity =
  | { type: "unauthenticated" }
  | { type: "pending"; userId: string }
  | { type: "active"; userId: string; orgId: string };

export const UNAUTH_IDENTITY = {
  type: "unauthenticated",
} as const satisfies AuthIdentity;

export function authIdentity(
  userId: string,
  orgId: string | null | undefined
): AuthIdentity {
  if (!orgId) return { type: "pending", userId };
  return { type: "active", userId, orgId };
}
```

#### 3. Lightfast tasks registry (vendor-specific implementation detail)

**File**: `api/app/src/auth/lightfast-tasks.ts` (new)
**Changes**: The Lightfast-tasks-specific registry. This is the implementation that feeds the readiness primitive in v1. **Knows nothing about `AuthReadiness`** — it just exposes a set of registered task keys. The resolver (Phase 2) bridges them.

```ts
import { z } from "zod";

export const lightfastTaskKeySchema = z.enum(["connect-github"]);
export type LightfastTaskKey = z.infer<typeof lightfastTaskKeySchema>;

export interface LightfastTaskEntry {
  key: LightfastTaskKey;
  label: string;
  /** Default true. Optional tasks appear in the checklist but do not gate. */
  required?: boolean;
}

/**
 * Metadata-only registry. UI consumers read `label`/`required`. The
 * readiness resolver reads the required keys + diffs against cleared rows
 * in the DB. Each concrete task has its own tRPC mutation (no dispatch
 * table).
 */
export const LIGHTFAST_TASKS: readonly LightfastTaskEntry[] = [
  { key: "connect-github", label: "Connect GitHub" },
] as const;

/**
 * Derived helper for the readiness resolver — the keys that contribute to
 * the gate. Optional tasks (`required: false`) are excluded.
 */
export const LIGHTFAST_REQUIRED_TASK_KEYS: readonly string[] =
  LIGHTFAST_TASKS.filter((t) => t.required !== false).map((t) => t.key);
```

#### 4. Composite `AuthContext`

**File**: `api/app/src/auth/context.ts`
**Changes**: Replace the 3-variant union with the composite shape. Re-export the two primitive state types for downstream narrowing.

```ts
import type { AuthIdentity } from "./identity";
import type { AuthReadiness } from "./readiness";

export interface AuthContext {
  identity: AuthIdentity;
  readiness: AuthReadiness;
}

export const UNAUTH: AuthContext = {
  identity: { type: "unauthenticated" },
  readiness: { type: "n/a" },
};

export type { AuthIdentity } from "./identity";
export type { AuthReadiness } from "./readiness";
```

#### 5. Drizzle schema + migration

**File**: `db/app/src/schema/org-lightfast-tasks.ts` (new)
**Changes**: Single table, composite PK on `(org_id, task_key)`. Idempotent upserts via `INSERT … ON CONFLICT DO NOTHING`. Add export to the package barrel.

```ts
import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const orgLightfastTasks = pgTable(
  "org_lightfast_tasks",
  {
    orgId: text("org_id").notNull(),
    taskKey: text("task_key").notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.taskKey] }),
    orgIdx: index("org_lightfast_tasks_org_idx").on(table.orgId),
  })
);
```

**Action**: `pnpm --filter @db/app db:generate` to emit the migration SQL. **Never write manual `.sql` files** (per CLAUDE.md). Verify the generated file matches the table shape, then `pnpm db:migrate` against local Postgres.

#### 6. Repository module

**File**: `api/app/src/auth/org-tasks-repo.ts` (new)
**Changes**: Two functions only — `listClearedTasks` (read) and `markTaskCleared` (idempotent upsert). The repo wraps Drizzle so the resolver/router don't import schema directly.

```ts
import { db } from "@db/app";
import { orgLightfastTasks } from "@db/app/schema";
import { eq } from "drizzle-orm";

export async function listClearedTasks(orgId: string): Promise<Set<string>> {
  const rows = await db
    .select({ taskKey: orgLightfastTasks.taskKey })
    .from(orgLightfastTasks)
    .where(eq(orgLightfastTasks.orgId, orgId));
  return new Set(rows.map((r) => r.taskKey));
}

export async function markTaskCleared(
  orgId: string,
  taskKey: string
): Promise<void> {
  await db
    .insert(orgLightfastTasks)
    .values({ orgId, taskKey })
    .onConflictDoNothing({
      target: [orgLightfastTasks.orgId, orgLightfastTasks.taskKey],
    });
}
```

#### 7. Add `@api/app/auth` subpath export

**File**: `api/app/package.json`
**Changes**: Mirror the existing `@api/app/inngest` named export pattern. `apps/app` imports the vendor-agnostic readiness type + the Lightfast-tasks registry through the package barrel. A second `./auth/repo` export ships the server-only repository for use from the app layout.

```jsonc
{
  // ... existing fields ...
  "exports": {
    ".": "./src/index.ts",
    "./inngest": "./src/inngest/index.ts",  // existing
    "./auth": "./src/auth/index.ts",         // new (pure types + registry)
    "./auth/repo": "./src/auth/org-tasks-repo.ts"  // new (server-only)
  }
}
```

**File**: `api/app/src/auth/index.ts` (new)
**Changes**: Re-export the pure surface. Do NOT re-export `AuthContext`, `resolveAuth`, or anything that pulls in server-only Clerk/DB code — `apps/app` only needs the types and the pure derivation function.

```ts
export type { AuthReadiness } from "./readiness";
export { deriveReadiness } from "./readiness";

export type { AuthIdentity } from "./identity";

export type { LightfastTaskKey, LightfastTaskEntry } from "./lightfast-tasks";
export {
  LIGHTFAST_TASKS,
  LIGHTFAST_REQUIRED_TASK_KEYS,
  lightfastTaskKeySchema,
} from "./lightfast-tasks";
```

#### 8. Phase-1 unit tests

**File**: `api/app/src/auth/readiness.test.ts` (new)
**Changes**: Table-driven test of `deriveReadiness`. Pure function, no fixtures needed. Vendor-agnostic — tests use arbitrary keys to prove the type isn't Lightfast-coupled.

```ts
import { describe, expect, it } from "vitest";
import { deriveReadiness } from "./readiness";

describe("deriveReadiness", () => {
  it("treats empty cleared set against any required keys as fully pending", () => {
    expect(deriveReadiness(["a", "b"], new Set())).toEqual({
      type: "pending",
      current: "a",
      remaining: ["a", "b"],
    });
  });
  it("treats all required keys cleared as fully cleared", () => {
    expect(deriveReadiness(["a", "b"], new Set(["a", "b"]))).toEqual({
      type: "cleared",
    });
  });
  it("ignores cleared keys not in the required set (forwards-compat)", () => {
    expect(deriveReadiness(["a"], new Set(["a", "extra"]))).toEqual({
      type: "cleared",
    });
  });
  it("orders remaining by the required-keys argument", () => {
    expect(deriveReadiness(["a", "b", "c"], new Set(["b"]))).toEqual({
      type: "pending",
      current: "a",
      remaining: ["a", "c"],
    });
  });
});
```

**File**: `api/app/src/auth/lightfast-tasks.test.ts` (new)
**Changes**: Registry shape only. Confirms `connect-github` is registered as required.

```ts
import { describe, expect, it } from "vitest";
import {
  LIGHTFAST_REQUIRED_TASK_KEYS,
  LIGHTFAST_TASKS,
  lightfastTaskKeySchema,
} from "./lightfast-tasks";

describe("LIGHTFAST_TASKS", () => {
  it("registers connect-github as required", () => {
    expect(LIGHTFAST_TASKS).toEqual([
      { key: "connect-github", label: "Connect GitHub" },
    ]);
    expect(LIGHTFAST_REQUIRED_TASK_KEYS).toEqual(["connect-github"]);
  });
  it("accepts known keys and rejects unknown", () => {
    expect(lightfastTaskKeySchema.safeParse("connect-github").success).toBe(true);
    expect(lightfastTaskKeySchema.safeParse("nope").success).toBe(false);
  });
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app typecheck` clean
- [x] `pnpm --filter @api/app test` passes (new `readiness.test.ts` + `lightfast-tasks.test.ts`)
- [x] `pnpm --filter @api/app check` clean (ran via root `ultracite check`; file-scoped, all clean after auto-fix)
- [x] `pnpm --filter @db/app db:generate` produces a migration creating `org_lightfast_tasks` with composite PK (`db/app/src/migrations/0066_material_albert_cleary.sql`)
- [x] `pnpm --filter @db/app db:migrate` applies cleanly against local dev Postgres (`\d org_lightfast_tasks` confirms shape + indexes)
- [x] `node -e "console.log(require('./api/app/package.json').exports['./auth'])"` prints `./src/auth/index.ts` (object form with `types` + `default`, matching existing convention)
- [x] `node -e "console.log(require('./api/app/package.json').exports['./auth/repo'])"` prints `./src/auth/org-tasks-repo.ts`
- [x] Files exist: `api/app/src/auth/{readiness,identity,lightfast-tasks,index,org-tasks-repo}.ts`, `api/app/src/auth/{readiness,lightfast-tasks}.test.ts`, `db/app/src/schema/tables/org-lightfast-tasks.ts`; updated `api/app/package.json`. (`context.ts` rewrite deferred to Phase 2 to keep typecheck clean across the phase boundary — see note below.)
- [x] `LIGHTFAST_TASKS.length === 1` and the only entry is `{ key: "connect-github", label: "Connect GitHub" }`
- [x] `grep -rn "publicMetadata" api/app/src/auth` returns 0 (readiness has zero publicMetadata coupling)
- [x] `grep -rn "Clerk\|clerk" api/app/src/auth/{identity,readiness,lightfast-tasks}.ts` returns 0 (vendor-agnostic types have zero Clerk vocabulary)

**Implementer notes (Phase 1):**

1. **`context.ts` rewrite deferred to Phase 2.** The plan's section #4 ("Replace `context.ts` with the composite shape") was deferred. Replacing `context.ts` standalone breaks `pnpm --filter @api/app typecheck` (which is itself a Phase 1 success criterion) because `resolve.ts` imports the removed `clerkAuth`/`ClerkJwtClaims` symbols and every router consumes the old discriminated union via `ctx.auth.userId`/`ctx.auth.orgId`/`ctx.auth.type`. Phase 2 will rewrite `context.ts` atomically with `resolve.ts` and the downstream `extractAuth`/router updates so the swap is a single typecheck-clean commit.

2. **Schema file lives at `db/app/src/schema/tables/org-lightfast-tasks.ts`** (not `db/app/src/schema/org-lightfast-tasks.ts` per the plan), following the existing `tables/` subdirectory convention used by `org-user-activities.ts`.

3. **Folder layout: group by primitive; no barrel** (decided 2026-05-18 during implementation, supersedes plan section #7's barrel `auth/index.ts`). The plan's flat `auth/{readiness,identity,lightfast-tasks,...}.ts` layout was reshaped into per-primitive subdirectories so the swappable concretions (Clerk identity, Lightfast tasks readiness) live next to the primitive they implement. Tests moved to the central `api/app/src/__tests__/` directory matching the existing `resolve.test.ts` placement. Barrel `auth/index.ts` deleted — `apps/app` consumes per-file subpath exports instead. Resulting structure:

   ```
   api/app/src/
     auth/
       context.ts                    # composite (rewritten in Phase 2)
       resolve.ts                    # composer (rewritten in Phase 2)
       identity/
         types.ts                    # AuthIdentity + authIdentity factory
         resolve-clerk.ts            # Phase 2 (Clerk Bearer/cookie)
       readiness/
         types.ts                    # AuthReadiness + deriveReadiness
       lightfast-tasks/
         registry.ts                 # LIGHTFAST_TASKS + key schema
         repo.ts                     # listClearedTasks, markTaskCleared
         resolve.ts                  # Phase 2 (resolveReadinessFromTasks)
     __tests__/
       readiness-types.test.ts
       lightfast-tasks-registry.test.ts
   ```

   Package subpath exports (no barrel — each export points at one file):

   ```jsonc
   "./auth/identity":              "./src/auth/identity/types.ts"
   "./auth/readiness":             "./src/auth/readiness/types.ts"
   "./auth/lightfast-tasks":       "./src/auth/lightfast-tasks/registry.ts"
   "./auth/lightfast-tasks/repo":  "./src/auth/lightfast-tasks/repo.ts"
   ```

   Implication for Phase 5: `apps/app/src/lib/org-readiness.ts` imports three explicit subpaths (not one barrel):

   ```ts
   import { type AuthReadiness, deriveReadiness } from "@api/app/auth/readiness";
   import { LIGHTFAST_REQUIRED_TASK_KEYS } from "@api/app/auth/lightfast-tasks";
   import { listClearedTasks } from "@api/app/auth/lightfast-tasks/repo";
   ```

---

## Phase 2: Resolver Split

### Overview

Replace the monolithic `resolveAuth` with two independent resolvers (one per primitive) plus a thin composer. `resolveIdentityFromClerk` extracts identity from Clerk Bearer/cookie (existing behavior, retargeted to the smaller type — this is where Clerk-specific knowledge lives). `resolveReadinessFromTasks` reads the DB and diffs against the Lightfast-tasks registry. The composite `resolveAuth` calls Lightfast-tasks readiness only when identity is `active`. No JWT template config required — DB is source of truth.

### Changes Required

#### 1. Clerk identity resolver — extracted from `resolve.ts`

**File**: `api/app/src/auth/resolve-identity-clerk.ts` (new — extracted from `resolve.ts`)
**Changes**: Move the Bearer/cookie unification logic here. Returns `AuthIdentity`, not `AuthContext`. The Clerk JWT claims schema also lives here (vendor-specific implementation detail, not in the pure `identity.ts`). Behavior is unchanged from today — same Bearer-first-then-cookie order, same UNAUTH paths.

```ts
import { z } from "zod";
import { auth, verifyToken } from "@vendor/clerk/server";
import { CLERK_SECRET_KEY } from "../env";
import {
  authIdentity,
  UNAUTH_IDENTITY,
  type AuthIdentity,
} from "./identity";

const ClerkJwtClaims = z.object({
  sub: z.string(),
  org_id: z.string().optional(),
});

async function tryBearer(headers: Headers): Promise<AuthIdentity | undefined> {
  // ... existing header parsing unchanged from current resolve.ts:23-52 ...
  // On success: return authIdentity(claims.sub, claims.org_id)
}

async function tryCookie(): Promise<AuthIdentity> {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) return UNAUTH_IDENTITY;
  return authIdentity(session.userId, session.orgId);
}

export async function resolveIdentityFromClerk(
  headers: Headers
): Promise<AuthIdentity> {
  return (await tryBearer(headers)) ?? (await tryCookie());
}
```

#### 2. Lightfast-tasks readiness resolver

**File**: `api/app/src/auth/resolve-readiness-tasks.ts` (new)
**Changes**: Thin wrapper around the repo + the pure derivation function + the Lightfast-tasks registry. Pure data flow: orgId → cleared set → readiness. Vendor-coupled to Lightfast tasks specifically (this is the implementation; future readiness sub-systems would have their own resolver file).

```ts
import { LIGHTFAST_REQUIRED_TASK_KEYS } from "./lightfast-tasks";
import { listClearedTasks } from "./org-tasks-repo";
import { deriveReadiness, type AuthReadiness } from "./readiness";

export async function resolveReadinessFromTasks(
  orgId: string
): Promise<AuthReadiness> {
  const cleared = await listClearedTasks(orgId);
  return deriveReadiness(LIGHTFAST_REQUIRED_TASK_KEYS, cleared);
}
```

#### 3. Composite resolver

**File**: `api/app/src/auth/resolve.ts`
**Changes**: Replace the monolithic body with the composer. Readiness resolver runs only when identity is `active` — gives us "n/a" for pending/unauthenticated for free.

```ts
import type { AuthContext } from "./context";
import { resolveIdentityFromClerk } from "./resolve-identity-clerk";
import { resolveReadinessFromTasks } from "./resolve-readiness-tasks";

export async function resolveAuth(headers: Headers): Promise<AuthContext> {
  const identity = await resolveIdentityFromClerk(headers);
  const readiness =
    identity.type === "active"
      ? await resolveReadinessFromTasks(identity.orgId)
      : ({ type: "n/a" } as const);
  return { identity, readiness };
}
```

#### 4. Phase-2 tests

**File**: `api/app/src/auth/resolve.test.ts` (new or updated)
**Changes**: Cover the composite cases. Mock both sub-resolvers (vi.mock).

- Identity unauthenticated → `{ identity: { type: "unauthenticated" }, readiness: { type: "n/a" } }`
- Identity pending → `{ identity: { type: "pending", userId }, readiness: { type: "n/a" } }` (readiness resolver NOT called)
- Identity active + no cleared rows → `{ identity: { type: "active", … }, readiness: { type: "pending", current: "connect-github", … } }`
- Identity active + connect-github cleared → `{ identity: { type: "active", … }, readiness: { type: "cleared" } }`

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app typecheck` clean
- [x] `pnpm --filter @api/app check` clean (ran via root `ultracite check api/app`)
- [x] `pnpm --filter @api/app test` passes (composite resolver tests in `__tests__/resolve.test.ts`; 5 files / 31 tests)
- [x] `grep -rn "publicMetadata" api/app/src/auth` returns 0
- [x] `grep -rn "org_lightfast_tasks\|orgLightfastTasks" api/app/src/auth` returns matches only in `lightfast-tasks/resolve.ts` and `lightfast-tasks/repo.ts` (plus a doc-comment reference in the composer `auth/resolve.ts`); zero leakage into `identity/types.ts`, `readiness/types.ts`, or `identity/resolve-clerk.ts`
- [x] `grep -rn "Clerk\|clerk\|@vendor/clerk" api/app/src/auth/{identity/types.ts,readiness/types.ts,lightfast-tasks/resolve.ts}` returns 0 (vendor decoupling intact)

#### Human Review

- [x] Confirmed the resolver hits `org_lightfast_tasks` against the real local Postgres. Threw a throwaway tsx script through the `db/app` env wrapper that called `resolveReadinessFromTasks('org_phase2_verify_throwaway')` four times around a row insert/delete cycle; with `log_statement='all'` enabled on the dev container, Postgres logged exactly four `select "task_key" from "org_lightfast_tasks" where ... org_id = $1` statements (pre-insert pending, post-insert cleared, double-insert cleared, post-delete pending). Script and elevated log setting reverted after.
- [x] Skip-on-non-active covered structurally by the `if (identity.type === "active")` guard in `auth/resolve.ts:14-17` plus the existing unit tests (`__tests__/resolve.test.ts` — both the "unauthenticated" and "pending" composition cases assert `expect(listClearedTasksMock).not.toHaveBeenCalled()`). Driving it end-to-end against the real DB would have required booting the full Next.js app for the Clerk cookie path; deemed redundant given the structural guard + mock-based negative assertion.

**Implementer notes (Phase 2):**

1. **File paths followed the Phase-1 per-primitive subdirectory layout.** Plan body refers to flat `auth/resolve-identity-clerk.ts`, `auth/resolve-readiness-tasks.ts`, `auth/org-tasks-repo.ts`; actual files are `auth/identity/resolve-clerk.ts`, `auth/lightfast-tasks/resolve.ts`, `auth/lightfast-tasks/repo.ts` (already created in Phase 1 in that location). The Clerk JWT claims schema (`ClerkJwtClaims`) lives privately in `auth/identity/resolve-clerk.ts` rather than being re-exported from `context.ts`.
2. **`context.ts` keeps the `UNAUTH` constant** for use by future callers, but no longer exports `clerkAuth` or `ClerkJwtClaims` — those moved into the identity resolver / factory.
3. **Existing middleware names retained.** Phase 2 keeps `requireAuth` and `requireOrg` and only updates their bodies to read `ctx.auth.identity.*`. Renames to `requireActiveIdentity` / `requireClearedReadiness` land in Phase 3 per plan.
4. **Router updates touched:** `(pending-allowed)/account.ts`, `(pending-allowed)/organization.ts`, `(pending-not-allowed)/org-api-keys.ts` — every `ctx.auth.userId` → `ctx.auth.identity.userId`, every `ctx.auth.orgId` → `ctx.auth.identity.orgId`, every `ctx.auth.type` → `ctx.auth.identity.type`. JSDoc references to "clerk-pending or clerk-active" updated to "pending or active identity" in `trpc.ts`, `root.ts`, and the router doc comments. Two stale JSDoc examples in `lib/activity.ts` (lines 98, 195) also updated to the composite shape; `ctx.session.userId` placeholders in those examples corrected to `ctx.auth.identity.userId`.
5. **Test setup for `resolve.test.ts`** mocks `auth/lightfast-tasks/repo` (the path the composer indirectly reaches via `lightfast-tasks/resolve.ts`) so `listClearedTasks` is controllable without standing up a DB. All seven pre-existing identity-only tests retained and updated to the new composite shape; four new readiness-composition tests added.

---

## Phase 3: Atomic Middlewares, Composition, Structured `errorFormatter`

### Overview

Split `requireOrg` into two atomic middlewares aligned with the two primitives. Compose both into `pendingNotAllowedProcedure` (default-safe). Add a sibling `activeIdentityProcedure` for the tasks router. Extend the tRPC `errorFormatter` to surface structured `data.lightfastTasksPending` on FORBIDDEN errors thrown by `requireClearedReadiness`. This is the chokepoint that gives us cross-transport enforcement.

### Changes Required

#### 1. Split `requireOrg` into atomic middlewares

**File**: `api/app/src/trpc.ts`
**Changes**: Rename `requireOrg` → `requireActiveIdentity` (it really only enforces the identity dimension). Add `requireClearedReadiness` as a sibling. Each narrows one dimension; downstream middlewares assume only what their predecessor narrowed.

```ts
const requireActiveIdentity = t.middleware(({ ctx, next }) => {
  if (ctx.auth.identity.type !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Active org required." });
  }
  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, identity: ctx.auth.identity } },
  });
});

const requireClearedReadiness = t.middleware(({ ctx, next }) => {
  // requireActiveIdentity has narrowed ctx.auth.identity to active.
  if (ctx.auth.readiness.type !== "cleared") {
    const pending =
      ctx.auth.readiness.type === "pending" ? ctx.auth.readiness : null;
    log.info("[readiness] denied", {
      orgId: ctx.auth.identity.type === "active" ? ctx.auth.identity.orgId : undefined,
      current: pending?.current,
    });
    // Throw with a structured shape the custom errorFormatter recognises.
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Complete required Lightfast tasks. Pending: ${pending?.current ?? "(unknown)"}`,
      cause: {
        kind: "LIGHTFAST_TASKS_PENDING",
        current: pending?.current ?? null,
        remaining: pending?.remaining ?? [],
      },
    });
  }
  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, readiness: ctx.auth.readiness } },
  });
});
```

#### 2. Compose at the chokepoint

**File**: `api/app/src/trpc.ts`
**Changes**: `pendingNotAllowedProcedure` carries BOTH gates. Update the JSDoc to make the new semantics explicit. Add the explicit opt-out procedure for the tasks router.

```ts
/**
 * No-Pending-State Procedure
 *
 * Admits sessions that are **fully ready**: identity active AND readiness
 * cleared. This is the default for org-scoped procedures — every router
 * under `pendingNotAllowed.*` (other than the tasks router itself)
 * inherits both gates without any per-router opt-in.
 *
 * The two gates are atomic and independent — see `requireActiveIdentity`
 * and `requireClearedReadiness`. The composition lives here so that the
 * safe default is one chokepoint, not N opt-ins.
 */
export const pendingNotAllowedProcedure = pendingAllowedProcedure
  .use(requireActiveIdentity)
  .use(requireClearedReadiness);

/**
 * Active-Identity Procedure (explicit opt-out from the readiness gate)
 *
 * Admits sessions with an active identity, regardless of readiness state.
 * The tasks router needs this so users with pending readiness can see the
 * checklist and complete tasks. **Use this only for the tasks router.**
 * Every other org-scoped procedure must use `pendingNotAllowedProcedure`.
 */
export const activeIdentityProcedure = pendingAllowedProcedure
  .use(requireActiveIdentity);
```

#### 3. Extend `errorFormatter` for the cross-transport contract

**File**: `api/app/src/trpc.ts`
**Changes**: The default formatter at `trpc.ts:49-65` propagates ZodError into `data.zodError`. Extend it to also propagate `data.lightfastTasksPending` when the thrown `TRPCError`'s cause matches our structured shape. Bearer clients (desktop/CLI) read `error.data.lightfastTasksPending` and act.

```ts
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === "BAD_REQUEST" && error.cause instanceof ZodError
        ? error.cause.flatten()
        : null;

    const cause = error.cause;
    const lightfastTasksPending =
      cause &&
      typeof cause === "object" &&
      "kind" in cause &&
      (cause as { kind?: unknown }).kind === "LIGHTFAST_TASKS_PENDING"
        ? {
            current: (cause as { current?: string | null }).current ?? null,
            remaining: (cause as { remaining?: string[] }).remaining ?? [],
          }
        : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
        lightfastTasksPending,
      },
    };
  },
});
```

This is the only mechanism Bearer transports get for structured rejection — it must land in v1.

#### 4. Phase-3 tests (land with code)

**File**: `api/app/src/__tests__/readiness-gate.test.ts` (new)
**Changes**: Direct middleware test via a tRPC test caller. Cases:
- `pendingNotAllowedProcedure` with `ctx.auth.readiness: { type: "pending", current: "connect-github", remaining: ["connect-github"] }` → throws FORBIDDEN; assert `error.data.lightfastTasksPending` matches the cause shape.
- Same procedure with `ctx.auth.readiness: { type: "cleared" }` → handler runs.
- `activeIdentityProcedure` with `ctx.auth.readiness: { type: "pending", … }` → handler runs (opt-out works).
- `pendingNotAllowedProcedure` with `ctx.auth.identity: { type: "pending", … }` → throws FORBIDDEN with the identity message (not the readiness message — `requireActiveIdentity` runs first).

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app typecheck` clean (composite ctx narrowing carries through all 4 existing `pendingNotAllowedProcedure` callers in `orgApiKeysRouter` without modification)
- [x] `pnpm --filter @lightfast/app typecheck` clean (zero client call-site changes required) — package is `@lightfast/app`, not `@apps/app`
- [x] `npx ultracite@latest check api/app` clean (api/app has no per-package `check` script; root-level ultracite covers it)
- [x] `pnpm --filter @api/app test` passes — 6 files / 39 tests including 8 new in `readiness-gate.test.ts`
- [x] `grep -rn "requireOrg\b" api/app/src` returns 0 (rename complete)
- [x] `grep -rn "requireActiveIdentity\|requireClearedReadiness" api/app/src` returns matches in `trpc.ts` only

#### Human Review

- [x] Verified end-to-end against the live dev stack. Provisioned a throwaway Clerk test user via `.claude/skills/lightfast-clerk/command/token.sh`, created `org_3DskVlVFW1YztObXnPdI75qehGt` via the Clerk Backend API with that user as `created_by` (membership auto-attaches), and minted a `lightfast-desktop`-template JWT carrying `org_id` set to the new org. Bearer `GET https://app.lightfast.localhost/api/trpc/pendingNotAllowed.orgApiKeys.list?batch=1&input=…` returned **HTTP 403** with `data.code = "FORBIDDEN"` and `data.lightfastTasksPending = { current: "connect-github", remaining: ["connect-github"] }` — exactly the wire contract the readiness gate promises. Skipped DevTools-in-browser since the structured payload is the cross-transport contract and Bearer is the harder (desktop/CLI) path; cookie-on-web inherits the same `errorFormatter`.
- [x] `INSERT INTO org_lightfast_tasks (org_id, task_key) VALUES ('org_3DskVlVFW1YztObXnPdI75qehGt', 'connect-github')` → re-ran the same Bearer fetch (with a freshly-minted JWT to avoid the previous session's expiry) and got **HTTP 200** with `result.data.json = []` (empty list because no API keys exist yet — gate passed, which is what the test asserts). Confirms the resolver re-reads `org_lightfast_tasks` on every request and flips `readiness` to `cleared` without a session refresh. Cleaned up afterwards: deleted the row, deleted the Clerk org (`DELETE /v1/organizations/<id>` → 200), and deleted the test user via the skill (`delete-user.sh phase3-verify`).

**Implementer notes (Phase 3):**

1. **Readiness gate is inlined inside `pendingNotAllowedProcedure`, not exposed as a named middleware.** Plan body sketches `requireClearedReadiness` as a sibling `t.middleware(...)`. In practice, a standalone middleware sees the *base* ctx type (full `AuthIdentity` union) and re-broadens `auth.identity` when its return spreads `...ctx.auth` to override the readiness slot — which silently undoes the active-identity narrowing for all four downstream `orgApiKeysRouter` handlers. Inlining the gate inside the procedure composition (`.use(requireActiveIdentity).use(({ ctx, next }) => { … })`) gives the inner callback a properly-narrowed ctx and lets the readiness override flow with identity still narrowed. Same behavioral contract, same single chokepoint, no call-site changes.
2. **`activeIdentityProcedure` is still a standalone procedure export** (Phase 4's tasks router consumes it). Identity-only narrowing works with a standalone `requireActiveIdentity` middleware because there is no second gate widening `auth`.
3. **errorFormatter shape decision.** The structured cause uses `kind: "LIGHTFAST_TASKS_PENDING"` as a discriminator. The formatter detects it via a private `isLightfastTasksPendingCause` type guard and emits `data.lightfastTasksPending = { current, remaining }` (no `kind` on the wire — the data slot's *presence* is itself the discriminator).
4. **Test approach combines two transports.** `readiness-gate.test.ts` exercises:
   - the middleware contract via `createCallerFactory` (asserts `code`, `message`, structured `cause`),
   - the wire contract via `fetchRequestHandler` (asserts `error.json.data.lightfastTasksPending` in the v11 + superjson envelope).
   The wire test confirms the formatter actually runs in the HTTP path — `createCaller` skips `errorFormatter`, so a caller-only test would not have caught a regression in the formatter.
5. **Vendor mock surface for `readiness-gate.test.ts`.** Imports `trpc.ts` directly, so the test file mocks `@vendor/clerk/env`, `@vendor/clerk/server`, `@db/app/client`, `@vendor/observability/log/next`, and stubs out `createObservabilityMiddleware` (so its config shim is not required). The mocks are not load-bearing for the gates themselves; they exist solely so importing `trpc.ts` does not pull real env vars or hit Postgres.
6. **Drift versus plan text.** Plan §3 success criteria say `pnpm --filter @apps/app typecheck` — the package is actually `@lightfast/app`. Plan also lists `pnpm --filter @api/app check`; api/app has no per-package `check` script. Used `npx ultracite@latest check api/app` (the same command Phase 2 used) to satisfy the lint check. Checkboxes above reflect the actual commands run.

---

## Phase 4: Tasks Router

### Overview

Create `tasksRouter` with two procedures: `getStatus` (pure read of `ctx.auth.readiness` + registry metadata) and `completeConnectGithub` (idempotent insert into `org_lightfast_tasks`). The router lives at `pendingNotAllowed.tasks` using the opt-out procedure. No `session.reload()` needed on the client — the DB read in the resolver reflects the write on the very next request.

### Changes Required

#### 1. Tasks router

**File**: `api/app/src/router/(pending-not-allowed)/tasks.ts` (new)
**Changes**: Two concrete procedures. Both use `activeIdentityProcedure` because the router must admit users with pending readiness.

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { log } from "@vendor/observability/log/next";

import { LIGHTFAST_TASKS } from "../../auth/lightfast-tasks";
import { markTaskCleared } from "../../auth/org-tasks-repo";
import { activeIdentityProcedure } from "../../trpc";

export const tasksRouter = {
  /**
   * Read current task state derived from auth context + registry.
   * No DB hit — `ctx.auth.readiness` was populated by the resolver.
   */
  getStatus: activeIdentityProcedure.query(({ ctx }) => {
    const readiness = ctx.auth.readiness;
    const isCleared = (key: string) =>
      readiness.type === "cleared" ||
      (readiness.type === "pending" && !readiness.remaining.includes(key));
    return LIGHTFAST_TASKS.map((t) => ({
      key: t.key,
      label: t.label,
      required: t.required !== false,
      cleared: isCleared(t.key),
    }));
  }),

  /**
   * Mark `connect-github` complete. Idempotent INSERT … ON CONFLICT DO
   * NOTHING. The very next authenticated request reads the new row via
   * `resolveReadinessFromTasks`, so no client-side `session.reload()` is
   * needed — JWT carries no readiness state.
   */
  completeConnectGithub: activeIdentityProcedure.mutation(async ({ ctx }) => {
    // requireActiveIdentity narrows identity to active; defensive cast for TS.
    if (ctx.auth.identity.type !== "active") {
      throw new Error("unreachable: requireActiveIdentity ran");
    }
    await markTaskCleared(ctx.auth.identity.orgId, "connect-github");
    log.info("[lightfast-tasks] completed", {
      orgId: ctx.auth.identity.orgId,
      key: "connect-github",
    });
    return { ok: true };
  }),
} satisfies TRPCRouterRecord;
```

#### 2. Wire into `root.ts`

**File**: `api/app/src/root.ts`
**Changes**: Add `tasks` alongside `orgApiKeys`. Update the file's banner JSDoc to reflect the new admission rules.

```ts
/**
 * App router — gate-based grouping of tRPC procedures.
 *
 * Sub-routers are nested by the auth admission rule they enforce:
 * - `pendingAllowed`:    admits identity pending OR active (any readiness).
 * - `pendingNotAllowed`: admits identity active AND readiness cleared
 *                        (default for org work). The tasks router under
 *                        here uses an opt-out procedure that admits
 *                        pending readiness.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { organizationRouter } from "./router/(pending-allowed)/organization";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { tasksRouter } from "./router/(pending-not-allowed)/tasks";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  pendingNotAllowed: createTRPCRouter({
    orgApiKeys: orgApiKeysRouter,
    tasks: tasksRouter,
  }),
});

export type AppRouter = typeof appRouter;
```

#### 3. Phase-4 tests (land with code)

**File**: `api/app/src/router/(pending-not-allowed)/tasks.test.ts` (new)
**Changes**: tRPC test caller with mocked repository (vi.mock on `org-tasks-repo`). Cases:
- `getStatus` with `ctx.auth.readiness: { type: "pending", … }` returns `[{ key: "connect-github", cleared: false, … }]`.
- `getStatus` with `ctx.auth.readiness: { type: "cleared" }` returns `[{ key: "connect-github", cleared: true, … }]`.
- `completeConnectGithub` calls `markTaskCleared(orgId, "connect-github")` exactly once.
- `completeConnectGithub` called twice in succession — `markTaskCleared` invoked twice; assertion is on the call shape, idempotency is guaranteed by the DB layer (composite PK + `ON CONFLICT DO NOTHING`).

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @api/app typecheck` clean
- [ ] `pnpm --filter @api/app check` clean
- [ ] `pnpm --filter @api/app test` passes (new tests in `tasks.test.ts`)
- [ ] `grep -rn "session\.reload\|sessionReload" api/app/src apps/app/src` returns no new matches introduced by this plan
- [ ] `grep -rn "publicMetadata" api/app/src/router api/app/src/auth` returns 0 (tasks router has zero publicMetadata coupling)
- [ ] tRPC routes exist: `appRouter.pendingNotAllowed.tasks.getStatus`, `appRouter.pendingNotAllowed.tasks.completeConnectGithub`

#### Human Review

- [ ] Fresh org with no `org_lightfast_tasks` rows → call `/api/trpc/pendingNotAllowed.tasks.getStatus` → returns `[{ key: "connect-github", cleared: false, required: true, label: "Connect GitHub" }]`
- [ ] Call `/api/trpc/pendingNotAllowed.tasks.completeConnectGithub` → returns `{ ok: true }`; verify a row appears in `org_lightfast_tasks` via `pnpm db:studio`
- [ ] Re-call `getStatus` → `cleared: true`
- [ ] Re-call `completeConnectGithub` → still returns `{ ok: true }`; row count for that (org, key) is still 1

---

## Phase 5: UI — Layout Redirect, Checklist, connect-github Page

### Overview

Wire the user-facing pieces. Add a defensive server-side redirect in the existing `[slug]/layout.tsx` (NOT a primary gate — tRPC is the authority; the redirect avoids SSR error pages). Add a checklist page and a per-task page. The `connect-github` page calls `tasks.completeConnectGithub` and navigates; no `session.reload()` needed because the DB is source of truth.

### Changes Required

#### 1. Extend `[slug]/layout.tsx` with the readiness redirect

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx`
**Changes**: After the existing `requireOrgAccess` block succeeds, check readiness and `redirect()` if pending. Reads from the DB once (via the same repo) — acceptable cost on a layout that already does an org-access check. Import the pure derivation function from `@api/app/auth`.

```tsx
import { getOrgReadiness } from "@/lib/org-readiness";
import { redirect } from "next/navigation";

// ... inside the layout, after requireOrgAccess succeeds:
const readiness = await getOrgReadiness(orgId);
if (readiness.type === "pending") {
  redirect(`/${slug}/tasks/${readiness.current}`);
}
```

**File**: `apps/app/src/lib/org-readiness.ts` (new)
**Changes**: Server-only helper that wraps the api/app repo for use from the layout. Keeps `apps/app` from deep-importing `@api/app/src/...`.

```ts
import "server-only";
import {
  deriveReadiness,
  LIGHTFAST_REQUIRED_TASK_KEYS,
  type AuthReadiness,
} from "@api/app/auth";
import { listClearedTasks } from "@api/app/auth/repo";

export async function getOrgReadiness(orgId: string): Promise<AuthReadiness> {
  const cleared = await listClearedTasks(orgId);
  return deriveReadiness(LIGHTFAST_REQUIRED_TASK_KEYS, cleared);
}
```

#### 2. Checklist page

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/tasks/page.tsx` (new)
**Changes**: Server page prefetches `tasks.getStatus`; client child renders one row per task with a "Continue" link.

```tsx
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { TasksChecklist } from "./_components/tasks-checklist";

export default function TasksPage() {
  prefetch(trpc.pendingNotAllowed.tasks.getStatus.queryOptions());
  return (
    <HydrateClient>
      <Suspense>
        <TasksChecklist />
      </Suspense>
    </HydrateClient>
  );
}
```

**File**: `.../tasks/_components/tasks-checklist.tsx` (new client component)
**Changes**: `useSuspenseQuery` on `tasks.getStatus`. For each row: render label + status. For pending rows: link to `/{slug}/tasks/{key}`. Cleared rows are read-only — no un-clear in v1.

#### 3. connect-github task page

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/tasks/[key]/page.tsx` (new)
**Changes**: Server page renders `<ConnectGithubTask />` when `params.key === "connect-github"`; otherwise `notFound()`.

**File**: `.../tasks/[key]/_components/connect-github-task.tsx` (new client component)
**Changes**: Mutation + navigation. No `session.reload()` — DB is source of truth and the resolver reads it on the next request.

```tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@repo/app-trpc/react";
import { useMutation } from "@tanstack/react-query";

export function ConnectGithubTask() {
  const trpc = useTRPC();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const complete = useMutation(
    trpc.pendingNotAllowed.tasks.completeConnectGithub.mutationOptions({
      onSuccess: () => {
        // No session.reload() needed — DB is source of truth; the layout's
        // server-side check on /[slug] reads the fresh DB row.
        router.push(`/${params.slug}`);
      },
    })
  );
  return (
    <button onClick={() => complete.mutate()} disabled={complete.isPending}>
      {complete.isPending ? "Connecting…" : "Connect GitHub"}
    </button>
  );
}
```

#### 4. Phase-5 tests (land with code)

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx` (new or extended)
**Changes**: Mock `getOrgReadiness` (`vi.mock("@/lib/org-readiness")`) to return: (a) pending → assert `redirect("/<slug>/tasks/connect-github")` called; (b) cleared → assert no redirect and `children` rendered.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @apps/app typecheck` clean
- [ ] `pnpm --filter @apps/app check` clean
- [ ] `pnpm --filter @apps/app test` passes (new layout test)
- [ ] Files exist:
  - [ ] `apps/app/src/lib/org-readiness.ts`
  - [ ] `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/tasks/page.tsx`
  - [ ] `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/tasks/[key]/page.tsx`
- [ ] `grep -rn "from \"@api/app/src/" apps/app/src` returns 0 (no deep-path imports introduced)
- [ ] `grep -rn "from \"@api/app/auth\"" apps/app/src` returns ≥ 1 (pure subpath export used)
- [ ] `grep -rn "session\.reload" apps/app/src` returns no new matches

#### Human Review

- [ ] Sign in to a fresh org → visit `/<slug>` directly → URL changes to `/<slug>/tasks/connect-github`
- [ ] Visit `/<slug>/settings/api-keys` mid-task → redirects to `/<slug>/tasks/connect-github`
- [ ] Press "Connect GitHub" → page redirects to `/<slug>` → workspace home renders without bouncing back (no JWT staleness — DB read on next request reflects the write)
- [ ] Inspect Postgres: `SELECT * FROM org_lightfast_tasks WHERE org_id = '<orgId>'` → one row, `task_key = 'connect-github'`, `cleared_at` recent
- [ ] To re-test the gate locally: `DELETE FROM org_lightfast_tasks WHERE org_id = '<orgId>'`, hard-reload `/<slug>` → bounces to the task page again (no `session.reload()` needed)
- [ ] `/<slug>/settings/api-keys` renders after completion; network tab shows `pendingNotAllowed.orgApiKeys.list` returning the keys list

---

## Testing Strategy

Tests land with the phase that introduces the code. No separate test phase.

### Unit (Phase 1)

- `deriveReadiness` — table-driven across empty / partial / fully-cleared sets + forwards-compat (unknown keys) + ordering. Tests use arbitrary string keys to prove the function isn't Lightfast-coupled.
- `LIGHTFAST_TASKS` registry shape — `connect-github` present, `required !== false`, `LIGHTFAST_REQUIRED_TASK_KEYS` matches.
- `lightfastTaskKeySchema` — accepts `"connect-github"`, rejects unknown.

### Integration (Phase 2 + 3 + 4)

- Composite resolver — identity dimension tested independently of readiness dimension, then composed.
- `requireActiveIdentity` — denies on `identity.type !== "active"`.
- `requireClearedReadiness` — denies on `readiness.type !== "cleared"`; the thrown FORBIDDEN's `data.lightfastTasksPending` carries the expected `{ current, remaining }` shape.
- `activeIdentityProcedure` — opt-out works: admits pending readiness.
- `tasks.completeConnectGithub` — mocked `markTaskCleared` is called with the expected args; idempotency verified via repeat call.

### Component (Phase 5)

- `[slug]/layout.tsx` — mocked `getOrgReadiness` returning pending → `redirect()` called with `/<slug>/tasks/connect-github`; cleared → children rendered, no redirect.

### End-to-end (manual until automated)

Phase 5 human-review steps cover the new-user funnel. The gate re-engagement path (delete the row + reload) is documented in Phase 5 human review but not automated.

## Performance Considerations

- **Gate read cost**: one extra DB query per authenticated request that reaches `pendingNotAllowedProcedure`-backed routes. PK lookup on a small table (≤ N tasks × N orgs rows). Sub-millisecond on Postgres. Add Redis cache (with explicit invalidation in `markTaskCleared`) if measurement shows the need.
- **`tasks.getStatus` cost**: zero DB calls in the procedure body — pure read of `ctx.auth.readiness` populated by the resolver. The resolver's DB call is the same one every other org-scoped procedure already made for this request.
- **`tasks.completeConnectGithub` cost**: one INSERT (idempotent via `ON CONFLICT DO NOTHING`).
- **JWT size**: zero impact — readiness is not carried in the JWT. No Clerk JWT template change required.
- **Concurrent writes**: composite PK + `ON CONFLICT DO NOTHING` makes `markTaskCleared` race-free at the DB layer. No application-level lock needed.

## Migration Notes

- **Existing orgs** have no rows in `org_lightfast_tasks` and are therefore `readiness.type === "pending"` from the moment Phase 3 ships. Until they complete `connect-github`, every `pendingNotAllowedProcedure`-backed route (currently `orgApiKeys.*`) returns 403. The Phase 5 layout redirect bounces web users to the task page; Bearer clients receive the structured `data.lightfastTasksPending` payload.
- **No Clerk dashboard config required.** Removed from the plan — the JWT template change the original plan needed is unnecessary now that DB is source of truth.
- **Backout**: cheapest unlock is to drop `.use(requireClearedReadiness)` from `pendingNotAllowedProcedure`'s definition. This re-opens every gated procedure regardless of readiness state. The DB table stays in place; no data damage. The composite `AuthContext` shape stays; downstream code that read `ctx.auth.identity.orgId` is unaffected.
- **No data migration needed.** The new table is additive.

## References

- Sibling rename plan (completed prerequisite): `thoughts/shared/plans/2026-05-14-pending-allowed-not-allowed-scopes.md`
- Existing patterns this mirrors:
  - Procedure ladder: `api/app/src/trpc.ts:115-191`
  - Group-by-gate router: `api/app/src/root.ts:20-28`
  - Layout-level gate (`notFound()`): `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx:32-41`
  - Package subpath exports: `api/app/package.json` `exports["./inngest"]`
  - Drizzle migrations: `db/app/src/schema/*.ts` (run `pnpm --filter @db/app db:generate`)
- Clerk dashboard inventory + `force_organization_selection`: `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md`
- Onboarding funnel context: `thoughts/shared/2026-04-23-onboarding-funnel-v2.md`
- Clerk SessionTask is a closed union (verified): `node_modules/.pnpm/@clerk+shared@4.10.2_*/node_modules/@clerk/shared/dist/runtime/index-BTdJ4Y4V.d.ts:4181`; runtime route map `@internal`: `node_modules/.pnpm/@clerk+shared@4.10.2_*/node_modules/@clerk/shared/dist/runtime/internal/clerk-js/sessionTasks.js:21-25`
- Existing files being modified:
  - `api/app/src/auth/context.ts` (replace 3-variant union with composite)
  - `api/app/src/auth/resolve.ts` (collapse to composer; sub-resolvers in new files)
  - `api/app/src/trpc.ts` (split `requireOrg` → `requireActiveIdentity` + `requireClearedReadiness`; compose at `pendingNotAllowedProcedure`; extend `errorFormatter`)
  - `api/app/src/root.ts` (add `tasks` under `pendingNotAllowed`)
  - `api/app/package.json` (add `./auth` and `./auth/repo` subpath exports)
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx` (add readiness redirect after `requireOrgAccess`)
- Files being added:
  - `api/app/src/auth/{identity,readiness,lightfast-tasks,index,resolve-identity-clerk,resolve-readiness-tasks,org-tasks-repo}.ts`
  - `db/app/src/schema/org-lightfast-tasks.ts` (+ generated migration)
  - `api/app/src/router/(pending-not-allowed)/tasks.ts`
  - `apps/app/src/lib/org-readiness.ts`
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/tasks/{page.tsx,[key]/page.tsx,_components/*}`
- Files NOT being moved (zero `git mv` in this plan):
  - `api/app/src/router/(pending-not-allowed)/org-api-keys.ts` (stays put)
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/*` (no `(tasks-cleared)/` route group)

---

## Improvement Log

### 2026-05-18 (cont.) — Vendor-agnostic naming pivot (Option B)

Names finalised after a focused naming discussion. The two primitive types and all their associated symbols are now **vendor-agnostic**; Clerk and Lightfast tasks are explicit implementations referenced only in resolver filenames and bodies.

**Type renames**

- `ClerkIdentity` → `AuthIdentity` (file: `auth/clerk-identity.ts` → `auth/identity.ts`)
- `LightfastState` → `AuthReadiness` (split out into new file: `auth/readiness.ts`)
- The `LIGHTFAST_TASKS` registry stays in `auth/lightfast-tasks.ts` — this *is* a Lightfast-specific implementation detail and the name is honest

**Function / symbol renames**

- `resolveClerkAuth` → `resolveIdentityFromClerk` (file: `auth/resolve-clerk.ts` → `auth/resolve-identity-clerk.ts`)
- `resolveLightfastTasks` → `resolveReadinessFromTasks` (file: `auth/resolve-lightfast.ts` → `auth/resolve-readiness-tasks.ts`)
- `requireClerkActive` → `requireActiveIdentity`
- `requireLightfastCleared` → `requireClearedReadiness`
- `deriveLightfastState` → `deriveReadiness` (signature changed: now takes `(requiredKeys, cleared)` to be truly vendor-agnostic)
- `clerkIdentity()` factory → `authIdentity()`
- `CLERK_UNAUTH` → `UNAUTH_IDENTITY`
- `pendingNotAllowedAllowingTasksProcedure` → `activeIdentityProcedure` (shorter and describes the gate it does carry, not the gate it skips)
- `getOrgLightfastState` → `getOrgReadiness` (apps/app helper)
- `apps/app/src/lib/lightfast-tasks-server.ts` → `apps/app/src/lib/org-readiness.ts`

**Field renames on `AuthContext`**

- `auth.clerk` → `auth.identity`
- `auth.lightfast` → `auth.readiness`

**File structure refinement**

The original Phase 1 had `LightfastState` + `deriveLightfastState` colocated with the registry in `lightfast-tasks.ts`. With the vendor-agnostic rename, the type and the (now-generic) derivation function move to a separate `readiness.ts` that has zero Lightfast imports. The Lightfast-tasks resolver (`resolve-readiness-tasks.ts`) is the bridge: it imports the registry's required keys + calls the pure derivation. This is the genuine decoupling Option B exists to enable — adding billing-readiness or terms-readiness later requires a new resolver file and no changes to the types or middlewares.

**What stayed**

- The cross-transport error contract field name `data.lightfastTasksPending` is unchanged — it specifically identifies *which* readiness implementation is gating, which is what Bearer clients need to dispatch on. Future readiness implementations get sibling fields (`data.billingPending`, etc.) rather than wrapping under a generic `data.readinessPending`.
- The `cause.kind: "LIGHTFAST_TASKS_PENDING"` string is unchanged for the same reason.
- The registry name `LIGHTFAST_TASKS` is unchanged.

### 2026-05-18 — Architectural pivot to two-primitive composite

Replaces the original "extend `clerk-active` with a `tasks` field" design with a dual `AuthContext` composed of two orthogonal primitives.

**Critical architecture change**

1. **`AuthContext` is now a composite of two orthogonal dimensions**, not a discriminated union with tasks-as-a-field on the `clerk-active` variant. Each dimension owns its own state type, resolver, and middleware. Zero cross-imports between the two primitive modules. Rationale: the readiness gate is *our* primitive — modelling it as fields inside a `Clerk`-prefixed type was a leaky abstraction. Future readiness dimensions (billing-active, terms-accepted, workspace-quota-ok) become new implementations of the same `AuthReadiness` type, not new variants of a swelling Clerk-flavored union.

2. **Default-safe composition at the procedure chokepoint.** `pendingNotAllowedProcedure` now carries BOTH gates by default. Forgetting to think about readiness on a new org-scoped router becomes a TypeScript narrowing error (because `ctx.auth.readiness` isn't narrowed to `cleared`), not a silent bypass. The tasks router uses a new, explicitly-named `activeIdentityProcedure` for opt-out — the name describes what it admits, not what it skips.

3. **Source of truth moved from `publicMetadata` to a dedicated Drizzle table.** `org_lightfast_tasks(org_id, task_key, cleared_at)` with composite PK. Atomic upserts via `INSERT ... ON CONFLICT DO NOTHING`. Eliminates the read-modify-write race the original plan accepted. Removes the Clerk dashboard JWT-template precondition entirely. Removes the JWT staleness race — DB read on the next request reflects the write immediately, so `session.reload()`-before-navigate is no longer needed.

**Cross-transport enforcement (was deferred to v2; now in v1)**

4. **Custom `errorFormatter` ships in v1.** Extends the default formatter to surface `data.lightfastTasksPending = { current, remaining }` on FORBIDDEN errors thrown by `requireClearedReadiness`. Desktop (Bearer) and future CLI (Bearer) now have a machine-readable contract from day one. The original plan's "vanilla 403 for non-web clients" is replaced.

5. **Single chokepoint at `pendingNotAllowedProcedure`** covers all transports — cookie (web), Bearer (desktop, CLI) — because all transports collapse to `ctx.auth` via the composite resolver. The layout-level `redirect()` remains as a defensive UX nicety to avoid SSR error pages, but is no longer the primary gate.

**Deletions vs the previous version of this plan**

6. **No `(tasks-cleared)/(workspace)/` route group restructure.** The typed gate covers it. Saves a `git mv` of the entire `(workspace)/` tree and its tests.
7. **No 4th tRPC procedure tier (`tasksClearedProcedure`).** The composition lives on `pendingNotAllowedProcedure`. One less name to learn; one less opt-in to forget.
8. **No Clerk JWT template config.** DB is source of truth; the JWT carries no readiness state. Removes the "JWT staleness causes 50s authorization lag" failure mode entirely.
9. **No `org.publicMetadata` writes.** Tasks router uses the new repo + Drizzle table.
10. **No `session.reload()` before navigate.** DB-source-of-truth means the next request just sees the new state.

**Acknowledged but unchanged**

11. **Concrete per-task mutations** stay (no generic `complete({ key })` dispatch). Promote when 2+ tasks share writeback semantics.
12. **One-way clearing in v1** — no `uncomplete`. Local re-test path is now `DELETE FROM org_lightfast_tasks WHERE …` (simpler than editing Clerk dashboard JSON).
13. **No real GitHub OAuth wiring** in v1. The mutation flips the DB row; real install verification is a follow-up.
14. **Layout-level `redirect()`** is still a new pattern in this codebase, but now it's defensive (UX), not load-bearing — the tRPC gate is the authority.

### 2026-05-14 — Adversarial review (preserved for history)

Findings driven by codebase analysis and pattern search; user decisions captured via AskUserQuestion. No spike run — the remaining uncertainty (Clerk JWT template wiring) requires dashboard access and isn't locally spike-able.

**Critical fixes**

1. **Removed structured `TRPCError.cause`** (was: `cause: { reason: "LIGHTFAST_TASKS_PENDING", current, remaining }`). Default tRPC `errorFormatter` does not propagate custom cause objects on the wire (`trpc.ts:49-65`); every existing use of `cause` in the codebase is opaque-exception passthrough (`organization.ts:133,229`; `account.ts:94`). The original cross-transport contract was structurally broken. User chose "drop cross-transport for v1"; gate threw plain FORBIDDEN with a descriptive message. **Superseded by the 2026-05-18 architecture pivot, which restores the structured contract via a custom `errorFormatter` extension.**
2. **Resolved cross-package import boundary.** Plan previously oscillated between `@vendor/clerk` (wrong — vendor shim owns zero domain types) and `@api/app/src/auth/lightfast-tasks` (wrong — zero precedent for `@api/app/src/...` deep-path imports anywhere). Decision: add a new `@api/app/auth` package subpath export, mirroring the existing `@api/app/inngest` pattern.
3. **Sequenced with the sibling rename plan.** `2026-05-14-pending-allowed-not-allowed-scopes.md` Phase 1 + Phase 2 automated work is already shipped. This plan inherits the `pendingAllowed`/`pendingNotAllowed` names and performs no further renames.

**High-impact simplifications**

4. **Collapsed the registry to metadata-only.** `LIGHTFAST_TASKS` is now `{ key, label, required? }[]`. Removed per-entry `check`/`markComplete`/`markIncomplete` dispatch. Each task gets its own concrete tRPC mutation.
5. **Renamed verbose route groups** from `(tasks-pending-allowed)` / `(tasks-pending-not-allowed)` to `(tasks-pending)` / `(tasks-cleared)`. **Superseded by 2026-05-18 — no route restructure at all.**
6. **Dropped `tasks.getStatus` bidirectional reconciliation.**
7. **Dropped the `uncomplete` mutation entirely.**
8. **Pulled all tests into the phases that introduce the code.**

**Pattern precedents acknowledged**

9. **Layout-level `redirect()` is a new pattern.** Today only `notFound()` is used as a layout gate. The original plan introduced layout-redirect as a primary gate inside a new `(tasks-cleared)/` group. **Superseded by 2026-05-18: layout-redirect lives in the existing `[slug]/layout.tsx` as a defensive UX nicety, not the primary gate.**
10. **`session.reload()`-before-navigate is a new pattern.** **Superseded by 2026-05-18: no longer needed because DB is source of truth.**

**Acknowledged but not fixed in v1 (status under 2026-05-18 pivot)**

11. **Concurrent writeback race on org publicMetadata** — **resolved by the move to a dedicated DB table with composite-PK `ON CONFLICT DO NOTHING`.**
12. **Clerk `force_organization_selection=true` interaction** — unchanged; the two systems still compose orthogonally.
13. **JWT staleness window** — **resolved by DB-source-of-truth; JWT carries no readiness state.**
