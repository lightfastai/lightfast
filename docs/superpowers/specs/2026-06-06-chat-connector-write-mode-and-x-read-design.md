# Chat Connector Write Mode and X Read Support Design

## Summary

Chat should use connector routines across both Linear and X. Linear should support write-capable routines when an explicit chat write mode is enabled and the stored Linear connector scopes include `write`. X should support read routines in chat through the existing X MCP bridge, but X write routines remain out of scope because the current X OAuth grant only requests `tweet.read users.read offline.access`.

This design replaces the current chat dependency on the Linear-only provider-routines path with a chat-facing connector routine service in `@api/app`. The service should sit on top of the same connector runtime primitives that automations already use, while enforcing chat-specific authorization rules.

## Current State

The chat route exposes `findProviderRoutines` and `callProviderRoutine` tools from `@repo/provider-routines`.

The current provider-routines package is Linear-shaped:

- `packages/provider-routines/src/find.ts` only treats active `linear` connections with `enabledForAgents` as usable.
- `packages/provider-routines/src/call.ts` also rejects non-Linear agent connections.
- `packages/provider-routines/src/context.ts` only defines a Linear adapter.

X is already a connectable provider and has runtime execution support:

- `packages/connector-contract/src/index.ts` lists both `linear` and `x` as connectable providers.
- `api/app/src/services/connectors/runtime.ts` can call both Linear MCP tools and X bridge MCP tools.
- X connector finalization stores the returned OAuth scopes and tool manifest.

The result is split behavior: automations can use provider-agnostic connector runtime tooling, while chat can only see and call Linear routines.

## Goals

- Support X read routines in chat when the X connector is active, enabled for agents, and has compatible read tools.
- Support Linear write routines in chat only when the current chat request enables write mode.
- Check stored Linear connector scopes before exposing or calling write routines.
- Return a clear reconnect-needed result when Linear write mode is requested but the stored Linear scopes do not include `write`.
- Keep the chat call path protected against bypasses, so directly calling a write `routineId` without write mode fails.
- Improve Braintrust/tool observability so future production investigations can identify routine IDs, classifications, scope decisions, and denial reasons.

## Non-Goals

- Do not add routine risk tiers in this version. All Linear write routines are allowed when write mode and OAuth write scope are present.
- Do not add X write support in this version.
- Do not change X OAuth scopes in this version.
- Do not redesign the full chat UI. API-level write mode support can land before a polished UI toggle.
- Do not change automation connector behavior except for shared helper extraction required by chat runtime reuse.

## Architecture

Add a chat-facing connector routine service in `@api/app`, likely under:

- `api/app/src/services/connectors/chat-routines.ts`

The service should export:

- `findChatProviderRoutines(context, input)`
- `callChatProviderRoutine(context, input)`

The chat route should import this service through `@api/app/services/connectors` or a dedicated export, replacing the current direct import from `@repo/provider-routines`.

The service should use database connector rows as the source of truth for connection state, enabled flags, OAuth scopes, MCP endpoint, and tool manifest. It should reuse or share logic from `api/app/src/services/connectors/runtime.ts` for provider calls, because that runtime already knows how to execute both Linear and X tools.

## Context Shape

The chat service context should include:

```ts
interface ChatProviderRoutineContext {
  clerkOrgId: string;
  conversationId: string;
  userId: string;
  writeMode: boolean;
}
```

The service can derive source metadata from this context:

- `sourceSurface: "chat"`
- `sourceRef: conversationId`
- `calledByKind: "user"`
- `calledByUserId: userId`

If an existing provider routine call schema does not include `"chat"` as a source surface, update the contract and database-facing types so chat calls are recorded explicitly as chat-sourced calls.

## Discovery Rules

`findChatProviderRoutines` should:

1. List current org connector connections.
2. Keep only active connections with `enabledForAgents === true`.
3. Summarize each tool manifest entry into a `ProviderRoutineSummary`.
4. Classify routines with the existing `classifyRoutine` policy.
5. Apply provider-specific chat visibility rules.
6. Apply optional query, provider, routine ID, schema, and limit filters.

Provider-specific visibility:

- Linear read routines are visible whenever Linear is active and enabled for agents.
- Linear write routines are visible only when `writeMode === true` and stored `connection.scopes` includes `"write"`.
- X read routines are visible whenever X is active and enabled for agents.
- X write routines are never visible in this version.

If `writeMode === true`, Linear is active/enabled, and Linear has write-classified tools but the stored scopes do not include `"write"`, the find result must communicate that reconnect is required. Extend the provider routine find output with a non-fatal warning:

```ts
{
  routines: [...readRoutines],
  warnings: [
    {
      code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
      provider: "linear",
      requiredScopes: ["write"],
      message: "Reconnect Linear to enable write access."
    }
  ]
}
```

`reason: "no_matching_routines"` should be used only when no routines match after all filters. It should not be the only signal for insufficient stored OAuth scopes, because the chat UI needs a stable way to show the reconnect action.

## Call Rules

`callChatProviderRoutine` must repeat all authorization checks. Discovery is advisory; call enforcement is authoritative.

For each call:

1. Parse `routineId` into provider and provider tool name.
2. Load the current connector connection for that provider.
3. Require active status and `enabledForAgents === true`.
4. Require the provider tool to exist in the current tool manifest.
5. Classify the routine.
6. Enforce chat provider rules.
7. Validate input against the manifest schema using the same lightweight required-field/type checks used today.
8. Create a provider routine call ledger row.
9. Execute the provider tool.
10. Mark the ledger row attempted, succeeded, or failed.

Provider-specific call authorization:

