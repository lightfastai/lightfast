# Linear-Style Dialogs + ⌘K Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the signal create dialog into a reusable Linear-style floating dialog and add an org-wide ⌘K command palette (with a global `C` shortcut to create a signal).

**Architecture:** A single client provider (`WorkspaceCommandMenu`) is mounted once in the workspace layout. It owns the ⌘K palette and a now-global signal create dialog, plus the global keyboard layer (⌘K, C). The dialog's chrome is extracted into an app-local presentational `CreateDialogShell` (the "standard dialog look"). A small `useActiveOrg()` hook feeds the dialog's breadcrumb. The create dialog invalidates the signals list by **partial key** so it works from any page.

**Tech Stack:** Next.js (App Router, RSC), React, TypeScript, `@trpc/tanstack-react-query`, TanStack Query, cmdk (`@repo/ui/components/ui/command`), Radix dialog/switch/avatar, Vitest + Testing Library, Biome (`pnpm check`).

**Spec:** `docs/superpowers/specs/2026-05-30-dialogs-command-palette-design.md`

---

## File Structure

**Create:**
- `apps/app/src/hooks/use-active-org.ts` — resolve current org `{ id, name, initials, slug }` from the cached org-list query + path slug.
- `apps/app/src/components/create-dialog-shell.tsx` — reusable floating-dialog chrome (breadcrumb header + body slot + footer toolbar).
- `apps/app/src/components/command-palette.tsx` — ⌘K palette (Create + Go-to groups).
- `apps/app/src/components/workspace-command-menu.tsx` — provider: owns palette + global create dialog + global keys; exposes `useWorkspaceCommands()`.
- `apps/app/src/__tests__/hooks/use-active-org.test.tsx`
- `apps/app/src/__tests__/components/create-dialog-shell.test.tsx`
- `apps/app/src/__tests__/components/command-palette.test.tsx`
- `apps/app/src/__tests__/components/workspace-command-menu.test.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx`

**Modify:**
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx` — rewrite to consume the shell; new props `{ open, onOpenChange }`; ⌘↵ submit; Create more; partial invalidation.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/layout.tsx` — wrap with `WorkspaceCommandMenu`.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx` — drop local dialog state/mount; route Add/empty actions through `useWorkspaceCommands()`.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx` — remove migrated dialog tests; add provider mock + Add-button-routes-to-context test.

**Conventions to follow:**
- Run all commands from `apps/app`. Test a single file: `pnpm test <path-relative-to-apps/app>` (script is `vitest run`). Lint/format: `pnpm check`. Types: `pnpm typecheck`.
- Tests heavily mock UI primitives and `~/trpc/react` / `@tanstack/react-query` / `next/navigation` (see the existing `signals-client.test.tsx` for the canonical pattern).
- Object/prop keys are alphabetized in this codebase; mirror that to satisfy Biome.

---

## Task 1: `useActiveOrg()` hook

**Files:**
- Create: `apps/app/src/hooks/use-active-org.ts`
- Test: `apps/app/src/__tests__/hooks/use-active-org.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/hooks/use-active-org.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/lightfast/signals";
const useQueryMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
  }),
}));

const { useActiveOrg } = await import("~/hooks/use-active-org");

const orgs = [
  { id: "org_1", initials: "L", name: "Lightfast", slug: "lightfast" },
  { id: "org_2", initials: "AC", name: "Acme", slug: "acme" },
];

describe("useActiveOrg", () => {
  beforeEach(() => {
    pathname = "/lightfast/signals";
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({ data: orgs });
  });

  it("resolves the org that matches the first path segment", () => {
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toEqual({
      id: "org_1",
      initials: "L",
      name: "Lightfast",
      slug: "lightfast",
    });
  });

  it("returns null on reserved routes", () => {
    pathname = "/account/settings";
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toBeNull();
  });

  it("returns null while the org list is still loading", () => {
    useQueryMock.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test src/__tests__/hooks/use-active-org.test.tsx`
