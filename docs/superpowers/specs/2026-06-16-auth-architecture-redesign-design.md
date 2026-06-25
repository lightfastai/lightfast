# Auth Architecture Redesign Design

Date: 2026-06-16
Status: Ready for user review

## Summary

Lightfast currently has several authentication and authorization paths that grew
around their transport implementations: Clerk sessions in tRPC, API-key auth in
oRPC, native OAuth for CLI and desktop, hosted MCP OAuth, service JWTs, connector
credentials, and app-owned internal routes. The result is that authorization
concepts are split across `api/app`, `apps/app`, `apps/mcp`, `apps/desktop`, and
`core/cli` without one clear vocabulary for "who is calling" and "whose
authority is being used".

The target architecture keeps `api/app` as the backend authority for now, but
splits it into explicit low-level layers:

- a framework-neutral domain layer for actors, gates, policies, commands, and
  domain errors,
- backend/auth composition that may keep owning env-backed infrastructure during
  the migration,
- explicit adapter surfaces for TanStack server functions, public API routes,
  desktop RPC, CLI RPC, internal service calls, and MCP OAuth.

`apps/app` remains the TanStack Start host and route mount point. It should not
become the place where backend authorization is reassembled. `apps/mcp` remains
a protocol facade with a narrow env surface and calls app-owned internal
surfaces instead of importing app/backend internals. `apps/desktop` uses the same
app UI when it is web-app-like, and uses credential-blind typed IPC when it is a
native Electron renderer. `/api/v1` remains a real public API with API keys,
stable resource routes, SDK support, and no internal command RPC exposure.

The migration should be strangler style. The first vertical slice is signals.

## Goals

- Create a single authorization vocabulary across Clerk sessions, native OAuth,
  API keys, hosted MCP OAuth, service JWTs, connector credentials, desktop, CLI,
  and public API traffic.
- Separate raw credentials from resolved domain authority.
- Keep `apps/app` focused on TanStack Start hosting, route mounting, and app UI.
- Keep `api/app` as the backend authority while introducing cleaner internal
  boundaries.
- Move app UI RPC from tRPC to TanStack server functions one product slice at a
  time.
- Replace oRPC-backed `/api/v1` with explicit resource-oriented public API
  routes and contracts over time.
- Preserve `/api/v1` as a real public API surface with API keys, docs, and SDK
  support.
- Keep desktop native renderers credential-blind while preserving type safety.
- Keep `apps/mcp` free of app-wide secrets such as DB, Clerk secret, connector
  vault, and provider runtime envs.
- Move connector provider packages into a first-class `connectors/*` workspace
  family with one package per provider and explicit runtime entrypoints.
- Use package exports, lint rules, and Knip as an architecture ratchet during
  migration.

## Non-Goals

- No big-bang rewrite of all auth, tRPC, oRPC, desktop, CLI, and MCP surfaces.
- No standalone auth service in the first phase.
- No generic replacement framework that recreates tRPC or oRPC under a new name.
- No public `/api/v1/rpc` command endpoint.
- No direct DB, Clerk, or connector credential access from `apps/mcp`.
- No exposure of OAuth bearer tokens or auth request headers to the Electron
  renderer long term.
- No collapse of org connectors and user connectors into one Lightfast authority
  model.
- No automatic global command discovery.

## Current Problems

The current repo has several valid auth mechanisms, but the concepts are
transport-shaped:

- `api/app` tRPC auth is Clerk and procedure oriented.
- `api/app` oRPC auth is API-key oriented.
- `apps/app` owns some HTTP routes and duplicates auth decisions at the route
  boundary.
- `apps/mcp` has its own hosted MCP auth context and has previously reached into
  app signal internals, which risks pulling app envs into the MCP runtime.
- `apps/desktop` has a native Electron renderer that currently uses tRPC with
  bearer headers from the main process.
- `core/cli` uses native OAuth and app HTTP endpoints.
- Diagnostics and error handling are still heavily tRPC shaped.
- Connector provider contracts and Node/runtime implementations are split in a
  way that makes provider boundaries harder to see.

The redesign should reduce this ambiguity without pretending the current
backend can be made pure immediately.

## Target Package Roles

