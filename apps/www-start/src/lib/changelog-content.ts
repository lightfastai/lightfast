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
  type ChangelogEntryData,
  ChangelogEntrySchema,
} from "~/lib/content-schemas";
import { SITE_URL } from "~/lib/landing-content";
import engineeringIntelligenceSource from "../content/changelog/2026-03-26-lightfast-engineering-intelligence-shipped.mdx?raw";

export interface ChangelogPage {
  body: string;
  data: ChangelogEntryData;
  slug: string;
  slugs: [string];
  url: `${typeof SITE_URL}/changelog/${string}`;
}

const changelogSources = {
  "2026-03-26-lightfast-engineering-intelligence-shipped":
    engineeringIntelligenceSource,
} as const;

function parseChangelogDocument(slug: string, source: string): ChangelogPage {
  const { frontmatter, body } = parseFrontmatter(source, slug);
  const data = ChangelogEntrySchema.parse(frontmatter);

  return {
    slug,
    slugs: [slug],
    data,
    body,
    url: `${SITE_URL}/changelog/${slug}`,
  };
}

const changelogPages = Object.entries(changelogSources)
  .map(([slug, source]) => parseChangelogDocument(slug, source))
  .sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );

const changelogPageBySlug = new Map(
  changelogPages.map((page) => [page.slug, page])
);

export function getChangelogPages(): ChangelogPage[] {
  return changelogPages;
}

export function getChangelogPage(slug: string): ChangelogPage | undefined {
  return changelogPageBySlug.get(slug);
}

export function buildChangelogIndexHead(): RouteHead {
  const url = `${SITE_URL}/changelog`;

  return {
    meta: [
      { title: "Changelog | Lightfast" },
      {
        name: "description",
        content:
          "Every feature, improvement, fix, and breaking change shipped in Lightfast. Follow the full release history of the superintelligence layer.",
      },
      {
        name: "keywords",
        content:
          "lightfast changelog, release notes, product updates, version history",
      },
      { property: "og:title", content: "Lightfast Changelog" },
      {
        property: "og:description",
        content:
          "Every feature, improvement, fix, and breaking change shipped in Lightfast.",
      },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lightfast" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Lightfast Changelog" },
    ],
    links: [
      { rel: "canonical", href: url },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "RSS 2.0",
        href: `${url}/rss.xml`,
      },
      {
        rel: "alternate",
        type: "application/atom+xml",
        title: "Atom 1.0",
        href: `${url}/atom.xml`,
      },
    ],
  };
}

export function buildChangelogEntryHead(page: ChangelogPage): RouteHead {
  const canonicalUrl = page.data.canonicalUrl ?? page.url;
  const robots = buildRobots(page.data);

  return {
    meta: [
      { title: `${page.data.title} | Lightfast Changelog` },
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

export function buildChangelogIndexJsonLd(): JsonLdGraph {
  const url = `${SITE_URL}/changelog`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: "Lightfast Changelog",
        description:
          "Every feature, improvement, fix, and breaking change shipped in Lightfast.",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      buildFaqEntity(
        [
          {
            question: "Where can I follow Lightfast product updates?",
            answer:
              "This changelog is the canonical source for all Lightfast releases. Each entry includes the version, change type, and a summary of what shipped.",
          },
        ],
        url
      ),
    ],
  };
}

export function buildChangelogEntryJsonLd(page: ChangelogPage): JsonLdGraph {
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
        keywords: [
          ...page.data.keywords,
          page.data.version,
          page.data.type,
        ].join(", "),
        articleSection: `Changelog / ${page.data.type}`,
        inLanguage: "en-US",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      ...(page.data.faq.length > 0
        ? [buildFaqEntity(page.data.faq, page.url)]
        : []),
      buildBreadcrumbList([
        { name: "Home", url: SITE_URL },
        { name: "Changelog", url: `${SITE_URL}/changelog` },
        { name: page.data.title, url: page.url },
      ]),
    ],
  };
}
