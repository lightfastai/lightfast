import { seoEnv } from "@vendor/seo/env";
import merge from "lodash.merge";
import type { Metadata } from "next";
import type { BasePageData } from "./content-schemas";

export type { BasePageData };

const applicationName = "Lightfast";
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = seoEnv.VERCEL_PROJECT_PRODUCTION_URL;

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
  return merge({}, appDefaults, metadata, overrides ?? {});
}

/**
 * Like createMetadata but forces og:type to "article" with publish/modify times.
 * Use for blog posts and changelog entries.
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
