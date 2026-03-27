import type { BlogPosting, GraphContext } from "@vendor/seo/json-ld";
import type { ChangelogEntryData, ChangelogType } from "~/lib/content-schemas";
import type { ChangelogUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

// Exhaustive mapping — adding a new ChangelogType errors here until handled
const CHANGELOG_SECTIONS: Record<ChangelogType, string> = {
  feature: "Changelog / Feature",
  improvement: "Changelog / Improvement",
  fix: "Changelog / Fix",
  breaking: "Changelog / Breaking Change",
};

function buildChangelogEntryEntity(
  data: ChangelogEntryData
): Omit<BlogPosting, "@id" | "url"> {
  return {
    "@type": "BlogPosting",
    headline: data.title,
    description: data.description,
    abstract: data.tldr,
    datePublished: data.publishedAt,
    dateModified: data.updatedAt,
    author: data.authors.map((a) => ({
      "@type": "Person" as const,
      name: a.name,
      url: a.url,
      sameAs: [`https://x.com/${a.twitterHandle.replace(/^@/, "")}`],
    })),
    image: {
      "@type": "ImageObject" as const,
      url: data.ogImage,
      width: "1200",
      height: "630",
    },
    keywords: [...data.keywords, data.version, data.type].join(", "),
    articleSection: CHANGELOG_SECTIONS[data.type],
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
  };
}

export function buildChangelogEntryJsonLd(
  data: ChangelogEntryData,
  url: ChangelogUrl
): GraphContext {
  const entity = buildChangelogEntryEntity(data);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#article`, url },
      ...(data.faq.length > 0 ? [buildFaqEntity(data.faq, url)] : []),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Changelog", url: "https://lightfast.ai/changelog" },
        { name: data.title, url },
      ]),
    ],
  };
}
