---
date: 2025-12-17T06:34:58Z
researcher: Claude
git_commit: 72ccdd2ccccd4b68af67fce7901e4e7cae4775ef
branch: feat/memory-layer-foundation
repository: lightfast
topic: "publish_changelog command architecture"
tags: [research, claude-code, commands, cms-workflows, basehub, changelog-skill]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude
last_updated_note: "Added skill output format restructuring to match ChangelogEntryInput directly"
---

# Research: publish_changelog Command Architecture

**Date**: 2025-12-17T06:34:58Z
**Researcher**: Claude
**Git Commit**: 72ccdd2ccccd4b68af67fce7901e4e7cae4775ef
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

How should we architect a `/publish_changelog` command that takes a file from `thoughts/changelog/` and publishes it to BaseHub using `@repo/cms-workflows`?

## Summary

The recommended architecture is a **Command + Script** pattern:
1. A Claude Code command (`.claude/commands/publish_changelog.md`) provides the UX layer (preview, validation, confirmation)
2. A TypeScript script (`apps/www/scripts/publish-changelog.ts`) handles YAML parsing and BaseHub mutation

This follows existing patterns in the codebase and enables both CLI usage and Claude Code orchestration. The script lives in `apps/www/` because it requires `BASEHUB_ADMIN_TOKEN` from the www environment.

## Detailed Findings

### Existing Infrastructure

#### 1. Changelog Draft Format (`thoughts/changelog/*.md`)

Files follow this structure:

```yaml
---
# Core fields
title: "Observation Pipeline, Semantic Classification, Webhook Storage"
slug: "neural-memory-foundation"
description: "150-160 char meta description..."
date: "2025-12-17"
status: draft
source_prs: ["333ca6ac", "9171c270"]

# AEO Fields
excerpt: "Max 300 char summary for listings..."
tldr: "50-100 word summary for AI citation..."

# SEO Fields
focusKeyword: "observation pipeline"
secondaryKeywords: "semantic classification webhooks"

# FAQ
faq:
  - question: "What is an observation pipeline?"
    answer: "An observation pipeline transforms..."
---

**Multi-view embeddings, AI classification...**

---

### Feature Section
{markdown body content}
```

#### 2. Mutation API (`packages/cms-workflows/src/mutations/changelog.ts`)

```typescript
type ChangelogEntryInput = {
  title: string;
  slug: string;
  body: string;           // markdown
  improvements?: string;
  infrastructure?: string;
  fixes?: string;
  patches?: string;
  featuredImageId?: string;
  publishedAt?: string;   // ISO date
  excerpt?: string;
  tldr?: string;
  seo?: ChangelogSeoInput;
};

type ChangelogSeoInput = {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeyword?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  faq?: Array<{ question: string; answer: string }>;
};
```

Key functions:
- `createChangelogEntry(data: ChangelogEntryInput)` - Creates new entry
- `updateChangelogEntry(entryId, data: Partial<ChangelogEntryInput>)` - Updates existing

#### 3. Field Mapping (Draft → Mutation Input)

| Draft Frontmatter | ChangelogEntryInput |
|-------------------|---------------------|
| `title` | `title` |
| `slug` | `slug` |
| `description` | `seo.metaDescription` |
| `date` | `publishedAt` |
| `excerpt` | `excerpt` |
| `tldr` | `tldr` |
| `focusKeyword` | `seo.focusKeyword` |
| `secondaryKeywords` | `seo.secondaryKeyword` |
| `faq` | `seo.faq` |
| Body (after `---`) | `body` |

### Architecture Options

#### Option A: Command + Script (Recommended)

**Components:**
1. `.claude/commands/publish_changelog.md` - Claude Code command for UX
2. `apps/www/scripts/publish-changelog.ts` - TypeScript script for parsing/mutation

