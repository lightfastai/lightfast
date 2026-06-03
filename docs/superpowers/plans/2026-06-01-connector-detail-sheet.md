# Connector Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, right-side detail Sheet for connected connectors that opens from the existing `?connector=` URL param (post-connect) and from a new "View details" item in the connected card's `'…'` menu.

**Architecture:** Frontend-only. The sheet renders entirely from the already-loaded `org.workspace.connectors.list` row (no new tRPC/DB). Selection is driven by the `?connector=<provider>` URL param via `nuqs` (mirroring the signals `?signal=` pattern); the OAuth success callback already lands on that param, so a successful connect auto-opens the sheet (replacing the green banner). Shared display helpers move to a new `connectors-model.ts`. The sheet/content components mirror `signal-detail-sheet.tsx` / `signal-detail-content.tsx`.

**Tech Stack:** Next.js (App Router), React, TypeScript, tRPC (read-only), `nuqs`, `@repo/ui` (shadcn `Sheet`, `Badge`, `Button`, `DropdownMenu`), Vitest + Testing Library, Biome.

---

## File Structure

- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-model.ts`
  — shared connector types + display helpers (`connectionStatus`, `displayProviderName`), so the client and sheet share one source (mirrors `signals-model.ts`).
- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx`
  — the inner sheet layout (header, property block, tools list, footer).
- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx`
  — colocated component test (mirrors `signal-detail-content.test.tsx`).
- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet.tsx`
  — the `Sheet` shell + copy-link handler.
- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet.test.tsx`
  — colocated component test (mirrors `signal-detail-sheet.test.tsx`).
- **Modify** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
  — import from `connectors-model`; switch URL handling to `nuqs`; drop the green success banner; add the "View details" dropdown item; render the sheet.
- **Modify** `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
  — add `nuqs` + sheet-stub mocks; rewrite the callback-clearing tests; add sheet-wiring tests.

`apps/app/.../connectors/page.tsx` is **unchanged** (it still passes `callbackConnector`/`callbackError` for the error banner).

### Shared paths (used verbatim in steps below)

- CONNECTORS_DIR = `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components`
- PAGE_TEST = `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`

All test/lint commands run from `apps/app` unless stated otherwise (`name: @lightfast/app`, `test: vitest run`, `typecheck: tsc --noEmit`). Vitest takes a filename substring filter, e.g. `pnpm test connector-detail`.

---

## Task 1: Extract `connectors-model.ts` (shared types + helpers)

Pure refactor guarded by the existing `connectors-page.test.tsx` suite — no behavior change.

**Files:**
- Create: `CONNECTORS_DIR/connectors-model.ts`
- Modify: `CONNECTORS_DIR/connectors-client.tsx` (top-of-file types + helpers, currently lines 52–89)

- [ ] **Step 1: Create the model module**

Create `CONNECTORS_DIR/connectors-model.ts`:

```ts
import type { AppRouterOutputs } from "@api/app";

export type ConnectorCatalogRow =
  AppRouterOutputs["org"]["workspace"]["connectors"]["list"][number];
export type ConnectorProvider = ConnectorCatalogRow["provider"];
export type ConnectorConnection = NonNullable<ConnectorCatalogRow["connection"]>;
export type ConnectorTool = ConnectorConnection["tools"][number];

export function displayProviderName(provider: string | undefined) {
  if (!provider) {
    return "Connector";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function connectionStatus(connection: ConnectorConnection): {
  dotClass: string;
  label: string;
} {
  if (connection.status === "error") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (connection.lastToolRefreshErrorAt) {
    return { dotClass: "bg-amber-500", label: "Tools stale" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}
```

- [ ] **Step 2: Remove the now-duplicated definitions from the client**

In `CONNECTORS_DIR/connectors-client.tsx`:

1. Delete the `import type { AppRouterOutputs } from "@api/app";` line (line 3) — the type now lives in the model.
2. Delete the local type aliases and helpers (current lines 52–54 and 72–89):

