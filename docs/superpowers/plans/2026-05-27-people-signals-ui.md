# People And Signals UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build separate Signals and People workspace pages in `apps/app`, backed by app-internal bound-org tRPC list queries.

**Architecture:** Add organization-scoped DB list helpers, expose them through `org.workspace.signals.list` and `org.workspace.people.list`, then render two client-side UI islands from Server Component pages that prefetch tRPC data. Signals uses a Linear-like flush list surface; People uses a contained directory table.

**Tech Stack:** pnpm, TypeScript, Drizzle, tRPC, TanStack React Query, Next.js App Router, nuqs, Vitest, Testing Library, shadcn-style `@repo/ui` primitives.

---

## Execution Notes

- The current worktree has unrelated uncommitted Automations work touching `api/app/src/root.ts` and `apps/app/src/components/app-sidebar.tsx`. Preserve those changes and add Signals/People around them.
- Do not stage or commit unrelated changes. If committing, stage only the files changed by the task.
- Use TDD. For each behavior, write the failing test, run it, implement the minimal code, then rerun the test.
- Do not add `@tanstack/react-virtual` in this first implementation. Render a bounded first page of 50 rows. Add virtualization only when implementing infinite scrolling or rendering more than one page.

## File Structure

- Modify: `db/app/src/utils/signals.ts`
  - Add `listSignals` with org scoping, status filtering, search, limit, and cursor pagination.
- Modify: `db/app/src/utils/people.ts`
  - Add `listPeople` with org scoping, search, limit, and cursor pagination.
- Modify: `db/app/src/index.ts`
  - Export the new list helper types/functions.
- Create: `db/app/src/__tests__/signals-list.test.ts`
  - Unit tests for `listSignals` query behavior and output shape.
- Modify: `db/app/src/__tests__/people.test.ts`
  - Add `listPeople` tests next to existing people utility tests.
- Create: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
  - tRPC router for `org.workspace.signals.list`.
- Create: `api/app/src/router/(pending-not-allowed)/workspace-people.ts`
  - tRPC router for `org.workspace.people.list`.
- Modify: `api/app/src/root.ts`
  - Register `signals` and `people` under `org.workspace`, preserving any existing `automations` router.
- Create: `api/app/src/__tests__/workspace-signals-router.test.ts`
  - Router tests for bound-org gating and input forwarding.
- Create: `api/app/src/__tests__/workspace-people-router.test.ts`
  - Router tests for bound-org gating and input forwarding.
- Modify: `apps/app/src/components/app-sidebar.tsx`
  - Add `Workspace` nav group with Signals and People. Preserve existing Manage items, including Automations if present.
- Modify: `apps/app/src/__tests__/components/app-sidebar.test.tsx`
  - Add nav group and active-route coverage.
- Create: `apps/app/src/components/workspace-surface.tsx`
  - Shared layout helper for `flush` and `contained` workspace content treatment.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx`
  - Server page that prefetches signals.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
  - Linear-like Signals client island.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading.tsx`
  - Edge-to-edge skeleton rows.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page.tsx`
  - Server page that prefetches people.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`
  - People directory client island.
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading.tsx`
  - Directory table skeleton.
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`
  - Page prefetch coverage.
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`
  - Signals filtering/search/empty/failure/dev-capture coverage.
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx`
  - Page prefetch coverage.
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`
  - People directory search/empty/no-results coverage.

## Task 1: DB List Helpers

**Files:**
- Create: `db/app/src/__tests__/signals-list.test.ts`
- Modify: `db/app/src/__tests__/people.test.ts`
- Modify: `db/app/src/utils/signals.ts`
- Modify: `db/app/src/utils/people.ts`
- Modify: `db/app/src/index.ts`

- [ ] **Step 1: Add failing tests for signal listing**

Create `db/app/src/__tests__/signals-list.test.ts`:

```ts
import type { Database, Signal } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import { listSignals } from "../utils/signals";

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    input: "Customer asked for migration help",
    status: "classified",
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.91,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply with migration plan",
      priority: "high",
      rationale: "The customer is asking for help.",
      summary: "Customer asked for migration help.",
      title: "Follow up on migration",
    },
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
    ...overrides,
  };
}

