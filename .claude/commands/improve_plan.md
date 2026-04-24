---
description: Adversarial review of implementation plans — find weaknesses, kill code smells, improve DX
model: opus
---

# Improve Plan

You are tasked with adversarially reviewing an existing implementation plan. Your job is to find weaknesses, challenge assumptions, eliminate code smells, and push toward the most accretive solution — then edit the plan in-place.

## Initial Setup

When invoked:

1. **If a plan path is provided**, read it FULLY immediately
2. **If no path provided**, list plans in `thoughts/shared/plans/` and ask which one to review

After reading the plan, spawn parallel research agents to understand the codebase areas it touches:

- **codebase-analyzer**: Trace how the files/modules the plan modifies actually work today
- **codebase-pattern-finder**: Find existing patterns in the codebase that the plan should (or shouldn't) follow
- **thoughts-locator**: Check if related research or prior plans exist that inform this one

Wait for all agents to complete before proceeding.

## Scrutiny Dimensions

Evaluate the plan against each dimension. Be adversarial — assume the plan is wrong until proven right.

### 1. Code Smells & Anti-Patterns

- Does the plan introduce tight coupling, god objects, or leaky abstractions?
- Are there unnecessary layers of indirection?
- Does it create hidden dependencies between modules?
- Could we delete code instead of adding it?

### 2. Long-Term Maintainability

- Will this be painful to change in 6 months?
- Does it create implicit contracts that will break silently?
- Are there migration landmines (data migrations, API contracts)?
- Is the abstraction level right — not too generic, not too specific?

### 3. 10x Alternatives

- Is there a radically simpler approach the plan missed entirely?
- Could an existing library, pattern, or primitive solve this with less code?
- Is the plan solving the right problem, or a symptom?
- Would a different decomposition make 3 phases collapse into 1?

### 4. DX Alignment

- Does this make the developer's life easier or harder?
- API ergonomics — is the interface obvious or does it need documentation to explain?
- Error messages — will developers know what went wrong?
- Discoverability — will someone new find this where they expect it?

### 5. Codebase Consistency

- Does the plan follow existing conventions, or diverge without justification?
- Are naming patterns consistent with the rest of the codebase?
- Does it respect established boundaries (vendor abstractions, workspace protocol)?

## Scope Creep Detection

For each phase in the plan, ask: **does this phase belong here, or is it papering over a deeper problem?**

If a phase is fixing symptoms of a bad pattern rather than implementing the actual feature:

1. Use `AskUserQuestion` to flag it:

   ```
   Phase [N] looks like it's working around [deeper issue].

   This phase is [description of what it does], but the root cause is [underlying problem].

   Options:
   1. Keep it in this plan (pragmatic, ships faster)
   2. Demote it — create a separate research + plan cycle to fix the root cause first

   Which do you prefer?
   ```

2. If the user chooses to demote, create a file at `thoughts/shared/plans/YYYY-MM-DD-demoted-[description].md`:

   ```markdown
   # Demoted from: [Original Plan Name]

   ## Context

   During review of `thoughts/shared/plans/[original-plan].md`, Phase [N] was identified as working around a deeper issue that deserves its own research and planning cycle.

   ## The Deeper Issue

   [Description of the root cause problem]

   ## Why It Was Demoted

   [Explanation of why this shouldn't be a band-aid in the original plan]

   ## Recommended Next Step

   Run `/research_codebase` focused on [specific area], then `/create_plan` to address the root cause.
   ```

   Then remove or simplify the demoted phase from the original plan.

## Output Format

Present findings as a severity-ranked list, not a wall of text:

```
## Plan Review: [Plan Name]

### Critical (blocks shipping)
1. [Issue] — [Why it matters] — [Proposed fix]

### High (will cause pain soon)
1. [Issue] — [Why it matters] — [Proposed fix]

### Improvements (makes it significantly better)
1. [Issue] — [Why it matters] — [Proposed fix]

### Scope Questions (need your input)
1. [Question for AskUserQuestion]
```

After presenting findings, use `AskUserQuestion` for any items that need user input before you can edit the plan.

## Spike Validation

After presenting findings but before editing the plan, identify the **single highest-leverage uncertainty** — the one assumption that, if wrong, would invalidate the most work.

This could be:
- A "Critical" finding where you proposed a simpler alternative
- A phase that assumes an abstraction will work but hasn't been tested
- A claim that something can be removed or simplified

1. Use `AskUserQuestion` to propose the spike:

   ```
   I want to spike [specific thing] to prove [specific claim].

   This would test whether [hypothesis] by [what the agent would try].
   Success signal: [what passing looks like]

   Worth spiking? (yes / no / spike something else)
   ```

2. If approved, spawn the **spike-validator** agent with `isolation: "worktree"`:
   - Provide: hypothesis, scoped files, what to try, success signal
   - The agent writes minimum viable code in an isolated copy of the repo
   - It reports back: verdict, evidence, complexity metrics, key finding

3. Incorporate the spike result into your findings:
   - If CONFIRMED: update the plan with the proven alternative
   - If REFUTED: drop the suggestion, note why the current approach is correct
   - If PARTIAL: present the nuance to the user before editing

4. **Clean up the spike worktree** once findings are incorporated:
   - If the agent made no changes, the worktree is auto-cleaned — nothing to do
   - If changes were made, the agent returns a worktree path and branch name. After extracting all needed evidence:
     - Remove the worktree: `git worktree remove <path>` (add `--force` if it has uncommitted changes you've already captured)
     - Delete the branch: `git branch -D <branch>`
   - Never leave spike worktrees lying around — they confuse future `git worktree list` output and waste disk

Only spike once per review. The point is targeted evidence, not a full prototype.

## Editing the Plan

Once you have the user's decisions (and spike results if applicable):

1. Edit the plan file in-place using the Edit tool
2. Add an `## Improvement Log` section at the bottom of the plan documenting what changed and why
3. If a spike was run, include the verdict and key finding in the improvement log
4. Do NOT create a separate review document

## Important Guidelines

1. **Be adversarial by default** — Assume every decision in the plan is wrong until you verify it against the codebase. Challenge "obvious" choices hardest.
2. **Be collaborative when stuck** — Use `AskUserQuestion` for decisions that require user intent or domain knowledge you can't derive from code.
3. **Kill complexity** — The best improvement is often removing a phase, not adding one. Fewer moving parts > more features.
4. **Ground everything in code** — Every criticism must reference actual files and patterns. No abstract complaints.
5. **Edit, don't lecture** — After discussion, update the plan. The deliverable is a better plan file, not a review essay.
