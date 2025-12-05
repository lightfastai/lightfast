# Changelog Review Checklist

Quick checklist before publishing to BaseHub. 2 minutes max.

## 1. Fact Check (Critical)

Compare against `docs/architecture/implementation-status/README.md`:

- [ ] Every feature mentioned is actually complete
- [ ] Incomplete features marked "Not yet" or "when N+ customers request"
- [ ] No overselling (e.g., "GitHub Integration" → "GitHub File Sync (File Contents)")
- [ ] Limitations disclosed (what's NOT included)

## 2. SEO Basics

- [ ] Description field in BaseHub: 150-160 characters with keywords
- [ ] 3+ internal links to docs (`/docs/quick-start`, `/docs/integrations/github`, etc.)
- [ ] At least 1 code example (config snippet or API call)
- [ ] Technical specifics present (not just marketing fluff)

**Note:** Structured data (JSON-LD) is auto-generated - no manual action needed.

## 3. Style

- [ ] 1-3 sentences per feature (not long paragraphs)
- [ ] "You can now..." not "Users are able to..."
- [ ] No emoji
- [ ] Structured data in frontmatter (schema field with JSON-LD)

## 4. Red Flags

🚫 **DO NOT PUBLISH if you see:**

- "Coming soon: Linear, Notion" (use "when 3+ customers request")
- "GitHub Integration" without specifying what (files/PRs/issues)
- Claims about features at 0% in implementation docs
- No limitations disclosed for partial features
- Meta description missing or >160 chars
- No code examples

## Quick Reference

### ❌ Bad
"Plans for Linear, Notion, and Slack integrations!"

### ✅ Good
"When 3+ customers request: Linear integration (1-2 week implementation)"

---

### ❌ Bad
"GitHub Integration is live"

### ✅ Good
"GitHub Repository Sync (File Contents). Not yet: PR metadata (v0.2)"

---

**Template:** `changelog-v0.1-revised.md` (reference)
**Agent prompt:** `vendor/cms/agents/changelog-writer.md`
