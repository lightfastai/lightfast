---
description: Generate and write changelog entries from PRs, URLs, or manual input directly to apps/www/src/content/changelog/
model: sonnet
---

# Changelog Generator

Generate SEO-optimized, fact-checked changelog entries and write them directly to the fumadocs content directory.

## CRITICAL: Accuracy Over Marketing

- **NEVER** oversell or make unverified claims
- **NEVER** use vague feature names (e.g., "GitHub Integration" — be specific: "GitHub File Sync")
- **ALWAYS** disclose limitations for partial features
- **ALWAYS** fact-check against live codebase using agents before writing
- **ALWAYS** include code examples for major features

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
3. **Manual list**: `/changelog "Added semantic search, Fixed webhook retry logic"`

I'll fact-check against the codebase and write the entry to apps/www/src/content/changelog/.
```

Then wait for user input.

## Steps

1. **Parse input and gather PR information:**
   - For each PR number/URL: `gh pr view {number} --json title,body,labels,files,commits`
   - For manual input, parse comma-separated items as individual changes
   - **Complete this step before spawning any sub-agents**

2. **Ask for version:**
   - Use `AskUserQuestion`: "What version is this changelog for? (e.g., v0.4.0)"
   - Goes directly into the `version` frontmatter field

3. **Create tracking plan using TodoWrite**

4. **Spawn parallel sub-agents for fact-checking:**
   - **codebase-locator** — find WHERE feature code lives
   - **codebase-analyzer** — understand HOW features work
   - **codebase-pattern-finder** — find usage patterns and examples

5. **Wait for all sub-agents, synthesize findings:**
   - Compile verification results
   - Note discrepancies between PR claims and actual implementation
   - Identify limitations to disclose

6. **Determine `type`:**
   - `feature` | `improvement` | `fix` | `breaking`
   - Use dominant change type if mixed

7. **Generate changelog** following `.agents/skills/changelog-writer/SKILL.md`:
   - 1-3 sentences per feature
   - Lead with benefit
   - Code examples for major features
   - Disclose limitations

8. **Determine filename:**
   - Format: `YYYY-MM-DD-{title-slug}.mdx`
   - Date from `publishedAt`, slug from top 2-3 features kebab-cased
   - Example: `2025-01-15-github-file-sync-semantic-search.mdx`

9. **Write the file to `apps/www/src/content/changelog/{filename}`**

10. **Present results:**
    ```
    ## Changelog Written

    **File**: apps/www/src/content/changelog/{filename}
    **URL**: https://lightfast.ai/changelog/{slug}

    - Version: {version}
    - Type: {type}
    - {N} features documented

    The entry is live on next build. Use `/validate_changelog` to audit.
    ```

## Frontmatter Schema

Maps to `ChangelogEntrySchema` in `apps/www/src/lib/content-schemas.ts`:

```yaml
---
title: "Feature Name, Feature Name"
description: "150-160 char meta description with version and keyword"
keywords:
  - "primary keyword phrase"
  - "secondary keyword"
  - "additional keyword"
canonicalUrl: "https://lightfast.ai/changelog/YYYY-MM-DD-slug"  # optional
ogTitle: "Title for social sharing (max 70 chars)"
ogDescription: "50-160 char OG description"
ogImage: "https://lightfast.ai/images/og-default.png"
noindex: false
nofollow: false
authors:
  - name: "Jeevan Pillay"
    url: "https://lightfast.ai"
    twitterHandle: "@jeevanpillay"
publishedAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
version: "v0.X.0"
type: "feature"  # feature | improvement | fix | breaking
tldr: "20-300 char summary for AI citation."
faq:
  - question: "What is [feature]?"
    answer: "Concise answer for featured snippets."
  - question: "How do I [action]?"
    answer: "Step-by-step answer."
---

# v{X.X} · {Month Day, Year}

**{2-3 key features as subtitle}**

---

{Generated content following skill templates}
```

## Error Handling

### PR Not Found
```
Could not fetch PR #{number}. Verify gh auth status and PR number.
Continuing with other inputs...
```

### Verification Failed
```
Warning: Could not verify "{claim}" in codebase.
Proceeding with verified claims only.
```

## Important Notes

- Fact-check before writing — unverified claims don't ship
- Wait for ALL sub-agents before generating
- Accuracy over completeness — fewer accurate features beats many inaccurate ones
