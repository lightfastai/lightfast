# Basehub Blog Setup Guide

## Overview

This guide provides step-by-step instructions for setting up a comprehensive blog structure in Basehub that supports AI-powered content creation, SEO optimization, and multi-author management.

## Table of Contents

1. [Dashboard Setup](#dashboard-setup)
2. [Tables Structure](#tables-structure)
3. [Field Definitions](#field-definitions)
4. [Relationships Configuration](#relationships-configuration)
5. [Code Integration](#code-integration)
6. [Testing](#testing)
7. [AI Content Pipeline](#ai-content-pipeline)

---

## Dashboard Setup

### Step 1: Access Basehub Dashboard

1. Go to [basehub.com](https://basehub.com)
2. Log in to your account
3. Navigate to your repository (or create one if needed)
4. Click on "Edit" to enter the repository editor

### Step 2: Create the Blog Document Block

1. In the root of your repository, type `/` to open the block selector
2. Choose **Document** block
3. Name it `blog`
4. This will be the container for all blog-related tables

---

## Tables Structure

Inside the `blog` document, create the following tables:

### Posts Table

1. Inside `blog`, type `/` and select **Table** block
2. Set the API name: `posts`
3. Set display name: `Blog Posts`

### Authors Table

1. Inside `blog`, type `/` and create another **Table** block
2. Set API name: `authors`
3. Set display name: `Authors`

### Categories Table

1. Type `/` and create **Table** block
2. API name: `categories`
3. Display name: `Categories`

---

## Field Definitions

### Posts Table Fields

#### Core Content Fields
- `slug` - **Text** field (for custom URL overrides)
- `description` - **Text** field (150-160 chars, for SEO meta and social cards)
- `excerpt` - **Rich Text** field (brief summary used in lists, email intros, etc.)
- `body` - **Rich Text** field (main content)

#### Publication Fields
- `publishedAt` - **Date** field
- `status` - **Select** field with options:
  - `draft`
  - `published`
  - `archived`

#### Content Type Fields
- `contentType` - **Select** field with options:
  - `tutorial`
  - `announcement`
  - `thought-leadership`
  - `case-study`
  - `comparison`
  - `deep-dive`
  - `guide`
- `difficulty` - **Select** field with options:
  - `beginner`
  - `intermediate`
  - `advanced`
- `prerequisites` - **Text** field (comma-separated list)

#### SEO Component (Create as Reusable Component)

First, create a Component:
1. Type `/` and select **Component** block
2. Name it `seoFields`
3. Add these fields:
   - `metaTitle` - Text field
   - `metaDescription` - Text field
   - `focusKeyword` - Text field
   - `secondaryKeywords` - Text field (comma-separated)
   - `canonicalUrl` - Text field
   - `noIndex` - Toggle field

Then in Posts table, add an **Instance** field referencing `seoFields`

#### Media Fields
- `featuredImage` - **Image** field
- `ogImage` - **Image** field (for social sharing)
- `videoUrl` - **Text** field (optional YouTube/Vimeo URL)

#### Engagement & CTA Fields
- `enableComments` - **Toggle** field
- `ctaType` - **Select** field with options:
  - `none`
  - `newsletter`
  - `demo`
  - `download`
  - `signup`
- `ctaTitle` - **Text** field
- `ctaDescription` - **Rich Text** field
- `ctaButtonText` - **Text** field
- `ctaButtonUrl` - **Text** field

#### Distribution & Sales Fields
- `businessGoal` - **Select** field to map content to funnel stages:
  - `awareness`
  - `consideration`
  - `conversion`
  - `retention`
- `primaryProductArea` - **Text** field (e.g., "Lightfast Core", "AI Workflows")
- `targetPersona` - **Text** field (e.g., "Founders", "IC Engineers", "RevOps")
- `campaignTag` - **Text** field (string shared with GitHub projects/issues for this campaign)
- `distributionChannels` - **Text** field (comma-separated list of channels, e.g., `blog, newsletter, x, linkedin, docs`)

#### AI Metadata Fields
- `aiGenerated` - **Toggle** field (default to `true` for this stack; set to `false` only for rare human-written posts)
- `aiModel` - **Text** field (e.g., "claude-3-opus")
- `aiPromptId` - **Text** field (reference to prompt template or workflow ID)

### Authors Table Fields

- `bio` - **Rich Text** field
- `avatar` - **Image** field
- `role` - **Text** field (job title)
- `email` - **Text** field
- `xUrl` - **Text** field (Twitter/X URL)
- `linkedInUrl` - **Text** field
- `githubUrl` - **Text** field
- `expertise` - **Text** field (comma-separated skills)
- `isAI` - **Toggle** field (for AI assistants)

### Categories Table Fields

- `description` - **Rich Text** field
- `icon` - **Text** field (icon name/class)
- `color` - **Text** field (hex color)
- `featured` - **Toggle** field
- `sortOrder` - **Number** field

## Relationships Configuration

### Posts Table References

Add these reference fields to the **Posts** table:

1. `authors` - **Reference** field
   - Target: `authors` table
   - Allow multiple selections

2. `categories` - **Reference** field
   - Target: `categories` table
    - Allow multiple selections

3. `relatedPosts` - **Reference** field
   - Target: `posts` table
   - Allow multiple selections

### Categories Table References

- `parent` - **Reference** field
  - Target: `categories` table (for nested categories)
  - Single selection

---

## Code Integration

### Step 1: Generate TypeScript Types

After creating the schema in Basehub:

```bash
# In your project root
pnpm basehub generate
```

This will update the `basehub-types.d.ts` file with your new schema.

### Step 2: Update vendor/cms/index.ts

Add the following code to your `vendor/cms/index.ts` file:

```typescript
/* -------------------------------------------------------------------------------------------------
 * Blog Fragments & Queries (Enhanced)
 * -----------------------------------------------------------------------------------------------*/

const authorFragment = fragmentOnLoose("AuthorsItem", {
  _slug: true,
  _title: true,
  bio: { plainText: true },
  avatar: imageFragment,
  role: true,
  email: true,
  xUrl: true,
  linkedInUrl: true,
  githubUrl: true,
  expertise: true,
  isAI: true,
});

const categoryFragment = fragmentOnLoose("CategoriesItem", {
  _slug: true,
  _title: true,
  description: { plainText: true },
  icon: true,
  color: true,
  featured: true,
  sortOrder: true,
  parent: {
    _slug: true,
    _title: true,
  },
});

const blogPostMetaFragment = fragmentOnLoose("PostsItem", {
  _slug: true,
  _title: true,
  slug: true,
  description: true,
  excerpt: { plainText: true },
  publishedAt: true,
  status: true,
  featuredImage: imageFragment,
  authors: authorFragment,
  categories: categoryFragment,
  contentType: true,
  difficulty: true,
  aiGenerated: true,
  _sys: {
    createdAt: true,
    lastModifiedAt: true,
  },
});

const blogPostFragment = fragmentOnLoose("PostsItem", {
  ...blogPostMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
  // SEO fields
  seoFields: {
    metaTitle: true,
    metaDescription: true,
    focusKeyword: true,
    secondaryKeywords: true,
    canonicalUrl: true,
    noIndex: true,
  },
  // Media
  ogImage: imageFragment,
  videoUrl: true,
  // Engagement
  enableComments: true,
  ctaType: true,
  ctaTitle: true,
  ctaDescription: { plainText: true },
  ctaButtonText: true,
  ctaButtonUrl: true,
  // References
  relatedPosts: blogPostMetaFragment,
  // AI tracking
  aiModel: true,
  aiPromptId: true,
  // Meta
  prerequisites: true,
});

// Enhanced types
export type BlogAuthor = {
  _slug?: string | null;
  _title?: string | null;
  bio?: { plainText?: string | null } | null;
  avatar?: any;
  role?: string | null;
  email?: string | null;
  xUrl?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  expertise?: string | null;
  isAI?: boolean | null;
};

export type BlogCategory = {
  _slug?: string | null;
  _title?: string | null;
  description?: { plainText?: string | null } | null;
  icon?: string | null;
  color?: string | null;
  featured?: boolean | null;
  sortOrder?: number | null;
  parent?: BlogCategory | null;
};

export type BlogPostMeta = {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  description?: string | null;
  excerpt?: { plainText?: string | null } | null;
  publishedAt?: string | null;
  status?: string | null;
  featuredImage?: any;
  authors?: BlogAuthor[] | null;
  categories?: BlogCategory[] | null;
  contentType?: string | null;
  difficulty?: string | null;
  aiGenerated?: boolean | null;
  _sys?: {
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
};

export type BlogPost = BlogPostMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: any[]; toc?: any } | null;
    readingTime?: number | null;
  } | null;
  seoFields?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    focusKeyword?: string | null;
    secondaryKeywords?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
  } | null;
  ogImage?: any;
  videoUrl?: string | null;
  enableComments?: boolean | null;
  ctaType?: string | null;
  ctaTitle?: string | null;
  ctaDescription?: { plainText?: string | null } | null;
  ctaButtonText?: string | null;
  ctaButtonUrl?: string | null;
  relatedPosts?: BlogPostMeta[] | null;
  aiModel?: string | null;
  aiPromptId?: string | null;
  prerequisites?: string | null;
};

// Enhanced blog queries
export const blog = {
  // Get all published posts
  postsQuery: fragmentOnLoose("Query", {
    blog: {
      posts: {
        __args: {
          filter: { status: { eq: "published" } },
          orderBy: "publishedAt__DESC",
        },
        items: blogPostMetaFragment,
      },
    },
  }),

  // Get posts by category
  postsByCategoryQuery: (categorySlug: string) =>
    fragmentOnLoose("Query", {
      blog: {
        posts: {
          __args: {
            filter: {
              status: { eq: "published" },
              categories: {
                _slug: { eq: categorySlug },
              },
            },
            orderBy: "publishedAt__DESC",
          },
          items: blogPostMetaFragment,
        },
      },
    }),

  // Get posts by author
  postsByAuthorQuery: (authorSlug: string) =>
    fragmentOnLoose("Query", {
      blog: {
        posts: {
          __args: {
            filter: {
              status: { eq: "published" },
              authors: {
                _slug: { eq: authorSlug },
              },
            },
            orderBy: "publishedAt__DESC",
          },
          items: blogPostMetaFragment,
        },
      },
    }),

  // Get single post by slug
  postQuery: (slug: string) => ({
    blog: {
      posts: {
        __args: {
          filter: {
            _sys_slug: { eq: slug },
          },
        },
        item: blogPostFragment,
      },
    },
  }),

  // Helper functions
  getPosts: async (): Promise<BlogPostMeta[]> => {
    try {
      const data: any = await basehub.query(blog.postsQuery as any);
      return data.blog.posts.items as BlogPostMeta[];
    } catch {
      return [];
    }
  },

  getPost: async (slug: string): Promise<BlogPost | null> => {
    try {
      const query = blog.postQuery(slug);
      const data: any = await basehub.query(query as any);
      return data.blog.posts.item as BlogPost;
    } catch {
      return null;
    }
  },

  getPostsByCategory: async (categorySlug: string): Promise<BlogPostMeta[]> => {
    try {
      const query = blog.postsByCategoryQuery(categorySlug);
      const data: any = await basehub.query(query as any);
      return data.blog.posts.items as BlogPostMeta[];
    } catch {
      return [];
    }
  },

  getCategories: async (): Promise<BlogCategory[]> => {
    try {
      const data: any = await basehub.query(blog.categoriesQuery as any);
      return data.blog.categories.items as BlogCategory[];
    } catch {
      return [];
    }
  },

  getAuthors: async (): Promise<BlogAuthor[]> => {
    try {
      const data: any = await basehub.query(blog.authorsQuery as any);
      return data.blog.authors.items as BlogAuthor[];
    } catch {
      return [];
    }
  },
};
```

---

## Testing

### Step 1: Create Test Data in Basehub

1. Go back to the Basehub dashboard
2. Create a test author in the `authors` table:
   - Name: "Test Author"
   - Role: "Developer"
   - Bio: "Test bio"

3. Create a test category in the `categories` table:
   - Name: "Tutorials"
   - Description: "Technical tutorials and guides"
   - Featured: true

4. Create a test blog post in the `posts` table:
   - Title: "Getting Started with Basehub"
   - Description: "Learn how to set up Basehub for your blog"
   - Status: "published"
   - Author: Select the test author
   - Category: Select the test category
   - Content Type: "tutorial"
   - Body: Add some rich text content

### Step 2: Test in Your Application

Create a test page at `apps/www/src/app/blog/page.tsx`:

```typescript
import { blog } from "@vendor/cms";

export default async function BlogPage() {
  const posts = await blog.getPosts();

  return (
    <div>
      <h1>Blog Posts</h1>
      <div className="grid gap-4">
        {posts.map((post) => (
          <article key={post._slug}>
            <h2>{post._title}</h2>
            <p>{post.description}</p>
            <div className="flex gap-2">
              {post.categories?.map((cat) => (
                <span key={cat._slug} className="badge">
                  {cat._title}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
```

---

## AI Content Pipeline

### Mutation API Integration

Create a new internal package at `packages/cms-workflows` and add a file at `packages/cms-workflows/src/mutations/blog.ts` for AI content creation. This file wires the Blog Writer output into your Basehub schema, including SEO, distribution, and AI metadata fields:

```typescript
import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

export type AIGeneratedPost = {
  title: string;
  description: string;
  excerpt: string;
  content: string;
  contentType: string;
  difficulty?: string | null;
  prerequisites?: string | null;
  keyword: string;
  secondaryKeywords: string[];
  businessGoal?: "awareness" | "consideration" | "conversion" | "retention" | null;
  primaryProductArea?: string | null;
  targetPersona?: string | null;
  campaignTag?: string | null;
  distributionChannels?: string[] | null;
  aiModel?: string | null;
  aiPromptId?: string | null;
  categories: string[]; // category IDs
  authorId: string;
};

export async function createBlogPostFromAI(data: AIGeneratedPost) {
  const distributionChannels =
    data.distributionChannels && data.distributionChannels.length > 0
      ? data.distributionChannels.join(", ")
      : undefined;

  const client = basehub({ token: basehubEnv.BASEHUB_TOKEN });

  return await client.mutation({
    transaction: {
      __args: {
        autoCommit: `AI: Create post - ${data.title}`,
        data: {
          type: "create",
          _table: "blog.posts",
          _title: data.title,
          description: data.description,
          body: {
            type: "rich-text",
            markdown: data.content,
          },
          excerpt: {
            type: "rich-text",
            markdown: data.excerpt,
          },
          seoFields: {
            focusKeyword: data.keyword,
            secondaryKeywords: data.secondaryKeywords.join(", "),
            metaDescription: data.description,
          },
          status: "draft", // Always start as draft for review
          publishedAt: {
            type: "date",
            value: new Date().toISOString(),
          },
          contentType: data.contentType,
          difficulty: data.difficulty ?? null,
          prerequisites: data.prerequisites ?? "",
          businessGoal: data.businessGoal ?? null,
          primaryProductArea: data.primaryProductArea ?? null,
          targetPersona: data.targetPersona ?? null,
          campaignTag: data.campaignTag ?? null,
          distributionChannels,
          aiGenerated: true,
          aiModel: data.aiModel ?? "claude-3-opus",
          aiPromptId: data.aiPromptId ?? null,
          authors: {
            type: "reference",
            ids: [data.authorId],
          },
          categories: {
            type: "reference",
            ids: data.categories,
          },
        },
      },
      message: true,
      status: true,
    },
  });
}

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

export async function updatePostStatus(
  postId: string,
  status: "published" | "archived",
) {
  const client = getMutationClient();

  return await client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update post status to ${status}`,
        data: {
          type: "update",
          id: postId,
          status,
        },
      },
      message: true,
      status: true,
    },
  });
}
```

### AI Content Generation Workflow

```typescript
// packages/cms-workflows/src/workflows/blog/ai-content-generator.ts
import { createBlogPostFromAI } from "@repo/cms-workflows/mutations/blog";
import { generateWithClaude } from "./ai-provider"; // Your AI provider

export async function generateAndPublishBlogPost(topic: string, keywords: string[]) {
  // 1. Generate content with AI
  const generatedContent = await generateWithClaude({
    prompt: `Write a comprehensive blog post about: ${topic}

    Target keywords: ${keywords.join(", ")}

    Return JSON with:
    - title
    - description (150-160 chars)
    - excerpt (2-3 sentences)
    - content (markdown, 1500-2500 words)
    - contentType (tutorial/guide/comparison)
    - difficulty (if tutorial)`,
    model: "claude-3-opus"
  });

  // 2. Parse AI response
  const parsed = JSON.parse(generatedContent);

  // 3. Create in Basehub
  const result = await createBlogPostFromAI({
    ...parsed,
    keyword: keywords[0],
    secondaryKeywords: keywords.slice(1),
    categories: ["category-id-here"], // Map to actual category IDs
    authorId: "ai-author-id" // Create an AI author in Basehub
  });

  return result;
}
```

---

## Additional Components

### Custom Content Blocks

Create these reusable components in Basehub for rich content:

#### Code Example Component

1. Create **Component** block named `codeExample`
2. Add fields:
   - `title` - Text field
   - `description` - Text field
   - `language` - Select field: `typescript`, `javascript`, `python`, `bash`
   - `code` - Text field (multiline)
   - `filename` - Text field
   - `runnable` - Toggle field

#### Callout Component

1. Create **Component** named `callout`
2. Add fields:
   - `type` - Select: `info`, `warning`, `success`, `error`, `tip`
   - `title` - Text field
   - `content` - Rich Text field
   - `icon` - Text field

#### Tab Group Component

1. Create **Component** named `tabGroup`
2. Add a nested table `tabs` with:
   - `label` - Text field
   - `content` - Rich Text field

---

## Best Practices

### 1. Content Organization

- Use categories for broad topics
- Use series for multi-part tutorials
- Use tags (in prerequisites field) for granular classification

### 2. SEO Optimization

- Always fill in SEO fields for better search visibility
- Use descriptive URLs in the slug field
- Keep descriptions between 150-160 characters

### 3. AI Content Management

- Always start AI-generated posts as drafts
- Track AI model and prompt ID for reproducibility
- Have human reviewers check before publishing

### 4. Performance

- Use featured images with proper dimensions (1200x630 for OG images)
- Enable blur data URLs for image placeholders
- Keep excerpt separate from body for list views

### 5. Workflow

- Use status field to manage content lifecycle
- Set up preview environments for draft content
- Use the mutation API for batch operations

---

## Troubleshooting

### Common Issues

1. **Types not generating**:
   - Ensure `BASEHUB_TOKEN` is set in environment
   - Run `pnpm basehub generate` after schema changes

2. **Queries returning empty**:
   - Check that posts have `status: "published"`
   - Verify table names match exactly
   - Ensure relationships are properly linked

3. **Mutation API errors**:
   - Verify `BASEHUB_ADMIN_TOKEN` is set
   - Check field types match schema
   - Ensure table paths are correct (e.g., `blog.posts`)

---

## Next Steps

1. Create blog listing page at `/blog`
2. Create individual post page at `/blog/[slug]`
3. Implement category and author archive pages
4. Set up AI content generation pipeline
5. Create admin dashboard for content management
6. Implement search functionality
7. Add RSS feed generation
8. Set up preview mode for drafts

---

## Resources

- [Basehub Documentation](https://docs.basehub.com)
- [Basehub Mutation API Playground](https://mutation-api-playground.vercel.app/)
- [GraphQL Query Explorer](https://api.basehub.com/graphql)
- [GitHub Issue #333 - AI Content Strategy](https://github.com/lightfastai/lightfast/issues/333)
