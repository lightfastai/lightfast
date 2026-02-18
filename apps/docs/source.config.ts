import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

/**
 * Extended frontmatter schema with SEO fields.
 *
 * With Zod v4, we can now extend fumadocs' frontmatterSchema directly.
 * This ensures compatibility with fumadocs-mdx v14 internals.
 *
 * These fields allow per-page SEO customization in MDX files:
 *
 * ```yaml
 * ---
 * title: MCP Server
 * description: Connect AI assistants via Model Context Protocol
 * keywords: MCP, Model Context Protocol, AI assistants, Claude, Cursor
 * ogTitle: Lightfast MCP Server - Connect AI to Your Knowledge
 * ogDescription: Enable Claude, Cursor, and Codex to search your workspace
 * ogImage: /og/docs-mcp.png
 * author: Lightfast Team
 * publishedAt: 2024-12-01
 * updatedAt: 2024-12-24
 * ---
 * ```
 */
const docsSchema = frontmatterSchema.extend({
	// Required fields — build fails (Zod validation) if any .mdx file omits these.
	// title is already required by the base schema, but we add min(1) to reject "".
	title: z.string().min(1),
	description: z.string().min(1),
	keywords: z.string().min(1),
	author: z.string().min(1),
	publishedAt: z.string().min(1),
	updatedAt: z.string().min(1),

	// Optional overrides (have good auto-generated defaults)
	canonical: z.string().optional(),
	ogImage: z.string().optional(),
	ogTitle: z.string().optional(),
	ogDescription: z.string().optional(),
	noindex: z.boolean().default(false),
	nofollow: z.boolean().default(false),
	proficiencyLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
});

export const { docs, meta } = defineDocs({
	dir: "src/content/docs",
	docs: {
		schema: docsSchema,
	},
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
	dir: "src/content/api",
	docs: {
		schema: docsSchema,
	},
});

export default defineConfig({
	mdxOptions: {
		// Disable fumadocs' built-in Shiki code highlighting
		// to preserve language-* className for custom SSRCodeBlock
		rehypeCodeOptions: false,
	},
});
