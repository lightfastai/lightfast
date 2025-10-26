import type { MetadataRoute } from "next";

import { createBaseUrl } from "~/lib/base-url";

/**
 * Generates the sitemap for the search application.
 *
 * Includes:
 * - Search page (high priority, weekly updates)
 *
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${createBaseUrl()}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
