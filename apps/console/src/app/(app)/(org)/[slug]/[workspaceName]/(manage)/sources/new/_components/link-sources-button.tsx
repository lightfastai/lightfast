"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { PROVIDER_SLUGS } from "@repo/console-providers";
import { useTRPC } from "@repo/console-trpc/react";
import { ADAPTERS } from "./adapters";
import { useSourceSelection } from "./source-selection-provider";

interface LinkSourcesButtonProps {
	clerkOrgSlug: string;
	workspaceName: string;
}

export function LinkSourcesButton({ clerkOrgSlug, workspaceName }: LinkSourcesButtonProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { getState, hasAnySelection } = useSourceSelection();

	const { data: sourcesData } = useSuspenseQuery({
		...trpc.workspace.sources.list.queryOptions({ clerkOrgSlug, workspaceName }),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const workspaceId = sourcesData.workspaceId;

	const linkMutation = useMutation(
		trpc.workspace.integrations.bulkLinkResources.mutationOptions({
			onError: (error) => {
				console.error("Failed to link sources:", error);
				toast.error("Sources not linked", {
					description: "Failed to connect sources. You can try again.",
				});
			},
		}),
	);

	const handleLinkSources = async () => {
		const mutations = PROVIDER_SLUGS.map((providerKey) => {
			const state = getState(providerKey);
			if (state.selectedResources.length === 0) return null;
			const installation = state.selectedInstallation;
			if (!installation) return null;
			const adapter = ADAPTERS[providerKey];
			return linkMutation.mutateAsync({
				provider: providerKey,
				workspaceId,
				gwInstallationId: installation.id,
				resources: adapter.buildLinkResources(state.rawSelectedResources),
			});
		}).filter(Boolean);

		const results = await Promise.allSettled(mutations);

		let totalLinked = 0;
		for (const result of results) {
			if (result.status === "fulfilled" && result.value) {
				totalLinked += result.value.created + result.value.reactivated;
			}
		}

		if (totalLinked > 0) {
			toast.success("Sources linked!", {
				description: `${totalLinked} source${totalLinked === 1 ? "" : "s"} connected to this workspace.`,
			});
		}

		void queryClient.invalidateQueries({
			queryKey: trpc.workspace.sources.list.queryOptions({ clerkOrgSlug, workspaceName }).queryKey,
		});

		router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
	};

	return (
		<div className="mt-8 flex items-center justify-between">
			<Button variant="outline" size="sm" asChild>
				<Link href={`/${clerkOrgSlug}/${workspaceName}/sources`}>Go back to sources</Link>
			</Button>
			<Button
				onClick={handleLinkSources}
				disabled={!hasAnySelection() || linkMutation.isPending}
				size="sm"
			>
				{linkMutation.isPending ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Linking sources...
					</>
				) : (
					"Link Sources"
				)}
			</Button>
		</div>
	);
}
