# Signals UI Loading And Board Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Signals workspace so status tabs, search, pagination, and list/board view changes stay populated and Linear-like after the first load.

**Architecture:** Replace the single suspense-backed active-status query with four concrete status infinite queries. Keep `status`, `q`, and `view` in `nuqs`; keep row selection and collapsed groups in a Signals-specific zustand store. Split the page into small state, data, toolbar, list, board, and shared rendering modules.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, tRPC TanStack React Query, `nuqs`, zustand, shadcn-style `@repo/ui` primitives, Vitest, Testing Library.

---

## File Structure

- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts`
  - Shared Signal types, status/view constants, labels, descriptions, row/card helpers, and list-section view-model types.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-search-params.ts`
  - Shared `nuqs` parsers for `status`, `q`, and `view`.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store.ts`
  - Local zustand store for selected signal and collapsed list groups.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signal-status-query.ts`
  - One status-specific `useInfiniteQuery` wrapper over `org.workspace.signals.list.infiniteQueryOptions`.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts`
  - Wires all four status queries and derives list sections for the active status filter and board columns for all statuses.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-toolbar.tsx`
  - Status tabs, search input, and Display Options dropdown.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-status-icon.tsx`
  - Shared status icon component used by list rows, section headers, and board cards.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-empty-state.tsx`
  - Shared empty state component for global, section, and board-column empty states.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.tsx`
  - Grouped, collapsible list view with per-section load more, retry, and empty states.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-board-view.tsx`
  - Horizontal board with fixed-width status columns and cards.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx`
  - Prefetch first pages for all four concrete statuses with infinite query options.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
  - Thin shell that wires URL state, deferred search, zustand state, workspace data, toolbar, list, and board.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading.tsx`
  - Keep only first-load skeleton; no client interaction should render it after hydration.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`
  - Prove the route prefetches all four concrete statuses with `infiniteQueryOptions`.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`
  - Replace suspense-query tests with infinite-query, URL-state, list, board, search, pagination, and error-isolation tests.

## Existing Constraints

- Do not revert the current Signals UI cleanup edits already present in the working tree.
- Keep the public route at `/${slug}/signals`.
- Keep the backend procedure as `org.workspace.signals.list`.
- Keep the current cursor contract: `{ createdAt, id }`.
- Do not add drag-and-drop or signal mutations.
- Do not put status/search/view changes behind a client Suspense boundary.

---

### Task 1: Shared Signals Model And URL State

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-search-params.ts`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Write the failing test for the new `view` URL state**

Update the `nuqs` mock in `signals-client.test.tsx` so it supports `view`.

```ts
let queryState = "";
let statusState = "all";
let viewState = "list";

