# Chat UI performance upgrade — evidence-grounded

**Date:** 2026-06-03
**Status:** Approved (design), pending implementation plan
**Area:** workspace assistant chat — `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx` and the shared `packages/ui/src/components/ai-elements/conversation.tsx`

## Context

A request to "run a full React / Next.js / TanStack end-to-end performance upgrade where possible" was scoped down by a three-part audit plus two validation probes (one isolated-worktree spike, one source-grounded research pass). The evidence collapsed most of the speculative surface and left a focused, chat-render–centric set of wins.

What the audit + probes established:

- **TanStack Query + tRPC is already optimal.** `apps/app/src/trpc/query-client.ts` sets `staleTime: 30_000`, `refetchOnMount: false`, `refetchOnWindowFocus: false`; pages follow `prefetch()` → `<HydrateClient>` with parallel prefetches; modern `useSuspenseQuery` / `queryOptions` / `infiniteQueryOptions` are used throughout. No architectural change is warranted. **No work here.**
- **PPR / Cache Components is a no-go for this app (spike-validated).** In Next 16.2.6 `experimental.ppr` has been folded into `experimental.cacheComponents`, which is **all-or-nothing app-wide**. Enabling it fails to compile until every `export const dynamic` (24) and `export const runtime` (20) in `apps/app` is removed — 44 files, several with load-bearing `runtime = "nodejs"` for Octokit/tRPC RSA signing. And because the app is auth-gated end-to-end (`<ClerkProvider>` at the root layout; `[slug]/layout.tsx` reads `headers()` + DB + Clerk before rendering), the prerenderable static shell is near-empty. High cost, ~zero payoff. **Dropped.**
- **Streamdown per-token reparse is a non-issue.** Streamdown 1.4.0 already splits markdown into top-level blocks and `React.memo`s each block with a `content === content` comparator plus a per-block `useMemo`'d parse; only the last growing block re-renders per token. The earlier "HIGH-impact bottleneck" does not exist. **Dropped.**
- **Virtualization is viable with what's installed.** `@tanstack/react-virtual@3.13.26` (→ `@tanstack/virtual-core@3.16.0`) natively supports `anchorTo: "end"`, `followOnAppend`, `scrollEndThreshold`, and `isAtEnd()` — i.e. "keep pinned to bottom while the last row grows during streaming" is built in. Running it *alongside* `use-stick-to-bottom` would create two scroll controllers fighting over `scrollTop`; the correct approach is to **retire `use-stick-to-bottom`** in the conversation component and use react-virtual's native end-anchoring. `react-virtual` is already used in-repo (`signals/_components/signals-list-view.tsx`), giving us a working pattern to model after.

A factual correction surfaced while reading the source: the initial audit claimed `ChatComposer`, `EmptyChatState`, and `WorkspaceAssistantMessagePart` are "inline functions recreated every render." They are **module-level** functions (`workspace-assistant-client.tsx:472`, `:290`, `:365`) and are not recreated. The real re-render cost is different (see Design § 1) and this spec targets the actual cause.

## Goal

Reduce wasted re-renders and unbounded DOM growth in the workspace chat without changing transport, data fetching, or the in-flight ChatGPT redesign. Concretely: (1) stop completed messages and the composer from re-rendering on every streaming token, (2) cap rendered message DOM via virtualization that preserves streaming stick-to-bottom UX, and (3) prove React Compiler is actually applied in production/CI builds.

This is a **separate workstream** from `docs/superpowers/specs/2026-06-03-chat-ui-chatgpt-redesign-design.md`; that spec is unchanged. Where both touch `workspace-assistant-client.tsx`, sequencing is handled in the implementation plan, not here.

## Decisions

| Area | Choice | Notes |
| --- | --- | --- |
| Data layer (TanStack/tRPC) | **No change** | Audited; already best-practice. "End-to-end" excludes it deliberately. |
| PPR / Cache Components | **Excluded (no-go)** | Spike-validated: all-or-nothing in 16.2.6, 44 route-config edits, auth-gated empty shell. |
| Streaming markdown | **Excluded (already optimal)** | Streamdown 1.4.0 block-memoizes; no reparse to fix. |
| Chat-render memoization | **In — low risk** | Memoize per-message and the composer so streaming re-renders are bounded to the active turn. |
| Message virtualization | **In — moderate risk** | `@tanstack/react-virtual` native `anchorTo:"end"`; **retire `use-stick-to-bottom`**. |
| `conversation.tsx` API | **Change contract; keep export names** | Single internal consumer → switch `ConversationContent` to an `items` + `renderItem` model. No `children`-virtualization contortion. |
| React Compiler | **Verify prod/CI, keep dev off** | `reactCompiler: !!env.VERCEL` stays; add proof it is applied + cover non-Vercel CI. |

