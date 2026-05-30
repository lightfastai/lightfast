# Signals UI Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Signals filtering/grouping/sorting feel instant by fetching one bounded, projected, unfiltered working set and doing all filter/group/sort in memory, virtualizing both views, and seeding the detail sheet from cache with a body fetched on demand.

**Architecture:** Add a server `workspace.signals.workingSet` query that returns up to 2,000 classified signals from the last 30 days as a **projected** row (no `input`/`rationale`/`nextAction`/error/`updatedAt`), plus `truncated`/`totalCount`. The client fetches that working set once (no filters in the query key) + a small `queued`/`processing` query, filters/groups/sorts entirely client-side via tested pure predicates, virtualizes the list and board, and gates the detail body `get` on an `"input" in item` discriminator with hover-prefetch.

**Tech Stack:** Next.js 16 (RSC + client), tRPC v11 + `@trpc/tanstack-react-query`, `@tanstack/react-query` v5, `@tanstack/react-virtual` v3 (new dep), Drizzle (PlanetScale MySQL), nuqs, Zustand, Vitest + Testing Library.

---

## Current-state context (read before starting)

The branch `feat/refactor-signals-page-ui` has **already done the component split** the spec's prior-art sections describe. These files already exist and work; this plan upgrades their data flow and rendering — it does **not** create them from scratch:

- `signals-client.tsx`, `signals-toolbar.tsx`, `signals-list-view.tsx`, `signals-board-view.tsx`, `signals-empty-state.tsx`, `signals-badge.tsx`, `signals-creator-avatar.tsx`, `signal-detail-sheet.tsx`, `signal-detail-content.tsx`, `signal-create-dialog.tsx`
- `signals-model.ts`, `signals-search-params.ts`, `signals-ui-store.ts`, `use-signals-workspace-data.ts`, `use-classified-signals-query.ts`

**What is NOT yet done (the delta this plan implements):**

1. `useSignalsListQuery` still bakes filters into the tRPC **query key** (`use-classified-signals-query.ts:28-44`) → server-side filtering → the ~1s lag.
2. No `workingSet` query; the classified list is a cursor `useInfiniteQuery` with `LIMIT 50` pagination.
3. No `SignalListItem` projection type, no client filter/group/sort predicates, no `useSignalsFiltering`.
4. No `useDeferredValue`, no truncation banner, no virtualization.
5. Detail sheet/content render the full `SignalRow` directly (no header/body split, no `"input" in item` gate, no hover-prefetch).

**Decisions already locked for this plan (resolved with the user, 2026-05-30):**

- **Projection build:** the `workingSet` SQL `select` includes the whole `classification` JSON column (one clean, typed Drizzle select); `rationale`/`nextAction` are stripped in JS before returning, so the client payload is a true subset and the heavy `input` column is never sent.
- **Constants home:** `WORKSPACE_SIGNALS_WINDOW_DAYS = 30` and `WORKSPACE_SIGNALS_LIMIT = 2000` live in `@repo/api-contract` (`packages/api-contract/src/schemas/signals.ts`), imported by both the db util and the client banner — single source of truth, no drift.
- **`totalCount` is lazy:** computed via a `COUNT(*)` only when the window is truncated; otherwise it equals `items.length` (the common, median-workspace case skips the count entirely).
- **Processing query is single-page** (`list` with `statuses=[queued,processing]`, `limit: 100`, no "Load more"). Both views drop pagination UI; `SignalSection` loses its pagination fields.
- **Filters apply to classified rows only.** Processing rows always pass through (they have no classification) — preserving today's behavior. No UI redesign.
- **Working-set refetch interval = 30s**; processing = 5s. Banner sits below the toolbar, above the views.

---

## File structure

**Server / contract / DB:**
- `packages/api-contract/src/schemas/signals.ts` — **modify**: add `WORKSPACE_SIGNALS_WINDOW_DAYS`, `WORKSPACE_SIGNALS_LIMIT`.
- `packages/api-contract/src/index.ts` — **modify**: re-export the two constants.
- `db/app/src/utils/signals.ts` — **modify**: add `listWorkspaceSignals` (projected, 30d window, cap 2000, `truncated`/`totalCount`), projection helper, count helper, projected-row types.
- `db/app/src/index.ts` — **modify**: re-export `listWorkspaceSignals` + its types.
- `db/app/src/__tests__/signals-list.test.ts` — **modify**: add `listWorkspaceSignals` tests.
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts` — **modify**: add `workingSet` query.

**Client (all under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/`):**
- `_components/signals-model.ts` — **rewrite**: projection types (`WorkspaceSignalRow`, `SignalListItem`, `SignalDetailRow`), client predicates (filter/sort/group, source of truth), `adaptProcessingRow`, slimmed `SignalSection`, display constants, updated helpers.
- `_components/use-classified-signals-query.ts` — **rewrite**: `useWorkingSetQuery()` + `useProcessingSignalsQuery()` (no filters in key; refetch intervals).
- `_components/use-signals-filtering.ts` — **new**: pure in-memory filter→sort→group hook.
- `_components/use-signals-workspace-data.ts` — **rewrite**: orchestrator (raw rows + adapt + filter + sections + `truncated`/`totalCount` + `signalsByPublicId` + invalidation keys).
- `_components/signals-truncation-banner.tsx` — **new**: additive banner.
- `_components/signals-client.tsx` — **rewrite**: `useDeferredValue(filters)`, banner, hover-prefetch handler, feed sections.
- `_components/signals-list-view.tsx` — **rewrite**: single flattened vertical virtualizer + hover-prefetch + `SignalListItem` typing.
- `_components/signals-board-view.tsx` — **rewrite**: per-column vertical virtualizers + hover-prefetch.
- `_components/signals-creator-avatar.tsx` — **modify**: prop type → projection-safe.
- `_components/signal-detail-content.tsx` — **rewrite**: header (from projection) + body (from full row) + body skeleton.
- `_components/signal-detail-sheet.tsx` — **rewrite**: seed header from cache, gate body `get` on `"input" in item`.
- `page.tsx` — **modify**: prefetch `workingSet` + processing (non-infinite).
- `apps/app/package.json` + `pnpm-workspace.yaml` — **modify**: add `@tanstack/react-virtual`.

**Tests:**
- `_components/signals-model.test.ts` — **modify**: add predicate/sort/group/adapter tests.
- `_components/signal-detail-content.test.tsx` — **rewrite**: header-from-item + body-from-detail + skeleton.
- `apps/app/src/__tests__/.../signals-client.test.tsx` — **rewrite**: in-memory filtering, working-set query shape, banner, virtualization mock, hover-prefetch.
- `apps/app/src/__tests__/.../signals-page.test.tsx` — **modify**: prefetch `workingSet` + processing.
- `_components/__tests__` — **new** `use-signals-filtering.test.ts` (hook memoization smoke), virtualization smoke test embedded in the view tests.

---

## Phase 0 — Dependency + shared constants

### Task 0.1: Add `@tanstack/react-virtual` dependency

**Files:**
- Modify: `pnpm-workspace.yaml` (catalog block)
- Modify: `apps/app/package.json` (dependencies)

- [ ] **Step 1: Add to the catalog**

In `pnpm-workspace.yaml`, inside the top-level `catalog:` map (the alphabetical block that contains `@tanstack/react-query`), add the line directly under `@tanstack/react-query`:

```yaml
  '@tanstack/react-query': ^5.99.1
  '@tanstack/react-virtual': ^3.13.12
```

- [ ] **Step 2: Reference it from apps/app**

In `apps/app/package.json`, in `dependencies`, directly under the `@tanstack/react-query` line:

```json
    "@tanstack/react-query": "catalog:",
    "@tanstack/react-virtual": "catalog:",
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: lockfile updates with `@tanstack/react-virtual@3.13.x`; no peer-dependency errors (v3 supports React 19).

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml apps/app/package.json pnpm-lock.yaml
git commit -m "build(app): add @tanstack/react-virtual for signals virtualization"
```

### Task 0.2: Add working-set bound constants to the contract

**Files:**
- Modify: `packages/api-contract/src/schemas/signals.ts`
- Modify: `packages/api-contract/src/index.ts`
- Test: `packages/api-contract/src/__tests__/signals.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/api-contract/src/__tests__/signals.test.ts` (inside the file, add a new `describe`; keep existing imports and add the two constants to the import from `../schemas/signals` or `../index`):

```ts
import {
  WORKSPACE_SIGNALS_LIMIT,
  WORKSPACE_SIGNALS_WINDOW_DAYS,
} from "../schemas/signals";

describe("workspace signals bounds", () => {
  it("exposes the working-set window and cap as named constants", () => {
    expect(WORKSPACE_SIGNALS_WINDOW_DAYS).toBe(30);
    expect(WORKSPACE_SIGNALS_LIMIT).toBe(2000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api-contract && pnpm test signals`
Expected: FAIL — `WORKSPACE_SIGNALS_WINDOW_DAYS`/`WORKSPACE_SIGNALS_LIMIT` are not exported.

- [ ] **Step 3: Add the constants**

In `packages/api-contract/src/schemas/signals.ts`, directly under the existing `SIGNAL_ID_PREFIX` line:

```ts
export const SIGNAL_INPUT_MAX_LENGTH = 4000;
export const SIGNAL_ID_PREFIX = "signal_";

/**
 * Bounds for the in-memory Signals working set. The list view fetches classified
 * signals from the last WORKSPACE_SIGNALS_WINDOW_DAYS days, capped at
 * WORKSPACE_SIGNALS_LIMIT rows, then filters/sorts entirely client-side. When the
 * window exceeds the cap the server reports `truncated: true` and a banner appears.
 * Promote these to a per-workspace retention setting when the Archived view ships.
 */
export const WORKSPACE_SIGNALS_WINDOW_DAYS = 30;
export const WORKSPACE_SIGNALS_LIMIT = 2000;
```

In `packages/api-contract/src/index.ts`, add the two names to the existing `export { ... } from "./schemas/signals";` block (keep it sorted — insert near the other `SIGNAL_*` / `WORKSPACE_*` entries):

```ts
  SIGNAL_ID_PREFIX,
  SIGNAL_INPUT_MAX_LENGTH,
  WORKSPACE_SIGNALS_LIMIT,
  WORKSPACE_SIGNALS_WINDOW_DAYS,
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api-contract && pnpm test signals`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-contract/src/schemas/signals.ts packages/api-contract/src/index.ts packages/api-contract/src/__tests__/signals.test.ts
git commit -m "feat(api-contract): add working-set window/cap constants"
```

---

## Phase 1 — Server: projected working-set query (rollout step 1; additive, nothing removed)

### Task 1.1: `listWorkspaceSignals` DB util

**Files:**
- Modify: `db/app/src/utils/signals.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/signals-list.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `db/app/src/__tests__/signals-list.test.ts`. First extend the top import to include the new function:

```ts
import { createSignal, listSignals, listWorkspaceSignals } from "../utils/signals";
```

Then add this projected-row mock + describe block at the end of the file:

