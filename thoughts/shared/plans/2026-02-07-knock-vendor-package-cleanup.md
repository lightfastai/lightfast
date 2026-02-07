# Knock Vendor Package Cleanup — Implementation Plan

## Overview

Fix the vendor package contract violation in `@vendor/knock` by extracting Lightfast-specific business logic into the application layer (`apps/console`), parameterizing hardcoded values, and deduplicating utility code in the notification workflows. After this plan, `@vendor/knock` will be a pure Knock SDK wrapper with zero `@repo/*` dependencies — matching every other vendor package in the repo.

## Current State Analysis

`@vendor/knock` is the **only** vendor package in the repo that depends on `@repo/console-types`. This breaks the vendor package contract ("standalone re-exports of third-party SDKs"). The violation originates in `preferences.tsx`, which imports `NotificationCategoryKey` from `@repo/console-types` and embeds Lightfast-specific category definitions, labels, descriptions, and business rules.

### Key Discoveries:
- `vendor/knock/src/components/preferences.tsx` mixes two concerns: generic Knock SDK wrapping (lines 1-35, 85-205) and Lightfast category logic (lines 37-83, 208-281)
- `vendor/knock/src/components/provider.tsx:12` hardcodes `knockFeedChannelId = "lightfast-console-notifications"` — application-specific constant in a vendor package
- `daily-digest.ts:192-201` and `weekly-summary.ts:220-229` contain identical `groupBy` helper functions
- Both digest files construct `Recipient`-shaped objects inline without importing the `Recipient` interface from `recipient-filter.ts`
- There is only **one consumer** of the preferences exports: `apps/console/src/app/.../notification-preferences.tsx`
- `apps/console/src/hooks/` already exists (contains `use-org-access.ts`)
- `ChannelPreference` is exported from vendor but **never imported** by any consumer

## Desired End State

After this plan:

1. `@vendor/knock` has **zero** `@repo/console-*` dependencies
2. `@vendor/knock/components/preferences` exports a generic `useKnockPreferences()` hook with no Lightfast domain knowledge
3. Lightfast category composition lives in `apps/console/src/hooks/use-notification-preferences.ts`
4. `NotificationsProvider` accepts `feedChannelId` as a prop instead of hardcoding it
5. `groupBy` and recipient construction are shared across digest workflows

### Verification:
```bash
# No @repo/console-* deps in any vendor package
grep -r "@repo/console" vendor/*/package.json  # Should return nothing

# Build passes
pnpm build:console

# Type checking passes
pnpm typecheck

# Lint passes
pnpm lint
```

## What We're NOT Doing

- Not changing the preferences UI component (`notification-preferences.tsx`) behavior — only updating its import paths
- Not changing the Knock SDK types mirror (lines 12-30 of preferences.tsx) — they're correctly placed in vendor
- Not promoting `Recipient` or `ClassifierInput` to shared packages — they're correctly scoped
- Not removing the `notification.dispatch` Inngest event schema (documented as intentional future hook)
- Not changing notification routing logic, rubric, or classifier behavior

## Implementation Approach

Work bottom-up: extract the new app-layer hook first, then slim down the vendor package, then clean up the digest helpers. Each phase is independently deployable.

---

## Phase 1: Extract Lightfast Category Logic to App Layer

### Overview
Create `apps/console/src/hooks/use-notification-preferences.ts` that composes the generic vendor hook with Lightfast-specific category definitions. Update the preferences UI to import from the new hook.

### Changes Required:

#### 1. Create new vendor hook — slim `useKnockPreferences`
**File**: `vendor/knock/src/components/preferences.tsx`
**Changes**: Remove all Lightfast-specific code. Keep generic Knock SDK types and a generic `useKnockPreferences()` hook.

The file should contain only:
- Generic Knock SDK type mirrors (current lines 12-30)
- `ChannelPreference` interface (current lines 32-35)
- `PreferenceSet` export (currently internal — promote to export)
- `getChannelTypesFromSetting` helper (current lines 86-100)
- `WorkflowPreferenceSetting` and `WorkflowPreferences` type exports (currently internal — promote to export)
- Generic `useKnockPreferences()` hook returning `{ preferences, loading, updating, knockClient, getChannelEnabled, updateChannelPreference, updateCategoryPreference: genericUpdateCategory }`

