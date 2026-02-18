#!/usr/bin/env npx tsx

/**
 * Publish a blog post from markdown to BaseHub CMS.
 *
 * Usage:
 *   pnpm publish:blog -- <filepath>
 *
 * The script:
 * 1. Reads and parses the markdown file
 * 2. Maps frontmatter to AIGeneratedPost type
 * 3. Resolves category and author IDs from BaseHub
 * 4. Creates the blog post via CMS mutation
 * 5. Updates local file status to 'published'
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import {
  createBlogPostFromAI,
} from "../src/mutations/blog.js";
import type { AIGeneratedPost, ContentType } from "../src/mutations/blog.js";
import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";
import { blog } from "@vendor/cms";

// Category slug to ID mapping (populated dynamically)
const categoryIdCache: Record<string, string> = {};

// Author slug to ID mapping (populated dynamically)
const authorIdCache: Record<string, string> = {};

async function getCategoryId(categorySlug: string): Promise<string> {
  if (categoryIdCache[categorySlug]) {
    return categoryIdCache[categorySlug];
  }

  const client = basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
  const result = (await client.query({
    blog: {
      categories: {
        items: {
          _id: true,
          _slug: true,
        },
      },
    },
  })) as { blog: { categories: { items: { _id: string; _slug: string }[] } } };

  const categories = result.blog.categories.items;
  for (const cat of categories) {
    if (cat._slug) {
      categoryIdCache[cat._slug] = cat._id;
    }
  }

  const id = categoryIdCache[categorySlug];
  if (!id) {
    throw new Error(
      `Category not found: ${categorySlug}. Available: ${Object.keys(categoryIdCache).join(", ")}`
    );
  }
  return id;
}

async function getAuthorId(authorSlug: string): Promise<string> {
  if (authorIdCache[authorSlug]) {
    return authorIdCache[authorSlug];
  }

  const client = basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
  const result = (await client.query({
    blog: {
      author: {
        items: {
          _id: true,
          _slug: true,
        },
      },
    },
  })) as { blog: { author: { items: { _id: string; _slug: string }[] } } };

  const authors = result.blog.author.items;
  for (const author of authors) {
    if (author._slug) {
      authorIdCache[author._slug] = author._id;
    }
  }

  const id = authorIdCache[authorSlug];
  if (!id) {
    throw new Error(
      `Author not found: ${authorSlug}. Available: ${Object.keys(authorIdCache).join(", ")}`
    );
  }
  return id;
}

interface InternalFields {
  status: "draft" | "published";
  generated?: string;
  sources?: string[];
  word_count?: number;
  reading_time?: string;
  publishedAt?: string;
}

interface BlogFrontmatter {
  title: string;
  slug: string;
  publishedAt: string;
  category: string;
  contentType?: ContentType;
  excerpt: string;
  tldr: string;
  author: string;
  seo: {
    metaDescription: string;
    focusKeyword: string;
    secondaryKeywords?: string[];
    faq?: { question: string; answer: string }[];
  };
  _internal?: InternalFields;
}

function mapContentType(category: string, contentType?: string): ContentType {
  if (contentType) return contentType as ContentType;

  // Default content types by category
  const defaults: Record<string, ContentType> = {
    technology: "deep-dive",
    company: "announcement",
    product: "announcement",
  };
  return defaults[category] ?? "deep-dive";
}

async function main() {
  const filepath = process.argv[2];
  if (!filepath) {
    console.error(
      JSON.stringify({
        success: false,
        error:
          "Usage: pnpm publish:blog -- <filepath>",
      })
    );
    process.exit(1);
  }

  const absolutePath = resolve(filepath);

  // Read and parse file
  let fileContent: string;
  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(
      JSON.stringify({
        success: false,
        error: `File not found: ${absolutePath}`,
      })
    );
    process.exit(1);
  }

  const { data, content: body } = matter(fileContent);
  const frontmatter = data as BlogFrontmatter;

  // Validate required fields
  const requiredFields: (keyof BlogFrontmatter)[] = [
    "title",
    "slug",
    "publishedAt",
    "category",
    "excerpt",
    "tldr",
    "author",
  ];
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      console.error(
        JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`,
        })
      );
      process.exit(1);
    }
  }

  // Check SEO fields
  if (!frontmatter.seo.metaDescription || !frontmatter.seo.focusKeyword) {
    console.error(
      JSON.stringify({
        success: false,
        error: "Missing required SEO fields: seo.metaDescription and seo.focusKeyword",
      })
    );
    process.exit(1);
  }

  // Check if already published
  if (frontmatter._internal?.status === "published") {
    console.error(
      JSON.stringify({
        success: false,
        error: "This blog post has already been published. Status is 'published'.",
      })
    );
    process.exit(1);
  }

  // Check for duplicate slug in BaseHub
  const existing = await blog.getPost(frontmatter.slug);
  if (existing) {
    console.error(
      JSON.stringify({
        success: false,
        error: `Blog post with slug '${frontmatter.slug}' already exists in BaseHub. Use a different slug or delete the existing entry.`,
        existingEntry: {
          title: existing._title,
          slug: frontmatter.slug,
        },
      })
    );
    process.exit(1);
  }

  // Resolve category and author IDs
  let categoryId: string;
  let authorId: string;
  try {
    categoryId = await getCategoryId(frontmatter.category);
  } catch (err) {
    console.error(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    process.exit(1);
  }

  try {
    authorId = await getAuthorId(frontmatter.author);
  } catch (err) {
    console.error(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    process.exit(1);
  }

  // Build AIGeneratedPost
  const post: AIGeneratedPost = {
    title: frontmatter.title,
    slug: frontmatter.slug,
    description: frontmatter.excerpt,
    excerpt: frontmatter.excerpt,
    tldr: frontmatter.tldr,
    content: body.trim(),
    contentType: mapContentType(frontmatter.category, frontmatter.contentType),
    seo: {
      focusKeyword: frontmatter.seo.focusKeyword,
      secondaryKeywords: frontmatter.seo.secondaryKeywords ?? [],
      metaDescription: frontmatter.seo.metaDescription,
      metaTitle: frontmatter.title,
    },
    categoryIds: [categoryId],
    authorIds: [authorId],
    publishedAt: new Date(frontmatter.publishedAt),
    status: "draft", // Publish as draft first for review
  };

  console.error(`Publishing blog post: ${frontmatter.title}...`);

  // Execute mutation
  const result = await createBlogPostFromAI(post);

  // Check if mutation succeeded (status can be "Completed" or "completed")
  const transaction = result.transaction as
    | { status: string; message?: string }
    | undefined;
  const status = transaction?.status.toLowerCase();
  if (status === "failed" || status !== "completed") {
    console.error(
      JSON.stringify({
        success: false,
        error: `BaseHub mutation failed: ${transaction?.message ?? "Unknown error"}`,
        result,
      })
    );
    process.exit(1);
  }

  // Update local file status only after successful mutation
  const updatedData: BlogFrontmatter = {
    ...frontmatter,
    _internal: {
      ...(frontmatter._internal ?? { status: "draft" }),
      status: "published",
      publishedAt: new Date().toISOString(),
    },
  };
  const updatedContent = matter.stringify(body, updatedData);
  writeFileSync(absolutePath, updatedContent);

  // Output success
  console.log(
    JSON.stringify(
      {
        success: true,
        result,
        localFileUpdated: true,
        slug: frontmatter.slug,
        url: `https://lightfast.ai/blog/${frontmatter.slug}`,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exit(1);
});
