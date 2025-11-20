# Phase C Implementation Summary: New Visualizations with Recharts

## Overview

Successfully implemented Phase C of the dashboard redesign, adding performance visualizations, time-series charts, and hierarchical system health views to the console application.

## Files Created

### 1. `/apps/console/src/lib/performance-utils.ts`
Utility functions for performance calculations and data transformations:

```typescript
// Core utility functions
calculatePercentile(values: number[], percentile: number): number
groupByHour(jobs: Job[]): TimeSeriesPoint[]
formatDuration(ms: number): string
getHealthStatus(successRate: number): 'healthy' | 'degraded' | 'down'
formatPercentileLabel(percentile: number): string
```

**Example Usage:**
```typescript
const durations = [100, 200, 300, 500, 1000];
const p95 = calculatePercentile(durations, 95); // 900

const formatted = formatDuration(2500); // "2.5s"
const health = getHealthStatus(92); // "degraded"
```

### 2. `/apps/console/src/components/performance-metrics.tsx`
React component displaying job performance metrics with Recharts visualization.

**Features:**
- **Percentile Badges**: p50, p95, p99, max duration
- **Time Series Chart**: AreaChart with gradient fill showing job count over last 24 hours
- **Empty State**: Friendly message when no data available

**Visual Structure:**
```
┌─────────────────────────────────────────────────────┐
│ Performance Metrics                                  │
│ Job execution times over the last 24 hours          │
├─────────────────────────────────────────────────────┤
│ [p50: 2.3s] [p95: 5.1s] [p99: 8.7s] [max: 12.4s]  │
│                                                      │
│ Jobs Over Time                                       │
│ ┌───────────────────────────────────────┐          │
│ │          /\                             │          │
│ │         /  \        /\                  │          │
│ │        /    \      /  \    /\          │          │
│ │   /\  /      \    /    \  /  \         │          │
│ │  /  \/        \  /      \/    \___     │          │
│ └───────────────────────────────────────┘          │
│   12AM  3AM  6AM  9AM  12PM  3PM  6PM  9PM         │
└─────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface PerformanceMetricsProps {
  workspaceId: string;
  clerkOrgId: string;
}
```

### 3. `/apps/console/src/components/system-health-overview.tsx`
Hierarchical tree view of system health (Workspace → Stores → Sources).

**Features:**
- **Collapsible Hierarchy**: Expandable store items
- **Health Indicators**: Green/yellow/red dots based on success rate
- **Relative Timestamps**: "2h ago", "1d ago" for last sync
- **Source Icons**: GitHub icon for GitHub repos, generic Database icon for others

**Visual Structure:**
```
┌─────────────────────────────────────────────────────┐
│ System Health                                        │
│ Hierarchical view of workspace components           │
├─────────────────────────────────────────────────────┤
│ ● Workspace                          24 jobs (24h)  │
│   2 stores, 3 sources                               │
│                                                      │
│ ├─ ● docs-store [1536d] [98%]                      │
│ │  ▼  2 documents                                   │
│ │                                                    │
│ │  ├─ ● lightfast/lightfast                        │
│ │  │    2 documents                   2h ago        │
│ │                                                    │
│ │  └─ ● lightfast/docs                             │
│ │       1 document                    1d ago        │
│                                                      │
│ └─ ● code-store [3072d] [100%]                     │
│    ▶  1 document                                    │
└─────────────────────────────────────────────────────┘
```

**Health Status Logic:**
- **Healthy** (green): ≥95% success rate
- **Degraded** (yellow): 80-94% success rate
- **Down** (red): <80% success rate

**Props:**
```typescript
interface SystemHealthOverviewProps {
  workspaceId: string;
  clerkOrgId: string;
}
```

## Files Modified

### 4. `/api/console/src/router/workspace.ts`
Added three new tRPC procedures to the workspace router.

#### New Procedure: `jobPercentiles`

**Endpoint Signature:**
```typescript
trpc.workspace.jobPercentiles.queryOptions({
  workspaceId: string,
  clerkOrgId: string,
  timeRange: "24h" | "7d" | "30d"
})
```

**Response Schema:**
```typescript
{
  hasData: boolean;
  p50: number;        // Median duration in ms
  p95: number;        // 95th percentile in ms
  p99: number;        // 99th percentile in ms
  max: number;        // Maximum duration in ms
  sampleSize: number; // Number of jobs analyzed
}
```

**Example Response:**
```json
{
  "hasData": true,
  "p50": 2345,
  "p95": 5123,
  "p99": 8765,
  "max": 12456,
  "sampleSize": 147
}
```

**SQL Logic:**
1. Filter completed jobs in time range with non-null durations
2. Sort durations in ascending order
3. Calculate percentile indices: `index = (percentile/100) * (length - 1)`
4. Return interpolated values

#### New Procedure: `performanceTimeSeries`

**Endpoint Signature:**
```typescript
trpc.workspace.performanceTimeSeries.queryOptions({
  workspaceId: string,
  clerkOrgId: string,
  timeRange: "24h" | "7d" | "30d"
})
```

