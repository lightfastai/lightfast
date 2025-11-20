"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { WorkspaceHeader } from "./workspace-header";
import { KeyMetricsStrip } from "./key-metrics-strip";
import { MetricsSidebar } from "./metrics-sidebar";
import { ActivityTimeline } from "./activity-timeline";
import { StoresOverview } from "./stores-overview";
import { ConnectedSourcesOverview } from "./connected-sources-overview";
import { PerformanceMetrics } from "./performance-metrics";
import { SystemHealthOverview } from "./system-health-overview";
import { LightfastConfigOverview } from "./lightfast-config-overview";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface WorkspaceDashboardProps {
	orgSlug: string;
	workspaceSlug: string;
	clerkOrgId: string;
}

export function WorkspaceDashboard({
	orgSlug,
	workspaceSlug,
	clerkOrgId,
}: WorkspaceDashboardProps) {
	const trpc = useTRPC();

	// Resolve workspace from Clerk org (already prefetched in layout)
	const { data: workspace } = useSuspenseQuery({
		...trpc.workspace.resolveFromClerkOrgId.queryOptions({
			clerkOrgId,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	// Fetch workspace statistics
	const { data: stats } = useSuspenseQuery({
		...trpc.workspace.statistics.queryOptions({
			workspaceId: workspace.workspaceId,
			clerkOrgId,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	return (
		<div className="space-y-6">
			{/* Header - Full Width */}
			<WorkspaceHeader
				workspaceName={workspaceSlug.charAt(0).toUpperCase() + workspaceSlug.slice(1)}
				workspaceSlug={workspaceSlug}
				sourcesConnected={stats.sources.total}
				orgSlug={orgSlug}
			/>

			{/* First Section - Config + Metrics Grid (like PlanetScale VTGates + Vitess) */}
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
				{/* Left: Lightfast Config (like VTGates) */}
				<LightfastConfigOverview
					workspaceId={workspace.workspaceId}
					workspaceName={workspaceSlug.charAt(0).toUpperCase() + workspaceSlug.slice(1)}
					stores={stats.stores.list}
				/>

				{/* Right: Metrics Sidebar (like Vitess stats) */}
				<MetricsSidebar
					sourcesCount={stats.sources.total}
					totalDocuments={stats.documents.total}
					totalChunks={stats.documents.chunks}
					successRate={stats.jobs.successRate}
					avgDurationMs={stats.jobs.avgDurationMs}
					recentJobsCount={stats.jobs.total}
				/>
			</div>

			{/* Main Grid Layout - 2 columns (65% / 35%) */}
			<div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
				{/* Left Column - Main Content */}
				<div className="space-y-6">
					{/* System Health Overview - Hierarchical Status */}
					<SystemHealthOverview
						workspaceId={workspace.workspaceId}
						clerkOrgId={clerkOrgId}
					/>

					{/* Performance Metrics - Percentiles & Time Series Charts */}
					<PerformanceMetrics
						workspaceId={workspace.workspaceId}
						clerkOrgId={clerkOrgId}
					/>
				</div>

				{/* Right Column - Activity Sidebar */}
				<div className="space-y-6">
					{/* Activity Timeline - Timeline-style layout */}
					<ActivityTimeline recentJobs={stats.jobs.recent} />
				</div>
			</div>

			{/* Bottom Section - Full Width */}
			<ConnectedSourcesOverview sources={stats.sources.list} />

			{/* Stores Overview - Full Width, Collapsible (can be removed since it's now in config) */}
			<StoresOverview
				stores={stats.stores.list}
				totalStores={stats.stores.total}
			/>
		</div>
	);
}

export function WorkspaceDashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header Skeleton */}
			<Skeleton className="h-20 w-full" />

			{/* First Section - Config + Metrics Skeleton */}
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
				<Skeleton className="h-[400px] w-full" />
				<Skeleton className="h-[400px] w-full" />
			</div>

			{/* Main Grid Skeleton - 2 columns */}
			<div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
				{/* Left Column */}
				<div className="space-y-6">
					<Skeleton className="h-64 w-full" />
					<Skeleton className="h-80 w-full" />
				</div>

				{/* Right Column */}
				<div className="space-y-6">
					<Skeleton className="h-[600px] w-full" />
				</div>
			</div>

			{/* Bottom Sections */}
			<Skeleton className="h-48 w-full" />
			<Skeleton className="h-32 w-full" />
		</div>
	);
}
