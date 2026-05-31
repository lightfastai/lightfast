# People UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the People workspace into a full-bleed, Attio-style table (Name · Identity · Type · Signals) with an icon-only Filter/Display toolbar and a row-click detail sheet matching Signals, then populate the `lightfast` org by seeding people-mentioning signals through the real pipeline — with no data-model change.

**Architecture:** Keep `lightfast_people` identity-centric and the classify-people pipeline untouched. Add additive backend reads only: a `getPersonByPublicId` DB helper, provider/type filters on `listPeople`, and `org.workspace.people.get`. Rebuild the People `_components/` to mirror the reworked Signals components (model, search-params, query hook, toolbar, table view, empty state, detail sheet/content, loading, client). Seed via a dev `tsx` script that creates signals through `createAndQueueSignal`.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, tRPC TanStack React Query, `nuqs`, zustand-free (selection lives in the URL), shadcn-style `@repo/ui` primitives, Drizzle (PlanetScale MySQL), Vitest, Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-30-people-ui-rework-design.md`

---

## Design Decisions Locked During Planning

These resolve the spec's Open Questions and one issue found while reading the code. They change the spec's defaults — review before executing:

1. **Display = parity stub (List), sort deferred.** `listPeople` uses keyset cursor pagination on `(createdAt, id)`. A real "Name"/"Recently seen" sort would require re-keying the cursor per sort column — more than this "UI-vibes" pass. The Display button renders for parity with a single checked **List** option, ready to grow. Provider/Type **filters are real** (they are additive `WHERE` clauses and do not disturb the keyset).
2. **Signals column is honest.** `lastSeenSignalId`/`firstSeenSignalId` are the only linkable references; `seenCount` is a count. The table chip shows the last-seen ref + `+N` (`N = seenCount − 1`, count-only). The detail sheet links the first/last-seen signals and states the total count — no fabricated middle entries.
3. **No visible search box.** The reworked Signals toolbar has no search input (`SignalsClient` passes `search: ""`); People matches. The `search` param stays plumbed in the query for future use, but no toolbar search box ships this pass.
4. **Detail-sheet signal links enrich via `signals.get`.** Each first/last-seen link lazily fetches the signal title (mirrors the Signals detail-sheet lazy `get`); falls back to the `SIG-xxxx` ref if unavailable.

---

## File Structure

**Backend (additive, no schema change):**

- Modify `db/app/src/utils/people.ts` — add `getPersonByPublicId`; extend `listPeople` + `ListPeopleParams` with `providers` / `types`.
- Modify `db/app/src/index.ts` — export `getPersonByPublicId`.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-people.ts` — add `get`; extend `list` input with `providers` / `types`.

**People UI (`apps/app/.../[slug]/(workspace)/people/`):**

- Create `_components/people-model.ts` — types inferred from `AppRouterOutputs`, provider/type label maps, helpers, page-size const.
- Create `_components/people-search-params.ts` — nuqs parsers + parse/serialize/toggle helpers.
- Create `_components/use-people-list-query.ts` — `useInfiniteQuery` wrapper over `people.list`.
- Create `_components/people-provider-icon.tsx` — provider glyph component.
- Create `_components/people-empty-state.tsx` — empty / no-results / error states.
- Create `_components/people-toolbar.tsx` — icon-only Filter (Provider, Type) + Display (List stub) + chips.
- Create `_components/people-table-view.tsx` — full-bleed table, footer count, load more.
- Create `_components/people-detail-content.tsx` — sheet body incl. Signals section.
- Create `_components/people-detail-sheet.tsx` — sheet shell + lazy `people.get`.
- Rewrite `_components/people-loading.tsx` — flush skeleton.
- Rewrite `_components/people-client.tsx` — thin shell wiring URL state + data + toolbar + table + sheet.
- Modify `page.tsx` — `flush` surface, prefetch the infinite list.

**Tests:**

- Modify `db/app/src/__tests__/people.test.ts` — `getPersonByPublicId` + `listPeople` provider/type filters.
- Modify `api/app/src/__tests__/workspace-people-router.test.ts` — `get` + filter input.
- Rewrite `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx`.

**Seeding:**

- Create `api/app/scripts/seed-people-signals.ts` — dev seed script.
- Modify `api/app/package.json` — add `seed:people` script.

**Commands** (run from repo root unless noted):
- DB tests: `pnpm --filter @db/app test`
- API tests: `pnpm --filter @api/app test`
- App tests: `pnpm --filter @lightfast/app test`
- Types: `pnpm --filter @db/app build` / `pnpm --filter @api/app build` / `pnpm typecheck`

---

## Task 1: `getPersonByPublicId` DB helper

**Files:**
- Modify: `db/app/src/utils/people.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/people.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `db/app/src/__tests__/people.test.ts` (append a new `describe` block; add `getPersonByPublicId` to the existing import from `../utils/people`):

```ts
import {
  escapeLikePattern,
  getPersonByPublicId,
  listPeople,
  upsertPeopleFromCandidates,
} from "../utils/people";

function makeGetDb(rows: Person[]) {
  const spies = {
    where: vi.fn(),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return { limit: spies.limit };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 7,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Jeevan Pillay",
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    normalizedIdentityValue: "jeevanp",
    identityKey: "identity_key",
    firstSeenSignalId: "signal_first",
    lastSeenSignalId: "signal_last",
    seenCount: 3,
    metadata: {},
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
    ...overrides,
  };
}