function makeListDb(rows: Signal[]) {
  const spies = {
    limit: vi.fn((value: number) => Promise.resolve(rows.slice(0, value))),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            orderBy: (...order: unknown[]) => {
              spies.orderBy(...order);
              return {
                limit: spies.limit,
              };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("listSignals", () => {
  it("returns newest-first signal rows with a next cursor when more rows exist", async () => {
    const rows = [
      makeSignal({ id: 3, publicId: "signal_333e4567-e89b-12d3-a456-426614174000" }),
      makeSignal({ id: 2, publicId: "signal_222e4567-e89b-12d3-a456-426614174000" }),
      makeSignal({ id: 1, publicId: "signal_111e4567-e89b-12d3-a456-426614174000" }),
    ];
    const { db, spies } = makeListDb(rows);

    await expect(
      listSignals(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[2]!.createdAt, id: rows[2]!.id },
    });
    expect(spies.limit).toHaveBeenCalledWith(3);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });

  it("returns null next cursor when no extra row exists", async () => {
    const rows = [makeSignal({ id: 1 })];
    const { db } = makeListDb(rows);

    await expect(
      listSignals(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows,
      nextCursor: null,
    });
  });

  it("bounds the requested limit to 100 rows", async () => {
    const { db, spies } = makeListDb([]);

    await listSignals(db, { clerkOrgId: "org_test", limit: 500 });

    expect(spies.limit).toHaveBeenCalledWith(101);
  });
});
```

- [ ] **Step 2: Run the signal list tests and verify they fail**

Run:

```bash
pnpm --filter @db/app test src/__tests__/signals-list.test.ts
```

Expected: fail because `listSignals` is not exported from `../utils/signals`.

- [ ] **Step 3: Add failing tests for people listing**

In `db/app/src/__tests__/people.test.ts`, update the existing people utility
import near the top:

```ts
import { listPeople, upsertPeopleFromCandidates } from "../utils/people";
```

Then append this block after the existing tests:

```ts

function makePeopleListDb(rows: Person[]) {
  const spies = {
    limit: vi.fn((value: number) => Promise.resolve(rows.slice(0, value))),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            orderBy: (...order: unknown[]) => {
              spies.orderBy(...order);
              return {
                limit: spies.limit,
              };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("listPeople", () => {
  it("returns people rows with cursor pagination", async () => {
    const rows = [
      makePerson({ id: 3, publicId: "person_333e4567-e89b-12d3-a456-426614174000" }),
      makePerson({ id: 2, publicId: "person_222e4567-e89b-12d3-a456-426614174000" }),
      makePerson({ id: 1, publicId: "person_111e4567-e89b-12d3-a456-426614174000" }),
    ];
    const { db, spies } = makePeopleListDb(rows);

    await expect(
      listPeople(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[2]!.createdAt, id: rows[2]!.id },
    });
    expect(spies.limit).toHaveBeenCalledWith(3);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });

  it("bounds people list limits to 100 rows", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, { clerkOrgId: "org_test", limit: 500 });

    expect(spies.limit).toHaveBeenCalledWith(101);
  });
});
```

- [ ] **Step 4: Run the people tests and verify they fail**

Run:

```bash
pnpm --filter @db/app test src/__tests__/people.test.ts
```

Expected: fail because `listPeople` is not exported from `../utils/people`.

- [ ] **Step 5: Implement list helper inputs and cursor utilities**

In both `db/app/src/utils/signals.ts` and `db/app/src/utils/people.ts`, add these shared local types:

```ts
export interface ListCursor {
  createdAt: Date;
  id: number;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: ListCursor | null;
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}
```

Use the local `ListCursor` type in each file. Do not create a shared utility until a third list helper needs it.

- [ ] **Step 6: Implement `listSignals`**

In `db/app/src/utils/signals.ts`, extend the Drizzle imports:

```ts
import { and, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";
```

Add:

```ts
export interface ListSignalsParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  search?: string;
  status?: Signal["status"];
}

export async function listSignals(
  db: Database,
  input: ListSignalsParams
): Promise<ListResult<Signal>> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const conditions = [
    eq(signals.clerkOrgId, input.clerkOrgId),
    input.status ? eq(signals.status, input.status) : undefined,
    search
      ? or(
          like(signals.publicId, `%${search}%`),
          like(signals.input, `%${search}%`)
        )
      : undefined,
    input.cursor
      ? or(
          lt(signals.createdAt, input.cursor.createdAt),
          and(
            eq(signals.createdAt, input.cursor.createdAt),
            lt(signals.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(signals)
    .where(and(...conditions))
    .orderBy(desc(signals.createdAt), desc(signals.id))
    .limit(limit + 1);

  const extra = rows.length > limit ? rows[limit] : undefined;
  return {
    items: rows.slice(0, limit),
    nextCursor: extra ? { createdAt: extra.createdAt, id: extra.id } : null,
  };
}
```

If TypeScript rejects the filtered condition type, replace `filter(Boolean)` with a typed local helper:

```ts
function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
```

Then call `.filter(isDefined)`.

- [ ] **Step 7: Implement `listPeople`**

In `db/app/src/utils/people.ts`, extend imports:

```ts
import { and, desc, eq, like, lt, or, sql } from "drizzle-orm";
```

Add:

```ts
export interface ListPeopleParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  search?: string;
}

export async function listPeople(
  db: Database,
  input: ListPeopleParams
): Promise<ListResult<Person>> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const conditions = [
    eq(people.clerkOrgId, input.clerkOrgId),
    search
      ? or(
          like(people.displayName, `%${search}%`),
          like(people.identityProvider, `%${search}%`),
          like(people.identityValue, `%${search}%`),
          like(people.normalizedIdentityValue, `%${search}%`)
        )
      : undefined,
    input.cursor
      ? or(
          lt(people.createdAt, input.cursor.createdAt),
          and(
            eq(people.createdAt, input.cursor.createdAt),
            lt(people.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(people)
    .where(and(...conditions))
    .orderBy(desc(people.createdAt), desc(people.id))
    .limit(limit + 1);

  const extra = rows.length > limit ? rows[limit] : undefined;
  return {
    items: rows.slice(0, limit),
    nextCursor: extra ? { createdAt: extra.createdAt, id: extra.id } : null,
  };
}
```

If TypeScript rejects the filtered condition type, use the same `isDefined` helper as the Signals file.

- [ ] **Step 8: Export DB helpers**

In `db/app/src/index.ts`, extend existing exports:

```ts
export {
  type ListPeopleParams,
  listPeople,
  type UpsertPeopleCandidate,
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";

export {
  type ClaimSignalForClassificationParams,
  type CreateSignalRecordInput,
  type GetSignalByPublicIdParams,
  type ListSignalsParams,
  type MarkSignalClassifiedParams,
  type MarkSignalFailedParams,
  claimSignalForClassification,
  createSignal,
  getSignalByPublicId,
  listSignals,
  markSignalClassified,
  markSignalFailed,
} from "./utils/signals";
```

Preserve any unrelated exports already present in the dirty file.

- [ ] **Step 9: Run DB tests**

Run:

```bash
pnpm --filter @db/app test src/__tests__/signals-list.test.ts src/__tests__/people.test.ts
```

Expected: pass.

## Task 2: tRPC Workspace Routers

**Files:**
- Create: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Create: `api/app/src/router/(pending-not-allowed)/workspace-people.ts`
- Modify: `api/app/src/root.ts`
- Create: `api/app/src/__tests__/workspace-signals-router.test.ts`
- Create: `api/app/src/__tests__/workspace-people-router.test.ts`

- [ ] **Step 1: Add failing Signals router tests**

Create `api/app/src/__tests__/workspace-signals-router.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listSignalsMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listSignals: listSignalsMock,
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspaceSignalsRouter } = await import(
  "../router/(pending-not-allowed)/workspace-signals"
);

const testRouter = createTRPCRouter({ signals: workspaceSignalsRouter });
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound" },
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listSignalsMock.mockReset();
  listSignalsMock.mockResolvedValue({ items: [], nextCursor: null });
});

describe("workspaceSignalsRouter.list", () => {
  it("forwards filters to the org-scoped signal list helper", async () => {
    await expect(
      caller().signals.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        limit: 25,
        search: "migration",
        status: "classified",
      })
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
      limit: 25,
      search: "migration",
      status: "classified",
    });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "unbound" },
      }).signals.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listSignalsMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add failing People router tests**

Create `api/app/src/__tests__/workspace-people-router.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listPeopleMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listPeople: listPeopleMock,
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspacePeopleRouter } = await import(
  "../router/(pending-not-allowed)/workspace-people"
);

const testRouter = createTRPCRouter({ people: workspacePeopleRouter });
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound" },
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listPeopleMock.mockReset();
  listPeopleMock.mockResolvedValue({ items: [], nextCursor: null });
});

describe("workspacePeopleRouter.list", () => {
  it("forwards filters to the org-scoped people list helper", async () => {
    await expect(
      caller().people.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        limit: 25,
        search: "jeevan",
      })
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
      limit: 25,
      search: "jeevan",
    });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "unbound" },
      }).people.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run router tests and verify they fail**

Run:

```bash
pnpm --filter @api/app test src/__tests__/workspace-signals-router.test.ts src/__tests__/workspace-people-router.test.ts
```

Expected: fail because the new router modules do not exist.

- [ ] **Step 4: Implement `workspaceSignalsRouter`**

Create `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`:

```ts
import { listSignals } from "@db/app";
import { signalStatusSchema } from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const listSignalsInput = z.object({
  cursor: z
    .object({
      createdAt: z.coerce.date(),
      id: z.number().int().positive(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  status: signalStatusSchema.optional(),
});

export const workspaceSignalsRouter = {
  list: boundOrgProcedure
    .input(listSignalsInput)
    .query(({ ctx, input }) =>
      listSignals(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        cursor: input.cursor,
        limit: input.limit,
        search: input.search,
        status: input.status,
      })
    ),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 5: Implement `workspacePeopleRouter`**

Create `api/app/src/router/(pending-not-allowed)/workspace-people.ts`:

```ts
import { listPeople } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const listPeopleInput = z.object({
  cursor: z
    .object({
      createdAt: z.coerce.date(),
      id: z.number().int().positive(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const workspacePeopleRouter = {
  list: boundOrgProcedure
    .input(listPeopleInput)
    .query(({ ctx, input }) =>
      listPeople(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        cursor: input.cursor,
        limit: input.limit,
        search: input.search,
      })
    ),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 6: Register routers in root**

In `api/app/src/root.ts`, add imports:

```ts
import { workspacePeopleRouter } from "./router/(pending-not-allowed)/workspace-people";
import { workspaceSignalsRouter } from "./router/(pending-not-allowed)/workspace-signals";
```

Then make `org.workspace` include all existing entries plus:

```ts
workspace: createTRPCRouter({
  automations: automationsRouter,
  people: workspacePeopleRouter,
  signals: workspaceSignalsRouter,
}),
```

If `automations` is not present in the current file at execution time, register only `people` and `signals`.

- [ ] **Step 7: Run router tests**

Run:

```bash
pnpm --filter @api/app test src/__tests__/workspace-signals-router.test.ts src/__tests__/workspace-people-router.test.ts
```

Expected: pass.

## Task 3: Navigation And Workspace Surface Helper

**Files:**
- Modify: `apps/app/src/components/app-sidebar.tsx`
- Modify: `apps/app/src/__tests__/components/app-sidebar.test.tsx`
- Create: `apps/app/src/components/workspace-surface.tsx`

- [ ] **Step 1: Add failing sidebar tests**

Create or update `apps/app/src/__tests__/components/app-sidebar.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/acme/signals";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: ReactNode;
    href: string | { pathname: string };
  }) => (
    <a href={typeof href === "string" ? href : href.pathname}>{children}</a>
  ),
}));

vi.mock("~/components/team-switcher", () => ({
  TeamSwitcher: () => <div>Team switcher</div>,
  TeamSwitcherSkeleton: () => <div>Loading team switcher</div>,
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children?: ReactNode }) => <aside>{children}</aside>,
  SidebarContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  SidebarGroup: ({
    children,
    label,
  }: {
    children?: ReactNode;
    label?: string;
  }) => (
    <section aria-label={label}>
      <h2>{label}</h2>
      {children}
    </section>
  ),
  SidebarGroupContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
  SidebarMenu: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children?: ReactNode;
    isActive?: boolean;
  }) => <div data-active={isActive ? "true" : "false"}>{children}</div>,
  SidebarMenuItem: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@repo/ui/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { AppSidebar } = await import("~/components/app-sidebar");

