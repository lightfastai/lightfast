"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Github,
  Globe,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { EnrichedConnection, Source } from "~/types";

interface ConnectedSourcesOverviewProps {
  connections?: EnrichedConnection[];
  sources?: Source[];
}

/**
 * Get status configuration for display
 */
function getStatusConfig(status: string | null) {
  const statusMap = {
    pending: {
      icon: Clock,
      color: "text-yellow-600 dark:text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      label: "Pending",
    },
    in_progress: {
      icon: Loader2,
      color: "text-blue-600 dark:text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      label: "Syncing",
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      label: "Synced",
    },
    failed: {
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      label: "Failed",
    },
  };

  const mappedStatus = status as keyof typeof statusMap;
  if (mappedStatus in statusMap) {
    return statusMap[mappedStatus];
  }
  return {
    icon: Clock,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950/20",
    label: "Unknown",
  };
}

/**
 * Source Item Component
 */
function SourceItem({ connection }: { connection: EnrichedConnection }) {
  const resource = connection.resource;
  const resourceData = resource.resourceData;
  const statusConfig = getStatusConfig(connection.lastSyncStatus);
  const StatusIcon = statusConfig.icon;

  // Get display info based on sourceType
  let displayName = "";
  let detailsUrl = "";

  if (resourceData.sourceType === "github") {
    displayName = resourceData.repoFullName;
    detailsUrl = `https://github.com/${resourceData.repoFullName}`;
  } else if (resourceData.sourceType === "vercel") {
    displayName = resourceData.projectName;
    detailsUrl = resourceData.teamSlug
      ? `https://vercel.com/${resourceData.teamSlug}/${resourceData.projectName}`
      : "https://vercel.com/dashboard";
  } else if (resourceData.sourceType === "sentry") {
    displayName = resourceData.projectSlug;
    detailsUrl = "https://sentry.io";
  } else {
    // Linear
    displayName = resourceData.teamName;
    detailsUrl = "https://linear.app";
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="rounded-full bg-muted p-2">
          {resourceData.sourceType === "github" ? (
            <Github className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-sm">{displayName}</p>
            {detailsUrl && (
              <Link
                className="text-muted-foreground transition-colors hover:text-foreground"
                href={detailsUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge className="text-xs" variant="secondary">
              {resourceData.sourceType}
            </Badge>
            {resourceData.sourceType === "github" && (
              <Badge className="text-xs" variant="outline">
                {resourceData.defaultBranch}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`rounded-full p-1 ${statusConfig.bgColor}`}>
          <StatusIcon
            className={`h-3 w-3 ${statusConfig.color} ${connection.lastSyncStatus === "pending" ? "animate-spin" : ""}`}
          />
        </div>
        <span className={`font-medium text-xs ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Simple Source Item for workspace.sources.list
 */
function SimpleSourceItem({ source }: { source: Source }) {
  // Check if this source is awaiting configuration
  const metadata = source.metadata as
    | {
        status?: {
          configStatus?: "configured" | "awaiting_config";
        };
      }
    | null
    | undefined;
  const isAwaitingConfig = metadata?.status?.configStatus === "awaiting_config";

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="rounded-full bg-muted p-2">
          {source.type === "github" ? (
            <Github className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-sm">{source.displayName}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge className="text-xs" variant="secondary">
              {source.type}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {source.documentCount}{" "}
              {source.documentCount === 1 ? "doc" : "docs"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isAwaitingConfig ? (
          <>
            <div className="rounded-full bg-amber-50 p-1 dark:bg-amber-950/20">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-500" />
            </div>
            <span className="font-medium text-amber-600 text-xs dark:text-amber-500">
              Needs config
            </span>
          </>
        ) : source.lastSyncedAt ? (
          <>
            <div className="rounded-full bg-green-50 p-1 dark:bg-green-950/20">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
            </div>
            <span className="font-medium text-green-600 text-xs dark:text-green-500">
              Synced
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Connected Sources Overview Component
 *
 * Displays all connected sources grouped by provider with sync status.
 */
export function ConnectedSourcesOverview({
  connections,
  sources,
}: ConnectedSourcesOverviewProps) {
  // If sources prop is provided (from workspace.sources.list), use simple layout
  if (sources) {
    const totalSources = sources.length;

    // Count sources awaiting configuration
    const awaitingConfigCount = sources.filter((s) => {
      const metadata = s.metadata as
        | {
            status?: {
              configStatus?: "configured" | "awaiting_config";
            };
          }
        | null
        | undefined;
      return metadata?.status?.configStatus === "awaiting_config";
    }).length;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-medium text-base">
                Connected Sources
              </CardTitle>
              <CardDescription className="mt-1">
                {totalSources === 0
                  ? "No sources connected yet"
                  : `${totalSources} source${totalSources === 1 ? "" : "s"} connected`}
              </CardDescription>
              {awaitingConfigCount > 0 && (
                <p className="mt-1 text-amber-600 text-sm dark:text-amber-500">
                  {awaitingConfigCount} source
                  {awaitingConfigCount === 1 ? "" : "s"} awaiting configuration
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalSources === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">
                Connect your first source to start building your workspace
                memory.
              </p>
              <Link
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                href="/account/teams/new"
              >
                Connect Source
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sources.map((source) => (
                <SimpleSourceItem key={source.id} source={source} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Otherwise use the full connections layout
  if (!connections) {
    return null;
  }

  // Group by sourceType
  const groupedBySourceType = connections.reduce(
    (acc, connection) => {
      const sourceType = connection.resource.resourceData.sourceType;
      acc[sourceType] = acc[sourceType] ?? [];
      acc[sourceType].push(connection);
      return acc;
    },
    {} as Record<string, EnrichedConnection[]>
  );

  // Calculate stats in a single pass
  const totalSources = connections.length;
  let syncedCount = 0;
  let syncingCount = 0;
  let failedCount = 0;
  for (const c of connections) {
    if (c.lastSyncStatus === "success") {
      syncedCount++;
    } else if (c.lastSyncStatus === "pending") {
      syncingCount++;
    } else if (c.lastSyncStatus === "failed") {
      failedCount++;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connected Sources</CardTitle>
            <CardDescription className="mt-1">
              {totalSources === 0
                ? "No sources connected yet"
                : `${totalSources} source${totalSources === 1 ? "" : "s"} connected`}
            </CardDescription>
          </div>
          {totalSources > 0 && (
            <div className="flex gap-2">
              {syncedCount > 0 && (
                <Badge
                  className="bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300"
                  variant="secondary"
                >
                  {syncedCount} synced
                </Badge>
              )}
              {syncingCount > 0 && (
                <Badge
                  className="bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
                  variant="secondary"
                >
                  {syncingCount} syncing
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge
                  className="bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                  variant="secondary"
                >
                  {failedCount} failed
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalSources === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-muted-foreground">
              Connect your first source to start building your workspace memory.
            </p>
            <Link
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
              href="/account/teams/new"
            >
              Connect Source
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedBySourceType).map(
              ([sourceType, sources]) => (
                <div key={sourceType}>
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-sm capitalize">
                    {sourceType === "github" ? (
                      <Github className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    {sourceType} ({sources.length})
                  </h4>
                  <div className="space-y-2">
                    {sources.map((connection) => (
                      <SourceItem connection={connection} key={connection.id} />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
