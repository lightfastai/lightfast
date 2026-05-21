import {
  defineCollections,
  defineConfig,
  defineDocs,
} from "fumadocs-mdx/config";
import {
  BlogPostSchema,
  ChangelogEntrySchema,
  DocsPageSchema,
  LegalPageSchema,
} from "./src/lib/content-schemas";

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  docs: { schema: DocsPageSchema },
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
  docs: { schema: DocsPageSchema },
});

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
