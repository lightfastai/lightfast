---
description: Commit changes, create PR, and merge into main in one shot
---

# Oneshot Merge

You are tasked with taking the current changes, committing them, creating a PR, and merging into main — all in one flow with user approval.

## Process:

1. **Understand what changed:**
   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes
   - Run `git diff` to understand the modifications
   - Run `git log --oneline -5` to see recent commit history and branch state

2. **Plan your commit(s):**
   - Identify which files belong together
   - Draft clear, descriptive commit messages (imperative mood, focus on why)
   - Consider whether changes should be one commit or multiple logical commits
   - Draft a PR title (under 70 chars) and summary

3. **Present the full plan to the user:**
   - List the files you plan to add for each commit
   - Show the commit message(s) you'll use
   - Show the PR title and summary
   - Confirm: merge target is `main`
   - Ask: "I plan to create [N] commit(s), open a PR, and merge to main. Shall I proceed?"

4. **Execute upon confirmation:**
   - Create a branch if not already on one (use a descriptive branch name)
   - Use `git add` with specific files (never use `-A` or `.`)
   - Create commits with your planned messages
   - Push to remote with `-u` flag
   - Create PR using `gh pr create` with title and body
   - Merge using `gh pr merge --merge --delete-branch`
   - Show the merged PR URL

## Remember:

- You have the full context of what was done in this session
- Group related changes together
- Keep commits focused and atomic when possible
- NEVER proceed without explicit user approval
- If on `main`, create a feature branch first
- If any step fails, stop and report — don't retry destructive operations
