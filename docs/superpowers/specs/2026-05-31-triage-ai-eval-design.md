# Triage AI Eval Design

## Context

Lightfast currently has a small AI package centered on signal intake:

- `ai/src/signal-classifier` classifies raw signal text.
- `ai/src/people-classifier` optionally extracts durable people references.
- `ai/src/_internal/agent-graphs/signal-intake.ts` records the runtime graph for
  Braintrust metadata.

The next dogfood direction is not a Linear connector first. It is a triage
reasoning layer that can evaluate GitHub Issues, later compare them to Linear
issues, and eventually route decisions to team members.

## Decision

Add a provisional triage AI surface under `ai/src/triage` and validate it with
Braintrust evals before committing product primitives such as durable
opportunities or native tasks.

The implementation must stay DB-free and connector-free. It accepts normalized
source items and candidate context, then returns structured decisions. Product
tables and UI can graduate later from repeated eval labels and dogfood failure
patterns.

## Provisional Vocabulary

- **Signal**: an observed artifact that might matter. Examples: GitHub issue,
  Linear issue, PR review comment, manual note.
- **Triage**: the decision process over signals. It answers what should happen
  next: dismiss, ask for context, link existing work, promote to opportunity, or
  create a task.
- **Opportunity**: a potential product value cluster supported by one or more
  signals. It is not committed execution.
- **Task**: committed execution. It may later sync to GitHub Issues, Linear, or a
  native Lightfast task.

These words are eval labels first. They should not become DB tables until the
eval set and dogfood usage show stable boundaries.

## AI Shape

Add a separate `triage` agent graph with three nodes:

1. `triageSourceClassifier`
   Classifies a source item as useful work, noise, needs-context, opportunity,
   or task-like execution.
2. `triageSimilarityRanker`
   Ranks candidate source or work items as duplicate, related, blocked-by,
   supersedes, or unrelated.
3. `triageActionRecommender`
   Proposes the next user-facing triage action from the classification,
   similarity results, and available destinations.

The first implementation should expose request builders and runtime functions
matching the existing signal classifier pattern.

## Braintrust Eval Shape

Add `ai/evals/triage-github-issues.eval.ts` with a JSONL fixture dataset. The
dataset should include dogfood-grade GitHub Issue examples:

- duplicate issue detection;
- issue that should become a task;
- issue that should become an opportunity;
- vague issue that needs context;
- low-value/noise issue;
- ownership routing hints;
- issue with candidates where linking existing work is the right answer.

The eval should support a fixture mode that returns expected output without
calling an LLM, so the eval plumbing can be verified locally. Default mode runs
the real triage classifier.

## Non-Goals

- No database schema changes.
- No Triage Inbox UI.
- No Linear connector.
- No GitHub webhook or PR review ingestion.
- No embeddings/vector store.
- No automated writes to GitHub or Linear.

## Success Criteria

- `@repo/ai/triage` exports typed schemas, request builders, and classifier
  entrypoints.
- Unit tests cover schema parsing and request shaping.
- Braintrust eval fixture loading is tested.
- A local fixture-mode `bt eval` run can validate the eval file without model
  calls.
- A live `pnpm --filter @repo/ai eval:triage` script can run the same dataset
  through the real triage classifier when we are ready to spend inference.
- The design leaves product primitives provisional.
