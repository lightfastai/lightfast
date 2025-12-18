# Validate Changelog Command Implementation Plan

## Overview

Create a `/validate_changelog` command that comprehensively validates changelog draft files against all rules defined in the changelog-writer skill resources. Additionally, enhance `/create_changelog` to validate resource links during generation to prevent invalid links from being written in the first place.

## Current State Analysis

### Existing Infrastructure

- **Changelog drafts**: Stored in `thoughts/changelog/` with pattern `{title-slug}-{YYYYMMDD-HHMMSS}.md`
- **Skill resources**: Validation rules defined across 4 resource files in `.claude/skills/changelog-writer/resources/`
- **Validation pattern**: Established by `.claude/commands/validate_plan.md` with step-based organization
- **Publish script**: `apps/www/scripts/publish-changelog.ts` performs basic validation before publishing

### Problem: Invalid Resource Links

The example changelog `observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md` contains these invalid links:
- `/docs/integrations/github` - **FILE NOT FOUND**
- `/docs/integrations/vercel` - **FILE NOT FOUND**
- `/docs/neural-memory` - **FILE NOT FOUND**

**Actual docs structure** (21 .mdx files):
```
apps/docs/src/content/
├── docs/
│   ├── index.mdx              → /docs
│   ├── features/              → /docs/features/*
│   │   ├── index.mdx
│   │   ├── search.mdx
│   │   ├── citations.mdx
│   │   ├── relationships.mdx
│   │   ├── security.mdx
│   │   ├── memory.mdx
│   │   └── quality.mdx
│   ├── get-started/           → /docs/get-started/*
│   │   ├── overview.mdx
│   │   ├── quickstart.mdx
│   │   └── config.mdx
│   └── integrate/             → /docs/integrate/*
│       ├── index.mdx
│       ├── sdk.mdx
│       └── mcp.mdx
└── api/                       → /docs/api-reference/*
    ├── overview.mdx
    ├── authentication.mdx
    ├── sdks.mdx
    ├── search.mdx
    ├── findsimilar.mdx
    ├── contents.mdx
    └── errors.mdx
```

### Key Discoveries

1. **No `/docs/integrations/` directory exists** - Links should use `/docs/integrate/` instead
2. **API docs use different path mapping**: `/docs/api-reference/X` maps to `api/X.mdx`
3. **Research document already exists**: `thoughts/shared/research/2025-12-18-validate-changelog-command.md` with comprehensive validation rules
4. **6 validation categories identified**: frontmatter, SEO, body content, resource links, fact-checked files, red flags

## Desired End State

### After Implementation:

1. **`/validate_changelog` command** exists at `.claude/commands/validate_changelog.md`
2. Running `/validate_changelog [path]` produces a structured validation report with:
   - Pass/fail status for all 6 validation categories
   - Specific errors with line references
   - Recommendations for fixes
3. **`/create_changelog` enhanced** to validate resource links during generation:
   - Warns about invalid links before saving
   - Suggests correct paths based on actual docs structure
4. **All existing changelogs** can be validated retroactively

### Verification:

1. Run `/validate_changelog thoughts/changelog/observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md`
2. Report should show 3 failed resource links with suggestions
3. Run `/create_changelog` and verify link validation occurs before draft is saved

## What We're NOT Doing

