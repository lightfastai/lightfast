# Shared View Switcher Library + UX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the duplicate Signals/People view switchers into one shared component library, upgrade the create/delete flows to the invite-member action-dialog style (incl. a new delete-confirm step), add a `+N` overflow dropdown to the action bar, and let the filter toolbar wrap downward instead of horizontal-scroll-clipping.

**Architecture:** A new entity-agnostic `(workspace)/_components/views/` library — `<ViewSwitcher>` (pills + `+N` overflow + dialogs), `<ViewCreateDialog>`, `<ViewDeleteDialog>`, and a pure `partitionViews` helper. Signals/People keep thin wrappers that inject their icon, label, nuqs params, and tRPC mutation hooks. The switcher knows nothing about signals-vs-people.

**Tech Stack:** Next.js App Router, React, nuqs, TanStack Query + tRPC, `@repo/ui` (Radix Dialog/DropdownMenu), Vitest + Testing Library (happy-dom; UI primitives mocked per repo convention), Biome/ultracite.

**Locked decisions (approved via mockup + AskUserQuestion):**
- Overflow cap = **fixed**: `All` + first **3** saved-view pills inline, rest in `+N` dropdown.
- **Promote active into view**: an active view that would otherwise be in overflow is pulled into the last inline pill slot, so the current selection is *always* a visible pill (and therefore never hidden in the `+N` menu). Consequence: the `+N` dropdown rows are **select-only** — to delete an overflow view you select it (it promotes to a pill) and delete from the pill. This removes the fragile nested-interactive-in-`DropdownMenuItem` pattern.
- Delete confirm uses **`Dialog` + `DialogActions`/`DialogActionButton`** (invite-member style) with the `destructive` variant — matching the upgraded create dialog.

**Overflow bugs being fixed:**
1. Topbar switcher `overflow-x-auto` pill row scrolls/clips with many views → fixed by `+N` dropdown + promote-active.
2. Filter toolbar `overflow-x-auto` clips chips on one line → fixed by wrapping downward (flex, no fixed height).

---

## File Structure

Base: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)`

**New shared library — `{Base}/_components/views/`:**
- `partition-views.ts` — `ViewSwitcherItem`, `MAX_INLINE_VIEWS`, pure `partitionViews()`.
- `partition-views.test.ts` — unit tests for the partition/promote logic.
- `view-create-dialog.tsx` — `ViewCreateDialog` (action-dialog style).
- `view-create-dialog.test.tsx`
- `view-delete-dialog.tsx` — `ViewDeleteDialog` (action-dialog, destructive).
- `view-delete-dialog.test.tsx`
- `view-switcher.tsx` — `ViewSwitcher` + `ViewSwitcherProps` (pills + `+N` + dialogs).
- `view-switcher.test.tsx`

**Modified wrappers:**
- `signals/_components/signals-view-switcher.tsx` — thin wrapper over `<ViewSwitcher>`.
- `signals/_components/signals-view-switcher.test.tsx` — rewritten to stub the shared switcher.
- `people/_components/people-view-switcher.tsx` — thin wrapper.
- `people/_components/people-view-switcher.test.tsx` — rewritten.

**Modified toolbars (CSS-only):**
- `signals/_components/signals-toolbar.tsx`
- `people/_components/people-toolbar.tsx`

**Deleted (replaced by shared dialog):**
- `signals/_components/signal-create-view-dialog.tsx`
- `people/_components/people-create-view-dialog.tsx`

**Test command (from repo root):** `pnpm --filter @lightfast/app test <pattern>` (script is `vitest run`).

---

## Task 1: `partitionViews` pure helper

**Files:**
- Create: `{Base}/_components/views/partition-views.ts`
- Test: `{Base}/_components/views/partition-views.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_VIEWS,
  partitionViews,
  type ViewSwitcherItem,
} from "./partition-views";

function views(count: number): ViewSwitcherItem[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `View ${index + 1}`,
    publicId: `v_${index}`,
  }));
}

