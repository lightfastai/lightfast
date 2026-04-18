---
name: lightfast-changelog
description: |
  Write and review AEO-optimized changelog entries for Lightfast. Triggers when the user asks
  to write a changelog entry, review changelog content, or asks about changelog structure,
  AEO optimization, or release notes formatting.
---

# Lightfast Changelog Skill

Write changelog entries optimized for Answer Engine Optimization (AEO) — structured so AI engines (ChatGPT, Perplexity, Claude, Google AI Overviews) can retrieve and cite individual sections as standalone answers.

## Core Principle

AI engines retrieve content at the **chunk/snippet level**, not the page level. Every H2 section in a changelog entry must function as a self-contained, directly answerable snippet that a query fanout sub-query can retrieve independently.

Source: tryprofound.com's AEO methodology, derived from ML model trained on millions of top-cited pages across AI platforms.

## Content Pipeline

Changelog MDX files live at `apps/www/src/content/changelog/`. Frontmatter is validated at build time against a Zod schema in `apps/www/src/lib/content-schemas.ts`. The SEO pipeline (`apps/www/src/lib/seo-bundle.ts`) produces Next.js Metadata and JSON-LD structured data per entry.

### What the infrastructure already handles

- FAQPage JSON-LD schema per entry (highest-impact AEO signal)
- BlogPosting JSON-LD with abstract, datePublished, dateModified, author with jobTitle
- BreadcrumbList (Home > Changelog > entry)
- Organization + WebSite entities
- Canonical URLs, OG + Twitter metadata, programmatic OG images
- RSS/Atom/feed.xml feeds (most recent 50 entries)
- Sitemap inclusion (index + all entries + feeds)
- Freshness signals via `updatedAt` in schema, JSON-LD, and sitemap

### What the content author controls (this skill)

- Answer-first content structure
- Question-based headings targeting query fanout
- Self-contained sections for chunk-level retrieval
- FAQ items targeting conversational sub-queries
- Trust signals (author credentials, TL;DR summary)

## File Naming

```
apps/www/src/content/changelog/YYYY-MM-DD-slug.mdx
```

Use the release date. The slug becomes the URL path: `/changelog/YYYY-MM-DD-slug`.

## Frontmatter Schema

All fields are required unless marked optional.

```yaml
---
title: "Short, descriptive title"                    # min 1 char
description: "50-160 char summary for meta tags"     # min 50, max 160
keywords: ["keyword1", "keyword2", ...]              # 3-20 items
canonicalUrl: "https://lightfast.ai/changelog/..."   # optional, must start with https://lightfast.ai/changelog/
ogTitle: "Title for social sharing"                  # min 1, max 70 chars
ogDescription: "50-160 char OG description"          # min 50, max 160
noindex: false
nofollow: false
authors:
  - name: "Author Name"
    url: "https://lightfast.ai"
    twitterHandle: "@handle"
    jobTitle: "Role"                                  # optional, emitted in Person JSON-LD
publishedAt: "YYYY-MM-DDTHH:MM:SSZ"                 # ISO datetime
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"                   # ISO datetime
version: "v0.X.0"                                    # min 1 char
type: "feature"                                      # feature | improvement | fix | breaking
featuredImage: "/images/changelog/..."               # optional, must start with /images/
tldr: "20-300 char summary"                          # acts as trust block answer summary
faq:                                                 # min 1 item
  - question: "Question text"                        # min 10 chars
    answer: "Answer text"                            # min 20 chars
---
```

## Writing the Content Body

### 1. Opening Paragraph (Answer-First Summary)

Lead with a 30-60 word direct answer to "What's in this release?" This is the first thing both humans and AI engines see after the TL;DR box.

```markdown
Lightfast vX.Y.Z introduces [primary change], [secondary change], and [tertiary change].
```

Do NOT use filler like "Here's everything in vX.Y.Z." — that wastes the most valuable content position.

### 2. Headings (Question-Based, Targeting Query Fanout)

Every H2 heading must be phrased as a question that mirrors how users ask AI engines.

| Bad (declarative) | Good (question-based) |
|---|---|
| `## Neural Pipeline` | `## How does the neural pipeline process events?` |
| `## New Features` | `## What new features does vX.Y.Z add?` |
| `## Breaking Changes` | `## What breaking changes are in vX.Y.Z?` |
| `## Bug Fixes` | `## What bugs were fixed in vX.Y.Z?` |
| `## API` | `## How do I access Lightfast programmatically?` |
| `## Performance` | `## What performance improvements ship in vX.Y.Z?` |

**Why:** AI engines fan out a user's prompt into 3-10 sub-queries before retrieving content. A heading like "How does the neural pipeline process events?" directly matches the sub-query an engine generates from "How does Lightfast work?"

### 3. Section Body (Atomic, Self-Contained)

Each H2 section follows this structure:

1. **Direct answer** (30-60 words) — answers the heading question immediately
2. **Atomic paragraphs** (2-3 paragraphs, 1-3 sentences each) — context and detail
3. **Scannable bullet list** — key points at a glance
4. **Example or screenshot** (when applicable)

Each section MUST be self-contained. An AI engine should be able to extract any H2 section without needing context from other sections or the page intro.

