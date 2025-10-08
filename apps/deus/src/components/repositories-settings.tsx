"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Plus, Github, ExternalLink } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { ConnectRepositoryDialog } from "./connect-repository-dialog";
import { useTRPC } from "@repo/deus-trpc/react";

interface RepositoriesSettingsProps {
	organizationId: string;
}

export function RepositoriesSettings({ organizationId }: RepositoriesSettingsProps) {
	const [showConnectDialog, setShowConnectDialog] = useState(false);
	const trpc = useTRPC();
	const params = useParams();

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
									className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/5 p-4"
								>
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
									<div className="flex items-center gap-2 shrink-0 ml-4">
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
										<Button variant="outline" size="sm">
											Remove
										</Button>
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
										Connect a GitHub repository from your organization to get started with Deus
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
				githubOrgId={params.orgId ? Number(params.orgId) : undefined}
			/>
		</div>
	);
}
