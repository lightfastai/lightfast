import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs({
	dir: "src/content/docs",
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
	dir: "src/content/api",
});

export default defineConfig({
	mdxOptions: {
		// Disable fumadocs' built-in Shiki code highlighting
		// to preserve language-* className for custom SSRCodeBlock
		rehypeCodeOptions: false,
	},
});