describe("partitionViews", () => {
  it("keeps every view inline at or under the cap", () => {
    const { overflow, visible } = partitionViews(views(3), null);
    expect(visible).toHaveLength(3);
    expect(overflow).toHaveLength(0);
  });

  it("collapses the tail into overflow past the cap", () => {
    const { overflow, visible } = partitionViews(views(5), null);
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_2"]);
    expect(overflow.map((v) => v.publicId)).toEqual(["v_3", "v_4"]);
  });

  it("keeps order stable when the active view is already inline", () => {
    const { visible } = partitionViews(views(5), "v_1");
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_2"]);
  });

  it("promotes an overflowed active view into the last inline slot", () => {
    const { overflow, visible } = partitionViews(views(5), "v_4");
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_4"]);
    expect(overflow.map((v) => v.publicId)).toEqual(["v_2", "v_3"]);
  });

  it("defaults the cap to MAX_INLINE_VIEWS", () => {
    expect(partitionViews(views(4), null).visible).toHaveLength(
      MAX_INLINE_VIEWS
    );
  });
});
```

- [ ] **Step 2: Run, expect fail** — `pnpm --filter @lightfast/app test partition-views` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** A view as far as the switcher cares — id + label, entity-agnostic. */
export interface ViewSwitcherItem {
  name: string;
  publicId: string;
}

/**
 * Max saved-view pills rendered inline next to "All". Everything beyond this
 * collapses into the "+N" overflow dropdown. The active view is always promoted
 * into the inline set (see partitionViews), so it is never hidden in overflow.
 */
export const MAX_INLINE_VIEWS = 3;

/**
 * Split saved views into inline pills vs the overflow dropdown.
 *
 * - ≤ cap views: all inline, no overflow.
 * - active view within the first `cap`: stable first-`cap` inline.
 * - active view beyond `cap`: promote it into the last inline slot so the
 *   current selection is always a visible pill; the displaced views (original
 *   order, minus the promoted one) go to overflow.
 */
export function partitionViews<T extends ViewSwitcherItem>(
  views: T[],
  activeViewId: string | null,
  cap: number = MAX_INLINE_VIEWS
): { overflow: T[]; visible: T[] } {
  if (views.length <= cap) {
    return { overflow: [], visible: views };
  }

  const activeIndex = activeViewId
    ? views.findIndex((view) => view.publicId === activeViewId)
    : -1;

  if (activeIndex < cap) {
    return { overflow: views.slice(cap), visible: views.slice(0, cap) };
  }

  const visible = [...views.slice(0, cap - 1), views[activeIndex] as T];
  const visibleIds = new Set(visible.map((view) => view.publicId));
  const overflow = views.filter((view) => !visibleIds.has(view.publicId));
  return { overflow, visible };
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** — `feat(views): add partitionViews overflow helper`.

---

## Task 2: `ViewCreateDialog` (action-dialog style)

**Files:**
- Create: `{Base}/_components/views/view-create-dialog.tsx`
- Test: `{Base}/_components/views/view-create-dialog.test.tsx`

- [ ] **Step 1: Failing test** (mock `@repo/ui` primitives as plain `open`-respecting elements — repo convention):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogActionButton: ({
    children,
    variant: _variant,
    ...props
  }: { children?: ReactNode; variant?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DialogActions: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

const { ViewCreateDialog } = await import("./view-create-dialog");

describe("ViewCreateDialog", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  let onSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
    onSubmit = vi.fn().mockResolvedValue({ publicId: "v_new" });
  });

  it("disables Save until a name is entered", () => {
    render(<ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />);
    expect(screen.getByRole("button", { name: "Save view" })).toBeDisabled();
  });

  it("submits the trimmed name and closes on success", async () => {
    render(<ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />);
    fireEvent.change(screen.getByPlaceholderText("View name"), {
      target: { value: "  High priority  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("High priority"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("submits on Enter", async () => {
    render(<ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />);
    const input = screen.getByPlaceholderText("View name");
    fireEvent.change(input, { target: { value: "Bugs" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Bugs"));
  });
});
```

- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement**

