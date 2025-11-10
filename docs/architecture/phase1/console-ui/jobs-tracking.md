# Jobs Tracking Specification

Last Updated: 2025-11-09

---

## Current State Analysis

### What We Have ✅

**1. `ingestion-commits` Table** (retrospective tracking)
```typescript
{
  id: string;
  storeId: string;
  beforeSha: string;
  afterSha: string;
  deliveryId: string;
  status: "processed" | "skipped" | "failed";
  processedAt: timestamp;
}
```

**Purpose:** Idempotency + audit trail for completed ingestions

**2. `connected-repository.configStatus` Field**
```typescript
configStatus: "configured" | "unconfigured" | "ingesting" | "error" | "pending"
```

**Purpose:** Coarse-grained status indicator (not detailed job tracking)

**3. Inngest Workflows**
- `apps-console/docs-ingestion` - Main orchestrator
- `apps-console/docs.file.process` - Process individual files
- `apps-console/docs.file.delete` - Delete individual files

---

## Problem

**Current tracking is insufficient for a Jobs UI:**
- ❌ No active job tracking (what's running RIGHT NOW?)
- ❌ No progress tracking (12 files processed / 100 total)
- ❌ No detailed error messages visible to user
- ❌ No job duration/timing data
- ❌ Can't see queued jobs waiting to run

**We only know:**
- ✅ Jobs that completed (from `ingestion-commits`)
- ✅ If a repo is "ingesting" (boolean flag)

---

## Solution: Use Inngest API

**No database changes needed!** Query Inngest's API for job status.

**What Inngest Provides:**
- Run ID, status (running, completed, failed)
- Started at, ended at, duration
- Step-by-step execution trace
- Error messages
- Event data (repo, files, etc.)

**Implementation:**
```typescript
// api/console/src/router/jobs.ts
import { inngest } from "../inngest/client";

export const jobsRouter = {
  list: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      status: z.enum(["running", "completed", "failed"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Query Inngest API for function runs
      // Filter by organization/workspace
      // Return formatted job list
    }),

  get: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get detailed run info from Inngest
      // Return steps, timing, errors
    }),
} satisfies TRPCRouterRecord;
```

**Pros:**
- ✅ No database changes
- ✅ Real-time status from source of truth
- ✅ Detailed step-by-step execution data
- ✅ Inngest handles all the tracking

**Cons:**
- ❌ Depends on Inngest API availability
- ❌ Need to handle Inngest API auth/rate limits
- ❌ Historical data retention depends on Inngest plan

---

## UI Design: Jobs Tab

### Layout

```
┌────────────────────────────────────────────────────────┐
│ What should we code next?                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│              (Search interface here)                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Chat] [Jobs]                                          │ ← Tabs
├────────────────────────────────────────────────────────┤
│ Jobs Tab Content:                                      │
│                                                        │
│ Running Jobs (2)                                       │
│ ┌────────────────────────────────────────────────────┐ │
│ │ 🔄 Ingesting lightfastai/lightfast                 │ │
│ │    12 / 45 files processed                         │ │
│ │    Started 2 minutes ago                           │ │
│ │    [View Details]                                  │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ 🔄 Ingesting acme/api                              │ │
│ │    Queued (waiting for rate limit)                 │ │
│ │    Started 30 seconds ago                          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ Completed Jobs (10)                                    │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ✅ Ingested lightfastai/docs                       │ │
│ │    23 files · Completed 1 hour ago                 │ │
│ │    [View Details]                                  │ │
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ❌ Failed: acme/broken-repo                        │ │
│ │    Error: Invalid lightfast.yml syntax             │ │
│ │    Failed 2 hours ago                              │ │
│ │    [Retry] [View Details]                          │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Component Structure

```tsx
// apps/console/src/components/org-chat-interface.tsx

export function OrgChatInterface({ orgId, organizationId, orgSlug }) {
  const [activeTab, setActiveTab] = useState<"chat" | "jobs">("chat");

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {/* Search prompt (always visible) */}
        <PromptInput>...</PromptInput>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="jobs">
              Jobs
              {runningJobsCount > 0 && (
                <Badge variant="secondary">{runningJobsCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            {/* Chat history/results */}
          </TabsContent>

          <TabsContent value="jobs">
            <JobsList organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

### Jobs List Component

```tsx
// apps/console/src/components/jobs-list.tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";

export function JobsList({ organizationId }: { organizationId: string }) {
  const trpc = useTRPC();

  const { data: jobs } = useSuspenseQuery({
    ...trpc.jobs.list.queryOptions({
      organizationId,
      filter: "all",
    }),
    refetchInterval: 3000, // Poll every 3s for active jobs
  });

  const runningJobs = jobs.filter(j => j.status === "running" || j.status === "queued");
  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "failed");

  return (
    <div className="space-y-6">
      {/* Running Jobs */}
      {runningJobs.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium">
            Running Jobs ({runningJobs.length})
          </h3>
          <div className="space-y-2">
            {runningJobs.map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Jobs */}
      <section>
        <h3 className="mb-3 text-sm font-medium">
          Recent Jobs ({completedJobs.length})
        </h3>
        <div className="space-y-2">
          {completedJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Job Card Component

```tsx
// apps/console/src/components/job-card.tsx
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatDistance } from "date-fns";

export function JobCard({ job }) {
  const icon = {
    running: <Loader2 className="h-4 w-4 animate-spin" />,
    queued: <Loader2 className="h-4 w-4" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
  }[job.status];

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {job.type === "docs-ingestion" && "Ingesting"} {job.repoName}
          </p>

          {/* Progress bar for running jobs */}
          {job.status === "running" && job.progress && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{job.progress.processed} / {job.progress.total} files</span>
                <span>{Math.round((job.progress.processed / job.progress.total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(job.progress.processed / job.progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message for failed jobs */}
          {job.status === "failed" && job.errorMessage && (
            <p className="mt-1 text-xs text-red-500">{job.errorMessage}</p>
          )}

          {/* Timing */}
          <p className="mt-2 text-xs text-muted-foreground">
            {job.status === "running" && `Started ${formatDistance(job.startedAt, new Date(), { addSuffix: true })}`}
            {job.status === "completed" && `Completed ${formatDistance(job.completedAt, new Date(), { addSuffix: true })}`}
            {job.status === "failed" && `Failed ${formatDistance(job.completedAt, new Date(), { addSuffix: true })}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">View Details</Button>
          {job.status === "failed" && (
            <Button variant="outline" size="sm">Retry</Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Data Flow

### Active Job Tracking (Inngest API)

```
1. User opens Jobs tab
2. Frontend calls trpc.jobs.list({ organizationId, filter: "all" })
3. Backend calls Inngest API:
   GET /v1/apps/{appId}/runs?status=Running&status=Queued
4. Filter runs by organization (match event.data.organizationId)
5. Transform Inngest run data to job format
6. Return to frontend
7. Frontend polls every 3s for updates
```

### Historical Job Tracking (Database)

```
1. User opens Jobs tab
2. Frontend calls trpc.jobs.list({ organizationId, filter: "completed" })
3. Backend queries ingestion_commits table
4. Join with repositories to get repo names
5. Return formatted job history
6. No polling needed (static data)
```

---

## Implementation Checklist

### Phase 1: Inngest API Integration

- [ ] Add `jobs` tRPC router (`api/console/src/router/jobs.ts`)
- [ ] Implement Inngest API client wrapper
- [ ] Add `list` procedure (query running jobs + completed jobs)
- [ ] Add `get` procedure (get detailed run info)
- [ ] Add Jobs tab to search interface
- [ ] Create `JobsList` component
- [ ] Create `JobCard` component
- [ ] Add polling for active jobs (3s interval)

---

## Summary

**Current State:**
- ❌ No detailed job tracking
- ✅ `ingestion-commits` table for completed jobs (retrospective)
- ✅ `configStatus: "ingesting"` flag (coarse-grained)

**Recommended Solution:**
- ✅ Use Inngest API for job tracking (no DB changes)
- ✅ Add Jobs tab with shadcn Tabs below search
- ✅ Poll Inngest API every 3s for active jobs
- ✅ Query `ingestion-commits` for historical jobs
- ✅ Show progress, errors, timing for each job
