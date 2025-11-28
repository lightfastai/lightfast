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
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Search, Circle, ChevronDown } from "lucide-react";
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
						const IconComponent = providerIcons[integration.type];

						// Type-safe metadata access for GitHub integrations
						const metadata = integration.metadata as {
							repoFullName?: string;
							documentCount?: number;
							isPrivate?: boolean;
						} | null | undefined;

						const name =
							integration.type === "github"
								? metadata?.repoFullName ?? providerNames[integration.type] ?? integration.type
								: providerNames[integration.type] ?? integration.type;

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
												<Circle className="h-2 w-2 fill-current text-green-500" />
												<p className="text-sm text-muted-foreground">Active</p>
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
