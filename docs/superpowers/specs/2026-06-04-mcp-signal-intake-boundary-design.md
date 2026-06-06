# MCP Signal Intake Boundary Design

Date: 2026-06-04
Status: Ready for user review

## Summary

Hosted MCP should not import app signal creation internals directly when it needs
to create a Lightfast signal. The current `lightfast_signals_create` path calls
`@api/app/signals/service` from `apps/mcp`, and that shared service owns both the
database insert and the `app/signal.created` Inngest enqueue. This makes the MCP
runtime depend on Inngest environment variables even though MCP should only know
that it is asking Lightfast to create a signal.

The new boundary keeps `apps/app` and `api/app` as the owner of signal intake and
workflow publication. `apps/mcp` will call an app-owned internal command over
HTTP with a short-lived service JWT. App creates the signal, sends the shared
Inngest event, applies enqueue failure handling, and returns the same public
signal output shape that MCP already exposes.

This preserves one Lightfast workflow publisher while letting MCP remain a
resource server and tool executor, not a workflow runtime.

## Goals

- Remove direct `@api/app/signals/service` imports from `apps/mcp`.
- Keep `lightfast_signals_create` behavior and response shape unchanged for MCP
  users.
- Keep `app/signal.created` publication owned by app-side signal intake.
- Prevent `apps/mcp` from needing `INNGEST_APP_NAME`, `INNGEST_EVENT_KEY`, or
  `INNGEST_SIGNING_KEY`.
- Use `SERVICE_JWT_SECRET` for service-to-service authentication between MCP and
  app.
- Preserve MCP attribution fields: MCP client id, grant id, Lightfast user id,
  and organization id.
- Preserve app-side enqueue failure semantics: create row, mark failed on enqueue
  failure, return an upstream error to the caller.
- Add tests at the app command boundary and the MCP adapter boundary.
- Ship a production smoke test that creates and reads a signal through Claude
  Code using `https://mcp.lightfast.ai/mcp`.

## Non-Goals

- No new standalone event gateway service in this iteration.
- No Inngest credentials in `lightfast-mcp` production env.
- No MCP-to-tRPC or MCP-to-oRPC transport calls.
- No public API change to `/api/v1/signals`.
- No change to the MCP OAuth, DCR, token, or consent model.
- No migration of provider routine proxy execution in this iteration.

## Architecture

### Current Path

```text
Claude Code
  -> apps/mcp /mcp
  -> executeHostedMcpTool(signals.create)
  -> @api/app/signals/service createSignalForActor
  -> db insert
  -> @vendor/inngest/env
  -> Inngest send app/signal.created
```

The problem is not the event itself. The problem is the dependency direction:
MCP imports a helper whose interface hides a workflow publisher. That forces MCP
to carry app workflow configuration.

### Target Path

```text
Claude Code
  -> apps/mcp /mcp
  -> executeHostedMcpTool(signals.create)
  -> AppSignalIntakeClient.createFromMcpActor()
  -> POST apps/app /api/internal/mcp/signals
       Authorization: Bearer <service JWT>
  -> api/app signal intake service
  -> db insert
  -> Inngest send app/signal.created
  -> queued signal output
```

`apps/mcp` owns MCP auth, scope enforcement, org access checks, and audit
recording. App owns signal creation and signal workflow publication.

## App Internal Command

Add an internal app route:

```text
POST /api/internal/mcp/signals
```

The route accepts only `Authorization: Bearer <service JWT>` with:

- issuer/caller: `mcp`
- audience: `lightfast-app`
- short TTL, matching the existing service JWT pattern used for platform calls

The request body should use a shared schema:

```ts
{
  actor: {
    kind: "mcp";
    orgId: string;
    userId: string;
    clientId: string;
    grantId: string;
  };
  input: string;
}
```

The route calls `createSignalForActor(db, body)`. It translates
`SignalCreateQueueError` to a 500 response with a stable error code and returns
other validation/auth failures as structured 400/401/403/500 responses.

The response body remains the existing `CreateSignalOutput`:

```ts
{
  id: string;
  status: "queued";
  visibilityScope: "user";
}
```

## Service JWT

Extend the service JWT module rather than inventing a second token primitive.
The app and platform audiences should be explicit so tokens are not accepted by
the wrong internal service.

The caller set should include `mcp` for app-bound internal commands:

```ts
type ServiceCaller = "app" | "inngest" | "cron" | "mcp";
type ServiceAudience = "lightfast-platform" | "lightfast-app";
```

The signing helper should accept `{ caller, audience }`, keep the same
short-lived HS256 behavior, and verify both caller and audience at the receiving
service. App routes should accept only callers that are explicitly allowed for
that route.

## MCP Adapter

Replace the `signals.create` default dependency with an app signal intake
adapter:

```ts
createSignalForActor: appSignalIntakeClient.createSignalForActor
```

The adapter signs a service JWT as caller `mcp`, posts to
`NEXT_PUBLIC_APP_URL` or a dedicated internal app origin env, validates the
response with the existing `CreateSignalOutput` schema, and maps app errors to
`HostedMcpToolError("upstream_error", ...)`.

`apps/mcp/turbo.json` should not include Inngest env keys. It should include any
new app-origin env needed by the adapter and continue to pass
`SERVICE_JWT_SECRET`.

## Event Ownership

`api/app/src/signals/create-signal.ts` remains the only signal creation path that
publishes `app/signal.created`. The event schema stays in app Inngest schemas for
this iteration. If more services need to publish events later, extract event
names and payload schemas to a shared event contract package without moving
Inngest credentials into each caller.

## Error Handling

- Missing or invalid service JWT returns 401 from the app internal route.
- Valid service JWT from a disallowed caller returns 403.
- Invalid request body returns 400.
- DB insertion failures return 500 and do not send Inngest events.
- Inngest enqueue failures keep existing behavior: mark the created signal
  failed with `INNGEST_ENQUEUE_FAILED`, then return a stable 500 app command
  error.
- MCP maps app command failures into MCP tool errors and still records the MCP
  audit event with the tool name, grant, client, org, user, and latency.

## Testing

### App Tests

- Service JWT verification accepts caller `mcp` only for the internal MCP signal
  route.
- Missing, malformed, expired, wrong-audience, and disallowed-caller tokens are
  rejected.
- Valid MCP command calls `createSignalForActor` with MCP attribution.
- Queue failure maps to the stable app command error and preserves failed-row
  marking through the existing service tests.

### MCP Tests

- `signals.create` default dependencies no longer import
  `@api/app/signals/service`.
- The MCP app signal adapter signs a service JWT with caller `mcp` and audience
  `lightfast-app`.
- App command success returns the existing MCP create output.
- App command failure maps to an upstream MCP error and still records an audit
  event.
- `lightfast_system_health` remains dependency-light and does not load signal or
  app command modules.

### Production Smoke

After deployment:

1. `claude mcp get lightfast` reports connected.
2. `lightfast_system_health` returns status `ok`.
3. `lightfast_signals_create` creates a queued signal.
4. `lightfast_signals_get` reads the created signal by id.
5. MCP Vercel production env still does not contain Inngest keys.

## Rollout

1. Add and test the app internal route and service JWT audience support.
2. Add the MCP app signal intake adapter.
3. Remove the MCP direct import of `@api/app/signals/service`.
4. Deploy `lightfast-app`.
5. Deploy `lightfast-mcp`.
6. Run the Claude Code MCP health and signal create/get smoke tests.

No database migration is required for this boundary change.