- Auto-fixing issues (just reporting)
- Blocking publish workflow (validation is advisory)
- Checking duplicate slugs (handled by publish script)
- Validating against BaseHub (that's publish-time validation)
- Creating a programmatic validation script (this is a Claude command)

## Implementation Approach

Create the command file following the `validate_plan.md` pattern with step-based validation, parallel research for complex checks, and structured markdown output. The link validation logic will be documented inline and also added to `create_changelog.md` for generation-time validation.

---

## Phase 1: Create validate_changelog.md Command

### Overview

Create the main command file with comprehensive validation logic for all 6 categories.

### Changes Required:

#### 1. Create Command File

**File**: `.claude/commands/validate_changelog.md`

**Content Structure**:

```markdown
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
\```
I'll help you validate a changelog. Please provide:

1. **File path**: `/validate_changelog thoughts/changelog/{filename}.md`
2. **Or select from available drafts**: I'll list all files in `thoughts/changelog/`

I'll validate against all checklist requirements and report any issues.
\```

Then list available changelog files using: `ls thoughts/changelog/`

## Step 1: Parse Changelog

1. Read the changelog file completely
2. Parse YAML frontmatter with gray-matter pattern
3. Extract body content (everything after `---`)
4. Store for validation

## Step 2: Frontmatter Validation

Check all required fields:

| Field | Rule | Check |
|-------|------|-------|
| `title` | Required, 2-3 key features | Present and descriptive |
| `slug` | Format: `0-{version}-lightfast-{feature-slug}` | Regex match |
| `publishedAt` | ISO 8601 date | Valid date format |
| `excerpt` | Max 300 characters | Character count |
| `tldr` | 50-100 words | Word count |
| `seo.metaDescription` | 150-160 characters | Character count |
| `seo.focusKeyword` | Required | Present |
| `_internal.status` | `draft` or `published` | Value check |
| `_internal.source_prs` | Non-empty array | Array length |

Report each field: ✓ (pass), ✗ (fail), ⚠️ (warning)

## Step 3: SEO Validation

Check SEO requirements:

1. `metaDescription` length: 150-160 chars
2. `focusKeyword` present in body (count occurrences, expect 2-3)
3. `excerpt` ≠ `metaDescription` (must be different)
4. `faq` structure valid (if present):
   - 2-4 Q&A pairs
   - Questions use "How do I..." or "What is..." patterns
   - Answers are 2-3 sentences

## Step 4: Body Content Validation

Parse markdown body and check:

1. **Internal links**: Count `/docs/*` links (require ≥3)
2. **Code examples**: Count code blocks (require ≥1 per major feature)
3. **Forbidden patterns**:
   - Emoji (regex: `/[\u{1F600}-\u{1F6FF}]/u`)
   - "Users are able to" (passive voice)
   - "Coming soon" without conditional
4. **Focus keyword**: Verify appears 2-3 times naturally
5. **Why section**: Check for "Why we built it this way" heading

## Step 5: Resource Link Validation

**CRITICAL**: Map `/docs/*` links to actual file paths and verify existence.

### Link Mapping Rules:

```
/docs                    → apps/docs/src/content/docs/index.mdx
/docs/X                  → apps/docs/src/content/docs/X.mdx OR
                           apps/docs/src/content/docs/X/index.mdx
/docs/X/Y                → apps/docs/src/content/docs/X/Y.mdx
/docs/api-reference      → apps/docs/src/content/api/overview.mdx
/docs/api-reference/X    → apps/docs/src/content/api/X.mdx
```

### Validation Process:

1. Extract all links matching `/docs/*` pattern from body
2. For each link:
   a. Map to expected file path using rules above
   b. Check if file exists using Glob
   c. If not found, check alternate paths (index.mdx)
   d. Report result

### Suggest Corrections:

If a link is invalid, search for similar paths:
- `/docs/integrations/github` → Suggest `/docs/integrate` (closest match)
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
3. If line numbers specified, verify file has that many lines
4. Report missing files or invalid line references

## Step 7: Red Flags Detection

Check for automatic rejection criteria:

| Red Flag | Detection |
|----------|-----------|
| "Coming soon: X, Y" | Regex without conditional |
| Vague feature names | "GitHub Integration" without specifics |
| Missing meta description | `seo.metaDescription` undefined/empty |
| No code examples | Code block count = 0 |
| tldr too short | Word count < 50 |
| excerpt = metaDescription | String equality |
| focusKeyword missing from body | Keyword not found |

## Step 8: Generate Validation Report

Output structured report:

\```markdown
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
✓ seo.metaDescription: 158 characters
✓ seo.focusKeyword: "observation pipeline"
✗ focusKeyword in body: Found 1 time (should be 2-3)

### Body Content
✓ Internal links: 4 found (min: 3)
✓ Code examples: 3 found
✓ No emoji detected
✓ Active voice used

### Resource Links
✗ /docs/integrations/github → FILE NOT FOUND
  Suggestion: /docs/integrate (similar path exists)
✗ /docs/integrations/vercel → FILE NOT FOUND
  Suggestion: /docs/integrate (similar path exists)
✗ /docs/neural-memory → FILE NOT FOUND
  Suggestion: /docs/features/memory (similar match)
✓ /docs/api-reference → EXISTS (api/overview.mdx)

### Fact-Checked Files
✓ api/console/src/inngest/workflow/neural/observation-capture.ts:335-1165
✓ api/console/src/inngest/workflow/neural/classification.ts:1-176
...

### Red Flags
⚠️ None detected

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
\```

## Error Handling

### File Not Found
\```
Could not find changelog file at: {path}

Available changelogs in thoughts/changelog/:
- {list files}
\```

### Parse Error
\```
Failed to parse changelog frontmatter. Please check YAML syntax.
Error: {error message}
\```

## Important Notes

- Validation is advisory, not blocking
- Use this before `/publish_changelog` to catch issues
- All validation rules sourced from `.claude/skills/changelog-writer/resources/`
- Run validation after editing to verify fixes
```

### Success Criteria:

#### Automated Verification:
- [x] Command file exists: `ls .claude/commands/validate_changelog.md`
- [x] Command appears in Claude Code command list

#### Manual Verification:
- [ ] Running `/validate_changelog thoughts/changelog/observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md` produces expected report
- [ ] Invalid links are detected with suggestions
- [ ] All 6 validation categories are checked

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Enhance create_changelog.md with Link Validation

### Overview

Add link validation step to create_changelog to prevent invalid links from being written.

### Changes Required:

#### 1. Update create_changelog.md

**File**: `.claude/commands/create_changelog.md`

**Changes**: Add Step 6.5 (between categorizing and generating) for link validation

```markdown
## Step 6.5: Validate Resource Links

Before generating the changelog, validate that all internal links point to existing documentation.

### Available Documentation Paths

Query the actual docs structure:
\```bash
find apps/docs/src/content -name "*.mdx" -type f
\```

### Link Resolution Rules

| Link Pattern | File Location |
|--------------|---------------|
| `/docs` | `apps/docs/src/content/docs/index.mdx` |
| `/docs/X` | `apps/docs/src/content/docs/X.mdx` or `docs/X/index.mdx` |
| `/docs/X/Y` | `apps/docs/src/content/docs/X/Y.mdx` |
| `/docs/api-reference` | `apps/docs/src/content/api/overview.mdx` |
| `/docs/api-reference/X` | `apps/docs/src/content/api/X.mdx` |

### Valid Documentation Links (Current)

Based on actual docs structure, these are the ONLY valid internal links:

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

### Validation Behavior

1. After fact-checking, before writing the changelog, validate all `/docs/*` links
2. If invalid links found:
   - Warn user which links are invalid
   - Suggest alternatives from the valid list above
   - Ask user to confirm whether to:
     a. Remove the invalid links
     b. Replace with suggested alternatives
     c. Keep invalid links (will fail validation later)
3. Update the changelog content with corrected links before saving

**CRITICAL**: Never write a changelog with links to non-existent pages without user acknowledgment.
```

#### 2. Add Warning in Step 9 (Present Results)

Add to the results summary:

```markdown
### Link Validation
- {N} internal links verified
- {N} links corrected during generation
- All links point to existing documentation ✓
```

### Success Criteria:

#### Automated Verification:
- [ ] Updated command file saved: `ls .claude/commands/create_changelog.md`
- [ ] File contains "Step 6.5: Validate Resource Links" section

#### Manual Verification:
- [ ] Running `/create_changelog "Test feature"` shows link validation step
- [ ] Invalid links trigger warning and correction flow
- [ ] Generated changelog contains only valid links

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests (Manual Validation):

1. **Frontmatter validation**:
   - Missing required field → ✗ reported
   - Incorrect slug format → ✗ reported
   - Character count violations → ✗ reported

2. **Link validation**:
   - Valid link `/docs/features/search` → ✓
   - Invalid link `/docs/integrations/github` → ✗ with suggestion
   - Partial match `/docs/neural-memory` → ✗ suggests `/docs/features/memory`

3. **Red flag detection**:
   - "Coming soon: X" → Detected
   - No code examples → Detected
   - Missing focusKeyword → Detected

### Integration Tests:

1. Run `/validate_changelog` on each existing changelog in `thoughts/changelog/`
2. Verify all expected issues are caught
3. Run `/create_changelog` and intentionally try to add invalid link

### Test Files:

Use `thoughts/changelog/observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md` as primary test case - it has known invalid links.

## Performance Considerations

- Link validation uses Glob which is fast
- No external API calls required
- All validation runs locally against filesystem

## References

- Research: `thoughts/shared/research/2025-12-18-validate-changelog-command.md`
- Validation pattern: `.claude/commands/validate_plan.md`
- Skill resources: `.claude/skills/changelog-writer/resources/`
- Publish script: `apps/www/scripts/publish-changelog.ts`
