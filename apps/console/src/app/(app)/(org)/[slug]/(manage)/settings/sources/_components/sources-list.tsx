"use client";
"use no memo";

import {
	useSuspenseQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { showErrorToast } from "~/lib/trpc-errors";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { formatDistanceToNow } from "date-fns";

const providers = ["github", "vercel", "linear", "sentry"] as const;
type Provider = (typeof providers)[number];

const providerConfig: Record<
	Provider,
	{
		name: string;
		icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
		description: string;
	}
> = {
	github: {
		name: "GitHub",
		icon: IntegrationLogoIcons.github,
		description: "Connect your GitHub repositories",
	},
	vercel: {
		name: "Vercel",
		icon: IntegrationLogoIcons.vercel,
		description: "Connect your Vercel projects",
	},
	linear: {
		name: "Linear",
		icon: IntegrationLogoIcons.linear,
		description: "Connect your Linear workspace",
	},
	sentry: {
		name: "Sentry",
		icon: IntegrationLogoIcons.sentry,
		description: "Connect your Sentry projects",
	},
};

function SourceItem({ provider }: { provider: Provider }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const config = providerConfig[provider];
	const Icon = config.icon;

	const { data: integrations } = useSuspenseQuery({
		...trpc.connections.list.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
	});

	const connection = integrations.find(
		(i) => i.sourceType === provider && i.isActive,
	);

	const { handleConnect } = useOAuthPopup({
		provider,
		queryKeysToInvalidate: [trpc.connections.list.queryOptions().queryKey],
	});

	const disconnectMutation = useMutation(
		trpc.connections.disconnect.mutationOptions({
			onSuccess: () => {
				toast.success(`${config.name} disconnected`);
				void queryClient.invalidateQueries({
					queryKey: trpc.connections.list.queryOptions().queryKey,
				});
			},
			onError: (error) => {
				showErrorToast(error, `Failed to disconnect ${config.name}`);
			},
		}),
	);

	const handleDisconnect = () => {
		if (
			connection &&
			window.confirm(
				`Disconnect ${config.name}? This will remove access to all resources connected through this integration.`,
			)
		) {
			disconnectMutation.mutate({ integrationId: connection.id });
		}
	};

	return (
		<AccordionItem value={provider}>
			<AccordionTrigger className="px-4 hover:no-underline">
				<div className="flex items-center gap-3 flex-1">
					<Icon className="h-5 w-5 shrink-0" />
					<span className="font-medium">{config.name}</span>
					{connection ? (
						<Badge variant="secondary" className="text-xs">
							Connected
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="text-xs text-muted-foreground"
						>
							Not connected
						</Badge>
					)}
				</div>
			</AccordionTrigger>
			<AccordionContent className="px-4">
				{connection ? (
					<div className="space-y-3 pt-2">
						<p className="text-sm text-muted-foreground">
							Connected{" "}
							{formatDistanceToNow(new Date(connection.connectedAt), {
								addSuffix: true,
							})}
							{connection.lastSyncAt && (
								<>
									{" · "}Last used{" "}
									{formatDistanceToNow(new Date(connection.lastSyncAt), {
										addSuffix: true,
									})}
								</>
							)}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={handleDisconnect}
							disabled={disconnectMutation.isPending}
						>
							Disconnect
						</Button>
					</div>
				) : (
					<div className="flex flex-col items-center py-6 text-center gap-4">
						<p className="text-sm text-muted-foreground">
							{config.description}
						</p>
						<Button onClick={handleConnect} variant="outline">
							<Icon className="h-4 w-4 mr-2" />
							Connect {config.name}
						</Button>
					</div>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

export function SourcesList() {
	return (
		<Accordion type="multiple" className="w-full rounded-lg border">
			{providers.map((provider) => (
				<SourceItem key={provider} provider={provider} />
			))}
		</Accordion>
	);
}
