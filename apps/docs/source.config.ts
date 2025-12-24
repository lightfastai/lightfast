import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

/**
 * Complete frontmatter schema with SEO fields.
 *
 * Note: We define the full schema instead of extending fumadocs' frontmatterSchema
 * because fumadocs-mdx uses Zod v4 internally while this project uses Zod v3.
 * Extending across Zod versions causes runtime errors.
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
const docsSchema = z.object({
	// Base fumadocs fields (must match fumadocs-mdx expectations)
	title: z.string(),
	description: z.string().optional(),
	icon: z.string().optional(),
	full: z.boolean().optional(),
	_openapi: z.record(z.unknown()).optional(),

	// SEO meta fields
	keywords: z.string().optional(),
	canonical: z.string().optional(),

	// OpenGraph overrides
	ogImage: z.string().optional(),
	ogTitle: z.string().optional(),
	ogDescription: z.string().optional(),

	// Indexing controls
	noindex: z.boolean().default(false),
	nofollow: z.boolean().default(false),

	// Article metadata for structured data
	author: z.string().optional(),
	publishedAt: z.string().optional(),
	updatedAt: z.string().optional(),

	// TechArticle-specific fields
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
