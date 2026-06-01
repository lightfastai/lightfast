# People Views + `@actions` Slot Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Linear-style personal saved views to `/people` (mirroring the signals stack) and fix the `@actions` parallel-route slot so the topbar actions bar only shows on `/signals` and `/people` — clearing on soft navigation to every other route.

**Architecture:** Two threads shipped together. (A) The `@actions` slot on `(workspace)/layout.tsx` gains a slot-index `page.tsx` and a `[...catchAll]/page.tsx` (both `null`), so soft-navigation to non-views routes resolves a real null match instead of retaining the last switcher. (B) A new `lightfast_people_views` table → `db/app` helpers → `org.workspace.people.views` tRPC router → `people/_components/` switcher, dialog, model, hooks, and a `@actions/people/page.tsx` slot — each a layer-for-layer mirror of the existing signals views stack. The switcher (slot subtree) and the page (`children` subtree) never share React state; they coordinate via nuqs URL params + the shared react-query cache.

**Tech Stack:** Drizzle ORM (PlanetScale/Vitess MySQL), tRPC (`boundOrgProcedure`), Next.js App Router parallel routes, React + nuqs + TanStack Query, Vitest + Testing Library, Biome.

**Source spec:** [`docs/superpowers/specs/2026-05-31-people-views-and-actions-slot-design.md`](../specs/2026-05-31-people-views-and-actions-slot-design.md)

---

## File Structure

**Create:**
- `db/app/src/schema/tables/people-views.ts` — table + `createPeopleViewId()` + `PeopleViewConfig`/`PeopleView`/`InsertPeopleView` types
- `db/app/src/utils/people-views.ts` — `listPeopleViews`/`createPeopleView`/`deletePeopleView` + private `getRowsAffected`
- `db/app/src/__tests__/people-views.test.ts` — DB helper unit tests
- `db/app/src/migrations/0010_<generated>.sql` (+ meta) — generated, never hand-written
- `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts` — `workspacePeopleViewsRouter`
- `api/app/src/__tests__/workspace-people-views-router.test.ts` — router tests
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-views-model.ts`
- `.../people/_components/use-people-views-query.ts`
- `.../people/_components/people-create-view-dialog.tsx`
- `.../people/_components/people-view-switcher.tsx`
- `.../people/_components/people-view-switcher.test.tsx`
- `.../(workspace)/@actions/people/page.tsx` — renders `<PeopleViewSwitcher />`
- `.../(workspace)/@actions/page.tsx` — slot index, returns `null`
- `.../(workspace)/@actions/[...catchAll]/page.tsx` — slot catch-all, returns `null`

**Modify:**
- `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, `db/app/src/index.ts` — export wiring
- `api/app/src/router/(pending-not-allowed)/workspace-people.ts` — mount `views:`
- `.../people/_components/people-search-params.ts` — add `peopleSavedViewParser`
- `.../people/_components/people-client.tsx` — clear `?view` on ad-hoc filter edits

**Keep unchanged:** `(workspace)/@actions/default.tsx` (hard-load fallback), `authenticated-topbar.tsx`, `(workspace)/layout.tsx` (the `actions` prop wiring already exists).

---

## Task 1: People views table + schema exports

The DB table mirrors `signal-views.ts` exactly. Critical detail: `updatedAt` uses the **runtime** `.$onUpdate(() => new Date())` hook, NOT the DDL `.onUpdateNow()`, to dodge the Vitess errno 1294 `ON UPDATE` precision bug. Config typed from `@repo/app-validation/schemas` (the same source `people.ts` uses), not from the UI `people-model.ts`.

**Files:**
- Create: `db/app/src/schema/tables/people-views.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/index.ts`

- [ ] **Step 1: Create the table file**

Create `db/app/src/schema/tables/people-views.ts`:

```ts
import { randomUUID } from "node:crypto";
import type {
  PersonIdentityProvider,
  PersonIdentityType,
} from "@repo/app-validation/schemas";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const PEOPLE_VIEW_ID_PREFIX = "peoview_";

const PEOPLE_VIEW_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;

export function createPeopleViewId() {
  return `${PEOPLE_VIEW_ID_PREFIX}${randomUUID()}`;
}

export interface PeopleViewConfig {
  filters: {
    providers: PersonIdentityProvider[];
    types: PersonIdentityType[];
  };
}

export const peopleViews = mysqlTable(
  "lightfast_people_views",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PEOPLE_VIEW_ID_LENGTH })
      .notNull()
      .$defaultFn(createPeopleViewId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    name: varchar("name", { length: NAME_LENGTH }).notNull(),

    config: json("config").$type<PeopleViewConfig>().notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // NOTE: runtime `$onUpdate` hook, NOT the DDL `.onUpdateNow()`. drizzle-kit
    // 0.31.10 emits `ON UPDATE CURRENT_TIMESTAMP` without the `(3)` precision a
    // `timestamp(3)` column requires, which Vitess rejects on CREATE TABLE
    // (errno 1294). The runtime hook keeps updated-at-on-write semantics
    // without emitting the invalid DDL clause. See signal-views.ts.
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("people_views_public_id_uq").on(table.publicId),
    index("people_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type PeopleView = typeof peopleViews.$inferSelect;
export type InsertPeopleView = typeof peopleViews.$inferInsert;
```

- [ ] **Step 2: Wire the per-file table barrel**