Expected: FAIL — cannot resolve `~/hooks/use-active-org`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/src/hooks/use-active-org.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTRPC } from "~/trpc/react";

const RESERVED_FIRST_SEGMENTS = new Set([
  "account",
  "api",
  "new",
  "sign-in",
  "sign-up",
]);

export interface ActiveOrg {
  id: string;
  initials: string;
  name: string;
  slug: string;
}

export function useActiveOrg(): ActiveOrg | null {
  const trpc = useTRPC();
  const pathname = usePathname();
  const { data: organizations } = useQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment || RESERVED_FIRST_SEGMENTS.has(firstSegment)) {
    return null;
  }

  const org = organizations?.find(
    (candidate) => candidate.slug === firstSegment
  );
  if (!org) {
    return null;
  }

  return {
    id: org.id,
    initials: org.initials,
    name: org.name,
    slug: org.slug ?? firstSegment,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test src/__tests__/hooks/use-active-org.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/hooks/use-active-org.ts "apps/app/src/__tests__/hooks/use-active-org.test.tsx"
git commit -m "feat(app): add useActiveOrg hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `CreateDialogShell` (reusable dialog chrome)

**Files:**
- Create: `apps/app/src/components/create-dialog-shell.tsx`
- Test: `apps/app/src/__tests__/components/create-dialog-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/components/create-dialog-shell.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogClose: ({ children }: { children?: ReactNode }) => children,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

const { CreateDialogShell } = await import("~/components/create-dialog-shell");

function renderShell(overrides: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  render(
    <CreateDialogShell
      description="desc"
      footerLeft={<span>left-slot</span>}
      footerRight={<span>right-slot</span>}
      onOpenChange={onOpenChange}
      open
      org={{ initials: "L", name: "Lightfast" }}
      title="New signal"
      {...overrides}
    >
      <div>body-slot</div>
    </CreateDialogShell>
  );
  return { onOpenChange };
}

describe("CreateDialogShell", () => {
  it("renders the breadcrumb, body, and footer slots", () => {
    renderShell();
    expect(screen.getByText("Lightfast")).toBeInTheDocument();
    expect(screen.getByText("New signal")).toBeInTheDocument();
    expect(screen.getByText("body-slot")).toBeInTheDocument();
    expect(screen.getByText("left-slot")).toBeInTheDocument();
    expect(screen.getByText("right-slot")).toBeInTheDocument();
  });

  it("falls back to a neutral label when org is null", () => {
    renderShell({ org: null });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("closes via the close button and disables it while busy", () => {
    const { onOpenChange } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the close button when busy", () => {
    renderShell({ busy: true });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test src/__tests__/components/create-dialog-shell.test.tsx`
Expected: FAIL — cannot resolve `~/components/create-dialog-shell`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/src/components/create-dialog-shell.tsx`:

```tsx
"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface CreateDialogShellProps {
  busy?: boolean;
  children: ReactNode;
  description: string;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  org: { initials: string; name: string } | null;
  title: string;
}