```ts
type ConnectorCatalogRow =
  AppRouterOutputs["org"]["workspace"]["connectors"]["list"][number];
type ConnectorProvider = ConnectorCatalogRow["provider"];
```

and

```ts
function displayProviderName(provider: string | undefined) {
  if (!provider) {
    return "Connector";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function connectionStatus(
  connection: NonNullable<ConnectorCatalogRow["connection"]>
): { dotClass: string; label: string } {
  if (connection.status === "error") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (connection.lastToolRefreshErrorAt) {
    return { dotClass: "bg-amber-500", label: "Tools stale" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}
```

Keep `type StatusFilter`, `CONNECTABLE_PROVIDER`, `ADMIN_REQUIRED_MESSAGE`, `REFRESH_TOOLS_TOAST_ID`, `isConnectableProvider`, `filterMatches`, `isMutationDisabled`, `isConnectDisabled` in the client.

3. Add an import near the other local imports (e.g. just above `import { ConnectorIcon } from "./connector-icons";`):

```ts
import {
  type ConnectorCatalogRow,
  type ConnectorProvider,
  connectionStatus,
  displayProviderName,
} from "./connectors-model";
```

- [ ] **Step 3: Run the existing suite to verify no behavior change**

Run (from `apps/app`): `pnpm test connectors-page`
Expected: PASS — all existing connectors-page tests still green.

- [ ] **Step 4: Typecheck**

Run (from `apps/app`): `pnpm typecheck`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-model.ts" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx"
git commit -m "refactor(connectors): extract shared model helpers into connectors-model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `connector-detail-content.tsx` (read-only sheet body)

**Files:**
- Create: `CONNECTORS_DIR/connector-detail-content.tsx`
- Test: `CONNECTORS_DIR/connector-detail-content.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `CONNECTORS_DIR/connector-detail-content.test.tsx` (renders the real component with real UI primitives, mirroring `signal-detail-content.test.tsx`; asserts only on date-independent text):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorDetailContent } from "./connector-detail-content";
import type { ConnectorCatalogRow } from "./connectors-model";

function connectedRow(
  overrides: Partial<NonNullable<ConnectorCatalogRow["connection"]>> = {}
): ConnectorCatalogRow {
  return {
    availableForAutomations: true,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Project management",
    connectAvailability: { status: "available" },
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "Lightfast App",
      providerWorkspaceName: "Acme Linear",
      status: "active",
      tools: [
        {
          availableForAutomations: true,
          description: "Create a Linear issue",
          name: "create_issue",
        },
        {
          availableForAutomations: false,
          description: "Search Linear issues",
          name: "search_issues",
        },
      ],
      ...overrides,
    },
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
  } as ConnectorCatalogRow;
}

describe("ConnectorDetailContent", () => {
  it("renders identity, automations, and the tools list for a connected row", () => {
    render(
      <ConnectorDetailContent onCopyLink={vi.fn()} row={connectedRow()} />
    );

    expect(
      screen.getByRole("heading", { name: "Linear" })
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Linear")).toBeInTheDocument();
    expect(screen.getByText("Lightfast App")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    // tools heading + count + rows
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("create_issue")).toBeInTheDocument();
    expect(screen.getByText("search_issues")).toBeInTheDocument();
  });

  it("hides workspace/account rows when those fields are null", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({
          providerActorName: null,
          providerWorkspaceName: null,
        })}
      />
    );

    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });

  it("renders the Disabled automations pill", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({ enabledForAutomations: false })}
      />
    );

    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders the tools-stale error code", () => {
    render(
      <ConnectorDetailContent
        onCopyLink={vi.fn()}
        row={connectedRow({
          lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
          lastToolRefreshErrorCode: "linear_unavailable",
        })}
      />
    );

    expect(screen.getAllByText("Tools stale").length).toBeGreaterThan(0);
    expect(screen.getByText("linear_unavailable")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", () => {
    const onCopyLink = vi.fn();
    render(
      <ConnectorDetailContent onCopyLink={onCopyLink} row={connectedRow()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/app`): `pnpm test connector-detail-content`
