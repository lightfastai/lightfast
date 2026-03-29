---
description: Validate blog posts against BlogPostSchema and AEO requirements
---

# Validate Blog

Validate blog `.mdx` files against all rules defined in the blog-writer skill.

## Initial Response

When invoked:

**If path provided** (e.g., `/validate_blog apps/www/src/content/blog/2025-12-21-how-vector-search-works.mdx`):
- Read the file immediately
- Begin validation workflow

**If no arguments**, respond with:
```
I'll help you validate a blog post. Please provide:

1. **File path**: `/validate_blog apps/www/src/content/blog/{filename}.mdx`
2. **Or select from available posts**: I'll list all files in apps/www/src/content/blog/
```

Then list available blog files using Glob on `apps/www/src/content/blog/*.mdx`.

## Step 1: Parse Blog Post

1. Read the file completely
2. Parse YAML frontmatter
3. Extract body content
4. Identify `category` from frontmatter
5. Load category checklist from `.agents/skills/blog-writer/resources/categories/{category}.md`

## Step 2: Frontmatter Validation

Check all required fields against `BlogPostSchema`:

| Field | Rule | Check |
|-------|------|-------|
| `title` | Required | Present and non-empty |
| `description` | 150-160 chars | Character count |
| `keywords` | Array, min 3 | Array length |
| `ogTitle` | Max 70 chars | Character count |
| `ogDescription` | 50-160 chars | Character count |
| `ogImage` | Valid URL | URL format |
| `authors` | Array, min 1 | Each has name/url/twitterHandle |
| `publishedAt` | ISO datetime | Valid format |
| `updatedAt` | ISO datetime | Valid format |
| `category` | Enum | One of: engineering \| product \| company \| tutorial \| research |
| `readingTimeMinutes` | Integer ≥ 1 | Number check |
| `featured` | Boolean | Boolean check |
| `tldr` | 20-300 chars | Character count |
| `faq` | Array, min 1 | Has question/answer pairs |

Report each field: ✓ (pass), ✗ (fail), ⚠ (warning)

## Step 3: Category-Specific Validation

### Engineering Posts (800-1,500 words)
- [ ] Code blocks present (>= 1)
- [ ] External citations: 5-10
- [ ] "Why we built" section or equivalent

### Company Posts (300-800 words)
- [ ] Quote present (blockquote)
- [ ] External citations: 3-5
- [ ] "Shift from/to" narrative

### Product Posts (500-1,000 words)
- [ ] Feature bullets present
- [ ] Use cases section
- [ ] Availability statement
- [ ] External citations: 3-5

### Tutorial Posts (1,000-2,000 words)
- [ ] Step-by-step structure
- [ ] Code examples with language tags
- [ ] Prerequisites listed
- [ ] External citations: 5+

### Research Posts (1,200-2,000 words)
- [ ] Methodology section
- [ ] External citations: 7-10

## Step 4: AEO Validation

1. **`tldr`**: 20-300 chars, in frontmatter (NOT a body section)
2. **`faq`**: min 1 question, each question min 10 chars, each answer min 20 chars
3. **`description`**: 150-160 chars, contains `keywords[0]`
4. **No `## TL;DR` in body**: verify tldr is only in frontmatter

## Step 5: Link Validation

### Internal Links
Extract `/docs/*` links and verify against `apps/www/src/content/`:
- `/docs/get-started/overview`
- `/docs/integrate/*`
- `/docs/connectors/*`
- `/docs/api-reference/*`

### External Links
Count external links (should be 3-10 depending on category).

## Step 6: Content Quality Checks

### Forbidden Patterns
- [ ] "Users are able to" (passive voice)
- [ ] "Coming soon" without conditional
- [ ] Emoji in body text
- [ ] `## TL;DR` heading in body

### Required Patterns (by category)
- Engineering: Code block with language tag
- Company: Blockquote (executive quote)
- Product: Bulleted feature list

## Step 7: Generate Validation Report

```markdown
## Blog Validation Report

**File**: `apps/www/src/content/blog/{filename}`
**Category**: {category}
**Validated**: {timestamp}

### Frontmatter Validation
✓ title: Present
✓ description: 158 chars (valid: 150-160)
✓ keywords: 4 entries
✓ category: engineering
✗ tldr: 15 chars (min 20)
✓ faq: 3 entries
✓ readingTimeMinutes: 6

### Category Validation (Engineering)
✓ Code blocks: 3 found
✗ External citations: 4 found (need 5-10)
✓ "Why we built" section present

### AEO Validation
✗ tldr too short: 15 chars (min 20)
✓ faq: 3 questions valid
✓ description contains keywords[0]
✓ No ## TL;DR in body

### Link Validation
✓ /docs/get-started/quickstart → EXISTS
✗ /docs/api/vector-search → NOT FOUND
  Suggestion: /docs/api-reference/getting-started/overview

### Content Quality
✓ No forbidden patterns detected
✓ Code blocks have language tags

### Summary
- **Passed**: 13/15 checks
- **Failed**: 2 checks

### Recommendations
1. Extend tldr to at least 20 chars
2. Add 1-2 more external citations
3. Fix link: /docs/api/vector-search → /docs/api-reference/getting-started/overview
```

## Error Handling

### File Not Found
```
Could not find blog file at: {path}

Available files in apps/www/src/content/blog/:
{list of .mdx files}
```

### Invalid Category
```
Unknown category: {category}

Valid categories: engineering, company, product, tutorial, research
```

## Notes

- Validation is advisory, not blocking
- All validation rules from `.agents/skills/blog-writer/resources/`
- `technology` is not a valid category — use `engineering`