const setQueryMock = vi.fn((value: string) => {
  queryState = value;
});
const setStatusMock = vi.fn((value: string) => {
  statusState = value;
});
const setViewMock = vi.fn((value: string) => {
  viewState = value;
});

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "mock-parser",
  },
  parseAsStringLiteral: () => ({
    withDefault: () => "mock-literal-parser",
  }),
  useQueryState: (key: string) => {
    if (key === "status") {
      return [statusState, setStatusMock];
    }
    if (key === "view") {
      return [viewState, setViewMock];
    }
    return [queryState, setQueryMock];
  },
}));
```

Add this test to `describe("SignalsClient", ...)`:

```ts
it("keeps display view in URL state", () => {
  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Board" }));

  expect(setViewMock).toHaveBeenCalledWith("board");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because the Display Options button is not a dropdown and does not call `setViewMock`.

- [ ] **Step 3: Create the shared model file**

Create `signals-model.ts` with:

```ts
import type { AppRouterOutputs } from "@api/app";

export type SignalList = AppRouterOutputs["org"]["workspace"]["signals"]["list"];
export type SignalRow = SignalList["items"][number];
export type SignalStatus = SignalRow["status"];

export const SIGNALS_PAGE_SIZE = 50;

export const signalStatuses = [
  "queued",
  "processing",
  "classified",
  "failed",
] as const satisfies readonly SignalStatus[];

export const signalStatusFilterValues = [
  "all",
  ...signalStatuses,
] as const;

export type SignalStatusFilter = (typeof signalStatusFilterValues)[number];

export const signalViewValues = ["list", "board"] as const;
export type SignalView = (typeof signalViewValues)[number];

export const signalStatusTabs: {
  label: string;
  value: SignalStatusFilter;
}[] = [
  { label: "All signals", value: "all" },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Classified", value: "classified" },
  { label: "Failed", value: "failed" },
];

export const signalStatusLabels: Record<SignalStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  classified: "Classified",
  failed: "Failed",
};

export const signalStatusDescriptions: Record<SignalStatus, string> = {
  queued: "Waiting for classification",
  processing: "Classification in progress",
  classified: "Ready for action",
  failed: "Needs attention",
};

export interface SignalStatusSection {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  label: string;
  refetch: () => void;
  rows: SignalRow[];
  status: SignalStatus;
}

export function getSignalTitle(signal: SignalRow) {
  return signal.classification?.title ?? signal.input;
}

export function getSignalSummary(signal: SignalRow) {
  return signal.classification?.summary ?? signal.input;
}

export function formatSignalIdentifier(signal: SignalRow) {
  return `SIG-${signal.id}`;
}

export function flattenSignalPages(data: { pages: SignalList[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
```

- [ ] **Step 4: Create the URL parser file**

Create `signals-search-params.ts` with:

```ts
import { parseAsString, parseAsStringLiteral } from "nuqs";
import {
  signalStatusFilterValues,
  signalViewValues,
} from "./signals-model";

export const signalQueryParser = parseAsString.withDefault("");

export const signalStatusParser = parseAsStringLiteral(
  signalStatusFilterValues
).withDefault("all");

export const signalViewParser = parseAsStringLiteral(signalViewValues)
  .withDefault("list");
```

- [ ] **Step 5: Create the zustand store**

Create `signals-ui-store.ts` with:

```ts
"use client";

import { create } from "zustand";
import type { SignalStatus } from "./signals-model";

interface SignalsUiState {
  collapsedListGroups: Partial<Record<SignalStatus, boolean>>;
  selectedSignalId: string | null;
  clearSelection: () => void;
  selectSignal: (publicId: string) => void;
  toggleListGroup: (status: SignalStatus) => void;
}

export const useSignalsUiStore = create<SignalsUiState>((set) => ({
  collapsedListGroups: {},
  selectedSignalId: null,
  clearSelection: () => set({ selectedSignalId: null }),
  selectSignal: (publicId) => set({ selectedSignalId: publicId }),
  toggleListGroup: (status) =>
    set((state) => ({
      collapsedListGroups: {
        ...state.collapsedListGroups,
        [status]: !state.collapsedListGroups[status],
      },
    })),
}));
```

- [ ] **Step 6: Run the focused test and keep the expected failure**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: the display view test still fails. The shared model files should typecheck at import time once wired in later tasks.

- [ ] **Step 7: Commit the shared model files and failing test only after the test failure is confirmed**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-search-params.ts" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "test: define signals url and ui state contracts"
```

---

### Task 2: Route Prefetch For All Status Infinite Queries

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx`

- [ ] **Step 1: Write the failing route prefetch test**

Replace the test mock in `signals-page.test.tsx` with support for `infiniteQueryOptions`:

```ts
const infiniteQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
  queryKey: ["org", "workspace", "signals", "list", input, "infinite"],
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
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  },
}));
```

Replace the existing test with:

```ts
it("prefetches the first page for every concrete signal status", async () => {
  const element = await SignalsPage();
  render(element);

  expect(infiniteQueryOptionsMock).toHaveBeenCalledTimes(4);
  expect(infiniteQueryOptionsMock).toHaveBeenNthCalledWith(
    1,
    { limit: 50, status: "queued" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenNthCalledWith(
    2,
    { limit: 50, status: "processing" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenNthCalledWith(
    3,
    { limit: 50, status: "classified" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenNthCalledWith(
    4,
    { limit: 50, status: "failed" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(prefetchMock).toHaveBeenCalledTimes(4);
  expect(screen.getByTestId("hydrated-signals")).toHaveTextContent(
    "Signals client"
  );
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
```

Expected: FAIL because the route still calls `queryOptions` once instead of `infiniteQueryOptions` four times.

- [ ] **Step 3: Update the route prefetch implementation**

Replace `page.tsx` with:

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import {
  SIGNALS_PAGE_SIZE,
  signalStatuses,
} from "./_components/signals-model";
import { SignalsClient } from "./_components/signals-client";
import { SignalsLoading } from "./_components/signals-loading";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  for (const status of signalStatuses) {
    prefetch(
      trpc.org.workspace.signals.list.infiniteQueryOptions(
        {
          limit: SIGNALS_PAGE_SIZE,
          status,
        },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor,
          staleTime: 30_000,
        }
      )
    );
  }

  return (
    <HydrateClient>
      <Suspense fallback={<SignalsLoading />}>
        <SignalsClient />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 4: Run the route test and verify it passes**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
```

Expected: PASS.

- [ ] **Step 5: Commit the route prefetch change**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx"
git commit -m "feat: prefetch signals by status"
```

---

### Task 3: Infinite Query Hooks And Workspace Data View Model

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signal-status-query.ts`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Rewrite the React Query mock for infinite queries**

In `signals-client.test.tsx`, replace the `useSuspenseQuery` mock with `useInfiniteQuery`.

```ts
const infiniteQueryOptionsMock = vi.fn();
const useInfiniteQueryMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}));
```

Update the tRPC mock:

```ts
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        signals: {
          list: {
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  }),
}));
```

Add status-specific fixtures:

```ts
const queuedSignal = {
  ...signalRows[0],
  id: 1,
  publicId: "signal_queued",
  status: "queued",
  classification: null,
  input: "Queued signal",
};

