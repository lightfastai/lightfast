# Braintrust Agent Runtime Refactor Design

## Summary

Refactor the Braintrust integration so Lightfast treats Braintrust projects as
runtime and evaluation boundaries, not as prompt-specific containers. The
current parent, `project_name:lightfast-signals`, is defined inside the signal
classifier package and is used by app-wide instrumentation. That naming no
longer matches the product shape because signal classification routes into
people classification, and future agents/prompts are expected to call each other
through routers.

The new default project should be:

```text
project_name:lightfast-agent-runtime
```

Individual prompts, routers, and workflow steps should be represented as
metadata on AI spans, with stable graph and node ids that make Braintrust
filtering, review, online scoring, and eval datasets usable without splitting
related traces across many projects.

## Current State

`@vendor/braintrust` owns the vendor integration mechanics:

- `vendor/braintrust/src/env.ts` validates `BRAINTRUST_API_KEY`.
- `vendor/braintrust/src/otel.ts` wraps `BraintrustExporter`.
- The exporter uses `filterAISpans: true`, so only AI spans are sent.

`@repo/ai` owns AI behavior:

- `ai/src/signal-classifier/constants.ts` defines
  `SIGNAL_CLASSIFIER_BRAINTRUST_PARENT = "project_name:lightfast-signals"`.
- `ai/src/signal-classifier/classify.ts` emits metadata with `feature`,
  `workflow`, `promptId`, `schemaVersion`, `signalId`, org/environment, and
  input length.
- `ai/src/people-classifier/classify.ts` emits similar metadata for people
  extraction, but it does not define or own the Braintrust parent.

`apps/app` owns runtime instrumentation:

- `apps/app/src/instrumentation.ts` imports the signal classifier Braintrust
  parent and passes it to `registerBraintrustOTel`.
- This means a signal-specific constant controls all app AI telemetry.

The signal and people workflows are connected:

- `classify-signal` runs from `app/signal.created`.
- Signal classification emits a routing decision in
  `routing.classifyPeople.shouldRun`.
- When true, the signal workflow sends `app/people.classification.requested`.
- `classify-people` loads the classified signal and uses the signal
  classification as prompt context.

## Goals

- Use a Braintrust project name that matches the connected agent runtime, not a
  single prompt or feature.
- Keep Braintrust project count low so related agent runs can be reviewed,
  filtered, and scored together.
- Preserve the existing privacy posture: no raw prompt text or model output in
  Braintrust telemetry by default.
- Make prompt and router relationships explicit through stable metadata.
- Create a reusable telemetry taxonomy for future interrelated agents.
- Keep `@vendor/braintrust` vendor-only and `@repo/ai` behavior-owned.
- Keep the refactor small enough to land before deeper trace propagation or eval
  runner work.

## Non-Goals

- Do not adopt Braintrust-hosted prompt invocation in production.
- Do not start recording prompt inputs or model outputs in production spans.
- Do not create Braintrust datasets, scorers, or eval runners in this refactor.
- Do not attempt full distributed OTel trace propagation across Inngest events in
  the first implementation pass.
- Do not rename application routes, public API contracts, or database tables.

## Braintrust Project Boundary

Use one Braintrust parent for the app-owned AI runtime:

```text
project_name:lightfast-agent-runtime
```

This project should contain production logs, prompt/node telemetry, reviews, and
future online scorers for connected Lightfast agent behavior. Split into a new
Braintrust project only when there is a real operational boundary:

- separate product surface,
- separate data/privacy policy,
- separate owning team,
- unrelated evaluation lifecycle,
- or an external/customer-owned agent runtime.

Do not create one Braintrust project per prompt. Prompt-specific projects would
hide cross-agent routing behavior and make it harder to evaluate a complete
agent run.

## Package Boundary

Add a neutral telemetry export under `@repo/ai`.

Proposed files:

- `ai/src/telemetry/index.ts`
- `ai/src/telemetry/braintrust.ts`
- `ai/src/telemetry/metadata.ts` if the metadata helper grows beyond constants.

Proposed package export:

```json
"./telemetry": {
  "types": "./src/telemetry/index.ts",
  "default": "./src/telemetry/index.ts"
}
```

Move the app-wide Braintrust parent out of
`ai/src/signal-classifier/constants.ts`:

```ts
export const LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT =
  "lightfast-agent-runtime";

export const LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT =
  `project_name:${LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT}`;
```

`apps/app/src/instrumentation.ts` should import from `@repo/ai/telemetry`, not
from `@repo/ai/signal-classifier`.

`@vendor/braintrust` should remain a vendor abstraction. It should not know
Lightfast project names, prompt ids, graph ids, workflow names, or business
metadata.

## Metadata Taxonomy

Use metadata as the main way to separate prompts and routes inside the shared
Braintrust project.

Required metadata for every Lightfast AI span:

```ts
{
  agentGraphId: string;
  agentRunId: string;
  deploymentEnvironment: "development" | "preview" | "production";
  feature: string;
  inputLength: number;
  model: string;
  nodeId: string;
  promptId: string;
  promptRole: "classifier" | "router" | "extractor" | "summarizer" | "tool" | "other";
  schemaVersion: string;
  workflow: string;
}
```

Required when available:

```ts
{
  clerkOrgId: string;
  routerId: string;
  upstreamNodeId: string;
}
```

