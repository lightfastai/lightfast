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
    // Homepage - highest priority
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    // Core marketing pages
    {
      url: `${base}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/early-access`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Feature pages
    {
      url: `${base}/features/agents`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/features/connectors`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/features/memory`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/features/timeline`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    // Use case pages
    {
      url: `${base}/use-cases/technical-founders`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/founding-engineers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/agent-builders`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    // Documentation
    {
      url: `${base}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/docs/get-started/quickstart`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/get-started/config`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/docs/api-reference`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Blog listing page
    {
      url: `${base}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Individual blog posts from CMS
    ...blogPosts
      .filter((post) => !!post.slug || !!post._slug)
      .map((post) => {
        const slug = post.slug ?? post._slug ?? "";

        return {
          url: `${base}/blog/${slug}`,
          lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
          changeFrequency: "weekly" as const,
          priority: getCategoryPriority(post.categories),
        };
      }),
    // Changelog listing
    {
      url: `${base}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Individual changelog entries from CMS
    ...changelogEntries
      .filter((entry) => !!entry.slug)
      .map((entry) => ({
        url: `${base}/changelog/${entry.slug}`,
        lastModified: entry.publishedAt
          ? new Date(entry.publishedAt)
          : entry._sys?.createdAt
            ? new Date(entry._sys.createdAt)
            : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    // Search
    {
      url: `${base}/search`,
      lastModified: new Date(),
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
    // Auth pages (lower priority as they're functional)
    {
      url: `${base}/sign-in`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}