```text
apps/app
  TanStack Start shell
  route mounting layer
  app UI and route loaders
  imports only explicit @api/app adapter entrypoints

api/app
  backend authority
  auth and actor resolution
  domain commands and gates
  backend infrastructure composition
  TanStack server-function adapters
  public API handlers/contracts
  desktop/CLI/internal/MCP adapter handlers

api/app/src/domain
  framework-neutral commands
  Actor, Caller, ExecutionContext
  gates, policies, domain errors
  no tRPC, oRPC, TanStack, Request, Response, Clerk sessions, or headers

apps/desktop
  Electron shell and optional native renderer
  web-app mode loads app UI and uses app TanStack functions
  native renderer uses typed IPC only
  main process owns native OAuth tokens and backend calls

core/cli
  first-party command-line UX
  native OAuth
  calls CLI RPC surface, not /api/v1 by default

apps/mcp
  hosted MCP protocol/resource server
  verifies MCP-facing request/protocol concerns
  holds only MCP and service-call envs
  calls app-owned internal API for domain work

connectors/*
  provider primitives and runtime entrypoints
  no Lightfast product auth or persistence ownership
```

`api/app` is allowed to keep env-aware backend code during the migration.
The stricter purity rule applies to the new `api/app/src/domain` boundary and to
any command definitions that should survive transport replacement.

## Layering

The target dependency direction is:

```text
apps/app UI
  -> @api/app/tanstack

apps/app route mounts
  -> @api/app/public-api
  -> @api/app/desktop-api
  -> @api/app/cli-api
  -> @api/app/internal-api
  -> @api/app/mcp-oauth

api/app adapters
  -> api/app backend/auth composition
  -> api/app domain commands

api/app backend/auth composition
  -> database, Clerk, vaults, provider node runtimes, Redis, Inngest

api/app domain
  -> schemas, pure helpers, ports/interfaces as needed

apps/mcp
  -> app internal HTTP surface
  -> optional client-safe MCP contracts only

apps/desktop renderer
  -> desktop preload bridge
  -> client-safe desktop contract types only
```

`apps/app` route files should be thin mounts:

```ts
export const ServerRoute = createServerFileRoute("/api/v1/signals").methods({
  POST: ({ request }) => handleCreateSignalPublicApi(request),
});
```

The handler imported from `api/app` owns credential verification, actor
resolution, command dispatch, and error mapping.

## Auth Vocabulary

The redesign uses three separate concepts.

### Credential

Raw credential material or transport state:

- Clerk web session or Clerk OAuth token
- native OAuth access token
- API key
- MCP access token
- service JWT
- connector provider token

Credentials must not leak into domain commands.

### Principal

The verified identity from a credential before domain authority is resolved.
Examples:

- Clerk user id from a session
- native OAuth user/client/token claims
- API key id and hashed-key lookup result
- MCP token claims
- service JWT caller and audience

Principal resolution belongs in `api/app` auth/backend adapter code.

### Actor

The post-resolution authority that domain gates consume:

```ts
type Actor =
  | {
      kind: "clerkUser";
      userId: string;
      orgId?: string;
      orgRole?: string;
      source: "web" | "desktop-web";
    }
  | {
      kind: "nativeClient";
      client: "cli" | "desktop";
      userId: string;
      orgId: string;
      source: "cli" | "desktop-main";
    }
  | {
      kind: "apiKey";
      orgId: string;
      keyId: string;
      scopes: ApiScope[];
    }
  | {
      kind: "mcpClient";
      orgId: string;
      connectionId: string;
      clientId: string;
      scopes: McpScope[];
    }
  | {
      kind: "service";
      service: "apps-mcp" | "inngest" | "qstash" | "system";
    };
```

Domain gates should consume `Actor` except for rare cases that explicitly need
caller metadata.

## Caller And Execution Context

Service credentials should authenticate the caller, not automatically authorize
domain mutations. The execution envelope separates the caller from the authority
being exercised:

```ts
type ExecutionContext = {
  actor: Actor;
  caller?: Caller;
  request?: {
    id: string;
    source:
      | "tanstack"
      | "desktop-rpc"
      | "cli-rpc"
      | "public-api"
      | "mcp"
      | "job";
  };
};

type Caller =
  | { kind: "service"; service: "apps-mcp" | "inngest" | "qstash" }
  | { kind: "firstPartyClient"; client: "desktop" | "cli" };
```

For hosted MCP, the preferred shape is:

```text
caller = service apps-mcp
actor = mcpClient for org/connection/client/scopes
```

This keeps audit trails clear and prevents service JWTs from becoming implicit
master keys.

## Domain Commands

Commands are the reusable authorization and business operation boundary. They
are framework-neutral:

```ts
defineCommand({
  name: "signals.create",
  input: createSignalCommandInput,
  output: signalCommandOutput,
  run: async ({ ctx, input, deps }) => {
    // domain gates and business behavior
  },
});
```

Rules:

- Commands own their input and output schemas.
- Commands throw domain errors, not transport errors.
- Commands receive resolved `ExecutionContext`, not raw headers, sessions,
  API keys, or service JWTs.
- Commands may receive narrow deps/ports where that reduces coupling, but the
  first implementation should avoid a giant repository abstraction.
- Command names are domain/action strings such as `signals.create`,
  `connectors.github.bind`, or `auth.whoami`.
- No auto-discovered global registry. Each surface gets an explicit allowlist.

Example command surface:

```ts
export const desktopCommands = defineCommandSurface({
  "signals.list": listSignalsCommand,
  "settings.update": updateSettingsCommand,
});
```

The first command abstraction should be tiny:

- `defineCommand`
- `defineCommandSurface`
- `dispatchCommand`
- typed command client helpers for native RPC surfaces

Anything more advanced should wait until the signals slice proves the need.

## Domain Errors

Command/domain code should throw a small domain error vocabulary:

```ts
throw new AuthzError("ORG_MEMBER_REQUIRED", metadata);
throw new ValidationError("INVALID_SIGNAL_FILTER", metadata);
throw new NotFoundError("SIGNAL_NOT_FOUND", metadata);
throw new ConflictError("CONNECTOR_ALREADY_BOUND", metadata);
```

It should not throw:

- `TRPCError`
- `ORPCError`
- `Response`
- TanStack `redirect` or `notFound`
- raw provider SDK errors across the domain boundary

Adapters map domain errors into their own transport:

- TanStack server function errors for app UI
- JSON problem responses for `/api/v1`
- typed error envelopes for desktop and CLI RPC
- MCP protocol/tool errors for hosted MCP

Diagnostics should move toward this transport-neutral domain vocabulary so
tRPC and oRPC can be removed without losing useful error detail.

## Adapter Surfaces

`api/app` should expose narrow package entrypoints for each adapter surface.
Illustrative entrypoints:

```text
@api/app/tanstack/signals
@api/app/public-api/signals
@api/app/desktop-api
@api/app/cli-api
@api/app/internal-api/mcp
@api/app/mcp-oauth
@api/app/domain/signals
```

These entrypoints are not all for every consumer. Package exports and lint rules
should restrict who may import what.

### TanStack App UI

TanStack server functions should replace app UI tRPC one slice at a time. The
preferred location is inside an `api/app` TanStack adapter:

```ts
export const createSignal = createServerFn({ method: "POST" })
  .inputValidator(createSignalInput)
  .handler(async ({ data }) => {
    return createSignalFromCurrentClerkUser(data);
  });
```

Auth must be enforced inside the server function handler or middleware because
server functions are RPC endpoints. Route guards are not sufficient.

Before migrating a broad slice, run a small spike to prove that `createServerFn`
defined in `api/app` is transformed correctly when statically imported into
`apps/app`. If the bundler requires physical placement inside `apps/app`, keep
the physical wrapper there but preserve the same logical adapter boundary and
delegate immediately to `api/app`.

### Public `/api/v1`

`/api/v1` remains a real public API:

```text
GET  /api/v1/signals
POST /api/v1/signals
GET  /api/v1/signals/:id
```

It should not expose:

```text
POST /api/v1/rpc { command: "signals.create", input: ... }
```

Public API actors are org-scoped API keys at first:

```ts
type PublicApiActor = {
  kind: "apiKey";
  orgId: string;
  keyId: string;
  scopes: ApiScope[];
};
```

User-scoped public API keys are out of scope until a concrete use case exists.

Public request and response schemas should be owned by the public API contract,
not directly exported from internal commands. Public API code can reuse small
primitive schemas and map to command inputs:

```ts
const input = parseCreateSignalPublicBody(requestBody);
const commandInput = mapPublicCreateSignalToCommand(input);
const result = await runCreateSignal({ ctx, input: commandInput });
return mapSignalToPublicResponse(result);
```

### Desktop

Desktop has two valid modes:

1. Web-app mode:
   - Electron loads the app UI.
   - The UI uses the same TanStack server functions as the web app.
   - Clerk/session-backed app behavior stays unified.

2. Native renderer mode:
   - The renderer is credential-blind.
   - The renderer calls typed IPC operations.
   - The main process owns OAuth storage/refresh and HTTP calls.
   - The main process calls `/api/desktop/rpc`.

Long term, the renderer should not expose:

```ts
auth.getToken();
auth.getRequestHeaders();
```

Instead:

```ts
window.lightfast.api.call("signals.list", input);
window.lightfast.api.call("settings.update", input);
```

