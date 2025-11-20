"use client";

import { MetricCard, MetricCardSkeleton } from "./metric-card";
import {
	Database,
	FileText,
	Activity,
	Clock,
	TrendingUp,
	Box,
} from "lucide-react";

interface MetricsGridProps {
	sourcesCount: number;
	storesCount: number;
	totalDocuments: number;
	totalChunks: number;
	recentJobsCount: number;
	completedJobsCount: number;
	failedJobsCount: number;
	avgDurationMs: number;
	successRate: number;
	// Comparison data (optional)
	comparison?: {
		documents: { total: number; chunks: number };
		jobs: {
			total: number;
			completed: number;
			failed: number;
			successRate: number;
			avgDurationMs: number;
		};
	};
}

export function MetricsGrid({
	sourcesCount,
	storesCount,
	totalDocuments,
	totalChunks,
	recentJobsCount,
	completedJobsCount,
	failedJobsCount,
	avgDurationMs,
	successRate,
	comparison,
}: MetricsGridProps) {
	const formatDuration = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	};

	// Determine success rate badge
	let successBadge = undefined;
	if (recentJobsCount > 0) {
		if (successRate >= 95) {
			successBadge = { label: "Healthy", variant: "default" as const };
		} else if (successRate >= 80) {
			successBadge = { label: "Fair", variant: "secondary" as const };
		} else {
			successBadge = { label: "Issues", variant: "destructive" as const };
		}
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{/* Connected Sources */}
			<MetricCard
				title="Connected Sources"
				value={sourcesCount}
				description={
					sourcesCount === 0
						? "No sources connected yet"
						: sourcesCount === 1
							? "GitHub repository"
							: "Across GitHub and other sources"
				}
				icon={Database}
			/>

			{/* Documents Indexed */}
			<MetricCard
				title="Documents Indexed"
				value={totalDocuments.toLocaleString()}
				description={`${totalChunks.toLocaleString()} vector embeddings`}
				icon={FileText}
				trend={
					comparison
						? {
								value: comparison.documents.total,
								isPositive: true, // More documents is always positive
							}
						: undefined
				}
			/>

			{/* Vector Stores */}
			<MetricCard
				title="Vector Stores"
				value={storesCount}
				description={
					storesCount === 0
						? "Create your first store"
						: storesCount === 1
							? "Pinecone index"
							: "Pinecone indexes"
				}
				icon={Box}
			/>

			{/* Job Success Rate */}
			<MetricCard
				title="Job Success Rate"
				value={recentJobsCount === 0 ? "—" : `${successRate.toFixed(0)}%`}
				description={
					recentJobsCount === 0
						? "No jobs in selected period"
						: `${recentJobsCount} jobs executed`
				}
				icon={TrendingUp}
				badge={successBadge}
				trend={
					comparison && recentJobsCount > 0
						? {
								value: comparison.jobs.successRate,
								isPositive: comparison.jobs.successRate >= 0, // Higher success rate is better
							}
						: undefined
				}
			/>

			{/* Recent Jobs */}
			<MetricCard
				title="Recent Jobs"
				value={recentJobsCount}
				description={`${completedJobsCount} completed${failedJobsCount > 0 ? `, ${failedJobsCount} failed` : ""}`}
				icon={Activity}
				trend={
					comparison
						? {
								value: comparison.jobs.total,
								isPositive: true, // More activity is generally positive
							}
						: undefined
				}
			/>

			{/* Avg Processing Time */}
			<MetricCard
				title="Avg Processing"
				value={completedJobsCount === 0 ? "—" : formatDuration(avgDurationMs)}
				description="Per job execution"
				icon={Clock}
				trend={
					comparison && completedJobsCount > 0
						? {
								value: comparison.jobs.avgDurationMs,
								isPositive: comparison.jobs.avgDurationMs < 0, // Faster is better (negative change)
							}
						: undefined
				}
			/>

			{/* Knowledge Coverage (placeholder for Phase 2+) */}
			<MetricCard
				title="Knowledge Coverage"
				value="—"
				description="Coming in Phase 2"
				icon={TrendingUp}
				className="opacity-60"
			/>

			{/* Search Queries (placeholder for Phase 2+) */}
			<MetricCard
				title="Search Queries"
				value="—"
				description="Coming in Phase 2"
				icon={Activity}
				className="opacity-60"
			/>
		</div>
	);
}

/**
 * MetricsGrid Skeleton for loading states
 */
export function MetricsGridSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 8 }).map((_, i) => (
				<MetricCardSkeleton key={i} />
			))}
		</div>
	);
}
