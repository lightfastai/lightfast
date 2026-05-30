# Create New Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the production Clerk-session "New signal" flow to the Signals workspace page and route every submission through the existing durable signal classification pipeline.

**Architecture:** Use one shared server helper for signal row creation, Inngest enqueueing, and enqueue failure handling. Add a bound-org tRPC mutation for the user-facing app, refactor the existing public oRPC create route to call the same helper, and keep AI classification in the existing Inngest workflow. The UI is a single-submit dialog composer that invalidates only the list query currently shown.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, tRPC, oRPC, Drizzle ORM on PlanetScale MySQL, Inngest, Clerk session auth, Vitest, Testing Library, shadcn-style `@repo/ui` primitives.

---

## Performance And Efficiency Decisions

- Do not import `@repo/ui/components/ai-elements/prompt-input` or `@repo/ui/components/chat/chat-input` for this flow. Those components bring attachment, dropdown, and AI message affordances that the single-submit signal composer does not need.
- Keep the browser submission path to one mutation and one targeted query invalidation: `invalidateQueries({ queryKey: listQueryOptions.queryKey, exact: true })`.
- Do not optimistically insert into the signal list. The row may be hidden by the active status filter, and duplicating list grouping/filter behavior on the client adds drift.
- Keep classification asynchronous through the existing `app/signal.created` event and `classify-signal` workflow. No browser import from `@repo/ai`.
- Keep DB reads unchanged for listing. The schema change only relaxes `created_by_api_key_id` nullability; no new indexes are required for this create path.
- Use the existing `Textarea` CSS `field-sizing-content` behavior for auto-grow. Avoid a custom resize effect on every keystroke.

## File Structure

- Modify `db/app/src/schema/tables/signals.ts`
  - Make `createdByApiKeyId` nullable so Clerk-session UI-created signals can exist without an API key id.
- Modify `db/app/src/utils/signals.ts`
  - Change `CreateSignalRecordInput.createdByApiKeyId` to `string | null`.
- Modify `db/app/src/__tests__/signals-list.test.ts`
  - Add coverage for creating a signal with `createdByApiKeyId: null`.
- Generate migration files under `db/app/src/migrations/`
  - Run `pnpm db:generate`. Do not hand-write or edit SQL.
- Create `api/app/src/signals/create-signal.ts`
  - Shared create-and-enqueue helper used by both tRPC and oRPC.
- Create `api/app/src/__tests__/signal-create-service.test.ts`
  - Focused helper tests for enqueue success, API key/null creator ids, and enqueue failure marking.
- Modify `api/app/src/orpc/router/signals.ts`
  - Replace duplicated create/enqueue code with the shared helper.
- Modify `api/app/src/__tests__/signal-orpc.test.ts`
  - Keep public API behavior covered after the refactor.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
  - Add `create` mutation under `org.workspace.signals`.
- Modify `api/app/src/__tests__/workspace-signals-router.test.ts`
  - Add create mutation tests for auth, input validation, org scoping, and nullable API key attribution.
