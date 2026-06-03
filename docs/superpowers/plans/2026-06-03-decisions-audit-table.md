# Decisions Audit Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Decisions page from a centered card-list with a slide-in panel into a full-width, day-grouped audit table with inline row expansion, backed by server-side cursor pagination, filtering, and search.

**Architecture:** Mirror the proven People feature stack end-to-end — keyset DB pagination (`db/app`), a `boundOrgProcedure` tRPC list with shared cursor/limit/search inputs (`api/app`), and a nuqs-driven `useInfiniteQuery` client (`apps/app`) — but swap People's detail *sheet* for an *inline accordion expand* deep-linked via `?decision=<publicId>`. Reuse shared components everywhere (time utils, `CodeBlock` JSON inspector, `SSRCodeBlockCopyButton`, `IsoFigure`); the only new shared asset is an `x` brand mark added to `@repo/ui` `IntegrationLogoIcons`.

**Tech Stack:** Drizzle (PlanetScale MySQL), tRPC v11 + Zod, Next.js App Router (RSC + `"use client"`), TanStack Query (`useInfiniteQuery`), nuqs v2, Tailwind, Vitest + Testing Library.

---

## Decisions taken (open items resolved with defaults)

These were flagged "to confirm during implementation" in the design doc. Defaults chosen below; change them here before implementing if you disagree:

1. **Deferred GH issues (⑤⑧⑨⑩):** Not part of this code plan. File **one umbrella tracking issue** after merge (see Task 18). No code impact.
2. **Empty-state scene:** Reuse the existing **`signalsScene`** isometric figure as a stand-in (a bespoke `decisionsScene` is explicitly out of scope). Used by Task 13.
3. **Caller filter (3rd facet):** **Deferred.** Ship only the two facets in the mockup — Status + Provider. Adding `calledByKind` would touch all four layers; not "cheap" enough for this pass.

## File structure