In `db/app/src/schema/tables/index.ts`, insert a new export block immediately after the `} from "./people";` block (before the `./signal-views` block). Find:

```ts
  type PersonIdentityType,
  people,
} from "./people";
export {
  createSignalViewId,
```

Replace with:

```ts
  type PersonIdentityType,
  people,
} from "./people";
export {
  createPeopleViewId,
  type InsertPeopleView,
  PEOPLE_VIEW_ID_PREFIX,
  type PeopleView,
  type PeopleViewConfig,
  peopleViews,
} from "./people-views";
export {
  createSignalViewId,
```

- [ ] **Step 3: Wire the combined schema barrel**

In `db/app/src/schema/index.ts`, add these six symbols to the existing `export { ... } from "./tables";` block (placement within the block is not load-bearing — `pnpm check` normalizes ordering; keep them near the other `Person*`/`people` entries):

```ts
  createPeopleViewId,
  type InsertPeopleView,
  PEOPLE_VIEW_ID_PREFIX,
  type PeopleView,
  type PeopleViewConfig,
  peopleViews,
```

- [ ] **Step 4: Wire the package entry schema re-export**

In `db/app/src/index.ts`, add the same six symbols to the `export { ... } from "./schema";` block (lines 7-53, near the other `Person*`/`people` entries):

```ts
  createPeopleViewId,
  type InsertPeopleView,
  PEOPLE_VIEW_ID_PREFIX,
  type PeopleView,
  type PeopleViewConfig,
  peopleViews,
```

(The `./utils/people-views` export block is added in Task 2, Step 4.)

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @db/app typecheck`
Expected: PASS (no errors). If `pnpm check` later flags export ordering, run the Biome autofix and re-run.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/schema/tables/people-views.ts db/app/src/schema/tables/index.ts db/app/src/schema/index.ts db/app/src/index.ts
git commit -m "feat(db): add lightfast_people_views table + schema exports"
```

---

## Task 2: People views DB helpers (TDD)

Mirror `db/app/src/utils/signal-views.ts`. All three helpers are scoped to `(clerkOrgId, createdByUserId)`; `deletePeopleView` additionally requires the `createdByUserId` match. The test mirrors `db/app/src/__tests__/signal-views.test.ts` and lives in the top-level `__tests__` dir (not `utils/__tests__/`).

**Files:**
- Test: `db/app/src/__tests__/people-views.test.ts`
- Create: `db/app/src/utils/people-views.ts`
- Modify: `db/app/src/index.ts` (util export block)

- [ ] **Step 1: Write the failing test**

Create `db/app/src/__tests__/people-views.test.ts`:

```ts
import type { Database, PeopleView } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  createPeopleView,
  deletePeopleView,
  listPeopleViews,
} from "../utils/people-views";

function makeView(overrides: Partial<PeopleView> = {}): PeopleView {
  return {
    id: 1,
    publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    name: "X handles",
    config: {
      filters: {
        providers: ["x"],
        types: ["handle"],
      },
    },
    createdAt: new Date("2026-05-31T01:00:00.000Z"),
    updatedAt: new Date("2026-05-31T01:00:00.000Z"),
    ...overrides,
  };
}

function makeListDb(rows: PeopleView[]) {
  const spies = {
    where: vi.fn(),
    orderBy: vi.fn(() => Promise.resolve(rows)),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return { orderBy: spies.orderBy };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makeCreateDb() {
  let inserted: Partial<PeopleView> | null = null;
  const spies = {
    values: vi.fn(async (value: Partial<PeopleView>) => {
      inserted = value;
    }),
    limit: vi.fn(() =>
      Promise.resolve(inserted ? [makeView({ ...inserted, id: 9 })] : [])
    ),
  };
  const db = {
    insert: () => ({ values: spies.values }),
    select: () => ({
      from: () => ({ where: () => ({ limit: spies.limit }) }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makeDeleteDb(rowsAffected: number) {
  const spies = {
    where: vi.fn(async () => ({ rowsAffected })),
  };
  const db = { delete: () => ({ where: spies.where }) };
  return { db: db as unknown as Database, spies };
}

describe("listPeopleViews", () => {
  it("returns the caller's views newest-first", async () => {
    const rows = [makeView({ id: 2 }), makeView({ id: 1 })];
    const { db, spies } = makeListDb(rows);

    await expect(
      listPeopleViews(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      })
    ).resolves.toEqual(rows);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });
});

describe("createPeopleView", () => {
  it("inserts a view scoped to the org + user and returns it", async () => {
    const { db, spies } = makeCreateDb();

    await expect(
      createPeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        name: "X handles",
        config: makeView().config,
      })
    ).resolves.toMatchObject({
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "X handles",
    });

    expect(spies.values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        name: "X handles",
      })
    );
  });
});

describe("deletePeopleView", () => {
  it("returns true when a row was deleted", async () => {
    const { db } = makeDeleteDb(1);
    await expect(
      deletePeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toBe(true);
  });

  it("returns false when nothing matched", async () => {
    const { db } = makeDeleteDb(0);
    await expect(
      deletePeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "peoview_missing",
      })
    ).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @db/app test people-views`
Expected: FAIL — cannot resolve `../utils/people-views` (module does not exist yet).

- [ ] **Step 3: Create the helper module**

Create `db/app/src/utils/people-views.ts`:

```ts
import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  createPeopleViewId,
  type PeopleView,
  type PeopleViewConfig,
  peopleViews,
} from "../schema";

export interface ListPeopleViewsParams {
  clerkOrgId: string;
  createdByUserId: string;
}

export async function listPeopleViews(
  db: Database,
  input: ListPeopleViewsParams
): Promise<PeopleView[]> {
  return db
    .select()
    .from(peopleViews)
    .where(
      and(
        eq(peopleViews.clerkOrgId, input.clerkOrgId),
        eq(peopleViews.createdByUserId, input.createdByUserId)
      )
    )
    .orderBy(desc(peopleViews.createdAt), desc(peopleViews.id));
}

export interface CreatePeopleViewParams {
  clerkOrgId: string;
  config: PeopleViewConfig;
  createdByUserId: string;
  name: string;
}

export async function createPeopleView(
  db: Database,
  input: CreatePeopleViewParams
): Promise<PeopleView> {
  const publicId = createPeopleViewId();
  await db.insert(peopleViews).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    config: input.config,
  });

  const [row] = await db
    .select()
    .from(peopleViews)
    .where(
      and(
        eq(peopleViews.publicId, publicId),
        eq(peopleViews.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error(`Failed to create people view ${publicId}`);
  }
  return row;
}

export interface DeletePeopleViewParams {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function deletePeopleView(
  db: Database,
  input: DeletePeopleViewParams
): Promise<boolean> {
  const result = await db
    .delete(peopleViews)
    .where(
      and(
        eq(peopleViews.publicId, input.publicId),
        eq(peopleViews.clerkOrgId, input.clerkOrgId),
        eq(peopleViews.createdByUserId, input.createdByUserId)
      )
    );
  return getRowsAffected(result) > 0;
}

function getRowsAffected(result: unknown): number {
  if (result === null || typeof result !== "object") {
    return 0;
  }
  const { affectedRows, rowsAffected } = result as {
    affectedRows?: unknown;
    rowsAffected?: unknown;
  };
  if (typeof rowsAffected === "number") {
    return rowsAffected;
  }
  if (typeof affectedRows === "number") {
    return affectedRows;
  }
  return 0;
}
```

- [ ] **Step 4: Wire the util exports in the package entry**

In `db/app/src/index.ts`, add a new dedicated export block immediately after the `} from "./utils/people";` block (mirroring the `./utils/signal-views` block that follows it). Find:

```ts
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";
export {
  type CreateSignalViewParams,
```

Replace with:

```ts
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";
export {
  type CreatePeopleViewParams,
  createPeopleView,
  type DeletePeopleViewParams,
  deletePeopleView,
  type ListPeopleViewsParams,
  listPeopleViews,
} from "./utils/people-views";
export {
  type CreateSignalViewParams,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @db/app test people-views`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/people-views.ts db/app/src/__tests__/people-views.test.ts db/app/src/index.ts
git commit -m "feat(db): add people views list/create/delete helpers"
```

---

## Task 3: Generate the migration

Never hand-write SQL — `db:generate` reads the schema barrel (which now exports `peopleViews`) and emits a new numbered migration.

**Files:**
- Create (generated): `db/app/src/migrations/0010_<generated>.sql`, `db/app/src/migrations/meta/0010_snapshot.json`, updated `_journal.json`

- [ ] **Step 1: Generate the migration**

Run:
```bash
cd db/app && pnpm db:generate
```
Expected: a new `0010_*.sql` migration is written under `db/app/src/migrations/`.

- [ ] **Step 2: Verify the generated DDL is Vitess-safe**

Open the generated `0010_*.sql` and confirm:
- It contains `CREATE TABLE \`lightfast_people_views\``.
- The `updated_at` column reads `timestamp(3) ... DEFAULT (CURRENT_TIMESTAMP(3))` and does **NOT** contain a bare `ON UPDATE CURRENT_TIMESTAMP` (no `(3)`-less clause). If an invalid `ON UPDATE` clause appears, the table file's `updatedAt` is wrong — re-check it uses `.$onUpdate(() => new Date())` not `.onUpdateNow()`, fix, and regenerate.
- Indexes `people_views_public_id_uq` (unique) and `people_views_org_user_created_idx` are present.

> **Applying it locally is not required to proceed.** All DB and API unit tests mock the database. Local schema application via `pnpm db:push` is known-broken on worktree branches (drizzle-kit 0.31.10 `ON UPDATE` precision bug); production rollout happens through CI against the persistent `staging` branch per `db/CLAUDE.md`. Only apply locally if you want to exercise the live query path — and then apply the generated migration SQL directly against the worktree PlanetScale branch (DB creds via the `lightfast-local-infra` skill), not `db:push`.

- [ ] **Step 3: Commit**

```bash
git add db/app/src/migrations
git commit -m "feat(db): generate people views migration"
```

---

## Task 4: People views tRPC router (TDD)

Mirror `workspace-signal-views.ts` on `boundOrgProcedure`, mounted at `org.workspace.people.views`. The config zod is built from `peopleIdentityProviderSchema`/`peopleIdentityTypeSchema` (from `@repo/app-validation/schemas` — the same source `workspace-people.ts` uses), with the same `.max()` caps as `listPeopleInput` (`providers` ≤ 5, `types` ≤ 3).

**Files:**
- Test: `api/app/src/__tests__/workspace-people-views-router.test.ts`
- Create: `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-people.ts`

- [ ] **Step 1: Write the failing test**

