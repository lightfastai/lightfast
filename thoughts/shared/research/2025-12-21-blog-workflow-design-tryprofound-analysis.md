---
date: 2025-12-21T01:17:44Z
researcher: Claude
git_commit: e748742fce7afd80e7fdbc20fd9dee0421473d38
branch: main
repository: lightfast
topic: "Blog Workflow Design: TryProfound Blog Analysis & AEO Requirements"
tags: [research, blog-workflow, aeo, seo, tryprofound, content-strategy]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude
---

# Research: Blog Workflow Design - TryProfound Blog Analysis & AEO Requirements

**Date**: 2025-12-21T01:17:44Z
**Researcher**: Claude
**Git Commit**: e748742fce7afd80e7fdbc20fd9dee0421473d38
**Branch**: main
**Repository**: lightfast

## Research Question

Design a blog post workflow similar to the existing changelog workflow (`create_changelog` -> `validate_changelog` -> `publish_changelog`), analyzing TryProfound.com's blog categories (Technology, Company, Product) to understand writing styles, content formats, and AEO requirements for high-value conversion.

## Summary

This research analyzes TryProfound.com's three blog categories to extract writing patterns, content structures, and category-specific styles. The findings inform the design of a modular blog generation workflow that mirrors the existing changelog pipeline but adapts to different content categories with distinct tones and purposes.

Key findings:
1. **Three distinct writing styles** map to specific audience needs and conversion goals
2. **AEO optimization** requires structured content with direct answers, FAQ sections, and semantic markup
3. **The existing changelog workflow architecture** provides an excellent template that can be extended with category-aware styling

---

## Detailed Findings

### 1. TryProfound Blog Category Analysis

#### 1.1 Technology Blogs

**Posts Analyzed** (5):
- Bring Profound data directly into your AI workflow with MCP
- Agents are users: Why the Cloudflare-Perplexity fight misses the point
- X-Forwarded-For for AI agents
- What we discovered about AI crawlers via server log analysis
- Introducing next-aeo: Optimize your Next.js app for AI visibility

**Title Patterns**:
| Pattern | Example |
|---------|---------|
| Product Launch | "Introducing next-aeo: [Benefit]" |
| Opinion/Thought Leadership | "Agents are users: Why the Cloudflare-Perplexity fight misses the point" |
| Research Findings | "What we discovered about AI crawlers via server log analysis" |
| Technical Explainer | "X-Forwarded-For for AI agents" |

**Writing Style Characteristics**:
- **Technical depth**: High - assumes developer knowledge of SDKs, protocols, infrastructure
- **Vocabulary**: Developer-focused jargon (RAG, SSR, webhooks, MCP)
- **Tone**: Authoritative, opinionated, data-driven
- **Structure**: Problem → Data → Solution flow
- **Code examples**: Prominent, copy-paste ready (npm commands, SDK usage)

**Content Structure**:
1. **Hook**: Technical problem or industry controversy
2. **Data/Evidence**: Specific metrics (16.3% vs 1.7% conversion rates)
3. **Technical Explanation**: Deep-dive with layers (Foundation → Real-time → Retrieval)
4. **Solution**: Natural product positioning
5. **Action**: Copy-paste commands, documentation links

**CTA Style**: Documentation-focused, low-friction ("Available now with full documentation")

---

#### 1.2 Company Blogs

**Posts Analyzed** (5):
- Profound secures $35M to connect brands with one new customer: Superintelligence
- Profound x G2: Turning AI Search into a performance channel
- $20M to pioneer Answer Engine Optimization
- Profound opens a London office
- Inside our inaugural Zero Click NYC summit

**Title Patterns**:
| Pattern | Example |
|---------|---------|
| Funding Announcement | "Profound secures $35M to [Visionary Outcome]" |
| Partnership | "Profound x G2: [Transformation]" |
| Expansion | "Profound opens a London office" |
| Event | "Inside our inaugural Zero Click NYC summit" |

**Writing Style Characteristics**:
- **Tone**: Bold, declarative, visionary
- **Vocabulary**: Category-defining language ("pioneer AEO", "Superintelligence")
- **Data usage**: Specific figures for credibility ($35M, 300 leaders, 24.6% increase)
- **Brand voice**: Movement builder, thought leader

