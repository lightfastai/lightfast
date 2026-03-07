/**
 * Conservative backstop for GitHub API rate limiting.
 * GitHub limit is 5000 req/hr — we reserve 1000 for webhook/realtime traffic.
 * Used by entity-worker throttle and estimate endpoint rate limit usage calculation.
 */
export const GITHUB_RATE_LIMIT_BUDGET = 4000;