Create `api/app/src/__tests__/workspace-people-views-router.test.ts`. It mounts the parent `people: workspacePeopleRouter` and reaches the sub-router via `caller().people.views.*`; the `@db/app` mock provides both the people-router deps and the new view helpers.

```ts
import type { Database, PeopleView } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listPeopleViewsMock = vi.fn();
const createPeopleViewMock = vi.fn();
const deletePeopleViewMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  // people router deps imported by workspace-people.ts
  listPeople: vi.fn(),
  getPersonByPublicId: vi.fn(),
  // people views deps
  listPeopleViews: listPeopleViewsMock,
  createPeopleView: createPeopleViewMock,
  deletePeopleView: deletePeopleViewMock,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
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

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;
const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};
const pendingIdentity: AuthIdentity = { type: "pending", userId: "user_test" };
const unauthenticatedIdentity: AuthIdentity = { type: "unauthenticated" };

const viewRow: PeopleView = {
  id: 3,
  publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByUserId: "user_test",
  name: "X handles",
  config: {
    filters: {
      providers: ["x"],
      types: ["handle"],
    },
  },
  createdAt: new Date("2026-05-31T01:00:00.000Z"),
  updatedAt: new Date("2026-05-31T01:00:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listPeopleViewsMock.mockReset().mockResolvedValue([viewRow]);
  createPeopleViewMock.mockReset().mockResolvedValue(viewRow);
  deletePeopleViewMock.mockReset().mockResolvedValue(true);
});

describe("workspacePeopleRouter.views.list", () => {
  it("scopes to the authenticated org + user", async () => {
    await expect(caller().people.views.list()).resolves.toEqual([viewRow]);
    expect(listPeopleViewsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).people.views.list()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });

  it("rejects pending (no active org) callers", async () => {
    await expect(
      caller(pendingIdentity).people.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).people.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.views.create", () => {
  it("creates a view scoped to the org + user and trims the name", async () => {
    await expect(
      caller().people.views.create({
        name: "  X handles  ",
        config: viewRow.config,
      })
    ).resolves.toEqual(viewRow);

    expect(createPeopleViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "X handles",
      config: viewRow.config,
    });
  });

  it("rejects an empty name", async () => {
    await expect(
      caller().people.views.create({ name: "   ", config: viewRow.config })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPeopleViewMock).not.toHaveBeenCalled();
  });

  it("rejects unknown provider values in config", async () => {
    await expect(
      caller().people.views.create({
        name: "Bad",
        config: {
          filters: {
            providers: ["telegram" as unknown as "x"],
            types: [],
          },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPeopleViewMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.views.delete", () => {
  it("deletes a view scoped to the org + user", async () => {
    await expect(
      caller().people.views.delete({ publicId: viewRow.publicId })
    ).resolves.toEqual({ success: true });
    expect(deletePeopleViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: viewRow.publicId,
    });
  });

  it("throws NOT_FOUND when nothing was deleted", async () => {
    deletePeopleViewMock.mockResolvedValueOnce(false);
    await expect(
      caller().people.views.delete({ publicId: "peoview_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @api/app test workspace-people-views-router`
Expected: FAIL — `people.views` does not exist on the router (the `views:` mount is not added yet).

- [ ] **Step 3: Create the router**

Create `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts`:

```ts
import { createPeopleView, deletePeopleView, listPeopleViews } from "@db/app";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const peopleViewConfigSchema = z.object({
  filters: z.object({
    providers: z.array(peopleIdentityProviderSchema).max(5),
    types: z.array(peopleIdentityTypeSchema).max(3),
  }),
});

const createPeopleViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: peopleViewConfigSchema,
});

const deletePeopleViewInput = z.object({
  publicId: z.string().min(1).max(64),
});

export const workspacePeopleViewsRouter = {
  list: boundOrgProcedure.query(({ ctx }) =>
    listPeopleViews(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
    })
  ),
  create: boundOrgProcedure
    .input(createPeopleViewInput)
    .mutation(({ ctx, input }) =>
      createPeopleView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        name: input.name,
        config: input.config,
      })
    ),
  delete: boundOrgProcedure
    .input(deletePeopleViewInput)
    .mutation(async ({ ctx, input }) => {
      const deleted = await deletePeopleView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        publicId: input.publicId,
      });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Mount the sub-router**

In `api/app/src/router/(pending-not-allowed)/workspace-people.ts`:

Add the import alongside the existing imports (after the `./workspace-list-input` import):

```ts
import { workspacePeopleViewsRouter } from "./workspace-people-views";
```

Then add `views:` as the last property of the router record. Find:

```ts
      return person;
    }),
} satisfies TRPCRouterRecord;
```

Replace with:

```ts
      return person;
    }),
  views: workspacePeopleViewsRouter,
} satisfies TRPCRouterRecord;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @api/app test workspace-people-views-router`
Expected: PASS (9 tests).

- [ ] **Step 6: Verify the existing people-router test still passes**

The pre-existing `workspace-people-router.test.ts` mocks `@db/app` with only `{ listPeople, getPersonByPublicId }`. After mounting `views:`, the router module also imports `createPeopleView`/`deletePeopleView`/`listPeopleViews` — these resolve to `undefined` under that mock but are never invoked by the people-router tests, so the suite is unaffected.

Run: `pnpm --filter @api/app test workspace-people-router`
Expected: PASS. If it fails because the module import surface is unsatisfied, add `listPeopleViews: vi.fn(), createPeopleView: vi.fn(), deletePeopleView: vi.fn(),` to that test's `vi.mock("@db/app", ...)` factory and re-run.

- [ ] **Step 7: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/workspace-people-views.ts" "api/app/src/router/(pending-not-allowed)/workspace-people.ts" api/app/src/__tests__/workspace-people-views-router.test.ts
git commit -m "feat(api): add org.workspace.people.views router"
```

