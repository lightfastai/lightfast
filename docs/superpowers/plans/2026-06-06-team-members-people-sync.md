# Team Members People Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically project accepted Clerk organization members into People as active or former team-member records.

**Architecture:** Keep Clerk as the source of truth and add a scheduled Inngest reconciliation job that syncs accepted memberships into `lightfast_org_people`. The DB layer owns identity-key upserts, source/status filters, and former-member marking; the API service owns Clerk pagination and per-org isolation; the UI adds source/status filters and a built-in Team Members preset.

**Tech Stack:** pnpm monorepo, TypeScript, Drizzle ORM, Vitest, tRPC, Inngest cron, Clerk Backend API, Next.js React UI, nuqs search params.

---

## Reference

Design spec: `docs/superpowers/specs/2026-06-06-team-members-people-design.md`

Deferred webhook issue: https://github.com/lightfastai/lightfast/issues/821

## Scope Check

This plan covers one coherent feature: accepted Clerk org memberships projected into People. It intentionally does not implement Clerk webhooks, person graph merging, pending invitation indexing, or a manual sync button.

## File Map

### Shared Validation

- Modify `packages/app-validation/src/schemas/people.ts`
  - Add `personSourceSchema`, `personMemberStatusSchema`, and exported types.
- Modify `packages/app-validation/src/__tests__/people.test.ts`
  - Cover source/status vocab.

### DB Schema And Utilities

- Modify `db/app/src/schema/tables/org-people.ts`
  - Add explicit team-member projection columns.
- Modify `db/app/src/schema/tables/org-people-views.ts`
  - Extend saved People view config with source/status filters.
- Modify `db/app/src/schema/index.ts`
  - Export new People source/status types.
- Modify `db/app/src/schema/tables/index.ts`
  - Export new People source/status types.
- Modify `db/app/src/index.ts`
  - Export new DB utilities and new schema types.
- Modify `db/app/src/utils/people.ts`
  - Add source/status filters to `listPeople`.
  - Ensure signal-created rows default to `personSource = "signal"`.
- Create `db/app/src/utils/people-team-members.ts`
  - Normalize member candidates.
  - Upsert accepted members into People by normalized email identity key.
  - Mark previously synced active members as former after successful fetches.
- Modify `db/app/src/utils/namespaces.ts`
  - Add `listActiveOrgNamespaceClerkOrgIds`.
- Modify `db/app/src/__tests__/people.test.ts`
  - Cover source/status filters and unchanged signal provenance.
- Create `db/app/src/__tests__/people-team-members.test.ts`
  - Cover member upsert, signal-row upgrade, former marking, skipped emails.
- Modify `db/app/src/__tests__/people-views.test.ts`
  - Cover saved view config with source/status filters.
- Modify `db/app/src/__tests__/namespace-repository.test.ts`
  - Add org namespace pagination coverage if this remains the best namespace utility test file.
- Generate Drizzle migration files with `pnpm --filter @db/app db:generate`.

### API Service And Inngest

- Create `api/app/src/services/team-members/people-sync.ts`
  - Page Clerk organization memberships.
  - Convert accepted memberships into DB sync candidates.
  - Sync one org with per-org result counts.
- Create `api/app/src/services/team-members/index.ts`
  - Re-export the service.
- Create `api/app/src/__tests__/team-member-people-sync.test.ts`
  - Cover Clerk pagination, skipped email members, and per-org failure isolation.
- Create `api/app/src/inngest/workflow/team-member-reconciler.ts`
  - Run `*/15 * * * *`.
  - Page active org namespace ids.
  - Call the sync service per org.
- Modify `api/app/src/inngest/index.ts`
  - Register `teamMemberReconciler`.
- Create `api/app/src/__tests__/team-member-reconciler-workflow.test.ts`
  - Cover cron registration and result counts.

### tRPC

- Modify `api/app/src/router/(pending-not-allowed)/workspace-people.ts`
  - Accept `sources` and `memberStatuses`.
  - Forward filters to DB.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts`
  - Persist `sources` and `memberStatuses` in People view config.
- Modify `api/app/src/__tests__/workspace-people-router.test.ts`
  - Cover source/status forwarding and validation.
- Modify `api/app/src/__tests__/workspace-people-views-router.test.ts`
  - Cover saved views with new filters.

### UI

- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/views/view-switcher.tsx`
  - Support built-in non-deletable preset views beside All.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/views/partition-views.ts`
  - Keep saved view partitioning unchanged; type can remain compatible.
- Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/views-view-switcher.test.tsx`
  - Cover built-in non-deletable presets in the shared view switcher.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-model.ts`
  - Add source/status types, labels, filter config, and member badge helpers.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`
  - Add `source` and `memberStatus` params plus parse/serialize helpers.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-views-model.ts`
  - Persist and apply source/status filters.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.tsx`
  - Add the built-in Team Members preset.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`
  - Read/write source/status query params and pass filters to the query and toolbar.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-list-query.ts`
  - Forward `sources` and `memberStatuses`.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx`
  - Add Source and Member Status filter groups.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-table-view.tsx`
  - Render active/former team-member badges.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-content.tsx`
  - Render team-member status, role, and last synced time.
- Modify existing People UI tests:
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.test.tsx`
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-sheet.test.tsx`
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`

---

## Task 1: Shared People Source/Member Vocabulary And Schema

**Files:**
- Modify: `packages/app-validation/src/schemas/people.ts`
- Modify: `packages/app-validation/src/__tests__/people.test.ts`
- Modify: `db/app/src/schema/tables/org-people.ts`
- Modify: `db/app/src/schema/tables/org-people-views.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/index.ts`
- Generated: `db/app/src/migrations/*`
- Generated: `db/app/src/migrations/meta/*`

- [ ] **Step 1: Add failing validation tests**

Replace the import block in `packages/app-validation/src/__tests__/people.test.ts` with:

```ts
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
  personMemberStatusSchema,
  personSourceSchema,
} from "../schemas/people";
```

Append these tests to the same file:

```ts

describe("person source schemas", () => {
  it("accepts supported people row sources", () => {
    expect(personSourceSchema.options).toEqual([
      "signal",
      "team_member",
      "mixed",
    ]);
  });

  it("accepts supported member statuses", () => {
    expect(personMemberStatusSchema.options).toEqual(["active", "former"]);
  });

  it("rejects unsupported source and member status values", () => {
    expect(() => personSourceSchema.parse("invitation")).toThrow();
    expect(() => personMemberStatusSchema.parse("pending")).toThrow();
  });
});
```

- [ ] **Step 2: Run validation tests and verify failure**

Run:

```bash
pnpm --filter @repo/app-validation test src/__tests__/people.test.ts
```

Expected: FAIL because `personSourceSchema` and `personMemberStatusSchema` are not exported.

- [ ] **Step 3: Implement validation schemas**

Update `packages/app-validation/src/schemas/people.ts`:

```ts
import { z } from "zod";

// Shared by AI people extraction and DB persistence; keep provider/type
// vocabulary centralized so the classifier cannot emit values the DB rejects.
export const peopleIdentityProviderSchema = z.enum([
  "email",
  "x",
  "linkedin",
  "github",
  "website",
]);

export const peopleIdentityTypeSchema = z.enum([
  "email",
  "handle",
  "profile_url",
]);

export const personSourceSchema = z.enum([
  "signal",
  "team_member",
  "mixed",
]);

export const personMemberStatusSchema = z.enum(["active", "former"]);

export type PersonIdentityProvider = z.infer<
  typeof peopleIdentityProviderSchema
>;
export type PersonIdentityType = z.infer<typeof peopleIdentityTypeSchema>;
export type PersonSource = z.infer<typeof personSourceSchema>;
export type PersonMemberStatus = z.infer<typeof personMemberStatusSchema>;
```

