---
date: 2025-12-24T12:00:00+11:00
researcher: claude-opus-4-5
topic: "AEO/GEO Best Practices for SEO Skill Development"
tags: [research, web-analysis, aeo, geo, seo, ai-optimization]
status: complete
created_at: 2025-12-24
confidence: high
sources_count: 8
---

# Web Research: AEO/GEO Best Practices for SEO Skill Development

**Date**: 2025-12-24
**Topic**: Analyze TryProfound's AEO/GEO approach and synthesize best practices for a comprehensive SEO skill
**Confidence**: High - Based on official TryProfound documentation, guides, and blog analysis

## Research Question

How should we structure an SEO skill that encapsulates AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) best practices for apps/docs and apps/www pages?

## Executive Summary

TryProfound has established a comprehensive framework for optimizing content for AI answer engines. Their approach centers on five pillars: **Analyze, Create, Distribute, Measure, Iterate**. Key insights include prioritizing structured content (FAQPage schema over generic Article), answer-first architecture (40-60 word TL;DRs), and citation-worthy formatting (tables, lists, FAQ sections). The existing Lightfast blog-writer and changelog-writer skills already implement many of these patterns. A unified SEO skill should consolidate these practices while extending coverage to docs and landing pages.

## Key Metrics & Findings

### Aspect 1: Content Structure for AI Discoverability

