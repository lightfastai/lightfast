import type { MetadataRoute } from "next";

import { createBaseUrl } from "~/lib/base-url";
import { blog, legal } from "@vendor/cms";

/**
 * Generates the sitemap for the application.
 *
 * Includes:
 * - Homepage (highest priority, monthly updates)
 * - Legal pages (terms and privacy, weekly updates)
 *
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = createBaseUrl();
  const posts = await blog.getPosts().catch(() => []);
  const legalPages = await legal.getPosts().catch(() => []);

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    // Key marketing pages
    {
      url: `${base}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/integrations`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/use-cases`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/early-access`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Marketing - Features
    {
      url: `${base}/features`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/features/memory`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/features/timeline`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/features/agents`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts
      .filter((p) => !!p._slug)
      .map((p) => ({
        url: `${base}/blog/${p._slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...legalPages
      .filter((p) => !!p._slug)
      .map((p) => ({
        url: `${base}/legal/${p._slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
