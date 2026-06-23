import type { MetadataRoute } from "next";
import { getPublicPublications } from "~/lib/publishing";
import { discoveryPolicyFor } from "~/lib/site/discovery";

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicPublications().map((publication) => {
    const { sitemap: policy } = discoveryPolicyFor(publication);

    return {
      url: publication.canonicalUrl,
      lastModified: new Date(publication.lastModified),
      ...policy,
    };
  });
}
