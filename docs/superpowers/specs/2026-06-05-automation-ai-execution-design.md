# Automation AI execution with selected connector tools — Design

Date: 2026-06-05
Status: Approved (design); pending implementation plan
Area: app automations, Inngest runner, connector provider routines

## Summary

Automations currently persist a selected `connectorProvider`, but the run
executor is still a scaffold. This design turns `runAutomation` into a real
background AI execution loop. Each run uses the automation prompt, the selected
single connector, and write-capable provider routines. The run stores a
versioned full transcript artifact with provider payloads redacted and provider
routine calls linked by id.

The first implementation should use a dedicated automation execution service.
It should reuse existing Lightfast patterns for Inngest durability, Vercel AI
Gateway model calls, provider routine discovery/calls, and provider routine call
ledger auditing.

## Current context

- `api/app/src/inngest/workflow/run-automation.ts` loads the automation and
  run, claims the run, then completes with scaffold output:
  `"Automation scaffold executed. AI execution is not enabled."`
- Automation create already persists `connectorProvider` on
  `lightfast_org_automations`.
- `api/app/src/services/connectors/runtime.ts` can call Linear and X connector
  MCP tools and records automation-origin provider calls, but the automation
  runner does not invoke it.
- `packages/provider-routines` exposes `findProviderRoutines` and
  `callProviderRoutine`, but the current service is shaped for chat/native
  agent use: it is Linear-only, checks `enabledForAgents`, and uses user caller
  semantics.
- The workspace assistant chat route already demonstrates AI SDK tool loops,
  Vercel AI Gateway model fallback, provider routine tools, usage capture, and
  telemetry.

## Decisions

| Topic | Decision |
| --- | --- |
| Runner shape | Dedicated automation AI execution service called from `runAutomation` |
| Connector scope | Exactly one selected connector per automation, from `automation.connectorProvider` |
| Tool permissions | Automations may use write-capable provider routines |
| Tool discovery | Model gets `findProviderRoutines` scoped to the selected connector |
| Tool calls | Model gets `callProviderRoutine`, rejecting routine ids for any other connector |
| Provider enablement | Automation tool access checks connector `enabledForAutomations`, not just `enabledForAgents` |
| Attribution | Provider calls use `automation.createdByUserId` as the attributable user for v1 |
| Run output | Store a full transcript artifact in `automation_run.output` |
| Provider payload storage | Redact raw provider inputs/outputs in run output; link provider routine call ids |
| UI | Small follow-through only: selected connector on automation detail, better run output rendering |
| Future upgrade path | More execution strategies can be added later without changing the persisted selected connector |

## Goals

- Execute scheduled and manual automation runs through a bounded AI loop.
- Give the model access only to routines from the automation's selected
  connector.
- Allow write-capable connector actions when the selected connector is active
  and enabled for automations.
- Persist a versioned full transcript that explains what the run did.
- Keep raw provider payloads, OAuth tokens, and provider responses out of
  `automation_run.output`.
- Record every provider routine call through the provider routine ledger.
- Preserve durable Inngest retry behavior and existing run lifecycle states.

## Non-goals

- No multi-connector automations.
- No per-run interactive approval checkpoint before write tools.
- No streaming run UI.
- No new automation conversation table in v1.
- No raw provider request or response payload persistence in automation run
  output.
- No replacement of the existing provider routine ledger.
- No generic graph model or new Decisions UI in this workstream.

## Architecture

### Inngest workflow

`runAutomation` remains the durable workflow boundary. It should keep the
existing checks:

1. load the automation run;
2. skip non-pending runs;
3. load the automation;
4. skip inactive or missing automation rows;
5. skip stale schedule versions;
6. claim the run as `running`.

After the run is claimed, the workflow delegates to a new automation AI
execution service. The workflow then persists either a completed run output or a
failed run error.

### Automation AI execution service

The execution service builds a model request from:

- `automation.publicId`;
- `run.publicId`;
- `automation.name`;
- `automation.prompt`;
- `automation.connectorProvider`;
- `automation.scheduleKind`;
- `automation.scheduleConfig`;
- `automation.timezone`;
- the current timestamp;
- the deployment environment;
- provider routine tools scoped to the selected connector.

The service should use the AI SDK through `@vendor/ai`, with Vercel AI Gateway
as the model provider. The default model policy should follow the workspace
assistant pattern unless the implementation plan chooses a repo-local constant:
primary `anthropic/claude-sonnet-4.6`, fallback `openai/gpt-5.4`, gateway tags
including `feature:automation-run`, org id, automation id, run id, connector
provider, and environment.