**Modify (4):**
- `packages/ui/src/components/integration-icons.tsx` — add `x` mark to `IntegrationLogoIcons`.
- `db/app/src/utils/provider-routine-calls.ts` — extend `listProviderRoutineCalls` with keyset pagination + filters + search; new return shape.
- `api/app/src/router/(pending-not-allowed)/decisions.ts` — new input schema + `{ items, nextCursor }` passthrough.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page.tsx` — `prefetch(infiniteQueryOptions)` + `Suspense`.

**Replace (1):**
- `apps/app/.../decisions/_components/decisions-client.tsx` — gut the card-list/panel; becomes the nuqs orchestrator.

**Create (10) under `apps/app/.../decisions/_components/`:**
- `decisions-model.ts`, `decisions-search-params.ts`, `use-decisions-list-query.ts`, `decision-provider-icon.tsx`, `decisions-detail.tsx`, `decision-row.tsx`, `decisions-table-view.tsx`, `decisions-toolbar.tsx`, `decisions-empty-state.tsx`, `decisions-loading.tsx`.

**Tests modified/created (5):**
- `db/app/src/__tests__/provider-routine-calls.test.ts` (modify), `api/app/src/__tests__/decisions-router.test.ts` (modify), `apps/app/.../decisions-page.test.tsx` (modify), `apps/app/.../decisions-client.test.tsx` (replace), `apps/app/.../decisions-model.test.ts` (create).

**Dependency order:** Task 1 (DB) → Task 2 (API) unblock the tRPC output type that the UI's `DecisionsList` type derives from. Task 3 (icon) unblocks Task 7. Tasks 4–13 build leaf-up. Task 14 (client) + 15 (page) wire it together. Tasks 16–17 are the consolidated UI tests (mirroring People, which unit-tests the model + one client test + one page test rather than every component). Task 18 is post-merge follow-up.

---

### Task 1: Extend `listProviderRoutineCalls` with keyset pagination, filters, search

Copies People's keyset pattern (`db/app/src/utils/people.ts:34-95`) onto provider routine calls. Search LIKEs over `routineId`, `providerToolName`, `calledById`. Return shape changes from `ProviderRoutineCall[]` to `{ items, nextCursor }`.

**Files:**
- Modify: `db/app/src/utils/provider-routine-calls.ts:1-55`
- Test: `db/app/src/__tests__/provider-routine-calls.test.ts`

- [ ] **Step 1: Rewrite the DB list tests (failing first)**

Replace the existing single `"lists recent provider routine calls for one org"` test (the `it(...)` block at lines 69-117) with the block below. Keep all other tests (create/mark*) untouched. Add the two imports shown at the top.

At the top of the file, add after the existing imports (line 9):

```ts
import { MySqlDialect } from "drizzle-orm/mysql-core";
```

Add this row factory near the top (after `const finishedAt = ...`, line 12):

```ts
function makeCall(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "provider_routine_call_1",
    clerkOrgId: "org_123",
    calledByKind: "automation",
    calledById: "run_1",
    calledByUserId: null,
    provider: "linear",
    routineId: "linear__create_issue",
    providerToolName: "create_issue",
    providerConnectionId: 42,
    providerWorkspaceId: "workspace_1",
    providerActorId: "actor_1",
    providerAttempted: true,
    sourceClientId: null,
    sourceRef: "run_1",
    sourceSurface: "automation",
    status: "succeeded",
    inputRedacted: { present: true },
    outputRedacted: { present: true },
    errorCode: null,
    errorMessage: null,
    startedAt,
    finishedAt,
    createdAt: finishedAt,
    updatedAt: finishedAt,
    ...overrides,
  };
}
```

Replace the old list `it(...)` block with this `describe`:

```ts
describe("listProviderRoutineCalls", () => {
  it("returns rows with keyset cursor pagination", async () => {
    const rows = [
      makeCall({ id: 3, publicId: "provider_routine_call_3" }),
      makeCall({ id: 2, publicId: "provider_routine_call_2" }),
      makeCall({ id: 1, publicId: "provider_routine_call_1" }),
    ];
    const { query, spies } = listRows(rows);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await expect(
      listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 2 })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[1]!.createdAt, id: rows[1]!.id },
    });

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything()
    );
    expect(spies.limit).toHaveBeenCalledWith(3);
  });

  it("returns a null cursor on the last page", async () => {
    const rows = [makeCall({ id: 1 })];
    const { query, spies } = listRows(rows);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await expect(
      listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 2 })
    ).resolves.toEqual({ items: rows, nextCursor: null });
    expect(spies.limit).toHaveBeenCalledWith(3);
  });

  it("bounds limits to 100 rows", async () => {
    const { query, spies } = listRows([]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await listProviderRoutineCalls(db, { clerkOrgId: "org_123", limit: 500 });
    expect(spies.limit).toHaveBeenCalledWith(101);
  });

  it("escapes MySQL LIKE wildcards in search input", async () => {
    const { query, spies } = listRows([]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await listProviderRoutineCalls(db, {
      clerkOrgId: "org_123",
      search: String.raw`50%_done\soon`,
    });

    const condition = spies.where.mock.calls[0]?.[0];
    const compiled = new MySqlDialect().sqlToQuery(condition);
    expect(compiled.sql).toContain("like ? escape '\\\\'");
    expect(compiled.params).toContain(String.raw`%50\%\_done\\soon%`);
  });

  it("passes provider and status filters without throwing", async () => {
    const row = makeCall();
    const { query, spies } = listRows([row]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await expect(
      listProviderRoutineCalls(db, {
        clerkOrgId: "org_123",
        providers: ["linear", "x"],
        statuses: ["failed"],
        limit: 10,
      })
    ).resolves.toEqual({ items: [row], nextCursor: null });

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(11);
  });

  it("ignores empty filter arrays", async () => {
    const { query, spies } = listRows([]);
    const db = { select: vi.fn(() => query) } as unknown as Database;

    await listProviderRoutineCalls(db, {
      clerkOrgId: "org_123",
      providers: [],
      statuses: [],
      limit: 10,
    });
    expect(spies.where).toHaveBeenCalledOnce();
  });
});
```

> Note: the existing `listRows` helper (lines 24-43) already records the `.where()` condition via `spies.where` and resolves `rows.slice(0, limit)` from `.limit()`, so no helper change is needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @db/app test src/__tests__/provider-routine-calls.test.ts`
Expected: FAIL — `listProviderRoutineCalls` still returns an array, so `.toEqual({ items, nextCursor })` mismatches and `spies.limit` is called with `2`/`500`, not `3`/`101`.

- [ ] **Step 3: Rewrite `listProviderRoutineCalls`**

In `db/app/src/utils/provider-routine-calls.ts`, change the drizzle import on line 1 from:

```ts
import { and, desc, eq } from "drizzle-orm";
```

to:

```ts
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
```

Add `ProviderRoutineCallStatus` to the schema import (the `import { ... } from "../schema";` block, lines 3-11) so it reads:

```ts
import {
  createProviderRoutineCallId,
  type ProviderRoutineCall,
  type ProviderRoutineCallCalledByKind,
  type ProviderRoutineCallProvider,
  type ProviderRoutineCallRedactedPayload,
  type ProviderRoutineCallSourceSurface,
  type ProviderRoutineCallStatus,
  providerRoutineCalls,
} from "../schema";
```

Add these two helpers immediately after `normalizeLimit` (after line 38):

```ts
function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export interface ProviderRoutineCallCursor {
  createdAt: Date;
  id: number;
}

export interface ListProviderRoutineCallsResult {
  items: ProviderRoutineCall[];
  nextCursor: ProviderRoutineCallCursor | null;
}

export interface ListProviderRoutineCallsInput {
  clerkOrgId: string;
  cursor?: ProviderRoutineCallCursor | null;
  limit?: number;
  providers?: ProviderRoutineCallProvider[];
  search?: string;
  statuses?: ProviderRoutineCallStatus[];
}
```

Replace the entire `listProviderRoutineCalls` function (lines 40-55) with:

```ts
export async function listProviderRoutineCalls(
  db: Database,
  input: ListProviderRoutineCallsInput
): Promise<ListProviderRoutineCallsResult> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const searchPattern = search ? `%${escapeLikePattern(search)}%` : undefined;
  const conditions = [
    eq(providerRoutineCalls.clerkOrgId, input.clerkOrgId),
    searchPattern
      ? or(
          sql`${providerRoutineCalls.routineId} like ${searchPattern} escape '\\\\'`,
          sql`${providerRoutineCalls.providerToolName} like ${searchPattern} escape '\\\\'`,
          sql`${providerRoutineCalls.calledById} like ${searchPattern} escape '\\\\'`
        )
      : undefined,
    input.providers?.length
      ? inArray(providerRoutineCalls.provider, input.providers)
      : undefined,
    input.statuses?.length
      ? inArray(providerRoutineCalls.status, input.statuses)
      : undefined,
    input.cursor
      ? or(
          lt(providerRoutineCalls.createdAt, input.cursor.createdAt),
          and(
            eq(providerRoutineCalls.createdAt, input.cursor.createdAt),
            lt(providerRoutineCalls.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(isDefined);

  const rows = await db
    .select()
    .from(providerRoutineCalls)
    .where(and(...conditions))
    .orderBy(
      desc(providerRoutineCalls.createdAt),
      desc(providerRoutineCalls.id)
    )
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @db/app test src/__tests__/provider-routine-calls.test.ts`
Expected: PASS (all `listProviderRoutineCalls` cases + the untouched create/mark tests).

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @db/app typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/provider-routine-calls.ts db/app/src/__tests__/provider-routine-calls.test.ts
git commit -m "feat(db): add keyset pagination, filters, search to provider routine calls list"
```

---

### Task 2: Rework the `decisions.list` tRPC input/output

New input: cursor + limit + search (shared schemas) + provider/status enum-array filters. Output is the DB's `{ items, nextCursor }` passthrough. Enums are tied to the DB unions via `satisfies` so they can't drift.

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/decisions.ts` (whole file)
- Test: `api/app/src/__tests__/decisions-router.test.ts` (whole file)

- [ ] **Step 1: Rewrite the router test (failing first)**

Replace the whole contents of `api/app/src/__tests__/decisions-router.test.ts` with:

```ts
import type { Database, ProviderRoutineCall } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listProviderRoutineCallsMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listProviderRoutineCalls: listProviderRoutineCallsMock,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { decisionsRouter } = await import(
  "../router/(pending-not-allowed)/decisions"
);

const testRouter = createTRPCRouter({ decisions: decisionsRouter });
const createCaller = createCallerFactory(testRouter);

const activeIdentity = {
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  orgId: "org_acme",
  type: "active",
  userId: "user_current",
} satisfies AuthIdentity;

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

const decision = {
  id: 1,
  publicId: "provider_routine_call_123",
  clerkOrgId: "org_acme",
  calledByKind: "automation",
  calledById: "run_123",
  calledByUserId: null,
  provider: "linear",
  routineId: "linear__create_issue",
  providerToolName: "create_issue",
  providerConnectionId: 42,
  providerWorkspaceId: "workspace_123",
  providerActorId: "actor_123",
  providerAttempted: true,
  sourceClientId: null,
  sourceRef: "run_123",
  sourceSurface: "automation",
  status: "succeeded",
  inputRedacted: { present: true },
  outputRedacted: { present: true },
  errorCode: null,
  errorMessage: null,
  startedAt: new Date("2026-06-02T03:20:11.419Z"),
  finishedAt: new Date("2026-06-02T03:20:11.966Z"),
  createdAt: new Date("2026-06-02T03:20:11.419Z"),
  updatedAt: new Date("2026-06-02T03:20:11.966Z"),
} satisfies ProviderRoutineCall;

const page = { items: [decision], nextCursor: null };

describe("decisionsRouter", () => {
  beforeEach(() => {
    listProviderRoutineCallsMock.mockReset();
    listProviderRoutineCallsMock.mockResolvedValue(page);
  });

  it("forwards cursor, limit, and search and returns the page unchanged", async () => {
    await expect(
      caller().decisions.list({
        cursor: { createdAt: new Date("2026-06-02T03:20:11.419Z"), id: 1 },
        limit: 25,
        search: "create_issue",
      })
    ).resolves.toEqual(page);

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: { createdAt: new Date("2026-06-02T03:20:11.419Z"), id: 1 },
        limit: 25,
        providers: undefined,
        search: "create_issue",
        statuses: undefined,
      }
    );
  });

  it("forwards provider and status filters", async () => {
    await caller().decisions.list({
      providers: ["linear"],
      statuses: ["failed", "succeeded"],
    });

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: undefined,
        limit: undefined,
        providers: ["linear"],
        search: undefined,
        statuses: ["failed", "succeeded"],
      }
    );
  });

  it("coerces empty filter arrays and blank search to undefined", async () => {
    await caller().decisions.list({
      providers: [],
      statuses: [],
      search: "   ",
    });

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: undefined,
        limit: undefined,
        providers: undefined,
        search: undefined,
        statuses: undefined,
      }
    );
  });

  it("rejects unknown provider values", async () => {
    await expect(
      caller().decisions.list({
        providers: ["github" as unknown as "linear"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects unknown status values", async () => {
    await expect(
      caller().decisions.list({
        statuses: ["pending" as unknown as "failed"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects non-date cursor values before querying", async () => {
    await expect(
      caller().decisions.list({
        cursor: { createdAt: 123 as unknown as Date, id: 1 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects pending users", async () => {
    await expect(
      caller({ type: "pending", userId: "user_current" }).decisions.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @api/app test src/__tests__/decisions-router.test.ts`
Expected: FAIL — current router rejects `cursor`/`providers`/`statuses`/`search` (`.strict()` flat-limit schema) and returns an array, not `{ items, nextCursor }`.

- [ ] **Step 3: Rewrite the router**

Replace the whole contents of `api/app/src/router/(pending-not-allowed)/decisions.ts` with:

```ts
import { listProviderRoutineCalls, type ProviderRoutineCall } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

// Tie the filter enums to the DB unions so a schema change there is a compile
// error here, not a silent runtime drift.
const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const listDecisionsInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  providers: z
    .array(z.enum(DECISION_PROVIDERS))
    .max(DECISION_PROVIDERS.length)
    .optional(),
  search: workspaceListSearchInput,
  statuses: z
    .array(z.enum(DECISION_STATUSES))
    .max(DECISION_STATUSES.length)
    .optional(),
});

export const decisionsRouter = {
  list: boundOrgProcedure.input(listDecisionsInput).query(({ ctx, input }) =>
    listProviderRoutineCalls(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      providers: input.providers?.length ? input.providers : undefined,
      search: input.search,
      statuses: input.statuses?.length ? input.statuses : undefined,
    })
  ),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @api/app test src/__tests__/decisions-router.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @api/app typecheck`
Expected: no errors. (This proves the `satisfies` enum tie compiles and the output type is `{ items, nextCursor }`.)

- [ ] **Step 6: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/decisions.ts" api/app/src/__tests__/decisions-router.test.ts
git commit -m "feat(api): cursor/filter/search input + paginated output for decisions.list"
```

---

### Task 3: Add the `x` brand mark to `IntegrationLogoIcons`

`linear` already exists; `x` is missing. Add it so both decision providers resolve from one shared registry.

**Files:**
- Modify: `packages/ui/src/components/integration-icons.tsx:418-423`

- [ ] **Step 1: Add the `x` entry**

In `packages/ui/src/components/integration-icons.tsx`, find the `workos` entry at the end of the `IntegrationLogoIcons` object (lines 418-422) followed by `};` (line 423). Insert the `x` entry between them so it reads:

```tsx
  workos: (props: IconProps) => (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24" {...props}>
      <path d="M1.2 5.4 6 18l3-8.4L12 18l3-8.4L18 18l4.8-12.6h-3L17.4 12l-3-6.6h-2.4L9.6 12l-3-6.6H1.2z" />
    </svg>
  ),
  x: (props: IconProps) => (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
};
```

- [ ] **Step 2: Typecheck the package**

Run: `pnpm --filter @repo/ui typecheck`
Expected: no errors (`IntegrationLogoIcons.x` is now a valid key).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/integration-icons.tsx
git commit -m "feat(ui): add X brand mark to IntegrationLogoIcons"
```

