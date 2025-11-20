"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { CheckCircle2, Settings } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { DashboardTimeRangeSelector } from "./dashboard-time-range-selector";
import { DashboardSettings } from "./dashboard-settings";

interface WorkspaceHeaderProps {
	workspaceName: string;
	workspaceSlug: string;
	sourcesConnected: number;
	orgSlug: string;
}

export function WorkspaceHeader({
	workspaceName,
	workspaceSlug,
	sourcesConnected,
	orgSlug,
}: WorkspaceHeaderProps) {
	return (
		<Card className="p-4 border-border/60">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
					<div className="flex items-center gap-3 flex-wrap">
						<h1 className="text-xl font-semibold truncate">{workspaceName}</h1>
						<Badge variant="outline" className="gap-1.5 shrink-0">
							<CheckCircle2 className="h-3 w-3 text-green-600" />
							Active
						</Badge>
					</div>
					<div className="hidden sm:block h-4 w-px bg-border shrink-0" />
					<div className="text-sm text-muted-foreground">
						<span className="font-medium text-foreground">
							{sourcesConnected}
						</span>{" "}
						{sourcesConnected === 1 ? "source" : "sources"} connected
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
					{/* Time Range Selector */}
					<DashboardTimeRangeSelector />
					<div className="flex-1 sm:flex-none" />
					{/* Dashboard Settings */}
					<DashboardSettings />
					{/* Workspace Settings */}
					<Button variant="ghost" size="sm" asChild>
						<a href={`/${orgSlug}/${workspaceSlug}/settings`}>
							<Settings className="h-4 w-4 mr-2" />
							Settings
						</a>
					</Button>
				</div>
			</div>
		</Card>
	);
}