**Content Structure**:
1. **Bold reframing statement**: "The internet is no longer a destination... it's a presence you speak to"
2. **Core announcement**: Who, what, when
3. **Strategic context**: Why this matters for the industry
4. **Social proof**: Executive quotes, partner names
5. **Forward-looking close**: Vision, not hard sell

**Key Pattern**: "Shift From/To" narrative appears in almost every post:
- "from traditional search to AI conversations"
- "clicks → citations"

**CTA Style**: Implicit, value-driven (career opportunities, partnership exploration)

---

#### 1.3 Product Blogs

**Posts Analyzed** (7):
- Introducing Profound Workflows: Automating content operations
- Introducing support for ChatGPT Shopping
- Introducing Profound Actions
- Shopping Analysis: Your new window into conversational shopping
- Introducing Agency Mode: Scale smarter, pitch faster
- Introducing the Profound Index
- Now tracking GPT-5.2 in ChatGPT

**Title Patterns**:
| Pattern | Example |
|---------|---------|
| "Introducing [Feature]" | "Introducing Profound Workflows" (most common) |
| "[Feature]: [Benefit]" | "Shopping Analysis: Your new window into conversational shopping" |
| "Now tracking [Update]" | "Now tracking GPT-5.2 in ChatGPT" |

**Writing Style Characteristics**:
- **Tone**: Enterprise B2B professional, benefit-oriented
- **Vocabulary**: Problem-aware ("Content operations are often too manual")
- **Data**: Scale metrics (6+ million daily prompts, 400M conversations)
- **Structure**: Problem → Solution → Features → Use Cases → Availability

**Content Structure**:
1. **Market shift/pain point** (1-2 paragraphs)
2. **Feature introduction** (what it is, high-level purpose)
3. **Key functionality** (bulleted or subsections)
4. **Use cases/early adoption** (customer testimonials, beta partners)
5. **Availability/next steps**

**CTA Style**: Soft availability statements ("Available starting today to existing Profound customers")

---

### 2. Comparative Style Matrix

| Element | Technology | Company | Product |
|---------|------------|---------|---------|
| **Primary Audience** | Developers | Executives, Industry | Customers, Prospects |
| **Tone** | Technical authority | Visionary leader | Problem-solver |
| **Title Style** | "What we discovered..." | "[Company] secures $XM to..." | "Introducing [Feature]" |
| **Opening Hook** | Technical problem | Bold reframing | Market shift statement |
| **Data Usage** | Technical metrics | Funding/scale numbers | Platform scale metrics |
| **Code Examples** | Prominent | Rarely | When relevant |
| **Social Proof** | Industry references | VCs, enterprise brands | Beta customers |
| **CTA** | Documentation | Vision/careers | Feature access |
| **Content Length** | 800-1,500 words | 300-800 words | 500-1,000 words |
| **Jargon Level** | High | Medium | Medium-low |

---

### 3. AEO Requirements for High-Value Conversion

#### 3.1 Core AEO Requirements

**Direct Answer Format**:
- Lead every section with 40-60 word direct answer
- Use inverted pyramid (most critical answer first)
- Question-first headings matching user search queries

**TL;DR Section**:
- Placement: Immediately after title
- Length: 80-100 words or 3-5 bullet points
- Purpose: AI citation, featured snippets

**FAQ Section**:
- 3-7 specific questions per post
- Answers under 100 words each
- Use FAQPage schema markup
- Mirror "People Also Ask" phrasing

#### 3.2 Structured Data Requirements

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Article Title",
  "datePublished": "2025-02-05T08:00:00Z",
  "dateModified": "2025-02-05T09:00:00Z",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Lightfast"
  }
}
```

#### 3.3 High-Value Conversion Patterns

**Three-CTA Pattern**:
1. Above the fold (+18% opt-in rate)
2. Mid-content (+32% conversions) - highest performing
3. End of post (45% of total conversions)

**Lead Magnet Integration**:
- Aligned with blog topic
- Inline form placement mid-content
- 2 fields maximum (name + email)

---

### 4. Existing Changelog Workflow Architecture

The changelog workflow provides the template for the blog workflow:

```
.claude/commands/
├── create_changelog.md    → Input parsing, fact-checking, draft generation
├── validate_changelog.md  → Field validation, link checking, red flags
└── publish_changelog.md   → CMS publishing workflow

.claude/skills/changelog-writer/
├── SKILL.md               → Core skill definition, guidelines
└── resources/
    ├── templates.md       → Frontmatter structure, document layout
    ├── seo-requirements.md → SEO/AEO field requirements
    ├── checklist.md       → Pre-publish validation
    └── examples.md        → Reference examples
