# Signal Routing V2 Design

## Context

`@repo/ai/signal-classifier` currently classifies raw signal input into an
actionability result and an optional people-routing hint. The stored
`signal.classification.v1` shape answers whether a signal is actionable and
whether the people classifier should run, but it does not model the B2B
visibility decision that every downstream AI feature will need.

Lightfast is B2B, so the AI intake pipeline must distinguish between signal
context that can safely become team-visible and context that must remain tied to
the creating user. Some inputs should also pause the pipeline until the creator
reviews them.

## Goals

- Introduce a `signal.classification.v2` routing contract.
- Make visibility explicit: `user`, `team`, or `needs_review`.
- Treat `needs_review` as a hard pipeline stop.
- Keep the signal classifier as a router, not an extractor.
- Keep the only current downstream route as `people`.
- Preserve room for future routes such as memory, knowledge suggestions,
  decisions, skills, tasks, risks, and artifacts without adding them now.

## Non-Goals

- No memory, knowledge, skill, task, decision, risk, or artifact extractor in
  this design.
- No direct AI writes to company knowledge. Future knowledge candidates must be
  suggestions for review only.
- No project, customer, or company-account primitive in this design.
- No reviewer assignment beyond the creator resolving review items.
- No full review UI design in this document.

## Recommended Approach

Upgrade the existing signal classifier output to v2 and keep routing decisions
inside the persisted signal classification. This is the smallest useful seam:
the classifier continues to triage the raw input once, while downstream
workflows read a structured routing contract before deciding whether to run.

A separate routing classifier would create a cleaner theoretical separation, but
it adds latency and operational complexity before there is more than one
implemented route. A generic event-routing abstraction would be more flexible,
but it would hide the current product decision behind premature infrastructure.

## Classification Contract

`signal.classification.v2` keeps the existing actionability fields and replaces
the v1 `routing.classifyPeople` hint with a structured routing object:

```ts
type SignalClassificationV2 = {
  schemaVersion: "signal.classification.v2";
  disposition: "actionable" | "needs_context" | "not_actionable";
  title: string;
  summary: string;
  kind:
    | "engage"
    | "follow_up"
    | "review"
    | "fix"
    | "investigate"
    | "remember"
    | "other";
  nextAction: string;
  priority: "low" | "normal" | "high" | "urgent";
  rationale: string;
  confidence: number;
  routing: {
    visibility: {
      scope: "user" | "team" | "needs_review";
      rationale: string;
    };
    review: {
      required: boolean;
      reason:
        | "privacy"
        | "sensitive_person"
        | "authority"
        | "low_confidence"
        | "ambiguous_scope"
        | "other"
        | null;
      rationale: string | null;
    };
    routes: {
      people: {
        shouldRun: boolean;
        confidence: number;
        rationale: string;
      };
    };
  };
};
```

The classifier owns only routing decisions. It must not extract people,
memories, decisions, knowledge, skills, tasks, risks, or artifacts.

## Visibility Rules

Use `user` when the signal is primarily private to the creator:

- Personal reminders, habits, preferences, or working style.
- Individual availability, workload, or context that is not clearly shared team
  knowledge.
- Creator-only notes or requests where downstream use should stay tied to that
  user.

Use `team` when the signal is safe and useful for the organization:

- Shared work decisions, operational facts, owners, blockers, runbooks, or
  project state.
- Public or organization-visible people/contact references.
- Inputs submitted by trusted org automation that clearly describe shared
  work.

Use `needs_review` when the model should not decide visibility alone:

- Ambiguous scope where the signal could be either personal or team-visible.
- Sensitive person-related claims or inferred judgments.
- Low-confidence classifications that would trigger durable downstream writes.
- Potentially authoritative company knowledge that should be approved by a
  human.
- Privacy-sensitive content, secrets, or material that may have been submitted
  to the wrong tenant or audience.

## Review Gate

`needs_review` is a hard pipeline stop. When
`routing.visibility.scope === "needs_review"`:

- `routing.review.required` must be `true`.
- `routing.review.reason` must be non-null.
- `routing.review.rationale` must be non-null.
- `routing.routes.people.shouldRun` must be `false`.
- No downstream route may run.
- The workflow creates or persists a creator-owned review item and stops.

When `routing.visibility.scope` is `user` or `team`,
`routing.review.required` must be `false`, and both `routing.review.reason` and
`routing.review.rationale` must be `null`.

The creator resolves the review item in v1. Resolution can choose an approved
visibility scope and route decisions, after which the downstream pipeline can
resume from the reviewed routing state.

## People Route

`routes.people` is the only route in v2. It replaces the legacy
`routing.classifyPeople` hint.

Set `routes.people.shouldRun` to `true` only when:

- The signal does not require review.
- The input plausibly contains durable social or contact identity material.
- A dedicated people extraction pass could create or update org-scoped People.

Set it to `false` when:

- Visibility is `needs_review`.
- The input contains no durable identity material.
- The input mentions people only by name with no durable identity.
- The signal is noise, spam, or not actionable.

The people classifier remains responsible for extraction and normalization
checks. The signal classifier only decides whether that classifier should run.

## Workflow Behavior

The `classify-signal` workflow should follow this order:

1. Load and claim the queued signal.
2. Run `@repo/ai/signal-classifier` and persist the v2 classification.
3. If `routing.visibility.scope === "needs_review"`, create a creator review
   item and return without sending downstream events.
4. If `routing.routes.people.shouldRun === true`, send
   `app/people.classification.requested`.
5. Return classified status with routing metadata for observability.

Existing v1 classified rows remain readable. Workflow helpers that inspect
routing should accept both v1 and v2 during migration:

- v1: `classification.routing?.classifyPeople?.shouldRun === true`
- v2:
  `classification.routing.visibility.scope !== "needs_review" &&
  classification.routing.routes.people.shouldRun === true`

## Schema Ownership

`@repo/api-contract` owns the persisted `signal.classification.v2` schema
because it is stored in `lightfast_signals.classification` and returned through
API surfaces.

`@repo/ai/signal-classifier` owns the model-facing strict structured-output
schema. The model-facing schema should require all routing fields so the model
always emits a complete routing decision.

`api/app` owns workflow interpretation: review gating, event emission, and
backward-compatible v1 routing support.

## Future Routes

Future routes should be added as explicit keys under `routing.routes` only when
their downstream workflow exists or is being implemented. Candidate future keys
include:

- `memory`
- `knowledgeSuggestion`
- `decision`
- `task`
- `risk`
- `skill`
- `artifact`

Knowledge routes, when added, must remain suggestion-only and review-gated.
The classifier may recommend a knowledge suggestion route, but it must not write
authoritative company knowledge directly.

## Testing

Add focused contract tests before implementation changes:

- v2 schema accepts a valid team-visible people route.
- v2 schema accepts a user-visible signal with no people route.
- v2 schema rejects invalid review states.
- `needs_review` fixtures force `people.shouldRun` to `false`.
- Prompt tests assert that the classifier is instructed to decide visibility,
  preserve uncertainty, stop on review, and avoid extraction.
- Workflow tests assert that `needs_review` does not queue people
  classification.
- Workflow tests assert that v2 team/user scopes can queue people
  classification when `routes.people.shouldRun` is true.
- Migration tests assert that existing v1 `routing.classifyPeople` rows still
  route people classification.

## Rollout

Ship this behind a schema-version migration inside the classifier and workflow.
New classifications should use `signal.classification.v2`. Existing v1 rows
remain valid and keep their current people-routing behavior. Downstream
extractors beyond people should not be introduced until their route key and
workflow are designed separately.