## Scope

**In scope (three workstreams):**

1. Chat-render memoization in `workspace-assistant-client.tsx`.
2. Message-list virtualization in `packages/ui/src/components/ai-elements/conversation.tsx`, with its single consumer updated.
3. React Compiler application verification in `vendor/next/src/config.ts` + CI.

**Out of scope (evidence-backed — see Out of scope §):** PPR / Cache Components; Streamdown / streaming-markdown internals; any TanStack Query / tRPC change; the ChatGPT redesign's visual/layout work; reasoning/tool/source/file part rendering changes.

## Design

### 1. Chat-render memoization (`workspace-assistant-client.tsx`)

**Problem.** `useChat` (`:114`) updates `messages`/`status` on every streaming token, re-rendering `WorkspaceAssistantClient` (`:68`). Each render re-runs the full `messages.map(...)` (`:204–243`) — so **every** completed message and **every** part (`WorkspaceAssistantMessagePart`, `:365`, un-memoized) re-renders, and the `composer` element (`:185`) re-renders, re-rendering the `PromptInputTextarea` on every token. Streamdown's own block memoization stops re-parsing, but React still reconciles all of it.

**Changes:**

- **Extract a memoized per-message component.** Pull the `Message` + `MessageContent` + parts mapping (`:207–241`) into a module-level `ChatMessage` wrapped in `React.memo`. Props: `message`, `isStreaming`, `copyText` (or derive `copyText` inside). Memo comparator (or default shallow + stable props) ensures a completed message re-renders only when its own `message` reference changes. During streaming only the active (last) message's reference changes, so prior turns skip reconciliation entirely.
  - `isStreaming` must be scoped to the streaming turn only — pass `status === "streaming" && message.id === lastMessageId` rather than a single global boolean, so flipping `status` doesn't dirty every memoized row.
- **`React.memo` `WorkspaceAssistantMessagePart`** (`:365`). Stable `part` references (completed messages) then skip re-render. Keep the existing `key={`${message.id}-${index}`}`.
- **Memoize the composer.** Wrap `ChatComposer` (`:472`) in `React.memo` and wrap `handleSubmit` (`:138`) in `useCallback` (stable deps: `params.slug`, `createConversation`, `sendMessage`, `clearError`). The textarea then stops re-rendering on every token. Keep `text`/`setText` local to the composer's parent so typing doesn't re-render the message list (already the case; verify after extraction).
- **Leave already-good memoization alone:** `initialMessages` (`:79`), `transport` (`:95`), `visibleSkills` (`:123`), and `MessageResponse`/`Reasoning`/`Tool` memoization in `@repo/ui` are correct as-is.

**Interaction with React Compiler.** With the compiler on (prod/Vercel) much of this is auto-memoized, so the manual memo's clearest payoff is **dev** (compiler off) and any non-Vercel build, plus making the streaming-row boundary explicit and test-assertable. Virtualization (§2) is the structural win the compiler cannot produce. Prefer extracting a real `ChatMessage` component (stable boundary) over scattering `useMemo`; it is robust whether or not the compiler runs.

### 2. Message-list virtualization (`conversation.tsx`)

**Problem.** `ConversationContent` renders all messages; long conversations grow DOM unbounded. The current scroll model is `use-stick-to-bottom` (`conversation.tsx:9,18,36,84`).

**Approach — retire `use-stick-to-bottom`, virtualize with native end-anchoring.** Validated: react-virtual + `use-stick-to-bottom` both own `scrollTop` and conflict; virtual-core 3.16.0 already does end-anchoring. Since the component has **exactly one consumer** (`workspace-assistant-client.tsx`), change the contract cleanly rather than preserve a `children` API that cannot be virtualized.

**Component changes:**

