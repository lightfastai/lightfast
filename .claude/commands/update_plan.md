---
description: Update an existing implementation plan with new phases, reworks, or scope changes based on research
model: opus
---

# Update Implementation Plan

You are tasked with updating an existing implementation plan through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce an updated plan that preserves completed work while incorporating new information.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a plan path was provided as a parameter, skip the default message
   - Immediately read the plan and any provided context files FULLY
   - Begin the research process

2. **If no parameters provided**, respond with:
```
I'll help you update an existing implementation plan. Let me start by understanding what needs to change.

Please provide:
1. The plan file path (e.g., `thoughts/shared/plans/2026-03-10-feature-name.md`)
2. What needs to change — new requirements, context, research doc, or description
3. Any relevant constraints or specific requirements for the update

I'll analyze the current plan and new information, then work with you to produce an updated plan.

Tip: You can invoke this with a plan path directly: `/update_plan thoughts/shared/plans/2026-03-10-feature-name.md`
Or with context: `/update_plan thoughts/shared/plans/2026-03-10-feature-name.md based on thoughts/shared/research/new-findings.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Initial Analysis

1. **Read all mentioned files immediately and FULLY**:
   - The existing plan file
   - Any new tickets, research docs, or context files
   - Documents referenced within the plan itself (original ticket, research, etc.)
   - Any JSON/data files mentioned
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn initial research tasks to gather context**:
   Before asking the user any questions, use specialized agents to research in parallel:

   - Use the **codebase-locator** agent to find all files related to areas the plan touches
   - Use the **codebase-analyzer** agent to understand the current implementation state vs what the plan describes
   - If relevant, use the **thoughts-locator** agent to find any new thoughts documents since the plan was written

   These agents will:
   - Find relevant source files, configs, and tests
   - Identify what has changed since the plan was written
   - Trace data flow and key functions in affected areas
   - Return detailed explanations with file:line references

3. **Read all files identified by research tasks**:
   - After research tasks complete, read ALL files they identified as relevant
   - Read them FULLY into the main context
   - This ensures you have complete understanding before proceeding

4. **Analyze and verify understanding**:
   - Assess plan state: which phases are complete (`[x]`), in progress, or not started
   - Cross-reference the plan's assumptions with the current codebase reality
   - Identify discrepancies between the plan and what was actually implemented
   - Note what the new information changes about remaining work

5. **Present informed understanding and focused questions**:
   ```
   I've read the current plan and the new context. Here's my assessment:

   **Plan**: [plan name]
   **Status**: [X of Y phases complete]

   Completed:
   - Phase 1: [name] ✓

   In Progress / Remaining:
   - Phase 2: [name] — [status notes]
   - Phase 3: [name] — not started

   **What I found in the codebase**:
   - [Current implementation detail with file:line reference]
   - [Deviation from plan or new constraint discovered]

   **What the new information changes**:
   - [Impact of new requirements/context on remaining phases]

   Questions that my research couldn't answer:
   - [Specific technical question that requires human judgment]
   - [Design preference that affects the update approach]
   ```

   Only ask questions that you genuinely cannot answer through code investigation.

### Step 2: Research & Discovery

After getting initial clarifications:

1. **If the user corrects any misunderstanding**:
   - DO NOT just accept the correction
   - Spawn new research tasks to verify the correct information
   - Read the specific files/directories they mention
   - Only proceed once you've verified the facts yourself

2. **Create a research todo list** using TodoWrite to track exploration tasks

3. **Spawn parallel sub-tasks for comprehensive research**:
   - Create multiple Task agents to research different aspects concurrently
   - Use the right agent for each type of research:

   **For deeper investigation:**
   - **codebase-locator** - To find more specific files (e.g., "find all files that handle [specific component]")
   - **codebase-analyzer** - To understand implementation details (e.g., "analyze how [system] works now vs what the plan assumed")
   - **codebase-pattern-finder** - To find similar features we can model after

   **For historical context:**
   - **thoughts-locator** - To find any research, plans, or decisions about this area
   - **thoughts-analyzer** - To extract key insights from the most relevant documents

   Each agent knows how to:
   - Find the right files and code patterns
   - Identify conventions and patterns to follow
   - Look for integration points and dependencies
   - Return specific file:line references
   - Find tests and examples

