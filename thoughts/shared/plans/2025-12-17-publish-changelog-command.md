# Publish Changelog Command Implementation Plan

## Overview

Implement a `/publish_changelog` command that publishes changelog drafts from `thoughts/changelog/` to BaseHub CMS. This requires first restructuring the changelog skill output to match the `ChangelogEntryInput` type directly, eliminating field mapping complexity.

## Current State Analysis

### Existing Infrastructure
- `createChangelogEntry()` at `packages/cms-workflows/src/mutations/changelog.ts:114-175`
- `getEntryBySlug()` at `vendor/cms/index.ts:557` for duplicate checking
- `gray-matter` already in `apps/www/package.json:52`
- 3 existing drafts in `thoughts/changelog/` using old flat format

### Current Draft Format (Old)
```yaml
title: "..."
slug: "..."
description: "..."        # Maps to seo.metaDescription
date: "..."               # Maps to publishedAt
focusKeyword: "..."       # Maps to seo.focusKeyword
secondaryKeywords: "..."  # Maps to seo.secondaryKeyword
faq: [...]                # Maps to seo.faq
```

### Target Mutation Type
```typescript
type ChangelogEntryInput = {
  title: string;
  slug: string;
  body: string;
  publishedAt?: string;
  excerpt?: string;
  tldr?: string;
  seo?: {
    metaDescription?: string;
    focusKeyword?: string;
    secondaryKeyword?: string;
    faq?: Array<{ question: string; answer: string }>;
  };
};
```

## Desired End State

1. Changelog skill outputs drafts in a format that maps directly to `ChangelogEntryInput`
2. A TypeScript script parses drafts and publishes to BaseHub with zero field mapping
3. A Claude Code command provides UX for previewing and confirming publication
4. Existing drafts are migrated to the new format

### Verification
- Run `/publish_changelog thoughts/changelog/test-draft.md` successfully publishes to BaseHub
- Published entry appears at `https://lightfast.ai/changelog/{slug}`
- Local file status updates to `published`

## What We're NOT Doing

- Backwards compatibility with old frontmatter format
- Update functionality (create-only for now)
- Image upload handling
- CI/CD integration

---

## Phase 1: Restructure Skill Output Format

### Overview
Update the changelog-writer skill to output frontmatter that matches `ChangelogEntryInput` directly.

### Changes Required:

#### 1. Update templates.md
**File**: `.claude/skills/changelog-writer/resources/templates.md`

Replace the frontmatter template (lines 23-49) with:

```yaml
---
# Fields that map directly to ChangelogEntryInput
title: "Feature Name, Feature Name, Feature Name"
slug: "version-slug"
publishedAt: "YYYY-MM-DD"
excerpt: "Short summary for listings, max 300 chars"
tldr: "50-100 word summary for AI citation and featured snippets. Appears at top of page."

# SEO nested object (matches ChangelogSeoInput)
seo:
  metaDescription: "150-160 char meta description with version and keyword"
  focusKeyword: "primary-keyword-phrase"
  secondaryKeyword: "secondary-keyword-phrase"
  faq:
    - question: "What is [feature]?"
      answer: "Concise answer optimized for featured snippets."
    - question: "How do I [action]?"
      answer: "Step-by-step answer with specifics."

# Internal fields (stripped before publish, not sent to BaseHub)
_internal:
  status: draft
  source_prs: ["#123", "commit-hash"]
  generated: "ISO-timestamp"
---
```

#### 2. Update SKILL.md
**File**: `.claude/skills/changelog-writer/SKILL.md`

Replace lines 70-80 with:

```markdown
### Required Frontmatter Fields

Every draft MUST include:
- `title`, `slug`, `publishedAt` (core)
- `excerpt`, `tldr` (AEO)
- `seo.metaDescription`, `seo.focusKeyword` (SEO)

Recommended:
- `seo.secondaryKeyword`, `seo.faq[]` (enhanced SEO)
- `_internal.source_prs` (traceability)

See `resources/templates.md` for complete frontmatter template.
```

#### 3. Update seo-requirements.md
**File**: `.claude/skills/changelog-writer/resources/seo-requirements.md`

Update the field requirements table to reflect nested structure under `seo:`.

