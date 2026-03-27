import type { MetadataRoute } from "next";
import {
  getBlogPages,
  getChangelogPages,
  getLegalPages,
} from "~/app/(app)/(content)/_lib/source";

function getCategoryPriority(category: string): number {
  switch (category) {
    case "research":
      return 0.95;
    case "tutorial":
      return 0.9;
    case "engineering":
    case "product":
      return 0.85;
    case "company":
      return 0.7;
    default:
      return 0.8;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://lightfast.ai";

  const blogPosts = getBlogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime(),
  );
  const changelogEntries = getChangelogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime(),
  );
  const legalPages = getLegalPages();

  const mostRecentBlog = blogPosts[0]?.data.updatedAt ?? blogPosts[0]?.data.publishedAt;
  const mostRecentChangelog =
    changelogEntries[0]?.data.updatedAt ?? changelogEntries[0]?.data.publishedAt;

  return [
    // Homepage
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    // Core marketing pages
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
    // Use case pages
    {
      url: `${base}/use-cases/technical-founders`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/engineering-leaders`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/platform-engineers`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/use-cases/agent-builders`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    // Documentation
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
    // Blog listing
    {
      url: `${base}/blog`,
      ...(mostRecentBlog && { lastModified: new Date(mostRecentBlog) }),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Individual blog posts
    ...blogPosts.map((page) => ({
      url: `${base}/blog/${page.slugs[0]}`,
      lastModified: new Date(page.data.updatedAt ?? page.data.publishedAt),
      changeFrequency: "weekly" as const,
      priority: getCategoryPriority(page.data.category),
    })),
    // Changelog listing
    {
      url: `${base}/changelog`,
      ...(mostRecentChangelog && { lastModified: new Date(mostRecentChangelog) }),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Individual changelog entries
    ...changelogEntries.map((page) => ({
      url: `${base}/changelog/${page.slugs[0]}`,
      lastModified: new Date(page.data.updatedAt ?? page.data.publishedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // RSS/Atom feeds for blog
    {
      url: `${base}/blog/rss.xml`,
      ...(mostRecentBlog && { lastModified: new Date(mostRecentBlog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/blog/atom.xml`,
      ...(mostRecentBlog && { lastModified: new Date(mostRecentBlog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/blog/feed.xml`,
      ...(mostRecentBlog && { lastModified: new Date(mostRecentBlog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    // RSS/Atom feeds for changelog
    {
      url: `${base}/changelog/rss.xml`,
      ...(mostRecentChangelog && { lastModified: new Date(mostRecentChangelog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/changelog/atom.xml`,
      ...(mostRecentChangelog && { lastModified: new Date(mostRecentChangelog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/changelog/feed.xml`,
      ...(mostRecentChangelog && { lastModified: new Date(mostRecentChangelog) }),
      changeFrequency: "daily",
      priority: 0.6,
    },
    // Search
    {
      url: `${base}/search`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Legal pages
    ...legalPages.map((page) => ({
      url: `${base}/legal/${page.slugs[0]}`,
      lastModified: new Date(page.data.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    // Auth pages
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
