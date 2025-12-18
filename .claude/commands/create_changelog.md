---
description: Generate changelog entries from PRs, URLs, or manual input. Output saved to thoughts/changelog/
model: opus
---

# Changelog Generator

Generate SEO-optimized, fact-checked changelog entries for Lightfast releases.

## CRITICAL: Accuracy Over Marketing

- **NEVER** oversell or make unverified claims
- **NEVER** use vague feature names (e.g., "GitHub Integration" - be specific: "GitHub File Sync")
- **ALWAYS** disclose limitations for partial features
- **ALWAYS** fact-check against live codebase using agents before writing
- **ALWAYS** include code examples for major features
- You are creating accurate technical documentation, not marketing copy

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

I'll fact-check against the codebase and generate an SEO-optimized entry.
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

## Steps to follow after receiving input:

1. **Parse input and gather PR information:**
   - For each PR number/URL, use `gh pr view {number} --json title,body,labels,files,commits`
   - Extract: title, description, files changed, labels, commit messages
   - For manual input, parse comma-separated items as individual changes
   - **CRITICAL**: Complete this step before spawning any sub-agents

2. **Ask for version number:**
   - Use `AskUserQuestion` to prompt for the changelog version
   - Question: "What version number is this changelog for?"
   - Accept either format: `4` or `0-4` (both produce slug prefix `0-4`)
   - Parse the input:
     - If user enters `4` → version is `4`
     - If user enters `0-4` → version is `4` (strip the `0-` prefix)
   - The final slug will be: `0-{version}-lightfast-{feature-slug}`
   - Example: version `4` + features "Neural Memory" → `0-4-lightfast-neural-memory`

3. **Create tracking plan using TodoWrite:**
   - Break down the changelog into trackable items
   - Create todos for each feature/change to document
   - Track fact-checking progress for each claim

4. **Spawn parallel sub-agents for fact-checking:**
   - Create multiple Task agents to verify claims concurrently
   - Use specialized agents that know how to research the codebase:

   **For locating implementations:**
   - Use the **codebase-locator** agent to find WHERE feature code lives
   - Example: "Find where GitHub file sync webhook handlers are implemented"

   **For understanding implementations:**
   - Use the **codebase-analyzer** agent to understand HOW features work
   - Example: "Analyze the semantic search implementation - what vector DB, what chunking strategy"

   **For finding usage patterns:**
   - Use the **codebase-pattern-finder** agent to find existing patterns and examples
   - Example: "Find examples of how hybrid search combines vector and full-text results"

   The key is to use these agents intelligently:
   - Start with locator agents to find what exists
   - Then use analyzer agents on the most promising findings
   - Run multiple agents in parallel when verifying different features
   - Each agent knows its job - just tell it what you're looking for
   - Don't write detailed prompts about HOW to search - the agents already know

5. **Wait for all sub-agents to complete and synthesize findings:**
   - **IMPORTANT**: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile verification results for each claimed feature
   - Note any discrepancies between PR claims and actual implementation
   - Identify limitations or partial implementations to disclose
   - Include specific file paths for reference

6. **Categorize changes:**
   - Group verified changes into:
     - **Features**: New capabilities (use PR labels or title keywords)
     - **Improvements**: Enhancements to existing features
     - **Infrastructure**: Technical/platform changes
     - **Fixes**: Bug fixes (usually not in changelog unless significant)
   - Remove or flag any claims that couldn't be verified

7. **Generate changelog using skill templates:**
   - Load skill from `.claude/skills/changelog-writer/SKILL.md`
   - Apply templates from `resources/templates.md`
   - Follow SEO requirements from `resources/seo-requirements.md`
   - Run through checklist from `resources/checklist.md`
   - **Key requirements**:
     - 1-3 sentences per feature (Cursor-style brevity)
     - Lead with benefit, then how
     - Include code examples for major features
     - Disclose beta status, limitations
     - No emoji - professional tone
     - **DO NOT include "Key files:" sections** - file references belong ONLY in the Metadata section at the bottom under "Fact-checked files"

8. **Save output:**
   - **Filename format**: `{title-slug}-{YYYYMMDD-HHMMSS}.md`
   - **Title slug**: Top 2-3 features in kebab-case, max 50 characters
   - **Output path**: `thoughts/changelog/{filename}`
   - Example: `github-file-sync-semantic-search-20251217-143022.md`

9. **Present results:**
   ```
   ## Changelog Generated

   **File**: `thoughts/changelog/{filename}`

   ### Summary
   - {N} features documented
   - {N} improvements listed
   - {N} infrastructure changes

   ### Fact-Check Results
   - {N} claims verified against codebase
   - {N} limitations disclosed
   - Files referenced: {list}

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

## Output Format

Save to: `thoughts/changelog/{title-slug}-{YYYYMMDD-HHMMSS}.md`

The frontmatter structure maps directly to `ChangelogEntryInput` type, enabling zero-mapping publish via `/publish_changelog`.

```yaml
---
# Fields that map directly to ChangelogEntryInput
title: "{2-3 key features}"
slug: "0-{version}-lightfast-{feature-slug}"  # e.g., "0-1-lightfast-github-file-sync"
publishedAt: "{YYYY-MM-DD}"
excerpt: "{Max 300 char summary for listings and RSS feeds}"
tldr: "{50-100 word summary for AI citation. Self-contained paragraph covering key user benefits.}"

# Categorized change sections (optional, arrays converted to bullet lists)
improvements:
  - "{Enhancement to existing feature}"
infrastructure:
  - "{Platform/architecture change}"
fixes:
  - "{Bug fix description}"
patches:
  - "{Security or dependency update}"

# SEO nested object (matches ChangelogSeoInput)
seo:
  metaDescription: "{150-160 char meta description with version and focus keyword}"
  focusKeyword: "{primary keyword phrase}"
  secondaryKeyword: "{optional secondary keyword}"
  faq:
    - question: "{What is [feature]?}"
      answer: "{Concise answer for featured snippets}"
    - question: "{How do I [action]?}"
      answer: "{Step-by-step answer}"

# Internal fields (stripped before publish, not sent to BaseHub)
_internal:
  status: draft
  source_prs: ["{PR numbers and commit hashes}"]
  generated: "{ISO timestamp}"
  fact_checked_files:
    - "{file:line references}"
---

# v{X.X} · {Month Day, Year}

**{2-3 key features as subtitle}**

---

{Generated content following skill templates}
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

### Agent Verification Failed
```
Warning: Could not verify claim "{claim}" in codebase.
Options:
1. Remove claim from changelog
2. Mark as "unverified" for manual review
3. Provide additional context for re-verification

Proceeding with verified claims only...
```

### Empty Input
```
No changes to document. Please provide:
- PR numbers: `/changelog #123`
- PR URLs: `/changelog https://github.com/.../pull/123`
- Manual list: `/changelog "Feature X, Improvement Y"`
```

## Important Notes

- Always use parallel Task agents to maximize efficiency and minimize context usage
- Each sub-agent prompt should be specific and focused on verification
- Keep the main agent focused on synthesis, not deep file reading
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS fetch PR data first before spawning sub-tasks (step 1)
  - ALWAYS ask for version number before fact-checking (step 2)
  - ALWAYS wait for all sub-agents to complete before writing (step 5)
  - NEVER write the changelog with unverified claims
- **Accuracy first**: It's better to document fewer features accurately than many features incorrectly
- **Disclosure over hype**: Always disclose limitations, beta status, partial implementations
- Output is a draft - human review required before publishing
