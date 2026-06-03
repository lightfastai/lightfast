# Integration Call Ledger Design

Date: 2026-06-02
Status: Approved for implementation planning

## Summary

Lightfast will add a minimal team integration call ledger. Day 1 is not a
Decision Graph, graph node model, or generic event stream. It records one simple
fact for every team integration routine call:

```text
who called it, what was called, and what happened
```

The first producer is the existing Linear MCP runtime. The ledger must be
generic enough for future chat-triggered Linear calls, but the implementation
should stay narrowly scoped to current connector runtime behavior.

## Goals

- Persist every Linear MCP runtime call made through the Lightfast connector
  runtime boundary.
- Record whether the caller was an automation, user, or system.
- Record the calling id in a single caller field.
- Preserve the existing org/team-owned Linear connection semantics.
- Store provider, routine, provider tool name, connector row id, provider
  workspace id, and provider actor id for audit/debugging.
- Track lifecycle as `running`, `succeeded`, or `failed`.
- Store only redacted input/output summaries and safe errors.
- Keep raw tokens and credential material out of the ledger.
- Keep the day-1 schema small and easy to query.

## Non-Goals

- No graph tables.
- No graph edges.
- No source-type/source-public-id abstraction.
- No chat tables.
- No user-facing graph UI.
- No durable raw provider request or response payloads.
- No provider-specific Linear call table.
- No changes to Linear OAuth setup semantics.
- No per-tool policy changes.

## Current Context

Current Linear calls pass through `api/app/src/services/connectors/runtime.ts`.
The runtime loads active automation-enabled org connector rows, exposes cached
MCP tools, re-checks current state before each call, obtains a fresh Linear
token, then calls `callLinearMcpTool`.

Current automation runs live in `lightfast_automation_runs`, but only store a
coarse `output`, `errorCode`, and `errorMessage`. The automation executor is
still scaffolded and does not yet perform AI/tool execution. The call ledger
should attach at the connector runtime boundary so it works for automation now
and for chat later.

## Data Model

Add one table:

```text
lightfast_integration_calls
```

Fields:

- `id`: internal bigint primary key.
- `publicId`: stable public id with prefix `integration_call_`.
- `clerkOrgId`: Lightfast org/team that owns the execution context.
- `calledByKind`: `user`, `automation`, or `system`.
- `calledById`: user id, automation run id, or controlled system label.
- `calledByUserId`: nullable Clerk user id when a human user directly caused the
  call.
- `provider`: controlled provider code, initially `linear`.
- `routineName`: Lightfast runtime routine name, e.g. `linear__create_issue`.
- `providerToolName`: provider-native tool name, e.g. `create_issue`.
- `connectorConnectionId`: current `lightfast_org_connector_connections.id`
  used for the call.
- `providerWorkspaceId`: copied from the connector row at call time.
- `providerActorId`: copied from the connector row at call time.
- `status`: `running`, `succeeded`, or `failed`.
- `inputRedacted`: nullable JSON object.
- `outputRedacted`: nullable JSON object.
- `errorCode`: nullable controlled/safe error code.
- `errorMessage`: nullable safe error message.
- `startedAt`: call start timestamp.
- `finishedAt`: nullable call finish timestamp.
- `createdAt`: row creation timestamp.
- `updatedAt`: row update timestamp.

Indexes:

- Unique `publicId`.
- `(clerkOrgId, createdAt, id)` for org audit timelines.
- `(clerkOrgId, calledByKind, calledById, createdAt, id)` for caller-specific
  drilldown.
- `(provider, routineName, createdAt, id)` for provider/routine analysis.

## Runtime Behavior

When `callConnectorRuntimeTool` is about to invoke Linear MCP:

1. Insert an integration call row with `status = "running"`.
2. Use `calledByKind = "automation"` when a run id is present.
3. Use `calledById = runPublicId` for automation calls.
4. Copy connector identity metadata from the current connector row.
5. Call Linear MCP exactly as today.
6. On success, mark the row `succeeded`, set `finishedAt`, and store a redacted
   output summary.
7. On failure, mark the row `failed`, set `finishedAt`, and store safe
   `errorCode` / `errorMessage`.

If the runtime fails before a current connector row is available, it should not
insert a call row in day 1. The ledger records provider routine calls, not every
failed preflight.

If the runtime has selected a current connector row and valid routine, token
refresh failure counts as a failed integration call even when the MCP request is
never sent. From the user's perspective, Lightfast attempted to use the team
Linear integration and failed while preparing provider credentials.

Ledger writes must not become a hard dependency for provider calls. If creating
or updating a ledger row fails, the runtime should log the ledger failure with
redacted metadata and preserve the provider call result.

## Redaction

Day 1 redaction should be conservative:

- `inputRedacted`: `{ "present": true }` when input is provided, otherwise
  `null`.
- `outputRedacted`: `{ "present": true }` when a provider result is returned,
  otherwise `null`.
- Safe Linear errors may store the existing sanitized error code/message.
- Non-Linear or unknown errors may store the error name and omit raw messages.

The ledger must not store:

- OAuth access tokens.
- OAuth refresh tokens.
- Full MCP request arguments.
- Full MCP responses.
- Raw downstream error messages that may contain user/provider data.

## Caller Semantics

Day 1 caller values:

```text
calledByKind = automation
calledById = automation run public id
calledByUserId = null
```

Future chat calls can use:

```text
calledByKind = user
calledById = Clerk user id
calledByUserId = Clerk user id
```

This keeps the schema simple while preserving the team-vs-user distinction the
product needs.

## API / UI

No new UI is required for day 1.

Expose DB helpers only. A tRPC query for integration call history can be added
later when a run detail or audit page needs it.

## Testing

- DB schema/helper tests should cover public id generation, insert-running, mark
  succeeded, and mark failed.
- Connector runtime tests should verify a Linear call creates a running row and
  updates it on success.
- Connector runtime tests should verify Linear MCP failures mark the call
  failed with safe error fields.
- Connector runtime tests should verify disabled/missing connector preflight
  failures do not create ledger rows.
- Existing runtime redaction assertions should continue to pass.

## Migration Path

This ledger can later feed a Decision Graph without changing day-1 call capture.
Future graph nodes can reference `integrationCallId`, or graph views can derive
routine-call nodes from this table.
