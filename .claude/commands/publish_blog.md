---
description: Publish a blog draft from thoughts/blog/ to BaseHub CMS
---

# Publish Blog

Publish a reviewed blog draft to BaseHub CMS.

## Workflow

When invoked, check if a file path was provided as an argument.

### If File Path Provided

Example: `/publish_blog thoughts/blog/my-post.md`

1. **Validate file exists:**
   - Use Read tool to load the file
   - If not found, show error and list available drafts

2. **Parse and preview:**
   - Extract YAML frontmatter
   - Display preview to user:

   ```
   ## Publish Preview

   **Title**: {title}
   **Slug**: {slug} -> lightfast.ai/blog/{slug}
   **Category**: {category}
   **Date**: {publishedAt}

   **SEO**:
   - Focus keyword: {seo.focusKeyword}
   - Meta description: {seo.metaDescription} ({length} chars)
   - FAQ entries: {seo.faq.length or 0}

   **AEO**:
   - Excerpt: {excerpt} ({length} chars)
   - TL;DR: {tldr} ({word count} words)

   **Author**: {author}
   **Status**: {_internal.status}

   **Content preview**:
   {first 200 chars of body}...
   ```

3. **Recommend validation first:**
   - If `_internal.status` is `draft`, suggest:
     ```
     This post hasn't been validated yet.
     Consider running `/validate_blog {filepath}` first.
     ```

4. **Confirm before publishing:**
   - Use AskUserQuestion tool:
     - Question: "Ready to publish to BaseHub?"
     - Options: "Publish now", "Validate first", "Cancel"

5. **Execute publish:**
   - If user confirms "Publish now":
     ```bash
     cd apps/www && pnpm with-env pnpm tsx scripts/publish-blog.ts {absolute_filepath}
     ```
   - Parse the JSON output from stdout
   - Handle errors from stderr

6. **Report results:**

   **On success:**
   ```
   ## Published Successfully

   **Blog URL**: https://lightfast.ai/blog/{slug}
   **BaseHub Dashboard**: https://basehub.com/lightfastai/lightfast/main/blog

   The local file has been updated with `_internal.status: published`.

   Note: Post is created as draft in BaseHub. Publish from dashboard when ready to go live.
   ```

   **On failure:**
   ```
   ## Publish Failed

   **Error**: {error message}

   Common issues:
   - Category not found: Verify category slug matches BaseHub
   - Author not found: Verify author exists in BaseHub
   - Missing fields: Run /validate_blog to check
   ```

### If No File Path Provided

When invoked without arguments (`/publish_blog`), respond with:

```
Please provide the blog file to publish:

`/publish_blog thoughts/blog/{filename}.md`

**Available drafts:**
```

Then use Glob to find files in `thoughts/blog/*.md` and for each file:
- Read the frontmatter
- Check `_internal.status`
- List files where status is `draft`

Format:
```
- `{filename}` -- {title} (category: {category}, status: {status})
```

## Error Handling

### File Not Found
```
File not found: {filepath}

Available files in thoughts/blog/:
{list of .md files}
```

### Already Published
```
This blog post has already been published.

Current status: published
Published at: {_internal.publishedAt}

If you need to update it, edit directly in BaseHub or create a new post.
```

### Missing Required Fields
```
Missing required field: {field}

Required fields:
- title, slug, publishedAt, category
- excerpt, tldr
- seo.metaDescription, seo.focusKeyword
- author

Please add the missing field and try again, or run /validate_blog first.
```

## Notes

- This command requires `BASEHUB_ADMIN_TOKEN` which is loaded via `pnpm with-env`
- The script creates posts as "draft" in BaseHub for final review
- Publish to live from BaseHub dashboard
- Author is hardcoded to "jeevanpillay" for now
- The frontmatter structure maps to `AIGeneratedPost` type
