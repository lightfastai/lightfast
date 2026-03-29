# AEO Requirements

Every blog post MUST include these elements for Answer Engine Optimization.

## 1. TL;DR Field

**Purpose**: AI citation, featured snippets, quick scanning

**Location**: Frontmatter `tldr` field (rendered automatically as highlight box on page)

**Requirements**:
- 20-300 chars (self-contained)
- Covers key user benefits
- Can stand alone as quotable text
- No bullet points (use flowing prose)
- Do NOT add a `## TL;DR` section in the body — it's rendered from frontmatter automatically

**Example**:
> "Lightfast v0.4 introduces Neural Memory — automatic capture and semantic search across team knowledge from Slack, GitHub, Linear, and more. Teams can now trace decisions, find context, and search by meaning across all their tools."

## 2. FAQ Array

**Purpose**: FAQPage schema, featured snippets, voice search

**Location**: Frontmatter `faq[]` array (top-level, not nested under `seo`)

**Requirements**:
- Min 1 item (recommend 3-5)
- Questions match real search queries ("How do I...", "What is...")
- Answers are complete and self-contained (2-3 sentences)
- Each answer works without surrounding context

**Category-specific FAQ focus**:
| Category | FAQ Focus |
|----------|-----------|
| Engineering | Implementation, architecture, scaling |
| Company | Impact, timeline, vision |
| Product | Pricing, migration, compatibility |
| Tutorial | Steps, prerequisites, troubleshooting |
| Research | Methodology, findings, implications |

## 3. Meta Description

**Location**: Frontmatter `description` field (this IS the meta description — no nested `seo.metaDescription`)

**Requirements**:
- Exactly 150-160 characters
- Include primary keyword (keywords[0])
- Match actual content
- End with benefit or CTA

## 4. Keywords Array

**Location**: Frontmatter `keywords[]` (replaces old nested `seo.focusKeyword` + `seo.secondaryKeywords`)

- First entry = primary focus keyword
- Remaining entries = secondary keywords
- Min 3, max 20

## 5. Three-CTA Pattern

Blog posts should include contextual CTAs:

1. **Above the fold**: After opening paragraph (+18% opt-in rate)
2. **Mid-content**: Most relevant section (+32% conversions)
3. **End of post**: Strong close (45% of total conversions)

**CTA types**:
- `lead-magnet`: Download, template, checklist
- `signup`: Free trial, demo request
- `docs`: Documentation link

## 6. Internal Links

Link to 3-5 related docs:
- Feature docs: `/docs/get-started/overview`
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

Every post includes author info with E-E-A-T signals via the `authors[]` frontmatter array:
- `name`: Author display name
- `url`: Author profile URL
- `twitterHandle`: Twitter/X handle

Currently defaulting to: **Jeevan Pillay, Founder**

## AEO Checklist

### Required Fields
- [ ] `tldr`: 20-300 chars, self-contained summary in frontmatter
- [ ] `description`: 150-160 chars with primary keyword (IS the meta description)
- [ ] `keywords[]`: min 3 entries, first is primary keyword
- [ ] `faq[]`: min 1 Q&A pair in frontmatter

### Content Requirements
- [ ] 3-5 internal links to docs
- [ ] 5+ external citations
- [ ] Code examples (Engineering/Tutorial posts)
- [ ] Primary keyword used naturally (2-3 times in body)
- [ ] Author bio at end of post
