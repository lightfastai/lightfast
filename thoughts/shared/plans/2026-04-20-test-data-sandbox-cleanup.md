# Test Data Sandbox Cleanup Implementation Plan

## Overview

Tidy up the `packages/app-test-data` sandbox after its rewrite from a
fixture-injector into a local signed-webhook replay harness. Focus: remove
dead code, stop bypassing `server-only`, centralize config, modernize the
CLI, and split the per-provider sandbox logic so adding a fifth provider is
a one-file change instead of editing two switch statements.

Not a feature effort. No new scenarios, no new providers, no upstream
changes to `@repo/app-providers`.

## Current State Analysis

After the in-flight edits (see `git status`) the package is:

- CLI-only: `src/cli.ts` dispatches `list | doctor | seed | replay | run`.
- Two seeded scenarios: `github-pr-closed`, `vercel-deployment-succeeded`.
- Fixture source of truth: `packages/webhook-schemas/fixtures`.
- DB writes via `@db/app/client`, provider lookup via `@repo/app-providers`.

Concrete issues observed:

- **`server-only` dodge** — `src/seed.ts:3` and `src/lib/fixtures.ts:4`
  import `../../../app-providers/src/registry` to bypass
  `import "server-only"` at the root of `@repo/app-providers`
  (`packages/app-providers/src/index.ts:1`). `packages/webhook-schemas`
  solves the same problem with `tsx --conditions react-server`
  (`packages/webhook-schemas/package.json:11-12`); the `sandbox:*` scripts
  don't.
- **Dead `datasets/`** — 9 JSON files, ~13,831 lines under
  `packages/app-test-data/datasets/`. Zero references under `packages/**`
  and `apps/**`. Leftover from the pre-replay synthetic-dataset era.
- **`knip.json` stale entry** — points at `src/cli/**/*.ts`; that directory
  no longer exists (was deleted this session). Actual entry is `src/cli.ts`.
- **`src/index.ts` barrel** re-exports every module incl. DB-touching
  `seed`/`assert`. No package depends on `@repo/app-test-data`
  (`grep -l '"@repo/app-test-data"' **/package.json` returns only its own
  `package.json`). The barrel is a future-consumer landmine.
- **Duplicated base-URL constants** — `DEFAULT_APP_BASE_URL` and
  `DEFAULT_PLATFORM_BASE_URL` appear in both `src/doctor.ts:8-9` and
  `src/replay.ts:11-12`.
- **Homegrown CLI arg parser** (`src/cli.ts:27-93`). Works for the happy
  path but has a quiet hole: `--base-url --json` consumes `--json` as the
  URL value since there's no flag-vs-value check. Node 22 ships
  `util.parseArgs`; the repo already requires Node >=22.
- **`doctor` only checks URLs** (`src/doctor.ts:34-40`). Provider signing
  secrets (`GITHUB_WEBHOOK_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET`,
  `SENTRY_CLIENT_SECRET`, `VERCEL_CLIENT_INTEGRATION_SECRET`) fail at
  replay time instead of being surfaced up-front.
- **Per-provider sandbox logic spread across two switches** —
  `deriveInboundEventType` + `overrideFixtureResourceId` in
  `src/lib/fixtures.ts:59-146` and `buildReplayRequest` in
  `src/lib/signing.ts:17-102`. Every provider touches two files.
- **Mixed static + dynamic imports in CLI** — scenarios + types static,
  handlers use `await import("./seed")` etc. No cold-start benefit in tsx;
  just inconsistent.
- **`assert.ts` timeout error is a string** (`src/assert.ts:83-86`) — loses
  structure (provider, url, lastStatus, lastIngestLogs) that would help CI
  triage.

### Key Discoveries

- `@repo/app-providers` root export is server-only
  (`packages/app-providers/src/index.ts:1`); a `react-server` condition
  resolves `server-only` to a no-op, which is why
  `packages/webhook-schemas` uses `tsx --conditions react-server`.