---

## Task 5: Add the saved-view URL param

`people-search-params.ts` already imports `parseAsString`. Add a nullable `view` param (mirror `signalSavedViewParser`).

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`

- [ ] **Step 1: Add the parser**

Find:

```ts
export const personProviderParser = parseAsString.withDefault("");
export const personTypeParser = parseAsString.withDefault("");
export const personParser = parseAsString;
export const personQueryParser = parseAsString.withDefault("");
```

Replace with:

```ts
export const personProviderParser = parseAsString.withDefault("");
export const personTypeParser = parseAsString.withDefault("");
export const personParser = parseAsString;
export const personQueryParser = parseAsString.withDefault("");

// "view" holds the active saved-view publicId (null when on All people).
export const peopleSavedViewParser = parseAsString;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts"
git commit -m "feat(people): add saved-view url param"
```

---

## Task 6: People views model

Mirror `signals-views-model.ts`. `PeopleViewConfig` here is the **tRPC output** config type (not the DB type); `selectionToConfig` takes the existing `PeopleClassificationFilters` from `people-model.ts`. Depends on Task 4 (the `org.workspace.people.views.list` output type must exist).

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-views-model.ts`

- [ ] **Step 1: Create the model**

Create `people-views-model.ts`:

```ts
import type { AppRouterOutputs } from "@api/app";
import type { PeopleClassificationFilters } from "./people-model";
import { serializePersonValues } from "./people-search-params";

export type PeopleViewList =
  AppRouterOutputs["org"]["workspace"]["people"]["views"]["list"];
export type PeopleViewRow = PeopleViewList[number];
export type PeopleViewConfig = PeopleViewRow["config"];

export const ALL_PEOPLE_VIEW_NAME = "All people";

export interface PeopleViewParamValues {
  provider: string;
  type: string;
}

/** Serialize a saved view's config into the URL param values the page reads. */
export function viewConfigToParamValues(
  config: PeopleViewConfig
): PeopleViewParamValues {
  return {
    provider: serializePersonValues(config.filters.providers),
    type: serializePersonValues(config.filters.types),
  };
}

/** Empty param values — selecting "All people" clears all filters. */
export function allPeopleParamValues(): PeopleViewParamValues {
  return { provider: "", type: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
export function selectionToConfig(
  filters: PeopleClassificationFilters
): PeopleViewConfig {
  return {
    filters: {
      providers: filters.providers,
      types: filters.types,
    },
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS — confirms the `org.workspace.people.views.list` output type resolves (Task 4 mounted it).

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-views-model.ts"
git commit -m "feat(people): add people views model helpers"
```

---

## Task 7: People views query hooks

Mirror `use-signal-views-query.ts`. Both mutations invalidate only `people.views.list` (the people list itself is driven by URL params, not view rows).

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-views-query.ts`

- [ ] **Step 1: Create the hooks**

Create `use-people-views-query.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function usePeopleViewsQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.org.workspace.people.views.list.queryOptions(),
    staleTime: 60_000,
  });
}

export function useCreatePeopleView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.people.views.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.people.views.list.queryKey(),
        }),
    })
  );
}

export function useDeletePeopleView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.org.workspace.people.views.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.org.workspace.people.views.list.queryKey(),
        }),
    })
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-views-query.ts"
git commit -m "feat(people): add people views query hooks"
```

---

## Task 8: People create-view dialog

Mirror `signal-create-view-dialog.tsx`. Name input; snapshots the current selection (passed in as `config`); on success sets `?view` to the new id.

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-create-view-dialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `people-create-view-dialog.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { useState } from "react";
import type { PeopleViewConfig } from "./people-views-model";
import { useCreatePeopleView } from "./use-people-views-query";

export function PeopleCreateViewDialog({
  config,
  onCreated,
  onOpenChange,
  open,
}: {
  config: PeopleViewConfig;
  onCreated: (publicId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const createView = useCreatePeopleView();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || createView.isPending) {
      return;
    }
    createView.mutate(
      { name: trimmed, config },
      {
        onSuccess: (view) => {
          setName("");
          onOpenChange(false);
          onCreated(view.publicId);
        },
      }
    );
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setName("");
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Save the current filters as a personal view.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="View name"
          value={name}
        />
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createView.isPending}
            onClick={submit}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-create-view-dialog.tsx"
git commit -m "feat(people): add people create-view dialog"
```

---

## Task 9: People view switcher (TDD)

Mirror `signals-view-switcher.tsx`: an always-visible pills row (synthetic "All people" first, then saved-view pills with hover-`×`, trailing `+`). Writes `provider` + `type` + `view` atomically through one `useQueryStates` call. Uses the `Users` icon (people's analog of signals' `LayoutGrid`).

**Files:**
- Test: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.test.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.tsx`

- [ ] **Step 1: Write the failing test**

Create `people-view-switcher.test.tsx` (mirror `signals-view-switcher.test.tsx`; note people params have no `parseAsStringLiteral` — all three are `parseAsString`):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeopleViewRow } from "./people-views-model";

