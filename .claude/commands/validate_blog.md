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

Report each field: checkmark (pass), X (fail), warning (warning)

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
   - `excerpt` != `seo.metaDescription` (must differ)

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
[checkmark] title: Present
[checkmark] slug: Valid kebab-case
[checkmark] publishedAt: Valid ISO date
[checkmark] category: technology
[X] tldr: 65 words (should be 80-100)
[checkmark] seo.metaDescription: 158 chars

### Category Validation (Technology)
[checkmark] Word count: 1,247 words (800-1,500)
[checkmark] Code blocks: 3 found
[X] External citations: 4 found (need 5-10)
[checkmark] "Why we built" section present

### AEO Validation
[X] TL;DR: Below minimum word count
[checkmark] FAQ: 4 questions (valid: 3-5)
[checkmark] Meta description: 158 chars with keyword
[checkmark] Excerpt differs from meta description

### Link Validation
[checkmark] /docs/get-started/quickstart -> EXISTS
[checkmark] /docs/features/search -> EXISTS
[X] /docs/api/vector-search -> NOT FOUND
  Suggestion: /docs/api-reference/search

### Content Quality
[checkmark] No forbidden patterns detected
[checkmark] Code blocks have language tags
[warning] Focus keyword appears 1 time (recommend 2-3)

### Summary
- **Passed**: 14/17 checks
- **Failed**: 3 checks
- **Warnings**: 1

### Recommendations
1. Expand TL;DR to 80-100 words
2. Add 1-2 more external citations
3. Fix link: /docs/api/vector-search -> /docs/api-reference/search
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
