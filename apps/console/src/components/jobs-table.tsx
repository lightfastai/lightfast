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
  GitBranch,
  GitCommit,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useSuspenseQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
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
  {
    icon: typeof CheckCircle2;
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  queued: { icon: Clock, label: "Queued", variant: "secondary" },
  running: { icon: Loader2, label: "Running", variant: "default" },
  completed: { icon: CheckCircle2, label: "Completed", variant: "outline" },
  failed: { icon: XCircle, label: "Failed", variant: "destructive" },
  cancelled: { icon: StopCircle, label: "Cancelled", variant: "outline" },
};

const triggerConfig: Record<
  JobTrigger,
  { icon: typeof PlayCircle; label: string }
> = {
  manual: { icon: PlayCircle, label: "Manual" },
  scheduled: { icon: Clock, label: "Scheduled" },
  webhook: { icon: Zap, label: "Webhook" },
  automatic: { icon: Calendar, label: "Automatic" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
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

interface JobRowProps {
  job: Job;
  clerkOrgSlug: string;
  workspaceName: string;
}

function JobRow({ job, clerkOrgSlug, workspaceName }: JobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Extract commit data from job input
  const commitSha = job.input?.afterSha;
  const commitMessage = job.input?.commitMessage;
  const branch = job.input?.branch;
  // Store slug comes from the joined workspaceStores table
  const storeSlug = job.storeSlug;

  // Restart mutation
  const restartMutation = useMutation(
    trpc.jobs.restart.mutationOptions({
      onSuccess: () => {
        toast.success("Job restart triggered", {
          description: "A new sync has been queued.",
        });
        // Invalidate jobs list to show the new job
        void queryClient.invalidateQueries({
          queryKey: trpc.jobs.list.queryOptions({
            clerkOrgSlug,
            workspaceName,
            limit: 50,
          }).queryKey,
        });
      },
      onError: (error) => {
        toast.error("Failed to restart job", {
          description: error.message,
        });
      },
    }),
  );

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    restartMutation.mutate({
      jobId: job.id,
      clerkOrgSlug,
      workspaceName,
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Cancel job:", job.id);
    // TODO: Call tRPC mutation to cancel job
  };

  const hasDetails = job.errorMessage ?? job.output;

  return (
    <>
      <div
        className={cn(
          "border-b border-border/60 py-4 px-6 hover:bg-muted/30 transition-colors cursor-pointer",
          isExpanded && "bg-muted/30",
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-6">
          {/* Left: Commit SHA + Store slug */}
          <div className="flex flex-col gap-1 w-[120px] flex-shrink-0">
            <span className="font-mono text-sm">
              {commitSha ? commitSha.substring(0, 8) : job.id.substring(0, 8)}
            </span>
            <span className="text-xs text-muted-foreground">
              {storeSlug || "—"}
            </span>
          </div>

          {/* Status + Duration */}
          <div className="flex flex-col gap-1 w-[140px] flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {job.status === "completed" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              )}
              {job.status === "failed" && (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              {job.status === "running" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {job.status === "queued" && (
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {job.status === "cancelled" && (
                <StopCircle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-sm capitalize">{job.status}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {job.durationMs !== null
                ? formatDuration(Number.parseInt(job.durationMs, 10))
                : job.status === "running"
                  ? "In progress"
                  : "—"}
            </span>
          </div>

          {/* Middle: Branch + Commit info (stacked vertically) */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* Branch */}
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{branch || "main"}</span>
            </div>
            {/* Commit */}
            <div className="flex items-center gap-2">
              <GitCommit className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">
                {commitSha ? commitSha.substring(0, 7) : ""}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {commitMessage || job.name}
              </span>
            </div>
          </div>

          {/* Right: Time + User + Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {job.startedAt
                ? formatDistanceToNow(new Date(job.startedAt), {
                    addSuffix: true,
                  })
                : formatDistanceToNow(new Date(job.createdAt), {
                    addSuffix: true,
                  })}
            </span>
            {job.triggeredBy && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                by {job.triggeredBy}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                {(job.status === "completed" ||
                  job.status === "failed" ||
                  job.status === "cancelled") && (
                  <>
                    {hasDetails && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleRetry}
                      disabled={restartMutation.isPending}
                    >
                      <RotateCcw
                        className={cn(
                          "mr-2 h-4 w-4",
                          restartMutation.isPending && "animate-spin",
                        )}
                      />
                      {restartMutation.isPending ? "Restarting..." : "Restart"}
                    </DropdownMenuItem>
                  </>
                )}
                {(job.status === "running" || job.status === "queued") && (
                  <>
                    {hasDetails && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleCancel}
                      className="text-destructive"
                    >
                      <StopCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
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
        </div>
      )}
    </>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const messages = {
    all: {
      icon: PlayCircle,
      title: "No jobs yet",
      description:
        "Workflow executions will appear here once they're triggered.",
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
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {message.description}
      </p>
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

function JobsTable({
  clerkOrgSlug,
  workspaceName,
  initialStatus,
  initialSearch,
}: JobsTableProps) {
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
            <TabsTrigger value="completed">
              Completed ({completedCount})
            </TabsTrigger>
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

      {/* Jobs list */}
      {filteredJobs.length > 0 ? (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          {filteredJobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              clerkOrgSlug={clerkOrgSlug}
              workspaceName={workspaceName}
            />
          ))}
        </div>
      ) : (
        <EmptyState filter={activeTab} />
      )}
    </div>
  );
}