The type safety comes from a small shared desktop contract. The renderer imports
client-safe command names and input/output types. The main process owns the
typed HTTP caller and credential attachment.

### CLI

CLI should use native OAuth and a command-oriented first-party surface:

```text
POST /api/cli/rpc
```

CLI should not default to `/api/v1`, because `/api/v1` is an external developer
surface with API keys, stable resources, SDKs, and public documentation. CLI can
reuse the same domain commands internally where operations overlap.

Desktop and CLI should share the low-level command protocol, dispatcher,
native OAuth verifier, domain commands, error envelope, and audit primitives.
They should mount separate endpoints so allowlists, rate limits, telemetry, and
deprecation cadence can diverge cleanly:

```text
/api/desktop/rpc
/api/cli/rpc
```

### Hosted MCP

`apps/mcp` is a protocol/resource facade, not a second backend composition root.
It should not import app backend internals or provider node runtimes when domain
authorization or connector credentials are required.

Target path:

```text
MCP client
  -> apps/mcp /mcp
  -> protocol/tool validation
  -> service-auth call to apps/app internal route
  -> api/app resolves caller + mcpClient actor
  -> domain command/service
  -> connector credential lookup/use inside api/app
```

`apps/mcp` should keep a narrow env allowlist:

- MCP issuer/resource config
- internal app URL
- service credential/JWT secret
- MCP runtime-specific values

It should not need:

- DB URL
- Clerk secret key
- connector vault envs
- provider OAuth secrets
- app workflow envs unless the MCP service itself owns that workflow

MCP scopes are necessary but not sufficient. Runtime domain policy must also
check org binding, setup completion, connector availability, tool capability,
and any command-specific gates.

## Connector Packages

Connector provider packages should move to a root workspace family:

```text
connectors/
  core/
  github/
  linear/
  x/
```

Suggested package names:

```text
@lightfast/connector-core
@lightfast/connector-github
@lightfast/connector-linear
@lightfast/connector-x
```

Each provider package can contain both contract and runtime code, separated by
entrypoints:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./contract": "./src/contract.ts",
    "./node": "./src/node.ts",
    "./oauth": "./src/oauth.ts",
    "./mcp": "./src/mcp.ts"
  }
}
```

Rules:

- UI/client-safe code imports provider `contract` entrypoints.
- Server code imports provider `node`, `oauth`, or `mcp` entrypoints as needed.
- The package root is client-safe only if all exported values are client-safe.
- `connectors/core` contains provider primitives, not Lightfast product
  workflows.

`connectors/core` may define:

- connector ids and kinds
- OAuth metadata types
- MCP capability descriptors
- credential envelope types
- standard provider errors
- token refresh helper interfaces
- contract composition helpers

`connectors/core` should not define:

- all-provider product registries
- org setup workflows
- user connector workflows
- DB persistence
- Lightfast actor/gate logic

Org connectors and user connectors stay separate `api/app` product domains even
when they share the same provider package.

## Enforcement

Use three mechanisms together.

### Package Exports

Each new package or adapter surface should have explicit exports. Avoid giant
default barrels that make every layer importable from everywhere.

### Lint And Import Rules

Examples of intended restrictions:

```text
apps/app
  may import explicit @api/app adapter entrypoints
  should not import @api/app/backend directly
  should not import connector node entrypoints directly

apps/mcp
  may import client-safe contracts
  should not import @api/app/backend
  should not import DB/vault/provider node runtime code

apps/desktop renderer
  may import client-safe desktop contract types
  should not import native auth node code
  should not import backend clients
