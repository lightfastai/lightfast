# Chat UI Performance Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound the workspace chat's streaming re-renders and DOM growth — memoize per-message/composer renders and virtualize the message list with `@tanstack/react-virtual` native end-anchoring — without changing transport or data fetching.

**Architecture:** Three task groups on a repaired-green baseline. (A) Extract a `React.memo` `ChatMessage` row and memoize the composer so streaming tokens stop re-rendering completed turns and the textarea. (B) Replace `use-stick-to-bottom` in the shared `conversation.tsx` with a scroll-container + virtualizer (`anchorTo:"end"` keeps the view pinned while the last row grows), switching its single consumer to an `items`/`renderItem` contract. (C) Verify React Compiler is applied in every production/CI build, not just Vercel.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, `@ai-sdk/react` `useChat`, `@tanstack/react-virtual@3.13.26` (→ `virtual-core@3.16.0`, already installed), vitest + Testing Library.

**Source spec:** `docs/superpowers/specs/2026-06-03-chat-perf-upgrade-design.md`

---

## Pre-flight context (read once before starting)

- **Component under change:** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx` (the `"use client"` chat root, lines numbered as of this plan).
- **Shared component under change:** `packages/ui/src/components/ai-elements/conversation.tsx` — **only consumer is the file above** (verified repo-wide), so its API can change freely.
- **Copy affordance:** `message-copy-button.tsx` exports `extractMessageText(message)` and `MessageCopyButton({text})`. `MessageCopyButton` renders a `MessageAction` whose accessible name is the `label` — `"Copy"`, flipping to `"Copied"` for ~1.5s after `navigator.clipboard.writeText(text)`.
- **Virtualizer reference pattern:** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-list-view.tsx` (+ `signals-list-view.test.tsx`) is the in-repo `useVirtualizer` + test-mock template. Match it.
- **Run tests from `apps/app`:** `cd apps/app && pnpm with-env vitest run <path>`. From `packages/ui`: `cd packages/ui && pnpm vitest run <path>`.
- **Commit discipline:** the worktree is dirty with unrelated in-progress work and has concurrent git writers. **Every commit uses an explicit pathspec** (`git commit -- <paths>`), and you `git add -- <paths>` then verify `git diff --cached --name-only` shows only your files before committing. End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx` | Chat root: state, empty/active branch, composes rows + composer | Modify (Tasks 1, 2, 4) |
| `apps/app/src/app/.../_components/chat-message.test.tsx` | Focused memo render-count test for the extracted row | Create (Task 1) |
| `packages/ui/src/components/ai-elements/conversation.tsx` | Scroll container + virtualization + scroll-state context | Modify (Tasks 3, 4, 5) |
| `packages/ui/src/components/ai-elements/conversation.test.tsx` | Scroll-button + windowing tests for the shared component | Create (Tasks 3, 4) |
| `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx` | Existing client test suite | Modify (Tasks 0, 4) |
| `packages/ui/package.json` | Drop `use-stick-to-bottom` | Modify (Task 5) |
| `vendor/next/src/config.ts` | React Compiler gating | Modify (Task 6) |
| `scripts/verify-react-compiler.mjs` (or equivalent) | Prove the compiler ran in a prod build | Create (Task 6) |

---

## Task 0: Repair the chat test baseline to green

The test predates commit `826131606` ("polish chat message styling, copy actions, and composer"); 3 of 10 assertions are stale against the already-shipped component. Bring them in line with current committed behavior **only** — invent no new behavior. This is the green baseline every later task depends on.

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx`

- [ ] **Step 1: Confirm the current red state**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: `3 failed | 7 passed (10)` — failures: *renders persisted chat messages…*, *uses tokenized composer styling*, *shows feedback when copying a persisted chat link*.

- [ ] **Step 2: Add `MessageActions` + `MessageAction` to the message-module mock**

The component now renders `<MessageActions>` wrapping `MessageCopyButton`, and `MessageCopyButton` imports `MessageAction` from the same module. The mock omits both, so the row throws. Replace the `vi.mock("@repo/ui/components/ai-elements/message", …)` block (currently lines ~69-85) with:

