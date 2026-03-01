---
date: 2026-03-01T09:02:26Z
researcher: claude
git_commit: 0bfdf649ddf174c9bf6b598036409df2c9984257
branch: feat/connections-provider-account-info
repository: lightfast
topic: "Source items refresh mechanism after OAuth connection/adjustment"
tags: [research, codebase, connections, github-source-item, vercel-source-item, sentry-source-item, oauth, refresh]
status: complete
last_updated: 2026-03-01
last_updated_by: claude
---

# Research: Source Items Refresh Mechanism After OAuth Connection/Adjustment

**Date**: 2026-03-01T09:02:26Z
**Researcher**: claude
**Git Commit**: 0bfdf649ddf174c9bf6b598036409df2c9984257
**Branch**: feat/connections-provider-account-info
**Repository**: lightfast

## Research Question

After connecting or adjusting GitHub/Vercel/Sentry in the `/new` workspace page, the list doesn't refresh to show new items. How does the current refresh mechanism work across all source item components?

## Summary

All three source items (GitHub, Vercel, Sentry) share an identical popup-based OAuth flow with a 500ms `setInterval` that polls `popup.closed`. When the popup closes, each component calls its own `refetchConnection()` to re-fetch the **connection list** query. However, the **resource list** queries (repositories for GitHub, projects for Vercel) are separate queries with independent cache entries. These resource queries are NOT invalidated when `refetchConnection()` runs. Additionally, all queries are configured with `refetchOnMount: false` and `refetchOnWindowFocus: false`, preventing automatic re-fetches.

## Detailed Findings

### 1. Server Prefetch Layer

`apps/console/src/app/(app)/(user)/new/page.tsx:59-61` — Three connection queries are prefetched on the server:

```
prefetch(orgTrpc.connections.github.list.queryOptions())   // line 59
prefetch(orgTrpc.connections.vercel.list.queryOptions())   // line 60
prefetch(orgTrpc.connections.sentry.get.queryOptions())    // line 61
```

These populate the TanStack Query cache inside `<HydrateClient>` (line 72), so client components read from cache without a client-side fetch waterfall.

### 2. Query Configuration Across All Source Items

Every connection status query uses the same configuration pattern:

| Component | Query | Line | Config |
|---|---|---|---|
| `github-source-item.tsx` | `trpc.connections.github.list` | 53-57 | `refetchOnMount: false`, `refetchOnWindowFocus: false` |
| `vercel-source-item.tsx` | `trpc.connections.vercel.list` | 64-68 | `refetchOnMount: false`, `refetchOnWindowFocus: false` |
| `sentry-source-item.tsx` | `trpc.connections.sentry.get` | 42-46 | `refetchOnMount: false`, `refetchOnWindowFocus: false` |

The resource-level queries also disable automatic refetching:

| Component | Query | Line | Config |
|---|---|---|---|
| `github-source-item.tsx` | `trpc.connections.github.repositories` | 103-111 | `refetchOnMount: false`, `refetchOnWindowFocus: false`, `enabled: Boolean(gwInstallationId && selectedInstallation)` |
| `vercel-source-item.tsx` | `trpc.connections.vercel.listProjects` | 113-121 | `refetchOnMount: false`, `refetchOnWindowFocus: false`, `retry: false`, `enabled: Boolean(vercelInstallationId)` |

### 3. OAuth Popup Flow (Identical Pattern in All Three)

Each source item component follows this flow:

1. **Get authorize URL**: `queryClient.fetchQuery(trpc.connections.getAuthorizeUrl.queryOptions({ provider }))` — proxies to `GET ${connectionsUrl}/services/connections/{provider}/authorize` (`api/console/src/router/org/connections.ts:59-84`)
2. **Open popup**: `window.open(data.url, ...)` with 600x800 dimensions
3. **Start poll timer**: `setInterval` at 500ms stored in `pollTimerRef`
4. **On popup close**: Clear interval, call `refetchConnection()`

The exact implementation for each:

- **GitHub `handleConnect`**: `github-source-item.tsx:149-180`
- **GitHub `handleAdjustPermissions`**: `github-source-item.tsx:120-147` (opens `https://github.com/apps/{slug}/installations/select_target?state={state}` instead)
- **Vercel `handleConnect`**: `vercel-source-item.tsx:130-161`
- **Sentry `handleConnect`**: `sentry-source-item.tsx:62-93`

### 4. What `refetchConnection()` Does

`refetchConnection` is the `refetch` function from `useSuspenseQuery`. When called:

- **GitHub**: Re-fetches `trpc.connections.github.list` — which queries `gwInstallations` for active GitHub rows, then makes live GitHub API calls (`GET /app/installations/{id}`) for each row (`connections.ts:210-255`)
- **Vercel**: Re-fetches `trpc.connections.vercel.list` — which queries `gwInstallations` for active Vercel rows, decrypts tokens, then makes live Vercel API calls for account info (`connections.ts:598-664`)
- **Sentry**: Re-fetches `trpc.connections.sentry.get` — which queries `gwInstallations` for one active Sentry row (`connections.ts:807-833`)

### 5. Effect Chains After `refetchConnection`

**GitHub** (`github-source-item.tsx`):
1. `connection` updates → `connectionInstallations` re-derived (line 59)
2. Effect at lines 69-76: compares installation IDs, calls `setInstallations()` if changed
3. Effect at lines 79-93: auto-selects first installation if current selection is stale
4. Effect at lines 64-66: syncs `gwInstallationId` from selected installation
5. Repositories query (`lines 103-111`): fires if `enabled` condition becomes true (both `gwInstallationId` and `selectedInstallation` non-null)

