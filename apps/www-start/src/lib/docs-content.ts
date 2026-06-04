import { parse } from "yaml";
import { z } from "zod";
import docsMeta from "../content/docs/meta.json";
import getStartedMeta from "../content/docs/get-started/meta.json";
import integrateMeta from "../content/docs/integrate/meta.json";
import overviewSource from "../content/docs/get-started/overview.mdx?raw";
import { SITE_URL } from "./landing-content";

const docsPageDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  canonicalUrl: z.string().url().optional(),
  ogTitle: z.string(),
  ogDescription: z.string(),
  authors: z.array(
    z.object({
      name: z.string(),
      url: z.string().url(),
      twitterHandle: z.string().optional(),
    })
  ),
  publishedAt: z.string(),
  updatedAt: z.string(),
  proficiencyLevel: z.string(),
});

const docsSources = {
  "get-started/overview": overviewSource,
} as const;

export type DocsPath = keyof typeof docsSources;
export type DocsPageData = z.infer<typeof docsPageDataSchema>;

export interface DocsPage {
  slug: string[];
  path: `/docs/${DocsPath}`;
  data: DocsPageData;
  body: string;
  url: `${typeof SITE_URL}/docs/${DocsPath}`;
}

export interface DocsNavigationItem {
  title: string;
  href: string;
  migrated: boolean;
}

export interface DocsNavigationSection {
  title: string;
  items: DocsNavigationItem[];
}

interface DocsHead {
  meta: Array<Record<string, string>>;
  links: Array<{ rel: string; href: string }>;
}

type DocsJsonLdEntity =
  | {
      "@type": "Organization";
      "@id": string;
      name: string;
      url: string;
      logo: { "@type": "ImageObject"; url: string };
      sameAs: string[];
      description: string;
    }
  | {
      "@type": "WebSite";
      "@id": string;
      url: string;
      name: string;
      description: string;
      publisher: { "@id": string };
    }
  | {
      "@type": "WebPage";
      "@id": string;
      url: string;
      name: string;
      description: string;
      dateModified: string;
      inLanguage: string;
      isPartOf: { "@id": string };
      publisher: { "@id": string };
    }
  | {
      "@type": "BreadcrumbList";
      itemListElement: Array<{
        "@type": "ListItem";
        position: number;
        name: string;
        item: string;
      }>;
    };

export interface DocsJsonLd {
  "@context": "https://schema.org";
  "@graph": DocsJsonLdEntity[];
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseDocsDocument(path: DocsPath, source: string): DocsPage {
  const match = source.match(frontmatterPattern);

  if (!match) {
    throw new Error(`Missing frontmatter in docs document: ${path}`);
  }

  const [, frontmatter] = match;
  const data = docsPageDataSchema.parse(parse(frontmatter ?? ""));
  const body = source.slice(match[0].length).trimStart();

  return {
    slug: path.split("/"),
    path: `/docs/${path}`,
    data,
    body,
    url: `${SITE_URL}/docs/${path}`,
  };
}

function toTitle(value: string) {
  return value
    .replace(/^\[(.+)\]\(.+\)$/, "$1")
    .split("-")
    .map((segment) => (segment[0]?.toUpperCase() ?? "") + segment.slice(1))
    .join(" ");
}

function toHref(section: string, value: string) {
  const linkMatch = value.match(/^\[.+\]\((.+)\)$/);
  if (linkMatch?.[1]) {
    return linkMatch[1];
  }

  if (value === "index") {
    return `/docs/${section}`;
  }

  return `/docs/${section}/${value}`;
}

const migratedDocsPaths = new Set(["/docs/get-started/overview"]);

export const docsNavigation: DocsNavigationSection[] = [
  {
    title: getStartedMeta.title,
    items: getStartedMeta.pages.map((page) => {
      const href = toHref("get-started", page);
      return {
        title: toTitle(page),
        href,
        migrated: migratedDocsPaths.has(href),
      };
    }),
  },
  {
    title: integrateMeta.title,
    items: integrateMeta.pages
      .filter((page) => page !== "index")
      .map((page) => {
        const href = toHref("integrate", page);
        return {
          title: toTitle(page),
          href,
          migrated: migratedDocsPaths.has(href),
        };
      }),
  },
];

const docsPages = Object.entries(docsSources).map(([path, source]) =>
  parseDocsDocument(path as DocsPath, source)
);

const docsPageByPath = new Map<string, DocsPage>(
  docsPages.map((page) => [page.slug.join("/"), page])
);

export function getDocsPages(): DocsPage[] {
  return docsPages;
}

export function getDocsPage(slug: string[] | string): DocsPage | undefined {
  const key = Array.isArray(slug) ? slug.join("/") : slug.replace(/^\/+/, "");
  return docsPageByPath.get(key);
}

export function buildDocsRootHead(): DocsHead {
  return {
    meta: [
      { title: `${docsMeta.title} – Lightfast` },
      {
        name: "description",
        content:
          "Comprehensive documentation for Lightfast - surface decisions across your tools.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/docs` }],
  };
}

export function buildDocsHead(page: DocsPage): DocsHead {
  const canonicalUrl = page.data.canonicalUrl ?? page.url;

  return {
    meta: [
      { title: `${page.data.title} – Lightfast Docs` },
      { name: "description", content: page.data.description },
      { name: "keywords", content: page.data.keywords.join(", ") },
      { name: "author", content: page.data.authors[0]?.name ?? "Lightfast" },
      { property: "og:title", content: page.data.ogTitle },
      { property: "og:description", content: page.data.ogDescription },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lightfast Documentation" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.data.ogTitle },
      { name: "twitter:description", content: page.data.ogDescription },
      { name: "twitter:site", content: "@lightfastai" },
      { name: "twitter:creator", content: "@lightfastai" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}

function buildBreadcrumbItems(page: DocsPage) {
  const parents = [
    { name: "Home", item: SITE_URL },
    { name: "Docs", item: `${SITE_URL}/docs` },
  ];

  const slugItems = page.slug.map((segment, index) => {
    const isLeaf = index === page.slug.length - 1;
    return {
      name: isLeaf ? page.data.title : toTitle(segment),
      item: `${SITE_URL}/docs/${page.slug.slice(0, index + 1).join("/")}`,
    };
  });

  return [...parents, ...slugItems].map((item, index) => ({
    "@type": "ListItem" as const,
    position: index + 1,
    ...item,
  }));
}

export function buildDocsJsonLd(page: DocsPage): DocsJsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Lightfast",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/android-chrome-512x512.png`,
        },
        sameAs: [
          "https://twitter.com/lightfastai",
          "https://github.com/lightfastai",
          "https://www.linkedin.com/company/lightfastai",
        ],
        description:
          "Lightfast is the superintelligence layer for founders, built on a unified operating layer that connects tools, unifies agents, and orchestrates entire operations.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Lightfast",
        description:
          "Superintelligence layer for founders built on a unified operating layer to observe, remember, and act across every tool.",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
      {
        "@type": "WebPage",
        "@id": `${page.url}#webpage`,
        url: page.url,
        name: page.data.title,
        description: page.data.description,
        dateModified: page.data.updatedAt,
        inLanguage: "en-US",
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: buildBreadcrumbItems(page),
      },
    ],
  };
}
