---
date: 2026-02-09T19:00:00-08:00
researcher: architect-agent
topic: "Bundle Size Optimization - Dynamic Imports"
tags: [research, architecture, build-optimization, bundle-size, dynamic-imports, code-splitting, lazy-loading]
status: complete
based_on:
  - 2026-02-09-console-build-codebase-deep-dive.md
  - 2026-02-09-web-analysis-next-js-15-config-optimization.md
priority: MEDIUM
estimated_impact: "15-25% initial bundle reduction for affected routes"
---

# Optimization Strategy: Bundle Size Optimization via Dynamic Imports

## Executive Summary

The console app has two major heavy-dependency components that are statically imported: **recharts** (~80-100KB gzipped) in the performance metrics component and **shiki** (~300-400KB including grammars) in the config overview component. These libraries are loaded on every page visit even though they're only needed on specific routes/views. Converting these to dynamic imports, plus lazy-loading conditionally-rendered modal components, can reduce initial bundle size by 15-25% for most routes.

## Current State (from Codebase Analysis)

### Heavy Dependency Map

| Component | File | Library | Approx Size (uncompressed) | Rendering |
|-----------|------|---------|----------------------|-----------|
| PerformanceMetrics | `apps/console/src/components/performance-metrics.tsx` | recharts | ~500KB | Always on jobs page |
| LightfastConfigOverview | `apps/console/src/components/lightfast-config-overview.tsx` | shiki | ~2MB+ (with grammars) | Always on workspace settings |
| Chart (UI package) | `packages/ui/src/components/ui/chart.tsx` | recharts | ~500KB (shared) | Via @repo/ui |
| Markdown | `packages/ui/src/components/markdown.tsx` | react-markdown + remark-gfm | ~100KB+ | Content rendering |
| SSR Code Block | `packages/ui/src/components/ssr-code-block/index.tsx` | shiki | ~2MB+ (shared) | Code display |
| AI Code Block | `packages/ui/src/components/ai-elements/code-block.tsx` | shiki (likely) | ~2MB+ (shared) | AI answer rendering |
| AnswerToolResults | `apps/console/src/components/answer-tool-results.tsx` | - | ~15-20KB | Only when AI responds |
| AnswerToolCallRenderer | `apps/console/src/components/answer-tool-call-renderer.tsx` | - | ~15-20KB | Only when AI responds |
| SetupGuideModal | `apps/console/src/components/setup-guide-modal.tsx` | - | ~7-10KB | Behind modal trigger |

**Critical finding**: There are **ZERO `next/dynamic` imports** across all 88 `"use client"` components in the console app. Every heavy component is statically imported.

### Already-Optimized Components

These dialog components are already well-structured for conditional rendering:
- `ConfigTemplateDialog` - minimal deps, behind dialog trigger
- `GitHubConnectDialog` - minimal deps, dialog controlled by state
- `GitHubRepoSelector` - uses conditional `useQuery` (loads data only when open)
- `RepositoryConfigDialog` - uses async fetch on mount

### Console App Dependencies (from `apps/console/package.json`)

Key heavy dependencies currently statically imported:
- `recharts: ^2.15.4` - Full charting library (~500KB)
- `shiki: ^3.9.2` - Code syntax highlighting (~2MB+ with grammars)
- `octokit: ^5.0.3` - GitHub API client (~200KB+)
- `date-fns: ^4.1.0` - Date utilities (~70KB full)
- `@sentry/nextjs: ^10.20.0` - Error tracking (~100KB+)
- `immer: ^10.1.1` - Immutable state (~16KB, used in 3 files)
- `react-hook-form` - Form handling (~30KB)

## Proposed Solution

### Phase 1: Dynamic Import - Performance Metrics (recharts)

**What**: Convert the `PerformanceMetrics` component to use `next/dynamic` with `ssr: false`

**Why**: recharts is a client-only charting library (~500KB uncompressed). It's only needed on the jobs dashboard page, but is currently included in shared bundles. It depends on D3 modules which are also pulled in. Note: `packages/ui/src/components/ui/chart.tsx` also uses recharts - if both are imported, the library is shared but still loaded on every page.

**How**:

**Before** (static import at the page level):
```typescript
// apps/console/src/app/(workspace)/[orgSlug]/[workspaceSlug]/jobs/page.tsx
import { PerformanceMetrics } from "@/components/performance-metrics";

export default function JobsPage() {
  return (
    <div>
      <JobsTable />
      <PerformanceMetrics data={metricsData} />
    </div>
  );
}
```

