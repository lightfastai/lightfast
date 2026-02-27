---
description: Run CodeRabbit review and save findings to thoughts/reviews/
model: haiku
---

# CodeRabbit Review

Run a CodeRabbit code review and save the output. That's it — don't process or fix any findings.

## Step 1: Determine Scope

Ask the user what to review if not clear from `$ARGUMENTS`. Here are the `coderabbit review` options:

| Scope | Flag | Example |
|-------|------|---------|
| All local changes (default) | _(none)_ | `coderabbit review --prompt-only --no-color` |
| Only committed | `--type committed` | Already committed but not pushed |
| Only uncommitted | `--type uncommitted` | Work-in-progress, staged + unstaged |
| Branch diff | `--base <branch>` | `--base main` to review entire feature branch |
| From a commit | `--base-commit <sha>` | Review from a specific point in history |
| Extra instructions | `--config <files...>` | Feed CLAUDE.md or other context to CodeRabbit |
| Different directory | `--cwd <path>` | Run against a different repo/path |

**Always include:** `--prompt-only --no-color`
- `--prompt-only` outputs structured findings delimited by `============` with "Prompt for AI Agent" sections
- `--no-color` ensures clean file output

## Step 2: Run and Save

Run the command in the background — reviews can take **5-30+ minutes** for large diffs:

```bash
mkdir -p thoughts/reviews
coderabbit review --prompt-only --no-color [flags] > thoughts/reviews/$(date '+%Y-%m-%d')-<name>.md 2>&1
```

Use a descriptive name based on branch or scope (e.g. `2026-02-26-feat-gateway-foundation.md`).

**Run this using Bash with `run_in_background: true`** so the user isn't blocked.

## Step 3: Report

When the command finishes, tell the user:
- Output file path
- Line count (`wc -l`)
- Number of findings (`grep -c "^====" <file>`)
- Remind them they can use `./afk-review.sh <file>` to process findings