```tsx
vi.mock("@repo/ui/components/ai-elements/message", () => ({
  Message: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  MessageContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="message-content">
      {children}
    </div>
  ),
  MessageResponse: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageActions: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="message-actions">
      {children}
    </div>
  ),
  MessageAction: ({
    children,
    label,
    onClick,
  }: {
    children?: ReactNode;
    label?: string;
    onClick?: () => void;
    tooltip?: string;
  }) => (
    <button aria-label={label} onClick={onClick} type="button">
      {children}
    </button>
  ),
}));
```

- [ ] **Step 3: Fix the persisted-messages class assertion**

The user bubble no longer carries `bg-muted`; the assistant turn carries `bg-transparent`. In the *renders persisted chat messages…* test (around lines 433-435) replace:

```tsx
    const messageContents = screen.getAllByTestId("message-content");
    expect(messageContents[0]).toHaveClass("bg-muted");
    expect(messageContents[1]).toHaveClass("bg-transparent");
```

with assertions matching the current component (user row: `group-[.is-user]:rounded-3xl`; assistant row: `bg-transparent`):

```tsx
    const messageContents = screen.getAllByTestId("message-content");
    expect(messageContents[0]).toHaveClass("group-[.is-user]:rounded-3xl");
    expect(messageContents[1]).toHaveClass("bg-transparent");
```

- [ ] **Step 4: Fix the composer styling assertion**

The composer is now `bg-secondary rounded-[1.75rem] shadow-lg`. Replace the body of *uses tokenized composer styling* (around lines 466-475):

```tsx
    const { container } = render(<WorkspaceAssistantClient />);

    expect(container.querySelector("form")).toHaveClass(
      "rounded-[1.75rem]",
      "border",
      "border-border/50",
      "bg-secondary",
      "shadow-lg",
      "[&_[data-slot=input-group]]:border-0",
      "[&_[data-slot=input-group]]:bg-transparent"
    );
```

- [ ] **Step 5: Rewrite the copy-feedback test to target the per-message copy button**

The old single "Copy chat link" button is gone; each turn now has a `MessageCopyButton` that copies the message's text. Rename and rewrite the *shows feedback when copying a persisted chat link* test (around lines 477-503):

```tsx
  it("copies a message's text and shows copied feedback", async () => {
    render(
      <WorkspaceAssistantClient
        initialConversation={{
          messages: [
            makeWorkspaceAssistantMessage({
              parts: [
                { text: "Summarize my active opportunities", type: "text" },
              ],
              publicId: "msg_user",
              role: "user",
            }),
          ],
          conversation: makeWorkspaceAssistantConversation(),
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "Summarize my active opportunities"
      );
    });
    expect(
      screen.getByRole("button", { name: "Copied" })
    ).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the suite to verify green**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: `10 passed (10)`.

- [ ] **Step 7: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"
git diff --cached --name-only   # must list ONLY that file
git commit -m "test(app): repair stale chat client assertions to match shipped redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"
```

---

## Task 1: Extract a memoized `ChatMessage` row (and memoize `WorkspaceAssistantMessagePart`)