**Remove** from this file:
- `import type { NotificationCategoryKey } from "@repo/console-types"` (line 5)
- `CategoryPreference` interface (lines 37-47)
- `CATEGORY_DEFINITIONS` constant (lines 49-83)
- `UseNotificationPreferencesResult` interface (lines 102-118)
- `getCategoryPreferences` function (lines 208-229)
- Lightfast-specific `updateCategoryPreference` (lines 232-281) — replaced by a generic version

New file contents:

```typescript
"use client";

import { useKnockClient } from "@knocklabs/react";
import { useState, useEffect } from "react";

/**
 * Local type definitions matching @knocklabs/client's preference interfaces.
 * We define them here because @knocklabs/react doesn't re-export them
 * and we don't want to add @knocklabs/client as a direct dependency.
 */
export type ChannelTypePreferences = Partial<
	Record<string, boolean | { conditions: unknown[] }>
>;

export type WorkflowPreferenceSetting =
	| boolean
	| { channel_types: ChannelTypePreferences }
	| { conditions: unknown[] };

export type WorkflowPreferences = Partial<
	Record<string, WorkflowPreferenceSetting>
>;

export interface PreferenceSet {
	id: string;
	categories: WorkflowPreferences | null;
	workflows: WorkflowPreferences | null;
	channel_types: ChannelTypePreferences | null;
}

export interface ChannelPreference {
	channelType: string;
	enabled: boolean;
}

/** Extract channel_types booleans from a WorkflowPreferenceSetting */
export function getChannelTypesFromSetting(
	setting: WorkflowPreferenceSetting | undefined,
): Record<string, boolean> {
	if (!setting || typeof setting === "boolean") return {};
	if ("channel_types" in setting) {
		const result: Record<string, boolean> = {};
		for (const [key, value] of Object.entries(setting.channel_types)) {
			if (typeof value === "boolean") {
				result[key] = value;
			}
		}
		return result;
	}
	return {};
}

export interface UseKnockPreferencesResult {
	preferences: PreferenceSet | null;
	loading: boolean;
	updating: boolean;
	knockClient: ReturnType<typeof useKnockClient>;
	getChannelEnabled: (channelType: string) => boolean;
	updateChannelPreference: (
		channelType: string,
		enabled: boolean,
	) => Promise<void>;
	updateCategoryPreference: (
		categoryKey: string,
		channelType: string,
		enabled: boolean,
	) => Promise<void>;
}

/**
 * Generic hook for managing Knock notification preferences.
 * No Lightfast domain knowledge — pure Knock SDK wrapper.
 */
export function useKnockPreferences(): UseKnockPreferencesResult {
	const knockClient = useKnockClient();
	const [preferences, setPreferences] = useState<PreferenceSet | null>(null);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);

	useEffect(() => {
		async function fetchPreferences() {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (!knockClient) {
				setLoading(false);
				return;
			}

			try {
				const prefs = await knockClient.preferences.get();
				setPreferences(prefs as PreferenceSet);
			} catch (error) {
				console.error("Failed to fetch notification preferences:", error);
			} finally {
				setLoading(false);
			}
		}

		void fetchPreferences();
	}, [knockClient]);

	const getChannelEnabled = (channelType: string): boolean => {
		if (!preferences?.channel_types) return true;
		const channelPref = preferences.channel_types[channelType];
		if (typeof channelPref === "boolean") return channelPref;
		return true;
	};

	const updateChannelPreference = async (
		channelType: string,
		enabled: boolean,
	) => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!knockClient) {
			console.error("Knock client not available");
			return;
		}

		setUpdating(true);
		try {
			const updatedChannelTypes = {
				...(preferences?.channel_types ?? {}),
				[channelType]: enabled,
			};

			await knockClient.preferences.set({
				channel_types: updatedChannelTypes,
				workflows: (preferences?.workflows ?? {}) as Record<string, boolean>,
				categories: (preferences?.categories ?? {}) as Record<string, boolean>,
			});

			const updatedPrefs = await knockClient.preferences.get();
			setPreferences(updatedPrefs as PreferenceSet);
		} catch (error) {
			console.error("Failed to update notification preference:", error);
			throw error;
		} finally {
			setUpdating(false);
		}
	};

	const updateCategoryPreference = async (
		categoryKey: string,
		channelType: string,
		enabled: boolean,
	) => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!knockClient) {
			console.error("Knock client not available");
			return;
		}

		setUpdating(true);
		try {
			const currentCategories: WorkflowPreferences =
				preferences?.categories ?? {};
			const currentSetting = currentCategories[categoryKey];
			const currentChannelTypes = getChannelTypesFromSetting(currentSetting);

			const updatedCategories: WorkflowPreferences = {
				...currentCategories,
				[categoryKey]: {
					channel_types: {
						...currentChannelTypes,
						[channelType]: enabled,
					},
				},
			};

			await knockClient.preferences.set({
				channel_types: preferences?.channel_types ?? {},
				workflows: (preferences?.workflows ?? {}) as Record<string, boolean>,
				categories: updatedCategories as Record<string, boolean>,
			});

			const updatedPrefs = await knockClient.preferences.get();
			setPreferences(updatedPrefs as PreferenceSet);
		} catch (error) {
			console.error("Failed to update category preference:", error);
			throw error;
		} finally {
			setUpdating(false);
		}
	};

	return {
		preferences,
		loading,
		updating,
		knockClient,
		getChannelEnabled,
		updateChannelPreference,
		updateCategoryPreference,
	};
}
```

