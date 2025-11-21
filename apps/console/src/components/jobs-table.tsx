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
	Calendar,
	Zap,
	ChevronDown,
	ChevronRight,
	FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
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
import { cn } from "@repo/ui/lib/utils";
import { useJobFilters } from "./use-job-filters";
import type { Job, JobStatus, JobTrigger } from "~/types";

interface JobsTableWrapperProps {
	clerkOrgSlug: string;
	workspaceName: string;
	initialStatus?: string;
	initialSearch?: string;
}

interface JobsTableProps {
	clerkOrgSlug: string;
	workspaceName: string;
	initialStatus?: string;
	initialSearch?: string;
}

/**
 * Wrapper component for JobsTable
 */
export function JobsTableWrapper({
	clerkOrgSlug,
	workspaceName,
	initialStatus,
	initialSearch,
}: JobsTableWrapperProps) {
	return (
		<JobsTable
			clerkOrgSlug={clerkOrgSlug}
			workspaceName={workspaceName}
			initialStatus={initialStatus}
			initialSearch={initialSearch}
		/>
	);
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
	const [isExpanded, setIsExpanded] = useState(false);

	const handleRetry = (e: React.MouseEvent) => {
		e.stopPropagation();
		console.log("Retry job:", job.id);
		// TODO: Call tRPC mutation to retry job
	};

	const handleCancel = (e: React.MouseEvent) => {
		e.stopPropagation();
		console.log("Cancel job:", job.id);
		// TODO: Call tRPC mutation to cancel job
	};

	const hasDetails = job.errorMessage ?? job.output;

	return (
		<>
			<TableRow
				className={cn(
					"cursor-pointer hover:bg-muted/5",
					isExpanded && "border-b-0"
				)}
				onClick={() => hasDetails && setIsExpanded(!isExpanded)}
			>
				<TableCell className="font-medium">
					<div className="flex items-center gap-2">
						{hasDetails ? (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 hover:bg-transparent"
								onClick={(e) => {
									e.stopPropagation();
									setIsExpanded(!isExpanded);
								}}
							>
								{isExpanded ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
							</Button>
						) : (
							<div className="w-6" />
						)}
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
							{hasDetails && (
								<DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
									<FileText className="mr-2 h-4 w-4" />
									{isExpanded ? "Hide" : "View"} details
								</DropdownMenuItem>
							)}
							{job.status === "failed" && (
								<>
									{hasDetails && <DropdownMenuSeparator />}
									<DropdownMenuItem onClick={handleRetry}>
										<RotateCcw className="mr-2 h-4 w-4" />
										Retry
									</DropdownMenuItem>
								</>
							)}
							{job.status === "running" && (
								<>
									{hasDetails && <DropdownMenuSeparator />}
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
			{isExpanded && hasDetails && (
				<TableRow>
					<TableCell colSpan={5} className="bg-muted/20 p-6">
						<div className="space-y-4">
							{job.errorMessage && (
								<div>
									<h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
										<XCircle className="h-4 w-4" />
										Error
									</h4>
									<pre className="text-xs bg-background border border-border/60 rounded-lg p-3 overflow-x-auto">
										{job.errorMessage}
									</pre>
								</div>
							)}
							{job.output && (
								<div>
									<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-green-500" />
										Output
									</h4>
									<pre className="text-xs bg-background border border-border/60 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
										{JSON.stringify(job.output, null, 2)}
									</pre>
								</div>
							)}
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}

function EmptyState({ filter }: { filter: string }) {
	const messages = {
		all: {
			icon: PlayCircle,
			title: "No jobs yet",
			description: "Workflow executions will appear here once they're triggered.",
			showCTA: true,
		},
		running: {
			icon: Clock,
			title: "No running jobs",
			description: "There are currently no jobs in progress.",
			showCTA: false,
		},
		completed: {
			icon: CheckCircle2,
			title: "No completed jobs",
			description: "Successfully completed jobs will appear here.",
			showCTA: false,
		},
		failed: {
			icon: CheckCircle2,
			title: "No failed jobs",
			description: "Great! You have no failed jobs.",
			showCTA: false,
		},
	};

	type MessageConfig = (typeof messages)[keyof typeof messages];

	const message: MessageConfig =
		filter in messages
			? messages[filter as keyof typeof messages]
			: messages.all;
	const Icon = message.icon;

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="rounded-full bg-muted/20 p-3 mb-4">
				<Icon className="h-8 w-8 text-muted-foreground" />
			</div>
			<h3 className="text-sm font-semibold mb-1">{message.title}</h3>
			<p className="text-sm text-muted-foreground max-w-sm mb-6">{message.description}</p>
			{message.showCTA && (
				<div className="flex flex-col gap-3">
					<Button variant="outline" size="sm">
						<FileText className="mr-2 h-4 w-4" />
						View documentation
					</Button>
				</div>
			)}
		</div>
	);
}

function JobsTable({ clerkOrgSlug, workspaceName, initialStatus, initialSearch }: JobsTableProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const {
		status: activeTab,
		setStatus: setActiveTab,
		search: searchQuery,
		setSearch: setSearchQuery,
	} = useJobFilters(initialStatus, initialSearch);

	// Fetch jobs list
	const { data: jobsData } = useSuspenseQuery({
		...trpc.jobs.list.queryOptions({
			clerkOrgSlug,
			workspaceName,
			status: activeTab === "all" ? undefined : (activeTab as JobStatus),
			limit: 50,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 10 * 1000, // 10 seconds - jobs are real-time sensitive
	});

	const jobs = jobsData.items;

	// Poll for updates every 5 seconds if there are running jobs
	useEffect(() => {
		const hasRunningJobs = jobs.some((job) => job.status === "running");
		if (!hasRunningJobs) return;

		const interval = setInterval(() => {
			// Invalidate and refetch jobs list
			void queryClient.invalidateQueries({
				queryKey: trpc.jobs.list.queryOptions({
					clerkOrgSlug,
					workspaceName,
					status: activeTab === "all" ? undefined : (activeTab as JobStatus),
					limit: 50,
				}).queryKey,
			});
		}, 5000);

		return () => clearInterval(interval);
	}, [jobs, queryClient, trpc, clerkOrgSlug, workspaceName, activeTab]);

	// Filter jobs based on search
	const filteredJobs = jobs.filter((job) => {
		return job.name.toLowerCase().includes(searchQuery.toLowerCase());
	});

	const runningCount = jobs.filter((j) => j.status === "running").length;
	const completedCount = jobs.filter((j) => j.status === "completed").length;
	const failedCount = jobs.filter((j) => j.status === "failed").length;

	return (
		<div className="space-y-4">
			{/* Filters bar */}
			<div className="flex items-center justify-between gap-4">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
					<TabsList>
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
				</Tabs>
				<Input
					placeholder="Search jobs..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="w-64"
				/>
			</div>

			{/* Jobs table */}
			{filteredJobs.length > 0 ? (
				<div className="rounded-lg border border-border/60 overflow-hidden">
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
		</div>
	);
}
