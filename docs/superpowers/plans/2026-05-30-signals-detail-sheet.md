# Signals Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, right-side detail Sheet that opens when a signal row/card is clicked, driven by a shareable `?signal=<publicId>` URL param and backed by a new `org.workspace.signals.get` tRPC procedure.

**Architecture:** Selection moves from the Zustand store to a nuqs URL param. `SignalsClient` finds the clicked row among loaded list pages and passes it to the sheet for instant render; if the signal is not loaded (deep link / later page), the sheet fetches it by `publicId` via the new `get` procedure. The sheet is split into a pure presentational `SignalDetailContent` (unit-testable without providers) and a `SignalDetailSheet` container that owns the `Sheet` wrapper and data resolution.

**Tech Stack:** Next.js (App Router) client components, tRPC + `@tanstack/react-query`, nuqs, Radix-based `Sheet` from `@repo/ui`, Drizzle (`@db/app`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-30-signals-detail-sheet-design.md`

---

## ⚠️ Working-tree note (read before executing)

This plan was written while `feat/refactor-signals-page-ui` had **active, uncommitted in-progress work** in the signals files and an **unresolved merge state** (`skills-lock.json: needs merge`). During authoring, `signals-model.ts`, `workspace-signals.ts`, `signal-create-dialog.tsx`, and `signals-client.tsx` changed between reads. Therefore:

- **Before editing any existing file in a task, re-read it fresh.** Line numbers and exact surrounding code below are accurate as of authoring but may have moved.
- **Do not run this concurrently with the human's live edits.** Coordinate so edits don't collide and clobber in-progress work.
- `getSignalStatusLabel`, `signalStatusLabels`, and `signalProcessingStatuses` **already exist** in `signals-model.ts` — reuse them; do not re-add.
- `SignalCreateDialog` already takes `listQueryKeys: QueryKey[]` (plural), and `signals-client.tsx` already passes `listQueryKeys={refreshListQueryKeys}`. Leave that wiring alone.

## File Structure

**Create:**
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.tsx` — pure presentational panel (header actions, title, property rows, body sections, footer). No data fetching.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-sheet.tsx` — container: `Sheet` wrapper, data resolution (loaded row vs `get` fallback), skeleton / not-found states.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx` — unit tests for the presentational panel.

**Modify:**
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts` — add `get` procedure.
- `api/app/src/__tests__/workspace-signals-router.test.ts` — mock `getSignalByPublicId`; add `get` tests.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts` — add `formatSignalConfidence`, `getSignalSource` (+ `SignalSource` type).
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-search-params.ts` — add `signalParser`.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store.ts` — remove selection state (keep `collapsedListGroups`).
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts` — return a `signalsByPublicId` lookup.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx` — drive selection from URL, render the sheet.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts` — create (helper unit tests).
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx` — add open/close/deep-link/copy-link cases.

---

## Task 1: `org.workspace.signals.get` tRPC procedure

**Files:**
- Modify: `api/app/src/__tests__/workspace-signals-router.test.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`

- [ ] **Step 1: Re-read both files fresh** (working-tree is live). Confirm the `@db/app` mock block and the `signalRow` fixture still match what's shown below.

- [ ] **Step 2: Add the `getSignalByPublicId` mock + reset**

In `workspace-signals-router.test.ts`, add the mock fn near `listSignalsMock`:

```ts
const getSignalByPublicIdMock = vi.fn();
```

Extend the existing `vi.mock("@db/app", ...)` to expose it:

```ts
vi.mock("@db/app", () => ({
  listSignals: listSignalsMock,
  getSignalByPublicId: getSignalByPublicIdMock,
}));
```

In the existing `beforeEach`, add:

```ts
getSignalByPublicIdMock.mockReset();
getSignalByPublicIdMock.mockResolvedValue(signalRow);
```

- [ ] **Step 3: Write the failing tests**

Append this describe block to `workspace-signals-router.test.ts`:

```ts
describe("workspaceSignalsRouter.get", () => {
  it("returns the org-scoped signal for a matching publicId", async () => {
    await expect(
      caller().signals.get({ publicId: signalRow.publicId })
    ).resolves.toEqual(signalRow);

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: signalRow.publicId,
      clerkOrgId: "org_test",
    });
  });

  it("scopes the lookup to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.get({
      publicId: signalRow.publicId,
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: signalRow.publicId,
      clerkOrgId: "org_other",
    });
  });

  it("throws NOT_FOUND when the signal does not exist", async () => {
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      caller().signals.get({
        publicId: "signal_00000000-0000-4000-8000-000000000000",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid signal ids before querying", async () => {
    await expect(
      caller().signals.get({ publicId: "not-a-signal-id" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(getSignalByPublicIdMock).not.toHaveBeenCalled();
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
      caller(identity).signals.get({ publicId: signalRow.publicId })
    ).rejects.toMatchObject({ code });

    expect(getSignalByPublicIdMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd api/app && pnpm with-env vitest run src/__tests__/workspace-signals-router.test.ts -t "workspaceSignalsRouter.get"`
Expected: FAIL — `signals.get` is not a function on the caller.

- [ ] **Step 5: Implement the `get` procedure**

In `workspace-signals.ts`, update the `@db/app` import and the `@repo/api-contract` import:

```ts
import { getSignalByPublicId, listSignals } from "@db/app";
import {
  createSignalInput,
  signalDispositionSchema,
  signalIdSchema,
  signalKindSchema,
  signalPrioritySchema,
  signalStatusSchema,
} from "@repo/api-contract";
```

Add the `get` procedure to `workspaceSignalsRouter` (after `list`, before `create`):

```ts
  get: boundOrgProcedure
    .input(z.object({ publicId: signalIdSchema }))
    .query(async ({ ctx, input }) => {
      const signal = await getSignalByPublicId(ctx.db, {
        publicId: input.publicId,
        clerkOrgId: ctx.auth.identity.orgId,
      });

      if (!signal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signal not found",
        });
      }

      return signal;
    }),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api/app && pnpm with-env vitest run src/__tests__/workspace-signals-router.test.ts`
Expected: PASS (existing `list`/`create` tests + new `get` tests).

- [ ] **Step 7: Typecheck the API package**

Run: `pnpm --filter @api/app build`
Expected: succeeds (this is the canonical tRPC type check).

- [ ] **Step 8: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/workspace-signals.ts" "api/app/src/__tests__/workspace-signals-router.test.ts"
git commit -m "feat(signals): add org-scoped signals.get procedure"
```

---

## Task 2: Model helpers (`formatSignalConfidence`, `getSignalSource`)

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts`

> `getSignalStatusLabel`, `getSignalKindLabel`, `getSignalPriorityLabel`, `getSignalDispositionLabel`, `getSignalTitle`, and `formatSignalIdentifier` already exist — do not re-create them.

- [ ] **Step 1: Write the failing test**

Create `signals-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SignalRow } from "./signals-model";
import { formatSignalConfidence, getSignalSource } from "./signals-model";

function rowWith(overrides: Partial<SignalRow>): SignalRow {
  return overrides as SignalRow;
}

describe("formatSignalConfidence", () => {
  it("renders a 0..1 confidence as a rounded percentage", () => {
    expect(formatSignalConfidence(0.912)).toBe("91%");
    expect(formatSignalConfidence(0)).toBe("0%");
    expect(formatSignalConfidence(1)).toBe("100%");
  });
});

describe("getSignalSource", () => {
  it("labels API-key-created signals as an API key", () => {
    const source = getSignalSource(rowWith({ createdByApiKeyId: "key_123" }));
    expect(source).toEqual({ isApiKey: true, label: "API key" });
  });

  it("labels signals without an API key as a user", () => {
    const source = getSignalSource(rowWith({ createdByApiKeyId: null }));
    expect(source).toEqual({ isApiKey: false, label: "User" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts"`
Expected: FAIL — `formatSignalConfidence`/`getSignalSource` are not exported.

- [ ] **Step 3: Implement the helpers**

Add to `signals-model.ts` (after `formatSignalIdentifier`):

```ts
export function formatSignalConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export interface SignalSource {
  isApiKey: boolean;
  label: string;
}

export function getSignalSource(signal: SignalRow): SignalSource {
  if (signal.createdByApiKeyId) {
    return { isApiKey: true, label: "API key" };
  }
  return { isApiKey: false, label: "User" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-model.test.ts"
git commit -m "feat(signals): add confidence and source model helpers"
```

---

## Task 3: `SignalDetailContent` presentational panel

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.tsx`

This component takes a `SignalRow` and renders. No tRPC, no providers — so it's testable directly.

- [ ] **Step 1: Write the failing test**

Create `signal-detail-content.test.tsx`:

```tsx
import type { SignalRow } from "./signals-model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalDetailContent } from "./signal-detail-content";

const classifiedSignal: SignalRow = {
  id: 7,
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
} as SignalRow;

function makeSignal(overrides: Partial<SignalRow>): SignalRow {
  return { ...classifiedSignal, ...overrides } as SignalRow;
}

describe("SignalDetailContent", () => {
  it("renders the identifier, title, classification properties, and body for a classified signal", () => {
    render(<SignalDetailContent onCopyLink={vi.fn()} signal={classifiedSignal} />);

    expect(screen.getByText("SIG-7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Follow up on migration" })
    ).toBeInTheDocument();
    expect(screen.getByText("Actionable")).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("Classified")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for migration help")).toBeInTheDocument();
    expect(screen.getByText("Reply with migration plan")).toBeInTheDocument();
    expect(screen.getByText("The customer is asking for help.")).toBeInTheDocument();
  });

  it("shows a User source when there is no API key", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({ createdByApiKeyId: null })}
      />
    );
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("hides classification-only rows when the signal is not yet classified", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({
          classification: null,
          status: "processing",
        })}
      />
    );

    expect(screen.queryByText("Disposition")).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
    // Status row and input still render.
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for migration help")).toBeInTheDocument();
  });

  it("renders the error section for a failed signal", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({
          classification: null,
          status: "failed",
          errorCode: "CLASSIFY_FAILED",
          errorMessage: "Model timed out",
        })}
      />
    );

    expect(screen.getByText("CLASSIFY_FAILED")).toBeInTheDocument();
    expect(screen.getByText("Model timed out")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", async () => {
    const onCopyLink = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<SignalDetailContent onCopyLink={onCopyLink} signal={classifiedSignal} />);

    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx"`