**Response Schema:**
```typescript
Array<{
  timestamp: string;    // ISO datetime (hour bucket)
  hour: string;         // Human-readable hour ("2 PM")
  jobCount: number;     // Total jobs in this hour
  avgDuration: number;  // Average duration in ms
  successRate: number;  // Percentage of completed jobs
}>
```

**Example Response:**
```json
[
  {
    "timestamp": "2025-11-19T00",
    "hour": "12 AM",
    "jobCount": 5,
    "avgDuration": 3456,
    "successRate": 100
  },
  {
    "timestamp": "2025-11-19T01",
    "hour": "1 AM",
    "jobCount": 3,
    "avgDuration": 2987,
    "successRate": 100
  },
  // ... 22 more hours
]
```

**Algorithm:**
1. Create hourly buckets (24 for 24h, 168 for 7d, 720 for 30d)
2. Group jobs by hour using `createdAt.slice(0, 13)` (YYYY-MM-DDTHH)
3. Calculate metrics per bucket:
   - Count total jobs
   - Count completed jobs
   - Sum durations of completed jobs
   - Compute average and success rate
4. Return chronologically sorted array

#### New Procedure: `systemHealth`

**Endpoint Signature:**
```typescript
trpc.workspace.systemHealth.queryOptions({
  workspaceId: string,
  clerkOrgId: string
})
```

**Response Schema:**
```typescript
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
    successRate: number;
    health: "healthy" | "degraded" | "down";
    sources: Array<{
      id: string;
      type: string;
      displayName: string;
      documentCount: number;
      lastSyncedAt: string | null;
      health: "healthy" | "degraded" | "down";
    }>;
  }>;
}
```

**Example Response:**
```json
{
  "workspaceHealth": "healthy",
  "storesCount": 2,
  "sourcesCount": 3,
  "totalJobs24h": 24,
  "stores": [
    {
      "id": "store_abc123",
      "name": "docs-store",
      "embeddingDim": 1536,
      "documentCount": 42,
      "successRate": 98.5,
      "health": "healthy",
      "sources": [
        {
          "id": "src_xyz789",
          "type": "github",
          "displayName": "lightfast/lightfast",
          "documentCount": 35,
          "lastSyncedAt": "2025-11-19T10:30:00",
          "health": "healthy"
        }
      ]
    }
  ]
}
```

**Calculation Logic:**
- Fetch stores with document counts (JOIN with docs_documents)
- Fetch active sources
- Get recent jobs (last 24h)
- Calculate health per level:
  - **Source**: Jobs filtered by `repositoryId`
  - **Store**: All workspace jobs (simplified)
  - **Workspace**: All workspace jobs
- Map success rate to health status:
  - ≥95% → healthy
  - 80-94% → degraded
  - <80% → down

### 5. `/apps/console/src/components/workspace-dashboard.tsx`
Integrated new components into the dashboard layout.

**Updated Layout Order:**
1. Workspace Header
2. Key Metrics Strip (6 compact metrics)
3. **Performance Metrics** (NEW - Phase C)
4. **System Health Overview** (NEW - Phase C)
5. Activity Timeline
6. Connected Sources Overview
7. Stores Overview

**Changes:**
```diff
+ import { PerformanceMetrics } from "./performance-metrics";
+ import { SystemHealthOverview } from "./system-health-overview";

  return (
    <div className="space-y-6">
      <WorkspaceHeader ... />
      <KeyMetricsStrip ... />

+     {/* Performance Metrics - Percentiles & Time Series Charts */}
+     <PerformanceMetrics
+       workspaceId={workspace.workspaceId}
+       clerkOrgId={clerkOrgId}
+     />
+
+     {/* System Health Overview - Hierarchical Status */}
+     <SystemHealthOverview
+       workspaceId={workspace.workspaceId}
+       clerkOrgId={clerkOrgId}
+     />

      <ActivityTimeline ... />
      <ConnectedSourcesOverview ... />
      <StoresOverview ... />
    </div>
  );
```

### 6. `/apps/console/package.json`
Added Recharts dependency.

```json
{
  "dependencies": {
    "recharts": "^2.15.4"
  }
}
```

## Technical Details

### Recharts Integration

**Components Used:**
- `AreaChart`: Time-series visualization
- `Area`: Gradient-filled area layer
- `XAxis`: Horizontal axis (hourly labels)
- `YAxis`: Vertical axis (job counts)
- `CartesianGrid`: Background grid lines
- `Tooltip`: Custom hover tooltip
- `ResponsiveContainer`: Auto-sizing wrapper

**Gradient Configuration:**
```tsx
<defs>
  <linearGradient id="jobGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
  </linearGradient>
</defs>
```

**Styling:**
- Uses Tailwind CSS v4 color variables (`hsl(var(--primary))`)
- Responsive container (100% width, 200px height)
- Custom tooltip with border, shadow, and padding
- Consistent with existing design system