---

### Task 4: Decisions model (types, status meta, caller/source formatters, day grouping)

RSC-safe (no JSX, no lucide icon *components* — only label/tone/rail strings, so `page.tsx` can import `DECISIONS_PAGE_SIZE` without pulling icons into the server bundle). Mirrors `people-model.ts`.

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-model.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-model.test.ts`

- [ ] **Step 1: Write the model unit test (failing first)**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatCaller,
  getSourceLabel,
  getDecisionStatusMeta,
  groupDecisionsByDay,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-model";

const DAY = 86_400_000;

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "provider_routine_call_1",
    clerkOrgId: "org_1",
    calledByKind: "automation",
    calledById: "run_1",
    calledByUserId: null,
    provider: "linear",
    routineId: "linear__create_issue",
    providerToolName: "create_issue",
    providerConnectionId: 1,
    providerWorkspaceId: null,
    providerActorId: null,
    providerAttempted: true,
    sourceClientId: null,
    sourceRef: null,
    sourceSurface: "automation",
    status: "succeeded",
    inputRedacted: null,
    outputRedacted: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date("2026-06-03T10:00:00.000Z"),
    finishedAt: new Date("2026-06-03T10:00:01.000Z"),
    createdAt: new Date("2026-06-03T10:00:00.000Z"),
    updatedAt: new Date("2026-06-03T10:00:01.000Z"),
    ...overrides,
  } as Parameters<typeof formatCaller>[0];
}

describe("formatCaller", () => {
  it("labels automation, user, and system callers", () => {
    expect(formatCaller(makeRow({ calledByKind: "automation" }))).toBe(
      "Automation run_1"
    );
    expect(
      formatCaller(
        makeRow({ calledByKind: "user", calledByUserId: "user_42" })
      )
    ).toBe("User user_42");
    expect(formatCaller(makeRow({ calledByKind: "system" }))).toBe(
      "System run_1"
    );
  });
});

describe("getSourceLabel", () => {
  it("maps every source surface to a human label", () => {
    expect(getSourceLabel("automation")).toBe("Automation");
    expect(getSourceLabel("hosted_mcp")).toBe("Hosted MCP");
    expect(getSourceLabel("native_cli")).toBe("Native CLI");
    expect(getSourceLabel("system")).toBe("System");
  });
});

describe("getDecisionStatusMeta", () => {
  it("provides a glyph tone and left-rail color per status", () => {
    expect(getDecisionStatusMeta("failed").rail).toContain("destructive");
    expect(getDecisionStatusMeta("succeeded").tone).toContain("emerald");
    expect(getDecisionStatusMeta("running").tone).toContain("animate-spin");
  });
});

describe("groupDecisionsByDay", () => {
  it("groups by UTC calendar day with Today/Yesterday labels and failure counts", () => {
    const now = new Date("2026-06-03T12:00:00.000Z");
    const rows = [
      makeRow({ id: 3, startedAt: new Date(now.getTime() - 1 * 1000) }),
      makeRow({
        id: 2,
        status: "failed",
        startedAt: new Date(now.getTime() - DAY),
      }),
      makeRow({ id: 1, startedAt: new Date(now.getTime() - 5 * DAY) }),
    ];

    const groups = groupDecisionsByDay(rows, now);

    expect(groups).toHaveLength(3);
    expect(groups[0]!.label).toBe("Today");
    expect(groups[0]!.rows).toHaveLength(1);
    expect(groups[0]!.failureCount).toBe(0);
    expect(groups[1]!.label).toBe("Yesterday");
    expect(groups[1]!.failureCount).toBe(1);
    expect(groups[2]!.label).toMatch(/\d/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-model.test.ts"`
Expected: FAIL — module `decisions-model` does not exist yet.

- [ ] **Step 3: Create the model**

Create `apps/app/.../decisions/_components/decisions-model.ts`:

```ts
import type { AppRouterOutputs } from "@api/app";
import { formatUtcCalendarDate } from "@vendor/lib/time";

export type DecisionsList =
  AppRouterOutputs["org"]["workspace"]["decisions"]["list"];
export type DecisionRow = DecisionsList["items"][number];
export type DecisionProvider = DecisionRow["provider"];
export type DecisionStatus = DecisionRow["status"];
export type DecisionSourceSurface = DecisionRow["sourceSurface"];

export const DECISIONS_PAGE_SIZE = 50;

export const decisionProviderOptions: {
  label: string;
  value: DecisionProvider;
}[] = [
  { label: "Linear", value: "linear" },
  { label: "X", value: "x" },
];

export const decisionStatusOptions: {
  label: string;
  value: DecisionStatus;
}[] = [
  { label: "Succeeded", value: "succeeded" },
  { label: "Running", value: "running" },
  { label: "Failed", value: "failed" },
];

export interface DecisionFilters {
  providers: DecisionProvider[];
  statuses: DecisionStatus[];
}

export interface DecisionStatusMeta {
  label: string;
  tone: string; // glyph color classes
  rail: string; // left-rail border color
}

const STATUS_META: Record<DecisionStatus, DecisionStatusMeta> = {
  failed: {
    label: "Failed",
    tone: "text-destructive",
    rail: "border-l-destructive",
  },
  running: {
    label: "Running",
    tone: "animate-spin text-amber-500",
    rail: "border-l-amber-500",
  },
  succeeded: {
    label: "Succeeded",
    tone: "text-emerald-500",
    rail: "border-l-emerald-500",
  },
};

export function getDecisionStatusMeta(status: DecisionStatus): DecisionStatusMeta {
  return STATUS_META[status];
}

export function getDecisionProviderLabel(provider: DecisionProvider) {
  return (
    decisionProviderOptions.find((option) => option.value === provider)
      ?.label ?? provider
  );
}

export function getDecisionStatusLabel(status: DecisionStatus) {
  return (
    decisionStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

export function formatCaller(decision: DecisionRow): string {
  if (decision.calledByKind === "automation") {
    return `Automation ${decision.calledById}`;
  }
  if (decision.calledByKind === "user") {
    return `User ${decision.calledByUserId ?? decision.calledById}`;
  }
  return `System ${decision.calledById}`;
}

const SOURCE_LABELS: Record<DecisionSourceSurface, string> = {
  automation: "Automation",
  hosted_mcp: "Hosted MCP",
  native_cli: "Native CLI",
  system: "System",
};

export function getSourceLabel(surface: DecisionSourceSurface): string {
  return SOURCE_LABELS[surface] ?? surface;
}

export function flattenDecisionPages(
  data: { pages: DecisionsList[] } | undefined
): DecisionRow[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export interface DecisionDayGroup {
  key: string;
  label: string;
  failureCount: number;
  rows: DecisionRow[];
}

function utcDayStart(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate()
  );
}

/**
 * Groups loaded (already createdAt-desc) rows by the UTC calendar day of
 * `startedAt` — the value shown in the Started column. `now` is injectable for
 * deterministic tests. Group order follows first appearance, which is newest
 * day first because the input is descending.
 */
export function groupDecisionsByDay(
  rows: DecisionRow[],
  now: Date = new Date()
): DecisionDayGroup[] {
  const todayKey = utcDayStart(now);
  const yesterdayKey = todayKey - 86_400_000;
  const groups: DecisionDayGroup[] = [];
  const byKey = new Map<number, DecisionDayGroup>();

  for (const row of rows) {
    const dayKey = utcDayStart(row.startedAt);
    let group = byKey.get(dayKey);
    if (!group) {
      const label =
        dayKey === todayKey
          ? "Today"
          : dayKey === yesterdayKey
            ? "Yesterday"
            : (formatUtcCalendarDate(dayKey) ?? "Unknown");
      group = { key: String(dayKey), label, failureCount: 0, rows: [] };
      byKey.set(dayKey, group);
      groups.push(group);
    }
    group.rows.push(row);
    if (row.status === "failed") {
      group.failureCount += 1;
    }
  }

  return groups;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-model.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-model.ts" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-model.test.ts"
git commit -m "feat(app): add decisions model (status meta, caller/source formatters, day grouping)"
```

---

### Task 5: Decisions URL-state parsers

Mirror `people-search-params.ts`: comma-joined enum lists for `provider`/`status`, plain string for `q`, nullable string for `decision` (the expanded row id).

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-search-params.ts`

- [ ] **Step 1: Create the parsers**

```ts
import { parseAsString } from "nuqs";
import {
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
} from "./decisions-model";

export const decisionProviderParser = parseAsString.withDefault("");
export const decisionStatusParser = parseAsString.withDefault("");
export const decisionQueryParser = parseAsString.withDefault("");
// "decision" holds the expanded row publicId (null when collapsed).
export const decisionParser = parseAsString;

function parseValues<T extends string>(
  value: string,
  allowedValues: readonly T[]
): T[] {
  const allowed = new Set(allowedValues);
  const seen = new Set<T>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => allowed.has(item as T))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

export function parseDecisionProviders(value: string): DecisionProvider[] {
  return parseValues(
    value,
    decisionProviderOptions.map((option) => option.value)
  );
}

export function parseDecisionStatuses(value: string): DecisionStatus[] {
  return parseValues(
    value,
    decisionStatusOptions.map((option) => option.value)
  );
}

export function serializeDecisionValues(values: readonly string[]) {
  return values.length > 0 ? values.join(",") : "";
}

export function toggleDecisionValue<T extends string>(
  values: readonly T[],
  value: T
): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-search-params.ts"
git commit -m "feat(app): add decisions URL-state parsers"
```

---

### Task 6: `useInfiniteQuery` wrapper

Mirror `use-people-list-query.ts` exactly; empty filter arrays become `undefined` before the query key is built.

**Files:**
- Create: `apps/app/.../decisions/_components/use-decisions-list-query.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  DECISIONS_PAGE_SIZE,
  type DecisionFilters,
} from "./decisions-model";

