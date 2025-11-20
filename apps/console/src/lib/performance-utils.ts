/**
 * Performance utility functions for job metrics and time-series data
 */

/**
 * Calculate percentile from sorted array of values
 */
export function calculatePercentile(
	values: number[],
	percentile: number,
): number {
	if (values.length === 0) return 0;

	// Sort values in ascending order
	const sorted = [...values].sort((a, b) => a - b);

	// Calculate index for percentile
	const index = (percentile / 100) * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);

	// If exact index, return that value
	if (lower === upper) return sorted[lower] ?? 0;

	// Otherwise, interpolate between values
	const lowerValue = sorted[lower] ?? 0;
	const upperValue = sorted[upper] ?? 0;
	const fraction = index - lower;

	return lowerValue + (upperValue - lowerValue) * fraction;
}

export interface TimeSeriesPoint {
	timestamp: string;
	hour: string; // Human-readable hour (e.g., "2:00 PM")
	jobCount: number;
	avgDuration: number;
	successRate: number;
}

export interface Job {
	createdAt: string | Date;
	durationMs: string | null;
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
}

/**
 * Group jobs by hour and calculate metrics
 */
export function groupByHour(jobs: Job[]): TimeSeriesPoint[] {
	const now = new Date();
	const hours = new Map<string, Job[]>();

	// Create 24 hour buckets (current hour back to 24 hours ago)
	for (let i = 0; i < 24; i++) {
		const hourDate = new Date(now);
		hourDate.setHours(now.getHours() - i, 0, 0, 0);
		const key = hourDate.toISOString().slice(0, 13); // YYYY-MM-DDTHH
		hours.set(key, []);
	}

	// Group jobs into hour buckets
	for (const job of jobs) {
		const jobDate = new Date(job.createdAt);
		const key = jobDate.toISOString().slice(0, 13);
		const bucket = hours.get(key);
		if (bucket) {
			bucket.push(job);
		}
	}

	// Convert to time series points
	const points: TimeSeriesPoint[] = [];
	for (const [timestamp, hourJobs] of hours.entries()) {
		const date = new Date(timestamp);
		const hour = date.toLocaleTimeString("en-US", {
			hour: "numeric",
			hour12: true,
		});

		const completedJobs = hourJobs.filter((j) => j.status === "completed");
		const avgDuration =
			completedJobs.length > 0
				? completedJobs.reduce(
						(sum, j) => sum + Number.parseInt(j.durationMs ?? "0", 10),
						0,
					) / completedJobs.length
				: 0;

		const successRate =
			hourJobs.length > 0
				? (completedJobs.length / hourJobs.length) * 100
				: 100;

		points.push({
			timestamp,
			hour,
			jobCount: hourJobs.length,
			avgDuration: Math.round(avgDuration),
			successRate: Math.round(successRate),
		});
	}

	// Return in chronological order (oldest to newest)
	return points.reverse();
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
	if (ms === 0) return "0ms";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
	return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Get health status based on success rate
 */
export function getHealthStatus(
	successRate: number,
): "healthy" | "degraded" | "down" {
	if (successRate >= 95) return "healthy";
	if (successRate >= 80) return "degraded";
	return "down";
}

/**
 * Format percentile label (e.g., "p50", "p95", "p99", "max")
 */
export function formatPercentileLabel(percentile: number): string {
	if (percentile === 100) return "max";
	return `p${percentile}`;
}
