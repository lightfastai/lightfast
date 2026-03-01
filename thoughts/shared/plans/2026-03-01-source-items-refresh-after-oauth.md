# Source Items Refresh After OAuth Implementation Plan

## Overview

After connecting or adjusting OAuth integrations (GitHub, Vercel, Linear) in the `/new` workspace page, resource lists (repositories, projects, teams) don't refresh because the resource queries are independent TanStack Query cache entries that aren't invalidated when `refetchConnection()` runs. This plan adds `queryClient.invalidateQueries()` calls for resource queries alongside the existing `refetchConnection()` after popup close, and adds a missing Linear connected page.

## Current State Analysis

All four source items (GitHub, Vercel, Sentry, Linear) share an identical popup OAuth flow:
1. Open popup → poll `popup.closed` at 500ms → call `refetchConnection()` on close
2. `refetchConnection()` only re-fetches the **connection list** query (e.g., `github.list`)
3. **Resource queries** (`github.repositories`, `vercel.listProjects`, `linear.listTeams`) are separate TanStack Query entries with their own keys — they are never invalidated

### Key Discoveries:
- `github-source-item.tsx:174` — `void refetchConnection()` after popup close (also at line 141 for adjust permissions)
- `vercel-source-item.tsx:155` — `void refetchConnection()` after popup close
- `linear-source-item.tsx:123` — `void refetchConnection()` after popup close
- `sentry-source-item.tsx:87` — `void refetchConnection()` after popup close (no resource query, no fix needed)
- tRPC query key structure: `[["connections", "github", "repositories"], { input: {...}, type: "query" }]`
- TanStack Query's `invalidateQueries` supports prefix matching — `[["connections", "github", "repositories"]]` matches all cached entries for that procedure regardless of input
- Connected pages exist for GitHub, Vercel, Sentry — but NOT Linear

### Broken scenarios:
- Reconnect with same account: query key unchanged, stale cache served
- GitHub "Adjust Permissions" to add repos: query key unchanged, stale cache served
- Vercel/Linear reconnect: same issue

### Working scenario:
- First-time connect: resource query fires when `enabled` transitions false→true (no cache to be stale)

## Desired End State

After popup close, both the connection list AND resource list queries are invalidated. If the resource query is mounted and enabled, it immediately refetches fresh data. If not yet enabled (first connect), invalidation is a no-op and the query fetches fresh when enabled becomes true.

Additionally, a Linear connected page exists at `/provider/linear/connected` matching the GitHub/Vercel/Sentry pattern.

### Verification:
- After reconnecting GitHub (same account), the repositories list refreshes with current data
- After adjusting GitHub App permissions to add repos, the repositories list shows newly added repos
- After reconnecting Vercel, the projects list refreshes
- After reconnecting Linear, the teams list refreshes
- The Linear connected page shows a success message and auto-closes

## What We're NOT Doing

