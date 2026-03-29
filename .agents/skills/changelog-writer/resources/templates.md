# Changelog Templates

## Frontmatter Schema

This frontmatter structure maps directly to `ChangelogEntrySchema` in `apps/www/src/lib/content-schemas.ts`. The `/create_changelog` command writes the file directly to `apps/www/src/content/changelog/`.

### Core Fields

- **title**: 2-3 key features (e.g., "GitHub File Sync, Semantic Search, Team Workspaces")
- **description**: 150-160 char meta description — this IS the SEO meta description (includes version + keyword)
- **keywords**: Array of keyword phrases (min 3). First entry is the primary focus keyword.
- **ogTitle**: Social sharing title (max 70 chars)
- **ogDescription**: 50-160 char OG description
- **ogImage**: OG image URL
- **version**: Version string shown in the changelog (e.g., `"v0.1.0"`)
- **type**: Change type — `feature` | `improvement` | `fix` | `breaking`
- **publishedAt** / **updatedAt**: ISO datetime strings
- **authors**: Array of author objects with name, url, twitterHandle

### AEO Fields

- **tldr**: 20-300 char summary optimized for AI citation engines. Rendered in a highlighted box at the top of the changelog page.
- **faq**: Array of Q&A pairs (min 1). Generates FAQPage schema for Google featured snippets.

### Frontmatter Template

```yaml
---
title: "Feature Name, Feature Name"
description: "150-160 char meta description with version and keyword — this is the SEO meta tag"
keywords:
  - "primary keyword phrase"
  - "secondary keyword"
  - "additional keyword"
canonicalUrl: "https://lightfast.ai/changelog/YYYY-MM-DD-slug"  # optional
ogTitle: "Title for social sharing (max 70 chars)"
ogDescription: "50-160 char OG description for social cards"
ogImage: "https://lightfast.ai/images/og-default.png"
noindex: false
nofollow: false
authors:
  - name: "Jeevan Pillay"
    url: "https://lightfast.ai"
    twitterHandle: "@jeevanpillay"
publishedAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
version: "v0.X.0"
type: "feature"  # feature | improvement | fix | breaking
tldr: "20-300 char summary for AI citation and featured snippets. Self-contained sentence(s) covering key user benefits."
faq:
  - question: "What is [feature]?"
    answer: "Concise answer optimized for featured snippets and voice search."
  - question: "How do I [action]?"
    answer: "Step-by-step answer with specifics."

# Internal fields (stripped before publishing)
_draft: true
_source_prs:
  - "#123"
  - "#124"
---
```

**Note on filename**: The filename determines the URL slug in fumadocs. Use `YYYY-MM-DD-{descriptive-slug}.md` for drafts; the publish command converts to `.mdx`.

## Document Structure

```markdown
**[2-3 key features as subtitle]**

---

### [Feature Name]

[1-3 sentences: what it does + user benefit]

**What's included:**
- Bullet list of specific capabilities
- Include limitations if any
- Mention beta/rollout status if applicable

**Example:**
\`\`\`yaml
# Config snippet or API example
\`\`\`

[Optional: "Why we built it this way" insight]

---

### [Next Feature]

[Repeat structure]

---

### What's Coming Next

[ONLY include if validated by codebase/roadmap]

**Based on your feedback:**
1. **[Feature]** (vX.X) — [brief description, validated by roadmap]
2. **[Integration]** (when N+ customers request it)

---

### Resources

- [Quick Start](/docs/get-started/quickstart)
- [GitHub Setup](/docs/connectors/github)
- [API Reference](/docs/api-reference/getting-started/overview)
```

## Section Guidelines

### Feature Sections (in body)
- Lead with user benefit
- Include "What's included" bullets
- Add code example
- Disclose what's NOT included
- Optional: "Why we built it this way"

### What's Coming Next (in body)
- ONLY validated items from roadmap
- Use conditionals: "when N+ customers request"
- Be honest about prioritization