```markdown
## How does Lightfast track entities across sources?

The Entities view is a real-time browser for every entity extracted
from your engineering events — repositories, pull requests,
deployments, issues, users, endpoints, and more.

Filter by category, search by name, and watch new entities appear
live as events are processed. Each entity links to a detail view
showing its full metadata and event timeline.

- Real-time streaming via server-sent events
- Filter by entity category
- Search by entity name
- Detail views with full metadata and event timeline
```

### 4. Atomic Paragraphs

- 1-3 sentences per paragraph
- Each paragraph conveys one idea
- No long-form prose blocks
- No paragraphs that depend on the previous paragraph for context

### 5. Feature-Specific Sections

For each major feature, create a dedicated H2 section with its own question-based heading. Do NOT combine multiple features under a single "New Features" heading — each feature is a separate retrievable chunk.

### 6. Improvements / Minor Changes

Group minor changes under a single H2 like `## What other improvements ship in vX.Y.Z?` with a bullet list. Each bullet should be a complete, self-contained statement.

```markdown
## What other improvements ship in v0.2.0?

Beyond the core features, v0.2.0 includes:

- **Real-time updates** — entities and events stream live via SSE across all views
- **Jobs dashboard** — monitor background workflows with live status and error details
```

## Writing FAQ Items

FAQ items in the frontmatter become FAQPage JSON-LD — the single most impactful structured data type for AEO (per Profound's ML model, FAQPage schema is preferred over generic Article schema).

### Guidelines

- **5-7 FAQ items per entry** — cover the major features and common questions
- **Target query fanout sub-queries** — what would an AI engine ask when decomposing a user's prompt?
- **Direct, concise answers** — 1-3 sentences, no long explanatory text
- **Self-contained** — each answer must make sense without reading other FAQ items
- **Include product name** — "Lightfast" should appear in answers for entity recognition

### FAQ Categories to Cover

1. **Discovery** — "What is [feature]?" or "What does [feature] do?"
2. **Mechanism** — "How does [feature] work?"
3. **Capability** — "Can I [do something]?" or "Does Lightfast support [X]?"
4. **Specifics** — "What [entity types / integrations / etc.] does Lightfast [verb]?"

### Example

```yaml
faq:
  - question: "What is Lightfast and what does it do?"
    answer: "Lightfast is an engineering intelligence platform. It connects to your developer tools, processes events through a neural pipeline that extracts entities and relationships, and lets you query everything with AI."
  - question: "What sources does Lightfast connect to in v0.1.0?"
    answer: "Lightfast connects to GitHub, Vercel, Linear, and Sentry via OAuth. Events flow in real-time through webhooks and are automatically processed by the neural pipeline."
  - question: "How does Lightfast's AI chat work?"
    answer: "Explore is a streaming AI interface that searches your entity graph, retrieves context from the vector store, and responds with cited, markdown-formatted answers grounded in your actual engineering data."
```

## Freshness

- Always set `updatedAt` to the current date when editing an existing entry
- If a feature described in an old entry has changed significantly, update the entry content AND the `updatedAt` date
- Recency is an explicit ranking signal in AI engine content scoring

## Images and Media

- Featured images go in `apps/www/public/images/changelog/`
- Use `{/* TODO: description — path */}` comments for planned screenshots
- The `![alt text](/images/changelog/filename.png)` syntax renders via the MDX `img` component as a Next.js Image with `aspect-video` styling
- OG images are generated programmatically at `[slug]/opengraph-image.tsx` — no manual OG image needed

## Index Page FAQ

The changelog index page at `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx` has its own hardcoded FAQ array. When adding new changelog entries that introduce new product capabilities, consider whether the index-page FAQ should be updated to reflect the broader product.

## Key Files

| Purpose | Path |
|---|---|
| MDX content files | `apps/www/src/content/changelog/*.mdx` |
| Frontmatter schema (Zod) | `apps/www/src/lib/content-schemas.ts` |
| Content loader | `apps/www/src/app/(app)/(content)/_lib/source.ts` |
| SEO pipeline | `apps/www/src/lib/seo-bundle.ts` |
| JSON-LD builder | `apps/www/src/lib/builders/changelog.ts` |
| Shared builders | `apps/www/src/lib/builders/shared.ts` |
| Index page | `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx` |
| Entry page | `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx` |
| OG image | `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/opengraph-image.tsx` |
| Feed generator | `apps/www/src/app/(app)/_lib/feeds/generate-changelog-feed.ts` |
| MDX components | `apps/www/src/app/(app)/(content)/_lib/mdx-components.tsx` |
| Sitemap | `apps/www/src/app/sitemap.ts` |

## Checklist

Before finalizing a changelog entry, verify:

- [ ] Opening paragraph is 30-60 words answering "What's in this release?"
- [ ] Every H2 is a question that mirrors a conversational query
- [ ] Every H2 section is self-contained (extractable without surrounding context)
- [ ] Every section leads with a direct answer before detail
- [ ] Paragraphs are atomic (1-3 sentences, one idea each)
- [ ] 5-7 FAQ items covering discovery, mechanism, capability, and specifics
- [ ] FAQ answers are concise (1-3 sentences) and self-contained
- [ ] `tldr` is 20-300 chars and serves as the answer summary
- [ ] `description` is 50-160 chars
- [ ] `ogTitle` is max 70 chars
- [ ] `keywords` has 3-20 items
- [ ] `updatedAt` is set to today if editing an existing entry
- [ ] `authors` includes `jobTitle` for trust signals
- [ ] Product name "Lightfast" appears in FAQ answers and section openings
