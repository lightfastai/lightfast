"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Time range options for dashboard metrics
 */
export type TimeRange = "24h" | "7d" | "30d";

/**
 * Dashboard preferences stored in localStorage
 */
export interface DashboardPreferences {
	autoRefreshInterval: number; // in seconds, 0 = disabled
	defaultTimeRange: TimeRange;
	visibleSections: {
		metrics: boolean;
		activity: boolean;
		sources: boolean;
		stores: boolean;
	};
}

/**
 * Default dashboard preferences
 */
const defaultPreferences: DashboardPreferences = {
	autoRefreshInterval: 30, // 30 seconds
	defaultTimeRange: "24h",
	visibleSections: {
		metrics: true,
		activity: true,
		sources: true,
		stores: true,
	},
};

/**
 * Dashboard preferences atom (persisted to localStorage)
 */
export const dashboardPreferencesAtom = atomWithStorage<DashboardPreferences>(
	"lightfast-console-dashboard-preferences",
	defaultPreferences
);

/**
 * Current time range atom (session state, not persisted)
 * Initialized from preferences
 */
export const currentTimeRangeAtom = atom<TimeRange>((get) => {
	const prefs = get(dashboardPreferencesAtom);
	return prefs.defaultTimeRange;
});

/**
 * Writable time range atom
 */
export const timeRangeAtom = atom(
	(get) => get(currentTimeRangeAtom),
	(_get, set, newRange: TimeRange) => {
		set(currentTimeRangeAtom, newRange);
	}
);

/**
 * Helper to get time range in milliseconds
 */
export function getTimeRangeMs(range: TimeRange): number {
	switch (range) {
		case "24h":
			return 24 * 60 * 60 * 1000;
		case "7d":
			return 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return 30 * 24 * 60 * 60 * 1000;
	}
}

/**
 * Helper to get comparison period based on time range
 */
export function getComparisonPeriod(range: TimeRange): {
	current: { start: Date; end: Date };
	previous: { start: Date; end: Date };
} {
	const now = new Date();
	const rangeMs = getTimeRangeMs(range);

	const currentEnd = now;
	const currentStart = new Date(now.getTime() - rangeMs);

	const previousEnd = currentStart;
	const previousStart = new Date(currentStart.getTime() - rangeMs);

	return {
		current: { start: currentStart, end: currentEnd },
		previous: { start: previousStart, end: previousEnd },
	};
}

/**
 * Helper to format time range label
 */
export function getTimeRangeLabel(range: TimeRange): string {
	switch (range) {
		case "24h":
			return "Last 24 hours";
		case "7d":
			return "Last 7 days";
		case "30d":
			return "Last 30 days";
	}
}