Key differences from current:
- Hook renamed from `useNotificationPreferences` to `useKnockPreferences`
- `updateCategoryPreference` takes `categoryKey: string` instead of `NotificationCategoryKey`
- No `getCategoryPreferences()` — that's Lightfast category logic
- `PreferenceSet`, `WorkflowPreferences`, `WorkflowPreferenceSetting`, `ChannelTypePreferences`, `getChannelTypesFromSetting` promoted to exports (needed by app-layer hook)
- `CategoryPreference`, `CATEGORY_DEFINITIONS`, `UseNotificationPreferencesResult` removed entirely

#### 2. Create app-layer notification preferences hook
**File**: `apps/console/src/hooks/use-notification-preferences.ts` (new file)
**Changes**: Composes generic vendor hook with Lightfast category definitions.

```typescript
"use client";

import { useCallback } from "react";
import type { NotificationCategoryKey } from "@repo/console-types";
import {
	useKnockPreferences,
	getChannelTypesFromSetting,
} from "@vendor/knock/components/preferences";
import type { WorkflowPreferences } from "@vendor/knock/components/preferences";

export interface CategoryPreference {
	categoryKey: NotificationCategoryKey;
	label: string;
	description: string;
	channels: {
		in_app_feed: boolean;
		email: boolean;
	};
	supportsInApp: boolean;
}

/** Static category definitions matching Knock workflow categories */
const CATEGORY_DEFINITIONS: readonly {
	categoryKey: NotificationCategoryKey;
	label: string;
	description: string;
	supportsInApp: boolean;
}[] = [
	{
		categoryKey: "critical-alerts",
		label: "Critical Alerts",
		description:
			"Deployment failures, security vulnerabilities, production incidents",
		supportsInApp: true,
	},
	{
		categoryKey: "workflow-updates",
		label: "Workflow Updates",
		description: "PR reviews, releases, issue assignments, deploy status",
		supportsInApp: true,
	},
	{
		categoryKey: "daily-digests",
		label: "Daily Digest",
		description:
			"Summary of yesterday's activity across all integrations",
		supportsInApp: false,
	},
	{
		categoryKey: "weekly-summaries",
		label: "Weekly Summary",
		description:
			"Velocity trends, pattern reports, and cross-tool insights",
		supportsInApp: false,
	},
];

/**
 * Lightfast-specific notification preferences hook.
 * Composes generic Knock preferences with Lightfast category definitions.
 */
export function useNotificationPreferences() {
	const knock = useKnockPreferences();

	const getCategoryPreferences = useCallback((): CategoryPreference[] => {
		const categories: WorkflowPreferences =
			knock.preferences?.categories ?? {};

		return CATEGORY_DEFINITIONS.map((def) => {
			const catSetting = categories[def.categoryKey];
			const channelTypes = getChannelTypesFromSetting(catSetting);

			return {
				categoryKey: def.categoryKey,
				label: def.label,
				description: def.description,
				supportsInApp: def.supportsInApp,
				channels: {
					in_app_feed: def.supportsInApp
						? (channelTypes.in_app_feed ?? true)
						: false,
					email: channelTypes.email ?? true,
				},
			};
		});
	}, [knock.preferences]);

	const updateCategoryPreference = async (
		categoryKey: NotificationCategoryKey,
		channelType: string,
		enabled: boolean,
	) => {
		await knock.updateCategoryPreference(categoryKey, channelType, enabled);
	};

	return {
		...knock,
		getCategoryPreferences,
		updateCategoryPreference,
	};
}
```

