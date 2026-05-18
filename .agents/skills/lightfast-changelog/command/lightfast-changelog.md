---
description: Write or review an AEO-optimized Lightfast changelog entry. Triggers on "write a changelog", "draft changelog", "review changelog", "new release notes", "changelog entry for", or any request to author/edit content in apps/www/src/content/changelog/.
---

Use the lightfast-changelog skill to draft or review a changelog entry.

## Workflow

### Step 1: Load lightfast-changelog skill

```
skill({ name: 'lightfast-changelog' })
```

### Step 2: Determine intent

Analyze $ARGUMENTS to identify what the user wants:

- **Draft new entry**: Gather release details (version, date, type, features shipped) then write a new MDX file at `apps/www/src/content/changelog/YYYY-MM-DD-slug.mdx`
- **Review existing entry**: Read the specified MDX file and audit it against the AEO checklist in SKILL.md
- **Rewrite existing entry**: Apply AEO methodology to an existing entry — question-based headings, answer-first paragraphs, expanded FAQ
- **Update entry**: Edit an existing entry and bump `updatedAt` to today's date

### Step 3: Apply the AEO methodology

Follow every section of SKILL.md:

1. Answer-first opening paragraph (30-60 words)
2. Question-based H2 headings mirroring query fanout
3. Self-contained sections with atomic paragraphs
4. 5-7 FAQ items covering discovery, mechanism, capability, specifics
5. Trust signals (jobTitle, tldr, updatedAt)
6. Schema constraints (description 50-160 chars, ogTitle max 70, etc.)

### Step 4: Validate against the checklist

Before presenting the result, verify every item in the SKILL.md checklist. Call out any items that need human judgment (e.g., screenshot placeholders, version number confirmation).

### Step 5: Typecheck

After creating or editing the file, run typecheck to ensure the frontmatter validates:

```
pnpm --filter @lightfast/www typecheck
```

<user-request>
$ARGUMENTS
</user-request>
