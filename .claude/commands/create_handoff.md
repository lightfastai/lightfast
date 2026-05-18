---
description: Create a concise handoff document for resuming work in another session
model: opus
---

# Create Handoff

You are tasked with writing a handoff document that transfers the current work to another agent in a new session. The handoff must be thorough enough to preserve critical context, but concise enough to be read quickly.

## Goal

Create a self-contained handoff under `thoughts/shared/handoffs/` that explains:

- What was being worked on
- What changed
- What was learned
- Which artifacts matter
- What the next agent should do first

This command is part of the `research_codebase` → `create_plan` → `implement_plan` workflow. If the current work relates to a research document or implementation plan, reference those documents explicitly.

Use this command when the user/developer explicitly asks for a handoff or when session context is approaching a practical limit, roughly 100k-120k tokens, and important details need to survive into a new session. Do not create handoffs as a routine phase-completion step; a concise final response is enough for normal stops.

Entire checkpoints may also exist through Claude hooks. Do not duplicate the full transcript. The handoff is the compact human-readable resume artifact for context-boundary moments: plan state, git state, verification state, debug evidence, and next action.

## Initial Setup

When invoked:

1. **Infer the scope** from the conversation, current git state, branch name, and any provided arguments.
2. **Determine the ticket number**:
   - Prefer an explicit `ENG-XXXX` argument if provided.
   - Otherwise infer from the current branch name or referenced plan/research documents.
   - If no ticket exists, use `general`.
3. **Determine a short kebab-case description**:
   - Prefer a concise description from the user argument.
   - Otherwise derive it from the task, plan title, branch name, or changed files.
4. **Gather metadata directly**:
   - Current date/time with timezone:
     `date +"%Y-%m-%dT%H:%M:%S%z"`
   - Current date:
     `date +"%Y-%m-%d"`
   - Current timestamp for filename:
     `date +"%Y-%m-%d_%H-%M-%S"`
   - Current commit:
     `git rev-parse HEAD`
   - Current branch:
     `git branch --show-current`
   - Repository name:
     `basename "$(git rev-parse --show-toplevel)"`
   - Researcher:
     `git config user.name` if available, otherwise `claude`
5. **Inspect current work**:
   - Run `git status --short`
   - Run `git diff --stat`
   - Run targeted `git diff` reads for files that changed during this task
   - Identify any research, plan, or implementation documents referenced in the current session
   - If `entire` is available, run `entire status` and include only relevant session/checkpoint context
   - If Lightfast debug skills were used, identify the primary debug block and strongest evidence

Do not run any external sync command. This repository stores handoffs directly in `thoughts/shared/handoffs/`.

## File Path

Create the handoff at:

```text
thoughts/shared/handoffs/ENG-XXXX/YYYY-MM-DD_HH-MM-SS_ENG-XXXX_description.md
```

For work without a ticket, create it at:

```text
thoughts/shared/handoffs/general/YYYY-MM-DD_HH-MM-SS_description.md
```

Examples:

- `thoughts/shared/handoffs/ENG-2166/2025-01-08_13-55-22_ENG-2166_create-context-compaction.md`
- `thoughts/shared/handoffs/general/2025-01-08_13-55-22_create-context-compaction.md`

Create the directory if it does not exist.

## Handoff Template

Write the document with YAML frontmatter followed by content:

```markdown
---
date: [Current date and time with timezone in ISO format]
researcher: [Researcher name]
git_commit: [Current commit hash]
branch: [Current branch name]
repository: [Repository name]
topic: "[Feature/Task Name] Handoff"
tags: [handoff, relevant-component-names]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
last_updated_by: [Researcher name]
type: handoff
---

# Handoff: ENG-XXXX concise description

## Task(s)

[Describe the task(s), including status for each: completed, in progress, planned, blocked, or discussed. If the work follows an implementation plan, name the current phase and link the plan document.]

## Plan State

[If working from a plan, list the plan path, current phase, completed phases, unchecked items, and blocked items. Leave blank if no plan applies.]

## Critical References

[List only the 2-3 most important docs/specs/architectural references. Use file paths. Leave blank if none.]

## Recent Changes

[Describe recent codebase/document changes made during the session. Prefer `path/to/file.ext:line` references. State clearly whether changes are committed or uncommitted.]

## Verification

[List commands/checks run with pass/fail/skipped status. Include manual verification status. If a check was skipped, state why.]

## Debug Evidence

[If debugging occurred, list primary debug block, secondary blocks, entrypoint/repro, failing request/run/provider action, persisted or provider truth, strongest evidence, and next decisive check. Use the Lightfast debug block names: browser, runtime, inngest, db, sdk, observability. Leave blank if none.]

## Learnings

[Record important discoveries, patterns, root causes, constraints, and file paths the next agent should know.]

## Artifacts

[Exhaustive list of artifacts produced or updated, including research docs, plans, handoff docs, generated files, or implementation files that should be read to resume.]

## Action Items & Next Steps

[List concrete next actions in priority order. Include verification commands that still need to run.]

## Other Notes

[Anything useful that does not fit above: relevant code areas, commands run, failed approaches, local dev server state, environment constraints, or review context.]
```

If there is no ticket, use:

```markdown
# Handoff: concise description
```

instead of including `ENG-XXXX`.

## Writing Guidelines

- Be precise and concrete. Prefer file paths and line references over broad summaries.
- Include enough context for a new agent to resume without rereading the whole conversation.
- Do not include large code snippets or diffs unless absolutely necessary.
- Distinguish committed changes from uncommitted changes.
- Distinguish completed work from suspected or planned work.
- Distinguish failed verification from skipped verification.
- Keep debug evidence in the same block vocabulary used by `lightfast-debug`: browser, runtime, Inngest, DB, SDK, observability.
- If files changed outside the current task already existed in the working tree, call that out instead of claiming ownership.
- Include failed commands, skipped verification, and blockers honestly.
- Keep the document self-contained; do not require access to the original conversation for basic continuity.

## Final Response

After creating the handoff, respond with exactly:

````markdown
Handoff created! You can resume from this handoff in a new session with the following command:

```bash
/resume_handoff path/to/handoff.md
```
````

Replace `path/to/handoff.md` with the actual handoff path.
