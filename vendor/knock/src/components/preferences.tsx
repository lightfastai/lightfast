"use client";

import { useKnockClient } from "@knocklabs/react";
import { useState, useEffect, useCallback } from "react";
import type { NotificationCategoryKey } from "@repo/console-types";

/**
 * Local type definitions matching @knocklabs/client's preference interfaces.
 * We define them here because @knocklabs/react doesn't re-export them
 * and we don't want to add @knocklabs/client as a direct dependency.
 */
type ChannelTypePreferences = Partial<
	Record<string, boolean | { conditions: unknown[] }>
>;

type WorkflowPreferenceSetting =
	| boolean
	| { channel_types: ChannelTypePreferences }
	| { conditions: unknown[] };

type WorkflowPreferences = Partial<
	Record<string, WorkflowPreferenceSetting>
>;

interface PreferenceSet {
	id: string;
	categories: WorkflowPreferences | null;
	workflows: WorkflowPreferences | null;
	channel_types: ChannelTypePreferences | null;
}

export interface ChannelPreference {
	channelType: string;
	enabled: boolean;
}

export interface CategoryPreference {
	categoryKey: NotificationCategoryKey;
	label: string;
	description: string;
	channels: {
		in_app_feed: boolean;
		email: boolean;
	};
	/** Whether this category supports in-app feed (digest categories are email-only) */
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

/** Extract channel_types booleans from a WorkflowPreferenceSetting */
function getChannelTypesFromSetting(
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

export interface UseNotificationPreferencesResult {
	preferences: PreferenceSet | null;
	loading: boolean;
	updating: boolean;
	updateChannelPreference: (
		channelType: string,
		enabled: boolean,
	) => Promise<void>;
	knockClient: ReturnType<typeof useKnockClient>;
	getChannelEnabled: (channelType: string) => boolean;
	getCategoryPreferences: () => CategoryPreference[];
	updateCategoryPreference: (
		categoryKey: NotificationCategoryKey,
		channelType: string,
		enabled: boolean,
	) => Promise<void>;
}

/**
 * Hook for managing Knock notification preferences
 * Provides access to channel preferences, category preferences, and update methods
 */
export function useNotificationPreferences(): UseNotificationPreferencesResult {
	const knockClient = useKnockClient();
	const [preferences, setPreferences] = useState<PreferenceSet | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);

	// Fetch current preferences on mount
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
				console.error(
					"Failed to fetch notification preferences:",
					error,
				);
			} finally {
				setLoading(false);
			}
		}

		void fetchPreferences();
	}, [knockClient]);

	// Helper to get the enabled state of a channel
	const getChannelEnabled = (channelType: string): boolean => {
		if (!preferences?.channel_types) return true;
		const channelPref = preferences.channel_types[channelType];
		if (typeof channelPref === "boolean") return channelPref;
		return true; // Default to enabled if not set
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
				workflows: (preferences?.workflows ?? {}) as Record<
					string,
					boolean
				>,
				categories: (preferences?.categories ?? {}) as Record<
					string,
					boolean
				>,
			});

			const updatedPrefs = await knockClient.preferences.get();
			setPreferences(updatedPrefs as PreferenceSet);
		} catch (error) {
			console.error(
				"Failed to update notification preference:",
				error,
			);
			throw error;
		} finally {
			setUpdating(false);
		}
	};

	/** Get category preferences with current enabled states */
	const getCategoryPreferences = useCallback((): CategoryPreference[] => {
		const categories: WorkflowPreferences =
			preferences?.categories ?? {};

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
	}, [preferences]);

	/** Update a single channel preference within a category */
	const updateCategoryPreference = async (
		categoryKey: NotificationCategoryKey,
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
			const currentChannelTypes =
				getChannelTypesFromSetting(currentSetting);

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
				workflows: (preferences?.workflows ?? {}) as Record<
					string,
					boolean
				>,
				categories: updatedCategories as Record<string, boolean>,
			});

			const updatedPrefs = await knockClient.preferences.get();
			setPreferences(updatedPrefs as PreferenceSet);
		} catch (error) {
			console.error(
				"Failed to update category preference:",
				error,
			);
			throw error;
		} finally {
			setUpdating(false);
		}
	};

	return {
		preferences,
		loading,
		updating,
		updateChannelPreference,
		knockClient,
		getChannelEnabled,
		getCategoryPreferences,
		updateCategoryPreference,
	};
}
