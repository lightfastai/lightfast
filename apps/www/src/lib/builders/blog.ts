import type {
  BlogPosting,
  CollectionPage,
  GraphContext,
  HowTo,
  HowToStep,
  ItemList,
  ListItem,
} from "@vendor/seo/json-ld";
import type { BlogCategoryMeta } from "~/config/blog-categories";
import type { BlogCategory, BlogPostData } from "~/lib/content-schemas";
import type { BlogPostUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

export interface BlogCategoryPost {
  readonly description: string;
  readonly publishedAt: string;
  readonly slug: string;
  readonly title: string;
  readonly updatedAt: string;
}

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
      ...(a.jobTitle ? { jobTitle: a.jobTitle } : {}),
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

function buildHowToEntity(data: BlogPostData, url: BlogPostUrl): HowTo {
  const steps = data.howToSteps!;
  return {
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: data.title,
    description: data.tldr,
    step: steps.map(
      (s, index) =>
        ({
          "@type": "HowToStep" as const,
          position: index + 1,
          name: s.name,
          text: s.text,
          ...(s.url ? { url: s.url } : {}),
        }) satisfies HowToStep
    ),
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
      ...(data.howToSteps && data.howToSteps.length > 0
        ? [buildHowToEntity(data, url)]
        : []),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Blog", url: "https://lightfast.ai/blog" },
        { name: data.title, url },
      ]),
    ],
  };
}

export function buildBlogCategoryJsonLd(
  meta: BlogCategoryMeta,
  posts: readonly BlogCategoryPost[],
  url: string
): GraphContext {
  const blogId = `${url}#blog`;
  const collectionId = `${url}#collectionpage`;
  const itemListId = `${url}#itemlist`;

  const blogPostEntities: BlogPosting[] = posts.slice(0, 10).map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    url: `https://lightfast.ai/blog/${p.slug}`,
    datePublished: p.publishedAt,
    dateModified: p.updatedAt,
    articleSection: meta.title,
  }));

  const itemList: ItemList = {
    "@type": "ItemList",
    "@id": itemListId,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: posts.length,
    itemListElement: posts.map(
      (p, idx): ListItem => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `https://lightfast.ai/blog/${p.slug}`,
        name: p.title,
      })
    ),
  };

  const collectionPage: CollectionPage = {
    "@type": "CollectionPage",
    "@id": collectionId,
    url,
    name: meta.heading,
    description: meta.description,
    about: meta.tagline,
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    mainEntity: { "@id": itemListId },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "Blog",
        "@id": blogId,
        url,
        name: `${meta.title} — Lightfast Blog`,
        description: meta.description,
        publisher: { "@id": "https://lightfast.ai/#organization" },
        blogPost: blogPostEntities,
      },
      collectionPage,
      itemList,
      buildFaqEntity([...meta.faq], url),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Blog", url: "https://lightfast.ai/blog" },
        { name: meta.title, url },
      ]),
    ],
  };
}
