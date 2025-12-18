---
description: Publish a changelog draft from thoughts/changelog/ to BaseHub CMS
---

# Publish Changelog

Publish a reviewed changelog draft to BaseHub CMS.

## Workflow

When invoked, check if a file path was provided as an argument.

### If File Path Provided

Example: `/publish_changelog thoughts/changelog/my-changelog.md`

1. **Validate file exists:**
   - Use Read tool to load the file
   - If not found, show error and list available drafts

2. **Parse and preview:**
   - Extract YAML frontmatter using gray-matter parsing logic
   - Display preview to user:

   ```
   ## Publish Preview

   **Title**: {title}
   **Slug**: {slug} → lightfast.ai/changelog/{slug}
   **Date**: {publishedAt}

   **SEO**:
   - Focus keyword: {seo.focusKeyword}
   - Meta description: {seo.metaDescription} ({length} chars)
   - FAQ entries: {seo.faq.length or 0}

   **AEO**:
   - Excerpt: {excerpt} ({length} chars)
   - TLDR: {tldr} ({word count} words)

   **Status**: {_internal.status}

   **Content preview**:
   {first 200 chars of body}...
   ```

3. **Confirm before publishing:**
   - Use AskUserQuestion tool:
     - Question: "Ready to publish to BaseHub?"
     - Options: "Publish now", "Review file first", "Cancel"

4. **Execute publish:**
   - If user confirms "Publish now":
     ```bash
     cd apps/www && pnpm with-env pnpm tsx scripts/publish-changelog.ts {absolute_filepath}
     ```
   - Parse the JSON output from stdout
   - Handle errors from stderr

5. **Report results:**

   **On success:**
   ```
   ## Published Successfully

   **Changelog URL**: https://lightfast.ai/changelog/{slug}
   **BaseHub Dashboard**: https://basehub.com/lightfastai/lightfast/main/changelog

   The local file has been updated with `_internal.status: published`.
   ```

   **On failure:**
   ```
   ## Publish Failed

   **Error**: {error message}

   {Suggestions based on error type}
   ```

### If No File Path Provided

When invoked without arguments (`/publish_changelog`), respond with:

```
Please provide the changelog file to publish:

`/publish_changelog thoughts/changelog/{filename}.md`

**Available drafts:**
```

Then use Glob to find files in `thoughts/changelog/*.md` and for each file:
- Read the frontmatter
- Check `_internal.status`
- List files where status is `draft`

Format:
```
- `{filename}` — {title} (status: {status})
```

## Error Handling

### File Not Found
```
File not found: {filepath}

Available files in thoughts/changelog/:
{list of .md files}
```

### Already Published
```
This changelog has already been published.

Current status: published
Published at: {_internal.publishedAt}

If you need to update it, edit directly in BaseHub or use a different slug.
```

### Duplicate Slug
```
A changelog with slug '{slug}' already exists in BaseHub.

Options:
1. Change the `slug` field in your draft and try again
2. Delete the existing entry in BaseHub first
```

### Missing Required Fields
```
Missing required field: {field}

Required fields:
- title
- slug
- seo.metaDescription
- seo.focusKeyword

Please add the missing field and try again.
```

## Notes

- This command requires `BASEHUB_ADMIN_TOKEN` which is loaded via `pnpm with-env`
- The script automatically updates `_internal.status` to `published` after success
- The frontmatter structure maps directly to `ChangelogEntryInput` type
- No field mapping is needed - the script passes frontmatter directly to the mutation