The model loop should be bounded by a small step count. V1 uses a maximum of
`5` model/tool steps and keeps the current Inngest finish timeout at `5m` unless
implementation testing proves that `10m` is necessary.

### Provider routine service extension

The provider routine boundary must support automation use directly. The current
chat/native-agent assumptions are not sufficient.

The implementation should extend or wrap provider routines so automation calls
can:

- find routines for both `linear` and `x`;
- filter by required `provider`;
- require connector `status = "active"`;
- require `enabledForAutomations = true`;
- allow read and write routines when the automation context has write scope;
- reject routine ids whose provider does not match
  `automation.connectorProvider`;
- create provider routine call ledger rows with automation source semantics.

The automation provider routine context should use:

- `source.surface = "automation"`;
- `source.ref = run.publicId`;
- `actor.orgId = automation.clerkOrgId`;
- `actor.userId = automation.createdByUserId`;
- `scopes.providerRoutineRead = true`;
- `scopes.providerRoutineWrite = true`.

Provider routine call ledger rows should use:

- `calledByKind = "automation"`;
- `calledById = run.publicId`;
- `calledByUserId = automation.createdByUserId`;
- `sourceSurface = "automation"`;
- `sourceRef = run.publicId`.

If the lower-level connector runtime remains the easiest path for X calls, the
automation provider routine adapter may delegate to it internally. The public
automation model tools should still present the provider routine contract, not
provider-specific runtime functions.

## Model tools

The automation service exposes exactly two tools to the model.

### `findProviderRoutines`

Finds routines available to this automation through the selected connector.

Required behavior:

- forces `provider = automation.connectorProvider`;
- includes input schemas so the model can call tools correctly;
- does not force `readOnly`;
- respects `providerRoutineRead` and `providerRoutineWrite` scope checks;
- returns no routines when the selected connector is not active or not enabled
  for automations.

### `callProviderRoutine`

Calls one provider routine.

Required behavior:

- parses the requested `routineId`;
- rejects the call before provider execution when the routine provider does not
  equal `automation.connectorProvider`;
- validates the tool input against the current cached tool manifest;
- re-checks the current connector row immediately before every provider call;
- records a provider routine call ledger row;
- returns either a successful tool result to the model or a safe tool failure.

The model should be instructed to use `findProviderRoutines` before calling a
routine unless it already has a valid routine id from the same run.

## System prompt

The automation system prompt should be short and operational:

- identify the run as a scheduled Lightfast automation;
- instruct the model to perform the user's automation prompt;
- state that it may use only the selected connector's routines;
- state that write-capable routines are allowed when necessary to satisfy the
  automation prompt;
- instruct it to prefer a concise final summary that states what was done;
- instruct it to stop and explain if required tools are unavailable.

The prompt must not include raw connector secrets or provider tokens.

## Run output artifact

`automation_run.output` becomes a versioned execution artifact for successful AI
runs.

Schema version:

```text
automation.run.ai.v1
```

Conceptual shape:

```json
{
  "schemaVersion": "automation.run.ai.v1",
  "automationId": "automation_...",
  "runId": "automation_run_...",
  "connectorProvider": "linear",
  "model": "anthropic/claude-sonnet-4.6",
  "finishReason": "stop",
  "usage": {},
  "startedAt": "2026-06-05T00:00:00.000Z",
  "finishedAt": "2026-06-05T00:00:30.000Z",
  "finalText": "Created the Linear issue and linked the relevant context.",
  "providerRoutineCallIds": ["provider_routine_call_..."],
  "transcript": []
}
```

Transcript events should preserve the full message/tool flow needed for
debugging while redacting provider payloads.

Allowed transcript event kinds:

- `system`: model-visible system prompt content plus a content hash. If a
  future implementation adds customer-sensitive context to the system prompt,
  that segment may be replaced by `contentRedacted: { "present": true }` and a
  hash for the redacted segment.
- `user`: the automation prompt as given by the automation owner.
- `assistant`: assistant text or tool-call intent.
- `tool_call`: routine id, provider, provider tool name, provider routine call
  id when available, and `inputRedacted`.
- `tool_result`: provider routine call id, status, and `outputRedacted`.
- `tool_error`: provider routine call id when available, routine id, and safe
  error code/message.

Redaction rules:

- Store `{ "present": true }` when a provider input or output exists.
- Store `null` when no provider input or output exists.
- Do not store OAuth access tokens.
- Do not store OAuth refresh tokens.
- Do not store raw MCP request arguments.
- Do not store raw MCP responses.
- Do not store raw downstream error messages that may contain provider data.

