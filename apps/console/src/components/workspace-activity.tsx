"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Activity,
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	Database,
	GitBranch,
	Play,
	Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Button } from "@repo/ui/components/ui/button";

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

interface Source {
	id: string;
	type: string;
	displayName: string;
	documentCount: number;
	lastSyncedAt: string | null;
	lastIngestedAt: string | null;
}

interface WorkspaceActivityProps {
	recentJobs: Job[];
	sources: Source[];
	orgSlug: string;
	workspaceSlug: string;
}

export function WorkspaceActivity({
	recentJobs,
	sources,
	orgSlug,
	workspaceSlug,
}: WorkspaceActivityProps) {
	// Filter state
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [sourceFilter, setSourceFilter] = useState<string>("all");

	// Filter jobs based on selections
	const filteredJobs = useMemo(() => {
		let filtered = recentJobs;

		// Filter by status
		if (statusFilter !== "all") {
			filtered = filtered.filter((job) => job.status === statusFilter);
		}

		// Filter by source (extract from job name if possible)
		if (sourceFilter !== "all") {
			filtered = filtered.filter((job) =>
				job.name.toLowerCase().includes(sourceFilter.toLowerCase())
			);
		}

		return filtered;
	}, [recentJobs, statusFilter, sourceFilter]);

	// Count active filters
	const activeFilterCount = [
		statusFilter !== "all" ? 1 : 0,
		sourceFilter !== "all" ? 1 : 0,
	].reduce((a, b) => a + b, 0);

	// Reset all filters
	const resetFilters = () => {
		setStatusFilter("all");
		setSourceFilter("all");
	};

	const getStatusIcon = (status: Job["status"]) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-4 w-4 text-green-600" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-600" />;
			case "running":
				return <Play className="h-4 w-4 text-blue-600 animate-pulse" />;
			case "queued":
				return <Clock className="h-4 w-4 text-yellow-600" />;
			case "cancelled":
				return <AlertCircle className="h-4 w-4 text-gray-600" />;
		}
	};

	const getStatusBadge = (status: Job["status"]) => {
		switch (status) {
			case "completed":
				return (
					<Badge variant="default" className="text-xs">
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
					<Badge variant="secondary" className="text-xs">
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

	const getJobBackgroundClass = (status: Job["status"]) => {
		switch (status) {
			case "failed":
				return "bg-red-500/5";
			case "running":
				return "bg-blue-500/5";
			default:
				return "";
		}
	};

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{/* Recent Activity */}
			<Card className="border-border/60">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Recent Activity</CardTitle>
						{recentJobs.length > 0 && (
							<div className="flex items-center gap-2">
								{activeFilterCount > 0 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={resetFilters}
										className="h-8 text-xs"
									>
										Clear
										{activeFilterCount > 0 && (
											<Badge variant="secondary" className="ml-1.5 h-4 w-4 p-0 text-[10px]">
												{activeFilterCount}
											</Badge>
										)}
									</Button>
								)}
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="h-8 w-[120px] text-xs">
										<Filter className="h-3 w-3 mr-1.5" />
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Status</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
										<SelectItem value="failed">Failed</SelectItem>
										<SelectItem value="running">Running</SelectItem>
										<SelectItem value="queued">Queued</SelectItem>
									</SelectContent>
								</Select>
								{sources.length > 0 && (
									<Select value={sourceFilter} onValueChange={setSourceFilter}>
										<SelectTrigger className="h-8 w-[140px] text-xs">
											<Database className="h-3 w-3 mr-1.5" />
											<SelectValue placeholder="Source" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Sources</SelectItem>
											{sources.map((source) => (
												<SelectItem key={source.id} value={source.displayName}>
													{source.displayName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{recentJobs.length === 0 ? (
							<div className="text-center py-8 text-sm text-muted-foreground">
								<Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="font-medium">No recent activity</p>
								<p className="text-xs mt-1">
									Jobs will appear here once you connect a repository
								</p>
							</div>
						) : filteredJobs.length === 0 ? (
							<div className="text-center py-8 text-sm text-muted-foreground">
								<Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="font-medium">No jobs match your filters</p>
								<p className="text-xs mt-1">
									Try adjusting or clearing your filters
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={resetFilters}
									className="mt-3"
								>
									Clear Filters
								</Button>
							</div>
						) : (
							filteredJobs.map((job) => (
								<div
									key={job.id}
									className={`flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 ${getJobBackgroundClass(job.status)}`}
								>
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
										{getStatusIcon(job.status)}
									</div>
									<div className="flex-1 min-w-0 space-y-1">
										<div className="flex items-center gap-2 justify-between">
											<p className="text-sm font-medium truncate">{job.name}</p>
											{getStatusBadge(job.status)}
										</div>
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
											<span>•</span>
											<span>
												{formatDistanceToNow(new Date(job.createdAt), {
													addSuffix: true,
												})}
											</span>
										</div>
										{job.errorMessage && (
											<p className="text-xs text-red-600 truncate">
												{job.errorMessage}
											</p>
										)}
									</div>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>

			{/* Connected Sources */}
			<Card className="border-border/60">
				<CardHeader>
					<CardTitle>Connected Sources</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{sources.length === 0 ? (
							<div className="text-center py-8 text-sm text-muted-foreground">
								<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="font-medium">No sources connected</p>
								<p className="text-xs mt-1 mb-4">
									Connect a GitHub repository to start building your workspace memory
								</p>
								<Button variant="default" size="sm" asChild>
									<a href="/new">Connect Source</a>
								</Button>
							</div>
						) : (
							sources.map((source) => (
								<div
									key={source.id}
									className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200"
								>
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
										<Database className="h-4 w-4 text-primary" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<p className="text-sm font-medium truncate">
												{source.displayName}
											</p>
											<Badge variant="outline" className="text-xs">
												{source.type}
											</Badge>
										</div>
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span>{source.documentCount} docs</span>
											{source.lastSyncedAt && (
												<>
													<span>•</span>
													<span>
														synced{" "}
														{formatDistanceToNow(new Date(source.lastSyncedAt), {
															addSuffix: true,
														})}
													</span>
												</>
											)}
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
