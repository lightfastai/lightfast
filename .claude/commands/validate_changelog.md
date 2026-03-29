---
description: Validate changelog entries against ChangelogEntrySchema, check resource links
---

# Validate Changelog

Validate changelog `.mdx` files against all rules defined in the changelog-writer skill.

## Initial Response

When invoked:

**If path provided** (e.g., `/validate_changelog apps/www/src/content/changelog/2025-01-15-github-file-sync.mdx`):
- Read the file immediately
- Begin validation workflow

**If no arguments**, respond with:
```
I'll help you validate a changelog. Please provide:

1. **File path**: `/validate_changelog apps/www/src/content/changelog/{filename}.mdx`
2. **Or select from available entries**: I'll list all files in apps/www/src/content/changelog/
```

Then list available changelog files using Glob on `apps/www/src/content/changelog/*.mdx`.

## Step 1: Parse Changelog

1. Read the file completely
2. Parse YAML frontmatter
3. Extract body content
4. Store both for validation

## Step 2: Frontmatter Validation

Check all required fields against `ChangelogEntrySchema`:

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
| `version` | Required | Present and non-empty |
| `type` | Enum | One of: feature \| improvement \| fix \| breaking |
| `tldr` | 20-300 chars | Character count |
| `faq` | Array, min 1 | Has question/answer pairs |

Report each field: ✓ (pass), ✗ (fail), ⚠ (warning)

## Step 3: SEO Validation

1. `description` length: 150-160 chars
2. `keywords[0]` present in body (count occurrences, expect 2-3)
3. `faq` structure valid: questions min 10 chars, answers min 20 chars

## Step 4: Body Content Validation

Parse markdown body and check:

1. **Internal links**: Count `/docs/*` links (recommend >= 3)
2. **Code examples**: Count code blocks (recommend >= 1 per major feature)
3. **Forbidden patterns**:
   - "Users are able to" (passive voice)
   - "Coming soon" without conditional
4. **Primary keyword**: Verify `keywords[0]` appears 2-3 times naturally
5. **Why section**: Check for "Why we built it this way" heading

## Step 5: Resource Link Validation

Map `/docs/*` links to actual file paths and verify existence.

### Link Mapping Rules

| Link Pattern | File Location |
|--------------|---------------|
| `/docs/X` | `apps/www/src/content/docs/X.mdx` or `X/index.mdx` |
| `/docs/X/Y` | `apps/www/src/content/docs/X/Y.mdx` |
| `/docs/api-reference/X` | `apps/www/src/content/api/X.mdx` |

### Valid Documentation Paths

**Get Started:**
- `/docs/get-started/overview`
- `/docs/get-started/quickstart`

**Integrate:**
- `/docs/integrate/sdk`
- `/docs/integrate/mcp`

**Connectors:**
- `/docs/connectors/github`
- `/docs/connectors/linear`
- `/docs/connectors/sentry`
- `/docs/connectors/vercel`

**API Reference:**
- `/docs/api-reference/getting-started/overview`
- `/docs/api-reference/getting-started/authentication`
- `/docs/api-reference/getting-started/errors`
- `/docs/api-reference/sdks-tools/typescript-sdk`
- `/docs/api-reference/sdks-tools/mcp-server`

### Validation Process

1. Extract all links matching `/docs/*` from body
2. For each link: map to file path and check existence with Glob
3. Report missing files with closest valid suggestion

## Step 6: Generate Validation Report

```markdown
## Changelog Validation Report

**File**: `apps/www/src/content/changelog/{filename}`
**Validated**: {timestamp}

### Frontmatter Validation
✓ title: Present
✓ description: 158 chars (valid: 150-160)
✓ keywords: 4 entries
✓ version: "v0.1.0"
✓ type: "feature"
✗ tldr: 18 chars (min 20)
✓ faq: 2 entries

### SEO Validation
✓ keywords[0] in body: found 3 times
✓ faq structure valid

### Body Content
✓ Internal links: 4 found
✓ Code examples: 2 found
✓ No forbidden patterns

### Resource Links
✓ /docs/get-started/quickstart → EXISTS
✗ /docs/integrations/github → NOT FOUND
  Suggestion: /docs/connectors/github

### Summary
- **Passed**: 15/16 checks
- **Failed**: 1 check

### Recommendations
1. Extend tldr to at least 20 chars
2. Fix link: /docs/integrations/github → /docs/connectors/github
```

## Error Handling

### File Not Found
```
Could not find changelog file at: {path}

Available changelogs in apps/www/src/content/changelog/:
- {list files}
```

### Parse Error
```
Failed to parse frontmatter. Please check YAML syntax.
Error: {error message}
```

## Notes

- Validation is advisory, not blocking
- All validation rules sourced from `.agents/skills/changelog-writer/resources/`
- The docs structure may change; verify against actual files if suggestions seem wrong
