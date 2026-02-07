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
