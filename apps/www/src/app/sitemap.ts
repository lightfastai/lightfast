import type { MetadataRoute } from "next";
import { getLegalPages } from "~/lib/content/source";

const BASE_URL = "https://lightfast.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const legalPages = getLegalPages();

  return [
    {
      url: `${BASE_URL}`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/brand`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...legalPages.map((page) => ({
      url: `${BASE_URL}/legal/${page.slugs[0]}`,
      lastModified: new Date(page.data.reviewedAt ?? page.data.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
