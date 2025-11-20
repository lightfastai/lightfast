"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	Play,
	GitBranch,
	Activity,
	ChevronDown,
	ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@repo/ui/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";

interface Job {
	id: string;
	name: string;
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
	trigger: "manual" | "scheduled" | "webhook" | "automatic";
	createdAt: string;
	completedAt: string | null;
	durationMs: string | null;
	errorMessage: string | null;
}

interface ActivityTimelineProps {
	recentJobs: Job[];
}

export function ActivityTimeline({ recentJobs }: ActivityTimelineProps) {
	const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

	const getStatusIcon = (status: Job["status"]) => {
		switch (status) {
			case "completed":
				return (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
					</div>
				);
			case "failed":
				return (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
					</div>
				);
			case "running":
				return (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
						<Play className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
					</div>
				);
			case "queued":
				return (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
						<Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
					</div>
				);
			case "cancelled":
				return (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900/30">
						<AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
					</div>
				);
		}
	};

	const getStatusBadge = (status: Job["status"]) => {
		switch (status) {
			case "completed":
				return (
					<Badge variant="default" className="text-xs bg-green-600">
						Completed
					</Badge>
				);
			case "failed":
				return (
					<Badge variant="destructive" className="text-xs">
						Failed
					</Badge>
				);
			case "running":
				return (
					<Badge variant="secondary" className="text-xs bg-blue-600 text-white">
						Running
					</Badge>
				);
			case "queued":
				return (
					<Badge variant="outline" className="text-xs">
						Queued
					</Badge>
				);
			case "cancelled":
				return (
					<Badge variant="outline" className="text-xs">
						Cancelled
					</Badge>
				);
		}
	};

	const getTriggerIcon = (trigger: Job["trigger"]) => {
		switch (trigger) {
			case "webhook":
				return <GitBranch className="h-3 w-3" />;
			case "manual":
				return <Play className="h-3 w-3" />;
			case "scheduled":
				return <Clock className="h-3 w-3" />;
			case "automatic":
				return <Activity className="h-3 w-3" />;
		}
	};

	// Limit to 10 most recent events
	const displayJobs = recentJobs.slice(0, 10);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">Recent Activity</CardTitle>
			</CardHeader>
			<CardContent>
				{displayJobs.length === 0 ? (
					<div className="text-center py-8 text-sm text-muted-foreground">
						<Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No recent activity</p>
						<p className="text-xs mt-1">
							Jobs will appear here once you connect a repository
						</p>
					</div>
				) : (
					<div className="space-y-0">
						{displayJobs.map((job, index) => (
							<Collapsible
								key={job.id}
								open={expandedJobId === job.id}
								onOpenChange={(open) =>
									setExpandedJobId(open ? job.id : null)
								}
							>
								<div className="relative">
									{/* Timeline connector line */}
									{index < displayJobs.length - 1 && (
										<div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
									)}

									<div className="flex items-start gap-4 py-3">
										{/* Status Icon */}
										<div className="relative z-10 shrink-0">
											{getStatusIcon(job.status)}
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0 space-y-1">
											<div className="flex items-center justify-between gap-2">
												<div className="flex items-center gap-2 flex-1 min-w-0">
													<CollapsibleTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-auto p-0 hover:bg-transparent font-medium text-sm"
														>
															<span className="truncate">{job.name}</span>
															{expandedJobId === job.id ? (
																<ChevronDown className="h-4 w-4 ml-1 shrink-0" />
															) : (
																<ChevronRight className="h-4 w-4 ml-1 shrink-0" />
															)}
														</Button>
													</CollapsibleTrigger>
													{getStatusBadge(job.status)}
												</div>

												{/* Timestamp */}
												<span className="text-xs text-muted-foreground shrink-0">
													{formatDistanceToNow(new Date(job.createdAt), {
														addSuffix: true,
													})}
												</span>
											</div>

											{/* Metadata */}
											<div className="flex items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													{getTriggerIcon(job.trigger)}
													{job.trigger}
												</span>
												{job.durationMs && job.status === "completed" && (
													<>
														<span>•</span>
														<span>
															{Number.parseInt(job.durationMs, 10) < 1000
																? `${job.durationMs}ms`
																: `${(Number.parseInt(job.durationMs, 10) / 1000).toFixed(1)}s`}
														</span>
													</>
												)}
											</div>

											{/* Error message (not in collapsible) */}
											{job.errorMessage && (
												<p className="text-xs text-red-600 dark:text-red-400 truncate">
													{job.errorMessage}
												</p>
											)}

											{/* Expandable details */}
											<CollapsibleContent className="pt-2">
												<div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-xs">
													<div className="grid grid-cols-2 gap-2">
														<div>
															<span className="font-medium text-muted-foreground">
																Job ID:
															</span>
															<p className="font-mono mt-0.5">{job.id}</p>
														</div>
														<div>
															<span className="font-medium text-muted-foreground">
																Created:
															</span>
															<p className="mt-0.5">
																{new Date(job.createdAt).toLocaleString()}
															</p>
														</div>
														{job.completedAt && (
															<div>
																<span className="font-medium text-muted-foreground">
																	Completed:
																</span>
																<p className="mt-0.5">
																	{new Date(job.completedAt).toLocaleString()}
																</p>
															</div>
														)}
														{job.durationMs && (
															<div>
																<span className="font-medium text-muted-foreground">
																	Duration:
																</span>
																<p className="mt-0.5">
																	{Number.parseInt(job.durationMs, 10) < 1000
																		? `${job.durationMs}ms`
																		: `${(Number.parseInt(job.durationMs, 10) / 1000).toFixed(2)}s`}
																</p>
															</div>
														)}
													</div>
													{job.errorMessage && (
														<div className="pt-2 border-t">
															<span className="font-medium text-muted-foreground">
																Error Details:
															</span>
															<p className="mt-1 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
																{job.errorMessage}
															</p>
														</div>
													)}
												</div>
											</CollapsibleContent>
										</div>
									</div>
								</div>
							</Collapsible>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