Expected: FAIL — module `./signal-detail-content` not found.

- [ ] **Step 3: Implement `SignalDetailContent`**

Create `signal-detail-content.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Calendar,
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
  type SignalRow,
} from "./signals-model";

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-2 py-1.5">
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 text-foreground text-sm">{children}</div>
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
    <div className="space-y-1">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h3>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
        {children}
      </p>
    </div>
  );
}

export function SignalDetailContent({
  onCopyLink,
  signal,
}: {
  onCopyLink: () => void;
  signal: SignalRow;
}) {
  const classification = signal.classification;
  const title = getSignalTitle(signal);
  const source = getSignalSource(signal);
  const createdAt = new Date(signal.createdAt);
  const updatedAt = new Date(signal.updatedAt);
  const peopleRouting = classification?.routing?.classifyPeople;
  const iconClass = "size-3.5 shrink-0";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pr-12">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(signal)}
        </span>
        {classification ? (
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground text-xs">
            {getSignalDispositionLabel(classification.disposition)}
          </span>
        ) : null}
        <Button
          aria-label="Copy link"
          className="ml-auto size-7 rounded-md text-muted-foreground hover:text-foreground"
          onClick={onCopyLink}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Link2 aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="overflow-y-auto px-4 pb-4">
        <h2 className="pt-3 pb-4 font-semibold text-foreground text-xl leading-tight">
          {title}
        </h2>

        <div className="divide-y divide-border/40">
          {classification ? (
            <PropertyRow icon={<CircleDot className={iconClass} />} label="Disposition">
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
            <PropertyRow icon={<Gauge className={iconClass} />} label="Confidence">
              {formatSignalConfidence(classification.confidence)}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<LoaderCircle className={iconClass} />} label="Status">
            {getSignalStatusLabel(signal.status)}
          </PropertyRow>
          {peopleRouting ? (
            <PropertyRow icon={<Users className={iconClass} />} label="People routing">
              <span>{peopleRouting.shouldRun ? "Yes" : "No"}</span>
              {peopleRouting.rationale ? (
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {peopleRouting.rationale}
                </p>
              ) : null}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<KeyRound className={iconClass} />} label="Source">
            {source.label}
          </PropertyRow>
          <PropertyRow icon={<Calendar className={iconClass} />} label="Created">
            <time dateTime={createdAt.toISOString()} title={createdAt.toISOString()}>
              {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
            </time>
          </PropertyRow>
        </div>

        <div className="mt-6 space-y-5 border-border/60 border-t pt-5">
          <BodySection label="Input">{signal.input}</BodySection>
          {classification?.summary ? (
            <BodySection label="Summary">{classification.summary}</BodySection>
          ) : null}
          {classification?.nextAction ? (
            <BodySection label="Next action">{classification.nextAction}</BodySection>
          ) : null}
          {classification?.rationale ? (
            <BodySection label="Rationale">{classification.rationale}</BodySection>
          ) : null}
          {signal.status === "failed" ? (
            <div className="space-y-1">
              <h3 className="font-medium text-destructive text-xs uppercase tracking-wide">
                Error
              </h3>
              {signal.errorCode ? (
                <p className="font-mono text-destructive text-sm">{signal.errorCode}</p>
              ) : null}
              {signal.errorMessage ? (
                <p className="text-muted-foreground text-sm">{signal.errorMessage}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 border-border/60 border-t pt-4 text-muted-foreground text-xs">
          <span title={createdAt.toISOString()}>
            Created {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
          </span>
          <span aria-hidden="true"> · </span>
          <span title={updatedAt.toISOString()}>
            Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
```

