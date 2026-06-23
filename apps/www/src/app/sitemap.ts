import type { MetadataRoute } from "next";
import {
  getPublicPublications,
  type StaticPublication,
} from "~/lib/publishing";

function sitemapPolicy(publication: StaticPublication): Pick<
  MetadataRoute.Sitemap[number],
  "changeFrequency" | "priority"
> {
  switch (publication.kind) {
    case "home":
      return { changeFrequency: "weekly", priority: 1 };
    case "blog-index":
      return { changeFrequency: "weekly", priority: 0.8 };
    case "blog-post":
      return { changeFrequency: "weekly", priority: 0.7 };
    case "brand":
      return { changeFrequency: "monthly", priority: 0.7 };
    case "legal":
      return { changeFrequency: "monthly", priority: 0.4 };
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicPublications().map((publication) => ({
    url: publication.canonicalUrl,
    lastModified: new Date(publication.lastModified),
    ...sitemapPolicy(publication),
  }));
}
