---
date: 2026-04-23
owner: jp@jeevanpillay.com
branch: main
based_on: thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
supersedes_partial: thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md
status: draft
---

# Desktop Pre-Release Batch Implementation Plan

## Overview

Get `apps/desktop` from "quick-wins applied" to "first public `@lightfast/desktop@0.1.0` release shipping a signed, notarized, auto-updating macOS binary with Sentry-readable stack traces." Six phases. Phase A is a human-setup checklist; B–F are code/CI changes. All four prior quick-win phases are already applied and verified in the current tree.

## Current State Analysis

All four phases of `2026-04-23-desktop-codex-gap-quick-wins.md` are landed:
- Entitlements trimmed (`build/entitlements.mac.plist` has 5 keys; over-broad `disable-library-validation`/`device.camera`/`network.server` removed).
- `forge.config.ts:67-78` has `NSQuitAlwaysKeepsWindows=false`, `LSMinimumSystemVersion=12.0`, `LSEnvironment.MallocNanoZone="0"`.
- `src/main/sentry.ts:14-55` has `SESSION_ID`, `rewriteFramesIntegration({root, prefix: "app:///"})`, `dist=buildNumber`, `bundle/host/sessionId` tags.
- `showContextMenu` IPC, `silentRefresh`, and the deep-link `console.log` are gone. `protocol.ts` deleted; OAuth moved to a loopback HTTP server (`auth-flow.ts:70-141`).

