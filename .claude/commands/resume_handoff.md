---
description: Resume work from a handoff document with context analysis and validation
model: opus
---

# Resume Handoff

You are tasked with resuming work from a handoff document. Handoffs contain critical context, learnings, artifacts, and next steps from a previous session. Your job is to validate that context against the current codebase before continuing.

## Initial Response

When this command is invoked:

### If a handoff path was provided

1. Skip the default message.
2. Immediately read the handoff document completely.
3. Immediately read any linked documents under:
   - `thoughts/shared/plans/`
   - `thoughts/shared/research/`
4. Do not use a sub-agent to read the handoff, plan documents, or research documents. Read these critical continuity artifacts in the main context.
5. Begin analysis by reading additional files mentioned in the handoff.
6. Present the current situation and recommended course of action to the user before implementing.

### If a ticket number was provided

Ticket numbers look like `ENG-XXXX`.

1. Do not run any external sync command.
2. Locate handoffs in:

   ```text
   thoughts/shared/handoffs/ENG-XXXX/
   ```

3. List the directory contents.
4. If the directory does not exist, or there are zero files, tell the user:

   ```text
   I'm sorry, I can't seem to find that handoff document. Can you please provide me with a path to it?
   ```

5. If there is one file, use that handoff.
6. If there are multiple files, choose the most recent one using the `YYYY-MM-DD_HH-MM-SS` timestamp in the filename.
7. Immediately read the handoff document completely.
8. Immediately read any linked documents under:
   - `thoughts/shared/plans/`
   - `thoughts/shared/research/`
9. Do not use a sub-agent to read these critical continuity artifacts.
10. Begin analysis by reading additional files mentioned in the handoff.
11. Present the current situation and recommended course of action to the user before implementing.

### If no parameters were provided

List recent available handoffs first:

```bash
find thoughts/shared/handoffs -type f -name "*.md" | sort | tail -20
```

Then respond with:

```text
I'll help you resume work from a handoff document. Let me find the available handoffs.

Which handoff would you like to resume from?

Tip: You can invoke this command directly with a handoff path:
/resume_handoff thoughts/shared/handoffs/ENG-XXXX/YYYY-MM-DD_HH-MM-SS_ENG-XXXX_description.md

or using a ticket number to resume from the most recent handoff for that ticket:
/resume_handoff ENG-XXXX
```

Then wait for the user's input.

## Process Steps

### Step 1: Read and Analyze the Handoff

1. **Read the handoff completely**
   - Use the Read tool without limit or offset parameters.
   - Extract every section:
     - Task(s)
     - Critical References
     - Recent Changes
     - Plan State
     - Verification
     - Debug Evidence
     - Learnings
     - Artifacts
     - Action Items & Next Steps
     - Other Notes

2. **Read critical continuity artifacts yourself**
   - Read every referenced plan under `thoughts/shared/plans/`.
   - Read every referenced research document under `thoughts/shared/research/`.
   - If the handoff references another handoff, read it yourself.
   - Do this before spawning any sub-agents.

3. **Inspect current repository state**
   - Run `git status --short`.
   - Run `git branch --show-current`.
   - Run `git rev-parse HEAD`.
   - Check whether files listed in Recent Changes and Artifacts still exist.
   - If `entire` is available and the handoff mentions a session/checkpoint, run the relevant `entire explain` command only as supporting context.

4. **Read implementation files mentioned in the handoff**
   - Read files from Recent Changes.
   - Read files from Learnings.
   - Read files from Action Items when they are specific enough to identify.
   - Read files fully when they are central to the resumed work.

5. **Restore the debug evidence chain**
   - Identify the primary debug block from the handoff: browser, runtime, inngest, db, sdk, or observability.
   - Read the corresponding `lightfast-debug` reference if the next step depends on that block.
   - Validate the strongest evidence still applies before implementing.
   - Preserve the handoff's next decisive check unless current evidence invalidates it.

