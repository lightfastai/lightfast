"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Key,
  Play,
  Settings,
  Shield,
  User,
  Users,
  Webhook,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { ActivityCategory, ActorType, WorkspaceActivity } from "~/types";

interface ActivityTimelineProps {
  activities: WorkspaceActivity[];
  isLoading?: boolean;
}

export function ActivityTimeline({
  activities,
  isLoading,
}: ActivityTimelineProps) {
  const [expandedActivityId, setExpandedActivityId] = useState<number | null>(
    null
  );
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Category icon mapping
  const getCategoryIcon = (category: ActivityCategory) => {
    switch (category) {
      case "auth":
        return Shield;
      case "workspace":
        return Briefcase;
      case "integration":
        return GitBranch;
      case "store":
        return Database;
      case "job":
        return Play;
      case "search":
        return FileText;
      case "document":
        return FileText;
      case "permission":
        return Shield;
      case "api_key":
        return Key;
      case "settings":
        return Settings;
      default:
        return Activity;
    }
  };

  // Actor type icon mapping
  const getActorIcon = (actorType: ActorType) => {
    switch (actorType) {
      case "user":
        return User;
      case "system":
        return Cpu;
      case "webhook":
        return Webhook;
      case "api":
        return Key;
      default:
        return Users;
    }
  };

  // Status color based on action
  const getActionColor = (action: string) => {
    if (action.includes("created") || action.includes("connected")) {
      return "green";
    }
    if (
      action.includes("deleted") ||
      action.includes("disconnected") ||
      action.includes("cancelled")
    ) {
      return "red";
    }
    if (action.includes("updated") || action.includes("restarted")) {
      return "blue";
    }
    if (action.includes("failed")) {
      return "red";
    }
    return "gray";
  };

  // Get status icon with color
  const getStatusIcon = (action: string) => {
    const color = getActionColor(action);

    const iconClass = `h-4 w-4 ${
      color === "green"
        ? "text-green-600 dark:text-green-400"
        : color === "red"
          ? "text-red-600 dark:text-red-400"
          : color === "blue"
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-400"
    }`;

    const bgClass = `flex h-8 w-8 items-center justify-center rounded-full ${
      color === "green"
        ? "bg-green-100 dark:bg-green-900/30"
        : color === "red"
          ? "bg-red-100 dark:bg-red-900/30"
          : color === "blue"
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "bg-gray-100 dark:bg-gray-900/30"
    }`;

    if (action.includes("created") || action.includes("connected")) {
      return (
        <div className={bgClass}>
          <CheckCircle2 className={iconClass} />
        </div>
      );
    }
    if (
      action.includes("deleted") ||
      action.includes("disconnected") ||
      action.includes("cancelled")
    ) {
      return (
        <div className={bgClass}>
          <XCircle className={iconClass} />
        </div>
      );
    }
    if (action.includes("failed")) {
      return (
        <div className={bgClass}>
          <AlertCircle className={iconClass} />
        </div>
      );
    }

    const Icon = getCategoryIcon(action as ActivityCategory);
    return (
      <div className={bgClass}>
        <Icon className={iconClass} />
      </div>
    );
  };

  // Get badge for category
  const getCategoryBadge = (category: ActivityCategory) => {
    const variants: Record<
      ActivityCategory,
      {
        label: string;
        variant: "default" | "secondary" | "outline" | "destructive";
      }
    > = {
      auth: { label: "Auth", variant: "outline" },
      workspace: { label: "Workspace", variant: "default" },
      integration: { label: "Integration", variant: "secondary" },
      store: { label: "Store", variant: "outline" },
      job: { label: "Job", variant: "default" },
      search: { label: "Search", variant: "outline" },
      document: { label: "Document", variant: "outline" },
      permission: { label: "Permission", variant: "destructive" },
      api_key: { label: "API Key", variant: "secondary" },
      settings: { label: "Settings", variant: "outline" },
    };

    const config = variants[category];
    return (
      <Badge className="text-xs" variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  // Format action name for display
  const formatAction = (action: string) => {
    return action
      .split(".")
      .pop()
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Filter activities
  const filteredActivities =
    filterCategory === "all"
      ? activities
      : activities.filter((a) => a.category === filterCategory);

  // Limit to 20 most recent
  const displayActivities = filteredActivities.slice(0, 20);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-medium text-base">
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Activity className="mx-auto mb-2 h-8 w-8 animate-pulse opacity-50" />
            <p>Loading activity...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-medium text-base">
            Activity Timeline
          </CardTitle>
          <Select onValueChange={setFilterCategory} value={filterCategory}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
              <SelectItem value="store">Store</SelectItem>
              <SelectItem value="job">Job</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="permission">Permission</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Activity className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No recent activity</p>
            <p className="mt-1 text-xs">
              {filterCategory === "all"
                ? "Activities will appear here as you work"
                : `No ${filterCategory} activities found`}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {displayActivities.map((activity, index) => {
              const ActorIcon = getActorIcon(activity.actorType);

              return (
                <Collapsible
                  key={activity.id}
                  onOpenChange={(open) =>
                    setExpandedActivityId(open ? activity.id : null)
                  }
                  open={expandedActivityId === activity.id}
                >
                  <div className="relative">
                    {/* Timeline connector line */}
                    {index < displayActivities.length - 1 && (
                      <div className="absolute top-8 bottom-0 left-4 w-px bg-border" />
                    )}

                    <div className="flex items-start gap-4 py-3">
                      {/* Status Icon */}
                      <div className="relative z-10 shrink-0">
                        {getStatusIcon(activity.action)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <Button
                                className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                                size="sm"
                                variant="ghost"
                              >
                                <span className="truncate">
                                  {formatAction(activity.action)}
                                </span>
                                {expandedActivityId === activity.id ? (
                                  <ChevronDown className="ml-1 h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            {getCategoryBadge(activity.category)}
                          </div>

                          {/* Timestamp */}
                          <span className="shrink-0 text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(activity.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-muted-foreground text-xs">
                          <span className="flex items-center gap-1">
                            <ActorIcon className="h-3 w-3" />
                            {activity.actorType === "user"
                              ? (activity.actorEmail ?? "Unknown user")
                              : activity.actorType}
                          </span>
                          <span>•</span>
                          <span>{activity.entityType}</span>
                        </div>

                        {/* Expandable details */}
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-medium text-muted-foreground">
                                  Activity ID:
                                </span>
                                <p className="mt-0.5 font-mono text-[10px]">
                                  {activity.id}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">
                                  Timestamp:
                                </span>
                                <p className="mt-0.5">
                                  {new Date(
                                    activity.timestamp
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">
                                  Entity ID:
                                </span>
                                <p className="mt-0.5 font-mono text-[10px]">
                                  {activity.entityId}
                                </p>
                              </div>
                              {activity.entityName && (
                                <div>
                                  <span className="font-medium text-muted-foreground">
                                    Entity Name:
                                  </span>
                                  <p className="mt-0.5">
                                    {activity.entityName}
                                  </p>
                                </div>
                              )}
                            </div>
                            {Object.keys(activity.metadata).length > 0 && (
                              <div className="border-t pt-2">
                                <span className="font-medium text-muted-foreground">
                                  Details:
                                </span>
                                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px]">
                                  {JSON.stringify(activity.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