What still blocks a v0.1.0 release:
- `.github/workflows/desktop-release.yml.disabled` is inert (correctly, since Apple signing secrets aren't provisioned yet).
- `forge.config.ts:43-54` reads `LIGHTFAST_DESKTOP_RELEASE_REPO` but the disabled workflow passes `${{ github.repository }}` — two conflicting paths.
- `@sentry/cli` is in `pnpm-workspace.yaml:82` `onlyBuiltDependencies` but no script invokes it; packaged-build stack traces will be unreadable despite `rewriteFramesIntegration` being wired.
- `ci-core.yml:45,105` explicitly excludes desktop from typecheck + build. `ci.yml:50-54` only runs typecheck via `turbo --affected`. Nothing runs `electron-forge package` on PRs.
- `apps/desktop/package.json` placeholders: `version: "0.0.0"`, empty `sparkleFeedUrl`, unused `sparklePublicKey: ""`.
- No `.env.example`, no `lint`/`clean` scripts in desktop, `dev:desktop-stack` is misnamed at the root.

### Key Discoveries

- `sparklePublicKey` is declared in `src/shared/env.ts:12`, `src/shared/ipc.ts:52`, and `src/main/build-info.ts:23` but has **zero** downstream readers (grep confirms). Electron's `autoUpdater` does not use it. Drop the field instead of stamping it in CI.
- Sentry DSNs are public identifiers (they're visible in any shipped app's JS bundle). Baking at CI build time via `npm pkg set sentryDsn=...` from a secret is simplest — no runtime env plumbing required on macOS.
- Release tag convention in this repo is already `<package>@<version>` (changesets produces `lightfast@x.y.z`, `@lightfastai/mcp@x.y.z` via `release.yml`). Desktop should match: `@lightfast/desktop@<version>`. YAML trigger: `'@lightfast/desktop@*'`.
- Desktop is `"private": true`; `changesets/action` ignores private packages automatically — it cannot and will not try to publish desktop. The blocker isn't publishing, it's that `verify-changeset.yml:51` rejects any changeset file mentioning `@lightfast/desktop`. We stay tag-only and add the package to `.changeset/config.json` `ignore` so `pnpm changeset` never prompts for it.
- Monorepo is public (`gh repo view` → `"visibility":"PUBLIC"`). Sparkle feed URL `github.com/lightfastai/lightfast/releases/latest/download/latest-mac-${arch}.json` works without auth.
- `.vite/build` (main + preload) and `.vite/renderer/main_window` (renderer) are the two source-map roots `sentry-cli upload-sourcemaps --url-prefix "app:///"` needs to target — both bundles end up addressed via the `app:///` prefix by `rewriteFramesIntegration`.

## Desired End State

1. `git tag @lightfast/desktop@0.1.0 && git push origin '@lightfast/desktop@0.1.0'` fires `desktop-release.yml`, which builds signed+notarized arm64 and x64 `.zip` + `.dmg`, uploads source maps to Sentry, publishes GitHub release assets with Squirrel.Mac JSON feeds, and undrafts the release.
2. Packaged app's Sentry issues have fully symbolicated stacks (file/line → repo file/line), session tag, `dist`, and the `@lightfast/desktop@0.1.0+<runNumber>` release id.
3. Every PR touching `apps/desktop/**` runs typecheck + `electron-forge package` on macOS and fails if either breaks.
4. A new contributor runs `cp apps/desktop/.env.example apps/desktop/.env.development && pnpm dev:desktop` and the app boots.
5. `pnpm changeset` in the repo never prompts for `@lightfast/desktop`.

Verification:
- `gh release view '@lightfast/desktop@0.1.0' --repo lightfastai/lightfast` shows 6 assets (arm64 zip+dmg+json, x64 zip+dmg+json) plus undraft state.
- `sentry-cli releases info '@lightfast/desktop@0.1.0+<runNumber>' --project lightfast-desktop` lists uploaded source maps.
- `.github/workflows/desktop-release.yml` exists and is green on the tag push.
- `pnpm --filter @lightfast/desktop lint` passes.

## What We're NOT Doing

- Sparkle-native / Ed25519 auto-update (Squirrel.Mac is fine for v0.1.0). `sparklePublicKey` gets deleted, not stamped.
- Windows + Linux packaging (`MakerSquirrel` stays in `forge.config.ts:82-85` dormant; no Linux makers; no Windows job in the workflow).
- Universal binaries (`@electron/universal`). Two separate `-arm64` / `-x64` artifacts are published; the existing `${arch}` template in `updater.ts:27-29` handles dispatch.
- File-backed structured logger. Sentry + breadcrumbs cover v0.1.0; revisit once a user-issue-debugging workflow demands it.
- SQLite / persistent structured storage, worker tier, per-surface preload isolation, renderer i18n, Playwright harness, notifications — all deferred per original research `Status Tracker`.
- Wiring desktop into the changeset-driven release flow (`release.yml`). Desktop stays tag-only.
- A cross-repo `lightfastai/lightfast-desktop-releases` release host. Monorepo tags only.

## Implementation Approach

Strict phase order because of dependencies:

- **Phase A (setup)** must happen before D can be tested end-to-end. Runs in parallel with B/C/E/F code work.
- **Phase B** must land before D (D depends on Vite's DSN injection from B).
- **Phase C** adds the script that D calls.
- **Phases E and F** are independent — can land in either order relative to B–D.

### Prerequisites (outside this plan)

- `thoughts/shared/plans/2026-04-24-coderabbit-pr614-fixes.md` — resolve the port-collision and `will-navigate` guard items flagged against the loopback OAuth flow in PR #614 before Phase D's end-to-end validation. An unsigned release that crashes on a port conflict during sign-in will look worse than not releasing at all.

---

## Phase A: External Setup Checklist (human)

### Overview

No code. Provision the four external resources the workflow depends on, and commit secrets to GitHub. Skipping any item here will leave `desktop-release.yml` failing on the first run.

### Apple Developer (8 secrets)

1. Enroll in **Apple Developer Program** (~$99/yr) under the Lightfast business entity. Capture the 10-character **Team ID** once enrolled.
2. Generate a **Developer ID Application** certificate in developer.apple.com → Certificates. Download the `.cer`, add to Keychain Access on a Mac, export the matching identity as a password-protected `.p12`.
3. Generate an **App Store Connect API key** with "Developer" role (developer.apple.com → Users and Access → Keys). Download the `.p8` (one-time download). Capture the **Key ID** (10-char) and **Issuer ID** (UUID).
4. In repo settings → Secrets and variables → Actions, add these secrets:
   - `APPLE_SIGNING_IDENTITY` — full identity string, e.g. `Developer ID Application: Lightfast AI Inc (ABC1234567)`
   - `APPLE_TEAM_ID` — 10-char team id (e.g. `ABC1234567`)
   - `APPLE_CERT_BASE64` — output of `base64 < DeveloperID.p12 | pbcopy` (macOS) or `base64 -w0 DeveloperID.p12` (Linux)
   - `APPLE_CERT_PASSWORD` — the p12 password chosen at export
   - `APPLE_API_KEY_ID` — the 10-char key id from step 3
   - `APPLE_API_ISSUER` — the issuer UUID from step 3
   - `APPLE_API_KEY_CONTENT` — raw contents of the `.p8` file (including the `-----BEGIN PRIVATE KEY-----` header/footer)
   - `KEYCHAIN_PASSWORD` — any strong random string (e.g. `openssl rand -base64 24`); used only inside the CI keychain

### Sentry (2 secrets + 1 project)

1. In Sentry, create a new **Electron** project named `lightfast-desktop` under the existing Lightfast org. Capture the DSN.
2. Create a Sentry **organization auth token** with `project:releases` scope (Settings → Developer Settings → Auth Tokens).
3. Add these secrets to the repo:
   - `SENTRY_DSN` — the DSN from step 1 (public, but storing as a secret keeps it out of git)
   - `SENTRY_AUTH_TOKEN` — the auth token from step 2
4. Add these repo variables (Variables tab, not Secrets):
   - `SENTRY_ORG` — Sentry org slug (e.g. `lightfast`)
   - `SENTRY_PROJECT` — `lightfast-desktop`

### Success Criteria

Nothing to automate. Cross off the 11 items above; confirm by visiting `github.com/lightfastai/lightfast/settings/secrets/actions` and seeing all 8 Apple secrets + 2 Sentry secrets + 2 Sentry variables present.

**Stop here for human confirmation that Phase A is complete before starting Phase D validation.**

---

## Phase B: Env layer overhaul + forge config + sparkle cleanup

### Overview

Four cleanups, with the env layer as the load-bearing change:

1. **New t3-env-based env layer** at `apps/desktop/src/env/` — replaces the silent-fail `parseRuntimeEnv` in `src/shared/env.ts` with two `createEnv` calls (main, renderer). Matches the repo convention used by every other workspace.
2. **Sentry DSN baked via Vite `define` with a custom token** (`__SENTRY_DSN__`) — not via `process.env.SENTRY_DSN` replacement. Sentry's official Electron troubleshooting docs warn against replacing `process.*` keys in Vite `define` because it can break Sentry SDK internals. Custom token pattern avoids the conflict.
3. **Forge config simplification** — hardcode the release repo, remove the `LIGHTFAST_DESKTOP_RELEASE_REPO` indirection.
4. **Sparkle cleanup** — drop the unused `sparklePublicKey` field end-to-end.

**Spike verdict (CONFIRMED, 2026-04-24)**: `@t3-oss/env-core` (ESM-only) inlines cleanly into Forge's main-process CJS bundle at package time. `ssr.noExternal` is NOT needed — Forge's `@electron-forge/plugin-vite@7.11.1` bundles everything except electron + `node:*` builtins by default. Custom-token `define` works as expected. See Improvement Log.

**Why this matters now (not deferred)**: Today's `parseRuntimeEnv` silently returns `{}` on validation failure (`apps/desktop/src/shared/env.ts:26-31`). A packaged app with a missing/malformed env var boots with wrong defaults and Sentry silently doesn't initialize. This is the opposite of the "build-fail-fast" behavior that makes `apps/www/next.config.ts` safe. Shipping v0.1.0 with this behavior turns every future env-touching change into a landmine.

### Changes Required

#### 1. `apps/desktop/package.json` — add `@t3-oss/env-core`

**File**: `apps/desktop/package.json` (devDependencies, alphabetical insertion)
**Changes**: Add `"@t3-oss/env-core": "catalog:"` (already pinned to `^0.13.11` in `pnpm-workspace.yaml`). Run `pnpm install` at repo root to refresh `pnpm-lock.yaml`.

Rationale: every other workspace (`vendor/db`, `vendor/inngest`, `vendor/upstash`, `core/cli`, `db/app`, `packages/app-providers`) uses `@t3-oss/env-core` for non-Next.js contexts. Desktop is the only outlier with a hand-rolled schema. Adopting the catalog dep is one line.

#### 2. `apps/desktop/src/env/main.ts` (new file)

**File**: `apps/desktop/src/env/main.ts`
**Changes**: New file. Single source of truth for main-process env vars. Build-fail-fast via t3-env.

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Populated by Vite's `define` at package time (see vite.main.config.ts).
// `undefined` guard covers `pnpm dev` (define is still applied) and
// ad-hoc `node` invocations during tooling.
declare const __SENTRY_DSN__: string | undefined;

const buildFlavor = z.enum(["dev", "preview", "prod"]);

export const mainEnv = createEnv({
  server: {
    // Sentry (baked at build time via Vite define; optional in dev).
    SENTRY_DSN: z.string().url().optional(),
    // API origin. Main-process side (auth-flow loopback, CSP allowlist).
    LIGHTFAST_API_URL: z
      .string()
      .url()
      .default("http://localhost:3024"),
    // Clerk frontend API — used by index.ts to compute the CSP `connect-src`
    // host for the Clerk iframe. Required (sign-in breaks otherwise).
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    // Build-info overrides (used by build-info.ts).
    BUILD_FLAVOR: buildFlavor.optional(),
    SPARKLE_FEED_URL: z.string().url().optional(),
    SQUIRREL_FEED_URL: z.string().url().optional(),
    // Dev-only remote debugging.
    LIGHTFAST_REMOTE_DEBUG_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional(),
  },
  runtimeEnv: {
    SENTRY_DSN:
      typeof __SENTRY_DSN__ !== "undefined" && __SENTRY_DSN__ !== ""
        ? __SENTRY_DSN__
        : process.env.SENTRY_DSN,
    LIGHTFAST_API_URL: process.env.LIGHTFAST_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    BUILD_FLAVOR: process.env.BUILD_FLAVOR,
    SPARKLE_FEED_URL: process.env.SPARKLE_FEED_URL,
    SQUIRREL_FEED_URL: process.env.SQUIRREL_FEED_URL,
    LIGHTFAST_REMOTE_DEBUG_PORT: process.env.LIGHTFAST_REMOTE_DEBUG_PORT,
  },
  isServer: true,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

Notes:
- `isServer: true` is explicit because t3-env's default heuristic (`typeof window === "undefined"`) misfires in Electron's preload context (preload has `window` but is Node-side).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` keeps its Next.js-style name because that's what the rest of the monorepo sets (`apps/app`, `apps/www`); renaming would fragment the contributor mental model. It's server-only in the desktop schema because only main reads it (for CSP).
- `default()` on `LIGHTFAST_API_URL` collapses the duplicated `getApiOrigin()` helpers in `index.ts:45-51` and `auth-flow.ts:10-16` into a single validated value.

#### 3. `apps/desktop/src/env/renderer.ts` (new file)

**File**: `apps/desktop/src/env/renderer.ts`
**Changes**: New file. Renderer env validation with Vite's `VITE_*` prefix.

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const rendererEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_API_URL: z
      .string()
      .url()
      .default("http://localhost:3024"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
  skipValidation: !!import.meta.env.VITE_SKIP_ENV_VALIDATION,
});
```

Only `VITE_LIGHTFAST_API_URL` is validated because that's the only `import.meta.env` access in the renderer tree today (`entry.tsx:7`). Adding schema slots for vars nothing reads ("future-proofing") accumulates tech debt identical to what we're ripping out — add them in the PR that introduces the consumer.

#### 4. `apps/desktop/vite.main.config.ts`

**File**: `apps/desktop/vite.main.config.ts`
**Changes**: Add `define` with a **custom token** (not `process.env.SENTRY_DSN`). Per Sentry's official Electron troubleshooting: replacing `process.*` keys in Vite `define` can break the Sentry SDK's internal `process.env` references.

```ts
export default defineConfig({
  define: {
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ""),
  },
  // ...existing...
});
```

#### 5. `apps/desktop/src/main/sentry.ts`

**File**: `apps/desktop/src/main/sentry.ts`
**Changes**: Read DSN + build-flavor check via `mainEnv` instead of `getRuntimeEnv()`.

```ts
// Before (line 1):
import { getBuildInfo, getRuntimeEnv } from "./build-info";

// After:
import { mainEnv } from "../env/main";
import { getBuildInfo } from "./build-info";

export function getSentryInitOptions(): SentryInitOptions {
  const build = getBuildInfo();
  const dsn = mainEnv.SENTRY_DSN ?? "";
  return {
    dsn,
    release: `${build.name}@${build.version}+${build.buildNumber}`,
    environment: build.buildFlavor,
    enabled: Boolean(dsn) && build.buildFlavor !== "dev",
  };
}
```

#### 6. `apps/desktop/src/main/index.ts`

**File**: `apps/desktop/src/main/index.ts`
**Changes**:

**6a.** Import `mainEnv` at the top (module-level import triggers validation on app startup — fail-fast).

**6b.** Replace `getApiOriginForCsp()` (`index.ts:45-51`) with `mainEnv.LIGHTFAST_API_URL`.

**6c.** Replace `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`index.ts:55`) with `mainEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Remove the `?? ""` fallback — schema guarantees non-empty.

```ts
import { mainEnv } from "../env/main";

// Before:
function getApiOriginForCsp(): string {
  return (
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024")
  );
}

function getClerkFrontendApi(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  // ...decode logic...
}

// After:
function getApiOriginForCsp(): string {
  return mainEnv.LIGHTFAST_API_URL;
}

function getClerkFrontendApi(): string {
  const key = mainEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // ...decode logic...
}
```

#### 7. `apps/desktop/src/main/auth-flow.ts`

**File**: `apps/desktop/src/main/auth-flow.ts` (lines 10-16)
**Changes**: Delete the local `getApiOrigin()` duplicate. Replace usage with `mainEnv.LIGHTFAST_API_URL`.

```ts
// Before:
function getApiOrigin(): string {
  return (
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024")
  );
}

// After (delete helper, inline the reference):
import { mainEnv } from "../env/main";
// ...
const apiOrigin = mainEnv.LIGHTFAST_API_URL;
```

#### 8. `apps/desktop/src/main/bootstrap.ts`

**File**: `apps/desktop/src/main/bootstrap.ts` (line 14)
**Changes**: Replace `process.env.LIGHTFAST_REMOTE_DEBUG_PORT` with `mainEnv.LIGHTFAST_REMOTE_DEBUG_PORT`. Coercion + range validation moves into the schema (remove the inline zod parse at the call site).

#### 9. `apps/desktop/src/main/build-info.ts`

**File**: `apps/desktop/src/main/build-info.ts`
**Changes**: Replace the `parseRuntimeEnv(process.env)` call with `mainEnv` reads. Drop the `sparklePublicKey` line from the candidate object. Remove the `getRuntimeEnv()` export — no callers remain after steps 5, 6, 7, 8, 10.

```ts
// Before (line 33):
const runtime = parseRuntimeEnv(process.env);
// ...
const candidate = {
  name: packageJson.name,
  version: packageJson.version,
  buildFlavor: runtime.BUILD_FLAVOR ?? packageJson.buildFlavor,
  buildNumber: packageJson.buildNumber,
  sparkleFeedUrl: runtime.SPARKLE_FEED_URL ?? packageJson.sparkleFeedUrl,
  sparklePublicKey: packageJson.sparklePublicKey,
};

// After:
import { mainEnv } from "../env/main";
// ...
const candidate = {
  name: packageJson.name,
  version: packageJson.version,
  buildFlavor: mainEnv.BUILD_FLAVOR ?? packageJson.buildFlavor,
  buildNumber: packageJson.buildNumber,
  sparkleFeedUrl: mainEnv.SPARKLE_FEED_URL ?? packageJson.sparkleFeedUrl,
};
```

#### 10. `apps/desktop/src/main/updater.ts`

**File**: `apps/desktop/src/main/updater.ts` (lines 35, 39)
**Changes**: Replace `getRuntimeEnv()` reads with `mainEnv.SPARKLE_FEED_URL` / `mainEnv.SQUIRREL_FEED_URL`.

#### 11. `apps/desktop/src/renderer/src/react/entry.tsx`

**File**: `apps/desktop/src/renderer/src/react/entry.tsx` (line 7)
**Changes**: Replace raw `import.meta.env.VITE_LIGHTFAST_API_URL` with `rendererEnv.VITE_LIGHTFAST_API_URL`.

```ts
// Before:
const baseUrl =
  import.meta.env.VITE_LIGHTFAST_API_URL ?? "https://lightfast.ai";

// After:
import { rendererEnv } from "../../../env/renderer";
const baseUrl = rendererEnv.VITE_LIGHTFAST_API_URL;
```

Note: the `?? "https://lightfast.ai"` prod fallback is intentionally removed. The schema's `.default("http://localhost:3024")` covers local dev, and production builds must set `VITE_LIGHTFAST_API_URL` explicitly (CI workflow change in Phase D, step 2e).

#### 12. `apps/desktop/src/shared/env.ts` → delete and rehome `buildInfoSchema`

**File**: `apps/desktop/src/shared/env.ts`
**Changes**: Delete the file. Every import has moved to `src/env/main.ts` or `src/env/renderer.ts`. `buildInfoSchema` (still needed for the preload → renderer IPC boundary) moves to a new `src/shared/build-info-schema.ts` — same content minus `sparklePublicKey`. Update imports in `src/main/build-info.ts` and `src/shared/ipc.ts`.

Rationale: the hand-rolled `parseRuntimeEnv` with silent-fail behavior is exactly what the overhaul exists to kill. Keep `buildInfoSchema` (it's a data-contract type, not env validation) but rehome it so nothing imports from the deleted file.

#### 13. `apps/desktop/package.json` (custom fields)

**File**: `apps/desktop/package.json` (lines 60-64)
**Changes**: Remove `sparklePublicKey`. Keep `buildFlavor`, `buildNumber`, `sparkleFeedUrl`.

```json
// After:
"buildFlavor": "dev",
"buildNumber": "1",
"sparkleFeedUrl": ""
```

#### 14. `apps/desktop/src/shared/ipc.ts`

**File**: `apps/desktop/src/shared/ipc.ts` (lines 47-54)
**Changes**: Drop `sparklePublicKey` from `BuildInfoSnapshot`. Update the `buildInfoSchema` import to point at the rehomed file from step 12.

```ts
export interface BuildInfoSnapshot {
  buildFlavor: "dev" | "preview" | "prod";
  buildNumber: string;
  name: string;
  sparkleFeedUrl: string;
  version: string;
}
```

#### 15. `apps/desktop/forge.config.ts`

**File**: `apps/desktop/forge.config.ts` (lines 43-54)
**Changes**: Hardcode the release repo; remove the `LIGHTFAST_DESKTOP_RELEASE_REPO` indirection.

```ts
// After:
const githubPublisher = process.env.GITHUB_TOKEN
  ? new PublisherGithub({
      repository: { owner: "lightfastai", name: "lightfast" },
      draft: true,
      prerelease: process.env.LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true",
    })
  : null;
```

**Scope note (deliberate non-change)**: `forge.config.ts` stays on raw `process.env` for `APPLE_*` / `GITHUB_TOKEN` reads. Forge config loads before the app's env module is resolvable (Forge evaluates `forge.config.ts` in a plain Node context without Vite's `define`), and these vars are CI-only — validating them via t3-env would only fire on CI anyway, and CI failures already surface clearly. Not worth the bootstrap complication.

#### 16. `apps/desktop/README.md` (line 158)

**File**: `apps/desktop/README.md`
**Changes**: Remove the local dry-run example's reference to `LIGHTFAST_DESKTOP_RELEASE_REPO=lightfastai/lightfast`. Add a short "Environment" section pointing at `.env.example` (which Phase F creates) and explaining that missing required vars cause `pnpm dev`/`pnpm package` to fail with a readable t3-env error at startup.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/desktop typecheck` passes.
- [x] `rg -n "sparklePublicKey" apps/desktop` returns zero hits.
- [x] `rg -n "LIGHTFAST_DESKTOP_RELEASE_REPO" .` returns zero hits (only plan doc self-references).
- [x] `rg -n "parseRuntimeEnv|getRuntimeEnv|runtimeEnvSchema" apps/desktop/src` returns zero hits (helper, export, and schema all removed).
- [x] `rg -n "src/shared/env" apps/desktop/src` returns zero hits (old file deleted, all imports migrated).
- [x] `rg -n "process\\.env\\.(LIGHTFAST_API_URL|SENTRY_DSN|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY|BUILD_FLAVOR|SPARKLE_FEED_URL|SQUIRREL_FEED_URL|LIGHTFAST_REMOTE_DEBUG_PORT)" apps/desktop/src` returns hits ONLY inside `src/env/main.ts` (the validator is the single reader).
- [x] `rg -n "import\\.meta\\.env\\." apps/desktop/src/renderer` returns hits only inside `src/env/renderer.ts`.
- [x] After `pnpm --filter @lightfast/desktop package`, `rg "__SENTRY_DSN__" apps/desktop/.vite/build` returns zero hits (Vite has replaced all tokens with the JSON string).
- [x] After `SENTRY_DSN='https://fake@sentry.io/12345' pnpm --filter @lightfast/desktop package`, `rg "https://fake@sentry.io/12345" apps/desktop/.vite/build` returns ≥1 hit.
- [ ] With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset and `SKIP_ENV_VALIDATION` unset: `pnpm --filter @lightfast/desktop dev` exits with t3-env's readable `❌ Invalid environment variables` error — NOT a silent empty-object fallback.

#### Manual Verification

- [ ] `pnpm --filter @lightfast/desktop dev` with a populated `.env.development` boots; no Sentry init happens (dev flavor, DSN empty).
- [ ] With `SENTRY_DSN=<test-dsn>` and `BUILD_FLAVOR=preview` set before `pnpm package`, packaged app emits Sentry events on a forced throw — confirming the custom-token bake + runtime read both work.
- [ ] Delete `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from `.env.development`, run `pnpm dev:desktop`, confirm the error message names the missing variable (not a generic crash).

---

## Phase C: Sentry source-map upload script

### Overview

Add a `scripts/upload-sourcemaps.mjs` that wraps `@sentry/cli` and uploads both `.vite/build` (main + preload) and `.vite/renderer/main_window` (renderer) with `--url-prefix "app:///"` so uploaded maps align with the `rewriteFramesIntegration` prefix set in `sentry.ts:45`. Add `@sentry/cli` to desktop devDeps so the script can invoke it via `pnpm exec sentry-cli`.

### Changes Required

#### 1. `apps/desktop/package.json`

**File**: `apps/desktop/package.json` (devDependencies, alphabetical insertion)
**Changes**: Add `@sentry/cli` to devDependencies; add a `sourcemaps:upload` script.

```json
"scripts": {
  "dev": "electron-forge start",
  "package": "electron-forge package",
  "make": "electron-forge make",
  "publish": "electron-forge publish",
  "sourcemaps:upload": "node scripts/upload-sourcemaps.mjs",
  "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"
},
```

Add `"@sentry/cli": "^2.39.1"` to `devDependencies` (alphabetical slot between `@sentry/electron` and `@tanstack/query-core`). Then run `pnpm install` from repo root to refresh `pnpm-lock.yaml`.

#### 2. `apps/desktop/scripts/upload-sourcemaps.mjs` (new file)

**File**: `apps/desktop/scripts/upload-sourcemaps.mjs`
**Changes**: New file.

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const pkg = JSON.parse(
  readFileSync(resolve(desktopRoot, "package.json"), "utf8")
);

const required = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
}

const release = `${pkg.name}@${pkg.version}+${pkg.buildNumber}`;
const urlPrefix = "app:///";
const buildDir = resolve(desktopRoot, ".vite/build");
const rendererDir = resolve(desktopRoot, ".vite/renderer/main_window");

function sentry(args) {
  execFileSync("pnpm", ["exec", "sentry-cli", ...args], {
    cwd: desktopRoot,
    stdio: "inherit",
    env: process.env,
  });
}

sentry(["releases", "new", release]);
sentry([
  "releases",
  "files",
  release,
  "upload-sourcemaps",
  "--url-prefix",
  urlPrefix,
  "--ext",
  "js",
  "--ext",
  "map",
  buildDir,
]);
sentry([
  "releases",
  "files",
  release,
  "upload-sourcemaps",
  "--url-prefix",
  urlPrefix,
  "--ext",
  "js",
  "--ext",
  "map",
  rendererDir,
]);
sentry(["releases", "finalize", release]);

console.log(`Uploaded sourcemaps for release ${release}`);
```

Why two separate upload calls: `sentry-cli upload-sourcemaps` takes one path. Calling twice is cheaper than trying to symlink or merge the two output trees.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/desktop exec sentry-cli --version` prints a version.
- [x] `pnpm --filter @lightfast/desktop typecheck` still passes (no TS changes, but sanity).
- [x] `node apps/desktop/scripts/upload-sourcemaps.mjs` with all three env vars missing exits 1 with a clear message.

#### Manual Verification (requires Phase A Sentry secrets)

- [ ] In a scratch shell: `pnpm --filter @lightfast/desktop package` to populate `.vite/`, then `SENTRY_DSN=<dsn> SENTRY_ORG=<slug> SENTRY_PROJECT=lightfast-desktop SENTRY_AUTH_TOKEN=<token> pnpm --filter @lightfast/desktop sourcemaps:upload`.
- [ ] In Sentry UI → Releases → `@lightfast/desktop@0.0.0+1`, confirm source maps are listed under Artifacts and at least one path starts with `app:///`.

**Stop here for manual confirmation before Phase D.**

---

## Phase D: Enable + harden `desktop-release.yml`

### Overview

Rename the workflow off `.disabled`, switch the trigger to `@lightfast/desktop@*` tags, add `cancel-in-progress`, stamp `sentryDsn` at build time, call the Phase C upload script, create a Sentry release, add artifact attestation, and generate release notes from the tag's commit range instead of a static string.

### Changes Required

#### 1. Rename file

```
mv .github/workflows/desktop-release.yml.disabled \
   .github/workflows/desktop-release.yml
```

#### 2. `.github/workflows/desktop-release.yml` (post-rename edits)

**File**: `.github/workflows/desktop-release.yml`
**Changes**: Apply the following edits in the file described by the `.disabled` transcript.

**2a. Trigger + concurrency** (lines 3-9 of the existing file)

```yaml
on:
  push:
    tags:
      - '@lightfast/desktop@*'

concurrency:
  group: desktop-release-${{ github.ref }}
  cancel-in-progress: true
```

Change: `desktop-v*` → `'@lightfast/desktop@*'` (quotes mandatory due to `@`); `cancel-in-progress: true` added.

**2b. Prepare job version extraction** (lines 22-26)

```yaml
- name: Resolve version
  id: ver
  run: |
    tag="${{ github.ref_name }}"
    echo "tag=$tag" >> "$GITHUB_OUTPUT"
    echo "version=${tag#@lightfast/desktop@}" >> "$GITHUB_OUTPUT"
```

**2c. Prepare job release notes** (lines 28-40) — replace static notes with auto-generated body from commits since the previous desktop tag.

```yaml
- name: Create draft release if missing
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    if gh release view "${{ steps.ver.outputs.tag }}" --repo "${{ github.repository }}" >/dev/null 2>&1; then
      echo "Release already exists, reusing."
    else
      prev=$(git tag -l '@lightfast/desktop@*' --sort=-v:refname | grep -v "${{ steps.ver.outputs.tag }}" | head -n1 || true)
      notes_arg=(--generate-notes)
      if [ -n "$prev" ]; then
        notes_arg=(--generate-notes --notes-start-tag "$prev")
      fi
      gh release create "${{ steps.ver.outputs.tag }}" \
        --repo "${{ github.repository }}" \
        --draft \
        --title "Lightfast desktop v${{ steps.ver.outputs.version }}" \
        "${notes_arg[@]}"
    fi
```

Also add `actions/checkout@v4` with `fetch-depth: 0` to the prepare job (currently there's no checkout step; `git tag -l` needs the repo on disk).

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - name: Resolve version
    ...
```

**2d. Build job env** (lines 53-59) — add Sentry variables.

```yaml
env:
  LIGHTFAST_DESKTOP_RELEASE_REPO: ${{ github.repository }}  # remove this line
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
  APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
  SENTRY_ORG: ${{ vars.SENTRY_ORG }}
  SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

Remove `LIGHTFAST_DESKTOP_RELEASE_REPO` — Phase B hardcoded the publisher target.

**2e. Stamp job** (lines 76-82) — no `sentryDsn` line. Sentry DSN is injected by Vite at package time via the `SENTRY_DSN` env var on the build job (Phase B step 2). The stamp step keeps its existing three-field shape.

```yaml
- name: Stamp version + feed URL in package.json
  working-directory: apps/desktop
  run: |
    npm version "${{ needs.prepare.outputs.version }}" --no-git-tag-version --allow-same-version
    npm pkg set buildFlavor=prod
    npm pkg set buildNumber="$GITHUB_RUN_NUMBER"
    npm pkg set sparkleFeedUrl='https://github.com/${{ github.repository }}/releases/latest/download/latest-mac-${arch}.json'
```

`SENTRY_DSN` is already in the build job's `env:` block (step 2d), so it is in scope when `electron-forge package` invokes Vite later — no per-step plumbing needed.

**2f. After the forge publish step** (after line 111), add source-map upload + Sentry release.

```yaml
- name: Upload source maps to Sentry
  working-directory: apps/desktop
  run: pnpm sourcemaps:upload

- name: Attest build provenance
  uses: actions/attest-build-provenance@v2
  with:
    subject-path: 'apps/desktop/out/make/**/*.zip'
```

Attestation covers the zip output used by the updater feed. The `.dmg` is for human download and has its own notarization ticket from Apple.

**2g. Finalize job** — no changes needed; `generate-update-feed.mjs` already works with the release tag output.

#### 3. `apps/desktop/README.md`

**File**: `apps/desktop/README.md`
**Changes**: Add a "Cutting a release" section.

```markdown
## Cutting a release

1. Confirm `main` is green.
2. Tag and push:
   ```
   git tag '@lightfast/desktop@0.1.0'
   git push origin '@lightfast/desktop@0.1.0'
   ```
3. The `desktop-release.yml` workflow creates a draft release, builds arm64 + x64 on macOS, notarizes, uploads source maps to Sentry, generates Squirrel.Mac feed JSON, and publishes.
4. The draft is auto-undrafted by the `finalize` job once all assets are present.

Tag format is `@lightfast/desktop@<semver>` to match the repo's existing changesets-style convention (`lightfast@x.y.z`, `@lightfastai/mcp@x.y.z`).
```

### Success Criteria

#### Automated Verification

- [ ] `gh workflow view "Release desktop"` (after push to main) lists the workflow as enabled.
- [ ] `yamllint .github/workflows/desktop-release.yml` passes (or `gh workflow list` shows no parse errors).
- [ ] `.github/workflows/desktop-release.yml.disabled` no longer exists.

#### Manual Verification (requires Phase A + C complete)

- [ ] Cut a pre-release dry run: `git tag '@lightfast/desktop@0.1.0-rc.1' && git push origin '@lightfast/desktop@0.1.0-rc.1'`. Watch the run in GH Actions.
- [ ] Prepare job creates draft; confirm it has auto-generated notes.
- [ ] Build matrix completes for both arm64 and x64; each matrix leg produces `.zip` + `.dmg`.
- [ ] `codesign -v --verbose=4 <downloaded .app>` reports "satisfies its Designated Requirement" and `spctl -a -v <path>.dmg` passes.
- [ ] Sentry Releases shows `@lightfast/desktop@0.1.0-rc.1+<runNumber>` with source maps under Artifacts.
- [ ] `attestations` tab on the GitHub release shows a provenance attestation.
- [ ] Finalize job publishes `latest-mac-arm64.json` and `latest-mac-x64.json` and undrafts the release.
- [ ] Install the arm64 `.dmg`, run the app, trigger a known Sentry event, confirm the stack trace shows file/line from `apps/desktop/src/*.ts` — not minified.

**Stop here for manual confirmation before Phase E.**

---

## Phase E: Desktop CI coverage

### Overview

New standalone workflow `.github/workflows/desktop-ci.yml` triggered by native `on: push: paths:` filtering on desktop-touching paths. Runs typecheck + `electron-forge package` (unsigned) on `macos-14`. No `dorny/paths-filter` dependency — matches `verify-changeset.yml`'s native pattern. No `if:` guards on every step.

`ci.yml` is left untouched (`ci-success` does NOT depend on desktop-ci); the desktop job is a parallel required check, configured via branch protection rather than `needs:`.

### Changes Required

#### 1. `.github/workflows/desktop-ci.yml` (new file)

**File**: `.github/workflows/desktop-ci.yml`
**Changes**: New file. Triggers only on PRs/pushes that touch desktop-relevant paths.

```yaml
name: Desktop CI

on:
  pull_request:
    paths:
      - 'apps/desktop/**'
      - 'packages/app-trpc/**'
      - 'packages/ui/**'
      - 'packages/lib/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/desktop-ci.yml'
  push:
    branches: [main]
    paths:
      - 'apps/desktop/**'
      - 'packages/app-trpc/**'
      - 'packages/ui/**'
      - 'packages/lib/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/desktop-ci.yml'

concurrency:
  group: desktop-ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  package:
    name: Typecheck + package (unsigned)
    runs-on: macos-14
    timeout-minutes: 30
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm --filter @lightfast/desktop typecheck

      - name: Package (unsigned)
        run: pnpm --filter @lightfast/desktop package
```

**Why standalone workflow + native `paths:`** vs. adding a job to `ci.yml`: workflow-level `paths:` filtering means GitHub never schedules a runner when the trigger doesn't match — no wasted CI minutes, no `if:` guards on individual steps, no third-party action. Matches the existing `verify-changeset.yml:12-14` pattern (the only existing `paths:`-filtered workflow in the repo).

**Why `macos-14` + unsigned**: signing needs Apple secrets we cannot expose to PR forks. `electron-forge package` without sign/notarize still catches the 95% case — native module rebuild, forge config errors, Vite build failures, missing imports, broken IPC contracts.

**Workspace deps included** (`@repo/app-trpc`, `@repo/ui`, `@repo/lib`): the three desktop imports most likely to break the build. `@repo/ai` is renderer-side and not in the main bundle path — out of scope. `pnpm-lock.yaml` catches transitive dep bumps. Trade-off is explicit: this catches ~80% of dep-driven regressions without becoming a "rebuild on any package change" hammer.

#### 2. Branch protection (manual configuration)

Add `Desktop CI / Typecheck + package (unsigned)` as a required status check on `main` in repo settings → Branches → branch protection rules. Note that this check appears only on PRs that touch desktop paths; on PRs that don't, GitHub treats the absent check as "not required" (this is GitHub's documented behavior for `paths:`-filtered workflows).

#### 3. `.github/workflows/ci.yml` and `.github/workflows/ci-core.yml`

**Changes**: None. `ci-core.yml` scope ("things we publish to npm") stays unchanged. `ci.yml` continues to typecheck desktop via `pnpm turbo typecheck --affected --continue` (line 54) — that's a fast Linux job and complementary to the macOS package gate.

### Success Criteria

#### Automated Verification

- [ ] A PR touching only `apps/desktop/src/main/sentry.ts` triggers `Desktop CI` and skips it on PRs touching only `apps/www/**`.
- [ ] `gh workflow view "Desktop CI"` shows the workflow as enabled after the PR merges.
- [ ] The package job completes in < 20 minutes on `macos-14`.

#### Manual Verification

- [ ] Open a throwaway PR with a one-char change to `apps/desktop/src/main/index.ts`. Confirm `Desktop CI` runs and passes.
- [ ] Open a separate throwaway PR touching only `apps/www/page.tsx`. Confirm `Desktop CI` does NOT run (no wasted macOS minutes).
- [ ] Update branch protection to require `Desktop CI / Typecheck + package (unsigned)`. Confirm a desktop-touching PR cannot merge until the check is green.

---

## Phase F: Contributor ergonomics

### Overview

Small fixes that reduce friction for anyone touching desktop: a `.env.example`, a `clean` script, the `dev:desktop-stack` naming fix, and the changesets ignore entry for `@lightfast/desktop`.

**Not doing**: per-package `lint` script. Every other workspace in the monorepo is lint-covered by root `pnpm check` → `npx ultracite@latest check`, which walks the whole tree. Adding a `"lint": "biome check"` to `apps/desktop/package.json` would be the first per-package lint script in the repo — convention-breaking for no real benefit, and there's no `biome.json` for it to pick up anyway.

### Changes Required

#### 1. `apps/desktop/.env.example` (new file)

**File**: `apps/desktop/.env.example`
**Changes**: New file documenting the env surface. Mirrors the schema in `src/env/main.ts` and `src/env/renderer.ts`. Required vars are uncommented; optional vars are commented out with their defaults documented. Phase B's t3-env layer fails fast if a required var is missing — this file is the contract.

```
# ── Required (main process) ──────────────────────────────────────────────────
# Clerk publishable key. Used by the main process to decode the Clerk frontend
# API domain for the sign-in window CSP. Same value as the monorepo's
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/app and apps/www.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

# ── Optional (main process) ──────────────────────────────────────────────────
# Main-process API origin. Used by auth-flow.ts for the loopback OAuth callback
# base and by index.ts for the CSP connect-src allowlist.
# Default: http://localhost:3024
# LIGHTFAST_API_URL=http://localhost:3024

# Sentry DSN. Leave blank in dev (Sentry init is disabled when buildFlavor=dev).
# In CI/release builds, Vite bakes this into the main bundle at package time via
# the __SENTRY_DSN__ custom-token define (see vite.main.config.ts).
# SENTRY_DSN=

# Override Sparkle / Squirrel feed URLs. Leave blank in dev; CI stamps
# sparkleFeedUrl into package.json for release builds (desktop-release.yml).
# SPARKLE_FEED_URL=
# SQUIRREL_FEED_URL=

# Override buildFlavor ("dev" | "preview" | "prod") without rebuilding package.json.
# BUILD_FLAVOR=dev

# Dev-only: enable Chrome DevTools Protocol on the given port (1-65535).
# LIGHTFAST_REMOTE_DEBUG_PORT=9222

# ── Optional (renderer) ──────────────────────────────────────────────────────
# Renderer-process API origin. Vite only exposes VITE_*-prefixed vars to the
# renderer bundle. Mirror LIGHTFAST_API_URL for local dev.
# Default: http://localhost:3024
# VITE_LIGHTFAST_API_URL=http://localhost:3024

# ── Escape hatch ─────────────────────────────────────────────────────────────
# Skip t3-env validation entirely (emergency / scripting only).
# SKIP_ENV_VALIDATION=1
```

Note: `apps/desktop/.gitignore` currently ignores `.env`, `.env.development`, and `.env.production` but NOT `.env.example`. Running `git check-ignore apps/desktop/.env.example` should exit 1 (file not ignored). If it's ignored unexpectedly, add `!.env.example` to the desktop-local `.gitignore`.

Confirm the existing committed `apps/desktop/.env.development` (which contains only `VITE_LIGHTFAST_API_URL=http://localhost:3024`) stays committed — contributors can copy `.env.example` over it or merge missing fields. After Phase B lands, `.env.development` will need `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` added or `pnpm dev:desktop` will fail fast (by design).

#### 2. `apps/desktop/package.json` scripts

**File**: `apps/desktop/package.json:7-13`
**Changes**: Add `clean` and `sourcemaps:upload`. Do NOT add `lint`/`lint:fix` — root `pnpm check` covers desktop.

```json
"scripts": {
  "clean": "rm -rf out .vite .cache",
  "dev": "electron-forge start",
  "package": "electron-forge package",
  "make": "electron-forge make",
  "publish": "electron-forge publish",
  "sourcemaps:upload": "node scripts/upload-sourcemaps.mjs",
  "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"
},
```

#### 3. Root `package.json:22-23`

**File**: `package.json` (root)
**Changes**: Fix the misleading `dev:desktop-stack` naming.

```json
// Before:
"dev:desktop": "pnpm --filter @lightfast/desktop dev",
"dev:desktop-stack": "concurrently --names app,proxy --prefix-colors cyan,magenta 'pnpm dev:full' 'pnpm --filter @lightfast/app proxy:wait'",

// After (rename `dev:desktop-stack` → `dev:desktop-api` which is what it actually does):
"dev:desktop": "pnpm --filter @lightfast/desktop dev",
"dev:desktop-api": "concurrently --names app,proxy --prefix-colors cyan,magenta 'pnpm dev:full' 'pnpm --filter @lightfast/app proxy:wait'",
```

Rationale: the script starts the API-side stack that desktop *talks to*; it does not start desktop itself. `dev:desktop-api` makes intent explicit.

#### 4. `.changeset/config.json`

**File**: `.changeset/config.json`
**Changes**: Add `@lightfast/desktop` to `ignore` (currently `[]`). Use a targeted edit — do not wholesale-rewrite the file, since other fields like `$schema` and `fixed` must stay exactly as-is.

```json
"ignore": ["@lightfast/desktop"]
```

Effect: `pnpm changeset` won't prompt for desktop; desktop changes never need a changeset. `verify-changeset.yml:51` allowlist stays untouched — it still rejects desktop-mentioning changesets, which is correct because we've committed to tag-only releases.

### Success Criteria

#### Automated Verification

- [ ] `pnpm check` passes (root ultracite run covers desktop files).
- [ ] `pnpm --filter @lightfast/desktop clean && pnpm --filter @lightfast/desktop typecheck` passes.
- [ ] `git check-ignore apps/desktop/.env.example` returns exit 1 (not ignored).

#### Manual Verification

- [ ] `pnpm changeset` (in interactive mode) does not list `@lightfast/desktop` as a selectable package.
- [ ] `pnpm dev:desktop-api` starts the API + proxy stack; `pnpm dev:desktop-stack` no longer exists (errors out cleanly).
- [ ] A fresh contributor running `cp apps/desktop/.env.example apps/desktop/.env.development` + populating `VITE_CLERK_PUBLISHABLE_KEY` can run `pnpm dev:desktop` and sign in.

---

## Testing Strategy

### Typecheck + lint gate

Every phase ends with `pnpm --filter @lightfast/desktop typecheck` green. Phase F adds `pnpm --filter @lightfast/desktop lint` to the gate.

### End-to-end release dry run

After Phase D lands and Phase A secrets are provisioned:

1. Tag `@lightfast/desktop@0.1.0-rc.1`.
2. Watch the workflow run green end-to-end.
3. Install the arm64 `.dmg` on a personal Mac, sign in, exercise primary + secondary + hud windows.
4. Trigger a known error (temporary `throw` in `src/main/index.ts` on a dev tag), confirm Sentry stack trace is symbolicated.
5. Publish a second release `@lightfast/desktop@0.1.0-rc.2` with a no-op change; confirm auto-updater picks it up on the running `rc.1` install within 10 seconds of launch.
6. Revert the `throw` and delete the pre-release tags.

### CI gate regression

Open a throwaway PR with a forced break in `apps/desktop/src/main/index.ts` (e.g. `const x: number = "string"`). Confirm the new `desktop` job fails loudly and blocks merge. Revert before merging.

## Performance Considerations

- `desktop-ci.yml` adds ~15 min of `macos-14` runtime on desktop-touching PRs only (native `paths:` filter means GitHub doesn't schedule a runner otherwise). Public repo → free CI minutes, so cost is not a factor; on paid plans, `macos-14` minutes cost ~10× Linux, but the job fires only on relevant PRs. Acceptable.
- Source-map upload adds ~30s to each release arch leg. Acceptable.
- Sentry release creation is a single API call, negligible.

## Migration Notes

- Pre-release installs of the unsigned dev build (`pnpm package` output) won't auto-update. Not a concern — nobody is running the dev `.app` outside local testing.
- `LIGHTFAST_DESKTOP_RELEASE_REPO` env var is gone after Phase B. If anyone has it in a local `.env.development`, remove it. No on-disk state affected.

## References

- Research: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` (follow-up §FU-3, §FU-4 particularly)
- Prior plan (phases 1–4 landed): `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md`
- `apps/desktop/forge.config.ts:43-54` — `LIGHTFAST_DESKTOP_RELEASE_REPO` indirection (removed in Phase B)
- `apps/desktop/src/main/sentry.ts:14-55` — already wired, Phase B adjusts DSN source
- `apps/desktop/package.json:60-64` — placeholder fields (Phase B)
- `.github/workflows/desktop-release.yml.disabled` — existing transcript (Phase D)
- `.github/workflows/ci.yml:50-54` — `--affected` typecheck gate (Phase E)
- `.github/workflows/ci-core.yml:45,105` — npm-only scope (Phase E non-change)
- `.github/workflows/verify-changeset.yml:51` — changeset allowlist (Phase F non-change, intentionally)
- `.changeset/config.json:10` — `ignore` array (Phase F)
- `pnpm-workspace.yaml:82` — `@sentry/cli` in `onlyBuiltDependencies` (Phase C)
- `package.json:22-23` (root) — `dev:desktop-stack` rename (Phase F)

## Improvement Log

### 2026-04-24 — Adversarial review (`/improve_plan`)

Four decisions changed after reviewing the plan against the actual codebase. Plan file edited in-place; this log captures what moved and why.

**1. Sentry DSN no longer flows through `build-info` / `BuildInfoSnapshot`.** Earlier draft of this plan threaded a new `sentryDsn` field through `package.json` → `env.ts` schema → `build-info.ts` → `ipc.ts` IPC contract → `sentry.ts`, and stamped it via `npm pkg set sentryDsn="$SENTRY_DSN"` in CI. Replaced with a single Vite `define` in `vite.main.config.ts` + a one-line change in `sentry.ts` that reads `process.env.SENTRY_DSN` directly. Vite's syntactic replacement bakes the literal DSN into `.vite/build/index-<hash>.js` at package time.
   - **Spike verdict: CONFIRMED** (worktree `agent-a9a9641300bfb70b8`). Baseline build with no env var produced `const dsn = "";` in the bundle. Build with `SENTRY_DSN='https://fake@sentry.io/12345' pnpm package` produced `const dsn = "https://fake@sentry.io/12345";`. `rg "process.env.SENTRY_DSN" apps/desktop/.vite/build/*.js` returned 0 hits in both builds. Typecheck passed on first try.
   - **Net change**: 2 files touched instead of 6; no schema churn; no secret value mutated into `package.json`; no per-step CI plumbing beyond adding `SENTRY_DSN` to the build-job `env:` block (which Phase A secrets work already required).
   - Phase D stamp step correspondingly drops the `npm pkg set sentryDsn` line.

**2. Desktop CI is a standalone workflow, not a `dorny/paths-filter` job bolted onto `ci.yml`.** The repo has zero prior uses of `dorny/paths-filter`; `verify-changeset.yml:12-14` already uses native workflow-level `on: push: paths:`. Phase E now creates `.github/workflows/desktop-ci.yml` with native path filtering — no `if:` guards on every step, no new third-party action. The dep list also expanded from `packages/app-trpc/**` alone to include `packages/ui/**`, `packages/lib/**`, `pnpm-workspace.yaml`, and the workflow file itself.

**3. No per-package `lint` script for desktop.** Phase F originally added `"lint": "biome check"` + `"lint:fix"` to `apps/desktop/package.json`. Zero workspace packages in the monorepo define their own lint script today — the convention is root `pnpm check` → `npx ultracite@latest check`, which walks the whole tree. Also, no `biome.json` exists for a per-package `biome check` to pick up. Both scripts removed; Phase F now only adds `clean` and `sourcemaps:upload`.

**4. `.env.example` now documents both `LIGHTFAST_API_URL` and `VITE_LIGHTFAST_API_URL`.** The earlier version only listed the unprefixed main-process variable, but Vite exposes only `VITE_*`-prefixed vars to the renderer. Both are required for the renderer-side tRPC client to hit localhost in dev. Also fixed `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → `VITE_CLERK_PUBLISHABLE_KEY` (the desktop renderer is not Next.js).

### Additional small fixes from the review

- Phase B now includes a README update to delete the `LIGHTFAST_DESKTOP_RELEASE_REPO=lightfastai/lightfast` reference at `apps/desktop/README.md:158`, which would otherwise go stale the day Phase B lands.
- Added prerequisites callout for `2026-04-24-coderabbit-pr614-fixes.md` — the port-collision and `will-navigate` fixes on the loopback OAuth flow need to be in before Phase D's end-to-end validation, otherwise a signed release could crash during sign-in.
- Performance Considerations section clarified that `macos-14` minutes cost ~10× Linux on paid plans; acceptable here because the workflow only fires on desktop-touching paths and the repo is public (free minutes).

---

### 2026-04-24 — Second adversarial review (env layer overhaul)

User flagged that the Sentry-DSN-only fix in the first review was a half-measure and asked for a proper env layer inspired by `apps/www/src/env.ts`. Phase B rewritten substantially. The earlier Sentry-DSN spike still holds (DSN does bake via Vite `define`), but the mechanism and surface changed.

**1. Replaced hand-rolled `parseRuntimeEnv` with t3-env.** Every other workspace in the monorepo uses `@t3-oss/env-core` (non-Next.js) or `@t3-oss/env-nextjs` — desktop was the only outlier with a hand-rolled zod validator. The old `parseRuntimeEnv` silently returned `{}` on validation failure (`apps/desktop/src/shared/env.ts:26-31`), the exact opposite of the "build-fail-fast" behavior that makes `apps/www/next.config.ts` safe. Phase B now introduces `apps/desktop/src/env/main.ts` (main + preload, `isServer: true`) and `apps/desktop/src/env/renderer.ts` (`VITE_*` prefix, `runtimeEnv: import.meta.env`). The old `src/shared/env.ts` is deleted; `buildInfoSchema` (a data contract, not env validation) is rehomed to `src/shared/build-info-schema.ts`.
   - **Spike verdict: CONFIRMED** (worktree `agent-ad5ab5b18d79dea9e`, 2026-04-24). Added `@t3-oss/env-core: catalog:` to desktop, created `src/env/main.ts`, imported it from `src/main/index.ts`, ran Vite main build. `@electron-forge/plugin-vite@7.11.1` bundles everything except electron + `node:*` builtins — t3-env's ESM source is inlined directly into the CJS `bootstrap.js` at build time. No `require("@t3-oss/env-core")` call survives, so no `ERR_REQUIRE_ESM` risk at runtime in the packaged `.app`. `ssr.noExternal` is NOT needed (contra web research on `electron-vite`, which does need it — Electron Forge's Vite plugin has different defaults).
   - **Key finding**: the plan does NOT need a Vite `ssr.noExternal` config addition. If a future Forge version changes bundling behavior, adding `ssr: { noExternal: ['@t3-oss/env-core'] }` to `vite.main.config.ts` is a one-line fallback.

**2. Sentry DSN bake switched from `process.env.SENTRY_DSN` replacement to a `__SENTRY_DSN__` custom token.** Sentry's official Electron troubleshooting docs explicitly warn: *"Vite recommends using `define` for CONSTANTS only, and not putting `process` or `global` into the options"* — string-replacing `process.*` keys can break Sentry SDK internals. The first-review spike validated only that the literal got baked, not that Sentry runtime behavior survived the replacement. Phase B now uses the Sentry-docs-recommended pattern: `define: { __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? "") }` paired with `declare const __SENTRY_DSN__: string | undefined;` in `src/env/main.ts`, read via `runtimeEnv` with a `process.env.SENTRY_DSN` fallback for dev.

**3. Expanded the env layer from Sentry-only to the full desktop main-process surface.** The previous Phase B left 4 other env reads on the same fragile pattern (`LIGHTFAST_API_URL` duplicated in `index.ts:45-51` + `auth-flow.ts:10-16`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with `?? ""` silent fallback, `LIGHTFAST_REMOTE_DEBUG_PORT`, `BUILD_FLAVOR`/`SPARKLE_FEED_URL`/`SQUIRREL_FEED_URL` behind the silent-fail zod wrapper). All now live in `src/env/main.ts` as validated `mainEnv.*` reads. The two duplicated `getApiOrigin()` helpers collapse into a single `mainEnv.LIGHTFAST_API_URL` with a `.default("http://localhost:3024")`.

**4. Renderer env layer (minimal).** `rendererEnv` validates only `VITE_LIGHTFAST_API_URL` — the single `import.meta.env` access in the renderer tree today (`entry.tsx:7`). Schema slots for future vars (e.g. `VITE_CLERK_PUBLISHABLE_KEY`) are added in the PRs that introduce the consumers, not pre-emptively in this plan.

**5. `forge.config.ts` stays on raw `process.env` for CI secrets.** Deliberate non-change: Forge evaluates its config in a plain Node context without Vite's `define`, so the mainEnv module isn't resolvable at that layer. `APPLE_*` / `GITHUB_TOKEN` are CI-only and GitHub Actions failures already surface clearly. Not worth the bootstrap complication.

**6. `.env.example` rewritten** to match the new schema. Required: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (missing → t3-env crashes on startup with a readable error). Everything else is optional with documented defaults. Removed the earlier draft's `VITE_CLERK_PUBLISHABLE_KEY` slot — it's a renderer var nothing reads yet, and adding unused schema entries is exactly the tech debt this overhaul exists to kill.

**Success criteria tightened**: new automated checks ensure `parseRuntimeEnv`/`getRuntimeEnv`/`runtimeEnvSchema` identifiers return zero hits post-migration, that raw `process.env.*` for migrated keys only appears in `src/env/main.ts`, and that missing required vars produce t3-env's readable error (not a silent fallback).

**Research trail**: no canonical Electron + t3-env example exists in public code — the pattern here is assembled from t3-env's docs, Sentry's Electron troubleshooting, and direct verification via the CONFIRMED spike. Desktop becomes the monorepo's reference implementation for non-Next.js t3-env in a three-bundle environment.