Expected: FAIL — cannot resolve `./connector-detail-content`.

- [ ] **Step 3: Implement the component**

Create `CONNECTORS_DIR/connector-detail-content.tsx`:

```tsx
"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Activity,
  Building2,
  CalendarDays,
  Link2,
  RefreshCcw,
  User,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { ConnectorIcon } from "./connector-icons";
import { type ConnectorCatalogRow, connectionStatus } from "./connectors-model";

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

export function ConnectorDetailContent({
  closeSlot,
  onCopyLink,
  row,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  row: ConnectorCatalogRow;
}) {
  const connection = row.connection;
  if (!connection) {
    return null;
  }

  const status = connectionStatus(connection);
  const iconClass = "size-4 shrink-0";
  const connectedAt = new Date(connection.connectedAt);
  const lastRefreshAt = connection.lastToolRefreshAt
    ? new Date(connection.lastToolRefreshAt)
    : null;
  const hasRefreshError = Boolean(connection.lastToolRefreshErrorAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <ConnectorIcon
          className="size-7 rounded-[7px]"
          provider={row.provider}
        />
        <span className="font-mono text-muted-foreground text-xs">
          {row.provider}
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground text-sm">
          <span className={cn("size-1.5 rounded-full", status.dotClass)} />
          {status.label}
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
        <h2 className="pt-4 pb-1 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {row.displayName}
        </h2>
        <p className="pb-5 text-muted-foreground text-sm">{row.description}</p>

        <div className="flex flex-col">
          <PropertyRow icon={<Activity className={iconClass} />} label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </PropertyRow>
          {connection.providerWorkspaceName ? (
            <PropertyRow
              icon={<Building2 className={iconClass} />}
              label="Workspace"
            >
              {connection.providerWorkspaceName}
            </PropertyRow>
          ) : null}
          {connection.providerActorName ? (
            <PropertyRow icon={<User className={iconClass} />} label="Account">
              {connection.providerActorName}
            </PropertyRow>
          ) : null}
          <PropertyRow
            icon={<CalendarDays className={iconClass} />}
            label="Connected"
          >
            <span title={connectedAt.toISOString()}>
              {formatRelativeTimeToNow(connectedAt, { addSuffix: true })}
            </span>
          </PropertyRow>
          <PropertyRow
            icon={<Workflow className={iconClass} />}
            label="Automations"
          >
            <Badge className="text-muted-foreground" variant="outline">
              {connection.enabledForAutomations ? "Enabled" : "Disabled"}
            </Badge>
          </PropertyRow>
          {lastRefreshAt ? (
            <PropertyRow
              icon={<RefreshCcw className={iconClass} />}
              label="Tools refreshed"
            >
              {hasRefreshError ? (
                <span className="text-amber-600">
                  {connection.lastToolRefreshErrorCode ?? "Refresh failed"}
                </span>
              ) : (
                <span title={lastRefreshAt.toISOString()}>
                  {formatRelativeTimeToNow(lastRefreshAt, { addSuffix: true })}
                </span>
              )}
            </PropertyRow>
          ) : null}
        </div>

        <div className="my-6 border-border/60 border-t" />

        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground text-sm">Tools</h3>
          <Badge className="px-1.5 text-muted-foreground" variant="secondary">
            {connection.tools.length}
          </Badge>
        </div>
        <div className="mt-2 flex flex-col">
          {connection.tools.map((tool) => (
            <div
              className="flex items-start gap-3 border-border/60 border-t py-2.5 first:border-t-0"
              key={tool.name}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-foreground text-sm">{tool.name}</p>
                {tool.description ? (
                  <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                    {tool.description}
                  </p>
                ) : null}
              </div>
              {tool.availableForAutomations ? (
                <span
                  aria-label="Available for automations"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500"
                  title="Available for automations"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={connectedAt.toISOString()}>
          Connected {formatRelativeTimeToNow(connectedAt, { addSuffix: true })}
        </span>
        {lastRefreshAt && !hasRefreshError ? (
          <>
            <span aria-hidden="true"> · </span>
            <span title={lastRefreshAt.toISOString()}>
              tools refreshed{" "}
              {formatRelativeTimeToNow(lastRefreshAt, { addSuffix: true })}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/app`): `pnpm test connector-detail-content`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx"
