---
date: 2025-12-18T12:00:00+08:00
researcher: Claude
git_commit: cc16b40f
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Validate Changelog Command Research"
tags: [research, changelog, validation, commands]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: Validate Changelog Command

**Date**: 2025-12-18T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: cc16b40f
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Design a `/validate_changelog` command that validates changelog output files, checking:
- Body content is correct and verified
- All resource links are valid and exist in codebase
- Additional validation based on create_changelog.md requirements

## Summary

The validate_changelog command should perform comprehensive validation across 6 categories: frontmatter structure, SEO requirements, body content quality, resource link verification, fact-checked files existence, and style guidelines. The command should follow the pattern established by `validate_plan.md` with step-based organization and a structured validation report.

## Detailed Findings

### 1. Changelog File Structure

All changelogs live in `thoughts/changelog/` with filename pattern `{feature-slug}-{YYYYMMDD}-{HHMMSS}.md`.

**Current files (4 total):**
- `search-api-hybrid-retrieval-cross-encoder-20251217-143022.md`
- `entity-extraction-clusters-multiview-20251217-143500.md`
- `observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md`
- `typescript-sdk-mcp-server-20251217-154500.md`

### 2. Frontmatter Validation Requirements

**Required Fields** (from `.claude/skills/changelog-writer/resources/checklist.md:14-25`):

| Field | Validation Rule | Example |
|-------|-----------------|---------|
| `title` | 2-3 key features, clear and specific | "GitHub File Sync, Semantic Search" |
| `slug` | Format: `0-{version}-lightfast-{feature-slug}` | "0-1-lightfast-github-file-sync" |
| `publishedAt` | ISO 8601 date (YYYY-MM-DD) | "2025-12-17" |
| `excerpt` | Max 300 characters | Short summary for listings |
| `tldr` | 50-100 words | Self-contained summary for AI citation |
| `_internal.status` | `draft` or `published` | "draft" |
| `_internal.source_prs` | Non-empty array | ["#123", "manual: Feature X"] |

**SEO Fields** (from `.claude/skills/changelog-writer/resources/seo-requirements.md:99-107`):

| Field | Validation Rule |
|-------|-----------------|
| `seo.metaDescription` | 150-160 characters exactly, includes version + keyword |
| `seo.focusKeyword` | Required, single keyword phrase |
| `seo.secondaryKeyword` | Optional |
| `seo.faq` | Recommended 2-4 Q&A pairs |

### 3. Body Content Validation

From `.claude/skills/changelog-writer/resources/checklist.md:31-42`:

| Check | Validation |
|-------|------------|
| Internal links | 3+ links to docs pages |
| Code examples | At least 1 per major feature |
| Feature descriptions | 1-3 sentences per feature, not long paragraphs |
| Voice | "You can now..." not "Users are able to..." |
| Emojis | None allowed |
| Focus keyword | Must appear 2-3 times naturally in body |
| Why section | One "Why we built it this way" paragraph |

### 4. Resource Link Validation

**Docs directory structure** (`apps/docs/src/content/`):

```
docs/
├── index.mdx              → /docs
├── get-started/
│   ├── overview.mdx       → /docs/get-started/overview
│   ├── quickstart.mdx     → /docs/get-started/quickstart
│   └── config.mdx         → /docs/get-started/config
├── integrate/
│   ├── index.mdx          → /docs/integrate
│   ├── sdk.mdx            → /docs/integrate/sdk
│   └── mcp.mdx            → /docs/integrate/mcp
└── features/
    ├── index.mdx          → /docs/features
    ├── search.mdx         → /docs/features/search
    ├── memory.mdx         → /docs/features/memory
    └── ... (7 total)

api/ (→ /docs/api-reference/*)
├── overview.mdx           → /docs/api-reference/overview
├── authentication.mdx     → /docs/api-reference/authentication
├── search.mdx             → /docs/api-reference/search
└── ... (7 total)
```

**CRITICAL: Invalid Links in Example Changelog**

The example changelog (`observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md`) contains these links:
- `/docs/integrations/github` - **DOES NOT EXIST**
- `/docs/integrations/vercel` - **DOES NOT EXIST**
- `/docs/neural-memory` - **DOES NOT EXIST**
- `/docs/api-reference` - **EXISTS** (at `/docs/api-reference/overview`)

The validator should map changelog links to actual doc file paths:
- `/docs/X/Y` → `apps/docs/src/content/docs/X/Y.mdx` or `apps/docs/src/content/docs/X/Y/index.mdx`
- `/docs/api-reference/X` → `apps/docs/src/content/api/X.mdx`

### 5. Fact-Checked Files Validation

From `_internal.fact_checked_files` in changelogs:

