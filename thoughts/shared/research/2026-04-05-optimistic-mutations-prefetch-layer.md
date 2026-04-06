---
date: 2026-04-05T18:00:00+08:00
researcher: claude
git_commit: 71600af1bb2293824646dc89e85d3a206442828c
branch: main
topic: "Optimistic Mutation Gaps & TanStack Query/tRPC Prefetch Layer Audit"
tags: [research, codebase, tanstack-query, trpc, optimistic-updates, mutations, prefetch]
status: complete
last_updated: 2026-04-05
---

# Research: Optimistic Mutation Gaps & TanStack Query/tRPC Prefetch Layer Audit

**Date**: 2026-04-05T18:00:00+08:00
**Git Commit**: 71600af1bb2293824646dc89e85d3a206442828c
**Branch**: main

## Research Question

Find all optimistic mutation gaps in `apps/app/`, audit the entire TanStack Query + tRPC prefetch layer, determine best practices, and decide what should be optimistic vs not.

## Summary

The app has **8 tRPC mutations** across 5 files. **Zero** use optimistic updates — all follow a pessimistic pattern of waiting for server confirmation, then calling `queryClient.invalidateQueries`. The prefetch layer is well-structured: RSC layouts call `prefetch()` → `HydrateClient` dehydrates → client components consume via `useSuspenseQuery`. The infrastructure (`@repo/app-trpc`) is correctly configured with a global `MutationCache` error handler, SuperJSON serialization, and 30s default `staleTime`.

Based on best practices from TanStack Query v5 docs and TkDodo (TanStack maintainer), **3 of 8 mutations are strong candidates for optimistic updates**, 2 are borderline, and 3 should remain pessimistic.

---

## Current State: All 8 Mutations

### Mutation Inventory

