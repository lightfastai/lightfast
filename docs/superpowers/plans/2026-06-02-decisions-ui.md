# Decisions UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only `/:slug/decisions` workspace page that lists recent integration call ledger rows as user-facing Decisions.

**Architecture:** Add a DB list helper over `integrationCalls`, expose it through `org.workspace.decisions.list`, prefetch it in a new Next.js page, and render a hydrated client list. Add the route to sidebar navigation and proxy protection.

**Tech Stack:** Drizzle, PlanetScale MySQL, tRPC, Next.js App Router, React Query, Vitest, Testing Library, Biome.

---

### Task 1: DB List Helper

**Files:**
- Modify: `db/app/src/utils/integration-calls.ts`
- Test: `db/app/src/__tests__/integration-calls.test.ts`

- [ ] Write a failing test that inserts multiple ledger rows for two orgs and expects `listIntegrationCalls(db, { clerkOrgId: "org_acme", limit: 2 })` to return only the newest two rows for that org.
- [ ] Run `pnpm --filter @db/app exec vitest run src/__tests__/integration-calls.test.ts`; expected failure: `listIntegrationCalls` is not exported or defined.
- [ ] Implement `listIntegrationCalls` using `eq(integrationCalls.clerkOrgId, input.clerkOrgId)`, `orderBy(desc(integrationCalls.createdAt), desc(integrationCalls.id))`, and a bounded limit.
- [ ] Export the helper from `db/app/src/index.ts`.
- [ ] Rerun the DB test; expected pass.

### Task 2: API Router

**Files:**
- Create: `api/app/src/router/(pending-not-allowed)/decisions.ts`
- Modify: `api/app/src/root.ts`
- Test: `api/app/src/__tests__/decisions-router.test.ts`

- [ ] Write a failing router test that mocks `@db/app` `listIntegrationCalls`, calls `caller().decisions.list({ limit: 10 })`, and expects the DB helper to receive the active `ctx.auth.identity.orgId`.
- [ ] Add validation with `z.object({ limit: z.number().int().min(1).max(100).default(50).optional() })`.
- [ ] Implement `decisionsRouter.list` as a `boundOrgProcedure`.
- [ ] Mount it at `org.workspace.decisions` in `api/app/src/root.ts`.
- [ ] Rerun the router test; expected pass.

### Task 3: Workspace UI

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-page.test.tsx`

- [ ] Write a failing page test that expects the page to prefetch `trpc.org.workspace.decisions.list.queryOptions({ limit: 50 })` and render `Decisions`.
- [ ] Write a failing client test that renders succeeded and failed rows with provider/tool, caller, relative time, duration, redacted payload markers, and error code.
- [ ] Implement the page prefetch and hydrated client.
- [ ] Implement the client as a compact list with an empty state for zero rows.
- [ ] Rerun the app decisions page test; expected pass.

### Task 4: Navigation And Route Protection

**Files:**
- Modify: `apps/app/src/components/app-sidebar.tsx`
- Modify: `apps/app/src/proxy.ts`
- Test: `apps/app/src/__tests__/components/app-sidebar.test.tsx`
- Test: `apps/app/src/__tests__/proxy.test.ts`

- [ ] Write failing assertions that the sidebar renders a Decisions link to `/${slug}/decisions` and marks it active for nested decisions routes.
- [ ] Write failing proxy assertions that `/:slug/decisions(.*)` is a protected bound-org workspace route.
- [ ] Add the sidebar item with a lucide icon and add the proxy pattern.
- [ ] Rerun the sidebar and proxy tests; expected pass.

### Task 5: Verification

- [ ] Run `pnpm exec biome check` on all changed files.
- [ ] Run focused tests:
  - `pnpm --filter @db/app exec vitest run src/__tests__/integration-calls.test.ts`
  - `pnpm --filter @api/app exec vitest run src/__tests__/decisions-router.test.ts`
  - `pnpm --filter @lightfast/app exec vitest run 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-page.test.tsx' src/__tests__/components/app-sidebar.test.tsx src/__tests__/proxy.test.ts`
- [ ] Run typechecks for `@db/app`, `@api/app`, and `@lightfast/app`.
