import type { MetadataRoute } from "next";

/**
 * Generates the sitemap for Lightfast Cloud application.
 * Only includes public pages that should be indexed by search engines.
 * 
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://cloud.lightfast.ai";
  const currentDate = new Date().toISOString();

  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0, // Homepage - highest priority
    },
    // Add other public pages as they are created
    // Example: waitlist success, pricing, features pages
  ];
}