**Vercel** (`vercel-source-item.tsx`):
1. `listData` updates → `connectionInstallations` re-derived (line 70)
2. Effect at lines 74-81: compares installation IDs, calls `setVercelInstallations()` if changed
3. Effect at lines 84-98: auto-selects first installation if current selection is stale
4. Effect at lines 101-103: syncs `vercelInstallationId` from selected installation
5. Projects query (`lines 113-121`): fires if `enabled` condition becomes true (`vercelInstallationId` non-null)

**Sentry** (`sentry-source-item.tsx`):
1. `sentryConnection` updates (line 42)
2. Effect at lines 51-53: syncs `sentryInstallationId` from connection
3. No resource picker — flow ends here

### 6. When Resource Queries Do and Do Not Re-fire

The resource queries (`github.repositories`, `vercel.listProjects`) use `useQuery` (not `useSuspenseQuery`). They will fire when:
- Their `enabled` condition transitions from `false` → `true` (first connection)
- Their query key changes (different installation selected)

They will NOT re-fire when:
- The popup closes and `refetchConnection()` runs (different query key)
- The same installation is selected but has new repos/projects (query key unchanged, cache serves stale data)
- The user adjusts GitHub App permissions to add more repos (query key unchanged)

### 7. tRPC Server-Side Cache Configuration

No tRPC-level cache directives (`staleTime`, `cacheTime`) are set on any procedure in the connections router (`api/console/src/router/org/connections.ts`). All caching behavior is determined by TanStack Query defaults on the client.

### 8. Additional Flow: GitHub "Adjust Permissions"

`github-source-item.tsx:120-147` — `handleAdjustPermissions` opens the GitHub App installation settings page (not the standard OAuth flow). After the popup closes, it calls `refetchConnection()` which refetches the installation list. The repository list is a separate cached query that is not invalidated by this call.

### 9. Vercel Error Recovery

`vercel-source-item.tsx:273-281` — When `projectsError` is truthy, the UI shows a "Reconnect Vercel" button that calls `handleConnect`. On the server side, if the Vercel API returns 401, `vercel.listProjects` updates the `gwInstallations` row to `status = "error"` (`connections.ts:721-731`).

## Code References

- `apps/console/src/app/(app)/(user)/new/page.tsx:59-61` — Server prefetch of all three connection queries
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:53-57` — GitHub connection query with refetch disabled
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:103-111` — GitHub repositories query
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:120-147` — handleAdjustPermissions popup flow
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:149-180` — handleConnect popup flow
- `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx:64-68` — Vercel connection query with refetch disabled
- `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx:113-121` — Vercel projects query
- `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx:130-161` — handleConnect popup flow
- `apps/console/src/app/(app)/(user)/new/_components/sentry-source-item.tsx:42-46` — Sentry connection query with refetch disabled
- `apps/console/src/app/(app)/(user)/new/_components/sentry-source-item.tsx:62-93` — handleConnect popup flow
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx:51` — WorkspaceFormProvider with all state
- `apps/console/src/app/(app)/(user)/new/_components/sources-section.tsx:16-19` — Accordion rendering all three items
- `api/console/src/router/org/connections.ts:59-84` — getAuthorizeUrl procedure
- `api/console/src/router/org/connections.ts:210-255` — github.list procedure (live API calls)
- `api/console/src/router/org/connections.ts:357-429` — github.repositories procedure
- `api/console/src/router/org/connections.ts:598-664` — vercel.list procedure (live API calls)
- `api/console/src/router/org/connections.ts:672-769` — vercel.listProjects procedure

## Architecture Documentation

### Current Refresh Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ page.tsx (RSC)                                               │
│   prefetch(github.list) ─┐                                   │
│   prefetch(vercel.list) ─┤─→ HydrateClient → TanStack Cache │
│   prefetch(sentry.get) ──┘                                   │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Source Items (client)                                         │
│                                                              │
│  useSuspenseQuery(list/get)  ←── reads from hydrated cache   │
│       refetchOnMount: false                                  │
│       refetchOnWindowFocus: false                            │
│                                                              │
│  handleConnect/handleAdjustPermissions:                       │
│    1. getAuthorizeUrl → open popup                           │
│    2. setInterval(500ms) → poll popup.closed                 │
│    3. popup closes → refetchConnection() ← refetches LIST   │
│                                                              │
│  useQuery(repositories/listProjects)  ←── independent cache  │
│       refetchOnMount: false                                  │
│       refetchOnWindowFocus: false                            │
│       enabled: Boolean(installationId)                       │
│       NOT invalidated by refetchConnection()                 │
└──────────────────────────────────────────────────────────────┘
```

### Query Key Independence

The connection list and resource list are entirely separate TanStack Query entries:
- Connection list key: `["connections", "github", "list"]` (or vercel/sentry equivalent)
- Resource list key: `["connections", "github", "repositories", { integrationId, installationId }]`

Calling `refetch()` on one does not affect the other's cache.

## Open Questions

1. What is the exact timing between the OAuth callback completing (writing to `gwInstallations`) and the popup window closing? If the popup closes before the callback writes to the DB, `refetchConnection()` would return stale data.
2. Does the connections service (`lightfast-connections`) auto-close the popup after the callback, or does the user close it manually?