#### 4. Update create_changelog.md command
**File**: `.claude/commands/create_changelog.md`

Update the output format section to use the new frontmatter structure.

### Success Criteria:

#### Automated Verification:
- [ ] Skill files pass lint: `pnpm lint`
- [ ] No syntax errors in YAML templates

#### Manual Verification:
- [ ] Run `/create_changelog #test` and verify output uses new format
- [ ] Frontmatter has nested `seo:` object
- [ ] Internal fields under `_internal:`

---

## Phase 2: Migrate Existing Drafts

### Overview
Convert the 3 existing draft files to the new format.

### Files to Migrate:
1. `thoughts/changelog/observation-pipeline-semantic-classification-20251217-165000.md`
2. `thoughts/changelog/observation-pipeline-semantic-classification-webhook-storage-20251217-172908.md`
3. `thoughts/changelog/observation-pipeline-semantic-classification-webhook-storage-20251217-180000.md`

### Migration Pattern:

**From:**
```yaml
title: "..."
slug: "..."
description: "..."
date: "2025-12-17"
status: draft
source_prs: [...]
excerpt: "..."
tldr: "..."
focusKeyword: "..."
secondaryKeywords: "..."
faq:
  - question: "..."
    answer: "..."
```

**To:**
```yaml
title: "..."
slug: "..."
publishedAt: "2025-12-17"
excerpt: "..."
tldr: "..."
seo:
  metaDescription: "..."
  focusKeyword: "..."
  secondaryKeyword: "..."
  faq:
    - question: "..."
      answer: "..."
_internal:
  status: draft
  source_prs: [...]
```

### Success Criteria:

#### Automated Verification:
- [ ] All 3 files have valid YAML frontmatter
- [ ] No files use old `description`, `date`, `focusKeyword` at root level

#### Manual Verification:
- [ ] Each file's content is preserved correctly
- [ ] Nested `seo:` structure is correct

---

## Phase 3: Create Publish Script

### Overview
Create the TypeScript script that parses drafts and calls `createChangelogEntry()`.

### Changes Required:

#### 1. Create publish-changelog.ts
**File**: `apps/www/scripts/publish-changelog.ts`

```typescript
#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import matter from "gray-matter";
import { createChangelogEntry, type ChangelogEntryInput } from "@repo/cms-workflows";
import { changelog } from "@vendor/cms";

async function main() {
  const filepath = process.argv[2];
  if (!filepath) {
    console.error("Usage: pnpm with-env pnpm tsx scripts/publish-changelog.ts <filepath>");
    process.exit(1);
  }

  const absolutePath = resolve(filepath);
  const fileContent = readFileSync(absolutePath, "utf-8");
  const { data, content: body } = matter(fileContent);

  // Validate required fields
  const required = ["title", "slug"];
  for (const field of required) {
    if (!data[field]) {
      console.error(JSON.stringify({ success: false, error: `Missing required field: ${field}` }));
      process.exit(1);
    }
  }

  // Check for duplicate slug
  const existing = await changelog.getEntryBySlug(data.slug);
  if (existing) {
    console.error(JSON.stringify({
      success: false,
      error: `Changelog with slug '${data.slug}' already exists. Use a different slug or delete the existing entry in BaseHub.`
    }));
    process.exit(1);
  }

  // Extract internal fields, rest maps directly to ChangelogEntryInput
  const { _internal, ...publishData } = data;

  // Build input - frontmatter maps directly, just add body
  const input: ChangelogEntryInput = {
    ...publishData,
    body: body.trim(),
  };

  // Execute mutation
  const result = await createChangelogEntry(input);

  // Update local file status
  const updatedData = {
    ...data,
    _internal: {
      ..._internal,
      status: "published",
      publishedAt: new Date().toISOString(),
    },
  };
  const updatedContent = matter.stringify(body, updatedData);
  writeFileSync(absolutePath, updatedContent);

  console.log(JSON.stringify({
    success: true,
    result,
    localFileUpdated: true,
    slug: data.slug,
    url: `https://lightfast.ai/changelog/${data.slug}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Script compiles: `cd apps/www && pnpm tsc scripts/publish-changelog.ts --noEmit`