export function useDecisionsListQuery({
  filters,
  search,
}: {
  filters: DecisionFilters;
  search: string;
}) {
  const trpc = useTRPC();
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: DECISIONS_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    statuses: filters.statuses.length ? filters.statuses : undefined,
  };

  const options = trpc.org.workspace.decisions.list.infiniteQueryOptions(input, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
  });

  return {
    query: useInfiniteQuery(options),
    queryKey: options.queryKey,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors (proves `decisions.list.infiniteQueryOptions` accepts the input and `nextCursor` is the page-param type).

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/use-decisions-list-query.ts"
git commit -m "feat(app): add decisions infinite-query hook"
```

---

### Task 7: Provider brand glyph

Maps `provider` → the shared `IntegrationLogoIcons` mark (depends on Task 3's `x`).

**Files:**
- Create: `apps/app/.../decisions/_components/decision-provider-icon.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { ComponentType } from "react";
import type { DecisionProvider } from "./decisions-model";

const PROVIDER_ICONS: Record<
  DecisionProvider,
  ComponentType<{ className?: string }>
> = {
  linear: IntegrationLogoIcons.linear,
  x: IntegrationLogoIcons.x,
};

export function DecisionProviderIcon({
  className,
  provider,
}: {
  className?: string;
  provider: DecisionProvider;
}) {
  const Icon = PROVIDER_ICONS[provider];
  if (!Icon) {
    return null;
  }
  return <Icon aria-hidden="true" className={className} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decision-provider-icon.tsx"
git commit -m "feat(app): add decision provider brand glyph"
```

---

### Task 8: Inline expand detail (grouped fields + JSON inspector + error box)

Surfaces data the old panel hid: full `errorMessage` and pretty-printed `inputRedacted`/`outputRedacted`. IDs and error text get copy-on-hover via `SSRCodeBlockCopyButton`; payloads use the `CodeBlock` JSON inspector.

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-detail.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@repo/ui/components/ai-elements/code-block";
import { SSRCodeBlockCopyButton } from "@repo/ui/components/ssr-code-block";
import { cn } from "@repo/ui/lib/utils";
import { formatDuration } from "@vendor/lib/time";
import type { ReactNode } from "react";
import {
  type DecisionRow,
  formatCaller,
  getSourceLabel,
} from "./decisions-model";

export function DecisionsDetail({ decision }: { decision: DecisionRow }) {
  const durationLabel = decision.finishedAt
    ? formatDuration(
        decision.finishedAt.getTime() - decision.startedAt.getTime()
      )
    : "—";
  const finishedLabel = decision.finishedAt
    ? decision.finishedAt.toISOString()
    : "Running";

  return (
    <div className="border-border/40 border-t bg-muted/10 px-4 py-4">
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <DetailField
          copyValue={decision.publicId}
          label="Decision ID"
          mono
          value={decision.publicId}
        />
        <DetailField
          copyValue={decision.routineId}
          label="Routine"
          mono
          value={decision.routineId}
        />
        <DetailField
          copyValue={decision.providerToolName}
          label="Provider tool"
          mono
          value={decision.providerToolName}
        />
        <DetailField label="Caller" value={formatCaller(decision)} />
        <DetailField
          label="Source"
          value={getSourceLabel(decision.sourceSurface)}
        />
        <DetailField
          copyValue={String(decision.providerConnectionId)}
          label="Provider connection"
          mono
          value={String(decision.providerConnectionId)}
        />
        {decision.providerWorkspaceId ? (
          <DetailField
            copyValue={decision.providerWorkspaceId}
            label="Provider workspace"
            mono
            value={decision.providerWorkspaceId}
          />
        ) : null}
        {decision.providerActorId ? (
          <DetailField
            copyValue={decision.providerActorId}
            label="Provider actor"
            mono
            value={decision.providerActorId}
          />
        ) : null}
        <DetailField
          copyValue={decision.startedAt.toISOString()}
          label="Started"
          mono
          value={decision.startedAt.toISOString()}
        />
        <DetailField
          copyValue={decision.finishedAt?.toISOString()}
          label="Finished"
          mono={Boolean(decision.finishedAt)}
          value={finishedLabel}
        />
        <DetailField label="Duration" value={durationLabel} />
      </dl>

      {decision.errorCode || decision.errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-destructive text-xs">
              {decision.errorCode ?? "Error"}
            </p>
            {decision.errorMessage ? (
              <SSRCodeBlockCopyButton
                className="text-muted-foreground"
                code={decision.errorMessage}
              />
            ) : null}
          </div>
          {decision.errorMessage ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-destructive/90 text-xs">
              {decision.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {decision.inputRedacted ? (
        <PayloadBlock payload={decision.inputRedacted} title="Input" />
      ) : null}
      {decision.outputRedacted ? (
        <PayloadBlock payload={decision.outputRedacted} title="Output" />
      ) : null}
    </div>
  );
}

function DetailField({
  copyValue,
  label,
  mono,
  value,
}: {
  copyValue?: string;
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="group/field flex flex-col gap-1 border-border/40 border-t py-2.5 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex items-start gap-1.5 text-foreground text-sm">
        <span className={cn("min-w-0 break-all", mono && "font-mono text-xs")}>
          {value}
        </span>
        {copyValue ? (
          <SSRCodeBlockCopyButton
            className="shrink-0 opacity-0 transition-opacity group-hover/field:opacity-100"
            code={copyValue}
          />
        ) : null}
      </dd>
    </div>
  );
}

function PayloadBlock({
  payload,
  title,
}: {
  payload: Record<string, unknown>;
  title: string;
}) {
  const code = JSON.stringify(payload, null, 2);
  return (
    <div className="mt-4">
      <CodeBlock code={code} language="json">
        <CodeBlockHeader>
          <CodeBlockTitle>{title}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors. (`inputRedacted`/`outputRedacted` narrow to `Record<string, unknown>` after the truthy guard.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-detail.tsx"
git commit -m "feat(app): add decisions inline-expand detail with JSON inspector and error box"
```

---

### Task 9: Single row + accordion expand

7-column grid row with a 2px status left-rail. The status glyph component lives here (client) — not in the RSC-safe model.

**Files:**
- Create: `apps/app/.../decisions/_components/decision-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import { formatDuration, formatRelativeTimeToNow } from "@vendor/lib/time";
import { CheckCircle2, ChevronDown, CircleX, Loader2 } from "lucide-react";
import type { ComponentType } from "react";
import { DecisionProviderIcon } from "./decision-provider-icon";
import { DecisionsDetail } from "./decisions-detail";
import {
  type DecisionRow as DecisionRowType,
  type DecisionStatus,
  formatCaller,
  getDecisionProviderLabel,
  getDecisionStatusMeta,
  getSourceLabel,
} from "./decisions-model";

export const ROW_GRID =
  "grid grid-cols-[7.5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_8rem_7rem_5.5rem_2rem] items-center gap-3";

const STATUS_ICONS: Record<
  DecisionStatus,
  ComponentType<{ className?: string }>
> = {
  failed: CircleX,
  running: Loader2,
  succeeded: CheckCircle2,
};

export function DecisionRow({
  decision,
  isExpanded,
  onToggle,
}: {
  decision: DecisionRowType;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = getDecisionStatusMeta(decision.status);
  const StatusIcon = STATUS_ICONS[decision.status];
  const durationLabel = decision.finishedAt
    ? formatDuration(
        decision.finishedAt.getTime() - decision.startedAt.getTime()
      )
    : "—";

  return (
    <div
      className={cn(
        "border-border/40 border-b border-l-2",
        status.rail,
        isExpanded && "bg-muted/20"
      )}
    >
      <button
        aria-expanded={isExpanded}
        className={cn(ROW_GRID, "min-h-11 w-full px-4 text-left hover:bg-muted/30")}
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <StatusIcon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0", status.tone)}
          />
          <span className="truncate text-muted-foreground text-xs">
            {status.label}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <DecisionProviderIcon
            className="size-3.5 shrink-0 text-foreground"
            provider={decision.provider}
          />
          <span className="min-w-0 truncate font-mono text-foreground text-sm">
            {getDecisionProviderLabel(decision.provider)} /{" "}
            {decision.providerToolName}
          </span>
        </span>

        <span className="min-w-0 truncate text-muted-foreground text-sm">
          {formatCaller(decision)}
        </span>

        <span className="min-w-0 truncate">
          <span className="inline-flex h-5 items-center rounded-md border border-border/70 bg-muted/25 px-1.5 text-muted-foreground text-xs">
            {getSourceLabel(decision.sourceSurface)}
          </span>
        </span>

        <span
          className="truncate text-muted-foreground text-xs"
          title={decision.startedAt.toISOString()}
        >
          {formatRelativeTimeToNow(decision.startedAt, { addSuffix: true })}
        </span>

        <span className="truncate text-muted-foreground text-xs">
          {durationLabel}
        </span>

        <span className="flex justify-end">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </span>
      </button>

      {isExpanded ? <DecisionsDetail decision={decision} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decision-row.tsx"
git commit -m "feat(app): add decision row with status rail and accordion expand"
```

---

### Task 10: Day-grouped table view

Sticky day headers (count + failure count), the shared column header, status-rail rows, "Load more", footer count, plus error / empty / no-results states. Mirrors `people-table-view.tsx`.

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-table-view.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import { DecisionRow, ROW_GRID } from "./decision-row";
import { DecisionsEmptyState } from "./decisions-empty-state";
import {
  type DecisionRow as DecisionRowType,
  groupDecisionsByDay,
} from "./decisions-model";

export function DecisionsTableView({
  expandedId,
  fetchNextPage,
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  isPlaceholderData,
  onToggleDecision,
  refetch,
  rows,
}: {
  expandedId: string | null;
  fetchNextPage: () => void;
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isPlaceholderData: boolean;
  onToggleDecision: (publicId: string) => void;
  refetch: () => void;
  rows: DecisionRowType[];
}) {
  if (isError && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load decisions for this workspace.
        </p>
        <Button
          aria-label="Retry loading decisions"
          onClick={refetch}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <DecisionsEmptyState
        description="Actions Lightfast takes against Linear and X on this team's behalf will appear here."
        title="No decisions yet"
      />
    );
  }

  if (rows.length === 0 && hasActiveFilters) {
    return (
      <DecisionsEmptyState
        description="Try a different status or provider filter."
        title="No matching decisions"
      />
    );
  }

  const groups = groupDecisionsByDay(rows);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isPlaceholderData && "opacity-60 transition-opacity"
        )}
      >
        <div
          className={cn(
            ROW_GRID,
            "h-9 border-border/70 border-b border-l-2 border-l-transparent bg-muted/25 px-4 text-muted-foreground text-xs"
          )}
        >
          <span>Status</span>
          <span>Action</span>
          <span>Caller</span>
          <span>Source</span>
          <span>Started</span>
          <span>Duration</span>
          <span className="sr-only">Expand</span>
        </div>

        {groups.map((group) => (
          <section key={group.key}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-border/40 border-b bg-background/95 px-4 py-1.5 text-muted-foreground text-xs backdrop-blur">
              <span className="font-medium text-foreground">{group.label}</span>
              <span>
                · {group.rows.length}{" "}
                {group.rows.length === 1 ? "action" : "actions"}
              </span>
              {group.failureCount > 0 ? (
                <span className="text-destructive">
                  · {group.failureCount} failed
                </span>
              ) : null}
            </div>

            {group.rows.map((decision) => (
              <DecisionRow
                decision={decision}
                isExpanded={expandedId === decision.publicId}
                key={decision.publicId}
                onToggle={() => onToggleDecision(decision.publicId)}
              />
            ))}
          </section>
        ))}

        {hasNextPage ? (
          <div className="px-3 py-3">
            <Button
              aria-label="Load more decisions"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isFetchingNextPage ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
              ) : (
                <ChevronDown aria-hidden="true" className="size-3.5" />
              )}
              {isFetchingNextPage ? "Loading" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-border/70 border-t px-4 py-2.5 text-muted-foreground text-xs">
        <span>
          {rows.length} {rows.length === 1 ? "decision" : "decisions"}
        </span>
        {isFetching && !isFetchingNextPage ? (
          <span className="flex items-center gap-1 text-muted-foreground/70">
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck (will fail until Task 11 + 12 exist)**

`DecisionsTableView` imports `DecisionsEmptyState` (Task 12). Defer the typecheck/commit of this file until Task 12 lands, OR create Task 12 first. To keep commits green, **proceed to Task 11 and Task 12, then typecheck and commit Tasks 10–12 together** (see Task 12 Step 3).

---

### Task 11: Toolbar (search + Status / Provider filters + chips)

Mirror `people-toolbar.tsx` precisely, swapping the two groups to Status + Provider.

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-toolbar.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Activity, Boxes, ListFilter, Search, X } from "lucide-react";
import type { ComponentType } from "react";
import {
  type DecisionFilters,
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
  getDecisionProviderLabel,
  getDecisionStatusLabel,
} from "./decisions-model";

type FilterGroupId = "status" | "provider";
type IconComponent = ComponentType<{ className?: string }>;

interface FilterGroup {
  count: number;
  icon: IconComponent;
  id: FilterGroupId;
  label: string;
}

export function DecisionsToolbar({
  filters,
  onClearFilterGroup,
  onQueryChange,
  onToggleProvider,
  onToggleStatus,
  query,
}: {
  filters: DecisionFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onQueryChange: (value: string) => void;
  onToggleProvider: (value: DecisionProvider) => void;
  onToggleStatus: (value: DecisionStatus) => void;
  query: string;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.statuses.length,
      id: "status",
      icon: Activity,
      label: "Status",
    },
    {
      count: filters.providers.length,
      id: "provider",
      icon: Boxes,
      label: "Provider",
    },
  ];
  const activeFilterCount = filters.statuses.length + filters.providers.length;

  return (
    <div
      className="flex shrink-0 flex-wrap items-start gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="decisions-toolbar"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Filters"
              className="relative size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              size="icon-sm"
              title="Filters"
              type="button"
              variant="ghost"
            >
              <ListFilter aria-hidden="true" className="size-3" />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-background bg-muted font-medium text-[0.55rem] text-muted-foreground leading-none"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 overflow-visible"
            sideOffset={8}
          >
            {filterGroups.map((group) => (
              <DecisionsFilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onToggleProvider={onToggleProvider}
                onToggleStatus={onToggleStatus}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DecisionsFilterChip
          count={filters.statuses.length}
          icon={Activity}
          label="Status"
          onClear={() => onClearFilterGroup("status")}
          value={formatChipValue(
            filters.statuses.map((value) => getDecisionStatusLabel(value))
          )}
        />
        <DecisionsFilterChip
          count={filters.providers.length}
          icon={Boxes}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getDecisionProviderLabel(value))
          )}
        />
      </div>

      <div className="ml-auto flex w-full min-w-0 items-center justify-end gap-1.5 sm:w-auto">
        <div className="relative w-full sm:w-56">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search decisions"
            className="pl-7"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search decisions"
            role="searchbox"
            size="lf-sm"
            value={query}
            variant="lf"
          />
        </div>
      </div>
    </div>
  );
}

function DecisionsFilterSubMenu({
  filters,
  group,
  onToggleProvider,
  onToggleStatus,
}: {
  filters: DecisionFilters;
  group: FilterGroup;
  onToggleProvider: (value: DecisionProvider) => void;
  onToggleStatus: (value: DecisionStatus) => void;
}) {
  const Icon = group.icon;
  const options =
    group.id === "status"
      ? decisionStatusOptions.map((option) => ({
          checked: filters.statuses.includes(option.value),
          label: option.label,
          onToggle: () => onToggleStatus(option.value),
          value: option.value as string,
        }))
      : decisionProviderOptions.map((option) => ({
          checked: filters.providers.includes(option.value),
          label: option.label,
          onToggle: () => onToggleProvider(option.value),
          value: option.value as string,
        }));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {group.count > 0 ? (
          <span className="rounded bg-muted px-1.5 text-muted-foreground text-xs">
            {group.count}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <DropdownMenuLabel className="flex h-7 items-center gap-2 text-muted-foreground text-xs">
          <Icon aria-hidden="true" className="size-3.5" />
          <span>{group.label}</span>
          <span className="ml-auto">is any of</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            checked={option.checked}
            key={option.value}
            onCheckedChange={option.onToggle}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DecisionsFilterChip({
  count,
  icon: Icon,
  label,
  onClear,
  value,
}: {
  count: number;
  icon: IconComponent;
  label: string;
  onClear: () => void;
  value: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      className="flex h-6 max-w-full shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-muted/25 text-sm"
      onClick={onClear}
      type="button"
    >
      <span className="flex h-full shrink-0 items-center gap-2 border-border/70 border-r px-3 text-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {label}
      </span>
      <span className="hidden h-full shrink-0 items-center border-border/70 border-r px-3 text-muted-foreground sm:flex">
        is any of
      </span>
      <span className="min-w-0 truncate px-3 text-muted-foreground">
        {value}
      </span>
      <span className="flex h-full shrink-0 items-center border-border/70 border-l px-2 text-muted-foreground hover:text-foreground">
        <X aria-hidden="true" className="size-3.5" />
      </span>
    </button>
  );
}

function formatChipValue(values: string[]) {
  if (values.length === 1) {
    return values[0]!;
  }
  return `${values.length} values`;
}
```

- [ ] **Step 2: Defer typecheck/commit until Task 12**

(Same batched-commit reason as Task 10.)

---

### Task 12: Empty state (page + section variants)

Reuse `IsoFigure` + `signalsScene` (the agreed stand-in). Mirror `people-empty-state.tsx`.

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-empty-state.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { IsoFigure, signalsScene } from "@repo/ui/components/iso-figure";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { ScrollText } from "lucide-react";
import type { ReactNode } from "react";

export function DecisionsEmptyState({
  action,
  description,
  size = "page",
  title,
}: {
  action?: ReactNode;
  description: string;
  size?: "page" | "section";
  title: string;
}) {
  if (size === "page") {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-6 pb-12">
        <div className="flex items-center gap-12 sm:gap-16">
          <div className="shrink-0">
            <IsoFigure scene={signalsScene} width={200} />
          </div>
          <div className="max-w-md">
            <p className="font-medium text-foreground text-lg">{title}</p>
            <p className="mt-2.5 text-base text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {action}
              <MicrofrontendLink
                className="inline-flex h-6 items-center rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
                href="/docs/get-started/overview"
                rel="noopener noreferrer"
                target="_blank"
              >
                Documentation
              </MicrofrontendLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center">
        <div className="mb-2 flex size-8 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <ScrollText className="size-3.5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck Tasks 10–12 together**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors (table view, toolbar, and empty state now all resolve).

- [ ] **Step 3: Commit Tasks 10–12**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-table-view.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-toolbar.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-empty-state.tsx"
git commit -m "feat(app): add decisions table view, toolbar, and empty state"
```

---

### Task 13: Loading skeleton

Mirror the grid 1:1 (Suspense fallback). Hardcode the same `ROW_GRID` columns as `decision-row.tsx`, plus a day-header skeleton.

**Files:**
- Create: `apps/app/.../decisions/_components/decisions-loading.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

const GRID =
  "grid grid-cols-[7.5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_8rem_7rem_5.5rem_2rem] items-center gap-3";

/**
 * Fallback for the `DecisionsClient` Suspense boundary. Mirrors the real layout
 * 1:1 so hydration swaps in place: the toolbar (filter control + search field),
 * the column header, a sticky day header, status-rail rows, and the footer.
 */
export function DecisionsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1.5 border-border/70 border-t px-3 py-3">
        <Skeleton className="size-6 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-6 w-56 rounded-lg" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={`${GRID} h-9 border-border/70 border-b border-l-2 border-l-transparent bg-muted/25 px-4`}
          >
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <span />
          </div>

          <div className="flex items-center gap-2 border-border/40 border-b px-4 py-1.5">
            <Skeleton className="h-3 w-24" />
          </div>

          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className={`${GRID} min-h-11 border-border/40 border-b border-l-2 border-l-transparent px-4`}
              key={index}
            >
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-10" />
              <span />
            </div>
          ))}
        </div>

        <div className="flex items-center border-border/70 border-t px-4 py-2.5">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-loading.tsx"
git commit -m "feat(app): add decisions loading skeleton"
```

---

### Task 14: Rewrite `decisions-client.tsx` as the nuqs orchestrator

Replaces the entire card-list/panel implementation. Owns all URL state + the infinite query; single-open accordion via `?decision`.

**Files:**
- Replace: `apps/app/.../decisions/_components/decisions-client.tsx` (whole file)

- [ ] **Step 1: Replace the whole file**

```tsx
"use client";

import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { type DecisionFilters, flattenDecisionPages } from "./decisions-model";
import {
  decisionParser,
  decisionProviderParser,
  decisionQueryParser,
  decisionStatusParser,
  parseDecisionProviders,
  parseDecisionStatuses,
  serializeDecisionValues,
  toggleDecisionValue,
} from "./decisions-search-params";
import { DecisionsTableView } from "./decisions-table-view";
import { DecisionsToolbar } from "./decisions-toolbar";
import { useDecisionsListQuery } from "./use-decisions-list-query";

export function DecisionsClient() {
  const [query, setQuery] = useQueryState("q", decisionQueryParser);
  const deferredQuery = useDeferredValue(query);
  const search = deferredQuery.trim();
  const [providerState, setProviderState] = useQueryState(
    "provider",
    decisionProviderParser
  );
  const [statusState, setStatusState] = useQueryState(
    "status",
    decisionStatusParser
  );
  const [expandedId, setExpandedId] = useQueryState("decision", decisionParser);

  const filters = useMemo<DecisionFilters>(
    () => ({
      providers: parseDecisionProviders(providerState),
      statuses: parseDecisionStatuses(statusState),
    }),
    [providerState, statusState]
  );
  const hasActiveFilters =
    search.length > 0 ||
    filters.providers.length > 0 ||
    filters.statuses.length > 0;

  const { query: decisionsQuery } = useDecisionsListQuery({ filters, search });
  const rows = flattenDecisionPages(decisionsQuery.data);

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Decisions</h1>
      <DecisionsToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setStatusState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) =>
          void setProviderState(
            serializeDecisionValues(
              toggleDecisionValue(filters.providers, value)
            )
          )
        }
        onToggleStatus={(value) =>
          void setStatusState(
            serializeDecisionValues(toggleDecisionValue(filters.statuses, value))
          )
        }
        query={query}
      />

      <DecisionsTableView
        expandedId={expandedId}
        fetchNextPage={() => void decisionsQuery.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!decisionsQuery.hasNextPage}
        isError={decisionsQuery.isError}
        isFetching={decisionsQuery.isFetching}
        isFetchingNextPage={decisionsQuery.isFetchingNextPage}
        isPlaceholderData={decisionsQuery.isPlaceholderData}
        onToggleDecision={(publicId) =>
          void setExpandedId(expandedId === publicId ? null : publicId)
        }
        refetch={() => void decisionsQuery.refetch()}
        rows={rows}
      />
    </WorkspaceSurface>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors. (The client test is rewritten in Task 16; expect the *old* `decisions-client.test.tsx` to fail until then — that's fine, it's addressed in Task 16.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client.tsx"
git commit -m "feat(app): rework decisions client into day-grouped table orchestrator"
```

---

### Task 15: Switch the page to `prefetch(infiniteQueryOptions)` + Suspense

Mirror `people/page.tsx`.

**Files:**
- Modify: `apps/app/.../decisions/page.tsx` (whole file)

- [ ] **Step 1: Replace the whole file**

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { DecisionsClient } from "./_components/decisions-client";
import { DecisionsLoading } from "./_components/decisions-loading";
import { DECISIONS_PAGE_SIZE } from "./_components/decisions-model";

export const dynamic = "force-dynamic";

export default function DecisionsPage() {
  prefetch(
    trpc.org.workspace.decisions.list.infiniteQueryOptions(
      { limit: DECISIONS_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 60_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<DecisionsLoading />}>
        <DecisionsClient />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: no errors. (The page test is updated in Task 17; the old `decisions-page.test.tsx` will fail until then.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page.tsx"
git commit -m "feat(app): prefetch infinite decisions list with Suspense skeleton"
```

---

### Task 16: Rewrite the client component test

Replace the old card-list/panel test with one that mirrors `people-client.test.tsx`: renders rows + a day-group header, toggles `?decision`, renders the inline detail (now showing the full `errorMessage` and JSON payloads), handles empty / no-results / search.

**Files:**
- Replace: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-client.test.tsx` (whole file)

- [ ] **Step 1: Replace the whole file (failing first)**

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn();
const infiniteQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "decisions", "list", input],
}));

const queryStates: Record<string, string | null> = {
  q: "",
  provider: "",
  status: "",
  decision: null,
};
const setQuery = vi.fn((value: string | null) => {
  queryStates.q = value;
});
const setProvider = vi.fn();
const setStatus = vi.fn();
const setDecision = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        decisions: {
          list: { infiniteQueryOptions: infiniteQueryOptionsMock },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => useInfiniteQueryMock(),
}));

vi.mock("@vendor/lib/time", () => ({
  formatRelativeTimeToNow: () => "just now",
  formatDuration: () => "547ms",
  formatUtcCalendarDate: () => "2 Jun 2026",
}));

// CodeBlock pulls in Shiki (async highlight) — stub it to a <pre> so we can
// still assert the serialized JSON is rendered.
vi.mock("@repo/ui/components/ai-elements/code-block", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
  CodeBlockActions: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CodeBlockCopyButton: () => <button type="button">copy</button>,
  CodeBlockHeader: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CodeBlockTitle: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@repo/ui/components/ssr-code-block", () => ({
  SSRCodeBlockCopyButton: () => <button type="button">copy</button>,
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "parser",
  },
  useQueryState: (key: string) => {
    const setters: Record<string, (value: string | null) => void> = {
      q: setQuery,
      provider: setProvider,
      status: setStatus,
      decision: setDecision,
    };
    return [queryStates[key] ?? null, setters[key] ?? vi.fn()];
  },
}));

