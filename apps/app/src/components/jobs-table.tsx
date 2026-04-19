"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  GitCommit,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  StopCircle,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Job, JobStatus } from "~/types";
import { useJobFilters } from "./use-job-filters";

interface JobsTableWrapperProps {
  initialSearch?: string;
  initialStatus?: string;
}

interface JobsTableProps {
  initialSearch?: string;
  initialStatus?: string;
}

/**
 * Wrapper component for JobsTable
 */
export function JobsTableWrapper({
  initialStatus,
  initialSearch,
}: JobsTableWrapperProps) {
  return (
    <JobsTable initialSearch={initialSearch} initialStatus={initialStatus} />
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  }
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/**
 * Extract event type from job name (text before colon)
 * Examples:
 * - "LLM entities: jZpSEV4ulG9kCSGtgPMO5" -> "LLM entities"
 * - "Update profile: github:56789" -> "Update profile"
 * - "Capture github/issue.opened" -> "Capture github/issue.opened"
 */
function getEventType(jobName: string): string {
  const colonIndex = jobName.indexOf(":");
  if (colonIndex === -1) {
    return jobName;
  }
  return jobName.slice(0, colonIndex).trim();
}

interface JobRowProps {
  job: Job;
}

function JobRow({ job }: JobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract commit data from job input (safely handle discriminated union)
  const commitSha: string | undefined =
    job.input && "afterSha" in job.input
      ? String(job.input.afterSha)
      : undefined;
  const commitMessage: string | undefined =
    job.input && "commitMessage" in job.input
      ? String(job.input.commitMessage)
      : undefined;
  const branch: string | undefined =
    job.input && "branch" in job.input ? String(job.input.branch) : undefined;

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
          "border-border/60 border-b px-6 py-4 transition-colors hover:bg-muted/30",
          hasDetails && "cursor-pointer",
          isExpanded && "bg-muted/30"
        )}
        {...(hasDetails
          ? {
              role: "button" as const,
              tabIndex: 0,
              onClick: () => setIsExpanded(!isExpanded),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }
              },
            }
          : {})}
      >
        <div className="flex items-center gap-6">
          {/* Left: Job ID + Event Type */}
          <div className="flex w-[140px] flex-shrink-0 flex-col gap-1">
            <span className="font-mono text-sm">#{job.id}</span>
            <span className="truncate text-muted-foreground text-xs">
              {getEventType(job.name)}
            </span>
          </div>

          {/* Status + Duration */}
          <div className="flex w-[140px] flex-shrink-0 flex-col gap-1">
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
            <span className="text-muted-foreground text-xs">
              {job.durationMs === null
                ? job.status === "running"
                  ? "In progress"
                  : "—"
                : formatDuration(Number.parseInt(job.durationMs, 10))}
            </span>
          </div>

          {/* Middle: Branch + Commit info (stacked vertically) */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Branch */}
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm">{branch ?? "main"}</span>
            </div>
            {/* Commit */}
            <div className="flex items-center gap-2">
              <GitCommit className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground text-xs">
                {commitSha?.slice(0, 7) ?? ""}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {commitMessage ?? job.name}
              </span>
            </div>
          </div>

          {/* Right: Time + User + Actions */}
          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="whitespace-nowrap text-muted-foreground text-sm">
              {job.startedAt
                ? formatDistanceToNow(new Date(job.startedAt), {
                    addSuffix: true,
                  })
                : formatDistanceToNow(new Date(job.createdAt), {
                    addSuffix: true,
                  })}
            </span>
            {job.triggeredBy && (
              <span className="whitespace-nowrap text-muted-foreground text-sm">
                by {job.triggeredBy}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
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
                {(job.status === "running" || job.status === "queued") && (
                  <>
                    {hasDetails && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleCancel}
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
        <div className="border-border/60 border-b bg-muted/20 px-6 py-4">
          <div className="space-y-4">
            {job.errorMessage && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-destructive text-sm">
                  <XCircle className="h-4 w-4" />
                  Error
                </h4>
                <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background p-3 text-xs">
                  {job.errorMessage}
                </pre>
              </div>
            )}
            {job.output && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Output
                </h4>
                <pre className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-border/60 bg-background p-3 text-xs">
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

const EMPTY_STATE_MESSAGES = {
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
    icon: XCircle,
    title: "No failed jobs",
    description: "Great! You have no failed jobs.",
    showCTA: false,
  },
};

type EmptyStateMessageConfig =
  (typeof EMPTY_STATE_MESSAGES)[keyof typeof EMPTY_STATE_MESSAGES];

function EmptyState({ filter }: { filter: string }) {
  const message: EmptyStateMessageConfig =
    filter in EMPTY_STATE_MESSAGES
      ? EMPTY_STATE_MESSAGES[filter as keyof typeof EMPTY_STATE_MESSAGES]
      : EMPTY_STATE_MESSAGES.all;
  const Icon = message.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted/20 p-3">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-1 font-semibold text-sm">{message.title}</h3>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        {message.description}
      </p>
      {message.showCTA && (
        <div className="flex flex-col gap-3">
          <Button size="sm" variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            View documentation
          </Button>
        </div>
      )}
    </div>
  );
}

function JobsTable({ initialStatus, initialSearch }: JobsTableProps) {
  const trpc = useTRPC();
  const {
    status: activeTab,
    setStatus: setActiveTab,
    search: searchQuery,
    setSearch: setSearchQuery,
  } = useJobFilters(initialStatus, initialSearch);

  // Fetch jobs list — polls every 5s when running jobs exist
  const { data: jobsData } = useSuspenseQuery({
    ...trpc.jobs.list.queryOptions({
      status: activeTab === "all" ? undefined : (activeTab as JobStatus),
      limit: 50,
    }),
    staleTime: 10 * 1000, // 10 seconds - jobs are real-time sensitive
    refetchOnMount: true,
    refetchInterval: (query) =>
      query.state.data?.items.some((job) => job.status === "running")
        ? 5000
        : false,
  });

  const jobs = jobsData.items;

  // Normalize once so the filter loop doesn't lowercase on every item
  const searchQueryLower = useMemo(
    () => searchQuery.toLowerCase(),
    [searchQuery]
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => job.name.toLowerCase().includes(searchQueryLower)),
    [jobs, searchQueryLower]
  );

  // Single pass over all jobs to compute tab counts
  const { runningCount, completedCount, failedCount } = useMemo(() => {
    let running = 0;
    let completed = 0;
    let failed = 0;
    for (const j of jobs) {
      if (j.status === "running") {
        running++;
      } else if (j.status === "completed") {
        completed++;
      } else if (j.status === "failed") {
        failed++;
      }
    }
    return {
      runningCount: running,
      completedCount: completed,
      failedCount: failed,
    };
  }, [jobs]);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex items-center justify-between gap-4">
        <Tabs className="flex-1" onValueChange={setActiveTab} value={activeTab}>
          <TabsList>
            <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
            <TabsTrigger value="running">
              Running ({runningCount})
              {runningCount > 0 && (
                <span className="ml-1.5 flex h-2 w-2 animate-pulse rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedCount})
            </TabsTrigger>
            <TabsTrigger value="failed">Failed ({failedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="w-64"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs..."
          value={searchQuery}
        />
      </div>

      {/* Jobs list */}
      {filteredJobs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {filteredJobs.map((job) => (
            <JobRow job={job} key={job.id} />
          ))}
        </div>
      ) : (
        <EmptyState filter={activeTab} />
      )}
    </div>
  );
}