- [ ] Script runs without env: shows usage error (expected)

#### Manual Verification:
- [ ] Run with test file: `cd apps/www && pnpm with-env pnpm tsx scripts/publish-changelog.ts ../../thoughts/changelog/test.md`
- [ ] Verify entry appears in BaseHub
- [ ] Verify local file status updated

---

## Phase 4: Create Publish Command

### Overview
Create the Claude Code command that provides UX for the publish workflow.

### Changes Required:

#### 1. Create publish_changelog.md
**File**: `.claude/commands/publish_changelog.md`

```markdown
---
description: Publish a changelog draft from thoughts/changelog/ to BaseHub CMS
---

# Publish Changelog

Publish a reviewed changelog draft to BaseHub CMS.

## Workflow

When invoked with a file path (e.g., `/publish_changelog thoughts/changelog/my-changelog.md`):

### 1. Validate File
- Use Read tool to load the file
- If not found, list available drafts in `thoughts/changelog/`

### 2. Parse and Preview
- Extract YAML frontmatter
- Display preview:

```
## Publish Preview

**Title**: {title}
**Slug**: {slug} → lightfast.ai/changelog/{slug}
**Date**: {publishedAt}

**SEO**:
- Focus keyword: {seo.focusKeyword}
- Meta description: {seo.metaDescription} ({length} chars)
- FAQ entries: {seo.faq.length}

**AEO**:
- Excerpt: {excerpt} ({length} chars)
- TLDR: {tldr} ({word count} words)

**Status**: {_internal.status}

**Content preview**:
{first 200 chars of body}...
```

### 3. Confirm Before Publishing
Use AskUserQuestion:
- "Ready to publish to BaseHub?"
- Options: "Publish now", "Review file first", "Cancel"

### 4. Execute Publish
Run: `cd apps/www && pnpm with-env pnpm tsx scripts/publish-changelog.ts {absolute_filepath}`

Parse the JSON output and report:
- Success: Show changelog URL and BaseHub dashboard link
- Failure: Show error message and suggestions

### 5. Post-Publish
- Confirm local file was updated to `_internal.status: published`
- Suggest next steps (share URL, verify in browser)

## No File Path Provided

If invoked without a file path (`/publish_changelog`), respond with:

```
Please provide the changelog file to publish:

`/publish_changelog thoughts/changelog/{filename}.md`

Available drafts:
{list files in thoughts/changelog/ with _internal.status: draft}
```
```

### Success Criteria:

#### Automated Verification:
- [ ] Command file has valid frontmatter

#### Manual Verification:
- [ ] `/publish_changelog` without args shows available drafts
- [ ] `/publish_changelog thoughts/changelog/test.md` shows preview
- [ ] Confirmation flow works correctly
- [ ] Successful publish shows URL

---

## Testing Strategy

### Unit Tests
- Not required for this implementation (script is thin wrapper)

### Integration Tests
- Manual testing with real BaseHub environment

### Manual Testing Steps
1. Create a test changelog draft with new format
2. Run `/publish_changelog` to see available drafts
3. Run `/publish_changelog thoughts/changelog/test.md`
4. Verify preview is accurate
5. Confirm and publish
6. Verify entry at `lightfast.ai/changelog/{slug}`
7. Verify local file status updated
8. Attempt to republish same slug (should error)

## File Structure After Implementation

```
.claude/
├── commands/
│   ├── create_changelog.md      # Updated output format
│   └── publish_changelog.md     # NEW
├── skills/
│   └── changelog-writer/
│       ├── SKILL.md             # Updated field requirements
│       └── resources/
│           ├── templates.md     # Updated frontmatter template
│           └── seo-requirements.md  # Updated field structure
apps/www/
└── scripts/
    └── publish-changelog.ts     # NEW
thoughts/changelog/
└── *.md                         # Migrated to new format
```

## References

- Research document: `thoughts/shared/research/2025-12-17-publish-changelog-architecture.md`
- Mutation API: `packages/cms-workflows/src/mutations/changelog.ts:114-175`
- Duplicate check: `vendor/cms/index.ts:557`
- Existing skill: `.claude/skills/changelog-writer/SKILL.md`