describe("getPersonByPublicId", () => {
  it("returns the org-scoped person when present", async () => {
    const person = makePerson();
    const { db } = makeGetDb([person]);

    await expect(
      getPersonByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: person.publicId,
      })
    ).resolves.toEqual(person);
  });

  it("returns undefined when no row matches", async () => {
    const { db } = makeGetDb([]);

    await expect(
      getPersonByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: "person_missing",
      })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @db/app test people`
Expected: FAIL — `getPersonByPublicId is not a function` (not exported yet).

- [ ] **Step 3: Implement `getPersonByPublicId`**

In `db/app/src/utils/people.ts`, add after `getPersonByIdentityKey`:

```ts
export async function getPersonByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<Person | undefined> {
  const [row] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.clerkOrgId, input.clerkOrgId),
        eq(people.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}
```

- [ ] **Step 4: Export it**

In `db/app/src/index.ts`, add `getPersonByPublicId` to the `./utils/people` export block (keep alphabetical-ish ordering):

```ts
export {
  getPersonByIdentityKey,
  getPersonByPublicId,
  type ListPeopleParams,
  listPeople,
  type UpsertPeopleCandidate,
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @db/app test people`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/people.ts db/app/src/index.ts db/app/src/__tests__/people.test.ts
git commit -m "feat(people): add getPersonByPublicId db helper"
```

---

## Task 2: Provider/type filters on `listPeople`

**Files:**
- Modify: `db/app/src/utils/people.ts`
- Test: `db/app/src/__tests__/people.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `db/app/src/__tests__/people.test.ts`. Reuse the `makeListDb` shape from `signals-list.test.ts` (a `select().from().where().orderBy().limit()` chain). Add this helper + tests:

```ts
function makeListDb(rows: Person[]) {
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
              return { limit: spies.limit };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("listPeople filters", () => {
  it("passes provider and type filters through without throwing and returns rows", async () => {
    const person = makePerson();
    const { db, spies } = makeListDb([person]);

    await expect(
      listPeople(db, {
        clerkOrgId: "org_test",
        providers: ["x", "email"],
        types: ["handle"],
        limit: 10,
      })
    ).resolves.toEqual({ items: [person], nextCursor: null });

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(11);
  });

  it("ignores empty provider/type arrays", async () => {
    const { db, spies } = makeListDb([]);

    await listPeople(db, {
      clerkOrgId: "org_test",
      providers: [],
      types: [],
      limit: 10,
    });

    expect(spies.where).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @db/app test people`
Expected: FAIL — `listPeople` rejects unknown `providers`/`types` params (TypeScript build error) or the type filter is ignored. (If it only fails to compile, that's the failing state.)

- [ ] **Step 3: Implement the filters**

In `db/app/src/utils/people.ts`:

1. Add `inArray` to the drizzle import:

```ts
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
```

2. Extend `ListPeopleParams`:

```ts
export interface ListPeopleParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  providers?: PersonIdentityProvider[];
  search?: string;
  types?: PersonIdentityType[];
}
```

3. Add the conditions inside `listPeople`'s `conditions` array (after the `searchPattern` entry, before the `cursor` entry):

```ts
    input.providers?.length
      ? inArray(people.identityProvider, input.providers)
      : undefined,
    input.types?.length
      ? inArray(people.identityType, input.types)
      : undefined,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @db/app test people`
Expected: PASS.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @db/app build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/people.ts db/app/src/__tests__/people.test.ts
git commit -m "feat(people): filter listPeople by provider and type"
```

---

## Task 3: `people.get` + filter input on the router

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-people.ts`
- Test: `api/app/src/__tests__/workspace-people-router.test.ts`

- [ ] **Step 1: Write the failing tests**

In `api/app/src/__tests__/workspace-people-router.test.ts`:

1. Extend the `@db/app` mock to include `getPersonByPublicId`:

```ts
const listPeopleMock = vi.fn();
const getPersonByPublicIdMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listPeople: listPeopleMock,
  getPersonByPublicId: getPersonByPublicIdMock,
}));
```

2. In `beforeEach`, reset the new mock:

```ts
  getPersonByPublicIdMock.mockReset();
  getPersonByPublicIdMock.mockResolvedValue(personRow);
```

3. Add tests:

```ts
describe("workspacePeopleRouter.list filters", () => {
  it("forwards provider and type filters to the db helper", async () => {
    await caller().people.list({ providers: ["x"], types: ["handle"] });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      limit: undefined,
      providers: ["x"],
      search: undefined,
      types: ["handle"],
    });
  });

  it("rejects unknown provider values", async () => {
    await expect(
      caller().people.list({
        providers: ["telegram" as unknown as "x"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.get", () => {
  it("returns the org-scoped person", async () => {
    await expect(
      caller().people.get({ publicId: personRow.publicId })
    ).resolves.toEqual(personRow);

    expect(getPersonByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      publicId: personRow.publicId,
    });
  });

  it("throws NOT_FOUND when the person is missing", async () => {
    getPersonByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      caller().people.get({ publicId: "person_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "unbound" },
      }).people.get({ publicId: personRow.publicId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getPersonByPublicIdMock).not.toHaveBeenCalled();
  });
});
```

> Note: the existing `list` tests call `listPeople` with exactly `{ clerkOrgId, cursor, limit, search }`. Update those three existing `toHaveBeenCalledWith` assertions to also include `providers: undefined` and `types: undefined`, since the handler now always forwards those keys (see Step 3).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @api/app test workspace-people`
Expected: FAIL — `people.get` is not a function on the caller; provider input not validated.

- [ ] **Step 3: Implement the router changes**

Rewrite `api/app/src/router/(pending-not-allowed)/workspace-people.ts`:

```ts
import { getPersonByPublicId, listPeople } from "@db/app";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

const listPeopleInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  providers: z.array(peopleIdentityProviderSchema).max(5).optional(),
  search: workspaceListSearchInput,
  types: z.array(peopleIdentityTypeSchema).max(3).optional(),
});

export const workspacePeopleRouter = {
  list: boundOrgProcedure.input(listPeopleInput).query(({ ctx, input }) =>
    listPeople(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      providers: input.providers?.length ? input.providers : undefined,
      search: input.search,
      types: input.types?.length ? input.types : undefined,
    })
  ),
  get: boundOrgProcedure
    .input(z.object({ publicId: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const person = await getPersonByPublicId(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.publicId,
      });

      if (!person) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      }

      return person;
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @api/app test workspace-people`
Expected: PASS.

- [ ] **Step 5: Typecheck the api package**

Run: `pnpm --filter @api/app build`
Expected: succeeds (this also confirms `AppRouterOutputs["org"]["workspace"]["people"]["get"]` is now available for the UI).

- [ ] **Step 6: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/workspace-people.ts" "api/app/src/__tests__/workspace-people-router.test.ts"
git commit -m "feat(people): add people.get and provider/type list filters"
```

---

## Task 4: `people-model.ts`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-model.ts`

- [ ] **Step 1: Create the model module**

```ts
import type { AppRouterOutputs } from "@api/app";

export type PeopleList = AppRouterOutputs["org"]["workspace"]["people"]["list"];
export type PersonRow = PeopleList["items"][number];
export type PersonProvider = PersonRow["identityProvider"];
export type PersonType = PersonRow["identityType"];

export const PEOPLE_PAGE_SIZE = 50;

export const peopleProviderOptions: {
  label: string;
  value: PersonProvider;
}[] = [
  { label: "Email", value: "email" },
  { label: "X", value: "x" },
  { label: "GitHub", value: "github" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Website", value: "website" },
];

export const peopleTypeOptions: {
  label: string;
  value: PersonType;
}[] = [
  { label: "Email", value: "email" },
  { label: "Handle", value: "handle" },
  { label: "Profile URL", value: "profile_url" },
];

export interface PeopleClassificationFilters {
  providers: PersonProvider[];
  types: PersonType[];
}

export function getPersonName(person: PersonRow) {
  return person.displayName ?? person.identityValue;
}

export function getPersonProviderLabel(provider: PersonProvider) {
  return (
    peopleProviderOptions.find((option) => option.value === provider)?.label ??
    provider
  );
}

export function getPersonTypeLabel(type: PersonType) {
  return (
    peopleTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}

/**
 * Short, display-only signal reference derived from a signal public id
 * (`signal_<uuid>` → `SIG-3F9A`). The full public id is still used for links;
 * this is only a compact label. Reworked when a person↔signal join exists.
 */
export function formatPersonSignalRef(signalId: string) {
  const raw = signalId.startsWith("signal_") ? signalId.slice(7) : signalId;
  const short = raw.replace(/-/g, "").slice(0, 4).toUpperCase();
  return short ? `SIG-${short}` : "Signal";
}

/**
 * The Signals column derives from the only two linkable refs plus the count.
 * `ref` is the most recent linkable signal; `more` is the count of additional
 * mentions (NOT a list we can expand — see the Honesty Constraint in the spec).
 */
export function getPersonSignals(person: PersonRow): {
  ref: string | null;
  more: number;
} {
  const ref = person.lastSeenSignalId ?? person.firstSeenSignalId ?? null;
  const more = Math.max(0, person.seenCount - 1);
  return { ref, more };
}

export function flattenPeoplePages(data: { pages: PeopleList[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app exec tsc --noEmit -p tsconfig.json` (or `pnpm typecheck`)
Expected: no errors from this file. If `AppRouterOutputs[...]["people"]["list"]` is unknown, re-run Task 3 Step 5 first (the api package must be built so app types resolve).

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-model.ts"
git commit -m "feat(people): add people-model types and helpers"
```

---

## Task 5: `people-search-params.ts`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`

- [ ] **Step 1: Create the parsers**

```ts
import { parseAsString } from "nuqs";
import {
  type PersonProvider,
  type PersonType,
  peopleProviderOptions,
  peopleTypeOptions,
} from "./people-model";

export const personProviderParser = parseAsString.withDefault("");
export const personTypeParser = parseAsString.withDefault("");
export const personParser = parseAsString;

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

export function parsePersonProviders(value: string): PersonProvider[] {
  return parseValues(
    value,
    peopleProviderOptions.map((option) => option.value)
  );
}

export function parsePersonTypes(value: string): PersonType[] {
  return parseValues(
    value,
    peopleTypeOptions.map((option) => option.value)
  );
}

export function serializePersonValues(values: readonly string[]) {
  return values.length > 0 ? values.join(",") : "";
}

export function togglePersonValue<T extends string>(
  values: readonly T[],
  value: T
): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts"
git commit -m "feat(people): add people search-param parsers"
```

---

## Task 6: `use-people-list-query.ts`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-list-query.ts`

- [ ] **Step 1: Create the query hook**

```ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  PEOPLE_PAGE_SIZE,
  type PeopleClassificationFilters,
} from "./people-model";

export function usePeopleListQuery({
  filters,
  search,
}: {
  filters: PeopleClassificationFilters;
  search: string;
}) {
  const trpc = useTRPC();
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: PEOPLE_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    types: filters.types.length ? filters.types : undefined,
  };

  const options = trpc.org.workspace.people.list.infiniteQueryOptions(input, {
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

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-list-query.ts"
git commit -m "feat(people): add infinite people list query hook"
```

---

## Task 7: `people-provider-icon.tsx`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-provider-icon.tsx`

- [ ] **Step 1: Create the glyph component**

```tsx
import { AtSign, Github, Globe, Linkedin, Mail } from "lucide-react";
import type { ComponentType } from "react";
import type { PersonProvider } from "./people-model";

const PROVIDER_ICONS: Record<
  PersonProvider,
  ComponentType<{ className?: string }>
> = {
  email: Mail,
  github: Github,
  linkedin: Linkedin,
  website: Globe,
  x: AtSign,
};

export function PersonProviderIcon({
  className,
  provider,
}: {
  className?: string;
  provider: PersonProvider;
}) {
  const Icon = PROVIDER_ICONS[provider] ?? Globe;
  return <Icon aria-hidden="true" className={className} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-provider-icon.tsx"
git commit -m "feat(people): add provider glyph component"
```

---

## Task 8: `people-empty-state.tsx`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-empty-state.tsx`

- [ ] **Step 1: Create the empty state (mirrors SignalsEmptyState)**

```tsx
import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";

export function PeopleEmptyState({
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
  const minHeight = size === "page" ? "min-h-96" : "min-h-32";

  return (
    <div className="px-3 py-3">
      <div
        className={`flex ${minHeight} flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center`}
      >
        <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <UsersRound className="size-4 text-muted-foreground" />
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

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-empty-state.tsx"
git commit -m "feat(people): add empty state component"
```

---

## Task 9: `people-toolbar.tsx`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx`

- [ ] **Step 1: Create the toolbar (icon-only Filter + Display, chips)**

Mirrors `signals-toolbar.tsx` styling exactly. Filter groups: Provider, Type. Display is a parity stub with a single checked "List" option.

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  AtSign,
  Check,
  List,
  ListFilter,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  getPersonProviderLabel,
  getPersonTypeLabel,
  type PeopleClassificationFilters,
  type PersonProvider,
  type PersonType,
  peopleProviderOptions,
  peopleTypeOptions,
} from "./people-model";

type FilterGroupId = "provider" | "type";
type IconComponent = ComponentType<{ className?: string }>;

interface FilterGroup {
  count: number;
  id: FilterGroupId;
  icon: IconComponent;
  label: string;
}

export function PeopleToolbar({
  filters,
  onClearFilterGroup,
  onToggleProvider,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleType: (value: PersonType) => void;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.providers.length,
      id: "provider",
      icon: AtSign,
      label: "Provider",
    },
    {
      count: filters.types.length,
      id: "type",
      icon: Tag,
      label: "Type",
    },
  ];
  const activeFilterCount = filters.providers.length + filters.types.length;

  return (
    <div
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-1.5 border-border/70 border-t px-3 py-1"
      data-testid="people-toolbar"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
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
              <ListFilter
                aria-hidden="true"
                className="size-3"
                data-testid="people-filter-icon"
              />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="-top-1 -right-1 absolute flex size-3.5 items-center justify-center rounded-full border border-background bg-muted font-medium text-[0.55rem] text-muted-foreground leading-none"
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
              <PeopleFilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onToggleProvider={onToggleProvider}
                onToggleType={onToggleType}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PeopleFilterChip
          count={filters.providers.length}
          icon={AtSign}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getPersonProviderLabel(value))
          )}
        />
        <PeopleFilterChip
          count={filters.types.length}
          icon={Tag}
          label="Type"
          onClear={() => onClearFilterGroup("type")}
          value={formatChipValue(
            filters.types.map((value) => getPersonTypeLabel(value))
          )}
        />
      </div>

      <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Display options"
              className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              size="icon-sm"
              title="Display options"
              type="button"
              variant="ghost"
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="size-3"
                data-testid="people-display-icon"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="bg-muted/50" disabled>
              <List aria-hidden="true" className="size-3.5" />
              <span>List</span>
              <Check
                aria-hidden="true"
                className="ml-auto size-3.5 text-muted-foreground"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function PeopleFilterSubMenu({
  filters,
  group,
  onToggleProvider,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  group: FilterGroup;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleType: (value: PersonType) => void;
}) {
  const Icon = group.icon;
  const options =
    group.id === "provider"
      ? peopleProviderOptions.map((option) => ({
          checked: filters.providers.includes(option.value),
          label: option.label,
          onToggle: () => onToggleProvider(option.value),
          value: option.value as string,
        }))
      : peopleTypeOptions.map((option) => ({
          checked: filters.types.includes(option.value),
          label: option.label,
          onToggle: () => onToggleType(option.value),
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

function PeopleFilterChip({
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
      className="flex h-6 shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-muted/25 text-sm"
      onClick={onClear}
      type="button"
    >
      <span className="flex h-full items-center gap-2 border-border/70 border-r px-3 text-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {label}
      </span>
      <span className="flex h-full items-center border-border/70 border-r px-3 text-muted-foreground">
        is any of
      </span>
      <span className="flex h-full items-center px-3 text-muted-foreground">
        {value}
      </span>
      <span className="flex h-full items-center border-border/70 border-l px-2 text-muted-foreground hover:text-foreground">
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

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx"
git commit -m "feat(people): add icon-only filter/display toolbar"
```

---

## Task 10: `people-table-view.tsx`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-table-view.tsx`

- [ ] **Step 1: Create the full-bleed table view**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  ChevronDown,
  Loader2,
  RefreshCw,
  Signal as SignalIcon,
  UserRound,
} from "lucide-react";
import { PeopleEmptyState } from "./people-empty-state";
import {
  formatPersonSignalRef,
  getPersonName,
  getPersonSignals,
  getPersonTypeLabel,
  type PersonRow,
} from "./people-model";
import { PersonProviderIcon } from "./people-provider-icon";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3";

export function PeopleTableView({
  fetchNextPage,
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  onSelectPerson,
  refetch,
  rows,
  selectedPersonId,
}: {
  fetchNextPage: () => void;
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onSelectPerson: (publicId: string) => void;
  refetch: () => void;
  rows: PersonRow[];
  selectedPersonId: string | null;
}) {
  if (isError && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load people for this workspace.
        </p>
        <Button
          aria-label="Retry loading people"
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
      <PeopleEmptyState
        description="People discovered by the signal pipeline will appear here."
        title="No people yet"
      />
    );
  }

  if (rows.length === 0 && hasActiveFilters) {
    return (
      <PeopleEmptyState
        description="Try a different provider or type filter."
        title="No matching people"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`${ROW_GRID} h-9 border-border/60 border-b bg-muted/20 px-4 text-muted-foreground text-xs`}
        >
          <span>Name</span>
          <span>Identity</span>
          <span>Type</span>
          <span>Signals</span>
        </div>

        {rows.map((person) => (
          <PeopleTableRow
            isSelected={selectedPersonId === person.publicId}
            key={person.publicId}
            onSelect={() => onSelectPerson(person.publicId)}
            person={person}
          />
        ))}

        {hasNextPage ? (
          <div className="px-3 py-3">
            <Button
              aria-label="Load more people"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isFetchingNextPage ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <ChevronDown aria-hidden="true" className="size-3.5" />
              )}
              {isFetchingNextPage ? "Loading" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-border/60 border-t px-4 py-2.5 text-muted-foreground text-xs">
        <span>
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
        {isFetching && !isFetchingNextPage ? (
          <span className="flex items-center gap-1 text-muted-foreground/70">
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PeopleTableRow({
  isSelected,
  onSelect,
  person,
}: {
  isSelected: boolean;
  onSelect: () => void;
  person: PersonRow;
}) {
  const name = getPersonName(person);
  const { more, ref } = getPersonSignals(person);

  return (
    <button
      aria-pressed={isSelected}
      className={
        `${ROW_GRID} min-h-12 w-full border-border/40 border-b px-4 text-left hover:bg-muted/20` +
        (isSelected ? " bg-muted/30" : " bg-background")
      }
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <UserRound
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground/70"
        />
        <span
          className={
            "min-w-0 truncate text-sm" +
            (person.displayName
              ? " font-medium text-foreground"
              : " text-muted-foreground")
          }
        >
          {name}
        </span>
      </span>

      <span className="flex min-w-0 items-center gap-2.5">
        <PersonProviderIcon
          className="size-3.5 shrink-0 text-muted-foreground/70"
          provider={person.identityProvider}
        />
        <span className="min-w-0 truncate font-mono text-foreground text-sm">
          {person.identityValue}
        </span>
      </span>

      <span className="truncate text-muted-foreground text-sm">
        {getPersonTypeLabel(person.identityType)}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        {ref ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 font-mono text-muted-foreground text-xs">
            <SignalIcon aria-hidden="true" className="size-3" />
            {formatPersonSignalRef(ref)}
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-sm">—</span>
        )}
        {more > 0 ? (
          <span className="text-muted-foreground/60 text-xs">+{more}</span>
        ) : null}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-table-view.tsx"
git commit -m "feat(people): add full-bleed people table view"
```

---

## Task 11: `people-detail-content.tsx` + `people-detail-sheet.tsx`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-content.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-sheet.tsx`

- [ ] **Step 1: Create the detail content**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  AtSign,
  Hash,
  Link2,
  Signal as SignalIcon,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTRPC } from "~/trpc/react";
import {
  formatPersonSignalRef,
  getPersonName,
  getPersonProviderLabel,
  getPersonTypeLabel,
  type PersonRow,
} from "./people-model";
import { PersonProviderIcon } from "./people-provider-icon";

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
      <div className="min-w-0 flex-1 break-words text-foreground text-sm">
        {children}
      </div>
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
      <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function PersonSignalLink({
  signalId,
  slug,
}: {
  signalId: string;
  slug: string;
}) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: signalId },
      { enabled: Boolean(signalId) }
    )
  );
  const title = query.data
    ? (query.data.classification?.title ?? query.data.input)
    : null;

  return (
    <Link
      className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/30"
      href={`/${slug}/signals?signal=${signalId}`}
    >
      <SignalIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span className="font-mono text-muted-foreground text-xs">
        {formatPersonSignalRef(signalId)}
      </span>
      <span className="min-w-0 truncate text-foreground text-sm">
        {title ?? "Open signal"}
      </span>
    </Link>
  );
}

export function PeopleDetailContent({
  closeSlot,
  onCopyLink,
  person,
  slug,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  person: PersonRow;
  slug: string;
}) {
  const name = getPersonName(person);
  const createdAt = new Date(person.createdAt);
  const updatedAt = new Date(person.updatedAt);
  const metadata = person.metadata as {
    confidence?: number;
    rationale?: string;
    source?: string;
  };
  const iconClass = "size-4 shrink-0";
  const firstSeen = person.firstSeenSignalId;
  const lastSeen = person.lastSeenSignalId;
  const signalIds = Array.from(
    new Set([lastSeen, firstSeen].filter((id): id is string => Boolean(id)))
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <PersonProviderIcon
          className="size-4 text-muted-foreground"
          provider={person.identityProvider}
        />
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground text-xs">
          {getPersonProviderLabel(person.identityProvider)}
        </span>
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
          {name}
        </h2>

        <div className="flex flex-col">
          <PropertyRow icon={<AtSign className={iconClass} />} label="Provider">
            {getPersonProviderLabel(person.identityProvider)}
          </PropertyRow>
          <PropertyRow icon={<Tag className={iconClass} />} label="Type">
            {getPersonTypeLabel(person.identityType)}
          </PropertyRow>
          <PropertyRow icon={<Hash className={iconClass} />} label="Identity">
            <span className="font-mono">{person.identityValue}</span>
          </PropertyRow>
          {person.normalizedIdentityValue !== person.identityValue ? (
            <PropertyRow
              icon={<Hash className={iconClass} />}
              label="Normalized"
            >
              <span className="font-mono text-muted-foreground">
                {person.normalizedIdentityValue}
              </span>
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<SignalIcon className={iconClass} />} label="Seen">
            {person.seenCount}{" "}
            {person.seenCount === 1 ? "signal" : "signals"}
          </PropertyRow>
          {typeof metadata.confidence === "number" ? (
            <PropertyRow
              icon={<Sparkles className={iconClass} />}
              label="Confidence"
            >
              {Math.round(metadata.confidence * 100)}%
            </PropertyRow>
          ) : null}
        </div>

        <div className="my-6 border-border/60 border-t" />

        <div className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Signals
            </h3>
            <p className="text-muted-foreground text-sm">
              Mentioned in {person.seenCount}{" "}
              {person.seenCount === 1 ? "signal" : "signals"}.
            </p>
            {signalIds.length > 0 ? (
              <div className="flex flex-col gap-2 pt-1">
                {signalIds.map((signalId) => (
                  <PersonSignalLink
                    key={signalId}
                    signalId={signalId}
                    slug={slug}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {metadata.rationale ? (
            <BodySection label="Rationale">{metadata.rationale}</BodySection>
          ) : null}
          {metadata.source ? (
            <BodySection label="Source">
              <span className="font-mono text-muted-foreground text-xs">
                {metadata.source}
              </span>
            </BodySection>
          ) : null}
        </div>
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={createdAt.toISOString()}>
          First seen {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </span>
        <span aria-hidden="true"> · </span>
        <span title={updatedAt.toISOString()}>
          Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the detail sheet (mirrors signal-detail-sheet)**

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
import { PeopleDetailContent } from "./people-detail-content";
import { getPersonName, type PersonRow } from "./people-model";

export function PeopleDetailSheet({
  initialPerson,
  onOpenChange,
  publicId,
  slug,
}: {
  initialPerson?: PersonRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
  slug: string;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const hasInitial = !!initialPerson && initialPerson.publicId === publicId;

  const query = useQuery(
    trpc.org.workspace.people.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasInitial && Boolean(publicId) }
    )
  );

  const person = hasInitial ? initialPerson : query.data;

  function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }
    void navigator.clipboard?.writeText(window.location.href);
    toast.success("Link copied", {
      description: "Anyone with access can open this person.",
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="inset-y-3 right-3 left-auto h-auto w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-md"
        showCloseButton={!person}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {person ? getPersonName(person) : "Person details"}
          </SheetTitle>
        </SheetHeader>

        {person ? (
          <PeopleDetailContent
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
            onCopyLink={handleCopyLink}
            person={person}
            slug={slug}
          />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">
              Person not found
            </p>
            <p className="text-muted-foreground text-sm">
              It may have been removed or belongs to another organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-6" data-testid="person-detail-skeleton">
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

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-content.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-sheet.tsx"
git commit -m "feat(people): add detail sheet with signals section"
```

---

## Task 12: Rewrite `people-loading.tsx` (flush skeleton)

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function PeopleLoading() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex min-h-10 items-center gap-1.5 border-border/70 border-t px-3 py-1">
        <Skeleton className="size-6 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="size-6 rounded-lg" />
        </div>
      </div>
      <div className="grid h-9 grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3 border-border/60 border-b bg-muted/20 px-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid min-h-12 grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3 border-border/40 border-b px-4"
          key={index}
        >
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading.tsx"
git commit -m "feat(people): flush loading skeleton"
```

---

## Task 13: Rewrite `people-client.tsx`

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import {
  flattenPeoplePages,
  type PeopleClassificationFilters,
  type PersonRow,
} from "./people-model";
import {
  parsePersonProviders,
  parsePersonTypes,
  personParser,
  personProviderParser,
  personTypeParser,
  serializePersonValues,
  togglePersonValue,
} from "./people-search-params";
import { PeopleDetailSheet } from "./people-detail-sheet";
import { PeopleTableView } from "./people-table-view";
import { PeopleToolbar } from "./people-toolbar";
import { usePeopleListQuery } from "./use-people-list-query";

export function PeopleClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [providerState, setProviderState] = useQueryState(
    "provider",
    personProviderParser
  );
  const [typeState, setTypeState] = useQueryState("type", personTypeParser);
  const [selectedPersonId, setSelectedPersonId] = useQueryState(
    "person",
    personParser
  );

  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      providers: parsePersonProviders(providerState),
      types: parsePersonTypes(typeState),
    }),
    [providerState, typeState]
  );
  const hasActiveFilters =
    filters.providers.length > 0 || filters.types.length > 0;

  const { query } = usePeopleListQuery({ filters, search: "" });
  const rows = flattenPeoplePages(query.data);
  const peopleByPublicId = useMemo(() => {
    const map = new Map<string, PersonRow>();
    for (const person of rows) {
      map.set(person.publicId, person);
    }
    return map;
  }, [rows]);

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">People</h1>
      <PeopleToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            void setProviderState("");
          } else {
            void setTypeState("");
          }
        }}
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
      />

      <PeopleTableView
        fetchNextPage={() => void query.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!query.hasNextPage}
        isError={query.isError}
        isFetching={query.isFetching}
        isFetchingNextPage={query.isFetchingNextPage}
        onSelectPerson={(publicId) => void setSelectedPersonId(publicId)}
        refetch={() => void query.refetch()}
        rows={rows}
        selectedPersonId={selectedPersonId}
      />

      <PeopleDetailSheet
        initialPerson={
          selectedPersonId ? peopleByPublicId.get(selectedPersonId) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedPersonId(null);
          }
        }}
        publicId={selectedPersonId}
        slug={slug}
      />
    </WorkspaceSurface>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx"
git commit -m "feat(people): rework client into full-bleed table shell"
```

---

## Task 14: Update `page.tsx` (flush + infinite prefetch)

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleClient } from "./_components/people-client";
import { PeopleLoading } from "./_components/people-loading";
import { PEOPLE_PAGE_SIZE } from "./_components/people-model";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  prefetch(
    trpc.org.workspace.people.list.infiniteQueryOptions(
      { limit: PEOPLE_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 60_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<PeopleLoading />}>
        <PeopleClient />
      </Suspense>
    </HydrateClient>
  );
}
```

> Note: `WorkspaceSurface` moves into `PeopleClient` (variant `flush`), matching `SignalsPage`/`SignalsClient`.

- [ ] **Step 2: Typecheck the app**

Run: `pnpm typecheck`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page.tsx"
git commit -m "feat(people): flush page surface with infinite prefetch"
```

---

## Task 15: Update People component + page tests

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx`
- Rewrite: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`

- [ ] **Step 1: Update the page test**

The page now prefetches `infiniteQueryOptions` instead of `queryOptions`. Replace the mock + assertions in `people-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infiniteQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "people", "list"],
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
            infiniteQueryOptions: infiniteQueryOptionsMock,
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
  infiniteQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("people page", () => {
  it("prefetches the infinite people list before rendering the client island", () => {
    render(PeoplePage());

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 50 },
      expect.objectContaining({ staleTime: 60_000 })
    );
    expect(prefetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-people")).toHaveTextContent(
      "People client"
    );
  });
});
```

- [ ] **Step 2: Rewrite the client test**

Replace `people-client.test.tsx` entirely. It mocks the infinite query hook, nuqs, and `next/navigation`, and asserts the new table renders rows, the Signals chip, and empty/no-results states:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn();
const infiniteQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "people", "list", input],
}));
const getQueryOptionsMock = vi.fn();

const queryStates: Record<string, string | null> = {
  provider: "",
  type: "",
  person: null,
};
const setProvider = vi.fn();
const setType = vi.fn();
const setPerson = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        people: {
          list: { infiniteQueryOptions: infiniteQueryOptionsMock },
          get: { queryOptions: getQueryOptionsMock },
        },
        signals: {
          get: { queryOptions: vi.fn(() => ({ queryKey: ["signals", "get"] })) },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => useInfiniteQueryMock(),
  useQuery: () => ({ data: undefined, isError: false }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "lightfast" }),
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "parser" },
  useQueryState: (key: string) => {
    const setters: Record<string, (value: string | null) => void> = {
      provider: setProvider,
      type: setType,
      person: setPerson,
    };
    return [queryStates[key] ?? null, setters[key] ?? vi.fn()];
  },
}));

const personRow = {
  clerkOrgId: "org_test",
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  displayName: "Jeevan Pillay",
  firstSeenSignalId: "signal_first",
  id: 1,
  identityKey: "identity_key",
  identityProvider: "x",
  identityType: "handle",
  identityValue: "@jeevanp",
  lastSeenSignalId: "signal_3f9a0000-0000-0000-0000-000000000000",
  metadata: {},
  normalizedIdentityValue: "jeevanp",
  publicId: "person_123e4567-e89b-12d3-a456-426614174000",
  seenCount: 3,
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

function mockRows(items: unknown[]) {
  useInfiniteQueryMock.mockReturnValue({
    data: { pages: [{ items, nextCursor: null }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  queryStates.provider = "";
  queryStates.type = "";
  queryStates.person = null;
  setProvider.mockClear();
  setType.mockClear();
  setPerson.mockClear();
  infiniteQueryOptionsMock.mockClear();
  mockRows([personRow]);
});

const { PeopleClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client"
);

describe("PeopleClient", () => {
  it("renders people rows with identity and a signal ref", () => {
    render(<PeopleClient />);

    expect(screen.getByText("Jeevan Pillay")).toBeInTheDocument();
    expect(screen.getByText("@jeevanp")).toBeInTheDocument();
    expect(screen.getByText("Handle")).toBeInTheDocument();
    expect(screen.getByText("SIG-3F9A")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders the empty state when there are no people and no filters", () => {
    mockRows([]);
    render(<PeopleClient />);
    expect(screen.getByText("No people yet")).toBeInTheDocument();
  });

  it("renders the no-results state when filters exclude all people", () => {
    queryStates.provider = "email";
    mockRows([]);
    render(<PeopleClient />);
    expect(screen.getByText("No matching people")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the app tests**

Run: `pnpm --filter @lightfast/app test people`
Expected: PASS for both files.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-page.test.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx"
git commit -m "test(people): cover reworked table client and infinite prefetch"
```

---

## Task 16: Seed script — people-mentioning signals

**Files:**
- Create: `api/app/scripts/seed-people-signals.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Create the seed script**

```ts
/**
 * Dev-only seed: creates people-mentioning signals in a target org so the real
 * pipeline (classify-signal -> classify-people) populates the People surface.
 *
 * Requires the local stack running (`pnpm dev` with local Inngest + AI creds)
 * and DATABASE_* env pointed at the target org's branch. Nondeterministic:
 * the AI does the extraction, so verify results at /<slug>/people afterward.
 *
 * Run from api/app:
 *   SEED_CLERK_ORG_ID=org_xxx SEED_CREATED_BY_USER_ID=user_xxx \
 *     pnpm with-env tsx scripts/seed-people-signals.ts
 */
import { db } from "@db/app/client";
import { createAndQueueSignal } from "../src/signals/create-signal";

const SEED_INPUTS = [
  "Reply to rauchg@vercel.com about the microfrontends partnership proposal.",
  "DM @leerob on X about the App Router demo we promised for next week.",
  "Follow up with sarah@netlify.com after the edge functions call on Thursday.",
  "Review github.com/shadcn feedback on the dialog primitive PR.",
  "Connect with linkedin.com/in/leerob about the DX advocate role.",
  "Email support@planetscale.com about the Vitess branch quota increase.",
  "Ping @theo on X to coordinate the t3 stack collab stream.",
  "Schedule an intro call with hello@resend.com about transactional email.",
  "Thank Sarah Drasner (sarah@netlify.com) for the conference shoutout.",
  "Ask jamie@upstash.com about Redis rate-limit pricing for our tier.",
  "Loop in guillermo (rauchg@vercel.com) on the enterprise SSO thread.",
  "Reach out to @shuding_ on X about the Next.js cache components feedback.",
];

async function main() {
  const clerkOrgId = process.env.SEED_CLERK_ORG_ID;
  const createdByUserId = process.env.SEED_CREATED_BY_USER_ID;

  if (!clerkOrgId || !createdByUserId) {
    throw new Error(
      "Set SEED_CLERK_ORG_ID and SEED_CREATED_BY_USER_ID env vars before seeding."
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeding ${SEED_INPUTS.length} signals into org ${clerkOrgId}...`
  );

  for (const input of SEED_INPUTS) {
    const result = await createAndQueueSignal(db, {
      clerkOrgId,
      createdByApiKeyId: null,
      createdByUserId,
      input,
    });
    // eslint-disable-next-line no-console
    console.log(`  queued ${result.id}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    "Done. Watch the Inngest dashboard / dev logs for classify-people, then check /<slug>/people."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
```

- [ ] **Step 2: Add the package script**

In `api/app/package.json`, add to `"scripts"`:

```json
    "seed:people": "with-env tsx scripts/seed-people-signals.ts",
```

(Confirm `tsx` is available to `@api/app`; if not present in its devDependencies, add it the same way `@db/app` has it, or run via `pnpm --filter @db/app exec tsx`.)

- [ ] **Step 3: Verify it typechecks (no run yet)**

Run: `cd api/app && pnpm with-env tsc --noEmit -p tsconfig.json`
Expected: succeeds. (Do NOT run the seed here — running it requires the live stack and writes real signals; that is the operational step in Task 17.)

- [ ] **Step 4: Commit**

```bash
git add api/app/scripts/seed-people-signals.ts api/app/package.json
git commit -m "feat(people): add dev seed script for people-mentioning signals"
```

---

## Task 17: Run the seed + verify end-to-end (operational, not committed)

**This task produces no commit. It is the live, nondeterministic seeding run.**

- [ ] **Step 1: Resolve the target org + user ids**

Get the `lightfast` org's Clerk id and a member user id (the `clerk` CLI skill can list these), e.g.:

```bash
clerk organizations list      # find the lightfast org id (org_...)
clerk users list              # find your user id (user_...)
```

- [ ] **Step 2: Start the local stack**

In a separate terminal (per CLAUDE.md):

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Confirm local Inngest is running and `DATABASE_*` + AI provider creds are present in `apps/app/.vercel/.env.development.local` (load the `lightfast-local-infra` skill if the DB branch isn't set up).

- [ ] **Step 3: Run the seed**

```bash
cd api/app
SEED_CLERK_ORG_ID=org_xxx SEED_CREATED_BY_USER_ID=user_xxx pnpm seed:people
```

Expected: 12 lines `queued signal_...`.

- [ ] **Step 4: Watch classification complete**

Watch the Inngest dashboard / dev logs until `classify-signal` then `classify-people` finish for the seeded signals. People rows are upserted only for signals the classifier routes (`routing.classifyPeople.shouldRun === true`).

- [ ] **Step 5: Verify in the UI**

Open `https://<wt.>lightfast.localhost` → the lightfast workspace → People. Confirm:
- Rows render full-bleed with Name · Identity · Type · Signals.
- A `SIG-xxxx` chip appears in the Signals column.
- Filter → Provider / Type narrows the list; chips show and clear.
- Clicking a row opens the detail sheet; the Signals section links back to the signal.

If too few people were extracted (nondeterministic), add or sharpen `SEED_INPUTS` (make the identity explicit) and re-run Step 3.

---

## Self-Review

**Spec coverage:**
- Full-bleed table (Name/Identity/Type/Signals) → Tasks 10, 13, 14. ✓
- Icon-only Filter + Display toolbar → Task 9. ✓
- Row-click detail sheet → Tasks 11, 13. ✓
- Signals column + honest `+N` / sheet Signals section → Tasks 4, 10, 11. ✓
- Provider/Type filters (additive) → Tasks 2, 3, 9. ✓
- `people.get` for the sheet → Task 3, 11. ✓
- Seed via real pipeline → Tasks 16, 17. ✓
- No schema / pipeline change → confirmed (no migration, no workflow edits). ✓
- Display sort deferred (documented deviation) → Decision #1. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output.

**Type consistency:** `PersonRow`, `PersonProvider`, `PersonType`, `PeopleClassificationFilters`, `PEOPLE_PAGE_SIZE`, `getPersonName`, `getPersonSignals`, `formatPersonSignalRef`, `flattenPeoplePages`, `usePeopleListQuery`, `PeopleToolbar`, `PeopleTableView`, `PeopleDetailSheet`/`PeopleDetailContent`, `PeopleEmptyState`, `PersonProviderIcon` are defined once (Tasks 4–11) and used consistently. Router `get` input (`{ publicId: string }`) matches the sheet's `people.get` call. `listPeople` params (`providers`/`types`) match the router forwarding and the query hook input.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-30-people-ui-rework.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
