# SSR-first workspace chat upgrade — design

Date: 2026-06-03
Status: Approved (design); pending implementation plan

## Problem

The workspace assistant chat is only partially server-rendered, and its error
handling is thin. Concretely:

- `chat/[conversationId]/page.tsx` `await`s `getConversation` and passes the
  result as a **prop**. It is never hydrated into the client query cache, and on
  an invalid `conversationId` the thrown `NOT_FOUND` bubbles to
  `OrgPageErrorBoundary`, which mislabels it **"Organization Not Found"**. There
  is no `error.tsx`/`not-found.tsx` anywhere in the chat route tree.
- The sidebar `ChatHistory` calls `useSuspenseQuery(listConversations)` but the
  query is **never prefetched server-side** (not in any layout or page). It
  suspends to `null`, then fetches client-side after hydration, so the chat list
  pops in.
- `createConversation` has **no `onMutate`**, so a newly created chat does not
  appear in the sidebar until something else refetches — and nothing invalidates
  the list.
- Streaming errors render as a single small `<p>` above the composer, with no
  retry affordance.

## Goals

1. Make the conversation page SSR-first: server-fetched, hydrated, read on the
   client via `useSuspenseQuery`, with a proper 404 for missing conversations.
2. Server-render the sidebar chat history on every workspace route.
3. Optimistically insert a new conversation into the sidebar the instant the
   first message is sent.
4. End-to-end chat error handling: route level (`not-found`/`error`), stream
   level (inline retry), and transport level (status-aware copy).
5. Stress test the full flow with agent-browser against local `pnpm dev` using
   Clerk test-mode auth, and fix bugs found in-loop.

## Non-goals (YAGNI / scope guard)

- No changes to the streaming route handler (`api/chat/route.ts`), the resumable
  stream plumbing, the DB schema, or the tRPC procedures themselves. This is
  purely the SSR/hydration/error/optimistic layer plus tests.
- No pagination/infinite-scroll work on the sidebar list beyond what exists.
- No redesign of message rendering or the composer UI.

## Confirmed decisions

| Decision | Choice |
| --- | --- |
| Conversation SSR strategy | Server fetch → `notFound()` on NOT_FOUND → hydrate → client `useSuspenseQuery` from cache |
| Error-handling scope | Full: route (`not-found.tsx` + `error.tsx`) + inline stream retry + transport status mapping |
| Sidebar prefetch location | `(workspace)/layout.tsx` (SSR sidebar on every workspace route) |
| Stress-test auth | Clerk test mode (`+clerk_test` / `424242`) on `https://lightfast.localhost` |

## Relevant facts (verified)

- `listConversations` output: `{ items: WorkspaceAssistantConversation[],
  nextCursor: { id: number; updatedAt: Date } | null }`. Items are full
  `WorkspaceAssistantConversation` rows (`id`, `publicId`, `title`, `updatedAt`,
  `createdAt`, `clerkOrgId`, `createdByUserId`, `status`, `activeStreamId`, …).
  Ordered by `updatedAt desc, id desc`.
  (`db/app/src/utils/workspace-assistant.ts:127`)
- `useChat` from `@ai-sdk/react@3.0.196` exposes `sendMessage`, `regenerate`,
  `stop`, `resumeStream`, `clearError`, `status`, `messages`, `error`.
- `boundOrgProcedure` resolves the org from the active Clerk session
  (`ctx.auth.identity.orgId`), so `listConversations` needs no slug argument
  server-side. (`api/app/src/router/(pending-not-allowed)/workspace-assistant.ts:113`)
- Repo optimistic pattern to mirror: `org-member-invite-actions.ts` +
  `org-member-cache.ts` (cancelQueries → setQueryData insert → rollback on error
  → replace on success → invalidate on settled).
- tRPC SSR helpers: `prefetch`, `HydrateClient`, `getQueryClient` from
  `~/trpc/server`. Client query keys via `trpc.x.y.queryKey(input)` and filters
  via `trpc.x.y.queryFilter()`.

