"use client";

import { useState } from "react";
import { Code2, GitPullRequest, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";

interface CodeReviewsTabProps {
	orgId: number;
}

// Mock data for now - will be replaced with real data from API
const MOCK_REVIEWS = [
	{
		id: "1",
		repositoryName: "lightfastai/lightfast",
		pullRequestNumber: 189,
		pullRequestTitle: "feat(deus): add Clerk auth and simplified repository connection",
		status: "completed" as const,
		tool: "coderabbit",
		triggeredAt: "2024-10-07T14:30:00Z",
		taskCount: 3,
	},
	{
		id: "2",
		repositoryName: "lightfastai/lightfast",
		pullRequestNumber: 188,
		pullRequestTitle: "feat: add Deus app - AI workflow orchestration platform",
		status: "running" as const,
		tool: "coderabbit",
		triggeredAt: "2024-10-07T12:15:00Z",
		taskCount: 0,
	},
];

const STATUS_CONFIG = {
	pending: {
		icon: Clock,
		label: "Pending",
		variant: "secondary" as const,
		color: "text-muted-foreground",
	},
	running: {
		icon: Clock,
		label: "Running",
		variant: "default" as const,
		color: "text-blue-500",
	},
	completed: {
		icon: CheckCircle2,
		label: "Completed",
		variant: "default" as const,
		color: "text-green-500",
	},
	failed: {
		icon: XCircle,
		label: "Failed",
		variant: "destructive" as const,
		color: "text-destructive",
	},
	cancelled: {
		icon: XCircle,
		label: "Cancelled",
		variant: "secondary" as const,
		color: "text-muted-foreground",
	},
};

function formatTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function CodeReviewsTab({ orgId }: CodeReviewsTabProps) {
	const [reviews] = useState(MOCK_REVIEWS);

	return (
		<div className="mt-12 w-full max-w-6xl">
			<Card className="border-border bg-card/50">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Code2 className="h-5 w-5" />
								Code Reviews
							</CardTitle>
							<CardDescription className="mt-1">
								Recent code review runs triggered by Deus
							</CardDescription>
						</div>
						<Button size="sm" variant="outline">
							<GitPullRequest className="mr-2 h-4 w-4" />
							Trigger Review
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{reviews.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<Code2 className="h-12 w-12 text-muted-foreground/40" />
							<p className="mt-4 text-sm font-medium text-foreground">
								No code reviews yet
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Trigger your first code review to get started
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{reviews.map((review) => {
								const statusConfig = STATUS_CONFIG[review.status];
								const StatusIcon = statusConfig.icon;

								return (
									<div
										key={review.id}
										className="group relative flex items-start gap-4 rounded-lg border border-border/60 bg-background/50 p-4 transition-colors hover:border-border hover:bg-background"
									>
										<div className="flex-shrink-0 pt-1">
											<StatusIcon
												className={`h-5 w-5 ${statusConfig.color}`}
											/>
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-4">
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<h3 className="text-sm font-medium truncate">
															{review.pullRequestTitle}
														</h3>
													</div>
													<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
														<span className="font-mono">
															{review.repositoryName}
														</span>
														<span>·</span>
														<span>PR #{review.pullRequestNumber}</span>
														<span>·</span>
														<span>{formatTimeAgo(review.triggeredAt)}</span>
													</div>
													{review.status === "completed" && review.taskCount > 0 && (
														<div className="mt-2">
															<Badge variant="secondary" className="text-xs">
																{review.taskCount}{" "}
																{review.taskCount === 1 ? "task" : "tasks"}
															</Badge>
														</div>
													)}
												</div>
												<div className="flex shrink-0 items-center gap-2">
													<Badge variant={statusConfig.variant} className="text-xs">
														{statusConfig.label}
													</Badge>
													<Button
														variant="ghost"
														size="sm"
														className="h-8 opacity-0 transition-opacity group-hover:opacity-100"
													>
														View
													</Button>
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