**After** (dynamic import with loading skeleton):
```typescript
// apps/console/src/app/(workspace)/[orgSlug]/[workspaceSlug]/jobs/page.tsx
import dynamic from "next/dynamic";

const PerformanceMetrics = dynamic(
  () => import("@/components/performance-metrics").then(mod => ({ default: mod.PerformanceMetrics })),
  {
    ssr: false, // recharts requires browser APIs
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" />
    ),
  }
);

export default function JobsPage() {
  return (
    <div>
      <JobsTable />
      <PerformanceMetrics data={metricsData} />
    </div>
  );
}
```

**Expected Impact**: ~80-100KB removed from initial bundle on all non-jobs pages
**Risk**: Low - loading skeleton provides visual continuity during chunk load

### Phase 2: Dynamic Import - Config Overview (shiki)

**What**: Convert `LightfastConfigOverview` to dynamic import

**Why**: shiki is extremely heavy (~2MB+ uncompressed) because it bundles language grammars and themes. The component already uses `useEffect` for async syntax highlighting, but the component itself is statically imported, pulling in shiki's module initialization code. Additionally, `packages/ui/src/components/ssr-code-block/index.tsx` and `packages/ui/src/components/ai-elements/code-block.tsx` also likely use shiki, compounding the issue.

**How**:

**Before** (static import):
```typescript
// In workspace settings page
import { LightfastConfigOverview } from "@/components/lightfast-config-overview";
```

**After** (dynamic import):
```typescript
import dynamic from "next/dynamic";

const LightfastConfigOverview = dynamic(
  () => import("@/components/lightfast-config-overview").then(mod => ({ default: mod.LightfastConfigOverview })),
  {
    ssr: false, // shiki uses browser APIs in useEffect
    loading: () => (
      <div className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    ),
  }
);
```

**Alternative Optimization**: If shiki is only used for YAML highlighting, consider switching to a lighter alternative:
```typescript
// Option A: Use shiki's fine-grained imports (if available)
import { codeToHtml } from 'shiki/core';
import yamlGrammar from 'shiki/langs/yaml';
import darkTheme from 'shiki/themes/dark-plus';

// Option B: Use prism-react-renderer (much lighter, ~15KB)
import { Highlight } from 'prism-react-renderer';
```

**Expected Impact**: ~300-400KB removed from initial bundle on all non-settings pages
**Risk**: Low - component already handles async loading internally

### Phase 3: Lazy Load Answer Interface Components

**What**: Dynamic import for answer tool result components that only render during AI interactions

**Why**: `AnswerToolResults` and `AnswerToolCallRenderer` are only rendered when the AI search interface produces tool call results. They add ~30-40KB to every page that includes the answer interface, even before the user initiates a search.

**How**:

```typescript
// apps/console/src/components/answer-messages.tsx
import dynamic from "next/dynamic";

const ToolCallRenderer = dynamic(
  () => import("./answer-tool-call-renderer"),
  { loading: () => <div className="h-8 animate-pulse rounded bg-muted" /> }
);

const SearchToolResult = dynamic(
  () => import("./answer-tool-results").then(mod => ({ default: mod.SearchToolResult })),
  { loading: () => <div className="h-16 animate-pulse rounded bg-muted" /> }
);

// Use in component - only loads when tool calls exist
{message.toolCalls?.map((call) => (
  <ToolCallRenderer key={call.id} toolCall={call} />
))}
```

**Expected Impact**: ~30-40KB deferred until first AI interaction
**Risk**: Low - tool results appear after a delay anyway (waiting for AI response)

### Phase 4: Lazy Load Setup Guide Modal

**What**: Dynamic import for the setup guide modal (224 lines, moderate complexity)

**Why**: The setup guide is shown only once during onboarding or when explicitly triggered. It loads documentation text and step-by-step UI that isn't needed on subsequent visits.

**How**:

```typescript
import dynamic from "next/dynamic";

const SetupGuideModal = dynamic(
  () => import("./setup-guide-modal"),
  { loading: () => null } // No loading state needed - modal isn't visible yet
);
```

**Expected Impact**: ~7-10KB deferred
**Risk**: None - modal content loads while trigger animation plays

### Phase 5: Route-Based Code Splitting Audit

**What**: Verify Next.js App Router is properly splitting per route

**Why**: App Router automatically code-splits by route, but shared layouts and barrel file imports can defeat this. After barrel file elimination (see separate doc), verify route splitting is working correctly.

**How**:

```bash
# 1. Build with analyzer
ANALYZE=true pnpm build:console

# 2. Check route-specific chunks
# Look for routes that share unexpectedly large chunks
# Identify any package that appears in multiple route chunks

# 3. Verify shared chunks are minimal
# The "shared" chunk should only contain truly shared code
# If it's > 200KB, investigate what's being shared unnecessarily
```

**Expected Impact**: Visibility into code splitting effectiveness
**Risk**: None - analysis only

## Code Examples

### Complete Dynamic Import Pattern

```typescript
// Pattern for client-only heavy components
import dynamic from "next/dynamic";
import { Skeleton } from "@repo/ui/skeleton";

// 1. Heavy chart component (no SSR)
const PerformanceChart = dynamic(
  () => import("@/components/performance-metrics"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  }
);

// 2. Heavy syntax highlighter (no SSR)
const CodeBlock = dynamic(
  () => import("@/components/lightfast-config-overview"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full" />,
  }
);

// 3. Modal content (SSR OK, just deferred)
const SetupGuide = dynamic(
  () => import("@/components/setup-guide-modal"),
  { loading: () => null }
);

// 4. Conditional component (loads on interaction)
const ToolResults = dynamic(
  () => import("@/components/answer-tool-results"),
  { loading: () => <Skeleton className="h-16 w-full" /> }
);
```

### Loading State Best Practices

```typescript
// ✅ Match the component's expected dimensions
loading: () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" />,

// ✅ For modals - return null (invisible while closed)
loading: () => null,

// ✅ For inline content - skeleton matching layout
loading: () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
),

// ❌ Don't show spinners for page-level content
loading: () => <Spinner />, // Jarring, causes layout shift
```

## Implementation Checklist

- [ ] **Phase 0** (15 min): Run `ANALYZE=true pnpm build:console` for baseline bundle sizes
- [ ] **Phase 1** (30 min): Convert PerformanceMetrics to dynamic import
- [ ] **Phase 1** (15 min): Add loading skeleton matching chart dimensions
- [ ] **Phase 1** (15 min): Verify recharts only loads on jobs page
- [ ] **Phase 2** (30 min): Convert LightfastConfigOverview to dynamic import
- [ ] **Phase 2** (30 min): Evaluate shiki alternatives for YAML-only highlighting
- [ ] **Phase 3** (30 min): Convert answer tool components to dynamic imports
- [ ] **Phase 4** (15 min): Convert SetupGuideModal to dynamic import
- [ ] **Phase 5** (30 min): Run bundle analyzer, verify route splitting
- [ ] **Final** (30 min): Compare bundle sizes to baseline

## Success Metrics

- **First-load JS per route**: Measured in `next build` output and bundle analyzer
- **Largest Contentful Paint (LCP)**: Should improve on routes with heavy components
- **Total Transfer Size**: Network tab in DevTools for initial page load
- **Route-specific chunk sizes**: Verify heavy libraries only appear in relevant route chunks

### Expected Results

| Route | Before (est.) | After (est.) | Reduction |
|-------|--------------|-------------|-----------|
| Jobs dashboard | Baseline + ~500KB (recharts) | Baseline | -500KB |
| Workspace settings | Baseline + ~2MB (shiki) | Baseline | -2MB |
| Answer interface | Baseline + ~30KB (tools) | Baseline | -30KB |
| Other routes | Includes all heavy deps | Clean | -2.5MB+ total |

## Trade-offs

| Factor | Before | After | Notes |
|--------|--------|-------|-------|
| Initial load speed | Slower (all JS loaded) | Faster (deferred heavy libs) | Major improvement |
| Interaction delay | None (pre-loaded) | 50-200ms (chunk loading) | Acceptable with skeletons |
| Code complexity | Simple imports | Dynamic imports + loading states | Slightly more complex |
| SSR compatibility | All SSR'd | Some client-only | recharts/shiki already client-only |
| User experience | Instant charts | Brief skeleton → chart | Acceptable trade-off |

## References

- Codebase findings: `apps/console/src/components/performance-metrics.tsx:6` (recharts import)
- Codebase findings: `apps/console/src/components/lightfast-config-overview.tsx:6` (shiki import)
- Codebase findings: `apps/console/src/components/answer-messages.tsx` (tool result orchestrator)
- External research: Dynamic imports provide 10-15% bundle reduction per lazy-loaded component
- Next.js docs: `next/dynamic` with `ssr: false` for client-only components
- Console dependencies: `recharts@2.15.4`, `shiki@3.9.2` in `apps/console/package.json`
