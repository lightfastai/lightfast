import type { GraphContext, TechArticle } from "@vendor/seo/json-ld";
import type { DocsPageData } from "~/lib/content-schemas";
import type { DocsUrl } from "~/lib/url-types";
import type { Crumb } from "./shared";
import {
  buildBreadcrumbList,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

function buildDocsEntity(data: DocsPageData): Omit<TechArticle, "@id" | "url"> {
  return {
    "@type": "TechArticle",
    headline: data.title,
    description: data.description,
    datePublished: data.publishedAt,
    dateModified: data.updatedAt,
    author: data.authors.map((a) => ({
      "@type": "Person" as const,
      name: a.name,
      url: a.url,
      ...(a.jobTitle ? { jobTitle: a.jobTitle } : {}),
    })),
    keywords: data.keywords.join(", "),
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
  };
}

export function buildDocsJsonLd(
  data: DocsPageData,
  url: DocsUrl,
  breadcrumbs: Crumb[]
): GraphContext {
  const entity = buildDocsEntity(data);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#article`, url },
      buildBreadcrumbList(breadcrumbs),
    ],
  };
}
