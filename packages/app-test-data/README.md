# @repo/app-test-data

Local simulated E2E sandbox for webhook-driven Lightfast flows.

This package is no longer an event injector. The main loop is:

1. Start local services with `pnpm dev:full`
2. Seed minimal DB state for the scenario
3. Replay raw fixtures from [`packages/webhook-schemas`](../webhook-schemas)
   as real signed HTTP POSTs to `/api/ingest/:provider`
4. Assert delivery + ingest state in Postgres

That means the sandbox now exercises the actual ingress route, signature
verification, delivery persistence, Inngest handoff, and ingest log creation.

## Commands

```bash
# List available scenarios
pnpm --filter @repo/app-test-data sandbox:list

# Check local runtime surfaces
pnpm --filter @repo/app-test-data sandbox:doctor

# Seed the minimal installation + integration rows for a scenario
pnpm --filter @repo/app-test-data sandbox:seed -- github-pr-closed

# Replay a scenario without assertions
pnpm --filter @repo/app-test-data sandbox:replay -- github-pr-closed

# Full loop: seed -> replay -> assert
pnpm --filter @repo/app-test-data sandbox:run -- github-pr-closed
pnpm --filter @repo/app-test-data sandbox:run -- vercel-deployment-succeeded
```

## Options

```bash
--target platform|app   Replay against platform (4112) or app/proxy (3024)
--base-url URL          Override the default base URL for the selected target
--timeout-ms NUMBER     Assertion timeout for `run` (default: 20000)
--json                  Print JSON instead of human-readable output
```

## Current Scope

Implemented now:
- minimal DB seeding for `gatewayInstallations` and `orgIntegrations`
- real signed webhook replay for GitHub, Vercel, Linear, and Sentry
- polling assertions for `gatewayWebhookDeliveries` and `orgIngestLogs`
- first-class scenarios for GitHub PR and Vercel deployment flows

Not implemented yet:
- outbound provider stubs for backfill and proxy-heavy scenarios
- token seeding for flows that need live provider fetches
- Clerk browser auth automation and UI verification
- full scenario reset/cleanup

## Fixture Source Of Truth

Fixtures live in [`packages/webhook-schemas/fixtures`](../webhook-schemas/fixtures).
This package treats them as canonical raw payloads and does not transform them
before replay.

## Scenario Shape

Scenarios live in [`src/scenarios`](./src/scenarios) and define:
- `connections`: the minimal seeded provider/resource rows
- `replays`: the fixture files to send and the expected delivery outcomes

The first scenarios are intentionally narrow. The goal is a fast local loop for
one boundary at a time, not a giant synthetic story dataset.
