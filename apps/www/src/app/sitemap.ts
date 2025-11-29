import type { MetadataRoute } from "next";

import { createBaseUrl } from "~/lib/base-url";
import { legal, changelog } from "@vendor/cms";

/**
 * Generates the sitemap for the application.
 *
 * Includes:
 * - Homepage (highest priority, monthly updates)
 * - Key marketing pages (weekly updates)
 * - Changelog entries (weekly updates)
 * - Legal pages (weekly updates)
 *
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = createBaseUrl();
  const legalPages = await legal.getPosts().catch(() => []);
  const changelogEntries = await changelog.getEntries().catch(() => []);

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
      url: `${base}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...legalPages
      .filter((p) => !!p._slug)
      .map((p) => ({
        url: `${base}/legal/${p._slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...changelogEntries
      .filter((entry) => !!entry.slug)
      .map((entry) => ({
        url: `${base}/changelog/${entry.slug}`,
        lastModified: entry._sys?.createdAt
          ? new Date(entry._sys.createdAt)
          : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];
}
