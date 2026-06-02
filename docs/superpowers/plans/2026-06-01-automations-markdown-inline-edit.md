# Automations Markdown + Inline Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render automation instructions as markdown and convert the detail-page name + instructions editors from popover/Edit-button UI to inline click-to-edit controls that auto-save on blur / ⌘↵.

**Architecture:** Pure `apps/app` UI change — no DB/schema/tRPC/runtime change (`prompt` is already a plain string and the agent consumes it as raw text). A headless `useInlineEdit` hook owns the view↔edit state machine and commit/cancel keyboard+blur logic; a shared `automationUpdateMutationOptions` factory owns the optimistic-cache mutation wiring. The instructions view renders with the existing `Markdown` component.

**Tech Stack:** Next.js (App Router) client components, React 19, `@tanstack/react-query` (tRPC mutationOptions), `@vendor/clerk` `useAuth`, `@repo/ui` (`Markdown`, `Textarea`), Vitest + React Testing Library (happy-dom).

---

## Spec

Design doc: `docs/superpowers/specs/2026-06-01-automations-markdown-inline-edit-design.md`

## File Structure

- **Create** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit.ts` — headless hook: `{ editing, draft, begin, fieldProps }` + commit/cancel logic.
- **Modify** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache.ts` — add `applyAutomationPatch` (pure) + `automationUpdateMutationOptions` (factory).
- **Rewrite** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx` — inline single-line editor.
- **Rewrite** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx` — inline markdown editor.
- **Modify** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx` — add "Markdown supported" hint.
- **Create tests:**
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts`
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts`
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx`
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx`

## Conventions (read once)

- **Run a single test file** (from `apps/app`):
  ```bash
  cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "<relative path>"
  ```
  Paths contain `(` `)` `[` `]` — always quote them.
- Test imports of the component/hook under test use the `~` alias (mapped to `apps/app/src` in `apps/app/vitest.config.ts`). For components that need mocked modules, follow the existing repo pattern: declare `vi.mock(...)` then `await import("~/app/...")` inside the test body (see `signal-create-dialog.test.tsx`).
- Test environment is `happy-dom`; `globals: true` (so `describe/it/expect/vi` are global, but importing them explicitly is also fine and matches existing tests).

---

## Task 1: `useInlineEdit` headless hook

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useInlineEdit } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit";

function changeEvent(value: string) {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>;
}

function keyEvent(over: Partial<{
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}>) {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...over,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("useInlineEdit", () => {
  it("begins editing and seeds the draft from value", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    expect(result.current.editing).toBe(false);
    act(() => result.current.begin());
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe("Hello");
  });

  it("commits the trimmed draft on blur and exits editing", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("  World  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).toHaveBeenCalledWith("World");
    expect(result.current.editing).toBe(false);
  });

  it("does not commit when the trimmed draft is unchanged", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("  Hello  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when the draft is empty", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("   ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Enter when single-line", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Renamed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));

    expect(onCommit).toHaveBeenCalledWith("Renamed");
  });

  it("commits only on Cmd/Ctrl+Enter when multiline", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", multiline: true, onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("New body")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));
    expect(onCommit).not.toHaveBeenCalled();

    act(() =>
      result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter", metaKey: true }))
    );
    expect(onCommit).toHaveBeenCalledWith("New body");
  });

  it("cancels on Escape without committing and resets the draft", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Discard me")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBe("Hello");
  });

  it("suppresses the trailing blur after Escape (no double-handle)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ value: "Hello", onCommit })
    );

    act(() => result.current.begin());
    act(() => result.current.fieldProps.onChange(changeEvent("Changed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts"
```
Expected: FAIL — cannot resolve `use-inline-edit` (module does not exist yet).