During streaming, `useChat` re-renders the chat root on every token, re-rendering every completed turn and every part. Extract the per-message subtree into a `React.memo` component keyed by `message`, so only the active turn reconciles. Also wrap `WorkspaceAssistantMessagePart` in `React.memo` so stable parts skip work.

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx`

- [ ] **Step 1: Write the failing memo render-count test**

Create `chat-message.test.tsx`. It renders the exported `ChatMessage` under a parent that can force re-renders, with a stable `message` reference, and asserts the row body renders once (memo skips parent-driven re-renders). The message-module mock counts `MessageResponse` invocations.

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

let messageResponseRenderCount = 0;

vi.mock("@repo/ui/components/ai-elements/message", () => ({
  Message: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageResponse: ({ children }: { children?: ReactNode }) => {
    messageResponseRenderCount += 1;
    return <div>{children}</div>;
  },
  MessageActions: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageAction: ({
    children,
    label,
  }: {
    children?: ReactNode;
    label?: string;
  }) => (
    <button aria-label={label} type="button">
      {children}
    </button>
  ),
  Reasoning: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ReasoningContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ReasoningTrigger: () => <button type="button">Reasoning</button>,
  Tool: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ToolContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ToolHeader: () => <button type="button">Tool</button>,
  ToolInput: () => <div>Tool input</div>,
  ToolOutput: () => <div>Tool output</div>,
}));

const { ChatMessage } = await import("./workspace-assistant-client");

function Harness({ message }: { message: Parameters<typeof ChatMessage>[0]["message"] }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  return (
    <>
      <button onClick={() => force()} type="button">
        force
      </button>
      <ChatMessage isStreaming={false} message={message} />
    </>
  );
}

describe("ChatMessage memoization", () => {
  it("does not re-render a completed message when the parent re-renders", () => {
    messageResponseRenderCount = 0;
    const message = {
      id: "msg_assistant",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Stable answer" }],
    };

    render(<Harness message={message} />);
    expect(messageResponseRenderCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "force" }));
    fireEvent.click(screen.getByRole("button", { name: "force" }));

    expect(messageResponseRenderCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx"`
Expected: FAIL — `ChatMessage` is not exported (`undefined`), import/render throws.

- [ ] **Step 3: Extract and export the memoized `ChatMessage`**

In `workspace-assistant-client.tsx`, add `memo` to the React import (`import { memo, useEffect, useMemo, useRef, useState } from "react";`). Pull the per-message JSX (currently the body of `messages.map(...)`, lines ~204-243) into a module-level memoized component, deriving `copyText` internally:

```tsx
export const ChatMessage = memo(function ChatMessage({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: UIMessage;
}) {
  const copyText = extractMessageText(message);
  return (
    <Message className="relative" from={message.role}>
      <MessageContent
        className={cn(
          message.role === "user" &&
            "text-base leading-6 group-[.is-user]:rounded-3xl group-[.is-user]:px-5 group-[.is-user]:py-2",
          message.role === "assistant" &&
            "w-full max-w-none bg-transparent px-0 py-0 text-base leading-7"
        )}
      >
        {message.parts.map((part, index) => (
          <WorkspaceAssistantMessagePart
            isStreaming={isStreaming}
            key={`${message.id}-${index}`}
            part={part}
          />
        ))}
      </MessageContent>
      {copyText ? (
        <MessageActions
          className={cn(
            "absolute top-full mt-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100",
            message.role === "user" ? "right-0" : "left-0"
          )}
        >
          <MessageCopyButton text={copyText} />
        </MessageActions>
      ) : null}
    </Message>
  );
});
```

- [ ] **Step 4: Use `ChatMessage` in the map and scope `isStreaming` to the active turn**

