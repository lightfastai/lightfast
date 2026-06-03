# Vercel Sandbox Runtime Design

Date: 2026-06-03
Status: Ready for written spec review

## Summary

Lightfast will use Vercel Sandbox as the v1 execution plane for Developer
Connections. Developer Connections remain org-owned credentials for provider
CLIs such as PlanetScale, Upstash, Sentry, and Clerk. Vercel is not a
Developer Connection provider in v1. It is Lightfast infrastructure used to
create short-lived Firecracker microVMs, inject leased provider credentials,
run real provider CLIs, collect output, revoke leases, and destroy the sandbox.

The local `vercel-labs/local-sandbox` repository was tested and should not be
used for v1 runtime execution. Its API and in-memory provider build and start,
but the in-memory provider stubs command execution. The real vfkit provider is
blocked in the current environment by missing `vfkit` and a missing base image
at `~/.cache/v0-vfkit/base.img`. It remains useful as a reference shape only.

V1 should integrate the official `@vercel/sandbox` SDK behind an internal
`SandboxRuntime` interface and expose only a higher-level
`DeveloperCommandRunner` to Lightfast product code.

## Goals

- Run real agent-oriented provider CLIs inside isolated Vercel Sandbox
  microVMs.
- Use Vercel OIDC as the default Sandbox SDK authentication path.
- Keep Vercel Sandbox as Lightfast-owned infrastructure, not org-owned user
  setup.
- Reuse the existing Developer Connections lease and materialization service.
- Avoid exposing raw provider credential materialization to browsers, tRPC, or
  local worktree processes.
- Ensure provider credentials are materialized only after sandbox creation and
  only for the command that needs them.
- Stop sandboxes and revoke leases in a `finally` cleanup path.
- Keep a provider-neutral `SandboxRuntime` boundary so another cloud runtime
  can replace Vercel Sandbox later.
- Start with an internal command runner, not a public end-user command API.

## Non-Goals

- No `vercel` Developer Connection provider in v1.
- No replacement CLI lookalikes. The sandbox runs the real CLIs.
- No `vercel-labs/local-sandbox` implementation in v1.
- No public tRPC procedure that accepts arbitrary commands.
- No MCP tool exposure in this scope.
- No durable terminal UI, command history UI, or replay UI in this scope.
- No promise that credentials are hidden from the command process itself.
  Env/file materialization means code running in the sandbox can read those
  values. V1 safety comes from sandbox isolation, short leases, cleanup,
  policy, and redaction.
- No command firewall that covers every destructive provider operation.
  V1 should include a narrow internal command policy hook, but full policy
  authoring is deferred.

## Verified Inputs

### Vercel Sandbox

The official Vercel Sandbox docs state that the SDK creates ephemeral Linux
microVMs and supports `Sandbox.create()`, `runCommand()`, file operations,
ports, timeouts, snapshots, network policies, and cleanup. Authentication
supports Vercel OIDC tokens as the recommended path. For local development,
`vercel link` plus `vercel env pull` provides `VERCEL_OIDC_TOKEN`; in
production on Vercel, authentication is automatic. Access-token auth exists
for non-Vercel environments.

References:

- https://vercel.com/docs/vercel-sandbox/
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
  -> DeveloperCommandRunner
    -> CommandPolicy
    -> issueDeveloperConnectionLeases()
    -> SandboxRuntime.create()
      -> VercelSandboxRuntime (@vercel/sandbox)
    -> SandboxRuntime.writeFiles()
    -> SandboxRuntime.exec()
    -> redact logs/result
    -> revoke leases
    -> stop sandbox
