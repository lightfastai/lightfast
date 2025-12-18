# Changelog SEO Frontmatter Enhancement

## Overview

Enhance the changelog draft frontmatter to include critical SEO and AEO (Answer Engine Optimization) fields that map directly to BaseHub CMS structure. This enables seamless transfer from draft files to CMS while ensuring all SEO optimization opportunities are captured during generation.

## Current State Analysis

**Current draft frontmatter** (from `thoughts/changelog/observation-pipeline-semantic-classification-20251217-165000.md`):
```yaml
---
title: "Feature Names Here"
slug: "url-slug"
description: "150-160 char SEO meta description"
date: "YYYY-MM-DD"
status: draft
source_prs: ["#123", "commit-hash"]
---
```

**BaseHub SEO fields NOT in current draft:**
- `seo.metaTitle` - Distinct from title (rarely needed)
- `seo.focusKeyword` - Primary SEO keyword
- `seo.secondaryKeyword` - Secondary keyword
- `seo.canonicalUrl` - Auto-generated from slug
- `seo.noIndex` - Default false
- `seo.faq[]` - FAQPage schema generation
- `excerpt` - Short summary for listings
- `tldr` - AI citation optimization, rendered on page

**Key Discovery**: `tldr` and `excerpt` are distinct from `description`:
- `description` → `seo.metaDescription` (150-160 chars, meta tag)
- `excerpt` → `excerpt` field (max 300 chars, listing pages)
- `tldr` → `tldr` field (50-100 words, rendered in highlighted box on page)

## Desired End State

**Enhanced frontmatter structure**:
```yaml
---
# Core fields (unchanged)
title: "Feature Names Here"
slug: "url-slug"
description: "150-160 char SEO meta description with keywords"
date: "YYYY-MM-DD"
status: draft
source_prs: ["#123", "commit-hash"]

# AEO Fields (Answer Engine Optimization)
excerpt: "Short summary for listings, max 300 characters. Distinct from description."
tldr: "50-100 word summary optimized for AI citation engines and featured snippets. This appears in a highlighted box at the top of the page."

# SEO Fields
focusKeyword: "primary-keyword-phrase"
secondaryKeyword: "secondary-keyword-phrase"  # Optional

# FAQ (generates FAQPage schema for Google featured snippets)
faq:
  - question: "What does [feature] do?"
    answer: "Clear, concise answer optimized for voice search and featured snippets."
  - question: "How do I configure [feature]?"
    answer: "Step-by-step answer with specific details."
---
```

**Verification**:
1. New drafts include all critical SEO fields
2. Field values transfer cleanly to BaseHub mutation
3. Generated pages render `tldr` in highlighted box
4. FAQPage JSON-LD schema generated when `faq[]` present
5. SEO checklist validates new fields

## What We're NOT Doing

- **NOT adding `featuredImage`** - Per requirements, omitted completely from drafts
- **NOT adding `metaTitle`** - Rarely differs from title, can be added ad-hoc in CMS
- **NOT adding `canonicalUrl`** - Auto-generated from slug in 99% of cases
- **NOT adding `noIndex`** - Default false, only needed for non-indexable content
- **NOT automating FAQ generation** - FAQ quality requires human oversight
- **NOT changing body content structure** - Only frontmatter changes

## Implementation Approach

The changes are confined to the changelog-writer skill files. No code changes required - only markdown template updates.

**Files to modify:**
1. `.claude/skills/changelog-writer/resources/templates.md` - Frontmatter template
2. `.claude/skills/changelog-writer/resources/seo-requirements.md` - Field definitions
3. `.claude/skills/changelog-writer/SKILL.md` - Workflow instructions
4. `.claude/commands/changelog.md` - Output format specification
5. `.claude/skills/changelog-writer/resources/checklist.md` - Validation rules

---

## Phase 1: Update Templates

### Overview
Update the frontmatter template in `templates.md` to include new SEO and AEO fields.

### Changes Required:

#### 1. templates.md Frontmatter Section
**File**: `.claude/skills/changelog-writer/resources/templates.md`
**Lines**: 3-9 (current frontmatter section)

**Current**:
```markdown
## BaseHub Entry Fields

- **Title**: 2-3 key features (e.g., "GitHub File Sync, Semantic Search, Team Workspaces")
- **Slug**: Version in URL format ("0-1", "1-2", etc.)
- **Body**: Main changelog content (markdown)
- **Description**: 150-160 char meta description with keywords
```