```ts
type ProjectedRow = {
  classification: Signal["classification"];
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: Signal["status"];
};

function makeProjectedRow(overrides: Partial<ProjectedRow> = {}): ProjectedRow {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply with the plan",
      priority: "high",
      rationale: "Customer needs help.",
      summary: "Customer wants migration help.",
      title: "Follow up on migration",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    id: 1,
    publicId: "signal_111e4567-e89b-12d3-a456-426614174000",
    status: "classified",
    ...overrides,
  };
}

function makeWorkspaceDb(rows: ProjectedRow[], totalCount?: number) {
  const spies = { limit: vi.fn(), orderBy: vi.fn(), where: vi.fn() };
  const db = {
    select: (projection: Record<string, unknown>) => {
      const isCount = "value" in projection;
      return {
        from: () => ({
          where: (condition: unknown) => {
            spies.where(condition);
            if (isCount) {
              return Promise.resolve([{ value: totalCount ?? rows.length }]);
            }
            return {
              orderBy: (...order: unknown[]) => {
                spies.orderBy(...order);
                return {
                  limit: (value: number) => {
                    spies.limit(value);
                    return Promise.resolve(rows.slice(0, value));
                  },
                };
              },
            };
          },
        }),
      };
    },
  };
  return { db: db as unknown as Database, spies };
}

describe("listWorkspaceSignals", () => {
  it("projects working-set fields and strips rationale/nextAction", async () => {
    const { db } = makeWorkspaceDb([makeProjectedRow()]);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.truncated).toBe(false);
    expect(result.totalCount).toBe(1);
    const item = result.items[0]!;
    expect(item.classification).toMatchObject({
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "Customer wants migration help.",
      title: "Follow up on migration",
    });
    expect(item.classification).not.toHaveProperty("rationale");
    expect(item.classification).not.toHaveProperty("nextAction");
    expect(item).not.toHaveProperty("input");
  });

  it("requests cap + 1 rows and does not count when within the cap", async () => {
    const { db, spies } = makeWorkspaceDb([makeProjectedRow()]);

    await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(spies.limit).toHaveBeenCalledWith(2001);
    expect(spies.where).toHaveBeenCalledTimes(1); // list only, no count
  });

  it("truncates to the cap and reports totalCount when the window overflows", async () => {
    const overflow = Array.from({ length: 2001 }, (_, index) =>
      makeProjectedRow({ id: index + 1 })
    );
    const { db, spies } = makeWorkspaceDb(overflow, 2500);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.items).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBe(2500);
    expect(spies.where).toHaveBeenCalledTimes(2); // list + count
  });

  it("keeps a null classification null", async () => {
    const { db } = makeWorkspaceDb([makeProjectedRow({ classification: null })]);

    const result = await listWorkspaceSignals(db, { clerkOrgId: "org_test" });

    expect(result.items[0]!.classification).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd db/app && pnpm test signals-list`
Expected: FAIL — `listWorkspaceSignals` is not exported.

- [ ] **Step 3: Implement `listWorkspaceSignals`**

In `db/app/src/utils/signals.ts`, change the top imports:

```ts
import {
  type SignalClassification,
  WORKSPACE_SIGNALS_LIMIT,
  WORKSPACE_SIGNALS_WINDOW_DAYS,
} from "@repo/api-contract";
import { and, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
```

Then add, directly above `export interface CreateSignalRecordInput {` (after `listSignals`):

```ts
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface WorkspaceSignalListItem {
  classification: Omit<SignalClassification, "nextAction" | "rationale"> | null;
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: Signal["status"];
}

export interface WorkspaceSignalsResult {
  items: WorkspaceSignalListItem[];
  totalCount: number;
  truncated: boolean;
}

export interface ListWorkspaceSignalsParams {
  clerkOrgId: string;
}

function projectSignalClassification(
  classification: SignalClassification | null
): WorkspaceSignalListItem["classification"] {
  if (!classification) {
    return null;
  }
  // rationale/nextAction live in the JSON blob but are detail-only; strip them
  // so the working-set row stays a strict subset of the full signal.
  const { nextAction, rationale, ...projected } = classification;
  return projected;
}

async function countClassifiedSince(
  db: Database,
  clerkOrgId: string,
  cutoff: Date
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(signals)
    .where(
      and(
        eq(signals.clerkOrgId, clerkOrgId),
        eq(signals.status, "classified"),
        gte(signals.createdAt, cutoff)
      )
    );
  return Number(row?.value ?? 0);
}

/**
 * Bounded, projected working set for the Signals UI: classified signals from the
 * last WORKSPACE_SIGNALS_WINDOW_DAYS days, newest-first, capped at
 * WORKSPACE_SIGNALS_LIMIT. The client filters/groups/sorts this set entirely in
 * memory. When the window exceeds the cap, `truncated` is true and `totalCount`
 * is the exact window size (computed lazily — the common case skips the count).
 */
export async function listWorkspaceSignals(
  db: Database,
  input: ListWorkspaceSignalsParams
): Promise<WorkspaceSignalsResult> {
  const cutoff = new Date(Date.now() - WORKSPACE_SIGNALS_WINDOW_DAYS * DAY_IN_MS);

  const rows = await db
    .select({
      classification: signals.classification,
      createdAt: signals.createdAt,
      createdByApiKeyId: signals.createdByApiKeyId,
      createdByUserId: signals.createdByUserId,
      id: signals.id,
      publicId: signals.publicId,
      status: signals.status,
    })
    .from(signals)
    .where(
      and(
        eq(signals.clerkOrgId, input.clerkOrgId),
        eq(signals.status, "classified"),
        gte(signals.createdAt, cutoff)
      )
    )
    .orderBy(desc(signals.createdAt), desc(signals.id))
    .limit(WORKSPACE_SIGNALS_LIMIT + 1);

  const truncated = rows.length > WORKSPACE_SIGNALS_LIMIT;
  const visible = truncated ? rows.slice(0, WORKSPACE_SIGNALS_LIMIT) : rows;
  const items: WorkspaceSignalListItem[] = visible.map((row) => ({
    ...row,
    classification: projectSignalClassification(row.classification),
  }));
  const totalCount = truncated
    ? await countClassifiedSince(db, input.clerkOrgId, cutoff)
    : items.length;

  return { items, totalCount, truncated };
}
```

In `db/app/src/index.ts`, extend the `export { ... } from "./utils/signals";` block (keep sorted) to add:

```ts
  type ListWorkspaceSignalsParams,
  listSignals,
  listWorkspaceSignals,
  ...
  type WorkspaceSignalListItem,
  type WorkspaceSignalsResult,
} from "./utils/signals";
```