**Flow:**
```
User: /publish_changelog thoughts/changelog/my-changelog.md
  ↓
Command reads file, parses frontmatter preview
  ↓
Command shows preview to user, asks confirmation
  ↓
Command runs: cd apps/www && pnpm with-env pnpm tsx scripts/publish-changelog.ts <filepath>
  ↓
Script parses YAML, maps fields, calls createChangelogEntry()
  ↓
Script returns BaseHub entry ID
  ↓
Command reports success with BaseHub URL
```

**Advantages:**
- Script reusable standalone (CI/CD, manual runs)
- Clean separation: UX in command, logic in script
- Follows existing `scripts/` patterns
- Can be tested independently

#### Option B: Command-Only with Inline Logic

**Flow:**
```
User: /publish_changelog thoughts/changelog/my-changelog.md
  ↓
Command reads file using Read tool
  ↓
Command manually parses YAML frontmatter (regex)
  ↓
Command generates JSON and pipes to node inline eval
```

**Disadvantages:**
- Complex YAML parsing in markdown prompt
- Not reusable outside Claude Code
- Error-prone string manipulation

#### Option C: Agent-Based

**Components:**
1. `.claude/agents/changelog-publisher.md` - Specialized agent
2. `.claude/commands/publish_changelog.md` - Command that spawns agent

**Disadvantages:**
- Adds unnecessary abstraction layer
- Agents are for research/analysis, not simple mutations
- Overhead of spawning agent for simple task

### Recommended Implementation

#### 1. Script: `apps/www/scripts/publish-changelog.ts`

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

  // Parse markdown with YAML frontmatter
  const content = readFileSync(absolutePath, "utf-8");
  const { data, content: body } = matter(content);

  // Check for duplicate slug
  const existing = await changelog.getEntryBySlug(data.slug);
  if (existing) {
    console.error(`Error: Changelog with slug '${data.slug}' already exists.`);
    console.error(`Use a different slug or delete the existing entry in BaseHub.`);
    process.exit(1);
  }

  // Map to ChangelogEntryInput
  const input: ChangelogEntryInput = {
    title: data.title,
    slug: data.slug,
    body: body.trim(),
    publishedAt: data.date ? new Date(data.date).toISOString() : undefined,
    excerpt: data.excerpt,
    tldr: data.tldr,
    seo: {
      metaDescription: data.description,
      focusKeyword: data.focusKeyword,
      secondaryKeyword: data.secondaryKeywords,
      faq: data.faq,
    },
  };

  // Execute mutation
  const result = await createChangelogEntry(input);

  // Update local file status
  const updatedFrontmatter = {
    ...data,
    status: "published",
    publishedAt: new Date().toISOString(),
  };
  const updatedContent = matter.stringify(body, updatedFrontmatter);
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

**Dependencies to add:** `gray-matter` (YAML frontmatter parser) to `apps/www/package.json`

#### 2. Command: `.claude/commands/publish_changelog.md`

```markdown
---
description: Publish a changelog draft from thoughts/changelog/ to BaseHub CMS
---

# Publish Changelog

Publish a reviewed changelog draft to BaseHub CMS.

## Initial Response

When invoked, check if a file path was provided:

**If file path provided** (e.g., `/publish_changelog thoughts/changelog/my-changelog.md`):
- Validate file exists
- Read and parse frontmatter
- Show preview
- Ask for confirmation
- Execute publish

**If no file path**, respond with:
```
Please provide the changelog file to publish:

`/publish_changelog thoughts/changelog/{filename}.md`

Available drafts:
{list files in thoughts/changelog/ with status: draft}
```

## Workflow

1. **Validate file exists:**
   - Use Read tool to load the file
   - If not found, show error with available files

2. **Parse and preview:**
   - Extract YAML frontmatter
   - Display preview:
     ```
     ## Publish Preview

     **Title**: {title}
     **Slug**: {slug} → lightfast.ai/changelog/{slug}
     **Date**: {date}

     **SEO**:
     - Focus keyword: {focusKeyword}
     - Meta description: {description} ({length} chars)
     - FAQ entries: {count}

     **AEO**:
     - Excerpt: {excerpt} ({length} chars)
     - TLDR: {tldr} ({word count} words)

     **Content preview**:
     {first 200 chars of body}...
     ```

3. **Confirm before publishing:**
   - Use AskUserQuestion:
     - "Ready to publish to BaseHub?"
     - Options: "Publish now", "Review file first", "Cancel"

4. **Execute publish:**
   - Run: `cd apps/www && pnpm with-env pnpm tsx scripts/publish-changelog.ts {absolute_filepath}`
   - Parse output JSON
   - Report success/failure

5. **Post-publish:**
   - Show changelog URL: `https://lightfast.ai/changelog/{slug}`
   - Confirm local file was updated to `status: published`
   - Show BaseHub dashboard link for further edits
