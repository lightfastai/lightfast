import { defineCollections, defineConfig } from "fumadocs-mdx/config";
import {
  BlogPostSchema,
  BrandPageSchema,
  HomePageSchema,
  LegalPageSchema,
} from "./src/lib/publishing/schemas";

export const blogCollection = defineCollections({
  type: "doc",
  dir: "src/content/blog",
  schema: BlogPostSchema,
});

export const brandCollection = defineCollections({
  type: "doc",
  dir: "src/content/brand",
  schema: BrandPageSchema,
});

export const homeCollection = defineCollections({
  type: "doc",
  dir: "src/content/home",
  schema: HomePageSchema,
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