// --- URL param state (nuqs, batched via useQueryStates) ---------------------
interface Params {
  provider: string;
  type: string;
  view: string | null;
}

let paramsState: Params;
const setParamsMock = vi.fn();

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  useQueryStates: () => [paramsState, setParamsMock] as const,
}));

// --- views data + mutations -------------------------------------------------
let viewsData: PeopleViewRow[] = [];
const createMutate = vi.fn();
const deleteMutate = vi.fn(
  (_input: { publicId: string }, opts?: { onSuccess?: () => void }) => {
    opts?.onSuccess?.();
  }
);

vi.mock("./use-people-views-query", () => ({
  usePeopleViewsQuery: () => ({ data: viewsData }),
  useCreatePeopleView: () => ({ mutate: createMutate, isPending: false }),
  useDeletePeopleView: () => ({ mutate: deleteMutate }),
}));

// Stub the dialog so we can drive its onCreated callback directly.
let dialogProps: {
  open: boolean;
  onCreated: (publicId: string) => void;
} | null = null;
vi.mock("./people-create-view-dialog", () => ({
  PeopleCreateViewDialog: (props: {
    open: boolean;
    onCreated: (publicId: string) => void;
  }) => {
    dialogProps = props;
    return props.open ? (
      <button onClick={() => props.onCreated("peoview_new")} type="button">
        stub-save
      </button>
    ) : null;
  },
}));

const { PeopleViewSwitcher } = await import("./people-view-switcher");

function makeView(overrides: Partial<PeopleViewRow> = {}): PeopleViewRow {
  return {
    id: 1,
    publicId: "peoview_1",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    name: "X handles",
    config: {
      filters: {
        providers: ["x"],
        types: ["handle"],
      },
    },
    createdAt: new Date("2026-05-31T01:00:00.000Z"),
    updatedAt: new Date("2026-05-31T01:00:00.000Z"),
    ...overrides,
  } as PeopleViewRow;
}

beforeEach(() => {
  paramsState = { provider: "", type: "", view: null };
  viewsData = [];
  dialogProps = null;
  vi.clearAllMocks();
});

