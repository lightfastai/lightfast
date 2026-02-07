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