export function CreateDialogShell({
  busy = false,
  children,
  description,
  footerLeft,
  footerRight,
  onOpenChange,
  open,
  org,
  title,
}: CreateDialogShellProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-[12px] border-border bg-card p-0 shadow-2xl sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Avatar className="size-5">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {org?.initials ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium">{org?.name ?? "Workspace"}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            <span className="truncate font-medium">{title}</span>
          </div>

          <DialogClose asChild>
            <Button
              aria-label="Close"
              className="size-7 rounded-md text-muted-foreground hover:text-foreground"
              disabled={busy}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {children}

        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-4">
          <div className="min-w-0">{footerLeft}</div>
          <div className="flex items-center gap-3">{footerRight}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test src/__tests__/components/create-dialog-shell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/create-dialog-shell.tsx "apps/app/src/__tests__/components/create-dialog-shell.test.tsx"
git commit -m "feat(app): add reusable CreateDialogShell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Rewrite `SignalCreateDialog`

Rewrites the dialog to consume `CreateDialogShell`, change props to `{ open, onOpenChange }`, switch to ⌘↵ submit (Enter = newline), add a persisted **Create more** toggle, and invalidate the signals list by partial key.

**Files:**
- Modify: `apps/app/.../signals/_components/signal-create-dialog.tsx` (full rewrite)
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx`:

```tsx
import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutationOptionsMock = vi.fn((options: unknown) => options);
const invalidateQueriesMock = vi.fn();
const mutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
    org: {
      workspace: {
        signals: {
          create: { mutationOptions: createMutationOptionsMock },
          list: {
            queryFilter: () => ({
              queryKey: ["org", "workspace", "signals", "list"],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => useMutationMock(options),
  useQuery: () => ({
    data: [{ id: "org_1", initials: "L", name: "Lightfast", slug: "lightfast" }],
  }),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/signals",
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogClose: ({ children }: { children?: ReactNode }) => children,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: toastSuccessMock },
}));

const { SignalCreateDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog"
);

function renderDialog() {
  const onOpenChange = vi.fn();
  render(<SignalCreateDialog onOpenChange={onOpenChange} open />);
  return { onOpenChange };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  createMutationOptionsMock.mockClear();
  invalidateQueriesMock.mockReset();
  mutateMock.mockReset();
  toastSuccessMock.mockReset();
  useMutationMock.mockReset();
  useMutationMock.mockImplementation(
    (options: { onSuccess?: () => void }) => ({
      isPending: false,
      mutate: (variables: { input: string }) => {
        mutateMock(variables);
        options.onSuccess?.();
      },
    })
  );
});

describe("SignalCreateDialog", () => {
  it("renders the org breadcrumb header", () => {
    renderDialog();
    expect(screen.getByText("Lightfast")).toBeInTheDocument();
    expect(screen.getByText("New signal")).toBeInTheDocument();
  });

  it("submits with Cmd+Enter and keeps plain Enter as a newline", () => {
    renderDialog();
    const input = screen.getByLabelText("Signal input");
    fireEvent.change(input, { target: { value: "Customer needs a response" } });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer needs a response",
    });
  });

  it("trims input and invalidates the signals list on success", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "  Customer asked for rollout timing  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer asked for rollout timing",
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "signals", "list"],
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Signal queued", {
      description: "Classification will start shortly.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and clears input when Create more is on", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("switch", { name: "Create more" }));
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "First signal" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({ input: "First signal" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Signal input")).toHaveValue("");
  });

  it("blocks blank submission", () => {
    renderDialog();
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("caps pasted input at the contract limit", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "a".repeat(SIGNAL_INPUT_MAX_LENGTH + 250) },
    });
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "a".repeat(SIGNAL_INPUT_MAX_LENGTH)
    );
    expect(screen.getByText("Limit reached")).toBeInTheDocument();
  });

  it("normalizes pasted line endings without collapsing multiline input", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "First line\r\n\r\nSecond line\rThird line" },
    });
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "First line\n\nSecond line\nThird line"
    );
  });

  it("restores a session draft on open", () => {
    sessionStorage.setItem(
      "lightfast:create-signal-draft:/lightfast/signals",
      "Recovered customer note"
    );
    renderDialog();
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "Recovered customer note"
    );
  });

  it("locks controls while creating", () => {
    useMutationMock.mockImplementation(() => ({
      isPending: true,
      mutate: mutateMock,
    }));
    renderDialog();
    expect(screen.getByLabelText("Signal input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creating" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx"`
Expected: FAIL — the current dialog still expects `listQueryKeys`, has no breadcrumb/switch, and submits on plain Enter.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx` with:

```tsx
"use client";

import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { CreateDialogShell } from "~/components/create-dialog-shell";
import { useActiveOrg } from "~/hooks/use-active-org";
import { useTRPC } from "~/trpc/react";

interface SignalCreateDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const SIGNAL_CREATE_DRAFT_PREFIX = "lightfast:create-signal-draft:";
const SIGNAL_CREATE_FORM_ID = "signal-create-form";
const CREATE_MORE_STORAGE_KEY = "lightfast:create-signal-more";

function normalizeSignalInput(value: string) {
  return value.replace(/\r\n?/g, "\n").slice(0, SIGNAL_INPUT_MAX_LENGTH);
}

function readSignalDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeSignalDraft(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    window.sessionStorage.setItem(storageKey, value);
  } catch {
    // Draft persistence is best-effort and should never block signal creation.
  }
}

function removeSignalDraft(storageKey: string) {
  writeSignalDraft(storageKey, "");
}

function readCreateMore() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(CREATE_MORE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCreateMore(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CREATE_MORE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Preference persistence is best-effort.
  }
}

export function SignalCreateDialog({
  onOpenChange,
  open,
}: SignalCreateDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const org = useActiveOrg();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [createMore, setCreateMore] = useState(false);
  const draftStorageKey = `${SIGNAL_CREATE_DRAFT_PREFIX}${pathname}`;

  const trimmedInput = input.trim();
  const inputLength = input.length;
  const isAtLimit = inputLength === SIGNAL_INPUT_MAX_LENGTH;
  const isOverLimit = inputLength > SIGNAL_INPUT_MAX_LENGTH;
  const formattedInputLength = inputLength.toLocaleString();
  const formattedInputLimit = SIGNAL_INPUT_MAX_LENGTH.toLocaleString();

  const createMutation = useMutation(
    trpc.org.workspace.signals.create.mutationOptions({
      meta: { errorTitle: "Failed to create signal" },
      onSuccess: () => {
        removeSignalDraft(draftStorageKey);
        void queryClient.invalidateQueries(
          trpc.org.workspace.signals.list.queryFilter()
        );
        toast.success("Signal queued", {
          description: "Classification will start shortly.",
        });
        setInput("");
        if (createMore) {
          requestAnimationFrame(() => textareaRef.current?.focus());
          return;
        }
        onOpenChange(false);
      },
    })
  );

  useEffect(() => {
    setCreateMore(readCreateMore());
  }, []);

  useEffect(() => {
    if (!open || input.length > 0) {
      return;
    }
    const draft = readSignalDraft(draftStorageKey);
    if (draft.length > 0) {
      setInput(normalizeSignalInput(draft));
    }
  }, [draftStorageKey, input.length, open]);

  const isSubmitDisabled =
    createMutation.isPending || trimmedInput.length === 0 || isOverLimit;

  function handleOpenChange(nextOpen: boolean) {
    if (createMutation.isPending) {
      return;
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }
    createMutation.mutate({ input: trimmedInput });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextInput = normalizeSignalInput(event.currentTarget.value);
    setInput(nextInput);
    writeSignalDraft(draftStorageKey, nextInput);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleCreateMoreChange(next: boolean) {
    setCreateMore(next);
    writeCreateMore(next);
  }

  return (
    <CreateDialogShell
      busy={createMutation.isPending}
      description="Paste one raw signal to queue it for classification."
      footerLeft={
        <div
          aria-live="polite"
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs"
        >
          <span className="shrink-0">
            {formattedInputLength} / {formattedInputLimit} characters
          </span>
          {(isAtLimit || isOverLimit) && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isOverLimit
                    ? "shrink-0 text-destructive"
                    : "shrink-0 text-muted-foreground"
                }
              >
                {isOverLimit ? "Too long" : "Limit reached"}
              </span>
            </>
          )}
          {trimmedInput.length === 0 && inputLength > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 text-muted-foreground">
                Add signal text
              </span>
            </>
          )}
        </div>
      }
      footerRight={
        <>
          <label className="flex items-center gap-2 text-muted-foreground text-sm">
            <Switch
              aria-label="Create more"
              checked={createMore}
              disabled={createMutation.isPending}
              onCheckedChange={handleCreateMoreChange}
            />
            Create more
          </label>
          <Button
            disabled={isSubmitDisabled}
            form={SIGNAL_CREATE_FORM_ID}
            size="sm"
            type="submit"
          >
            {createMutation.isPending && (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            )}
            {createMutation.isPending ? "Creating" : "Create signal"}
            {!createMutation.isPending && (
              <kbd className="ml-1 rounded bg-foreground/10 px-1 text-[10px] text-primary-foreground/80">
                ⌘↵
              </kbd>
            )}
          </Button>
        </>
      }
      onOpenChange={handleOpenChange}
      open={open}
      org={org}
      title="New signal"
    >
      <form
        aria-label="Create signal"
        className="flex min-h-[14rem] px-4 pb-2"
        id={SIGNAL_CREATE_FORM_ID}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <Textarea
          aria-label="Signal input"
          autoFocus
          className="field-sizing-fixed h-full max-h-[40vh] min-h-[14rem] flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
          disabled={createMutation.isPending}
          maxLength={SIGNAL_INPUT_MAX_LENGTH}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste a customer request, support note, product signal, or internal observation..."
          ref={textareaRef}
          value={input}
          wrap="soft"
        />
      </form>
    </CreateDialogShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx"`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signal-create-dialog.test.tsx"
git commit -m "feat(signals): rework create dialog into Linear-style shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `CommandPalette`

**Files:**
- Create: `apps/app/src/components/command-palette.tsx`
- Test: `apps/app/src/__tests__/components/command-palette.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/components/command-palette.test.tsx`. The command primitives are mocked to lightweight components so `onSelect` fires reliably on click:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("~/hooks/use-active-org", () => ({
  useActiveOrg: () => ({
    id: "org_1",
    initials: "L",
    name: "Lightfast",
    slug: "lightfast",
  }),
}));

vi.mock("@repo/ui/components/ui/command", () => ({
  CommandDialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  CommandInput: (props: Record<string, unknown>) => <input {...props} />,
  CommandList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({
    children,
    heading,
  }: {
    children?: ReactNode;
    heading?: string;
  }) => (
    <div>
      <div>{heading}</div>
      {children}
    </div>
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children?: ReactNode;
    onSelect?: () => void;
  }) => (
    <button onClick={() => onSelect?.()} type="button">
      {children}
    </button>
  ),
  CommandShortcut: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

const { CommandPalette } = await import("~/components/command-palette");

function renderPalette() {
  const onCreateSignal = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CommandPalette
      onCreateSignal={onCreateSignal}
      onOpenChange={onOpenChange}
      open
    />
  );
  return { onCreateSignal, onOpenChange };
}

beforeEach(() => {
  pushMock.mockReset();
});

describe("CommandPalette", () => {
  it("invokes create signal and closes", () => {
    const { onCreateSignal, onOpenChange } = renderPalette();
    fireEvent.click(screen.getByRole("button", { name: /Create signal/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreateSignal).toHaveBeenCalled();
  });

  it("routes to a section and closes", () => {
    const { onOpenChange } = renderPalette();
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pushMock).toHaveBeenCalledWith("/lightfast/people");
  });

  it("renders all go-to destinations", () => {
    renderPalette();
    for (const label of ["Signals", "People", "Automations", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test src/__tests__/components/command-palette.test.tsx`
Expected: FAIL — cannot resolve `~/components/command-palette`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/src/components/command-palette.tsx`:

```tsx
"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@repo/ui/components/ui/command";
import { CalendarClock, Plus, Settings, Signal, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveOrg } from "~/hooks/use-active-org";

interface CommandPaletteProps {
  onCreateSignal: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const GO_TO = [
  { icon: Signal, label: "Signals", section: "signals" },
  { icon: UsersRound, label: "People", section: "people" },
  { icon: CalendarClock, label: "Automations", section: "automations" },
  { icon: Settings, label: "Settings", section: "settings" },
] as const;

export function CommandPalette({
  onCreateSignal,
  onOpenChange,
  open,
}: CommandPaletteProps) {
  const router = useRouter();
  const org = useActiveOrg();
  const slug = org?.slug;

  function goTo(section: string) {
    if (!slug) {
      return;
    }
    onOpenChange(false);
    router.push(`/${slug}/${section}`);
  }

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onCreateSignal();
            }}
          >
            <Plus />
            Create signal
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {GO_TO.map(({ icon: Icon, label, section }) => (
            <CommandItem key={section} onSelect={() => goTo(section)}>
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-4 border-border/50 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span className="ml-auto">esc close</span>
      </div>
    </CommandDialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test src/__tests__/components/command-palette.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/command-palette.tsx "apps/app/src/__tests__/components/command-palette.test.tsx"
git commit -m "feat(app): add CommandPalette (create + go-to)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `WorkspaceCommandMenu` provider + global keys

**Files:**
- Create: `apps/app/src/components/workspace-command-menu.tsx`
- Test: `apps/app/src/__tests__/components/workspace-command-menu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/components/workspace-command-menu.test.tsx`. The palette and dialog are mocked to open-state probes so we test only the provider's wiring:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/command-palette", () => ({
  CommandPalette: ({ open }: { open: boolean }) =>
    open ? <div>palette-open</div> : null,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog",
  () => ({
    SignalCreateDialog: ({ open }: { open: boolean }) =>
      open ? <div>create-open</div> : null,
  })
);

const { WorkspaceCommandMenu, useWorkspaceCommands } = await import(
  "~/components/workspace-command-menu"
);

function Probe() {
  const { openCreateSignal } = useWorkspaceCommands();
  return (
    <button onClick={openCreateSignal} type="button">
      probe-create
    </button>
  );
}

describe("WorkspaceCommandMenu", () => {
  it("opens the palette on Cmd+K", () => {
    render(
      <WorkspaceCommandMenu>
        <div>child</div>
      </WorkspaceCommandMenu>
    );
    expect(screen.queryByText("palette-open")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByText("palette-open")).toBeInTheDocument();
  });

  it("opens the create dialog on C", () => {
    render(
      <WorkspaceCommandMenu>
        <div>child</div>
      </WorkspaceCommandMenu>
    );
    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByText("create-open")).toBeInTheDocument();
  });

  it("ignores C while typing in an input", () => {
    render(
      <WorkspaceCommandMenu>
        <input aria-label="field" />
      </WorkspaceCommandMenu>
    );
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "c" });
    expect(screen.queryByText("create-open")).not.toBeInTheDocument();
  });

  it("exposes openCreateSignal through context", () => {
    render(
      <WorkspaceCommandMenu>
        <Probe />
      </WorkspaceCommandMenu>
    );
    fireEvent.click(screen.getByRole("button", { name: "probe-create" }));
    expect(screen.getByText("create-open")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test src/__tests__/components/workspace-command-menu.test.tsx`
Expected: FAIL — cannot resolve `~/components/workspace-command-menu`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/src/components/workspace-command-menu.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { SignalCreateDialog } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog";
import { CommandPalette } from "~/components/command-palette";

interface WorkspaceCommandsContextValue {
  openCreateSignal: () => void;
  openPalette: () => void;
}

const WorkspaceCommandsContext =
  createContext<WorkspaceCommandsContextValue | null>(null);

export function useWorkspaceCommands() {
  const context = useContext(WorkspaceCommandsContext);
  if (!context) {
    throw new Error(
      "useWorkspaceCommands must be used within WorkspaceCommandMenu"
    );
  }
  return context;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function WorkspaceCommandMenu({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createSignalOpen, setCreateSignalOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableTarget(event.target) &&
        !paletteOpen &&
        !createSignalOpen
      ) {
        event.preventDefault();
        setCreateSignalOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createSignalOpen, paletteOpen]);

  const value = useMemo<WorkspaceCommandsContextValue>(
    () => ({
      openCreateSignal: () => setCreateSignalOpen(true),
      openPalette: () => setPaletteOpen(true),
    }),
    []
  );

  return (
    <WorkspaceCommandsContext.Provider value={value}>
      {children}
      <CommandPalette
        onCreateSignal={() => setCreateSignalOpen(true)}
        onOpenChange={setPaletteOpen}
        open={paletteOpen}
      />
      <SignalCreateDialog
        onOpenChange={setCreateSignalOpen}
        open={createSignalOpen}
      />
    </WorkspaceCommandsContext.Provider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test src/__tests__/components/workspace-command-menu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/workspace-command-menu.tsx "apps/app/src/__tests__/components/workspace-command-menu.test.tsx"
git commit -m "feat(app): add WorkspaceCommandMenu provider + global keys

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Mount provider + refactor `SignalsClient` + update its tests

**Files:**
- Modify: `apps/app/.../(workspace)/layout.tsx`
- Modify: `apps/app/.../signals/_components/signals-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`

- [ ] **Step 1: Update the failing signals-client test first**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`:

(a) Add the provider mock near the other `vi.mock` calls (e.g. after the `next/navigation` mock), and two spies near the top-level mock declarations:

```tsx
const openCreateSignalMock = vi.fn();
const openPaletteMock = vi.fn();

vi.mock("~/components/workspace-command-menu", () => ({
  useWorkspaceCommands: () => ({
    openCreateSignal: openCreateSignalMock,
    openPalette: openPaletteMock,
  }),
}));
```

(b) In `beforeEach`, add: `openCreateSignalMock.mockClear();`

(c) **Delete** these now-migrated `it(...)` blocks (they live in `signal-create-dialog.test.tsx` now): `"opens and closes the create signal dialog"`, `"blocks blank signal submission"`, `"caps pasted signal input at the contract limit"`, `"keeps the multiline composer constrained inside the dialog"`, `"restores a session draft when the dialog opens"`, `"normalizes pasted line endings without collapsing multiline input"`, `"explains whitespace-only input without submitting"`, `"submits with Enter and keeps Shift+Enter as a newline gesture"`, `"locks composer controls while a signal is being created"`, `"submits a valid signal and refreshes processing and classified lists"`, `"preserves input when the create mutation does not succeed"`.

(d) **Replace** the `"renders the create control as a top-bar Add Signal button"` test with two tests:

```tsx
  it("renders the create control as a top-bar Add Signal button", () => {
    render(<SignalsClient />);

    expect(screen.queryByLabelText("Search signals")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Signal" })
    ).toBeInTheDocument();
  });

  it("routes the Add Signal button through the command menu", () => {
    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "Add Signal" }));

    expect(openCreateSignalMock).toHaveBeenCalledTimes(1);
  });
```

(Leave the existing `@repo/ui/components/ui/dialog`, `@repo/ui/components/ui/sonner`, and `@tanstack/react-query` mocks in place — they remain referenced by `beforeEach` and stay valid even though `SignalsClient` no longer renders the dialog.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"`
Expected: FAIL — `openCreateSignalMock` is not called because `SignalsClient` still uses local dialog state, and `~/components/workspace-command-menu` mock is unused by the component.

- [ ] **Step 3: Refactor `SignalsClient`**

In `apps/app/.../signals/_components/signals-client.tsx`:

Remove the `useState` import usage for dialog state and the `SignalCreateDialog` import; add the command hook import:

```tsx
// remove:  import { SignalCreateDialog } from "./signal-create-dialog";
// add:
import { useWorkspaceCommands } from "~/components/workspace-command-menu";
```

Replace the dialog open-state + `openCreateDialog` with the context, and delete the `refreshListQueryKeys` memo and the `<SignalCreateDialog>` JSX:

```tsx
// remove:  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
// add (top of component body):
  const { openCreateSignal } = useWorkspaceCommands();
```

```tsx
// remove the openCreateDialog function and refreshListQueryKeys memo entirely.
// update the destructure from useSignalsWorkspaceData to drop the now-unused
// classifiedListQueryKey / processingListQueryKey bindings.
```

Point the Add/empty actions at `openCreateSignal`:

```tsx
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
```

```tsx
      <SignalsToolbar
        // ...
        onAddSignal={openCreateSignal}
        // ...
      />
```

Delete the `<SignalCreateDialog ... />` element from the JSX (the `<SignalDetailSheet>` stays).

If `useState` is no longer used anywhere in the file, remove it from the `react` import. If `useMemo` is still used by `filters`, keep it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm test "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"`
Expected: PASS (all remaining tests).

- [ ] **Step 5: Mount the provider in the workspace layout**

In `apps/app/.../(workspace)/layout.tsx`, import and wrap. The provider must sit **outside** the `Suspense` boundary so palette/dialog state survives page-level suspense:

```tsx
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { WorkspaceCommandMenu } from "~/components/workspace-command-menu";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-background">
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AuthenticatedTopbar left={<SidebarTrigger className="lg:hidden" />} />
        <WorkspaceCommandMenu>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
          </div>
        </WorkspaceCommandMenu>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PageLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/layout.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx"
git commit -m "feat(signals): mount command menu org-wide; route create through it

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full verification

**Files:** none (validation only).

- [ ] **Step 1: Run the full app test suite**

Run: `cd apps/app && pnpm test`
Expected: PASS — all suites green (new: use-active-org, create-dialog-shell, signal-create-dialog, command-palette, workspace-command-menu; updated: signals-client).

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Lint/format**

Run: `cd apps/app && pnpm check`
Expected: no errors. If Biome flags a newly-unused binding in `signals-client.test.tsx` (e.g. a mock only referenced by deleted tests), remove that binding and its `beforeEach` reset line, then re-run.

- [ ] **Step 4: Manual smoke (optional but recommended)**

With `pnpm dev` running, on any org page:
- Press **⌘K** → palette opens; arrow/enter to "People" routes to `/<slug>/people`.
- Press **C** (not focused in a field) → create dialog opens with the org breadcrumb.
- Type a signal, press **⌘↵** → toast "Signal queued", dialog closes (or stays open with input cleared if **Create more** is on).
- Confirm the signals list refreshes after creating from a non-signals page, then navigating to Signals.

- [ ] **Step 5: Commit (only if Step 3 required cleanup edits)**

```bash
git add -A
git commit -m "chore(signals): tidy command-menu test bindings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** breadcrumb header (Task 2/3), single paste body (Task 3), Create more + ⌘↵ + counter (Task 3), partial-key invalidation (Task 3), palette Create + Go-to groups (Task 4), ⌘K/C global keys ignoring text fields (Task 5), org-wide mount + SignalsClient refactor (Task 6), tests for every unit (Tasks 1–6), verification (Task 7). All spec sections map to a task.
- **Out of scope** (search backend, quick-create, G-then-X chords, fullscreen, attachments) is intentionally absent.
- **Type consistency:** `useActiveOrg(): ActiveOrg | null` is consumed as `{ initials, name }` by the shell and `{ slug }` by the palette — both subsets of `ActiveOrg`. `useWorkspaceCommands()` returns `{ openCreateSignal, openPalette }`, used consistently in Task 6. The dialog prop contract is `{ open, onOpenChange }` everywhere it's rendered (Task 5 provider).
```