```

### Knip

Knip should become part of the architecture ratchet:

- find unused exports,
- identify dead adapter entrypoints,
- catch forgotten tRPC/oRPC procedures after a slice migrates,
- catch stale connector package exports,
- detect workspace dependency drift,
- reveal files reachable only through old barrels.

Knip is not the boundary enforcement mechanism by itself. It complements
package exports and lint restrictions.

## Migration Plan

The migration is slice-by-slice.

### Phase 1: Foundation

- Add domain primitives inside `api/app/src/domain`.
- Add domain error vocabulary.
- Add command definition and command surface helpers.
- Add explicit package exports for new surfaces.
- Add import restrictions for the first migrated surfaces.
- Add Knip checks or config updates that make unused exports visible.

### Phase 2: Signals Vertical Slice

Signals should be the first vertical slice because they touch org-scoped app UI,
route prefetch, filters/search params, auth gates, public API relevance, and
desktop relevance.

For signals:

1. Add domain commands for the operations needed by the current UI.
2. Add TanStack server-function adapters.
3. Move app UI reads/mutations to server-function-backed TanStack Query helpers.
4. Preserve route search params, loading states, error behavior, mutation
   invalidation, and user-facing behavior first.
5. Add parity tests.
6. Remove migrated tRPC procedures after parity is proven.
7. Map public API signal endpoints through public contracts when in scope.

The first slice should stay tight. Do not build every hypothetical signal API.

### Phase 3: Native RPC Surfaces

- Add desktop RPC and CLI RPC command protocols over the shared dispatcher.
- Move desktop native renderer calls behind credential-blind IPC.
- Remove renderer access to raw bearer tokens/request headers.
- Keep desktop and CLI endpoint allowlists separate.

### Phase 4: Public API

- Replace oRPC-backed `/api/v1` with explicit resource routes and public
  contract modules.
- Keep API-key actor resolution in `api/app`.
- Generate or support SDK/OpenAPI from public contracts.
- Remove oRPC once equivalent explicit routes and contract generation exist.

### Phase 5: Connector Workspace

- Create `connectors/*` workspace family.
- Move provider contract/runtime code provider by provider.
- Add explicit provider entrypoints.
- Update `api/app` org/user/developer domains to import the right provider
  entrypoints.
- Use Knip to remove stale provider barrels and old split packages.

## Testing Strategy

Tests should scale with migration risk.

For domain commands:

- gate behavior for each actor kind,
- command input/output validation,
- domain error mapping,
- command behavior independent of transport.

For TanStack adapters:

- auth enforced in handler/middleware,
- no reliance on route guards for server function security,
- input validation,
- error mapping,
- TanStack Query invalidation behavior for migrated UI.

For public API:

- API-key verification,
- scope enforcement,
- stable request/response schemas,
- HTTP status and error envelopes,
- OpenAPI/SDK contract generation checks when available.

For desktop:

- renderer cannot access raw tokens after migration,
- IPC operation typing,
- main process attaches native OAuth credentials,
- `/api/desktop/rpc` allowlist enforcement.

For CLI:

- native OAuth actor resolution,
- `/api/cli/rpc` allowlist enforcement,
- CLI-specific error envelope and command behavior.

For MCP:

- `apps/mcp` does not import app backend or connector node runtime code,
- service JWT caller/audience verification,
- delegated MCP actor resolution,
- MCP scope plus runtime capability checks,
- audit captures both caller and actor.

For enforcement:

- package export tests or source tests for forbidden imports,
- lint/import rules,
- Knip reports included in cleanup milestones.

## Rollout Rules

- Do not migrate a second product slice until the signals slice proves the
  command, actor, TanStack adapter, and test pattern.
- Do not keep duplicate tRPC and TanStack paths permanently for the same app UI
  operation.
- Do not remove oRPC from `/api/v1` until explicit public routes and contracts
  reach parity.
- Do not move connector packages until entrypoint rules and client/server import
  boundaries are clear.
- Do not allow `apps/mcp` to become a secret-bearing backend composition root.
- Do not expose bearer credentials to the desktop renderer in the target model.

## Risks

- Defining TanStack server functions inside `api/app` may need a bundler spike.
  If it fails, keep the physical wrapper in `apps/app` but preserve the logical
  backend adapter boundary.
- A command abstraction can grow into another framework. Keep the first helper
  tiny and signals-driven.
- Separate adapter surfaces can create maintenance overhead if each hand-rolls
  dispatch, error mapping, and auth boilerplate. Share low-level adapter kits,
  but keep each auth contract explicit.
- Public API schemas can accidentally couple to internal command schemas. Use
  deliberate mapping for public request/response contracts.
- Desktop has two product shapes. Web-app mode and native renderer mode need
  different calling models, even if they share domain commands underneath.
- Knip can reveal large cleanup work. Treat it as a ratchet during migration,
  not a requirement to fix all historic drift before starting.

## Acceptance Criteria

- The repo has an agreed design for `Actor`, `Caller`, `ExecutionContext`,
  commands, command surfaces, and domain errors.
- `apps/app`, `api/app`, `apps/mcp`, `apps/desktop`, `core/cli`, and
  `connectors/*` have clear target ownership.
- `/api/v1` remains resource-oriented and API-key-authenticated.
- Desktop native renderer target state is credential-blind and typed through
  IPC.
- `apps/mcp` target state avoids app/backend env expansion and uses app-owned
  internal calls.
- Connector packages have a clear root workspace and entrypoint strategy.
- The migration starts with signals and removes old tRPC/oRPC paths only after
  parity tests.
- Package exports, lint rules, and Knip are part of the architecture enforcement
  plan.