- `node:util` `parseArgs` is available and zero-dep — Node >=22 is already
  the pinned engine (repo root `package.json`).
- `packages/app-test-data/datasets/*.json` are unreferenced. Safe to delete.
- `packages/app-test-data` is not a dependency of any app or package
  (`grep -l '"@repo/app-test-data"' **/package.json` → itself only), so
  dropping the barrel `src/index.ts` is safe.
- Fixture overrides (`overrideFixtureResourceId`) only matter for the
  sandbox — they exist to force the fixture's provider-resource-id onto a
  predictable seeded value, and the real ingest path does not use them.
  So the correct home is sandbox-local, not
  `@repo/app-providers`.

## Desired End State

- `packages/app-test-data` is a cleanly-scoped CLI:
  `pnpm --filter @repo/app-test-data sandbox:{list,doctor,seed,replay,run}`
  continues to work against both `platform` (4112) and `app` (3024).
- No deep relative imports into sibling packages. `@repo/app-providers` is
  imported via the public workspace entry.
- `doctor` reports service health **and** which provider secrets are
  present / missing. Exit code is 0 regardless (diagnostic, not enforcement).
- `datasets/` folder is gone. `knip.json` matches the actual source layout.
- CLI argument parsing uses `node:util` `parseArgs`; all imports are
  static.
- Each provider's sandbox logic (signing, event-type derivation, resource
  override) lives in exactly one file under `src/lib/providers/`.
- `assert` timeout surfaces a structured error with last-seen delivery
  status + ingest log count.

### Verifying the end state

- `pnpm --filter @repo/app-test-data typecheck` passes.
- `pnpm --filter @repo/app-test-data sandbox:doctor` lists one entry per
  service URL and one entry per provider env var, with clear ok/missing.
- `pnpm --filter @repo/app-test-data sandbox:run -- github-pr-closed` and
  `... vercel-deployment-succeeded` still pass end-to-end against
  `pnpm dev:full`.
- `pnpm knip` reports no false positives pointing at
  `packages/app-test-data/src/cli/**`.
- No file under `packages/app-test-data/src/**` contains
  `../../../app-providers`.

## What We're NOT Doing

- Adding new scenarios, providers, or webhook fixtures.
- Adding outbound provider stubs, token seeding, or Clerk UI automation
  (that's the README's open backlog).
- Adding a test framework or vitest coverage to this package.
- Pushing sandbox hooks (resource-override, signed-request building) into
  `@repo/app-providers`' `WebhookDef`. Too invasive; sandbox concerns stay
  sandbox-local.
- Changing the ingest route (`apps/platform/src/app/api/ingest/[provider]/route.ts`)
  or any production code path.

## Implementation Approach

Five small, independently-verifiable phases, ordered so structure lands
before the module that consumes it. The per-provider split moves ahead of
`doctor`'s env preflight so `doctor` can read env-var requirements off
the `SandboxProvider` registry instead of hardcoding a second list.

1. **Housekeeping** — delete dead code, fix knip, drop the barrel.
2. **Server-only dodge** — add `--conditions react-server`, switch to
   public `@repo/app-providers` imports.
3. **Per-provider split** — one file per provider under
   `src/lib/providers/`; `fixtures.ts` + `signing.ts` become thin
   dispatchers. Each provider declares its required env vars.
4. **Config + env preflight** — central `config.ts`; `doctor` reports
   missing provider secrets by iterating the registry built in Phase 3.
5. **CLI ergonomics** — `node:util parseArgs`, static imports.

Only Phase 2 (the `--conditions react-server` switch) has non-trivial
failure risk, so it is the single confirmation gate. Remaining phases run
through and are verified end-to-end at the finish.

---

## Phase 1: Housekeeping

### Overview

Remove unreferenced files and stale config so the cleanup phases don't
have to work around them.

