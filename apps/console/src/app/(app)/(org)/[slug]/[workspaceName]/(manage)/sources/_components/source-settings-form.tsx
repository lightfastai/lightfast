"use client";

import {
	useFormCompat,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@repo/ui/components/ui/form";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
	GITHUB_EVENTS,
	VERCEL_EVENTS,
	LINEAR_EVENTS,
	SENTRY_EVENTS,
	ALL_GITHUB_EVENTS,
	ALL_VERCEL_EVENTS,
	ALL_LINEAR_EVENTS,
	ALL_SENTRY_EVENTS,
} from "@repo/console-types";

interface EventConfig {
	label: string;
	description: string;
	type: "observation" | "sync+observation";
}

interface SourceSettingsFormProps {
	integrationId: string;
	provider: "github" | "vercel" | "linear" | "sentry";
	currentEvents: string[];
	backfillConfig: { depth: 7 | 30 | 90; entityTypes: string[] } | null;
}

export function SourceSettingsForm({
	integrationId,
	provider,
	currentEvents,
	backfillConfig,
}: SourceSettingsFormProps) {
	const allEvents =
		provider === "github" ? ALL_GITHUB_EVENTS :
		provider === "vercel" ? ALL_VERCEL_EVENTS :
		provider === "linear" ? ALL_LINEAR_EVENTS :
		ALL_SENTRY_EVENTS;

	const eventConfig: Record<string, EventConfig> =
		provider === "github" ? GITHUB_EVENTS :
		provider === "vercel" ? VERCEL_EVENTS :
		provider === "linear" ? LINEAR_EVENTS :
		SENTRY_EVENTS;

	// Backwards compat: empty array = all events
	const initialEvents = currentEvents.length === 0
		? (allEvents as string[])
		: currentEvents;

	const form = useFormCompat({
		defaultValues: {
			events: initialEvents,
			backfillDepth: backfillConfig?.depth.toString() ?? "",
		},
	});

	const selectedEvents = form.watch("events");
	const showPushWarning = provider === "github" && !selectedEvents.includes("push");

	return (
		<Form {...form}>
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
					{allEvents.map((event) => {
						const config = eventConfig[event];
						if (!config) return null;
						return (
							<FormField
								key={event}
								control={form.control}
								name="events"
								render={({ field }) => (
									<FormItem className="flex items-start gap-3">
										<FormControl>
											<Checkbox
												id={`${integrationId}-${event}`}
												checked={field.value.includes(event)}
												disabled
											/>
										</FormControl>
										<div className="grid gap-0.5 leading-none">
											<FormLabel
												htmlFor={`${integrationId}-${event}`}
												className="text-sm font-medium"
											>
												{config.label}
												{config.type === "sync+observation" && (
													<span className="ml-2 text-xs text-muted-foreground">
														(sync + observation)
													</span>
												)}
											</FormLabel>
											<p className="text-xs text-muted-foreground">
												{config.description}
											</p>
										</div>
									</FormItem>
								)}
							/>
						);
					})}
				</div>

				{/* Backfill Configuration */}
				<div className="mt-5 pt-4 border-t border-border/50">
					<div className="text-sm font-medium text-foreground mb-3">
						Backfill Configuration
					</div>

					{backfillConfig ? (
						<div className="space-y-3">
							<FormField
								control={form.control}
								name="backfillDepth"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs text-muted-foreground">
											Depth
										</FormLabel>
										<Select
											value={field.value}
											disabled
										>
											<FormControl>
												<SelectTrigger className="w-[200px] bg-muted/50">
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="7">7 days</SelectItem>
												<SelectItem value="30">30 days</SelectItem>
												<SelectItem value="90">90 days</SelectItem>
											</SelectContent>
										</Select>
									</FormItem>
								)}
							/>

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
		</Form>
	);
}