> If `@testing-library/user-event` is not already a dev dependency in `apps/app`, the copy-link test step's dynamic import will fail — in that case replace it with `fireEvent.click(screen.getByRole("button", { name: /copy link/i }))` from `@testing-library/react`. Check `apps/app/package.json` during Step 1.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-content.test.tsx"
git commit -m "feat(signals): add signal detail content panel"
```

---

## Task 4: `SignalDetailSheet` container

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-sheet.tsx`

No standalone test here — its data-resolution behavior is exercised by the client integration test in Task 6. (Mounting it alone requires a tRPC + QueryClient provider, which the client test already sets up.)

- [ ] **Step 1: Implement `SignalDetailSheet`**

Create `signal-detail-sheet.tsx`:

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { SignalDetailContent } from "./signal-detail-content";
import { getSignalTitle, type SignalRow } from "./signals-model";

export function SignalDetailSheet({
  initialSignal,
  onOpenChange,
  publicId,
}: {
  initialSignal?: SignalRow;
  onOpenChange: (open: boolean) => void;
  publicId: string | null;
}) {
  const trpc = useTRPC();
  const open = publicId !== null;
  const hasInitial = !!initialSignal && initialSignal.publicId === publicId;

  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: publicId ?? "" },
      { enabled: open && !hasInitial && Boolean(publicId) }
    )
  );

  const signal = hasInitial ? initialSignal : query.data;

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
        className="w-full gap-0 p-0 sm:max-w-md"
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{signal ? getSignalTitle(signal) : "Signal details"}</SheetTitle>
        </SheetHeader>

        {signal ? (
          <SignalDetailContent onCopyLink={handleCopyLink} signal={signal} />
        ) : query.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium text-foreground text-sm">Signal not found</p>
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

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && pnpm with-env tsc --noEmit -p tsconfig.json`
Expected: no errors from `signal-detail-sheet.tsx`. (If the app has no direct `tsc` script, rely on the Task 6 `pnpm typecheck`.)

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-detail-sheet.tsx"
git commit -m "feat(signals): add signal detail sheet container"
```

---

## Task 5: URL param, slim store, and `signalsByPublicId` lookup

**Files:**
- Modify: `apps/app/.../signals/_components/signals-search-params.ts`
- Modify: `apps/app/.../signals/_components/signals-ui-store.ts`
- Modify: `apps/app/.../signals/_components/use-signals-workspace-data.ts`

- [ ] **Step 1: Re-read all three files fresh** (live worktree).

- [ ] **Step 2: Add the `signal` URL parser**

In `signals-search-params.ts`, `parseAsString` is already imported. Add:

```ts
export const signalParser = parseAsString;
```

(No `.withDefault` — absent param resolves to `null`, which the sheet reads as "closed".)

- [ ] **Step 3: Confirm no other consumer of the store's selection fields**

Run: `grep -rn "selectedSignalId\|selectSignal\|clearSelection" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals"`
Expected: only `signals-client.tsx`, `signals-list-view.tsx`, and `signals-board-view.tsx` reference them as props (not the store). If anything else reads the *store* fields, stop and reconcile before removing.

- [ ] **Step 4: Slim the Zustand store**

Replace `signals-ui-store.ts` with selection removed (keep group collapse):

```ts
"use client";

import { create } from "zustand";

interface SignalsUiState {
  collapsedListGroups: Record<string, boolean>;
  toggleListGroup: (groupId: string) => void;
}

export const useSignalsUiStore = create<SignalsUiState>((set) => ({
  collapsedListGroups: {},
  toggleListGroup: (groupId) =>
    set((state) => ({
      collapsedListGroups: {
        ...state.collapsedListGroups,
        [groupId]: !state.collapsedListGroups[groupId],
      },
    })),
}));
```

- [ ] **Step 5: Return a `signalsByPublicId` lookup from the workspace-data hook**

In `use-signals-workspace-data.ts`, after `classifiedRows` and `processingRows` are computed, add:

```ts
  const signalsByPublicId = useMemo(() => {
    const map = new Map<string, SignalRow>();
    for (const row of processingRows) {
      map.set(row.publicId, row);
    }
    for (const row of classifiedRows) {
      map.set(row.publicId, row);
    }
    return map;
  }, [classifiedRows, processingRows]);
```

Add `signalsByPublicId` to the returned object (the `return { ... }` near the end). `SignalRow` and `useMemo` are already imported.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck` (or the repo-root `pnpm typecheck` if the app filter name differs — check `apps/app/package.json` `name`).
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-search-params.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/use-signals-workspace-data.ts"
git commit -m "feat(signals): drive selection via url param and expose row lookup"
```

---

## Task 6: Wire the sheet into `SignalsClient` + integration tests

**Files:**
- Modify: `apps/app/.../signals/_components/signals-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Re-read both files fresh** (live worktree — `signals-client.tsx` has been changing). Note the current imports, the `useSignalsUiStore` selection lines, and how `onSelectSignal`/`selectedSignalId` are passed to `<SignalsListView>` and `<SignalsBoardView>`.

- [ ] **Step 2: Add the failing integration tests**

In `signals-client.test.tsx`, add cases following the file's existing render/mock harness (tRPC mock, nuqs provider). Use the test IDs/labels the existing rows already expose. Representative cases:

```tsx
it("opens the detail sheet and sets the ?signal= param when a row is clicked", async () => {
  // render SignalsClient via the file's existing helper, with at least one
  // classified signal in the mocked list response.
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Follow up on migration/i }));

  // Sheet content shows the signal.
  expect(
    await screen.findByRole("heading", { name: "Follow up on migration" })
  ).toBeInTheDocument();
  // URL reflects the selection (nuqs testing adapter / window.location).
  expect(window.location.search).toContain(
    "signal=signal_123e4567-e89b-12d3-a456-426614174000"
  );
});