### Performance Considerations

**Data Fetching:**
- Uses `useSuspenseQuery` with `refetchOnMount: false`
- Prefetch pattern following tRPC best practices
- Data fetched once on page load, cached by React Query

**SQL Optimization:**
- Indexed queries on `workspaceId` and `createdAt`
- Limited to recent time ranges (24h, 7d, 30d)
- Aggregations done in application layer (Drizzle ORM)
- Future optimization: Move aggregations to SQL with window functions

**Chart Performance:**
- Fixed data points (24 hours = 24 points)
- Memoized chart data transformation
- Lightweight gradient fills vs complex patterns

### Type Safety

**Full Type Inference:**
- tRPC infers response types from router procedures
- React Query types from `queryOptions()`
- TypeScript validates all prop interfaces
- Zod validates input schemas

**Example Type Flow:**
```typescript
// Router defines types
const jobPercentiles = protectedProcedure
  .input(z.object({ ... }))
  .query(async ({ input }) => {
    return {
      hasData: true,
      p50: 2345,
      // ... TypeScript knows exact shape
    };
  });

// Client infers types
const { data } = useSuspenseQuery({
  ...trpc.workspace.jobPercentiles.queryOptions({ ... })
});
// data.p50 is typed as number
// data.hasData is typed as boolean
```

## Testing Scenarios

### Empty State
**When:** No jobs in last 24 hours
**Expected:**
- Performance Metrics shows "No job data available yet" message
- System Health shows "No stores configured yet" if no stores

### Low Data State
**When:** 1-5 jobs in last 24 hours
**Expected:**
- Percentiles calculated from small sample
- Chart shows sparse data points
- Health indicators based on limited data

### Normal State
**When:** Regular job activity (10+ jobs per hour)
**Expected:**
- Smooth time-series curve
- Accurate percentile badges
- Hierarchical health tree with all levels expanded

### Error State
**When:** Store has <80% success rate
**Expected:**
- Red health indicator
- "Down" badge with destructive variant
- Visible in System Health Overview

## Example Chart Outputs

### Performance Metrics Chart (ASCII Art)

```
Jobs Over Time (Last 24 Hours)
  12│                      ╱╲
    │                    ╱    ╲
  10│                  ╱        ╲
    │                ╱            ╲
   8│              ╱                ╲
    │            ╱                    ╲
   6│          ╱                        ╲╱╲
    │        ╱                              ╲
   4│      ╱                                  ╲
    │    ╱                                      ╲
   2│  ╱                                          ╲
    │╱                                              ╲
   0└─────────────────────────────────────────────────
    12AM 2AM 4AM 6AM 8AM 10AM 12PM 2PM 4PM 6PM 8PM 10PM
```

**Interpretation:**
- Peak activity: 10 jobs at 2 PM
- Low activity: 1-2 jobs during night hours
- Gradient fill emphasizes volume

### System Health Hierarchy

```
Workspace (healthy - 98% success)
├─ Store: docs-store (1536d)
│  ├─ Source: lightfast/lightfast (35 docs, 2h ago) ✓
│  └─ Source: lightfast/docs (7 docs, 1d ago) ✓
│
└─ Store: code-store (3072d)
   └─ Source: acme/api (12 docs, 3h ago) ⚠
```

**Legend:**
- ✓ (green) = Healthy (≥95%)
- ⚠ (yellow) = Degraded (80-94%)
- ✗ (red) = Down (<80%)

## Success Metrics

### Code Quality
- ✅ Full TypeScript type safety
- ✅ Zero TypeScript errors in new components
- ✅ Follows existing code patterns
- ✅ Proper error handling and empty states

### User Experience
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Accessible color scheme (uses theme variables)
- ✅ Loading states with Suspense boundaries
- ✅ Clear visual hierarchy

### Performance
- ✅ Efficient SQL queries with indexes
- ✅ Client-side caching with React Query
- ✅ Memoized transformations
- ✅ Lightweight chart library

## Next Steps

### Phase D: Real-time Updates
- Add WebSocket connection for live job updates
- Implement real-time chart updates
- Add live health status changes

### Phase E: Drill-down Views
- Click store to see detailed metrics
- Click source to see job history
- Add filtering and time range selection

### Phase F: Alerting
- Configure health thresholds
- Email/Slack notifications for degraded health
- Historical health trends

## Dependencies Added

```json
{
  "recharts": "^2.15.4"
}
```

**Recharts Features Used:**
- Responsive charts
- Gradient fills
- Custom tooltips
- Axis customization
- Theme integration

## Conclusion

Phase C successfully implements visual analytics for the console dashboard, providing users with:
1. **Performance Insights**: Percentile-based metrics for job durations
2. **Trend Visualization**: Time-series charts showing activity patterns
3. **System Monitoring**: Hierarchical health view for proactive issue detection

All components follow existing design patterns, maintain type safety, and integrate seamlessly with the tRPC backend.
