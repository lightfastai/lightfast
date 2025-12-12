/**
 * Observation templates by category
 *
 * Each template is a partial observation that can be customized.
 * Templates provide realistic content for different engineering scenarios.
 */

import type { SourceType } from "@repo/console-validation";

/**
 * Base template structure (without actor/date which are assigned dynamically)
 */
export interface ObservationTemplate {
  source: SourceType;
  sourceType: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
}

/**
 * Security & Authentication templates
 */
export const SECURITY_TEMPLATES: ObservationTemplate[] = [
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: implement OAuth2 PKCE flow for secure authentication",
    body: "Implemented PKCE flow with code verifier and challenge. Added secure token storage using httpOnly cookies. Replaces implicit grant for better security. This ensures proper authorization code flow with PKCE extension for public clients.",
    category: "security",
    tags: ["auth", "oauth", "security"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "fix: patch JWT token validation vulnerability CVE-2024-1234",
    body: "Fixed critical JWT validation bypass where expired tokens were accepted. Added proper exp claim verification and clock skew tolerance. This patch addresses the security vulnerability reported in CVE-2024-1234.",
    category: "security",
    tags: ["security", "jwt", "vulnerability"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Security: API keys exposed in client-side bundle",
    body: "Found API keys being bundled into client JavaScript. Need to move to server-side proxy pattern. Affects production environment. This is a critical security issue that needs immediate attention.",
    category: "security",
    tags: ["security", "api-keys", "critical"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "chore: rotate production API credentials",
    body: "Rotated all API keys after security audit. Updated environment variables in Vercel dashboard. Old keys invalidated. All services verified working with new credentials.",
    category: "security",
    tags: ["security", "credentials", "maintenance"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: add rate limiting to prevent brute force attacks",
    body: "Implemented rate limiting using Upstash Redis. Limits login attempts to 5 per minute per IP. Returns 429 Too Many Requests with Retry-After header. Includes bypass for trusted IPs.",
    category: "security",
    tags: ["security", "rate-limiting", "protection"],
  },
  {
    source: "github",
    sourceType: "issue.closed",
    title: "Security: Implement CSP headers for XSS protection",
    body: "Added Content-Security-Policy headers via Next.js middleware. Blocks inline scripts, restricts frame ancestors, enforces HTTPS. Tested against common XSS vectors.",
    category: "security",
    tags: ["security", "csp", "xss"],
  },
];

/**
 * Performance & Optimization templates
 */
export const PERFORMANCE_TEMPLATES: ObservationTemplate[] = [
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "perf: add Redis caching layer for database queries",
    body: "Added Redis caching with 5-minute TTL for frequently accessed queries. Reduced database load by 60%. Using Upstash for serverless Redis. Cache invalidation handled via pub/sub.",
    category: "performance",
    tags: ["performance", "caching", "redis"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "perf: implement virtual scrolling for large lists",
    body: "Implemented react-window for virtualized rendering. Only renders visible items. Handles lists with 10k+ items smoothly. Memory usage reduced by 80% for large datasets.",
    category: "performance",
    tags: ["performance", "react", "virtualization"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Performance: Dashboard takes 8 seconds to load",
    body: "Dashboard loading is extremely slow. Profiler shows 47 re-renders on mount. Suspect missing useMemo/useCallback optimizations. Network waterfall shows sequential API calls.",
    category: "performance",
    tags: ["performance", "bug", "dashboard"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "perf: optimize bundle size with dynamic imports",
    body: "Split vendor bundle using next/dynamic. Reduced initial JS payload from 450kb to 180kb. Lazy load heavy components. Tree shaking enabled for all dependencies.",
    category: "performance",
    tags: ["performance", "bundle", "optimization"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "perf: implement connection pooling for database",
    body: "Added PgBouncer for connection pooling. Reduced connection overhead from 100ms to 5ms. Pool size set to 20 connections. Includes health check endpoint.",
    category: "performance",
    tags: ["performance", "database", "pooling"],
  },
  {
    source: "github",
    sourceType: "issue.closed",
    title: "Performance: API response times exceed 2 seconds",
    body: "Resolved by adding database indexes and query optimization. Response time reduced from 2.3s to 180ms. Added compound index on frequently filtered columns.",
    category: "performance",
    tags: ["performance", "api", "database"],
  },
];

/**
 * Bug Fix templates
 */
export const BUGFIX_TEMPLATES: ObservationTemplate[] = [
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "fix: resolve race condition in webhook processing",
    body: "Fixed race condition where concurrent webhooks could create duplicate records. Added distributed locking using Upstash Redis. Lock TTL set to 30 seconds with automatic release.",
    category: "bugfix",
    tags: ["fix", "race-condition", "webhooks"],
  },
  {
    source: "github",
    sourceType: "pull-request.closed",
    title: "fix: handle null pointer in user profile component",
    body: "Closed without merging - duplicate of #142. Null check already added in previous PR. The optional chaining operator handles the edge case properly.",
    category: "bugfix",
    tags: ["fix", "null-check", "duplicate"],
  },
  {
    source: "github",
    sourceType: "issue.closed",
    title: "Bug: Form data lost on page refresh",
    body: "Resolved by persisting form state to sessionStorage. Auto-restores on page load. Added cleanup on successful submit. Works across all major browsers.",
    category: "bugfix",
    tags: ["fix", "forms", "persistence"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "fix: correct timezone handling for scheduled jobs",
    body: "Jobs were running at wrong times for non-UTC users. Now storing all times as UTC and converting on display. Added timezone dropdown to user settings.",
    category: "bugfix",
    tags: ["fix", "timezone", "scheduling"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "fix: prevent memory leak in WebSocket connections",
    body: "Fixed memory leak where disconnected WebSocket handlers weren't cleaned up. Added proper cleanup in useEffect return. Memory usage stabilized after 24h stress test.",
    category: "bugfix",
    tags: ["fix", "memory-leak", "websocket"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Bug: Infinite loop when syncing large repositories",
    body: "Sync process enters infinite loop for repos with 10k+ files. Pagination cursor not advancing correctly. Affects GitHub integration for large monorepos.",
    category: "bugfix",
    tags: ["fix", "infinite-loop", "sync"],
  },
];

/**
 * New Feature templates
 */
export const FEATURE_TEMPLATES: ObservationTemplate[] = [
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: add workspace search with semantic similarity",
    body: "Added semantic search using Pinecone vector database. Supports natural language queries. Returns ranked results with relevance scores. Cohere embeddings for best-in-class accuracy.",
    category: "feature",
    tags: ["feat", "search", "semantic"],
  },
  {
    source: "github",
    sourceType: "pull-request.opened",
    title: "feat: implement real-time notifications via WebSocket",
    body: "Implementing WebSocket connection for real-time updates. Using Pusher for managed WebSocket infrastructure. Includes reconnection logic with exponential backoff.",
    category: "feature",
    tags: ["feat", "notifications", "websocket"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Feature: Export workspace data to CSV",
    body: "Users need ability to export their data for backup or migration. Should support CSV and JSON formats. Include all workspace observations. Add progress indicator for large exports.",
    category: "feature",
    tags: ["feat", "export", "data"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "feat: add dark mode toggle with system preference detection",
    body: "Added dark mode with three options: light, dark, system. Persists preference to localStorage. Smooth CSS transitions. Uses CSS custom properties for theming.",
    category: "feature",
    tags: ["feat", "dark-mode", "ui"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "feat: implement AI-powered code review suggestions",
    body: "Added Claude integration for automated code review. Analyzes PR diffs and suggests improvements. Supports TypeScript, Python, and Go. Rate limited to prevent abuse.",
    category: "feature",
    tags: ["feat", "ai", "code-review"],
  },
  {
    source: "github",
    sourceType: "issue.closed",
    title: "Feature: Add keyboard shortcuts for common actions",
    body: "Implemented keyboard shortcuts using cmd/ctrl + key combinations. Added shortcut help modal (press ?). Customizable shortcuts stored in user preferences.",
    category: "feature",
    tags: ["feat", "keyboard", "ux"],
  },
];

/**
 * DevOps & Infrastructure templates
 */
export const DEVOPS_TEMPLATES: ObservationTemplate[] = [
  {
    source: "vercel",
    sourceType: "deployment.succeeded",
    title: "Production deployment v2.4.0",
    body: "Deployed successfully to production. Build time: 45s. 3 serverless functions updated. No errors in first 100 requests. All health checks passing.",
    category: "devops",
    tags: ["deployment", "production", "vercel"],
  },
  {
    source: "vercel",
    sourceType: "deployment.error",
    title: "Staging deployment failed - build error",
    body: "Build failed with TypeScript error in new component. Missing type export from @repo/console-types package. Error: Cannot find name 'FilterCandidate'.",
    category: "devops",
    tags: ["deployment", "error", "typescript"],
  },
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "ci: add automated E2E tests with Playwright",
    body: "Added Playwright E2E tests for critical user flows. Runs on PR merge to main. Covers auth, search, and workspace creation. Parallel execution reduces CI time.",
    category: "devops",
    tags: ["ci", "testing", "playwright"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Infrastructure: Need staging environment parity with production",
    body: "Staging differs from production in several ways: different API keys, missing feature flags, outdated dependencies. Need parity for reliable testing.",
    category: "devops",
    tags: ["infrastructure", "staging", "parity"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "ci: optimize GitHub Actions workflow caching",
    body: "Added dependency caching for pnpm. Reduced CI time from 8 minutes to 3 minutes. Cache hit rate at 95%. Added cache cleanup for stale entries.",
    category: "devops",
    tags: ["ci", "caching", "optimization"],
  },
  {
    source: "vercel",
    sourceType: "deployment.succeeded",
    title: "Preview deployment for PR #234",
    body: "Preview deployment ready for review. URL: https://pr-234.lightfast.vercel.app. Build time: 52s. Includes new search filters feature.",
    category: "devops",
    tags: ["deployment", "preview", "pr"],
  },
];

/**
 * Documentation templates
 */
export const DOCS_TEMPLATES: ObservationTemplate[] = [
  {
    source: "github",
    sourceType: "pull-request.merged",
    title: "docs: add API reference for workspace endpoints",
    body: "Added comprehensive API documentation for all workspace endpoints. Includes request/response examples, error codes, and rate limits. Generated from OpenAPI spec.",
    category: "docs",
    tags: ["docs", "api", "reference"],
  },
  {
    source: "github",
    sourceType: "issue.opened",
    title: "Documentation: Missing setup guide for local development",
    body: "New contributors struggling to set up local environment. Need step-by-step guide covering: prerequisites, environment variables, database setup, and running tests.",
    category: "docs",
    tags: ["docs", "setup", "contributing"],
  },
  {
    source: "github",
    sourceType: "push",
    title: "docs: update README with new architecture diagram",
    body: "Added Mermaid diagram showing system architecture. Covers: API layer, database, vector store, and external integrations. Replaces outdated PNG image.",
    category: "docs",
    tags: ["docs", "architecture", "readme"],
  },
];

/**
 * All templates grouped by category
 */
export const ALL_TEMPLATES = {
  security: SECURITY_TEMPLATES,
  performance: PERFORMANCE_TEMPLATES,
  bugfix: BUGFIX_TEMPLATES,
  feature: FEATURE_TEMPLATES,
  devops: DEVOPS_TEMPLATES,
  docs: DOCS_TEMPLATES,
};

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: keyof typeof ALL_TEMPLATES): ObservationTemplate[] {
  return ALL_TEMPLATES[category];
}

/**
 * Get all templates as a flat array
 */
export function getAllTemplates(): ObservationTemplate[] {
  return Object.values(ALL_TEMPLATES).flat();
}

/**
 * Get random templates
 */
export function getRandomTemplates(count: number): ObservationTemplate[] {
  const all = getAllTemplates();
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