**Replace with**:
```markdown
## BaseHub Entry Fields

### Core Fields

- **Title**: 2-3 key features (e.g., "GitHub File Sync, Semantic Search, Team Workspaces")
- **Slug**: Version in URL format ("0-1", "1-2", etc.)
- **Body**: Main changelog content (markdown)
- **Description**: 150-160 char SEO meta description with version number and target keyword

### AEO Fields (Answer Engine Optimization)

- **Excerpt**: Short summary for listing pages (max 300 chars). Distinct from description - this appears on changelog index pages and RSS feeds.
- **TL;DR**: 50-100 word summary optimized for AI citation engines. This is rendered in a highlighted box at the top of the changelog page.

### SEO Fields

- **Focus Keyword**: Primary keyword phrase for SEO optimization (e.g., "webhook-driven sync", "semantic code search")
- **Secondary Keyword**: Optional secondary keyword phrase for additional optimization
- **FAQ**: Array of 2-4 question/answer pairs. Generates FAQPage schema for Google featured snippets. Questions should match what users would search for.

### Frontmatter Template

```yaml
---
# Core fields
title: "Feature Name, Feature Name, Feature Name"
slug: "version-slug"
description: "150-160 char meta description with version and keyword"
date: "YYYY-MM-DD"
status: draft
source_prs: ["#123", "commit-hash"]

# AEO Fields
excerpt: "Short summary for listings, max 300 chars"
tldr: "50-100 word summary for AI citation and featured snippets. Appears at top of page."

# SEO Fields
focusKeyword: "primary-keyword-phrase"
secondaryKeyword: "secondary-keyword-phrase"  # Optional

# FAQ (2-4 questions for FAQPage schema)
faq:
  - question: "What is [feature]?"
    answer: "Concise answer optimized for featured snippets and voice search."
  - question: "How do I [action]?"
    answer: "Step-by-step answer with specifics."
---
```
```

### Success Criteria:

#### Automated Verification:
- [x] File syntax is valid markdown: `cat .claude/skills/changelog-writer/resources/templates.md`
- [x] YAML template is valid: Parse frontmatter section

#### Manual Verification:
- [ ] Template structure is clear and easy to follow
- [ ] Field descriptions explain purpose and constraints
- [ ] Example values are realistic and helpful

---

## Phase 2: Update SEO Requirements

### Overview
Add detailed requirements for new fields in `seo-requirements.md`.

### Changes Required:

#### 1. Add Field Definitions
**File**: `.claude/skills/changelog-writer/resources/seo-requirements.md`
**Location**: After line 65 (structured data section)

**Add new section**:
```markdown
## Frontmatter Field Requirements

### Core Fields

| Field | Required | Constraints | Example |
|-------|----------|-------------|---------|
| `title` | Yes | 2-3 key features | "GitHub File Sync, Semantic Search, Team Workspaces" |
| `slug` | Yes | URL-safe version identifier | "0-1", "neural-memory-day-1" |
| `description` | Yes | 150-160 chars, includes version + keyword | See meta description section |
| `date` | Yes | ISO 8601 format | "2025-01-15" |
| `status` | Yes | `draft` or `published` | "draft" |
| `source_prs` | Yes | Array of PR numbers/commits | ["#123", "5acf9396"] |

### AEO Fields (Answer Engine Optimization)

| Field | Required | Constraints | Purpose |
|-------|----------|-------------|---------|
| `excerpt` | Yes | Max 300 chars | Listing pages, RSS feeds |
| `tldr` | Yes | 50-100 words | AI citation, page highlight box |

**Excerpt guidelines:**
- Different from description (which is for meta tags)
- Used on changelog index page and RSS feeds
- Can be slightly longer and more detailed than description
- Should entice readers to click through

**TL;DR guidelines:**
- Rendered in a highlighted box at the top of the page
- Optimized for AI citation engines (ChatGPT, Perplexity, etc.)
- Should be self-contained summary
- Use complete sentences, not bullet points
- Include the most important user benefits

### SEO Fields

| Field | Required | Constraints | Purpose |
|-------|----------|-------------|---------|
| `focusKeyword` | Yes | Single keyword phrase | Primary SEO target |
| `secondaryKeyword` | No | Single keyword phrase | Secondary SEO target |

**Focus keyword selection:**
- Choose from target keywords list (see above)
- Must appear naturally in description and body
- Should match what users would search for
- Examples: "webhook-driven sync", "semantic code search", "vector search"

### FAQ Field

| Field | Required | Constraints | Purpose |
|-------|----------|-------------|---------|
| `faq` | Recommended | 2-4 Q&A pairs | FAQPage schema for featured snippets |

**FAQ guidelines:**
- Questions should match real search queries
- Answers should be concise but complete (2-3 sentences)
- Include "How do I..." and "What is..." question types
- Answers optimized for voice search (conversational)
- Each answer should stand alone without context

**FAQ example:**
```yaml
faq:
  - question: "What is webhook-driven sync?"
    answer: "Webhook-driven sync automatically updates your knowledge base when you push code to GitHub. Instead of polling, Lightfast receives instant notifications, ensuring sub-minute latency for code updates."
  - question: "How do I set up GitHub integration?"
    answer: "Install the Lightfast GitHub App, select repositories to sync, and configure file patterns in lightfast.yml. Webhooks are automatically configured for instant updates."
