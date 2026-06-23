import { seoEnv } from "@vendor/seo/env";
import merge from "lodash.merge";
import type { Metadata } from "next";
import type {
  BlogPostData,
  BrandPageData,
  HomePageData,
  LegalPageData,
} from "./schemas";
import { SITE } from "./site";

type RobotsData = Pick<
  BlogPostData | BrandPageData | HomePageData | LegalPageData,
  "nofollow" | "noindex"
>;

type StandardMetadataData = Pick<
  BlogPostData | BrandPageData | HomePageData | LegalPageData,
  | "description"
  | "keywords"
  | "nofollow"
  | "noindex"
  | "ogDescription"
  | "ogTitle"
  | "title"
>;

interface OgImage {
  readonly alt: string;
  readonly height: number;
  readonly url: string;
  readonly width: number;
}

const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = seoEnv.VERCEL_PROJECT_PRODUCTION_URL;

const appDefaults: Metadata = {
  applicationName: SITE.name,
  metadataBase: productionUrl
    ? new URL(`${protocol}://${productionUrl}`)
    : undefined,
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
};

function robotsFrom(data: RobotsData): Metadata["robots"] {
  return {
    index: !data.noindex,
    follow: !data.nofollow,
    googleBot: {
      index: !data.noindex,
      follow: !data.nofollow,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

function createPublicationMetadata(
  metadata: Partial<Metadata>,
  overrides?: Partial<Metadata>
): Metadata {
  const merged = merge({}, appDefaults, metadata, overrides ?? {});

  return {
    ...merged,
    openGraph: {
      ...merged.openGraph,
      images: merged.openGraph?.images ?? [SITE.defaultOgImage],
    },
    twitter: {
      ...merged.twitter,
      images: merged.twitter?.images ?? [SITE.defaultOgImage.url],
    },
  };
}

function buildStandardMetadata({
  canonicalUrl,
  data,
  ogImage,
  siteName = SITE.name,
  title,
  type = "website",
}: {
  canonicalUrl: string;
  data: StandardMetadataData;
  ogImage?: OgImage;
  siteName?: string;
  title: string;
  type?: "article" | "website";
}): Metadata {
  return createPublicationMetadata({
    title,
    description: data.description,
    keywords: data.keywords,
    creator: SITE.name,
    publisher: SITE.name,
    robots: robotsFrom(data),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: data.ogTitle,
      description: data.ogDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
      type,
      url: canonicalUrl,
      siteName,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: data.ogTitle,
      description: data.ogDescription,
      ...(ogImage ? { images: [ogImage.url] } : {}),
      site: SITE.twitterHandle,
      creator: SITE.twitterHandle,
    },
  });
}

export function buildHomeMetadata(
  data: HomePageData,
  canonicalUrl: string
): Metadata {
  return buildStandardMetadata({
    canonicalUrl,
    data,
    ogImage: SITE.homeOgImage,
    title: `${data.title} | ${SITE.name}`,
  });
}

export function buildBrandMetadata(
  data: BrandPageData,
  canonicalUrl: string
): Metadata {
  return buildStandardMetadata({
    canonicalUrl,
    data,
    title: `${data.title} | ${SITE.name}`,
  });
}

export function buildLegalMetadata(
  data: LegalPageData,
  canonicalUrl: string
): Metadata {
  return buildStandardMetadata({
    canonicalUrl,
    data,
    title: `${data.title} - ${SITE.name}`,
  });
}

export function buildBlogPostMetadata(
  data: BlogPostData,
  canonicalUrl: string
): Metadata {
  return createPublicationMetadata(
    {
      title: `${data.title} - ${SITE.name} Blog`,
      description: data.description,
      keywords: data.keywords,
      authors: data.authors.map((author) => ({
        name: author.name,
        url: author.url,
      })),
      creator: SITE.name,
      publisher: SITE.name,
      robots: robotsFrom(data),
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: data.ogTitle,
        description: data.ogDescription,
        url: canonicalUrl,
        siteName: `${SITE.name} Blog`,
        locale: "en_US",
        type: "article",
        publishedTime: data.publishedAt,
        modifiedTime: data.updatedAt,
        authors: data.authors.map((author) => author.url),
      },
      twitter: {
        card: "summary_large_image",
        title: data.ogTitle,
        description: data.ogDescription,
        site: SITE.twitterHandle,
        creator: SITE.twitterHandle,
      },
      category: "Technology",
    }
  );
}

export function buildBlogIndexMetadata(canonicalUrl: string): Metadata {
  const description =
    "Notes from Lightfast on applied AI, real-time collaboration, product engineering, evals, and the systems we build.";

  return createPublicationMetadata({
    title: `Blog | ${SITE.name}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Blog | ${SITE.name}`,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: SITE.name,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `Blog | ${SITE.name}`,
      description,
      site: SITE.twitterHandle,
      creator: SITE.twitterHandle,
    },
  });
}