### Changes Required

#### 1. Delete dead dataset fixtures

**Directory**: `packages/app-test-data/datasets/`
**Changes**: Delete the entire directory
(`sandbox-1.json` … `sandbox-8.json`, `webhook-schema.json`). Confirm zero
references first: `rg -l 'datasets/sandbox|datasets/webhook-schema'`
must be empty.

#### 2. Fix `knip.json` entry

**File**: `knip.json`
**Changes**:

```jsonc
// Before:
"packages/app-test-data": {
  "entry": ["src/cli/**/*.ts"],
  "project": ["src/**/*.ts"]
},

// After:
"packages/app-test-data": {
  "entry": ["src/cli.ts"],
  "project": ["src/**/*.ts"]
},
```

#### 3. Drop the barrel

**File**: `packages/app-test-data/src/index.ts`
**Changes**: Delete the file. Drop the
`"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }`
block from `packages/app-test-data/package.json` since the package is
CLI-only. Keep `"private": true`.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-test-data typecheck` passes.
- [x] `pnpm knip` reports no new issues for `packages/app-test-data`.
- [x] `rg 'datasets/sandbox|datasets/webhook-schema'` is empty.
- [x] `rg '"@repo/app-test-data"' -g '!pnpm-lock.yaml' -g '!.changeset/**'`
      returns only `packages/app-test-data/package.json`.

#### Manual Verification

- [ ] `pnpm --filter @repo/app-test-data sandbox:list` still prints the two
      scenarios.

---

## Phase 2: Stop bypassing `server-only`

### Overview

Make `@repo/app-providers` consumable from the sandbox CLI the same way
`packages/webhook-schemas` consumes it — via the `react-server` export
condition. Drop deep relative imports.

### Changes Required

#### 1. Add the condition to every `sandbox:*` script

**File**: `packages/app-test-data/package.json`
**Changes**:

```jsonc
"sandbox:list":    "tsx --conditions react-server src/cli.ts list",
"sandbox:doctor":  "pnpm with-env tsx --conditions react-server src/cli.ts doctor",
"sandbox:seed":    "pnpm with-env tsx --conditions react-server src/cli.ts seed",
"sandbox:replay":  "pnpm with-env tsx --conditions react-server src/cli.ts replay",
"sandbox:run":     "pnpm with-env tsx --conditions react-server src/cli.ts run"
```

`webhook-schemas` uses bare `tsx --conditions react-server` with no env
wrapper, so the `pnpm with-env tsx --conditions react-server ...` chain is
new. Before committing, run `sandbox:doctor` once to confirm `with-env`
forwards the flag through to `tsx` (and the env is still loaded).

#### 2. Replace deep relative imports

**Files**: `packages/app-test-data/src/seed.ts`,
`packages/app-test-data/src/lib/fixtures.ts`
**Changes**: Replace
`import { getProvider } from "../../../app-providers/src/registry";`
with
`import { getProvider } from "@repo/app-providers";`
(both files).

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-test-data typecheck` passes.
- [x] `rg "app-providers/src" packages/app-test-data/src` is empty.

#### Manual Verification

- [ ] `pnpm --filter @repo/app-test-data sandbox:list` runs.
- [ ] `pnpm --filter @repo/app-test-data sandbox:doctor` runs.
- [ ] `pnpm --filter @repo/app-test-data sandbox:run -- github-pr-closed`
      still passes end-to-end against `pnpm dev:full`.

**Implementation Note**: Pause for confirmation after `sandbox:run` is
verified green. The `react-server` condition is the load-bearing change.

---

## Phase 3: Per-provider sandbox split

### Overview

Turn the two provider-switches into a registry of per-provider sandbox
modules. Adding a new webhook provider becomes "add one file and one
entry", not "edit two switches". Moved ahead of the config/doctor phase
so `doctor`'s env preflight (Phase 4) can read each provider's required
env vars from this registry instead of duplicating the list.