```
```

#### 2. Update SEO Checklist
**Location**: Lines 67-74 (current checklist)

**Replace with**:
```markdown
## SEO Checklist

### Required Fields
- [ ] `description`: 150-160 chars, includes version + focus keyword
- [ ] `excerpt`: Max 300 chars, distinct from description
- [ ] `tldr`: 50-100 words, self-contained summary
- [ ] `focusKeyword`: Primary keyword phrase selected

### Content Requirements
- [ ] 3-5 internal links to docs
- [ ] At least 1 code example per major feature
- [ ] Focus keyword used naturally in body (2-3 times)
- [ ] One "Why we built it this way" paragraph
- [ ] Technical specifics (API names, config files, metrics)

### Optional but Recommended
- [ ] `secondaryKeyword`: Secondary keyword if applicable
- [ ] `faq`: 2-4 Q&A pairs for featured snippets
```

### Success Criteria:

#### Automated Verification:
- [x] File syntax is valid markdown

#### Manual Verification:
- [ ] Field requirements are clear
- [ ] Examples are realistic and helpful
- [ ] Checklist is actionable

---

## Phase 3: Update SKILL.md

### Overview
Update the core skill instructions to reference new frontmatter structure.

### Changes Required:

#### 1. Update Writing Guidelines
**File**: `.claude/skills/changelog-writer/SKILL.md`
**Lines**: 30-39 (writing guidelines section)

**Add after line 39**:
```markdown
9. **AEO-conscious**: Write `tldr` for AI citation engines, `excerpt` for listings
10. **FAQ quality**: Questions must match real search queries, answers must be complete
```

#### 2. Update Output Section
**Location**: Lines 66-68 (output section)

**Replace with**:
```markdown
## Output

Save drafts to: `thoughts/changelog/{title-slug}-{YYYYMMDD-HHMMSS}.md`

### Required Frontmatter Fields

Every draft MUST include:
- `title`, `slug`, `description`, `date`, `status`, `source_prs` (core)
- `excerpt`, `tldr` (AEO)
- `focusKeyword` (SEO)

Recommended:
- `secondaryKeyword`, `faq[]` (enhanced SEO)

See `resources/templates.md` for complete frontmatter template.
```

### Success Criteria:

#### Automated Verification:
- [x] File syntax is valid markdown

#### Manual Verification:
- [ ] Instructions are clear
- [ ] New fields are documented
- [ ] Relationship to templates.md is clear

---

## Phase 4: Update Command Output Format

### Overview
Update the changelog command to output drafts with new frontmatter structure.

### Changes Required:

#### 1. Update Output Template
**File**: `.claude/commands/changelog.md`
**Lines**: 160-190 (output template section)

**Replace output template with**:
```markdown
## Output Format

Save to: `thoughts/changelog/{title-slug}-{YYYYMMDD-HHMMSS}.md`

```yaml
---
# Core fields
title: "{2-3 key features}"
slug: "{version-slug}"
description: "{150-160 char meta description with version and focus keyword}"
date: "{YYYY-MM-DD}"
status: draft
source_prs: ["{PR numbers and commit hashes}"]

