/**
 * Conservative backstop for GitHub API rate limiting.
 * GitHub limit is 5000 req/hr — we reserve 1000 for webhook/realtime traffic.
 * Used by entity-worker throttle and estimate endpoint rate limit usage calculation.
 */
export const GITHUB_RATE_LIMIT_BUDGET = 4000;

/**
 * Safety cap for pagination in entity workers.
 * Prevents infinite loops from buggy providers that always return a nextCursor.
 * 500 pages × ~100 items/page = ~50k items — more than any reasonable backfill.
 */
export const MAX_PAGES = 500;
