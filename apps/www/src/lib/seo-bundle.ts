import type { GraphContext } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import type { BlogCategoryMeta } from "~/config/blog-categories";
import type { BlogCategoryPost, Crumb } from "./builders";
import {
  buildApiRefJsonLd,
  buildBlogCategoryJsonLd,
  buildBlogPostJsonLd,
  buildChangelogEntryJsonLd,
  buildDocsJsonLd,
  buildIntegrationJsonLd,
  buildLegalJsonLd,
} from "./builders";
import type {
  BlogPostData,
  ChangelogEntryData,
  ContentSeoData,
  DocsPageData,
  IntegrationPageData,
  LegalPageData,
} from "./content-schemas";
import { createArticleMetadata, createMetadata } from "./content-seo";
import type {
  ApiRefUrl,
  BlogPostUrl,
  ChangelogUrl,
  DocsUrl,
  IntegrationUrl,
  LegalUrl,
} from "./url-types";

interface SeoBundle {
  readonly jsonLd: GraphContext;
  readonly metadata: Metadata;
}

// SeoBundle owns canonical URL derivation — derives from the typed url param,
// respects frontmatter canonicalUrl as an escape hatch.
// Both metadata.alternates.canonical and JSON-LD url come from the same value:
// drift is structurally impossible.

function buildArticleMetadata(
  data: ContentSeoData,
  canonicalUrl: string,
  titleSuffix: string,
  siteName: string,
  ogImageUrl?: string
): Metadata {
  return createArticleMetadata(
    {
      title: `${data.title} – ${titleSuffix}`,
      description: data.description,
      keywords: data.keywords,
      authors: data.authors.map((a) => ({ name: a.name, url: a.url })),
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: !data.noindex,
        follow: !data.nofollow,
        googleBot: {
          index: !data.noindex,
          follow: !data.nofollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: data.ogTitle,
        description: data.ogDescription,
        url: canonicalUrl,
        siteName,
        locale: "en_US",
        authors: data.authors.map((a) => a.url),
        ...(ogImageUrl && {
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: data.ogTitle,
            },
          ],
        }),
      },
      twitter: {
        card: "summary_large_image",
        title: data.ogTitle,
        description: data.ogDescription,
        site: "@lightfastai",
        creator: "@lightfastai",
        ...(ogImageUrl && { images: [ogImageUrl] }),
      },
      category: "Technology",
    },
    { publishedAt: data.publishedAt, updatedAt: data.updatedAt }
  );
}

export function emitBlogPostSeo(
  data: BlogPostData,
  url: BlogPostUrl
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  return {
    metadata: buildArticleMetadata(
      data,
      canonicalUrl,
      "Lightfast Blog",
      "Lightfast Blog"
    ),
    jsonLd: buildBlogPostJsonLd(data, url),
  };
}

export function emitBlogCategorySeo(
  meta: BlogCategoryMeta,
  posts: readonly BlogCategoryPost[]
): SeoBundle {
  const url = `https://lightfast.ai/blog/topic/${meta.slug}`;
  return {
    metadata: createMetadata({
      title: `${meta.heading} | Lightfast`,
      description: meta.description,
      keywords: [...meta.keywords],
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: {
        canonical: url,
        types: {
          "application/rss+xml": [
            { url: "https://lightfast.ai/blog/rss.xml", title: "RSS 2.0" },
          ],
          "application/atom+xml": [
            { url: "https://lightfast.ai/blog/atom.xml", title: "Atom 1.0" },
          ],
        },
      },
      openGraph: {
        title: meta.ogTitle,
        description: meta.description,
        type: "website",
        url,
        siteName: "Lightfast Blog",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: meta.ogTitle,
        description: meta.description,
        site: "@lightfastai",
        creator: "@lightfastai",
      },
      category: meta.title,
    }),
    jsonLd: buildBlogCategoryJsonLd(meta, posts, url),
  };
}

export function emitChangelogEntrySeo(
  data: ChangelogEntryData,
  url: ChangelogUrl
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  return {
    metadata: buildArticleMetadata(
      data,
      canonicalUrl,
      "Lightfast Changelog",
      "Lightfast Changelog"
    ),
    jsonLd: buildChangelogEntryJsonLd(data, url),
  };
}

export function emitDocsSeo(
  data: DocsPageData,
  url: DocsUrl,
  breadcrumbs: Crumb[]
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  const ogImageUrl = url.replace("/docs/", "/docs/og/");
  return {
    metadata: buildArticleMetadata(
      data,
      canonicalUrl,
      "Lightfast Docs",
      "Lightfast Documentation",
      ogImageUrl
    ),
    jsonLd: buildDocsJsonLd(data, url, breadcrumbs),
  };
}

export function emitLegalSeo(data: LegalPageData, url: LegalUrl): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  return {
    metadata: createMetadata({
      title: `${data.title} – Lightfast`,
      description: data.description,
      keywords: data.keywords,
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: !data.noindex,
        follow: !data.nofollow,
        googleBot: {
          index: !data.noindex,
          follow: !data.nofollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: data.ogTitle,
        description: data.ogDescription,
        type: "website",
        url: canonicalUrl,
        siteName: "Lightfast",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: data.ogTitle,
        description: data.ogDescription,
        site: "@lightfastai",
        creator: "@lightfastai",
      },
    }),
    jsonLd: buildLegalJsonLd(data, url),
  };
}

export function emitIntegrationSeo(
  data: IntegrationPageData,
  url: IntegrationUrl
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  const ogImageUrl = `${url}/opengraph-image`;
  return {
    metadata: createMetadata({
      title: `${data.title} – Lightfast Integrations`,
      description: data.description,
      keywords: data.keywords,
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: !data.noindex,
        follow: !data.nofollow,
        googleBot: {
          index: !data.noindex,
          follow: !data.nofollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: data.ogTitle,
        description: data.ogDescription,
        type: "website",
        url: canonicalUrl,
        siteName: "Lightfast Integrations",
        locale: "en_US",
        images: [
          { url: ogImageUrl, width: 1200, height: 630, alt: data.ogTitle },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: data.ogTitle,
        description: data.ogDescription,
        site: "@lightfastai",
        creator: "@lightfastai",
        images: [ogImageUrl],
      },
    }),
    jsonLd: buildIntegrationJsonLd(data, url),
  };
}

export function emitApiRefSeo(
  data: DocsPageData,
  url: ApiRefUrl,
  breadcrumbs: Crumb[]
): SeoBundle {
  const canonicalUrl = data.canonicalUrl ?? url;
  const ogImageUrl = url.replace(
    "/docs/api-reference/",
    "/docs/api-reference/og/"
  );
  return {
    metadata: buildArticleMetadata(
      data,
      canonicalUrl,
      "Lightfast API Reference",
      "Lightfast API Reference",
      ogImageUrl
    ),
    jsonLd: buildApiRefJsonLd(data, url, breadcrumbs),
  };
}
