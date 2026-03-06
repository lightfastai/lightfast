"use client";

import { useState } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { cn } from "@repo/ui/lib/utils";
import { Search, Circle, ChevronDown, ChevronRight, AlertTriangle, Plus } from "lucide-react";
import { ConfigTemplateDialog } from "~/components/config-template-dialog";
import type { SourceType } from "@repo/console-providers";
import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/console-providers/display";
import { ProviderIcon } from "~/lib/provider-icon";
import { getResourceLabel } from "~/lib/resource-label";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import type { Source } from "~/types";
import { SourceSettingsForm } from "./source-settings-form";

interface InstalledSourcesProps {
	clerkOrgSlug: string;
	workspaceName: string;
	initialSearch?: string;
	initialStatus?: "all" | "active" | "inactive";
}

export function InstalledSources({
	clerkOrgSlug,
	workspaceName,
	initialSearch = "",
	initialStatus = "all",
}: InstalledSourcesProps) {
	const trpc = useTRPC();

	const [filters, setFilters] = useQueryStates(
		{
			search: parseAsString.withDefault(initialSearch),
			status: parseAsStringEnum<"all" | "active" | "inactive">(["all", "active", "inactive"]).withDefault(initialStatus),
		},
		{
			history: "push",
			shallow: true,
		}
	);

	const { data: sourcesData } = useSuspenseQuery({
		...trpc.workspace.sources.list.queryOptions({
			clerkOrgSlug,
			workspaceName,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const integrations = sourcesData.list;

	// Filter integrations
	const searchLower = filters.search.toLowerCase();
	const filteredIntegrations = integrations.filter((integration) => {
		const { metadata } = integration;
		const providerLabel = PROVIDER_DISPLAY[metadata.sourceType].displayName;
		const resourceLabel = getResourceLabel(metadata);
		const searchTarget = `${providerLabel}/${resourceLabel}`.toLowerCase();

		const matchesSearch = !searchLower || searchTarget.includes(searchLower);
		const matchesStatus = filters.status === "all" || filters.status === "active";

		return matchesSearch && matchesStatus;
	});

	// Group by provider — sourceType is always a known SourceType, no "unknown" handling needed
	const grouped = new Map<SourceType, Source[]>();
	for (const integration of filteredIntegrations) {
		const type = integration.metadata.sourceType;
		const list = grouped.get(type) ?? [];
		list.push(integration);
		grouped.set(type, list);
	}

	const sortedGroups = PROVIDER_SLUGS
		.filter((p) => grouped.has(p))
		.map((p) => ({ provider: p, resources: grouped.get(p) ?? [] }));

	return (
		<div className="space-y-4">
			{/* Filter bar */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search integrations..."
						value={filters.search}
						onChange={(e) => setFilters({ search: e.target.value })}
						className="pl-9"
					/>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="w-[150px] justify-between">
							<span className="text-left">
								{filters.status === "all" && "All Integrations"}
								{filters.status === "active" && "Active Only"}
								{filters.status === "inactive" && "Inactive Only"}
							</span>
							<ChevronDown className="h-3.5 w-3.5 shrink-0" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => setFilters({ status: "all" })}>
							All Integrations
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setFilters({ status: "active" })}>
							Active Only
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setFilters({ status: "inactive" })}>
							Inactive Only
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Provider-grouped list */}
			{sortedGroups.length === 0 ? (
				<div className="rounded-lg border p-12 text-center">
					<p className="text-sm text-muted-foreground">
						{filters.search
							? `No integrations found matching "${filters.search}"`
							: "No integrations installed yet"}
					</p>
					{!filters.search && (
						<Button asChild variant="outline" size="sm" className="mt-4">
							<Link href={`/${clerkOrgSlug}/${workspaceName}/sources/new`}>
								<Plus className="h-4 w-4 mr-2" />
								Add Source
							</Link>
						</Button>
					)}
				</div>
			) : (
				<Accordion type="multiple" className="w-full rounded-lg border">
					{sortedGroups.map(({ provider, resources }) => {
						const display = PROVIDER_DISPLAY[provider];

						return (
							<AccordionItem key={provider} value={provider}>
								<AccordionTrigger className="px-4 hover:no-underline">
									<div className="flex items-center gap-3 flex-1">
										<ProviderIcon icon={display.icon} className="h-5 w-5 shrink-0" />
										<span className="font-medium">{display.displayName}</span>
										<Badge variant="secondary" className="text-xs">
											{resources.length} connected
										</Badge>
									</div>
								</AccordionTrigger>
								<AccordionContent className="px-0 pb-0">
									<div className="divide-y border-t">
										{resources.map((resource) => (
											<ResourceRow
												key={resource.id}
												integration={resource}
											/>
										))}
									</div>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			)}
		</div>
	);
}

function ResourceRow({ integration }: { integration: Source }) {
	const [isOpen, setIsOpen] = useState(false);
	const { metadata } = integration;

	const isAwaitingConfig = metadata.sourceType === "github" && metadata.status?.configStatus === "awaiting_config";
	const isPrivate = metadata.sourceType === "github" && metadata.isPrivate;
	const subscribedEvents = metadata.sync.events ?? [];
	const eventLabel = subscribedEvents.length === 0 ? "All events" : `${subscribedEvents.length} events`;
	const resourceName = getResourceLabel(metadata);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
				>
					<div className="flex items-center gap-2.5 min-w-0 flex-1">
						<Circle
							className={cn(
								"h-2 w-2 fill-current shrink-0",
								isAwaitingConfig ? "text-amber-500" : "text-green-500"
							)}
						/>
						<span className="text-sm font-medium truncate">{resourceName}</span>
						{isPrivate && (
							<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
								Private
							</span>
						)}
						{metadata.sourceType === "linear" && (
							<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
								{metadata.teamKey}
							</span>
						)}
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-3">
						{integration.documentCount > 0 && (
							<span className="text-xs text-muted-foreground">
								{integration.documentCount.toLocaleString()} docs
							</span>
						)}
						<span className="text-xs text-muted-foreground">{eventLabel}</span>
						<ChevronRight
							className={cn(
								"h-3.5 w-3.5 text-muted-foreground transition-transform",
								isOpen && "rotate-90"
							)}
						/>
					</div>
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent>
				{isAwaitingConfig && (
					<div className="mx-4 mb-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
						<div className="flex items-start gap-2">
							<AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
							<div className="text-xs flex-1">
								<p className="font-medium text-amber-800 dark:text-amber-200">
									Configuration Required
								</p>
								<p className="text-amber-700 dark:text-amber-300 mt-0.5">
									Add a{" "}
									<ConfigTemplateDialog>
										<button type="button" className="underline hover:no-underline font-mono">
											lightfast.yml
										</button>
									</ConfigTemplateDialog>
									{" "}file to start indexing.
								</p>
							</div>
						</div>
					</div>
				)}
				<SourceSettingsForm
					integrationId={integration.id}
					provider={metadata.sourceType}
					currentEvents={subscribedEvents}
					backfillConfig={integration.backfillConfig ?? null}
				/>
			</CollapsibleContent>
		</Collapsible>
	);
}