# AEO Fields
excerpt: "{Max 300 char summary for listings and RSS feeds}"
tldr: "{50-100 word summary for AI citation. Self-contained paragraph covering key user benefits.}"

# SEO Fields
focusKeyword: "{primary keyword phrase}"
secondaryKeyword: "{optional secondary keyword}"

# FAQ (2-4 Q&A pairs)
faq:
  - question: "{What is [feature]?}"
    answer: "{Concise answer for featured snippets}"
  - question: "{How do I [action]?}"
    answer: "{Step-by-step answer}"
---

# v{X.X} · {Month Day, Year}

**{2-3 key features as subtitle}**

---

{Generated content following skill templates}

---

## Metadata

- **Generated**: {ISO timestamp}
- **Source PRs**: {list}
- **Status**: Draft (pending review)
- **Focus Keyword**: {keyword used}
- **Fact-checked files**: {list}
```
```

### Success Criteria:

#### Automated Verification:
- [x] File syntax is valid markdown
- [x] YAML frontmatter template is valid

#### Manual Verification:
- [ ] Output format includes all required fields
- [ ] Example is clear and realistic
- [ ] Comments explain field purposes

---

## Phase 5: Update Checklist

### Overview
Update the validation checklist to include new field validation.

### Changes Required:

#### 1. Add Frontmatter Validation
**File**: `.claude/skills/changelog-writer/resources/checklist.md`
**Location**: After line 12 (fact check section)

**Add new section**:
```markdown
## 2. Frontmatter Validation (Required)

- [ ] `title`: 2-3 key features, clear and specific
- [ ] `slug`: URL-safe, matches version or feature theme
- [ ] `description`: 150-160 characters (count: ___)
- [ ] `date`: Valid ISO date format
- [ ] `status`: Set to `draft`
- [ ] `source_prs`: All source PRs/commits listed
- [ ] `excerpt`: Max 300 characters, distinct from description
- [ ] `tldr`: 50-100 words, self-contained summary
- [ ] `focusKeyword`: Selected from target keywords list

## 3. Optional SEO Fields

- [ ] `secondaryKeyword`: Relevant secondary keyword (if applicable)
- [ ] `faq`: 2-4 Q&A pairs with search-optimized questions
```

#### 2. Renumber Existing Sections
**Update section numbers**:
- "2. SEO Basics" → "4. SEO Content"
- "3. Style" → "5. Style"
- "4. Red Flags" → "6. Red Flags"

#### 3. Add Red Flags for New Fields
**Location**: Red Flags section

**Add**:
```markdown
- `tldr` is missing or too short (< 50 words)
- `excerpt` is identical to `description`
- `focusKeyword` not present in body text
- `faq` questions don't match real search queries
```

### Success Criteria:

#### Automated Verification:
- [x] File syntax is valid markdown

#### Manual Verification:
- [ ] Checklist covers all new fields
- [ ] Red flags catch common mistakes
- [ ] Validation is actionable

---

## Testing Strategy

### Unit Tests:
N/A - These are markdown documentation files

### Integration Tests:
1. Run `/changelog #340` (or similar PR) and verify output includes new frontmatter
2. Verify frontmatter YAML is valid and parseable
3. Verify field values meet constraints (char counts, etc.)

### Manual Testing Steps:
1. Generate a new changelog draft using `/changelog` command
2. Verify all required frontmatter fields are present
3. Verify `description` is 150-160 chars
4. Verify `excerpt` is max 300 chars
5. Verify `tldr` is 50-100 words
6. Verify `focusKeyword` appears in body text
7. If `faq` present, verify questions match search patterns
8. Transfer draft to BaseHub and verify all fields map correctly
9. Verify rendered page shows `tldr` in highlighted box
10. Verify JSON-LD includes FAQPage schema if `faq` present

---

## References

- Research document: `thoughts/shared/research/2025-12-17-changelog-seo-output-structure.md`
- Existing draft example: `thoughts/changelog/observation-pipeline-semantic-classification-20251217-165000.md`
- BaseHub CMS types: `vendor/cms/index.ts:380-456`
- Page metadata generation: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx:30-91`
- Mutation function: `packages/cms-workflows/src/mutations/changelog.ts:24-50`
