# Linear MCP Required Envs Design

Date: 2026-06-04
Status: Approved direction; pending written-spec review

## Summary

Linear connector configuration should become a required application environment
contract, using the recent GitHub App env rework as the reference pattern.
Lightfast should require Linear OAuth credentials everywhere, while keeping real
Linear API and MCP endpoints as safe defaults in preview and production. Local
development continues to override endpoints through the Linear emulator.

This changes Linear from "optional connector that may be disabled by missing
config" to "core provider integration that must be configured for app runtime."

## Goals

- Require `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` during `@api/app` env
  module evaluation in development, preview, and production.
- Keep `LINEAR_API_ORIGIN` and `LINEAR_MCP_ENDPOINT` optional endpoint
  overrides.
- Use `packages/linear-app-node` default endpoints for real Linear whenever the
  overrides are absent.
- Preserve local dev behavior where `@repo/linear-emulator env:sh` injects all
  Linear values into `@lightfast/app`.
- Keep custom Linear endpoint overrides allowed only in development and test.
- Mirror the GitHub config split:
  - Explicit parser for tests and controlled config creation.
  - Ambient runtime getter for production code.
  - Runtime getter still rejects incomplete config when env validation is
    skipped.
- Update Turbo env/pass-through config so Linear env changes are visible to
  builds and cache keys.

## Non-Goals

- Do not require `LINEAR_API_ORIGIN` or `LINEAR_MCP_ENDPOINT` in preview or
  production.
- Do not remove the Linear emulator or its `env:sh` output.
- Do not change the connector database schema.
- Do not change Linear OAuth scopes, token storage, MCP tool discovery, or
  runtime call behavior except where config resolution is affected.
- Do not make X connector config required as part of this work.

## Architecture

`api/app/src/env.ts` should require `LINEAR_CLIENT_ID` and
`LINEAR_CLIENT_SECRET`. Endpoint overrides remain optional:

- `LINEAR_API_ORIGIN`: optional URL. When present, it overrides both Linear API
  and app origins for local/emulated Linear.
- `LINEAR_MCP_ENDPOINT`: optional URL. When present, it overrides the MCP
  streamable HTTP endpoint.

`api/app/src/services/connectors/config.ts` should stop returning
`missing_config` for Linear. Instead it should expose a required Linear config
path:

- `parseLinearConnectorConfig(configEnv, options)` for explicit tests and
  controlled parsing.
- `getLinearConnectorConfig(options)` as the ambient runtime getter.
- `requireLinearConnectorConfig(options)` can remain as a compatibility wrapper,
  but it should no longer produce a `PRECONDITION_FAILED` missing-config result
  for absent Linear credentials. Missing credentials fail as an incomplete
  environment error.

This follows `api/app/src/services/github/config.ts`: env validation catches
normal boot-time mistakes, while the runtime getter still protects code paths
that run under `SKIP_ENV_VALIDATION`.

X keeps its existing optional `getXConnectorConfig` result shape. Connector
catalog availability still checks X for missing config, but Linear availability
becomes based on permission only. The Linear connector row should no longer show
missing-config UI in normal runtime because the app cannot boot with incomplete
Linear credentials.

`packages/provider-routines/src/linear.ts` already has a runtime env guard for
credentials. It should either continue to use the ambient env defensively or be
aligned with the same parser semantics so skipped validation cannot produce
undefined credentials during token refresh.

## Local Development

The root `pnpm dev` path already starts the Linear emulator and
`apps/app/package.json` already injects:

- `LINEAR_CLIENT_ID`
- `LINEAR_CLIENT_SECRET`
- `LINEAR_API_ORIGIN`
- `LINEAR_MCP_ENDPOINT`

through `pnpm --filter @repo/linear-emulator env:sh`.

That behavior should remain the local source of truth. The design does not add
manual `.env` requirements for local Linear endpoints when using `pnpm dev`.

## Build And Cache Env

`apps/app/turbo.json` should include the Linear envs in the app build task,
matching how provider envs are consumed through `@api/app` during Next builds.
Use this split:

- `passThroughEnv`: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`
- `env`: `LINEAR_API_ORIGIN`, `LINEAR_MCP_ENDPOINT`

Credentials must remain server-only pass-through envs. Endpoint overrides are
non-secret URLs that should affect the build cache key because they change the
resolved Linear endpoint contract.

## UI Behavior

The Linear connector page should no longer need to render a missing-config state
for Linear. Existing X missing-config UI stays.

Tests that currently assert Linear missing-config copy should be rewritten to
cover X, or deleted if redundant. Product copy for Linear should assume it is
available when the viewer can manage connectors.

## Error Handling

Missing Linear credentials should fail clearly:

- Env module evaluation: `Invalid environment variables` with the missing
  `LINEAR_*` keys in the logged validation error.
- Runtime getter under skipped validation: `Linear connector environment is
  incomplete.`

Custom endpoint overrides outside development/test should continue to fail via
`LINEAR_CUSTOM_ENDPOINT_FORBIDDEN`.

## Testing

Update focused tests before implementation:

- `api/app/src/__tests__/env.test.ts`
  - Add Linear env keys to the mutated env set.
  - Set valid Linear credentials in `setValidBaseEnv`.
  - Add a test that env module evaluation requires Linear credentials in
    development, preview, and production.
- Connector config tests
  - Assert explicit Linear parser defaults to real Linear endpoints when
    endpoint overrides are absent.
  - Assert explicit Linear parser accepts emulator endpoint overrides in
    development.
  - Assert ambient getter rejects incomplete Linear config with
    `SKIP_ENV_VALIDATION=1`.
  - Assert custom Linear endpoints remain forbidden in preview/production.
- Connector catalog tests
  - Remove Linear missing-config availability assertions.
  - Keep X missing-config availability assertions.
- UI tests
  - Remove or rewrite Linear missing-config UI assertions.
  - Keep provider-aware missing-config coverage for X.
- Provider routine tests
  - Ensure skipped validation or missing credentials still produce a controlled
    Linear config/token-refresh failure.

## Rollout

Preview and production deployments must provide `LINEAR_CLIENT_ID` and
`LINEAR_CLIENT_SECRET` before this change lands. If they are absent, builds or
runtime env evaluation should fail immediately, which is intended.

Local dev remains zero-manual-config for Linear when using the root `pnpm dev`
entrypoint because the emulator injects deterministic credentials and endpoint
overrides.