beforeEach(() => {
  pathname = "/acme/signals";
});

describe("AppSidebar", () => {
  it("renders workspace links separately from manage links", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: /signals/i })).toHaveAttribute(
      "href",
      "/acme/signals"
    );
    expect(screen.getByRole("link", { name: /people/i })).toHaveAttribute(
      "href",
      "/acme/people"
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/acme/settings"
    );
    expect(screen.getByRole("region", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Manage" })).toBeInTheDocument();
  });

  it("marks people active by route section", () => {
    pathname = "/acme/people";
    render(<AppSidebar />);

    const peopleLink = screen.getByRole("link", { name: /people/i });
    expect(peopleLink.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true"
    );
  });
});
```

- [ ] **Step 2: Run sidebar tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/components/app-sidebar.test.tsx
```

Expected: fail because Signals and People links are missing.

- [ ] **Step 3: Update sidebar nav**

In `apps/app/src/components/app-sidebar.tsx`, add icons:

```ts
import { BookOpen, HelpCircle, Mail, Settings, Signal, UsersRound } from "lucide-react";
```

If `CalendarClock` is already present for Automations, preserve it:

```ts
import {
  BookOpen,
  CalendarClock,
  HelpCircle,
  Mail,
  Settings,
  Signal,
  UsersRound,
} from "lucide-react";
```