6. **Use sub-agents only after critical context is loaded**
   - You may spawn focused research tasks to verify non-critical details or broaden codebase understanding.
   - Do not ask sub-agents to read the handoff in your place.
   - Wait for all sub-agents to complete before presenting final analysis.

Example focused research task:

```text
Task - Verify implementation context:
Review the files related to [component/feature] mentioned in the handoff.
Confirm whether the described changes are present in the current codebase.
Return file:line references and any divergence from the handoff.
```

### Step 2: Synthesize and Present Analysis

Present a concise but complete analysis before taking action:

```markdown
I've analyzed the handoff from [date] by [researcher]. Here's the current situation:

**Original Tasks**
- [Task 1]: [handoff status] -> [current verification]
- [Task 2]: [handoff status] -> [current verification]

**Key Learnings Validated**
- [Learning with file:line reference] - [still valid / changed / not found]
- [Pattern or constraint] - [still applicable / changed]

**Recent Changes Status**
- [Change 1] - [verified present / missing / modified]
- [Change 2] - [verified present / missing / modified]

**Verification Status**
- [Command/check] - [passed / failed / skipped and why]
- [Manual review item] - [complete / pending / not applicable]

**Debug Evidence**
- Primary block: [browser / runtime / inngest / db / sdk / observability / none]
- Strongest evidence: [validated / stale / changed]
- Next decisive check: [specific check]

**Artifacts Reviewed**
- [Document 1]: [key takeaway]
- [Document 2]: [key takeaway]

**Recommended Next Actions**
1. [Most logical next step based on handoff and current state]
2. [Second priority action]
3. [Additional task if needed]

**Potential Issues**
- [Conflicts, regressions, stale assumptions, missing files, or verification gaps]

Shall I proceed with [recommended action 1], or would you like to adjust the approach?
```

If the handoff is straightforward and the user explicitly asked you to continue work, you may proceed after presenting the analysis. Otherwise, get confirmation before implementation.

### Step 3: Create an Action Plan

After the user confirms direction:

1. Use TodoWrite to create a task list.
2. Convert handoff action items into todos.
3. Add any tasks discovered during validation.
4. Prioritize by dependency order.
5. Present the plan briefly:

```markdown
I've created a task list based on the handoff and current analysis:

[Show todo list]

Ready to begin with the first task: [task description]?
```

If the user already confirmed implementation, begin with the first task after creating the todo list.

### Step 4: Begin Implementation

1. Start with the first approved task.
2. Apply patterns and constraints documented in the handoff.
3. Reference the handoff and any plan/research documents while implementing.
4. Update progress as tasks are completed.
5. Run verification commands relevant to the resumed task.
6. Consider creating a new handoff before ending only if the user asks for one or context is approaching the 100k-120k token range and continuity would otherwise be at risk.

## Guidelines

- Never assume the handoff state still matches the current codebase.
- Verify all file references still exist.
- Check whether the branch or commit has changed since the handoff was written.
- Treat plans and research docs as continuity-critical artifacts.
- Pay special attention to the Learnings section; it often records the reason earlier attempts failed.
- Distinguish stale context from current evidence.
- Ask for clarification when the handoff's next step is ambiguous or conflicts with the current code.
- Document deviations from the handoff if you proceed differently.

## Common Scenarios

### Clean Continuation

- All referenced changes are present.
- No conflicts or regressions are visible.
- Action items are clear.
- Proceed with the recommended next action after user confirmation.

### Diverged Codebase

- Some referenced files changed, moved, or disappeared.
- New related code has landed since the handoff.
- Reconcile differences before implementing.

### Incomplete Handoff Work

- Tasks are marked in progress.
- Partial implementation exists.
- Finish or stabilize existing work before starting new scope.

### Stale Handoff

- Significant time has passed.
- The branch or architecture has changed.
- Re-evaluate the strategy before continuing.
