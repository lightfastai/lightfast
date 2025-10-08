"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { useTRPC } from "@repo/deus-trpc/react";
import { useState } from "react";

interface CodeReviewsTabProps {
	orgId: string;
}

const STATUS_CONFIG = {
	pending: {
		icon: Clock,
		color: "text-muted-foreground",
	},
	running: {
		icon: Clock,
		color: "text-blue-500",
	},
	completed: {
		icon: CheckCircle2,
		color: "text-green-500",
	},
	failed: {
		icon: XCircle,
		color: "text-destructive",
	},
};

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function CodeReviewsTab({ orgId }: CodeReviewsTabProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [syncingId, setSyncingId] = useState<string | null>(null);

	// ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
	const { data: reviews, isLoading, error } = useQuery({
		...trpc.codeReview.list.queryOptions({
			organizationId: orgId,
		}),
	});

	const { data: repositories = [] } = useQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: orgId,
		}),
	});

	const syncMutation = useMutation(
		trpc.codeReview.sync.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.codeReview.list.queryOptions({ organizationId: orgId }).queryKey,
				});
			},
			onSettled: () => {
				setSyncingId(null);
			},
		})
	);

	const scanMutation = useMutation(
		trpc.codeReview.scanRepository.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.codeReview.list.queryOptions({ organizationId: orgId }).queryKey,
				});
			},
		})
	);

	const handleSync = (reviewId: string) => {
		setSyncingId(reviewId);
		syncMutation.mutate({
			reviewId,
			organizationId: orgId,
		});
	};

	const handleScanRepository = (repositoryId: string) => {
		scanMutation.mutate({
			organizationId: orgId,
			repositoryId,
			reviewTool: "claude",
		});
	};

	// NOW WE CAN DO CONDITIONAL RENDERING
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<p className="text-sm text-muted-foreground">Loading code reviews...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<p className="text-sm text-destructive">Failed to load code reviews</p>
				<p className="text-xs text-muted-foreground mt-1">{error.message}</p>
			</div>
		);
	}

	if (!reviews || reviews.length === 0) {
		if (repositories.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<p className="text-sm text-muted-foreground">
						No repositories connected yet
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Connect a repository to start reviewing PRs
					</p>
				</div>
			);
		}

		return (
			<div className="flex flex-col items-center justify-center py-16 text-center gap-4">
				<div>
					<p className="text-sm font-medium mb-1">No code reviews yet</p>
					<p className="text-xs text-muted-foreground">
						Scan your connected repositories for open pull requests
					</p>
				</div>
				<div className="flex flex-col gap-2 w-full max-w-xs">
					{repositories.map((repo) => (
						<Button
							key={repo.id}
							variant="outline"
							onClick={() => handleScanRepository(repo.id)}
							disabled={scanMutation.isPending}
							className="w-full justify-between"
						>
							<span className="truncate">
								{repo.metadata?.fullName || "Unknown repository"}
							</span>
							{scanMutation.isPending ? (
								<RefreshCw className="h-4 w-4 animate-spin ml-2" />
							) : (
								<span className="text-xs text-muted-foreground ml-2">
									Scan for PRs
								</span>
							)}
						</Button>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-0">
			{reviews.map((review, index) => {
				const statusConfig = STATUS_CONFIG[review.status];
				const StatusIcon = statusConfig.icon;

				// Extract cached PR metadata
				const prTitle = review.metadata?.prTitle || `PR #${review.pullRequestNumber}`;
				const repositoryName = review.repository?.metadata?.fullName || "Unknown repository";
				const bugCount = review.metadata?.taskCount || 0;

				// Check if metadata is missing (new connection, no sync yet)
				const hasMetadata = Boolean(review.metadata?.prTitle);
				const isDeleted = review.metadata?.deleted === true;
				const isSyncing = syncingId === review.id;

				// Determine severity from metadata (you can add this field to metadata)
				const severity = review.status === "failed" ? "severe" : "warning";

				return (
					<div
						key={review.id}
						className={`group flex items-center gap-4 py-2 px-4 -mx-4 hover:bg-muted/50 transition-colors ${
							index !== reviews.length - 1 ? "border-b border-border/40" : ""
						}`}
					>
						<div className="flex-1 min-w-0">
							<h3 className="text-sm font-medium mb-1 truncate">
								{prTitle}
							</h3>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{formatDate(review.triggeredAt)}</span>
								<span>·</span>
								<span className="font-mono">{repositoryName}</span>
								<span>·</span>
								<span>refs/pull/{review.pullRequestNumber}/head</span>
							</div>
						</div>

						<div className="flex items-center gap-3 shrink-0">
							{!hasMetadata && !isDeleted && (
								<Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
									<Clock className="h-3 w-3" />
									Not synced
								</Badge>
							)}
							{isDeleted && (
								<Badge variant="destructive" className="gap-1.5 font-normal">
									<XCircle className="h-3 w-3" />
									PR deleted
								</Badge>
							)}
							{bugCount > 0 && (
								<Badge
									variant={
										severity === "severe" ? "destructive" : "secondary"
									}
									className="gap-1.5 font-normal"
								>
									<AlertCircle className="h-3 w-3" />
									{bugCount} {bugCount === 1 ? "bug" : "bugs"}
									{severity === "severe" && " (severe)"}
								</Badge>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => handleSync(review.id)}
								disabled={isSyncing}
								title="Refresh PR metadata"
							>
								<RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
							</Button>
							<Button variant="outline" size="sm" className="h-8 px-3">
								Fix
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