(Insert `type ListWorkspaceSignalsParams` and `listWorkspaceSignals` alphabetically near `listSignals`; append the two `Workspace*` types after `markSignalFailed`.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd db/app && pnpm test signals-list`
Expected: PASS (all `listWorkspaceSignals` cases + existing `listSignals`/`createSignal`).

- [ ] **Step 5: Commit**

```bash
git add db/app/src/utils/signals.ts db/app/src/index.ts db/app/src/__tests__/signals-list.test.ts
git commit -m "feat(db): add projected listWorkspaceSignals working-set query"
```

### Task 1.2: Wire the `workingSet` tRPC procedure

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`

- [ ] **Step 1: Add the procedure**

Update the import on line 1 to include the new util:

```ts
import { getSignalByPublicId, listSignals, listWorkspaceSignals } from "@db/app";
```

Inside `export const workspaceSignalsRouter = {` add a `workingSet` query directly above `get:`:

```ts
  workingSet: boundOrgProcedure.query(({ ctx }) =>
    listWorkspaceSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
    })
  ),
```

- [ ] **Step 2: Typecheck the api layer (the procedure is thin; types are the contract)**

Run: `pnpm --filter @api/app build`
Expected: PASS — `workspace.signals.workingSet` is now part of `AppRouter`/`AppRouterOutputs`.

- [ ] **Step 3: Run the existing api signal tests (no regressions)**

Run: `cd api/app && pnpm test signal`
Expected: PASS (existing `signal-orpc`, `signal-create-service` tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/workspace-signals.ts"
git commit -m "feat(api): expose workspace.signals.workingSet query"
```

---

## Phase 2 — Client model: projection types + predicates (the tested source of truth)

### Task 2.1: Rewrite `signals-model.ts`

**Files:**
- Rewrite: `_components/signals-model.ts`
- Test: `_components/signals-model.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `_components/signals-model.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  adaptProcessingRow,
  compareSignalsByRecency,
  filterClassifiedSignals,
  formatSignalConfidence,
  getSignalSource,
  getSignalSummary,
  getSignalTitle,
  groupSignalsByKind,
  signalMatchesFilters,
  type SignalClassificationFilters,
  type SignalListItem,
  type SignalRow,
} from "./signals-model";

const NO_FILTERS: SignalClassificationFilters = {
  dispositions: [],
  kinds: [],
  peopleRouted: false,
  priorities: [],
};

function classified(overrides: Partial<SignalListItem> = {}): SignalListItem {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "Summary text",
      title: "Title text",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    id: 1,
    publicId: "signal_1",
    status: "classified",
    ...overrides,
  } as SignalListItem;
}

describe("formatSignalConfidence", () => {
  it("renders a 0..1 confidence as a rounded percentage", () => {
    expect(formatSignalConfidence(0.912)).toBe("91%");
    expect(formatSignalConfidence(0)).toBe("0%");
    expect(formatSignalConfidence(1)).toBe("100%");
  });
});

describe("getSignalSource", () => {
  it("labels API-key vs user creators", () => {
    expect(getSignalSource(classified({ createdByApiKeyId: "key_1" }))).toEqual({
      isApiKey: true,
      label: "API key",
    });
    expect(getSignalSource(classified({ createdByApiKeyId: null }))).toEqual({
      isApiKey: false,
      label: "User",
    });
  });
});

describe("getSignalTitle / getSignalSummary", () => {
  it("prefers the classification, then inputPreview, then identifier", () => {
    expect(getSignalTitle(classified())).toBe("Title text");
    const processing = classified({
      classification: null,
      id: 9,
      inputPreview: "Raw input",
    });
    expect(getSignalTitle(processing)).toBe("Raw input");
    expect(getSignalSummary(processing)).toBe("Raw input");
    const bare = classified({ classification: null, id: 5, inputPreview: undefined });
    expect(getSignalTitle(bare)).toBe("SIG-5");
    expect(getSignalSummary(bare)).toBe("");
  });
});

describe("signalMatchesFilters", () => {
  it("keeps a row when its classification is in every selected set", () => {
    const row = classified();
    expect(signalMatchesFilters(row, NO_FILTERS)).toBe(true);
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, kinds: ["follow_up"] })
    ).toBe(true);
    expect(signalMatchesFilters(row, { ...NO_FILTERS, kinds: ["fix"] })).toBe(
      false
    );
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, priorities: ["high"] })
    ).toBe(true);
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, dispositions: ["not_actionable"] })
    ).toBe(false);
  });

  it("applies peopleRouted via routing.classifyPeople.shouldRun", () => {
    const routed = classified({
      classification: {
        ...classified().classification!,
        routing: { classifyPeople: { shouldRun: true } },
      },
    });
    expect(signalMatchesFilters(routed, { ...NO_FILTERS, peopleRouted: true })).toBe(
      true
    );
    expect(
      signalMatchesFilters(classified(), { ...NO_FILTERS, peopleRouted: true })
    ).toBe(false);
  });

  it("never matches an unclassified row", () => {
    expect(
      signalMatchesFilters(classified({ classification: null }), NO_FILTERS)
    ).toBe(false);
  });
});

describe("filterClassifiedSignals", () => {
  it("filters then sorts newest-first by createdAt then id, without mutating input", () => {
    const older = classified({
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
      id: 1,
      publicId: "signal_old",
    });
    const newerLowId = classified({
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      id: 2,
      publicId: "signal_a",
    });
    const newerHighId = classified({
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      id: 3,
      publicId: "signal_b",
    });
    const input = [older, newerLowId, newerHighId];

    const result = filterClassifiedSignals(input, NO_FILTERS);

    expect(result.map((row) => row.publicId)).toEqual([
      "signal_b",
      "signal_a",
      "signal_old",
    ]);
    expect(input.map((row) => row.publicId)).toEqual([
      "signal_old",
      "signal_a",
      "signal_b",
    ]);
  });
});

describe("groupSignalsByKind", () => {
  it("buckets rows by classification kind, skipping unclassified", () => {
    const grouped = groupSignalsByKind([
      classified({ id: 1, publicId: "a" }),
      classified({
        classification: { ...classified().classification!, kind: "fix" },
        id: 2,
        publicId: "b",
      }),
      classified({ classification: null, id: 3, publicId: "c" }),
    ]);
    expect(grouped.get("follow_up")?.map((r) => r.publicId)).toEqual(["a"]);
    expect(grouped.get("fix")?.map((r) => r.publicId)).toEqual(["b"]);
  });
});

describe("adaptProcessingRow", () => {
  it("maps a full processing row to a SignalListItem with a 200-char preview", () => {
    const full = {
      classification: null,
      createdAt: new Date("2026-05-27T01:00:00.000Z"),
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      errorCode: null,
      errorMessage: null,
      id: 9,
      input: "x".repeat(500),
      publicId: "signal_proc",
      status: "queued",
      updatedAt: new Date("2026-05-27T01:00:00.000Z"),
    } as SignalRow;

    const adapted = adaptProcessingRow(full);

    expect(adapted.classification).toBeNull();
    expect(adapted.inputPreview).toHaveLength(200);
    expect("input" in adapted).toBe(false);
    expect(adapted.publicId).toBe("signal_proc");
  });
});

describe("compareSignalsByRecency", () => {
  it("orders newest createdAt first, breaking ties by higher id", () => {
    const a = classified({ createdAt: new Date(2), id: 1 });
    const b = classified({ createdAt: new Date(1), id: 2 });
    const c = classified({ createdAt: new Date(2), id: 5 });
    expect([b, a, c].sort(compareSignalsByRecency).map((r) => r.id)).toEqual([
      5, 1, 2,
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm test signals-model`
Expected: FAIL — new exports (`adaptProcessingRow`, `compareSignalsByRecency`, `filterClassifiedSignals`, `groupSignalsByKind`, `signalMatchesFilters`, `SignalListItem`) don't exist.

- [ ] **Step 3: Rewrite `signals-model.ts`**

Replace `_components/signals-model.ts` with:

```ts
import type { AppRouterOutputs } from "@api/app";

/** Full row from the cursor `list` query (processing path) — carries body fields. */
export type SignalList =
  AppRouterOutputs["org"]["workspace"]["signals"]["list"];
export type SignalRow = SignalList["items"][number];

/** Projected working-set row (classified, no body). */
export type WorkspaceSignals =
  AppRouterOutputs["org"]["workspace"]["signals"]["workingSet"];
export type WorkspaceSignalRow = WorkspaceSignals["items"][number];

/** Full row from `get` — used for the detail body. */
export type SignalDetailRow =
  AppRouterOutputs["org"]["workspace"]["signals"]["get"];

/**
 * Canonical view-row type for list/board/grouping. It is the projected
 * working-set row plus an optional client-computed `inputPreview` (populated only
 * when adapting a processing row). Classified rows always have
 * `classification.title`, so they leave `inputPreview` undefined.
 */
export type SignalListItem = WorkspaceSignalRow & { inputPreview?: string };

export type SignalStatus = SignalRow["status"];
export type SignalClassification = NonNullable<SignalRow["classification"]>;
export type SignalDisposition = SignalClassification["disposition"];
export type SignalKind = SignalClassification["kind"];
export type SignalPriority = SignalClassification["priority"];

export const SIGNALS_PAGE_SIZE = 50;
export const PROCESSING_SIGNALS_LIMIT = 100;

export const signalViewValues = ["list", "board"] as const;
export type SignalView = (typeof signalViewValues)[number];

export const signalProcessingStatuses = [
  "queued",
  "processing",
] as const satisfies readonly SignalStatus[];

export const signalStatusLabels: Record<SignalStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  classified: "Classified",
  failed: "Failed",
};

export const signalDispositionOptions: {
  label: string;
  value: SignalDisposition;
}[] = [
  { label: "Actionable", value: "actionable" },
  { label: "Needs context", value: "needs_context" },
  { label: "Not actionable", value: "not_actionable" },
];

export const signalKindOptions: {
  label: string;
  value: SignalKind;
}[] = [
  { label: "Engage", value: "engage" },
  { label: "Follow up", value: "follow_up" },
  { label: "Review", value: "review" },
  { label: "Fix", value: "fix" },
  { label: "Investigate", value: "investigate" },
  { label: "Remember", value: "remember" },
  { label: "Other", value: "other" },
];

export const signalPriorityOptions: {
  label: string;
  value: SignalPriority;
}[] = [
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Normal", value: "normal" },
  { label: "Low", value: "low" },
];

export interface SignalClassificationFilters {
  dispositions: SignalDisposition[];
  kinds: SignalKind[];
  peopleRouted: boolean;
  priorities: SignalPriority[];
}

/**
 * A grouped, already-filtered set of view rows for one list section or board
 * column. No pagination fields — the working set is fetched in one shot.
 */
export interface SignalSection {
  id: string;
  isError: boolean;
  isFetching: boolean;
  kind?: SignalKind;
  label: string;
  refetch: () => void;
  rows: SignalListItem[];
}

// ---------------------------------------------------------------------------
// Client filtering / sorting / grouping — the single tested source of truth.
// These mirror the (now dormant) server SQL branches; the server branches have
// no consumer after this refactor, so there is no SQL↔client parity test.
// ---------------------------------------------------------------------------

export function signalMatchesFilters(
  item: SignalListItem,
  filters: SignalClassificationFilters
): boolean {
  const classification = item.classification;
  if (!classification) {
    return false;
  }
  if (filters.kinds.length > 0 && !filters.kinds.includes(classification.kind)) {
    return false;
  }
  if (
    filters.priorities.length > 0 &&
    !filters.priorities.includes(classification.priority)
  ) {
    return false;
  }
  if (
    filters.dispositions.length > 0 &&
    !filters.dispositions.includes(classification.disposition)
  ) {
    return false;
  }
  if (
    filters.peopleRouted &&
    classification.routing?.classifyPeople?.shouldRun !== true
  ) {
    return false;
  }
  return true;
}

/** Newest first: createdAt desc, then id desc (matches `orderBy(desc(createdAt), desc(id))`). */
export function compareSignalsByRecency(
  a: SignalListItem,
  b: SignalListItem
): number {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id - a.id;
}

export function filterClassifiedSignals(
  rows: SignalListItem[],
  filters: SignalClassificationFilters
): SignalListItem[] {
  return rows
    .filter((row) => signalMatchesFilters(row, filters))
    .sort(compareSignalsByRecency);
}

export function groupSignalsByKind(
  rows: SignalListItem[]
): Map<SignalKind, SignalListItem[]> {
  const byKind = new Map<SignalKind, SignalListItem[]>();
  for (const row of rows) {
    const kind = row.classification?.kind;
    if (!kind) {
      continue;
    }
    const bucket = byKind.get(kind);
    if (bucket) {
      bucket.push(row);
    } else {
      byKind.set(kind, [row]);
    }
  }
  return byKind;
}

/**
 * Adapt a full processing row (`queued`/`processing`, from `list`) into the view
 * type: no classification, a 200-char `inputPreview`, and crucially **no `input`
 * field** so `"input" in item` stays false for view-layer rows. The full row is
 * retained separately (in `signalsByPublicId`) for the detail body.
 */
export function adaptProcessingRow(row: SignalRow): SignalListItem {
  return {
    classification: null,
    createdAt: row.createdAt,
    createdByApiKeyId: row.createdByApiKeyId,
    createdByUserId: row.createdByUserId,
    id: row.id,
    inputPreview: row.input.slice(0, 200),
    publicId: row.publicId,
    status: row.status,
  };
}

// ---------------------------------------------------------------------------
// Display helpers (now typed against the projected view row).
// ---------------------------------------------------------------------------

export function getSignalTitle(item: SignalListItem) {
  return (
    item.classification?.title ??
    item.inputPreview ??
    formatSignalIdentifier(item)
  );
}

export function getSignalSummary(item: SignalListItem) {
  return item.classification?.summary ?? item.inputPreview ?? "";
}

export function getSignalKindLabel(kind: SignalKind) {
  return (
    signalKindOptions.find((option) => option.value === kind)?.label ?? kind
  );
}

export function getSignalStatusLabel(status: SignalStatus) {
  return signalStatusLabels[status];
}

export function getSignalPriorityLabel(priority: SignalPriority) {
  return (
    signalPriorityOptions.find((option) => option.value === priority)?.label ??
    priority
  );
}

export function getSignalDispositionLabel(disposition: SignalDisposition) {
  return (
    signalDispositionOptions.find((option) => option.value === disposition)
      ?.label ?? disposition
  );
}

export function formatSignalIdentifier(item: Pick<SignalListItem, "id">) {
  return `SIG-${item.id}`;
}

export function formatSignalConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Absolute creation date for signal rows/cards, e.g. "May 30". The year is
 * appended only when it differs from the current year. Formatted in UTC to keep
 * server and client output identical (no hydration drift).
 */
export function formatSignalDate(value: Date | number | string) {
  const date = new Date(value);
  const isCurrentYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}

export interface SignalSource {
  isApiKey: boolean;
  label: string;
}

export function getSignalSource(
  item: Pick<SignalListItem, "createdByApiKeyId">
): SignalSource {
  if (item.createdByApiKeyId) {
    return { isApiKey: true, label: "API key" };
  }
  return { isApiKey: false, label: "User" };
}
```

> Note: `flattenSignalPages`, `SignalView`-unrelated infinite helpers, and `SIGNALS_PAGE_SIZE` usage drop out of the data hooks in Phase 3. `SIGNALS_PAGE_SIZE` is kept exported (still referenced by `page.tsx` until Task 4.4 removes it). `signalProcessingStatuses` is retained.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm test signals-model`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts"
git commit -m "feat(signals): add projection types and client filter/sort/group predicates"
```

---

## Phase 3 — Client data flow: remove filters from query keys (rollout step 2 — kills the ~1s lag)

### Task 3.1: Rewrite the query hooks

**Files:**
- Rewrite: `_components/use-classified-signals-query.ts`

- [ ] **Step 1: Replace the file**

Replace `_components/use-classified-signals-query.ts` with:

```ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./signals-model";

const WORKING_SET_REFETCH_MS = 30_000;
const PROCESSING_REFETCH_MS = 5_000;

/**
 * Bounded, projected classified working set — fetched once, unfiltered. Filters
 * never enter the query key, so toggling a filter triggers no network request.
 * A fixed 30s interval surfaces newly-classified signals.
 */
export function useWorkingSetQuery() {
  const trpc = useTRPC();
  const options = {
    ...trpc.org.workspace.signals.workingSet.queryOptions(),
    placeholderData: keepPreviousData,
    refetchInterval: WORKING_SET_REFETCH_MS,
    staleTime: WORKING_SET_REFETCH_MS,
  };
  return { query: useQuery(options), queryKey: options.queryKey };
}

/**
 * Small `queued`/`processing` query, single page, polled every 5s. No
 * classification filters (those rows are not classified yet).
 */
export function useProcessingSignalsQuery() {
  const trpc = useTRPC();
  const options = {
    ...trpc.org.workspace.signals.list.queryOptions({
      limit: PROCESSING_SIGNALS_LIMIT,
      statuses: [...signalProcessingStatuses],
    }),
    placeholderData: keepPreviousData,
    refetchInterval: PROCESSING_REFETCH_MS,
    staleTime: PROCESSING_REFETCH_MS,
  };
  return { query: useQuery(options), queryKey: options.queryKey };
}
```

- [ ] **Step 2: Typecheck (no test yet — covered by client tests in Task 3.5)**

Run: `cd apps/app && pnpm with-env next typegen` then `pnpm --filter @lightfast/app typecheck` (or root `pnpm typecheck`).
Expected: This file compiles; downstream `use-signals-workspace-data.ts` will error until Task 3.3 — that is fine, continue.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-classified-signals-query.ts"
git commit -m "feat(signals): replace filter-keyed query with unfiltered workingSet + processing queries"
```

### Task 3.2: New pure filtering hook

**Files:**
- Create: `_components/use-signals-filtering.ts`
- Test: `_components/use-signals-filtering.test.ts`

- [ ] **Step 1: Write the failing test**

Create `_components/use-signals-filtering.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SignalClassificationFilters, SignalListItem } from "./signals-model";
import { useSignalsFiltering } from "./use-signals-filtering";

const NO_FILTERS: SignalClassificationFilters = {
  dispositions: [],
  kinds: [],
  peopleRouted: false,
  priorities: [],
};

function row(overrides: Partial<SignalListItem>): SignalListItem {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "s",
      title: "t",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: null,
    createdByUserId: "user_test",
    id: 1,
    publicId: "p1",
    status: "classified",
    ...overrides,
  } as SignalListItem;
}

