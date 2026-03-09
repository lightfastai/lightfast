"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle,
  Database,
  Github,
  XCircle,
} from "lucide-react";

interface HealthData {
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  totalJobs24h: number;
  workspaceHealth: "healthy" | "degraded" | "down";
}

interface Store {
  documentCount: number;
  embeddingDim: number;
  embeddingModel: string;
  id: string;
}

interface Source {
  displayName: string;
  documentCount: number;
  id: string;
  lastSyncedAt: string | null;
  type: string;
}

interface SystemHealthOverviewProps {
  health: HealthData;
  sources: Source[];
  store: Store | null; // Single store (1:1 relationship)
}

/**
 * System Health Overview Component
 *
 * Shows hierarchical view of workspace health.
 * Note: Each workspace has exactly ONE store (1:1 relationship).
 */
export function SystemHealthOverview({
  health,
  store,
  sources,
}: SystemHealthOverviewProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="font-medium text-base">System Health</CardTitle>
          <p className="text-muted-foreground text-xs">
            Hierarchical view of workspace components
          </p>
        </div>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Workspace Level */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <HealthIndicator status={health.workspaceHealth} />
            <div className="flex-1">
              <p className="font-medium text-sm">Workspace</p>
              <p className="text-muted-foreground text-xs">
                {store ? "1 store" : "No store"}, {sources.length} sources
              </p>
            </div>
            <Badge className="text-xs" variant="outline">
              {health.totalJobs24h} jobs (24h)
            </Badge>
          </div>

          {/* Store Level (single store) */}
          {store && (
            <div className="space-y-2 border-border/50 border-l-2 pl-6">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <HealthIndicator status={health.workspaceHealth} />
                <Box className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {store.embeddingModel}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {store.documentCount.toLocaleString()} documents
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className="text-xs" variant="outline">
                    {store.embeddingDim}d
                  </Badge>
                  <Badge
                    className="text-xs"
                    variant={
                      health.successRate >= 95
                        ? "default"
                        : health.successRate >= 80
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {health.successRate.toFixed(0)}%
                  </Badge>
                </div>
              </div>

              {/* Sources Level */}
              {sources.length > 0 && (
                <div className="space-y-2 border-border/30 border-l-2 pl-6">
                  {sources.map((source) => (
                    <div
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                      key={source.id}
                    >
                      <HealthIndicator status={health.workspaceHealth} />
                      <SourceIcon type={source.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {source.displayName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {source.documentCount.toLocaleString()} documents
                        </p>
                      </div>
                      {source.lastSyncedAt && (
                        <p className="shrink-0 text-muted-foreground text-xs">
                          {formatRelativeTime(new Date(source.lastSyncedAt))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sources.length === 0 && (
                <div className="border-border/30 border-l-2 pl-6">
                  <div className="p-3 text-center text-muted-foreground text-xs">
                    No sources connected yet
                  </div>
                </div>
              )}
            </div>
          )}

          {!store && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No store configured yet</p>
              <p className="mt-1 text-xs">Connect a source to create a store</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthIndicator({
  status,
}: {
  status: "healthy" | "degraded" | "down";
}) {
  const config = {
    healthy: {
      icon: CheckCircle,
      className: "text-green-600",
    },
    degraded: {
      icon: AlertCircle,
      className: "text-yellow-600",
    },
    down: {
      icon: XCircle,
      className: "text-red-600",
    },
  };

  const { icon: Icon, className } = config[status];

  return <Icon className={cn("h-4 w-4 shrink-0", className)} />;
}

function SourceIcon({ type }: { type: string }) {
  // Map source types to icons
  const iconMap = {
    github: Github,
    default: Database,
  };

  const lowerType = type.toLowerCase();
  const Icon: typeof Database =
    lowerType in iconMap
      ? iconMap[lowerType as keyof typeof iconMap]
      : iconMap.default;

  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}