## Architecture & components

### Component 1 — SSR sidebar (`(workspace)/layout.tsx`)

Prefetch `listConversations({ limit: 20 })` and wrap the shell subtree in
`<HydrateClient>`:

```tsx
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default function WorkspaceLayout({ actions, children }) {
  prefetch(trpc.org.workspace.assistant.listConversations.queryOptions({ limit: 20 }));
  return (
    <HydrateClient>
      <SidebarProvider …>
        <AppSidebar />
        <SidebarInset …>…</SidebarInset>
      </SidebarProvider>
    </HydrateClient>
  );
}
```

- The sidebar's `useSuspenseQuery(listConversations({ limit: 20 }))` must use the
  **same input** as the prefetch so the query keys match.
- Keep the existing `<Suspense fallback={null}>` around `ChatHistory` as a safety
  net; with hydration present it will not suspend.
- The query input passed to both the prefetch and the `useSuspenseQuery` must be
  identical (`{ limit: 20 }`); align the sidebar's existing call accordingly.

### Component 2 — Conversation page SSR (`chat/[conversationId]/page.tsx`)

```tsx
export default async function ConversationPage({ params }) {
  const { conversationId } = await params;
  const qc = getQueryClient();
  prefetch(trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 }));
  try {
    await qc.fetchQuery(
      trpc.org.workspace.assistant.getConversation.queryOptions(
        { id: conversationId },
        { staleTime: Number.POSITIVE_INFINITY },
      ),
    );
  } catch (error) {
    if (isTRPCNotFound(error)) notFound();
    throw error; // → chat/error.tsx
  }
  return (
    <HydrateClient>
      <Suspense fallback={<ChatLoading />}>
        <ConversationChat conversationId={conversationId} />
      </Suspense>
    </HydrateClient>
  );
}
```

- `isTRPCNotFound(error)`: a small helper that checks the tRPC error shape
  (`error instanceof TRPCError && error.code === "NOT_FOUND"` server-side, or the
  serialized `data.code === "NOT_FOUND"`). Server-side `fetchQuery` rethrows the
  original `TRPCError`, so checking `.code === "NOT_FOUND"` is sufficient here;
  the helper also covers the serialized shape for reuse in `error.tsx`.
- `getConversation` uses `staleTime: Infinity` so the client `useSuspenseQuery`
  trusts the hydrated cache and does not refetch (live message state is owned by
  `useChat`, not this query).

New client loader `chat/_components/conversation-chat.tsx` (named
`ConversationChat`):

```tsx
"use client";
export function ConversationChat({ conversationId }: { conversationId: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.assistant.getConversation.queryOptions(
      { id: conversationId },
      { staleTime: Number.POSITIVE_INFINITY },
    ),
  );
  return <WorkspaceAssistantClient initialConversation={data} />;
}
```

`WorkspaceAssistantClient`'s public signature (`initialConversation?`) is
unchanged; all conversation data-loading is isolated in the loader.

### Component 3 — New chat page (`chat/page.tsx`)

Structure unchanged: `prefetch(skills.list)` + `HydrateClient` + `Suspense` +
`<WorkspaceAssistantClient />` (no `initialConversation`). Extract the shared
`ChatLoading` spinner into one module (e.g. `chat/_components/chat-loading.tsx`)
used by both pages.

### Component 4 — Optimistic sidebar insert

New `chat/_components/conversation-cache.ts` (mirrors `org-member-cache.ts`):

```ts
type ConversationListData = AppRouterOutputs["org"]["workspace"]["assistant"]["listConversations"];
type ConversationItem = ConversationListData["items"][number];

export function createOptimisticConversation(input: { publicId: string; title: string }): ConversationItem;
export function insertConversation(data: ConversationListData | undefined, item: ConversationItem): ConversationListData | undefined;
export function removeConversation(data: ConversationListData | undefined, publicId: string): ConversationListData | undefined;
export function replaceConversation(data: ConversationListData | undefined, publicId: string, item: ConversationItem): ConversationListData | undefined;
```

