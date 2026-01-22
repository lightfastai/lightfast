# Blog Workflow Implementation Plan

## Overview

Create a blog workflow (`create_blog` → `validate_blog` → `publish_blog`) that mirrors the existing changelog workflow but adds category-aware styling for Technology, Company, and Product blog posts. The workflow outputs markdown drafts to `thoughts/blog/` for human review before publishing to BaseHub CMS.

## Current State Analysis

### What Exists
- **Blog Frontend**: Routes at `apps/www/src/app/(app)/(marketing)/(content)/blog/` with listing, category pages (`/blog/topic/{category}`), and individual posts (`/blog/{slug}`)
- **CMS Mutation**: `createBlogPostFromAI()` in `packages/cms-workflows/src/mutations/blog.ts` accepts `AIGeneratedPost` type
- **Blog Agents**: `blog-brief-planner` and `blog-writer` agents output JSON for a different workflow (direct CMS push)
- **Categories in BaseHub**: technology, company, product, data, guides (focusing on first 3)
- **Changelog Workflow**: Complete reference implementation with 3 commands + 1 skill

### What's Missing
- `/create_blog`, `/validate_blog`, `/publish_blog` commands
- `blog-writer` skill with category style guides
- Publish script (`apps/www/scripts/publish-blog.ts`)
- Draft storage directory (`thoughts/blog/`)

### Key Discoveries
- Blog URL structure is `/blog/{slug}` (flat, not `/blog/{category}/{slug}`)
- Categories are metadata, not URL paths
- Authors referenced by BaseHub ID (hardcode to "jeevanpillay" for now)
- `AIGeneratedPost` requires `categoryIds` and `authorIds` arrays
- Existing blog agents output JSON, new workflow outputs markdown (consistent with changelog)

## Desired End State

A complete blog workflow where:
1. `/create_blog` generates category-aware markdown drafts with AEO optimization
2. `/validate_blog` validates drafts against category style guides and AEO requirements
3. `/publish_blog` publishes validated drafts to BaseHub CMS

### Verification:
- Draft files created at `thoughts/blog/{slug}-{timestamp}.md`
- Drafts parse correctly with required frontmatter fields
- Published posts appear at `https://lightfast.ai/blog/{slug}`
- Category styling matches TryProfound analysis patterns

## What We're NOT Doing

- Modifying existing `blog-brief-planner` and `blog-writer` agents (different workflow)
- Implementing Data and Guides categories (future phase)
- Author selection (hardcoded to jeevanpillay)
- Image upload automation (manual for now)
- BaseHub schema modifications

---

## Implementation Approach

Mirror the changelog workflow architecture:
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
    └── categories/
        ├── technology.md  → Technology category style guide
        ├── company.md     → Company category style guide
        └── product.md     → Product category style guide
```

---

## Phase 1: Blog Writer Skill Foundation

### Overview
Create the core `blog-writer` skill with category style guides based on TryProfound analysis.

### Changes Required:

#### 1. Create Skill Directory Structure

**Directory**: `.claude/skills/blog-writer/`

Create the following files:

#### 2. SKILL.md
**File**: `.claude/skills/blog-writer/SKILL.md`

```markdown
---
name: blog-writer
description: Create category-aware, AEO-optimized blog posts for Lightfast. Use when writing technology deep-dives, company announcements, or product launches.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Blog Writer

Create clear, accurate blog posts that help developers understand Lightfast capabilities and industry trends.

## Critical: Accuracy Over Marketing

Before writing anything:

1. **Verify every claim:**
   - If you cite a number, confirm the source
   - If you mention a feature, confirm it exists in production
   - When uncertain, ask for clarification

2. **Never oversell:**
   - Disclose limitations: "Currently supports X; Y coming in vZ"
   - Be honest about beta status and rollout timelines

3. **Match category voice:**
   - Technology: Technical authority, data-driven
   - Company: Visionary, category-defining
   - Product: Problem-solver, benefit-oriented

## Writing Guidelines

1. **Concise & scannable**: Match category word counts
2. **Lead with value**: Start with what readers gain
3. **Be transparent**: Mention beta status, limitations
4. **Active voice**: "You can now..." not "Users are able to..."
5. **No emoji**: Professional tone
6. **Include TL;DR**: 80-100 words for AI citation
7. **FAQ section**: 3-5 questions matching search queries
8. **Code examples**: Required for Technology posts

## Workflow

1. **Detect category** from input or ask if unclear
2. **Load category style** from `resources/categories/{category}.md`
3. **Research topic** using web-search-researcher agent
4. **Draft following** category template and [templates](resources/templates.md)
5. **Add AEO elements** per [aeo-requirements](resources/aeo-requirements.md)
6. **Review with** [checklist](resources/checklist.md)

## Quick Reference

### Category Selection
| Category | Use When | Audience |
|----------|----------|----------|
| Technology | Technical deep-dives, architecture, research | Developers, engineers |
| Company | Funding, partnerships, events, hiring | Executives, investors |
| Product | Feature launches, updates, tutorials | Customers, prospects |

### Do
- Include code examples (Technology)
- Use "shift from/to" narratives (Company)
- Lead with pain point (Product)
- Link to 3-5 related docs

### Don't
- Marketing buzzwords without substance
- Claims without verification
- Long paragraphs (keep sections scannable)
- Generic corporate speak

## Output

Save drafts to: `thoughts/blog/{slug}-{YYYYMMDD-HHMMSS}.md`

### Required Frontmatter Fields

