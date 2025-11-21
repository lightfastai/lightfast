"use client";

import { useSuspenseQueries } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { WorkspaceHeader } from "./workspace-header";
import { MetricsSidebar } from "./metrics-sidebar";
import { ActivityTimeline } from "./activity-timeline";
import { StoresOverview } from "./stores-overview";
import { ConnectedSourcesOverview } from "./connected-sources-overview";
import { PerformanceMetrics } from "./performance-metrics";
import { SystemHealthOverview } from "./system-health-overview";
import { LightfastConfigOverview } from "./lightfast-config-overview";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { WorkspaceResolution, WorkspaceStats } from "~/types";

interface WorkspaceDashboardProps {
  orgSlug: string;
  workspaceName: string;
}

export function WorkspaceDashboard({
  orgSlug,
  workspaceName,
}: WorkspaceDashboardProps) {
  const trpc = useTRPC();

  // Fetch all queries in parallel (5 total)
  const [
    { data: workspace },
    { data: stats },
    { data: percentiles },
    { data: timeSeries },
    { data: health },
  ] = useSuspenseQueries({
    queries: [
      {
        ...trpc.workspace.resolveFromClerkOrgSlug.queryOptions({
          clerkOrgSlug: orgSlug,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 2 * 60 * 1000, // 2 minutes - workspace metadata rarely changes
      },
      {
        ...trpc.workspace.statistics.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - statistics change frequently
      },
      {
        ...trpc.workspace.jobPercentiles.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
          timeRange: "24h",
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - performance metrics change frequently
      },
      {
        ...trpc.workspace.performanceTimeSeries.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
          timeRange: "24h",
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - time series data changes frequently
      },
      {
        ...trpc.workspace.systemHealth.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - health status changes frequently
      },
    ],
  });

  return (
    <div className="space-y-6">
      {/* Header - Full Width */}
      <WorkspaceHeader
        workspaceName={
          workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1)
        }
        workspaceUrlName={workspaceName}
        sourcesConnected={stats.sources.total}
        orgSlug={orgSlug}
      />

      {/* First Section - Config + Metrics Grid (like PlanetScale VTGates + Vitess) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Lightfast Config (like VTGates) */}
        <LightfastConfigOverview
          workspaceId={workspace.workspaceId}
          workspaceName={
            workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1)
          }
          stores={stats.stores.list.map((store) => ({
            ...store,
            name: store.slug,
          }))}
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
          <SystemHealthOverview health={health} />

          {/* Performance Metrics - Percentiles & Time Series Charts */}
          <PerformanceMetrics
            percentiles={percentiles}
            timeSeries={timeSeries}
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
        stores={stats.stores.list.map((store) => ({
          ...store,
          name: store.slug,
        }))}
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