Optional for future graph routing:

```ts
{
  agentStepId: string;
  routeDecision: string;
  routeDecisionCode: string;
  sourceEventName: string;
}
```

For the existing signal pipeline:

Signal classifier metadata:

```ts
{
  agentGraphId: "signal-intake",
  agentRunId: signalId,
  routerId: "signals",
  nodeId: "signal-classifier",
  promptId: "signal-classifier",
  promptRole: "router",
  workflow: "classify-signal",
  schemaVersion: "signal.classification.v1"
}
```

People classifier metadata:

```ts
{
  agentGraphId: "signal-intake",
  agentRunId: signalId,
  routerId: "signals",
  nodeId: "people-classifier",
  upstreamNodeId: "signal-classifier",
  promptId: "people-classifier",
  promptRole: "extractor",
  workflow: "classify-people",
  schemaVersion: "people.classification.v1"
}
```

`agentRunId` should be the stable logical run id used to correlate routed spans
when Inngest creates separate function executions. For the current signal
pipeline, `signalId` is the correct run id.

## Prompt Identity

Prompt ids should be stable node identifiers, not project names. Existing prompt
ids can stay unchanged in code for this refactor:

- `signal-classifier`
- `people-classifier`

Future prompt ids should be scoped by graph when ambiguity appears:

- `signal-intake.signal-classifier`
- `signal-intake.people-classifier`
- `billing.invoice-router`

Do not encode versions in prompt ids. Schema versions already describe output
contracts, and Braintrust-managed prompts can handle prompt version history if
that is adopted later.

## Trace and Routing Model

Phase 1 should not try to force one physical OTel trace across Inngest function
boundaries. It should guarantee logical correlation through metadata:

- same `agentGraphId`,
- same `agentRunId`,
- `nodeId` and `upstreamNodeId`,
- shared `routerId`,
- workflow-specific `promptId` and `schemaVersion`.

This gives Braintrust enough structure for filtering, dashboards, manual review,
and later offline eval grouping.

A future phase can add OTel context propagation through Inngest event payloads if
we need one physical trace tree across multiple queued functions. That should be
designed separately because it touches event schemas, span context baggage, and
durable workflow replay behavior.

## Privacy

Keep the current AI SDK telemetry posture:

- `recordInputs: false`
- `recordOutputs: false`
- metadata-only logs
- no prompt text in app logs
- no model output in app logs

Metadata may include ids, environment, schema versions, workflow names, model,
input length, and routing/node identifiers. Metadata should not include raw
signal input, prompt text, extracted person identity values, model output JSON,
or free-form route rationale unless it has been reviewed as safe.

The current `routing.classifyPeople.rationale` is model output and should not be
sent to Braintrust metadata in Phase 1.

## Testing

Update unit tests to lock the new boundaries:

- Signal classifier tests should no longer assert
  `SIGNAL_CLASSIFIER_BRAINTRUST_PARENT`.
- Add telemetry tests for `@repo/ai/telemetry` asserting the parent is
  `project_name:lightfast-agent-runtime`.
- Signal classifier tests should assert `agentGraphId`, `agentRunId`,
  `routerId`, `nodeId`, and `promptRole` metadata.
- People classifier tests should assert the same plus
  `upstreamNodeId: "signal-classifier"`.
- App instrumentation tests, if present or added, should assert that the app
  imports the parent from `@repo/ai/telemetry`.
- Existing `@vendor/braintrust` tests should continue to assert that the vendor
  wrapper accepts a caller-provided parent and passes it to `BraintrustExporter`.

Run focused verification:

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai typecheck
pnpm --filter @vendor/braintrust test
pnpm --filter @vendor/braintrust typecheck
pnpm --filter @api/app test
pnpm --filter lightfast-app typecheck
```

Use broader repo checks only if the implementation touches shared type exports
or package lockfile boundaries.

## Migration Steps

1. Add `@repo/ai/telemetry` with the shared Braintrust project parent and
   metadata types/helpers.
2. Change `apps/app/src/instrumentation.ts` to import the parent from
   `@repo/ai/telemetry`.
3. Remove `SIGNAL_CLASSIFIER_BRAINTRUST_PARENT` from the signal classifier
   public surface.
4. Add graph/node metadata to signal classification spans.
5. Add graph/node/upstream metadata to people classification spans.
6. Update tests that encoded the old project name.
7. Run focused package tests and typechecks.

## Decisions

- Keep existing prompt ids for this refactor to avoid mixing naming migration
  with project boundary cleanup.
- Add a small typed metadata helper now, because future prompts will otherwise
  drift.
- Leave Braintrust enabled behavior unchanged in this refactor. A separate
  enable/disable flag can be added if local development or preview deploys need
  softer env requirements.
- Do not send free-form routing rationale in Braintrust metadata. If future
  routing metadata is needed, prefer bounded codes such as `routeDecisionCode`.

## Success Criteria

- No app instrumentation import depends on `@repo/ai/signal-classifier` for a
  Braintrust parent.
- Braintrust exporter receives `project_name:lightfast-agent-runtime`.
- Signal and people classifier spans can be filtered by graph, node, prompt,
  workflow, schema version, environment, org, and run id.
- Prompt text and model output remain absent from Braintrust telemetry.
- The vendor Braintrust package remains Lightfast-domain-agnostic.