it("clears the ?signal= param when the sheet is closed", async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Follow up on migration/i }));
  await screen.findByRole("heading", { name: "Follow up on migration" });

  await user.click(screen.getByRole("button", { name: /close/i }));
  expect(window.location.search).not.toContain("signal=");
});

it("opens the sheet on mount from an initial ?signal= param (deep link)", async () => {
  // set the nuqs initial search param to the signal publicId before render,
  // using the same mechanism other tests in this file use for `view`/filters.
  expect(
    await screen.findByRole("heading", { name: "Follow up on migration" })
  ).toBeInTheDocument();
});
```

> Match the file's existing nuqs setup. If it wraps renders in `NuqsTestingAdapter` / `withNuqsTestingAdapter`, set `searchParams={{ signal: "signal_..." }}` for the deep-link case and read `onUrlUpdate` instead of `window.location` for the assertion. Mirror whatever the existing `view`/filter tests do.

- [ ] **Step 3: Run to verify the new tests fail**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"`
Expected: the new cases FAIL (no sheet rendered, param not set).

- [ ] **Step 4: Wire selection to the URL and render the sheet**

In `signals-client.tsx`:

1. Add imports:

```ts
import { SignalDetailSheet } from "./signal-detail-sheet";
import { signalParser } from "./signals-search-params";
```