Every draft MUST include:
- `title`, `slug`, `publishedAt`, `category` (core)
- `excerpt`, `tldr` (AEO)
- `seo.metaDescription`, `seo.focusKeyword` (SEO)
- `_internal.status`, `_internal.generated` (traceability)

See `resources/templates.md` for complete frontmatter template.

## Resources

- [Document Templates](resources/templates.md)
- [AEO Requirements](resources/aeo-requirements.md)
- [Pre-Publish Checklist](resources/checklist.md)
- [Technology Style Guide](resources/categories/technology.md)
- [Company Style Guide](resources/categories/company.md)
- [Product Style Guide](resources/categories/product.md)
```

#### 3. templates.md
**File**: `.claude/skills/blog-writer/resources/templates.md`

```markdown
# Blog Templates

## BaseHub Entry Fields

This frontmatter structure maps to `AIGeneratedPost` type in `@repo/cms-workflows`, enabling publish via `/publish_blog`.

### Core Fields

- **title**: Blog post title (compelling, keyword-rich)
- **slug**: URL slug (kebab-case, no category prefix)
- **publishedAt**: ISO date string (YYYY-MM-DD)
- **category**: One of: `technology`, `company`, `product`
- **contentType**: One of: `tutorial`, `announcement`, `thought-leadership`, `case-study`, `comparison`, `deep-dive`, `guide`

### AEO Fields (Answer Engine Optimization)

- **excerpt**: 2-3 sentences for listings (max 300 chars)
- **tldr**: 80-100 word summary for AI citation. Self-contained paragraph with key benefits.

### SEO Fields (nested under `seo:`)

- **seo.metaDescription**: 150-160 chars with primary keyword
- **seo.focusKeyword**: Primary keyword phrase
- **seo.secondaryKeywords**: Array of 2-4 secondary keywords
- **seo.faq**: Array of 3-5 question/answer pairs

### Author (hardcoded for now)

- **author**: `jeevanpillay`

### Internal Fields (nested under `_internal:`)

Stripped before publishing:

- **_internal.status**: `draft` or `published`
- **_internal.generated**: ISO timestamp
- **_internal.sources**: Array of research URLs
- **_internal.word_count**: Approximate word count
- **_internal.reading_time**: Estimated reading time

### Frontmatter Template

```yaml
---
# Core fields
title: "Blog Post Title"
slug: "blog-post-slug"
publishedAt: "YYYY-MM-DD"
category: "technology" | "company" | "product"
contentType: "deep-dive" | "announcement" | "tutorial" | etc.

# AEO fields
excerpt: "2-3 sentence summary for listings, max 300 chars"
tldr: "80-100 word summary for AI citation. Self-contained paragraph covering key user benefits and main insights."

# SEO nested object
seo:
  metaDescription: "150-160 char meta description with primary keyword"
  focusKeyword: "primary keyword phrase"
  secondaryKeywords:
    - "secondary keyword 1"
    - "secondary keyword 2"
  faq:
    - question: "What is [topic]?"
      answer: "Concise answer optimized for featured snippets."
    - question: "How do I [action]?"
      answer: "Step-by-step answer with specifics."

# Author (hardcoded)
author: "jeevanpillay"

# Internal fields (stripped before publish)
_internal:
  status: draft
  generated: "YYYY-MM-DDTHH:MM:SSZ"
  sources:
    - "https://source1.com"
    - "https://source2.com"
  word_count: 1200
  reading_time: "6 min"
---
```

## Document Structure by Category

### Technology Posts (800-1,500 words)

```markdown
## TL;DR

[80-100 word summary - rendered in highlight box]

---

## [Technical Problem/Hook]

[1-2 paragraphs introducing the technical challenge or industry controversy]

**Key metrics:**
- [Data point 1]
- [Data point 2]

---

## [Technical Deep-Dive Section]

[Layer 1: Foundation explanation]

```typescript
// Code example
```

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

```markdown
## TL;DR

[80-100 word summary]

---

## [Bold Reframing Statement]