- Modify `apps/app/package.json`
  - Add `@repo/api-contract` as a direct workspace dependency for the client-safe signal input length constant.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx`
  - Dialog and single-submit chat-style composer.
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
  - Add toolbar and empty-state buttons, open the dialog, and pass the current list query key for exact invalidation.
- Modify `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`
  - Add user-facing create flow tests.

---

### Task 1: Allow UI-Created Signals Without API Keys

**Files:**
- Modify: `db/app/src/__tests__/signals-list.test.ts`
- Modify: `db/app/src/schema/tables/signals.ts`
- Modify: `db/app/src/utils/signals.ts`
- Generate: `db/app/src/migrations/*`

- [ ] **Step 1: Write the failing DB utility test**

Add `createSignal` to the imports in `db/app/src/__tests__/signals-list.test.ts`:

```ts
import { createSignal, listSignals } from "../utils/signals";
```

Add this helper below `makeListDb`:

```ts
function makeCreateDb() {
  let inserted: Partial<Signal> | null = null;

  const spies = {
    values: vi.fn(async (value: Partial<Signal>) => {
      inserted = value;
    }),
    where: vi.fn(),
    limit: vi.fn(() =>
      Promise.resolve(
        inserted
          ? [
              makeSignal({
                ...inserted,
                id: 11,
                createdAt: new Date("2026-05-27T03:00:00.000Z"),
                updatedAt: new Date("2026-05-27T03:00:00.000Z"),
              }),
            ]
          : []
      )
    ),
  };

  const db = {
    insert: () => ({
      values: spies.values,
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            limit: spies.limit,
          };
        },
      }),
    }),
  };

  return { db: db as unknown as Database, spies };
}
```

Add this test after the existing `listSignals` test block:

```ts
describe("createSignal", () => {
  it("creates a queued signal without an API key id", async () => {
    const { db, spies } = makeCreateDb();

    await expect(
      createSignal(db, {
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create a user-facing signal",
      })
    ).resolves.toMatchObject({
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create a user-facing signal",
      status: "queued",
    });

    expect(spies.values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create a user-facing signal",
        status: "queued",
      })
    );
  });
});
```

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
```

Expected: FAIL because `CreateSignalRecordInput.createdByApiKeyId` still requires `string`, and the schema still infers the selected `Signal.createdByApiKeyId` as non-null.

- [ ] **Step 3: Update the schema and utility type**

In `db/app/src/schema/tables/signals.ts`, replace the `createdByApiKeyId` column block with:

```ts
    createdByApiKeyId: varchar("created_by_api_key_id", {
      length: API_KEY_ID_LENGTH,
    }),
```

In `db/app/src/utils/signals.ts`, replace the input interface with:

```ts
export interface CreateSignalRecordInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  input: string;
}
```

No insert logic change is needed. Keep this existing insert field:

```ts
    createdByApiKeyId: input.createdByApiKeyId,
```

- [ ] **Step 4: Generate the Drizzle migration**

Run from the repository root:

```bash
pnpm db:generate
```

Expected: Drizzle creates the next numbered migration SQL file under `db/app/src/migrations/`, updates `db/app/src/migrations/meta/_journal.json`, and writes the matching snapshot JSON. Do not write or edit the SQL by hand.

- [ ] **Step 5: Run the DB test and typecheck**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the DB nullability change**

Run:

```bash
git add db/app/src/schema/tables/signals.ts db/app/src/utils/signals.ts db/app/src/__tests__/signals-list.test.ts db/app/src/migrations
git commit -m "feat: allow ui-created signals without api keys"
```

---

### Task 2: Add The Shared Signal Create-And-Enqueue Helper

**Files:**
- Create: `api/app/src/signals/create-signal.ts`
- Create: `api/app/src/__tests__/signal-create-service.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `api/app/src/__tests__/signal-create-service.test.ts` with:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignalMock = vi.fn();
const markSignalFailedMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@db/app", () => ({
  createSignal: createSignalMock,
  markSignalFailed: markSignalFailedMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));

const {
  SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
  SignalCreateQueueError,
  createAndQueueSignal,
  isSignalCreateQueueError,
} = await import("../signals/create-signal");

const db = { kind: "mock-db" } as unknown as Database;

beforeEach(() => {
  createSignalMock.mockReset();
  markSignalFailedMock.mockReset();
  sendMock.mockReset();

  createSignalMock.mockResolvedValue({
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    status: "queued",
  });
  markSignalFailedMock.mockResolvedValue(true);
  sendMock.mockResolvedValue(undefined);
});

describe("createAndQueueSignal", () => {
  it("creates a signal and sends the classification event", async () => {
    await expect(
      createAndQueueSignal(db, {
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create from app UI",
      })
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });

    expect(createSignalMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create from app UI",
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/signal.created",
      data: {
        clerkOrgId: "org_test",
        signalId: "signal_123e4567-e89b-12d3-a456-426614174000",
      },
    });
  });

  it("preserves API key attribution for public API-created signals", async () => {
    await createAndQueueSignal(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Create from public API",
    });

    expect(createSignalMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Create from public API",
    });
  });

  it("marks the created signal failed and throws a typed error when enqueue fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("inngest unavailable"));

    const error = await createAndQueueSignal(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create from app UI",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SignalCreateQueueError);
    expect(isSignalCreateQueueError(error)).toBe(true);
    expect(markSignalFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
      errorMessage: "inngest unavailable",
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    });
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts
```

Expected: FAIL with a module resolution error because `api/app/src/signals/create-signal.ts` does not exist.

- [ ] **Step 3: Implement the shared helper**

Create `api/app/src/signals/create-signal.ts` with:

```ts
import type { Database } from "@db/app";
import { createSignal, markSignalFailed } from "@db/app";
import type { CreateSignalOutput } from "@repo/api-contract";

export const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";
const QUEUE_ERROR_MESSAGE = "Failed to queue signal for classification.";

export interface CreateAndQueueSignalInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  input: string;
}

export class SignalCreateQueueError extends Error {
  constructor(cause: unknown) {
    super(QUEUE_ERROR_MESSAGE, { cause });
    this.name = "SignalCreateQueueError";
  }
}

export function isSignalCreateQueueError(
  error: unknown
): error is SignalCreateQueueError {
  return error instanceof SignalCreateQueueError;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createAndQueueSignal(
  db: Database,
  input: CreateAndQueueSignalInput
): Promise<CreateSignalOutput> {
  const signal = await createSignal(db, {
    clerkOrgId: input.clerkOrgId,
    createdByApiKeyId: input.createdByApiKeyId,
    createdByUserId: input.createdByUserId,
    input: input.input,
  });

  try {
    const { inngest } = await import("../inngest/client");
    await inngest.send({
      name: "app/signal.created",
      data: {
        clerkOrgId: signal.clerkOrgId,
        signalId: signal.publicId,
      },
    });
  } catch (error) {
    await markSignalFailed(db, {
      publicId: signal.publicId,
      clerkOrgId: signal.clerkOrgId,
      errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
      errorMessage: getErrorMessage(error),
    });
    throw new SignalCreateQueueError(error);
  }

  return {
    id: signal.publicId,
    status: "queued",
  };
}
```

- [ ] **Step 4: Run the helper test and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the shared helper**

Run:

```bash
git add api/app/src/signals/create-signal.ts api/app/src/__tests__/signal-create-service.test.ts
git commit -m "feat: share signal creation enqueue service"
```

---

### Task 3: Refactor Public oRPC Creation To Use The Helper

**Files:**
- Modify: `api/app/src/orpc/router/signals.ts`
- Modify: `api/app/src/__tests__/signal-orpc.test.ts`

- [ ] **Step 1: Update the oRPC test setup to keep public behavior covered**

In `api/app/src/__tests__/signal-orpc.test.ts`, keep the existing `@db/app` and `../inngest/client` mocks. They should continue to cover the real helper through the public route.

Add this assertion to the existing `"creates a queued signal and sends an Inngest event"` test after the `sendMock` assertion:

```ts
    expect(markSignalFailedMock).not.toHaveBeenCalled();
```

This fails after the refactor only if the public route stops using the shared enqueue path correctly.

- [ ] **Step 2: Run the oRPC test before the refactor**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-orpc.test.ts
```

Expected: PASS. This is a behavior-preservation checkpoint before deleting duplicated route logic.

- [ ] **Step 3: Replace duplicated create/enqueue logic in the oRPC router**

In `api/app/src/orpc/router/signals.ts`, replace the first import:

```ts
import { getSignalByPublicId } from "@db/app";
```

Add the helper import:

```ts
import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
```

Remove the local constants and helper:

```ts
const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Replace the `signals.create` handler body with:

```ts
    async ({ context, input }) => {
      const createInput = input as CreateSignalInput;

      try {
        return await createAndQueueSignal(db, {
          clerkOrgId: context.auth.identity.orgId,
          createdByApiKeyId: context.apiKeyId,
          createdByUserId: context.auth.identity.userId,
          input: createInput.input,
        });
      } catch (error) {
        if (isSignalCreateQueueError(error)) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: error.message,
          });
        }
        throw error;
      }
    }
```

- [ ] **Step 4: Run public oRPC tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-orpc.test.ts src/__tests__/signal-create-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the oRPC refactor**

Run:

```bash
git add api/app/src/orpc/router/signals.ts api/app/src/__tests__/signal-orpc.test.ts
git commit -m "refactor: route public signal create through shared service"
```

---

### Task 4: Add The Bound-Org tRPC Create Mutation

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Modify: `api/app/src/__tests__/workspace-signals-router.test.ts`

- [ ] **Step 1: Write failing tRPC create tests**

In `api/app/src/__tests__/workspace-signals-router.test.ts`, add this mock near `listSignalsMock`:

```ts
const createAndQueueSignalMock = vi.fn();
```

Add this mock after the `@db/app` mock:

```ts
vi.mock("../signals/create-signal", () => ({
  createAndQueueSignal: createAndQueueSignalMock,
  isSignalCreateQueueError: (error: unknown) =>
    error instanceof Error && error.name === "SignalCreateQueueError",
}));
```

In `beforeEach`, reset and seed the mock:

```ts
  createAndQueueSignalMock.mockReset();
  createAndQueueSignalMock.mockResolvedValue({
    id: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "queued",
  });
```

Add this describe block after the existing `workspaceSignalsRouter.list` block:

```ts
describe("workspaceSignalsRouter.create", () => {
  it("trims input and creates a queued signal for the bound org", async () => {
    await expect(
      caller().signals.create({ input: "  Reply to the migration thread  " })
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });

    expect(createAndQueueSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Reply to the migration thread",
    });
  });

  it("scopes creation to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.create({
      input: "Track this from the active org",
    });

    expect(createAndQueueSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_other",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Track this from the active org",
    });
  });

  it("rejects invalid input before creating a signal", async () => {
    await expect(
      caller().signals.create({ input: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(createAndQueueSignalMock).not.toHaveBeenCalled();
  });

  it("translates enqueue failures to an internal tRPC error", async () => {
    const enqueueError = Object.assign(
      new Error("Failed to queue signal for classification."),
      { name: "SignalCreateQueueError" }
    );
    createAndQueueSignalMock.mockRejectedValueOnce(enqueueError);

    await expect(
      caller().signals.create({ input: "Queue this signal" })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to queue signal for classification.",
    });
  });

  it.each([
    ["pending identity", pendingIdentity, "FORBIDDEN"],
    ["unauthenticated identity", unauthenticatedIdentity, "UNAUTHORIZED"],
    [
      "unbound org",
      { ...activeIdentity, orgGate: { bindingStatus: "unbound" as const } },
      "FORBIDDEN",
    ],
    [
      "revoked org",
      { ...activeIdentity, orgGate: { bindingStatus: "revoked" as const } },
      "FORBIDDEN",
    ],
  ])("rejects %s", async (_label, identity, code) => {
    await expect(
      caller(identity).signals.create({ input: "Create a signal" })
    ).rejects.toMatchObject({ code });

    expect(createAndQueueSignalMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tRPC router test and verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts
```

Expected: FAIL because `signals.create` does not exist.

- [ ] **Step 3: Implement the mutation**

In `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, update imports:

```ts
import { listSignals } from "@db/app";
import { createSignalInput, signalStatusSchema } from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
import { boundOrgProcedure } from "../../trpc";
```

Add the `create` mutation after `list`:

```ts
  create: boundOrgProcedure.input(createSignalInput).mutation(async ({ ctx, input }) => {
    try {
      return await createAndQueueSignal(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByApiKeyId: null,
        createdByUserId: ctx.auth.identity.userId,
        input: input.input,
      });
    } catch (error) {
      if (isSignalCreateQueueError(error)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
          cause: error,
        });
      }
      throw error;
    }
  }),
```

If the formatter complains about line length, format the mutation as:

```ts
  create: boundOrgProcedure
    .input(createSignalInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createAndQueueSignal(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
          createdByApiKeyId: null,
          createdByUserId: ctx.auth.identity.userId,
          input: input.input,
        });
      } catch (error) {
        if (isSignalCreateQueueError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
```

- [ ] **Step 4: Run tRPC tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts src/__tests__/signal-create-service.test.ts src/__tests__/signal-orpc.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the tRPC mutation**

Run:

```bash
git add 'api/app/src/router/(pending-not-allowed)/workspace-signals.ts' api/app/src/__tests__/workspace-signals-router.test.ts
git commit -m "feat: add workspace signal create mutation"
```

---

### Task 5: Add The Single-Submit Signal Composer UI

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Add the direct client dependency**

In `apps/app/package.json`, add this dependency in alphabetical order near the other `@repo/*` dependencies:

```json
    "@repo/api-contract": "workspace:*",
```

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` stays consistent with the new workspace dependency. If pnpm reports no lockfile diff, continue.

- [ ] **Step 2: Update UI tests for the create flow**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`, add this import:

```ts
import type { ReactNode } from "react";
```

Add these mocks and test helpers near the current mocks:

```ts
const createMutationOptionsMock = vi.fn((options: unknown) => options);
const invalidateQueriesMock = vi.fn();
const mutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children?: ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));
```

Update the `useTRPC` mock to include the create mutation:

```ts
          create: {
            mutationOptions: createMutationOptionsMock,
          },
```

Replace the current `@tanstack/react-query` mock with:

```ts
vi.mock("@tanstack/react-query", () => ({
  useMutation: useMutationMock,
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
  useSuspenseQuery: useSuspenseQueryMock,
}));
```

In `beforeEach`, reset and seed the new mocks:

```ts
  createMutationOptionsMock.mockClear();
  invalidateQueriesMock.mockReset();
  mutateMock.mockReset();
  toastSuccessMock.mockReset();
  useMutationMock.mockReset();
  useMutationMock.mockImplementation(
    (options: {
      onSuccess?: (data: { id: string; status: "queued" }) => void;
    }) => ({
      isPending: false,
      mutate: (variables: { input: string }) => {
        mutateMock(variables);
        options.onSuccess?.({
          id: "signal_323e4567-e89b-12d3-a456-426614174000",
          status: "queued",
        });
      },
    })
  );
```

Add these tests inside `describe("SignalsClient", () => { ... })`:

```ts
  it("renders the New signal toolbar button", () => {
    render(<SignalsClient />);

    expect(
      screen.getByRole("button", { name: "New signal" })
    ).toBeInTheDocument();
  });

  it("opens and closes the create signal dialog", () => {
    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "New signal" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New signal" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks blank signal submission", () => {
    render(<SignalsClient />);
    fireEvent.click(screen.getByRole("button", { name: "New signal" }));

    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("submits a valid signal and invalidates the current list query", () => {
    render(<SignalsClient />);
    fireEvent.click(screen.getByRole("button", { name: "New signal" }));

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "  Customer asked for rollout timing  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer asked for rollout timing",
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryOptions.queryKey,
      exact: true,
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Signal queued", {
      description: "Classification will start shortly.",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves input when the create mutation does not succeed", () => {
    useMutationMock.mockImplementation(() => ({
      isPending: false,
      mutate: (variables: { input: string }) => {
        mutateMock(variables);
      },
    }));

    render(<SignalsClient />);
    fireEvent.click(screen.getByRole("button", { name: "New signal" }));

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "Keep this input" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "Keep this input"
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the empty-state create action when there are no signals", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<SignalsClient />);

    expect(screen.getByText("No signals yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "New signal" }).length
    ).toBeGreaterThanOrEqual(2);
  });
```

- [ ] **Step 3: Run the UI test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: FAIL because the button, dialog, mutation path, and empty-state action do not exist yet.

- [ ] **Step 4: Create the signal composer dialog**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx` with:

```tsx
"use client";

import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { toast } from "@repo/ui/components/ui/sonner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2, X } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

interface SignalCreateDialogProps {
  listQueryKey: QueryKey;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function SignalCreateDialog({
  listQueryKey,
  onOpenChange,
  open,
}: SignalCreateDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const descriptionId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState("");

  const trimmedInput = useMemo(() => input.trim(), [input]);
  const isOverLimit = input.length > SIGNAL_INPUT_MAX_LENGTH;

  const createMutation = useMutation(
    trpc.org.workspace.signals.create.mutationOptions({
      meta: { errorTitle: "Failed to create signal" },
      onSuccess: () => {
        setInput("");
        onOpenChange(false);
        toast.success("Signal queued", {
          description: "Classification will start shortly.",
        });
        void queryClient.invalidateQueries({
          queryKey: listQueryKey,
          exact: true,
        });
      },
    })
  );

  const isSubmitDisabled =
    createMutation.isPending || trimmedInput.length === 0 || isOverLimit;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }
    createMutation.mutate({ input: trimmedInput });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-4 p-4 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>New signal</DialogTitle>
          <DialogDescription id={descriptionId}>
            Add one raw signal. Lightfast will classify it after submission.
          </DialogDescription>
        </DialogHeader>

        <form
          aria-label="Create signal"
          aria-describedby={descriptionId}
          className="rounded-xl border border-border/70 bg-muted/15 p-2"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <Textarea
            aria-label="Signal input"
            autoFocus
            className="max-h-52 min-h-32 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            disabled={createMutation.isPending}
            onChange={(event) => setInput(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a customer request, product signal, support note, or internal observation..."
            value={input}
          />

          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span
              className={
                isOverLimit
                  ? "text-destructive text-xs"
                  : "text-muted-foreground text-xs"
              }
            >
              {input.length}/{SIGNAL_INPUT_MAX_LENGTH}
            </span>

            <div className="flex items-center gap-2">
              <Button
                aria-label="Close"
                className="size-8 rounded-full"
                disabled={createMutation.isPending}
                onClick={() => onOpenChange(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
              <Button
                aria-label="Submit signal"
                className="size-8 rounded-full"
                disabled={isSubmitDisabled}
                size="icon"
                type="submit"
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire the dialog into the Signals page**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx`, add `Plus` to the lucide imports:

```ts
  Plus,
```

Add the dialog import:

```ts
import { SignalCreateDialog } from "./signal-create-dialog";
```

Inside `SignalsClient`, add create dialog state near the existing state:

```ts
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
```

Add this helper near `toggleGroup`:

```ts
  function openCreateDialog() {
    setCreateDialogOpen(true);
  }
```

Add the toolbar button before the search label:

```tsx
          <Button
            aria-label="New signal"
            className="h-8 rounded-full px-3"
            onClick={openCreateDialog}
            size="sm"
            type="button"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New signal</span>
          </Button>
```

Pass the empty-state handler:

```tsx
        <SignalsEmptyState
          hasFilters={hasFilters}
          onCreateSignal={openCreateDialog}
        />
```

Render the dialog as a child of `WorkspaceSurface`, after the list/empty-state conditional:

```tsx
      <SignalCreateDialog
        listQueryKey={listQueryOptions.queryKey}
        onOpenChange={setCreateDialogOpen}
        open={isCreateDialogOpen}
      />
```

Replace `SignalsEmptyState` with:

```tsx
function SignalsEmptyState({
  hasFilters,
  onCreateSignal,
}: {
  hasFilters: boolean;
  onCreateSignal: () => void;
}) {
  return (
    <div className="px-3 py-3">
      <div className="flex min-h-96 flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center">
        <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <SignalIcon className="size-4 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">
          {hasFilters ? "No matching signals" : "No signals yet"}
        </p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          {hasFilters
            ? "Try a different search or status filter."
            : "Signals created by API keys, automations, and teammates will appear here."}
        </p>
        {!hasFilters && (
          <Button
            className="mt-4 h-8 rounded-full px-3"
            onClick={onCreateSignal}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-3.5" />
            New signal
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run UI tests and app typecheck**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the UI flow**

Run:

```bash
git add apps/app/package.json pnpm-lock.yaml 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx' 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx' 'apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
git commit -m "feat: add signal create composer"
```

---

### Task 6: Full Verification And Browser Smoke

**Files:**
- Verify all files changed by Tasks 1-5.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts src/__tests__/workspace-signals-router.test.ts src/__tests__/signal-orpc.test.ts
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run focused typechecks**

Run:

```bash
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run workspace checks**

Run:

```bash
pnpm check
```

Expected: PASS or only unrelated pre-existing findings. If unrelated findings appear, record the exact command output in the handoff.

- [ ] **Step 4: Start the app stack for a browser smoke test**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Expected: the app, API, local Inngest, QStash, and Portless aggregate start. Use the app URL printed by Portless, normally `https://lightfast.localhost`.

- [ ] **Step 5: Smoke-test the user-facing flow**

In the browser:

1. Open the Signals page for a bound org.
2. Click `New signal`.
3. Type `Customer asked whether the rollout can start next week.`
4. Press Enter.
5. Confirm the dialog closes and the success toast says `Signal queued`.
6. Confirm the Signals list refetches.
7. Confirm the created row appears when the active filter includes queued signals.
8. Confirm local Inngest receives `app/signal.created` and runs `classify-signal`.

Expected: no console errors, no server errors, and no client-side imports from `@repo/ai` in the Signals page bundle.

- [ ] **Step 6: Final git status check**

Run:

```bash
git status --short
```

Expected: clean except for unrelated user changes that were present before implementation. Do not stage unrelated files.