The provider routine ledger remains the source of truth for external calls.
`automation_run.output` is a run narrative with links to provider call records.

## Failure behavior

The automation executor should fail the run with stable error codes. The error
message should be safe for display in run detail.

| Condition | Error code |
| --- | --- |
| Selected connector is missing, inactive, or not enabled for automations | `AUTOMATION_CONNECTOR_NOT_ENABLED` |
| Selected connector has no available routines | `AUTOMATION_CONNECTOR_NO_TOOLS` |
| Model gateway, timeout, or generation failure | `AUTOMATION_MODEL_FAILED` |
| The loop finishes without final assistant text | `AUTOMATION_EMPTY_OUTPUT` |
| Provider routine call failure prevents successful completion | `AUTOMATION_TOOL_FAILED` |

Recoverable tool failures may be returned to the model as tool results so the
model can choose another action or explain the failure. If the final run cannot
complete successfully, the workflow should mark the run failed instead of
storing a completed output.

The existing `onFailure` handler should continue to catch exhausted retries and
mark the run failed.

## UI surface

The existing create form connector selector remains the creation surface for v1.

Small follow-through changes:

- automation detail shows the selected connector;
- run detail detects `schemaVersion = "automation.run.ai.v1"` and renders a
  readable transcript/output view instead of an undifferentiated JSON blob;
- run detail lists provider routine call ids in order;
- provider routine call ids should be copyable or linkable later when Decisions
  supports filtering by `sourceRef = run.publicId`.

A dedicated transcript viewer is not required for the first implementation.

## Testing strategy

### Unit tests

- Automation execution service builds a model request using automation name,
  prompt, selected connector, run id, and schedule metadata.
- `findProviderRoutines` always filters to the selected connector.
- `callProviderRoutine` rejects routine ids for other providers.
- Provider routine automation context uses `source.surface = "automation"`,
  `source.ref = run.publicId`, read/write scopes, and `createdByUserId`
  attribution.
- Run output builder redacts provider inputs and outputs while preserving
  provider routine call ids.
- Failure mapper returns the stable automation error codes listed above.

### Workflow tests

- `runAutomation` calls the automation execution service after claiming a run.
- Successful execution marks the run completed with
  `schemaVersion = "automation.run.ai.v1"`.
- Missing or disabled selected connector marks the run failed with
  `AUTOMATION_CONNECTOR_NOT_ENABLED`.
- Stale schedule version and inactive automation still skip as today.
- Exhausted retry failure still marks the run failed through the existing
  `onFailure` path.

### Provider routine tests

- Automation routine discovery includes only automation-enabled routines for the
  selected provider.
- Linear write routines are available when the selected provider is `linear` and
  write scope is true.
- X routines are available when the selected provider is `x` and the connector
  is enabled for automations.
- Calls create provider routine ledger rows with automation caller/source
  semantics.
- Ledger and run output redaction assertions prove raw provider payloads are not
  stored.

### E2E smoke

Use local infra to create an automation with selected connector `x`, seed an
active automation-enabled X connector, run the automation manually, and assert:

- the run transitions to `completed`;
- `automation_run.output.schemaVersion` is `automation.run.ai.v1`;
- `automation_run.output.connectorProvider` is `x`;
- transcript includes redacted tool events;
- provider routine call rows are linked to the run id.

## Risks and mitigations

- **Write-capable scheduled actions:** The selected connector and
  `enabledForAutomations` gate are the hard safety boundary. The run transcript
  and provider routine ledger provide auditability.
- **Provider routine package drift:** The current provider routine service is
  Linear/agent-focused. The implementation plan must explicitly extend it for
  X and automation enablement, or add an automation-specific wrapper with the
  same public contract.
- **Large run outputs:** Full transcripts can grow. V1 should keep the step
  limit small and store redacted provider payloads only. If output size becomes
  a problem, later versions can move transcripts to a separate table.
- **Model nondeterminism:** Tests should mock the AI SDK/model layer. E2E smoke
  should validate system integration, not exact model wording.
- **Retry duplication:** Inngest idempotency remains `event.data.runId`.
  Provider routine calls should be created only inside the claimed running run,
  so retries after a failed attempt remain auditable as separate provider
  attempts for the same run.

## Open questions

None. The approved v1 scope is a dedicated automation AI service, write-capable
selected-connector routines, full redacted transcript output, and small UI
follow-through.
