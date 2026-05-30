# Signals People Rework Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove structural debt from the Signals/People rework by fixing app/private contract boundaries, deleting dormant server filters, making Signals stream merging deterministic, restoring People search, and keeping `pnpm check` green.

**Architecture:** Keep the external oRPC contract package focused on public signal create/get schemas. The private workspace Signals tRPC/DB boundary owns working-set window metadata, and the client owns in-memory filtering plus deduped classified/processing composition. People search returns as URL-backed client state that flows into the existing people list query path.

**Tech Stack:** pnpm, Turborepo, Next.js App Router, tRPC, React Query, nuqs, Drizzle ORM, Vitest, Ultracite.

---

## File Structure

- Modify `packages/api-contract/src/schemas/signals.ts`: remove app-only working-set constants and comment.
- Modify `packages/api-contract/src/index.ts`: stop exporting removed working-set constants.
- Modify `packages/api-contract/src/__tests__/signals.test.ts`: remove the contract-package bounds test.
- Modify `db/app/src/utils/signals.ts`: own private working-set constants, return `limit` and `windowDays`, and simplify `listSignals` to the live-status query contract.
- Modify `db/app/src/__tests__/signals-list.test.ts`: assert working-set metadata and update list helper expectations.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`: make `signals.list` a strict processing-list endpoint and remove dormant classification filter inputs.
- Modify `api/app/src/__tests__/workspace-signals-router.test.ts`: update mocks and tests for strict processing-list input plus working-set metadata forwarding.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts`: dedupe classified/processing rows and return working-set metadata.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`: pass working-set metadata to the truncation banner.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-truncation-banner.tsx`: render metadata from props, not `@repo/api-contract`.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`: cover metadata-driven banner text and classified-over-processing dedupe.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`: add URL parser for People search.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`: read/defer URL search and pass it to `usePeopleListQuery`.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx`: render the compact search input and emit query changes.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`: cover URL-backed search and search-driven empty state.

---

### Task 1: Move Working-Set Bounds Out of the Public API Contract

**Files:**
- Modify: `packages/api-contract/src/schemas/signals.ts`
- Modify: `packages/api-contract/src/index.ts`
- Modify: `packages/api-contract/src/__tests__/signals.test.ts`
- Modify: `db/app/src/utils/signals.ts`
- Modify: `db/app/src/__tests__/signals-list.test.ts`

- [ ] **Step 1: Write the failing DB metadata expectation**

In `db/app/src/__tests__/signals-list.test.ts`, update the first `listWorkspaceSignals` test to assert the returned bounds:

```ts
expect(result.limit).toBe(2000);
expect(result.windowDays).toBe(30);
expect(result.truncated).toBe(false);
expect(result.totalCount).toBe(1);
```

Also update the overflow test with:

```ts
expect(result.limit).toBe(2000);
expect(result.windowDays).toBe(30);
expect(result.items).toHaveLength(2000);
expect(result.truncated).toBe(true);
expect(result.totalCount).toBe(2500);
```

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
```

Expected: FAIL because `result.limit` and `result.windowDays` are `undefined`.

- [ ] **Step 3: Move the bounds into the DB working-set helper**

In `db/app/src/utils/signals.ts`, change the top import and add private constants:

```ts
import type { SignalClassification } from "@repo/api-contract";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

const WORKSPACE_SIGNALS_WINDOW_DAYS = 30;
const WORKSPACE_SIGNALS_LIMIT = 2000;
```

Update `WorkspaceSignalsResult`:

```ts
export interface WorkspaceSignalsResult {
  items: WorkspaceSignalListItem[];
  limit: number;
  totalCount: number;
  truncated: boolean;
  windowDays: number;
}
```

Update the `listWorkspaceSignals` return:

```ts
return {
  items,
  limit: WORKSPACE_SIGNALS_LIMIT,
  totalCount,
  truncated,
  windowDays: WORKSPACE_SIGNALS_WINDOW_DAYS,
};
```

- [ ] **Step 4: Remove public contract exports and tests**

In `packages/api-contract/src/schemas/signals.ts`, delete the working-set comment plus:

```ts
export const WORKSPACE_SIGNALS_WINDOW_DAYS = 30;
export const WORKSPACE_SIGNALS_LIMIT = 2000;
```