- [ ] **Step 4: Run validation tests and verify pass**

Run:

```bash
pnpm --filter @repo/app-validation test src/__tests__/people.test.ts
```

Expected: PASS.

- [ ] **Step 5: Extend People DB schema**

Update `db/app/src/schema/tables/org-people.ts` imports:

```ts
import type {
  PersonIdentityProvider,
  PersonIdentityType,
  PersonMemberStatus,
  PersonSource,
} from "@repo/app-validation/schemas";
```

Update exported type line:

```ts
export type {
  PersonIdentityProvider,
  PersonIdentityType,
  PersonMemberStatus,
  PersonSource,
};
```

Add fields to the `orgPeople` table after `metadata`:

```ts
    personSource: varchar("person_source", { length: CODE_LENGTH })
      .$type<PersonSource>()
      .default("signal")
      .notNull(),

    memberStatus: varchar("member_status", { length: CODE_LENGTH }).$type<
      PersonMemberStatus
    >(),

    clerkUserId: varchar("clerk_user_id", { length: CLERK_ID_LENGTH }),

    memberRole: varchar("member_role", { length: CODE_LENGTH }).$type<
      "org:admin" | "org:member"
    >(),

    memberSyncedAt: datetime("member_synced_at", { mode: "date", fsp: 3 }),
```

Add table indexes:

```ts
    orgPersonSourceIdx: index("org_people_org_person_source_idx").on(
      table.clerkOrgId,
      table.personSource,
      table.id
    ),
    orgMemberStatusIdx: index("org_people_org_member_status_idx").on(
      table.clerkOrgId,
      table.memberStatus,
      table.id
    ),
```

- [ ] **Step 6: Extend People saved view config type**

Update `db/app/src/schema/tables/org-people-views.ts` imports:

```ts
import type {
  PersonIdentityProvider,
  PersonIdentityType,
  PersonMemberStatus,
  PersonSource,
} from "@repo/app-validation/schemas";
```

Update `PeopleViewConfig`:

```ts
export interface PeopleViewConfig {
  filters: {
    memberStatuses: PersonMemberStatus[];
    providers: PersonIdentityProvider[];
    sources: PersonSource[];
    types: PersonIdentityType[];
  };
}
```

- [ ] **Step 7: Export new schema types from DB barrels**

Update the `org-people` export sections in `db/app/src/schema/index.ts`, `db/app/src/schema/tables/index.ts`, and the top schema export block in `db/app/src/index.ts` to include:

```ts
  type PersonMemberStatus,
  type PersonSource,
```

- [ ] **Step 8: Generate migration**

Run:

```bash
pnpm --filter @db/app db:generate
```

Expected: PASS and new generated migration/meta files under `db/app/src/migrations/`.

- [ ] **Step 9: Audit DB schema**

Run:

```bash
pnpm --filter @db/app db:audit
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add packages/app-validation/src/schemas/people.ts \
  packages/app-validation/src/__tests__/people.test.ts \
  db/app/src/schema/tables/org-people.ts \
  db/app/src/schema/tables/org-people-views.ts \
  db/app/src/schema/index.ts \
  db/app/src/schema/tables/index.ts \
  db/app/src/index.ts \
  db/app/src/migrations
git commit -m "feat(people): add team member projection schema"
```

Expected: commit succeeds.

---

## Task 2: DB People Filters And Saved View Config

**Files:**
- Modify: `db/app/src/utils/people.ts`
- Modify: `db/app/src/utils/people-views.ts`
- Modify: `db/app/src/__tests__/people.test.ts`
- Modify: `db/app/src/__tests__/people-views.test.ts`

- [ ] **Step 1: Update test fixtures for new Person fields**

Update `makePerson` in `db/app/src/__tests__/people.test.ts`:

```ts
function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Jeevan Pillay",
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    normalizedIdentityValue: "jeevanp",
    identityKey: createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    }),
    firstSeenSignalId: "signal_first",
    lastSeenSignalId: "signal_first",
    seenCount: 1,
    metadata: {},
    personSource: "signal",
    memberStatus: null,
    clerkUserId: null,
    memberRole: null,
    memberSyncedAt: null,
    createdAt: new Date("2026-05-22T00:00:00.000Z"),
    updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    ...overrides,
  };
}
```

- [ ] **Step 2: Add failing listPeople source/status filter tests**

Append to `describe("listPeople filters", ...)` in `db/app/src/__tests__/people.test.ts`:

```ts
  it("passes source and member status filters through without throwing", async () => {
    const person = makePerson({
      personSource: "team_member",
      memberStatus: "active",
    });
    const { db, spies } = makePeopleListDb([person]);

    await expect(
      listPeople(db, {
        clerkOrgId: "org_test",
        limit: 10,
        memberStatuses: ["active"],
        sources: ["team_member", "mixed"],
      })
    ).resolves.toEqual({ items: [person], nextCursor: null });

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(11);
  });

  it("ignores empty source and member status arrays", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, {
      clerkOrgId: "org_test",
      limit: 10,
      memberStatuses: [],
      sources: [],
    });

    expect(spies.where).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 3: Add failing People view config tests**

Update `makeView` in `db/app/src/__tests__/people-views.test.ts` so config includes empty arrays:

```ts
    config: {
      filters: {
        memberStatuses: [],
        providers: ["x"],
        sources: [],
        types: ["handle"],
      },
    },
```

Add this test to `describe("createPeopleView", ...)`:

```ts
  it("persists source and member status filters in view config", async () => {
    const { db, spies } = makeCreateDb();
    const config = {
      filters: {
        memberStatuses: ["active" as const],
        providers: [],
        sources: ["team_member" as const, "mixed" as const],
        types: [],
      },
    };

    await createPeopleView(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "Team members",
      config,
    });

    expect(spies.values).toHaveBeenCalledWith(
      expect.objectContaining({ config })
    );
  });
```

- [ ] **Step 4: Run DB tests and verify failure**

Run:

```bash
pnpm --filter @db/app test src/__tests__/people.test.ts src/__tests__/people-views.test.ts
```

Expected: FAIL because `ListPeopleParams` does not accept `sources` or `memberStatuses`, and view config types are not fully wired.

- [ ] **Step 5: Implement listPeople filters**

Update imports in `db/app/src/utils/people.ts`:

```ts
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
```

Ensure the type imports include:

```ts
  type PersonMemberStatus,
  type PersonSource,
```

Update `ListPeopleParams`:

```ts
export interface ListPeopleParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  memberStatuses?: PersonMemberStatus[];
  providers?: PersonIdentityProvider[];
  search?: string;
  sources?: PersonSource[];
  types?: PersonIdentityType[];
}
```

Add conditions inside `listPeople`:

```ts
    input.sources?.length ? inArray(people.personSource, input.sources) : undefined,
    input.memberStatuses?.length
      ? inArray(people.memberStatus, input.memberStatuses)
      : undefined,
```

Place them beside the existing provider/type filters.

- [ ] **Step 6: Keep signal upserts source-safe**

In `upsertPeopleFromCandidates`, set `personSource` for new rows:

```ts
        personSource: "signal",
```

In the duplicate update block, keep member-backed rows mixed when a later signal mentions the same email:

```ts
          personSource: sql`CASE WHEN ${people.personSource} = 'team_member' THEN 'mixed' ELSE ${people.personSource} END`,
```

Do not modify `memberStatus`, `clerkUserId`, `memberRole`, or `memberSyncedAt` from signal classification.

- [ ] **Step 7: Run DB tests and verify pass**

Run:

```bash
pnpm --filter @db/app test src/__tests__/people.test.ts src/__tests__/people-views.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add db/app/src/utils/people.ts \
  db/app/src/utils/people-views.ts \
  db/app/src/__tests__/people.test.ts \
  db/app/src/__tests__/people-views.test.ts