### Changes Required

#### 1. Per-provider modules

**Files**:
- `packages/app-test-data/src/lib/providers/github.ts`
- `packages/app-test-data/src/lib/providers/linear.ts`
- `packages/app-test-data/src/lib/providers/sentry.ts`
- `packages/app-test-data/src/lib/providers/vercel.ts`

**Shape**: each file exports one object conforming to a shared interface
from `lib/providers/types.ts`:

```ts
// lib/providers/types.ts
import type { LoadedFixture, ReplayRequest } from "../../types";

export interface SandboxProvider {
  readonly requiredEnvVars: readonly string[];
  deriveInboundEventType(fixture: LoadedFixture): string;
  overrideResourceId(fixture: LoadedFixture, resourceId: string): LoadedFixture;
  buildSignedRequest(fixture: LoadedFixture): ReplayRequest;
}
```

`requiredEnvVars` is the single source of truth consumed by `doctor` in
Phase 4 (e.g. `github.requiredEnvVars = ["GITHUB_WEBHOOK_SECRET"]`).

Each provider module owns:

- Its slice of the current `deriveInboundEventType` switch
  (`src/lib/fixtures.ts:59-78`).
- Its slice of the current `overrideFixtureResourceId` switch
  (`src/lib/fixtures.ts:80-146`).
- Its slice of the current `buildReplayRequest` switch
  (`src/lib/signing.ts:17-102`), including env-var requirements read
  via the shared `requireEnv` helper.

#### 2. Thin dispatcher

**File**: `packages/app-test-data/src/lib/providers/index.ts`
**Changes**: Registry keyed by `ProviderSlug`. `ProviderSlug` includes
`apollo`, which is an API provider with no inbound webhooks and
therefore no sandbox entry — hence `Partial<Record<...>>`, not the
stricter `Record<...>`.

```ts
import type { ProviderSlug } from "@repo/app-providers";
import { github } from "./github";
import { linear } from "./linear";
import { sentry } from "./sentry";
import type { SandboxProvider } from "./types";
import { vercel } from "./vercel";

// apollo intentionally absent: API provider, no inbound webhooks.
const PROVIDERS: Partial<Record<ProviderSlug, SandboxProvider>> = {
  github, linear, sentry, vercel,
};

export function getSandboxProvider(slug: ProviderSlug): SandboxProvider {
  const provider = PROVIDERS[slug];
  if (!provider) {
    throw new Error(`No sandbox provider registered for "${slug}"`);
  }
  return provider;
}

export function listSandboxProviders(): ReadonlyArray<
  readonly [ProviderSlug, SandboxProvider]
> {
  return Object.entries(PROVIDERS) as ReadonlyArray<
    readonly [ProviderSlug, SandboxProvider]
  >;
}
```

`listSandboxProviders` is what Phase 4's `doctor` iterates.

#### 3. Slim down `fixtures.ts` and `signing.ts`

**Files**: `packages/app-test-data/src/lib/fixtures.ts`,
`packages/app-test-data/src/lib/signing.ts`
**Changes**:

- `fixtures.ts` keeps `resolveFixturePath`, `loadFixture`,
  `deriveResourceIdFromFixture` (still uses `@repo/app-providers`
  `extractResourceId`). It delegates `deriveInboundEventType` and
  `overrideFixtureResourceId` to `getSandboxProvider(fixture.provider)`.
