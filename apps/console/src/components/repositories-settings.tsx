"use client";

import { useState } from "react";
import { produce } from "immer";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Github, ExternalLink, Loader2, Play } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useToast } from "@repo/ui/hooks/use-toast";
import { ConnectRepositoryDialog } from "./connect-repository-dialog";
import { RepositoryConfigStatus } from "./repository-config-status";
import { RepositoryConfigDialog } from "./repository-config-dialog";
import type { ConfigStatus } from "./repository-config-status";
import { SetupGuideModal } from "./setup-guide-modal";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrgAccess } from "~/hooks/use-org-access";

export function RepositoriesSettings() {
	// Get org data from prefetched cache
	const { organizationId, githubOrgId } = useOrgAccess();
	const [showConnectDialog, setShowConnectDialog] = useState(false);
    const [showSetupGuide, setShowSetupGuide] = useState(false);
    const [selectedRepoForSetup, setSelectedRepoForSetup] = useState<string>("");
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [selectedFullName, setSelectedFullName] = useState<string>("");
    const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();

	// Query to fetch organization's connected repositories
	// Using useSuspenseQuery for better loading UX with Suspense boundaries
	const { data: repositories = [] } = useSuspenseQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId
		}),
		refetchOnMount: false, // Use prefetched server data
		refetchOnWindowFocus: false, // Don't refetch on window focus
		staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes (repos don't change often)
	});

	const hasRepositories = repositories.length > 0;

	// Mutation to detect config for a repository
    const detectConfigMutation = useMutation(
        trpc.repository.detectConfig.mutationOptions({
            onSuccess: (data, variables) => {
                toast({
                    title: data.exists ? "Configuration found" : "No configuration",
                    description: data.exists
                        ? `Found config at ${data.path}`
                        : "Set up lightfast.yml to start indexing",
                });

                // Optimistically update repository status in the list for immediate feedback
                queryClient.setQueryData(
                    trpc.repository.list.queryKey({ includeInactive: false, organizationId }),
                    produce((draft: any) => {
                        if (!draft) return;
                        const repo = draft.find((r: any) => r.id === variables.repositoryId);
                        if (repo) {
                            repo.configStatus = data.exists ? "configured" : "unconfigured";
                            repo.configPath = data.path ?? null;
                        }
                    }),
                );
            },
			onError: (error) => {
				toast({
					title: "Detection failed",
					description: error.message,
					variant: "destructive",
				});
			},
			onSettled: () => {
				// Invalidate to refetch with updated status
				// Use refetchType: "none" to avoid triggering Suspense boundaries
				void queryClient.invalidateQueries({
					queryKey: trpc.repository.list.queryKey({
						includeInactive: false,
						organizationId,
					}),
					refetchType: "none",
				});
			},
		})
	);

    const handleSetupClick = (repoFullName: string) => {
        setSelectedRepoForSetup(repoFullName);
        setShowSetupGuide(true);
    };

    const handleRetryConfig = (repositoryId: string) => {
        detectConfigMutation.mutate({
            repositoryId,
            organizationId,
        });
    };

    // Manual reindex mutation
    const reindexMutation = useMutation(
        trpc.repository.reindex.mutationOptions({
            onSuccess: (data) => {
                toast({
                    title: "Indexing started",
                    description: data.matched > 0
                        ? `Queued ${data.matched} files on ${data.ref}`
                        : "No files matched your configuration",
                });
            },
            onError: (error) => {
                toast({ title: "Failed to start indexing", description: error.message, variant: "destructive" });
            },
        })
    );

    const handleStartIndexing = (repositoryId: string) => {
        reindexMutation.mutate({ repositoryId, organizationId });
    };

    const handleViewConfig = (fullName?: string, installationId?: string | number) => {
        if (!fullName || !installationId) return;
        setSelectedFullName(fullName);
        setSelectedInstallationId(typeof installationId === "string" ? Number.parseInt(installationId, 10) : installationId);
        setShowConfigDialog(true);
    };

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Github className="h-5 w-5" />
								Connected Repositories
							</CardTitle>
							<CardDescription>
								Manage GitHub repositories synced to this organization
							</CardDescription>
						</div>
						{hasRepositories && (
							<Button onClick={() => setShowConnectDialog(true)} size="sm" className="gap-2">
								<Plus className="h-4 w-4" />
								Add repository
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{hasRepositories ? (
						<div className="space-y-3">
							{repositories.map((repo) => (
								<div
									key={repo.id}
									className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/5 p-4"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-start gap-3 min-w-0 flex-1">
											<div className="flex-shrink-0 mt-0.5">
												<Github className="h-5 w-5 text-muted-foreground" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<p className="text-sm font-medium truncate">
														{repo.metadata?.fullName ?? "Unknown Repository"}
													</p>
													{repo.metadata?.private && (
														<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
															Private
														</span>
													)}
												</div>
												{repo.metadata?.description && (
													<p className="text-xs text-muted-foreground mt-1 line-clamp-1">
														{repo.metadata.description}
													</p>
												)}
												<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
													{repo.metadata?.language && (
														<span>{repo.metadata.language}</span>
													)}
													{repo.metadata?.stargazersCount !== undefined && (
														<span>⭐ {repo.metadata.stargazersCount}</span>
													)}
												</div>
											</div>
										</div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                    >
												<a
													href={`https://github.com/${repo.metadata?.fullName}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													<ExternalLink className="h-4 w-4" />
												</a>
											</Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewConfig(repo.metadata?.fullName, repo.githubInstallationId)}
                                    >
                                        View Config
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={reindexMutation.isPending}
                                        onClick={() => handleStartIndexing(repo.id)}
                                        className="gap-1.5"
                                    >
                                        {reindexMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Play className="h-4 w-4" />
                                        )}
                                        Start Indexing
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRetryConfig(repo.id)}
                                    >
                                        Check Config
                                    </Button>
                                </div>
                            </div>

									{/* Configuration Status */}
									<div className="border-t border-border/40 pt-3">
										<RepositoryConfigStatus
											status={repo.configStatus as ConfigStatus}
											documentCount={repo.documentCount}
											lastIngestedAt={repo.lastIngestedAt ?? undefined}
											onSetup={() => handleSetupClick(repo.metadata?.fullName ?? "")}
											onRetry={() => handleRetryConfig(repo.id)}
										/>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="py-12">
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8">
								<div className="flex flex-col items-center text-center">
									<Github className="h-12 w-12 text-muted-foreground/60" />
									<p className="mt-3 text-sm font-medium">
										No repositories connected
									</p>
									<p className="mt-1 text-xs text-muted-foreground max-w-sm">
										Connect a GitHub repository from your organization to get started with Console
									</p>
									<Button
										onClick={() => setShowConnectDialog(true)}
										className="mt-4 gap-2"
									>
										<Plus className="h-4 w-4" />
										Connect your first repository
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<ConnectRepositoryDialog
				open={showConnectDialog}
				onOpenChange={setShowConnectDialog}
				organizationId={organizationId}
				githubOrgId={githubOrgId}
			/>

            <SetupGuideModal
                open={showSetupGuide}
                onOpenChange={setShowSetupGuide}
                repositoryName={selectedRepoForSetup}
            />

            <RepositoryConfigDialog
                open={showConfigDialog}
                onOpenChange={setShowConfigDialog}
                fullName={selectedFullName}
                installationId={selectedInstallationId ?? 0}
            />
        </div>
    );
}