- [ ] **Step 3: Write the hook**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit.ts`:

```ts
import type { ChangeEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

interface UseInlineEditOptions {
  /** Current persisted value — source of truth for revert and change detection. */
  value: string;
  /** When true, the commit chord is Cmd/Ctrl+Enter and plain Enter inserts a newline. */
  multiline?: boolean;
  /** Called with the trimmed draft when a real change is committed. */
  onCommit: (next: string) => void;
}

export interface InlineEditFieldProps {
  value: string;
  onChange: (event: ChangeEvent<EditableElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<EditableElement>) => void;
  autoFocus: boolean;
}

export interface UseInlineEditResult {
  editing: boolean;
  draft: string;
  begin: () => void;
  fieldProps: InlineEditFieldProps;
}

export function useInlineEdit({
  value,
  multiline = false,
  onCommit,
}: UseInlineEditOptions): UseInlineEditResult {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Set before any programmatic exit so the trailing blur (e.g. on unmount or
  // after Escape) does not commit a second time.
  const suppressBlur = useRef(false);

  function begin() {
    setDraft(value);
    suppressBlur.current = false;
    setEditing(true);
  }

  function commit() {
    suppressBlur.current = true;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  }

  function cancel() {
    suppressBlur.current = true;
    setDraft(value);
    setEditing(false);
  }

  function handleBlur() {
    if (suppressBlur.current) {
      suppressBlur.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<EditableElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    const isCommitChord = multiline
      ? event.key === "Enter" && (event.metaKey || event.ctrlKey)
      : event.key === "Enter" && !event.shiftKey;
    if (isCommitChord) {
      event.preventDefault();
      commit();
    }
  }

  return {
    editing,
    draft,
    begin,
    fieldProps: {
      value: draft,
      onChange: (event) => setDraft(event.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      autoFocus: true,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts"
```
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit.ts" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/use-inline-edit.test.ts"
git commit -m "feat(automations): add useInlineEdit hook for inline auto-save"
```

---

## Task 2: Shared optimistic update factory

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts`

- [ ] **Step 1: Write the failing test** (covers the only branching logic — the pure patch helper)

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts`:

```ts
import type { Automation } from "@db/app/schema";
import { describe, expect, it } from "vitest";
import { applyAutomationPatch } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache";

function make(over: Partial<Automation>): Automation {
  return { name: "Old name", prompt: "Old prompt", ...over } as unknown as Automation;
}

describe("applyAutomationPatch", () => {
  it("patches only the name", () => {
    const result = applyAutomationPatch(make({}), { name: "New name" });
    expect(result.name).toBe("New name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("patches only the prompt", () => {
    const result = applyAutomationPatch(make({}), { prompt: "New prompt" });
    expect(result.prompt).toBe("New prompt");
    expect(result.name).toBe("Old name");
  });

  it("leaves fields untouched when the patch has neither key", () => {
    const result = applyAutomationPatch(make({}), {});
    expect(result.name).toBe("Old name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("ignores undefined values (does not blank a field)", () => {
    const result = applyAutomationPatch(make({}), { name: undefined });
    expect(result.name).toBe("Old name");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts"
```
Expected: FAIL — `applyAutomationPatch` is not exported.

- [ ] **Step 3: Add the helper + factory**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache.ts`, append after the existing `setRuns` function (the existing imports at the top — `Automation`, `AutomationRun`, `QueryClient`, `useTRPC`/`TRPCClient` — already cover everything used below):

```ts
export function applyAutomationPatch(
  prev: Automation,
  patch: { name?: string; prompt?: string }
): Automation {
  return {
    ...prev,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
  };
}

/**
 * Shared optimistic-update wiring for `automations.update`. Snapshots the get +
 * list caches, applies the patch optimistically, rolls back on error, and
 * replaces both caches with the server result on success.
 */
export function automationUpdateMutationOptions(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  opts: { errorTitle: string }
) {
  const getKey = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  const listKey = trpc.org.workspace.automations.list.queryOptions().queryKey;

  return trpc.org.workspace.automations.update.mutationOptions({
    meta: { errorTitle: opts.errorTitle },
    onMutate: async (patch) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: getKey }),
        qc.cancelQueries({ queryKey: listKey }),
      ]);
      const prevGet = qc.getQueryData(getKey);
      const prevList = qc.getQueryData(listKey);
      setOne(qc, trpc, id, (a) => applyAutomationPatch(a as Automation, patch));
      upsertInList(qc, trpc, id, (a) => applyAutomationPatch(a as Automation, patch));
      return { prevGet, prevList };
    },
    onError: (_error, _patch, ctx) => {
      if (ctx?.prevGet) {
        qc.setQueryData(getKey, ctx.prevGet);
      }
      if (ctx?.prevList) {
        qc.setQueryData(listKey, ctx.prevList);
      }
    },
    onSuccess: (updated) => {
      setOne(qc, trpc, id, () => updated);
      upsertInList(qc, trpc, id, () => updated);
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts"
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache.ts" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automations-cache-patch.test.ts"
git commit -m "feat(automations): add shared optimistic update mutation factory"
```

---

## Task 3: Inline name editor

**Files:**
- Rewrite: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          get: { queryOptions: () => ({ queryKey: ["get"] }) },
          list: { queryOptions: () => ({ queryKey: ["list"] }) },
          update: { mutationOptions: (options: unknown) => options },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: mutateMock, isPending: false }),
  useQueryClient: () => ({}),
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

const automation = { publicId: "automation_1", name: "Daily review" } as never;

async function renderEditor() {
  const { AutomationNameEditor } = await import(
    "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor"
  );
  render(<AutomationNameEditor automation={automation} />);
}

describe("AutomationNameEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => true });
  });

  it("renders the name and no editor for a non-admin", async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => false });
    await renderEditor();
    expect(screen.getByText("Daily review")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("commits a renamed value on blur", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Weekly review" } });
    fireEvent.blur(input);
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      name: "Weekly review",
    });
  });

  it("commits on Enter", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).toHaveBeenCalledWith({ id: "automation_1", name: "Renamed" });
  });

  it("reverts on Escape without committing", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Daily review")).toBeTruthy();
  });

  it("does not commit an unchanged value", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx"
```
Expected: FAIL — current `AutomationNameEditor` uses a Popover (no `textbox` appears on click; `mutate` payload shape differs).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_NAME_MAX_LENGTH } from "@repo/app-validation/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useTRPC } from "~/trpc/react";
import { automationUpdateMutationOptions } from "../../_components/automations-cache";
import { useInlineEdit } from "./use-inline-edit";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationNameEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const update = useMutation(
    automationUpdateMutationOptions(qc, trpc, id, {
      errorTitle: "Failed to rename automation",
    })
  );

  const { editing, begin, fieldProps } = useInlineEdit({
    value: automation.name,
    onCommit: (next) => update.mutate({ id, name: next }),
  });

  if (!canManage) {
    return (
      <h1 className="font-medium font-pp text-2xl text-foreground">
        {automation.name}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        {...fieldProps}
        className="-mx-1 w-full bg-transparent px-1 font-medium font-pp text-2xl text-foreground outline-none"
        maxLength={AUTOMATION_NAME_MAX_LENGTH}
      />
    );
  }

  return (
    <div
      className="-mx-1 cursor-text rounded px-1 transition-colors hover:bg-accent/50"
      onClick={begin}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          begin();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <h1 className="font-medium font-pp text-2xl text-foreground">
        {automation.name}
      </h1>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx"
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-name-editor.test.tsx"
git commit -m "feat(automations): inline click-to-edit name with auto-save"
```

---

## Task 4: Inline markdown instructions editor

**Files:**
- Rewrite: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx`. The `Markdown` component is mocked to a plain element so the test does not pull in react-markdown/shiki and so we can assert the view renders the prompt text:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          get: { queryOptions: () => ({ queryKey: ["get"] }) },
          list: { queryOptions: () => ({ queryKey: ["list"] }) },
          update: { mutationOptions: (options: unknown) => options },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: mutateMock, isPending: false }),
  useQueryClient: () => ({}),
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@repo/ui/components/markdown", () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

const automation = {
  publicId: "automation_1",
  prompt: "## Review\n- summarize diffs",
} as never;

async function renderEditor() {
  const { AutomationPromptEditor } = await import(
    "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor"
  );
  render(<AutomationPromptEditor automation={automation} />);
}

describe("AutomationPromptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => true });
  });

  it("renders the prompt as markdown", async () => {
    await renderEditor();
    expect(screen.getByTestId("markdown").textContent).toContain("Review");
  });

  it("renders read-only markdown for a non-admin (no editor)", async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => false });
    await renderEditor();
    expect(screen.getByTestId("markdown")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("commits on Cmd+Enter", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New instructions" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      prompt: "New instructions",
    });
  });

  it("commits on blur", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Blurred body" } });
    fireEvent.blur(textarea);
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      prompt: "Blurred body",
    });
  });

  it("does not commit on plain Enter (newline) ", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Line one" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("reverts on Escape", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Discarded" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("markdown")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx"
```
Expected: FAIL — current editor renders a plain `<p>` (no `markdown` testid) and uses an Edit button + Save button (mutate shape/flow differs).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "@repo/app-validation/schemas";
import { Markdown } from "@repo/ui/components/markdown";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useTRPC } from "~/trpc/react";
import { automationUpdateMutationOptions } from "../../_components/automations-cache";
import { useInlineEdit } from "./use-inline-edit";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationPromptEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const update = useMutation(
    automationUpdateMutationOptions(qc, trpc, id, {
      errorTitle: "Failed to update instructions",
    })
  );

  const { editing, draft, begin, fieldProps } = useInlineEdit({
    value: automation.prompt,
    multiline: true,
    onCommit: (next) => update.mutate({ id, prompt: next }),
  });

  const rendered = (
    <Markdown className="text-muted-foreground">{automation.prompt}</Markdown>
  );

  if (!canManage) {
    return rendered;
  }

  if (editing) {
    const length = draft.trim().length;
    const isTooLong = length > AUTOMATION_PROMPT_MAX_LENGTH;
    return (
      <div className="space-y-1.5">
        <Textarea
          {...fieldProps}
          maxLength={AUTOMATION_PROMPT_MAX_LENGTH}
          variant="lf"
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Markdown supported · ⌘↵ to save · Esc to cancel
          </p>
          <p
            className={`font-mono text-xs ${
              isTooLong ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {length} / {AUTOMATION_PROMPT_MAX_LENGTH}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="-mx-2 cursor-text rounded-[9px] px-2 py-1 transition-colors hover:bg-accent/50"
      onClick={(event) => {
        // Let links inside the rendered markdown navigate instead of editing.
        if ((event.target as HTMLElement).closest("a")) {
          return;
        }
        begin();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          begin();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {rendered}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx"
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/automation-prompt-editor.test.tsx"
git commit -m "feat(automations): render instructions as markdown with inline auto-save"
```

---

## Task 5: "Markdown supported" hint on the /new create form

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx`

No automated test: the create form has no existing test, the change is a single static hint string inside a heavily-wired react-hook-form, and a dedicated render harness would be high-cost/low-value. Covered by typecheck + the manual verification in Task 6.

- [ ] **Step 1: Add the hint under the Instructions label**

In `automation-create-form.tsx`, locate the Instructions `FormField` (the `name="prompt"` render). Find this `FormControl` closing block followed by `<FormMessage />`:

```tsx
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
```

Insert a hint paragraph between the `</FormControl>` and `<FormMessage />` of the **prompt** FormField only:

```tsx
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Markdown supported.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
```

> Note: this exact `</FormControl>\n<FormMessage />` sequence appears in more than one FormField. Apply the edit inside the `name="prompt"` field (the one whose `FormControl` wraps the `<Textarea ... maxLength={AUTOMATION_PROMPT_MAX_LENGTH} ...>` with the char-count `<span>`), not the name field.

- [ ] **Step 2: Typecheck the app**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm typecheck
```
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx"
git commit -m "feat(automations): note markdown support on the create form"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full app test suite**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm exec vitest run
```
Expected: PASS — all new tests pass and the existing `automations-page` / `automations-client` suites are unaffected.

- [ ] **Step 2: Typecheck**

Run:
```bash
cd apps/app && SKIP_ENV_VALIDATION=true pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Lint/format**

Run (from repo root):
```bash
pnpm check
```
Expected: PASS (no new violations). If it auto-fixes formatting, restage and amend the relevant commit.

- [ ] **Step 4: Manual smoke test**

Start dev (`pnpm dev`) and open an automation detail page as an org admin (see the authenticated E2E approach in memory if needed):
- Click the **name** → inline input appears with matching heading typography → type → blur or Enter saves → heading updates; Escape reverts.
- Click the **instructions** → textarea with raw markdown appears → edit → ⌘↵ or blur saves → block re-renders as markdown (headings/lists/`code`); Escape reverts; counter + "Markdown supported" hint show while editing.
- Visit **/new** → the Instructions field shows the "Markdown supported." hint.
- As a **non-admin**, confirm the name and rendered markdown are read-only (no edit affordance).

- [ ] **Step 5: Final commit (only if `pnpm check` made changes)**

```bash
git add -A
git commit -m "chore(automations): formatting from pnpm check"
```

---

## Self-Review

**Spec coverage:**
- Markdown rendering of instructions → Task 4 (`Markdown`). ✓
- Click-to-edit, blur/⌘↵ commit, Esc revert → Task 1 (hook) + Tasks 3/4 (wiring). ✓
- Name inline (replaces popover) → Task 3. ✓
- Instructions inline (replaces Edit button) → Task 4. ✓
- Shared optimistic mutation factory → Task 2. ✓
- /new "Markdown supported" hint, no preview → Task 5. ✓
- Schedule editor unchanged → not touched. ✓
- No DB/schema/tRPC/runtime change → none in plan. ✓
- Testing per existing vitest+RTL pattern → Tasks 1–4. ✓

**Type consistency:** `useInlineEdit` returns `{ editing, draft, begin, fieldProps }` — consumed exactly so in Tasks 3/4. `automationUpdateMutationOptions(qc, trpc, id, { errorTitle })` signature matches both call sites. `applyAutomationPatch(prev, { name?, prompt? })` matches its test and factory usage. Mutation payloads `{ id, name }` / `{ id, prompt }` match the test assertions.

**Placeholder scan:** none — every code/test step contains complete content.

**Accepted tradeoffs (noted, not gaps):**
- Clicking a link inside rendered instructions navigates rather than entering edit (anchor guard in Task 4); all other clicks edit. Acceptable for prompt text.
- The previous explicit "name too long" message is dropped; `maxLength` makes over-length entry impossible, and empty/unchanged drafts silently revert.