describe("useSignalsFiltering", () => {
  it("filters + sorts classified rows and groups them by kind", () => {
    const classifiedRows = [
      row({ id: 1, publicId: "a" }),
      row({
        classification: { ...row({}).classification!, kind: "fix" },
        id: 2,
        publicId: "b",
      }),
    ];
    const processingRows = [
      row({ classification: null, id: 9, inputPreview: "raw", publicId: "proc" }),
    ];

    const { result } = renderHook(() =>
      useSignalsFiltering({
        classifiedRows,
        filters: { ...NO_FILTERS, kinds: ["follow_up"] },
        processingRows,
      })
    );

    expect(result.current.classified.map((r) => r.publicId)).toEqual(["a"]);
    expect(result.current.byKind.get("follow_up")?.length).toBe(1);
    expect(result.current.byKind.get("fix")).toBeUndefined();
    expect(result.current.processing.map((r) => r.publicId)).toEqual(["proc"]);
  });

  it("keeps a stable reference when inputs are unchanged", () => {
    const classifiedRows = [row({ id: 1, publicId: "a" })];
    const processingRows: SignalListItem[] = [];
    const filters = NO_FILTERS;

    const { result, rerender } = renderHook(
      (props: { classifiedRows: SignalListItem[]; filters: SignalClassificationFilters; processingRows: SignalListItem[] }) =>
        useSignalsFiltering(props),
      { initialProps: { classifiedRows, filters, processingRows } }
    );
    const first = result.current.classified;
    rerender({ classifiedRows, filters, processingRows });
    expect(result.current.classified).toBe(first);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm test use-signals-filtering`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `_components/use-signals-filtering.ts`:

```ts
"use client";

import { useMemo } from "react";
import {
  compareSignalsByRecency,
  filterClassifiedSignals,
  groupSignalsByKind,
  type SignalClassificationFilters,
  type SignalKind,
  type SignalListItem,
} from "./signals-model";

/**
 * Pure in-memory transform: filter + sort classified rows, group them by kind,
 * and sort processing rows. Memoized on `(rows, filters)` so a filter toggle
 * recomputes without any network access. Filters apply to classified rows only;
 * processing rows pass through (they are not classified yet).
 */
export function useSignalsFiltering({
  classifiedRows,
  filters,
  processingRows,
}: {
  classifiedRows: SignalListItem[];
  filters: SignalClassificationFilters;
  processingRows: SignalListItem[];
}): {
  byKind: Map<SignalKind, SignalListItem[]>;
  classified: SignalListItem[];
  processing: SignalListItem[];
} {
  const classified = useMemo(
    () => filterClassifiedSignals(classifiedRows, filters),
    [classifiedRows, filters]
  );
  const byKind = useMemo(() => groupSignalsByKind(classified), [classified]);
  const processing = useMemo(
    () => [...processingRows].sort(compareSignalsByRecency),
    [processingRows]
  );
  return { byKind, classified, processing };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm test use-signals-filtering`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-filtering.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-filtering.test.ts"
git commit -m "feat(signals): add pure in-memory filtering hook"
```

### Task 3.3: Rewrite the data orchestrator hook

**Files:**
- Rewrite: `_components/use-signals-workspace-data.ts`

- [ ] **Step 1: Replace the file**

Replace `_components/use-signals-workspace-data.ts` with:

```ts
"use client";

import { useMemo } from "react";
import {
  adaptProcessingRow,
  getSignalKindLabel,
  type SignalClassificationFilters,
  type SignalListItem,
  type SignalRow,
  type SignalSection,
  signalKindOptions,
} from "./signals-model";
import { useSignalsFiltering } from "./use-signals-filtering";
import {
  useProcessingSignalsQuery,
  useWorkingSetQuery,
} from "./use-classified-signals-query";

export function useSignalsWorkspaceData({
  filters,
}: {
  filters: SignalClassificationFilters;
}) {
  const { query: workingSetQuery, queryKey: workingSetQueryKey } =
    useWorkingSetQuery();
  const { query: processingQuery, queryKey: processingQueryKey } =
    useProcessingSignalsQuery();

  const classifiedRows = useMemo<SignalListItem[]>(
    () => workingSetQuery.data?.items ?? [],
    [workingSetQuery.data]
  );
  const processingFullRows = useMemo<SignalRow[]>(
    () => processingQuery.data?.items ?? [],
    [processingQuery.data]
  );
  const processingRows = useMemo<SignalListItem[]>(
    () => processingFullRows.map(adaptProcessingRow),
    [processingFullRows]
  );

  const { byKind, classified, processing } = useSignalsFiltering({
    classifiedRows,
    filters,
    processingRows,
  });

  const visibleListSections = useMemo<SignalSection[]>(
    () => [
      {
        id: "classified",
        isError: workingSetQuery.isError,
        isFetching: workingSetQuery.isFetching,
        label: "Classified",
        refetch: () => void workingSetQuery.refetch(),
        rows: classified,
      },
      {
        id: "processing",
        isError: processingQuery.isError,
        isFetching: processingQuery.isFetching,
        label: "Processing",
        refetch: () => void processingQuery.refetch(),
        rows: processing,
      },
    ],
    [classified, processing, workingSetQuery, processingQuery]
  );

  const boardSections = useMemo<SignalSection[]>(
    () => [
      {
        id: "processing",
        isError: processingQuery.isError,
        isFetching: processingQuery.isFetching,
        label: "Processing",
        refetch: () => void processingQuery.refetch(),
        rows: processing,
      },
      ...signalKindOptions.map((option) => ({
        id: option.value,
        isError: workingSetQuery.isError,
        isFetching: workingSetQuery.isFetching,
        kind: option.value,
        label: getSignalKindLabel(option.value),
        refetch: () => void workingSetQuery.refetch(),
        rows: byKind.get(option.value) ?? [],
      })),
    ],
    [byKind, processing, processingQuery, workingSetQuery]
  );

  // Classified rows (projection, no body) seed the detail header; processing
  // rows are retained full (they carry `input`) so their detail needs no `get`.
  const signalsByPublicId = useMemo(() => {
    const map = new Map<string, SignalListItem | SignalRow>();
    for (const row of classifiedRows) {
      map.set(row.publicId, row);
    }
    for (const row of processingFullRows) {
      map.set(row.publicId, row);
    }
    return map;
  }, [classifiedRows, processingFullRows]);

  return {
    boardSections,
    hasAnyRows: classifiedRows.length + processingRows.length > 0,
    processingQueryKey,
    signalsByPublicId,
    totalCount: workingSetQuery.data?.totalCount ?? classifiedRows.length,
    truncated: workingSetQuery.data?.truncated ?? false,
    visibleListSections,
    workingSetQueryKey,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && pnpm --filter @lightfast/app typecheck` (downstream `signals-client.tsx` / views may still error until Phase 3.4 + Phase 5 — acceptable, continue).
Expected: this file compiles.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts"
git commit -m "feat(signals): orchestrate workingSet + processing into in-memory sections"
```

### Task 3.4: Truncation banner

**Files:**
- Create: `_components/signals-truncation-banner.tsx`

- [ ] **Step 1: Create the component**

Create `_components/signals-truncation-banner.tsx`:

```tsx
import {
  WORKSPACE_SIGNALS_LIMIT,
  WORKSPACE_SIGNALS_WINDOW_DAYS,
} from "@repo/api-contract";

/**
 * Additive banner shown only when the working set is clipped by the cap. Makes
 * the in-memory filtering honest: filters are complete within the window, and
 * any clipping is visible. Silent truncation is forbidden.
 */
export function SignalsTruncationBanner({ truncated }: { truncated: boolean }) {
  if (!truncated) {
    return null;
  }
  return (
    <div
      className="mx-3 mb-2 rounded-lg border border-border/70 bg-muted/25 px-4 py-2 text-muted-foreground text-sm"
      data-testid="signals-truncation-banner"
      role="status"
    >
      Showing the {WORKSPACE_SIGNALS_LIMIT.toLocaleString()} most recent of the
      last {WORKSPACE_SIGNALS_WINDOW_DAYS} days — filters apply to this window.
    </div>
  );
}
```

- [ ] **Step 2: Commit (rendered + tested in Task 3.5)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-truncation-banner.tsx"
git commit -m "feat(signals): add working-set truncation banner"
```

### Task 3.5: Rewrite `signals-client.tsx` (deferred filters, banner, hover-prefetch)

**Files:**
- Rewrite: `_components/signals-client.tsx`

- [ ] **Step 1: Replace the file**

Replace `_components/signals-client.tsx` with:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useWorkspaceCommands } from "~/components/workspace-command-menu";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsBoardView } from "./signals-board-view";
import { SignalsListView } from "./signals-list-view";
import type { SignalClassificationFilters } from "./signals-model";
import {
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  serializeSignalValues,
  signalDispositionParser,
  signalKindParser,
  signalParser,
  signalPeopleParser,
  signalPriorityParser,
  signalViewParser,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { openCreateSignal } = useWorkspaceCommands();
  const [dispositionState, setDispositionState] = useQueryState(
    "disposition",
    signalDispositionParser
  );
  const [kindState, setKindState] = useQueryState("kind", signalKindParser);
  const [peopleState, setPeopleState] = useQueryState(
    "people",
    signalPeopleParser
  );
  const [priorityState, setPriorityState] = useQueryState(
    "priority",
    signalPriorityParser
  );
  const [view, setView] = useQueryState("view", signalViewParser);
  const [selectedSignalId, setSelectedSignalId] = useQueryState(
    "signal",
    signalParser
  );

  const collapsedGroups = useSignalsUiStore(
    (state) => state.collapsedListGroups
  );
  const toggleListGroup = useSignalsUiStore((state) => state.toggleListGroup);

  const filters = useMemo<SignalClassificationFilters>(
    () => ({
      dispositions: parseSignalDispositions(dispositionState),
      kinds: parseSignalKinds(kindState),
      peopleRouted: peopleState === "routed",
      priorities: parseSignalPriorities(priorityState),
    }),
    [dispositionState, kindState, peopleState, priorityState]
  );
  const hasActiveFilters =
    filters.dispositions.length > 0 ||
    filters.kinds.length > 0 ||
    filters.peopleRouted ||
    filters.priorities.length > 0;

  // The toolbar reflects `filters` immediately; the (cheap) list work runs on the
  // deferred value so a rapid toggle never drops a frame. With virtualized views
  // the in-memory work is trivial — this is the single hedge for the tail case.
  const deferredFilters = useDeferredValue(filters);

  const {
    boardSections,
    hasAnyRows,
    signalsByPublicId,
    truncated,
    visibleListSections,
  } = useSignalsWorkspaceData({ filters: deferredFilters });

  const prefetchSignal = useCallback(
    (publicId: string) => {
      const cached = signalsByPublicId.get(publicId);
      if (cached && "input" in cached) {
        return; // processing/full rows already carry the body
      }
      void queryClient.prefetchQuery(
        trpc.org.workspace.signals.get.queryOptions({ publicId })
      );
    },
    [queryClient, signalsByPublicId, trpc]
  );

  const emptyCreateAction = (
    <Button
      className="h-8 rounded-full px-3"
      onClick={openCreateSignal}
      size="sm"
      type="button"
      variant="outline"
    >
      <Plus aria-hidden="true" className="size-3.5" />
      Add
    </Button>
  );

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Signals</h1>
      <SignalsToolbar
        filters={filters}
        onAddSignal={openCreateSignal}
        onClearFilterGroup={(group) => {
          if (group === "disposition") {
            void setDispositionState("");
          } else if (group === "kind") {
            void setKindState("");
          } else if (group === "people") {
            void setPeopleState("all");
          } else {
            void setPriorityState("");
          }
        }}
        onPeopleRoutedChange={(value) =>
          void setPeopleState(value ? "routed" : "all")
        }
        onToggleDisposition={(value) =>
          void setDispositionState(
            serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            )
          )
        }
        onToggleKind={(value) =>
          void setKindState(
            serializeSignalValues(toggleSignalValue(filters.kinds, value))
          )
        }
        onTogglePriority={(value) =>
          void setPriorityState(
            serializeSignalValues(toggleSignalValue(filters.priorities, value))
          )
        }
        onViewChange={(value) => void setView(value)}
        view={view}
      />

      <SignalsTruncationBanner truncated={truncated} />

      {view === "board" ? (
        <SignalsBoardView
          emptyAction={emptyCreateAction}
          hasActiveSearch={hasActiveFilters}
          hasAnyRows={hasAnyRows}
          onPrefetchSignal={prefetchSignal}
          onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
          sections={boardSections}
          selectedSignalId={selectedSignalId}
        />
      ) : (
        <SignalsListView
          collapsedGroups={collapsedGroups}
          emptyAction={emptyCreateAction}
          hasActiveSearch={hasActiveFilters}
          hasAnyRows={hasAnyRows}
          onPrefetchSignal={prefetchSignal}
          onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
          onToggleGroup={toggleListGroup}
          sections={visibleListSections}
          selectedSignalId={selectedSignalId}
        />
      )}

      <SignalDetailSheet
        initialItem={
          selectedSignalId
            ? signalsByPublicId.get(selectedSignalId)
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedSignalId(null);
          }
        }}
        publicId={selectedSignalId}
      />
    </WorkspaceSurface>
  );
}
```

> The views gain a required `onPrefetchSignal` prop and the sheet's `initialSignal` becomes `initialItem` — both are implemented in Phases 5 and 6. Typecheck/tests for this file pass only after those phases; the client test in Task 3.6 mocks the views/sheet so it can run independently.

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx"
git commit -m "feat(signals): defer filters, render truncation banner, prefetch detail on hover"
```