3. **Wait for ALL sub-tasks to complete** before proceeding

4. **Present findings and update options**:
   ```
   Based on my research, here's what I found:

   **Still Valid**:
   - [Aspects of the plan that hold up]
   - [Pattern or convention confirmed]

   **Needs Updating**:
   - [What's changed and why]
   - [New information that affects remaining phases]

   **Update Options:**
   1. [Option A - e.g., in-place edit, add phase] - [pros/cons]
   2. [Option B - e.g., new version, rework phase] - [pros/cons]

   **Open Questions:**
   - [Technical uncertainty]
   - [Design decision needed]

   Which approach aligns best with your vision?
   ```

### Step 3: Update Structure Development

Once aligned on approach, determine the update strategy:

**Minor Update** (adjusting details within existing phases):
- Edit the plan file in place
- Preserve all existing structure and checkmarks
- Add/modify only the affected sections

**Moderate Update** (adding phases, reworking incomplete phases):
- Edit the plan file in place
- Add new phases with clear numbering
- Rework incomplete phases while preserving completed ones
- Add an `## Update Log` section at the bottom if one doesn't exist

**Major Rework** (fundamental approach change):
- Create a new version of the plan file (e.g., `...-v2.md`, `...-v3.md`)
- Reference the original plan in the new version
- Carry forward completed phase status
- Clearly mark what changed and why

1. **Present the proposed update structure**:
   ```
   Here's my proposed update:

   **Preserved** (no changes):
   - Phase 1: [name] ✓ (completed, untouched)
   - Phase 2: [name] ✓ (completed, untouched)

   **Modifications**:
   - Phase 3: [what changes and why]

   **Additions**:
   - New Phase [N]: [name] — [what it accomplishes]

   **Removals** (if any):
   - Phase [N]: [moved to "What We're NOT Doing" because...]

   Does this structure make sense? Should I adjust the scope or ordering?
   ```

2. **Get feedback on structure** before writing details

### Step 4: Detailed Plan Update

After structure approval:

1. **For in-place updates**, edit the existing plan file:
   - Preserve all completed phases exactly as they are
   - Modify only the sections that need updating
   - New phases must use the same template structure as existing phases
   - Update the Overview, Current State Analysis, and Desired End State if the update changes them
   - Update the "What We're NOT Doing" section if scope changed
   - Add an Update Log entry at the bottom

2. **For new versions**, write a new plan file:
   - Use naming convention: `YYYY-MM-DD-description-vN.md`
   - Add a note at the top referencing the previous version
   - Add a note at the top of the old plan pointing to the new version
   - Carry forward completed phase status
   - Follow the same template structure as `create_plan`

3. **Include an Update Log entry**:

```markdown
## Update Log

### YYYY-MM-DD — [Brief description of update]
- **Trigger**: [What prompted the update — new requirements, implementation findings, etc.]
- **Changes**:
  - [Change 1]
  - [Change 2]
- **Impact on remaining work**: [How this affects phases not yet started]
```

### Step 5: Sync and Review

1. **Sync the thoughts directory**:
   - Run `humanlayer thoughts sync` to sync the updated plan
   - This ensures the plan is properly indexed and available

2. **Present the updated plan location**:
   ```
   I've updated the implementation plan at:
   `thoughts/shared/plans/[filename].md`

   Summary of changes:
   - [Change 1]
   - [Change 2]

   Please review it and let me know:
   - Are the updated phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases or considerations?
   ```

3. **Iterate based on feedback** - be ready to:
   - Adjust modified phases
   - Refine new phases
   - Clarify success criteria (both automated and manual)
   - Adjust scope
   - After making changes, run `humanlayer thoughts sync` again

4. **Continue refining** until the user is satisfied

## Important Guidelines

1. **Be Skeptical**:
   - Question vague change requests
   - Identify potential issues early
   - Ask "why" and "what about"
   - Don't assume - verify with code
   - When adding new phases, question whether they belong in this plan or a separate one

2. **Be Interactive**:
   - Don't rewrite the entire plan in one shot
   - Get buy-in at each major step
   - Allow course corrections
   - Work collaboratively

