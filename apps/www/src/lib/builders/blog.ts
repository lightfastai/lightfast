import type { BlogPosting, GraphContext } from "@vendor/seo/json-ld";
import type { BlogCategory, BlogPostData } from "~/lib/content-schemas";
import type { BlogPostUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

// Exhaustive mapping — adding a new BlogCategory errors here until handled
const ARTICLE_SECTIONS: Record<BlogCategory, string> = {
  engineering: "Engineering",
  product: "Product",
  company: "Company",
  tutorial: "Tutorial",
  research: "Research",
};

function buildBlogPostEntity(
  data: BlogPostData,
  url: BlogPostUrl
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
      url: `${url}/opengraph-image`,
      width: "1200",
      height: "630",
    },
    keywords: data.keywords.join(", "),
    articleSection: ARTICLE_SECTIONS[data.category],
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
  };
}

export function buildBlogPostJsonLd(
  data: BlogPostData,
  url: BlogPostUrl
): GraphContext {
  const entity = buildBlogPostEntity(data, url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#article`, url },
      ...(data.faq.length > 0 ? [buildFaqEntity(data.faq, url)] : []),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Blog", url: "https://lightfast.ai/blog" },
        { name: data.title, url },
      ]),
    ],
  };
}
