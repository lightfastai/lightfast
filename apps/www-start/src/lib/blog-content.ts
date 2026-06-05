import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildRobots,
  buildWebSiteEntity,
  type JsonLdGraph,
  parseFrontmatter,
  type RouteHead,
} from "~/lib/content-common";
import {
  type BlogCategory,
  type BlogPostData,
  BlogPostSchema,
  blogCategoryValues,
} from "~/lib/content-schemas";
import { SITE_URL } from "~/lib/landing-content";
import whyWeBuiltLightfastSource from "../content/blog/2026-03-26-why-we-built-lightfast.mdx?raw";

export interface BlogCategoryMeta {
  readonly description: string;
  readonly faq: readonly { question: string; answer: string }[];
  readonly heading: string;
  readonly keywords: readonly string[];
  readonly ogTitle: string;
  readonly slug: BlogCategory;
  readonly tagline: string;
  readonly title: string;
}

export interface BlogPage {
  body: string;
  data: BlogPostData;
  slug: string;
  slugs: [string];
  url: `${typeof SITE_URL}/blog/${string}`;
}

const blogSources = {
  "2026-03-26-why-we-built-lightfast": whyWeBuiltLightfastSource,
} as const;

export const BLOG_CATEGORY_META: Record<BlogCategory, BlogCategoryMeta> = {
  engineering: {
    slug: "engineering",
    title: "Engineering",
    heading: "Blog - Engineering",
    tagline:
      "Deep-dives on AI agent orchestration, event-driven architecture, and operating infrastructure.",
    description:
      "Engineering deep-dives from the Lightfast team on AI agent orchestration, event ingestion pipelines, and the infrastructure behind autonomous systems.",
    ogTitle: "Blog - Engineering",
    keywords: [
      "lightfast engineering blog",
      "ai agent orchestration",
      "event-driven architecture",
      "mcp tools",
      "agent infrastructure",
    ],
    faq: [
      {
        question: "What engineering topics does the Lightfast blog cover?",
        answer:
          "AI agent orchestration, event ingestion pipelines, MCP tool design, graph stores, and operational patterns for running AI infrastructure in production.",
      },
    ],
  },
  product: {
    slug: "product",
    title: "Product",
    heading: "Blog - Product",
    tagline:
      "Launches, changelog highlights, and the reasoning behind the product decisions we ship.",
    description:
      "Product updates from Lightfast including launch announcements, feature deep-dives, and the thinking behind decisions on our superintelligence layer for founders.",
    ogTitle: "Blog - Product",
    keywords: [
      "lightfast product updates",
      "ai agent platform",
      "product launches",
      "feature announcements",
      "superintelligence layer",
    ],
    faq: [
      {
        question: "How do product posts differ from the changelog?",
        answer:
          "The changelog is a terse list of what changed in each release. Product posts unpack the motivation, tradeoffs, and design thinking behind major launches.",
      },
    ],
  },
  company: {
    slug: "company",
    title: "Company",
    heading: "Blog - Company",
    tagline:
      "Founder letters, team updates, and the story behind building Lightfast in public.",
    description:
      "Company updates from Lightfast, including founder letters, team milestones, hiring, fundraising, and the story of building an AI infrastructure company in public.",
    ogTitle: "Blog - Company",
    keywords: [
      "lightfast company",
      "founder letter",
      "ai startup",
      "building in public",
      "startup milestones",
    ],
    faq: [
      {
        question: "What is in the company section of the blog?",
        answer:
          "Founder letters, team updates, hiring announcements, fundraising news, and milestones from building Lightfast in public.",
      },
    ],
  },
  tutorial: {
    slug: "tutorial",
    title: "Tutorial",
    heading: "Blog - Tutorials",
    tagline:
      "Step-by-step guides for building with Lightfast, MCP tools, and agent orchestration.",
    description:
      "Step-by-step tutorials from Lightfast on building with the platform, wiring up MCP tools, orchestrating AI agents, and using the API in production.",
    ogTitle: "Blog - Tutorials",
    keywords: [
      "lightfast tutorial",
      "ai agent tutorial",
      "mcp tool guide",
      "agent orchestration tutorial",
      "lightfast sdk examples",
    ],
    faq: [
      {
        question: "What kind of tutorials are published here?",
        answer:
          "Hands-on guides for building with Lightfast, including SDK usage, MCP tool authoring, agent orchestration patterns, and production playbooks.",
      },
    ],
  },
  research: {
    slug: "research",
    title: "Research",
    heading: "Blog - Research",
    tagline:
      "Benchmarks, evaluations, and applied research on agent behavior, tool use, and memory.",
    description:
      "Applied research from Lightfast on agent behavior, MCP tool use, evaluation methodology, memory systems, and benchmarks for AI agents.",
    ogTitle: "Blog - Research",
    keywords: [
      "lightfast research",
      "ai agent benchmarks",
      "llm evaluation",
      "mcp tool use research",
      "agent memory research",
    ],
    faq: [
      {
        question: "What research does Lightfast publish?",
        answer:
          "Applied research on agent behavior, MCP tool use, evaluation methodology, memory systems, and benchmarks we run to understand how AI agents perform.",
      },
    ],
  },
};

function parseBlogDocument(slug: string, source: string): BlogPage {
  const { frontmatter, body } = parseFrontmatter(source, slug);
  const data = BlogPostSchema.parse(frontmatter);

  return {
    slug,
    slugs: [slug],
    data,
    body,
    url: `${SITE_URL}/blog/${slug}`,
  };
}