git commit -m "feat(connectors): add read-only connector detail content

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `connector-detail-sheet.tsx` (Sheet shell + copy-link)

**Files:**
- Create: `CONNECTORS_DIR/connector-detail-sheet.tsx`
- Test: `CONNECTORS_DIR/connector-detail-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `CONNECTORS_DIR/connector-detail-sheet.test.tsx` (mirrors `signal-detail-sheet.test.tsx`: renders the real Radix `Sheet`, mocks only `sonner`, sets up `navigator.clipboard`):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorDetailSheet } from "./connector-detail-sheet";
import type { ConnectorCatalogRow } from "./connectors-model";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { error: toastMocks.error, success: toastMocks.success },
}));

function connectedRow(): ConnectorCatalogRow {
  return {
    availableForAutomations: true,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Project management",
    connectAvailability: { status: "available" },
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "Lightfast App",
      providerWorkspaceName: "Acme Linear",
      status: "active",
      tools: [
        {
          availableForAutomations: true,
          description: "Create a Linear issue",
          name: "create_issue",
        },
      ],
    },
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
  } as ConnectorCatalogRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("ConnectorDetailSheet", () => {
  it("renders the connector detail when a connected row is provided", () => {
    render(<ConnectorDetailSheet onOpenChange={vi.fn()} row={connectedRow()} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby");
    expect(
      screen.getAllByRole("heading", { name: "Linear" }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("create_issue")).toBeInTheDocument();
  });

  it("does not render the dialog when no row is provided", () => {
    render(<ConnectorDetailSheet onOpenChange={vi.fn()} row={undefined} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error toast when copying the link fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<ConnectorDetailSheet onOpenChange={vi.fn()} row={connectedRow()} />);

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Unable to copy link")
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/app`): `pnpm test connector-detail-sheet`
Expected: FAIL — cannot resolve `./connector-detail-sheet`.

- [ ] **Step 3: Implement the component**

Create `CONNECTORS_DIR/connector-detail-sheet.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { toast } from "@repo/ui/components/ui/sonner";
import { X } from "lucide-react";
import { ConnectorDetailContent } from "./connector-detail-content";
import type { ConnectorCatalogRow } from "./connectors-model";

export function ConnectorDetailSheet({
  onOpenChange,
  row,
}: {
  onOpenChange: (open: boolean) => void;
  row?: ConnectorCatalogRow;
}) {
  const open = Boolean(row?.connection);

  function handleCopyLink() {
    if (typeof window === "undefined") {
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      toast.error("Unable to copy link");
      return;
    }
    void clipboard
      .writeText(window.location.href)
      .then(() => {
        toast.success("Link copied", {
          description: "Anyone with access can open this connector.",
        });
      })
      .catch(() => {
        toast.error("Unable to copy link");
      });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="inset-y-3 right-3 left-auto h-auto w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-md"
        showCloseButton={!row}
        side="right"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{row ? row.displayName : "Connector details"}</SheetTitle>
          <SheetDescription>
            {row?.description ?? "Connector identity, status, and tools."}
          </SheetDescription>
        </SheetHeader>

        {row?.connection ? (
          <ConnectorDetailContent
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
            row={row}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/app`): `pnpm test connector-detail-sheet`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet.test.tsx"
git commit -m "feat(connectors): add connector detail sheet shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire the sheet into `connectors-client.tsx` (nuqs + View details + drop success banner)

This task changes client behavior, so the integration test is updated first (TDD). The real sheet is stubbed in the integration test; its rendering is already covered by Tasks 2–3.