2. Replace the store-based selection (`const selectedSignalId = useSignalsUiStore(...)` and `const selectSignal = useSignalsUiStore(...)`) with the URL param:

```ts
const [selectedSignalId, setSelectedSignalId] = useQueryState(
  "signal",
  signalParser
);
```

Keep `collapsedGroups` and `toggleListGroup` from the store as they are.

3. Pull the lookup from the workspace-data hook (add `signalsByPublicId` to the destructured result alongside `boardSections`, `visibleListSections`, etc.):

```ts
const {
  boardSections,
  hasAnyRows,
  signalsByPublicId,
  visibleListSections,
  // ...whatever else is already destructured (e.g. refreshListQueryKeys source)
} = useSignalsWorkspaceData({ filters, search: "" });
```

4. Change the views' `onSelectSignal` to set the param (replace `onSelectSignal={selectSignal}` in BOTH `<SignalsBoardView>` and `<SignalsListView>`):

```tsx
onSelectSignal={(publicId) => void setSelectedSignalId(publicId)}
```

`selectedSignalId={selectedSignalId}` stays as-is.

5. Render the sheet once, just before `</WorkspaceSurface>` (after the `<SignalCreateDialog .../>`):

```tsx
<SignalDetailSheet
  initialSignal={
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
```

- [ ] **Step 5: Run the full signals client test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"`
Expected: PASS (existing cases + new sheet cases).