const blogPages = Object.entries(blogSources)
  .map(([slug, source]) => parseBlogDocument(slug, source))
  .sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );

const blogPageBySlug = new Map(blogPages.map((page) => [page.slug, page]));

export function getBlogPages(): BlogPage[] {
  return blogPages;
}

export function getBlogPage(slug: string): BlogPage | undefined {
  return blogPageBySlug.get(slug);
}

export function isBlogCategory(value: string): value is BlogCategory {
  return (blogCategoryValues as readonly string[]).includes(value);
}

export function getCategoryPages(category: BlogCategory): BlogPage[] {
  return blogPages.filter((page) => page.data.category === category);
}

export function getBlogCategories() {
  return blogCategoryValues.map((slug) => ({
    slug,
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
  }));
}

export function buildBlogIndexHead(): RouteHead {
  return {
    meta: [
      { title: "Blog | Lightfast" },
      {
        name: "description",
        content:
          "Engineering deep-dives, product updates, and lessons from building the superintelligence layer for founders at Lightfast.",
      },
      {
        name: "keywords",
        content:
          "lightfast blog, ai engineering blog, agent infrastructure, mcp tools, product updates",
      },
      { property: "og:title", content: "Lightfast Blog" },
      {
        property: "og:description",
        content:
          "Articles on operating infrastructure, event-driven architecture, and agent tooling.",
      },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lightfast" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Lightfast Blog" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/blog` },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "RSS 2.0",
        href: `${SITE_URL}/blog/rss.xml`,
      },
      {
        rel: "alternate",
        type: "application/atom+xml",
        title: "Atom 1.0",
        href: `${SITE_URL}/blog/atom.xml`,
      },
    ],
  };
}

export function buildBlogPostHead(page: BlogPage): RouteHead {
  const canonicalUrl = page.data.canonicalUrl ?? page.url;
  const robots = buildRobots(page.data);

  return {
    meta: [
      { title: `${page.data.title} | Lightfast Blog` },
      { name: "description", content: page.data.description },
      { name: "keywords", content: page.data.keywords.join(", ") },
      { name: "robots", content: robots },
      { property: "og:title", content: page.data.ogTitle },
      { property: "og:description", content: page.data.ogDescription },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "Lightfast" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.data.ogTitle },
      { name: "twitter:description", content: page.data.ogDescription },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}

export function buildBlogCategoryHead(category: BlogCategory): RouteHead {
  const meta = BLOG_CATEGORY_META[category];
  const url = `${SITE_URL}/blog/topic/${category}`;

  return {
    meta: [
      { title: `${meta.heading} | Lightfast` },
      { name: "description", content: meta.description },
      { name: "keywords", content: meta.keywords.join(", ") },
      { property: "og:title", content: meta.ogTitle },
      { property: "og:description", content: meta.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: meta.ogTitle },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function buildBlogIndexJsonLd(): JsonLdGraph {
  const url = `${SITE_URL}/blog`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        url,
        name: "Lightfast Blog",
        description:
          "Engineering deep-dives, product updates, and lessons from building Lightfast.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        blogPost: blogPages.slice(0, 10).map((page) => ({
          "@type": "BlogPosting",
          headline: page.data.title,
          description: page.data.description,
          url: page.url,
          datePublished: page.data.publishedAt,
        })),
      },
      buildFaqEntity(
        [
          {
            question: "What topics does the Lightfast blog cover?",
            answer:
              "We cover engineering deep-dives on AI agent orchestration, product launches, company updates, tutorials, and research on MCP tools and agent memory.",
          },
        ],
        url
      ),
    ],
  };
}

export function buildBlogPostJsonLd(page: BlogPage): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "BlogPosting",
        "@id": `${page.url}#article`,
        url: page.url,
        headline: page.data.title,
        description: page.data.description,
        abstract: page.data.tldr,
        datePublished: page.data.publishedAt,
        dateModified: page.data.updatedAt,
        author: page.data.authors.map((author) => ({
          "@type": "Person",
          name: author.name,
          url: author.url,
          jobTitle: author.jobTitle,
        })),
        image: page.data.featuredImage
          ? `${SITE_URL}${page.data.featuredImage}`
          : undefined,
        keywords: page.data.keywords.join(", "),
        articleSection: page.data.category,
        inLanguage: "en-US",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      ...(page.data.faq.length > 0
        ? [buildFaqEntity(page.data.faq, page.url)]
        : []),
      buildBreadcrumbList([
        { name: "Home", url: SITE_URL },
        { name: "Blog", url: `${SITE_URL}/blog` },
        { name: page.data.title, url: page.url },
      ]),
    ],
  };
}

export function buildBlogCategoryJsonLd(category: BlogCategory): JsonLdGraph {
  const meta = BLOG_CATEGORY_META[category];
  const url = `${SITE_URL}/blog/topic/${category}`;
  const pages = getCategoryPages(category);

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "CollectionPage",
        "@id": `${url}#collectionpage`,
        url,
        name: meta.heading,
        description: meta.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#itemlist`,
        numberOfItems: pages.length,
        itemListElement: pages.map((page, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: page.url,
          name: page.data.title,
        })),
      },
      buildFaqEntity(meta.faq, url),
      buildBreadcrumbList([
        { name: "Home", url: SITE_URL },
        { name: "Blog", url: `${SITE_URL}/blog` },
        { name: meta.title, url },
      ]),
    ],
  };
}