- `createOptimisticConversation` synthesizes a full `WorkspaceAssistantConversation`
  row: real `publicId`/`title`, `status: "active"`, `activeStreamId: null`,
  placeholder numeric `id` (e.g. `Number.MAX_SAFE_INTEGER` so any ordering keeps
  it first), and `createdAt`/`updatedAt` = now. Cache mutations only prepend; no
  re-sort is required.
- `insertConversation` prepends to `data.items` (guard against duplicate
  `publicId`).

New hook `chat/_components/use-create-workspace-conversation.ts`:

```ts
export function useCreateWorkspaceConversation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.org.workspace.assistant.listConversations.queryKey({ limit: 20 });
  const listFilter = trpc.org.workspace.assistant.listConversations.queryFilter({ limit: 20 });
  return useMutation(
    trpc.org.workspace.assistant.createConversation.mutationOptions({
      meta: { errorTitle: "Failed to create conversation" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(listFilter);
        const optimistic = createOptimisticConversation({ publicId: input.publicId, title: input.title });
        queryClient.setQueryData(listKey, (old) => insertConversation(old, optimistic));
        return { publicId: input.publicId };
      },
      onError: (_e, _input, ctx) => {
        if (ctx) queryClient.setQueryData(listKey, (old) => removeConversation(old, ctx.publicId));
      },
      onSuccess: (result, _input, ctx) => {
        if (ctx) queryClient.setQueryData(listKey, (old) => replaceConversation(old, ctx.publicId, result.conversation));
      },
      onSettled: () => void queryClient.invalidateQueries(listFilter),
    }),
  );
}
```

- `createConversation` is currently called with `{ publicId, title }` where
  `title = nextText` (always present in `handleSubmit`), so `onMutate` can rely
  on both. The mutation input schema allows them as optional; the client always
  supplies them.
- `WorkspaceAssistantClient` swaps its inline `useMutation(createConversation)`
  for this hook; the existing URL-revert-on-error logic stays and now composes
  with the cache rollback.

### Component 5 — Error handling

**Route level**

- `chat/[conversationId]/not-found.tsx` (server component): in-shell empty state
  — "Conversation not found", short copy, and a "Start new chat" link to
  `/${slug}/chat` (slug read from `params`). Renders inside `SidebarInset`, so
  the sidebar/topbar remain visible.
- `chat/error.tsx` (`"use client"`, covers the chat segment and nested
  `[conversationId]` route): classifies the error via the serialized tRPC
  `data.code` — `NOT_FOUND`, `FORBIDDEN`, else unknown — and renders an Alert
  with a Retry button (`reset()`) plus a "Start new chat" link. Mirrors the
  classification approach already used in `OrgPageErrorBoundary`.

**Stream level (inside `WorkspaceAssistantClient`)**