**Files:**
- Modify: `PAGE_TEST`
- Modify: `CONNECTORS_DIR/connectors-client.tsx`

- [ ] **Step 1: Update the integration test (failing) — add mocks + new expectations**

In `PAGE_TEST`:

**1a.** Add nuqs state + setter mocks near the other mock declarations (after `const useSuspenseQueryMock = vi.fn();`, before the `vi.mock` calls):

```tsx
let connectorState: string | null = null;
let errorState: string | null = null;
const setConnectorMock = vi.fn((value: string | null) => {
  connectorState = value;
});
const setErrorMock = vi.fn((value: string | null) => {
  errorState = value;
});
```

**1b.** Add the `nuqs` mock and the sheet stub alongside the existing `vi.mock(...)` blocks:

```tsx
vi.mock("nuqs", () => ({
  useQueryState: (key: string) => {
    if (key === "error") {
      return [errorState, setErrorMock];
    }
    return [connectorState, setConnectorMock];
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet",
  () => ({
    ConnectorDetailSheet: ({
      onOpenChange,
      row,
    }: {
      onOpenChange: (open: boolean) => void;
      row?: { provider: string };
    }) =>
      row ? (
        <div data-provider={row.provider} data-testid="connector-detail-sheet">
          <button onClick={() => onOpenChange(false)} type="button">
            close-sheet
          </button>
        </div>
      ) : null,
  })
);
```

**1c.** In `beforeEach`, reset the new state/mocks (add inside the existing `beforeEach` body):

```tsx
connectorState = null;
errorState = null;
setConnectorMock.mockClear();
setErrorMock.mockClear();
```

**1d.** Replace the two callback-clearing tests (`renders callback errors inline and clears the callback URL` and `clears only callback params and preserves unrelated query params`) with these two:

```tsx
it("renders callback errors inline and clears the callback params", async () => {
  connectorState = "linear";
  errorState = "access_denied";
  useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

  render(
    <ConnectorsClient callbackConnector="linear" callbackError="access_denied" />
  );

  expect(screen.getByText(/linear connection failed/i)).toBeVisible();
  expect(screen.getByText(/access_denied/i)).toBeVisible();
  await waitFor(() => {
    expect(setConnectorMock).toHaveBeenCalledWith(null);
    expect(setErrorMock).toHaveBeenCalledWith(null);
  });
});

it("does not open the detail sheet when a callback error is present", () => {
  connectorState = "linear";
  errorState = "access_denied";
  useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

  render(
    <ConnectorsClient callbackConnector="linear" callbackError="access_denied" />
  );

  expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
});
```

**1e.** Add four new sheet-wiring tests inside the `describe("connectors page", ...)` block:

```tsx
it("opens the detail sheet from the View details action", () => {
  renderClient([connectedLinear()]);

  fireEvent.click(screen.getByRole("button", { name: /view details/i }));
  expect(setConnectorMock).toHaveBeenCalledWith("linear");
});

it("opens the detail sheet for the connector in the URL param", () => {
  connectorState = "linear";
  renderClient([connectedLinear()]);

  const sheet = screen.getByTestId("connector-detail-sheet");
  expect(sheet).toBeVisible();
  expect(sheet).toHaveAttribute("data-provider", "linear");
});

it("does not open the detail sheet for an unconnected provider", () => {
  connectorState = "linear";
  renderClient([row()]);

  expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
});

it("clears the connector param when the sheet is closed", () => {
  connectorState = "linear";
  renderClient([connectedLinear()]);

  fireEvent.click(screen.getByRole("button", { name: "close-sheet" }));
  expect(setConnectorMock).toHaveBeenCalledWith(null);
});
```

> Note: the `next/navigation` mock and `replaceMock` stay declared (now unused) — harmless. The client no longer calls `router.replace`, so no assertions reference `replaceMock` anymore.

- [ ] **Step 2: Run the integration test to verify the new expectations fail**