- `signing.ts` keeps `requireEnv` as a helper (exported if a provider
  module needs it). `buildReplayRequest` delegates to
  `getSandboxProvider(fixture.provider).buildSignedRequest(fixture)`.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-test-data typecheck` passes.
- [x] `rg 'case "github"|case "linear"|case "sentry"|case "vercel"' packages/app-test-data/src`
      matches only inside `src/lib/providers/*.ts` files — not in
      `fixtures.ts` or `signing.ts`.

#### Manual Verification

- [ ] `sandbox:run -- github-pr-closed` passes.
- [ ] `sandbox:run -- vercel-deployment-succeeded` passes.
- [ ] Manually replay a Linear fixture via `sandbox:replay` (no assertion)
      to sanity-check the Linear provider module still signs correctly.
- [ ] Manually replay a Sentry fixture via `sandbox:replay` (no assertion)
      to sanity-check the Sentry provider module still signs correctly.

---

## Phase 4: Central config + env preflight

### Overview

Collapse the two copies of base-URL constants into one module; extend
`doctor` to report which provider signing secrets are set, reading the
env-var list off Phase 3's `SandboxProvider` registry so there is one
source of truth. Exit code stays 0 (diagnostic, not enforcement).

### Changes Required

#### 1. New `src/config.ts`

**File**: `packages/app-test-data/src/config.ts`
**Changes**: New module exposing:

```ts
import type { ReplayTarget } from "./types";

export const DEFAULT_APP_BASE_URL = "http://localhost:3024";
export const DEFAULT_PLATFORM_BASE_URL = "http://localhost:4112";

export const DEFAULT_ASSERTION_TIMEOUT_MS = 20_000;
export const DEFAULT_POLL_INTERVAL_MS = 500;

export function resolveBaseUrl(
  target: ReplayTarget,
  override?: string
): string {
  if (override) return override;
  return target === "app" ? DEFAULT_APP_BASE_URL : DEFAULT_PLATFORM_BASE_URL;
}
```

#### 2. Consume `config.ts` from `doctor` and `replay`

**Files**: `packages/app-test-data/src/doctor.ts`,
`packages/app-test-data/src/replay.ts`
**Changes**: Remove the local `DEFAULT_*_BASE_URL` constants and the local
`resolveBaseUrl`. Import from `./config`.
`src/assert.ts:20-21` should pull its timeout / poll defaults from
`config.ts` as well.

#### 3. Provider env preflight in `doctor`

**File**: `packages/app-test-data/src/doctor.ts`
**Changes**: Iterate the Phase 3 registry — no hardcoded map.

```ts
import { listSandboxProviders } from "./lib/providers";

interface EnvCheck {
  name: string;      // e.g. "github signing secret"
  var: string;       // e.g. "GITHUB_WEBHOOK_SECRET"
  present: boolean;
}

export async function doctor(): Promise<{
  services: ServiceCheck[];
  envs: EnvCheck[];
}> {
  const services = await Promise.all([ /* existing checks */ ]);
  const envs = listSandboxProviders().flatMap(([slug, provider]) =>
    provider.requiredEnvVars.map((v) => ({
      name: `${slug} signing secret`,
      var: v,
      present: Boolean(process.env[v]),
    }))
  );
  return { services, envs };
}
```

CLI output prints both groups. Exit code stays 0 regardless.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-test-data typecheck` passes.
- [x] `rg "DEFAULT_APP_BASE_URL|DEFAULT_PLATFORM_BASE_URL" packages/app-test-data/src`
      only matches `src/config.ts`.
- [x] `rg "GITHUB_WEBHOOK_SECRET|LINEAR_WEBHOOK_SIGNING_SECRET|SENTRY_CLIENT_SECRET|VERCEL_CLIENT_INTEGRATION_SECRET" packages/app-test-data/src`
      matches only inside `src/lib/providers/*.ts` (one env-var name per
      provider module) — not in `doctor.ts`.

#### Manual Verification

- [ ] `pnpm --filter @repo/app-test-data sandbox:doctor` prints both
      service and env sections with the correct counts.
- [ ] Temporarily unsetting `GITHUB_WEBHOOK_SECRET` makes it appear as
      `present: false` while other envs stay `true`; exit code remains 0.
- [ ] `sandbox:run -- github-pr-closed` still passes.

---

## Phase 5: CLI ergonomics

