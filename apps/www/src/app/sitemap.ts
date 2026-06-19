import type { MetadataRoute } from "next";
import { getBlogPages, getLegalPages } from "~/lib/content/source";

const BASE_URL = "https://lightfast.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getBlogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );
  const legalPages = getLegalPages();

  const mostRecentBlog = blogPosts[0]?.data.reviewedAt ??
    blogPosts[0]?.data.updatedAt ??
    blogPosts[0]?.data.publishedAt;

  return [
    {
      url: `${BASE_URL}/v2`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/v2/brand`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/v2/blog`,
      ...(mostRecentBlog && { lastModified: new Date(mostRecentBlog) }),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts.map((page) => ({
      url: `${BASE_URL}/v2/blog/${page.slugs[0]}`,
      lastModified: new Date(
        page.data.reviewedAt ?? page.data.updatedAt ?? page.data.publishedAt
      ),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    ...legalPages.map((page) => ({
      url: `${BASE_URL}/v2/legal/${page.slugs[0]}`,
      lastModified: new Date(page.data.reviewedAt ?? page.data.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