In `packages/api-contract/src/index.ts`, delete:

```ts
WORKSPACE_SIGNALS_LIMIT,
WORKSPACE_SIGNALS_WINDOW_DAYS,
```

In `packages/api-contract/src/__tests__/signals.test.ts`, remove both imports:

```ts
WORKSPACE_SIGNALS_LIMIT,
WORKSPACE_SIGNALS_WINDOW_DAYS,
```

Then delete the whole test block:

```ts
describe("workspace signals bounds", () => {
  it("exposes the working-set window and cap as named constants", () => {
    expect(WORKSPACE_SIGNALS_WINDOW_DAYS).toBe(30);
    expect(WORKSPACE_SIGNALS_LIMIT).toBe(2000);
  });
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api-contract/src/schemas/signals.ts packages/api-contract/src/index.ts packages/api-contract/src/__tests__/signals.test.ts db/app/src/utils/signals.ts db/app/src/__tests__/signals-list.test.ts
git commit -m "refactor: keep signal working set bounds private"
```

---

### Task 2: Delete Dormant Server-Side Signals Classification Filters

**Files:**
- Modify: `db/app/src/utils/signals.ts`
- Modify: `db/app/src/__tests__/signals-list.test.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Modify: `api/app/src/__tests__/workspace-signals-router.test.ts`

- [ ] **Step 1: Update API tests for the smaller list contract**

In `api/app/src/__tests__/workspace-signals-router.test.ts`, add a DB mock for `listWorkspaceSignals` near the other mocks:

```ts
const listWorkspaceSignalsMock = vi.fn();
```

Update the `@db/app` mock:

```ts
vi.mock("@db/app", () => ({
  getSignalByPublicId: getSignalByPublicIdMock,
  listSignals: listSignalsMock,
  listWorkspaceSignals: listWorkspaceSignalsMock,
}));
```

Reset it in `beforeEach`:

```ts
listWorkspaceSignalsMock.mockReset();
listWorkspaceSignalsMock.mockResolvedValue({
  items: [],
  limit: 2000,
  totalCount: 0,
  truncated: false,
  windowDays: 30,
});
```

Replace the old `"forwards filters and returns native DB rows unchanged"` test with:

```ts
it("forwards only cursor, limit, and statuses to the DB list helper", async () => {
  const cursor = { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 };

  await expect(
    caller().signals.list({
      cursor,
      limit: 25,
      statuses: ["queued", "processing"],
    })
  ).resolves.toEqual({
    items: [signalRow],
    nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
  });

  expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
    clerkOrgId: "org_test",
    cursor,
    limit: 25,
    statuses: ["queued", "processing"],
  });
});
```

Replace the blank-search test with a strict-input test:

```ts
it("rejects dormant classified filter inputs", async () => {
  await expect(
    caller().signals.list({
      kinds: ["fix"],
      search: "migration",
    } as never)
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });

  expect(listSignalsMock).not.toHaveBeenCalled();
});
```

Update the org-scope expectation to:

```ts
expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
  clerkOrgId: "org_other",
  cursor: undefined,
  limit: undefined,
  statuses: undefined,
});
```

Add a working-set forwarding test:

```ts
it("returns the org-scoped working set with metadata", async () => {
  await expect(caller().signals.workingSet()).resolves.toEqual({
    items: [],
    limit: 2000,
    totalCount: 0,
    truncated: false,
    windowDays: 30,
  });

  expect(listWorkspaceSignalsMock).toHaveBeenCalledWith(expect.anything(), {
    clerkOrgId: "org_test",
  });
});
```

- [ ] **Step 2: Run the API test and verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts
```

Expected: FAIL because `signals.list` still accepts and forwards dormant filter inputs.

- [ ] **Step 3: Shrink the tRPC list input**

In `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, remove these imports:

```ts
signalDispositionSchema,
signalKindSchema,
signalPrioritySchema,
workspaceListSearchInput,
```

Change `listSignalsInput` to a strict object:

```ts
const listSignalsInput = z
  .object({
    cursor: workspaceListCursorInput,
    limit: workspaceListLimitInput,
    statuses: z.array(signalStatusSchema).max(2).optional(),
  })
  .strict();
