"use client";

import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
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
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { cn } from "@repo/ui/lib/utils";
import { Search, Circle, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { ConfigTemplateDialog } from "~/components/config-template-dialog";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import { EventSettings } from "./event-settings";

interface InstalledSourcesProps {
	clerkOrgSlug: string;
	workspaceName: string;
	initialSearch?: string;
	initialStatus?: "all" | "active" | "inactive";
}

const providerOrder = ["github", "vercel", "linear", "sentry"] as const;

const providerIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	github: IntegrationLogoIcons.github,
	vercel: IntegrationLogoIcons.vercel,
	linear: IntegrationLogoIcons.linear,
	sentry: IntegrationLogoIcons.sentry,
};

const providerNames: Record<string, string> = {
	github: "GitHub",
	vercel: "Vercel",
	linear: "Linear",
	sentry: "Sentry",
};

// Metadata shapes per provider (from sourceConfig in workspace_integrations)
// GitHub: { repoFullName, isPrivate, documentCount, status.configStatus, sync.events }
// Vercel: { projectName, projectId, sync.events }
// Linear: { teamName, teamKey, teamId, sync.events }
// Sentry: { projectSlug, projectId, sync.events }
interface IntegrationMetadata {
	// GitHub
	repoFullName?: string;
	documentCount?: number;
	isPrivate?: boolean;
	status?: {
		configStatus?: "configured" | "awaiting_config";
	};
	// Vercel
	projectName?: string;
	// Linear
	teamName?: string;
	teamKey?: string;
	// Sentry
	projectSlug?: string;
	// Shared
	sync?: {
		events?: string[];
	};
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
	const filteredIntegrations = integrations.filter((integration) => {
		const metadata = integration.metadata as IntegrationMetadata | null | undefined;
		const integrationType = integration.type ?? "unknown";
		const providerLabel = providerNames[integrationType] ?? integrationType;

		let searchableName: string;
		if (integrationType === "github") {
			const repoName = metadata?.repoFullName ?? "";
			searchableName = repoName ? `${providerLabel.toLowerCase()}/${repoName}` : providerLabel;
		} else if (integrationType === "vercel") {
			const projectName = metadata?.projectName ?? "";
			searchableName = projectName ? `${providerLabel.toLowerCase()}/${projectName}` : providerLabel;
		} else if (integrationType === "linear") {
			const teamName = metadata?.teamName ?? "";
			searchableName = teamName ? `${providerLabel.toLowerCase()}/${teamName}` : providerLabel;
		} else if (integrationType === "sentry") {
			const projectSlug = metadata?.projectSlug ?? "";
			searchableName = projectSlug ? `${providerLabel.toLowerCase()}/${projectSlug}` : providerLabel;
		} else {
			searchableName = providerLabel;
		}

		const matchesSearch =
			searchableName.toLowerCase().includes(filters.search.toLowerCase()) ||
			integrationType.toLowerCase().includes(filters.search.toLowerCase());

		const matchesStatus = filters.status === "all" || filters.status === "active";

		return matchesSearch && matchesStatus;
	});

	// Group by provider
	const grouped = new Map<string, typeof integrations>();
	for (const integration of filteredIntegrations) {
		const type = integration.type ?? "unknown";
		const list = grouped.get(type) ?? [];
		list.push(integration);
		grouped.set(type, list);
	}

	// Sort by defined order, then append any extras
	const sortedGroups = [
		...providerOrder
			.filter((p) => grouped.has(p))
			.map((p) => ({ provider: p as string, resources: grouped.get(p)! })),
		...[...grouped.entries()]
			.filter(([p]) => !(providerOrder as readonly string[]).includes(p))
			.map(([provider, resources]) => ({ provider, resources })),
	];

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
						<Button variant="outline" size="sm" className="gap-2">
							{filters.status === "all" && "All Integrations"}
							{filters.status === "active" && "Active Only"}
							{filters.status === "inactive" && "Inactive Only"}
							<ChevronDown className="h-3.5 w-3.5" />
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
				</div>
			) : (
				<Accordion type="multiple" className="w-full rounded-lg border">
					{sortedGroups.map(({ provider, resources }) => {
						const IconComponent = providerIcons[provider];
						const label = providerNames[provider] ?? provider;

						return (
							<AccordionItem key={provider} value={provider}>
								<AccordionTrigger className="px-4 hover:no-underline">
									<div className="flex items-center gap-3 flex-1">
										{IconComponent ? (
											<IconComponent className="h-5 w-5 shrink-0" />
										) : (
											<span className="text-sm">🔗</span>
										)}
										<span className="font-medium">{label}</span>
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
												provider={provider}
												clerkOrgSlug={clerkOrgSlug}
												workspaceName={workspaceName}
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

function ResourceRow({
	integration,
	provider,
	clerkOrgSlug,
	workspaceName,
}: {
	integration: {
		id: string;
		type: string | null;
		documentCount?: number | null;
		metadata: unknown;
	};
	provider: string;
	clerkOrgSlug: string;
	workspaceName: string;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const metadata = integration.metadata as IntegrationMetadata | null | undefined;

	const isAwaitingConfig = metadata?.status?.configStatus === "awaiting_config";
	const documentCount = integration.documentCount || metadata?.documentCount;
	const isPrivate = metadata?.isPrivate;
	const subscribedEvents = metadata?.sync?.events ?? [];
	const eventLabel = subscribedEvents.length === 0 ? "All events" : `${subscribedEvents.length} events`;

	// Resource name without provider prefix (already grouped)
	const integrationType = integration.type ?? "unknown";
	let resourceName: string;

	if (integrationType === "github") {
		resourceName = metadata?.repoFullName || "Unknown repo";
	} else if (integrationType === "vercel") {
		resourceName = metadata?.projectName ?? "Unknown project";
	} else if (integrationType === "linear") {
		resourceName = metadata?.teamName ?? "Unknown team";
	} else if (integrationType === "sentry") {
		resourceName = metadata?.projectSlug ?? "Unknown project";
	} else {
		resourceName = "Unknown resource";
	}

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
						{integrationType === "linear" && metadata?.teamKey && (
							<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
								{metadata.teamKey}
							</span>
						)}
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-3">
						{documentCount != null && documentCount > 0 && (
							<span className="text-xs text-muted-foreground">
								{documentCount.toLocaleString()} docs
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
				<EventSettings
					integrationId={integration.id}
					provider={provider as "github" | "vercel" | "linear" | "sentry"}
					currentEvents={subscribedEvents}
					clerkOrgSlug={clerkOrgSlug}
					workspaceName={workspaceName}
				/>
			</CollapsibleContent>
		</Collapsible>
	);
}
