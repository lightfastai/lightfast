# Vercel Sandbox Runtime Design

Date: 2026-06-03
Status: Ready for implementation plan

## Summary

Lightfast will use Vercel Sandbox as the v1 execution plane for Developer
Connections. Developer Connections remain org-owned credentials for provider
CLIs such as PlanetScale, Upstash, Sentry, and Clerk. Vercel is not a
Developer Connection provider in v1. It is Lightfast infrastructure used to
create short-lived Firecracker microVMs, load all enabled org Developer
Connections, run real provider CLIs, collect redacted output, revoke leases,
and destroy the sandbox.

The v1 security model is **trusted-with-guardrails**. A sandboxed agent is
trusted to use the org's enabled Developer Connections for the active work, but
Lightfast still keeps execution off the user's machine, loads credentials only
after command policy passes, runs each command through Lightfast, blocks
default CLI auth/session mutation commands, redacts live output, stores only
command metadata, and tears down the sandbox on explicit stop or TTL expiry.

The local `vercel-labs/local-sandbox` repository was tested and should not be
used for v1 runtime execution. Its API and in-memory provider build and start,
but the in-memory provider stubs command execution. The real vfkit provider is
blocked in the current environment by missing `vfkit` and a missing base image
at `~/.cache/v0-vfkit/base.img`. It remains useful as a reference shape only.

## Goals

- Run real agent-oriented provider CLIs inside isolated Vercel Sandbox
  microVMs.
- Use Vercel OIDC as the default Sandbox SDK authentication path.
- Keep Vercel Sandbox as Lightfast-owned infrastructure, not org-owned user
  setup.
- Follow repo vendor boundaries: third-party SDK access goes through
  `@vendor/vercel-sandbox`; reusable runtime code lives in
  `@repo/sandbox-runtime`; Lightfast orchestration stays in `api/app`.
- Persist multi-command sandbox runs and command metadata.
- Load all enabled Developer Connections for the org by default, but only
  after command policy passes.
- Reuse the existing Developer Connections lease and materialization service.
- Keep commands routed through Lightfast per-command execution; no unrestricted
  interactive terminal handoff in v1.
- Allow shell commands for usability, while treating policy inspection as a
  best-effort guardrail rather than a hard adversarial sandbox policy.
- Stop sandboxes and revoke leases via explicit stop, TTL expiry, and stale-run
  cleanup.

## Non-Goals

- No `vercel` Developer Connection provider in v1.
- No replacement CLI lookalikes. The sandbox runs the real CLIs.
- No `vercel-labs/local-sandbox` implementation in v1.
- No public tRPC procedure that accepts arbitrary command execution.
- No MCP tool exposure in this scope.
- No durable terminal UI, command history UI, or replay UI in this scope.
- No unrestricted interactive shell where an agent can keep running commands
  after bypassing Lightfast's per-command policy path.
- No org-configurable blocklist setup in v1. The architecture includes the
  seam, but no UI, DB table, parser, or settings flow.
- No Lightfast-default resource-operation blocklist in v1. Dangerous
  resource-operation rules such as `pscale database delete` are deferred to the
  future org blocklist architecture. V1 defaults focus on preserving
  Lightfast-owned CLI auth/session material.
- No promise that credentials are hidden from the command process itself.
  Env/file materialization means code running in the sandbox can read those
  values. V1 safety comes from trusted use, sandbox isolation, short leases,
  cleanup, policy guardrails, and redaction.

## Verified Inputs

### Vercel Sandbox

The official Vercel Sandbox docs state that each sandbox runs in a secure
Firecracker microVM with its own filesystem and network. Supported runtimes
include `node24`, `node22`, and `python3.13`; Vercel documents full root
access and installing packages or binaries inside the sandbox.

The SDK supports `Sandbox.create()`, `sandbox.runCommand()`, `writeFiles()`,
`readFile()`, `domain()`, `updateNetworkPolicy()`, timeout extension, and
cleanup operations. `runCommand()` supports structured `cmd` and `args`,
per-command environment variables, `cwd`, `sudo`, detached mode, writable
stdout/stderr streams, and abort signals.

Authentication supports Vercel OIDC tokens as the recommended path. For local
development, `vercel link` plus `vercel env pull` creates a
`VERCEL_OIDC_TOKEN`; the token expires after 12 hours. In production on
Vercel, token expiration is managed automatically. Access-token auth exists for
external CI/CD and non-Vercel hosting, but Lightfast will not support that path
in v1.

References:

- https://vercel.com/docs/vercel-sandbox
- https://vercel.com/docs/vercel-sandbox/sdk-reference
- https://vercel.com/docs/vercel-sandbox/concepts/authentication

### local-sandbox Smoke Test

