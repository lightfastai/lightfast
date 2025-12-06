/**
 * AI Crawler Tracking for Answer Engine Optimization (AEO)
 *
 * Tracks visits from AI crawlers to understand:
 * - Which pages are being indexed by AI engines
 * - Frequency of crawling
 * - Which AI engines are most active
 *
 * TODO: Move this to a shared package (@vendor/analytics or @repo/ai-crawler-tracking)
 * to enable reuse across multiple apps and centralize analytics integration.
 * This would also allow for better testing and configuration management.
 */

// Known AI crawler user agents
export const AI_CRAWLERS = {
  // OpenAI
  'OAI-SearchBot': 'OpenAI Search',
  'ChatGPT-User': 'ChatGPT Browsing',
  'GPTBot': 'OpenAI Training',

  // Perplexity
  'PerplexityBot': 'Perplexity',

  // Anthropic
  'Claude-Web': 'Claude Web',

  // Google
  'Google-Extended': 'Google AI Overviews',

  // Others
  'cohere-ai': 'Cohere AI',
} as const;

export type AICrawlerName = keyof typeof AI_CRAWLERS;

/**
 * Check if a user agent string belongs to an AI crawler
 */
export function isAICrawler(userAgent: string): boolean {
  return Object.keys(AI_CRAWLERS).some(crawler =>
    userAgent.includes(crawler)
  );
}

/**
 * Get the AI crawler name from user agent
 */
export function getAICrawlerName(userAgent: string): string | null {
  for (const [key, value] of Object.entries(AI_CRAWLERS)) {
    if (userAgent.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * Log AI crawler visit for analytics
 * Can be extended to send to PostHog, Vercel Analytics, or custom tracking
 */
export async function trackAICrawlerVisit({
  userAgent,
  path,
  timestamp = new Date(),
}: {
  userAgent: string;
  path: string;
  timestamp?: Date;
}) {
  const crawlerName = getAICrawlerName(userAgent);

  if (!crawlerName) {
    return;
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AI Crawler] ${crawlerName} visited ${path} at ${timestamp.toISOString()}`);
  }

  // TODO: Send to analytics service when ready
  // Example with PostHog:
  // posthog.capture('ai_crawler_visit', {
  //   crawler: crawlerName,
  //   path,
  //   timestamp: timestamp.toISOString(),
  // });

  return {
    crawler: crawlerName,
    path,
    timestamp,
  };
}