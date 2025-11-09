import { docs, meta, apiDocs, apiMeta } from "@/.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";

// Docs source (general documentation)
export const docsSource = loader({
	baseUrl: "/docs",
	source: createMDXSource(docs, meta),
});

// API source (API reference documentation)
export const apiSource = loader({
	baseUrl: "/api",
	source: createMDXSource(apiDocs, apiMeta),
});

// Export docs methods
export const { getPage, getPages, pageTree } = docsSource;

// Export API methods with different names
export const {
	getPage: getApiPage,
	getPages: getApiPages,
	pageTree: apiPageTree,
} = apiSource;
