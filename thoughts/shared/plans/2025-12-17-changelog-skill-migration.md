# Changelog Skill Migration Implementation Plan

## Overview

Migrate the changelog-writer from `vendor/cms/agents/changelog-writer.md` to Claude Code's skill system using Option B (Slash Command + Skill Hybrid). This creates a modular, discoverable changelog generation system with:
- **Changelog Skill**: Core instructions and templates
- **Technical Writer Agent**: General-purpose writing agent
- **`/changelog` Command**: User-facing entry point
- **Separate publishing workflow** (future `/publish-changelog` command)

## Current State Analysis

### Existing Assets
- `vendor/cms/agents/changelog-writer.md` (366 lines) - Monolithic agent prompt
- `vendor/cms/agents/changelog-checklist.md` (61 lines) - Review checklist
- No `.claude/skills/` directory exists yet

### Key Discoveries
- Agent pattern: `.claude/agents/*.md` with YAML frontmatter (`name`, `description`, `tools`, `model`)
- Command pattern: `.claude/commands/*.md` with frontmatter + markdown instructions
- Blog workflow: `blog-brief-planner.md` → `blog-writer.md` pattern works well
- Output directory: `thoughts/shared/` exists, `thoughts/changelog/` does not

## Desired End State

After implementation:
1. `/changelog #123` generates a changelog entry from a PR
2. `/changelog #123 #124 https://github.com/org/repo/pull/125` handles multiple inputs
3. `/changelog "Added feature X, Fixed bug Y"` handles manual input
4. Output saved to `thoughts/changelog/{title-slug}-{datetime}.md`
5. Skill auto-discovered when user mentions "changelog", "release notes", "what's new"
6. Technical writer agent reusable for other writing tasks

### Verification
- [x] Skill file exists at `.claude/skills/changelog-writer/SKILL.md`
- [x] Resources split into modular files
- [x] Agent exists at `.claude/agents/technical-writer.md`
- [x] Command exists at `.claude/commands/changelog.md`
- [x] Output directory `thoughts/changelog/` exists
- [ ] Manual test: `/changelog "Test feature"` produces valid output

## What We're NOT Doing

- BaseHub publishing (separate `/publish-changelog` command later)
- Automated PR fetching via GitHub API (user provides PR content)
- JSON-LD structured data generation (handled by website template)
- Migration of existing changelogs to new format

## Implementation Approach

Split the 366-line agent into modular components following Anthropic's skill best practices:
1. Core SKILL.md (~200 lines) with essential instructions
2. Resources folder with templates, examples, SEO requirements, checklist
3. General-purpose technical writer agent for execution
4. Command that orchestrates skill + agent

---

## Phase 1: Create Skill Directory Structure

### Overview
Create the `.claude/skills/changelog-writer/` directory with proper structure following Anthropic's skill patterns.

### Changes Required

#### 1. Create Directory Structure
```
.claude/skills/changelog-writer/
├── SKILL.md                    # Core instructions (~200 lines)
└── resources/
    ├── templates.md            # Document structure templates
    ├── examples.md             # Good/bad examples + v0.1 example
    ├── seo-requirements.md     # SEO checklist and keywords
    └── checklist.md            # Pre-publish validation
```

#### 2. Create SKILL.md
**File**: `.claude/skills/changelog-writer/SKILL.md`