The subagent smoke test cloned `vercel-labs/local-sandbox` at commit
`67d2b865024808ec671bc7d1dd5cb2bf0b6b1d2c`.

Observed:

- `pnpm install --frozen-lockfile` passed.
- `cargo build -p local-sandbox-daemon` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- Default daemon started with provider `in_memory`.
- In-memory `runCommand` returned exit `0` with empty stdout for `echo`,
  `printenv`, `cat`, `node --version`, and `npx --version`.
- `LOCAL_SANDBOX_VM_PROVIDER=vfkit` reported provider `vfkit`, but sandbox
  creation failed because `vfkit` and `~/.cache/v0-vfkit/base.img` were not
  available.

Conclusion: local-sandbox is not a usable v1 execution runtime in this
environment.

## Architecture

```text
Lightfast internal caller
  -> DeveloperSandboxRunService
    -> create run record
    -> SandboxRuntime.create()
      -> @repo/sandbox-runtime
        -> @vendor/vercel-sandbox
    -> run command
      -> CommandPolicy
      -> lazy load all enabled Developer Connections
      -> issueDeveloperConnectionLeases()
      -> materialize auth files + per-command env
      -> SandboxRuntime.exec()
      -> redact live stdout/stderr
      -> persist command metadata
    -> stop or expire run
      -> revoke leases
      -> stop Vercel Sandbox
      -> mark run stopped/expired
```

There are three boundaries.

### Vendor Boundary

`@vendor/vercel-sandbox` is the only package that imports `@vercel/sandbox`.
It should be a standalone vendor abstraction:

- re-export the official SDK types and values Lightfast needs
- avoid Lightfast auth, org, DB, Developer Connections, and policy imports
- keep third-party SDK churn isolated from app code

### Runtime Boundary

`@repo/sandbox-runtime` owns provider-neutral runtime interfaces and the
Vercel implementation. It depends on `@vendor/vercel-sandbox`, but it must not
depend on `@db/app`, Clerk auth, or Developer Connections.

Exports:

- `SandboxRuntime` interfaces
- `createVercelSandboxRuntime()`
- `createInMemorySandboxRuntimeForTests()`

The in-memory runtime is a deterministic test double only. It must not be a
runtime selectable by app env in production or development.

Conceptual runtime interface:

```ts
export interface SandboxRuntime {
  create(input: SandboxCreateInput): Promise<SandboxHandle>;
  get(id: string): Promise<SandboxHandle>;
  destroy(id: string): Promise<void>;
}

export interface SandboxHandle {
  id: string;
  status: SandboxStatus;
  writeFiles(files: SandboxFile[]): Promise<void>;
  exec(input: SandboxExecInput): Promise<SandboxCommand>;
  updateNetworkPolicy?(policy: SandboxNetworkPolicy): Promise<void>;
  stop(): Promise<void>;
}

export interface SandboxCommand {
  id: string;
  logs(): AsyncIterable<SandboxLogChunk>;
  wait(): Promise<SandboxCommandResult>;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
  kill(): Promise<void>;
}
```

### Lightfast Orchestration Boundary

`api/app` owns the Lightfast-specific sandbox run service:

- active org access checks
- persisted run and command rows
- command policy
- Developer Connections lease issuance
- credential materialization
- output redaction
- explicit stop
- stale-run cleanup/reaper

Product code should call the Lightfast run service, not `SandboxRuntime`
directly.

## Sandbox Run Lifecycle

V1 is a multi-command session model.

1. `createDeveloperSandboxRun()` requires an active org identity.
2. It checks `canUseDeveloperSandboxes(ctx)`.
3. It creates a Vercel Sandbox with no provider credentials.
4. It persists a `lightfast_developer_sandbox_runs` row with:
   - `publicId`
   - `clerkOrgId`
   - `actorUserId`
   - `vercelSandboxId`
   - `status`
   - `credentialsLoadedAt`
   - `expiresAt`
   - `stoppedAt`
   - `cleanupAttemptedAt`
   - `cleanupFailureCode`
   - `createdAt`
   - `updatedAt`
5. `runDeveloperSandboxCommand(runId, command)` runs each command through
   Lightfast.
6. Before every command, `CommandPolicy` evaluates the command.
7. On the first allowed command, the run service resolves all enabled current
   Developer Connections for the org.
8. It issues Developer Connection leases for all enabled providers.
9. It writes provider auth files into the sandbox once.
10. It applies materialized env vars to every command execution after
    credentials are loaded.
11. It executes the command in Vercel Sandbox.
12. It returns redacted stdout/stderr to the caller.
13. It persists command metadata, not raw output.
14. `stopDeveloperSandboxRun(runId)` revokes leases, stops the sandbox, and
    marks the run stopped.
15. A stale-run cleanup path marks expired runs, revokes leases, and attempts
    sandbox stop when explicit stop did not happen.