Replace the `messages.map(...)` block (lines ~204-243) with a stable-keyed render whose `isStreaming` is true only for the last message while streaming (so flipping `status` doesn't dirty every row):

```tsx
                {messages.map((message, index) => (
                  <ChatMessage
                    isStreaming={
                      status === "streaming" && index === messages.length - 1
                    }
                    key={message.id}
                    message={message}
                  />
                ))}
```

- [ ] **Step 5: Wrap `WorkspaceAssistantMessagePart` in `React.memo`**

Change its declaration (line ~365) from `function WorkspaceAssistantMessagePart({…}) {` to a memoized const, preserving the body:

```tsx
const WorkspaceAssistantMessagePart = memo(function WorkspaceAssistantMessagePart({
  isStreaming,
  part,
}: {
  isStreaming: boolean;
  part: UIMessage["parts"][number];
}) {
  // …existing body unchanged…
});
```

- [ ] **Step 6: Run the new test + the full client suite**

Run: `cd apps/app && pnpm with-env vitest run "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx" "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: both files green (memo test `1 passed`, client suite `10 passed`).

- [ ] **Step 7: Typecheck the app package**

Run: `pnpm --filter @api/app build && cd apps/app && pnpm with-env next typegen`
Expected: no type errors introduced by the extraction. (If `next typegen` is noisy, rely on `pnpm typecheck` for `apps/app`.)

- [ ] **Step 8: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx"
git diff --cached --name-only
git commit -m "perf(app): memoize chat message rows to skip completed turns during streaming

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx"
```

---

## Task 2: Memoize the composer

`ChatComposer` re-renders on every streaming token because `handleSubmit` is a fresh closure each render and the composer isn't memoized — re-rendering the textarea unnecessarily. Stabilize the handler and memoize the composer; it then re-renders only on `status`/`text`/`error` changes (which it must), not on message growth.

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx`

- [ ] **Step 1: Wrap `ChatComposer` in `React.memo`**

Change its declaration (line ~472) from `function ChatComposer({…}) {` to:

```tsx
const ChatComposer = memo(function ChatComposer({
  disabled,
  error,
  onSubmit,
  onTextChange,
  status,
  stop,
  text,
}: {
  disabled: boolean;
  error: Error | undefined;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  status: ChatStatus;
  stop: () => void;
  text: string;
}) {
  // …existing body unchanged…
});
```

- [ ] **Step 2: Stabilize `handleSubmit` with `useCallback`**

Add `useCallback` to the React import. Wrap `handleSubmit` (lines ~138-183), depending only on stable values (note `createConversation.mutateAsync` is stable across renders; the `createConversation` object is not):

```tsx
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      // …existing body unchanged…
    },
    [params.slug, createConversation.mutateAsync, sendMessage, clearError]
  );
```

- [ ] **Step 3: Run the full client suite to verify behavior is unchanged**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: `10 passed (10)` (send/create/stop/styling behaviors intact).

- [ ] **Step 4: Manual perf confirmation (no test — documented check)**

With `pnpm dev` running, open a chat, send a prompt, and in React DevTools Profiler (or "Highlight updates") confirm that during streaming the composer and completed turns do **not** flash re-renders — only the active assistant turn updates. Record the observation in the PR description. (Render-count profiling stays manual; unit tests gate behavior + the Task 1 memo boundary.)

- [ ] **Step 5: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx"
git diff --cached --name-only
git commit -m "perf(app): memoize chat composer and stabilize submit handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx"
```

---

## Task 3: Replace `use-stick-to-bottom` with a scroll-container + scroll-state context (no virtualization yet)

Swap the scroll mechanism first, keeping `ConversationContent` rendering `children` directly so behavior and the chat suite stay green. This isolates the riskier virtualization (Task 4) from the scroll-controller swap.

**Files:**
- Modify: `packages/ui/src/components/ai-elements/conversation.tsx`
- Create: `packages/ui/src/components/ai-elements/conversation.test.tsx`

- [ ] **Step 1: Write the failing scroll-button test**

Create `conversation.test.tsx`. It asserts the scroll button is hidden at bottom and appears after scrolling up, driven by the new context. jsdom reports zero geometry, so define geometry on the scroll element and fire a scroll event.

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./conversation";

function setGeometry(
  el: HTMLElement,
  geo: { scrollTop: number; scrollHeight: number; clientHeight: number }
) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: geo.scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: geo.clientHeight,
  });
  el.scrollTop = geo.scrollTop;
}