```markdown
---
name: changelog-writer
description: Create user-focused, SEO-optimized changelog entries for software releases. Use when writing release notes, version updates, product changelogs, or "what's new" documentation for developer tools.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Changelog Writer

Create clear, accurate changelog entries that help developers understand what's new in Lightfast releases.

## Critical: Fact-Check First

Before writing anything, verify against `docs/architecture/implementation-status/README.md`:

1. **Check implementation status** to verify:
   - What's actually completed vs planned
   - Current limitations and known gaps
   - Technical accuracy of claims

2. **Never oversell:**
   - Use specific names: "GitHub File Sync (File Contents)" not "GitHub Integration"
   - Disclose limitations: "Currently supports X; Y coming in vZ"
   - Be honest about conditionals: "when 3+ customers request"

3. **Verify every claim:**
   - If you cite a number, confirm it's in implementation docs
   - If you mention a feature, confirm it exists in production
   - When uncertain, ask for clarification

## Writing Guidelines

1. **Concise & scannable**: 1-3 sentences per feature (Cursor-style brevity)
2. **Lead with benefit**: Start with what users can do, then how
3. **Be transparent**: Mention beta status, rollout timelines, limitations
4. **User-focused but technical**: Balance benefits with specifics developers need
5. **Active voice**: "You can now..." not "Users are able to..."
6. **No emoji**: Professional tone
7. **Specific examples**: Include config snippets, API calls
8. **SEO-conscious**: Use target keywords naturally

## Workflow

1. **Gather input**: PR numbers, URLs, or manual change list
2. **Read implementation status** for fact-checking
3. **Draft following** [templates](resources/templates.md)
4. **Cross-check claims** against implementation reality
5. **Add SEO elements** per [seo-requirements](resources/seo-requirements.md)
6. **Review with** [checklist](resources/checklist.md)

## Quick Reference

### Do
- "GitHub File Sync (File Contents)" with limitations disclosed
- "When 3+ customers request: Linear integration"
- Include code examples for every major feature
- Link to 3-5 related docs

### Don't
- "GitHub Integration" (vague - what does it cover?)
- "Coming soon: Linear, Notion, Slack!" (when at 0%)
- Long paragraphs (keep to 1-3 sentences per feature)
- Claims without verification

## Output Format

Save to: `thoughts/changelog/{title-slug}-{YYYYMMDD-HHMMSS}.md`

Slug format: kebab-case title (e.g., `github-file-sync-semantic-search-20251217-143022.md`)

## Resources

- [Document Templates](resources/templates.md)
- [SEO Requirements](resources/seo-requirements.md)
- [Examples](resources/examples.md)
- [Pre-Publish Checklist](resources/checklist.md)
```

#### 3. Create resources/templates.md
**File**: `.claude/skills/changelog-writer/resources/templates.md`

```markdown
# Changelog Templates

## BaseHub Entry Fields

When creating/editing in BaseHub:
- **Title**: 2-3 key features (e.g., "GitHub File Sync, Semantic Search, Team Workspaces")
- **Slug**: Version in URL format ("0-1", "1-2", etc.)
- **Body**: Main changelog content (markdown)
- **Description**: 150-160 char meta description with keywords

## Document Structure

```markdown
# vX.X · Month Day, Year

**[2-3 key features as subtitle]**

---

### [Feature Name]

[1-3 sentences: what it does + user benefit]

**What's included:**
- Bullet list of specific capabilities
- Include limitations if any
- Mention beta/rollout status if applicable

**Example:**
\`\`\`yaml
# Config snippet or API example
\`\`\`

[Optional: "Why we built it this way" insight]

---

### [Next Feature]

[Repeat structure]

---

### Improvements (N)

<details>
<summary>View all improvements</summary>

- Concise bullet (1-2 lines max)
- Focus on user impact, not implementation
- [Link to docs if relevant](/docs/feature)

</details>

---

### Infrastructure (N)

<details>
<summary>View technical details</summary>

- Platform/architecture improvements
- Can be more technical than Improvements
- Include performance metrics if available

</details>

---

### What's Coming Next

[ONLY include if validated by implementation docs]

**Based on your feedback:**
1. **[Feature]** (vX.X) — [brief description, validated by roadmap]
2. **[Integration]** (when N+ customers request it)

---

### Resources

- [Quick Start](/docs/quick-start)
- [GitHub Setup](/docs/integrations/github)
- [API Reference](/docs/api)
- [Configuration Docs](/docs/config)
```

## Section Guidelines

### Feature Sections
- Lead with user benefit
- Include "What's included" bullets
- Add code example
- Disclose what's NOT included
- Optional: "Why we built it this way"

### Improvements Section
- Use collapsible `<details>` tag
- 1-2 lines per item max
- Focus on user impact
- Link to docs where relevant

### Infrastructure Section
- Technical audience
- Include metrics where available
- Can be more detailed than Improvements

### What's Coming Next
- ONLY validated items from roadmap
- Use conditionals: "when N+ customers request"
- Be honest about prioritization
```

#### 4. Create resources/examples.md
**File**: `.claude/skills/changelog-writer/resources/examples.md`

```markdown
# Changelog Examples

## Writing Style

### Good Examples (Cursor-style brevity + technical specificity)

