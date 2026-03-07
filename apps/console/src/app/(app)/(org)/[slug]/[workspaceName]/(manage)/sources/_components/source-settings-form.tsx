"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Label } from "@repo/ui/components/ui/label";
import { Button } from "@repo/ui/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { PROVIDERS } from "@repo/console-providers";
import type { CategoryDef, SourceType } from "@repo/console-providers";
import { BACKFILL_DEPTH_OPTIONS } from "@repo/console-validation";
import type { Source } from "~/types";

interface SourceSettingsFormProps {
	installationId: string;
	integrationId: string;
	provider: SourceType;
	currentEvents: string[];
	backfillConfig: Source["backfillConfig"];
}

export function SourceSettingsForm({
	installationId,
	integrationId,
	provider,
	currentEvents,
	backfillConfig,
}: SourceSettingsFormProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const eventConfig = PROVIDERS[provider].categories;
	const allEventKeys = Object.keys(eventConfig);

	// Backwards compat: empty array = all events
	const activeEvents = currentEvents.length === 0 ? allEventKeys : currentEvents;
	const showPushWarning = provider === "github" && !activeEvents.includes("push");

	// Available entity types come from provider categories
	const availableEntityTypes = allEventKeys;

	// Backfill config state — initialize from stored config or select all as default
	type BackfillDepth = (typeof BACKFILL_DEPTH_OPTIONS)[number];
	const [depth, setDepth] = useState<BackfillDepth>(backfillConfig?.depth ?? 30);
	const [entityTypes, setEntityTypes] = useState<string[]>(
		backfillConfig?.entityTypes ?? availableEntityTypes,
	);

	const initialDepth = backfillConfig?.depth ?? 30;
	const initialEntityTypes = backfillConfig?.entityTypes ?? availableEntityTypes;
	const isDirty =
		depth !== initialDepth ||
		JSON.stringify([...entityTypes].sort()) !== JSON.stringify([...initialEntityTypes].sort());

	const updateMutation = useMutation(
		trpc.connections.updateBackfillConfig.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries({
					queryKey: [["workspace", "sources", "list"]],
				});
			},
		}),
	);

	function toggleEntityType(type: string) {
		setEntityTypes((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
		);
	}

	function handleSave() {
		if (entityTypes.length === 0) return;
		updateMutation.mutate({
			installationId,
			backfillConfig: { depth, entityTypes },
		});
	}

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
				{(Object.entries(eventConfig) as [string, CategoryDef][]).map(([event, config]) => (
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

				<div className="space-y-3">
					<div>
						<p className="text-xs text-muted-foreground mb-1">Depth</p>
						<Select
							value={depth.toString()}
							onValueChange={(v) => {
							const parsed = Number(v);
							const valid = BACKFILL_DEPTH_OPTIONS.find((d) => d === parsed);
							if (valid) setDepth(valid);
						}}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{BACKFILL_DEPTH_OPTIONS.map((d) => (
									<SelectItem key={d} value={d.toString()}>
										{d} days
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{availableEntityTypes.length > 0 && (
						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								Entity Types
							</p>
							<div className="flex flex-wrap gap-1.5">
								{availableEntityTypes.map((type) => {
									const active = entityTypes.includes(type);
									return (
										<Badge
											key={type}
											variant={active ? "secondary" : "outline"}
											className={cn(
												"text-xs cursor-pointer select-none",
												!active && "opacity-50",
											)}
											onClick={() => toggleEntityType(type)}
										>
											{type}
										</Badge>
									);
								})}
							</div>
							{entityTypes.length === 0 && (
								<p className="text-xs text-destructive mt-1">
									At least one entity type must be selected.
								</p>
							)}
						</div>
					)}

					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							variant="outline"
							disabled={
								!isDirty ||
								entityTypes.length === 0 ||
								updateMutation.isPending
							}
							onClick={handleSave}
						>
							{updateMutation.isPending ? "Saving..." : "Save"}
						</Button>
						{updateMutation.isSuccess && !isDirty && (
							<span className="text-xs text-muted-foreground">Saved</span>
						)}
						{updateMutation.isError && (
							<span className="text-xs text-destructive">Failed to save</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
