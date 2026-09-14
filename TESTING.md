# Repository test harness

Use Node 22 (at least 22.13.0) and the pinned pnpm 11.1.3. From the root:

```sh
pnpm install --frozen-lockfile
pnpm test --force --continue --summarize
pnpm check
pnpm typecheck
pnpm lint:ws
pnpm turbo boundaries
pnpm knip
pnpm build
pnpm --filter @lightfast/remotion render:brand
```

`pnpm test` first compares every repository test file with each runner's actual
file discovery and Turbo cache inputs. All ten test-owning packages must remain
runnable and nonempty. New test packages are discovered automatically; add them
to the package commitments in `scripts/verify-test-harness.mjs` once established.
This is a repository inventory check, so it runs at the root, outside the cached
package tests. `pnpm verify:test-harness` runs just that check.

Vitest packages share recursive `src/**/*.{test,spec}.{ts,tsx}` discovery, reject
empty suites and use at most two workers with serial files. Remotion uses the same
source naming convention with Node's test runner through tsx, one file at a time.
Tests, fixtures, snapshots, package manifests and configuration are Turbo inputs.
Shared configuration changes invalidate dependent tests through the package graph.

The required PR gate and repository CI invoke the complete `pnpm test --force`
command, including database tests. The public API CI remains a focused additional
check; it does not replace full repository acceptance. Release workflows retain
their existing triggers and publication behavior.

## Coverage audit

The September 2026 audit covered all 33 original test source files, discovery
configuration, fixtures, snapshots, package scripts, Turbo wiring, Knip and CI.
There are now 32 files: the duplicate CLI token-client suite was consolidated.

| Area | Files | Protection retained |
| --- | ---: | --- |
| API foundation | 1 | Deterministic router health and request context |
| Database foundation | 1 | Explicit credentials and mocked vendor adapter with empty schema |
| Desktop | 1 | Context isolation, sandbox, disabled Node integration, web security |
| Local example | 1 | Local root and index route registration |
| Local MCP | 2 | In-memory and real stdio initialization, empty tools, no TCP listener |
| Remotion | 2 | Canonical SVG paths, clearspace, sizes, individual selection, historical artwork, manifest, registration, local destinations and CSS behavior |
| CLI | 15 | Environment, contract, OAuth state/PKCE, errors, browser spawn handling, login, refresh, sessions, commands, loopback and full local HTTP auth fixture |
| SDK | 1 | Explicit endpoints, key validation, authorization, methods, paths, request bodies and responses |
| Public MCP | 5 | Explicit startup configuration, policy, registration, results/errors and bundled stdio wire snapshot |
| API contract | 3 | Route/schema metadata, MCP scopes/policy and signal classification invariants |

Four migration-only source/dependency string tests were removed from SDK, public
MCP and contract suites. Their useful guarantees remain in route/request tests,
plain schema metadata, policy registration, bundled stdio snapshots and workspace
build/dependency checks. The database source-string test became a mocked adapter
behavior test. No provider is contacted.

CLI token-client assertions now live together: POST, endpoint, form fields,
PKCE, redirect URI, absence of client secret, expiration, refresh preservation and
missing-refresh-token rejection. Session tests remove their own temporary files;
fake timers and MCP transports are cleaned up on failure as well as success.

Remotion assembly hashes and migration-specific source substitutions were removed.
Runtime manifest, dimensions, props, registration and CSS checks remain. Historical
artwork and static-asset hashes are intentionally retained: they protect existing
creative content, including Lissajous media, without freezing assembly source.

## Local integration and asset acceptance

The CLI HTTP fixture owns ephemeral loopback listeners and a temporary session
store. It verifies login, S256 challenge, callback, token exchange, finalization,
0600 permissions, refresh, whoami and logout. It never opens a real browser or
contacts an OAuth provider. The public MCP subprocess replaces fetch before
loading the built package; unexpected requests fail rather than reaching a network.
Local MCP checks actual stdio handshakes and process TCP-listener state.

Asset acceptance requires a fresh `render:brand` from a clean committed checkout.
The renderer checks SVG serialization, PNG dimensions and pixels, clearspace and
ICO frames, then writes `.cache/brand-render-receipt.json` with source commit,
dirty flag, geometry hashes and each individual output hash. Run again at the
integrated main revision and compare the files, not just a cached test result.
Generated outputs stay under `apps/remotion/out`; no render publishes or deploys.
