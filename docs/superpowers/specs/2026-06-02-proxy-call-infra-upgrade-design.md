# Provider Routine Proxy Infrastructure Design

Date: 2026-06-02
Status: Draft after architecture grill

## Summary

Lightfast will add a user-scoped provider routine proxy that lets hosted MCP and
the first-party CLI discover and call connected provider routines through
Lightfast-managed org provider credentials.

The external operation names are:

```text
proxy_find
proxy_call
```

The internal domain is provider routines:

```text
routineId = linear__create_issue
providerToolName = create_issue
providerRoutineCallId = provider_routine_call_...
```

Hosted MCP should expose only the two generic proxy tools, not one MCP tool per
connected provider routine. This prevents a user's MCP tool catalog from
exploding as an org connects more apps. `proxy_find` is search/filter-first and
returns only routines the current user, org, source, and grant are allowed to
call. `proxy_call` executes exactly one routine with a validated JSON-object
input.

This design intentionally drops the earlier public oRPC/API-key version. The
local `core/mcp` and API-key SDK paths are legacy during the migration to
cloud-hosted, user-level MCP. V1 proxy execution is user-authenticated through
hosted MCP OAuth or native CLI OAuth.

## Goals

- Provide one shared server-side provider routine service for hosted MCP and
  native CLI routes.
- Keep org provider credentials, token refresh, provider dispatch, ledger
  writes, and policy checks server-side.
- Keep provider credentials org-scoped in v1 while making every proxy caller
  user-scoped for Lightfast authorization and attribution.
- Preserve the existing provider runtime id convention, for example
  `linear__create_issue`.
- Add a pure `@repo/provider-routine-contract` package for routine ids, schemas,
  classifications, search inputs, call inputs, and result envelopes.
- Add a server-only `@repo/provider-routines` package for routine search and
  execution.
- Rename the durable execution record from integration-call language to
  provider-routine language before the ledger hardens.
- Add an explicit org/provider `enabledForAgents` delegation flag separate from
  `enabledForAutomations`.
- Use hosted MCP scopes for third-party MCP clients:
  `mcp:provider_routines:read` and `mcp:provider_routines:write`.
- Let CLI use first-party native OAuth without MCP-style provider routine scopes
  for now.

## Non-Goals

- No public `/api/v1` oRPC proxy procedures in v1.
- No API-key or SDK proxy-call surface in v1.
- No local `core/mcp` API-key proxy integration in v1.
- No raw arbitrary URL proxy.
- No provider manifest refresh during `proxy_find`.
- No dynamic registration of every provider routine as an MCP tool.
- No idempotency key requirement in v1.
- No rate limiting in v1.
- No dry-run mode.
- No human confirmation flow.
- No multi-step or cross-provider orchestration inside `proxy_call`.
- No per-routine admin allowlist UI in v1.
- No automation runtime migration in this scope; defer to a follow-up issue.

## Branch Context

This work should land after, or on top of, these branches:

- `feat/remote-mcp`: introduces hosted MCP at `apps/mcp`, with user/org OAuth
  context containing `userId`, `orgId`, `clientId`, `grantId`, and scopes.
- `feat/integration-call-ledger`: introduces the first durable provider call
  ledger around the current Linear MCP connector runtime.

The current design supersedes the stale assumption that proxy calls should enter
through public oRPC or API-key surfaces. Hosted MCP and native CLI should adapt
their user-auth contexts into shared provider-routine service functions.

## Vocabulary

External surface names:

```text
proxy_find
proxy_call
lightfast proxy find
lightfast proxy call
/api/native/proxy/routines
/api/native/proxy/call
```

Internal domain names:

```text
provider routine
provider routine id
provider routine call
findProviderRoutines
callProviderRoutine
```

Durable storage names:

```text
lightfast_provider_routine_calls
provider_routine_call_...
routineId
providerToolName
providerConnectionId
```

`proxy` describes the mediated external access path. `provider routine`
describes the executable unit inside Lightfast.

## Routine Ids

Provider routines use the existing MCP-layer namespacing convention:

```text
<provider>__<providerToolName>
```

Examples:

```text
linear__create_issue
linear__list_issues
linear__foo__bar
```

The first `__` separates the provider from the provider-native tool name.
Provider tool names may contain additional double underscores and must be
preserved after the first separator.

The routine-centric formatter/parser should be added to
`@repo/provider-routine-contract` under these names:

```ts
providerRoutineId(provider, providerToolName)
parseProviderRoutineId(routineId)
providerRoutineIdSchema
providerToolNameSchema
```

Because `@repo/provider-routine-contract` imports provider ids from
`@repo/connector-contract`, `@repo/connector-contract` must not import back from
the new package. Keep the existing connector runtime helper implementations in
`@repo/connector-contract` as temporary compatibility helpers. A later provider
taxonomy package can remove that duplication when the product-wide terminology
migration happens.

## Auth And Caller Model

Every accepted proxy call is user-scoped in Lightfast:

```text
orgId = current Lightfast org
userId = current Lightfast user
provider credentials = org-level provider connection
```

Hosted MCP context:

```text
sourceSurface = hosted_mcp
sourceRef = grantId
sourceClientId = clientId
calledByKind = user
calledById = userId
calledByUserId = userId
```

Native CLI context:

```text
sourceSurface = native_cli
sourceRef = cli
sourceClientId = native OAuth client id when available
calledByKind = user
calledById = userId
calledByUserId = userId
```

Current org membership must be checked at both find and call time, even if an
MCP grant was issued earlier.

## Provider Access Policy

Provider connection admin controls remain on the Connectors page for now.

Add `enabledForAgents` to the current org provider connection model. It is
separate from `enabledForAutomations`:

- `enabledForAutomations`: existing automation runtime delegation.
- `enabledForAgents`: hosted MCP and native CLI provider routine delegation.

`enabledForAgents` defaults to `false` on new and existing provider
connections. Org admins can toggle it. All org members can use provider routines
once the provider is connected and `enabledForAgents` is on, subject to source
policy and scopes.

Do not add a separate proxy policy table in v1. Provider-wide enablement plus
MCP read/write scopes are enough for the first version.

## Hosted MCP Scopes

Add hosted MCP provider routine scopes:

```text
mcp:provider_routines:read
mcp:provider_routines:write
```

Write implies read.

`proxy_find` should be exposed when the grant has either provider-routine scope.
`proxy_call` should also be exposed when the grant has either scope, but the
service enforces routine-level scope at call time:

- `read` routines: require read or write scope.
- `write` routines: require write scope.
- `unknown_write_default` routines: require write scope.

MCP grants can retain these scopes even when no org provider currently has
`enabledForAgents`. In that case `proxy_find` returns an empty result with a
compact reason.

## Routine Classification

Lightfast owns routine classification policy. Provider MCP metadata is only a
hint.

Classification values:

```text
read
write
unknown_write_default
```

Known read routines require read scope. Known write routines require write
scope. Unknown routines default to write-required and may be exposed only to
write-capable callers.

The policy overlay may also provide Lightfast-authored titles, descriptions,
tags, and examples for known routines. Dynamic provider metadata remains the
fallback.

## proxy_find

`proxy_find` is search/filter-first. It should not return the full allowed
catalog by default.

Input shape:

```ts
{
  query?: string;
  provider?: "linear";
  routineId?: string;
  readOnly?: boolean;
  includeSchema?: boolean;
  limit?: number;
}
```

Behavior:

- Return only executable routines for the current user/org/source.
- Do not reveal connected providers that are disabled for agents.
- Use cached provider MCP manifests only.
- Do not refresh provider manifests during search.
- Search metadata only in v1: provider, routine id, provider tool name, title,
  description, classification, and tags.
- Default to compact routine summaries.
- Include full input schema only when `includeSchema = true`.
- Return no disconnected, disabled, unauthorized, or stale-only routines.
- If no providers are enabled for agents, return `reason =
  "no_enabled_providers"`.
- If providers are enabled but no routines match, return `reason =
  "no_matching_routines"`.

Output shape:

```ts
{
  routines: Array<{
    routineId: string;
    provider: "linear";
    providerToolName: string;
    title: string;
    description?: string;
    classification: "read" | "write" | "unknown_write_default";
    inputSummary?: string;
    inputSchema?: unknown;
    examples?: Array<{
      label: string;
      input: Record<string, unknown>;
    }>;
  }>;
  reason?: "no_enabled_providers" | "no_matching_routines";
}
```

## proxy_call

`proxy_call` executes one provider routine by exact `routineId`.

Input shape:

```ts
{
  routineId: string;
  input: Record<string, unknown>;
}
```

Behavior:

- Accept JSON-object inputs only.
- Resolve and validate the provider routine id.
- Check current org membership.
- Check `enabledForAgents`.
- Check source scopes/policy.
- Check that the routine exists in the current cached manifest.
- Validate input against the routine input schema.
- Create a provider routine call row after routine, policy, connection, and
  input validation have succeeded.
- Refresh provider credentials server-side.
- Dispatch to the provider once.
- Return provider result body to the caller.
- Store only redacted summaries in the ledger.

`proxy_call` is synchronous only in v1.

Do not retry write or `unknown_write_default` routines after the provider
request may have been sent. Read routines may use conservative retry behavior if
the implementation can prove it is safe. Pre-dispatch preparation failures may
retry only when the operation is clearly safe.

Output shape:

```ts
{
  providerRoutineCallId: string;
  routineId: string;
  provider: "linear";
  providerToolName: string;
  status: "succeeded";
  result: unknown;
}
```

Failure shape when a call row exists:

```ts
{
  providerRoutineCallId: string;
  routineId: string;
  status: "failed";
  error: {
    code: string;
    message: string;
  };
}
```

Pre-acceptance failures, such as unknown routine, disabled provider, insufficient
scope, invalid input, or missing org membership, do not create call rows and do
not return `providerRoutineCallId`.

## Provider Routine Call Ledger

Rename the day-1 integration call ledger before it hardens:

```text
lightfast_integration_calls       -> lightfast_provider_routine_calls
integration_call_...              -> provider_routine_call_...
routineName                       -> routineId
connectorConnectionId             -> providerConnectionId
```

Recommended fields:

- `id`: internal bigint primary key.
- `publicId`: stable public id with prefix `provider_routine_call_`.
- `clerkOrgId`: Lightfast org.
- `calledByKind`: `user`, `automation`, or `system`.
- `calledById`: user id, automation run id, or controlled system label.
- `calledByUserId`: nullable Clerk user id when directly human-caused.
- `sourceSurface`: `hosted_mcp`, `native_cli`, `automation`, or `system`.
- `sourceRef`: grant id, automation run id, `cli`, or controlled system label.
- `sourceClientId`: MCP client id or native OAuth client id when available.
- `provider`: controlled provider code, initially `linear`.
- `routineId`: executable routine id, for example `linear__create_issue`.
- `providerToolName`: provider-native tool name, for example `create_issue`.
- `providerConnectionId`: selected org provider connection row id.
- `providerWorkspaceId`: copied from the connection row at call time.
- `providerActorId`: copied from the connection row at call time.
- `providerAttempted`: boolean.
- `status`: `running`, `succeeded`, or `failed`.
- `inputRedacted`: nullable JSON object.
- `outputRedacted`: nullable JSON object.
- `errorCode`: nullable controlled safe error code.
- `errorMessage`: nullable safe error message.
- `startedAt`: call start timestamp.
- `finishedAt`: nullable finish timestamp.
- `createdAt` / `updatedAt`.

Create no ledger row for malformed or unauthorized requests. Create a row once
the service has accepted a valid, authorized routine call against a selected
provider connection. Token refresh failure after that point records
`providerAttempted = false`. Provider dispatch attempts record
`providerAttempted = true`.

Ledger writes should remain non-fatal where possible, but if a call row was
created its public id should be returned on success and failure.

## Hosted MCP Surface

Hosted MCP exposes two tools:

```text
proxy_find
proxy_call
```

These tools call the shared provider-routine service directly. They must not
call tRPC/oRPC handlers.

MCP audit events remain separate from provider routine call records:

- `proxy_find`: MCP audit event only.
- `proxy_call`: MCP audit event plus provider routine call row when accepted.

When a provider routine call row exists, the MCP audit event should link to
`providerRoutineCallId`.

## Native CLI Surface

CLI commands:

```text
lightfast proxy find [query]
lightfast proxy call <routineId> --json <input>
```

The CLI uses native OAuth bearer auth and the selected org header. It must not
execute provider routines locally.

Native app routes:

```text
GET  /api/native/proxy/routines
POST /api/native/proxy/call
```

The routes are dedicated native app routes, not public oRPC and not API-key
routes. Internally, they adapt native OAuth identity into the same service
context as hosted MCP.

## Package Boundaries

Add a pure client-safe contract package:

```text
packages/provider-routine-contract
```

Responsibilities:

- Routine id formatter/parser/schema.
- Search and call input schemas.
- Result envelope schemas.
- Classification enum.
- Error code enum.
- Source surface enum.
- Provider enum imported from `@repo/connector-contract` while that remains the
  provider source of truth.

Add a server-only execution package:

```text
packages/provider-routines
```

Responsibilities:

- `findProviderRoutines(context, input)`.
- `callProviderRoutine(context, input)`.
- Cached manifest loading.
- Policy overlay and classification.
- Provider adapter registry.
- Ledger create/update calls.
- Safe error normalization.

The server package accepts host dependencies:

```ts
{
  db: Database;
  log: Pick<typeof log, "info" | "warn" | "error">;
  now: () => Date;
}
```

It should not import `@db/app/client` directly. Hosts such as `apps/mcp` and
`apps/app` wire the database client and logger at their boundary.

## Provider Adapter Boundary

V1 provider support starts with Linear MCP.

Provider adapter shape:

```ts
interface ProviderRoutineAdapter {
  provider: "linear";
  call(input: {
    accessToken: string;
    connection: OrgConnectorConnection;
    input: Record<string, unknown>;
    providerToolName: string;
  }): Promise<unknown>;
}
```

Discovery uses the cached connection `toolManifest`; it does not call provider
`listTools`.

Linear dispatch delegates to the existing `callLinearMcpTool` and token refresh
helpers.

## Error Codes

Public/service error family:

- `PROVIDER_ROUTINE_NOT_FOUND`
- `PROVIDER_ROUTINE_NOT_ENABLED`
- `PROVIDER_ROUTINE_CONNECTION_REQUIRED`
- `PROVIDER_ROUTINE_INSUFFICIENT_SCOPE`
- `PROVIDER_ROUTINE_INVALID_INPUT`
- `PROVIDER_ROUTINE_AUTH_REQUIRED`
- `PROVIDER_ROUTINE_PROVIDER_FAILED`
- `PROVIDER_ROUTINE_TIMEOUT`

Provider-specific errors may be mapped into these public codes and stored in the
ledger only as controlled safe codes/messages.

## Security And Redaction

- Never return or log OAuth access tokens or refresh tokens.
- Never expose org provider credential material to MCP clients or CLI.
- Re-check org membership at find and call time.
- Re-check connection state immediately before dispatch.
- Re-check that `providerToolName` exists in the selected cached manifest.
- Return provider results to authorized callers.
- Store only redacted input/output summaries in the ledger.
- Do not store raw MCP request arguments or responses in durable tables.
- Treat unknown dynamic routines as write-required.

## Deferred Follow-Up Issues

Create follow-up GitHub issues for:

- Refresh and retry stale provider manifests.
- Per-routine admin allowlists.
- Automation runtime migration onto `callProviderRoutine`.
- Rate limits by user/org/source/client.
- First-class idempotency or confirmation model for duplicate write protection.
- Optional direct MCP routine-tool mode for power users if tool explosion becomes
  manageable.
- Product-wide terminology migration away from Connectors/Integrations if the
  product language changes.

## Testing Strategy

- Contract tests for routine id parsing/formatting, including provider tool
  names containing `__`.
- Contract tests for `proxy_find` and `proxy_call` schemas.
- Service tests for filtering disabled providers, no-enabled-provider reasons,
  scope filtering, and unknown-write-default behavior.
- Service tests for call lifecycle: success, token refresh failure with
  `providerAttempted = false`, provider failure with `providerAttempted = true`,
  and invalid input with no ledger row.
- DB tests for provider routine call id generation, create-running,
  mark-succeeded, and mark-failed.
- Hosted MCP tests for scope behavior, MCP audit events, and linked
  `providerRoutineCallId` on accepted `proxy_call`.
- Native route tests for native OAuth org membership, find, call, and disabled
  provider behavior.
- CLI tests for `lightfast proxy find` and `lightfast proxy call` request
  construction and JSON output.

## Delivery Phases

1. Rename/reshape the ledger from integration-call to provider-routine-call
   language.
2. Add `@repo/provider-routine-contract`.
3. Add `@repo/provider-routines` and Linear cached-manifest execution.
4. Add `enabledForAgents` and Connectors page control.
5. Wire hosted MCP `proxy_find` and `proxy_call`.
6. Add native CLI routes and CLI commands.
7. File deferred follow-up issues.