Add:

```ts
function getOrgWorkspaceItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Signals",
      href: `/${orgSlug}/signals`,
      icon: Signal,
    },
    {
      title: "People",
      href: `/${orgSlug}/people`,
      icon: UsersRound,
    },
  ];
}
```

Update active matching:

```ts
function isActiveNavItem(item: NavItem, pathname: string) {
  if (item.title === "Settings") {
    return pathname.startsWith(item.href);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
```

Use `isActiveNavItem(item, pathname)` inside `NavItems`.

Render `Workspace` before `Manage`:

```tsx
{orgSlug && (
  <>
    <SidebarGroup collapsible defaultOpen label="Workspace">
      <SidebarGroupContent>
        <SidebarMenu>
          <NavItems items={getOrgWorkspaceItems(orgSlug)} pathname={pathname} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
    <SidebarGroup collapsible defaultOpen label="Manage">
      <SidebarGroupContent>
        <SidebarMenu>
          <NavItems items={getOrgManageItems(orgSlug)} pathname={pathname} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </>
)}
```

- [ ] **Step 4: Add workspace surface helper**

Create `apps/app/src/components/workspace-surface.tsx`:

```tsx
import { cn } from "@repo/ui/lib/utils";

export function WorkspaceSurface({
  children,
  className,
  variant = "contained",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "contained" | "flush";
}) {
  if (variant === "flush") {
    return (
      <div className={cn("min-h-full w-full bg-background", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 py-10", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Run sidebar tests**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/components/app-sidebar.test.tsx
```

