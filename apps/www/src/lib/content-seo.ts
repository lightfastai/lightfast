import { seoEnv } from "@vendor/seo/env";
import merge from "lodash.merge";
import type { Metadata } from "next";

const applicationName = "Lightfast";
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = seoEnv.VERCEL_PROJECT_PRODUCTION_URL;
const defaultOgImage = {
  url: "https://lightfast.ai/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Lightfast - The Operating Layer for Agents and Apps",
} as const;

const appDefaults: Metadata = {
  applicationName,
  metadataBase: productionUrl
    ? new URL(`${protocol}://${productionUrl}`)
    : undefined,
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
};

/**
 * Merges page metadata with application-level defaults.
 * Pages construct their own title, description, openGraph, etc.
 * and this function injects the common base (applicationName, metadataBase, etc.).
 */
export function createMetadata(
  metadata: Partial<Metadata>,
  overrides?: Partial<Metadata>
): Metadata {
  const merged = merge({}, appDefaults, metadata, overrides ?? {});
  return {
    ...merged,
    openGraph: {
      ...merged.openGraph,
      images: merged.openGraph?.images ?? [defaultOgImage],
    },
    twitter: {
      ...merged.twitter,
      images: merged.twitter?.images ?? [defaultOgImage.url],
    },
  };
}

/**
 * Like createMetadata but forces og:type to "article" with publish/modify times.
 * Use for blog posts.
 */
export function createArticleMetadata(
  metadata: Partial<Metadata>,
  times: { publishedAt: string; updatedAt: string },
  overrides?: Partial<Metadata>
): Metadata {
  return createMetadata(
    metadata,
    merge(
      {
        openGraph: {
          type: "article" as const,
          publishedTime: times.publishedAt,
          modifiedTime: times.updatedAt,
        },
      },
      overrides ?? {}
    )
  );
}