```

Change the list procedure to:

```ts
list: boundOrgProcedure.input(listSignalsInput).query(({ ctx, input }) =>
  listSignals(ctx.db, {
    clerkOrgId: ctx.auth.identity.orgId,
    cursor: input.cursor,
    limit: input.limit,
    statuses: input.statuses?.length ? input.statuses : undefined,
  })
),
```

- [ ] **Step 4: Simplify the DB list helper**

In `db/app/src/utils/signals.ts`, change `ListSignalsParams` to:

```ts
export interface ListSignalsParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  statuses?: Signal["status"][];
}
```

Delete both JSON helpers:

```ts
function jsonString(path: string) {
  return sql<string>`json_unquote(json_extract(${signals.classification}, ${path}))`;
}

function jsonStringIn(path: string, values: string[] | undefined) {
  if (!values?.length) {
    return;
  }
  return inArray(jsonString(path), values);
}
```

Remove the `search` local and replace the start of `conditions` with:

```ts
const conditions = [
  eq(signals.clerkOrgId, input.clerkOrgId),
  input.statuses?.length ? inArray(signals.status, input.statuses) : undefined,
  input.cursor
    ? or(
        lt(signals.createdAt, input.cursor.createdAt),
        and(
          eq(signals.createdAt, input.cursor.createdAt),
          lt(signals.id, input.cursor.id)
        )
      )
    : undefined,
].filter(isDefined);
```

Remove `like` from the Drizzle import. Keep `or` because cursor pagination still uses it.

- [ ] **Step 5: Run focused DB and API tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/signals.ts db/app/src/__tests__/signals-list.test.ts api/app/src/router/'(pending-not-allowed)'/workspace-signals.ts api/app/src/__tests__/workspace-signals-router.test.ts
git commit -m "refactor: narrow workspace signals list"
```

---