#### 3. Update preferences UI imports
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/notifications/_components/notification-preferences.tsx`
**Changes**: Update import paths from `@vendor/knock/components/preferences` to `~/hooks/use-notification-preferences`.

Lines 3-4 change from:
```typescript
import { useNotificationPreferences } from "@vendor/knock/components/preferences";
import type { CategoryPreference } from "@vendor/knock/components/preferences";
```

To:
```typescript
import { useNotificationPreferences } from "~/hooks/use-notification-preferences";
import type { CategoryPreference } from "~/hooks/use-notification-preferences";
```

No other changes needed — the hook return type is identical.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build:console` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `grep -r "@repo/console" vendor/knock/src/` returns nothing

#### Manual Verification:
- [x] Notification preferences page loads correctly at `/settings/notifications`
- [x] Global channel toggles (in-app, email) work
- [x] Per-category toggles work
- [x] Loading skeleton appears briefly on page load

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the preferences UI works before proceeding.

---

## Phase 2: Parameterize Provider Feed Channel ID

### Overview
Make `knockFeedChannelId` a prop on `NotificationsProvider` instead of hardcoding it. Pass the value from the consumer in `apps/console`.

### Changes Required:

#### 1. Add `feedChannelId` prop to provider
**File**: `vendor/knock/src/components/provider.tsx`
**Changes**: Add `feedChannelId` to `NotificationsProviderProps`, remove hardcoded constant.

Line 12 (remove):
```typescript
const knockFeedChannelId = "lightfast-console-notifications";
```

Lines 14-18 become:
```typescript
interface NotificationsProviderProps {
  children: ReactNode;
  userId: string;
  userToken?: string | null;
  feedChannelId: string;
}
```

Line 41 changes from:
```typescript
<KnockFeedProvider colorMode={"dark" as ColorMode} feedId={knockFeedChannelId}>
```
To:
```typescript
<KnockFeedProvider colorMode={"dark" as ColorMode} feedId={feedChannelId}>
```

Destructuring at line 20 adds `feedChannelId`:
```typescript
export const NotificationsProvider = ({
  children,
  userId,
  userToken,
  feedChannelId,
}: NotificationsProviderProps) => {
```

#### 2. Pass feed channel ID from consumer
**File**: `apps/console/src/components/notifications-provider.tsx`
**Changes**: Add `feedChannelId` prop to both `NotificationsProvider` invocations.

Line 31 becomes:
```typescript
<NotificationsProvider userId="loading" userToken={null} feedChannelId="lightfast-console-notifications">
```

Line 38 becomes:
```typescript
<NotificationsProvider userId={user.id} userToken={userToken as string | null} feedChannelId="lightfast-console-notifications">
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` passes
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [x] Notification bell still shows notifications
- [x] Notification popover opens and displays feed items

**Implementation Note**: After completing this phase, pause for manual verification of the notification bell.

---

## Phase 3: Remove `@repo/console-types` Dependency from Vendor

### Overview
After Phase 1 removed all `@repo/console-types` imports from vendor source, clean up `package.json`.

