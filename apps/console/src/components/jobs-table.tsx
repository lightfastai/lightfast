"use client";

import { useState, useEffect } from "react";
import {
	CheckCircle2,
	XCircle,
	Clock,
	Loader2,
	PlayCircle,
	MoreHorizontal,
	RotateCcw,
	StopCircle,
	Eye,
	Calendar,
	Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobTrigger = "manual" | "scheduled" | "webhook" | "automatic";

interface Job {
	id: string;
	name: string;
	status: JobStatus;
	trigger: JobTrigger;
	startedAt: string | null;
	createdAt: string;
	durationMs?: string | null;
}

interface JobsTableWrapperProps {
	clerkOrgSlug: string;
	workspaceSlug: string;
}

interface JobsTableProps {
	clerkOrgSlug: string;
	workspaceSlug: string;
}

/**
 * Wrapper component for JobsTable
 */
export function JobsTableWrapper({ clerkOrgSlug, workspaceSlug }: JobsTableWrapperProps) {
	return <JobsTable clerkOrgSlug={clerkOrgSlug} workspaceSlug={workspaceSlug} />;
}


const statusConfig: Record<
	JobStatus,
	{ icon: typeof CheckCircle2; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
	queued: { icon: Clock, label: "Queued", variant: "secondary" },
	running: { icon: Loader2, label: "Running", variant: "default" },
	completed: { icon: CheckCircle2, label: "Completed", variant: "outline" },
	failed: { icon: XCircle, label: "Failed", variant: "destructive" },
	cancelled: { icon: StopCircle, label: "Cancelled", variant: "outline" },
};

const triggerConfig: Record<JobTrigger, { icon: typeof PlayCircle; label: string }> = {
	manual: { icon: PlayCircle, label: "Manual" },
	scheduled: { icon: Clock, label: "Scheduled" },
	webhook: { icon: Zap, label: "Webhook" },
	automatic: { icon: Calendar, label: "Automatic" },
};

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function StatusBadge({ status }: { status: JobStatus }) {
	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<Badge variant={config.variant} className="gap-1.5">
			<Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
			{config.label}
		</Badge>
	);
}

function TriggerBadge({ trigger }: { trigger: JobTrigger }) {
	const config = triggerConfig[trigger];
	const Icon = config.icon;

	return (
		<Badge variant="outline" className="gap-1.5">
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}

function JobRow({ job }: { job: Job }) {
	const handleViewDetails = () => {
		console.log("View details for job:", job.id);
		// TODO: Navigate to job detail page or open modal
	};

	const handleRetry = () => {
		console.log("Retry job:", job.id);
		// TODO: Call tRPC mutation to retry job
	};

	const handleCancel = () => {
		console.log("Cancel job:", job.id);
		// TODO: Call tRPC mutation to cancel job
	};

	return (
		<TableRow className="cursor-pointer hover:bg-muted/5" onClick={handleViewDetails}>
			<TableCell className="font-medium">
				<div className="flex items-center gap-2">
					<StatusBadge status={job.status} />
					<span className="text-sm">{job.name}</span>
				</div>
			</TableCell>
			<TableCell>
				<TriggerBadge trigger={job.trigger} />
			</TableCell>
			<TableCell className="text-sm text-muted-foreground">
				{job.startedAt
					? formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })
					: formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
			</TableCell>
			<TableCell className="text-sm text-muted-foreground">
				{job.durationMs !== null && job.durationMs !== undefined ? (
					formatDuration(Number.parseInt(job.durationMs, 10))
				) : job.status === "running" ? (
					<span className="flex items-center gap-1.5">
						<Loader2 className="h-3 w-3 animate-spin" />
						In progress
					</span>
				) : (
					"—"
				)}
			</TableCell>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Open menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleViewDetails}>
							<Eye className="mr-2 h-4 w-4" />
							View details
						</DropdownMenuItem>
						{job.status === "failed" && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleRetry}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Retry
								</DropdownMenuItem>
							</>
						)}
						{job.status === "running" && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleCancel} className="text-destructive">
									<StopCircle className="mr-2 h-4 w-4" />
									Cancel
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</TableCell>
		</TableRow>
	);
}

function EmptyState({ filter }: { filter: string }) {
	const messages: Record<string, { title: string; description: string }> = {
		all: {
			title: "No jobs found",
			description: "No workflow executions have been triggered yet.",
		},
		running: {
			title: "No running jobs",
			description: "There are currently no jobs in progress.",
		},
		completed: {
			title: "No completed jobs",
			description: "No jobs have finished successfully yet.",
		},
		failed: {
			title: "No failed jobs",
			description: "Great! You have no failed jobs.",
		},
	};

	const message = (filter in messages ? messages[filter] : messages.all)!;

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="rounded-full bg-muted/20 p-3 mb-4">
				<Loader2 className="h-8 w-8 text-muted-foreground" />
			</div>
			<h3 className="text-sm font-medium mb-1">{message.title}</h3>
			<p className="text-xs text-muted-foreground max-w-sm">{message.description}</p>
		</div>
	);
}

function JobsTable({ clerkOrgSlug, workspaceSlug }: JobsTableProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("all");

	// Fetch jobs list
	const { data: jobsData } = useSuspenseQuery({
		...trpc.jobs.list.queryOptions({
			clerkOrgSlug,
			workspaceSlug,
			status: activeTab === "all" ? undefined : (activeTab as JobStatus),
			limit: 50,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const jobs = jobsData.items;

	// Poll for updates every 5 seconds if there are running jobs
	useEffect(() => {
		const hasRunningJobs = jobs.some((job) => job.status === "running");
		if (!hasRunningJobs) return;

		const interval = setInterval(() => {
			// Invalidate and refetch jobs list
			queryClient.invalidateQueries({
				queryKey: trpc.jobs.list.queryOptions({
					clerkOrgSlug,
					workspaceSlug,
					status: activeTab === "all" ? undefined : (activeTab as JobStatus),
					limit: 50,
				}).queryKey,
			});
		}, 5000);

		return () => clearInterval(interval);
	}, [jobs, queryClient, trpc, clerkOrgSlug, workspaceSlug, activeTab]);

	// Filter jobs based on search
	const filteredJobs = jobs.filter((job) => {
		return job.name.toLowerCase().includes(searchQuery.toLowerCase());
	});

	const runningCount = jobs.filter((j) => j.status === "running").length;
	const completedCount = jobs.filter((j) => j.status === "completed").length;
	const failedCount = jobs.filter((j) => j.status === "failed").length;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Workflow Jobs</CardTitle>
						<CardDescription>Monitor and manage your workflow executions</CardDescription>
					</div>
					<div className="flex items-center gap-3">
						<Input
							placeholder="Search jobs..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-64"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="mb-4">
						<TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
						<TabsTrigger value="running">
							Running ({runningCount})
							{runningCount > 0 && (
								<span className="ml-1.5 flex h-2 w-2 rounded-full bg-primary animate-pulse" />
							)}
						</TabsTrigger>
						<TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
						<TabsTrigger value="failed">Failed ({failedCount})</TabsTrigger>
					</TabsList>

					<TabsContent value={activeTab} className="mt-0">
						{filteredJobs.length > 0 ? (
							<div className="rounded-lg border border-border/60">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Job Name</TableHead>
											<TableHead>Trigger</TableHead>
											<TableHead>Started</TableHead>
											<TableHead>Duration</TableHead>
											<TableHead className="w-[60px]">
												<span className="sr-only">Actions</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredJobs.map((job) => (
											<JobRow key={job.id} job={job} />
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<EmptyState filter={activeTab} />
						)}
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
