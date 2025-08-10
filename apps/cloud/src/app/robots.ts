import type { MetadataRoute } from "next";

/**
 * Generates the robots.txt configuration for the application.
 * This app disallows all crawling to prevent search engine indexing.
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