"use client";

import { useKnockClient } from "@knocklabs/react";
import { useState, useEffect } from "react";

export interface ChannelPreference {
	channelType: string;
	enabled: boolean;
}

export interface UseNotificationPreferencesResult {
	preferences: any;
	loading: boolean;
	updating: boolean;
	updateChannelPreference: (channelType: string, enabled: boolean) => Promise<void>;
	knockClient: ReturnType<typeof useKnockClient>;
	getChannelEnabled: (channelType: string) => boolean;
}

/**
 * Hook for managing Knock notification preferences
 * Provides access to channel preferences and update methods
 */
export function useNotificationPreferences(): UseNotificationPreferencesResult {
	const knockClient = useKnockClient();
	const [preferences, setPreferences] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);

	// Fetch current preferences on mount
	useEffect(() => {
		async function fetchPreferences() {
			if (!knockClient) {
				setLoading(false);
				return;
			}

			try {
				const prefs = await knockClient.preferences.get();
				setPreferences(prefs);
			} catch (error) {
				console.error("Failed to fetch notification preferences:", error);
			} finally {
				setLoading(false);
			}
		}

		fetchPreferences();
	}, [knockClient]);

	// Helper to get the enabled state of a channel
	const getChannelEnabled = (channelType: string): boolean => {
		if (!preferences?.channel_types) return true;
		const channelPref = preferences.channel_types[channelType];
		// Handle both simple boolean and conditional preference objects
		if (typeof channelPref === "boolean") return channelPref;
		if (typeof channelPref === "object" && channelPref !== null) {
			return true; // Conditional preferences are considered enabled
		}
		return true; // Default to enabled if not set
	};

	const updateChannelPreference = async (
		channelType: string,
		enabled: boolean,
	) => {
		if (!knockClient) {
			console.error("Knock client not available");
			return;
		}

		setUpdating(true);
		try {
			// Preserve existing preferences and update only the target channel
			const updatedChannelTypes = {
				...(preferences?.channel_types || {}),
				[channelType]: enabled,
			};

			// Use Knock's preference set method with required fields
			await knockClient.preferences.set({
				channel_types: updatedChannelTypes,
				workflows: preferences?.workflows || {},
				categories: preferences?.categories || {},
			});

			// Refetch to get the updated state from server
			const updatedPrefs = await knockClient.preferences.get();
			setPreferences(updatedPrefs);
		} catch (error) {
			console.error("Failed to update notification preference:", error);
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
	};
}
