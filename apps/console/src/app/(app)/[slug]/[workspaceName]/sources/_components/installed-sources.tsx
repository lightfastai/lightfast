"use client";

import type { ComponentType, SVGProps } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Search, MoreVertical, Circle, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";

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
	notion: IntegrationIcons.notion,
	linear: IntegrationIcons.linear,
	sentry: IntegrationIcons.sentry,
};

const providerNames: Record<string, string> = {
	github: "GitHub",
	upstash: "Upstash",
	vercel: "Vercel",
	notion: "Notion",
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
	const queryClient = useQueryClient();

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

	const { data: integrations = [] } = useSuspenseQuery({
		...trpc.workspace.integrations.list.queryOptions({
			clerkOrgSlug,
			workspaceName,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const disconnectMutation = useMutation(
		trpc.workspace.integrations.disconnect.mutationOptions({
			onSuccess: () => {
				toast.success("Integration disconnected successfully");
				void queryClient.invalidateQueries({
					queryKey: trpc.workspace.integrations.list.queryOptions({
						clerkOrgSlug,
						workspaceName,
					}).queryKey,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to disconnect integration");
			},
		}),
	);

	const handleDisconnect = (integrationId: string, provider: string) => {
		if (
			window.confirm(
				`Are you sure you want to disconnect ${providerNames[provider]}? This will remove access to all resources connected through this integration.`,
			)
		) {
			disconnectMutation.mutate({ integrationId });
		}
	};

	// Filter integrations
	const filteredIntegrations = integrations.filter((integration) => {
		const displayName = integration.provider === "github"
			? (integration.metadata as any)?.repoFullName || providerNames[integration.provider]
			: providerNames[integration.provider];

		const matchesSearch =
			displayName?.toLowerCase().includes(filters.search.toLowerCase()) ||
			integration.provider.toLowerCase().includes(filters.search.toLowerCase());

		const matchesStatus =
			filters.status === "all" ||
			(filters.status === "active" && integration.isActive) ||
			(filters.status === "inactive" && !integration.isActive);

		return matchesSearch && matchesStatus;
	});

	return (
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
						const IconComponent = providerIcons[integration.provider];
						const name = integration.provider === "github"
							? (integration.metadata as any)?.repoFullName || providerNames[integration.provider]
							: providerNames[integration.provider] || integration.provider;

						// Get additional metadata for GitHub
						const metadata = integration.metadata as any;
						const documentCount = metadata?.documentCount;
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
											{integration.provider === "github" && isPrivate && (
												<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
													Private
												</span>
											)}
										</div>
										<div className="flex items-center gap-3 mt-1">
											<div className="flex items-center gap-2">
												<Circle
													className={`h-2 w-2 fill-current ${
														integration.isActive
															? "text-green-500"
															: "text-muted-foreground"
													}`}
												/>
												<p className="text-sm text-muted-foreground">
													{integration.isActive ? "Active" : "Inactive"}
												</p>
											</div>
											<span className="text-muted-foreground">•</span>
											<p className="text-sm text-muted-foreground">
												Synced{" "}
												{formatDistanceToNow(
													new Date(integration.lastSyncAt || integration.connectedAt),
													{ addSuffix: true },
												)}
											</p>
											{documentCount && (
												<>
													<span className="text-muted-foreground">•</span>
													<p className="text-sm text-muted-foreground">
														{documentCount.toLocaleString()} docs
													</p>
												</>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