```tsx
"use client";

import {
  Dialog,
  DialogActionButton,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Save-current-filters-as-a-view dialog. Entity-agnostic: the parent owns the
 * config snapshot and performs the create inside `onSubmit`, which resolves on
 * success (we close + reset) and rejects to keep the dialog open for a retry.
 */
export function ViewCreateDialog({
  onOpenChange,
  onSubmit,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<unknown>;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setName("");
      onOpenChange(false);
    } catch {
      // Surfaced upstream (toast); keep the dialog open.
    } finally {
      setSubmitting(false);
    }
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
              void submit();
            }
          }}
          placeholder="View name"
          value={name}
        />
        <DialogActions>
          <DialogClose asChild>
            <DialogActionButton>Cancel</DialogActionButton>
          </DialogClose>
          <DialogActionButton
            disabled={!name.trim() || submitting}
            onClick={() => void submit()}
            variant="primary"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save view"
            )}
          </DialogActionButton>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** — `feat(views): add action-style ViewCreateDialog`.

---

## Task 3: `ViewDeleteDialog` (action-dialog, destructive)

**Files:**
- Create: `{Base}/_components/views/view-delete-dialog.tsx`
- Test: `{Base}/_components/views/view-delete-dialog.test.tsx`

- [ ] **Step 1: Failing test** (same dialog mock as Task 2):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogActionButton: ({
    children,
    variant: _variant,
    ...props
  }: { children?: ReactNode; variant?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DialogActions: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

const { ViewDeleteDialog } = await import("./view-delete-dialog");

describe("ViewDeleteDialog", () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn().mockResolvedValue(undefined);
    onOpenChange = vi.fn();
  });

  it("renders nothing when no view is targeted", () => {
    render(<ViewDeleteDialog onConfirm={onConfirm} onOpenChange={onOpenChange} view={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the targeted view in the confirmation copy", () => {
    render(
      <ViewDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        view={{ name: "High priority", publicId: "v_1" }}
      />
    );
    expect(screen.getByText(/High priority/)).toBeInTheDocument();
  });

  it("confirms deletion and closes", async () => {
    render(
      <ViewDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        view={{ name: "High priority", publicId: "v_1" }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete view" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("v_1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
```

- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement**

```tsx
"use client";

import {
  Dialog,
  DialogActionButton,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ViewSwitcherItem } from "./partition-views";

/**
 * Confirm before deleting a saved view. Open while `view` is non-null. Mirrors
 * the invite-member action-dialog (full-bleed split buttons); confirm uses the
 * destructive variant. The parent performs the delete inside `onConfirm`.
 */
export function ViewDeleteDialog({
  onConfirm,
  onOpenChange,
  view,
}: {
  onConfirm: (publicId: string) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  view: ViewSwitcherItem | null;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!view || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(view.publicId);
      onOpenChange(false);
    } catch {
      // Surfaced upstream; keep open for a retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={view !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete view</DialogTitle>
          <DialogDescription>
            {view
              ? `“${view.name}” will be removed from your personal views. This can’t be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogActions>
          <DialogClose asChild>
            <DialogActionButton>Cancel</DialogActionButton>
          </DialogClose>
          <DialogActionButton
            disabled={submitting}
            onClick={() => void confirm()}
            variant="destructive"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete view"
            )}
          </DialogActionButton>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** — `feat(views): add destructive ViewDeleteDialog`.

---

## Task 4: `ViewSwitcher` (pills + `+N` overflow + dialogs)

**Files:**
- Create: `{Base}/_components/views/view-switcher.tsx`
- Test: `{Base}/_components/views/view-switcher.test.tsx`

- [ ] **Step 1: Failing test** (mock dialog + dropdown-menu + input; `DropdownMenuContent` → `null` so overflow rows aren't pills; use **exact** role names to avoid the "Delete X"/"X" collision):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "./view-switcher";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: () => null,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogActionButton: ({
    children,
    variant: _variant,
    ...props
  }: { children?: ReactNode; variant?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  DialogActions: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

const { ViewSwitcher } = await import("./view-switcher");

function makeViews(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `View ${i + 1}`,
    publicId: `v_${i + 1}`,
  }));
}

