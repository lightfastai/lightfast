"use client";

import type { ComponentType, SVGProps } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
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
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Search, Circle, ChevronDown, Plus, AlertTriangle } from "lucide-react";
import { ConfigTemplateDialog } from "~/components/config-template-dialog";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import { EventSettings } from "./event-settings";
import Link from "next/link";

interface InstalledSourcesProps {
	clerkOrgSlug: string;
	workspaceName: string;
	initialSearch?: string;
	initialStatus?: "all" | "active" | "inactive";
}

// Map provider names to their icon components
const providerIcons: Record<
	string,
	ComponentType<SVGProps<SVGSVGElement>>
> = {
	github: IntegrationIcons.github,
	upstash: IntegrationIcons.github, // Fallback until we have upstash icon
	vercel: IntegrationIcons.vercel,
	linear: IntegrationIcons.linear,
	sentry: IntegrationIcons.sentry,
};

const providerNames: Record<string, string> = {
	github: "GitHub",
	upstash: "Upstash",
	vercel: "Vercel",
	linear: "Linear",
	sentry: "Sentry",
};

export function InstalledSources({
	clerkOrgSlug,
	workspaceName,
	initialSearch = "",
	initialStatus = "all",
}: InstalledSourcesProps) {
	const trpc = useTRPC();

	// Use nuqs for URL-based state management with server-side initial values
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
		// Type-safe metadata access
		const metadata = integration.metadata as {
			repoFullName?: string;
			projectName?: string;
			workspaceName?: string;
		} | null | undefined;

		// Build searchable display name (matches the format shown in UI)
		const providerLabel = providerNames[integration.type] ?? integration.type;
		let searchableName: string;

		if (integration.type === "github") {
			const repoName = metadata?.repoFullName ?? "";
			searchableName = repoName ? `${providerLabel.toLowerCase()}/${repoName}` : providerLabel;
		} else if (integration.type === "vercel") {
			const projectName = metadata?.projectName ?? "";
			searchableName = projectName ? `${providerLabel.toLowerCase()}/${projectName}` : providerLabel;
		} else {
			const resourceName = metadata?.projectName ?? metadata?.workspaceName ?? "";
			searchableName = resourceName ? `${providerLabel.toLowerCase()}/${resourceName}` : providerLabel;
		}

		const matchesSearch =
			searchableName.toLowerCase().includes(filters.search.toLowerCase()) ||
			integration.type.toLowerCase().includes(filters.search.toLowerCase());

		// All sources are active by default in the new model
		const matchesStatus = filters.status === "all" || filters.status === "active";

		return matchesSearch && matchesStatus;
	});

	return (
		<>
			<div className="space-y-4">
				{/* Filter bar */}
				<div className="flex items-center gap-3">
					{/* Search */}
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search integrations..."
							value={filters.search}
							onChange={(e) => setFilters({ search: e.target.value })}
							className="pl-9 h-10"
						/>
					</div>

					{/* Status filter */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-10 gap-2">
								{filters.status === "all" && "All Integrations"}
								{filters.status === "active" && "Active Only"}
								{filters.status === "inactive" && "Inactive Only"}
								<ChevronDown className="h-4 w-4" />
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

					{/* Add new source button */}
					<Link href={`/${clerkOrgSlug}/${workspaceName}/sources/connect`}>
						<Button size="sm" className="h-10">
							<Plus className="h-4 w-4 mr-2" />
							Add New Source
						</Button>
					</Link>
				</div>

				{/* Integrations list */}
				{filteredIntegrations.length === 0 ? (
					<div className="rounded-sm border border-border/60 bg-card p-12 text-center">
						<p className="text-sm text-muted-foreground">
							{filters.search
								? `No integrations found matching "${filters.search}"`
								: "No integrations installed yet"}
						</p>
					</div>
				) : (
					<Accordion type="multiple" className="rounded-sm border border-border/60 overflow-hidden bg-card">
						{filteredIntegrations.map((integration, index) => {
							const IconComponent = providerIcons[integration.type];

							// Type-safe metadata access for GitHub integrations
							const metadata = integration.metadata as {
								repoFullName?: string;
								documentCount?: number;
								isPrivate?: boolean;
								projectName?: string;
								workspaceName?: string;
								status?: {
									configStatus?: "configured" | "awaiting_config";
									configPath?: string;
									lastConfigCheck?: string;
								};
								sync?: {
									events?: string[];
								};
							} | null | undefined;

							// Check if this repo is awaiting configuration
							const isAwaitingConfig = metadata?.status?.configStatus === "awaiting_config";

							// Get display name based on provider type
							let displayName: string;
							const providerLabel: string = providerNames[integration.type] ?? integration.type;

							if (integration.type === "github") {
								const repoName = metadata?.repoFullName ?? "";
								displayName = repoName ? `${providerLabel.toLowerCase()}/${repoName.split("/").pop() ?? repoName}` : providerLabel;
							} else if (integration.type === "vercel") {
								const projectName = metadata?.projectName ?? "";
								displayName = projectName ? `${providerLabel.toLowerCase()}/${projectName}` : providerLabel;
							} else {
								// For Linear/Sentry and other providers, show provider/workspace or provider/project
								const resourceName = metadata?.projectName ?? metadata?.workspaceName ?? "";
								displayName = resourceName ? `${providerLabel.toLowerCase()}/${resourceName}` : providerLabel;
							}

							// Get additional metadata for GitHub
							const documentCount = integration.documentCount || metadata?.documentCount;
							const isPrivate = metadata?.isPrivate;

							return (
								<AccordionItem
									key={integration.id}
									value={integration.id}
									className={index !== filteredIntegrations.length - 1 ? "border-b border-border" : "border-b-0"}
								>
									<AccordionTrigger className="px-3 py-3 hover:no-underline hover:bg-muted/50">
										<div className="flex items-center gap-4 flex-1">
											{/* Icon */}
											<div className="flex items-center justify-center w-10 h-10 rounded-sm bg-muted shrink-0 p-2">
												{IconComponent ? (
													<IconComponent className="w-full h-full text-foreground" />
												) : (
													<span className="text-lg">🔗</span>
												)}
											</div>

											{/* Name and Status */}
											<div className="flex-1 min-w-0 text-left">
												<div className="flex items-center gap-2">
													<p className="font-medium text-foreground">{displayName}</p>
													{integration.type === "github" && isPrivate && (
														<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
															Private
														</span>
													)}
												</div>
												<div className="flex items-center gap-3 mt-1">
													<div className="flex items-center gap-2">
														<Circle className={`h-2 w-2 fill-current ${isAwaitingConfig ? "text-amber-500" : "text-green-500"}`} />
														<p className="text-xs text-muted-foreground">
															{isAwaitingConfig ? "Awaiting config" : "Active"}
														</p>
													</div>
													{documentCount && documentCount > 0 && (
														<>
															<span className="text-muted-foreground text-xs">•</span>
															<p className="text-xs text-muted-foreground">
																{documentCount.toLocaleString()} docs
															</p>
														</>
													)}
												</div>
												{/* Config Required Banner */}
												{isAwaitingConfig && (
													<div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
														<div className="flex items-start gap-2">
															<AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
															<div className="text-xs flex-1">
																<p className="font-medium text-amber-800 dark:text-amber-200">
																	Configuration Required
																</p>
																<p className="text-amber-700 dark:text-amber-300 mt-0.5">
																	Add a{" "}
																	<ConfigTemplateDialog>
																		<button className="underline hover:no-underline font-mono">
																			lightfast.yml
																		</button>
																	</ConfigTemplateDialog>
																	{" "}file to start indexing.
																</p>
															</div>
														</div>
													</div>
												)}
											</div>
										</div>
									</AccordionTrigger>

									{/* Expanded Event Settings - Only for providers with webhook handlers */}
									<AccordionContent className="px-0 pb-0">
											<EventSettings
												integrationId={integration.id}
												provider={integration.type}
												currentEvents={metadata?.sync?.events ?? []}
												clerkOrgSlug={clerkOrgSlug}
												workspaceName={workspaceName}
											/>
										</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				)}
			</div>
		</>
	);
}
