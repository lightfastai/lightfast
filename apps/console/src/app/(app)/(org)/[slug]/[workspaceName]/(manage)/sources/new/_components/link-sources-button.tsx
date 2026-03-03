"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { showErrorToast } from "~/lib/trpc-errors";
import { useSourceSelection } from "./source-selection-provider";

interface LinkSourcesButtonProps {
	clerkOrgSlug: string;
	workspaceName: string;
}

export function LinkSourcesButton({
	clerkOrgSlug,
	workspaceName,
}: LinkSourcesButtonProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const {
		selectedRepositories,
		gwInstallationId,
		selectedInstallation,
		selectedVercelInstallation,
		selectedProjects,
		sentryInstallationId,
		selectedSentryProjects,
		selectedLinearTeam,
	} = useSourceSelection();

	// Get workspaceId from prefetched sources list
	const { data: sourcesData } = useSuspenseQuery({
		...trpc.workspace.sources.list.queryOptions({
			clerkOrgSlug,
			workspaceName,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const workspaceId = sourcesData.workspaceId;

	// Bulk link mutations
	const bulkLinkGitHubMutation = useMutation(
		trpc.workspace.integrations.bulkLinkGitHubRepositories.mutationOptions({
			onError: (error) => {
				console.error("Failed to link repositories:", error);
				toast.error("Repositories not linked", {
					description:
						"Failed to connect repositories. You can try again.",
				});
			},
		}),
	);

	const bulkLinkVercelMutation = useMutation(
		trpc.workspace.integrations.bulkLinkVercelProjects.mutationOptions({
			onError: (error) => {
				console.error("Failed to link Vercel projects:", error);
				toast.error("Vercel projects not linked", {
					description:
						"Failed to connect Vercel projects. You can try again.",
				});
			},
		}),
	);

	const bulkLinkSentryMutation = useMutation(
		trpc.workspace.integrations.bulkLinkSentryProjects.mutationOptions({
			onError: (error) => {
				console.error("Failed to link Sentry projects:", error);
				toast.error("Sentry projects not linked", {
					description:
						"Failed to connect Sentry projects. You can try again.",
				});
			},
		}),
	);

	const bulkLinkLinearMutation = useMutation(
		trpc.workspace.integrations.bulkLinkLinearTeams.mutationOptions({
			onError: (error) => {
				console.error("Failed to link Linear teams:", error);
				toast.error("Linear teams not linked", {
					description:
						"Failed to connect Linear teams. You can try again.",
				});
			},
		}),
	);

	const hasSelection =
		selectedRepositories.length > 0 ||
		selectedProjects.length > 0 ||
		selectedSentryProjects.length > 0 ||
		selectedLinearTeam !== null;

	const isLoading =
		bulkLinkGitHubMutation.isPending ||
		bulkLinkVercelMutation.isPending ||
		bulkLinkSentryMutation.isPending ||
		bulkLinkLinearMutation.isPending;

	const handleLinkSources = async () => {
		const [githubResult, vercelResult, sentryResult, linearResult] =
			await Promise.allSettled([
				selectedRepositories.length > 0 &&
				gwInstallationId &&
				selectedInstallation
					? bulkLinkGitHubMutation.mutateAsync({
							workspaceId,
							gwInstallationId,
							installationId: selectedInstallation.id,
							repositories: selectedRepositories.map((repo) => ({
								repoId: repo.id,
								repoFullName: repo.fullName,
							})),
						})
					: Promise.resolve(null),
				selectedProjects.length > 0 && selectedVercelInstallation
					? bulkLinkVercelMutation.mutateAsync({
							workspaceId,
							gwInstallationId: selectedVercelInstallation.id,
							projects: selectedProjects.map((p) => ({
								projectId: p.id,
								projectName: p.name,
							})),
						})
					: Promise.resolve(null),
				selectedSentryProjects.length > 0 && sentryInstallationId
					? bulkLinkSentryMutation.mutateAsync({
							workspaceId,
							gwInstallationId: sentryInstallationId,
							projects: selectedSentryProjects.map((p) => ({
								projectId: p.id,
								projectSlug: p.slug,
								projectName: p.name,
							})),
						})
					: Promise.resolve(null),
				selectedLinearTeam
					? bulkLinkLinearMutation.mutateAsync({
							workspaceId,
							gwInstallationId:
								selectedLinearTeam.installationId,
							teams: [
								{
									teamId: selectedLinearTeam.id,
									teamKey: selectedLinearTeam.key,
									teamName: selectedLinearTeam.name,
								},
							],
						})
					: Promise.resolve(null),
			]);

		const repoCount =
			githubResult.status === "fulfilled" && githubResult.value
				? githubResult.value.created + githubResult.value.reactivated
				: 0;
		const projectCount =
			vercelResult.status === "fulfilled" && vercelResult.value
				? vercelResult.value.created + vercelResult.value.reactivated
				: 0;
		const sentryCount =
			sentryResult.status === "fulfilled" && sentryResult.value
				? sentryResult.value.created + sentryResult.value.reactivated
				: 0;
		const linearCount =
			linearResult.status === "fulfilled" && linearResult.value
				? linearResult.value.created + linearResult.value.reactivated
				: 0;
		const totalLinked =
			repoCount + projectCount + sentryCount + linearCount;

		if (totalLinked > 0) {
			toast.success("Sources linked!", {
				description: `${totalLinked} source${totalLinked === 1 ? "" : "s"} connected to this workspace.`,
			});
		}

		// Invalidate sources list so the manage page reflects changes
		void queryClient.invalidateQueries({
			queryKey: trpc.workspace.sources.list.queryOptions({
				clerkOrgSlug,
				workspaceName,
			}).queryKey,
		});

		router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
	};

	const sourcesUrl = `/${clerkOrgSlug}/${workspaceName}/sources`;

	return (
		<div className="mt-8 flex items-center justify-between">
			<Button variant="outline" size="sm" asChild>
				<Link href={sourcesUrl}>Go back to sources</Link>
			</Button>
			<Button
				onClick={handleLinkSources}
				disabled={!hasSelection || isLoading}
				size="sm"
			>
				{isLoading ? (
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