[The internet is no longer... → it's now...]

---

## [Core Announcement]

[Who, what, when - the news]

**Key highlights:**
- [Highlight 1]
- [Highlight 2]

---

## [Strategic Context]

[Why this matters for the industry]

> "[Executive quote]" — Name, Title

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

```markdown
## TL;DR

[80-100 word summary]

---

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

```yaml
# Example configuration
```

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
- [Feature Docs](/docs/features/feature-name)
- [Pricing](/pricing)
```
```

#### 4. aeo-requirements.md
**File**: `.claude/skills/blog-writer/resources/aeo-requirements.md`

```markdown
# AEO Requirements

Every blog post MUST include these elements for Answer Engine Optimization.

## 1. TL;DR Section

**Purpose**: AI citation, featured snippets, quick scanning

**Requirements**:
- 80-100 words (self-contained paragraph)
- Immediately after title in rendered page
- Covers key user benefits
- Can stand alone as quotable text
- No bullet points (use flowing prose)

**Example**:
> Lightfast v0.4 introduces Neural Memory, a breakthrough in team knowledge retrieval. Neural Memory automatically captures and organizes decisions, discussions, and context from your tools—Slack, GitHub, Linear, and more. Your team can now search by meaning across all sources, get answers with citations, and trace the reasoning behind any decision. This release marks our shift from simple indexing to true organizational memory.

## 2. Excerpt

**Purpose**: Listing pages, RSS feeds, social sharing

**Requirements**:
- Max 300 characters
- Different from seo.metaDescription
- Entices click-through
- 2-3 complete sentences

## 3. FAQ Section

**Purpose**: FAQPage schema, featured snippets, voice search

**Requirements**:
- 3-5 questions per post
- Questions match real search queries ("How do I...", "What is...")
- Answers are complete and self-contained (2-3 sentences)
- Each answer works without surrounding context

**Category-specific FAQ focus**:
| Category | FAQ Focus |
|----------|-----------|
| Technology | Implementation, architecture, scaling |
| Company | Impact, timeline, vision |
| Product | Pricing, migration, compatibility |

## 4. Meta Description

**Requirements**:
- Exactly 150-160 characters
- Include primary keyword
- Match actual content
- End with benefit or CTA

## 5. Three-CTA Pattern

Blog posts should include contextual CTAs:

1. **Above the fold**: After TL;DR (+18% opt-in rate)
2. **Mid-content**: Most relevant section (+32% conversions)
3. **End of post**: Strong close (45% of total conversions)

**CTA types**:
- `lead-magnet`: Download, template, checklist
- `signup`: Free trial, demo request
- `docs`: Documentation link

## 6. Internal Links

Link to 3-5 related docs:
- Feature docs: `/docs/features/{feature}`
- API reference: `/docs/api-reference/{endpoint}`
- Quick start: `/docs/get-started/quickstart`
- Pricing: `/pricing`

## 7. External Citations

**Minimum**: 5+ external sources for credibility (E-E-A-T)

**Source types**:
- Research papers (arXiv, Google Research)
- Industry reports (Gartner, Forrester)
- Technical documentation (MDN, official docs)
- News sources (TechCrunch, The Verge)

## 8. Author Attribution

Every post includes author bio with E-E-A-T signals:
- Name and role
- Years of experience
- Relevant expertise
- LinkedIn (optional)

Currently hardcoded to: **Jeevan Pillay, Founder**

## SEO Checklist

### Required Fields
- [ ] `tldr`: 80-100 words, self-contained summary
- [ ] `excerpt`: Max 300 chars, distinct from metaDescription
- [ ] `seo.metaDescription`: 150-160 chars with keyword
- [ ] `seo.focusKeyword`: Primary keyword selected
- [ ] `seo.faq`: 3-5 Q&A pairs

### Content Requirements
- [ ] 3-5 internal links to docs
- [ ] 5+ external citations
- [ ] Code examples (Technology posts)
- [ ] Focus keyword used naturally (2-3 times)
- [ ] Author bio at end
```

#### 5. checklist.md
**File**: `.claude/skills/blog-writer/resources/checklist.md`

```markdown
# Pre-Publish Checklist

Run through this checklist before using `/publish_blog`.

## Frontmatter Validation

### Core Fields
- [ ] `title`: Present and compelling
- [ ] `slug`: Kebab-case, no special characters
- [ ] `publishedAt`: Valid ISO date (YYYY-MM-DD)
- [ ] `category`: One of `technology`, `company`, `product`
- [ ] `contentType`: Valid content type

### AEO Fields
- [ ] `excerpt`: Present, max 300 chars
- [ ] `tldr`: 80-100 words, self-contained

### SEO Fields
- [ ] `seo.metaDescription`: 150-160 characters
- [ ] `seo.focusKeyword`: Present
- [ ] `seo.secondaryKeywords`: 2-4 keywords
- [ ] `seo.faq`: 3-5 Q&A pairs

## Category-Specific Checks

### Technology Posts
- [ ] Word count: 800-1,500 words
- [ ] At least 1 code example per major section
- [ ] Technical metrics/benchmarks included
- [ ] "Why we built it this way" section
- [ ] 5-10 external citations

### Company Posts
- [ ] Word count: 300-800 words
- [ ] Bold reframing statement in opening
- [ ] "Shift from/to" narrative present
- [ ] Executive quote included
- [ ] Forward-looking close
- [ ] 3-5 external citations

### Product Posts
- [ ] Word count: 500-1,000 words
- [ ] Pain point identified in opening
- [ ] Feature breakdown with bullets
- [ ] Use cases section
- [ ] Availability statement
- [ ] 3-5 external citations

## Content Quality

### Structure
- [ ] TL;DR immediately after frontmatter
- [ ] FAQ section present with 3-5 questions
- [ ] Internal links: 3-5 to docs
- [ ] External links: 5+ authoritative sources
- [ ] Author bio reference

### Style
- [ ] No passive voice ("Users are able to" → "You can")
- [ ] No marketing buzzwords without substance
- [ ] No emoji
- [ ] Professional tone
- [ ] Active, direct language

### Forbidden Patterns
- [ ] No "Coming soon" without conditional
- [ ] No vague feature names (be specific)
- [ ] No unverified claims
- [ ] No `excerpt` = `metaDescription` (must differ)

## Red Flags (Automatic Rejection)

| Red Flag | Detection |
|----------|-----------|
| Missing TL;DR | `tldr` field undefined |
| TL;DR too short | Word count < 80 |
| Missing FAQ | `seo.faq` empty or undefined |
| No code examples | Technology post without code blocks |
| Over length | Exceeds category word limit |
| Under length | Below category minimum |
```

#### 6. Category Style Guides

**File**: `.claude/skills/blog-writer/resources/categories/technology.md`

```markdown
# Technology Blog Style Guide

## Audience
Developers, engineers, technical decision makers

## Tone
- Authoritative and opinionated
- Data-driven claims
- Assumes technical knowledge

## Word Count
800-1,500 words

## Required Elements
- Code examples (1+ per major section)
- Technical metrics/benchmarks
- Implementation details
- "Why we built it this way" section
- 5-10 external citations

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
- "[Topic]: Why the [industry debate] misses the point"

## Opening Hook Examples
- Start with controversial technical take
- Lead with surprising data point
- Present industry problem developers face

## Vocabulary
**Use**: RAG, SSR, webhooks, SDK, API, vector search, semantic, pipeline, architecture, latency, throughput
**Avoid**: Marketing buzzwords without technical backing, vague claims

## Code Example Requirements
- Copy-paste ready
- Include npm/pnpm commands
- Show actual SDK usage
- Syntax highlighted with language tag

## CTA Style
Documentation-focused, low-friction:
- "Full documentation available at..."
- "Get started with: `npm install @lightfast/sdk`"
- "See the API reference for..."

## Example Titles
- "Introducing next-aeo: Optimize your Next.js app for AI visibility"
- "What we discovered about AI crawlers via server log analysis"
- "X-Forwarded-For for AI agents"
- "Bring Profound data directly into your AI workflow with MCP"
```

**File**: `.claude/skills/blog-writer/resources/categories/company.md`

```markdown
# Company Blog Style Guide

## Audience
Executives, investors, industry analysts, potential hires

## Tone
- Visionary and bold
- Category-defining language
- Movement-building

## Word Count
300-800 words

## Required Elements
- Specific funding/scale numbers
- Strategic context for announcements
- Executive/partner quotes
- "Shift from/to" narrative
- 3-5 external citations

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
- "$XM to pioneer [category]"

## Opening Hook Examples
- "The internet is no longer a destination... it's a presence you speak to"
- Bold reframing of industry shift
- Declaration of new category

## Key Pattern: "Shift From/To"
Almost every company post should include this narrative:
- "from traditional search to AI conversations"
- "clicks → citations"
- "from documents to memory"

## Vocabulary
**Use**: pioneer, shift, transform, optimize, visibility, category, mission, vision
**Avoid**: Generic corporate speak ("pleased to announce", "excited to share")

## Quote Format
> "Quote text here." — Name, Title at Company

## CTA Style
Implicit, value-driven:
- Career opportunities
- Partnership exploration
- Vision alignment

## Example Titles
- "Profound secures $35M to connect brands with one new customer: Superintelligence"
- "Profound x G2: Turning AI Search into a performance channel"
- "$20M to pioneer Answer Engine Optimization"
- "Profound opens a London office"
```

**File**: `.claude/skills/blog-writer/resources/categories/product.md`

```markdown
# Product Blog Style Guide

## Audience
Customers, prospects, product managers

## Tone
- Professional B2B
- Benefit-oriented
- Problem-aware and empathetic

## Word Count
500-1,000 words

## Required Elements
- Market shift/pain point identification
- Feature breakdown with bullets
- Use cases/early adoption stories
- Availability statement
- 3-5 external citations

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
- "[Analysis Type]: Your new window into [domain]"

## Opening Hook Examples
- "Content operations are often too manual..."
- "Teams spend X hours per week on..."
- Identify specific pain point

## Vocabulary
**Use**: streamline, automate, visibility, insights, control, workflow, operations
**Avoid**: Over-technical jargon without explanation

## Feature Breakdown Format
**Key capabilities:**
- **[Capability]**: [1-sentence benefit]
- **[Capability]**: [1-sentence benefit]
- **[Capability]**: [1-sentence benefit]

## Availability Statement Examples
- "Available starting today to all Lightfast customers"
- "Rolling out to Pro and Enterprise plans this week"
- "Now in beta for early access customers"

## CTA Style
Soft availability statements:
- "Available now in your dashboard"
- "Get started in Settings → Features"
- "Contact sales for Enterprise access"

## Example Titles
- "Introducing Profound Workflows: Automating content operations"
- "Introducing support for ChatGPT Shopping"
- "Shopping Analysis: Your new window into conversational shopping"
- "Introducing Agency Mode: Scale smarter, pitch faster"
```

### Success Criteria:

#### Automated Verification:
- [x] All files exist in `.claude/skills/blog-writer/`
- [x] SKILL.md references all resource files correctly
- [x] Markdown syntax valid (no broken links)

#### Manual Verification:
- [x] Style guides match TryProfound analysis patterns
- [x] Templates align with existing blog page rendering
- [x] Checklist covers all validation requirements

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 2.

---

## Phase 2: Create Blog Command

### Overview
Build the `/create_blog` command that generates category-aware markdown drafts.

### Changes Required:

#### 1. create_blog.md
**File**: `.claude/commands/create_blog.md`

```markdown
---
description: Create blog posts with category-aware styling. Output saved to thoughts/blog/
model: opus
---

# Blog Generator

Generate AEO-optimized, category-aware blog posts for Lightfast.

## CRITICAL: Match Category Voice

- **Technology**: Technical authority, code examples, data-driven
- **Company**: Visionary, bold, category-defining
- **Product**: Problem-solver, benefit-oriented, customer-focused

## Initial Response

When this command is invoked, check if arguments were provided:

**If arguments provided** (e.g., `/create_blog "How vector search works"` or `/create_blog technology "MCP integration"`):
- Parse the input immediately
- Detect or use provided category
- Begin the blog generation workflow

**If no arguments**, respond with:
```
I'll help you generate a blog post. Please provide:

1. **Topic with category**: `/create_blog technology "How vector search improves code retrieval"`
2. **Topic only** (I'll detect category): `/create_blog "Announcing our Series A"`
3. **URL for reference**: `/create_blog https://example.com/reference-article`

Categories: technology, company, product

I'll research the topic, apply category styling, and generate an AEO-optimized draft.
```

Then wait for user input.

## Input Parsing

### Supported Formats

1. **Topic only**: `"Topic description"` - category auto-detected
2. **Category + topic**: `technology "Topic description"`
3. **URL**: `https://...` - extract topic from URL content
4. **Brief file**: `thoughts/briefs/topic.md` - read structured brief

### Category Detection

If category not specified, infer from topic:
- Technical terms (API, SDK, architecture) → `technology`
- Funding, partnership, hiring → `company`
- Feature, update, launch → `product`

Ask user to confirm if uncertain.

## Workflow Steps

1. **Parse input and detect category:**
   - Extract topic from arguments
   - Detect or confirm category
   - Load category style from `.claude/skills/blog-writer/resources/categories/{category}.md`

2. **Create tracking plan using TodoWrite:**
   - Research tasks
   - Outline generation
   - Draft writing
   - AEO element creation

3. **Research topic:**
   - Use `web-search-researcher` agent for external context
   - Use `codebase-locator` agent if topic involves Lightfast features
   - Gather 5+ authoritative sources for citations

4. **Generate outline based on category template:**
   - Load template from `.claude/skills/blog-writer/resources/templates.md`
   - Apply category-specific structure
   - Present outline for user approval before proceeding

5. **Ask for approval on outline:**
   - Show proposed structure
   - Confirm category selection
   - Get go-ahead to write full draft

6. **Generate full draft:**
   - Apply category voice and tone
   - Include all required AEO elements
   - Add code examples (Technology)
   - Include quotes (Company)
   - Add use cases (Product)

7. **Add SEO/AEO elements:**
   - Generate TL;DR (80-100 words)
   - Write excerpt (max 300 chars)
   - Create meta description (150-160 chars)
   - Generate 3-5 FAQ questions
   - Compile external citations

8. **Save output:**
   - **Filename format**: `{slug}-{YYYYMMDD-HHMMSS}.md`
   - **Output path**: `thoughts/blog/{filename}`
   - Example: `how-vector-search-works-20251221-143022.md`

9. **Present results:**
   ```
   ## Blog Post Generated

   **File**: `thoughts/blog/{filename}`
   **Category**: {category}
   **Word Count**: {count} ({expected range for category})

   ### Summary
   - Title: {title}
   - Slug: {slug}
   - Focus Keyword: {keyword}

   ### AEO Elements
   - TL;DR: {word count} words
   - FAQ: {count} questions
   - External Citations: {count}
   - Internal Links: {count}

   ### Next Steps
   1. Review the generated draft
   2. Make any manual adjustments
   3. Use `/validate_blog` to check for issues
   4. Use `/publish_blog` when ready

   Would you like me to open the file for review?
   ```

## Error Handling

### Category Detection Failed
```
I couldn't determine the category for "{topic}".

Please specify:
- `/create_blog technology "{topic}"` - for technical deep-dives
- `/create_blog company "{topic}"` - for announcements, partnerships
- `/create_blog product "{topic}"` - for feature launches
```

### Research Failed
```
Warning: Limited research results for "{topic}".
Proceeding with available sources. Consider adding more context.
```

## Important Notes

- Always get outline approval before writing full draft
- Match category word count ranges strictly
- Include all required AEO elements
- Verify claims using codebase agents when discussing Lightfast features
- Output is a draft - human review required before publishing
```

### Success Criteria:

#### Automated Verification:
- [x] Command file exists at `.claude/commands/create_blog.md`
- [x] Command is recognized by Claude Code
- [x] Drafts saved to `thoughts/blog/` directory

#### Manual Verification:
- [ ] Category detection works for sample topics
- [ ] Generated drafts match category templates
- [ ] AEO elements present and correctly formatted

**Implementation Note**: After completing this phase and verifying drafts generate correctly, pause for manual testing before Phase 3.

---

## Phase 3: Validate Blog Command

### Overview
Build the `/validate_blog` command that validates drafts against style guides and AEO requirements.

### Changes Required:

#### 1. validate_blog.md
**File**: `.claude/commands/validate_blog.md`

```markdown
---
description: Validate blog drafts against category style guides and AEO requirements
---

# Validate Blog

Validate blog draft files against all rules defined in the blog-writer skill.

## Initial Response

When invoked:

**If path provided** (e.g., `/validate_blog thoughts/blog/my-post.md`):
- Read the file immediately
- Begin validation workflow

**If no arguments**, respond with:
```
I'll help you validate a blog post. Please provide:

1. **File path**: `/validate_blog thoughts/blog/{filename}.md`
2. **Or select from available drafts**: I'll list files in `thoughts/blog/`

I'll validate against category style guides and AEO requirements.
```

Then list available blog files using: `ls thoughts/blog/`

## Step 1: Parse Blog Post

1. Read the blog file completely
2. Parse YAML frontmatter (between `---` markers)
3. Extract body content (after second `---`)
4. Identify category from frontmatter
5. Load category checklist from `.claude/skills/blog-writer/resources/categories/{category}.md`

## Step 2: Frontmatter Validation

Check all required fields:

| Field | Rule | Check |
|-------|------|-------|
| `title` | Required | Present and non-empty |
| `slug` | Kebab-case | Regex: `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `publishedAt` | ISO 8601 date | Valid YYYY-MM-DD |
| `category` | Valid value | One of: technology, company, product |
| `excerpt` | Max 300 chars | Character count |
| `tldr` | 80-100 words | Word count |
| `seo.metaDescription` | 150-160 chars | Character count |
| `seo.focusKeyword` | Required | Present |
| `seo.faq` | 3-5 items | Array length |
| `author` | Required | Present (should be "jeevanpillay") |
| `_internal.status` | Valid value | `draft` or `published` |

Report each field: ✓ (pass), ✗ (fail), ⚠ (warning)

## Step 3: Category-Specific Validation

Based on `category` field, validate:

### Technology Posts
- [ ] Word count: 800-1,500 words
- [ ] Code blocks present (>= 1)
- [ ] External citations: 5-10
- [ ] "Why we built" section or equivalent

### Company Posts
- [ ] Word count: 300-800 words
- [ ] Quote present (blockquote)
- [ ] External citations: 3-5
- [ ] "Shift from/to" narrative

### Product Posts
- [ ] Word count: 500-1,000 words
- [ ] Feature bullets present
- [ ] Use cases section
- [ ] Availability statement
- [ ] External citations: 3-5

## Step 4: AEO Validation

1. **TL;DR check**:
   - Present immediately after frontmatter
   - 80-100 words
   - Self-contained paragraph

2. **FAQ check**:
   - 3-5 questions
   - Questions use "How do I..." or "What is..." patterns
   - Answers are 2-3 sentences

3. **Meta description**:
   - 150-160 characters
   - Contains focus keyword

4. **Excerpt vs Meta**:
   - `excerpt` ≠ `seo.metaDescription` (must differ)

## Step 5: Link Validation

### Internal Links
Extract `/docs/*` links and verify:
- `/docs/get-started/overview`
- `/docs/features/*`
- `/docs/api-reference/*`

Map to actual files in `apps/docs/src/content/`.

### External Links
Count external links (should be 3-10 depending on category).

## Step 6: Content Quality Checks

### Forbidden Patterns
- [ ] "Users are able to" (passive voice)
- [ ] "Coming soon" without conditional
- [ ] Emoji in body text
- [ ] Vague feature names

### Required Patterns (by category)
- Technology: Code block with language tag
- Company: Blockquote (executive quote)
- Product: Bulleted feature list

## Step 7: Generate Validation Report

```markdown
## Blog Validation Report

**File**: `thoughts/blog/{filename}`
**Category**: {category}
**Validated**: {timestamp}

### Frontmatter Validation
✓ title: Present
✓ slug: Valid kebab-case
✓ publishedAt: Valid ISO date
✓ category: technology
✗ tldr: 65 words (should be 80-100)
✓ seo.metaDescription: 158 chars

### Category Validation (Technology)
✓ Word count: 1,247 words (800-1,500)
✓ Code blocks: 3 found
✗ External citations: 4 found (need 5-10)
✓ "Why we built" section present

### AEO Validation
✗ TL;DR: Below minimum word count
✓ FAQ: 4 questions (valid: 3-5)
✓ Meta description: 158 chars with keyword
✓ Excerpt differs from meta description

### Link Validation
✓ /docs/get-started/quickstart → EXISTS
✓ /docs/features/search → EXISTS
✗ /docs/api/vector-search → NOT FOUND
  Suggestion: /docs/api-reference/search

### Content Quality
✓ No forbidden patterns detected
✓ Code blocks have language tags
⚠ Focus keyword appears 1 time (recommend 2-3)

### Summary
- **Passed**: 14/17 checks
- **Failed**: 3 checks
- **Warnings**: 1

### Recommendations
1. Expand TL;DR to 80-100 words
2. Add 1-2 more external citations
3. Fix link: /docs/api/vector-search → /docs/api-reference/search
4. Add focus keyword once more in body text
```

## Error Handling

### File Not Found
```
Could not find blog file at: {path}

Available files in thoughts/blog/:
{list of .md files}
```

### Invalid Category
```
Unknown category: {category}

Valid categories: technology, company, product

Please update the `category` field in frontmatter.
```

## Important Notes

- Validation is advisory, not blocking
- Use before `/publish_blog` to catch issues
- All validation rules from `.claude/skills/blog-writer/resources/`
- Run validation after editing to verify fixes
```

### Success Criteria:

#### Automated Verification:
- [x] Command file exists at `.claude/commands/validate_blog.md`
- [x] Validation runs on sample draft files
- [x] Report generated with pass/fail status

#### Manual Verification:
- [ ] All checklist items validated correctly
- [ ] Category-specific rules applied
- [ ] Link validation identifies broken docs links

**Implementation Note**: After completing this phase, test with sample drafts before Phase 4.

---

## Phase 4: Publish Blog Command & Script

### Overview
Create the publish script and command to push validated drafts to BaseHub CMS.

### Changes Required:

#### 1. publish-blog.ts
**File**: `apps/www/scripts/publish-blog.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Publish a blog post from markdown to BaseHub CMS.
 *
 * Usage: pnpm with-env pnpm tsx scripts/publish-blog.ts <filepath>
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
  type AIGeneratedPost,
  type ContentType,
} from "@repo/cms-workflows/mutations/blog";
import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

// Author ID mapping (hardcoded for now)
const AUTHOR_IDS: Record<string, string> = {
  jeevanpillay: "", // Will be populated on first run
};

// Category slug to ID mapping (populated dynamically)
let categoryIdCache: Record<string, string> = {};

async function getCategoryId(categorySlug: string): Promise<string> {
  if (categoryIdCache[categorySlug]) {
    return categoryIdCache[categorySlug];
  }

  const client = basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
  const result = await client.query({
    blog: {
      categories: {
        items: {
          _id: true,
          _slug: true,
        },
      },
    },
  });

  const categories = (result as any).blog?.categories?.items || [];
  for (const cat of categories) {
    if (cat._slug) {
      categoryIdCache[cat._slug] = cat._id;
    }
  }

  const id = categoryIdCache[categorySlug];
  if (!id) {
    throw new Error(`Category not found: ${categorySlug}`);
  }
  return id;
}

async function getAuthorId(authorSlug: string): Promise<string> {
  if (AUTHOR_IDS[authorSlug]) {
    return AUTHOR_IDS[authorSlug];
  }

  const client = basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
  const result = await client.query({
    blog: {
      authors: {
        items: {
          _id: true,
          _slug: true,
        },
      },
    },
  });

  const authors = (result as any).blog?.authors?.items || [];
  for (const author of authors) {
    if (author._slug) {
      AUTHOR_IDS[author._slug] = author._id;
    }
  }

  const id = AUTHOR_IDS[authorSlug];
  if (!id) {
    throw new Error(`Author not found: ${authorSlug}. Available: ${Object.keys(AUTHOR_IDS).join(", ")}`);
  }
  return id;
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
    faq?: Array<{ question: string; answer: string }>;
  };
  _internal?: {
    status: string;
    generated?: string;
    sources?: string[];
  };
}

function mapContentType(category: string, contentType?: string): ContentType {
  if (contentType) return contentType as ContentType;

  // Default content types by category
  const defaults: Record<string, ContentType> = {
    technology: "deep-dive",
    company: "announcement",
    product: "announcement",
  };
  return defaults[category] || "deep-dive";
}

async function publishBlog(filepath: string): Promise<void> {
  // Read and parse the markdown file
  const absolutePath = resolve(filepath);
  const fileContent = readFileSync(absolutePath, "utf-8");
  const { data: frontmatter, content: body } = matter(fileContent);

  const fm = frontmatter as BlogFrontmatter;

  // Validate required fields
  const requiredFields = ["title", "slug", "publishedAt", "category", "excerpt", "tldr", "author"];
  for (const field of requiredFields) {
    if (!(field in fm)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Resolve category and author IDs
  const categoryId = await getCategoryId(fm.category);
  const authorId = await getAuthorId(fm.author);

  // Build AIGeneratedPost
  const post: AIGeneratedPost = {
    title: fm.title,
    slug: fm.slug,
    description: fm.excerpt,
    excerpt: fm.tldr, // TL;DR goes to excerpt in CMS
    content: body.trim(),
    contentType: mapContentType(fm.category, fm.contentType),
    seo: {
      focusKeyword: fm.seo.focusKeyword,
      secondaryKeywords: fm.seo.secondaryKeywords || [],
      metaDescription: fm.seo.metaDescription,
      metaTitle: fm.title,
    },
    categoryIds: [categoryId],
    authorIds: [authorId],
    publishedAt: new Date(fm.publishedAt),
    status: "draft", // Publish as draft first for review
  };

  console.log("Publishing blog post:", {
    title: post.title,
    slug: post.slug,
    category: fm.category,
    categoryId,
    authorId,
  });

  // Create in BaseHub
  const result = await createBlogPostFromAI(post);

  if (result.transaction.status !== "completed") {
    throw new Error(`Publish failed: ${result.transaction.message || "Unknown error"}`);
  }

  console.log("✓ Published successfully!");
  console.log(`  URL: https://lightfast.ai/blog/${fm.slug}`);
  console.log(`  Status: draft (publish in BaseHub dashboard)`);

  // Update local file status
  const updatedFrontmatter = {
    ...fm,
    _internal: {
      ...fm._internal,
      status: "published",
      publishedAt: new Date().toISOString(),
    },
  };

  const updatedContent = matter.stringify(body, updatedFrontmatter);
  writeFileSync(absolutePath, updatedContent);
  console.log("✓ Updated local file status to 'published'");

  // Output JSON for command parsing
  console.log(JSON.stringify({
    success: true,
    slug: fm.slug,
    url: `https://lightfast.ai/blog/${fm.slug}`,
  }));
}

// Main
const filepath = process.argv[2];
if (!filepath) {
  console.error("Usage: pnpm tsx scripts/publish-blog.ts <filepath>");
  process.exit(1);
}

publishBlog(filepath).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
```

#### 2. publish_blog.md
**File**: `.claude/commands/publish_blog.md`

```markdown
---
description: Publish a blog draft from thoughts/blog/ to BaseHub CMS
---

# Publish Blog

Publish a reviewed blog draft to BaseHub CMS.

## Workflow

When invoked, check if a file path was provided as an argument.

### If File Path Provided

Example: `/publish_blog thoughts/blog/my-post.md`

1. **Validate file exists:**
   - Use Read tool to load the file
   - If not found, show error and list available drafts

2. **Parse and preview:**
   - Extract YAML frontmatter
   - Display preview to user:

   ```
   ## Publish Preview

   **Title**: {title}
   **Slug**: {slug} → lightfast.ai/blog/{slug}
   **Category**: {category}
   **Date**: {publishedAt}

   **SEO**:
   - Focus keyword: {seo.focusKeyword}
   - Meta description: {seo.metaDescription} ({length} chars)
   - FAQ entries: {seo.faq.length or 0}

   **AEO**:
   - Excerpt: {excerpt} ({length} chars)
   - TL;DR: {tldr} ({word count} words)

   **Author**: {author}
   **Status**: {_internal.status}

   **Content preview**:
   {first 200 chars of body}...
   ```

3. **Recommend validation first:**
   - If `_internal.status` is `draft`, suggest:
     ```
     This post hasn't been validated yet.
     Consider running `/validate_blog {filepath}` first.
     ```

4. **Confirm before publishing:**
   - Use AskUserQuestion tool:
     - Question: "Ready to publish to BaseHub?"
     - Options: "Publish now", "Validate first", "Cancel"

5. **Execute publish:**
   - If user confirms "Publish now":
     ```bash
     cd apps/www && pnpm with-env pnpm tsx scripts/publish-blog.ts {absolute_filepath}
     ```
   - Parse the JSON output from stdout
   - Handle errors from stderr

6. **Report results:**

   **On success:**
   ```
   ## Published Successfully

   **Blog URL**: https://lightfast.ai/blog/{slug}
   **BaseHub Dashboard**: https://basehub.com/lightfastai/lightfast/main/blog

   The local file has been updated with `_internal.status: published`.

   Note: Post is created as draft in BaseHub. Publish from dashboard when ready to go live.
   ```

   **On failure:**
   ```
   ## Publish Failed

   **Error**: {error message}

   Common issues:
   - Category not found: Verify category slug matches BaseHub
   - Author not found: Verify author exists in BaseHub
   - Missing fields: Run /validate_blog to check
   ```

### If No File Path Provided

When invoked without arguments (`/publish_blog`), respond with:

```
Please provide the blog file to publish:

`/publish_blog thoughts/blog/{filename}.md`

**Available drafts:**
```

Then use Glob to find files in `thoughts/blog/*.md` and for each file:
- Read the frontmatter
- Check `_internal.status`
- List files where status is `draft`

Format:
```
- `{filename}` — {title} (category: {category}, status: {status})
```

## Error Handling

### File Not Found
```
File not found: {filepath}

Available files in thoughts/blog/:
{list of .md files}
```

### Already Published
```
This blog post has already been published.

Current status: published
Published at: {_internal.publishedAt}

If you need to update it, edit directly in BaseHub or create a new post.
```

### Missing Required Fields
```
Missing required field: {field}

Required fields:
- title, slug, publishedAt, category
- excerpt, tldr
- seo.metaDescription, seo.focusKeyword
- author

Please add the missing field and try again, or run /validate_blog first.
```

## Notes

- This command requires `BASEHUB_ADMIN_TOKEN` which is loaded via `pnpm with-env`
- The script creates posts as "draft" in BaseHub for final review
- Publish to live from BaseHub dashboard
- Author is hardcoded to "jeevanpillay" for now
- The frontmatter structure maps to `AIGeneratedPost` type
```

### Success Criteria:

#### Automated Verification:
- [x] Script exists at `apps/www/scripts/publish-blog.ts`
- [x] Script compiles with `pnpm tsx --check` (same patterns as publish-changelog.ts)
- [x] Command file exists at `.claude/commands/publish_blog.md`

#### Manual Verification:
- [ ] Script successfully creates post in BaseHub (test with draft)
- [ ] Category and author IDs resolve correctly
- [ ] Local file updated with published status

**Implementation Note**: After completing this phase, test with a real blog post before Phase 5.

---

## Phase 5: Directory Setup & Testing

### Overview
Create the draft storage directory and test the complete workflow.

### Changes Required:

#### 1. Create thoughts/blog directory

```bash
mkdir -p thoughts/blog
echo "# Blog Drafts\n\nBlog post drafts generated by /create_blog command.\n\nUse /validate_blog to check drafts.\nUse /publish_blog to publish to BaseHub." > thoughts/blog/README.md
```

#### 2. Add to .gitignore (if needed)

Check if `thoughts/blog/*.md` should be gitignored (drafts) or tracked.

### Success Criteria:

#### Automated Verification:
- [x] `thoughts/blog/` directory exists
- [x] README.md created

#### Manual Verification:
- [ ] Complete workflow test:
  1. `/create_blog technology "How vector search works"`
  2. Review generated draft
  3. `/validate_blog thoughts/blog/{file}.md`
  4. Fix any issues
  5. `/publish_blog thoughts/blog/{file}.md`
  6. Verify post appears in BaseHub

---

## Testing Strategy

### Unit Tests
- Frontmatter parsing validates all field types
- Category detection logic covers edge cases
- Word count calculation accurate

### Integration Tests
- `/create_blog` generates valid markdown
- `/validate_blog` catches known issues
- `/publish_blog` creates post in BaseHub (test environment)

### Manual Testing Steps
1. Create blog post for each category (technology, company, product)
2. Verify category styling matches TryProfound patterns
3. Validate AEO elements present and formatted correctly
4. Publish to BaseHub and verify rendering
5. Check structured data (JSON-LD) in page source

---

## Performance Considerations

- Research agent calls run in parallel where possible
- Category style guides loaded once per session
- BaseHub ID lookups cached after first resolution

---

## Migration Notes

- Existing `blog-brief-planner` and `blog-writer` agents remain unchanged
- New workflow is additive, not replacing existing agents
- Future: Consider consolidating agents with new skill

---

## References

- Research document: `thoughts/shared/research/2025-12-21-blog-workflow-design-tryprofound-analysis.md`
- Changelog workflow: `.claude/commands/create_changelog.md`
- Changelog skill: `.claude/skills/changelog-writer/SKILL.md`
- Blog mutation: `packages/cms-workflows/src/mutations/blog.ts`
- Blog frontend: `apps/www/src/app/(app)/(marketing)/(content)/blog/`