Vercel Sandbox timeout is the infrastructure last resort. Lightfast still
tracks `expiresAt` and runs cleanup so lease state is correct even when a
caller forgets to stop.

## Command Metadata

`lightfast_developer_sandbox_commands` should persist metadata only:

- `publicId`
- `sandboxRunId`
- `clerkOrgId`
- `actorUserId`
- `cmd`
- `args`
- `cwd`
- `status`
- `policyDecision`
- `policyRuleId`
- `policyReason`
- `exitCode`
- `stdoutBytes`
- `stderrBytes`
- `redactionCount`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

Raw stdout/stderr must not be stored in v1. CLI output can contain secrets,
customer data, provider resource names, or transient environment details. The
active caller receives redacted output for the command response only.

## Access Model

V1 access is internal-only, but the service should still include a permission
seam:

```ts
function canUseDeveloperSandboxes(ctx: DeveloperSandboxContext): boolean {
  return ctx.auth.identity.type === "active";
}
```

Any active org member can use developer sandboxes in v1. Future work can
tighten this to org roles, billing plans, explicit permissions, or per-provider
policy without changing the service boundary.

## Credential Materialization

The existing Developer Connections materialization output has:

```ts
{
  provider: DeveloperConnectionProvider;
  env: Record<string, string>;
  files: Array<{ path: string; contents: string; mode: "0600" }>;
}
```

Vercel Sandbox integration should adapt this to:

- files under `/vercel/sandbox/.lightfast/provider-auth/<leaseId>/`
- `HOME` or provider-specific config env vars pointing at sandbox-only auth
  paths when needed
- command-level env merged into every command after credentials are loaded
- no provider credentials in `Sandbox.create()` env

The sandbox run should be created before credentials are decrypted. Secret
materialization happens after the first command passes policy and immediately
before that command executes.

## Command Policy

V1 policy is a best-effort guardrail, not the sandbox security boundary.

Commands may be direct argv or shell-based commands such as `bash -lc "..."`.
Blocking shell entirely would make agent workflows brittle. Instead, policy
normalizes both structured argv and shell command text, then blocks known
Lightfast-default auth/session mutation patterns.

Default v1 deny rules:

- `pscale auth login`
- `pscale auth logout`
- `upstash auth login`
- `upstash auth logout`
- `sentry auth login`
- `sentry auth logout`
- `clerk auth login`
- `clerk auth logout`

Policy should treat separators such as `&&`, `;`, and newlines as command
boundaries when matching obvious command text. It should reject clear matches
before sandbox execution and before credentials are loaded.

The policy must not claim complete prevention against a hostile actor. A
determined command can hide behavior through downloaded scripts, aliases,
custom binaries, base64, or indirect code execution. That is acceptable in v1
because the model is trusted-with-guardrails.

Future org-configurable blocklists should plug into the same interface:

```ts
interface CommandPolicyRule {
  id: string;
  source: "lightfast_default" | "org";
  action: "deny";
  reason: string;
}
```

V1 only ships `source: "lightfast_default"` rules.

## Provider Toolchain

The `node24` runtime can run Node package CLIs such as `npx clerk` and
`npx sentry`. PlanetScale and some Upstash workflows need a toolchain strategy:

- Prefer package-runner commands when the provider publishes a working npm CLI.
- For non-Node binaries such as `pscale`, add a provider-specific preparation
  command that installs the binary before credentials are materialized.
- Preparation commands must not receive provider credentials.
- Preparation output should be logged separately from secret-bearing command
  output and should not be persisted as raw logs.

V1 implementation should begin with smoke probes:

- `node --version`
- `npx --version`
- `npx --yes clerk --help`
- `npx --yes sentry --help`
- Upstash CLI help through its npm package if available
- PlanetScale version only after a non-secret install step exists

Provider-authenticated commands should only be added after non-secret smoke
probes pass in the Vercel Sandbox runtime.

## Network Policy

Vercel Sandbox supports network policies. V1 should keep a network policy hook
in the runtime and command policy result, but should not block implementation
on a perfect provider domain list.

Practical v1 model:

1. Sandbox setup starts with the default Vercel Sandbox network behavior.
2. Non-secret setup commands may use broad egress.
3. Authenticated provider commands may run with broad egress while provider
   domain lists are being finalized.
4. The runtime interface and command policy output include the seam needed to
   tighten network policy later.

This is another guardrail, not the primary v1 safety mechanism.

## Authentication And Environment

V1 should rely on the SDK's default OIDC behavior:

- Local development:
  - `vercel link`
  - `vercel env pull`
  - `apps/app/.vercel/.env.development.local` provides `VERCEL_OIDC_TOKEN`
    through the repo's existing `pnpm with-env` pattern.
  - Development tokens expire after 12 hours and must be refreshed with
    `vercel env pull`.