const processingSignal = {
  ...signalRows[0],
  id: 2,
  publicId: "signal_processing",
  status: "processing",
  classification: null,
  input: "Processing signal",
};

const classifiedSignal = {
  ...signalRows[0],
  id: 7,
  publicId: "signal_classified",
  status: "classified",
};

const failedSignal = {
  ...signalRows[1],
  id: 8,
  publicId: "signal_failed",
  status: "failed",
};

const rowsByStatus = {
  queued: [queuedSignal],
  processing: [processingSignal],
  classified: [classifiedSignal],
  failed: [failedSignal],
};
```

Use this default mock behavior:

```ts
function makeInfiniteResult(status: keyof typeof rowsByStatus) {
  return {
    data: {
      pages: [{ items: rowsByStatus[status], nextCursor: null }],
      pageParams: [null],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  queryState = "";
  statusState = "all";
  viewState = "list";
  setQueryMock.mockClear();
  setStatusMock.mockClear();
  setViewMock.mockClear();
  infiniteQueryOptionsMock.mockReset();
  infiniteQueryOptionsMock.mockImplementation((input: unknown, opts: unknown) => ({
    input,
    opts,
    queryKey: ["org", "workspace", "signals", "list", input, "infinite"],
  }));
  useInfiniteQueryMock.mockReset();
  useInfiniteQueryMock.mockImplementation((options: { input: { status: keyof typeof rowsByStatus } }) =>
    makeInfiniteResult(options.input.status)
  );
});
```

- [ ] **Step 2: Add failing tests for all-status queries and no suspense loading**

Add:

```ts
it("queries every concrete status independently", () => {
  render(<SignalsClient />);

  expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
    { limit: 50, search: undefined, status: "queued" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
    { limit: 50, search: undefined, status: "processing" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
    { limit: 50, search: undefined, status: "classified" },
    expect.objectContaining({ staleTime: 30_000 })
  );
  expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
    { limit: 50, search: undefined, status: "failed" },
    expect.objectContaining({ staleTime: 30_000 })
  );
});

it("keeps all status sections populated in all signals list view", () => {
  render(<SignalsClient />);

  expect(screen.getByText("Queued signal")).toBeInTheDocument();
  expect(screen.getByText("Processing signal")).toBeInTheDocument();
  expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
  expect(screen.getByText("Investigate failed provider call")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because `SignalsClient` still uses `useSuspenseQuery` and one active query.

- [ ] **Step 4: Create `use-signal-status-query.ts`**

Create:

```ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { SIGNALS_PAGE_SIZE, type SignalStatus } from "./signals-model";
import { useTRPC } from "~/trpc/react";

export function useSignalStatusQuery({
  search,
  status,
}: {
  search: string;
  status: SignalStatus;
}) {
  const trpc = useTRPC();
  const normalizedSearch = search.trim() || undefined;

  return useInfiniteQuery(
    trpc.org.workspace.signals.list.infiniteQueryOptions(
      {
        limit: SIGNALS_PAGE_SIZE,
        search: normalizedSearch,
        status,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        placeholderData: (previousData) => previousData,
        staleTime: 30_000,
      }
    )
  );
}
```

- [ ] **Step 5: Create `use-signals-workspace-data.ts`**

Create:

```ts
"use client";

import { useMemo } from "react";
import {
  flattenSignalPages,
  signalStatusDescriptions,
  signalStatusLabels,
  signalStatuses,
  type SignalStatus,
  type SignalStatusFilter,
  type SignalStatusSection,
} from "./signals-model";
import { useSignalStatusQuery } from "./use-signal-status-query";

export function useSignalsWorkspaceData({
  search,
  statusFilter,
}: {
  search: string;
  statusFilter: SignalStatusFilter;
}) {
  const queuedQuery = useSignalStatusQuery({ search, status: "queued" });
  const processingQuery = useSignalStatusQuery({
    search,
    status: "processing",
  });
  const classifiedQuery = useSignalStatusQuery({
    search,
    status: "classified",
  });
  const failedQuery = useSignalStatusQuery({ search, status: "failed" });

  const queryByStatus = useMemo(
    () => ({
      classified: classifiedQuery,
      failed: failedQuery,
      processing: processingQuery,
      queued: queuedQuery,
    }),
    [classifiedQuery, failedQuery, processingQuery, queuedQuery]
  );

  const sections = useMemo<SignalStatusSection[]>(
    () =>
      signalStatuses.map((status) => {
        const query = queryByStatus[status];
        return {
          fetchNextPage: () => void query.fetchNextPage(),
          hasNextPage: !!query.hasNextPage,
          isError: query.isError,
          isFetching: query.isFetching,
          isFetchingNextPage: query.isFetchingNextPage,
          label: signalStatusLabels[status],
          refetch: () => void query.refetch(),
          rows: flattenSignalPages(query.data),
          status,
        };
      }),
    [queryByStatus]
  );

  const visibleListSections = useMemo(() => {
    if (statusFilter === "all") {
      return sections;
    }
    return sections.filter((section) => section.status === statusFilter);
  }, [sections, statusFilter]);

  const hasAnyRows = sections.some((section) => section.rows.length > 0);
  const isFetchingAny = sections.some((section) => section.isFetching);
  const statusDescriptions: Record<SignalStatus, string> =
    signalStatusDescriptions;

  return {
    boardSections: sections,
    hasAnyRows,
    isFetchingAny,
    statusDescriptions,
    visibleListSections,
  };
}
```

- [ ] **Step 6: Run the focused test and keep failures limited to UI wiring**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL remains because `SignalsClient` has not been rewritten to use the new hooks.

- [ ] **Step 7: Commit the query hook files and failing client tests**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signal-status-query.ts" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "test: define signals infinite query contracts"
```

---

### Task 4: Toolbar With Display Options

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-toolbar.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add toolbar interaction tests**

Keep the "keeps display view in URL state" test from Task 1. Add this test:

```ts
it("updates URL status and search state from the toolbar", () => {
  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Failed" }));
  fireEvent.change(screen.getByLabelText("Search signals"), {
    target: { value: "migration" },
  });

  expect(setStatusMock).toHaveBeenCalledWith("failed");
  expect(setQueryMock).toHaveBeenCalledWith("migration");
});
```

- [ ] **Step 2: Run the focused test and verify toolbar failures**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because the Display Options dropdown is not implemented.

- [ ] **Step 3: Create `signals-toolbar.tsx`**

Create:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { Check, Columns3, List, Search, SlidersHorizontal } from "lucide-react";
import {
  signalStatusTabs,
  type SignalStatusFilter,
  type SignalView,
} from "./signals-model";

export function SignalsToolbar({
  isSearching,
  onQueryChange,
  onStatusFilterChange,
  onViewChange,
  query,
  statusFilter,
  view,
}: {
  isSearching: boolean;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: SignalStatusFilter) => void;
  onViewChange: (value: SignalView) => void;
  query: string;
  statusFilter: SignalStatusFilter;
  view: SignalView;
}) {
  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-border/70 border-t border-b px-3 py-2">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {signalStatusTabs.map((tab) => (
          <Button
            aria-pressed={statusFilter === tab.value}
            className={
              statusFilter === tab.value
                ? "h-8 rounded-full border border-border/80 bg-secondary px-4 text-foreground shadow-xs"
                : "h-8 rounded-full px-4 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }
            key={tab.value}
            onClick={() => onStatusFilterChange(tab.value)}
            size="sm"
            type="button"
            variant="none"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <label className="flex h-8 w-64 max-w-[42vw] items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 text-muted-foreground focus-within:border-ring/60 focus-within:bg-background">
          <Search className="size-3.5 shrink-0" />
          <Input
            aria-label="Search signals"
            className="h-7 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search"
            value={query}
          />
          {isSearching ? (
            <span className="text-muted-foreground/70 text-xs">Searching</span>
          ) : null}
        </label>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Display options"
                  className="size-8 rounded-full border border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <SlidersHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Display options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onViewChange("list")}>
              <List className="size-3.5" />
              <span>List</span>
              {view === "list" ? <Check className="ml-auto size-3.5" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange("board")}>
              <Columns3 className="size-3.5" />
              <span>Board</span>
              {view === "board" ? <Check className="ml-auto size-3.5" /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the focused test and keep failures limited to client wiring**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL remains until `SignalsClient` renders `SignalsToolbar`.

- [ ] **Step 5: Commit the toolbar component**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-toolbar.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat: add signals display toolbar"
```

---

### Task 5: Shared Status Icon, Empty State, And List View

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-status-icon.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-empty-state.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add list filtering, collapse, pagination, and error tests**

Add these tests:

```ts
it("renders only the selected status section in list view", () => {
  statusState = "failed";

  render(<SignalsClient />);

  expect(screen.queryByText("Queued signal")).not.toBeInTheDocument();
  expect(screen.queryByText("Processing signal")).not.toBeInTheDocument();
  expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
  expect(screen.getByText("Investigate failed provider call")).toBeInTheDocument();
});

it("loads more only for the matching list section", () => {
  const fetchFailedNextPageMock = vi.fn();
  useInfiniteQueryMock.mockImplementation((options: { input: { status: keyof typeof rowsByStatus } }) => ({
    ...makeInfiniteResult(options.input.status),
    fetchNextPage:
      options.input.status === "failed" ? fetchFailedNextPageMock : vi.fn(),
    hasNextPage: options.input.status === "failed",
  }));

  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Load more Failed signals" }));

  expect(fetchFailedNextPageMock).toHaveBeenCalledTimes(1);
});

it("shows an inline retry action for a failed status query", () => {
  const retryFailedMock = vi.fn();
  useInfiniteQueryMock.mockImplementation((options: { input: { status: keyof typeof rowsByStatus } }) => ({
    ...makeInfiniteResult(options.input.status),
    isError: options.input.status === "failed",
    refetch: options.input.status === "failed" ? retryFailedMock : vi.fn(),
  }));

  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Retry Failed signals" }));

  expect(retryFailedMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because the extracted list view and scoped pagination/error controls do not exist.

- [ ] **Step 3: Create `signals-status-icon.tsx`**

Create:

```tsx
import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleX,
} from "lucide-react";
import type { SignalStatus } from "./signals-model";

export function SignalsStatusIcon({ status }: { status: SignalStatus }) {
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
```

- [ ] **Step 4: Create `signals-empty-state.tsx`**

Create:

```tsx
import { Signal as SignalIcon } from "lucide-react";

export function SignalsEmptyState({
  description,
  size = "page",
  title,
}: {
  description: string;
  size?: "page" | "section" | "column";
  title: string;
}) {
  const minHeight =
    size === "page" ? "min-h-96" : size === "section" ? "min-h-32" : "min-h-28";

  return (
    <div className="px-3 py-3">
      <div
        className={`flex ${minHeight} flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center`}
      >
        <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <SignalIcon className="size-4 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `signals-list-view.tsx`**

Create:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  formatSignalIdentifier,
  getSignalSummary,
  getSignalTitle,
  signalStatusDescriptions,
  type SignalRow,
  type SignalStatus,
  type SignalStatusSection,
} from "./signals-model";
import { SignalsEmptyState } from "./signals-empty-state";
import { SignalsStatusIcon } from "./signals-status-icon";

export function SignalsListView({
  collapsedGroups,
  hasActiveSearch,
  hasAnyRows,
  onSelectSignal,
  onToggleGroup,
  sections,
  selectedSignalId,
}: {
  collapsedGroups: Partial<Record<SignalStatus, boolean>>;
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onSelectSignal: (publicId: string) => void;
  onToggleGroup: (status: SignalStatus) => void;
  sections: SignalStatusSection[];
  selectedSignalId: string | null;
}) {
  if (!hasAnyRows && !hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Signals created by API keys and automations will appear here."
        title="No signals yet"
      />
    );
  }

  if (!hasAnyRows && hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Try a different search or status filter."
        title="No matching signals"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 px-3 py-3">
      <div className="min-h-full overflow-hidden rounded-lg border border-border/70 bg-background">
        {sections.map((section) => (
          <SignalListSection
            collapsed={!!collapsedGroups[section.status]}
            key={section.status}
            onSelectSignal={onSelectSignal}
            onToggleGroup={onToggleGroup}
            section={section}
            selectedSignalId={selectedSignalId}
          />
        ))}
      </div>
    </div>
  );
}

function SignalListSection({
  collapsed,
  onSelectSignal,
  onToggleGroup,
  section,
  selectedSignalId,
}: {
  collapsed: boolean;
  onSelectSignal: (publicId: string) => void;
  onToggleGroup: (status: SignalStatus) => void;
  section: SignalStatusSection;
  selectedSignalId: string | null;
}) {
  return (
    <section
      aria-label={`${section.label} signals`}
      className="border-border/70 border-b last:border-b-0"
    >
      <button
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${section.label} signals`}
        className="flex h-11 w-full items-center gap-2 bg-muted/20 px-4 text-left hover:bg-muted/35"
        onClick={() => onToggleGroup(section.status)}
        type="button"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
        <SignalsStatusIcon status={section.status} />
        <span className="font-medium text-foreground text-sm">
          {section.label}
        </span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        <span className="hidden text-muted-foreground/70 text-xs md:inline">
          {signalStatusDescriptions[section.status]}
        </span>
        {section.isFetching && !section.isFetchingNextPage ? (
          <span className="ml-auto text-muted-foreground/70 text-xs">
            Refreshing
          </span>
        ) : null}
      </button>

      {!collapsed && (
        <div>
          {section.isError ? (
            <div className="flex h-16 items-center justify-between border-border/60 border-t px-4">
              <span className="text-muted-foreground text-sm">
                Could not load {section.label.toLowerCase()} signals.
              </span>
              <Button
                aria-label={`Retry ${section.label} signals`}
                onClick={section.refetch}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : section.rows.length === 0 ? (
            <SignalsEmptyState
              description={`No ${section.label.toLowerCase()} signals match this view.`}
              size="section"
              title={`No ${section.label.toLowerCase()} signals`}
            />
          ) : (
            section.rows.map((signal) => (
              <SignalListRow
                isSelected={selectedSignalId === signal.publicId}
                key={signal.publicId}
                onSelect={() => onSelectSignal(signal.publicId)}
                signal={signal}
              />
            ))
          )}

          {section.hasNextPage ? (
            <div className="border-border/60 border-t px-4 py-2">
              <Button
                aria-label={`Load more ${section.label} signals`}
                disabled={section.isFetchingNextPage}
                onClick={section.fetchNextPage}
                size="sm"
                type="button"
                variant="ghost"
              >
                {section.isFetchingNextPage ? "Loading" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SignalListRow({
  isSelected,
  onSelect,
  signal,
}: {
  isSelected: boolean;
  onSelect: () => void;
  signal: SignalRow;
}) {
  const title = getSignalTitle(signal);
  const summary = getSignalSummary(signal);
  const showSummary = summary !== title;
  const createdAt = new Date(signal.createdAt);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "group grid min-h-11 w-full grid-cols-[4.75rem_1.25rem_minmax(12rem,1fr)_7rem_7rem_8rem] items-center gap-3 border-border/60 border-t px-4 text-left first:border-t-0 hover:bg-muted/30 " +
        (isSelected ? "bg-muted/35" : "bg-background")
      }
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
        <MoreHorizontal className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="font-mono">{formatSignalIdentifier(signal)}</span>
      </span>
      <SignalsStatusIcon status={signal.status} />
      <span className="min-w-0">
        <span className="truncate font-medium text-foreground text-sm">
          {title}
        </span>
        {showSummary ? (
          <span className="ml-2 hidden truncate text-muted-foreground text-sm md:inline">
            {summary}
          </span>
        ) : null}
        {signal.status === "failed" && signal.errorCode ? (
          <span className="ml-2 truncate text-destructive text-sm">
            {signal.errorCode}
            {signal.errorMessage ? `: ${signal.errorMessage}` : ""}
          </span>
        ) : null}
      </span>
      <span className="truncate text-muted-foreground text-sm">
        {signal.classification?.priority ?? signal.status}
      </span>
      <span className="truncate text-muted-foreground text-sm">
        {signal.classification?.kind ?? "unclassified"}
      </span>
      <time
        className="truncate text-right text-muted-foreground text-sm"
        dateTime={createdAt.toISOString()}
        title={createdAt.toISOString()}
      >
        {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
      </time>
    </button>
  );
}
```

- [ ] **Step 6: Run the focused test and keep failures limited to client wiring**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL remains until `SignalsClient` renders `SignalsListView`.

- [ ] **Step 7: Commit the list view components**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-status-icon.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-empty-state.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat: add grouped signals list view"
```

---

### Task 6: Board View

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-board-view.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add board rendering and board pagination tests**

Add:

```ts
it("renders all status columns in board view regardless of active status", () => {
  viewState = "board";
  statusState = "failed";

  render(<SignalsClient />);

  expect(screen.getByRole("region", { name: "Queued board column" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Processing board column" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Classified board column" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Failed board column" })).toBeInTheDocument();
  expect(screen.getByText("Queued signal")).toBeInTheDocument();
  expect(screen.getByText("Processing signal")).toBeInTheDocument();
  expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
  expect(screen.getByText("Investigate failed provider call")).toBeInTheDocument();
});

it("loads more only for the matching board column", () => {
  viewState = "board";
  const fetchQueuedNextPageMock = vi.fn();
  useInfiniteQueryMock.mockImplementation((options: { input: { status: keyof typeof rowsByStatus } }) => ({
    ...makeInfiniteResult(options.input.status),
    fetchNextPage:
      options.input.status === "queued" ? fetchQueuedNextPageMock : vi.fn(),
    hasNextPage: options.input.status === "queued",
  }));

  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Load more Queued signals" }));

  expect(fetchQueuedNextPageMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because board view is not implemented.

- [ ] **Step 3: Create `signals-board-view.tsx`**

Create:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  formatSignalIdentifier,
  getSignalSummary,
  getSignalTitle,
  type SignalRow,
  type SignalStatusSection,
} from "./signals-model";
import { SignalsEmptyState } from "./signals-empty-state";
import { SignalsStatusIcon } from "./signals-status-icon";

export function SignalsBoardView({
  hasActiveSearch,
  hasAnyRows,
  onSelectSignal,
  sections,
  selectedSignalId,
}: {
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onSelectSignal: (publicId: string) => void;
  sections: SignalStatusSection[];
  selectedSignalId: string | null;
}) {
  if (!hasAnyRows && !hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Signals created by API keys and automations will appear here."
        title="No signals yet"
      />
    );
  }

  if (!hasAnyRows && hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Try a different search."
        title="No matching signals"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto px-3 py-3">
      <div className="flex min-h-full w-max gap-3">
        {sections.map((section) => (
          <SignalBoardColumn
            key={section.status}
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
  onSelectSignal,
  section,
  selectedSignalId,
}: {
  onSelectSignal: (publicId: string) => void;
  section: SignalStatusSection;
  selectedSignalId: string | null;
}) {
  return (
    <section
      aria-label={`${section.label} board column`}
      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
    >
      <div className="flex h-11 items-center gap-2 border-border/70 border-b bg-muted/20 px-3">
        <SignalsStatusIcon status={section.status} />
        <span className="font-medium text-sm">{section.label}</span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        {section.isFetching && !section.isFetchingNextPage ? (
          <span className="ml-auto text-muted-foreground/70 text-xs">
            Refreshing
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {section.isError ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-muted-foreground text-sm">
              Could not load {section.label.toLowerCase()} signals.
            </p>
            <Button
              aria-label={`Retry ${section.label} signals`}
              className="mt-3"
              onClick={section.refetch}
              size="sm"
              type="button"
              variant="outline"
            >
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
          section.rows.map((signal) => (
            <SignalBoardCard
              isSelected={selectedSignalId === signal.publicId}
              key={signal.publicId}
              onSelect={() => onSelectSignal(signal.publicId)}
              signal={signal}
            />
          ))
        )}
      </div>

      {section.hasNextPage ? (
        <div className="border-border/70 border-t p-2">
          <Button
            aria-label={`Load more ${section.label} signals`}
            className="w-full justify-center"
            disabled={section.isFetchingNextPage}
            onClick={section.fetchNextPage}
            size="sm"
            type="button"
            variant="ghost"
          >
            {section.isFetchingNextPage ? "Loading" : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function SignalBoardCard({
  isSelected,
  onSelect,
  signal,
}: {
  isSelected: boolean;
  onSelect: () => void;
  signal: SignalRow;
}) {
  const title = getSignalTitle(signal);
  const summary = getSignalSummary(signal);
  const createdAt = new Date(signal.createdAt);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "w-full rounded-md border border-border/70 bg-background p-3 text-left hover:bg-muted/30 " +
        (isSelected ? "bg-muted/35" : "")
      }
      onClick={onSelect}
      type="button"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(signal)}
        </span>
        <time
          className="shrink-0 text-muted-foreground text-xs"
          dateTime={createdAt.toISOString()}
          title={createdAt.toISOString()}
        >
          {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </time>
      </div>
      <p className="line-clamp-2 font-medium text-foreground text-sm">
        {title}
      </p>
      {summary !== title ? (
        <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
          {summary}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
        <SignalsStatusIcon status={signal.status} />
        <span>{signal.classification?.priority ?? signal.status}</span>
        <span>{signal.classification?.kind ?? "unclassified"}</span>
      </div>
      {signal.status === "failed" && signal.errorCode ? (
        <p className="mt-2 line-clamp-2 text-destructive text-xs">
          {signal.errorCode}
          {signal.errorMessage ? `: ${signal.errorMessage}` : ""}
        </p>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 4: Run the focused test and keep failures limited to client wiring**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL remains until `SignalsClient` renders `SignalsBoardView`.

- [ ] **Step 5: Commit the board view**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-board-view.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat: add signals board view"
```

---

### Task 7: Wire SignalsClient To The New Data And View Components

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add the no-skeleton interaction regression test**

Because the test file mocks React Query directly, the regression assertion is that `SignalsClient` does not import or call `useSuspenseQuery`. Add this at the top-level after imports:

```ts
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}));
```

Do not expose `useSuspenseQuery` from the mock. The test suite should fail if production code imports it.

Add this behavior test:

```ts
it("does not clear the populated list when status changes", () => {
  render(<SignalsClient />);

  fireEvent.click(screen.getByRole("button", { name: "Failed" }));

  expect(setStatusMock).toHaveBeenCalledWith("failed");
  expect(screen.getByText("Queued signal")).toBeInTheDocument();
  expect(screen.getByText("Processing signal")).toBeInTheDocument();
  expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
  expect(screen.getByText("Investigate failed provider call")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: FAIL because `SignalsClient` still imports `useSuspenseQuery` and has not been wired to the new components.

- [ ] **Step 3: Replace `signals-client.tsx` with the thin shell**

Replace the file with:

```tsx
"use client";

import { useDeferredValue } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import {
  signalQueryParser,
  signalStatusParser,
  signalViewParser,
} from "./signals-search-params";
import { useSignalsUiStore } from "./signals-ui-store";
import { SignalsBoardView } from "./signals-board-view";
import { SignalsListView } from "./signals-list-view";
import { SignalsToolbar } from "./signals-toolbar";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";
import { useQueryState } from "nuqs";

export function SignalsClient() {
  const [query, setQuery] = useQueryState("q", signalQueryParser);
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    signalStatusParser
  );
  const [view, setView] = useQueryState("view", signalViewParser);

  const deferredQuery = useDeferredValue(query);
  const normalizedDeferredQuery = deferredQuery.trim();
  const hasActiveSearch = normalizedDeferredQuery.length > 0;
  const isSearching = query !== deferredQuery;

  const collapsedGroups = useSignalsUiStore(
    (state) => state.collapsedListGroups
  );
  const selectedSignalId = useSignalsUiStore((state) => state.selectedSignalId);
  const selectSignal = useSignalsUiStore((state) => state.selectSignal);
  const toggleListGroup = useSignalsUiStore((state) => state.toggleListGroup);

  const {
    boardSections,
    hasAnyRows,
    isFetchingAny,
    visibleListSections,
  } = useSignalsWorkspaceData({
    search: normalizedDeferredQuery,
    statusFilter,
  });

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Signals</h1>
      <SignalsToolbar
        isSearching={isSearching || (hasActiveSearch && isFetchingAny)}
        onQueryChange={(value) => void setQuery(value)}
        onStatusFilterChange={(value) => void setStatusFilter(value)}
        onViewChange={(value) => void setView(value)}
        query={query}
        statusFilter={statusFilter}
        view={view}
      />

      {view === "board" ? (
        <SignalsBoardView
          hasActiveSearch={hasActiveSearch}
          hasAnyRows={hasAnyRows}
          onSelectSignal={selectSignal}
          sections={boardSections}
          selectedSignalId={selectedSignalId}
        />
      ) : (
        <SignalsListView
          collapsedGroups={collapsedGroups}
          hasActiveSearch={hasActiveSearch}
          hasAnyRows={hasAnyRows}
          onSelectSignal={selectSignal}
          onToggleGroup={toggleListGroup}
          sections={visibleListSections}
          selectedSignalId={selectedSignalId}
        />
      )}
    </WorkspaceSurface>
  );
}
```

- [ ] **Step 4: Run the focused test and fix only wiring/type errors**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```

Expected: PASS once mocks and component wiring align. If the test fails because menu roles differ in the mocked DOM, query by text `Board` inside the menu and keep the assertion on `setViewMock`.

- [ ] **Step 5: Run the route test**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
```

Expected: PASS.

- [ ] **Step 6: Commit the integrated client**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat: wire signals cached views"
```

---

### Task 8: Loading Skeleton Alignment And Final Verification

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx`

- [ ] **Step 1: Confirm the loading skeleton still represents first route load only**

Read `signals-loading.tsx`. It should remain a route-level skeleton with toolbar placeholders and list rows. Do not add search, status, or board-change loading behavior to this file.

- [ ] **Step 2: Adjust skeleton placeholders if the toolbar dimensions changed**

Keep this shape:

```tsx
<div className="flex h-14 items-center justify-between border-border/70 border-b px-3">
  <div className="flex items-center gap-2">
    <Skeleton className="h-8 w-24 rounded-full" />
    <Skeleton className="h-8 w-20 rounded-full" />
    <Skeleton className="h-8 w-24 rounded-full" />
  </div>
  <div className="flex items-center gap-2">
    <Skeleton className="h-8 w-56 rounded-full" />
    <Skeleton className="size-8 rounded-full" />
  </div>
</div>
```

- [ ] **Step 3: Run focused Signals tests**

Run:

```bash
pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
```

Expected: both test files PASS.

- [ ] **Step 4: Run app typecheck**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 6: Browser verification**

Start or reuse the local dev server:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open:

```text
https://lightfast.localhost/lightfast/signals
```

Verify manually:

- `All signals`, `Queued`, `Processing`, `Classified`, and `Failed` tab clicks do not show the route skeleton.
- `All signals` list view shows grouped sections.
- A concrete status tab shows only that status section in list view.
- Display Options opens a dropdown.
- Selecting `Board` shows all four status columns even when the status tab is `Failed`.
- Board columns scroll horizontally when viewport width is constrained.
- Search keeps the existing surface visible while fetching.

- [ ] **Step 7: Commit final verification adjustments**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"
git commit -m "feat: complete signals cached board rework"
```

## Final Verification Checklist

- [ ] `pnpm --filter @lightfast/app test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-page.test.tsx"`
- [ ] `pnpm --filter @lightfast/app typecheck`
- [ ] `git diff --check`
- [ ] Browser check at `https://lightfast.localhost/lightfast/signals`