```

### File Structure After Implementation

```
.claude/
├── commands/
│   ├── create_changelog.md      # Existing - generates drafts
│   └── publish_changelog.md     # NEW - publishes to BaseHub
apps/www/
├── scripts/
│   └── publish-changelog.ts     # NEW - mutation script
├── package.json                 # Add gray-matter dependency
packages/
└── cms-workflows/
    └── src/mutations/changelog.ts  # Existing - BaseHub API
```

### Workflow Integration

The full changelog workflow becomes:

```
1. /changelog #123 #124
   ↓ (generates draft)
2. User reviews thoughts/changelog/my-changelog.md
   ↓ (makes edits)
3. /publish_changelog thoughts/changelog/my-changelog.md
   ↓ (publishes to BaseHub)
4. Entry live at lightfast.ai/changelog/{slug}
```

This is already anticipated - line 156 of `create_changelog.md` states:
> "Use `/publish-changelog` when ready to push to BaseHub"

## Code References

- `.claude/commands/create_changelog.md:156` - Reference to planned publish command
- `packages/cms-workflows/src/mutations/changelog.ts:114-175` - `createChangelogEntry()` function
- `packages/cms-workflows/src/mutations/changelog.ts:7-50` - Type definitions
- `thoughts/changelog/observation-pipeline-semantic-classification-webhook-storage-20251217-180000.md:1-26` - Example draft frontmatter

## Architecture Documentation

### Pattern: Command + Script Separation

Claude Code commands in this repo follow a pattern where:
- **Commands** (`.claude/commands/`) handle UX, orchestration, user confirmation
- **Scripts** (`scripts/`) handle complex logic, parsing, external API calls
- **Packages** (`packages/`) provide reusable libraries

This separation allows:
- Scripts to be run standalone or via CI/CD
- Commands to provide guardrails and confirmations
- Logic to be unit tested independently

### Pattern: Environment-Gated Mutations

All CMS mutations require `BASEHUB_ADMIN_TOKEN` which is only available in specific contexts:
- `apps/www/.vercel/.env.development.local`
- Accessed via: `cd apps/www && pnpm with-env <command>`

Scripts must be run from the correct directory with environment loaded.

## Design Decisions

### 1. Update vs Create

**Decision**: Create-only for now.

The command will only support creating new entries. If a user needs to update an existing entry:
- Edit directly in BaseHub dashboard
- Or delete and recreate with the same slug

Rationale: Updating requires looking up the entry ID by slug, adding complexity. Users can easily provide a new slug if needed.

### 2. Status Field Sync

**Decision**: Yes, automatically update local file status.

After successful publish:
1. Update `status: draft` → `status: published` in the frontmatter
2. Add `publishedAt: {ISO timestamp}` if not present
3. This creates a clear audit trail of what was published and when

### 3. Duplicate Prevention

**Decision**: Check and error before publishing.

The script will:
1. Query BaseHub for existing entry with the same slug using `@vendor/cms` changelog queries
2. If found, error with: "Changelog with slug '{slug}' already exists. Use a different slug or delete the existing entry."
3. User provides the slug in frontmatter, so they have full control

This prevents accidental overwrites while keeping the workflow simple.

### 4. Image Handling

**Decision**: Skip for now.

Images can be added manually in BaseHub dashboard after publishing if needed.

---

## Extended Rework: Skill Output Format

### Problem

The current changelog draft format requires field mapping during publish:

| Current Frontmatter | Must Map To |
|---------------------|-------------|
| `description` | `seo.metaDescription` |
| `date` | `publishedAt` |
| `focusKeyword` | `seo.focusKeyword` |
| `secondaryKeywords` | `seo.secondaryKeyword` |
| `faq` | `seo.faq` |

This mapping logic adds complexity to the publish script and creates a mismatch between the draft format and the mutation API.

### Solution

Restructure the skill output to match `ChangelogEntryInput` directly. The frontmatter structure should mirror the TypeScript type, eliminating all field mapping.

### New Output Format

```yaml
---
# Fields that map directly to ChangelogEntryInput
title: "Observation Pipeline, Semantic Classification, Webhook Storage"
slug: "neural-memory-foundation"
publishedAt: "2025-12-17"
excerpt: "Max 300 char summary for listings and RSS feeds..."
tldr: "50-100 word summary for AI citation. Self-contained paragraph..."