Run (from `apps/app`): `pnpm test connectors-page`
Expected: FAIL — no "View details" button; sheet stub never renders; `setConnectorMock`/`setErrorMock` not called (client still uses `router.replace`).

- [ ] **Step 3: Update the client — imports**

In `CONNECTORS_DIR/connectors-client.tsx`:

1. Remove `import type { Route } from "next";`.
2. Remove `import { usePathname, useRouter, useSearchParams } from "next/navigation";`.
3. Remove `useEffect` from the `react` import is **not** needed — `useEffect` is still used (see Step 5); keep `useEffect`, `useMemo`, `useState`.
4. Add `import { useQueryState } from "nuqs";` (with the other third-party imports).
5. Add `import { ConnectorDetailSheet } from "./connector-detail-sheet";` (near `import { ConnectorIcon } from "./connector-icons";`).
6. Add `PanelRight` to the existing `lucide-react` import:

```ts
import {
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  PanelRight,
  RefreshCcw,
  Search,
} from "lucide-react";
```

- [ ] **Step 4: Update the client — replace router/searchParams state with nuqs**

In `ConnectorsClient`, delete these three lines:

```ts
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
```

and add (near the other hook calls, after `const queryClient = useQueryClient();`):

```ts
  const [selectedProvider, setSelectedProvider] = useQueryState("connector");
  const [, setErrorParam] = useQueryState("error");
```

- [ ] **Step 5: Update the client — error-only cleanup effect**

Replace the existing cleanup effect:

```ts
  useEffect(() => {
    if (callbackConnector || callbackError) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("connector");
      nextParams.delete("error");
      const queryString = nextParams.toString();
      router.replace(
        (queryString ? `${pathname}?${queryString}` : pathname) as Route
      );
    }
  }, [callbackConnector, callbackError, pathname, router, searchParams]);
```

with:

```ts
  useEffect(() => {
    if (!callbackState.error) {
      return;
    }
    // A failed connect has no connection to show: clear both params so the
    // sheet stays closed and the error banner does not re-trigger on refresh.
    void setSelectedProvider(null);
    void setErrorParam(null);
  }, [callbackState.error, setErrorParam, setSelectedProvider]);
```

- [ ] **Step 6: Update the client — resolve the sheet row + view-details handler**

Add, just after the `disconnect` function (before `const mutationPending = ...`):

```ts
  function viewDetails(row: ConnectorCatalogRow) {
    void setSelectedProvider(row.provider);
  }

  // Never open the sheet on a failed callback (handled by the cleanup effect).
  const sheetProvider = callbackState.error ? null : selectedProvider;
  const sheetRow = sheetProvider
    ? connectors.find((row) => row.provider === sheetProvider && row.connection)
    : undefined;
```

- [ ] **Step 7: Update the client — drop the success banner, pass `onViewDetails`, render the sheet**

**7a.** Delete the green success-banner block:

```tsx
      {callbackState.connector && !callbackState.error && (
        <div className="mt-6 rounded-[9px] border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-600 text-sm">
          {displayProviderName(callbackState.connector)} connected.
        </div>
      )}
```

Keep the red error banner block immediately above it unchanged.

**7b.** Pass `onViewDetails` to the connected card — in the `.map` where `<ConnectedConnectorCard ... />` is rendered, add the prop:

```tsx
              <ConnectedConnectorCard
                key={row.provider}
                onConnect={connect}
                onDisconnect={disconnect}
                onRefreshTools={refreshTools}
                onSetAutomationEnabled={setAutomationEnabled}
                onViewDetails={viewDetails}
                pending={mutationPending}
                refreshing={
                  refreshToolsMutation.isPending &&
                  refreshToolsMutation.variables?.provider === row.provider
                }
                row={row}
              />
```

**7c.** Render the sheet as the last child of the outer `<div className="mx-auto w-full max-w-3xl px-6 py-10">` (just before its closing `</div>`):

```tsx
      <ConnectorDetailSheet
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedProvider(null);
          }
        }}
        row={sheetRow}
      />
```