git commit -m "feat(people): support source and member status filters"
```

Expected: commit succeeds.

---

## Task 3: DB Team Member Sync Primitives

**Files:**
- Create: `db/app/src/utils/people-team-members.ts`
- Modify: `db/app/src/utils/namespaces.ts`
- Modify: `db/app/src/index.ts`
- Create: `db/app/src/__tests__/people-team-members.test.ts`
- Modify: `db/app/src/__tests__/namespace-repository.test.ts`

- [ ] **Step 1: Add failing team-member DB utility tests**

Create `db/app/src/__tests__/people-team-members.test.ts`:

```ts
import type { Database, Person } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import { createPersonIdentityKey } from "../utils/people-identities";
import {
  markFormerTeamMembersMissingFromSync,
  syncOrgTeamMemberPeople,
} from "../utils/people-team-members";

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Ada Lovelace",
    identityProvider: "email",
    identityType: "email",
    identityValue: "ada@example.com",
    normalizedIdentityValue: "ada@example.com",
    identityKey: createPersonIdentityKey({
      identityProvider: "email",
      identityType: "email",
      normalizedIdentityValue: "ada@example.com",
    }),
    firstSeenSignalId: null,
    lastSeenSignalId: null,
    seenCount: 1,
    metadata: {},
    personSource: "team_member",
    memberStatus: "active",
    clerkUserId: "user_ada",
    memberRole: "org:member",
    memberSyncedAt: new Date("2026-06-06T00:00:00.000Z"),
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSyncDb(selectRows: Person[][], updateRowsAffected = 1) {
  const selectQueue = [...selectRows];
  const spies = {
    duplicateSet: vi.fn(),
    insertValues: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(async () => ({ rowsAffected: updateRowsAffected })),
  };
  const db = {
    insert: () => ({
      values: (values: unknown) => {
        spies.insertValues(values);
        return {
          onDuplicateKeyUpdate: ({ set }: { set: unknown }) => {
            spies.duplicateSet(set);
            return Promise.resolve({ rowsAffected: 1 });
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
    update: () => ({
      set: (set: unknown) => {
        spies.updateSet(set);
        return { where: spies.updateWhere };
      },
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("syncOrgTeamMemberPeople", () => {
  it("upserts accepted members as active email-backed people", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const row = makePerson({ memberSyncedAt: syncedAt });
    const { db, spies } = makeSyncDb([[row]]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_ada",
            displayName: "Ada Lovelace",
            emailAddress: "Ada@Example.com",
            role: "org:member",
          },
        ],
        syncedAt,
      })
    ).resolves.toMatchObject({
      activeIdentityKeys: [row.identityKey],
      membersSeen: 1,
      membersSkippedNoEmail: 0,
      membersUpserted: 1,
    });

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        displayName: "Ada Lovelace",
        identityProvider: "email",
        identityType: "email",
        identityValue: "Ada@Example.com",
        normalizedIdentityValue: "ada@example.com",
        memberStatus: "active",
        personSource: "team_member",
        clerkUserId: "user_ada",
        memberRole: "org:member",
        memberSyncedAt: syncedAt,
      })
    );
  });

  it("skips members without usable emails", async () => {
    const { db, spies } = makeSyncDb([]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_missing",
            displayName: "Missing Email",
            emailAddress: "",
            role: "org:member",
          },
        ],
        syncedAt: new Date("2026-06-06T01:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      activeIdentityKeys: [],
      membersSeen: 1,
      membersSkippedNoEmail: 1,
      membersUpserted: 0,
    });

    expect(spies.insertValues).not.toHaveBeenCalled();
  });
});

describe("markFormerTeamMembersMissingFromSync", () => {
  it("marks previously active member rows missing from the active identity set as former", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const { db, spies } = makeSyncDb([], 2);

    await expect(
      markFormerTeamMembersMissingFromSync(db, {
        activeIdentityKeys: ["active_key"],
        clerkOrgId: "org_test",
        syncedAt,
      })
    ).resolves.toBe(2);

    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "former",
        memberSyncedAt: syncedAt,
      })
    );
    expect(spies.updateWhere).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @db/app test src/__tests__/people-team-members.test.ts
```

Expected: FAIL because `people-team-members.ts` does not exist.

- [ ] **Step 3: Implement team-member People utilities**

Create `db/app/src/utils/people-team-members.ts`:

```ts
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
  type Person,
  orgPeople as people,
} from "../schema";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
} from "./people-identities";
import { getPersonByIdentityKey } from "./people";

export interface TeamMemberPeopleCandidate {
  clerkUserId: string;
  displayName?: string;
  emailAddress: string;
  role: "org:admin" | "org:member";
}

export interface SyncOrgTeamMemberPeopleInput {
  clerkOrgId: string;
  members: TeamMemberPeopleCandidate[];
  syncedAt: Date;
}

export interface SyncOrgTeamMemberPeopleResult {
  activeIdentityKeys: string[];
  membersSeen: number;
  membersSkippedNoEmail: number;
  membersUpserted: number;
  people: Person[];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeDisplayName(value: string | undefined, email: string) {
  const trimmed = value?.trim() || email.trim();
  return trimmed.slice(0, PERSON_DISPLAY_NAME_LENGTH);
}

export async function syncOrgTeamMemberPeople(
  db: Database,
  input: SyncOrgTeamMemberPeopleInput
): Promise<SyncOrgTeamMemberPeopleResult> {
  const peopleRows: Person[] = [];
  const activeIdentityKeys: string[] = [];
  let membersSkippedNoEmail = 0;
  const seenIdentityKeys = new Set<string>();

  for (const member of input.members) {
    const normalized = normalizePersonIdentityCandidate({
      identityProvider: "email",
      identityType: "email",
      identityValue: member.emailAddress,
    });

    if (
      !normalized ||
      normalized.normalizedIdentityValue.length >
        PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH
    ) {
      membersSkippedNoEmail += 1;
      continue;
    }

    const identityKey = createPersonIdentityKey(normalized);
    if (seenIdentityKeys.has(identityKey)) {
      continue;
    }
    seenIdentityKeys.add(identityKey);
    activeIdentityKeys.push(identityKey);

    const displayName = normalizeDisplayName(
      member.displayName,
      member.emailAddress
    );

    await db
      .insert(people)
      .values({
        clerkOrgId: input.clerkOrgId,
        displayName,
        identityProvider: "email",
        identityType: "email",
        identityValue: member.emailAddress,
        normalizedIdentityValue: normalized.normalizedIdentityValue,
        identityKey,
        firstSeenSignalId: null,
        lastSeenSignalId: null,
        seenCount: 1,
        metadata: {},
        personSource: "team_member",
        memberStatus: "active",
        clerkUserId: member.clerkUserId,
        memberRole: member.role,
        memberSyncedAt: input.syncedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName,
          personSource: sql`CASE WHEN ${people.personSource} = 'signal' THEN 'mixed' ELSE ${people.personSource} END`,
          memberStatus: "active",
          clerkUserId: member.clerkUserId,
          memberRole: member.role,
          memberSyncedAt: input.syncedAt,
        },
      });

    const row = await getPersonByIdentityKey(db, {
      clerkOrgId: input.clerkOrgId,
      identityKey,
    });
    if (row) {
      peopleRows.push(row);
    }
  }

  return {
    activeIdentityKeys,
    membersSeen: input.members.length,
    membersSkippedNoEmail,
    membersUpserted: peopleRows.length,
    people: peopleRows,
  };
}