- Replace the small `<p>` error with a dedicated inline error surface rendered
  after the last turn (and within the empty state's composer area): an Alert
  showing the (mapped) message plus:
  - **Retry** → `regenerate()` (re-runs the last user turn). Disabled while
    `status` is `submitted`/`streaming`.
  - **Dismiss** → `clearError()`.
- The existing `creationError` path (createConversation failure) reuses the same
  surface; its Retry re-submits the pending text.

**Transport level**

- `/api/chat` returns JSON `{ error }` with statuses 400/401/403/404/409/500.
  Map these to friendly copy via a small `describeChatError(error)` helper used
  by the inline surface (e.g. 401 → "Your session expired — refresh to continue.",
  403 → "You don't have access to this workspace.", 409 → "Another response is
  already in progress."). Unknown/empty → "Something went wrong generating a
  response."
- Intentional aborts (`stop()`) must **not** show an error bubble (status returns
  to `ready`).
- Empty/failed generations surface through `useChat`'s `error` (the route's
  `onError` returns the message) → the retry path applies.

### Component 6 — Stress test (agent-browser)

Run `pnpm dev`, then with agent-browser against `https://lightfast.localhost`:

1. Sign in with a `+clerk_test` email and code `424242`; land in a seeded org.
2. New chat: send first message → assert the conversation appears in the sidebar
   immediately (optimistic), URL updates to `/<org>/chat/<id>`, response streams.
3. Reload mid-stream → assert resume (or graceful settle) and no duplicate turns.
4. Navigate to an invalid `/<org>/chat/conv_doesnotexist` → assert the
   `not-found.tsx` UI (not "Organization Not Found").
5. Rapid double-submit, empty submit, and a very long message → assert no
   bricking, composer re-enables, no orphaned optimistic rows.
6. Force a transport failure (e.g. offline) → assert the inline error + Retry.

Log every bug with repro; fix in-loop and re-test.

## Data flow (conversation load, SSR-first)

```
Request /<org>/chat/<id>
  → (workspace)/layout: prefetch(listConversations) ; HydrateClient wraps shell
  → page: prefetch(skills) ; await fetchQuery(getConversation{id})
        ├─ NOT_FOUND → notFound() → chat/[conversationId]/not-found.tsx
        └─ other error → throw → chat/error.tsx
  → HydrateClient(page) → Suspense → ConversationChat
        → useSuspenseQuery(getConversation{id})  [hydrated, no refetch]
        → WorkspaceAssistantClient(initialConversation)
              → useChat(initialMessages from initialConversation)
Sidebar: useSuspenseQuery(listConversations)  [hydrated from layout]
```

## File-change inventory

| File | Change |
| --- | --- |
| `(workspace)/layout.tsx` | prefetch `listConversations` + wrap in `HydrateClient` |
| `chat/page.tsx` | use shared `ChatLoading`; structure otherwise unchanged |
| `chat/[conversationId]/page.tsx` | server fetch → `notFound()`/throw → hydrate + Suspense + `ConversationChat` |
| `chat/[conversationId]/not-found.tsx` | new — conversation-not-found UI |
| `chat/error.tsx` | new — classified chat error boundary |
| `chat/_components/chat-loading.tsx` | new — shared spinner |
| `chat/_components/conversation-chat.tsx` | new — `useSuspenseQuery` loader |
| `chat/_components/conversation-cache.ts` | new — optimistic cache utils |
| `chat/_components/use-create-workspace-conversation.ts` | new — optimistic mutation hook |
| `_components/workspace-assistant-client.tsx` | use the hook; inline error surface w/ retry; status-aware copy |
| `app-sidebar.tsx` | align `listConversations` input with prefetch (`{ limit: 20 }`) |

> Note: the chat route's `_components` directory is created under
> `chat/` (sibling to `page.tsx`). The existing shared client lives at the
> `(workspace)/_components/` level; new chat-only modules live under `chat/_components/`
> to keep the chat feature self-contained. Final placement is confirmed during planning.

## Testing & verification

- `pnpm typecheck` and `pnpm check` (or `pnpm --filter @api/app build` for tRPC
  type errors) pass.
- `pnpm build:app` succeeds.
- agent-browser stress scenarios above pass; bugs fixed in-loop.

## Risks / edge cases

- **Query-key mismatch**: prefetch input must exactly equal the
  `useSuspenseQuery` input or hydration misses and the sidebar refetches. Both
  use `{ limit: 20 }`.
- **Optimistic id collision/ordering**: synthetic `id` must not collide with the
  cursor logic; since we only prepend in-cache and invalidate on settle, the
  next real fetch corrects ordering.
- **`error.tsx` vs `notFound()`**: NOT_FOUND is handled server-side via
  `notFound()`; `error.tsx` is the fallback for other failures. Confirm a missing
  conversation renders `not-found.tsx`, not `error.tsx`.
- **Session/org propagation**: `listConversations` is session-org scoped; on a
  brief slug/session mismatch the list reflects the session org (matches current
  behavior; org access is already gated by `[slug]/layout`).
```