Expected: pass.

## Task 4: Signals Page

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add failing Signals page prefetch test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-signals">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        signals: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client",
  () => ({
    SignalsClient: () => <div>Signals client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading",
  () => ({
    SignalsLoading: () => <div>Loading signals</div>,
  })
);

const { default: SignalsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page"
);

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("signals page", () => {
  it("prefetches the signals list before rendering the client island", async () => {
    const element = await SignalsPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
    });
    expect(screen.getByTestId("hydrated-signals")).toHaveTextContent(
      "Signals client"
    );
  });
});
```

- [ ] **Step 2: Run Signals page test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx'
```

Expected: fail because the Signals page does not exist.

- [ ] **Step 3: Add failing Signals client tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSuspenseQueryMock = vi.fn();
const queryOptions = {
  queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
};

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        signals: {
          list: {
            queryOptions: (input: unknown) => ({
              ...queryOptions,
              input,
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "mock-parser",
  },
  useQueryState: () => ["", vi.fn()],
}));

const { SignalsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client"
);

const signalRows = [
  {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.91,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply",
      priority: "high",
      rationale: "Customer asked for a migration update.",
      summary: "Customer asked for a migration update.",
      title: "Follow up on migration",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    errorCode: null,
    errorMessage: null,
    id: 7,
    input: "Customer asked for migration help",
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "classified",
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  },
  {
    classification: null,
    createdAt: new Date("2026-05-27T02:00:00.000Z"),
    errorCode: "CLASSIFICATION_PROVIDER_ERROR",
    errorMessage: "Gateway failed",
    id: 8,
    input: "Investigate failed provider call",
    publicId: "signal_223e4567-e89b-12d3-a456-426614174000",
    status: "failed",
    updatedAt: new Date("2026-05-27T02:01:00.000Z"),
  },
];