describe("ViewSwitcher", () => {
  let props: ViewSwitcherProps;

  beforeEach(() => {
    props = {
      activeViewId: null,
      allLabel: "All signals",
      icon: LayoutGrid,
      onCreate: vi.fn().mockResolvedValue(undefined),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onSelectAll: vi.fn(),
      onSelectView: vi.fn(),
      views: [],
    };
  });

  it("renders the All pill", () => {
    render(<ViewSwitcher {...props} />);
    expect(screen.getByRole("button", { name: "All signals" })).toBeInTheDocument();
  });

  it("renders one pill per view and no overflow within the cap", () => {
    render(<ViewSwitcher {...props} views={makeViews(3)} />);
    expect(screen.getByRole("button", { name: "View 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More views" })).toBeNull();
  });

  it("collapses past the cap into a +N overflow trigger", () => {
    render(<ViewSwitcher {...props} views={makeViews(5)} />);
    expect(screen.getByRole("button", { name: "More views" })).toHaveTextContent("+2");
    expect(screen.queryByRole("button", { name: "View 4" })).toBeNull();
  });

  it("selects a view when its pill is clicked", () => {
    render(<ViewSwitcher {...props} views={makeViews(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "View 2" }));
    expect(props.onSelectView).toHaveBeenCalledWith("v_2");
  });

  it("selects All when the All pill is clicked", () => {
    render(<ViewSwitcher {...props} activeViewId="v_1" views={makeViews(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "All signals" }));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("opens the create dialog from the + button", () => {
    render(<ViewSwitcher {...props} />);
    expect(screen.queryByText("Save view")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(screen.getByText("Save view")).toBeInTheDocument();
  });

  it("opens a delete confirm (not an immediate delete) from a pill", () => {
    render(<ViewSwitcher {...props} views={makeViews(1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete View 1" }));
    expect(screen.getByText("Delete view")).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement**

```tsx
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, type LucideIcon, Plus, X } from "lucide-react";
import { useState } from "react";
import { partitionViews, type ViewSwitcherItem } from "./partition-views";
import { ViewCreateDialog } from "./view-create-dialog";
import { ViewDeleteDialog } from "./view-delete-dialog";

export type { ViewSwitcherItem } from "./partition-views";

export interface ViewSwitcherProps {
  activeViewId: string | null;
  allLabel: string;
  icon: LucideIcon;
  onCreate: (name: string) => Promise<unknown>;
  onDelete: (publicId: string) => Promise<unknown>;
  onSelectAll: () => void;
  onSelectView: (publicId: string) => void;
  views: ViewSwitcherItem[];
}

/**
 * Shared views bar for Signals and People. "All" is synthetic (active when no
 * saved view). Saved views render as pills up to MAX_INLINE_VIEWS; the rest
 * collapse into a "+N" dropdown. The active view is always promoted into the
 * inline pills (partitionViews), so it is never hidden — the overflow rows are
 * therefore select-only, and deletion always happens from a pill. Create/delete
 * go through confirm dialogs.
 *
 * Entity specifics (icon, label, param wiring, mutations) are injected by thin
 * per-entity wrappers — this component knows nothing about signals vs people.
 */
export function ViewSwitcher({
  activeViewId,
  allLabel,
  icon: Icon,
  onCreate,
  onDelete,
  onSelectAll,
  onSelectView,
  views,
}: ViewSwitcherProps) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ViewSwitcherItem | null>(
    null
  );

  const { overflow, visible } = partitionViews(views, activeViewId);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <button
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors",
              activeViewId
                ? "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                : "border-border/70 bg-muted/60 text-foreground"
            )}
            data-active={!activeViewId}
            onClick={onSelectAll}
            type="button"
          >
            <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span>{allLabel}</span>
          </button>

          {visible.map((view) => {
            const isActive = activeViewId === view.publicId;
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
                  onClick={() => onSelectView(view.publicId)}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                  <span className="max-w-[12rem] truncate">{view.name}</span>
                </button>
                <button
                  aria-label={`Delete ${view.name}`}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  onClick={() => setPendingDelete(view)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </div>
            );
          })}

          {overflow.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More views"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                  type="button"
                >
                  +{overflow.length}
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60" sideOffset={8}>
                {overflow.map((view) => (
                  <DropdownMenuItem
                    className="gap-2"
                    key={view.publicId}
                    onSelect={() => onSelectView(view.publicId)}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
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

      <ViewCreateDialog
        onOpenChange={setCreateOpen}
        onSubmit={onCreate}
        open={isCreateOpen}
      />
      <ViewDeleteDialog
        onConfirm={onDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        view={pendingDelete}
      />
    </>
  );
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** — `feat(views): add shared ViewSwitcher with +N overflow`.

---

## Task 5: Rewire `SignalsViewSwitcher` + rewrite test + delete old dialog

**Files:**
- Modify (replace): `signals/_components/signals-view-switcher.tsx`
- Modify (replace): `signals/_components/signals-view-switcher.test.tsx`
- Delete: `signals/_components/signal-create-view-dialog.tsx`

- [ ] **Step 1: Rewrite the test** (stub the shared switcher; assert param wiring + create/delete via `mutateAsync`):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "../../_components/views/view-switcher";
import type { SignalViewRow } from "./signals-views-model";

interface Params {
  disposition: string;
  kind: string;
  people: "all" | "routed";
  priority: string;
  view: string | null;
}

let paramsState: Params;
const setParamsMock = vi.fn();

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryStates: () => [paramsState, setParamsMock] as const,
}));

let viewsData: SignalViewRow[] = [];
const createAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("./use-signal-views-query", () => ({
  useCreateSignalView: () => ({ mutateAsync: createAsync }),
  useDeleteSignalView: () => ({ mutateAsync: deleteAsync }),
  useSignalViewsQuery: () => ({ data: viewsData }),
}));

let switcherProps: ViewSwitcherProps;
vi.mock("../../_components/views/view-switcher", () => ({
  ViewSwitcher: (props: ViewSwitcherProps) => {
    switcherProps = props;
    return (
      <div>
        <button onClick={props.onSelectAll} type="button">all</button>
        <button onClick={() => props.onSelectView("sigview_1")} type="button">select</button>
        <button onClick={() => void props.onCreate("My view")} type="button">create</button>
        <button onClick={() => void props.onDelete("sigview_1")} type="button">delete</button>
      </div>
    );
  },
}));

const { SignalsViewSwitcher } = await import("./signals-view-switcher");

function makeView(overrides: Partial<SignalViewRow> = {}): SignalViewRow {
  return {
    clerkOrgId: "org_test",
    config: {
      filters: {
        dispositions: ["actionable"],
        kinds: ["bug"],
        peopleRouted: true,
        priorities: ["urgent"],
      },
    },
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    name: "High priority",
    publicId: "sigview_1",
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  } as SignalViewRow;
}

beforeEach(() => {
  paramsState = { disposition: "", kind: "", people: "all", priority: "", view: null };
  viewsData = [];
  createAsync.mockReset().mockResolvedValue({ publicId: "sigview_new" });
  deleteAsync.mockReset().mockResolvedValue(undefined);
  setParamsMock.mockReset();
});

describe("SignalsViewSwitcher", () => {
  it("passes signals identity to the shared switcher", () => {
    render(<SignalsViewSwitcher />);
    expect(switcherProps.allLabel).toBe("All signals");
  });

  it("stamps a view's filters and ?view atomically on select", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: "actionable",
        kind: "bug",
        people: "routed",
        priority: "urgent",
        view: "sigview_1",
      })
    );
  });

  it("clears filters and ?view on All", () => {
    paramsState.view = "sigview_1";
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: "", kind: "", people: "all", priority: "", view: null })
    );
  });

  it("creates a view then selects it", async () => {
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() =>
      expect(createAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "My view" }))
    );
    await waitFor(() => expect(setParamsMock).toHaveBeenCalledWith({ view: "sigview_new" }));
  });

  it("deletes the active view and clears ?view", async () => {
    paramsState.view = "sigview_1";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith({ publicId: "sigview_1" }));
    await waitFor(() => expect(setParamsMock).toHaveBeenCalledWith({ view: null }));
  });
});
```

- [ ] **Step 2: Run, expect fail** (old switcher still imports the create dialog / uses `mutate`).
- [ ] **Step 3: Replace `signals-view-switcher.tsx`** with the thin wrapper:

```tsx
"use client";

import { LayoutGrid } from "lucide-react";
import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
import {
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  signalDispositionParser,
  signalKindParser,
  signalPeopleParser,
  signalPriorityParser,
  signalSavedViewParser,
} from "./signals-search-params";
import {
  ALL_SIGNALS_VIEW_NAME,
  allSignalsParamValues,
  selectionToConfig,
  viewConfigToParamValues,
} from "./signals-views-model";
import {
  useCreateSignalView,
  useDeleteSignalView,
  useSignalViewsQuery,
} from "./use-signal-views-query";

/**
 * Signals views bar — wires the shared <ViewSwitcher> to the signals URL params
 * (5 params, written atomically via nuqs) and the signals views tRPC router.
 */
export function SignalsViewSwitcher() {
  const [params, setParams] = useQueryStates({
    disposition: signalDispositionParser,
    kind: signalKindParser,
    people: signalPeopleParser,
    priority: signalPriorityParser,
    view: signalSavedViewParser,
  });

  const viewsQuery = useSignalViewsQuery();
  const createView = useCreateSignalView();
  const deleteView = useDeleteSignalView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    dispositions: parseSignalDispositions(params.disposition),
    kinds: parseSignalKinds(params.kind),
    peopleRouted: params.people === "routed",
    priorities: parseSignalPriorities(params.priority),
  });

  return (
    <ViewSwitcher
      activeViewId={activeViewId}
      allLabel={ALL_SIGNALS_VIEW_NAME}
      icon={LayoutGrid}
      onCreate={async (name) => {
        const view = await createView.mutateAsync({ config: currentConfig, name });
        void setParams({ view: view.publicId });
      }}
      onDelete={async (publicId) => {
        await deleteView.mutateAsync({ publicId });
        if (activeViewId === publicId) {
          void setParams({ view: null });
        }
      }}
      onSelectAll={() => {
        const next = allSignalsParamValues();
        void setParams({
          disposition: next.disposition,
          kind: next.kind,
          people: next.people,
          priority: next.priority,
          view: null,
        });
      }}
      onSelectView={(publicId) => {
        const view = views.find((candidate) => candidate.publicId === publicId);
        if (!view) {
          return;
        }
        const next = viewConfigToParamValues(view.config);
        void setParams({
          disposition: next.disposition,
          kind: next.kind,
          people: next.people,
          priority: next.priority,
          view: publicId,
        });
      }}
      views={views}
    />
  );
}
```

- [ ] **Step 4: Delete** `signal-create-view-dialog.tsx` (no other importers — verified).
- [ ] **Step 5: Run, expect pass.** Then run the full signals glob: `pnpm --filter @lightfast/app test signals-view-switcher`.
- [ ] **Step 6: Commit** — `refactor(signals): use shared ViewSwitcher`.

---

## Task 6: Rewire `PeopleViewSwitcher` + rewrite test + delete old dialog

**Files:**
- Modify (replace): `people/_components/people-view-switcher.tsx`
- Modify (replace): `people/_components/people-view-switcher.test.tsx`
- Delete: `people/_components/people-create-view-dialog.tsx`

- [ ] **Step 1: Rewrite the test** (mirror of Task 5; 3 params):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "../../_components/views/view-switcher";
import type { PeopleViewRow } from "./people-views-model";

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

let viewsData: PeopleViewRow[] = [];
const createAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("./use-people-views-query", () => ({
  useCreatePeopleView: () => ({ mutateAsync: createAsync }),
  useDeletePeopleView: () => ({ mutateAsync: deleteAsync }),
  usePeopleViewsQuery: () => ({ data: viewsData }),
}));

let switcherProps: ViewSwitcherProps;
vi.mock("../../_components/views/view-switcher", () => ({
  ViewSwitcher: (props: ViewSwitcherProps) => {
    switcherProps = props;
    return (
      <div>
        <button onClick={props.onSelectAll} type="button">all</button>
        <button onClick={() => props.onSelectView("peoview_1")} type="button">select</button>
        <button onClick={() => void props.onCreate("My view")} type="button">create</button>
        <button onClick={() => void props.onDelete("peoview_1")} type="button">delete</button>
      </div>
    );
  },
}));

const { PeopleViewSwitcher } = await import("./people-view-switcher");

function makeView(overrides: Partial<PeopleViewRow> = {}): PeopleViewRow {
  return {
    clerkOrgId: "org_test",
    config: { filters: { providers: ["x"], types: ["handle"] } },
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    name: "X handles",
    publicId: "peoview_1",
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  } as PeopleViewRow;
}

beforeEach(() => {
  paramsState = { provider: "", type: "", view: null };
  viewsData = [];
  createAsync.mockReset().mockResolvedValue({ publicId: "peoview_new" });
  deleteAsync.mockReset().mockResolvedValue(undefined);
  setParamsMock.mockReset();
});

describe("PeopleViewSwitcher", () => {
  it("passes people identity to the shared switcher", () => {
    render(<PeopleViewSwitcher />);
    expect(switcherProps.allLabel).toBe("All people");
  });

  it("stamps a view's filters and ?view atomically on select", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "x", type: "handle", view: "peoview_1" })
    );
  });

  it("clears filters and ?view on All", () => {
    paramsState.view = "peoview_1";
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "", type: "", view: null })
    );
  });

  it("creates a view then selects it", async () => {
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() =>
      expect(createAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "My view" }))
    );
    await waitFor(() => expect(setParamsMock).toHaveBeenCalledWith({ view: "peoview_new" }));
  });

  it("deletes the active view and clears ?view", async () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith({ publicId: "peoview_1" }));
    await waitFor(() => expect(setParamsMock).toHaveBeenCalledWith({ view: null }));
  });
});
```

- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Replace `people-view-switcher.tsx`** with the thin wrapper:

```tsx
"use client";