export async function markFormerTeamMembersMissingFromSync(
  db: Database,
  input: {
    activeIdentityKeys: string[];
    clerkOrgId: string;
    syncedAt: Date;
  }
): Promise<number> {
  const conditions = [
    eq(people.clerkOrgId, input.clerkOrgId),
    eq(people.memberStatus, "active"),
    inArray(people.personSource, ["team_member", "mixed"]),
    input.activeIdentityKeys.length
      ? notInArray(people.identityKey, input.activeIdentityKeys)
      : undefined,
  ].filter(isDefined);

  const result = await db
    .update(people)
    .set({
      memberStatus: "former",
      memberSyncedAt: input.syncedAt,
    })
    .where(and(...conditions));

  return Number(result.rowsAffected ?? 0);
}
```

- [ ] **Step 4: Add namespace helper failing test**

Append to `db/app/src/__tests__/namespace-repository.test.ts`:

```ts
import { listActiveOrgNamespaceClerkOrgIds } from "../utils/namespaces";

describe("listActiveOrgNamespaceClerkOrgIds", () => {
  it("returns active org namespace clerk ids with cursor pagination", async () => {
    const rows = [
      { id: 1, clerkOrgId: "org_one" },
      { id: 2, clerkOrgId: "org_two" },
    ];
    const spies = {
      limit: vi.fn(() => Promise.resolve(rows)),
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
    } as unknown as Database;

    await expect(
      listActiveOrgNamespaceClerkOrgIds(db, { limit: 1 })
    ).resolves.toEqual({
      items: [{ id: 1, clerkOrgId: "org_one" }],
      nextCursor: 1,
    });

    expect(spies.limit).toHaveBeenCalledWith(2);
    expect(spies.where).toHaveBeenCalledOnce();
  });
});
```

Add `listActiveOrgNamespaceClerkOrgIds` to the existing `../utils/namespaces` import in this file.

- [ ] **Step 5: Implement namespace helper**

Update imports in `db/app/src/utils/namespaces.ts`:

```ts
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
```

Add near other exported namespace read helpers:

```ts
export interface ListActiveOrgNamespaceClerkOrgIdsInput {
  cursor?: number | null;
  limit: number;
}

export interface ActiveOrgNamespaceClerkOrgId {
  id: number;
  clerkOrgId: string;
}

export async function listActiveOrgNamespaceClerkOrgIds(
  db: Database,
  input: ListActiveOrgNamespaceClerkOrgIdsInput
): Promise<{
  items: ActiveOrgNamespaceClerkOrgId[];
  nextCursor: number | null;
}> {
  const limit = Math.max(1, Math.min(Math.trunc(input.limit), 100));
  const rows = await db
    .select({
      id: namespaces.id,
      clerkOrgId: namespaces.clerkOrgId,
    })
    .from(namespaces)
    .where(
      and(
        eq(namespaces.kind, "org"),
        eq(namespaces.status, "active"),
        isNotNull(namespaces.clerkOrgId),
        input.cursor ? gt(namespaces.id, input.cursor) : undefined
      )
    )
    .orderBy(asc(namespaces.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    clerkOrgId: row.clerkOrgId as string,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: rows.length > limit && last ? last.id : null,
  };
}
```

Use the existing `systemNamespaces as namespaces` alias in `namespaces.ts`.

- [ ] **Step 6: Export DB utilities**

Update `db/app/src/index.ts`:

```ts
export {
  markFormerTeamMembersMissingFromSync,
  syncOrgTeamMemberPeople,
  type SyncOrgTeamMemberPeopleInput,
  type SyncOrgTeamMemberPeopleResult,
  type TeamMemberPeopleCandidate,
} from "./utils/people-team-members";
```

Add `listActiveOrgNamespaceClerkOrgIds` and its types to the existing namespaces export block:

```ts
  type ActiveOrgNamespaceClerkOrgId,
  listActiveOrgNamespaceClerkOrgIds,
  type ListActiveOrgNamespaceClerkOrgIdsInput,
```

- [ ] **Step 7: Run DB tests and typecheck**

Run:

```bash
pnpm --filter @db/app test src/__tests__/people-team-members.test.ts src/__tests__/namespace-repository.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add db/app/src/utils/people-team-members.ts \
  db/app/src/utils/namespaces.ts \
  db/app/src/index.ts \
  db/app/src/__tests__/people-team-members.test.ts \
  db/app/src/__tests__/namespace-repository.test.ts
git commit -m "feat(people): add team member sync db primitives"
```

Expected: commit succeeds.

---

## Task 4: Clerk Membership Sync Service And Inngest Cron

**Files:**
- Create: `api/app/src/services/team-members/people-sync.ts`
- Create: `api/app/src/services/team-members/index.ts`
- Create: `api/app/src/__tests__/team-member-people-sync.test.ts`
- Create: `api/app/src/inngest/workflow/team-member-reconciler.ts`
- Modify: `api/app/src/inngest/index.ts`
- Create: `api/app/src/__tests__/team-member-reconciler-workflow.test.ts`

- [ ] **Step 1: Add failing service tests**

Create `api/app/src/__tests__/team-member-people-sync.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncOrgTeamMemberPeopleMock = vi.fn();
const markFormerTeamMembersMissingFromSyncMock = vi.fn();

vi.mock("@db/app", () => ({
  markFormerTeamMembersMissingFromSync:
    markFormerTeamMembersMissingFromSyncMock,
  syncOrgTeamMemberPeople: syncOrgTeamMemberPeopleMock,
}));

const { listAcceptedOrgMemberships, syncTeamMembersForOrg } = await import(
  "../services/team-members/people-sync"
);

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem_1",
    publicUserData: {
      firstName: "Ada",
      identifier: "ada@example.com",
      lastName: "Lovelace",
      userId: "user_ada",
    },
    role: "org:member",
    ...overrides,
  };
}

function clerkWithPages(pages: unknown[][]) {
  const getOrganizationMembershipList = vi.fn(
    ({ offset }: { offset: number }) => {
      const pageIndex = offset === 0 ? 0 : 1;
      const data = pages[pageIndex] ?? [];
      return Promise.resolve({ data, totalCount: pages.flat().length });
    }
  );
  return {
    organizations: { getOrganizationMembershipList },
  };
}

beforeEach(() => {
  syncOrgTeamMemberPeopleMock.mockReset().mockResolvedValue({
    activeIdentityKeys: ["identity_ada"],
    membersSeen: 1,
    membersSkippedNoEmail: 0,
    membersUpserted: 1,
    people: [],
  });
  markFormerTeamMembersMissingFromSyncMock.mockReset().mockResolvedValue(0);
});

describe("listAcceptedOrgMemberships", () => {
  it("pages through every Clerk organization membership page", async () => {
    const clerk = clerkWithPages([
      [membership({ id: "mem_1" })],
      [membership({ id: "mem_2" })],
    ]);

    await expect(
      listAcceptedOrgMemberships(clerk, {
        clerkOrgId: "org_test",
        pageSize: 1,
      })
    ).resolves.toHaveLength(2);

    expect(clerk.organizations.getOrganizationMembershipList).toHaveBeenCalledWith(
      { limit: 1, offset: 0, organizationId: "org_test" }
    );
    expect(clerk.organizations.getOrganizationMembershipList).toHaveBeenCalledWith(
      { limit: 1, offset: 1, organizationId: "org_test" }
    );
  });
});

