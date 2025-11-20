"use client";

import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";
import { Github, MoreVertical } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const providerIcons = {
	github: Github,
	notion: () => <span className="text-lg">📝</span>,
	linear: () => <span className="text-lg">◇</span>,
	sentry: () => <span className="text-lg">🔍</span>,
};

const providerNames = {
	github: "GitHub",
	notion: "Notion",
	linear: "Linear",
	sentry: "Sentry",
};

const providerDescriptions = {
	github: "Connect your GitHub account",
	notion: "Connect your Notion workspace",
	linear: "Connect your Linear workspace",
	sentry: "Connect your Sentry account",
};

/**
 * Sources List (Client Component)
 *
 * Interactive list of integrations with connect/disconnect functionality.
 * Uses useSuspenseQuery to display prefetched data without client-side fetch.
 *
 * Pattern:
 * - Data prefetched in page.tsx via server-side prefetch()
 * - HydrateClient in page.tsx transfers data to client
 * - useSuspenseQuery reads from hydrated cache (no fetch!)
 * - refetchOnMount: false prevents unnecessary refetch
 */
export function SourcesList() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: integrations } = useSuspenseQuery({
		...trpc.account.integrations.list.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const disconnectMutation = useMutation(
		trpc.account.integrations.disconnect.mutationOptions({
			onSuccess: () => {
				toast.success("Integration disconnected successfully");
				void queryClient.invalidateQueries({
					queryKey: trpc.account.integrations.list.queryOptions().queryKey,
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
				`Are you sure you want to disconnect ${providerNames[provider as keyof typeof providerNames]}? This will remove access to all resources connected through this integration.`,
			)
		) {
			disconnectMutation.mutate({ integrationId });
		}
	};

	const handleConnect = (provider: string) => {
		// Redirect to OAuth flow
		if (provider === "github") {
			window.location.href = "/api/github/oauth";
		} else {
			toast.info(`${providerNames[provider as keyof typeof providerNames]} integration coming soon`);
		}
	};

	// Create a unified list of all sources (connected and available)
	const allSources = (["github", "notion", "linear", "sentry"] as const).map((provider) => {
		const connectedIntegration = integrations.find(
			(i) => i.provider === provider && i.isActive,
		);
		return {
			provider,
			isConnected: !!connectedIntegration,
			integration: connectedIntegration,
		};
	});

	return (
		<div className="border border-border rounded-lg overflow-hidden bg-card">
			{allSources.map((source, index) => {
				const Icon = providerIcons[source.provider];
				const name = providerNames[source.provider];
				const description = providerDescriptions[source.provider];

				return (
					<div
						key={source.provider}
						className={`flex items-center justify-between px-4 py-4 ${
							index !== allSources.length - 1 ? "border-b border-border" : ""
						}`}
					>
						<div className="flex items-center gap-4 flex-1">
							{/* Icon */}
							<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
								<Icon className="h-5 w-5" />
							</div>

							{/* Name and Status */}
							<div className="flex-1 min-w-0">
								<p className="font-medium text-foreground">{name}</p>
								<p className="text-sm text-muted-foreground">
									{source.isConnected && source.integration
										? source.integration.lastSyncAt
											? `Last used ${formatDistanceToNow(new Date(source.integration.lastSyncAt), { addSuffix: true })}`
											: `Connected ${formatDistanceToNow(new Date(source.integration.connectedAt), { addSuffix: true })}`
										: description}
								</p>
							</div>
						</div>

						{/* Action Button */}
						<div className="flex items-center gap-2">
							{source.isConnected && source.integration ? (
								<>
									<span className="text-sm text-muted-foreground mr-2">
										Last used{" "}
										{formatDistanceToNow(
											new Date(source.integration.lastSyncAt ?? source.integration.connectedAt),
											{ addSuffix: true }
										).replace(" ago", "")}
									</span>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon" className="h-8 w-8">
												<MoreVertical className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() => {
													if (source.integration) {
														handleDisconnect(source.integration.id, source.provider);
													}
												}}
												disabled={disconnectMutation.isPending}
												className="text-destructive cursor-pointer"
											>
												Disconnect
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleConnect(source.provider)}
								>
									Connect
								</Button>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