**Finding**: AI engines heavily favor structured, scannable content with clear hierarchies
**Sources**: [TryProfound AEO Guide](https://www.tryprofound.com/guides/answer-engine-optimization-aeo-guide-for-marketers-2025), [GEO Guide](https://www.tryprofound.com/guides/generative-engine-optimization-geo-guide-2025)

| Element | Requirement | Purpose |
|---------|-------------|---------|
| TL;DR | 40-60 words (max 100) | AI citation, featured snippets |
| Answer-first | First 100-200 words | Direct answer placement |
| Question headings | H2/H3 as questions | Voice search, conversational queries |
| FAQ section | 3-5 Q&A pairs | FAQPage schema, featured snippets |
| Comparison tables | Columns with units/caveats | Easy extraction by LLMs |
| Bullet lists | Scannable key points | Quick parsing by AI crawlers |

**Analysis**: Lightfast already implements TL;DR sections and FAQ in blog posts. Docs and landing pages need similar treatment.

### Aspect 2: Schema Markup Priority

**Finding**: FAQPage schema is the highest-priority structured data for AEO
**Sources**: TryProfound AEO Content Score methodology

**Schema Priority Order**:
1. **FAQPage** - Highest priority for AI citation
2. **HowTo** - Step-by-step instructions
3. **Article/BlogPosting** - Standard content with dates, authors
4. **Organization** - Entity recognition
5. **Speakable** - Voice assistant optimization
6. **SoftwareSourceCode** - Technical documentation

**Current Lightfast Implementation**:
- Blog posts: BlogPosting + FAQPage + category-specific (HowTo for Data, SoftwareSourceCode for Technology)
- Docs: Not analyzed yet - potential gap
- Landing pages: Basic metadata only - needs schema enhancement

### Aspect 3: E-E-A-T Signals for AI Trust

**Finding**: Experience, Expertise, Authoritativeness, Trustworthiness signals directly impact AI citation likelihood

| Signal | Implementation | Impact |
|--------|----------------|--------|
| Author attribution | Visible bios with credentials | High |
| Publication dates | Published + modified dates | Medium |
| Methodology sections | "Why we built it this way" | High |
| External citations | 5+ authoritative sources | High |
| Statistics | One stat per 150-200 words | Medium |
| Expert quotes | Direct quotations | Medium |
| Version numbers | Content update tracking | Low |

### Aspect 4: URL Patterns & Internal Linking

**Finding**: Descriptive, keyword-rich URLs with topic clustering improve AI discoverability

**Recommended URL Patterns**:
```
/blog/{category}/{keyword-slug}                    # Blog posts
/docs/{feature}/{sub-topic}                        # Documentation
/guides/{topic}-guide-{year}                       # Guides
/changelog/{version}-{feature-slug}                # Changelogs
```

**Internal Linking Strategy**:
- 3-5 related docs per content piece
- Topic clusters (pillar page + supporting articles)
- Bidirectional linking for related Q&A content
- Descriptive anchor text (not "click here")

### Aspect 5: Meta Tag Requirements

**Finding**: Specific meta tag patterns optimize for both traditional search and AI engines

**Essential Meta Tags**:
```html
<title>Keyword-Rich Title | Brand Name</title>
<meta name="description" content="150-160 chars, answer to primary question">
<meta name="robots" content="max-image-preview:large, max-snippet:-1">
<meta property="article:published_time" content="ISO 8601">
<meta property="article:modified_time" content="ISO 8601">
```

**OpenGraph Requirements**:
- og:title, og:description, og:type, og:url, og:image
- og:type="article" for content pages
- Image: 1200x630px minimum

## Trade-off Analysis

### Scenario 1: Unified SEO Skill

| Factor | Impact | Notes |
|--------|--------|-------|
| Consistency | High | Single source of truth for all SEO patterns |
| Maintenance | Medium | One skill to update for all content types |
| Flexibility | Medium | May need page-type-specific overrides |
| Complexity | High | Must handle blog, docs, landing pages |

### Scenario 2: Page-Type-Specific Skills (Current State)

| Factor | Impact | Notes |
|--------|--------|-------|
| Consistency | Low | Patterns may diverge between blog/changelog |
| Maintenance | High | Multiple skills to keep aligned |
| Flexibility | High | Each skill optimized for its content type |
| Complexity | Low | Simpler per-skill scope |

### Recommendation: Hybrid Approach

Create a core `seo` skill with shared utilities and page-type-specific modules:
- `seo/core` - Shared metadata, schema, requirements
- `seo/blog` - Blog-specific patterns (references existing blog-writer AEO)
- `seo/docs` - Documentation patterns
- `seo/landing` - Landing page patterns

## Recommendations

Based on research findings:

1. **Create unified `seo` skill directory** with modular structure for different page types while sharing core utilities

2. **Extend schema implementation to docs/landing pages** - Current blog implementation is comprehensive; docs and landing pages need similar treatment

3. **Implement URL pattern guidelines** - Codify keyword-rich, descriptive URL patterns across all content

4. **Add AEO checklist validation** - Automated checks for TL;DR length, FAQ presence, schema completeness

5. **Track content freshness** - Add `modifiedDate` tracking for AI engine recency signals

## Detailed Findings

### TryProfound's 5-Step AEO Framework

1. **Analyze**: Identify AI citation landscape, competitor citations, hidden influencers
2. **Create**: Focus on structure, clarity, comparative content, precise language
3. **Distribute**: Get cited by trusted sources, leverage PR, optimize owned channels
4. **Measure**: Track Visibility Score, brand mentions, citation sources
5. **Iterate**: Double down on what works, continuously refine

### Content Types That Win AI Citations

| Content Type | Citability | Best For |
|--------------|------------|----------|
| Ultimate Guides | Very High | Comprehensive topic coverage |
| Product Comparisons | High | Decision-support content |
| How-To Guides | High | Step-by-step instructions |
| Listicles | Medium | Scannable recommendations |
| Data Reports | High | Original research, benchmarks |
| Case Studies | Medium | Social proof, real examples |

### AI Engine-Specific Optimization

| Engine | Priority Signal | Content Style |
|--------|-----------------|---------------|
| ChatGPT | Comprehensiveness | Encyclopedic, Wikipedia-style |
| Perplexity | Recency (90 days) | Fresh, community-vetted |
| Google AI | Organic ranking | E-E-A-T, structured data |
| Gemini | Entity clarity | Consistent terminology |

## Current Lightfast Implementation Analysis

### Strengths (Already Implemented)
- TL;DR sections in blog posts
- FAQ schema with dynamic generation
- Category-specific schema (HowTo, SoftwareSourceCode)
- Author attribution with E-E-A-T signals
- Canonical URLs and RSS feeds
- OpenGraph and Twitter meta tags

### Gaps (Need Implementation)
- Docs pages lack schema markup
- Landing pages have minimal structured data
- No URL pattern guidelines codified
- No automated AEO score/checklist
- No `modifiedDate` tracking
- No internal linking guidelines enforcement

## SEO Skill Structure Proposal

```
.claude/skills/seo/
├── SKILL.md                    # Main skill with unified approach
├── resources/
│   ├── core-requirements.md    # Shared SEO/AEO requirements
│   ├── schema-patterns.md      # JSON-LD templates
│   ├── url-guidelines.md       # URL structure patterns
│   ├── meta-templates.md       # Meta tag templates
│   ├── checklist.md            # Universal SEO checklist
│   └── page-types/
│       ├── blog.md             # Blog-specific (refs blog-writer)
│       ├── docs.md             # Documentation patterns
│       └── landing.md          # Landing page patterns
```

## Risk Assessment

### High Priority
- **Docs SEO gap**: Documentation pages lack structured data, reducing AI discoverability - **Mitigation**: Add schema generator for docs
- **Inconsistent URL patterns**: No codified standards - **Mitigation**: Create URL guidelines in SEO skill

### Medium Priority
- **Content freshness tracking**: No `modifiedDate` implementation - **Mitigation**: Add to CMS schema
- **Internal linking enforcement**: Manual process - **Mitigation**: Add checklist validation

## Open Questions

Areas that need further investigation:
- **Docs schema implementation**: How to add JSON-LD to Fumadocs-based docs?
- **Landing page schema**: What schema types work best for feature/pricing pages?
- **Automated validation**: Should we add CI checks for SEO requirements?

## Sources

### Official Documentation
- [TryProfound AEO Guide 2025](https://www.tryprofound.com/guides/answer-engine-optimization-aeo-guide-for-marketers-2025)
- [TryProfound GEO Guide 2025](https://www.tryprofound.com/guides/generative-engine-optimization-geo-guide-2025)

### TryProfound Blog & Tools
- [TryProfound Blog](https://www.tryprofound.com/blog) - Blog structure analysis
- [9 Best Answer Engine Optimization Platforms](https://www.tryprofound.com/blog/9-best-answer-engine-optimization-platforms)

### Current Lightfast Implementation
- `vendor/seo/metadata.ts` - Existing metadata generator
- `.claude/skills/blog-writer/resources/aeo-requirements.md` - Blog AEO patterns
- `.claude/skills/changelog-writer/resources/seo-requirements.md` - Changelog SEO patterns
- `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx` - Blog page implementation

---

**Last Updated**: 2025-12-24
**Confidence Level**: High - Based on official TryProfound documentation and existing Lightfast patterns
**Next Steps**: Create unified SEO skill with modular page-type support
