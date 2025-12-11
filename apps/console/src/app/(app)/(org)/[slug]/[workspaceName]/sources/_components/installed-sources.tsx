"use client";

import type { ComponentType, SVGProps } from "react";
import { useState, useEffect } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Search, Circle, ChevronDown, Plus, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ConfigTemplateDialog } from "~/components/config-template-dialog";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { VercelProjectSelector } from "~/components/integrations/vercel-project-selector";

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
};

const providerNames: Record<string, string> = {
	github: "GitHub",
	upstash: "Upstash",
	vercel: "Vercel",
};

export function InstalledSources({
	clerkOrgSlug,
	workspaceName,
	initialSearch = "",
	initialStatus = "all",
}: InstalledSourcesProps) {
	const trpc = useTRPC();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [showVercelSelector, setShowVercelSelector] = useState(false);

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

	// Query for user's Vercel source
	const { data: vercelSource } = useQuery({
		...trpc.userSources.vercel.get.queryOptions(),
		staleTime: 5 * 60 * 1000,
	});

	// Get query client for invalidation
	const queryClient = useQueryClient();
	const handleVercelSuccess = () => {
		// Invalidate sources list query to refresh the list
		void queryClient.invalidateQueries({
			queryKey: [["workspace", "sources", "list"], { input: { clerkOrgSlug, workspaceName }, type: "query" }],
		});
	};

	// Auto-open selector after OAuth callback (URL parameter)
	useEffect(() => {
		if (searchParams.get("vercel_connected") === "true" && vercelSource) {
			setShowVercelSelector(true);
			// Clean up URL
			const url = new URL(window.location.href);
			url.searchParams.delete("vercel_connected");
			router.replace(url.pathname + url.search, { scroll: false });
		}
	}, [searchParams, vercelSource, router]);

	// Listen for postMessage from OAuth popup window
	useEffect(() => {
		const handleMessage = (event: MessageEvent<{ type?: string }>) => {
			if (event.data.type === "vercel_connected") {
				// Refetch Vercel source and sources list, then open selector
				void queryClient.invalidateQueries({
					queryKey: [["userSources", "vercel", "get"]],
				});
				void queryClient.invalidateQueries({
					queryKey: [["workspace", "sources", "list"], { input: { clerkOrgSlug, workspaceName }, type: "query" }],
				});
				// Use timeout to allow queries to refetch before opening selector
				setTimeout(() => {
					setShowVercelSelector(true);
				}, 500);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [clerkOrgSlug, workspaceName, queryClient]);

	const integrations = sourcesData.list;
	const workspaceId = sourcesData.workspaceId;

	// Filter integrations
	const filteredIntegrations = integrations.filter((integration) => {
		// Type-safe metadata access for GitHub integrations
		const metadata = integration.metadata as { repoFullName?: string } | null | undefined;
		const displayName = integration.type === "github"
			? metadata?.repoFullName ?? providerNames[integration.type] ?? integration.type
			: providerNames[integration.type] ?? integration.type;

		const matchesSearch =
			displayName.toLowerCase().includes(filters.search.toLowerCase()) ||
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

					{/* Add Vercel Projects button */}
					{vercelSource && (
						<Button
							variant="outline"
							size="sm"
							className="h-10"
							onClick={() => setShowVercelSelector(true)}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Vercel Projects
						</Button>
					)}
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
					<div className="rounded-sm border border-border/60 overflow-hidden bg-card">
						{filteredIntegrations.map((integration, index) => {
							const IconComponent = providerIcons[integration.type];

							// Type-safe metadata access for GitHub integrations
							const metadata = integration.metadata as {
								repoFullName?: string;
								documentCount?: number;
								isPrivate?: boolean;
								projectName?: string;
								status?: {
									configStatus?: "configured" | "awaiting_config";
									configPath?: string;
									lastConfigCheck?: string;
								};
							} | null | undefined;

							// Check if this repo is awaiting configuration
							const isAwaitingConfig = metadata?.status?.configStatus === "awaiting_config";

							// Get display name based on provider type
							let name: string;
							if (integration.type === "github") {
								name = metadata?.repoFullName ?? providerNames[integration.type] ?? integration.type;
							} else {
								// Vercel or other providers
								name = metadata?.projectName ?? providerNames[integration.type] ?? integration.type;
							}

							// Get additional metadata for GitHub
							const documentCount = integration.documentCount || metadata?.documentCount;
							const isPrivate = metadata?.isPrivate;

							return (
								<div
									key={integration.id}
									className={`flex items-center justify-between p-3 ${
										index !== filteredIntegrations.length - 1
											? "border-b border-border"
											: ""
									}`}
								>
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
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<p className="font-medium text-foreground">{name}</p>
												{integration.type === "github" && isPrivate && (
													<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
														Private
													</span>
												)}
											</div>
											<div className="flex items-center gap-3 mt-1">
												<div className="flex items-center gap-2">
													<Circle className={`h-2 w-2 fill-current ${isAwaitingConfig ? "text-amber-500" : "text-green-500"}`} />
													<p className="text-sm text-muted-foreground">
														{isAwaitingConfig ? "Awaiting config" : "Active"}
													</p>
												</div>
												<span className="text-muted-foreground">•</span>
												<p className="text-sm text-muted-foreground">
													Synced{" "}
													{integration.lastSyncedAt
														? formatDistanceToNow(new Date(integration.lastSyncedAt), {
																addSuffix: true,
														  })
														: "never"}
												</p>
												{documentCount && documentCount > 0 && (
													<>
														<span className="text-muted-foreground">•</span>
														<p className="text-sm text-muted-foreground">
															{documentCount.toLocaleString()} docs
														</p>
													</>
												)}
											</div>
											{/* Config Required Banner */}
											{isAwaitingConfig && (
												<div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
													<div className="flex items-start gap-2">
														<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
														<div className="text-sm flex-1">
															<p className="font-medium text-amber-800 dark:text-amber-200">
																Configuration Required
															</p>
															<p className="text-amber-700 dark:text-amber-300 mt-0.5">
																Add a{" "}
																<ConfigTemplateDialog>
																	<button className="underline hover:no-underline font-mono text-xs">
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
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Vercel Project Selector Modal */}
			{vercelSource && (
				<VercelProjectSelector
					open={showVercelSelector}
					onOpenChange={setShowVercelSelector}
					userSourceId={vercelSource.id}
					workspaceId={workspaceId}
					workspaceName={workspaceName}
					onSuccess={handleVercelSuccess}
				/>
			)}
		</>
	);
}