- Linear read: allowed with read scope.
- Linear write: allowed only when `writeMode === true` and stored Linear scopes include `"write"`.
- X read: allowed.
- X write: rejected with insufficient scope or unsupported write code.

Bypass protection:

- A direct call to `linear__create_issue` without write mode must fail before provider execution.
- A direct call to `linear__create_issue` with write mode but without stored `"write"` scope must fail with reconnect-required semantics.
- A direct call to `x__postTweet` must fail in this version.

## Write Mode API

Extend the chat request schema with:

```ts
providerRoutineWriteMode?: boolean
```

The chat route should pass this boolean into the chat routine context. The chat UI should send `true` only when the user enables the per-turn write toggle for the next submitted message. Existing chat behavior remains read-only because the flag defaults to false and resets after each submission.

System prompt and tool descriptions should reflect the new behavior:

- Reads can use enabled Linear and X connector routines.
- Linear writes are available only when write mode is enabled.
- If write mode is unavailable because Linear lacks OAuth write scope, tell the user to reconnect Linear.
- X write routines are not available.

## Stored Scope Checks

Linear OAuth already requests `read,write`, and connector finalization stores returned scopes in `orgConnectorConnections.scopes`.

The chat service should treat stored scopes as authoritative:

```ts
function hasLinearWriteScope(connection: OrgConnectorConnection) {
  return connection.scopes.includes("write");
}
```

This check should run during both discovery and calls. It should not inspect decrypted tokens or call Linear to infer scopes.

X OAuth currently requests `tweet.read users.read offline.access`. X read support can rely on active connection state and current tool manifests. X write support should wait for a separate OAuth-scope design.

## Provider Runtime Reuse

The existing `api/app/src/services/connectors/runtime.ts` can execute both providers, but it currently filters connections through `enabledForAutomations` and records source surfaces as automation or system.

For chat, add a new chat-specific runtime entry point that uses `enabledForAgents` and `sourceSurface: "chat"`. The entry point should share the Linear token refresh and X MCP token bridge logic from `runtime.ts` through small internal helpers instead of duplicating provider-specific call logic.

## Observability

Braintrust and server logs should include enough metadata to debug production chat routine behavior:

- `provider`
- `providerToolName`
- `routineId`
- `classification`
- `writeMode`
- `sourceSurface`
- `providerRoutineCallId`
- `scopeDecision`
- `denialReason`
- `requiredScopes`
- `storedScopes` as a redacted capability summary, such as `{ read: true, write: false }`

Tool spans should not log full tool inputs or outputs unless they are already safely redacted. Logging routine IDs and decisions is enough for the investigation path that motivated this work.

## Error Semantics

Use existing provider routine error codes where they fit:

- Missing connector: `PROVIDER_ROUTINE_CONNECTION_REQUIRED`
- Connector not enabled for agents: `PROVIDER_ROUTINE_NOT_ENABLED`
- Tool missing from current manifest: `PROVIDER_ROUTINE_NOT_FOUND`
- Write mode or provider policy failure: `PROVIDER_ROUTINE_INSUFFICIENT_SCOPE`
- Invalid input: `PROVIDER_ROUTINE_INVALID_INPUT`

Add a specific reconnect-required signal:

- `PROVIDER_ROUTINE_RECONNECT_REQUIRED`

This should be used when the connector is present but stored scopes are insufficient for the requested capability. The user-facing message should be:

> Reconnect Linear to enable write access.

## UI Behavior

The chat UI should expose a minimal per-turn write toggle:

- Add a compact per-turn write toggle near the chat composer.
- The toggle applies only to the next submitted message.
- The toggle label can be "Write mode".
- If a reconnect-required result is returned, show a concise message with a route to the connector settings page.

## Testing

Add focused tests for:

- Chat routine discovery includes X read routines when X is active and enabled for agents.
- Chat routine discovery excludes X routines when X is disabled for agents.
- Chat routine discovery hides Linear write routines when write mode is false.
- Chat routine discovery includes Linear write routines when write mode is true and stored scopes include `"write"`.
- Chat routine discovery returns reconnect-required information when write mode is true and stored Linear scopes lack `"write"`.
- Chat routine calls reject Linear write routines when write mode is false.
- Chat routine calls reject Linear write routines when stored scopes lack `"write"`.
- Chat routine calls allow Linear write routines when write mode is true and stored scopes include `"write"`.
- Chat routine calls allow X read routines.
- Chat routine calls reject X write routines.
- Chat route passes `providerRoutineWriteMode` into the service context.
- Chat UI sends `providerRoutineWriteMode: true` only for the next message after the user enables the per-turn write toggle.
- Braintrust or telemetry metadata includes routine ID, provider, classification, write mode, and denial reason for routine tool calls.

## Rollout

The default `providerRoutineWriteMode` value should be false. Existing chat behavior remains read-only until a client explicitly opts in.

X read support becomes available to chats for organizations that have connected X and enabled it for agents. Since only read routines are exposed, this is a low-risk capability expansion.

Linear write support is opt-in per chat request and additionally gated by stored OAuth scopes. Users whose existing Linear connection lacks `write` must reconnect before write routines are exposed or callable.

## Acceptance Criteria

- Chat can discover and call X read routines for active agent-enabled X connections.
- Chat cannot discover or call X write routines.
- Chat cannot discover or call Linear write routines unless write mode is enabled.
- Chat cannot call Linear write routines if the stored Linear connector scopes lack `"write"`.
- Chat has a per-turn write toggle that defaults off after each submitted message.
- The user receives or can be shown a clear reconnect-needed message when Linear write mode is requested without stored write scope.
- Production traces/logs can identify which routine was considered or called and why it was allowed or denied.