- No shared `useOAuthPopup` hook extraction (would reduce duplication but is a separate refactor)
- No `postMessage` listener integration in source items (the connected pages already post messages but source items don't listen — separate improvement)
- No changes to Sentry source item (it has no resource query)
- No changes to the settings page `sources-list.tsx` (different page, different flow)
- No changes to query `staleTime` or `refetchOnMount` config

## Implementation Approach

Add one line of `queryClient.invalidateQueries()` after each `void refetchConnection()` call in the three source items that have resource queries. Use a partial tRPC query key (procedure path only, no input) to match all cached entries regardless of installation/integration ID.

## Phase 1: Invalidate Resource Queries After Popup Close

### Overview
Add `invalidateQueries` calls for resource queries in GitHub, Vercel, and Linear source items after the popup-close handler fires `refetchConnection()`.

### Changes Required:

#### 1. GitHub Source Item — `handleConnect` and `handleAdjustPermissions`
**File**: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`
**Changes**: Add `invalidateQueries` after `refetchConnection()` in both handlers

In `handleAdjustPermissions` (line 141), change:
```ts
          void refetchConnection();
```
to:
```ts
          void refetchConnection();
          void queryClient.invalidateQueries({
            queryKey: [["connections", "github", "repositories"]],
          });
```

In `handleConnect` (line 174), change:
```ts
          void refetchConnection();
```
to:
```ts
          void refetchConnection();
          void queryClient.invalidateQueries({
            queryKey: [["connections", "github", "repositories"]],
          });
```

#### 2. Vercel Source Item — `handleConnect`
**File**: `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx`
**Changes**: Add `invalidateQueries` after `refetchConnection()` in `handleConnect`

At line 155, change:
```ts
          void refetchConnection();
```
to:
```ts
          void refetchConnection();
          void queryClient.invalidateQueries({
            queryKey: [["connections", "vercel", "listProjects"]],
          });
```

#### 3. Linear Source Item — `handleConnect`
**File**: `apps/console/src/app/(app)/(user)/new/_components/linear-source-item.tsx`
**Changes**: Add `invalidateQueries` after `refetchConnection()` in `handleConnect`

At line 123, change:
```ts
          void refetchConnection();
```
to:
```ts
          void refetchConnection();
          void queryClient.invalidateQueries({
            queryKey: [["connections", "linear", "listTeams"]],
          });
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] After reconnecting GitHub with the same account, the repositories list refreshes
- [ ] After adjusting GitHub App permissions to add repos, new repos appear in the picker
- [ ] After reconnecting Vercel with the same account, the projects list refreshes
- [ ] After reconnecting Linear with the same account, the teams list refreshes
- [ ] First-time connect still works correctly (resource query fires on `enabled` transition)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add Linear Connected Page

### Overview
Create the Linear OAuth success page at `/provider/linear/connected`, matching the existing GitHub/Sentry/Vercel pattern. This page displays in the popup after successful OAuth, posts a `linear_connected` message to the parent window, and auto-closes after 2 seconds.

### Changes Required:

#### 1. Linear Connected Page
**File**: `apps/console/src/app/(providers)/provider/linear/connected/page.tsx` (new file)
**Changes**: Create page matching the Sentry connected page pattern (most concise of the three existing pages)

```tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Linear OAuth Success Page
 *
 * Displayed in popup window after successful Linear OAuth authorization.
 * Shows confirmation message and instructs user to close the window.
 *
 * The parent window detects popup close and refetches integration data.
 */
export default function LinearConnectedPage() {
	useEffect(() => {
		const opener = window.opener as Window | null;
		if (opener) {
			try {
				opener.postMessage({ type: "linear_connected" }, window.location.origin);
			} catch {
				// Guard against SecurityError under strict COOP/COEP
			}
		}

		const timer = setTimeout(() => {
			window.close();
		}, 2000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="text-center space-y-6 p-8">
				<div className="flex justify-center">
					<div className="rounded-full bg-green-500/10 p-4">
						<CheckCircle2 className="h-16 w-16 text-green-500" />
					</div>
				</div>
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">
						Linear Connected!
					</h1>
					<p className="text-muted-foreground">
						Your Linear account has been successfully connected.
					</p>
				</div>
				<div className="space-y-2">
					<p className="text-sm text-muted-foreground">
						This window will close automatically...
					</p>
					<button
						onClick={() => window.close()}
						className="text-sm text-primary hover:underline"
					>
						Or click here to close now
					</button>
				</div>
			</div>
		</div>
	);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] After Linear OAuth completes, the popup shows "Linear Connected!" message
- [ ] The popup auto-closes after 2 seconds
- [ ] The "Or click here to close now" button works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `/new` workspace creation page
2. For each provider (GitHub, Vercel, Linear):
   a. If already connected, disconnect first (via settings page)
   b. Click "Connect" — verify first-time connect works (resource picker loads)
   c. Click "Reconnect" or adjust permissions — verify list refreshes with current data
3. For GitHub specifically: adjust permissions to add/remove a repo — verify the picker updates

## References

- Research document: `thoughts/shared/research/2026-03-01-source-items-refresh-mechanism.md`
- GitHub source item: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:141,174`
- Vercel source item: `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx:155`
- Linear source item: `apps/console/src/app/(app)/(user)/new/_components/linear-source-item.tsx:123`
- Existing connected pages: `apps/console/src/app/(providers)/provider/{github,sentry,vercel}/connected/page.tsx`
- Existing `invalidateQueries` pattern: `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx:120-122`
