---
description: Validate changelog output, verify content accuracy, check resource links
---

# Validate Changelog

Validate changelog draft files against all rules defined in the changelog-writer skill.

## Initial Response

When invoked:

**If path provided** (e.g., `/validate_changelog thoughts/changelog/my-changelog.md`):
- Read the file immediately
- Begin validation workflow

**If no arguments**, respond with:
```
I'll help you validate a changelog. Please provide:

1. **File path**: `/validate_changelog thoughts/changelog/{filename}.md`
2. **Or select from available drafts**: I'll list all files in `thoughts/changelog/`

I'll validate against all checklist requirements and report any issues.
```

Then list available changelog files using: `ls thoughts/changelog/`

## Step 1: Parse Changelog

1. Read the changelog file completely
2. Parse YAML frontmatter (everything between the first `---` markers)
3. Extract body content (everything after the second `---`)
4. Store both for validation

## Step 2: Frontmatter Validation

Check all required fields:

| Field | Rule | Check |
|-------|------|-------|
| `title` | Required, 2-3 key features | Present and descriptive |
| `slug` | Format: `0-{version}-lightfast-{feature-slug}` | Regex: `^0-\d+-lightfast-` |
| `publishedAt` | ISO 8601 date | Valid date format (YYYY-MM-DD) |
| `excerpt` | Max 300 characters | Character count |
| `tldr` | 50-100 words | Word count |
| `seo.metaDescription` | 150-160 characters | Character count |
| `seo.focusKeyword` | Required | Present |
| `_internal.status` | `draft` or `published` | Value check |
| `_internal.source_prs` | Non-empty array | Array length |

Report each field: ✓ (pass), ✗ (fail), ⚠ (warning)

## Step 3: SEO Validation

Check SEO requirements:

1. `metaDescription` length: 150-160 chars (warn if <150 or >160)
2. `focusKeyword` present in body (count occurrences, expect 2-3)
3. `excerpt` ≠ `metaDescription` (must be different)
4. `faq` structure valid (if present):
   - 2-4 Q&A pairs
   - Questions use "How do I..." or "What is..." patterns
   - Answers are 2-3 sentences

## Step 4: Body Content Validation

Parse markdown body and check:

1. **Internal links**: Count `/docs/*` links (require >= 3)
2. **Code examples**: Count code blocks (require >= 1 per major feature)
3. **Forbidden patterns**:
   - "Users are able to" (passive voice)
   - "Coming soon" without conditional (should use "when N+ customers request")
4. **Focus keyword**: Verify appears 2-3 times naturally
5. **Why section**: Check for "Why we built it this way" or "Why We Built It This Way" heading

## Step 5: Resource Link Validation

**CRITICAL**: Map `/docs/*` links to actual file paths and verify existence.

### Link Mapping Rules

The docs use Fumadocs with this structure:
- `apps/docs/src/content/docs/` - Main docs
- `apps/docs/src/content/api/` - API reference (mapped to `/docs/api-reference/`)

| Link Pattern | File Location |
|--------------|---------------|
| `/docs` | `apps/docs/src/content/docs/index.mdx` |
| `/docs/X` | `apps/docs/src/content/docs/X.mdx` OR `apps/docs/src/content/docs/X/index.mdx` |
| `/docs/X/Y` | `apps/docs/src/content/docs/X/Y.mdx` |
| `/docs/api-reference` | `apps/docs/src/content/api/overview.mdx` |
| `/docs/api-reference/X` | `apps/docs/src/content/api/X.mdx` |

### Current Valid Documentation Paths

Based on actual docs structure (21 .mdx files):

**Features:**
- `/docs/features` → features/index.mdx
- `/docs/features/search` → features/search.mdx
- `/docs/features/citations` → features/citations.mdx
- `/docs/features/relationships` → features/relationships.mdx
- `/docs/features/security` → features/security.mdx
- `/docs/features/memory` → features/memory.mdx
- `/docs/features/quality` → features/quality.mdx

**Get Started:**
- `/docs/get-started/overview` → get-started/overview.mdx
- `/docs/get-started/quickstart` → get-started/quickstart.mdx
- `/docs/get-started/config` → get-started/config.mdx

**Integrate:**
- `/docs/integrate` → integrate/index.mdx
- `/docs/integrate/sdk` → integrate/sdk.mdx
- `/docs/integrate/mcp` → integrate/mcp.mdx

