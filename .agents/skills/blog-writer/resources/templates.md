# Blog Templates

## Frontmatter Schema

This frontmatter structure maps to `BlogPostSchema` in `apps/www/src/lib/content-schemas.ts`. The `/create_blog` command writes the file directly to `apps/www/src/content/blog/`.

### Core Fields

- **title**: Blog post title (compelling, keyword-rich)
- **description**: 150-160 char meta description — this IS the SEO meta tag (not a nested `seo.metaDescription`)
- **keywords**: Array of keyword phrases (min 3, max 20). First entry is primary keyword.
- **ogTitle**: Social sharing title (max 70 chars)
- **ogDescription**: 50-160 char OG description
- **ogImage**: OG image URL
- **publishedAt** / **updatedAt**: ISO datetime strings
- **category**: One of: `engineering`, `company`, `product`, `tutorial`, `research`
- **readingTimeMinutes**: Estimated reading time (integer, min 1)
- **featured**: Boolean — whether post appears in featured sections

### AEO Fields

- **tldr**: 20-300 char summary for AI citation. Rendered as highlighted box at top of post.
- **faq**: Array of Q&A pairs (min 1). Generates FAQPage schema for featured snippets.

### Author

- **authors**: Array of author objects (min 1):
  - `name`: Author display name
  - `url`: Author profile URL
  - `twitterHandle`: Twitter/X handle

### Frontmatter Template

```yaml
---
title: "Blog Post Title"
description: "150-160 char meta description with primary keyword — this is the SEO meta tag"
keywords:
  - "primary keyword phrase"
  - "secondary keyword 1"
  - "secondary keyword 2"
canonicalUrl: "https://lightfast.ai/blog/YYYY-MM-DD-slug"  # optional
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
category: "engineering"  # engineering | product | company | tutorial | research
readingTimeMinutes: 5
featured: false
tldr: "20-300 char summary for AI citation. Self-contained, covers key user benefits."
faq:
  - question: "What is [topic]?"
    answer: "Concise answer optimized for featured snippets."
  - question: "How do I [action]?"
    answer: "Step-by-step answer with specifics."

# Internal fields (stripped before publishing)
_draft: true
_sources:
  - "https://source1.com"
  - "https://source2.com"
---
```

**Note on filename**: The filename determines the URL slug in fumadocs. Use `YYYY-MM-DD-{slug}.md` for drafts; the publish command converts to `.mdx`.

## Document Structure by Category

### Engineering Posts (800-1,500 words)

Note: The `tldr` frontmatter field is rendered automatically in a highlight box on the page. Do NOT include a `## TL;DR` section in the body.

```markdown
## [Technical Problem/Hook]

[1-2 paragraphs introducing the technical challenge or industry controversy]

**Key metrics:**
- [Data point 1]
- [Data point 2]

---

## [Technical Deep-Dive Section]

[Layer 1: Foundation explanation]

\`\`\`typescript
// Code example
\`\`\`

[Layer 2: Implementation details]

---

## [Solution/How We Built It]

[Natural product positioning with technical specifics]

**What's included:**
- [Capability 1]
- [Capability 2]

---

## Why We Built It This Way

[1-2 paragraphs on architectural decisions]

---

## Frequently Asked Questions

**Q: [Technical question]?**
A: [Complete, self-contained answer]

**Q: [Implementation question]?**
A: [Step-by-step answer]

---

## Resources

- [Documentation](/docs/relevant-page)
- [API Reference](/docs/api-reference/endpoint)
- [Quick Start](/docs/get-started/quickstart)
```

### Company Posts (300-800 words)

Note: The `tldr` frontmatter field is rendered automatically in a highlight box on the page. Do NOT include a `## TL;DR` section in the body.

```markdown
## [Bold Reframing Statement]

[The internet is no longer... -> it's now...]

---

## [Core Announcement]

[Who, what, when - the news]

**Key highlights:**
- [Highlight 1]
- [Highlight 2]

---

## [Strategic Context]

[Why this matters for the industry]

> "[Executive quote]" -- Name, Title

---

## [Looking Ahead]

[Vision statement, next steps]

---

## Frequently Asked Questions

**Q: [Impact question]?**
A: [Answer with forward-looking vision]

---

## Learn More

- [Careers](/careers)
- [About](/about)
- [Contact](/contact)
```

### Product Posts (500-1,000 words)

Note: The `tldr` frontmatter field is rendered automatically in a highlight box on the page. Do NOT include a `## TL;DR` section in the body.

```markdown
## [Market Shift/Pain Point]

[1-2 paragraphs identifying the problem]

---

## Introducing [Feature Name]

[What it is and high-level purpose]

**Key capabilities:**
- [Capability 1]: [Benefit]
- [Capability 2]: [Benefit]
- [Capability 3]: [Benefit]

---

## How It Works

[Brief explanation or walkthrough]

\`\`\`yaml
# Example configuration
\`\`\`

---

## Use Cases

**[Use case 1]**: [How the feature helps]

**[Use case 2]**: [How the feature helps]

---

## Availability

[When and how to access. Availability statement.]

---

## Frequently Asked Questions

**Q: [Pricing/access question]?**
A: [Clear answer]

**Q: [Integration question]?**
A: [Technical answer]

---

## Get Started

- [Quick Start](/docs/get-started/quickstart)
- [Documentation](/docs/get-started/overview)
- [Pricing](/pricing)
```

### Tutorial Posts (1,000-2,000 words)

```markdown
## Overview

[What the reader will learn and why it matters]

**Prerequisites:**
- [Requirement 1]
- [Requirement 2]

---

## Step 1: [Action]

[Explanation]

\`\`\`bash
# Command
\`\`\`

---

## Step 2: [Action]

[Explanation with code]

---

## Troubleshooting

**[Common issue]**: [Solution]

---

## Next Steps

- [Related tutorial](/docs/...)
- [API Reference](/docs/api-reference/...)
```

### Research Posts (1,200-2,000 words)

```markdown
## Overview

[What was studied and why]

---

## Methodology

[How the research was conducted]

---

## Findings

### [Finding 1]

[Data with citations]

---

## Implications

[What this means for practitioners]

---

## Conclusion

[Key takeaways]
```
