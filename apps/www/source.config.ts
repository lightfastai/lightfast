import { defineCollections, defineConfig } from "fumadocs-mdx/config";
import {
  BlogPostSchema,
  BrandPageSchema,
  ChangelogEntrySchema,
  LegalPageSchema,
} from "./src/lib/content-schemas";

export const blogCollection = defineCollections({
  type: "doc",
  dir: "src/content/blog",
  schema: BlogPostSchema,
});

export const changelogCollection = defineCollections({
  type: "doc",
  dir: "src/content/changelog",
  schema: ChangelogEntrySchema,
});

export const brandCollection = defineCollections({
  type: "doc",
  dir: "src/content/brand",
  schema: BrandPageSchema,
});

export const legalCollection = defineCollections({
  type: "doc",
  dir: "src/content/legal",
  schema: LegalPageSchema,
});

export default defineConfig({
  mdxOptions: {
    // Disable fumadocs' built-in Shiki code highlighting
    // to preserve language-* className for custom SSRCodeBlock
    rehypeCodeOptions: false,
  },
});