### Changes Required:

#### 1. Remove dependency
**File**: `vendor/knock/package.json`
**Changes**: Remove line 29 (`"@repo/console-types": "workspace:*"`)

```diff
  "dependencies": {
    "@knocklabs/node": "^1.20.0",
    "@knocklabs/react": "^0.8.11",
-   "@repo/console-types": "workspace:*",
    "@t3-oss/env-nextjs": "catalog:",
    "react": "catalog:react19",
    "zod": "catalog:zod3"
  },
```

#### 2. Reinstall dependencies
```bash
pnpm install
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm build:console` passes
- [x] `pnpm typecheck` passes
- [x] `grep -r "@repo/console" vendor/*/package.json` returns nothing — vendor contract restored

---

## Phase 4: DRY Digest Helpers

### Overview
Extract the duplicated `groupBy` helper and shared recipient construction into a local utils file within the notifications workflow directory.

### Changes Required:

#### 1. Create shared utils file
**File**: `api/console/src/inngest/workflow/notifications/utils.ts` (new file)
**Changes**: Contains the shared `groupBy` helper and a `buildRecipients` helper.

```typescript
import type { Recipient } from "./recipient-filter";

/**
 * Group array items by a key and count occurrences.
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
	return arr.reduce(
		(acc, item) => {
			const k = String(item[key]);
			acc[k] = (acc[k] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);
}

/**
 * Build Recipient objects from Clerk organization member data.
 */
export function buildRecipientsFromMembers(
	members: { publicUserData?: { userId?: string | null; identifier?: string | null; firstName?: string | null } | null }[],
): Recipient[] {
	return members
		.filter(
			(m) => m.publicUserData?.userId && m.publicUserData.identifier,
		)
		.map((m) => ({
			id: m.publicUserData?.userId ?? "",
			email: m.publicUserData?.identifier ?? "",
			name: m.publicUserData?.firstName ?? undefined,
		}));
}
```

#### 2. Update daily-digest.ts
**File**: `api/console/src/inngest/workflow/notifications/daily-digest.ts`
**Changes**:
- Add import: `import { groupBy, buildRecipientsFromMembers } from "./utils";`
- Replace inline recipient construction (~lines 137-147) with `buildRecipientsFromMembers(members.data)`
- Remove local `groupBy` function (lines 192-201)

#### 3. Update weekly-summary.ts
**File**: `api/console/src/inngest/workflow/notifications/weekly-summary.ts`
**Changes**:
- Add import: `import { groupBy, buildRecipientsFromMembers } from "./utils";`
- Replace inline recipient construction (~lines 159-167) with `buildRecipientsFromMembers(members.data)`
- Remove local `groupBy` function (lines 220-229)

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

---

## Testing Strategy

### Automated Tests:
- No new tests required — this is a refactor with no behavior changes
- Existing build, typecheck, and lint pipelines validate correctness

### Manual Testing Steps:
1. Navigate to workspace settings > notifications page
2. Verify loading skeleton appears, then preferences load
3. Toggle global "In-App Notifications" switch — verify it toggles
4. Toggle global "Email Notifications" switch — verify it toggles
5. Toggle per-category switches — verify they toggle
6. Verify disabled states when global channel is off
7. Verify "Not recommended" warning appears when critical alerts email is off
8. Click notification bell in header — verify popover opens with feed items

## Performance Considerations

None. This is a pure refactor — no runtime behavior changes. The new app-layer hook composes the vendor hook identically to how the code worked before.

## Migration Notes

No data migration. No API changes. No environment variable changes. Import paths change but all consumers are within the monorepo.

## References

- Research document: `thoughts/shared/research/2026-02-07-knock-notification-types-analysis.md`
- Original Phase 1 plan: `thoughts/shared/plans/2026-02-06-knock-notification-integration-phase-1.md`
- Rubric implementation plan: `thoughts/shared/plans/2026-02-07-notification-rubric-implementation.md`
- Vendor package contract: `CLAUDE.md` — "Vendor abstractions: Standalone re-exports of third-party SDKs"
