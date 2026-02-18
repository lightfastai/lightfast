import { docs, meta, apiDocs, apiMeta } from "fumadocs-mdx:collections/server";
import { loader, multiple } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { openapiSource } from "fumadocs-openapi/server";
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
export type ApiPageType = (typeof apiDocs)[number];

// Export docs methods
export const { getPage, getPages, pageTree } = docsSource;

// Export API methods with different names
export const {
	getPage: getApiPage,
	getPages: getApiPages,
	pageTree: apiPageTree,
} = apiSource;
