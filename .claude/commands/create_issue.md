---
description: Create a GitHub issue using gh CLI
---

# Create GitHub Issue

Create a GitHub issue based on what the user describes.

## Templates

Refer to `.github/ISSUE_TEMPLATE/` for the available templates:
- `bug_report.md` — bugs and unexpected behavior
- `feature_request.md` — new features and improvements

## Process

1. **Understand the issue:**
   - Ask the user what type of issue this is (bug or feature) if not clear
   - Gather the title and key details from the conversation

2. **Draft the issue:**
   - Pick the appropriate template from `.github/ISSUE_TEMPLATE/`
   - Fill in the relevant sections based on what the user described
   - Keep it concise — don't pad with placeholders

3. **Present to the user:**
   - Show the title and body you'll use
   - Ask: "Shall I create this issue?"

4. **Create on confirmation:**
   ```bash
   gh issue create --title "<title>" --body "<body>" --label "<label>"
   ```
   - Show the issue URL when done

## Important

- Use `--label bug` for bug reports, `--label enhancement` for features
- Write in third person, present tense (e.g. "Search returns no results when...")
- Do not add assignees or milestones unless the user asks
