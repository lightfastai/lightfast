# Triage GitHub Issues Live Eval Analysis

Date: 2026-05-31

## Summary

The triage eval now runs live through the existing Lightfast Vercel OIDC path.

Latest clean Braintrust experiment:

- Name: `HEAD-1780211258`
- URL: https://www.braintrust.dev/app/Lightfast/p/lightfast-agent-runtime/experiments/HEAD-1780211258
- Dataset: 30 GitHub Issue dogfood cases
- Runtime errors: 0

Scores:

- `source_useful`: 30/30, 100.00%
- `work_intent`: 21/30, 70.00%
- `priority`: 22/30, 73.33%
- `triage_decision`: 27/30, 90.00%

Targeted similarity experiment:

- Name: `HEAD-1780211242`
- URL: https://www.braintrust.dev/app/Lightfast/p/lightfast-agent-runtime/experiments/HEAD-1780211242
- Dataset: 5 duplicate/linking cases derived from the GitHub Issue fixtures
- Runtime errors: 0
- `candidate_id`: 5/5, 100.00%
- `relation`: 5/5, 100.00%

## Runtime Findings

The first live run failed before prompt quality could be evaluated because `@repo/ai` did not load `apps/app/.vercel/.env.development.local`, so `VERCEL_OIDC_TOKEN` was not present for AI Gateway auth. The eval script now loads the app Vercel env file directly.

Two model-facing schema issues also surfaced:

- `z.record(...)` emitted JSON Schema `propertyNames`, which AI Gateway rejected.
- `z.string().url()` emitted JSON Schema `format: "uri"`, which AI Gateway rejected in this structured-output path.

The action payload model schema now uses a fixed nullable object shape with no `propertyNames` or URL format annotation.

The eval layer now has a small label policy at `ai/evals/triage-label-policy.md`. It intentionally keeps the fixture shape to `sourceItem`, `candidates`, `availableDestinations`, `expected`, and `metadata`; org knowledge, org skills, project memory, and user memory stay out of the default fixture shape until a focused eval requires them.

## Quality Findings

The model reliably decides whether a source item is useful. The remaining misses are mostly domain taxonomy and routing-policy ambiguity:

- `workIntent` still confuses docs/copy with cleanup, vague asks with planning/investigation, and connector/platform strategy with feature/planning.
- `priority` needs a clearer policy for "high": duplicate-work prevention and current dogfood/build-process blockers versus ordinary implementation bugs.
- `triageDecision` improved after duplicate/related few-shot examples. The remaining misses are mostly `promote_opportunity` versus `create_task`, `needs_context` versus `promote_opportunity`, and one duplicate case that reaches action recommendation but still returns `create_task`.
- The dedicated similarity eval now shows the ranker finds the right candidate and labels all 5 duplicate fixtures correctly.
- `promote_opportunity` remains subjective. The current prompt improved strategic routing, but cases such as native tasks and embeddings still need sharper product-policy examples.

## Recommendation

Do not introduce persisted triage primitives yet. Keep the next work in `ai/`:

1. Add a relation-aware action rule: `duplicate` should link, while `related` should usually preserve the classifier decision and surface context.
2. Add a few-shot section for `promote_opportunity` versus `create_task`.
3. Decide whether priority should be scored strictly or with a tolerance band, because current misses are often reasonable `normal`/`high` disagreements.
4. Only after this stabilizes should Lightfast add durable triage inbox records or workspace-level connector sync tables.

## References

- Vercel OIDC local development: https://vercel.com/docs/oidc
- Vercel env pull behavior: https://vercel.com/docs/cli/env
- Vercel AI Gateway: https://vercel.com/docs/ai-gateway
