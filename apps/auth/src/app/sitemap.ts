import type { MetadataRoute } from "next";

/**
 * Generates the sitemap for Lightfast Auth application.
 * Includes only public authentication pages that should be discoverable.
 * 
 * @returns {MetadataRoute.Sitemap} Next.js compatible sitemap configuration
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://auth.lightfast.ai";
  const currentDate = new Date().toISOString();

  return [
    {
      url: `${baseUrl}/sign-in`,
      lastModified: currentDate,
      changeFrequency: "monthly", // Auth pages rarely change
      priority: 0.8, // Important for users but not primary marketing
    },
    // Note: sign-up page is dev-only and not included in production sitemap
  ];
}