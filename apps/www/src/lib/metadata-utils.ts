import type { Metadata } from "next";

interface PageData {
  title?: string;
  description?: string;
}

/**
 * Generate consistent metadata for docs and API pages
 *
 * @param page - The page data object containing title and description
 * @returns Metadata object for Next.js
 */
export function generatePageMetadata(page: PageData | null): Metadata {
  if (!page) {
    return {
      title: "Not Found",
      description: "Page not found",
    };
  }

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}

/**
 * Generate redirect paths for root routes
 *
 * @param basePath - The base path (e.g., "/docs" or "/api")
 * @param defaultPath - The default path to redirect to
 * @returns The redirect path
 */
export function getDefaultRedirectPath(
  basePath: string,
  defaultPath: string
): string {
  return `${basePath}/${defaultPath}`;
}