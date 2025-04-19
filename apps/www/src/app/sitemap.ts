import type { MetadataRoute } from "next";

import { createBaseUrl } from "~/lib/base-url";

/**
 * Generates the sitemap for the application.
 *
 * Includes:
 * - Homepage (highest priority, monthly updates)
 * - Legal pages (terms and privacy, weekly updates)
 *
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: createBaseUrl(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${createBaseUrl()}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${createBaseUrl()}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