- **`Conversation`** — replace `StickToBottom` with a plain scroll-parent `div` (owns `overflow-y-auto`, holds a `ref` used as the virtualizer's `getScrollElement`). Keep the export, `aria-label`/`role="log"`, and `className` contract.
- **`ConversationContent`** — change from a `children` slot to an items model:
  - New props: `items: T[]`, `renderItem: (item: T, index: number) => ReactNode`, `getItemKey: (item: T, index: number) => string`, optional `estimateSize`.
  - Internally: `useVirtualizer({ count, getScrollElement, estimateSize, measureElement, getItemKey, anchorTo: "end", followOnAppend: "smooth", scrollEndThreshold: <px> })`. Render the standard react-virtual structure — an inner `div` of height `getTotalSize()`, each visible row absolutely positioned with `transform: translateY(virtualItem.start)` and `ref={virtualizer.measureElement}` for dynamic height. Each row renders `renderItem(item, index)`.
  - `anchorTo`/`followOnAppend` live in `virtual-core` types but the `react-virtual@3.13.26` option type may not surface them; cast the options object if TS complains (note in plan; do not upgrade).
- **`ConversationScrollButton`** — replace `useStickToBottomContext()` with a small context the virtualized `ConversationContent` provides, exposing `isAtBottom` (from `virtualizer.isAtEnd()` / distance-from-end ≤ threshold) and `scrollToBottom` (`virtualizer.scrollToIndex(count - 1, { align: "end" })`). Keep the export, the `!isAtBottom &&` render guard, and styling.
- **`ConversationDownload`, `messagesToMarkdown`, `ConversationEmptyState`** — unchanged; no scroll coupling.
- **Dependency cleanup** — remove `use-stick-to-bottom` from `packages/ui/package.json:111` (only import is `conversation.tsx:9`).

**Consumer change (`workspace-assistant-client.tsx:202–246`).** Replace the `<ConversationContent>{messages.map(...)}</ConversationContent>` block with `items={messages}`, `getItemKey={(m) => m.id}`, and a `renderItem` that returns the memoized `ChatMessage` from §1. The `mx-auto max-w-3xl` column styling moves onto each row (or a row wrapper) since the virtualizer owns the scroll/positioning container.

**Reference implementation.** Model the `useVirtualizer` setup, `measureElement` wiring, and test approach after the existing `signals/_components/signals-list-view.tsx` and `signals-list-view.test.tsx`.

### 3. React Compiler application verification (`vendor/next/src/config.ts`)

**Problem.** `reactCompiler: !!env.VERCEL` (`:19`) — disabled locally for build speed. Decision: keep dev off, but prove the compiler is actually applied in every production/CI build (not silently skipped) and confirm non-Vercel CI paths are covered.

**Changes:**

- **Verification, not behavior change** — keep `!!env.VERCEL` for dev speed. Add a check that proves the compiler ran in a representative prod/CI build: inspect built client output for React Compiler runtime markers (e.g. `react-compiler-runtime` / `_c(` memo-cache calls) on a known component, or assert via build output that the babel plugin executed. Encode this as a small CI step or a documented one-shot verification in the plan.
- **CI coverage** — confirm whether any production/release build path runs **outside** Vercel (where `env.VERCEL` is unset and the compiler would be off). If so, gate `reactCompiler` on the broader "is this a production/CI build" condition rather than Vercel alone. If all prod builds go through Vercel, record that finding and treat this workstream as a verified no-op (don't pad it).

## Component boundaries

- **`WorkspaceAssistantClient`** — owns chat state, the empty/active branch, and composes `ChatMessage` rows + the memoized composer. Passes `items`/`renderItem` to `ConversationContent`.
- **`ChatMessage`** (new, module-level, memoized) — pure presentational per-turn render (Message + parts + copy action). Re-renders only when its `message` reference or streaming flag changes.
- **`ConversationContent`** — owns virtualization (scroll element, virtualizer, measured rows) and exposes scroll state via context. Knows nothing about chat/message semantics beyond `items`/`renderItem`/`getItemKey`.
- **`ConversationScrollButton`** — consumes scroll-state context only.
- **`MessageResponse` / `Reasoning` / `Tool` / Streamdown** — unchanged.

## Risks & mitigations

- **Virtualization streaming jitter** (moderate). High-frequency `measureElement` during fast streams can sub-pixel jitter even with `anchorTo:"end"`. Mitigation: enable rAF-batched measurement (`useAnimationFrameWithResizeObserver`) if observed; tune `scrollEndThreshold`.
- **Bad `estimateSize` lurch** (moderate). Wildly variable message heights (one-liner vs long code block) make the spacer/scroll lurch as off-screen rows measure. Mitigation: estimate toward a typical/larger message; rely on `measureElement` to correct; key by `message.id` (stable) not index.
- **react-virtual option typing** (low). `anchorTo`/`followOnAppend` may be untyped in the `3.13.26` React wrapper. Mitigation: cast options; do not upgrade react-virtual in this workstream.
- **Memo correctness** (low). A memoized `ChatMessage` that reads `status` directly would re-render on every token. Mitigation: pass a per-row `isStreaming` boolean derived from `message.id === lastMessageId`, not the global `status`.
- **Test DOM assumptions** (low–moderate). jsdom has no layout, so virtualized rows need rect mocking or only a subset renders. Mitigation: model test setup after `signals-list-view.test.tsx`; update assertions that assumed all messages are in the DOM.

## Testing

- **Keep green:** `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx` and `.../chat/page.test.tsx`. Update any assertion that depends on all messages being rendered (virtualization renders a visible subset under jsdom).
- **Memoization:** assert a completed message's render function is not re-invoked when a later streaming token arrives (e.g. spy/`renderCount`, or assert stable DOM nodes for prior turns while the last turn updates).
- **Composer:** assert the textarea does not re-render on streaming token updates (render-count or value-stability check).
- **Virtualization:** model after `signals-list-view.test.tsx` — mock element rects so rows render; assert (a) only a bounded subset mounts for a long list, (b) `ConversationScrollButton` hides when at bottom and shows after scrolling up, (c) `scrollToBottom` calls `scrollToIndex(count-1, {align:"end"})`.
- **Follow existing patterns** in `apps/app/src/__tests__` (vitest + Testing Library).
- **Manual/perf check:** with `pnpm dev`, verify in a long streaming conversation that prior turns don't re-render (React DevTools highlight) and the view stays pinned to bottom while the last message grows, and that scrolling up reveals the scroll-to-bottom button.

## Out of scope

- **PPR / Cache Components** — spike-validated no-go for 16.2.6 given app-wide flag + 44 route configs + auth-gated empty shell. If revisited later, the prerequisite is a standalone PR removing/relocating all `dynamic`/`runtime` route configs, then piloting on a non-auth route (e.g. `/api/health`, OAuth metadata) — not a workspace route.
- **Streaming-markdown / Streamdown internals** — already block-memoized; nothing to optimize without upstreaming an incremental lexer (not worth it).
- **TanStack Query / tRPC** — audited; already best-practice.
- **The ChatGPT redesign** (`2026-06-03-chat-ui-chatgpt-redesign-design.md`) — separate spec; visual/layout work unchanged here.
- **Reasoning / tool / source / file part rendering** — untouched beyond memoization wrappers.

## Verified evidence (appendix)

- `@tanstack/react-virtual@3.13.26` → `@tanstack/virtual-core@3.16.0`; `anchorTo`, `followOnAppend`, `scrollEndThreshold`, `isAtEnd`, `getVirtualDistanceFromEnd` all present in the installed core. No upgrade required.
- `use-stick-to-bottom` imported only at `packages/ui/src/components/ai-elements/conversation.tsx:9`; safe to remove from `packages/ui` on retirement.
- Sole consumer of the conversation component: `workspace-assistant-client.tsx` (verified by repo-wide grep).
- In-repo react-virtual precedent: `signals/_components/signals-list-view.tsx` (+ test).
- Streamdown 1.4.0 block memoization verified from installed source + `https://streamdown.ai/docs/memoization`.
- PPR spike: `experimental.cacheComponents: true` → Turbopack build fails with 44 route-segment-config errors (24 `dynamic`, 20 `runtime`); `experimental.ppr: "incremental"` rejected at config load ("merged into cacheComponents").

## Open questions

None. Scope, sequencing (separate workstream), the conversation API change (single consumer → items/renderItem), and the React Compiler stance (verify prod/CI, keep dev off) are all settled.
