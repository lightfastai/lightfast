import type { Metadata } from "next";
import { seoEnv } from "./env";

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
  return { ...appDefaults, ...metadata, ...overrides };
}
