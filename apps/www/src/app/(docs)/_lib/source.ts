import { apiDocs, apiMeta, docs, meta } from "fumadocs-mdx:collections/server";
import { loader, multiple } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { openapiSource } from "fumadocs-openapi/server";
import type { ApiPageProps } from "fumadocs-openapi/ui";
import { openapi } from "./openapi";

// Docs source (general documentation)
const docsSource = loader({
  baseUrl: "/docs",
  source: toFumadocsSource(docs, meta),
});

// API source (API reference documentation)
// Combines manual MDX pages (getting-started, sdks-tools) with virtual OpenAPI endpoint pages
const apiSource = loader({
  baseUrl: "/docs/api-reference",
  source: multiple({
    mdx: toFumadocsSource(apiDocs, apiMeta),
    openapi: await openapiSource(openapi, {
      // Use operationId for flat URLs (no tag folders)
      // This generates /docs/api-reference/search, /docs/api-reference/contents, etc.
      groupBy: "none",
      per: "operation",
    }),
  }),
});

/**
 * Type helpers that properly infer the full collection entry type including DocData.
 *
 * These types provide access to runtime properties (body, toc, structuredData) that
 * are added by fumadocs-mdx v14 but lost in fumadocs-core v16 loader type inference.
 */

/** Full collection entry type for API MDX pages (includes body, toc, structuredData) */
export type ApiPageType = (typeof apiDocs)[number];

/**
 * Frontmatter type for general docs pages, derived directly from the collection type.
 * The collection entry IS the data object (no nested `.data`), matching how ApiPageType
 * is used: `page.data as DocsFrontmatter`.
 * Eliminates the need for a manually-maintained mirror interface.
 */
export type DocsFrontmatter = (typeof docs)[number];

/**
 * Type guard for fumadocs-openapi virtual pages.
 *
 * OpenAPI virtual pages expose `getAPIPageProps()` on their data object.
 * MDX pages expose `body`, `toc`, `structuredData` instead.
 *
 * Use this guard whenever you need to branch between OpenAPI and MDX pages
 * instead of repeating the inline duck-type check.
 */
interface OpenAPIPageData {
  // ApiPageProps is exported from fumadocs-openapi/ui — no `any` needed
  getAPIPageProps: () => ApiPageProps;
  title?: string;
  description?: string;
}

export function isOpenAPIPage(
  page: { data: unknown }
): page is { data: OpenAPIPageData } {
  const data = page.data as Record<string, unknown>;
  return typeof data?.getAPIPageProps === "function";
}

// Export docs methods
export const { getPage, getPages, pageTree } = docsSource;

// Export API methods with different names
export const {
  getPage: getApiPage,
  getPages: getApiPages,
  pageTree: apiPageTree,
} = apiSource;
