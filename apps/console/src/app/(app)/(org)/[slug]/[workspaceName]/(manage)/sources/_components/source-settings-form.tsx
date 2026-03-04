"use client";

import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Label } from "@repo/ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { EVENT_CATEGORIES } from "@repo/console-types";
import type { SourceType } from "@repo/console-validation";
import type { Source } from "~/types";

interface SourceSettingsFormProps {
	integrationId: string;
	provider: SourceType;
	currentEvents: string[];
	backfillConfig: Source["backfillConfig"];
}

export function SourceSettingsForm({
	integrationId,
	provider,
	currentEvents,
	backfillConfig,
}: SourceSettingsFormProps) {
	const eventConfig = EVENT_CATEGORIES[provider];
	const allEventKeys = Object.keys(eventConfig);

	// Backwards compat: empty array = all events
	const activeEvents = currentEvents.length === 0 ? allEventKeys : currentEvents;
	const showPushWarning = provider === "github" && !activeEvents.includes("push");

	return (
		<div className="pt-3 pb-4 px-4 border-t border-border/50 bg-card/40">
			{/* Event Subscriptions */}
			<div className="text-sm font-medium text-foreground mb-3">
				Event Subscriptions
			</div>

			{showPushWarning && (
				<Alert variant="destructive" className="mb-3">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						Push events are disabled — file syncing is stopped for this repository.
					</AlertDescription>
				</Alert>
			)}

			{/* 2-column event grid */}
			<div className="grid grid-cols-2 gap-x-6 gap-y-2">
				{Object.entries(eventConfig).map(([event, config]) => (
					<div key={event} className="flex items-start gap-3">
						<Checkbox
							id={`${integrationId}-${event}`}
							checked={activeEvents.includes(event)}
							disabled
						/>
						<div className="grid gap-0.5 leading-none">
							<Label
								htmlFor={`${integrationId}-${event}`}
								className="text-sm font-medium"
							>
								{config.label}
								{config.type === "sync+observation" && (
									<span className="ml-2 text-xs text-muted-foreground">
										(sync + observation)
									</span>
								)}
							</Label>
							<p className="text-xs text-muted-foreground">
								{config.description}
							</p>
						</div>
					</div>
				))}
			</div>

			{/* Backfill Configuration */}
			<div className="mt-5 pt-4 border-t border-border/50">
				<div className="text-sm font-medium text-foreground mb-3">
					Backfill Configuration
				</div>

				{backfillConfig ? (
					<div className="space-y-3">
						<div>
							<p className="text-xs text-muted-foreground mb-1">Depth</p>
							<Select value={backfillConfig.depth.toString()} disabled>
								<SelectTrigger className="w-[200px] bg-muted/50">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="7">7 days</SelectItem>
									<SelectItem value="30">30 days</SelectItem>
									<SelectItem value="90">90 days</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								Entity Types
							</p>
							<div className="flex flex-wrap gap-1.5">
								{backfillConfig.entityTypes.map((type) => (
									<Badge
										key={type}
										variant="secondary"
										className="text-xs"
									>
										{type}
									</Badge>
								))}
							</div>
						</div>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						No backfill configured for this installation.
					</p>
				)}
			</div>
		</div>
	);
}