describe("Conversation scroll button", () => {
  it("hides at bottom and shows after scrolling up", () => {
    const { container } = render(
      <Conversation>
        <ConversationContent>
          <div style={{ height: 2000 }}>messages</div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    );

    const scroller = container.querySelector(
      "[data-slot=conversation-scroller]"
    ) as HTMLElement;
    expect(scroller).not.toBeNull();

    // At bottom: scrollTop + clientHeight === scrollHeight → button hidden.
    setGeometry(scroller, {
      scrollTop: 1500,
      scrollHeight: 2000,
      clientHeight: 500,
    });
    fireEvent.scroll(scroller);
    expect(
      screen.queryByRole("button", { name: "Scroll to latest message" })
    ).not.toBeInTheDocument();

    // Scrolled up: gap > threshold → button shows.
    setGeometry(scroller, {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 500,
    });
    fireEvent.scroll(scroller);
    expect(
      screen.getByRole("button", { name: "Scroll to latest message" })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Expected: FAIL — no `data-slot=conversation-scroller` element / `useStickToBottomContext` not provided.

- [ ] **Step 3: Rewrite `conversation.tsx` scroll layer**

Replace the `use-stick-to-bottom` imports and `Conversation`/`ConversationContent`/`ConversationScrollButton` with a context-driven scroll container. Keep `ConversationEmptyState`, `messagesToMarkdown`, and `ConversationDownload` exactly as-is. New top section:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { UIMessage } from "@vendor/ai";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const STICK_TO_BOTTOM_THRESHOLD_PX = 70;

interface ConversationScrollState {
  scrollRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

const ConversationScrollContext = createContext<ConversationScrollState | null>(
  null
);

function useConversationScroll(): ConversationScrollState {
  const ctx = useContext(ConversationScrollContext);
  if (!ctx) {
    throw new Error("Conversation components must be used within <Conversation>");
  }
  return ctx;
}

export type ConversationProps = ComponentProps<"div"> & {
  "aria-label"?: string;
};

export const Conversation = ({
  "aria-label": ariaLabel,
  className,
  children,
  ...props
}: ConversationProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distance <= STICK_TO_BOTTOM_THRESHOLD_PX);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight });
  }, []);

  return (
    <ConversationScrollContext.Provider
      value={{ scrollRef, isAtBottom, scrollToBottom }}
    >
      <div
        aria-label={ariaLabel ?? "Conversation"}
        className={cn("relative flex-1 overflow-hidden", className)}
        role="log"
        {...props}
      >
        <div
          className="h-full overflow-y-auto"
          data-slot="conversation-scroller"
          onScroll={recompute}
          ref={scrollRef}
        >
          {children}
        </div>
      </div>
    </ConversationScrollContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<"div">;

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => (
  <div className={cn("flex flex-col gap-8 p-4", className)} {...props}>
    {children}
  </div>
);
```

And rewrite `ConversationScrollButton` to read the context:

```tsx
export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  "aria-label": ariaLabel,
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationScroll();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      aria-label={ariaLabel ?? "Scroll to latest message"}
      className={cn(
        "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted",
        className
      )}
      onClick={scrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};
```

Keep the `getMessageText` / `ConversationDownloadProps` / `defaultFormatMessage` / `messagesToMarkdown` / `ConversationDownload` / `ConversationEmptyState` exports unchanged. Remove the `use-stick-to-bottom` import line entirely.

- [ ] **Step 4: Run the conversation test + the chat suite**

Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Expected: `1 passed`.
Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: `10 passed (10)` (children still render directly; no API change for the consumer yet).

- [ ] **Step 5: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- packages/ui/src/components/ai-elements/conversation.tsx packages/ui/src/components/ai-elements/conversation.test.tsx
git diff --cached --name-only
git commit -m "refactor(ui): replace use-stick-to-bottom with scroll-state context in conversation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- packages/ui/src/components/ai-elements/conversation.tsx packages/ui/src/components/ai-elements/conversation.test.tsx
```

---

## Task 4: Virtualize `ConversationContent` and switch the consumer to `items`/`renderItem`

Now bound DOM growth. `ConversationContent` becomes generic over an items array and owns the virtualizer with native end-anchoring; the chat root passes `items={messages}` + a `renderItem` that returns the memoized `ChatMessage`.

**Files:**
- Modify: `packages/ui/src/components/ai-elements/conversation.tsx`
- Modify: `packages/ui/src/components/ai-elements/conversation.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx`

- [ ] **Step 1: Write the failing windowing test**

Add to `conversation.test.tsx` a `@tanstack/react-virtual` mock (windowed, mirroring `signals-list-view.test.tsx`) and a test that a long list renders only the window. Place the `vi.mock` at the top of the file:

```tsx
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => {
    const windowSize = Math.min(count, 5);
    return {
      getTotalSize: () => count * 80,
      getVirtualItems: () =>
        Array.from({ length: windowSize }, (_, index) => ({
          index,
          key: getItemKey(index),
          start: index * 80,
          size: 80,
        })),
      measureElement: () => undefined,
    };
  },
}));
```

And the test:

```tsx
describe("ConversationContent virtualization", () => {
  it("renders only the windowed items", () => {
    const items = Array.from({ length: 50 }, (_, i) => `Message ${i + 1}`);
    render(
      <Conversation>
        <ConversationContent
          getItemKey={(item) => item}
          items={items}
          renderItem={(item) => <div>{item}</div>}
        />
      </Conversation>
    );

    expect(screen.getByText("Message 1")).toBeInTheDocument();
    expect(screen.queryByText("Message 40")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Expected: FAIL — `ConversationContent` doesn't accept `items`/`renderItem` (renders nothing / type error at runtime).

- [ ] **Step 3: Virtualize `ConversationContent`**

Replace the `ConversationContent` from Task 3 with a generic, virtualized version using the context's `scrollRef`. Add the import `import { useVirtualizer } from "@tanstack/react-virtual";` at the top.

```tsx
const DEFAULT_ESTIMATE_SIZE = 120;

export type ConversationContentProps<T> = Omit<
  ComponentProps<"div">,
  "children"
> & {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  estimateSize?: number;
};

export const ConversationContent = <T,>({
  className,
  items,
  renderItem,
  getItemKey,
  estimateSize = DEFAULT_ESTIMATE_SIZE,
  ...props
}: ConversationContentProps<T>) => {
  const { scrollRef } = useConversationScroll();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getItemKey(items[index] as T, index),
    measureElement: (el) => el.getBoundingClientRect().height,
    // Native end-anchoring keeps the view pinned while the last row grows
    // during streaming. These live in virtual-core 3.16.0; cast because the
    // react-virtual 3.13.x option type may not surface them yet.
    ...({ anchorTo: "end", followOnAppend: "smooth", scrollEndThreshold: 70 } as Record<
      string,
      unknown
    >),
  });

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height: virtualizer.getTotalSize() }}
      {...props}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          data-index={virtualItem.index}
          key={virtualItem.key}
          ref={virtualizer.measureElement}
          style={{
            left: 0,
            position: "absolute",
            top: 0,
            transform: `translateY(${virtualItem.start}px)`,
            width: "100%",
          }}
        >
          {renderItem(items[virtualItem.index] as T, virtualItem.index)}
        </div>
      ))}
    </div>
  );
};
```

> Note: the previous `flex flex-col gap-8 p-4` spacing moves onto each row wrapper or `renderItem` output, since the virtualizer absolutely-positions rows. The consumer (Step 5) applies its column/padding styling per row.

- [ ] **Step 4: Run the conversation tests**

Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Expected: both `Conversation scroll button` and `ConversationContent virtualization` pass.

- [ ] **Step 5: Switch the chat root to `items`/`renderItem`**

In `workspace-assistant-client.tsx`, replace the `<ConversationContent>{messages.map(...)}</ConversationContent>` block (lines ~203-244) with the items API, moving the `max-w-3xl` column styling onto a per-row wrapper:

```tsx
              <ConversationContent
                getItemKey={(message) => message.id}
                items={messages}
                renderItem={(message, index) => (
                  <div className="mx-auto w-full max-w-3xl px-5 pt-8 md:px-10">
                    <ChatMessage
                      isStreaming={
                        status === "streaming" && index === messages.length - 1
                      }
                      message={message}
                    />
                  </div>
                )}
              />
