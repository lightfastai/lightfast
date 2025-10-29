import type { MetadataRoute } from "next";
import { siteConfig } from "@/src/lib/site-config";
import { getPages, getApiPages } from "@/src/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");

  const docs = getPages().map((p) => ({
    url: `${base}/docs/${p.slugs.join("/")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const api = getApiPages().map((p) => ({
    url: `${base}/api/${p.slugs.join("/")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...docs,
    ...api,
  ];
}