### Task 3: Dedupe Signals Streams and Drive the Banner from Metadata

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-truncation-banner.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Write client tests for metadata and dedupe**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`, add `limit` and `windowDays` to the `workingSetData` type:

```ts
let workingSetData: {
  items: unknown[];
  limit: number;
  totalCount: number;
  truncated: boolean;
  windowDays: number;
};
```

Add a processing data variable near `workingSetError`:

```ts
let processingData: { items: unknown[]; nextCursor: null };
```

Update `dispatchQuery` for the list path:

```ts
if (root === "list") {
  return {
    data: processingData,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}
```

Set both defaults in `beforeEach`:

```ts
workingSetData = {
  items: [followUpSignal, fixSignal],
  limit: 2000,
  totalCount: 2,
  truncated: false,
  windowDays: 30,
};
processingData = { items: [queuedSignal], nextCursor: null };
```

Update non-spread `workingSetData = { ... }` assignments in the test file so each literal includes `limit` and `windowDays`:

```ts
workingSetData = {
  items: [],
  limit: 2000,
  totalCount: 0,
  truncated: false,
  windowDays: 30,
};
```

Add this banner assertion:

```ts
it("renders truncation copy from working-set metadata", () => {
  workingSetData = {
    ...workingSetData,
    limit: 1234,
    totalCount: 5000,
    truncated: true,
    windowDays: 14,
  };

  render(<SignalsClient />);

  expect(
    screen.getByText(
      "Showing the 1,234 most recent of the last 14 days — filters apply to this window."
    )
  ).toBeInTheDocument();
});
```

Add this dedupe assertion:

```ts
it("lets classified rows win over stale processing rows", () => {
  processingData = {
    items: [
      {
        ...queuedSignal,
        id: followUpSignal.id,
        input: "Stale queued copy",
        publicId: followUpSignal.publicId,
      },
    ],
    nextCursor: null,
  };

  render(<SignalsClient />);

  expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
  expect(screen.queryByText("Stale queued copy")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: FAIL because the banner still imports constants and processing rows are not deduped.

- [ ] **Step 3: Make the banner prop-driven**

Replace `signals-truncation-banner.tsx` with:

```tsx
/**
 * Additive banner shown only when the working set is clipped by the cap. Makes
 * the in-memory filtering honest: filters are complete within the window, and
 * any clipping is visible. Silent truncation is forbidden.
 */
export function SignalsTruncationBanner({
  limit,
  truncated,
  windowDays,
}: {
  limit: number;
  truncated: boolean;
  windowDays: number;
}) {
  if (!truncated) {
    return null;
  }
  return (
    <div
      className="mx-3 mb-2 rounded-lg border border-border/70 bg-muted/25 px-4 py-2 text-muted-foreground text-sm"
      data-testid="signals-truncation-banner"
      role="status"
    >
      Showing the {limit.toLocaleString()} most recent of the last {windowDays}{" "}
      days — filters apply to this window.
    </div>
  );
}
```

- [ ] **Step 4: Dedupe in `useSignalsWorkspaceData`**

In `use-signals-workspace-data.ts`, replace the processing row derivation and map with:

```ts
const classifiedIds = useMemo(() => {
  const ids = new Set<string>();
  for (const row of classifiedRows) {
    ids.add(row.publicId);
  }
  return ids;
}, [classifiedRows]);

const dedupedProcessingFullRows = useMemo<SignalRow[]>(
  () => processingFullRows.filter((row) => !classifiedIds.has(row.publicId)),
  [classifiedIds, processingFullRows]
);

const processingRows = useMemo<SignalListItem[]>(
  () => dedupedProcessingFullRows.map(adaptProcessingRow),
  [dedupedProcessingFullRows]
);
```

Update `signalsByPublicId` to use only deduped processing rows:

```ts
const signalsByPublicId = useMemo(() => {
  const map = new Map<string, SignalListItem | SignalRow>();
  for (const row of classifiedRows) {
    map.set(row.publicId, row);
  }
  for (const row of dedupedProcessingFullRows) {
    map.set(row.publicId, row);
  }
  return map;
}, [classifiedRows, dedupedProcessingFullRows]);
```

Update the returned metadata:

```ts
return {
  boardSections,
  hasAnyRows: classifiedRows.length + processingRows.length > 0,
  processingQueryKey,
  signalsByPublicId,
  totalCount: workingSetQuery.data?.totalCount ?? classifiedRows.length,
  truncated: workingSetQuery.data?.truncated ?? false,
  visibleListSections,
  windowDays: workingSetQuery.data?.windowDays ?? 0,
  workingSetLimit: workingSetQuery.data?.limit ?? 0,
  workingSetQueryKey,
};
```

- [ ] **Step 5: Pass metadata through `SignalsClient`**

In `signals-client.tsx`, destructure the new hook fields:

```ts
const {
  boardSections,
  hasAnyRows,
  signalsByPublicId,
  truncated,
  visibleListSections,
  windowDays,
  workingSetLimit,
} = useSignalsWorkspaceData({ filters: deferredFilters });
```

Update the banner call:

```tsx
<SignalsTruncationBanner
  limit={workingSetLimit}
  truncated={truncated}
  windowDays={windowDays}
/>
```

- [ ] **Step 6: Run the client test**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/signals/_components/use-signals-workspace-data.ts apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/signals/_components/signals-client.tsx apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/signals/_components/signals-truncation-banner.tsx apps/app/src/__tests__/app/'(app)'/'(pending-not-allowed)'/'[slug]'/signals-client.test.tsx
git commit -m "fix: dedupe workspace signal streams"
```

---

### Task 4: Restore URL-Backed People Search

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`

- [ ] **Step 1: Write People search tests**

In `people-client.test.tsx`, change the import to include `fireEvent`:

```ts
import { fireEvent, render, screen } from "@testing-library/react";
```

Add query state and setter:

```ts
const queryStates: Record<string, string | null> = {
  peopleQuery: "",
  person: null,
  provider: "",
  type: "",
};
const setQuery = vi.fn((value: string | null) => {
  queryStates.peopleQuery = value;
});
```

Update the `nuqs` mock setter map:

```ts
const setters: Record<string, (value: string | null) => void> = {
  peopleQuery: setQuery,
  person: setPerson,
  provider: setProvider,
  type: setType,
};
```

Reset in `beforeEach`:

```ts
queryStates.peopleQuery = "";
setQuery.mockClear();
```

Add a query-forwarding test:

```ts
it("passes deferred search text into the people list query", () => {
  queryStates.peopleQuery = " jeevan ";

  render(<PeopleClient />);

  expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
    {
      limit: 50,
      providers: undefined,
      search: "jeevan",
      types: undefined,
    },
    expect.anything()
  );
});
```

Add a URL setter test:

```ts
it("writes search input changes to the people query param", () => {
  render(<PeopleClient />);

  fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), {
    target: { value: "alice" },
  });

  expect(setQuery).toHaveBeenCalledWith("alice");
});
```

Add a search empty-state test:

```ts
it("renders the no-results state when search excludes all people", () => {
  queryStates.peopleQuery = "missing";
  mockRows([]);

  render(<PeopleClient />);

  expect(screen.getByText("No matching people")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the People client test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: FAIL because the toolbar has no searchbox and `PeopleClient` passes `search: ""`.

- [ ] **Step 3: Add the People search parser**

In `people-search-params.ts`, add:

```ts
export const personQueryParser = parseAsString.withDefault("");
```

- [ ] **Step 4: Wire query state in `PeopleClient`**

In `people-client.tsx`, change the React import:

```ts
import { useDeferredValue, useMemo } from "react";
```

Import the parser:

```ts
personQueryParser,
```

Add the query state before provider/type state:

```ts
const [query, setQuery] = useQueryState("peopleQuery", personQueryParser);
const deferredQuery = useDeferredValue(query);
const search = deferredQuery.trim();
```

Update `hasActiveFilters`:

```ts
const hasActiveFilters =
  search.length > 0 || filters.providers.length > 0 || filters.types.length > 0;
```

Update the query call:

```ts
const { query: peopleQuery } = usePeopleListQuery({ filters, search });
const rows = flattenPeoplePages(peopleQuery.data);
```

Then update the `PeopleTableView` props to read from `peopleQuery`:

```tsx
<PeopleTableView
  fetchNextPage={() => void peopleQuery.fetchNextPage()}
  hasActiveFilters={hasActiveFilters}
  hasNextPage={!!peopleQuery.hasNextPage}
  isError={peopleQuery.isError}
  isFetching={peopleQuery.isFetching}
  isFetchingNextPage={peopleQuery.isFetchingNextPage}
  isPlaceholderData={peopleQuery.isPlaceholderData}
  onSelectPerson={(publicId) => void setSelectedPersonId(publicId)}
  refetch={() => void peopleQuery.refetch()}
  rows={rows}
  selectedPersonId={selectedPersonId}
/>
```

Pass search props into `PeopleToolbar`:

```tsx
<PeopleToolbar
  filters={filters}
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
  query={query}
/>
```

- [ ] **Step 5: Render the search input in `PeopleToolbar`**

In `people-toolbar.tsx`, add imports:

```ts
import { Input } from "@repo/ui/components/ui/input";
import { Search } from "lucide-react";
```

Add props to `PeopleToolbar`:

```ts
onQueryChange,
query,
```

with types:

```ts
onQueryChange: (value: string) => void;
query: string;
```

Render the compact search control before the display dropdown:

```tsx
<div className="flex h-6 w-56 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 text-muted-foreground">
  <Search aria-hidden="true" className="size-3" />
  <Input
    aria-label="Search people"
    className="h-5 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
    onChange={(event) => onQueryChange(event.currentTarget.value)}
    placeholder="Search people"
    role="searchbox"
    value={query}
  />
</div>
```

- [ ] **Step 6: Run the People client test**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/people/_components/people-search-params.ts apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/people/_components/people-client.tsx apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/people/_components/people-toolbar.tsx apps/app/src/__tests__/app/'(app)'/'(pending-not-allowed)'/'[slug]'/people-client.test.tsx
git commit -m "feat: restore people search"
```

---

### Task 5: Final Verification and Quality Gate

**Files:**
- Verify: all modified files from Tasks 1-4

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx'
```

Expected: all commands PASS.

- [ ] **Step 2: Run the required quality gate**

Run:

```bash
pnpm check
```

Expected: PASS with output ending in `No fixes applied.` and no errors.

- [ ] **Step 3: Run typecheck for touched packages**

Run:

```bash
pnpm --filter @repo/api-contract typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all commands PASS.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --stat HEAD
git diff --check HEAD
```

Expected: `git diff --check HEAD` prints no whitespace errors.

- [ ] **Step 5: Commit verification-only fixes if any were required**

If Step 2 or Step 3 required formatting or type-only changes, commit them with:

```bash
git add packages/api-contract db/app api/app apps/app
git commit -m "chore: finish signals people quality checks"
```

If no files changed after Step 1-4, skip this commit.
