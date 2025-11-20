"use client";

import { useState, useMemo } from "react";
import { produce } from "immer";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Github, ExternalLink, Loader2, Play, MoreVertical, Settings, Search, Check, AlertCircle } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { useToast } from "@repo/ui/hooks/use-toast";
import { ConnectRepositoryDialog } from "./connect-repository-dialog";
import { RepositoryConfigDialog } from "./repository-config-dialog";
import type { ConfigStatus } from "./repository-config-status";
import { SetupGuideModal } from "./setup-guide-modal";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrgAccess } from "~/hooks/use-org-access";
import { formatDistanceToNow } from "date-fns";

export function RepositoriesSettings() {
	// Get org data from prefetched cache
	const { clerkOrgId } = useOrgAccess();
	const [showConnectDialog, setShowConnectDialog] = useState(false);
	const [showSetupGuide, setShowSetupGuide] = useState(false);
	const [selectedRepoForSetup, setSelectedRepoForSetup] = useState<string>("");
	const [showConfigDialog, setShowConfigDialog] = useState(false);
	const [selectedFullName, setSelectedFullName] = useState<string>("");
	const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();

	// Query to fetch organization's connected repositories
	// Using useSuspenseQuery for better loading UX with Suspense boundaries
	const { data: repositories = [] } = useSuspenseQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			clerkOrgId
		}),
		refetchOnMount: false, // Use prefetched server data
		refetchOnWindowFocus: false, // Don't refetch on window focus
		staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes (repos don't change often)
	});

	// Filter repositories based on search query
	const filteredRepositories = useMemo(() => {
		if (!searchQuery.trim()) return repositories;
		const query = searchQuery.toLowerCase();
		return repositories.filter((repo) => {
			const fullName = repo.metadata?.fullName?.toLowerCase() ?? "";
			const description = repo.metadata?.description?.toLowerCase() ?? "";
			return fullName.includes(query) || description.includes(query);
		});
	}, [repositories, searchQuery]);

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
					trpc.repository.list.queryKey({ includeInactive: false, clerkOrgId }),
					(oldData: typeof repositories | undefined) => {
						if (!oldData) return oldData;
						return produce(oldData, (draft) => {
							const repo = draft.find((r) => r.id === variables.repositoryId);
							if (repo) {
								repo.configStatus = data.exists ? "configured" : "unconfigured";
								repo.configPath = data.path ?? null;
							}
						});
					},
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
						clerkOrgId,
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
			clerkOrgId,
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
		reindexMutation.mutate({ repositoryId, clerkOrgId });
	};

	const handleViewConfig = (fullName?: string, installationId?: string | number) => {
		if (!fullName || !installationId) return;
		setSelectedFullName(fullName);
		setSelectedInstallationId(typeof installationId === "string" ? Number.parseInt(installationId, 10) : installationId);
		setShowConfigDialog(true);
	};

	const getStatusBadge = (status: ConfigStatus) => {
		switch (status) {
			case "configured":
				return (
					<Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
						<Check className="h-3 w-3" />
						Configured
					</Badge>
				);
			case "unconfigured":
				return (
					<Badge variant="secondary" className="gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
						<Settings className="h-3 w-3" />
						Setup needed
					</Badge>
				);
			case "ingesting":
				return (
					<Badge variant="secondary" className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
						<Loader2 className="h-3 w-3 animate-spin" />
						Ingesting
					</Badge>
				);
			case "error":
				return (
					<Badge variant="secondary" className="gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
						<AlertCircle className="h-3 w-3" />
						Error
					</Badge>
				);
			case "pending":
			default:
				return (
					<Badge variant="secondary" className="gap-1.5">
						<Loader2 className="h-3 w-3 animate-spin" />
						Checking
					</Badge>
				);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div className="flex-1 max-w-md">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search repositories..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>
				<Button onClick={() => setShowConnectDialog(true)} size="sm" className="gap-2">
					<Plus className="h-4 w-4" />
					Connect repository
				</Button>
			</div>

			{hasRepositories ? (
				<div className="rounded-lg border border-border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[40%]">Repository</TableHead>
								<TableHead className="w-[15%]">Config Status</TableHead>
								<TableHead className="w-[12%]">Documents</TableHead>
								<TableHead className="w-[18%]">Last Updated</TableHead>
								<TableHead className="w-[15%] text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredRepositories.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
										No repositories match your search
									</TableCell>
								</TableRow>
							) : (
								filteredRepositories.map((repo) => (
									<TableRow key={repo.id}>
										<TableCell>
											<div className="flex items-start gap-3">
												<div className="flex-shrink-0 mt-0.5">
													<Github className="h-4 w-4 text-muted-foreground" />
												</div>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="text-sm font-medium truncate">
															{repo.metadata?.fullName ?? "Unknown Repository"}
														</span>
														{repo.metadata?.private && (
															<Badge variant="secondary" className="text-xs">
																Private
															</Badge>
														)}
													</div>
													{repo.metadata?.description && (
														<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
															{repo.metadata.description}
														</p>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell>
											{getStatusBadge(repo.configStatus as ConfigStatus)}
										</TableCell>
										<TableCell>
											<span className="text-sm">
												{repo.documentCount !== undefined && repo.documentCount > 0
													? repo.documentCount.toLocaleString()
													: "—"}
											</span>
										</TableCell>
										<TableCell>
											<span className="text-sm text-muted-foreground">
												{repo.lastIngestedAt
													? formatDistanceToNow(new Date(repo.lastIngestedAt), { addSuffix: true })
													: "Never"}
											</span>
										</TableCell>
										<TableCell className="text-right">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
														<MoreVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													{repo.configStatus === "unconfigured" && (
														<>
															<DropdownMenuItem
																onClick={() => handleSetupClick(repo.metadata?.fullName ?? "")}
															>
																<Settings className="h-4 w-4" />
																Configure
															</DropdownMenuItem>
															<DropdownMenuSeparator />
														</>
													)}
													<DropdownMenuItem
														onClick={() => handleStartIndexing(repo.id)}
														disabled={reindexMutation.isPending}
													>
														{reindexMutation.isPending ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Play className="h-4 w-4" />
														)}
														Reindex
													</DropdownMenuItem>
													<DropdownMenuItem
														asChild
													>
														<a
															href={`https://github.com/${repo.metadata?.fullName}`}
															target="_blank"
															rel="noopener noreferrer"
														>
															<ExternalLink className="h-4 w-4" />
															View on GitHub
														</a>
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => handleViewConfig(repo.metadata?.fullName, repo.githubInstallationId)}
													>
														<Settings className="h-4 w-4" />
														View Config
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() => handleRetryConfig(repo.id)}
													>
														<Loader2 className="h-4 w-4" />
														Check Config
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-12">
					<div className="flex flex-col items-center text-center">
						<div className="rounded-full bg-muted p-3">
							<Github className="h-6 w-6 text-muted-foreground" />
						</div>
						<h3 className="mt-4 text-sm font-semibold">No repositories connected</h3>
						<p className="mt-2 text-sm text-muted-foreground max-w-sm">
							Connect a GitHub repository from your organization to get started with Console
						</p>
						<Button
							onClick={() => setShowConnectDialog(true)}
							className="mt-6 gap-2"
						>
							<Plus className="h-4 w-4" />
							Connect your first repository
						</Button>
					</div>
				</div>
			)}

			<ConnectRepositoryDialog
				open={showConnectDialog}
				onOpenChange={setShowConnectDialog}
				clerkOrgId={clerkOrgId}
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
