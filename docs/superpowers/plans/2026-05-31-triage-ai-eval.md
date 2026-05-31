# Triage AI Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DB-free triage AI module plus Braintrust eval scaffolding for GitHub Issue dogfood examples.

**Architecture:** Keep triage in `ai/src/triage` as a separate agent graph from signal intake. The module owns provisional schemas, prompts, request builders, and structured-output runners; eval fixtures live under `ai/evals`.

**Tech Stack:** TypeScript, Zod, Vitest, Vercel AI SDK wrapper via `@vendor/ai`, Braintrust `bt eval`.

---

## File Map

- Create `ai/src/_internal/agent-graphs/triage.ts` for Braintrust graph metadata.
- Create `ai/src/triage/{schema,prompt,constants,errors,classify-source-item,rank-similar-items,recommend-action,index}.ts`.
- Create `ai/src/__tests__/triage/{schema,classify-source-item}.test.ts`.
- Create `ai/evals/datasets/triage-github-issues.jsonl`, `ai/evals/triage-fixtures.ts`, `ai/evals/triage-fixtures.test.ts`, and `ai/evals/triage-github-issues.eval.ts`.
- Modify `ai/package.json` to export `./triage`, add Braintrust eval dependencies, and add a fixture-mode eval script.
- Modify `ai/tsconfig.json` so eval files are typechecked.

### Task 1: Red Tests

**Files:**
- Create: `ai/src/__tests__/triage/schema.test.ts`
- Create: `ai/src/__tests__/triage/classify-source-item.test.ts`
- Create: `ai/evals/triage-fixtures.test.ts`

- [ ] **Step 1: Write schema tests**

Add tests that import missing triage schemas and assert parsing for source item
classification, similarity ranks, and action recommendations.

- [ ] **Step 2: Write request-builder tests**

Add tests that import missing request builders and assert prompt/system strings
include GitHub Issue content and candidate context.

- [ ] **Step 3: Write eval fixture tests**

Add tests that import a missing `loadTriageGithubIssueEvalCases` helper and
assert fixture cases contain expected inputs and outputs.

- [ ] **Step 4: Run red tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/triage/schema.test.ts src/__tests__/triage/classify-source-item.test.ts evals/triage-fixtures.test.ts
```

Expected: fail because the triage module and fixture loader are missing.

### Task 2: Triage Module

**Files:**
- Create: `ai/src/_internal/agent-graphs/triage.ts`
- Create: `ai/src/triage/*.ts`
- Modify: `ai/package.json`

- [ ] **Step 1: Add graph and schemas**

Implement the provisional triage graph and Zod schemas with fixed schema
version literals.

- [ ] **Step 2: Add prompts and request builders**

Implement source classification, similarity ranking, and action recommendation
request builders.

- [ ] **Step 3: Add structured-output runners**

Use the existing `runObjectClassification` helper and stamp schema versions
after model output parsing.

- [ ] **Step 4: Export the module**

Add the `./triage` export to `ai/package.json`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/triage/schema.test.ts src/__tests__/triage/classify-source-item.test.ts
```

Expected: pass.

### Task 3: Braintrust Eval Scaffold

**Files:**
- Create: `ai/evals/datasets/triage-github-issues.jsonl`
- Create: `ai/evals/triage-fixtures.ts`
- Create: `ai/evals/triage-github-issues.eval.ts`
- Modify: `ai/package.json`
- Modify: `ai/tsconfig.json`

- [ ] **Step 1: Add JSONL fixtures**

Create a compact fixture set covering duplicate, task, opportunity,
needs-context, and dismiss decisions.

- [ ] **Step 2: Add fixture loader**

Parse JSONL through the triage eval case schema and expose a typed loader.

- [ ] **Step 3: Add Braintrust eval**

Define a Braintrust eval in `ai/evals/triage-github-issues.eval.ts`. In default
mode it calls the triage classifier. In `TRIAGE_EVAL_MODE=expected`, it returns
expected outputs so eval plumbing can run without model calls.

- [ ] **Step 4: Add scripts and deps**

Add Braintrust and `tsx` dev dependencies to `ai/package.json`, plus:

```bash
pnpm --filter @repo/ai eval:triage
pnpm --filter @repo/ai eval:triage:fixture
```

- [ ] **Step 5: Verify eval fixture mode**

Run:

```bash
pnpm --filter @repo/ai eval:triage:fixture
```

Expected: pass locally without sending logs or making live model calls.

### Task 4: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run focused tests**

```bash
pnpm --filter @repo/ai test -- src/__tests__/triage/schema.test.ts src/__tests__/triage/classify-source-item.test.ts evals/triage-fixtures.test.ts
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @repo/ai typecheck
```

- [ ] **Step 3: Inspect git status**

```bash
git status --short
```

Confirm only the triage AI/eval/doc files changed.

## Self-Review

- Spec coverage: The plan covers the DB-free triage graph, provisional schemas,
  eval fixtures, fixture-mode eval run, and package exports.
- Placeholder scan: No TBD/TODO placeholders are left.
- Scope check: DB, UI, Linear, and GitHub webhook work are intentionally outside
  this plan.