import { Users } from "lucide-react";
import { useQueryStates } from "nuqs";
import { ViewSwitcher } from "../../_components/views/view-switcher";
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
  selectionToConfig,
  viewConfigToParamValues,
} from "./people-views-model";
import {
  useCreatePeopleView,
  useDeletePeopleView,
  usePeopleViewsQuery,
} from "./use-people-views-query";

/**
 * People views bar — wires the shared <ViewSwitcher> to the people URL params
 * (3 params, written atomically via nuqs) and the people views tRPC router.
 */
export function PeopleViewSwitcher() {
  const [params, setParams] = useQueryStates({
    provider: personProviderParser,
    type: personTypeParser,
    view: peopleSavedViewParser,
  });

  const viewsQuery = usePeopleViewsQuery();
  const createView = useCreatePeopleView();
  const deleteView = useDeletePeopleView();
  const views = viewsQuery.data ?? [];
  const activeViewId = params.view;

  const currentConfig = selectionToConfig({
    providers: parsePersonProviders(params.provider),
    types: parsePersonTypes(params.type),
  });

  return (
    <ViewSwitcher
      activeViewId={activeViewId}
      allLabel={ALL_PEOPLE_VIEW_NAME}
      icon={Users}
      onCreate={async (name) => {
        const view = await createView.mutateAsync({ config: currentConfig, name });
        void setParams({ view: view.publicId });
      }}
      onDelete={async (publicId) => {
        await deleteView.mutateAsync({ publicId });
        if (activeViewId === publicId) {
          void setParams({ view: null });
        }
      }}
      onSelectAll={() => {
        const next = allPeopleParamValues();
        void setParams({ provider: next.provider, type: next.type, view: null });
      }}
      onSelectView={(publicId) => {
        const view = views.find((candidate) => candidate.publicId === publicId);
        if (!view) {
          return;
        }
        const next = viewConfigToParamValues(view.config);
        void setParams({ provider: next.provider, type: next.type, view: publicId });
      }}
      views={views}
    />
  );
}
```

- [ ] **Step 4: Delete** `people-create-view-dialog.tsx`.
- [ ] **Step 5: Run, expect pass.** Then `pnpm --filter @lightfast/app test people-view-switcher`.
- [ ] **Step 6: Commit** — `refactor(people): use shared ViewSwitcher`.

---

## Task 7: Filter toolbar wraps downward (no horizontal-scroll clipping)

**Files:**
- Modify: `signals/_components/signals-toolbar.tsx:100,103`
- Modify: `people/_components/people-toolbar.tsx:71,74`

CSS-only. In each toolbar:
1. Outer container: `items-center` → `items-start` (so the right-hand action/search pins to the top as chips reflow beneath).
2. Inner filter region: `flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto` → `flex min-w-0 flex-1 flex-wrap items-center gap-1.5` (drop `overflow-x-auto`, add `flex-wrap`).

- [ ] **Step 1 (signals):** Edit `signals-toolbar.tsx`:
  - Line ~100: `"flex shrink-0 flex-wrap items-center gap-1.5 border-border/70 border-t px-3 py-3"` → replace `items-center` with `items-start`.
  - Line ~103: `"flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"` → `"flex min-w-0 flex-1 flex-wrap items-center gap-1.5"`.
- [ ] **Step 2 (people):** Edit `people-toolbar.tsx`:
  - Line ~71: same `items-center` → `items-start`.
  - Line ~74: same filter-region swap.
- [ ] **Step 3: Verify no test regressions** — `pnpm --filter @lightfast/app test toolbar` (no toolbar tests exist; this just confirms nothing else asserts those class strings). Then full app suite in Task 8.
- [ ] **Step 4: Commit** — `fix(signals,people): wrap filter toolbar instead of clipping`.

---

## Task 8: Full verification

- [ ] **Step 1: Typecheck** — `pnpm --filter @lightfast/app typecheck` (or `cd apps/app && pnpm with-env next typegen` first if tRPC types stale). Expected: clean.
- [ ] **Step 2: Full app test suite** — `pnpm --filter @lightfast/app test`. Expected: all pass (new view-library specs + rewritten switcher specs).
- [ ] **Step 3: Biome on changed files** — `git diff --name-only -z <base>..HEAD | xargs -0 npx ultracite@latest check` (only changed files; the repo has pre-existing unrelated findings). Expected: clean for changed files.
- [ ] **Step 4: Live check (manual)** — `pnpm dev`; on `/[slug]/signals` and `/[slug]/people`:
  - Create ≥4 views → `All` + 3 pills + `+N`; open `+N`, select an overflowed view → it promotes to a pill.
  - `+` → action-style create dialog; save → new pill + `?view` set.
  - Pill ✕ → action-style delete confirm; confirm → pill removed (and `?view` cleared if it was active).
  - Apply many filters → chips wrap to multiple rows; toolbar grows downward; right-side action/search stays pinned top-right.
  - Soft-navigate signals → people → automations → root: the switcher in the topbar swaps/clears correctly (no leak — `@actions` slot behavior unchanged).

---

## Self-Review

- **Spec coverage:** shared library (Tasks 1–4) ✓; delete dialog (Task 3) ✓; action-dialog upgrade for create (Task 2) ✓; `+N` overflow (Tasks 1,4) ✓; filter wrap (Task 7) ✓; both entities rewired (Tasks 5,6) ✓.
- **Type consistency:** `ViewSwitcherItem`/`ViewSwitcherProps` defined in Task 1/4 and consumed verbatim in Tasks 5,6 tests; `mutateAsync` return shape (`{ publicId }`) matches `createSignalView`/`createPeopleView` (`Promise<SignalView | PeopleView>`); param objects match each model's `*ParamValues` shape.
- **Placeholders:** none — all code is complete.
- **Risk:** Radix `DropdownMenu` overflow open is not unit-tested (mocked to `null`); covered by Task 8 live check + the pure `partitionViews` tests. Overflow rows are select-only by design (promote-active makes pill-delete sufficient).
