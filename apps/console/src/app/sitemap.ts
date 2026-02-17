import type { MetadataRoute } from "next";
import { legal, changelog, blog } from "@vendor/cms";

/**
 * Get category-based priority for blog posts.
 * Higher priority for content that drives SEO value.
 *
 * @param categories - Array of category objects with _title property
 * @returns Priority value between 0.7 and 0.95
 */
function getCategoryPriority(categories?: { _title?: string | null }[]): number {
  if (!categories || categories.length === 0) return 0.8;

  const categoryNames = categories
    .map((c) => c._title?.toLowerCase())
    .filter(Boolean) as string[];

  // Comparisons get highest priority (0.95) - high SEO value
  if (categoryNames.includes("comparisons")) return 0.95;

  // Data and Guides get 0.9 - valuable evergreen content
  if (categoryNames.includes("data") || categoryNames.includes("guides")) return 0.9;

  // Technology and Product get 0.85 - important but less SEO-driven
  if (categoryNames.includes("technology") || categoryNames.includes("product")) return 0.85;

  // Company gets 0.7 - lowest priority for company news
  if (categoryNames.includes("company")) return 0.7;

  // Default for uncategorized posts
  return 0.8;
}

/**
 * Get the most recent lastModified date from CMS entries.
 * Used for listing pages to accurately reflect when the listing changed.
 *
 * @param entries - Array of CMS entries with optional date fields
 * @returns Most recent date or undefined if no dates available
 */
function getMostRecentDate(
  entries: {
    _sys?: { lastModifiedAt?: string | null; createdAt?: string | null } | null;
    publishedAt?: string | null;
  }[],
): Date | undefined {
  if (entries.length === 0) return undefined;

  // Entries are already sorted by date (newest first) from CMS
  const mostRecent = entries[0];
  if (!mostRecent) return undefined;

  if (mostRecent._sys?.lastModifiedAt) {
    return new Date(mostRecent._sys.lastModifiedAt);
  }
  if (mostRecent.publishedAt) {
    return new Date(mostRecent.publishedAt);
  }
  if (mostRecent._sys?.createdAt) {
    return new Date(mostRecent._sys.createdAt);
  }
  return undefined;
}

/**
 * Generates the sitemap for the Lightfast platform.
 *
 * Since console is the root orchestrator serving all microfrontends,
 * this sitemap includes all routes from:
 * - Marketing pages (from @lightfast/www microfrontend)
 * - Documentation (served at /docs)
 * - Authentication pages (from @lightfast/auth microfrontend)
 * - Dynamic content from CMS (blog, changelog, legal)
 *
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://lightfast.ai";

  // Fetch dynamic content from CMS
  const [blogPosts, changelogEntries, legalPages] = await Promise.all([
    blog.getPosts().catch(() => []),
    changelog.getEntries().catch(() => []),
    legal.getPosts().catch(() => []),
  ]);

  return [
    // Homepage - highest priority (no lastModified - per Google guidance, omit rather than fake)
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    // Core marketing pages (no lastModified - static pages should omit to avoid false freshness signals)
    {
      url: `${base}/pricing`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/early-access`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Use case pages (no lastModified - static pages)
    {
      url: `${base}/use-cases/technical-founders`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/founding-engineers`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/agent-builders`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    // Documentation (no lastModified - static pages)
    {
      url: `${base}/docs`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/docs/get-started/quickstart`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/get-started/config`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/api-reference`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Blog listing page - uses most recent post's date (accurate: listing changes when new post added)
    {
      url: `${base}/blog`,
      ...(getMostRecentDate(blogPosts) && { lastModified: getMostRecentDate(blogPosts) }),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Individual blog posts from CMS
    // Uses lastModifiedAt for accurate freshness signals (AEO/GEO optimization)
    ...blogPosts
      .filter((post) => !!post.slug || !!post._slug)
      .map((post) => {
        const slug = post.slug ?? post._slug ?? "";
        const lastModified = post._sys?.lastModifiedAt
          ? new Date(post._sys.lastModifiedAt)
          : post.publishedAt
            ? new Date(post.publishedAt)
            : undefined;

        return {
          url: `${base}/blog/${slug}`,
          ...(lastModified && { lastModified }),
          changeFrequency: "weekly" as const,
          priority: getCategoryPriority(post.categories),
        };
      }),
    // Changelog listing - uses most recent entry's date (accurate: listing changes when new entry added)
    {
      url: `${base}/changelog`,
      ...(getMostRecentDate(changelogEntries) && { lastModified: getMostRecentDate(changelogEntries) }),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Individual changelog entries from CMS
    // Uses lastModifiedAt for accurate freshness signals (AEO/GEO optimization)
    // AI search engines show 76.4% recency bias - accurate timestamps improve citation probability
    ...changelogEntries
      .filter((entry) => !!entry.slug)
      .map((entry) => {
        const lastModified = entry._sys?.lastModifiedAt
          ? new Date(entry._sys.lastModifiedAt)
          : entry.publishedAt
            ? new Date(entry.publishedAt)
            : entry._sys?.createdAt
              ? new Date(entry._sys.createdAt)
              : undefined;

        return {
          url: `${base}/changelog/${entry.slug}`,
          ...(lastModified && { lastModified }),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      }),
    // RSS/Atom feeds for blog (helps feed aggregators discover feeds)
    {
      url: `${base}/blog/rss.xml`,
      ...(getMostRecentDate(blogPosts) && { lastModified: getMostRecentDate(blogPosts) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/blog/atom.xml`,
      ...(getMostRecentDate(blogPosts) && { lastModified: getMostRecentDate(blogPosts) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/blog/feed.xml`,
      ...(getMostRecentDate(blogPosts) && { lastModified: getMostRecentDate(blogPosts) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    // RSS/Atom feeds for changelog
    {
      url: `${base}/changelog/rss.xml`,
      ...(getMostRecentDate(changelogEntries) && { lastModified: getMostRecentDate(changelogEntries) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/changelog/atom.xml`,
      ...(getMostRecentDate(changelogEntries) && { lastModified: getMostRecentDate(changelogEntries) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/changelog/feed.xml`,
      ...(getMostRecentDate(changelogEntries) && { lastModified: getMostRecentDate(changelogEntries) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    // Search (no lastModified - static page)
    {
      url: `${base}/search`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Legal pages from CMS
    ...legalPages
      .filter((page) => !!page._slug)
      .map((page) => ({
        url: `${base}/legal/${page._slug}`,
        lastModified: page._sys?.lastModifiedAt
          ? new Date(page._sys.lastModifiedAt)
          : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    // Auth pages (lower priority as they're functional, no lastModified - static pages)
    {
      url: `${base}/sign-in`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/sign-up`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}