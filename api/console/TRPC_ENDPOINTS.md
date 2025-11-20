# Console API - tRPC Endpoints Reference

## Workspace Router

### `workspace.resolveFromClerkOrgId`
**Type:** Public Procedure (no auth required)

Resolves workspace ID and key from Clerk organization ID.

```typescript
// Input
{
  clerkOrgId: string
}

// Output
{
  workspaceId: string;      // Database UUID
  workspaceKey: string;     // External key (ws-<slug>)
  workspaceSlug: string;    // Human-readable slug
}

// Usage
const { data } = await trpc.workspace.resolveFromClerkOrgId.query({
  clerkOrgId: "org_abc123"
});
```

---

### `workspace.listByClerkOrgId`
**Type:** Protected Procedure (requires auth)

Lists all workspaces for a Clerk organization.

```typescript
// Input
{
  clerkOrgId: string
}

// Output
Array<{
  id: string;
  slug: string;
  isDefault: boolean;
  createdAt: string | Date;
}>

// Usage
const { data } = await trpc.workspace.listByClerkOrgId.query({
  clerkOrgId: "org_abc123"
});
```

---

### `workspace.statistics`
**Type:** Protected Procedure (requires auth)

Gets comprehensive workspace statistics for dashboard.

```typescript
// Input
{
  workspaceId: string;
  clerkOrgId: string;
}

// Output
{
  sources: {
    total: number;
    byType: Record<string, number>;
    list: Array<{
      id: string;
      type: string;
      displayName: string;
      documentCount: number;
      lastSyncedAt: string | null;
      lastIngestedAt: string | null;
      metadata: object;
    }>;
  };
  stores: {
    total: number;
    list: Array<{
      id: string;
      slug: string;
      indexName: string;
      embeddingDim: number;
      documentCount: number;
      createdAt: string | Date;
    }>;
  };
  documents: {
    total: number;
    chunks: number;
  };
  jobs: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    recent: Array<{
      id: string;
      name: string;
      status: "queued" | "running" | "completed" | "failed" | "cancelled";
      trigger: "manual" | "scheduled" | "webhook" | "automatic";
      createdAt: string;
      completedAt: string | null;
      durationMs: string | null;
      errorMessage: string | null;
    }>;
  };
}

// Usage
const { data } = await trpc.workspace.statistics.query({
  workspaceId: "ws_xyz789",
  clerkOrgId: "org_abc123"
});
```

**Notes:**
- Jobs are from last 24 hours only
- Document/chunk counts are total (not time-filtered)
- Sources include type distribution (GitHub, etc.)

---

### `workspace.statisticsComparison`
**Type:** Protected Procedure (requires auth)

Compares workspace statistics between two time periods.

```typescript
// Input
{
  workspaceId: string;
  clerkOrgId: string;
  currentStart: string;    // ISO datetime
  currentEnd: string;      // ISO datetime
  previousStart: string;   // ISO datetime
  previousEnd: string;     // ISO datetime
}

// Output
{
  current: {
    jobs: {
      total: number;
      completed: number;
      failed: number;
      successRate: number;
      avgDurationMs: number;
    };
    documents: {
      total: number;
      chunks: number;
    };
  };
  previous: {
    // Same structure as current
  };
  changes: {
    jobs: {
      total: number;           // Percentage change
      completed: number;       // Percentage change
      failed: number;          // Percentage change
      successRate: number;     // Absolute difference
      avgDurationMs: number;   // Percentage change
    };
    documents: {
      total: number;           // Percentage change
      chunks: number;          // Percentage change
    };
  };
}

// Example Usage
const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

const { data } = await trpc.workspace.statisticsComparison.query({
  workspaceId: "ws_xyz789",
  clerkOrgId: "org_abc123",
  currentStart: oneDayAgo.toISOString(),
  currentEnd: now.toISOString(),
  previousStart: twoDaysAgo.toISOString(),
  previousEnd: oneDayAgo.toISOString()
});

// data.changes.jobs.total = 25.0 (25% increase)
// data.changes.jobs.successRate = -2.5 (2.5% decrease)
```

---

### `workspace.jobPercentiles`
**Type:** Protected Procedure (requires auth)
**Added:** Phase C

Gets job duration percentile metrics for performance analysis.

