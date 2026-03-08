"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import {
  Activity,
  Box,
  Clock,
  Database,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { WorkspaceMetricsSummary } from "~/types";

/**
 * Props derived from granular workspace endpoints:
 * - workspace.sources.list (sourcesCount)
 * - workspace.documents.stats (totalDocuments, totalChunks)
 * - workspace.jobs.stats (successRate, avgDurationMs, recentJobsCount)
 * Individual fields are extracted in parent component for flexibility
 */
type MetricsSidebarProps = WorkspaceMetricsSummary;

export function MetricsSidebar({
  sourcesCount,
  totalDocuments,
  totalChunks,
  successRate,
  avgDurationMs,
  recentJobsCount,
}: MetricsSidebarProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60_000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60_000).toFixed(1)}m`;
  };

  // Only use real data - no fake/placeholder values
  const metrics = [
    {
      label: "Connected Sources",
      value: String(sourcesCount),
      icon: Database,
    },
    {
      label: "Documents Indexed",
      value: totalDocuments.toLocaleString(),
      icon: FileText,
    },
    {
      label: "Vector Chunks",
      value: totalChunks.toLocaleString(),
      icon: Box,
    },
    {
      label: "Success Rate",
      value: recentJobsCount === 0 ? "—" : `${successRate.toFixed(0)}%`,
      icon: TrendingUp,
      badge:
        recentJobsCount > 0 && successRate >= 95 ? (
          <Badge className="h-5 px-1.5 py-0.5 text-[10px]" variant="default">
            Healthy
          </Badge>
        ) : null,
    },
    {
      label: "Avg Processing",
      value: recentJobsCount === 0 ? "—" : formatDuration(avgDurationMs),
      icon: Clock,
    },
    {
      label: "Recent Jobs",
      value: String(recentJobsCount),
      icon: Activity,
    },
  ];

  return (
    <Card className="h-full overflow-hidden border-border/60">
      {/* Grid layout with borders like PlanetScale */}
      <div className="grid grid-cols-2 divide-x divide-border/60">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const isBottomRow = index >= metrics.length - 2;
          return (
            <div
              className={`p-4 ${isBottomRow ? "" : "border-border/60 border-b"}`}
              key={index}
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">
                  {metric.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-2xl">{metric.value}</span>
                {metric.badge}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