- [ ] **Step 8: Update the client — add the "View details" dropdown item**

In `ConnectedConnectorCard`'s props type, add:

```ts
  onViewDetails: (row: ConnectorCatalogRow) => void;
```

and destructure `onViewDetails` in the parameter list.

Then, as the first items inside `<DropdownMenuContent align="end">` (before the "Refresh tools" item), add:

```tsx
              <DropdownMenuItem onSelect={() => onViewDetails(row)}>
                <PanelRight className="size-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
```

- [ ] **Step 9: Run the integration test to verify it passes**

Run (from `apps/app`): `pnpm test connectors-page`
Expected: PASS — all existing + new tests green.

- [ ] **Step 10: Run the full connectors test set + typecheck**

Run (from `apps/app`):
- `pnpm test connector` (runs connectors-page + connector-detail-content + connector-detail-sheet)
- `pnpm typecheck`

Expected: PASS for both.

- [ ] **Step 11: Commit**

```bash
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx"
git commit -m "feat(connectors): open detail sheet post-connect and from View details

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint/format the whole repo**

Run (from repo root): `pnpm check`
Expected: PASS (Biome reports no errors on the changed files). If Biome reports auto-fixable issues on the new files, apply them and re-run.

- [ ] **Step 2: Typecheck the app**

Run (from repo root): `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Run the full app test suite once**

Run (from `apps/app`): `pnpm test`
Expected: PASS (no regressions in the broader suite).

- [ ] **Step 4: Manual smoke (optional, if a dev server is running)**

With `pnpm dev` running and a connected Linear connector:
- Open the connectors page, click `'…'` → "View details" → the sheet opens, URL gains `?connector=linear`.
- Close the sheet → `?connector` is removed.
- Visit `…/connectors?connector=linear` directly → the sheet opens on load.
- Simulate a failed callback (`…/connectors?connector=linear&error=access_denied`) → the red banner shows, the sheet does **not** open, and the params are cleared.

---

## Self-Review

**Spec coverage:**
- Right-side sheet modeled on the signals sheet → Tasks 2–3 (same container classes, `PropertyRow`).
- Reuse `?connector=` via nuqs, shareable/refresh-safe → Task 4 Steps 4–7 + integration tests.
- Post-connect auto-open, replacing the green banner → Task 4 Steps 6–7a + the URL-param test.
- Error path keeps banner, clears params, no sheet → Task 4 Step 5 + the two callback tests.
- "View details" in the `'…'` menu → Task 4 Step 8 + the View-details test.
- Render from the cached `list` row (no tRPC/DB) → Tasks 2–3 take a `row` prop; no query added.
- Connected-only → `sheetRow` requires `row.connection`; Sheet `open` gated on `row?.connection`; unconnected-provider test.
- Read-only (no actions) → content/sheet expose no mutations; actions remain in the card.
- "Who" = Linear identity only → Workspace/Account rows use `providerWorkspaceName`/`providerActorName`; no Clerk lookup.
- Degraded status / null-field hiding → `connectionStatus` reuse + null guards + the tools-stale and null-field tests.
- Extract `connectors-model.ts` → Task 1.

**Placeholder scan:** none — every code/step is concrete.

**Type consistency:** `ConnectorCatalogRow`/`ConnectorConnection`/`ConnectorProvider` defined once in `connectors-model.ts` (Task 1) and imported by the client (Task 1 Step 2), content (Task 2), and sheet (Task 3). `connectionStatus(connection: ConnectorConnection)` is called with a non-null connection in both the client card and the content component (each guards `if (!connection) return null;`). `ConnectorDetailSheet` prop is `row?: ConnectorCatalogRow`; `ConnectorDetailContent` prop is `row: ConnectorCatalogRow` (non-optional) — the sheet only renders content inside `row?.connection ?` so the non-optional contract holds. `viewDetails`/`onViewDetails` names match between `ConnectorsClient` and `ConnectedConnectorCard`.