```typescript
// Input
{
  workspaceId: string;
  clerkOrgId: string;
  timeRange: "24h" | "7d" | "30d";  // Default: "24h"
}

// Output
{
  hasData: boolean;     // False if no completed jobs
  p50: number;          // Median duration in milliseconds
  p95: number;          // 95th percentile in milliseconds
  p99: number;          // 99th percentile in milliseconds
  max: number;          // Maximum duration in milliseconds
  sampleSize: number;   // Number of jobs analyzed
}

// Usage
const { data } = await trpc.workspace.jobPercentiles.query({
  workspaceId: "ws_xyz789",
  clerkOrgId: "org_abc123",
  timeRange: "24h"
});

// Example output:
// {
//   hasData: true,
//   p50: 2345,      // 2.3 seconds
//   p95: 5123,      // 5.1 seconds
//   p99: 8765,      // 8.8 seconds
//   max: 12456,     // 12.5 seconds
//   sampleSize: 147
// }
```

**Algorithm:**
1. Filters completed jobs in time range with non-null durations
2. Sorts durations in ascending order
3. Calculates percentile index: `(percentile/100) * (length - 1)`
4. Returns exact value if index is integer, interpolates otherwise

**Use Cases:**
- Performance monitoring dashboards
- SLA tracking (e.g., p95 under 5 seconds)
- Outlier detection (max vs p99)

---

### `workspace.performanceTimeSeries`
**Type:** Protected Procedure (requires auth)
**Added:** Phase C

Gets hourly time-series data for job performance charts.

```typescript
// Input
{
  workspaceId: string;
  clerkOrgId: string;
  timeRange: "24h" | "7d" | "30d";  // Default: "24h"
}

// Output
Array<{
  timestamp: string;    // ISO datetime (hour bucket) "2025-11-19T14"
  hour: string;         // Human-readable "2 PM"
  jobCount: number;     // Total jobs in this hour
  avgDuration: number;  // Average duration in milliseconds
  successRate: number;  // Percentage (0-100)
}>

// Usage
const { data } = await trpc.workspace.performanceTimeSeries.query({
  workspaceId: "ws_xyz789",
  clerkOrgId: "org_abc123",
  timeRange: "24h"
});

// Example output:
// [
//   { timestamp: "2025-11-19T00", hour: "12 AM", jobCount: 5, avgDuration: 3456, successRate: 100 },
//   { timestamp: "2025-11-19T01", hour: "1 AM", jobCount: 3, avgDuration: 2987, successRate: 100 },
//   { timestamp: "2025-11-19T02", hour: "2 AM", jobCount: 0, avgDuration: 0, successRate: 100 },
//   // ... 21 more hours
// ]
```

**Algorithm:**
1. Creates hour buckets for entire range (24, 168, or 720 hours)
2. Groups jobs by hour using `createdAt` timestamp truncated to hour
3. For each bucket:
   - Counts total jobs
   - Counts completed jobs
   - Sums durations of completed jobs
   - Calculates average duration and success rate
4. Returns chronologically sorted array

**Use Cases:**
- Time-series charts (line/area charts)
- Identifying peak/off-peak hours
- Detecting performance degradation over time
- Capacity planning

**Chart Example:**
```typescript
// Recharts usage
<AreaChart data={data}>
  <XAxis dataKey="hour" />
  <YAxis />
  <Area type="monotone" dataKey="jobCount" stroke="#8884d8" />
</AreaChart>
```

---

### `workspace.systemHealth`
**Type:** Protected Procedure (requires auth)
**Added:** Phase C

Gets hierarchical system health view (Workspace → Stores → Sources).

```typescript
// Input
{
  workspaceId: string;
  clerkOrgId: string;
}

// Output
{
  workspaceHealth: "healthy" | "degraded" | "down";
  storesCount: number;
  sourcesCount: number;
  totalJobs24h: number;
  stores: Array<{
    id: string;
    name: string;
    embeddingDim: number;
    documentCount: number;
    successRate: number;        // 0-100
    health: "healthy" | "degraded" | "down";
    sources: Array<{
      id: string;
      type: string;             // "github", etc.
      displayName: string;
      documentCount: number;
      lastSyncedAt: string | null;
      health: "healthy" | "degraded" | "down";
    }>;
  }>;
}

// Usage
const { data } = await trpc.workspace.systemHealth.query({
  workspaceId: "ws_xyz789",
  clerkOrgId: "org_abc123"
});

// Example output:
// {
//   workspaceHealth: "healthy",
//   storesCount: 2,
//   sourcesCount: 3,
//   totalJobs24h: 24,
//   stores: [
//     {
//       id: "store_abc123",
//       name: "docs-store",
//       embeddingDim: 1536,
//       documentCount: 42,
//       successRate: 98.5,
//       health: "healthy",
//       sources: [
//         {
//           id: "src_xyz789",
//           type: "github",
//           displayName: "lightfast/lightfast",
//           documentCount: 35,
//           lastSyncedAt: "2025-11-19T10:30:00",
//           health: "healthy"
//         }
//       ]
//     }
//   ]
// }
```

