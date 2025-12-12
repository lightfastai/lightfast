/**
 * Day 2 Retrieval Infrastructure Test Scenario
 *
 * 20 observations across 5 categories designed to test:
 * - Metadata filters (sourceTypes, observationTypes, actorNames, dateRange)
 * - LLM relevance gating (triggers when >5 results)
 * - Latency tracking
 * - Filter UI functionality
 */

import type { TestScenario, TestObservation } from "../types";

/**
 * 20 test observations for Day 2 retrieval testing
 */
const observations: TestObservation[] = [
  // Category 1: Authentication & Security (4 items)
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: implement OAuth2 PKCE flow for secure authentication",
    body: "Implemented PKCE flow with code verifier and challenge. Added secure token storage using httpOnly cookies. Replaces implicit grant for better security.",
    actorName: "alice",
    daysAgo: 2,
    category: "security",
    tags: ["auth", "oauth", "security"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "fix: patch JWT token validation vulnerability CVE-2024-1234",
    body: "Fixed critical JWT validation bypass where expired tokens were accepted. Added proper exp claim verification and clock skew tolerance.",
    actorName: "bob",
    daysAgo: 1,
    category: "security",
    tags: ["security", "jwt", "vulnerability"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Security: API keys exposed in client-side bundle",
    body: "Found API keys being bundled into client JavaScript. Need to move to server-side proxy pattern. Affects production environment.",
    actorName: "charlie",
    daysAgo: 5,
    category: "security",
    tags: ["security", "api-keys", "critical"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "chore: rotate production API credentials",
    body: "Rotated all API keys after security audit. Updated environment variables in Vercel dashboard. Old keys invalidated.",
    actorName: "alice",
    daysAgo: 3,
    category: "security",
    tags: ["security", "credentials"],
  },

  // Category 2: Performance & Optimization (4 items)
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "perf: add Redis caching layer for database queries",
    body: "Added Redis caching with 5-minute TTL for frequently accessed queries. Reduced database load by 60%. Using Upstash for serverless Redis.",
    actorName: "david",
    daysAgo: 7,
    category: "performance",
    tags: ["performance", "caching", "redis"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "perf: implement virtual scrolling for large lists",
    body: "Implemented react-window for virtualized rendering. Only renders visible items. Handles lists with 10k+ items smoothly.",
    actorName: "alice",
    daysAgo: 1,
    category: "performance",
    tags: ["performance", "react", "virtualization"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Performance: Dashboard takes 8 seconds to load",
    body: "Dashboard loading is extremely slow. Profiler shows 47 re-renders on mount. Suspect missing useMemo/useCallback optimizations.",
    actorName: "eve",
    daysAgo: 10,
    category: "performance",
    tags: ["performance", "bug", "dashboard"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "perf: optimize bundle size with dynamic imports",
    body: "Split vendor bundle using next/dynamic. Reduced initial JS payload from 450kb to 180kb. Lazy load heavy components.",
    actorName: "david",
    daysAgo: 4,
    category: "performance",
    tags: ["performance", "bundle", "optimization"],
  },

  // Category 3: Bug Fixes (4 items)
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "fix: resolve race condition in webhook processing",
    body: "Fixed race condition where concurrent webhooks could create duplicate records. Added distributed locking using Upstash Redis.",
    actorName: "bob",
    daysAgo: 6,
    category: "bugfix",
    tags: ["fix", "race-condition", "webhooks"],
  },
  {
    source: "github",
    sourceType: "pull-request.closed",
    title: "fix: handle null pointer in user profile component",
    body: "Closed without merging - duplicate of #142. Null check already added in previous PR.",
    actorName: "charlie",
    daysAgo: 8,
    category: "bugfix",
    tags: ["fix", "null-check", "duplicate"],
  },
  {
    source: "github",
    sourceType: "issue.closed",
    title: "Bug: Form data lost on page refresh",
    body: "Resolved by persisting form state to sessionStorage. Auto-restores on page load. Added cleanup on successful submit.",
    actorName: "eve",
    daysAgo: 12,
    category: "bugfix",
    tags: ["fix", "forms", "persistence"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "fix: correct timezone handling for scheduled jobs",
    body: "Jobs were running at wrong times for non-UTC users. Now storing all times as UTC and converting on display.",
    actorName: "bob",
    daysAgo: 2,
    category: "bugfix",
    tags: ["fix", "timezone", "scheduling"],
  },

  // Category 4: New Features (4 items)
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: add workspace search with semantic similarity",
    body: "Added semantic search using Pinecone vector database. Supports natural language queries. Returns ranked results with relevance scores.",
    actorName: "alice",
    daysAgo: 3,
    category: "feature",
    tags: ["feat", "search", "semantic"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "feat: implement real-time notifications via WebSocket",
    body: "Implementing WebSocket connection for real-time updates. Using Pusher for managed WebSocket infrastructure.",
    actorName: "david",
    daysAgo: 1,
    category: "feature",
    tags: ["feat", "notifications", "websocket"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Feature: Export workspace data to CSV",
    body: "Users need ability to export their data for backup or migration. Should support CSV and JSON formats.",
    actorName: "frank",
    daysAgo: 15,
    category: "feature",
    tags: ["feat", "export", "data"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "feat: add dark mode toggle with system preference detection",
    body: "Added dark mode with three options: light, dark, system. Persists preference to localStorage.",
    actorName: "charlie",
    daysAgo: 5,
    category: "feature",
    tags: ["feat", "dark-mode", "ui"],
  },

  // Category 5: DevOps & Infrastructure (4 items)
  {
    source: "vercel",
    sourceType: "deployment.succeeded",
    title: "Production deployment v2.4.0",
    body: "Deployed successfully to production. Build time: 45s. 3 serverless functions updated. No errors in first 100 requests.",
    actorName: "vercel-bot",
    daysAgo: 1,
    category: "devops",
    tags: ["deployment", "production", "vercel"],
  },
  {
    source: "vercel",
    sourceType: "deployment.error",
    title: "Staging deployment failed - build error",
    body: "Build failed with TypeScript error in new component. Missing type export from @repo/console-types package.",
    actorName: "vercel-bot",
    daysAgo: 2,
    category: "devops",
    tags: ["deployment", "error", "typescript"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "ci: add automated E2E tests with Playwright",
    body: "Added Playwright E2E tests for critical user flows. Runs on PR merge to main. Covers auth, search, and workspace creation.",
    actorName: "eve",
    daysAgo: 9,
    category: "devops",
    tags: ["ci", "testing", "playwright"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Infrastructure: Need staging environment parity with production",
    body: "Staging differs from production in several ways: different API keys, missing feature flags, outdated dependencies.",
    actorName: "frank",
    daysAgo: 20,
    category: "devops",
    tags: ["infrastructure", "staging", "parity"],
  },
];

/**
 * Day 2 Retrieval Test Scenario
 */
export const day2RetrievalScenario: TestScenario = {
  name: "Day 2 Retrieval Infrastructure",
  description: "20 observations for testing metadata filters, LLM gating, and latency tracking",
  observations,
  expectedResults: [
    {
      name: "Filter by Source Type",
      query: "deployment issues",
      filters: { sourceTypes: ["vercel"] },
      expectedBehavior: "Only Vercel deployment observations returned",
      maxResults: 2,
      llmShouldTrigger: false,
    },
    {
      name: "Filter by Observation Type",
      query: "what bugs were fixed",
      filters: { observationTypes: ["pull-request.merged", "issue.closed"] },
      expectedBehavior: "Only merged PRs and closed issues about bug fixes",
    },
    {
      name: "Filter by Actor",
      query: "authentication changes",
      filters: { actorNames: ["alice"] },
      expectedBehavior: "Only alice's observations about authentication",
    },
    {
      name: "Filter by Date Range (7 days)",
      query: "recent performance work",
      filters: { dateRange: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
      expectedBehavior: "Only observations from last 7 days",
    },
    {
      name: "Combined Filters",
      query: "security",
      filters: {
        sourceTypes: ["github"],
        observationTypes: ["pull-request.merged", "pull-request.opened"],
      },
      expectedBehavior: "Only GitHub PRs about security",
    },
    {
      name: "LLM Relevance Gating",
      query: "how do we handle user authentication",
      expectedBehavior: "LLM invoked (>5 results), security/auth PRs ranked high",
      minResults: 5,
      llmShouldTrigger: true,
    },
    {
      name: "LLM Bypass (Small Result Set)",
      query: "deployment",
      filters: { sourceTypes: ["vercel"] },
      expectedBehavior: "Only 2 results, LLM bypassed (latency.llmFilter === 0)",
      maxResults: 2,
      llmShouldTrigger: false,
    },
  ],
};