describe("PeopleViewSwitcher", () => {
  it('renders the "All people" pill, active when no saved view is set', () => {
    render(<PeopleViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "All people" })
    ).toBeInTheDocument();
  });

  it("renders one always-visible pill per saved view (no dropdown)", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "X handles" })
    ).toBeInTheDocument();
  });

  it("clicking a view pill stamps its params and sets ?view atomically", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "X handles" }));

    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "x",
        type: "handle",
        view: "peoview_1",
      })
    );
  });

  it('clicking "All people" clears the filters and ?view', () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "All people" }));

    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "", type: "", view: null })
    );
  });

  it('"+" opens the dialog and saving sets ?view to the new id', () => {
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(dialogProps?.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "stub-save" }));
    expect(setParamsMock).toHaveBeenCalledWith({ view: "peoview_new" });
  });

  it("deleting the active view removes it and clears ?view", () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Delete X handles" }));

    expect(deleteMutate).toHaveBeenCalledWith(
      { publicId: "peoview_1" },
      expect.anything()
    );
    expect(setParamsMock).toHaveBeenCalledWith({ view: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lightfast/app test people-view-switcher`
Expected: FAIL — cannot resolve `./people-view-switcher` (module does not exist yet).

- [ ] **Step 3: Create the switcher**

Create `people-view-switcher.tsx`:

```tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import { Plus, Users, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { PeopleCreateViewDialog } from "./people-create-view-dialog";
import {
  parsePersonProviders,
  parsePersonTypes,
  peopleSavedViewParser,
  personProviderParser,
  personTypeParser,
} from "./people-search-params";
import {
  ALL_PEOPLE_VIEW_NAME,
  allPeopleParamValues,
  type PeopleViewParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";
import {
  useDeletePeopleView,
  usePeopleViewsQuery,
} from "./use-people-views-query";

/**
 * Views bar — every view is an always-visible pill (no dropdown). "All people"
 * is synthetic (active when `?view` is absent); each saved view is a pill that
 * stamps its filters into the URL when clicked. The trailing `+` saves the
 * current selection as a new view.
 *
 * The bar coordinates with the page entirely through URL params (nuqs): the
 * three params are written in a single `setParams` call so selecting a view is
 * one history entry / one re-render.
 */
export function PeopleViewSwitcher() {
  const [params, setParams] = useQueryStates({
    provider: personProviderParser,
    type: personTypeParser,
    view: peopleSavedViewParser,
  });
  const [isCreateOpen, setCreateOpen] = useState(false);

  const viewsQuery = usePeopleViewsQuery();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];
  const savedViewId = params.view;

  // With many views the row scrolls horizontally; keep the active pill visible.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [savedViewId, views.length]);

  // Cheap pure transform — recompute each render. Snapshots the current
  // selection so `+` can save it as a view.
  const currentConfig = selectionToConfig({
    providers: parsePersonProviders(params.provider),
    types: parsePersonTypes(params.type),
  });

  function applyParams(next: PeopleViewParamValues, viewId: string | null) {
    void setParams({
      provider: next.provider,
      type: next.type,
      view: viewId,
    });
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* Scrollable pill region. The `+` stays pinned outside so it is always
            reachable even when the views overflow. */}
        <div
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
          ref={scrollRef}
        >
          <button
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
              savedViewId
                ? "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                : "border-border/70 bg-muted/60 text-foreground"
            )}
            data-active={!savedViewId}
            onClick={() => applyParams(allPeopleParamValues(), null)}
            type="button"
          >
            <Users
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <span>{ALL_PEOPLE_VIEW_NAME}</span>
          </button>

          {views.map((view) => {
            const isActive = savedViewId === view.publicId;
            return (
              <div
                className={cn(
                  "group inline-flex h-7 shrink-0 items-center rounded-lg border pr-1 pl-2.5 text-sm transition-colors",
                  isActive
                    ? "border-border/70 bg-muted/60 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
                data-active={isActive}
                key={view.publicId}
              >
                <button
                  className="inline-flex items-center gap-1.5"
                  onClick={() =>
                    applyParams(
                      viewConfigToParamValues(view.config),
                      view.publicId
                    )
                  }
                  type="button"
                >
                  <Users
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="max-w-[12rem] truncate">{view.name}</span>
                </button>
                <button
                  aria-label={`Delete ${view.name}`}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  onClick={() =>
                    deleteView.mutate(
                      { publicId: view.publicId },
                      {
                        onSuccess: () => {
                          if (savedViewId === view.publicId) {
                            void setParams({ view: null });
                          }
                        },
                      }
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          aria-label="New view"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <PeopleCreateViewDialog
        config={currentConfig}
        onCreated={(publicId) => void setParams({ view: publicId })}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lightfast/app test people-view-switcher`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.test.tsx"
git commit -m "feat(people): add people view switcher pills"
```

---

## Task 10: Clear `?view` on ad-hoc filter edits

Mirror the signals interaction model: filter params are the source of truth; `?view` is a label + stamp. Editing a **filter** (provider/type) drops the active view. The search query is transient and orthogonal — it does NOT clear the view (per spec: "Search query stays transient").

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`

- [ ] **Step 1: Import the saved-view parser**

Find:

```ts
import {
  parsePersonProviders,
  parsePersonTypes,
  personParser,
  personProviderParser,
  personQueryParser,
  personTypeParser,
  serializePersonValues,
  togglePersonValue,
} from "./people-search-params";
```

Replace with:

```ts
import {
  parsePersonProviders,
  parsePersonTypes,
  peopleSavedViewParser,
  personParser,
  personProviderParser,
  personQueryParser,
  personTypeParser,
  serializePersonValues,
  togglePersonValue,
} from "./people-search-params";
```

- [ ] **Step 2: Add the saved-view setter**

Find:

```ts
  const [typeState, setTypeState] = useQueryState("type", personTypeParser);
  const [selectedPersonId, setSelectedPersonId] = useQueryState(
    "person",
    personParser
  );
```

Replace with:

```ts
  const [typeState, setTypeState] = useQueryState("type", personTypeParser);
  // Editing any filter in the toolbar drops the active saved view — you are now
  // on an ad-hoc selection. The switcher writes `view` + filter params together
  // (see people-view-switcher), so view selection does not pass through here.
  const [, setSavedViewId] = useQueryState("view", peopleSavedViewParser);
  const [selectedPersonId, setSelectedPersonId] = useQueryState(
    "person",
    personParser
  );
```

- [ ] **Step 3: Clear the view in the filter callbacks**

Find:

```tsx
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setTypeState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) =>
          void setProviderState(
            serializePersonValues(togglePersonValue(filters.providers, value))
          )
        }
        onToggleType={(value) =>
          void setTypeState(
            serializePersonValues(togglePersonValue(filters.types, value))
          )
        }
```

Replace with:

```tsx
        onClearFilterGroup={(group) => {
          void setSavedViewId(null);
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setTypeState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) => {
          void setSavedViewId(null);
          void setProviderState(
            serializePersonValues(togglePersonValue(filters.providers, value))
          );
        }}
        onToggleType={(value) => {
          void setSavedViewId(null);
          void setTypeState(
            serializePersonValues(togglePersonValue(filters.types, value))
          );
        }}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx"
git commit -m "feat(people): clear saved view on ad-hoc filter edit"
```

---

## Task 11: People `@actions` slot page

Mirror `@actions/signals/page.tsx`. Prefetch `people.views.list` with `staleTime: 60_000` and render the switcher inside `<HydrateClient>`.

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/people/page.tsx`

- [ ] **Step 1: Create the slot page**

Create `@actions/people/page.tsx`:

```tsx
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleViewSwitcher } from "../../people/_components/people-view-switcher";

// Per-user, org-scoped data — never statically rendered.
export const dynamic = "force-dynamic";

export default function PeopleActionsSlot() {
  // Prefetch into this slot's subtree so the views bar hydrates with data and
  // avoids a client-side fetch waterfall on first paint.
  prefetch({
    ...trpc.org.workspace.people.views.list.queryOptions(),
    staleTime: 60_000,
  });

  return (
    <HydrateClient>
      <PeopleViewSwitcher />
    </HydrateClient>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/people/page.tsx"
git commit -m "feat(people): mount people views switcher in @actions slot"
```

---

## Task 12: Fix the `@actions` slot leak (index + catch-all)

Per the spec (grounded in the official Next.js Parallel Routes docs): `default.tsx` runs **only on hard load/refresh**. On *soft* navigation Next.js retains a slot's last active subpage when the new URL has no matching slot segment — so after visiting `/signals`, soft-navigating to `/automations`, `/settings/*`, or the workspace root leaves the stale switcher visible. The fix is the Next.js-documented Modals pattern: a slot index `page.tsx` (0-segment root) + a `[...catchAll]/page.tsx` (1+ segments), both rendering `null`. Static `signals`/`people` segments out-rank the catch-all (static > dynamic > catch-all). `default.tsx` stays as the hard-load fallback.

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/[...catchAll]/page.tsx`

- [ ] **Step 1: Create the slot index**

Create `@actions/page.tsx`:

```tsx
// Slot index — matches the 0-segment workspace root (/[slug]), which the
// catch-all does not match. Returning null clears the topbar actions region
// when soft-navigating to the workspace root. (The Next.js Modals example pairs
// an @auth/page.tsx with @auth/[...catchAll]/page.tsx for exactly this split.)
export default function WorkspaceActionsIndex() {
  return null;
}
```

- [ ] **Step 2: Create the slot catch-all**

Create `@actions/[...catchAll]/page.tsx`:

```tsx
// Catch-all — matches 1+ trailing segments (/automations, /automations/[id],
// /settings/**, …) that have no dedicated slot. On soft navigation this resolves
// to a real null-rendering match instead of retaining the last switcher.
// `default.tsx` only runs on hard load, so without this the slot would leak.
export default function WorkspaceActionsCatchAll() {
  return null;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/page.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/@actions/[...catchAll]/page.tsx"
git commit -m "fix(workspace): stop @actions slot leaking across routes on soft nav"
```

---

## Task 13: Full quality gates

- [ ] **Step 1: Run all affected package tests**

```bash
pnpm --filter @db/app test
pnpm --filter @api/app test
pnpm --filter @lightfast/app test people-view-switcher
```
Expected: all PASS.

- [ ] **Step 2: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Lint/format**

Run: `pnpm check`
Expected: PASS. If Biome reports export/import ordering in the DB barrels, apply its autofix and re-run, then amend the relevant commit or commit the formatting fix.

---

## Task 14: Manual dev verification (slot leak + interaction model)

These behaviors depend on Next.js parallel-route soft-navigation semantics and a running app — RTL/Vitest cannot reproduce them. Verify in dev. This is the spec's mandated check and the catch-all's reason for existing.

Use the authenticated browser E2E flow (agent-browser via the aggregate URL + Clerk `+clerk_test`/`424242` sign-in; the `lightfast` org has seeded people/signals).

- [ ] **Step 1: Start dev**

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

- [ ] **Step 2: Verify the actions bar appears on both views routes**

Navigate to `/<slug>/signals` — the signals switcher pills render in the topbar left region. Navigate to `/<slug>/people` — the "All people" pill + any saved-view pills render.

- [ ] **Step 3: Verify the slot clears on SOFT navigation (the bug that started this)**

From `/<slug>/signals`, soft-navigate (in-app link clicks, no refresh) to each of:
- `/<slug>/automations`
- `/<slug>/automations/new`
- `/<slug>/settings` (and `/settings/billing`, `/settings/members`, `/settings/api-keys`)
- `/<slug>` (workspace root)

Confirm the topbar actions region is **empty** on each (no stale signals/people switcher). Then refresh each and confirm it stays empty (hard-load `default.tsx` path). Confirm `/signals` and `/people` still render their switchers after the catch-all is in place (static segments out-rank the catch-all).

- [ ] **Step 4: Verify the people views interaction model**

On `/<slug>/people`:
- Apply provider/type filters, click `+`, name + save → a new pill appears and `?view=<id>` is set.
- Click "All people" → filters + `?view` clear.
- Click a saved-view pill → its filters stamp into the URL and `?view` is set (single history entry).
- With a view active, toggle a provider/type filter in the toolbar → `?view` clears (you are now ad-hoc), filters persist.
- Hover a saved-view pill → `×` appears; deleting the active view clears `?view`.
- Confirm scope: a view created here is not visible to a different user/org (personal + org-partitioned).

> If the catch-all proves brittle across the nested `(manage)/settings` layout, the documented client-portal fallback from the signals-views spec applies (a `TopbarSlot` context + portal in the topbar's `actions` prop) — last resort only; the catch-all is the first-class Next.js fix.

- [ ] **Step 5: Stop dev**

```bash
pkill -f "next dev"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (slot index + catch-all + people slot page, keep default.tsx) → Tasks 11–12. Part B data → Tasks 1–3; API → Task 4; frontend model/hooks/dialog/switcher/search-params/client → Tasks 5–10. Testing section (DB, API, switcher, slot regression) → Tasks 2, 4, 9, 14. Decisions table (mirror signals, filters-only JSON config, personal+org scope, synthetic "All people", list/create/delete only, ship together) all reflected.
- **One research/spec disagreement, resolved in favor of the spec:** a codebase scan claimed the catch-all/index pages are unnecessary because `default.tsx` already returns `null`. The spec (citing Next.js soft-vs-hard navigation docs) is authoritative: `default.tsx` only runs on hard load, so soft-nav leaks the stale switcher. The plan implements per spec and empirically confirms in Task 14 Step 3.
- **Type source discipline:** the DB table config types come from `@repo/app-validation/schemas` (matching `people.ts`); the frontend `PeopleViewConfig` is the tRPC-output config type (matching `signals-views-model.ts`). These are structurally identical string-enum arrays, so `selectionToConfig` round-trips cleanly.
- **No `view`-param collision:** `/signals` and `/people` are separate routes, so both can use `?view` independently.