```

**Key Patterns to Replicate**:
1. **Frontmatter mapping** to CMS input types
2. **Category-specific sections** (improvements, fixes, etc.)
3. **Fact-checking workflow** with sub-agents
4. **Internal field stripping** before publish
5. **SEO/AEO nested fields**

---

## Implementation Design: Blog Workflow

### 5. Proposed Architecture

```
.claude/commands/
├── create_blog.md         → Topic research, outline, draft generation
├── validate_blog.md       → Content validation, AEO checks, link validation
└── publish_blog.md        → CMS publishing workflow

.claude/skills/blog-writer/
├── SKILL.md               → Core skill definition
└── resources/
    ├── templates.md       → Frontmatter and content templates
    ├── aeo-requirements.md → AEO/SEO field requirements
    ├── checklist.md       → Pre-publish validation
    ├── examples.md        → Reference examples
    └── categories/
        ├── technology.md  → Technology category style guide
        ├── company.md     → Company category style guide
        └── product.md     → Product category style guide
```

### 6. Blog Frontmatter Schema

```yaml
---
# Core fields
title: "Blog Post Title"
slug: "blog-post-slug"
publishedAt: "YYYY-MM-DD"
author: "Author Name"
category: "technology" | "company" | "product"

# AEO fields
excerpt: "Max 300 chars for listings"
tldr: "80-100 word summary for AI citation"

# Content sections (category-dependent)
keyTakeaways:
  - "Takeaway 1"
  - "Takeaway 2"

# SEO nested object
seo:
  metaDescription: "150-160 chars"
  focusKeyword: "primary keyword"
  secondaryKeyword: "secondary keyword"
  faq:
    - question: "Question 1?"
      answer: "Answer 1"
    - question: "Question 2?"
      answer: "Answer 2"

# CTA configuration
ctas:
  aboveFold:
    type: "lead-magnet" | "signup" | "demo"
    text: "CTA text"
    link: "/path"
  midContent:
    type: "contextual"
    text: "CTA text"
    link: "/path"
  bottom:
    type: "primary"
    text: "CTA text"
    link: "/path"

# Internal fields (stripped before publish)
_internal:
  status: draft
  category_style: "technology" | "company" | "product"
  research_sources: ["URL1", "URL2"]
  generated: "ISO timestamp"
  word_count: 0
  reading_time: "X min"
---
```

### 7. Command Specifications

#### 7.1 create_blog.md

**Input Formats**:
- Topic string: `/create_blog "How to implement AEO for Next.js apps"`
- URL research: `/create_blog https://example.com/reference-article`
- Brief document: `/create_blog thoughts/briefs/aeo-guide.md`

**Workflow**:
1. Parse input and detect category (ask if unclear)
2. Load category-specific style from `resources/categories/{category}.md`
3. Research topic using web-search-researcher agent
4. Generate outline based on category template
5. Ask for approval on outline
6. Generate full draft with category-appropriate tone
7. Apply AEO requirements (TL;DR, FAQ, structured data)
8. Save to `thoughts/blog/{category}/{slug}-{timestamp}.md`

#### 7.2 validate_blog.md

**Validation Checks**:
1. **Frontmatter validation**: All required fields present
2. **AEO validation**: TL;DR length, FAQ structure, schema compliance
3. **Category style validation**: Tone, vocabulary, structure matches category
4. **Link validation**: All internal links resolve
5. **CTA validation**: Three CTAs present and configured
6. **Word count**: Within category-appropriate range
7. **Red flags**: Passive voice, missing code examples (technology), etc.

#### 7.3 publish_blog.md

**Workflow**:
1. Load and parse blog file
2. Validate all fields
3. Show preview with word count, reading time, category
4. Confirm publication
5. Execute CMS publish script
6. Update `_internal.status` to `published`
7. Return published URL

### 8. Category Style Guides (Summary)

#### 8.1 Technology Category

