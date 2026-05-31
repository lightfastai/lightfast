# Triage Eval Label Policy

This policy keeps triage eval fixtures small and consistent. It describes how to label GitHub Issue dogfood cases without introducing org knowledge, project memory, user memory, or org skills into the fixture shape.

## Fixture Shape

Use the current fixture shape:

```ts
{
  sourceItem,
  candidates,
  availableDestinations,
  expected,
  metadata,
}
```

Do not add a default `contextPack` until a fixture needs retrieved org, project, or user context to be judged correctly. For now, `candidates` is the bounded retrieved context.

## Work Intent

- `bug`: observed incorrect behavior, failed test, broken workflow, stale state, or regression.
- `feature`: a concrete capability with enough detail that someone could start implementation.
- `cleanup`: refactor, migration, naming cleanup, debt reduction, or internal simplification.
- `investigation`: the cause or reproduction is unclear; the next step is inspect, measure, or debug.
- `planning`: architecture, product strategy, primitive design, integration direction, eval design, or build-process decisions.
- `documentation`: docs, copy, README, changelog, or wording-only work.
- `question`: broad or exploratory ask where the next useful action is answering or clarifying.

## Triage Decision

- `dismiss`: not useful, already resolved with no durable learning value, or obsolete.
- `needs_context`: possibly useful, but too vague to route or act on.
- `link_existing`: same underlying work as an existing candidate; the human should link, merge, close, or update the existing item.
- `promote_opportunity`: useful product or engineering direction, but not committed execution yet.
- `create_task`: specific enough to execute as committed work.

## Similarity Relation

- `duplicate`: same underlying work, same fix, same tracking item, or same decision. Different wording is still duplicate if one resolution should close or update both items.
- `related`: useful adjacent context, same area, or same pattern, but different acceptance criteria or independently completable work.
- `supersedes`: the source replaces the candidate.
- `blocked_by`: the source depends on the candidate.
- `unrelated`: weak or incidental overlap.

## Priority

- `urgent`: blocks production, security, data integrity, or active incident response.
- `high`: blocks current dogfood/build flow, prevents duplicate work, breaks core setup/sync flows, or represents a strategic decision the team is actively making.
- `normal`: useful work but not immediately blocking.
- `low`: stale, docs-only, minor copy, or non-reproducing work with little current impact.

## Future Context

When a case cannot be judged from `sourceItem` plus `candidates`, add a focused eval for the missing context type before changing every fixture. Possible future context types are org knowledge, org skills, project memory, and user memory.
