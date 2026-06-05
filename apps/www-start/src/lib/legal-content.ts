import { parse } from "yaml";
import { z } from "zod";
import { SITE_URL } from "~/lib/landing-content";
import privacySource from "../content/legal/privacy.mdx?raw";
import termsSource from "../content/legal/terms.mdx?raw";

const legalPageDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  canonicalUrl: z.string().url().optional(),
  ogTitle: z.string(),
  ogDescription: z.string(),
  noindex: z.boolean(),
  nofollow: z.boolean(),
  updatedAt: z.string(),
  effectiveAt: z.string(),
});

const legalSources = {
  privacy: privacySource,
  terms: termsSource,
} as const;

export type LegalSlug = keyof typeof legalSources;
export type LegalPageData = z.infer<typeof legalPageDataSchema>;

export interface LegalPage {
  body: string;
  data: LegalPageData;
  slug: LegalSlug;
  url: `${typeof SITE_URL}/legal/${LegalSlug}`;
}

interface LegalHead {
  links: Array<{ rel: string; href: string }>;
  meta: Record<string, string>[];
}

type LegalJsonLdEntity =
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

export interface LegalJsonLd {
  "@context": "https://schema.org";
  "@graph": LegalJsonLdEntity[];
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseLegalDocument(slug: LegalSlug, source: string): LegalPage {
  const match = source.match(frontmatterPattern);

  if (!match) {
    throw new Error(`Missing frontmatter in legal document: ${slug}`);
  }

  const [, frontmatter] = match;
  const data = legalPageDataSchema.parse(parse(frontmatter ?? ""));
  const body = source.slice(match[0].length).trimStart();

  return {
    slug,
    data,
    body,
    url: `${SITE_URL}/legal/${slug}`,
  };
}

const legalPages = Object.entries(legalSources).map(([slug, source]) =>
  parseLegalDocument(slug as LegalSlug, source)
);

const legalPageBySlug = new Map<string, LegalPage>(
  legalPages.map((page) => [page.slug, page])
);

export function getLegalPages(): LegalPage[] {
  return legalPages;
}

export function getLegalPage(slug: string): LegalPage | undefined {
  return legalPageBySlug.get(slug);
}

export function buildLegalHead(page: LegalPage): LegalHead {
  const canonicalUrl = page.data.canonicalUrl ?? page.url;
  const robots = [
    page.data.noindex ? "noindex" : "index",
    page.data.nofollow ? "nofollow" : "follow",
  ].join(", ");

  return {
    meta: [
      { title: `${page.data.title} – Lightfast` },
      { name: "description", content: page.data.description },
      { name: "keywords", content: page.data.keywords.join(", ") },
      { name: "robots", content: robots },
      { property: "og:title", content: page.data.ogTitle },
      { property: "og:description", content: page.data.ogDescription },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lightfast" },
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

export function buildLegalJsonLd(page: LegalPage): LegalJsonLd {
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
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.data.title,
            item: page.url,
          },
        ],
      },
    ],
  };
}
