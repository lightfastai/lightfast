"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Github, CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { RouterOutputs } from "@repo/console-trpc/types";

type EnrichedConnection = RouterOutputs["integration"]["workspace"]["list"][number];

interface Source {
	id: string;
	type: string;
	displayName: string;
	documentCount: number;
	lastSyncedAt: string | null;
	lastIngestedAt: string | null;
}

interface ConnectedSourcesOverviewProps {
  connections?: EnrichedConnection[];
  sources?: Source[];
  orgSlug?: string;
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

  return statusMap[status as keyof typeof statusMap] ?? {
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
  if (!resource) return null;

  const resourceData = resource.resourceData;
  const statusConfig = getStatusConfig(connection.lastSyncStatus);
  const StatusIcon = statusConfig.icon;

  // Get display info based on provider
  let displayName = "";
  let providerIcon = Github;
  let detailsUrl = "";

  if (resourceData.provider === "github" && resourceData.type === "repository") {
    displayName = resourceData.repoFullName;
    providerIcon = Github;
    detailsUrl = `https://github.com/${resourceData.repoFullName}`;
  } else if (resourceData.provider === "linear" && resourceData.type === "team") {
    displayName = resourceData.teamName;
  } else if (resourceData.provider === "notion") {
    displayName = resourceData.pageName;
  } else if (resourceData.provider === "sentry" && resourceData.type === "project") {
    displayName = `${resourceData.orgSlug}/${resourceData.projectSlug}`;
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="rounded-full bg-muted p-2">
          <Github className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {detailsUrl && (
              <Link
                href={detailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {resourceData.provider}
            </Badge>
            {resourceData.provider === "github" && resourceData.type === "repository" && (
              <Badge variant="outline" className="text-xs">
                {resourceData.defaultBranch}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`rounded-full p-1 ${statusConfig.bgColor}`}>
          <StatusIcon
            className={`h-3 w-3 ${statusConfig.color} ${connection.lastSyncStatus === "in_progress" ? "animate-spin" : ""}`}
          />
        </div>
        <span className={`text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Simple Source Item for workspace.statistics sources
 */
function SimpleSourceItem({ source }: { source: Source }) {
  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "github":
        return Github;
      default:
        return Github;
    }
  };

  const SourceIcon = getSourceIcon(source.type);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="rounded-full bg-muted p-2">
          <SourceIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{source.displayName}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {source.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {source.documentCount} {source.documentCount === 1 ? "doc" : "docs"}
            </span>
          </div>
        </div>
      </div>
      {source.lastSyncedAt && (
        <div className="flex items-center gap-2">
          <div className="rounded-full p-1 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
          </div>
          <span className="text-xs font-medium text-green-600 dark:text-green-500">
            Synced
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Connected Sources Overview Component
 *
 * Displays all connected sources grouped by provider with sync status.
 */
export function ConnectedSourcesOverview({ connections, sources, orgSlug }: ConnectedSourcesOverviewProps) {
  // If sources prop is provided (from workspace.statistics), use simple layout
  if (sources) {
    const totalSources = sources.length;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Connected Sources</CardTitle>
              <CardDescription className="mt-1">
                {totalSources === 0
                  ? "No sources connected yet"
                  : `${totalSources} source${totalSources === 1 ? "" : "s"} connected`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalSources === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Connect your first source to start building your workspace memory.
              </p>
              <Link
                href="/account/teams/new"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
  if (!connections) return null;

  // Group by provider
  const groupedByProvider = connections.reduce(
    (acc, connection) => {
      const provider = connection.resource?.resourceData?.provider ?? "unknown";
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(connection);
      return acc;
    },
    {} as Record<string, EnrichedConnection[]>
  );

  // Calculate stats
  const totalSources = connections.length;
  const syncedCount = connections.filter((c) => c.lastSyncStatus === "completed").length;
  const syncingCount = connections.filter((c) =>
    ["pending", "in_progress"].includes(c.lastSyncStatus ?? "")
  ).length;
  const failedCount = connections.filter((c) => c.lastSyncStatus === "failed").length;

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
                <Badge variant="secondary" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                  {syncedCount} synced
                </Badge>
              )}
              {syncingCount > 0 && (
                <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                  {syncingCount} syncing
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="secondary" className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
                  {failedCount} failed
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalSources === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Connect your first source to start building your workspace memory.
            </p>
            <Link
              href="/account/teams/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Connect Source
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.entries(groupedByProvider) as [string, EnrichedConnection[]][]).map(([provider, sources]) => (
              <div key={provider}>
                <h4 className="text-sm font-semibold mb-2 capitalize flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  {provider} ({sources.length})
                </h4>
                <div className="space-y-2">
                  {sources.map((connection) => (
                    <SourceItem key={connection.id} connection={connection} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