### Overview

Swap the homegrown parser for `node:util parseArgs`; make all CLI imports
static; flatten command dispatch.

### Changes Required

#### 1. Rewrite `cli.ts` parsing with `node:util`

**File**: `packages/app-test-data/src/cli.ts`
**Changes**:

```ts
import { parseArgs } from "node:util";
import { doctor } from "./doctor";
import { replayScenario } from "./replay";
import { runScenario } from "./run";
import { getScenario, scenarios } from "./scenarios";
import { seedScenario } from "./seed";
import type { ReplayTarget } from "./types";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    json: { type: "boolean", default: false },
    target: { type: "string" },
    "base-url": { type: "string" },
    "timeout-ms": { type: "string" },
  },
});

const [command, scenarioName] = positionals;

const target = parseTarget(values.target);
const timeoutMs = parseTimeout(values["timeout-ms"]);

function parseTarget(value: string | undefined): ReplayTarget | undefined {
  if (value === undefined) return undefined;
  if (value === "app" || value === "platform") return value;
  throw new Error(`Invalid --target value "${value}"`);
}

function parseTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid --timeout-ms value "${value}"`);
  }
  return parsed;
}
```

Command dispatch becomes a flat switch over `command` calling the
statically-imported handlers. No more `await import(...)` in cases.

Note: `src/scenarios/index.ts` is the correct import path
(`packages/app-test-data/src/scenarios.ts` does not exist).

#### 2. Sharpen error UX

When `scenarioName` is missing for `seed | replay | run`, throw with the
list of known scenarios (same shape `getScenario` already uses on unknown
names). Unknown command prints `printUsage()` then exits 1.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-test-data typecheck` passes.
- [x] `rg "await import" packages/app-test-data/src` is empty.
- [x] `grep -c "parseArgs" packages/app-test-data/src/cli.ts` is `>= 1`.

#### Manual Verification

- [ ] `sandbox:list` unchanged.
- [ ] `sandbox:run -- github-pr-closed --target app` works.
- [ ] `sandbox:run -- github-pr-closed --base-url --json` now errors
      cleanly on the missing `--base-url` value instead of silently
      consuming `--json`.
- [ ] `sandbox:run` without a scenario name prints the "unknown scenario"
      style message listing known scenarios.

---

## Phase 6 (trailing nit): structured `assert` timeout

### Overview

Tiny follow-up bundled with Phase 5 if time permits. Purely DX.

### Changes Required

**File**: `packages/app-test-data/src/assert.ts`
**Changes**: Replace the string `throw new Error(...)` at
`src/assert.ts:83-86` with a thrown `AssertionTimeoutError` carrying
`{ scenario, provider, deliveryId, url, lastStatus, lastIngestLogs, elapsedMs }`
as fields. Keep the same human-readable `message`. `run.ts` does not
catch it — the CLI already surfaces `error.message` on throw and the
structured fields are available to any future programmatic consumer.

### Success Criteria

- [ ] Deliberately break a scenario (e.g. wrong `expectedIngestLogs`) and
      confirm the thrown error still prints a useful message.

---

## Testing Strategy

### Automated

- `pnpm --filter @repo/app-test-data typecheck` after every phase.
- `pnpm knip` after Phase 1.
- `pnpm check` at end of the work (biome / lint).

This package has no unit tests today and this plan does not add any — the
end-to-end CLI run is the integration test.

### Manual

After each phase, with `pnpm dev:full` running:

1. `pnpm --filter @repo/app-test-data sandbox:list`
2. `pnpm --filter @repo/app-test-data sandbox:doctor`
3. `pnpm --filter @repo/app-test-data sandbox:run -- github-pr-closed`
4. `pnpm --filter @repo/app-test-data sandbox:run -- vercel-deployment-succeeded`

Plus per-phase verifications listed above.

## Performance Considerations

