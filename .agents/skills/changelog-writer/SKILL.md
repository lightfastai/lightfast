---
name: changelog-writer
description: Create user-focused, SEO-optimized changelog entries for software releases. Use when writing release notes, version updates, product changelogs, or "what's new" documentation for developer tools.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Changelog Writer

Create clear, accurate changelog entries that help developers understand what's new in Lightfast releases.

## Critical: Fact-Check First

Before writing anything, verify claims against the actual codebase:

1. **Check implementation status** to verify:
   - What's actually completed vs planned
   - Current limitations and known gaps
   - Technical accuracy of claims

2. **Never oversell:**
   - Use specific names: "GitHub File Sync (File Contents)" not "GitHub Integration"
   - Disclose limitations: "Currently supports X; Y coming in vZ"
   - Be honest about conditionals: "when 3+ customers request"

3. **Verify every claim:**
   - If you cite a number, confirm it's in the codebase
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
8. **SEO-conscious**: Use target keywords naturally in `description` and `keywords[]`
9. **AEO-conscious**: Write `tldr` for AI citation engines
10. **FAQ quality**: Questions must match real search queries, answers must be complete

## Workflow

1. **Gather input**: PR numbers, URLs, or manual change list
2. **Fact-check claims** against the codebase
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

## Output

Save drafts to: `thoughts/changelog/{YYYY-MM-DD-title-slug}.md`

### Required Frontmatter Fields

Every draft MUST include (maps to `ChangelogEntrySchema` in `apps/www/src/lib/content-schemas.ts`):
- `title` (core)
- `description` (150-160 chars — this is the meta description)
- `keywords[]` (min 3 — first entry is the primary keyword)
- `ogTitle`, `ogDescription`, `ogImage` (social/OG)
- `authors[]` (structured array with name, url, twitterHandle)
- `publishedAt`, `updatedAt` (ISO datetimes)
- `version` (e.g., "v0.1.0")
- `type` (feature | improvement | fix | breaking)
- `tldr` (20-300 chars)
- `faq[]` (min 1 entry)
- `_draft: true` (traceability)

See `resources/templates.md` for complete frontmatter template.

The `/create_changelog` command writes the `.mdx` file directly to `apps/www/src/content/changelog/`.

## Resources

- [Document Templates](resources/templates.md)
- [SEO Requirements](resources/seo-requirements.md)
- [Examples](resources/examples.md)
- [Pre-Publish Checklist](resources/checklist.md)
