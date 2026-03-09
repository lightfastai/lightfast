"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CheckCircle2, Settings } from "lucide-react";
import { DashboardSettings } from "./dashboard-settings";
import { DashboardTimeRangeSelector } from "./dashboard-time-range-selector";

interface WorkspaceHeaderProps {
  orgSlug: string;
  sourcesConnected: number;
  workspaceName: string;
  workspaceUrlName: string;
}

export function WorkspaceHeader({
  workspaceName,
  workspaceUrlName,
  sourcesConnected,
  orgSlug,
}: WorkspaceHeaderProps) {
  return (
    <Card className="border-border/60 p-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate font-semibold text-xl">{workspaceName}</h1>
            <Badge className="shrink-0 gap-1.5" variant="outline">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              Active
            </Badge>
          </div>
          <div className="hidden h-4 w-px shrink-0 bg-border sm:block" />
          <div className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">
              {sourcesConnected}
            </span>{" "}
            {sourcesConnected === 1 ? "source" : "sources"} connected
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
          {/* Time Range Selector */}
          <DashboardTimeRangeSelector />
          <div className="flex-1 sm:flex-none" />
          {/* Dashboard Settings */}
          <DashboardSettings />
          {/* Workspace Settings */}
          <Button asChild size="sm" variant="ghost">
            <a href={`/${orgSlug}/${workspaceUrlName}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
