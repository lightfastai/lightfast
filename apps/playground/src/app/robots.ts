import type { MetadataRoute } from "next";

/**
 * Generates the robots.txt configuration for the playground application.
 * This playground app disallows all crawling to prevent search engine indexing
 * since it's a development/testing environment.
 *
 * @returns {MetadataRoute.Robots} Next.js compatible robots.txt configuration
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/"],
    },
  };
}