### Task 3.6: Update create-dialog invalidation

**Files:**
- Modify: `_components/signal-create-dialog.tsx`

- [ ] **Step 1: Invalidate both stable keys**

In `signal-create-dialog.tsx`, replace the single invalidate inside `onSuccess` (currently `void queryClient.invalidateQueries(trpc.org.workspace.signals.list.queryFilter());`) with:

```ts
        removeSignalDraft(draftStorageKey);
        void queryClient.invalidateQueries(
          trpc.org.workspace.signals.workingSet.queryFilter()
        );
        void queryClient.invalidateQueries(
          trpc.org.workspace.signals.list.queryFilter()
        );
```

- [ ] **Step 2: Run the create-dialog test (still green)**

Run: `cd apps/app && pnpm test signal-create-dialog`
Expected: PASS. If the existing test asserts the exact invalidate call count, update it to expect two `invalidateQueries` calls (one `workingSet`, one `list`). (Open the test; adjust the assertion to `expect(invalidateQueriesMock).toHaveBeenCalledTimes(2)` and assert both query filters were used.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx"
git commit -m "fix(signals): invalidate workingSet + processing keys on create"
```

### Task 3.7: Update `page.tsx` prefetch

**Files:**
- Modify: `signals/page.tsx`
- Test: `apps/app/src/__tests__/.../signals-page.test.tsx`

- [ ] **Step 1: Update the failing test first**

Replace the body of the `it("prefetches ...")` test in `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`. The mock currently only exposes `signals.list.infiniteQueryOptions`; add `workingSet.queryOptions` and `list.queryOptions`. Replace the `vi.mock("~/trpc/server", ...)` trpc block and the test:

```ts
const workingSetQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
  queryKey: ["org", "workspace", "signals", "workingSet"],
}));
const listQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
  queryKey: ["org", "workspace", "signals", "list", input],
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
          list: { queryOptions: listQueryOptionsMock },
          workingSet: { queryOptions: workingSetQueryOptionsMock },
        },
      },
    },
  },
}));
```

Update `beforeEach` to clear the new mocks and replace the assertion test:

```ts
beforeEach(() => {
  workingSetQueryOptionsMock.mockClear();
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("signals page", () => {
  it("prefetches the working set and the processing list", async () => {
    const element = await SignalsPage();
    render(element);

    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
    expect(listQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 100, statuses: ["queued", "processing"] },
      expect.objectContaining({ staleTime: 5_000 })
    );
    expect(prefetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("hydrated-signals")).toHaveTextContent(
      "Signals client"
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm test signals-page`
Expected: FAIL — `page.tsx` still prefetches the classified infinite list.

- [ ] **Step 3: Update `page.tsx`**

Replace `signals/page.tsx` with:

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SignalsClient } from "./_components/signals-client";
import { SignalsLoading } from "./_components/signals-loading";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./_components/signals-model";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  prefetch({
    ...trpc.org.workspace.signals.workingSet.queryOptions(),
    staleTime: 30_000,
  });
  prefetch(
    trpc.org.workspace.signals.list.queryOptions(
      {
        limit: PROCESSING_SIGNALS_LIMIT,
        statuses: [...signalProcessingStatuses],
      },
      {
        staleTime: 5_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<SignalsLoading />}>
        <SignalsClient />
      </Suspense>
    </HydrateClient>
  );
}
```

> `prefetch` routes non-infinite `queryOptions` to `prefetchQuery` (it only uses `prefetchInfiniteQuery` when `queryKey[1].type === "infinite"`), so both calls hydrate correctly. `SIGNALS_PAGE_SIZE` is no longer imported here.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm test signals-page`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
git commit -m "feat(signals): prefetch workingSet + processing instead of filtered infinite lists"
```

---

## Phase 4 — Virtualize the views (rollout step 4)

### Task 4.1: Projection-safe `SignalCreatorAvatar`

**Files:**
- Modify: `_components/signals-creator-avatar.tsx`

- [ ] **Step 1: Narrow the prop type**

In `signals-creator-avatar.tsx`, change the import and signature so it accepts a projected row. Replace:

```ts
import type { SignalRow } from "./signals-model";
```

with:

```ts
import type { SignalListItem } from "./signals-model";
```

and change the function signature from `{ signal }: { signal: SignalRow }` to:

```ts
export function SignalCreatorAvatar({
  signal,
}: {
  signal: Pick<SignalListItem, "createdByApiKeyId" | "createdByUserId">;
}) {
```

(The body already only reads `signal.createdByApiKeyId` and `signal.createdByUserId`.)

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-creator-avatar.tsx"
git commit -m "refactor(signals): type creator avatar against projected row"
```

### Task 4.2: Virtualize the list view

**Files:**
- Rewrite: `_components/signals-list-view.tsx`

- [ ] **Step 1: Replace the file**

Replace `_components/signals-list-view.tsx` with a single flattened vertical virtualizer over headers + rows (collapse drops a section's rows; error/empty render as their own entry). Drop the "Load more" block (no pagination):

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import { SignalBadge } from "./signals-badge";
import { SignalCreatorAvatar } from "./signals-creator-avatar";
import { SignalsEmptyState } from "./signals-empty-state";
import {
  formatSignalDate,
  formatSignalIdentifier,
  getSignalKindLabel,
  getSignalPriorityLabel,
  getSignalStatusLabel,
  getSignalSummary,
  getSignalTitle,
  type SignalListItem,
  type SignalSection,
} from "./signals-model";

type ListEntry =
  | { key: string; section: SignalSection; type: "header" }
  | { key: string; section: SignalSection; type: "error" }
  | { key: string; section: SignalSection; type: "empty" }
  | { key: string; section: SignalSection; signal: SignalListItem; type: "row" };

const HEADER_SIZE = 44;
const ROW_SIZE = 44;
const STATUS_SIZE = 140;

export function SignalsListView({
  collapsedGroups,
  emptyAction,
  hasActiveSearch,
  hasAnyRows,
  onPrefetchSignal,
  onSelectSignal,
  onToggleGroup,
  sections,
  selectedSignalId,
}: {
  collapsedGroups: Record<string, boolean>;
  emptyAction: ReactNode;
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  onToggleGroup: (groupId: string) => void;
  sections: SignalSection[];
  selectedSignalId: string | null;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<ListEntry[]>(() => {
    const list: ListEntry[] = [];
    for (const section of sections) {
      list.push({ key: `${section.id}:header`, section, type: "header" });
      if (collapsedGroups[section.id]) {
        continue;
      }
      if (section.isError) {
        list.push({ key: `${section.id}:error`, section, type: "error" });
        continue;
      }
      if (section.rows.length === 0) {
        list.push({ key: `${section.id}:empty`, section, type: "empty" });
        continue;
      }
      for (const signal of section.rows) {
        list.push({ key: signal.publicId, section, signal, type: "row" });
      }
    }
    return list;
  }, [collapsedGroups, sections]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    estimateSize: (index) => {
      const entry = entries[index];
      if (!entry || entry.type === "header") {
        return HEADER_SIZE;
      }
      if (entry.type === "row") {
        return ROW_SIZE;
      }
      return STATUS_SIZE;
    },
    getItemKey: (index) => entries[index]?.key ?? index,
    getScrollElement: () => parentRef.current,
    overscan: 12,
  });

  if (!(hasAnyRows || hasActiveSearch)) {
    return (
      <SignalsEmptyState
        action={emptyAction}
        description="Classified signals created by API keys and automations will appear here."
        title="No classified signals yet"
      />
    );
  }

  if (!hasAnyRows && hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Try a different search or classification filter."
        title="No matching signals"
      />
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      data-testid="signals-list-scroll"
      ref={parentRef}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const entry = entries[virtualItem.index];
          if (!entry) {
            return null;
          }
          return (
            <div
              className="absolute top-0 left-0 w-full"
              data-index={virtualItem.index}
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {entry.type === "header" ? (
                <SignalListSectionHeader
                  collapsed={!!collapsedGroups[entry.section.id]}
                  onToggleGroup={onToggleGroup}
                  section={entry.section}
                />
              ) : entry.type === "error" ? (
                <div className="flex h-14 items-center justify-between rounded-md px-4">
                  <span className="text-muted-foreground text-sm">
                    Could not load {entry.section.label.toLowerCase()} signals.
                  </span>
                  <Button
                    aria-label={`Retry ${entry.section.label.toLowerCase()} signals`}
                    onClick={entry.section.refetch}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="size-3.5"
                      data-testid="signals-list-section-retry-icon"
                    />
                    Retry
                  </Button>
                </div>
              ) : entry.type === "empty" ? (
                <SignalsEmptyState
                  description={`No ${entry.section.label.toLowerCase()} signals match this view.`}
                  size="section"
                  title={`No ${entry.section.label.toLowerCase()} signals`}
                />
              ) : (
                <div className="pt-1">
                  <SignalListRow
                    isSelected={selectedSignalId === entry.signal.publicId}
                    onPrefetch={() => onPrefetchSignal(entry.signal.publicId)}
                    onSelect={() => onSelectSignal(entry.signal.publicId)}
                    signal={entry.signal}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalListSectionHeader({
  collapsed,
  onToggleGroup,
  section,
}: {
  collapsed: boolean;
  onToggleGroup: (groupId: string) => void;
  section: SignalSection;
}) {
  return (
    <div
      aria-label={`${section.label} signals`}
      className="flex h-9 items-center overflow-hidden rounded-lg border border-border/60 bg-muted/25"
      role="group"
    >
      <button
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${section.label} signals`}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-4 text-left hover:bg-muted/35"
        onClick={() => onToggleGroup(section.id)}
        type="button"
      >
        {collapsed ? (
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
            data-testid="signals-list-section-toggle-icon"
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
            data-testid="signals-list-section-toggle-icon"
          />
        )}
        <span className="font-medium text-foreground text-sm">
          {section.label}
        </span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        {section.isFetching ? (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground/70 text-xs">
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </button>
    </div>
  );
}

function SignalListRow({
  isSelected,
  onPrefetch,
  onSelect,
  signal,
}: {
  isSelected: boolean;
  onPrefetch: () => void;
  onSelect: () => void;
  signal: SignalListItem;
}) {
  const title = getSignalTitle(signal);
  const summary = getSignalSummary(signal);
  const createdAtIso = new Date(signal.createdAt).toISOString();
  const kind = signal.classification?.kind;
  const priority = signal.classification?.priority;
  const statusLabel = getSignalStatusLabel(signal.status);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "group grid min-h-10 w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-4 text-left hover:bg-muted/30" +
        (isSelected ? " bg-muted/35" : " bg-background")
      }
      onClick={onSelect}
      onFocus={onPrefetch}
      onMouseEnter={onPrefetch}
      type="button"
    >
      <span className="truncate font-mono text-muted-foreground text-sm">
        {formatSignalIdentifier(signal)}
      </span>
      <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
        <span className="min-w-0 truncate font-medium text-foreground text-sm">
          {title}
        </span>
        {summary === title ? null : (
          <span className="hidden min-w-0 flex-1 truncate text-muted-foreground text-sm md:block">
            {summary}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-muted-foreground text-sm">
        {priority ? (
          <SignalBadge className="hidden md:inline-flex">
            {getSignalPriorityLabel(priority)}
          </SignalBadge>
        ) : null}
        <SignalBadge>{kind ? getSignalKindLabel(kind) : statusLabel}</SignalBadge>
        <time
          className="w-20 shrink-0 text-right"
          dateTime={createdAtIso}
          title={createdAtIso}
        >
          {formatSignalDate(signal.createdAt)}
        </time>
        <SignalCreatorAvatar signal={signal} />
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Commit (view tests run in Task 4.4)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.tsx"
git commit -m "feat(signals): virtualize the list view"
```

### Task 4.3: Virtualize the board view (per-column)

**Files:**
- Rewrite: `_components/signals-board-view.tsx`

- [ ] **Step 1: Replace the file**

Replace `_components/signals-board-view.tsx` with per-column vertical virtualizers:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { SignalBadge } from "./signals-badge";
import { SignalCreatorAvatar } from "./signals-creator-avatar";
import { SignalsEmptyState } from "./signals-empty-state";
import {
  formatSignalDate,
  formatSignalIdentifier,
  getSignalKindLabel,
  getSignalPriorityLabel,
  getSignalStatusLabel,
  getSignalSummary,
  getSignalTitle,
  type SignalListItem,
  type SignalSection,
} from "./signals-model";

const CARD_SIZE = 120;

export function SignalsBoardView({
  emptyAction,
  hasActiveSearch,
  hasAnyRows,
  onPrefetchSignal,
  onSelectSignal,
  sections,
  selectedSignalId,
}: {
  emptyAction: ReactNode;
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  sections: SignalSection[];
  selectedSignalId: string | null;
}) {
  if (!(hasAnyRows || hasActiveSearch)) {
    return (
      <SignalsEmptyState
        action={emptyAction}
        description="Classified signals created by API keys and automations will appear here."
        title="No classified signals yet"
      />
    );
  }

  if (!hasAnyRows && hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Try a different search or classification filter."
        title="No matching signals"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto px-3 pb-3">
      <div className="flex min-h-full w-max gap-3">
        {sections.map((section) => (
          <SignalBoardColumn
            key={section.id}
            onPrefetchSignal={onPrefetchSignal}
            onSelectSignal={onSelectSignal}
            section={section}
            selectedSignalId={selectedSignalId}
          />
        ))}
      </div>
    </div>
  );
}

function SignalBoardColumn({
  onPrefetchSignal,
  onSelectSignal,
  section,
  selectedSignalId,
}: {
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  section: SignalSection;
  selectedSignalId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: section.rows.length,
    estimateSize: () => CARD_SIZE,
    getItemKey: (index) => section.rows[index]?.publicId ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 8,
  });

  return (
    <section
      aria-label={`${section.label} board column`}
      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
    >
      <div className="flex h-9 items-center gap-2 border-border/70 border-b bg-muted/20 px-3">
        <span className="font-medium text-sm">{section.label}</span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {section.isFetching ? (
            <span className="flex items-center gap-1 text-muted-foreground/70 text-xs">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              Refreshing
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-2"
        data-testid={`signals-board-scroll-${section.id}`}
        ref={scrollRef}
      >
        {section.isError ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-muted-foreground text-sm">
              Could not load classified signals.
            </p>
            <Button
              aria-label="Retry classified signals"
              className="mt-3"
              onClick={section.refetch}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : section.rows.length === 0 ? (
          <SignalsEmptyState
            description={`No ${section.label.toLowerCase()} signals match this view.`}
            size="column"
            title={`No ${section.label.toLowerCase()} signals`}
          />
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const signal = section.rows[virtualItem.index];
              if (!signal) {
                return null;
              }
              return (
                <div
                  className="absolute top-0 left-0 w-full pb-2"
                  data-index={virtualItem.index}
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <SignalBoardCard
                    isSelected={selectedSignalId === signal.publicId}
                    onPrefetch={() => onPrefetchSignal(signal.publicId)}
                    onSelect={() => onSelectSignal(signal.publicId)}
                    signal={signal}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SignalBoardCard({
  isSelected,
  onPrefetch,
  onSelect,
  signal,
}: {
  isSelected: boolean;
  onPrefetch: () => void;
  onSelect: () => void;
  signal: SignalListItem;
}) {
  const title = getSignalTitle(signal);
  const summary = getSignalSummary(signal);
  const createdAtIso = new Date(signal.createdAt).toISOString();
  const priority = signal.classification?.priority;
  const statusLabel = getSignalStatusLabel(signal.status);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "w-full rounded-md border border-border/70 bg-background p-3 text-left hover:bg-muted/30" +
        (isSelected ? " bg-muted/35" : "")
      }
      onClick={onSelect}
      onFocus={onPrefetch}
      onMouseEnter={onPrefetch}
      type="button"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(signal)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <time
            className="text-muted-foreground text-xs"
            dateTime={createdAtIso}
            title={createdAtIso}
          >
            {formatSignalDate(signal.createdAt)}
          </time>
          <SignalCreatorAvatar signal={signal} />
        </div>
      </div>
      <p className="line-clamp-2 font-medium text-foreground text-sm">{title}</p>
      {summary === title ? null : (
        <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
          {summary}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SignalBadge>
          {signal.classification?.kind
            ? getSignalKindLabel(signal.classification.kind)
            : statusLabel}
        </SignalBadge>
        {priority ? (
          <SignalBadge>{getSignalPriorityLabel(priority)}</SignalBadge>
        ) : null}
        {typeof signal.classification?.confidence === "number" ? (
          <span className="text-muted-foreground text-xs">
            {Math.round(signal.classification.confidence * 100)}%
          </span>
        ) : null}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-board-view.tsx"
git commit -m "feat(signals): virtualize each board column independently"
```

### Task 4.4: Rewrite the client test (in-memory filtering, virtualization mock, hover-prefetch)

**Files:**
- Rewrite: `apps/app/src/__tests__/.../signals-client.test.tsx`

This test must change substantially because (a) the classified query is now `workingSet` (`useQuery`, not `useInfiniteQuery`), (b) processing is single-page `useQuery`, (c) filtering is in-memory, (d) views are virtualized (mock `@tanstack/react-virtual` to render all entries so row assertions still work), (e) `useQueryClient` exposes `prefetchQuery`.

- [ ] **Step 1: Replace the test file**

Replace `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "signals", "get", input],
}));
const listQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "signals", "list", input],
}));
const workingSetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "signals", "workingSet"],
}));
const orgMembersQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgMembers", "list"],
}));
const prefetchQueryMock = vi.fn();
const useQueryMock = vi.fn();

let dispositionState = "";
let kindState = "";
let peopleState = "all";
let priorityState = "";
let viewState = "list";
let signalState: string | null = null;

const setDispositionMock = vi.fn((value: string) => {
  dispositionState = value;
});
const setKindMock = vi.fn((value: string) => {
  kindState = value;
});
const setPeopleMock = vi.fn((value: string) => {
  peopleState = value;
});
const setPriorityMock = vi.fn((value: string) => {
  priorityState = value;
});
const setViewMock = vi.fn((value: string) => {
  viewState = value;
});
const setSignalMock = vi.fn((value: string | null) => {
  signalState = value;
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgMembers: { list: { queryOptions: orgMembersQueryOptionsMock } },
      },
      workspace: {
        signals: {
          get: { queryOptions: getQueryOptionsMock },
          list: { queryOptions: listQueryOptionsMock },
          workingSet: { queryOptions: workingSetQueryOptionsMock },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: (options: { queryKey: unknown[] }) => useQueryMock(options),
  useQueryClient: () => ({ prefetchQuery: prefetchQueryMock }),
}));

// Render every virtual item so row-presence assertions work in jsdom.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 44,
      })),
    measureElement: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/signals",
}));

const openCreateSignalMock = vi.fn();

vi.mock("~/components/workspace-command-menu", () => ({
  useWorkspaceCommands: () => ({ openCreateSignal: openCreateSignalMock }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-string-parser" },
  parseAsStringLiteral: () => ({ withDefault: () => "mock-literal-parser" }),
  useQueryState: (key: string) => {
    if (key === "disposition") return [dispositionState, setDispositionMock];
    if (key === "kind") return [kindState, setKindMock];
    if (key === "people") return [peopleState, setPeopleMock];
    if (key === "priority") return [priorityState, setPriorityMock];
    if (key === "view") return [viewState, setViewMock];
    return [signalState, setSignalMock];
  },
}));

const baseClassification = {
  schemaVersion: "signal.classification.v1",
  confidence: 0.91,
  disposition: "actionable",
  rationale: "n/a",
  summary: "Summary text",
};

const followUpSignal = {
  classification: {
    ...baseClassification,
    kind: "follow_up",
    priority: "high",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_follow_up",
  status: "classified",
};

const fixSignal = {
  classification: {
    ...baseClassification,
    kind: "fix",
    priority: "urgent",
    title: "Fix stale key fingerprint",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 8,
  publicId: "signal_fix",
  status: "classified",
};

const queuedSignal = {
  classification: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 9,
  input: "Customer asked for rollout timing",
  publicId: "signal_queued",
  status: "queued",
  updatedAt: new Date("2026-05-27T01:00:00.000Z"),
};

let workingSetData: {
  items: unknown[];
  totalCount: number;
  truncated: boolean;
};
let workingSetError = false;

function dispatchQuery(options: { queryKey: unknown[] }) {
  const root = options.queryKey[3];
  if (root === "workingSet") {
    return {
      data: workingSetData,
      isError: workingSetError,
      isFetching: false,
      refetch: vi.fn(),
    };
  }
  if (root === "list") {
    return {
      data: { items: [queuedSignal], nextCursor: null },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  }
  if (options.queryKey[1] === "settings") {
    return { data: { members: [] }, isError: false, isLoading: false };
  }
  // get
  return { data: undefined, isError: false, isLoading: false };
}

beforeEach(() => {
  dispositionState = "";
  kindState = "";
  peopleState = "all";
  priorityState = "";
  viewState = "list";
  signalState = null;
  workingSetData = {
    items: [followUpSignal, fixSignal],
    totalCount: 2,
    truncated: false,
  };
  workingSetError = false;
  vi.clearAllMocks();
  useQueryMock.mockImplementation(dispatchQuery);
  useSignalsUiStore.setState({ collapsedListGroups: {} });
});

const { SignalsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client"
);
const { useSignalsUiStore } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store"
);

describe("SignalsClient", () => {
  it("renders classified rows above the processing section", () => {
    render(<SignalsClient />);

    expect(screen.getByRole("heading", { name: "Signals" })).toBeInTheDocument();
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for rollout timing")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Classified signals" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Processing signals" })
    ).toBeInTheDocument();
  });

  it("fetches the working set without any filters in the query input", () => {
    dispositionState = "actionable";
    kindState = "follow_up";

    render(<SignalsClient />);

    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
    expect(workingSetQueryOptionsMock).toHaveBeenCalledWith();
    expect(listQueryOptionsMock).toHaveBeenCalledWith({
      limit: 100,
      statuses: ["queued", "processing"],
    });
  });

  it("filters classified rows in memory by kind without refetching", () => {
    kindState = "fix";

    render(<SignalsClient />);

    expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    // Filters never enter the query key: still exactly one workingSet call.
    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("renders the truncation banner only when the window is clipped", () => {
    const { rerender } = render(<SignalsClient />);
    expect(
      screen.queryByTestId("signals-truncation-banner")
    ).not.toBeInTheDocument();

    workingSetData = { ...workingSetData, totalCount: 5000, truncated: true };
    rerender(<SignalsClient />);
    expect(screen.getByTestId("signals-truncation-banner")).toBeInTheDocument();
  });

  it("prefetches a signal body on row hover", () => {
    render(<SignalsClient />);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /Follow up on migration/i })
    );

    expect(prefetchQueryMock).toHaveBeenCalledTimes(1);
    expect(getQueryOptionsMock).toHaveBeenCalledWith({ publicId: "signal_follow_up" });
  });

  it("selects a signal by setting the url param", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /Follow up on migration/i })
    );

    expect(setSignalMock).toHaveBeenCalledWith("signal_follow_up");
  });

  it("collapses and expands the classified group", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Classified signals" })
    );
    expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
  });

  it("groups classified board cards by kind", () => {
    viewState = "board";

    render(<SignalsClient />);

    expect(
      screen.getByRole("region", { name: "Follow up board column" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Fix board column" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Processing board column" })
    ).toBeInTheDocument();
  });

  it("shows an empty state when the working set and processing are empty", () => {
    workingSetData = { items: [], totalCount: 0, truncated: false };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey[3] === "list") {
        return {
          data: { items: [], nextCursor: null },
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        };
      }
      return dispatchQuery(options);
    });

    render(<SignalsClient />);

    expect(screen.getByText("No classified signals yet")).toBeInTheDocument();
  });

  it("shows a retry action when the working set errors", () => {
    workingSetError = true;

    render(<SignalsClient />);

    expect(
      screen.getByRole("button", { name: "Retry classified signals" })
    ).toBeInTheDocument();
  });

  it("keeps view state in the url", () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Display options" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Board/ }));

    expect(setViewMock).toHaveBeenCalledWith("board");
  });
});
```

> This deliberately drops the old "Load more" and "queries classified signals with filters" tests (both encoded the removed server-filter behavior) and replaces them with the in-memory-filter + working-set-shape + banner + hover-prefetch tests the spec's Testing section requires. Toolbar interaction tests (filter submenu, chips) are preserved by the unchanged `SignalsToolbar`; if any toolbar-specific assertions from the old file are still wanted, re-add them verbatim — the toolbar API is unchanged.

- [ ] **Step 2: Run the full signals client + page + filtering + model tests**

Run: `cd apps/app && pnpm test signals`
Expected: PASS for `signals-model`, `signals-client`, `signals-page`, `use-signals-filtering`. (`signal-detail-content` is rewritten in Phase 5.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "test(signals): cover in-memory filtering, working-set shape, banner, hover-prefetch"
```

---

## Phase 5 — Detail sheet: seed header from cache, fetch body on demand (rollout step 5)

### Task 5.1: Split `signal-detail-content.tsx` into header + body

**Files:**
- Rewrite: `_components/signal-detail-content.tsx`
- Rewrite: `_components/signal-detail-content.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace `_components/signal-detail-content.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalDetailContent } from "./signal-detail-content";
import type { SignalDetailRow, SignalListItem } from "./signals-model";

const headerItem: SignalListItem = {
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    priority: "high",
    summary: "Customer wants migration help.",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "classified",
};

const detail: SignalDetailRow = {
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    summary: "Customer wants migration help.",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 7,
  input: "Customer asked for migration help",
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "classified",
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
} as SignalDetailRow;

describe("SignalDetailContent", () => {
  it("renders the header from the projection seed immediately", () => {
    render(
      <SignalDetailContent
        bodyLoading={true}
        item={headerItem}
        onCopyLink={vi.fn()}
      />
    );

    expect(screen.getByText("SIG-7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Follow up on migration" })
    ).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByTestId("signal-detail-body-skeleton")).toBeInTheDocument();
  });

  it("renders the body from the full detail row", () => {
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={detail}
        item={headerItem}
        onCopyLink={vi.fn()}
      />
    );

    expect(
      screen.getByText("Customer asked for migration help")
    ).toBeInTheDocument();
    expect(screen.getByText("Reply with migration plan")).toBeInTheDocument();
    expect(
      screen.getByText("The customer is asking for help.")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("signal-detail-body-skeleton")
    ).not.toBeInTheDocument();
  });

  it("renders the error section for a failed detail row", () => {
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={
          {
            ...detail,
            classification: null,
            errorCode: "CLASSIFY_FAILED",
            errorMessage: "Model timed out",
            status: "failed",
          } as SignalDetailRow
        }
        item={{ ...headerItem, classification: null, status: "failed" }}
        onCopyLink={vi.fn()}
      />
    );

    expect(screen.getByText("CLASSIFY_FAILED")).toBeInTheDocument();
    expect(screen.getByText("Model timed out")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", () => {
    const onCopyLink = vi.fn();
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={detail}
        item={headerItem}
        onCopyLink={onCopyLink}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm test signal-detail-content`
Expected: FAIL — `SignalDetailContent` doesn't accept `item`/`detail`/`bodyLoading`.

- [ ] **Step 3: Rewrite `signal-detail-content.tsx`**

Replace `_components/signal-detail-content.tsx` with:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  CircleDot,
  Flag,
  Gauge,
  KeyRound,
  Link2,
  LoaderCircle,
  Tag,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  formatSignalConfidence,
  formatSignalIdentifier,
  getSignalDispositionLabel,
  getSignalKindLabel,
  getSignalPriorityLabel,
  getSignalSource,
  getSignalStatusLabel,
  getSignalTitle,
  type SignalDetailRow,
  type SignalListItem,
} from "./signals-model";

function PropertyRow({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex w-36 shrink-0 items-center gap-2.5 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1 text-foreground text-sm">{children}</div>
    </div>
  );
}

function BodySection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h3>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}

/**
 * The header seeds instantly from the cached projection (`item`); the body
 * (`input`, `nextAction`, `rationale`, error fields, `updatedAt`) comes from the
 * full `detail` row. While the detail is loading, a body skeleton is shown.
 */
export function SignalDetailContent({
  bodyLoading,
  closeSlot,
  detail,
  item,
  onCopyLink,
}: {
  bodyLoading: boolean;
  closeSlot?: ReactNode;
  detail?: SignalDetailRow;
  item: SignalListItem;
  onCopyLink: () => void;
}) {
  const classification = item.classification;
  const title = getSignalTitle(item);
  const source = getSignalSource(item);
  const createdAt = new Date(item.createdAt);
  const peopleRouting = classification?.routing?.classifyPeople;
  const iconClass = "size-4 shrink-0";
  const detailClassification = detail?.classification;
  const summary = classification?.summary ?? detailClassification?.summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(item)}
        </span>
        {classification ? (
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground text-xs">
            {getSignalDispositionLabel(classification.disposition)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onCopyLink}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Link2 aria-hidden="true" className="size-4" />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-5 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {title}
        </h2>

        <div className="flex flex-col">
          {classification ? (
            <PropertyRow
              icon={<CircleDot className={iconClass} />}
              label="Disposition"
            >
              {getSignalDispositionLabel(classification.disposition)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow icon={<Tag className={iconClass} />} label="Kind">
              {getSignalKindLabel(classification.kind)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow icon={<Flag className={iconClass} />} label="Priority">
              {getSignalPriorityLabel(classification.priority)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow
              icon={<Gauge className={iconClass} />}
              label="Confidence"
            >
              {formatSignalConfidence(classification.confidence)}
            </PropertyRow>
          ) : null}
          <PropertyRow
            icon={<LoaderCircle className={iconClass} />}
            label="Status"
          >
            {getSignalStatusLabel(item.status)}
          </PropertyRow>
          {peopleRouting ? (
            <PropertyRow
              icon={<Users className={iconClass} />}
              label="People routing"
            >
              {peopleRouting.shouldRun ? "Yes" : "No"}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<KeyRound className={iconClass} />} label="Source">
            {source.label}
          </PropertyRow>
        </div>

        <div className="my-6 border-border/60 border-t" />

        {detail ? (
          <div className="flex flex-col gap-5">
            <BodySection label="Input">{detail.input}</BodySection>
            {summary ? <BodySection label="Summary">{summary}</BodySection> : null}
            {detailClassification?.nextAction ? (
              <BodySection label="Next action">
                {detailClassification.nextAction}
              </BodySection>
            ) : null}
            {detailClassification?.rationale ? (
              <BodySection label="Rationale">
                {detailClassification.rationale}
              </BodySection>
            ) : null}
            {detail.status === "failed" ? (
              <div className="space-y-1.5">
                <h3 className="font-medium text-destructive text-xs uppercase tracking-wide">
                  Error
                </h3>
                {detail.errorCode ? (
                  <p className="font-mono text-destructive text-sm">
                    {detail.errorCode}
                  </p>
                ) : null}
                {detail.errorMessage ? (
                  <p className="text-muted-foreground text-sm">
                    {detail.errorMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : bodyLoading ? (
          <div
            className="flex flex-col gap-3"
            data-testid="signal-detail-body-skeleton"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        ) : null}
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={createdAt.toISOString()}>
          Created {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </span>
        {detail ? (
          <>
            <span aria-hidden="true"> · </span>
            <span title={new Date(detail.updatedAt).toISOString()}>
              Updated{" "}
              {formatRelativeTimeToNow(new Date(detail.updatedAt), {
                addSuffix: true,
              })}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm test signal-detail-content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx"
git commit -m "feat(signals): split detail content into projection header + fetched body"
```

### Task 5.2: Rewrite `signal-detail-sheet.tsx` (gate body on `"input" in item`)

**Files:**
- Rewrite: `_components/signal-detail-sheet.tsx`

- [ ] **Step 1: Replace the file**

Replace `_components/signal-detail-sheet.tsx` with:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { SignalDetailContent } from "./signal-detail-content";
import {
  getSignalTitle,
  type SignalDetailRow,
  type SignalListItem,
  type SignalRow,
} from "./signals-model";

export function SignalDetailSheet({
  initialItem,
  onOpenChange,
  publicId,
}: {
  initialItem?: SignalListItem | SignalRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const seededItem =
    initialItem && initialItem.publicId === publicId ? initialItem : undefined;
  // Processing rows (and any already-fetched full rows) carry `input`, so their
  // body needs no `get`. Classified projection rows do.
  const hasBody = !!seededItem && "input" in seededItem;

  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasBody && Boolean(publicId) }
    )
  );

  // Header seed: the projection (or, for deep-links not in cache, the fetched row).
  const headerItem: SignalListItem | undefined = seededItem ?? query.data;
  // Body: the full row if seeded, else the fetched row.
  const detail: SignalDetailRow | undefined = hasBody
    ? (seededItem as SignalRow)
    : query.data;
  const bodyLoading = !detail && query.isLoading;

  function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }
    void navigator.clipboard?.writeText(window.location.href);
    toast.success("Link copied", {
      description: "Anyone with access can open this signal.",
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="inset-y-3 right-3 left-auto h-auto w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-md"
        showCloseButton={!headerItem}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {headerItem ? getSignalTitle(headerItem) : "Signal details"}
          </SheetTitle>
        </SheetHeader>

        {headerItem ? (
          <SignalDetailContent
            bodyLoading={bodyLoading}
            closeSlot={
              <SheetClose asChild>
                <Button
                  aria-label="Close"
                  className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </SheetClose>
            }
            detail={detail}
            item={headerItem}
            onCopyLink={handleCopyLink}
          />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">
              Signal not found
            </p>
            <p className="text-muted-foreground text-sm">
              It may have been deleted or belongs to another organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-6" data-testid="signal-detail-skeleton">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

> `headerItem = seededItem ?? query.data` works because `SignalRow`/`SignalDetailRow` are assignable to `SignalListItem` (the full classification is assignable to the projected one, and `input`/extra fields are permitted on a typed value). `SignalDetailContent`'s header reads only projection fields.

- [ ] **Step 2: Typecheck the app**

Run: `cd apps/app && pnpm with-env next typegen && pnpm --filter @lightfast/app typecheck`
Expected: PASS — `signals-client.tsx` (Task 3.5) now type-checks against the new view + sheet props.

- [ ] **Step 3: Run the whole signals client + detail suite**

Run: `cd apps/app && pnpm test signal`
Expected: PASS for `signals-client`, `signal-detail-content`, `signals-page`, `signals-model`, `use-signals-filtering`, `signal-create-dialog`.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-sheet.tsx"
git commit -m "feat(signals): seed detail header from cache, gate body get on input discriminator"
```

### Task 5.3: Detail seed-then-fetch behavior test

**Files:**
- Create: `_components/signal-detail-sheet.test.tsx`

- [ ] **Step 1: Write the test**

Create `_components/signal-detail-sheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignalDetailSheet } from "./signal-detail-sheet";
import type { SignalListItem, SignalRow } from "./signals-model";

const useQueryMock = vi.fn();
const getQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgMembers: { list: { queryOptions: () => ({ queryKey: ["m"] }) } },
      },
      workspace: { signals: { get: { queryOptions: getQueryOptionsMock } } },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({ toast: { success: vi.fn() } }));

const classifiedItem: SignalListItem = {
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.9,
    disposition: "actionable",
    kind: "follow_up",
    priority: "high",
    summary: "s",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_follow_up",
  status: "classified",
};

const processingRow = {
  classification: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 9,
  input: "Raw processing input",
  publicId: "signal_proc",
  status: "processing",
  updatedAt: new Date("2026-05-27T01:00:00.000Z"),
} as SignalRow;

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({ data: undefined, isError: false, isLoading: false });
});

describe("SignalDetailSheet", () => {
  it("fetches the body for a classified projection row (no input in seed)", () => {
    render(
      <SignalDetailSheet
        initialItem={classifiedItem}
        onOpenChange={vi.fn()}
        publicId="signal_follow_up"
      />
    );

    // Header seeds from the projection immediately.
    expect(
      screen.getByRole("heading", { name: "Follow up on migration" })
    ).toBeInTheDocument();
    // get is enabled because the seed has no body.
    expect(getQueryOptionsMock).toHaveBeenCalledWith(
      { publicId: "signal_follow_up" },
      expect.objectContaining({ enabled: true })
    );
  });

  it("skips the body fetch for a processing row that already has input", () => {
    render(
      <SignalDetailSheet
        initialItem={processingRow}
        onOpenChange={vi.fn()}
        publicId="signal_proc"
      />
    );

    expect(screen.getByText("Raw processing input")).toBeInTheDocument();
    expect(getQueryOptionsMock).toHaveBeenCalledWith(
      { publicId: "signal_proc" },
      expect.objectContaining({ enabled: false })
    );
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd apps/app && pnpm test signal-detail-sheet`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-sheet.test.tsx"
git commit -m "test(signals): verify detail seed-then-fetch and input discriminator"
```

---

## Phase 6 — Virtualization smoke test + full verification

### Task 6.1: Virtualization smoke test (subset render + selection)

**Files:**
- Create: `_components/signals-list-view.test.tsx`

- [ ] **Step 1: Write the test**

Create `_components/signals-list-view.test.tsx`. It mocks `@tanstack/react-virtual` to render only a 5-row window and asserts (a) only windowed rows are in the DOM, (b) clicking a rendered row selects it:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalsListView } from "./signals-list-view";
import type { SignalListItem, SignalSection } from "./signals-model";

// Render a fixed 5-item window starting at index 0 regardless of count.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => {
    const windowSize = Math.min(count, 5);
    return {
      getTotalSize: () => count * 44,
      getVirtualItems: () =>
        Array.from({ length: windowSize }, (_, index) => ({
          index,
          key: getItemKey(index),
          start: index * 44,
        })),
      measureElement: () => undefined,
    };
  },
}));

vi.mock("./signals-creator-avatar", () => ({
  SignalCreatorAvatar: () => <span data-testid="avatar" />,
}));

function row(id: number): SignalListItem {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "s",
      title: `Signal ${id}`,
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: null,
    createdByUserId: "user_test",
    id,
    publicId: `signal_${id}`,
    status: "classified",
  } as SignalListItem;
}

function section(rows: SignalListItem[]): SignalSection {
  return {
    id: "classified",
    isError: false,
    isFetching: false,
    label: "Classified",
    refetch: vi.fn(),
    rows,
  };
}

describe("SignalsListView virtualization", () => {
  it("renders only the windowed rows and selects on click", () => {
    const rows = Array.from({ length: 50 }, (_, index) => row(index + 1));
    const onSelectSignal = vi.fn();

    render(
      <SignalsListView
        collapsedGroups={{}}
        emptyAction={null}
        hasActiveSearch={false}
        hasAnyRows={true}
        onPrefetchSignal={vi.fn()}
        onSelectSignal={onSelectSignal}
        onToggleGroup={vi.fn()}
        sections={[section(rows)]}
        selectedSignalId={null}
      />
    );

    // The flattened window is [header, row#1..row#4]; deep rows are not in DOM.
    expect(screen.getByText("Signal 1")).toBeInTheDocument();
    expect(screen.queryByText("Signal 40")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Signal 1/i }));
    expect(onSelectSignal).toHaveBeenCalledWith("signal_1");
  });

  it("prefetches on row hover", () => {
    const onPrefetchSignal = vi.fn();
    render(
      <SignalsListView
        collapsedGroups={{}}
        emptyAction={null}
        hasActiveSearch={false}
        hasAnyRows={true}
        onPrefetchSignal={onPrefetchSignal}
        onSelectSignal={vi.fn()}
        onToggleGroup={vi.fn()}
        sections={[section([row(1)])]}
        selectedSignalId={null}
      />
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Signal 1/i }));
    expect(onPrefetchSignal).toHaveBeenCalledWith("signal_1");
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd apps/app && pnpm test signals-list-view`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.test.tsx"
git commit -m "test(signals): virtualization smoke test for list view"
```

### Task 6.2: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: PASS (no `SignalRow`/`SignalListItem` mismatches; `workingSet` types resolve).

- [ ] **Step 2: Lint/format**

Run: `pnpm check`
Expected: PASS (fix any import-order or unused-import findings the rewrites introduced).

- [ ] **Step 3: Run all affected test suites**

Run:
```bash
cd packages/api-contract && pnpm test signals
cd ../../db/app && pnpm test signals-list
cd ../../api/app && pnpm test signal
cd ../../apps/app && pnpm test signals && pnpm test signal-detail
```
Expected: all PASS.

- [ ] **Step 4: Build the app**

Run: `pnpm build:app`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional but recommended)**

With `pnpm dev` running, open `https://[<wt>.]lightfast.localhost` → a workspace → Signals. Verify: toggling a filter updates the list with no network request (Network tab shows no `workingSet`/`list` call on filter toggle); list and board scroll smoothly; hovering a row warms the body so opening it shows no body skeleton; a cold deep-link shows the header skeleton then content; if a workspace exceeds the cap, the truncation banner appears.

- [ ] **Step 6: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(signals): typecheck + lint cleanup for architecture upgrade"
```

---

## Spec coverage check

- Decision 1–2 (bounded working set, 30d window + cap + banner, no silent truncation): Tasks 0.2, 1.1, 3.4, 3.5.
- Decision 3 (detail skeleton + hover/focus prefetch): Tasks 3.5, 4.2, 4.3, 5.1, 5.2, 5.3.
- Decision 4 (fixed-interval polling 30s/5s, `placeholderData`): Task 3.1.
- Decision 5 (virtualize both views, no truncation of rows): Tasks 4.2, 4.3, 6.1.
- Decision 6 (keep six `useQueryState`, add `useDeferredValue`, drop `startTransition`, no `useQueryStates`): Task 3.5.
- Decision 7 (server filter branches become dormant; client predicates are the single tested source of truth; no parity test): Tasks 2.1, 1.x leave `listSignals` filter branches untouched/unused.
- Decision 8 (`SignalListItem` is canonical; projection ⊂ full; `"input" in item` discriminator; no api-contract *type* change — only the two shared numeric constants, per the resolved fork): Tasks 2.1, 5.2.
- Decision 9 (`inputPreview` computed client-side for processing rows only; not from the server): Task 2.1 (`adaptProcessingRow`).
- Goals (instant filter path, URL filters via nuqs, ~2000 rows smooth, live transitions, no silent truncation, tests green + new tests): all phases.
- Testing section: model predicates (2.1), working-set query (1.1), virtualization smoke (6.1), detail seed-then-fetch (5.3), truncation banner (3.5/4.4). The SQL↔client parity test is intentionally **not** added (decision 7).
- Remaining-items-to-confirm: window/cap constants → `@repo/api-contract` (resolved fork); banner copy/placement → below toolbar, exact spec copy (3.4/3.5); refetch interval → 30s (3.1); board per-column virtualization with the collapse store → board columns are independent of the list collapse store, which only governs list groups (4.3).
