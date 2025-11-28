"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
 * Dashboard preferences store with persistence
 */
interface DashboardPreferencesStore extends DashboardPreferences {
	// Session state (not persisted)
	currentTimeRange: TimeRange | null;

	// Actions
	setAutoRefreshInterval: (interval: number) => void;
	setDefaultTimeRange: (range: TimeRange) => void;
	setCurrentTimeRange: (range: TimeRange) => void;
	toggleVisibleSection: (
		section: keyof DashboardPreferences["visibleSections"]
	) => void;
	setVisibleSection: (
		section: keyof DashboardPreferences["visibleSections"],
		visible: boolean
	) => void;
	resetPreferences: () => void;

	// Computed getter for current time range
	getCurrentTimeRange: () => TimeRange;
}

/**
 * Dashboard preferences store (persisted to localStorage)
 */
export const useDashboardPreferences = create<DashboardPreferencesStore>()(
	persist(
		(set, get) => ({
			// Initial state from defaults
			...defaultPreferences,
			currentTimeRange: null,

			// Actions
			setAutoRefreshInterval: (interval) =>
				set({ autoRefreshInterval: interval }),

			setDefaultTimeRange: (range) => set({ defaultTimeRange: range }),

			setCurrentTimeRange: (range) => set({ currentTimeRange: range }),

			toggleVisibleSection: (section) =>
				set((state) => ({
					visibleSections: {
						...state.visibleSections,
						[section]: !state.visibleSections[section],
					},
				})),

			setVisibleSection: (section, visible) =>
				set((state) => ({
					visibleSections: {
						...state.visibleSections,
						[section]: visible,
					},
				})),

			resetPreferences: () =>
				set({
					...defaultPreferences,
					currentTimeRange: null,
				}),

			getCurrentTimeRange: () => {
				const state = get();
				return state.currentTimeRange ?? state.defaultTimeRange;
			},
		}),
		{
			name: "lightfast-console-dashboard-preferences",
			// Only persist preferences, not session state
			partialize: (state) => ({
				autoRefreshInterval: state.autoRefreshInterval,
				defaultTimeRange: state.defaultTimeRange,
				visibleSections: state.visibleSections,
			}),
		}
	)
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
