import type { MetadataRoute } from "next";

import { env } from "~/env";

/**
 * Generates the robots.txt configuration for Lightfast Cloud.
 *
 * For production:
 * - Allows crawling of public pages (landing, marketing)
 * - Includes sitemap reference  
 * - Protects authenticated routes and sensitive areas
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
      allow: "/",
      disallow: [
        "/api/", // Protect API routes
        "/_next/", // Protect Next.js internal files
        "/orgs/", // Protect authenticated org areas
        "/dashboard/", // Protect dashboards  
        "/settings/", // Protect settings pages
        "/**/api-keys", // Protect API key pages
        "/auth/", // Protect auth flows
        "/onboarding/", // Protect onboarding
      ],
    },
    sitemap: "https://cloud.lightfast.ai/sitemap.xml",
  };
}