beforeEach(() => {
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockReturnValue({
    data: { items: signalRows, nextCursor: null },
  });
});

describe("SignalsClient", () => {
  it("renders classified and failed signal rows", () => {
    render(<SignalsClient />);

    expect(screen.getByRole("heading", { name: "Signals" })).toBeInTheDocument();
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for a migration update.")).toBeInTheDocument();
    expect(screen.getByText("CLASSIFICATION_PROVIDER_ERROR")).toBeInTheDocument();
    expect(screen.getByText("Gateway failed")).toBeInTheDocument();
  });

  it("filters rows by status tab", () => {
    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
    expect(screen.getByText("CLASSIFICATION_PROVIDER_ERROR")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<SignalsClient />);

    expect(screen.getByText("No signals yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run Signals client tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: fail because the Signals client component does not exist.

- [ ] **Step 5: Implement Signals loading skeleton**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading.tsx`:

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function SignalsLoading() {
  return (
    <div className="min-h-full border-border border-t bg-background">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_5rem] items-center gap-3 border-border/70 border-b px-4"
          key={index}
        >
          <Skeleton className="size-3.5 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
          <Skeleton className="h-5 rounded-full" />
          <Skeleton className="h-5 rounded-full" />
          <Skeleton className="h-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement Signals page**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx`:

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SignalsClient } from "./_components/signals-client";
import { SignalsLoading } from "./_components/signals-loading";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  prefetch(trpc.org.workspace.signals.list.queryOptions({ limit: 50 }));

  return (
    <HydrateClient>
      <Suspense fallback={<SignalsLoading />}>
        <SignalsClient />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 7: Implement Signals client**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Circle, CircleCheck, CircleDashed, CircleX, FlaskConical, Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useDeferredValue, useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";

type SignalList = AppRouterOutputs["org"]["workspace"]["signals"]["list"];
type SignalRow = SignalList["items"][number];
type SignalStatus = SignalRow["status"];

const statusTabs: Array<{ label: string; value: "all" | SignalStatus }> = [
  { label: "All", value: "all" },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Classified", value: "classified" },
  { label: "Failed", value: "failed" },
];

export function SignalsClient() {
  const trpc = useTRPC();
  const [query, setQuery] = useQueryState(
    "q",
    parseAsString.withDefault("")
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SignalStatus>("all");
  const deferredQuery = useDeferredValue(query);
  const listQueryOptions = trpc.org.workspace.signals.list.queryOptions({
    limit: 50,
    search: deferredQuery.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });

  const rows = useMemo(() => data.items, [data.items]);

  return (
    <WorkspaceSurface variant="flush">
      <div className="flex h-11 items-center justify-between border-border border-t border-b px-4">
        <div>
          <h1 className="font-medium text-foreground text-sm">Signals</h1>
          <p className="text-muted-foreground text-xs">
            {data.items.length} recent signals
          </p>
        </div>
        <Button
          className={cn(process.env.NODE_ENV === "production" && "hidden")}
          size="sm"
          type="button"
          variant="ghost"
        >
          <FlaskConical className="size-3.5" />
          Dev capture
        </Button>
      </div>
      <div className="flex h-10 items-center gap-1 border-border border-b px-3">
        {statusTabs.map((tab) => (
          <Button
            aria-pressed={statusFilter === tab.value}
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            size="sm"
            type="button"
            variant={statusFilter === tab.value ? "secondary" : "ghost"}
          >
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto flex w-64 items-center gap-2">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search signals"
            className="h-8"
            onChange={(event) => void setQuery(event.currentTarget.value)}
            placeholder="Search signals"
            value={query}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <SignalsEmptyState hasQuery={!!deferredQuery.trim()} />
      ) : (
        <div className="bg-background">
          {rows.map((signal) => (
            <SignalListRow key={signal.publicId} signal={signal} />
          ))}
        </div>
      )}
    </WorkspaceSurface>
  );
}

function SignalsEmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center border-border border-b px-6 text-center">
      <p className="font-medium text-sm">
        {hasQuery ? "No matching signals" : "No signals yet"}
      </p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        {hasQuery
          ? "Try a different search or status filter."
          : "Signals created by API keys and automations will appear here."}
      </p>
    </div>
  );
}

function SignalListRow({ signal }: { signal: SignalRow }) {
  const classification = signal.classification;
  const title = classification?.title ?? signal.input;
  const summary = classification?.summary ?? signal.input;

  return (
    <div className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6rem_6rem] items-center gap-3 border-border/70 border-b px-4 hover:bg-muted/30">
      <StatusIcon status={signal.status} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground text-sm">{title}</p>
        <p className="truncate text-muted-foreground text-xs">{summary}</p>
        {signal.status === "failed" && signal.errorCode && (
          <p className="truncate text-destructive text-xs">
            {signal.errorCode}
            {signal.errorMessage ? `: ${signal.errorMessage}` : ""}
          </p>
        )}
      </div>
      <SignalBadge>{classification?.priority ?? signal.status}</SignalBadge>
      <SignalBadge>{classification?.kind ?? "unclassified"}</SignalBadge>
      <SignalBadge>{classification?.disposition ?? signal.status}</SignalBadge>
      <Tooltip>
        <TooltipTrigger className="truncate text-muted-foreground text-xs text-left">
          {formatRelativeTimeToNow(new Date(signal.createdAt), {
            addSuffix: true,
          })}
        </TooltipTrigger>
        <TooltipContent>{signal.createdAt.toISOString()}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function StatusIcon({ status }: { status: SignalStatus }) {
  const className = "size-4 text-muted-foreground";
  if (status === "classified") {
    return <CircleCheck className={className} />;
  }
  if (status === "failed") {
    return <CircleX className="size-4 text-destructive" />;
  }
  if (status === "processing") {
    return <CircleDashed className={className} />;
  }
  return <Circle className={className} />;
}

function SignalBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="truncate rounded-full" variant="secondary">
      {children}
    </Badge>
  );
}
```

If the router output uses `id` instead of `publicId`, update the client to use `signal.id` consistently. Prefer the DB public id field name only if the tRPC router returns raw DB rows.

- [ ] **Step 8: Run Signals tests**

Run:

```bash
pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: pass.

## Task 5: People Page

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`

- [ ] **Step 1: Add failing People page prefetch test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "people", "list", { limit: 50 }],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-people">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        people: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client",
  () => ({
    PeopleClient: () => <div>People client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading",
  () => ({
    PeopleLoading: () => <div>Loading people</div>,
  })
);

const { default: PeoplePage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page"
);

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("people page", () => {
  it("prefetches the people list before rendering the client island", async () => {
    const element = await PeoplePage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "people", "list", { limit: 50 }],
    });
    expect(screen.getByTestId("hydrated-people")).toHaveTextContent(
      "People client"
    );
  });
});
```

- [ ] **Step 2: Add failing People client tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        people: {
          list: {
            queryOptions: (input: unknown) => ({
              input,
              queryKey: ["org", "workspace", "people", "list", input],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "mock-parser",
  },
  useQueryState: () => ["", vi.fn()],
}));

const { PeopleClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client"
);

const peopleRows = [
  {
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    displayName: "Jeevan Pillay",
    firstSeenSignalId: "signal_first",
    id: 1,
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    lastSeenSignalId: "signal_last",
    normalizedIdentityValue: "jeevanp",
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    seenCount: 3,
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  },
];

beforeEach(() => {
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockReturnValue({
    data: { items: peopleRows, nextCursor: null },
  });
});

describe("PeopleClient", () => {
  it("renders people directory rows", () => {
    render(<PeopleClient />);

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByText("Jeevan Pillay")).toBeInTheDocument();
    expect(screen.getByText("@jeevanp")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("filters visible rows by local search", () => {
    render(<PeopleClient />);

    fireEvent.change(screen.getByLabelText("Search people"), {
      target: { value: "missing" },
    });

    expect(screen.queryByText("Jeevan Pillay")).not.toBeInTheDocument();
    expect(screen.getByText("No people found")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<PeopleClient />);

    expect(screen.getByText("No people yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run People tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: fail because the People page and client do not exist.

- [ ] **Step 4: Implement People loading skeleton**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading.tsx`:

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function PeopleLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem] gap-4 border-border/60 border-b px-4 py-3 last:border-b-0"
            key={index}
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement People page**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page.tsx`:

```tsx
import { Suspense } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleClient } from "./_components/people-client";
import { PeopleLoading } from "./_components/people-loading";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  prefetch(trpc.org.workspace.people.list.queryOptions({ limit: 50 }));

  return (
    <HydrateClient>
      <WorkspaceSurface variant="contained">
        <Suspense fallback={<PeopleLoading />}>
          <PeopleClient />
        </Suspense>
      </WorkspaceSurface>
    </HydrateClient>
  );
}
```

- [ ] **Step 6: Implement People client**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Search, UsersRound } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { useTRPC } from "~/trpc/react";

type PeopleList = AppRouterOutputs["org"]["workspace"]["people"]["list"];
type PersonRow = PeopleList["items"][number];

export function PeopleClient() {
  const trpc = useTRPC();
  const [query, setQuery] = useQueryState(
    "peopleQuery",
    parseAsString.withDefault("")
  );
  const deferredQuery = useDeferredValue(query);
  const listQueryOptions = trpc.org.workspace.people.list.queryOptions({
    limit: 50,
  });
  const { data } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 60_000,
  });

  const visiblePeople = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return data.items;
    }
    return data.items.filter((person) =>
      [
        person.displayName,
        person.identityProvider,
        person.identityType,
        person.identityValue,
        person.normalizedIdentityValue,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
  }, [data.items, deferredQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            People
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Durable identities discovered from classified signals.
          </p>
        </div>
        <div className="flex w-72 items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            aria-label="Search people"
            onChange={(event) => void setQuery(event.currentTarget.value)}
            placeholder="Search people"
            value={query}
          />
        </div>
      </div>

      {data.items.length === 0 ? (
        <PeopleEmptyState title="No people yet">
          People discovered by the signal pipeline will appear here.
        </PeopleEmptyState>
      ) : visiblePeople.length === 0 ? (
        <PeopleEmptyState title="No people found">
          No people match your search.
        </PeopleEmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem_9rem] gap-4 border-border/60 border-b bg-muted/30 px-4 py-2 text-muted-foreground text-xs">
            <span>Identity</span>
            <span>Provider</span>
            <span>Type</span>
            <span>Seen</span>
            <span>Updated</span>
          </div>
          {visiblePeople.map((person) => (
            <PeopleRow key={person.publicId} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}

function PeopleEmptyState({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 py-16 text-center">
      <div className="mb-4 rounded-full bg-muted/20 p-3">
        <UsersRound className="size-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">{children}</p>
    </div>
  );
}

function PeopleRow({ person }: { person: PersonRow }) {
  const name = person.displayName ?? person.identityValue;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem_9rem] items-center gap-4 border-border/60 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">{name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {person.identityValue}
        </p>
        <p className="truncate text-muted-foreground/80 text-xs">
          {person.normalizedIdentityValue}
        </p>
      </div>
      <Badge className="w-fit rounded-full" variant="secondary">
        {person.identityProvider}
      </Badge>
      <span className="text-muted-foreground text-sm">{person.identityType}</span>
      <span className="text-sm">{person.seenCount}</span>
      <span className="text-muted-foreground text-xs">
        {formatRelativeTimeToNow(new Date(person.updatedAt), {
          addSuffix: true,
        })}
      </span>
    </div>
  );
}
```

If the router output uses `id` instead of `publicId`, update the row key to use that output consistently.

- [ ] **Step 7: Run People tests**

Run:

```bash
pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: pass.

## Task 6: Typecheck And Focused Verification

**Files:**
- No new files unless fixes are required by failing commands.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @db/app test src/__tests__/signals-list.test.ts src/__tests__/people.test.ts
pnpm --filter @api/app test src/__tests__/workspace-signals-router.test.ts src/__tests__/workspace-people-router.test.ts
pnpm --filter @lightfast/app test src/__tests__/components/app-sidebar.test.tsx 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: all commands pass.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all commands pass.

- [ ] **Step 3: Inspect diff for unrelated changes**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files match the file list in this plan plus pre-existing unrelated dirty files. Do not stage unrelated dirty files.

- [ ] **Step 4: Optional local browser verification**

Start the app if no dev server is running:

```bash
pnpm dev:app
```

Open:

```text
https://app.lightfast.localhost/<slug>/signals
https://app.lightfast.localhost/<slug>/people
```

Expected:

- Signals renders a flush, Linear-like list surface.
- People renders a contained directory table.
- Sidebar shows Workspace and Manage groups.
- No text overlaps at desktop width and mobile sidebar mode remains usable.