```

There are two boundaries.

### SandboxRuntime

`SandboxRuntime` is infrastructure plumbing. It should be small and shaped
around the minimum operations Lightfast needs:

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

The v1 implementation is `VercelSandboxRuntime`.

It should map to `@vercel/sandbox` without leaking the SDK across the service
boundary. The wrapper should normalize:

- runtime selection, defaulting to `node24`
- sandbox id naming
- command result shape
- file write payloads
- network policy naming
- timeout and cleanup errors

### DeveloperCommandRunner

`DeveloperCommandRunner` is the product-safe boundary. It owns credentials,
policy, redaction, and cleanup. Product code should call this instead of
calling `SandboxRuntime` directly.

Conceptual input:

```ts
export interface DeveloperCommandRunnerInput {
  auth: AuthContext;
  providers: DeveloperConnectionProvider[];
  workflowRunId: string;
  command: {
    cmd: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  };
  policy: {
    purpose: "developer_connection_probe" | "internal_workflow";
    allowedProviders: DeveloperConnectionProvider[];
  };
}
```

Conceptual output:

```ts
export interface DeveloperCommandRunnerResult {
  sandboxRunId: string;
  providerLeaseIds: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}
```

The runner should be internal-only in v1. It should not be mounted directly on
workspace tRPC.

## Runtime Flow

1. Internal caller requests a bounded command with explicit providers.
2. `DeveloperCommandRunner` checks the actor has an active org identity.
3. `CommandPolicy` validates that the requested command is allowed for the
   current internal purpose.
4. Runner creates a `sandboxRunId`.
5. Runner creates a Vercel Sandbox without provider credentials.
6. Runner performs non-secret toolchain preparation if needed.
7. Runner calls `issueDeveloperConnectionLeases()` with:
   - `providers`
   - `sandboxRunId`
   - `workflowRunId`
8. Runner writes provider materialization files under a sandbox-only temp path.
9. Runner runs the real command with provider env vars and, when needed,
   `HOME` or provider config env vars pointing at the temp path.
10. Runner collects stdout/stderr and applies redaction.
11. Runner revokes leases and stops the sandbox in `finally`.
12. Runner returns redacted command output and exit status.

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

- command-level env, not create-level env, whenever possible
- files under `/vercel/sandbox/.lightfast/provider-auth/<leaseId>/`
- `HOME` set to that auth directory for commands that use CLI config files
- provider-specific env variables for CLIs that support them

The sandbox should be created before credentials are decrypted. Secret-bearing
setup must happen after lease issuance and immediately before command
execution.

## Provider Toolchain

The `node24` runtime can run Node package CLIs such as `npx clerk` and
`npx sentry`. PlanetScale and some Upstash workflows need a toolchain strategy:

- Prefer package-runner commands when the provider publishes a working npm CLI.
- For non-Node binaries such as `pscale`, add a provider-specific preparation
  step that installs the binary before credentials are materialized.
- Preparation commands must not receive provider credentials.
- Preparation output should be logged separately from secret-bearing command
  output.

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

Vercel Sandbox supports network policies. V1 should use this in a conservative
two-phase model where practical:

1. Setup phase:
   - allow npm/package registry and download hosts needed to install CLIs
   - no provider credentials are present
2. Execution phase:
   - remove broad install egress
   - allow the provider domains required by the requested providers
   - run the command with leased credentials

If the exact provider domain list is incomplete, v1 may use `allow-all` only
for internal smoke tests, but the command runner interface must keep a network
policy hook so this can be tightened without changing product callers.

## Authentication And Environment

V1 should rely on the SDK's default authentication behavior:

- Local development:
  - `vercel link`
  - `vercel env pull`
  - `apps/app/.vercel/.env.development.local` provides `VERCEL_OIDC_TOKEN`
    through the repo's existing `pnpm with-env` pattern.
  - Development tokens expire after 12 hours and must be refreshed with
    `vercel env pull`.
- Production on Vercel:
  - Vercel manages OIDC automatically.
- Non-Vercel external environments:
  - access-token auth may be supported later with `VERCEL_TEAM_ID`,
    `VERCEL_PROJECT_ID`, and `VERCEL_TOKEN`.

The Lightfast app should not store Vercel Sandbox auth as a Developer
Connection. Vercel Sandbox auth is deployment infrastructure.

## Security Model

Vercel Sandbox gives Lightfast a stronger v1 execution boundary than local
processes or Codex worktrees because commands run in ephemeral microVMs. It
does not remove the need for Lightfast policy.

V1 safety controls:

- no public raw command endpoint
- active org actor required
- explicit provider list
- short Developer Connection leases
- no credential materialization before sandbox creation
- no create-level provider env unless a provider requires it
- command-level env for secrets
- sandbox file materialization under temp auth directories
- redaction for stdout/stderr and error messages
- `finally` cleanup for lease revocation and sandbox stop
- sandbox timeout limits
- network policy hook

Known limits:

- The command process can read env vars and materialized files.
- A malicious command can try to print credentials; redaction reduces but does
  not eliminate this risk.
- If a command has provider privileges, the provider may still allow dangerous
  actions unless credentials are scoped narrowly or command policy blocks the
  command.
- Sandbox teardown failure should not leave durable Lightfast credentials on a
  user machine, but it may leave a Vercel Sandbox alive until timeout.

## Command Policy

The next implementation should add a narrow policy seam even if the first
caller is internal.

Policy inputs:

- command `cmd`
- command `args`
- requested providers
- purpose
- actor org role or future sandbox permission

Policy outputs:

- allowed or rejected
- redaction hints
- network policy hints
- toolchain preparation hints

Initial policy should allow only internal smoke/probe commands and explicit
known provider CLI command families. It should reject shell string execution as
the default. Commands should be represented as `{ cmd, args }`, not a single
shell string.

## Error Handling

The runner should distinguish:

- sandbox auth/config failure
- sandbox creation failure
- toolchain preparation failure
- lease issuance failure
- command policy rejection
- command execution nonzero exit
- command timeout
- cleanup failure

Cleanup failures should be logged and surfaced as warnings when the command
result is otherwise available. Lease issuance failures should stop the sandbox
before returning an error. Auth failures from provider CLIs should not
automatically mark Developer Connections as `needs_reconnect` unless a provider
adapter explicitly recognizes the failure.

## Testing Strategy

Unit tests:

- fake `SandboxRuntime` verifies create/write/exec/stop call order
- no lease issuance before command policy passes
- no credential materialization before sandbox creation
- cleanup runs when command execution fails
- cleanup runs when lease issuance fails
- stdout/stderr redaction removes materialized secrets
- shell string commands are rejected

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

- `api/app/package.json`
  - add `@vercel/sandbox`
- `api/app/src/services/sandbox-runtime/types.ts`
  - provider-neutral interfaces
- `api/app/src/services/sandbox-runtime/vercel.ts`
  - `@vercel/sandbox` adapter
- `api/app/src/services/sandbox-runtime/index.ts`
  - runtime factory
- `api/app/src/services/developer-command-runner/policy.ts`
  - initial command policy
- `api/app/src/services/developer-command-runner/redaction.ts`
  - stdout/stderr redaction helpers
- `api/app/src/services/developer-command-runner/index.ts`
  - orchestration service
- `api/app/src/__tests__/sandbox-runtime.test.ts`
  - adapter/factory behavior with mocks
- `api/app/src/__tests__/developer-command-runner.test.ts`
  - orchestration, lease, cleanup, redaction
- optional gated script:
  - `api/app/scripts/smoke-vercel-sandbox.ts`

The implementation should not add a workspace page or public router in this
scope.

## Open Questions

1. Which internal workflow should call `DeveloperCommandRunner` first?
   Recommended answer: a gated smoke script before product UI or MCP exposure.
2. Should access-token auth be supported in v1?
   Recommended answer: no. Use OIDC first and add access-token fallback only
   when Lightfast needs non-Vercel execution.
3. How strict should v1 network policy be?
   Recommended answer: strict for authenticated commands, permissive only for
   non-secret setup/smoke probes while provider domain lists are finalized.

## Acceptance Criteria

- `SandboxRuntime` exists as an internal API with a Vercel Sandbox
  implementation.
- `DeveloperCommandRunner` can run a non-secret Vercel Sandbox smoke command
  and always stop the sandbox.
- Developer Connection leases are issued only after policy passes and sandbox
  creation succeeds.
- Provider credentials are injected only at command execution time.
- Public tRPC does not expose lease materialization or raw command execution.
- Unit tests prove cleanup and redaction paths.
- Gated smoke script documents whether the current developer environment has a
  valid Vercel OIDC token.
