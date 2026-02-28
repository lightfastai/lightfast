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


# CodeRabbit CLI Helper

AI-powered code review using CodeRabbit. Enables developers to implement features, review code, and fix issues in autonomous cycles without manual intervention.

## Capabilities

- Finds bugs, security issues, and quality risks in changed code
- Groups findings by severity (Critical, Warning, Info)
- Works on staged, committed, or all changes; supports base branch/commit
- Provides fix suggestions (`--plain`) or minimal output for agents (`--prompt-only`)

## When to Use

When user asks to:

- Review code changes / Review my code
- Check code quality / Find bugs or security issues
- Get PR feedback / Pull request review
- What's wrong with my code / my changes
- Run coderabbit / Use coderabbit

## How to Review

### 1. Check Prerequisites

```bash
coderabbit --version 2>/dev/null || echo "NOT_INSTALLED"
coderabbit auth status 2>&1
```

**If CLI not installed**, tell user:

```text
Please install CodeRabbit CLI first:
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

**If not authenticated**, tell user:

```text
Please authenticate first:
coderabbit auth login
```

### 2. Run Review

Use `--prompt-only` for minimal output optimized for AI agents:

```bash
coderabbit review --prompt-only
```

Or use `--plain` for detailed feedback with fix suggestions:

```bash
coderabbit review --plain
```

**Options:**

| Flag             | Description                              |
| ---------------- | ---------------------------------------- |
| `-t all`         | All changes (default)                    |
| `-t committed`   | Committed changes only                   |
| `-t uncommitted` | Uncommitted changes only                 |
| `--base main`    | Compare against specific branch          |
| `--base-commit`  | Compare against specific commit hash     |
| `--prompt-only`  | Minimal output optimized for AI agents   |
| `--plain`        | Detailed feedback with fix suggestions   |

**Shorthand:** `cr` is an alias for `coderabbit`:

```bash
cr review --prompt-only
```

### 3. Present Results

Group findings by severity:

1. **Critical** - Security vulnerabilities, data loss risks, crashes
2. **Warning** - Bugs, performance issues, anti-patterns
3. **Info** - Style issues, suggestions, minor improvements

Create a task list for issues found that need to be addressed.

### 4. Fix Issues (Autonomous Workflow)

When user requests implementation + review:

1. Implement the requested feature
2. Run `coderabbit review --prompt-only`
3. Create task list from findings
4. Fix critical and warning issues systematically
5. Re-run review to verify fixes
6. Repeat until clean or only info-level issues remain

### 5. Review Specific Changes

**Review only uncommitted changes:**

```bash
cr review --prompt-only -t uncommitted
```

**Review against a branch:**

```bash
cr review --prompt-only --base main
```

**Review a specific commit range:**

```bash
cr review --prompt-only --base-commit abc123
```

## Documentation

For more details: <https://docs.coderabbit.ai/cli>