```markdown
# Technology Blog Style Guide

## Audience
Developers, engineers, technical decision makers

## Tone
- Authoritative and opinionated
- Data-driven claims
- Assumes technical knowledge

## Required Elements
- Code examples (1+ per major section)
- Technical metrics/benchmarks
- Implementation details
- "Why we built it this way" section

## Structure
1. Technical problem/industry controversy (hook)
2. Data/research backing
3. Technical deep-dive (layered explanation)
4. Solution/product positioning
5. Action: documentation, commands, next steps

## Title Patterns
- "What we discovered about [topic] via [methodology]"
- "Introducing [tool]: [benefit for developers]"
- "[Technical concept] for [use case]"

## Vocabulary
Use: RAG, SSR, webhooks, SDK, API, vector search, semantic
Avoid: Marketing buzzwords without technical backing
```

#### 8.2 Company Category

```markdown
# Company Blog Style Guide

## Audience
Executives, investors, industry analysts, potential hires

## Tone
- Visionary and bold
- Category-defining language
- Movement-building

## Required Elements
- Specific funding/scale numbers
- Strategic context for announcements
- Executive/partner quotes
- "Shift from/to" narrative

## Structure
1. Bold reframing statement (hook)
2. Core announcement (who, what, when)
3. Strategic industry context
4. Social proof (VCs, partners, brands)
5. Forward-looking vision

## Title Patterns
- "[Company] secures $XM to [visionary outcome]"
- "[Company] x [Partner]: [transformation statement]"
- "Inside our [event/milestone]"

## Vocabulary
Use: pioneer, shift, transform, optimize, visibility
Avoid: Generic corporate speak ("pleased to announce")
```

#### 8.3 Product Category

```markdown
# Product Blog Style Guide

## Audience
Customers, prospects, product managers

## Tone
- Professional B2B
- Benefit-oriented
- Problem-aware and empathetic

## Required Elements
- Market shift/pain point identification
- Feature breakdown with bullets
- Use cases/early adoption stories
- Availability statement

## Structure
1. Market shift/pain point (hook)
2. Feature introduction (what, why)
3. Key functionality (bulleted)
4. Use cases/customer testimonials
5. Availability/next steps

## Title Patterns
- "Introducing [Feature]: [benefit]"
- "[Feature Name]: Your new [capability]"
- "Now [action]: [what's new]"

## Vocabulary
Use: streamline, automate, visibility, insights, control
Avoid: Over-technical jargon without explanation
```

### 9. Sub-Agent Usage

The blog workflow should use these sub-agents:

| Agent | Purpose |
|-------|---------|
| `web-search-researcher` | Topic research, competitor analysis |
| `codebase-locator` | Find relevant internal docs/code for references |
| `codebase-analyzer` | Extract technical details for technology posts |
| `blog-writer` | Apply category style, generate content |
| `technical-writer` | Review for clarity and accuracy |

---

## Implementation Recommendations

### Phase 1: Foundation
1. Create `blog-writer` skill with SKILL.md and category style guides
2. Create `create_blog.md` command with category detection
3. Create basic frontmatter template matching CMS types

### Phase 2: Validation
4. Create `validate_blog.md` with AEO checklist
5. Implement category-specific validation rules
6. Add link validation for internal docs

### Phase 3: Publishing
7. Create `publish_blog.md` command
8. Create CMS publish script in `apps/www/scripts/`
9. Add blog to CMS schema (BaseHub or similar)

### Phase 4: Refinement
10. Add example files for each category
11. Create AEO grader integration
12. Add analytics tracking for conversion metrics

---

## Open Questions

1. **CMS Platform**: Will blog use BaseHub like changelog, or different CMS?
2. **Author Management**: How are authors defined? Single author or team?
3. **Image Handling**: How to handle hero images, inline images?
4. **Draft Review**: Should drafts go through human review workflow?
5. **Category Taxonomy**: Are Technology/Company/Product the final categories?
6. **URL Structure**: `/blog/{category}/{slug}` or `/blog/{slug}`?

---

## Related Research

- [AEO Best Practices 2024-2025](./2025-12-21-aeo-best-practices.md) (pending)
- Changelog workflow: `.claude/commands/create_changelog.md`
- Changelog skill: `.claude/skills/changelog-writer/SKILL.md`

---

## References

### TryProfound Blog Analysis
- https://www.tryprofound.com/blog/technology (5 posts analyzed)
- https://www.tryprofound.com/blog/company (5 posts analyzed)
- https://www.tryprofound.com/blog/product (7 posts analyzed)

### AEO Research Sources
- HubSpot AEO Best Practices Guide
- CXL Comprehensive AEO Guide 2025
- Search Engine Journal: How LLMs Interpret Content
- Perplexity Playbook for Citations