**Feature description:**
> "Connect GitHub repositories with automatic webhook-driven synchronization. When you push code, Lightfast incrementally updates your knowledge base. Currently supports file contents via Git Trees API; PR metadata coming in v0.2."

**Improvement bullet:**
> "Config hash tracking auto-detects embedding changes and re-processes affected documents"

**Technical detail:**
> "Vector embeddings (Pinecone) + BM25 full-text search with cross-encoder reranking for sub-second results"

### Bad Examples

**Too vague:**
> "GitHub Integration" (what does this cover? files? PRs? issues?)

**Too verbose:**
> "You can now search your entire organization's code using natural language instead of exact keywords. Ask questions like 'how does authentication work' or 'where do we handle rate limiting' and get relevant results based on semantic understanding, not just text matching. This revolutionary approach transforms how teams discover knowledge..." [2 more paragraphs]

**Overselling:**
> "Coming soon: Linear, Notion, Slack, Sentry, and 10 more integrations!" (when they're at 0%)

**Missing limitations:**
> "GitHub integration is live!" (but doesn't mention it's only file contents)

---

## Full Example: v0.1 Changelog

**BaseHub Entry:**
- Title: "GitHub File Sync, Semantic Search, Team Workspaces"
- Slug: "0-1"
- Description: "Lightfast v0.1 brings GitHub file sync with webhook-driven updates, semantic code search with vector + full-text retrieval, and isolated team workspaces. Production-ready." (158 chars)

**Body:**

# v0.1 · Nov 29, 2024

**GitHub File Sync, Semantic Search, and Team Workspaces**

---

### GitHub Repository Sync (File Contents)

Connect GitHub repositories with automatic webhook-driven synchronization. When you push code, Lightfast incrementally updates your knowledge base using Git Trees API to handle repositories with 100k+ files efficiently.

**What's included:**
- File contents (code, markdown, docs) indexed via webhook events
- `lightfast.yml` configuration with glob patterns for include/exclude
- HMAC SHA-256 webhook verification
- Incremental sync (only changed files re-indexed)

**Not yet:** PR metadata, issue discussions, commit history (planned for v0.2 based on feedback)

**Example config:**
```yaml
# lightfast.yml
include:
  - "src/**/*.ts"
  - "docs/**/*.md"
exclude:
  - "**/*.test.ts"
  - "node_modules/**"
```

**Why webhooks over polling:** Webhooks provide sub-minute update latency while avoiding GitHub API rate limits (5,000 requests/hour). Polling would exhaust limits for active teams.

[Learn more about GitHub setup](/docs/integrations/github)

---

### Semantic Code Search

Search your codebase using natural language, not keywords. Ask "how does authentication work" and get relevant results ranked by meaning with highlighted snippets and citations.

**What's included:**
- Vector embeddings (Pinecone) + BM25 full-text search
- Cross-encoder reranking for top results
- Sub-second queries across 100k+ files
- Snippet highlighting with source citations

**How it works:** Each file is chunked with context preservation, embedded using sentence transformers, and indexed with metadata. Queries use hybrid retrieval (dense + sparse) followed by reranking.

[API documentation](/docs/api/search)

---

### Team Workspaces

Create isolated knowledge bases per team or project. Each workspace has separate GitHub integrations, search access, and activity tracking.

**What's included:**
- Clerk authentication with SSO support
- Per-workspace GitHub app installations
- Team-based access control
- Activity and metrics tracking

[Setup guide](/docs/workspaces)

---

### Improvements (8)

<details>
<summary>View all improvements</summary>

- **Search highlighting:** Context-aware snippets with keyword emphasis
- **Intelligent chunking:** Respects code structure (functions, classes, modules)
- **Activity tracking:** Per-workspace job status and search metrics
- **Batch processing:** Efficient handling of large repository updates
- **Webhook verification:** HMAC SHA-256 signature validation
- **Incremental sync:** Only re-index changed files on push
- **Config hash tracking:** Auto-detect config changes and re-process
- **Glob patterns:** Full support for `**`, `*`, `!` syntax

</details>

---

### Infrastructure (5)

<details>
<summary>View technical details</summary>

- **Multi-source schema:** Generic document model ready for future integrations
- **Event-driven workflows:** Inngest orchestration with `waitForEvent`
- **Idempotent processing:** Safe retries and partial failure recovery
- **Metrics tracking:** Per-workspace job lifecycle monitoring
- **Type-safe APIs:** Discriminated unions throughout (TypeScript + Zod)

</details>

---

### What's Coming Next

Based on your feedback:

1. **PR & Issue ingestion** (v0.2) — Search pull requests, reviews, issue discussions
2. **Linear integration** (when 3+ customers request it) — 1-2 week implementation
3. **Notion integration** (when 3+ customers request it) — 1-2 week implementation

---

### Resources

- [Quick Start Guide](/docs/quick-start)
- [GitHub Integration Setup](/docs/integrations/github)
- [Configuration Reference](/docs/config)
- [API Documentation](/docs/api)
- [Workspace Management](/docs/workspaces)
```

#### 5. Create resources/seo-requirements.md
**File**: `.claude/skills/changelog-writer/resources/seo-requirements.md`

```markdown
# SEO Requirements

Every changelog MUST include these elements.

## 1. Target Keywords

Naturally incorporate developer search terms:

**Technical terms:**
- webhook-driven sync
- vector search
- semantic code search
- incremental sync
- knowledge base

**Use cases:**
- search codebase
- code retrieval
- team memory

**Integration names:**
- GitHub integration
- repository sync

## 2. Meta Description

Add to BaseHub Description field:
- 150-160 characters exactly
- Include version number
- Top 2-3 features
- Target keyword

**Example:**
> "Lightfast v0.1 brings GitHub file sync with webhook-driven updates, semantic code search with vector + full-text retrieval, and isolated team workspaces. Production-ready." (158 chars)

## 3. Internal Links

Link to 3-5 related docs:
- Setup guides: `[GitHub Setup](/docs/integrations/github)`
- API docs: `[API Reference](/docs/api)`
- Configuration: `[Config Reference](/docs/config)`
- Quick start: `[Quick Start](/docs/quick-start)`

## 4. Code Examples

At least one config snippet or API example per major feature.

```yaml
# lightfast.yml example
include:
  - "src/**/*.ts"
exclude:
  - "node_modules/**"
```

## 5. Unique Insight

One "Why we built it this way" paragraph per release.

**Example:**
> "We chose webhook-driven sync over polling to reduce API rate limit impact and ensure sub-minute latency for code updates."

## 6. Structured Data

JSON-LD schema is automatically generated by the changelog page template from BaseHub entry data. No manual action needed.

## SEO Checklist

- [ ] Meta description in BaseHub (150-160 chars, includes keywords)
- [ ] 3-5 internal links to docs
- [ ] At least 1 code example per major feature
- [ ] Target keywords used naturally
- [ ] Unique insight or "why we built it" paragraph
- [ ] Specific technical details (API names, config files, performance)
```

#### 6. Create resources/checklist.md
**File**: `.claude/skills/changelog-writer/resources/checklist.md`

```markdown
# Changelog Pre-Publish Checklist

Quick checklist before publishing. 2 minutes max.

## 1. Fact Check (Critical)

Compare against `docs/architecture/implementation-status/README.md`:

- [ ] Every feature mentioned is actually complete
- [ ] Incomplete features marked "Not yet" or "when N+ customers request"
- [ ] No overselling (e.g., "GitHub Integration" → "GitHub File Sync (File Contents)")
- [ ] Limitations disclosed (what's NOT included)

## 2. SEO Basics

- [ ] Description field: 150-160 characters with keywords
- [ ] 3+ internal links to docs
- [ ] At least 1 code example per major feature
- [ ] Technical specifics present (not just marketing fluff)

## 3. Style

- [ ] 1-3 sentences per feature (not long paragraphs)
- [ ] "You can now..." not "Users are able to..."
- [ ] No emoji
- [ ] Professional tone throughout

## 4. Red Flags

**DO NOT PUBLISH if you see:**

- "Coming soon: Linear, Notion" (use "when 3+ customers request")
- "GitHub Integration" without specifying what (files/PRs/issues)
- Claims about features at 0% in implementation docs
- No limitations disclosed for partial features
- Meta description missing or >160 chars
- No code examples

## Quick Reference

### Bad → Good

| Bad | Good |
|-----|------|
| "Plans for Linear, Notion, and Slack!" | "When 3+ customers request: Linear (1-2 week implementation)" |
| "GitHub Integration is live" | "GitHub Repository Sync (File Contents). Not yet: PR metadata (v0.2)" |
| Long paragraph describing feature | 1-3 sentences with bullet points |
| "Users are able to search" | "You can now search" |

## Transparency Questions

For every feature, ask:

- [ ] Is this 100% complete and in production?
- [ ] Are there limitations users should know?
- [ ] Is this beta/rolling out?
- [ ] Did I verify against implementation docs?
- [ ] Would a developer hit any surprises?
```

### Success Criteria

#### Automated Verification
- [x] Directory exists: `ls -la .claude/skills/changelog-writer/`
- [x] SKILL.md exists and has valid frontmatter
- [x] All 4 resource files exist in `resources/`
- [x] No syntax errors in markdown

#### Manual Verification
- [x] SKILL.md under 250 lines (75 lines)
- [x] Frontmatter includes `name`, `description`, `allowed-tools`
- [x] Resources properly linked from SKILL.md

---

## Phase 2: Create Technical Writer Agent

### Overview
Create a general-purpose technical writing agent that can be used by the changelog command and other writing tasks (docs, release notes, announcements).

### Changes Required

#### 1. Create Agent File
**File**: `.claude/agents/technical-writer.md`

```markdown
---
name: technical-writer
description: General-purpose technical writing agent for documentation, changelogs, release notes, and developer-focused content. Use when you need to write or edit technical documentation with accuracy and clarity.
tools: Read, Grep, Glob, Write, Edit
model: sonnet
---

# Technical Writer

You are a technical writing specialist focused on creating clear, accurate, developer-focused documentation.

## Core Principles

1. **Accuracy over marketing**: Verify every claim against source code or docs
2. **Clarity over cleverness**: Simple, direct language
3. **Brevity over verbosity**: 1-3 sentences per concept
4. **Specificity over vagueness**: Include concrete examples, numbers, code

## Writing Guidelines

### Tone
- Professional, not casual
- Confident, not hedging
- Helpful, not salesy
- Technical, not dumbed-down

### Structure
- Lead with the most important information
- Use bullet points for lists of 3+ items
- Include code examples where relevant
- Link to related documentation

### Style Rules
- Active voice: "You can configure..." not "Configuration can be done..."
- Present tense: "This feature enables..." not "This feature will enable..."
- Second person: "your codebase" not "the user's codebase"
- No emoji in professional docs
- No exclamation marks (except in truly exceptional cases)

## Fact-Checking Workflow

Before writing claims about features:

1. **Read implementation status**: Check `docs/architecture/implementation-status/README.md`
2. **Verify in codebase**: Use Grep/Glob to confirm feature exists
3. **Note limitations**: Document what's NOT included
4. **Ask if uncertain**: Better to clarify than assume

## Output Formats

### Changelog Entry
See `.claude/skills/changelog-writer/SKILL.md` for specific format.

### Documentation Page
```markdown
# [Feature Name]

[1-2 sentence overview]

## Quick Start

[Minimal working example]

## Configuration

[Options and settings]

## Examples

[Real-world use cases]

## API Reference

[If applicable]

## Troubleshooting

[Common issues and solutions]
```

### Release Notes
```markdown
## [Version] - [Date]

### Added
- [New feature with brief description]

### Changed
- [Modified behavior]

### Fixed
- [Bug fix with issue reference]

### Deprecated
- [Feature being phased out]
```

## Quality Checklist

Before finalizing any document:

- [ ] All claims verified against source
- [ ] Limitations disclosed
- [ ] Code examples tested/validated
- [ ] Links point to real pages
- [ ] No marketing fluff
- [ ] Appropriate length (not too long/short)
- [ ] Consistent formatting
- [ ] No typos or grammar issues
```

### Success Criteria

#### Automated Verification
- [x] File exists: `ls .claude/agents/technical-writer.md`
- [x] Valid YAML frontmatter
- [x] Tools list matches: `Read, Grep, Glob, Write, Edit`
- [x] Model set to `sonnet`

#### Manual Verification
- [ ] Agent appears in Claude Code agent list
- [ ] Can be invoked via Task tool

---

## Phase 3: Create /changelog Command

### Overview
Create the `/changelog` command that orchestrates the skill and technical-writer agent to generate changelog entries from various inputs.

### Changes Required

#### 1. Create Command File
**File**: `.claude/commands/changelog.md`

```markdown
---
description: Generate changelog entries from PRs, URLs, or manual input. Output saved to thoughts/changelog/
model: opus
---

# Changelog Generator

Generate SEO-optimized, fact-checked changelog entries for Lightfast releases.

## Initial Response

When this command is invoked, check if arguments were provided:

**If arguments provided** (e.g., `/changelog #123` or `/changelog "Added feature X"`):
- Parse the input immediately
- Begin the changelog generation workflow

**If no arguments**, respond with:
```
I'll help you generate a changelog entry. Please provide one of:

1. **PR number(s)**: `/changelog #123` or `/changelog #123 #124 #125`
2. **PR URL(s)**: `/changelog https://github.com/lightfastai/lightfast/pull/123`
3. **Manual list**: `/changelog "Added semantic search, Fixed webhook retry logic, Improved chunking performance"`

I'll fact-check against implementation docs and generate an SEO-optimized entry.
```

Then wait for user input.

## Input Parsing

### Supported Formats

1. **Single PR number**: `#123` or `123`
2. **Multiple PR numbers**: `#123 #124 #125`
3. **PR URLs**: `https://github.com/{owner}/{repo}/pull/{number}`
4. **Manual text**: Quoted string with comma-separated changes
5. **Mixed**: Any combination of the above

### Parsing Logic

```
Input: #123 #124 https://github.com/lightfastai/lightfast/pull/125 "Manual change"

Parsed:
- PR #123 (fetch details)
- PR #124 (fetch details)
- PR #125 from URL (fetch details)
- Manual: "Manual change"
```

## Workflow Steps

### Step 1: Gather PR Information

For each PR number/URL:

1. Use `gh pr view {number} --json title,body,labels,files,commits` to fetch PR details
2. Extract:
   - Title and description
   - Files changed
   - Labels (feature, bugfix, etc.)
   - Commit messages

For manual input:
- Parse comma-separated items as individual changes

### Step 2: Read Implementation Status

Before writing, read and understand:
- `docs/architecture/implementation-status/README.md`
- Any referenced implementation docs

Cross-check PR claims against actual implementation status.

### Step 3: Categorize Changes

Group changes into:
- **Features**: New capabilities (use PR labels or title keywords)
- **Improvements**: Enhancements to existing features
- **Infrastructure**: Technical/platform changes
- **Fixes**: Bug fixes (usually not in changelog unless significant)

### Step 4: Generate Changelog Draft

Use the technical-writer agent with the changelog skill:

1. Load skill from `.claude/skills/changelog-writer/SKILL.md`
2. Apply templates from `resources/templates.md`
3. Follow SEO requirements from `resources/seo-requirements.md`
4. Generate draft following the document structure

### Step 5: Fact-Check and Validate

Run through checklist from `resources/checklist.md`:
- Verify every feature claim
- Check for overselling
- Ensure limitations disclosed
- Validate SEO elements

### Step 6: Save Output

**Filename format**: `{title-slug}-{YYYYMMDD-HHMMSS}.md`

**Title slug generation**:
- Take top 2-3 features from changelog
- Convert to kebab-case
- Max 50 characters

**Example**: `github-file-sync-semantic-search-20251217-143022.md`

**Output path**: `thoughts/changelog/{filename}`

### Step 7: Present Results

```
## Changelog Generated

**File**: `thoughts/changelog/{filename}`

### Summary
- {N} features documented
- {N} improvements listed
- {N} infrastructure changes

### SEO Elements
- Meta description: {150-160 chars}
- Internal links: {N}
- Code examples: {N}

### Next Steps
1. Review the generated changelog
2. Make any manual adjustments
3. Use `/publish-changelog` when ready to push to BaseHub

Would you like me to open the file for review?
```

## Output Template

The generated file should follow this structure:

```markdown
---
title: "{2-3 key features}"
slug: "{version-slug}"
description: "{150-160 char meta description}"
date: "{ISO date}"
status: draft
source_prs: ["{PR numbers}"]
---

# v{X.X} · {Month Day, Year}

**{2-3 key features as subtitle}**

---

{Generated content following skill templates}

---

## Metadata

- **Generated**: {timestamp}
- **Source PRs**: {list}
- **Status**: Draft (pending review)
- **Publish command**: `/publish-changelog thoughts/changelog/{filename}`
```

## Error Handling

### PR Not Found
```
Could not fetch PR #{number}. Please verify:
1. PR exists and is accessible
2. You have `gh` CLI authenticated: `gh auth status`
3. PR number is correct

Continuing with other inputs...
```

### No Implementation Status
```
Warning: Could not read implementation status docs.
Proceeding without fact-checking. Please manually verify all claims.
```

### Empty Input
```
No changes to document. Please provide:
- PR numbers: `/changelog #123`
- PR URLs: `/changelog https://github.com/.../pull/123`
- Manual list: `/changelog "Feature X, Improvement Y"`
```

## Important Notes

- Always fact-check against implementation docs
- Never oversell or make unverified claims
- Disclose limitations for partial features
- Include code examples for major features
- Output is a draft - human review required before publishing
```

### Success Criteria

#### Automated Verification
- [x] File exists: `ls .claude/commands/changelog.md`
- [x] Valid YAML frontmatter with `description` and `model`
- [x] No syntax errors

#### Manual Verification
- [ ] `/changelog` appears in available commands
- [ ] Help text displays when invoked without arguments
- [ ] PR parsing works for all input formats

---

## Phase 4: Create Output Directory & Validate

### Overview
Create the output directory structure and validate the entire workflow end-to-end.

### Changes Required

#### 1. Create Output Directory
**Command**: `mkdir -p thoughts/changelog`

#### 2. Create .gitkeep
**File**: `thoughts/changelog/.gitkeep`
(Empty file to ensure directory is tracked by git)

#### 3. End-to-End Test

Test the workflow manually:

```bash
# Test 1: Manual input
/changelog "Test feature for validation"

# Verify output exists
ls thoughts/changelog/

# Test 2: Help text
/changelog
# Should display usage instructions
```

### Success Criteria

#### Automated Verification
- [x] Directory exists: `ls -la thoughts/changelog/`
- [x] `.gitkeep` file exists
- [x] All previous phase files in place

#### Manual Verification
- [ ] `/changelog "Test feature"` generates valid output
- [ ] Output file has correct naming format
- [ ] Generated content follows skill templates
- [ ] SEO elements present (meta description, links, code examples)
- [ ] Checklist items can be verified

---

## Testing Strategy

### Unit Tests
Not applicable - this is a Claude Code skill/command system.

### Integration Tests
Not applicable - manual testing workflow.

### Manual Testing Steps

1. **Skill Discovery Test**
   - Start new Claude Code session
   - Ask "help me write release notes"
   - Verify skill is suggested/auto-activated

2. **Command Invocation Test**
   - Run `/changelog` without arguments
   - Verify help text displays

3. **Single PR Test**
   - Run `/changelog #123` (use real PR number)
   - Verify PR details fetched
   - Verify output generated

4. **Multiple Input Test**
   - Run `/changelog #123 "Manual change"`
   - Verify both inputs processed

5. **Output Format Test**
   - Check generated file follows template
   - Verify SEO elements present
   - Verify metadata section complete

6. **Fact-Check Test**
   - Include a claim about an incomplete feature
   - Verify it gets flagged or corrected

## Performance Considerations

- PR fetching via `gh` CLI is fast (<1s per PR)
- File reading for fact-checking adds ~2-3s
- Total generation time: 30-60s for typical changelog

## Migration Notes

### From Old Agent
The existing `vendor/cms/agents/changelog-writer.md` can be:
1. Kept as reference (no breaking change)
2. Deprecated with note pointing to new skill
3. Deleted after validation period

### Recommended Approach
Add deprecation notice to old file:
```markdown
> **DEPRECATED**: This agent has been migrated to Claude Code skills.
> Use `/changelog` command instead.
> See `.claude/skills/changelog-writer/SKILL.md`
```

## References

- Research: `thoughts/shared/research/2025-12-17-claude-code-skills-migration-analysis.md`
- Agent pattern: `.claude/agents/web-search-researcher.md`
- Command pattern: `.claude/commands/research-web.md`
- Original agent: `vendor/cms/agents/changelog-writer.md`
- Checklist: `vendor/cms/agents/changelog-checklist.md`

---

**Last Updated**: 2025-12-17
**Status**: Ready for implementation
**Estimated Files**: 8 new files, 1 directory
