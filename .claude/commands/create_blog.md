---
description: Create blog posts with category-aware styling. Output saved to thoughts/blog/
model: sonnet
---

# Blog Generator

Generate AEO-optimized, category-aware blog posts for Lightfast.

## CRITICAL: Match Category Voice

- **Technology**: Technical authority, code examples, data-driven
- **Company**: Visionary, bold, category-defining
- **Product**: Problem-solver, benefit-oriented, customer-focused

## Initial Response

When this command is invoked, check if arguments were provided:

**If arguments provided** (e.g., `/create_blog "How vector search works"` or `/create_blog technology "MCP integration"`):
- Parse the input immediately
- Detect or use provided category
- Begin the blog generation workflow

**If no arguments**, respond with:
```
I'll help you generate a blog post. Please provide:

1. **Topic with category**: `/create_blog technology "How vector search improves code retrieval"`
2. **Topic only** (I'll detect category): `/create_blog "Announcing our Series A"`
3. **URL for reference**: `/create_blog https://example.com/reference-article`

Categories: technology, company, product

I'll research the topic, apply category styling, and generate an AEO-optimized draft.
```

Then wait for user input.

## Input Parsing

### Supported Formats

1. **Topic only**: `"Topic description"` - category auto-detected
2. **Category + topic**: `technology "Topic description"`
3. **URL**: `https://...` - extract topic from URL content
4. **Brief file**: `thoughts/briefs/topic.md` - read structured brief

### Category Detection

If category not specified, infer from topic:
- Technical terms (API, SDK, architecture) -> `technology`
- Funding, partnership, hiring -> `company`
- Feature, update, launch -> `product`

Ask user to confirm if uncertain.

## Workflow Steps

1. **Parse input and detect category:**
   - Extract topic from arguments
   - Detect or confirm category
   - Load category style from `.claude/skills/blog-writer/resources/categories/{category}.md`

2. **Create tracking plan using TodoWrite:**
   - Research tasks
   - Outline generation
   - Draft writing
   - AEO element creation

3. **Research topic:**
   - Use `web-search-researcher` agent for external context
   - Use `codebase-locator` agent if topic involves Lightfast features
   - Gather 5+ authoritative sources for citations

4. **Generate outline based on category template:**
   - Load template from `.claude/skills/blog-writer/resources/templates.md`
   - Apply category-specific structure
   - Present outline for user approval before proceeding

5. **Ask for approval on outline:**
   - Show proposed structure
   - Confirm category selection
   - Get go-ahead to write full draft

6. **Generate full draft:**
   - Apply category voice and tone
   - Include all required AEO elements
   - Add code examples (Technology)
   - Include quotes (Company)
   - Add use cases (Product)

7. **Add SEO/AEO elements:**
   - Generate TL;DR (80-100 words)
   - Write excerpt (max 300 chars)
   - Create meta description (150-160 chars)
   - Generate 3-5 FAQ questions
   - Compile external citations

8. **Save output:**
   - **Filename format**: `{slug}-{YYYYMMDD-HHMMSS}.md`
   - **Output path**: `thoughts/blog/{filename}`
   - Example: `how-vector-search-works-20251221-143022.md`

9. **Present results:**
   ```
   ## Blog Post Generated

   **File**: `thoughts/blog/{filename}`
   **Category**: {category}
   **Word Count**: {count} ({expected range for category})

   ### Summary
   - Title: {title}
   - Slug: {slug}
   - Focus Keyword: {keyword}

   ### AEO Elements
   - TL;DR: {word count} words
   - FAQ: {count} questions
   - External Citations: {count}
   - Internal Links: {count}

   ### Next Steps
   1. Review the generated draft
   2. Make any manual adjustments
   3. Use `/validate_blog` to check for issues
   4. Use `/publish_blog` when ready

   Would you like me to open the file for review?
   ```

## Error Handling

### Category Detection Failed
```
I couldn't determine the category for "{topic}".

Please specify:
- `/create_blog technology "{topic}"` - for technical deep-dives
- `/create_blog company "{topic}"` - for announcements, partnerships
- `/create_blog product "{topic}"` - for feature launches
```

### Research Failed
```
Warning: Limited research results for "{topic}".
Proceeding with available sources. Consider adding more context.
```

## Important Notes

- Always get outline approval before writing full draft
- Match category word count ranges strictly
- Include all required AEO elements
- Verify claims using codebase agents when discussing Lightfast features
- Output is a draft - human review required before publishing
