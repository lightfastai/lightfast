# Changelog Pre-Publish Checklist

Quick checklist before publishing. 2 minutes max.

## 1. Fact Check (Critical)

Verify claims against the codebase:

- [ ] Every feature mentioned is actually complete
- [ ] Incomplete features marked "Not yet" or "when N+ customers request"
- [ ] No overselling (e.g., "GitHub Integration" → "GitHub File Sync (File Contents)")
- [ ] Limitations disclosed (what's NOT included)

## 2. Frontmatter Validation (Required)

- [ ] `title`: 2-3 key features, clear and specific
- [ ] `description`: 150-160 characters (count: ___)
- [ ] `keywords[]`: min 3 entries — first is primary keyword
- [ ] `ogTitle`: max 70 chars
- [ ] `ogDescription`: 50-160 chars
- [ ] `ogImage`: valid URL
- [ ] `authors[]`: min 1 entry with name, url, twitterHandle
- [ ] `publishedAt` / `updatedAt`: valid ISO datetime format
- [ ] `version`: present (e.g., "v0.1.0")
- [ ] `type`: one of feature | improvement | fix | breaking
- [ ] `tldr`: 20-300 chars, self-contained summary
- [ ] `faq[]`: min 1 Q&A pair
- [ ] `_draft: true`: set

## 3. Filename

- [ ] Draft filename: `YYYY-MM-DD-{descriptive-slug}.md`
- [ ] Slug is URL-safe kebab-case, version or feature-themed

## 4. SEO Content

- [ ] 3+ internal links to docs
- [ ] At least 1 code example per major feature
- [ ] Technical specifics present (not just marketing fluff)
- [ ] Primary keyword (keywords[0]) appears naturally in body 2-3 times

## 5. Style

- [ ] 1-3 sentences per feature (not long paragraphs)
- [ ] "You can now..." not "Users are able to..."
- [ ] No emoji
- [ ] Professional tone throughout

## 6. Red Flags

**DO NOT PUBLISH if you see:**

- "Coming soon: Linear, Notion" (use "when 3+ customers request")
- "GitHub Integration" without specifying what (files/PRs/issues)
- Claims about features not yet in production
- No limitations disclosed for partial features
- `description` missing or outside 150-160 chars
- No code examples
- `tldr` missing or too short (< 20 chars)
- `faq` empty or missing
- `keywords[0]` not present in body text
- `faq` questions don't match real search queries

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
- [ ] Did I verify against the codebase?
- [ ] Would a developer hit any surprises?