- Production on Vercel:
  - Vercel manages OIDC automatically.

Lightfast should not support Vercel access-token auth in v1. No
`VERCEL_TOKEN`, `VERCEL_TEAM_ID`, or `VERCEL_PROJECT_ID` env validation should
be added for this feature yet.

The Lightfast app should not store Vercel Sandbox auth as a Developer
Connection. Vercel Sandbox auth is deployment infrastructure.

## Error Handling

The run service should distinguish:

- Vercel Sandbox auth/config failure
- sandbox creation failure
- sandbox lookup failure
- command policy rejection
- first credential load failure
- lease issuance failure
- credential materialization failure
- command execution nonzero exit
- command timeout
- explicit stop failure
- stale-run cleanup failure

Cleanup failures should be logged and stored on the run row when available.
Lease issuance failures should stop the sandbox before returning an error.
Auth failures from provider CLIs should not automatically mark Developer
Connections as `needs_reconnect` unless a provider adapter explicitly
recognizes the failure.

## Testing Strategy

Unit tests:

- `@repo/sandbox-runtime` fake runtime verifies create/write/exec/stop call
  order.
- Vercel runtime adapter maps `Sandbox.create()`, `runCommand()`,
  `writeFiles()`, `readFileToBuffer()`, `updateNetworkPolicy()`, and `stop()`
  calls through the vendor wrapper.
- run creation persists a sandbox run without loading credentials.
- first allowed command loads all enabled Developer Connections.
- subsequent commands reuse loaded credentials and do not issue duplicate
  leases.
- command policy blocks CLI auth login/logout patterns.
- command policy allows ordinary shell commands that do not match default deny
  rules.
- no credentials are materialized when policy rejects a command.
- explicit stop revokes leases and stops the sandbox.
- stale-run cleanup revokes leases and marks expired runs.
- stdout/stderr redaction removes materialized secret values from returned
  output.
- command rows persist metadata without raw stdout/stderr.

Integration smoke tests:

- gated by `VERCEL_OIDC_TOKEN` availability
- create Vercel Sandbox
- run `node --version`
- run env injection probe
- write/read a temp file
- stop sandbox

Provider smoke tests:

- gated and non-destructive
- `npx --yes clerk --help`
- `npx --yes sentry --help`
- Upstash CLI help
- PlanetScale version after non-secret install

Authenticated provider tests should remain manual or separately gated until
command policy and provider credential scopes are well understood.

## Implementation Shape

Likely files for the next implementation plan:

- `vendor/vercel-sandbox/package.json`
- `vendor/vercel-sandbox/tsconfig.json`
- `vendor/vercel-sandbox/src/index.ts`
- `packages/sandbox-runtime/package.json`
- `packages/sandbox-runtime/tsconfig.json`
- `packages/sandbox-runtime/vitest.config.ts`
- `packages/sandbox-runtime/src/index.ts`
- `packages/sandbox-runtime/src/types.ts`
- `packages/sandbox-runtime/src/vercel.ts`
- `packages/sandbox-runtime/src/testing.ts`
- `packages/sandbox-runtime/src/__tests__/sandbox-runtime.test.ts`
- `db/app/src/schema/tables/developer-sandbox-runs.ts`
- `db/app/src/utils/developer-sandbox-runs.ts`
- `db/app/src/__tests__/developer-sandbox-runs.test.ts`
- `api/app/src/services/developer-sandbox-runs/policy.ts`
- `api/app/src/services/developer-sandbox-runs/redaction.ts`
- `api/app/src/services/developer-sandbox-runs/index.ts`
- `api/app/src/__tests__/developer-sandbox-runs.test.ts`
- `api/app/scripts/smoke-vercel-sandbox-runtime.ts`

The implementation should not add a workspace page, public router, MCP tool,
or org blocklist UI in this scope.

## Acceptance Criteria

- `@vendor/vercel-sandbox` isolates the official SDK import.
- `@repo/sandbox-runtime` exposes provider-neutral runtime interfaces and a
  Vercel implementation.
- `api/app` can create a persisted multi-command sandbox run.
- The first allowed command lazily loads all enabled Developer Connections.
- Subsequent commands run through Lightfast policy and reuse loaded credentials.
- Default policy blocks CLI auth/session mutation commands.
- Raw stdout/stderr is returned redacted to the active caller but not persisted.
- Explicit stop revokes leases and stops the Vercel Sandbox.
- TTL/stale cleanup revokes leases and marks expired runs.
- Public tRPC does not expose lease materialization or raw command execution.
- Gated smoke script documents whether the current developer environment has a
  valid Vercel OIDC token and can run a non-secret Vercel Sandbox probe.
