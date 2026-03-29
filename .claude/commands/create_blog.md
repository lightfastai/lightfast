---
description: Create blog posts with category-aware styling and write directly to apps/www/src/content/blog/
model: sonnet
---

# Blog Generator

Generate AEO-optimized, category-aware blog posts and write them directly to the fumadocs content directory.

## CRITICAL: Match Category Voice

- **Engineering**: Technical authority, code examples, data-driven
- **Company**: Visionary, bold, category-defining
- **Product**: Problem-solver, benefit-oriented, customer-focused
- **Tutorial**: Step-by-step, practical, prerequisite-aware
- **Research**: Data-driven, methodology-first, citation-heavy

## Initial Response

When this command is invoked, check if arguments were provided:

**If arguments provided** (e.g., `/create_blog "How vector search works"` or `/create_blog engineering "MCP integration"`):
- Parse the input immediately
- Detect or use provided category
- Begin the blog generation workflow

**If no arguments**, respond with:
```
I'll help you generate a blog post. Please provide:

1. **Topic with category**: `/create_blog engineering "How vector search improves code retrieval"`
2. **Topic only** (I'll detect category): `/create_blog "Announcing our Series A"`
3. **URL for reference**: `/create_blog https://example.com/reference-article`

Categories: engineering, company, product, tutorial, research
```

Then wait for user input.

## Category Detection

If category not specified, infer from topic:
- Technical terms (API, SDK, architecture, vector, embeddings) → `engineering`
- Step-by-step, how-to, guide → `tutorial`
- Funding, partnership, hiring → `company`
- Feature, update, launch → `product`
- Data, analysis, benchmark, study → `research`

Ask user to confirm if uncertain.

## Workflow Steps

1. **Parse input and detect category**
   - Load category style from `.agents/skills/blog-writer/resources/categories/{category}.md`

2. **Create tracking plan using TodoWrite**

3. **Research topic:**
   - Use `web-search-researcher` agent for external context
   - Use `codebase-locator` agent if topic involves Lightfast features
   - Gather 5+ authoritative sources for citations

4. **Generate outline** using category template from `.agents/skills/blog-writer/resources/templates.md`

5. **Ask for approval on outline** before writing full draft

6. **Generate full draft** following category voice

7. **Determine filename:**
   - Format: `YYYY-MM-DD-{slug}.mdx`
   - Date = today, slug from title
   - Example: `2025-12-21-how-vector-search-works.mdx`

8. **Write the file to `apps/www/src/content/blog/{filename}`**

9. **Present results:**
   ```
   ## Blog Post Written

   **File**: apps/www/src/content/blog/{filename}
   **URL**: https://lightfast.ai/blog/{slug}
   **Category**: {category}
   **Word Count**: {count}

   The post is live on next build. Use `/validate_blog` to audit.
   ```

## Frontmatter Schema

Maps to `BlogPostSchema` in `apps/www/src/lib/content-schemas.ts`:

```yaml
---
title: "Blog Post Title"
description: "150-160 char meta description with primary keyword"
keywords:
  - "primary keyword phrase"
  - "secondary keyword 1"
  - "secondary keyword 2"
canonicalUrl: "https://lightfast.ai/blog/YYYY-MM-DD-slug"  # optional
ogTitle: "Title for social sharing (max 70 chars)"
ogDescription: "50-160 char OG description"
ogImage: "https://lightfast.ai/images/og-default.png"
noindex: false
nofollow: false
authors:
  - name: "Jeevan Pillay"
    url: "https://lightfast.ai"
    twitterHandle: "@jeevanpillay"
publishedAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
category: "engineering"  # engineering | product | company | tutorial | research
readingTimeMinutes: 5
featured: false
tldr: "20-300 char summary for AI citation highlight box."
faq:
  - question: "What is [topic]?"
    answer: "Concise answer for featured snippets."
  - question: "How do I [action]?"
    answer: "Step-by-step answer."
---

{Generated content following skill templates}
```

## Notes

- Get outline approval before writing full draft
- `tldr` goes in frontmatter only — do NOT add a `## TL;DR` body section
- `faq` goes in frontmatter only — the body includes a "Frequently Asked Questions" section for body content
- Verify Lightfast feature claims using codebase agents