```

Keep the surrounding `<Conversation className="h-full">…<ConversationScrollButton /></Conversation>` wrapper. Remove the now-unused inline `extractMessageText(message)`/`copyText` left in the map (it lives in `ChatMessage` now).

- [ ] **Step 6: Add the react-virtual mock to the chat suite**

Because the chat suite does not mock `conversation.tsx`, the real virtualizer would render nothing in jsdom. Add the same windowed mock used in `signals-list-view.test.tsx` to the top of `workspace-assistant-client.test.tsx` (with the other `vi.mock` calls):

```tsx
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 120,
        size: 120,
      })),
    measureElement: () => undefined,
  }),
}));
```

(Window = full `count` here so the existing "renders persisted chat messages" / "non-text fallbacks" assertions that expect both messages keep passing.)

- [ ] **Step 7: Run both suites**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx" "src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx"`
Expected: client suite `10 passed`, memo test `1 passed`.
Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Expected: all pass.

- [ ] **Step 8: Manual streaming/scroll check**

With `pnpm dev`, in a long conversation confirm: (a) only a window of message DOM nodes exists (inspect the DOM), (b) the view stays pinned to the bottom while the last assistant message streams and grows, (c) scrolling up reveals the scroll-to-bottom button and clicking it returns to bottom. Record in the PR. If sub-pixel jitter appears during fast streams, enable rAF-batched measurement by adding `useAnimationFrameWithResizeObserver: true` to the `useVirtualizer` options (cast block) and re-verify.

