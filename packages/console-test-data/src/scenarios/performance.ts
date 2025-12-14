/**
 * Performance-focused Test Scenario
 *
 * Contains events related to performance optimization.
 */

import type { SourceEvent } from "@repo/console-types";
import { githubPR, githubIssue, vercelDeployment } from "../events";

/**
 * Performance-focused test scenario
 * Contains events related to performance optimization
 */
export const performanceScenario = (): SourceEvent[] => [
  githubPR({
    repo: "test/repo",
    prNumber: 201,
    title: "perf: Implement Redis caching for API responses",
    body: `## Summary
Added Redis caching layer to reduce database load.

## Changes
- New cache module at \`src/lib/cache.ts\`
- Configured CACHE_TTL via environment variable
- Added cache invalidation on writes

## Performance Impact
- GET /api/dashboard: 450ms → 45ms (90% reduction)
- Database queries reduced by 75%

Tested with @david-perf`,
    action: "merged",
    author: "david",
    labels: ["performance", "enhancement"],
    daysAgo: 3,
  }),

  githubIssue({
    repo: "test/repo",
    issueNumber: 202,
    title: "Dashboard loading time exceeds 5s on production",
    body: `## Problem
The GET /api/dashboard endpoint is taking >5 seconds on production.

## Investigation
- N+1 query detected in user list
- No database indexes on frequently queried columns

## Environment
- Production cluster with 1000+ concurrent users
- Redis not currently deployed`,
    action: "opened",
    author: "eve",
    labels: ["performance", "bug"],
    daysAgo: 5,
  }),

  vercelDeployment({
    projectName: "lightfast-app",
    event: "deployment.succeeded",
    branch: "main",
    commitMessage: "perf: enable edge runtime for API routes",
    commitAuthor: "frank",
    environment: "production",
    daysAgo: 1,
  }),
];