**Format:**
```yaml
fact_checked_files:
  - 'path/to/file.ts:startLine-endLine'   # Specific line range
  - 'path/to/file.ts:lineNumber'          # Single line
  - 'path/to/file.ts'                     # Entire file
```

**Validation approach:**
1. Parse each entry to extract file path and optional line range
2. Check file exists at specified path (relative to repo root)
3. If line numbers specified, verify file has that many lines
4. Report missing files or invalid line references

### 6. Red Flags Detection

From `.claude/skills/changelog-writer/resources/checklist.md:44-57`:

| Red Flag | Detection |
|----------|-----------|
| "Coming soon: Linear, Notion" | Regex: `/coming soon/i` without conditional |
| Vague feature names | "GitHub Integration" without specifics |
| Missing meta description | `seo.metaDescription` undefined or >160 chars |
| No code examples | Count code blocks, must be ≥1 |
| tldr too short | Word count < 50 |
| excerpt = metaDescription | String comparison |
| focusKeyword missing from body | Search body for keyword |
| FAQ questions don't match search queries | "How do I...", "What is..." patterns |

### 7. Command Structure (following validate_plan.md pattern)

```markdown
---
description: Validate changelog output, verify content accuracy, check resource links
---

# Validate Changelog

## Initial Setup
- Parse changelog path (if provided) or list available changelogs
- Load and parse YAML frontmatter + markdown body

## Step 1: Frontmatter Validation
- Check all required fields present
- Validate field formats and constraints
- Character count checks (excerpt, metaDescription)
- Word count checks (tldr)

## Step 2: SEO Validation
- metaDescription length (150-160 chars)
- focusKeyword presence
- FAQ structure validation

## Step 3: Body Content Validation
- Count internal links (≥3)
- Count code examples (≥1 per major feature)
- Detect forbidden patterns (emoji, "Users are able to")
- Check focusKeyword appears in body

## Step 4: Resource Link Validation
- Extract all `/docs/*` links from body
- Map to expected file paths
- Check each file exists

## Step 5: Fact-Checked Files Validation
- Parse _internal.fact_checked_files
- Verify each file exists
- Validate line numbers if specified

## Step 6: Generate Validation Report
- Structured output with pass/fail for each check
- Summary statistics
- Specific errors with line references
- Recommendations for fixes
```

## Code References

- `.claude/commands/validate_plan.md` - Reference implementation pattern
- `.claude/commands/create_changelog.md` - Changelog creation requirements
- `.claude/skills/changelog-writer/resources/checklist.md` - Validation checklist
- `.claude/skills/changelog-writer/resources/seo-requirements.md` - SEO validation rules
- `.claude/skills/changelog-writer/resources/templates.md` - Frontmatter structure
- `apps/docs/src/content/docs/` - Documentation file structure for link validation
- `apps/docs/src/content/api/` - API docs file structure
- `thoughts/changelog/` - Changelog files directory

## Validation Report Template

```markdown
## Changelog Validation Report

**File**: `thoughts/changelog/{filename}`
**Generated**: {timestamp}

### Frontmatter Validation
✓ title: Present and valid
✓ slug: Matches format `0-X-lightfast-*`
✓ publishedAt: Valid ISO date
✗ excerpt: 342 characters (max 300)
✓ tldr: 67 words (valid range: 50-100)
...

### SEO Validation
✓ seo.metaDescription: 158 characters
✓ seo.focusKeyword: "observation pipeline"
✗ focusKeyword in body: Not found (should appear 2-3 times)
...

### Body Content
✓ Internal links: 4 found
✗ Code examples: 2 found (need 1 per major feature, 3 features)
✓ No emoji detected
✗ Forbidden pattern: "Users are able to" at line 45
...

### Resource Links
✗ /docs/integrations/github - FILE NOT FOUND
✗ /docs/integrations/vercel - FILE NOT FOUND
✗ /docs/neural-memory - FILE NOT FOUND
✓ /docs/api-reference - EXISTS

### Fact-Checked Files
✓ api/console/src/inngest/workflow/neural/observation-capture.ts:335-1165
✓ api/console/src/inngest/workflow/neural/classification.ts:1-176
...

### Summary
- **Passed**: 12/18 checks
- **Failed**: 6 checks
- **Warnings**: 2

### Recommendations
1. Shorten excerpt to under 300 characters
2. Add focusKeyword "observation pipeline" to body (2-3 times)
3. Update resource links to valid doc paths
4. Add code example for Semantic Classification feature
```

## Related Research

- No existing validate_changelog research found

## Open Questions

1. Should validation auto-fix simple issues (like character count)?
2. Should it integrate with the publish workflow (block publish if validation fails)?
3. Should it check for duplicate slugs across existing changelogs?
4. Should it validate that FAQ questions follow "How do I...", "What is..." patterns?