- [ ] **Step 6: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat(signals): open detail sheet on row select"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the signals-related test suites**

Run:
```bash
cd api/app && pnpm with-env vitest run src/__tests__/workspace-signals-router.test.ts
cd ../../apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
```
Expected: all PASS.

- [ ] **Step 2: Lint + typecheck the workspace**

Run: `pnpm check && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke (optional but recommended)**

With `pnpm dev` running, open the signals page, click a row → sheet opens, URL gains `?signal=…`. Refresh the page → sheet re-opens (via `get` fallback). Copy-link → toast + clipboard. Close → param clears. Click a `failed` signal → Error section shows.

- [ ] **Step 4: Final commit (only if Step 2 required fixes)**

```bash
git add -A
git commit -m "chore(signals): lint/type fixes for detail sheet"
```

---

## Self-Review

**Spec coverage:**
- `get` procedure → Task 1. ✅
- URL param + slim store → Task 5. ✅
- `SignalDetailContent` (header/title/properties/body/footer, hide-when-absent, failed error) → Task 3. ✅
- `SignalDetailSheet` (instant row, `get` fallback, skeleton, not-found) → Task 4. ✅
- Wiring + integration tests (open/close/deep-link/copy-link) → Task 6. ✅
- Model helpers `formatSignalConfidence`/`getSignalSource` → Task 2. ✅
- `getSignalStatusLabel` reuse (already exists) → noted, not re-added. ✅

**Deviations from spec (intentional):**
- People-routing rationale renders as an inline muted line, not a tooltip, to avoid depending on an unverified `Tooltip` component. Behavior (Yes/No + rationale) is preserved.
- Copy-link toast copies `window.location.href` (which carries `?signal=`) rather than constructing a URL manually.

**Type consistency:** `SignalRow` is the single row type across all tasks; `SignalDetailSheet` props (`publicId`, `initialSignal`, `onOpenChange`) match the wiring in Task 6; `getSignalSource` returns `{ isApiKey, label }` used consistently; `signalParser` returns `string | null` matching `publicId: string | null`.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only deliberately-deferred specifics are the exact nuqs test-harness calls in Task 6 (the existing test file's adapter is the source of truth) and the `user-event` availability check in Task 3 — both flagged with concrete fallbacks.