3. **Be Thorough**:
   - Read all context files COMPLETELY before updating
   - Research actual code patterns using parallel sub-tasks
   - Include specific file paths and line numbers
   - Write measurable success criteria with clear automated vs manual distinction
   - Automated steps should use `pnpm` whenever possible - for example `pnpm check` instead of `cd apps/console && npx biome check .`

4. **Be Practical**:
   - Focus on incremental, testable changes
   - Consider migration and rollback
   - Think about edge cases
   - Keep the "What We're NOT Doing" section current

5. **Track Progress**:
   - Use TodoWrite to track planning tasks
   - Update todos as you complete research
   - Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
   - If you encounter open questions during the update, STOP
   - Research or ask for clarification immediately
   - Do NOT write the update with unresolved questions
   - The updated plan must be complete and actionable
   - Every decision must be made before finalizing the update

7. **Never Lose Completed Work**:
   - Completed phases (with `[x]` checkmarks) must be preserved unless explicitly told otherwise
   - If a completed phase needs revision, flag it — don't silently change it
   - Carry forward completion status accurately

## Success Criteria Guidelines

**Always separate success criteria into two categories:**

1. **Automated Verification** (can be run by execution agents):
   - Commands that can be run: `pnpm test`, `pnpm check`, etc.
   - Specific files that should exist
   - Code compilation/type checking
   - Automated test suites

2. **Manual Verification** (requires human testing):
   - UI/UX functionality
   - Performance under real conditions
   - Edge cases that are hard to automate
   - User acceptance criteria

**Format example:**
```markdown
### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs successfully: `pnpm db:migrate`
- [ ] All unit tests pass: `pnpm test`
- [ ] No linting errors: `pnpm check`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] New feature appears correctly in the UI
- [ ] Performance is acceptable with 1000+ items
- [ ] Error messages are user-friendly
- [ ] Feature works correctly on mobile devices
```

## Common Patterns

### For Adding Phases:
- Insert in logical order (not necessarily at the end)
- Renumber subsequent phases if needed
- Update any cross-phase references
- Match the style and detail level of existing phases

### For Reworking Phases:
- Preserve the phase's intent unless told otherwise
- Show what changed and why in the Update Log
- Update success criteria to match the new approach
- Check if changes cascade to later phases

### For Scope Changes:
- Update "What We're NOT Doing" when removing scope
- Update Overview and Desired End State when adding scope
- Suggest splitting into separate plans if the update makes the plan too large

### For Incorporating Implementation Lessons:
- Adjust future phases based on what was discovered
- Update assumptions and constraints
- Document lessons in the Update Log

## Sub-task Spawning Best Practices

When spawning research sub-tasks:

1. **Spawn multiple tasks in parallel** for efficiency
2. **Each task should be focused** on a specific area
3. **Provide detailed instructions** including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
4. **Be EXTREMELY specific about directories**:
   - If the ticket mentions "WUI", specify `humanlayer-wui/` directory
   - If it mentions "daemon", specify `hld/` directory
   - Never use generic terms like "UI" when you mean "WUI"
   - Include the full path context in your prompts
5. **Specify read-only tools** to use
6. **Request specific file:line references** in responses
7. **Wait for all tasks to complete** before synthesizing
8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect

Example of spawning multiple tasks:
```python
# Spawn these tasks concurrently:
tasks = [
    Task("Analyze current state vs plan assumptions", state_comparison_prompt),
    Task("Research impact of new requirements", requirements_research_prompt),
    Task("Find affected downstream code", downstream_analysis_prompt),
    Task("Check test coverage for affected areas", test_research_prompt)
]
```

## Example Interaction Flow

```
User: /update_plan thoughts/shared/plans/2026-03-10-feature-name.md
Assistant: Let me read the plan and research the current state...

[Reads plan fully, spawns research tasks]

I've read the plan and analyzed the codebase. Here's the current state:
- Phases 1-2 are complete
- Phase 3 hasn't started
- The codebase has evolved in [ways] since the plan was written

What changes do you want to make?

User: We need to add a new phase for handling edge case X, and rework Phase 3 based on findings in thoughts/shared/research/new-findings.md
Assistant: Let me read that research document and investigate the edge case...

[Reads research doc, spawns targeted research tasks]

Based on my research, here's what I propose...

[Interactive process continues...]
```