const baseDecision = {
  id: 1,
  publicId: "provider_routine_call_123",
  clerkOrgId: "org_acme",
  calledByKind: "automation",
  calledById: "run_123",
  calledByUserId: null,
  provider: "linear",
  routineId: "linear__create_issue",
  providerToolName: "create_issue",
  providerConnectionId: 42,
  providerWorkspaceId: "workspace_123",
  providerActorId: "actor_123",
  providerAttempted: true,
  sourceClientId: null,
  sourceRef: "run_123",
  sourceSurface: "automation",
  status: "succeeded",
  inputRedacted: { tool: "create_issue" },
  outputRedacted: null,
  errorCode: null,
  errorMessage: null,
  startedAt: new Date("2026-06-02T03:20:11.419Z"),
  finishedAt: new Date("2026-06-02T03:20:11.966Z"),
  createdAt: new Date("2026-06-02T03:20:11.419Z"),
  updatedAt: new Date("2026-06-02T03:20:11.966Z"),
};

function mockRows(items: unknown[]) {
  useInfiniteQueryMock.mockReturnValue({
    data: { pages: [{ items, nextCursor: null }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  queryStates.q = "";
  queryStates.provider = "";
  queryStates.status = "";
  queryStates.decision = null;
  setQuery.mockClear();
  setProvider.mockClear();
  setStatus.mockClear();
  setDecision.mockClear();
  infiniteQueryOptionsMock.mockClear();
  mockRows([baseDecision]);
});

const { DecisionsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client"
);

describe("DecisionsClient", () => {
  it("renders a decision row grouped under a day header", () => {
    render(<DecisionsClient />);

    expect(screen.getByText("2 Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("Linear / create_issue")).toBeInTheDocument();
    expect(screen.getByText("Automation run_123")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("Automation")).toBeInTheDocument();
  });

  it("toggles the decision URL param when a row is clicked", () => {
    render(<DecisionsClient />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(setDecision).toHaveBeenCalledWith("provider_routine_call_123");
  });

  it("renders the inline detail with the full error message and JSON payload", () => {
    queryStates.decision = "provider_routine_call_failed";
    mockRows([
      {
        ...baseDecision,
        publicId: "provider_routine_call_failed",
        status: "failed",
        inputRedacted: { tool: "create_issue" },
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "raw provider error is now shown",
      },
    ]);

    render(<DecisionsClient />);

    expect(screen.getByText("provider_routine_call_failed")).toBeInTheDocument();
    expect(screen.getByText("linear__create_issue")).toBeInTheDocument();
    expect(screen.getByText("LINEAR_MCP_FAILED")).toBeInTheDocument();
    expect(
      screen.getByText("raw provider error is now shown")
    ).toBeInTheDocument();
    // JSON inspector renders the serialized input payload.
    expect(screen.getByText(/"tool": "create_issue"/)).toBeInTheDocument();
  });

  it("renders the empty state with no rows and no filters", () => {
    mockRows([]);
    render(<DecisionsClient />);
    expect(screen.getByText("No decisions yet")).toBeInTheDocument();
  });

  it("renders the no-results state when a filter excludes everything", () => {
    queryStates.status = "failed";
    mockRows([]);
    render(<DecisionsClient />);
    expect(screen.getByText("No matching decisions")).toBeInTheDocument();
  });

  it("passes deferred search text into the decisions list query", () => {
    queryStates.q = " create_issue ";

    render(<DecisionsClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        providers: undefined,
        search: "create_issue",
        statuses: undefined,
      },
      expect.anything()
    );
  });

  it("writes search input changes to the q param", () => {
    render(<DecisionsClient />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search decisions" }),
      { target: { value: "linear" } }
    );

    expect(setQuery).toHaveBeenCalledWith("linear");
  });
});
```

> Note on the "toggles" test: `groupDecisionsByDay` defaults `now = new Date()`; the fixture's `startedAt` is in the past, so the group header is the mocked `"2 Jun 2026"` (never "Today"/"Yesterday" in CI), and the row's expand `<button aria-expanded={false}>` is the only collapsed button — `getByRole("button", { expanded: false })` selects it unambiguously.

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-client.test.tsx"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-client.test.tsx"
git commit -m "test(app): rewrite decisions client test for day-grouped table + inline expand"
```

---

### Task 17: Update the page test

Mirror `people-page.test.tsx` — mock `prefetch` + `infiniteQueryOptions`, assert prefetch + Suspense + hydrated client.

**Files:**
- Replace: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-page.test.tsx` (whole file)

- [ ] **Step 1: Replace the whole file (failing first)**

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infiniteQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "decisions", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-decisions">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        decisions: {
          list: {
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client",
  () => ({
    DecisionsClient: () => <div>Decisions client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-loading",
  () => ({
    DecisionsLoading: () => <div>Loading decisions</div>,
  })
);

const { default: DecisionsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page"
);

beforeEach(() => {
  infiniteQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("decisions page", () => {
  it("prefetches the infinite decisions list before rendering the client island", () => {
    render(DecisionsPage());

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 50 },
      expect.objectContaining({ staleTime: 60_000 })
    );
    expect(prefetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-decisions")).toHaveTextContent(
      "Decisions client"
    );
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-page.test.tsx"`
Expected: PASS.

- [ ] **Step 3: Full app test + typecheck sweep**

Run: `pnpm --filter @lightfast/app test` then `pnpm --filter @lightfast/app typecheck`
Expected: PASS / no errors (proves the old card-list/panel tests are fully replaced and nothing else regressed).

- [ ] **Step 4: Repo-wide quality gate**

Run: `pnpm check && pnpm typecheck`
Expected: PASS. (Per CLAUDE.md — lint + format + types across the monorepo.)

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/decisions-page.test.tsx"
git commit -m "test(app): update decisions page test for prefetch + Suspense"
```

---

### Task 18: (Post-merge, non-code) File the deferred-features tracking issue

The design doc defers ⑤ live rows, ⑧ trace/correlation, ⑨ keyboard nav, ⑩ failure-summary chip. Default decision: one umbrella issue.

- [ ] **Step 1: Open one tracking issue**

```bash
gh issue create \
  --title "Decisions audit table — deferred upgrades (live rows, trace, keyboard nav, failure chip)" \
  --body "Follow-ups deferred from the Decisions audit-table rework (docs/superpowers/specs/2026-06-03-decisions-audit-table-design.md):

- [ ] ⑤ Live running rows (auto-refetch / in-place status flip)
- [ ] ⑧ Trace / correlation ('N related actions in this run' via calledById / sourceRef) — needs a dedicated correlation query
- [ ] ⑨ Keyboard navigation (j/k/↵)
- [ ] ⑩ Failure-summary quick-filter chip ('2 failed · 24h')

Also out of scope for the rework: a bespoke isometric decisionsScene (currently reusing signalsScene); resolving calledByUserId to a human name; a Caller (calledByKind) filter facet."
```

- [ ] **Step 2: (Optional) Manual smoke check**

With `pnpm dev` running, open `https://app.lightfast.localhost/<org-slug>/decisions` for an org with seeded routine calls. Confirm: rows group by day with sticky headers; the status left-rail colors failures; clicking a row expands the JSON inspector + error box in place and sets `?decision=`; Status/Provider filters and search update the URL and refetch; "Load more" pages when >50 rows exist.

---

## Self-review (spec coverage)

| Design-doc requirement | Task |
|---|---|
| Full-width, day-grouped, newest-first table | 9, 10 |
| Inline accordion expand (single open), `?decision=` deep-link | 9, 14 |
| Server-side cursor pagination | 1, 2, 6 |
| Server-side filters (provider, status) | 1, 2, 5, 11 |
| Server-side search (routineId / providerToolName / calledById) | 1, 2 |
| Surface input/output JSON + full errorMessage | 8, 16 |
| ① Day grouping + sticky headers (count + failures) | 4, 10 |
| ② Status left-rail | 4, 9 |
| ③ Brand glyphs (Linear / X) | 3, 7 |
| ④ Source column | 4, 9 |
| ⑥ Copy-on-hover (IDs, payloads, error) | 8 |
| ⑦ JSON inspector + errorMessage | 8 |
| Columns: Status·Action·Caller·Source·Started·Duration·chevron | 9, 10 |
| DB: keyset, escapeLikePattern, normalizeLimit, inArray filters, limit+1 | 1 |
| API: shared cursor/limit/search inputs + enum filter arrays + passthrough | 2 |
| UI file set mirroring People | 4–15 |
| Reuse: time utils, CodeBlock, SSRCodeBlockCopyButton, IsoFigure, integration-icons | 7, 8, 12 |
| Add `x` to IntegrationLogoIcons | 3 |
| Tests: DB pagination/filters/search; router output+schema (keep FORBIDDEN); component | 1, 2, 16, 17 |
| Non-goals ⑤⑧⑨⑩ deferred | 18 |
```