**API Reference:**
- `/docs/api-reference` → api/overview.mdx
- `/docs/api-reference/authentication` → api/authentication.mdx
- `/docs/api-reference/sdks` → api/sdks.mdx
- `/docs/api-reference/search` → api/search.mdx
- `/docs/api-reference/findsimilar` → api/findsimilar.mdx
- `/docs/api-reference/contents` → api/contents.mdx
- `/docs/api-reference/errors` → api/errors.mdx

### Validation Process

1. Extract all links matching `/docs/*` pattern from body using regex: `\[([^\]]+)\]\((/docs[^)]+)\)`
2. For each link:
   a. Map to expected file path using rules above
   b. Check if file exists using Glob
   c. If not found, check alternate paths (index.mdx)
   d. Report result

### Suggest Corrections

If a link is invalid, suggest the closest valid path:
- `/docs/integrations/github` → Suggest `/docs/integrate` (no integrations directory exists)
- `/docs/integrations/vercel` → Suggest `/docs/integrate` (no integrations directory exists)
- `/docs/neural-memory` → Suggest `/docs/features/memory` (partial match)

## Step 6: Fact-Checked Files Validation

Parse `_internal.fact_checked_files` array and verify each entry:

```yaml
# Format examples:
- 'path/to/file.ts:startLine-endLine'   # Specific line range
- 'path/to/file.ts:lineNumber'          # Single line
- 'path/to/file.ts'                     # Entire file
```

For each entry:
1. Parse file path and optional line numbers
2. Check file exists (relative to repo root)
3. If line numbers specified, note them for reference (don't validate line counts as files change)
4. Report missing files

## Step 7: Red Flags Detection

Check for automatic rejection criteria:

| Red Flag | Detection |
|----------|-----------|
| "Coming soon: X, Y" | Regex: `/coming soon[:\s]+\w+/i` without conditional |
| Vague feature names | "GitHub Integration" without specifics (should be "GitHub File Sync") |
| Missing meta description | `seo.metaDescription` undefined or empty |
| No code examples | Code block count = 0 |
| tldr too short | Word count < 50 |
| excerpt = metaDescription | String equality check |
| focusKeyword missing from body | Keyword not found in body text |

## Step 8: Generate Validation Report

Output structured report:

```markdown
## Changelog Validation Report

**File**: `thoughts/changelog/{filename}`
**Validated**: {timestamp}

### Frontmatter Validation
✓ title: Present and valid
✓ slug: Matches format `0-X-lightfast-*`
✓ publishedAt: Valid ISO date
✗ excerpt: 342 characters (max 300)
✓ tldr: 67 words (valid range: 50-100)

### SEO Validation
✓ seo.metaDescription: 158 characters (valid: 150-160)
✓ seo.focusKeyword: "observation pipeline"
✗ focusKeyword in body: Found 1 time (should be 2-3)

### Body Content
✓ Internal links: 4 found (min: 3)
✓ Code examples: 3 found
✓ No forbidden patterns detected
✓ "Why we built it this way" section present

### Resource Links
✗ /docs/integrations/github → FILE NOT FOUND
  Suggestion: /docs/integrate (closest match)
✗ /docs/integrations/vercel → FILE NOT FOUND
  Suggestion: /docs/integrate (closest match)
✗ /docs/neural-memory → FILE NOT FOUND
  Suggestion: /docs/features/memory (partial match)
✓ /docs/api-reference → EXISTS (api/overview.mdx)

### Fact-Checked Files
✓ api/console/src/inngest/workflow/neural/observation-capture.ts:335-1165
✓ api/console/src/inngest/workflow/neural/classification.ts:1-176
...

### Red Flags
⚠ None detected

### Summary
- **Passed**: 14/18 checks
- **Failed**: 4 checks
- **Warnings**: 0

### Recommendations
1. Shorten excerpt to under 300 characters
2. Add focusKeyword "observation pipeline" to body (2-3 times)
3. Fix resource links:
   - Replace `/docs/integrations/github` with valid docs path
   - Replace `/docs/integrations/vercel` with valid docs path
   - Replace `/docs/neural-memory` with `/docs/features/memory`
```

## Error Handling

### File Not Found
```
Could not find changelog file at: {path}

Available changelogs in thoughts/changelog/:
- {list files}
```

### Parse Error
```
Failed to parse changelog frontmatter. Please check YAML syntax.
Error: {error message}
```

## Important Notes

- Validation is advisory, not blocking
- Use this before `/publish_changelog` to catch issues
- All validation rules sourced from `.claude/skills/changelog-writer/resources/`
- Run validation after editing to verify fixes
- The docs structure may change; verify against actual files if suggestions seem wrong