- [ ] **Step 9: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- packages/ui/src/components/ai-elements/conversation.tsx packages/ui/src/components/ai-elements/conversation.test.tsx "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"
git diff --cached --name-only
git commit -m "perf(ui,app): virtualize chat message list with native end-anchoring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- packages/ui/src/components/ai-elements/conversation.tsx packages/ui/src/components/ai-elements/conversation.test.tsx "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"
```

---

## Task 5: Drop the unused `use-stick-to-bottom` dependency

**Files:**
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Confirm there are no remaining imports**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && grep -rn "use-stick-to-bottom" --include="*.ts" --include="*.tsx" apps packages`
Expected: no matches in source (only — if anything — the `package.json` entry).

- [ ] **Step 2: Remove the dependency line**

Delete the `"use-stick-to-bottom": "catalog:",` line from `packages/ui/package.json` (was line ~111).

- [ ] **Step 3: Reinstall to update the lockfile**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && pnpm install`
Expected: lockfile updates; install succeeds.

- [ ] **Step 4: Re-run the conversation + chat suites as a regression gate**

Run: `cd packages/ui && pnpm vitest run src/components/ai-elements/conversation.test.tsx`
Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx"`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- packages/ui/package.json pnpm-lock.yaml
git diff --cached --name-only
git commit -m "chore(ui): drop unused use-stick-to-bottom dependency

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- packages/ui/package.json pnpm-lock.yaml
```

---

## Task 6: Verify React Compiler runs in every production/CI build

Keep dev off (build speed), but ensure the compiler is applied in all production builds — not only on Vercel — and add a check that proves it.

**Files:**
- Modify: `vendor/next/src/config.ts`
- Create: `scripts/verify-react-compiler.mjs`

- [ ] **Step 1: Establish where production builds run**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && ls .github/workflows && grep -rln "next build\|build:app\|turbo run build\|pnpm build" .github/workflows`
Read the matching workflows. Determine whether any production build runs outside Vercel (i.e. where `env.VERCEL` is unset). Record the finding in the PR description. If **all** production builds go through Vercel, the gating change below is a safety net (still correct), and the verification step proves current behavior.

- [ ] **Step 2: Inspect the env object available in the config**

Run: `grep -n "env\b\|VERCEL\|NODE_ENV\|process.env\|createEnv\|import" vendor/next/src/config.ts | head -40`
Confirm which production signal is available on `env` (e.g. `env.VERCEL`, `env.VERCEL_ENV`, `env.NODE_ENV`). Use whichever production signal the validated `env` exposes; if only `process.env.NODE_ENV` is reliable for "is a production build", use that. The intent: **true for any production build, false for `next dev`.**

- [ ] **Step 3: Broaden the gating (keep dev off)**

Change line ~19 so the compiler runs for every production build, not just Vercel. Using `NODE_ENV` (production during `next build`, development during `next dev`):

```ts
  // React Compiler and optimizeCss add significant overhead in local dev,
  // so gate them on production builds (true for `next build` anywhere —
  // Vercel or other CI — and false for `next dev`).
  reactCompiler: process.env.NODE_ENV === "production",
```