**Health Status Logic:**
- **Healthy**: ≥95% success rate (green indicator)
- **Degraded**: 80-94% success rate (yellow indicator)
- **Down**: <80% success rate (red indicator)

**Calculation:**
1. **Workspace health**: Based on all jobs in last 24h
2. **Store health**: Based on all workspace jobs (simplified)
3. **Source health**: Based on jobs filtered by `repositoryId`

**Use Cases:**
- System monitoring dashboards
- Proactive issue detection
- Drilling down from workspace → store → source
- Historical health tracking

**Visual Hierarchy:**
```
Workspace (healthy)
├─ Store A (healthy)
│  ├─ Source 1 (healthy)
│  └─ Source 2 (degraded) ⚠
└─ Store B (down) ✗
   └─ Source 3 (down) ✗
```

---

## Error Handling

All procedures use tRPC's error handling:

```typescript
// Client-side error handling
try {
  const data = await trpc.workspace.statistics.query({ ... });
} catch (error) {
  if (error instanceof TRPCClientError) {
    if (error.data?.code === "UNAUTHORIZED") {
      // Handle auth error
    }
    if (error.data?.code === "NOT_FOUND") {
      // Handle not found
    }
  }
}

// Or with React Query
const { data, error, isError } = useQuery(
  trpc.workspace.statistics.queryOptions({ ... })
);

if (isError) {
  console.error(error.data?.code);
}
```

**Common Error Codes:**
- `UNAUTHORIZED`: User not authenticated
- `NOT_FOUND`: Resource doesn't exist
- `BAD_REQUEST`: Invalid input (Zod validation failed)
- `INTERNAL_SERVER_ERROR`: Database or server error

---

## Best Practices

### 1. Use Suspense Queries for RSC
```typescript
const { data } = useSuspenseQuery({
  ...trpc.workspace.statistics.queryOptions({ ... }),
  refetchOnMount: false,
  refetchOnWindowFocus: false
});
```

### 2. Prefetch in Server Components
```typescript
// layout.tsx or page.tsx
import { trpc, prefetch } from "@repo/console-trpc/server";

export default async function Page() {
  prefetch(trpc.workspace.statistics.queryOptions({ ... }));

  return <HydrateClient><ClientComponent /></HydrateClient>;
}
```

### 3. Type-Safe Client Access
```typescript
import { useTRPC } from "@repo/console-trpc/react";

function Component() {
  const trpc = useTRPC();

  const { data } = useQuery({
    ...trpc.workspace.jobPercentiles.queryOptions({ ... })
  });

  // data is fully typed!
  const median = data.p50; // number
}
```

### 4. Stale Time Configuration
```typescript
// Short-lived data (jobs, metrics)
useQuery({
  ...trpc.workspace.statistics.queryOptions({ ... }),
  staleTime: 30_000  // 30 seconds
});

// Long-lived data (workspace config)
useQuery({
  ...trpc.workspace.resolveFromClerkOrgId.queryOptions({ ... }),
  staleTime: 5 * 60_000  // 5 minutes
});
```

---

## Performance Tips

1. **Batch Queries**: tRPC automatically batches parallel queries
2. **Use Indexes**: All queries use indexed columns (workspaceId, createdAt)
3. **Limit Time Ranges**: Performance endpoints default to 24h
4. **Cache Appropriately**: Use React Query's staleTime based on data volatility
5. **Prefetch Critical Data**: Prefetch in RSC to avoid waterfalls

---

## Migration Guide

### Adding New Procedures

1. **Define in Router**:
```typescript
// api/console/src/router/workspace.ts
export const workspaceRouter = {
  myNewProcedure: protectedProcedure
    .input(z.object({ ... }))
    .query(async ({ ctx, input }) => {
      // Implementation
    })
} satisfies TRPCRouterRecord;
```

2. **Rebuild API Package**:
```bash
pnpm --filter @api/console build
```

3. **Use in Client**:
```typescript
const { data } = useQuery(
  trpc.workspace.myNewProcedure.queryOptions({ ... })
);
```

Types are automatically inferred!