# SEO nested object (matches ChangelogSeoInput)
seo:
  metaDescription: "150-160 char meta description with version and focus keyword..."
  focusKeyword: "observation pipeline"
  secondaryKeyword: "semantic classification webhooks"
  faq:
    - question: "What is an observation pipeline?"
      answer: "An observation pipeline transforms raw engineering events..."
    - question: "How does semantic classification work?"
      answer: "Lightfast uses Claude 3.5 Haiku to classify each observation..."

# Internal fields (stripped before publish, not sent to BaseHub)
_internal:
  status: draft
  source_prs: ["333ca6ac", "9171c270", "70b17850", "a309c88a"]
  generated: "2025-12-17T18:00:00Z"
  fact_checked_files:
    - "api/console/src/inngest/workflow/neural/observation-capture.ts:335-1163"
    - "packages/console-webhooks/src/storage.ts:22-78"
---

**Multi-view embeddings, AI classification, and permanent audit trails**

---

### Observation Pipeline

{markdown body content - human readable and editable}
```

### Key Changes

1. **`description` → `seo.metaDescription`**: SEO fields nested under `seo:` object
2. **`date` → `publishedAt`**: Matches mutation field name directly
3. **`focusKeyword` → `seo.focusKeyword`**: Nested under `seo:`
4. **`secondaryKeywords` → `seo.secondaryKeyword`**: Nested + singular name
5. **`faq` → `seo.faq`**: Nested under `seo:`
6. **Internal fields under `_internal:`**: Clear separation of draft metadata vs. publish data

### Simplified Publish Script

With the restructured format, the script becomes trivial:

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

  // Check for duplicate slug
  const existing = await changelog.getEntryBySlug(data.slug);
  if (existing) {
    console.error(`Error: Changelog with slug '${data.slug}' already exists.`);
    console.error(`Use a different slug or delete the existing entry in BaseHub.`);
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

**Key simplification**: No field mapping logic. Just `{ ...publishData, body }`.

### Files to Update

#### 1. `.claude/skills/changelog-writer/SKILL.md`

Update output format specification to use new frontmatter structure.

#### 2. `.claude/skills/changelog-writer/resources/templates.md`

Update frontmatter template:
- Nest SEO fields under `seo:`
- Rename `date` to `publishedAt`
- Rename `description` to `seo.metaDescription`
- Move internal fields under `_internal:`

#### 3. `.claude/skills/changelog-writer/resources/seo-requirements.md`

Update field requirements table to reflect new structure.

#### 4. `.claude/commands/create_changelog.md`

Update output format section (lines 165-208) to match new structure.

### Migration Notes

Existing drafts in `thoughts/changelog/` use the old format. Options:
1. **Manual migration**: Update existing drafts to new format before publishing
2. **Script migration**: Create a one-time script to convert old format to new
3. **Dual support**: Have publish script support both formats (not recommended - adds complexity)

**Recommended**: Manual migration for existing drafts (only 2-3 files), then use new format going forward.