(If the file standardizes on the validated `env` wrapper for this, prefer `env`'s production signal over raw `process.env`; match the file's existing convention from Step 2.)

- [ ] **Step 4: Add a verification script that proves the compiler ran**

Create `scripts/verify-react-compiler.mjs` — it greps a production build's client output for the React Compiler runtime marker (`react-compiler-runtime`) or its memo-cache helper, and exits non-zero if absent.

```js
// Verifies React Compiler output is present in a production build of apps/app.
// Usage: node scripts/verify-react-compiler.mjs <chunks-dir>
//   e.g. node scripts/verify-react-compiler.mjs apps/app/.next/static/chunks
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "apps/app/.next/static/chunks";
const MARKERS = ["react-compiler-runtime", "react.memo_cache_sentinel"];

function walk(d) {
  const out = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (p.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(dir);
const hit = files.some((f) => {
  const src = readFileSync(f, "utf8");
  return MARKERS.some((m) => src.includes(m));
});

if (!hit) {
  console.error(
    `React Compiler markers not found in ${dir}. Expected one of: ${MARKERS.join(", ")}`
  );
  process.exit(1);
}
console.log(`React Compiler output confirmed in ${dir}.`);
```

- [ ] **Step 5: Run a production build and the verification locally**

Run: `cd apps/app && pnpm with-env next build`
Then: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && node scripts/verify-react-compiler.mjs apps/app/.next/static/chunks`
Expected: `React Compiler output confirmed in …`. (If markers differ in this Next/compiler version, adjust `MARKERS` to a string the build actually emits — confirm by grepping the chunks for `_c(` memo-cache usage — and re-run.)

- [ ] **Step 6: Wire the check into CI**

Add a step to the production/build workflow identified in Step 1 that runs `node scripts/verify-react-compiler.mjs <app>/.next/static/chunks` after the build. If all prod builds are Vercel-only and CI has no post-build hook, document in the PR that the verification runs locally/pre-merge and that Step 3's gating guarantees the compiler on every `next build`.

- [ ] **Step 7: Commit**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git add -- vendor/next/src/config.ts scripts/verify-react-compiler.mjs
git diff --cached --name-only   # plus any CI workflow file you edited
git commit -m "build: apply React Compiler to all production builds and verify output

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- vendor/next/src/config.ts scripts/verify-react-compiler.mjs
```

---

## Final verification (run after all tasks)

- [ ] **Full app + ui test suites green**

Run: `cd apps/app && pnpm with-env vitest run` → expected: all pass.
Run: `cd packages/ui && pnpm vitest run` → expected: all pass.

- [ ] **Typecheck + lint**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && pnpm check && pnpm typecheck`
Expected: no new errors.

- [ ] **Production build**

Run: `pnpm build:app`
Expected: build succeeds; `node scripts/verify-react-compiler.mjs apps/app/.next/static/chunks` confirms the compiler.

- [ ] **Manual chat smoke (documented in PR)**

`pnpm dev` → long conversation: bounded DOM window, pinned-to-bottom streaming, working scroll-to-bottom button, no composer/completed-turn re-render flashing during streaming.

---

## Self-review notes (author)

- **Spec coverage:** WS1 memoization → Tasks 1-2; WS2 virtualization (retire use-stick-to-bottom, items/renderItem, scroll button from new context, single consumer) → Tasks 3-5; WS3 React Compiler verify-prod/CI → Task 6; red-baseline repair (added during planning) → Task 0. Out-of-scope items (PPR, Streamdown, TanStack) are correctly untouched.
- **Type consistency:** `ChatMessage({isStreaming, message})`, `WorkspaceAssistantMessagePart({isStreaming, part})`, `ConversationContentProps<T>{items, renderItem, getItemKey, estimateSize}`, and the `ConversationScrollContext` shape `{scrollRef, isAtBottom, scrollToBottom}` are used identically across tasks.
- **Known residual risk:** `anchorTo`/`followOnAppend` are passed via a cast because the `react-virtual@3.13.x` option types may not surface virtual-core 3.16 options (verified present at runtime). If a future react-virtual bump types them, drop the cast.