None. Sandbox CLI, local-only, small data volume. Phase 4's static imports
save a few ms of cold start in tsx; immaterial.

## Migration Notes

- `datasets/` deletion is permanent. Files are unreferenced and also
  recoverable from git history if needed.
- Barrel `src/index.ts` removal is a public-surface change in theory; no
  workspace package consumes it today, confirmed via grep over
  `**/package.json`.
- `doctor` return shape changes from `ServiceCheck[]` to
  `{ services, envs }`. No external consumer — CLI is the only caller.

## References

- Current sources: `packages/app-test-data/src/**`
- Fixture source of truth: `packages/webhook-schemas/fixtures/**`
- `server-only` workaround precedent:
  `packages/webhook-schemas/package.json:11-12`
- Ingest endpoint: `apps/platform/src/app/api/ingest/[provider]/route.ts`
- Existing registry pattern: `packages/app-providers/src/registry.ts:19-25`
  (`PROVIDERS as const` + `getProvider` with typed overloads)
- Node parseArgs: `node:util` (Node >=22, already required)

---

## Improvement Log

Review pass on 2026-04-20. Key changes:

- **Phase reordering** — per-provider split (was Phase 5) moved to
  Phase 3; config + env preflight (was Phase 3) moved to Phase 4. Reason:
  Phase 4's `doctor` needs the `requiredEnvVars` declared by each
  `SandboxProvider` in the new registry. Original order would have
  hardcoded the provider→env-var map in `doctor.ts` and duplicated the
  same knowledge in each signer, guaranteeing drift.

- **`SandboxProvider` interface gains `readonly requiredEnvVars`** —
  single source of truth for env-var requirements, iterated by `doctor`
  via a new `listSandboxProviders()` export.

- **Registry type corrected from `Record<ProviderSlug, SandboxProvider>`
  to `Partial<Record<...>>`** — `ProviderSlug` (defined in
  `packages/app-providers/src/client/display.ts:15-23`) includes `apollo`,
  which is an API provider with no inbound webhooks. The strict `Record`
  would fail typecheck. Apollo omission now has an inline comment.

- **`doctor` env-var implementation simplified** — hardcoded
  `PROVIDER_ENV_VARS` map deleted; iterates `listSandboxProviders()`
  instead. Added an automated-verification rg check asserting no env-var
  literals exist outside `src/lib/providers/`.

- **Confirmation gates consolidated from 4 → 1** — only Phase 2 (the
  load-bearing `--conditions react-server` switch) has non-trivial
  failure risk. Other phases are straightforward refactors, verified
  end-to-end at the finish.

- **Phase 2 gained a pre-commit verification note** — `pnpm with-env tsx
  --conditions react-server ...` is a new chain; `webhook-schemas` uses
  bare `tsx --conditions react-server`. Worth confirming `with-env`
  forwards flags correctly before committing.

- **Minor fixes** — Phase 5 (now the CLI phase) clarifies that scenarios
  live at `src/scenarios/index.ts` (not `src/scenarios.ts`); Phase 6's
  `AssertionTimeoutError` now includes `scenario` alongside `provider`
  and `deliveryId`.

- **10x alternative considered and rejected** — replacing the two
  provider switches with `ProviderSlug`-exhaustive switches (no
  registry, no new files) would deliver most of the compile-time safety
  at ~10% of the code. Rejected in favor of the registry because it
  matches the existing monorepo pattern (`registry.ts`, `dispatch.ts`,
  ingest route all use lookup-over-switch) and cleanly exposes
  `requiredEnvVars` to Phase 4.

- **Out-of-scope code smell surfaced but not fixed** — sandbox-only
  concerns (resource-override, signed-request building) arguably belong
  on `@repo/app-providers`' `WebhookProvider` shape rather than in a
  parallel sandbox registry. Plan already flags this in
  "What We're NOT Doing" and the rationale (keep test-only methods out
  of the production provider surface) holds.
