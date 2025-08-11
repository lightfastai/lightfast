/**
 * Date utility functions for grouping and formatting
 */

export const DATE_GROUP_ORDER = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"] as const;
export type DateGroup = typeof DATE_GROUP_ORDER[number];

/**
 * Group items by date categories
 */
export function groupByDate<T extends { createdAt: Date }>(items: T[]): Record<DateGroup, T[]> {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const sevenDaysAgo = new Date(today);
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const thirtyDaysAgo = new Date(today);
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const groups: Record<DateGroup, T[]> = {
		"Today": [],
		"Yesterday": [],
		"Last 7 days": [],
		"Last 30 days": [],
		"Older": [],
	};

	items.forEach((item) => {
		const itemDate = new Date(item.createdAt);
		const isToday = itemDate.toDateString() === today.toDateString();
		const isYesterday = itemDate.toDateString() === yesterday.toDateString();
		const isLastWeek = itemDate > sevenDaysAgo && !isToday && !isYesterday;
		const isLastMonth = itemDate > thirtyDaysAgo && !isLastWeek && !isToday && !isYesterday;

		if (isToday) {
			groups["Today"].push(item);
		} else if (isYesterday) {
			groups["Yesterday"].push(item);
		} else if (isLastWeek) {
			groups["Last 7 days"].push(item);
		} else if (isLastMonth) {
			groups["Last 30 days"].push(item);
		} else {
			groups["Older"].push(item);
		}
	});

	return groups;
}