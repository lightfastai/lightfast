import type {
  Answer,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  FAQPage,
  GraphContext,
  HowTo,
  HowToStep,
  ItemList,
  ListItem,
  Organization,
  Question,
  WebPage,
  WebSite,
} from "@vendor/seo/json-ld";
import type { BlogPostData, LegalPageData } from "./schemas";
import { SITE } from "./site";

interface Crumb {
  name: string;
  url: string;
}

interface WebPageJsonLdData {
  description: string;
  lastModified: string;
  title: string;
}

interface BlogIndexJsonLdPost {
  canonicalUrl: string;
  description: string;
  publishedAt: string;
  title: string;
  updatedAt: string;
  url: string;
}

const ARTICLE_SECTIONS: Record<BlogPostData["category"], string> = {
  engineering: "Engineering",
  product: "Product",
  company: "Company",
  tutorial: "Tutorial",
  research: "Research",
};

function buildOrganizationEntity(): Organization {
  return {
    "@type": "Organization",
    "@id": SITE.organizationId,
    name: SITE.name,
    url: SITE.baseUrl,
    logo: {
      "@type": "ImageObject",
      url: SITE.logoUrl,
    },
    sameAs: [...SITE.sameAs],
  };
}
function buildWebSiteEntity(): WebSite {
  return {
    "@type": "WebSite",
    "@id": SITE.websiteId,
    name: SITE.name,
    url: SITE.baseUrl,
    publisher: { "@id": SITE.organizationId },
  };
}

function buildBreadcrumbList(crumbs: Crumb[]): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    "@id": `${crumbs.at(-1)?.url ?? ""}#breadcrumb`,
    itemListElement: crumbs.map(
      (crumb, index) =>
        ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        }) satisfies ListItem
    ),
  };
}

function buildFaqEntity(
  items: Array<{ question: string; answer: string }>,
  pageId: string
): FAQPage {
  return {
    "@type": "FAQPage",
    "@id": `${pageId}#faq`,
    mainEntity: items.map(
      (item) =>
        ({
          "@type": "Question" as const,
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer" as const,
            text: item.answer,
          } satisfies Answer,
        }) satisfies Question
    ),
  };
}

function buildWebPageEntity(
  data: WebPageJsonLdData
): Omit<WebPage, "@id" | "url"> {
  return {
    "@type": "WebPage",
    name: data.title,
    description: data.description,
    dateModified: data.lastModified,
    inLanguage: "en-US",
    isPartOf: { "@id": SITE.websiteId },
    publisher: { "@id": SITE.organizationId },
  };
}

function buildBlogPostEntity(
  data: BlogPostData,
  url: string
): Omit<BlogPosting, "@id" | "url"> {
  return {
    "@type": "BlogPosting",
    headline: data.title,
    description: data.description,
    abstract: data.tldr,
    datePublished: data.publishedAt,
    dateModified: data.updatedAt,
    author: data.authors.map((author) => ({
      "@type": "Person" as const,
      name: author.name,
      url: author.url,
      ...(author.jobTitle ? { jobTitle: author.jobTitle } : {}),
      sameAs: [`https://x.com/${author.twitterHandle.replace(/^@/, "")}`],
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
    isPartOf: { "@id": SITE.websiteId },
    publisher: { "@id": SITE.organizationId },
  };
}

function buildHowToEntity(data: BlogPostData, url: string): HowTo {
  const steps = data.howToSteps ?? [];

  return {
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: data.title,
    description: data.tldr,
    step: steps.map(
      (step, index) =>
        ({
          "@type": "HowToStep" as const,
          position: index + 1,
          name: step.name,
          text: step.text,
          ...(step.url ? { url: step.url } : {}),
        }) satisfies HowToStep
    ),
  };
}

export function buildContentPageJsonLd({
  data,
  url,
}: {
  data: WebPageJsonLdData;
  url: string;
}): GraphContext {
  const entity = buildWebPageEntity(data);

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#webpage`, url },
    ],
  };
}

export function buildLegalJsonLd(
  data: LegalPageData,
  url: string,
  lastModified: string
): GraphContext {
  const entity = buildWebPageEntity({
    description: data.description,
    lastModified,
    title: data.title,
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#webpage`, url },
      buildBreadcrumbList([
        { name: "Home", url: SITE.baseUrl },
        { name: data.title, url },
      ]),
    ],
  };
}

export function buildBlogPostJsonLd(
  data: BlogPostData,
  url: string
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
        { name: "Home", url: SITE.baseUrl },
        { name: "Blog", url: `${SITE.baseUrl}/blog` },
        { name: data.title, url },
      ]),
    ],
  };
}

export function buildBlogIndexJsonLd({
  lastModified,
  posts,
  url,
}: {
  lastModified: string;
  posts: readonly BlogIndexJsonLdPost[];
  url: string;
}): GraphContext {
  const blogId = `${url}#blog`;
  const collectionId = `${url}#collectionpage`;
  const itemListId = `${url}#itemlist`;

  const blogPostEntities: BlogPosting[] = posts.slice(0, 10).map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: post.canonicalUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
  }));

  const itemList: ItemList = {
    "@type": "ItemList",
    "@id": itemListId,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: posts.length,
    itemListElement: posts.map(
      (post, index): ListItem => ({
        "@type": "ListItem",
        position: index + 1,
        url: post.canonicalUrl,
        name: post.title,
      })
    ),
  };

  const collectionPage: CollectionPage = {
    "@type": "CollectionPage",
    "@id": collectionId,
    url,
    name: "Blog",
    description:
      "Notes from Lightfast on agent infrastructure, workspace memory, and building reliable AI operations.",
    dateModified: lastModified,
    inLanguage: "en-US",
    isPartOf: { "@id": SITE.websiteId },
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
        name: `${SITE.name} Blog`,
        description:
          "Notes from Lightfast on agent infrastructure, workspace memory, and building reliable AI operations.",
        publisher: { "@id": SITE.organizationId },
        blogPost: blogPostEntities,
      },
      collectionPage,
      itemList,
      buildBreadcrumbList([
        { name: "Home", url: SITE.baseUrl },
        { name: "Blog", url },
      ]),
    ],
  };
}
