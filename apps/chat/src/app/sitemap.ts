import type { MetadataRoute } from "next";

/**
 * Generates the sitemap for the Lightfast Chat application
 * Only includes public pages that actually exist and should be indexed by search engines
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://chat.lightfast.ai";
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}