describe("syncTeamMembersForOrg", () => {
  it("syncs accepted memberships and marks former rows only after fetch success", async () => {
    const db = {} as Database;
    const syncedAt = new Date("2026-06-06T02:00:00.000Z");
    const clerk = clerkWithPages([[membership()]]);

    await expect(
      syncTeamMembersForOrg({
        clerk,
        clerkOrgId: "org_test",
        db,
        syncedAt,
      })
    ).resolves.toEqual({
      clerkOrgId: "org_test",
      membersMarkedFormer: 0,
      membersSeen: 1,
      membersSkippedNoEmail: 0,
      membersUpserted: 1,
      status: "synced",
    });

    expect(syncOrgTeamMemberPeopleMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      members: [
        {
          clerkUserId: "user_ada",
          displayName: "Ada Lovelace",
          emailAddress: "ada@example.com",
          role: "org:member",
        },
      ],
      syncedAt,
    });
    expect(markFormerTeamMembersMissingFromSyncMock).toHaveBeenCalledWith(db, {
      activeIdentityKeys: ["identity_ada"],
      clerkOrgId: "org_test",
      syncedAt,
    });
  });

  it("does not mark former rows when Clerk fetch fails", async () => {
    const clerk = {
      organizations: {
        getOrganizationMembershipList: vi.fn(async () => {
          throw new Error("clerk unavailable");
        }),
      },
    };

    await expect(
      syncTeamMembersForOrg({
        clerk,
        clerkOrgId: "org_test",
        db: {} as Database,
        syncedAt: new Date("2026-06-06T02:00:00.000Z"),
      })
    ).rejects.toThrow("clerk unavailable");

    expect(markFormerTeamMembersMissingFromSyncMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run service tests and verify failure**

Run:

```bash
pnpm --filter @api/app test src/__tests__/team-member-people-sync.test.ts
```

Expected: FAIL because `services/team-members/people-sync.ts` does not exist.

- [ ] **Step 3: Implement Clerk sync service**

Create `api/app/src/services/team-members/people-sync.ts`:

```ts
import type {
  Database,
  SyncOrgTeamMemberPeopleResult,
  TeamMemberPeopleCandidate,
} from "@db/app";
import {
  markFormerTeamMembersMissingFromSync,
  syncOrgTeamMemberPeople,
} from "@db/app";

const DEFAULT_PAGE_SIZE = 100;

export interface ClerkOrganizationMembershipListClient {
  organizations: {
    getOrganizationMembershipList(input: {
      limit: number;
      offset: number;
      organizationId: string;
    }): Promise<{ data: ClerkOrganizationMembership[]; totalCount?: number }>;
  };
}

export interface ClerkOrganizationMembership {
  publicUserData?: {
    firstName?: string | null;
    identifier?: string | null;
    lastName?: string | null;
    userId?: string | null;
  } | null;
  role: string;
}

export async function listAcceptedOrgMemberships(
  clerk: ClerkOrganizationMembershipListClient,
  input: { clerkOrgId: string; pageSize?: number }
): Promise<ClerkOrganizationMembership[]> {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const memberships: ClerkOrganizationMembership[] = [];
  let offset = 0;

  while (true) {
    const page = await clerk.organizations.getOrganizationMembershipList({
      limit: pageSize,
      offset,
      organizationId: input.clerkOrgId,
    });
    memberships.push(...page.data);
    offset += page.data.length;

    const totalCount = page.totalCount ?? memberships.length;
    if (page.data.length === 0 || memberships.length >= totalCount) {
      break;
    }
  }

  return memberships;
}

function memberDisplayName(member: ClerkOrganizationMembership) {
  const firstName = member.publicUserData?.firstName ?? "";
  const lastName = member.publicUserData?.lastName ?? "";
  return `${firstName} ${lastName}`.trim();
}

function memberToCandidate(
  member: ClerkOrganizationMembership
): TeamMemberPeopleCandidate | null {
  const clerkUserId = member.publicUserData?.userId?.trim();
  const emailAddress = member.publicUserData?.identifier?.trim() ?? "";
  const role = member.role === "org:admin" ? "org:admin" : "org:member";

  if (!clerkUserId) {
    return null;
  }

  return {
    clerkUserId,
    displayName: memberDisplayName(member) || emailAddress,
    emailAddress,
    role,
  };
}

export interface SyncTeamMembersForOrgResult {
  clerkOrgId: string;
  membersMarkedFormer: number;
  membersSeen: number;
  membersSkippedNoEmail: number;
  membersUpserted: number;
  status: "synced";
}

export async function syncTeamMembersForOrg(input: {
  clerk: ClerkOrganizationMembershipListClient;
  clerkOrgId: string;
  db: Database;
  syncedAt: Date;
}): Promise<SyncTeamMembersForOrgResult> {
  const memberships = await listAcceptedOrgMemberships(input.clerk, {
    clerkOrgId: input.clerkOrgId,
  });
  const candidates = memberships
    .map(memberToCandidate)
    .filter((candidate): candidate is TeamMemberPeopleCandidate =>
      Boolean(candidate)
    );

  const synced: SyncOrgTeamMemberPeopleResult = await syncOrgTeamMemberPeople(
    input.db,
    {
      clerkOrgId: input.clerkOrgId,
      members: candidates,
      syncedAt: input.syncedAt,
    }
  );
  const membersMarkedFormer = await markFormerTeamMembersMissingFromSync(
    input.db,
    {
      activeIdentityKeys: synced.activeIdentityKeys,
      clerkOrgId: input.clerkOrgId,
      syncedAt: input.syncedAt,
    }
  );

  return {
    clerkOrgId: input.clerkOrgId,
    membersMarkedFormer,
    membersSeen: synced.membersSeen,
    membersSkippedNoEmail: synced.membersSkippedNoEmail,
    membersUpserted: synced.membersUpserted,
    status: "synced",
  };
}
```

Create `api/app/src/services/team-members/index.ts`:

```ts
export {
  listAcceptedOrgMemberships,
  syncTeamMembersForOrg,
  type ClerkOrganizationMembership,
  type ClerkOrganizationMembershipListClient,
  type SyncTeamMembersForOrgResult,
} from "./people-sync";
```

- [ ] **Step 4: Run service tests and verify pass**

Run:

```bash
pnpm --filter @api/app test src/__tests__/team-member-people-sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add failing Inngest workflow test**

Create `api/app/src/__tests__/team-member-reconciler-workflow.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const listActiveOrgNamespaceClerkOrgIdsMock = vi.fn();
const syncTeamMembersForOrgMock = vi.fn();
const clerkClientMock = vi.fn();
const db = { kind: "mock-db" };

type WorkflowCallback = (input: {
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
const createFunctionMock = vi.fn((_config: unknown, handler: WorkflowCallback) => {
  workflowCallback = handler;
  return { id: "team-member-reconciler" };
});

vi.mock("@db/app", () => ({
  listActiveOrgNamespaceClerkOrgIds: listActiveOrgNamespaceClerkOrgIdsMock,
}));
vi.mock("@db/app/client", () => ({ db }));
vi.mock("@vendor/clerk/server", () => ({ clerkClient: clerkClientMock }));
vi.mock("../services/team-members", () => ({
  syncTeamMembersForOrg: syncTeamMembersForOrgMock,
}));
vi.mock("../inngest/client", () => ({
  inngest: { createFunction: createFunctionMock },
}));

const { teamMemberReconciler } = await import(
  "../inngest/workflow/team-member-reconciler"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
  };
}

beforeEach(() => {
  listActiveOrgNamespaceClerkOrgIdsMock.mockReset().mockResolvedValue({
    items: [{ id: 1, clerkOrgId: "org_test" }],
    nextCursor: null,
  });
  syncTeamMembersForOrgMock.mockReset().mockResolvedValue({
    clerkOrgId: "org_test",
    membersMarkedFormer: 1,
    membersSeen: 2,
    membersSkippedNoEmail: 0,
    membersUpserted: 2,
    status: "synced",
  });
  clerkClientMock.mockReset().mockResolvedValue({ clerk: true });
});

describe("teamMemberReconciler", () => {
  it("registers the cron workflow", () => {
    expect(teamMemberReconciler).toEqual({ id: "team-member-reconciler" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "team-member-reconciler",
        triggers: { cron: "*/15 * * * *" },
      }),
      expect.any(Function)
    );
  });

  it("syncs active org namespace ids and returns aggregate counts", async () => {
    if (!workflowCallback) {
      throw new Error("workflow callback was not registered");
    }

    await expect(workflowCallback({ step: createStep() })).resolves.toEqual({
      membersMarkedFormer: 1,
      membersSeen: 2,
      membersSkippedNoEmail: 0,
      membersUpserted: 2,
      orgPagesChecked: 1,
      orgsChecked: 1,
      orgsFailed: 0,
    });

    expect(syncTeamMembersForOrgMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        db,
      })
    );
  });
});
```

- [ ] **Step 6: Run workflow test and verify failure**

Run:

```bash
pnpm --filter @api/app test src/__tests__/team-member-reconciler-workflow.test.ts
```

Expected: FAIL because the workflow file does not exist.

- [ ] **Step 7: Implement Inngest cron workflow**

Create `api/app/src/inngest/workflow/team-member-reconciler.ts`:

```ts
import { listActiveOrgNamespaceClerkOrgIds } from "@db/app";
import { db } from "@db/app/client";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";

import { syncTeamMembersForOrg } from "../../services/team-members";
import { inngest } from "../client";

const MAX_ORG_PAGES_PER_RUN = 10;
const ORG_PAGE_LIMIT = 100;

export const teamMemberReconciler = inngest.createFunction(
  {
    id: "team-member-reconciler",
    retries: 1,
    timeouts: {
      finish: "10m",
      start: "2m",
    },
    triggers: { cron: "*/15 * * * *" },
  },
  async ({ step }) => {
    const clerk = await step.run("load clerk client", () => clerkClient());
    const syncedAt = new Date();
    let cursor: number | null = null;
    const totals = {
      membersMarkedFormer: 0,
      membersSeen: 0,
      membersSkippedNoEmail: 0,
      membersUpserted: 0,
      orgsChecked: 0,
      orgsFailed: 0,
    };
    let orgPagesChecked = 0;

    while (orgPagesChecked < MAX_ORG_PAGES_PER_RUN) {
      const page = await step.run(
        `list active org namespaces ${cursor ?? "first"}`,
        () =>
          listActiveOrgNamespaceClerkOrgIds(db, {
            cursor,
            limit: ORG_PAGE_LIMIT,
          })
      );

      for (const org of page.items) {
        try {
          const result = await step.run(
            `sync team members ${org.clerkOrgId}`,
            () =>
              syncTeamMembersForOrg({
                clerk,
                clerkOrgId: org.clerkOrgId,
                db,
                syncedAt,
              })
          );
          totals.orgsChecked += 1;
          totals.membersMarkedFormer += result.membersMarkedFormer;
          totals.membersSeen += result.membersSeen;
          totals.membersSkippedNoEmail += result.membersSkippedNoEmail;
          totals.membersUpserted += result.membersUpserted;
        } catch (error) {
          totals.orgsFailed += 1;
          log.warn("[people] team member sync failed", {
            clerkOrgId: org.clerkOrgId,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }

      orgPagesChecked += 1;
      cursor = page.nextCursor;
      if (!cursor) {
        break;
      }
    }

    return { ...totals, orgPagesChecked };
  }
);
```

Modify `api/app/src/inngest/index.ts`:

```ts
import { teamMemberReconciler } from "./workflow/team-member-reconciler";
```

Add `teamMemberReconciler` to the `functions` array.

- [ ] **Step 8: Run API tests and typecheck**

Run:

```bash
pnpm --filter @api/app test src/__tests__/team-member-people-sync.test.ts src/__tests__/team-member-reconciler-workflow.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add api/app/src/services/team-members \
  api/app/src/__tests__/team-member-people-sync.test.ts \
  api/app/src/inngest/workflow/team-member-reconciler.ts \
  api/app/src/inngest/index.ts \
  api/app/src/__tests__/team-member-reconciler-workflow.test.ts
git commit -m "feat(people): reconcile team members with inngest"
```

Expected: commit succeeds.

---

## Task 5: tRPC People Filters And View Persistence

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-people.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts`
- Modify: `api/app/src/__tests__/workspace-people-router.test.ts`
- Modify: `api/app/src/__tests__/workspace-people-views-router.test.ts`

- [ ] **Step 1: Add failing workspace People router tests**

In `api/app/src/__tests__/workspace-people-router.test.ts`, update `personRow` with:

```ts
  personSource: "team_member",
  memberStatus: "active",
  clerkUserId: "user_ada",
  memberRole: "org:member",
  memberSyncedAt: new Date("2026-06-06T01:00:00.000Z"),
```

Add tests to `describe("workspacePeopleRouter.list filters", ...)`:

```ts
  it("forwards source and member status filters to the db helper", async () => {
    await caller().people.list({
      memberStatuses: ["active"],
      sources: ["team_member", "mixed"],
    });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      limit: undefined,
      memberStatuses: ["active"],
      providers: undefined,
      search: undefined,
      sources: ["team_member", "mixed"],
      types: undefined,
    });
  });

  it("rejects unknown source values", async () => {
    await expect(
      caller().people.list({
        sources: ["invitation" as unknown as "signal"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("rejects unknown member status values", async () => {
    await expect(
      caller().people.list({
        memberStatuses: ["pending" as unknown as "active"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });
```

Update existing `expect(listPeopleMock).toHaveBeenCalledWith` expectations in this file to include:

```ts
      memberStatuses: undefined,
      sources: undefined,
```

- [ ] **Step 2: Add failing People views router tests**

In `api/app/src/__tests__/workspace-people-views-router.test.ts`, update `viewRow.config`:

```ts
  config: {
    filters: {
      memberStatuses: ["active"],
      providers: ["x"],
      sources: ["team_member"],
      types: ["handle"],
    },
  },
```

Add a create validation test:

```ts
  it("rejects unknown source values in config", async () => {
    await expect(
      caller().people.views.create({
        name: "Bad",
        config: {
          filters: {
            memberStatuses: [],
            providers: [],
            sources: ["invitation" as unknown as "signal"],
            types: [],
          },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPeopleViewMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run router tests and verify failure**

Run:

```bash
pnpm --filter @api/app test src/__tests__/workspace-people-router.test.ts src/__tests__/workspace-people-views-router.test.ts
```

Expected: FAIL because router schemas do not accept source/status filters yet.

- [ ] **Step 4: Implement workspace People filter schema**

Update imports in `api/app/src/router/(pending-not-allowed)/workspace-people.ts`:

```ts
  personMemberStatusSchema,
  personSourceSchema,
```

Update `listPeopleInput`:

```ts
const listPeopleInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  memberStatuses: z.array(personMemberStatusSchema).max(2).optional(),
  providers: z.array(peopleIdentityProviderSchema).max(5).optional(),
  search: workspaceListSearchInput,
  sources: z.array(personSourceSchema).max(3).optional(),
  types: z.array(peopleIdentityTypeSchema).max(3).optional(),
});
```

Forward filters to `listPeople`:

```ts
      memberStatuses: input.memberStatuses?.length
        ? input.memberStatuses
        : undefined,
      sources: input.sources?.length ? input.sources : undefined,
```

- [ ] **Step 5: Implement People views schema**

Update imports in `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts`:

```ts
  personMemberStatusSchema,
  personSourceSchema,
```

Update `peopleViewConfigSchema`:

```ts
const peopleViewConfigSchema = z.object({
  filters: z.object({
    memberStatuses: z.array(personMemberStatusSchema).max(2),
    providers: z.array(peopleIdentityProviderSchema).max(5),
    sources: z.array(personSourceSchema).max(3),
    types: z.array(peopleIdentityTypeSchema).max(3),
  }),
});
```

- [ ] **Step 6: Run router tests and verify pass**

Run:

```bash
pnpm --filter @api/app test src/__tests__/workspace-people-router.test.ts src/__tests__/workspace-people-views-router.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add "api/app/src/router/(pending-not-allowed)/workspace-people.ts" \
  "api/app/src/router/(pending-not-allowed)/workspace-people-views.ts" \
  api/app/src/__tests__/workspace-people-router.test.ts \
  api/app/src/__tests__/workspace-people-views-router.test.ts
git commit -m "feat(people): expose team member filters"
```

Expected: commit succeeds.

---

## Task 6: People UI Team Member Filters, Preset, And Badges

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/views/view-switcher.tsx`
- Add or modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/views-view-switcher.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-model.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-views-model.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/use-people-list-query.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-toolbar.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-table-view.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-detail-content.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-view-switcher.test.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx`

- [ ] **Step 1: Add failing People model/search param tests**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getMemberStatusLabel,
  getPersonSourceLabel,
  peopleMemberStatusOptions,
  peopleSourceOptions,
} from "./people-model";

describe("people team member model", () => {
  it("exposes source and member status filter options", () => {
    expect(peopleSourceOptions.map((option) => option.value)).toEqual([
      "signal",
      "team_member",
      "mixed",
    ]);
    expect(peopleMemberStatusOptions.map((option) => option.value)).toEqual([
      "active",
      "former",
    ]);
  });

  it("formats source and member status labels", () => {
    expect(getPersonSourceLabel("team_member")).toBe("Team member");
    expect(getMemberStatusLabel("former")).toBe("Former member");
  });
});
```

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-search-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  parsePersonMemberStatuses,
  parsePersonSources,
  serializePersonValues,
} from "./people-search-params";

describe("people search params", () => {
  it("parses source filters safely", () => {
    expect(parsePersonSources("team_member,mixed,invalid,team_member")).toEqual([
      "team_member",
      "mixed",
    ]);
  });

  it("parses member status filters safely", () => {
    expect(parsePersonMemberStatuses("active,pending,former")).toEqual([
      "active",
      "former",
    ]);
  });

  it("serializes empty selections as an empty param", () => {
    expect(serializePersonValues([])).toBe("");
  });
});
```

- [ ] **Step 2: Run new UI unit tests and verify failure**

Run:

```bash
cd apps/app && pnpm test "people-model|people-search-params"
```

Expected: FAIL because source/status UI helpers do not exist.

- [ ] **Step 3: Implement People model and search params**

Update `people-model.ts`:

```ts
export type PersonSource = PersonRow["personSource"];
export type PersonMemberStatus = NonNullable<PersonRow["memberStatus"]>;
```

Add options:

```ts
export const peopleSourceOptions: {
  label: string;
  value: PersonSource;
}[] = [
  { label: "Signal-discovered", value: "signal" },
  { label: "Team member", value: "team_member" },
  { label: "Mixed", value: "mixed" },
];

export const peopleMemberStatusOptions: {
  label: string;
  value: PersonMemberStatus;
}[] = [
  { label: "Active member", value: "active" },
  { label: "Former member", value: "former" },
];
```

Update `PeopleClassificationFilters`:

```ts
export interface PeopleClassificationFilters {
  memberStatuses: PersonMemberStatus[];
  providers: PersonProvider[];
  sources: PersonSource[];
  types: PersonType[];
}
```

Add label helpers:

```ts
export function getPersonSourceLabel(source: PersonSource) {
  return (
    peopleSourceOptions.find((option) => option.value === source)?.label ??
    source
  );
}

export function getMemberStatusLabel(status: PersonMemberStatus) {
  return (
    peopleMemberStatusOptions.find((option) => option.value === status)
      ?.label ?? status
  );
}
```

Update `people-search-params.ts` imports and parsers:

```ts
  type PersonMemberStatus,
  type PersonSource,
  peopleMemberStatusOptions,
  peopleSourceOptions,
```

Add:

```ts
export const personSourceParser = parseAsString.withDefault("");
export const personMemberStatusParser = parseAsString.withDefault("");

export function parsePersonSources(value: string): PersonSource[] {
  return parseValues(
    value,
    peopleSourceOptions.map((option) => option.value)
  );
}

export function parsePersonMemberStatuses(
  value: string
): PersonMemberStatus[] {
  return parseValues(
    value,
    peopleMemberStatusOptions.map((option) => option.value)
  );
}
```

- [ ] **Step 4: Run model/search tests and verify pass**

Run:

```bash
cd apps/app && pnpm test "people-model|people-search-params"
```

Expected: PASS.

- [ ] **Step 5: Add failing view switcher preset tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/views-view-switcher.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ViewSwitcher,
  type ViewSwitcherProps,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/views/view-switcher";

function renderSwitcher(props: Partial<ViewSwitcherProps> = {}) {
  return render(
    <ViewSwitcher
      activePresetId={props.activePresetId ?? null}
      activeViewId={props.activeViewId ?? null}
      onCreate={props.onCreate ?? vi.fn()}
      onDelete={props.onDelete ?? vi.fn()}
      onSelectAll={props.onSelectAll ?? vi.fn()}
      onSelectPreset={props.onSelectPreset ?? vi.fn()}
      onSelectView={props.onSelectView ?? vi.fn()}
      presets={props.presets ?? [{ name: "Team Members", publicId: "team_members" }]}
      views={props.views ?? []}
    />
  );
}

describe("ViewSwitcher presets", () => {
  it("renders built-in presets and calls onSelectPreset", () => {
    const onSelectPreset = vi.fn();
    renderSwitcher({ onSelectPreset });

    fireEvent.click(screen.getByRole("button", { name: "Team Members" }));

    expect(onSelectPreset).toHaveBeenCalledWith("team_members");
  });

  it("does not render a delete button for built-in presets", () => {
    renderSwitcher();

    expect(
      screen.queryByRole("button", { name: "Delete Team Members" })
    ).not.toBeInTheDocument();
  });
});
```

Modify `people-view-switcher.test.tsx`:

```ts
interface Params {
  memberStatus: string;
  provider: string;
  source: string;
  type: string;
  view: string | null;
}
```

Update `beforeEach` state:

```ts
  paramsState = {
    memberStatus: "",
    provider: "",
    source: "",
    type: "",
    view: null,
  };
```

Update the mocked `ViewSwitcher` to expose presets:

```tsx
        <button onClick={() => props.onSelectPreset?.("team_members")} type="button">
          team members
        </button>
```

Add the test:

```ts
  it("applies the built-in Team Members preset", () => {
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "team members" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "active",
        source: "team_member,mixed",
        view: null,
      })
    );
  });
```

Update existing "All" and saved-view expectations to include cleared `source` and `memberStatus`.

- [ ] **Step 6: Implement built-in preset support**

Update `ViewSwitcherProps` in the shared `view-switcher.tsx`:

```ts
export interface ViewSwitcherPreset {
  name: string;
  publicId: string;
}

export interface ViewSwitcherProps {
  activePresetId?: string | null;
  activeViewId: string | null;
  onCreate: (name: string) => Promise<unknown>;
  onDelete: (publicId: string) => Promise<unknown>;
  onSelectAll: () => void;
  onSelectPreset?: (publicId: string) => void;
  onSelectView: (publicId: string) => void;
  presets?: ViewSwitcherPreset[];
  views: ViewSwitcherItem[];
}
```

Render presets after All and before saved views:

```tsx
          {(presets ?? []).map((preset) => {
            const isActive = activePresetId === preset.publicId;
            return (
              <Fragment key={preset.publicId}>
                <div
                  aria-hidden="true"
                  className="mx-1.5 h-3.5 w-px shrink-0 bg-border"
                />
                <button
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
                    isActive
                      ? "border-border/70 bg-muted/60 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                  data-active={isActive}
                  onClick={() => onSelectPreset?.(preset.publicId)}
                  type="button"
                >
                  <AlignJustify
                    aria-hidden="true"
                    className="size-3.5 rotate-90 text-muted-foreground"
                  />
                  <span>{preset.name}</span>
                </button>
              </Fragment>
            );
          })}
```

Update `PeopleViewSwitcher` query states:

```ts
    memberStatus: personMemberStatusParser,
    source: personSourceParser,
```

Use current config:

```ts
  const currentConfig = selectionToConfig({
    memberStatuses: parsePersonMemberStatuses(params.memberStatus),
    providers: parsePersonProviders(params.provider),
    sources: parsePersonSources(params.source),
    types: parsePersonTypes(params.type),
  });
```

Pass preset props:

```tsx
      activePresetId={
        params.source === "team_member,mixed" &&
        params.memberStatus === "active" &&
        !activeViewId
          ? "team_members"
          : null
      }
      onSelectPreset={(publicId) => {
        if (publicId !== "team_members") {
          return;
        }
        void setParams({
          memberStatus: "active",
          provider: "",
          source: "team_member,mixed",
          type: "",
          view: null,
        });
      }}
      presets={[{ name: "Team Members", publicId: "team_members" }]}
```

Update `allPeopleParamValues` and `viewConfigToParamValues` in `people-views-model.ts` to include `source` and `memberStatus`.

- [ ] **Step 7: Run view switcher tests**

Run:

```bash
cd apps/app && pnpm test "people-view-switcher"
```

Expected: PASS.

- [ ] **Step 8: Wire filters through People client/query/toolbar**

Update `PeopleClient` query states:

```ts
  const [sourceState, setSourceState] = useQueryState(
    "source",
    personSourceParser
  );
  const [memberStatusState, setMemberStatusState] = useQueryState(
    "memberStatus",
    personMemberStatusParser
  );
```

Update filters:

```ts
  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      memberStatuses: parsePersonMemberStatuses(memberStatusState),
      providers: parsePersonProviders(providerState),
      sources: parsePersonSources(sourceState),
      types: parsePersonTypes(typeState),
    }),
    [memberStatusState, providerState, sourceState, typeState]
  );
```

Update `hasActiveFilters` to include sources and member statuses.

Update `usePeopleListQuery` input:

```ts
    memberStatuses: filters.memberStatuses.length
      ? filters.memberStatuses
      : undefined,
    sources: filters.sources.length ? filters.sources : undefined,
```

Update `PeopleToolbar` props with:

```ts
  onToggleSource: (value: PersonSource) => void;
  onToggleMemberStatus: (value: PersonMemberStatus) => void;
```

Add Source and Member Status filter groups using existing `PeopleFilterSubMenu` and `PeopleFilterChip` patterns. Use `UsersRound` for Source and `UserCheck` for Member Status from `lucide-react`.

In `PeopleClient`, pass handlers:

```tsx
        onToggleSource={(value) => {
          void setSavedViewId(null);
          void setSourceState(
            serializePersonValues(togglePersonValue(filters.sources, value))
          );
        }}
        onToggleMemberStatus={(value) => {
          void setSavedViewId(null);
          void setMemberStatusState(
            serializePersonValues(
              togglePersonValue(filters.memberStatuses, value)
            )
          );
        }}
```

Update `onClearFilterGroup` to clear `source` and `memberStatus`.

- [ ] **Step 9: Add badges and detail fields**

In `people-table-view.tsx`, import `Badge` and `getMemberStatusLabel`. Render a compact badge in the Name cell after the name:

```tsx
        {person.memberStatus ? (
          <Badge
            className="shrink-0 text-muted-foreground"
            variant={person.memberStatus === "active" ? "secondary" : "outline"}
          >
            {person.memberStatus === "active"
              ? "Team member"
              : "Former"}
          </Badge>
        ) : null}
```

In `people-detail-content.tsx`, import `UserCheck` and `Clock3` from `lucide-react`. Add rows after Identity:

```tsx
          {person.memberStatus ? (
            <PropertyRow icon={<UserCheck className={iconClass} />} label="Member">
              {person.memberStatus === "active"
                ? "Team member"
                : "Former member"}
            </PropertyRow>
          ) : null}
          {person.memberRole ? (
            <PropertyRow icon={<Tag className={iconClass} />} label="Role">
              {person.memberRole === "org:admin" ? "Admin" : "Member"}
            </PropertyRow>
          ) : null}
          {person.memberSyncedAt ? (
            <PropertyRow icon={<Clock3 className={iconClass} />} label="Synced">
              {formatRelativeTimeToNow(new Date(person.memberSyncedAt), {
                addSuffix: true,
              })}
            </PropertyRow>
          ) : null}
```

- [ ] **Step 10: Update People UI tests**

In `people-client.test.tsx`, update mocked filters and query expectations to include:

```ts
memberStatuses: [],
sources: [],
```

Update the `queryStates` object in `people-client.test.tsx`:

```ts
const queryStates: Record<string, string | null> = {
  memberStatus: "",
  peopleQuery: "",
  person: null,
  provider: "",
  source: "",
  type: "",
};
```

Add setters:

```ts
const setMemberStatus = vi.fn();
const setSource = vi.fn();
```

Update the `nuqs` setter map:

```ts
      memberStatus: setMemberStatus,
      peopleQuery: setQuery,
      person: setPerson,
      provider: setProvider,
      source: setSource,
      type: setType,
```

Update `beforeEach`:

```ts
  queryStates.memberStatus = "";
  queryStates.source = "";
  setMemberStatus.mockClear();
  setSource.mockClear();
```

Add this test:

```ts
  it("passes source and member status filters into the people list query", () => {
    queryStates.source = "team_member,mixed";
    queryStates.memberStatus = "active";

    render(<PeopleClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        memberStatuses: ["active"],
        providers: undefined,
        search: undefined,
        sources: ["team_member", "mixed"],
        types: undefined,
      },
      expect.anything()
    );
  });
```

In `people-detail-sheet.test.tsx`, add a member-backed person fixture and assert the detail content renders:

```ts
expect(screen.getByText("Team member")).toBeInTheDocument();
expect(screen.getByText("Member")).toBeInTheDocument();
```

- [ ] **Step 11: Run focused UI tests**

Run:

```bash
cd apps/app && pnpm test "people-model|people-search-params|people-view-switcher|people-client|people-detail-sheet"
```

Expected: PASS.

- [ ] **Step 12: Commit**

Run:

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/views/view-switcher.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/people-client.test.tsx"
git commit -m "feat(people): add team member filters and badges"
```

Expected: commit succeeds.

---

## Task 7: Full Verification

**Files:**
- Verify repo-wide generated files and changed implementation files.

- [ ] **Step 1: Run DB audit**

Run:

```bash
pnpm --filter @db/app db:audit
```

Expected: PASS.

- [ ] **Step 2: Run API tests and typecheck**

Run:

```bash
pnpm --filter @api/app test \
  src/__tests__/team-member-people-sync.test.ts \
  src/__tests__/team-member-reconciler-workflow.test.ts \
  src/__tests__/workspace-people-router.test.ts \
  src/__tests__/workspace-people-views-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run app UI tests and typecheck**

Run:

```bash
cd apps/app && pnpm test "people-model|people-search-params|people-view-switcher|people-client|people-detail-sheet"
cd apps/app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Run root checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Inspect migration and final diff**

Run:

```bash
git status --short
git diff --stat HEAD~6..HEAD
```

Expected: worktree clean after prior task commits; diff stat includes app-validation, db schema/migration/utilities/tests, api service/workflow/tests, and People UI files.
