import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from "fumadocs-mdx/config";
import { z } from "zod";

const docsSchema = frontmatterSchema.extend({
  title: z.string().min(1),
  description: z.string().min(1),
  keywords: z.string().min(1),
  author: z.string().min(1),
  publishedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  canonical: z.string().optional(),
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  proficiencyLevel: z
    .enum(["Beginner", "Intermediate", "Advanced", "Expert"])
    .optional(),
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
