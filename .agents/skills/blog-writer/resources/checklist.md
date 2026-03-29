# Pre-Publish Checklist

Run through this checklist before the `/create_blog` command writes the file.

## Frontmatter Validation

### Core Fields
- [ ] `title`: Present and compelling
- [ ] `description`: 150-160 chars (IS the meta description)
- [ ] `keywords[]`: min 3 entries, first is primary keyword
- [ ] `ogTitle`: max 70 chars
- [ ] `ogDescription`: 50-160 chars
- [ ] `ogImage`: valid URL
- [ ] `authors[]`: min 1 entry (name, url, twitterHandle)
- [ ] `publishedAt` / `updatedAt`: valid ISO datetime
- [ ] `category`: one of `engineering`, `company`, `product`, `tutorial`, `research`
- [ ] `readingTimeMinutes`: integer ≥ 1
- [ ] `featured`: boolean

### AEO Fields
- [ ] `tldr`: 20-300 chars, self-contained
- [ ] `faq[]`: min 1 Q&A pair

## Category-Specific Checks

### Engineering Posts (800-1,500 words)
- [ ] At least 1 code example per major section
- [ ] Technical metrics/benchmarks included
- [ ] "Why we built" section or equivalent
- [ ] 5-10 external citations

### Company Posts (300-800 words)
- [ ] Bold reframing statement in opening
- [ ] "Shift from/to" narrative present
- [ ] Executive quote included
- [ ] Forward-looking close
- [ ] 3-5 external citations

### Product Posts (500-1,000 words)
- [ ] Pain point identified in opening
- [ ] Feature breakdown with bullets
- [ ] Use cases section
- [ ] Availability statement
- [ ] 3-5 external citations

### Tutorial Posts (1,000-2,000 words)
- [ ] Step-by-step structure
- [ ] Code examples with language tags
- [ ] Prerequisites listed
- [ ] Troubleshooting section
- [ ] 5+ external citations

### Research Posts (1,200-2,000 words)
- [ ] Methodology section
- [ ] Data tables / visualizations
- [ ] 7-10 external citations (research papers preferred)
- [ ] Strong author credentials in bio

## Content Quality

### Structure
- [ ] `faq[]` in frontmatter with 3-5 questions
- [ ] Internal links: 3-5 to docs
- [ ] External links: 5+ authoritative sources
- [ ] Author bio at end of post

### Style
- [ ] No passive voice ("Users are able to" -> "You can")
- [ ] No marketing buzzwords without substance
- [ ] No emoji
- [ ] Professional tone
- [ ] Active, direct language

### Forbidden Patterns
- [ ] No "Coming soon" without conditional
- [ ] No vague feature names (be specific)
- [ ] No unverified claims
- [ ] No `## TL;DR` section in body (use frontmatter `tldr` instead)

## Red Flags (Automatic Rejection)

| Red Flag | Detection |
|----------|-----------|
| Missing TL;DR | `tldr` field undefined or empty |
| TL;DR too short | Less than 20 chars |
| Missing FAQ | `faq` empty or undefined |
| No code examples | Engineering/Tutorial post without code blocks |
| Over length | Exceeds category word limit |
| Under length | Below category minimum |
| Wrong category | `technology` used instead of `engineering` |
| Meta description wrong length | `description` outside 150-160 chars |
