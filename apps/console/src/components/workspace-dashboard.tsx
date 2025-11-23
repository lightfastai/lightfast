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

interface WorkspaceDashboardProps {
  orgSlug: string;
  workspaceName: string;
}

export function WorkspaceDashboard({
  orgSlug,
  workspaceName,
}: WorkspaceDashboardProps) {
  const trpc = useTRPC();

  // Fetch all queries in parallel (8 total - granular for better caching)
  const [
    { data: sources },
    { data: stores },
    { data: documents },
    { data: jobStats },
    { data: recentJobs },
    { data: percentiles },
    { data: timeSeries },
    { data: health },
  ] = useSuspenseQueries({
    queries: [
      {
        ...trpc.workspace.sources.list.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes - sources change infrequently
      },
      {
        ...trpc.workspace.stores.list.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes - stores change infrequently
      },
      {
        ...trpc.workspace.documents.stats.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 1 * 60 * 1000, // 1 minute - document counts change moderately
      },
      {
        ...trpc.workspace.jobs.stats.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - job stats change frequently
      },
      {
        ...trpc.workspace.jobs.recent.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName: workspaceName,
        }),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // 30 seconds - recent jobs change frequently
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
        ...trpc.workspace.health.overview.queryOptions({
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
        sourcesConnected={sources.total}
        orgSlug={orgSlug}
      />

      {/* First Section - Config + Metrics Grid (like PlanetScale VTGates + Vitess) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Lightfast Config (like VTGates) */}
        <LightfastConfigOverview
          workspaceName={
            workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1)
          }
          stores={stores.list.map((store) => ({
            ...store,
            name: store.slug,
          }))}
        />

        {/* Right: Metrics Sidebar (like Vitess stats) */}
        <MetricsSidebar
          sourcesCount={sources.total}
          totalDocuments={documents.total}
          totalChunks={documents.chunks}
          successRate={jobStats.successRate}
          avgDurationMs={jobStats.avgDurationMs}
          recentJobsCount={jobStats.total}
        />
      </div>

      {/* Main Grid Layout - 2 columns (65% / 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left Column - Main Content */}
        <div className="space-y-6">
          {/* System Health Overview - Hierarchical Status */}
          <SystemHealthOverview
            health={health}
            stores={stores.list}
            sources={sources.list}
          />

          {/* Performance Metrics - Percentiles & Time Series Charts */}
          <PerformanceMetrics
            percentiles={percentiles}
            timeSeries={timeSeries}
          />
        </div>

        {/* Right Column - Activity Sidebar */}
        <div className="space-y-6">
          {/* Activity Timeline - Timeline-style layout */}
          <ActivityTimeline recentJobs={recentJobs} />
        </div>
      </div>

      {/* Bottom Section - Full Width */}
      <ConnectedSourcesOverview sources={sources.list} />

      {/* Stores Overview - Full Width, Collapsible (can be removed since it's now in config) */}
      <StoresOverview
        stores={stores.list.map((store) => ({
          ...store,
          name: store.slug,
        }))}
        totalStores={stores.total}
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