| # | Procedure | File | Optimistic? | Cache Strategy |
|---|---|---|---|---|
| 1 | `organization.create` | [team-name-form.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx#L28-L45) | No | `invalidateQueries` on `listUserOrganizations` |
| 2 | `organization.updateName` | [team-general-settings-client.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx#L71-L109) | No | `invalidateQueries` on `listUserOrganizations` (in `onSettled`) |
| 3 | `orgApiKeys.create` | [org-api-key-list.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx#L55-L67) | No | `invalidateQueries` on `orgApiKeys.list` |
| 4 | `orgApiKeys.revoke` | [org-api-key-list.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx#L69-L79) | No | `invalidateQueries` on `orgApiKeys.list` |
| 5 | `orgApiKeys.delete` | [org-api-key-list.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx#L81-L91) | No | `invalidateQueries` on `orgApiKeys.list` |
| 6 | `orgApiKeys.rotate` | [org-api-key-list.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx#L93-L104) | No | `invalidateQueries` on `orgApiKeys.list` |
| 7 | `connections.updateBackfillConfig` | [source-settings-form.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/source-settings-form.tsx#L70-L78) | No | `invalidateQueries` on `connections.resources.list` |
| 8 | `connections.resources.bulkLink` | [link-sources-button.tsx](https://github.com/lightfastai/lightfast/blob/71600af1b/apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx#L35-L42) | No | `invalidateQueries` after `Promise.allSettled` |

### Current Pattern (universal)

Every mutation follows the same flow:
1. User clicks button → button shows `isPending` state (disabled + "Saving..."/"Creating..." text or `Loader2` spinner)
2. Server processes mutation
3. `onSuccess`/`onSettled` fires → `queryClient.invalidateQueries(...)` → TanStack refetches from server
4. UI updates with server-confirmed data

**No mutation uses `onMutate`, `setQueryData`, `cancelQueries`, `getQueryData`, or any rollback pattern.**

---

## Current State: Prefetch & Query Layer

### Infrastructure (`@repo/app-trpc`)

| File | Purpose |
|---|---|
| `packages/app-trpc/src/client.ts` | `createQueryClient` factory — 30s `staleTime`, SuperJSON serialize/deserialize, dehydrates pending queries |
| `packages/app-trpc/src/react.tsx` | Client singleton `QueryClient` + `MutationCache` (global toast on error), tRPC `httpBatchStreamLink` to `/api/trpc` |
| `packages/app-trpc/src/server.tsx` | RSC `QueryClient` (per-request via `cache()`), `TRPCOptionsProxy` (direct router call, no HTTP), `HydrateClient`, `prefetch()` |
| `packages/app-trpc/src/types.ts` | Type augmentation for `meta.errorTitle` and `meta.suppressErrorToast` |
| `packages/app-trpc/src/hooks/use-active-org.ts` | `useActiveOrg` — finds org from prefetched `listUserOrganizations` by URL slug |

### Prefetch Calls (Server Components)

| Layout/Page | Queries Prefetched |
|---|---|
| `(app)/layout.tsx` | `organization.listUserOrganizations`, `account.get` |
| `(user)/layout.tsx` | `account.get` |
| `events/layout.tsx` | `events.list` × 5 (per source filter) |
| `jobs/layout.tsx` | `jobs.list` × 4 (per status filter) |
| `sources/page.tsx` | `connections.generic.listInstallations` × N providers, `connections.resources.list` |
| `sources/new/page.tsx` | `connections.generic.listInstallations` × N, `connections.resources.list` |
| `api-keys/page.tsx` | `orgApiKeys.list` |
| `account/settings/general/page.tsx` | `account.get` |

### Client Query Consumption

**`useSuspenseQuery`** — 14 call sites, all with `refetchOnMount: false` and `refetchOnWindowFocus: false`. `staleTime` varies: 5 min (account/org data), 10 sec (jobs), 10 min (profile), or default 30s (events).

**`useQuery`** — 2 call sites (lazy resource loading with `enabled` gating).

**`useQueries`** — 1 call site (merged installation resources).

### `staleTime` Landscape

| Data | staleTime | Rationale |
|---|---|---|
| `account.get` | 5 min | Rarely changes during session |
| `listUserOrganizations` | 5 min | Rarely changes during session |
| `orgApiKeys.list` | 5 min | Rarely changes during session |
| `profile-data-display` | 10 min | Static profile data |
| `jobs.list` | 10 sec | Jobs have active status changes + 5s polling interval |
| `events.list` | 30s (default) | Events stream in from webhooks |
| Everything else | 30s (default) | Global default in `createQueryClient` |

---

## Best Practices: Optimistic Update Decision Framework

### Sources

- [TanStack Query v5 Optimistic Updates Guide](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates)
- [TkDodo #12: Mastering Mutations](https://tkdodo.eu/blog/mastering-mutations-in-react-query)
- [TkDodo #29: Concurrent Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [tRPC v11 TanStack React Query Integration](https://trpc.io/blog/introducing-tanstack-react-query-client)

### Two Patterns Available

**Pattern A — "Via `variables`" (simpler, same-component only):**
Read `isPending` + `variables` from `useMutation` to render an optimistic item inline. No rollback code needed — `isError` triggers retry UI. Best for: append-to-list, single-component display.

```tsx
const { mutate, isPending, variables, isError } = useMutation(
  trpc.orgApiKeys.revoke.mutationOptions({
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
)
// Render revoked key with opacity: 0.5 while isPending
```

**Pattern B — "Via `onMutate` cache" (cross-component, rollback-safe):**
Cancel in-flight queries → snapshot → write to cache → rollback on error → invalidate on settled. Best for: data consumed by multiple components, toggles.

```tsx
useMutation(trpc.organization.updateName.mutationOptions({
  onMutate: async (input) => {
    const queryKey = trpc.organization.listUserOrganizations.queryKey()
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old) => /* merge input */)
    return { previous }
  },
  onError: (_err, _input, context) => {
    queryClient.setQueryData(queryKey, context?.previous)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey }),
}))
```

### Decision Criteria

| Criterion | Optimistic? |
|---|---|
| Client can perfectly predict server outcome | Yes |
| Instant feedback meaningfully improves UX (toggles, inline edits) | Yes |
| Only one component shows the result | Use Pattern A (`variables`) |
| Multiple components need the update | Use Pattern B (`onMutate`) |
| Mutation returns server-generated data (IDs, keys, timestamps) | **No** |
| Mutation navigates away or closes a modal on success | **No** |
| Complex server-side logic (backfill, linking across providers) | **No** |
| Meaningful failure rate or irreversible action | **No** |

### Critical: Don't Use React 19 `useOptimistic` with TanStack Query

`useOptimistic` and TanStack Query's cache model are incompatible — React Query re-renders reset `useOptimistic` state, cancelling the optimistic display. Pick one system per data flow. Since this codebase uses TanStack Query, stick with TanStack's native patterns.

### Concurrent Mutation Safety

When multiple mutations target the same cache key (e.g., rapid toggling), guard `invalidateQueries` with `isMutating`:

```tsx
onSettled: () => {
  if (queryClient.isMutating({ mutationKey: ['items'] }) === 1) {
    queryClient.invalidateQueries({ queryKey })
  }
}
```

---

## Recommendations: What Should Be Optimistic

### Should Be Optimistic (3 mutations)

#### 1. `orgApiKeys.revoke` — Pattern A (`variables`)
**Why**: Binary state change (active → revoked). Client knows the outcome. User sees immediate visual feedback (key grayed out / strikethrough). No server-generated data needed.

#### 2. `orgApiKeys.delete` — Pattern A (`variables`)
**Why**: Remove from list. Client knows the outcome. Instant removal from the list with fade-out. If it fails, item reappears with an error toast.

#### 3. `organization.updateName` — Pattern B (`onMutate` cache)
**Why**: Name change is consumed by sidebar (`app-sidebar.tsx`), header (`user-page-header.tsx`), and `useActiveOrg` — all read from `listUserOrganizations`. Optimistically updating the cache makes the name change feel instant across all components. The client perfectly predicts the outcome (the name they typed).

### Borderline — Consider Optimistic (2 mutations)

#### 4. `connections.updateBackfillConfig` — Pattern A (`variables`)
**Could be optimistic**: The form shows a "Saved" inline indicator on success. Optimistically showing "Saved" while the request is in-flight would feel snappier. However, the form already shows `isPending` → "Saving..." which is adequate. Low impact.

#### 5. `orgApiKeys.rotate` — **Probably not**
**Why not**: Returns a new server-generated key value that must be displayed to the user. The client cannot predict this value. The dialog needs the actual key from the server response.

### Should Remain Pessimistic (3 mutations)

#### 6. `organization.create`
**Why**: Creates a new entity with server-generated IDs. Triggers Clerk `setActive()`. Navigates to a new URL. All require server confirmation.

#### 7. `orgApiKeys.create`
**Why**: Returns a server-generated API key that must be shown to the user. The dialog switches to a "copy your key" view on success — this requires the actual key value.

#### 8. `connections.resources.bulkLink`
**Why**: Complex multi-provider operation via `Promise.allSettled` on parallel `mutateAsync` calls. Server does cross-provider linking logic. Partial failures are possible. The outcome depends entirely on server-side state.

---

## Prefetch Layer Assessment

### What's Working Well

- **Correct prefetch → HydrateClient flow**: Every server component follows the pattern of calling `prefetch()` before returning `<HydrateClient>`. No UNAUTHORIZED errors from racing.
- **Shared data seeded at root**: `(app)/layout.tsx` prefetches `account.get` and `listUserOrganizations`, then nested layouts inherit from cache. The settings page explicitly documents this: "relies on cache seeded by app layout".
- **Global error handling**: `MutationCache.onError` with `meta.errorTitle` and `meta.suppressErrorToast` is a clean pattern — avoids boilerplate across all mutations.
- **`staleTime` tiering**: Appropriate differentiation between frequently-changing data (events: 30s, jobs: 10s) and stable data (account: 5min, profile: 10min).

### Opportunities for Improvement

1. **`refetchOnMount: false` and `refetchOnWindowFocus: false` copied everywhere**: 14 of 14 `useSuspenseQuery` calls manually set both to `false`. This could be a global default in `createQueryClient` since it's universally applied.

2. **No `gcTime` tuning**: All queries use the default `gcTime` (5 minutes). Long-lived stable data (account, org list) could benefit from longer `gcTime` to avoid unnecessary cache eviction on deep navigation.

3. **Inconsistent `queryKey` access**: Some mutations use `trpc.proc.queryOptions().queryKey` and others use `trpc.proc.queryKey()`. Both work, but the codebase should standardize on one.

4. **Manual "load more" pagination**: `events-table.tsx` uses `queryClient.fetchQuery` + local state accumulation instead of `useInfiniteQuery` / `useSuspenseInfiniteQuery`. The infinite query pattern would give automatic cache management, deduplication, and built-in `fetchNextPage`.

5. **5s polling via `setInterval`**: `jobs-table.tsx` implements manual polling with `setInterval` + `invalidateQueries`. TanStack Query's built-in `refetchInterval` would be simpler and automatically respects component lifecycle.

---

## Code References

- `packages/app-trpc/src/client.ts` — QueryClient factory, global defaults
- `packages/app-trpc/src/react.tsx:28-47` — MutationCache global error handler
- `packages/app-trpc/src/react.tsx:78-103` — tRPC client links (httpBatchStreamLink)
- `packages/app-trpc/src/server.tsx:28-51` — HydrateClient, prefetch()
- `packages/app-trpc/src/hooks/use-active-org.ts` — useActiveOrg hook
- `apps/app/src/app/(app)/layout.tsx:11-13` — Root prefetches
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx:55-104` — 4 API key mutations
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx:71-109` — org.updateName mutation
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/source-settings-form.tsx:70-78` — backfill config mutation
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx:35-42` — bulkLink mutation
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx:28-45` — org.create mutation
- `apps/app/src/components/jobs-table.tsx:352-368` — Manual 5s polling
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx:184-195` — Manual load-more pagination

## Architecture Documentation

### Data Flow

```
Server Render
  └─ RSC layout: prefetch(trpc.X.queryOptions()) → cache() QueryClient
  └─ <HydrateClient> → HydrationBoundary(dehydrate(queryClient))

Client Hydration
  └─ TRPCReactProvider → QueryClientProvider + TRPCProvider
  └─ Browser singleton QueryClient (with MutationCache)
  └─ SuperJSON.deserialize reconstructs query data

Mutations (Client)
  └─ useMutation(trpc.X.mutationOptions({ onSuccess, meta }))
  └─ httpBatchStreamLink → POST /api/trpc
  └─ fetchRequestHandler → appRouter
  └─ onSuccess → queryClient.invalidateQueries → refetch from server
  └─ onError → MutationCache global handler → toast.error
```

### Mutation Meta Convention

```ts
// Typed via packages/app-trpc/src/types.ts
interface Register {
  mutationMeta: {
    errorTitle?: string;          // Custom toast title
    suppressErrorToast?: boolean; // Opt out of global toast
  };
}
```

## Open Questions

1. **Should `refetchOnMount: false` and `refetchOnWindowFocus: false` become global defaults?** — Every single `useSuspenseQuery` call sets both. Making them defaults in `createQueryClient` would remove ~28 lines of repetitive config. The only risk is if a future query needs auto-refetch — it could opt back in.

2. **Should events pagination migrate to `useInfiniteQuery`?** — The current manual `fetchQuery` + local state accumulation pattern works but doesn't benefit from TanStack Query's cache-level deduplication or automatic page management.

3. **Should jobs polling use `refetchInterval` instead of `setInterval`?** — The current manual implementation works but requires explicit cleanup and doesn't pause when the component is unmounted.

4. **`queryKey()` vs `queryOptions().queryKey` — which to standardize on?** — Both work but inconsistency across the codebase makes patterns harder to follow.
