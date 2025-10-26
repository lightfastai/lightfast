import type { MetadataRoute } from "next";

import { env } from "~/env";
import { createBaseUrl } from "~/lib/base-url";

/**
 * Generates the robots.txt configuration for the search application.
 *
 * For production:
 * - Allows crawling of search page
 * - Includes sitemap reference
 * - Protects sensitive routes
 *
 * For non-production:
 * - Disallows all crawling to prevent search engine indexing
 *
 * @returns {MetadataRoute.Robots} Next.js compatible robots.txt configuration
 */
export default function robots(): MetadataRoute.Robots {
  // Check if this is NOT production
  const isNonProduction = env.NODE_ENV !== "production";

  // For non-production environments, block all crawling
  if (isNonProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  // For production, allow crawling with restrictions
  return {
    rules: {
      userAgent: "*",
      allow: "/search",
      disallow: [
        "/api/", // Protect API routes
        "/_next/", // Protect Next.js internal files
      ],
    },
    sitemap: `${createBaseUrl()}/sitemap.xml`,
  };
}
