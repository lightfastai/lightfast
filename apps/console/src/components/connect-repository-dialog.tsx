"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { produce } from "immer";
import { Github, Check, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { useTRPC } from "@repo/console-trpc/react";
import { useToast } from "@repo/ui/hooks/use-toast";
import type { GitHubRepository } from "@repo/console-octokit-github";

interface ConnectRepositoryDialogProps {
	children?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	clerkOrgSlug: string;
	githubOrgId?: number;
}

/**
 * Environment Setup Dialog (Step 2)
 *
 * This dialog allows users to select a repository from their organization
 * to create an environment. Assumes GitHub is already connected.
 */

export function ConnectRepositoryDialog({
	children,
	open: controlledOpen,
	onOpenChange,
	clerkOrgSlug,
	githubOrgId,
}: ConnectRepositoryDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
	const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
	const [fetchingRepos, setFetchingRepos] = useState(false);
	const [installationId, setInstallationId] = useState<number | null>(null);

	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();

	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;

	// Query to check if user has a connected repository
	const { data: repositories = [] } = useQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			clerkOrgSlug,
		}),
		enabled: open,
	});

	const hasConnectedRepo = repositories.length > 0;

	// Mutation to detect config after connection
	const detectConfigMutation = useMutation(
		trpc.repository.detectConfig.mutationOptions({
			onSuccess: (data) => {
				if (!data.exists) {
					toast({
						title: "Setup needed",
						description: "No configuration found. Set up lightfast.yml to start indexing.",
					});
				} else {
					toast({
						title: "Configuration detected",
						description: `Found ${data.path} - indexing will start on next push.`,
					});
				}
			},
			onError: (error) => {
				console.error("Config detection failed:", error);
				// Don't show error to user - not critical
			},
		})
	);

	// Connect repository mutation using tRPC with optimistic updates
	const connectMutation = useMutation(
		trpc.repository.connect.mutationOptions({
			onMutate: async (variables) => {
				// Cancel any outgoing refetches to avoid overwriting optimistic update
				await queryClient.cancelQueries({
					queryKey: trpc.repository.list.queryKey({
						includeInactive: false,
						clerkOrgSlug,
					}),
				});

				// Snapshot the previous value
				const previousRepositories = queryClient.getQueryData(
					trpc.repository.list.queryKey({
						includeInactive: false,
						clerkOrgSlug,
					})
				);

				// Optimistically update the cache
				queryClient.setQueryData(
					trpc.repository.list.queryKey({
						includeInactive: false,
						clerkOrgSlug,
					}),
					produce(previousRepositories, (draft) => {
						if (draft) {
							// Add the new repository to the list optimistically
							draft.unshift({
								id: crypto.randomUUID(), // Temporary ID
								clerkOrgId: "", // Placeholder - will be replaced by server response
								githubRepoId: variables.githubRepoId,
								githubInstallationId: variables.githubInstallationId,
								permissions: variables.permissions ?? null,
								isActive: true,
								connectedAt: new Date().toISOString(),
								lastSyncedAt: null,
								configStatus: "pending",
								configPath: null,
								configDetectedAt: null,
								workspaceId: null,
								documentCount: 0,
								lastIngestedAt: null,
                                metadata: variables.metadata ?? null,
                                createdAt: new Date().toISOString(),
                            });
						}
					})
				);

				return { previousRepositories };
			},
			onError: (error, variables, context) => {
				// Rollback to the previous value on error
				if (context?.previousRepositories) {
					queryClient.setQueryData(
						trpc.repository.list.queryKey({
							includeInactive: false,
							clerkOrgSlug,
						}),
						context.previousRepositories
					);
				}

				toast({
					title: "Connection failed",
					description: error.message,
					variant: "destructive",
				});
			},
			onSuccess: (data) => {
				toast({
					title: "Repository connected",
					description: "Your GitHub repository has been successfully connected.",
				});

				// Trigger config detection for the newly connected repository
				if (data?.id) {
					detectConfigMutation.mutate({
						repositoryId: data.id,
						clerkOrgSlug,
					});
				}

				// Reset state and close dialog
				setGithubRepos([]);
				setSelectedRepoId(null);
				setOpen(false);
			},
			onSettled: () => {
				// Invalidate to ensure consistency after mutation completes
				// Use refetchType: "none" to avoid triggering Suspense boundaries
				void queryClient.invalidateQueries({
					queryKey: trpc.repository.list.queryKey({
						includeInactive: false,
						clerkOrgSlug,
					}),
					refetchType: "none",
				});
			},
		})
	);

	const handleConnectRepository = (repo: GitHubRepository) => {
		if (!installationId) {
			toast({
				title: "Connection failed",
				description: "Installation ID not found. Please try again.",
				variant: "destructive",
			});
			return;
		}

		connectMutation.mutate({
			clerkOrgSlug,
			githubRepoId: repo.id.toString(),
			githubInstallationId: installationId.toString(),
			permissions: repo.permissions ?? { admin: true, push: true, pull: true },
			metadata: {
				fullName: repo.full_name,
				description: repo.description,
				language: repo.language,
				private: repo.private,
				owner: repo.owner.login || "",
				ownerAvatar: repo.owner.avatar_url || "",
				stargazersCount: repo.stargazers_count || 0,
				updatedAt: repo.updated_at,
			},
		});
	};

	// Fetch repositories when dialog opens
	React.useEffect(() => {
		if (open && githubOrgId) {
			void fetchGitHubRepositoriesForOrg(githubOrgId);
		}
	}, [open, githubOrgId]);

	const fetchGitHubRepositoriesForOrg = async (githubOrgId: number) => {
		setFetchingRepos(true);
		setSelectedRepoId(null);
		try {
			// Fetch repositories for this org using the new API
			const response = await fetch(`/api/github/repositories?githubOrgId=${githubOrgId}`);
			if (!response.ok) {
				throw new Error("Failed to fetch repositories");
			}
			const data = (await response.json()) as {
				repositories: GitHubRepository[];
				installationId: number;
			};
			setGithubRepos(data.repositories);
			setInstallationId(data.installationId);
		} catch {
			toast({
				title: "Failed to fetch repositories",
				description: "Could not retrieve repositories for this organization. Please try again.",
				variant: "destructive",
			});
			setGithubRepos([]);
		} finally {
			setFetchingRepos(false);
		}
	};

	const handleSelectRepository = (repo: GitHubRepository) => {
		setSelectedRepoId(repo.id);
	};

	const handleConnect = () => {
		const selectedRepo = githubRepos.find((r) => r.id === selectedRepoId);
		if (selectedRepo) {
			void handleConnectRepository(selectedRepo);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create your first environment</DialogTitle>
					<DialogDescription>
						{hasConnectedRepo
							? "You can only connect one repository at a time. Please remove your existing repository before adding a new one."
							: "Select a repository to create an environment."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					{hasConnectedRepo ? (
						<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
									<Github className="h-5 w-5 text-amber-500" />
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium text-amber-500">
										Repository Already Connected
									</p>
									<p className="text-xs text-muted-foreground">
										{repositories[0]?.metadata?.fullName ?? "Repository connected"}
									</p>
								</div>
							</div>
						</div>
					) : fetchingRepos ? (
						<div className="flex flex-col items-center justify-center py-12">
							<Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
							<p className="text-sm text-muted-foreground">
								Loading repositories...
							</p>
						</div>
					) : githubRepos.length > 0 ? (
						<>
							<div className="flex flex-col gap-2">
								<label htmlFor="repository" className="text-sm font-medium">
									Repository
								</label>
								<ScrollArea className="h-[400px] rounded-lg border border-border/60">
									<div className="space-y-2 p-4">
										{githubRepos.map((repo) => (
											<button
												key={repo.id}
												onClick={() => handleSelectRepository(repo)}
												className={`w-full rounded-lg border p-3 text-left transition-colors ${
													selectedRepoId === repo.id
														? "border-primary bg-primary/10"
														: "border-border/60 hover:border-border hover:bg-muted/50"
												}`}
											>
												<div className="flex items-start justify-between">
													<div className="flex-1 space-y-1">
														<div className="flex items-center gap-2">
															<p className="font-medium text-foreground">
																{repo.full_name}
															</p>
															{repo.private && (
																<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
																	Private
																</span>
															)}
														</div>
														{repo.description && (
															<p className="text-xs text-muted-foreground line-clamp-2">
																{repo.description}
															</p>
														)}
														<div className="flex items-center gap-3 text-xs text-muted-foreground">
															{repo.language && <span>{repo.language}</span>}
															<span>⭐ {repo.stargazers_count}</span>
															{repo.updated_at && (
																<span>
																	Updated {new Date(repo.updated_at).toLocaleDateString()}
																</span>
															)}
														</div>
													</div>
													{selectedRepoId === repo.id && (
														<Check className="h-5 w-5 flex-shrink-0 text-primary" />
													)}
												</div>
											</button>
										))}
									</div>
								</ScrollArea>
							</div>

							<p className="text-xs text-muted-foreground">
								This list only includes repositories that you have access to in GitHub and can use with Console.
								Missing a repo?{" "}
								<a
									href={`https://github.com/settings/installations`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									Configure repository access
								</a>
								.
							</p>

							<div className="flex gap-2">
								<Button
									onClick={() => {
										setGithubRepos([]);
										setSelectedRepoId(null);
										setOpen(false);
									}}
									variant="outline"
									className="flex-1"
								>
									Cancel
								</Button>
								<Button
									onClick={handleConnect}
									disabled={!selectedRepoId || connectMutation.isPending}
									className="flex-1 gap-2"
								>
									{connectMutation.isPending ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Creating...
										</>
									) : (
										<>
											<Check className="h-4 w-4" />
											Create environment
										</>
									)}
								</Button>
							</div>
						</>
					) : (
						<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
							<Github className="mx-auto h-12 w-12 text-muted-foreground/60" />
							<p className="mt-3 text-sm text-muted-foreground">
								No repositories found for this organization
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Make sure the GitHub App is installed on the repositories you want to connect.
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
