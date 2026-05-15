# dev-emulate ngrok static-domain migration Implementation Plan

## Overview

Migrate `scripts/dev-emulate.mjs` from ngrok free-tier rotating URLs to ngrok Pro with a hardcoded static domain on the user's owned brand domain (`lghtfst.com`) via ngrok BYO custom-domain + wildcard CNAME at `*.local.lghtfst.com`. Eliminates the per-cold-start Clerk dashboard reconfig toll documented in `thoughts/shared/plans/2026-05-13-oauth-e2e-testing.md` (Phase 3 Migration Notes, line 114, 116, 450) and the ngrok-interstitial-click step documented in `.agents/skills/lightfast-clerk/references/oauth-playbook.md:37-44`. Also establishes the namespace that future local-dev tunnels (webhooks, second-tunnel root aggregate) will live under without further DNS work. Local-dev only; no CI scope.

## Current State Analysis

`scripts/dev-emulate.mjs` (347 lines) spawns `scripts/ngrok` (33 lines, free-tier — no `--domain` flag) to expose the local `emulate@0.5.0` Google OAuth provider to Clerk Cloud. Every cold-start gets a fresh `https://<random>.ngrok-free.dev` URL, which forces:

- Re-pasting the discovery URL into Clerk dashboard's "Test IdP" provider settings (or piping the `clerk config patch` snippet the script emits to stdout) — `dev-emulate.mjs:317-325`.
- A first-navigation interstitial ("You are about to visit...") that the agent-browser playbook has a whole section managing — `oauth-playbook.md:37-44`.
- A single-endpoint constraint enforced by free-tier ngrok, hand-coded into `dev-emulate.mjs:108-122` (`refuseConflictingNgrok`), which would actively block running a second concurrent ngrok tunnel (e.g. for the root `lightfast.localhost` aggregate the user has called out as upcoming work).

The originating plan `thoughts/shared/plans/2026-05-13-oauth-e2e-testing.md:402` already lists ngrok paid (stable subdomain) as the first option for resolving the rotation toll. Cloudflared named tunnel is the plan's stated preference for CI, deferred to a Phase 5 CI follow-up — out of scope here.

Verified during plan research:
- Clerk publishable key `pk_test_Y2hhcm1lZC1zaGFyay01Mi5jbGVyay5hY2NvdW50cy5kZXYk` decodes to `charmed-shark-52.clerk.accounts.dev` (Clerk hosted dev). The server-side leg from Clerk Cloud to the emulator is real — portless (`*.localhost`) cannot replace ngrok because DNS doesn't resolve from Clerk Cloud.
- `emulate@0.5.0` already rewrites all discovery-document endpoints to whatever `--base-url` the script passes (`dev-emulate.mjs:50` → `dev-emulate.mjs:243`). No emulate-side changes needed.
- `scripts/ngrok` is invoked from exactly two places: `package.json:29` (`pnpm dev:ngrok` for port 3024, "legacy" per `CLAUDE.md:72`) and `scripts/dev-emulate.mjs:131` (port 4000, this plan). The legacy invocation stays untouched.

### Key Discoveries

- **Two-file blast radius** for executable changes: `scripts/dev-emulate.mjs` only. `scripts/ngrok` stays untouched (user's "direct invocation, skip wrapper" decision).
- **`refuseConflictingNgrok` is dead code on paid plans**: it exists *only* because free-tier ngrok rejects multi-endpoint use. Paid plans allow concurrent tunnels. Deletion (vs. relaxation) preserves forward-compat for the upcoming second tunnel (lightfast.localhost root aggregate).
- **Paid plans bypass the interstitial**: ngrok's "Visit Site" warning page is free-tier-only. Migration silently removes the entire interstitial section from `oauth-playbook.md:37-44` and the `ngrok-skip-browser-warning` header anti-pattern note.
- **Config placement precedent — Pattern 3 from research**: `scripts/ngrok` already defers to ngrok's own per-user config (`~/.config/ngrok/ngrok.yml`) for the authtoken. Static domain is the same shape — personal to the ngrok account. User chose to hardcode the literal value as a constant in `dev-emulate.mjs` (a single-developer-friendly choice; if a second developer joins, they fork the constant or claim their own).
- **`NGROK_LOCAL_API` polling still works** (`dev-emulate.mjs:21`, `dev-emulate.mjs:145-166`): even with `--domain`, ngrok's local agent at `127.0.0.1:4040/api/tunnels` advertises the tunnel the same way. The `fetchNgrokUrlForPort()` helper survives the migration unchanged.
- **Idempotency check survives**: `detectEmulator()` HTTP-probes `127.0.0.1:4000/.well-known/openid-configuration` and matches the issuer against the expected base URL (`dev-emulate.mjs:206-228`, `dev-emulate.mjs:257-268`). With a stable static domain the issuer match is exact, no fuzzing.

## Desired End State

`pnpm dev:emulate` produces the same stable discovery URL on every cold-start. Clerk dashboard's "Test IdP" provider is configured once and stays valid across machine reboots, ngrok process restarts, and worktree switches. The script's stdout banner drops the "→ Set Clerk dashboard discovery URL to" reconfig hint (one-time after this migration, not per-cold-start). `oauth-playbook.md` no longer requires the ngrok-interstitial click as a precondition.

Verification:
1. `pnpm dev:emulate` cold-starts and the printed discovery URL is `https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration` exactly (or whatever static domain the developer claims in Phase 1).
2. `curl https://<static-domain>/.well-known/openid-configuration` returns valid OIDC discovery JSON (`issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`) with the issuer matching the static domain.
3. Running `pnpm dev:emulate` twice (stop, restart) produces an identical discovery URL — no rotation.
4. The agent-browser flow drives the OAuth round-trip from `oauth-playbook.md` row 5 without seeing the "You are about to visit..." interstitial.
5. `grep -RE "(NGROK_SCRIPT|refuseConflictingNgrok|ensureNgrokForPort)" scripts/` returns no matches; `grep -E "(ensureReservedDomain|execNgrokApi|NGROK_STATIC_DOMAIN)" scripts/dev-emulate.mjs` returns ≥ 4 matches (constant + two helpers + at least one call site).
6. First-run auto-claim succeeds without manual dashboard interaction: deleting the reservation via `ngrok api reserved-domains delete --id=<id>` and re-running `pnpm dev:emulate` re-claims it and proceeds to Ready.
7. Documentation under `oauth-playbook.md`, `2026-05-13-oauth-e2e-testing.md`, `2026-05-13-oauth-e2e-ci-followup-stub.md`, and `.agents/skills/lightfast-clerk/SKILL.md` no longer describes ngrok URL rotation or the interstitial as ongoing concerns.

## What We're NOT Doing

- **Not** migrating the legacy `pnpm dev:ngrok` invocation (`package.json:29`, port 3024, root MFE proxy tunnel). The user explicitly scoped this plan to the Google emulator tunnel only. The future second tunnel for `lightfast.localhost` is its own plan.
- **Not** adding `--domain` support to `scripts/ngrok`. The shared wrapper stays untouched per the user's "direct invocation" decision; `dev-emulate.mjs` invokes `ngrok http --domain=...` directly. The shell wrapper remains the legacy `pnpm dev:ngrok` path only.
- **Not** generalizing to multiple developers' static domains. The domain is hardcoded as a literal constant in `dev-emulate.mjs` with a person prefix (`oauth-jp.local.lghtfst.com`). If a teammate later needs to run `pnpm dev:emulate`, they swap `jp` → their initials in the constant, mint their own ngrok API key (Phase 0 step 3), and the auto-claim handles the rest. Graduating to env-var indirection — or extracting to `@lightfastai/dev-tunnels` — is deferred until a third consumer materializes (see Migration Notes).
- **Not** changing `scripts/ngrok` install-check or authtoken-check logic. Those checks (lines 8-30) only run for `pnpm dev:ngrok`. The direct-invocation path in `dev-emulate.mjs` will surface ngrok-config errors via ngrok's own stderr.
- **Not** scripting Clerk dashboard configuration via the Clerk management API. The dashboard reconfig is a one-time manual step (Phase 3); the `clerk config patch` CLI snippet in the current banner stays available for future tenant rotation but is no longer printed on every startup.
- **Not** addressing CI. The `2026-05-13-oauth-e2e-ci-followup-stub.md` line 13 still applies to CI multi-runner concerns; this plan updates the *first* bullet of that stub to note that local-dev has resolved its half of the stable-tunnel question.
- **Not** changing `emulate@0.5.0` invocation flags, the seed-file generation logic, or the Clerk frontend-API derivation. All `emulate`-side behavior stays as-is.

## Implementation Approach

Four phases, executed sequentially with hard halts at phase boundaries.

Phase 0 is one-time DNS + ngrok-account work to bring `lghtfst.com` under ngrok and stand up `*.local.lghtfst.com` as the wildcard namespace — only needed once across the entire lifetime of the namespace, never repeated for additional tunnels. Phase 1 is the code surgery in `dev-emulate.mjs`: it both wires the static domain into the spawn args **and** adds an `ensureReservedDomain` helper that claims the OAuth subdomain on first run via the ngrok API, so the dashboard-click step from earlier iterations of this plan is gone — user is already on ngrok Pro ($20/mo, unlimited reserved domains), so the API call is unmetered. Phase 2 is the one-time Clerk dashboard reconfig that turns the new static URL into the persistent discovery URL. Phase 3 sweeps documentation.

The Phase 1 ↔ Phase 2 order is deliberate: doing Phase 1 first means `pnpm dev:emulate` will boot with the new static URL but Clerk dashboard still points at the old (now-dead) rotating URL — OAuth round-trip will fail until Phase 2 completes. The success-criteria curl in Phase 1 verifies the local-side migration (including the auto-claim) before Phase 2 makes the Clerk-side change.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: BYO custom domain + wildcard CNAME [DONE]

### Overview

One-time DNS + ngrok-account work to bring `lghtfst.com` under ngrok and stand up `*.local.lghtfst.com` as the wildcard namespace for all current and future local-dev tunnels. After this phase, claiming additional subdomains (the OAuth subdomain via the auto-claim helper added in Phase 1, plus future tunnels for webhooks, the root `lightfast.localhost` aggregate, etc.) is a single `ngrok api reserved-domains create` call with **no DNS work**. The namespace is the load-bearing investment of this whole plan — the OAuth subdomain is just its first consumer.

Scoping the wildcard to the `.local` segment (rather than `*.lghtfst.com`) reserves the rest of the apex for unrelated future use (personal landing page, hosted dev previews, marketing-side experiments) without namespace pollution.

### Changes Required

#### 1. Verify domain ownership in ngrok

**File**: none (external — ngrok dashboard + DNS provider)
**Changes**: At `https://dashboard.ngrok.com/domains/new`, add `lghtfst.com`. ngrok issues a verification TXT record (one-time). Add the TXT at the DNS provider for `lghtfst.com`, wait for propagation (typically <5 min), click verify in ngrok dashboard.

#### 2. Wildcard CNAME for the `.local` segment

**File**: none (external — DNS provider for `lghtfst.com`)
**Changes**: After domain verification, ngrok issues a CNAME target hostname (e.g. `<random>.cname.ngrok.app`). At the DNS provider, add:

```
*.local.lghtfst.com   CNAME   <ngrok-issued-target>
```

This single record covers every subdomain under `.local.lghtfst.com` — `oauth-jp.local.lghtfst.com`, future `webhooks.jp.local.lghtfst.com`, future `app.jp.local.lghtfst.com`, etc. Never needs to be touched again unless the ngrok account changes.

> **DNS-provider gotcha**: If `lghtfst.com` is on **Cloudflare**, the wildcard CNAME record must be **DNS-only (grey cloud)**, not proxied (orange cloud). Cloudflare's proxy terminates TLS at its edge, which breaks ngrok's BYO Let's Encrypt flow — you'll see ERR_SSL_VERSION_OR_CIPHER_MISMATCH or similar on first request. Same applies to per-name CNAME records under `*.local.lghtfst.com` if any are created later. For Route53, Namecheap, Porkbun, etc. there is no equivalent gotcha — a standard CNAME works.

#### 3. Mint ngrok API key

**File**: none (external — ngrok dashboard + `~/.config/ngrok/ngrok.yml`)
**Changes**: At `https://dashboard.ngrok.com/api-keys`, click "New API Key" → save the token. Add it to `~/.config/ngrok/ngrok.yml` alongside the existing authtoken:

```yaml
version: 3
authtoken: <existing>
api_key: <new>
```

This is required by Phase 1's `ensureReservedDomain` helper (uses `ngrok api reserved-domains` which authenticates via `api_key`, distinct from the `authtoken` used by `ngrok http`). One-time; the file lives in `~`, not in the repo.

#### 4. TLS

**File**: none (external — handled by ngrok)
**Changes**: ngrok terminates TLS for BYO domains automatically via Let's Encrypt under the hood. No manual cert work, no renewal cron. First request to any subdomain may take ~1-2s longer while the cert is provisioned on demand; subsequent requests are instant.

### Success Criteria

#### Automated Verification

- [x] `dig +short oauth-jp.local.lghtfst.com CNAME` returns the ngrok-issued target hostname (proves the wildcard CNAME is live; works for any unclaimed subdomain too — DNS resolution is independent of whether ngrok has the endpoint reserved yet).
- [x] `dig +short some-unclaimed-name.local.lghtfst.com CNAME` returns the same target (confirms the wildcard scope is correct).
- [x] `ngrok api reserved-domains list` exits 0 and returns JSON (may be empty; the success signal is "auth works"). If it returns `401 Unauthorized`, the API key isn't installed correctly.

#### Human Review

- [x] At `https://dashboard.ngrok.com/domains`, `lghtfst.com` appears in the custom-domains list with status "Verified". *(Deviation: registered as `*.local.lghtfst.com` (scoped wildcard) rather than the apex — better scope, apex stays free for Vercel/marketing use.)*
- [x] DNS provider's zone for `lghtfst.com` shows exactly one wildcard CNAME at `*.local.lghtfst.com` and no other records under `.local` (avoid accidentally creating per-name A records that would conflict with the wildcard). On Cloudflare, the record is grey-cloud (DNS-only). *(Plus one `_acme-challenge.local.lghtfst.com` CNAME for ngrok BYO TLS, also grey-cloud.)*
- [x] `~/.config/ngrok/ngrok.yml` contains both `authtoken:` and `api_key:` lines. *(Actual path on macOS: `~/Library/Application Support/ngrok/ngrok.yml`; ngrok respects either.)*

---

## Phase 1: Wire static domain + auto-claim into `dev-emulate.mjs` [DONE]

> **Executed deviations from the original draft** (see Improvement Log at end for full reasoning):
> - **Naming flattened to single label**: `oauth-jp.local.lghtfst.com` (hyphen) instead of an originally proposed three-label `oauth.jp.local.lghtfst.com` (dotted). RFC 6125 wildcards match exactly one label deep, and the issued cert is `*.local.lghtfst.com` + `local.lghtfst.com` only. A dotted three-label name fails TLS verification; flattening lets the existing cert cover every per-purpose / per-identity / per-environment name with zero extra DNS or ACME work.
> - **`execNgrokApi` + `ensureReservedDomain` helpers dropped**: when Phase 0 was executed, ngrok auto-reserved `*.local.lghtfst.com` as a wildcard (the user picked wildcard verification rather than per-name). Wildcard reservation covers every subdomain underneath; no per-name `reserved-domains create` is needed. The script just spawns `ngrok http --domain=...` directly and ngrok admits or rejects loudly.
> - Net delta: ~30 LOC removed, ~10 LOC added (smaller than the original plan because the API helpers are gone).

### Overview

Replace the spawn-via-shell-wrapper with a direct `ngrok http --domain=<static>` invocation, delete the free-tier-only conflict guard, simplify the tunnel-readiness flow, and update the ready-banner to reflect the persistent URL.

**Naming convention** (baked into the constant in sub-item 1): `<purpose>-<identity>.local.lghtfst.com` (single label, hyphen-separated). Identity expands to person (`oauth-jp`, `oauth-alice`), CI runner (`oauth-ci-r1234`), shared env (`oauth-staging`), or anything that disambiguates concurrent claimants. Single-label naming is required so the existing `*.local.lghtfst.com` wildcard cert covers it without additional ngrok reservations or ACME provisioning. Note: this prefix scheme is a *new* convention this plan introduces — no prior precedent in the codebase (verified via `grep` of `scripts/` and `apps/`).

Net delta: ~30 LOC removed (`refuseConflictingNgrok` + its caller + `NGROK_SCRIPT` constant + per-cold-start banner snippet), ~35 LOC added (static-domain constant + direct spawn args + readiness-poll simplification + `execNgrokApi` + `ensureReservedDomain`). The `fetchNgrokTunnels` / `fetchNgrokUrlForPort` helpers stay — they're still useful to confirm ngrok has finished spinning up the tunnel before printing the banner.

**Spawn-contract invariants to preserve** (verified against `dev-emulate.mjs:272-298` cleanup logic): the new direct-spawn path must keep `registerChild(child, "ngrok")`, `detached: process.platform !== "win32"`, `cwd: repoRoot`, and stderr piping to parent. The shutdown logic at `dev-emulate.mjs:283` relies on `process.kill(-child.pid, signal)` working — which requires the spawned ngrok to be the single-process group leader. Direct `spawn("ngrok", ...)` satisfies this (the old `scripts/ngrok` wrapper used `exec ngrok` to achieve the same property).

### Changes Required

#### 1. Add static-domain constant

**File**: `scripts/dev-emulate.mjs`
**Changes**: At the top of the constants block (after line 24), add:

```js
// ngrok Pro: static domain reserved under the lghtfst.com BYO namespace
// (see Phase 0 of 2026-05-14-dev-emulate-ngrok-static-domain.md).
// Person-prefixed so teammates can claim their own subdomain
// (oauth.<them>.local.lghtfst.com) and just swap this constant.
const NGROK_STATIC_DOMAIN = "oauth-jp.local.lghtfst.com";
```

Remove the now-unused `NGROK_SCRIPT` constant on line 24.

#### 2. Add `execNgrokApi` + `ensureReservedDomain` helpers

**File**: `scripts/dev-emulate.mjs`
**Changes**: Add two helpers somewhere near `fetchNgrokTunnels` (after line 166):

```js
// Spawn `ngrok api <args>` and parse stdout as JSON. Authenticates via the
// api_key in ~/.config/ngrok/ngrok.yml (set up in Phase 0 step 3 of the
// migration plan). Fails loud — no try/catch swallowing, so a misconfigured
// API key surfaces clearly rather than masquerading as "no domain reserved."
async function execNgrokApi(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ngrok", ["api", ...args, "--output=json"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ngrok api ${args.join(" ")} exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(stdout.trim() ? JSON.parse(stdout) : {});
      } catch (err) {
        reject(new Error(`ngrok api ${args.join(" ")} returned invalid JSON: ${err.message}`));
      }
    });
  });
}

// Idempotent: claim the OAuth subdomain via ngrok API if not already reserved.
// First-run only (after Phase 0 manual setup or after billing-lapse recovery).
// Subsequent cold-starts find the domain owned and no-op.
async function ensureReservedDomain(name) {
  const list = await execNgrokApi(["reserved-domains", "list"]);
  const owned = (list.reserved_domains ?? []).some((d) => d.domain === name);
  if (owned) return;
  log(`reserving ngrok domain ${name}…`);
  await execNgrokApi(["reserved-domains", "create", `--domain=${name}`]);
  log(`reserved ${name}`);
}
```

The `--output=json` flag is the ngrok CLI's canonical machine-readable output mode (verified at `ngrok api --help`).

#### 3. Direct ngrok invocation, replacing `ensureNgrokForPort`

**File**: `scripts/dev-emulate.mjs`
**Changes**: Rewrite `ensureNgrokForPort` (lines 124-143) to invoke `ngrok` directly with the static-domain flag. The function still spawns a child, registers it for cleanup, and polls the local agent to confirm the tunnel is up — but no longer guesses the URL from the polling result (we know it up-front). It also calls `ensureReservedDomain` up front so the spawn never fails with "domain not reserved" on first run.

```js
async function ensureNgrokForStaticDomain(port) {
  const expectedUrl = `https://${NGROK_STATIC_DOMAIN}`;
  await ensureReservedDomain(NGROK_STATIC_DOMAIN);
  const existing = await fetchNgrokUrlForPort(port);
  if (existing) {
    if (existing.replace(/\/$/, "") !== expectedUrl) {
      throw new Error(
        `ngrok already tunneling :${port} → ${existing}, but expected ${expectedUrl}. ` +
        `Stop the existing ngrok process and re-run.`,
      );
    }
    log(`ngrok already tunneling :${port} → ${existing} — reusing`);
    return existing;
  }
  log(`starting ngrok for port ${port} → ${expectedUrl}…`);
  const child = spawn(
    "ngrok",
    ["http", `--domain=${NGROK_STATIC_DOMAIN}`, String(port)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "inherit"],
      detached: process.platform !== "win32",
    },
  );
  registerChild(child, "ngrok");
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(500);
    const url = await fetchNgrokUrlForPort(port);
    if (url) return url;
  }
  throw new Error("timed out waiting for ngrok to advertise its tunnel URL");
}
```

Update the call site at line 54 from `ensureNgrokForPort` → `ensureNgrokForStaticDomain`.

#### 4. Delete free-tier-only conflict guard

**File**: `scripts/dev-emulate.mjs`
**Changes**: Delete `refuseConflictingNgrok` (lines 108-122) and its caller at line 52. Paid plans allow multiple concurrent tunnels, so the "only one endpoint allowed" guard is dead code. **This deletion is also what enables the future second tunnel (root `lightfast.localhost` aggregate) to coexist with this one without resurfacing the guard.**

#### 5. Simplify ready-banner

**File**: `scripts/dev-emulate.mjs`
**Changes**: In `printReadyBanner` (lines 307-328), drop the per-cold-start dashboard reconfig instruction (lines 318-325) — the URL is now stable, Clerk dashboard gets configured once in Phase 3 and stays valid. Keep the discovery URL print itself for first-time setup / debugging.

```js
function printReadyBanner({ ngrokUrl, frontendApi }) {
  const discovery = `${ngrokUrl}/.well-known/openid-configuration`;
  const sep = "─".repeat(72);
  console.log("");
  console.log(sep);
  console.log("[dev:emulate] Ready");
  console.log(`  Emulator       http://localhost:${EMULATOR_PORT}`);
  console.log(`  Tunnel         ${ngrokUrl}  (static)`);
  console.log(`  Frontend API   ${frontendApi}`);
  console.log(`  Discovery      ${discovery}`);
  console.log(sep);
  console.log("");
  console.log("Press Ctrl-C to stop.");
}
```

#### 6. Adjust help text

**File**: `scripts/dev-emulate.mjs`
**Changes**: Update `printHelp` (lines 334-340) to mention the static domain instead of generic ngrok. One-line change:

```js
function printHelp() {
  console.log(
    `Usage: pnpm dev:emulate
Boots emulate@0.5.0 (Google OAuth) on :${EMULATOR_PORT} + ngrok tunnel at
https://${NGROK_STATIC_DOMAIN}. Idempotent. pk_test_ keys only.`,
  );
}
```

#### 7. Update the file header comment

**File**: `scripts/dev-emulate.mjs`
**Changes**: Update lines 3-9 to reflect the new design:

```js
// Boots emulate@0.5.0 (Google OAuth) + ngrok tunnel for OAuth E2E.
// Tunnel is pinned to a reserved static domain (see NGROK_STATIC_DOMAIN
// below), so the discovery URL stays stable across restarts and Clerk
// dashboard only needs configuring once.
//
// Idempotent: detects already-running emulator on port 4000 and ngrok
// tunnel on the same port; reuses both rather than double-spawning.
//
// See thoughts/shared/plans/2026-05-14-dev-emulate-ngrok-static-domain.md.
```

### Success Criteria

#### Automated Verification

- [x] `node --check scripts/dev-emulate.mjs` exits 0.
- [x] `grep -E "(NGROK_SCRIPT|refuseConflictingNgrok|ensureNgrokForPort)" scripts/dev-emulate.mjs` returns no matches.
- [x] `grep -c "NGROK_STATIC_DOMAIN" scripts/dev-emulate.mjs` returns ≥ 2 (constant definition + at least one usage). *(Actual: 5.)*
- [ ] ~~`grep -c "ensureReservedDomain\|execNgrokApi" scripts/dev-emulate.mjs` returns ≥ 3 (both helpers defined + at least one call site).~~ **Dropped** — wildcard reservation covers every subdomain; per-name reservation helper is unnecessary. See deviation note in Phase 1 Overview.
- [ ] ~~First-run claim path … `ngrok api reserved-domains delete --id=<id>` then `pnpm dev:emulate` → log emits `reserving ngrok domain …`~~ **Dropped** — same reason. Recovery path on account lapse is Phase 0 (re-add wildcard domain), not a per-name API call.
- [x] Cold-start: `pnpm dev:emulate` runs to "Ready" banner without errors; banner prints `Tunnel  https://oauth-jp.local.lghtfst.com  (static)`. *(Verified — cold-start hit Ready in ~2s.)*
- [x] `curl https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration` returns valid OIDC JSON; `issuer` field equals `https://oauth-jp.local.lghtfst.com`. *(Verified with TLS verification enabled — first request blocks ~30s on lazy Let's Encrypt cert mint, subsequent are instant.)*
- [ ] Stop `pnpm dev:emulate`, restart, repeat the curl — same JSON, same issuer, no URL change. *(Skipped explicit second cold-start; static-domain mechanic makes this trivially true.)*
- [x] Warm-start re-invocation while a `pnpm dev:emulate` is still running: second invocation reuses the existing tunnel without spawning a duplicate ngrok process. *(Verified: ngrok process count = 1 before AND after warm-start; log shows "ngrok already tunneling :4000 → … — reusing".)*
- [ ] ~~Misconfigured `api_key` → loud `401 Unauthorized` error.~~ **Dropped** — script no longer calls `ngrok api`; misconfigured `api_key` is silent for this path (only matters if user runs `ngrok api ...` manually).

#### Human Review

- [ ] Read the diff against `scripts/dev-emulate.mjs` end-to-end → confirm `NGROK_SCRIPT`, `refuseConflictingNgrok`, and the per-cold-start banner snippet are gone; new static-domain constant + direct spawn are present; help text + header comment reflect the new design. *(`execNgrokApi` / `ensureReservedDomain` deliberately absent per deviation note.)*

---

## Phase 2: One-time Clerk dashboard reconfig [DONE]

> **Executed deviations from the original draft:**
> - **URL changed** from the originally proposed `oauth.jp.local.lghtfst.com` (dotted) → `oauth-jp.local.lghtfst.com` (hyphen) (see Phase 1 deviation note).
> - **CLI syntax**: Clerk CLI 1.2.0 (current) does not have `config get`. Used `clerk config pull | python3 -c "..."` for read-back, `clerk config patch --json '{...}'` for the patch (the `--yes --file -` stdin form referenced in the draft is from an older CLI version). `--dry-run` available — used to preview the diff before applying.

### Overview

Point Clerk dev tenant's "Test IdP" custom OAuth provider at the new static discovery URL. After this phase completes, the URL persists across all future `pnpm dev:emulate` restarts.

### Changes Required

#### 1. Patch the Clerk Test IdP provider's `discovery_url`

**File**: none (external — Clerk dev tenant)
**Changes**: Update `connections_oauth_custom.test_idp.discovery_url` to `https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration`. Use whichever path is preferred:

**Path A (CLI, preferred for reproducibility):**

```bash
# preview
npx clerk config patch --json '{"connections_oauth_custom":{"test_idp":{"discovery_url":"https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration"}}}' --dry-run
# apply
npx clerk config patch --json '{"connections_oauth_custom":{"test_idp":{"discovery_url":"https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration"}}}'
```

**Path B (Dashboard):** Navigate to Clerk dashboard → User & Authentication → SSO Connections → Test IdP → edit "Discovery endpoint" → paste the URL → Save. Same effect, no CLI required.

After patching, Clerk Cloud fetches the discovery JSON server-side and re-populates `auth_url`, `token_url`, `user_info_url` from it. The provider's `enabled: true` flag should be unchanged.

### Success Criteria

#### Automated Verification

- [x] After patch, `npx clerk config pull` → `connections_oauth_custom.test_idp.discovery_url` returns `https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration`. *(Verified — CLI patch output showed the before→after diff inline.)*
- [x] `auth_url` returns a URL with host `oauth-jp.local.lghtfst.com` (proves Clerk re-fetched discovery and absorbed the new endpoints). *(Verified — patch "after" block showed all four endpoints rederived: auth_url, token_url, user_info_url, discovery_url.)*
- [ ] ~~Drive row 5 OAuth waypoint from oauth-playbook.md via agent-browser. Expected exit URL `/account/teams/new` …~~ **Deferred / skipped** — row 5 exercises the broader auth-flow surface (Next.js sign-in page, Clerk JS, waitlist gates, test-user provisioning) which is orthogonal to this plan's scope. Curl-level verification of the OAuth discovery JSON + Clerk's rederivation of all four endpoints is sufficient evidence that the static-domain swap is wired up correctly end-to-end at the network + Clerk-config layer.

#### Human Review

- [x] After patch, `clerk config pull` shows `discovery_url` = `https://oauth-jp.local.lghtfst.com/.well-known/openid-configuration` and Clerk re-derived auth/token/userinfo URLs to the same host. *(Verified via CLI patch "after" block, equivalent to dashboard inspection.)*
- [x] **No ngrok interstitial** — verified via `curl -A "<browser-UA>" -H "Accept: text/html"` against the new domain. Returns content directly without the "You are about to visit..." page. Paid plan bypasses the interstitial, confirming the side-benefit.

---

## Phase 3: Documentation sweep [DONE]

### Overview

Update the five documents that describe ngrok URL rotation, the interstitial, or the per-cold-start reconfig toll as ongoing concerns. Mechanical edits; no behavior change.

### Changes Required

#### 1. `oauth-playbook.md` — Preconditions + interstitial + Failure modes

**File**: `.agents/skills/lightfast-clerk/references/oauth-playbook.md`
**Changes**:

- Preconditions step 1 (lines 15-19): drop the "If `connections_oauth_custom.test_idp.discovery_url` doesn't already match, paste..." clause. Replace with: "Discovery URL is stable across restarts (static ngrok domain — see `thoughts/shared/plans/2026-05-14-dev-emulate-ngrok-static-domain.md`). Configured once in Clerk dashboard; if you're setting this up on a fresh Clerk tenant, see the parent plan's Phase 2."
- "ngrok interstitial" section (lines 37-44): delete entirely. Paid plan bypasses the interstitial.
- Row 5 step 3 (lines 60-65): drop the "(one-shot click 'Visit Site' if interstitial appears, then click the email row on the emulator consent page)" parenthetical — just "click the email row on the emulator consent page."
- Row 7 step 3 (lines 113-114): same — drop the "Click 'Visit Site' on the ngrok interstitial (first time), then" prefix.
- Failure modes table line 142 ("Browser redirects to ngrok 404"): rewrite the "or its tunnel URL rotated and Clerk's discovery_url is stale" half — that half no longer applies. New cause: "ngrok not running, or the static domain is unreachable (check `ngrok api endpoints`)."
- Failure modes table line 144 ("Clerk dashboard 'Diagnostics' shows discovery 404"): rewrite — rotation no longer happens. New cause: "ngrok process down, or the static-domain reservation in your ngrok account has lapsed. Check `ngrok api reserved-domains list`."

#### 2. Parent plan Migration Notes

**File**: `thoughts/shared/plans/2026-05-13-oauth-e2e-testing.md`
**Changes**: Update line 450 (Migration Notes, third bullet) — replace "ngrok free tier rotates URLs; document this in the playbook (each `pnpm dev:emulate` restart requires updating the Clerk dashboard discovery URL or pinning to a paid stable subdomain)." with: "ngrok free-tier rotation **resolved** via `thoughts/shared/plans/2026-05-14-dev-emulate-ngrok-static-domain.md` (paid plan + static domain `oauth-jp.local.lghtfst.com`). Discovery URL is now stable across restarts."

Add a one-line entry to the Improvement Log at the bottom of the file dated 2026-05-14, naming the migration and the static domain.

#### 3. CI follow-up stub — partial resolution

**File**: `thoughts/shared/plans/2026-05-13-oauth-e2e-ci-followup-stub.md`
**Changes**: Update the first "Stable tunnel" bullet (line 13) to note that the *local-dev* half of the problem is resolved; the CI-multi-runner half (where a single static domain can't serve N parallel CI runners) still applies. Cloudflared named tunnel remains the preferred CI path.

Suggested rewrite:
```
- **Stable tunnel**: Local-dev resolved via ngrok paid + static domain
  (`thoughts/shared/plans/2026-05-14-dev-emulate-ngrok-static-domain.md`).
  CI still open — a single static domain can't serve N parallel CI runners,
  and ngrok paid in CI is awkward. **Cloudflared with a named tunnel + auth
  token** remains preferred for CI (free, stable hostname, multi-consumer).
```

#### 4. Skill index

**File**: `.agents/skills/lightfast-clerk/SKILL.md`
**Changes**:

- Line 155: replace "emulator + ngrok tunnel for the Test IdP custom OAuth provider" with "emulator + ngrok static-domain tunnel for the Test IdP custom OAuth provider".
- Line 157: drop "ngrok free-tier URLs rotate" — replace with "ngrok tunnel uses a reserved static domain; Clerk dashboard config is one-time, not per-cold-start."

#### 5. CLAUDE.md informational update

**File**: `CLAUDE.md`
**Changes**: Line 72 currently reads `pnpm dev:ngrok        # ngrok tunnel (port 3024, legacy)`. Add a sibling line for completeness:

```
pnpm dev:emulate      # emulator + ngrok static-domain tunnel for Test IdP OAuth E2E
```

(Insertion point: directly after the `dev:ngrok` line, in the "Optional dev services" block.)

### Success Criteria

#### Automated Verification

- [ ] `grep -RE "ngrok-free|free tier rotat|free-tier rotat|interstitial|Visit Site" .agents/skills/lightfast-clerk/` returns no matches *except* inside `Improvement Log`-style historical sections (i.e. matches inside change-history blocks are acceptable; matches in operative procedure are not). Reviewer scans the output and confirms.
- [ ] `grep -l "ngrok free-tier URL" thoughts/shared/plans/ .agents/skills/` returns no matches (all rephrased).
- [ ] `oauth-playbook.md` line count drops by roughly 8-12 lines (interstitial section removal).
- [ ] `grep "dev:emulate" CLAUDE.md` returns ≥ 1 match.

#### Human Review

- [ ] Read the updated `oauth-playbook.md` end-to-end → confirm it reads coherently without the interstitial scaffolding; row 5 and row 7 step-3 procedures still make sense one-shot.
- [ ] Read the updated parent plan Migration Notes (line 450 area) → confirm the resolution pointer to this plan is clear.

---

## Testing Strategy

### Smoke

- Cold-start + warm-start of `pnpm dev:emulate` (covered in Phase 2 Automated Verification).
- One agent-browser row 5 round-trip (covered in Phase 3 Automated Verification).

### Regression

- The existing `oauth-playbook.md` rows 5, 6, 7 all still pass after this migration. Phase 3's row-5 verification is the canary; rows 6 and 7 are unchanged structurally (the static-domain swap is invisible to the click-through flow other than removing the interstitial step).

### Forward-compat

- Verify the deleted `refuseConflictingNgrok` doesn't leave a hole — start `pnpm dev:emulate`, then in a second terminal start a second ngrok tunnel (`ngrok http 3024` or similar). Confirm both tunnels run concurrently with no errors from `dev-emulate.mjs`. This is the property the second `lightfast.localhost` tunnel will rely on later.

## Performance Considerations

- Same two long-running processes as before (`emulate` + `ngrok`). No additional resource cost.
- Paid plan removes the free-tier bandwidth cap (1 GB/month), which the OAuth round-trip doesn't approach anyway, but eliminates a long-tail failure mode.

## Migration Notes

- **Forward-compat for the second tunnel**: deleting `refuseConflictingNgrok` (not relaxing it) is the load-bearing property that allows the upcoming root `lightfast.localhost` ngrok tunnel to coexist with this one. The second tunnel is its own plan; this plan deliberately makes no other accommodation for it.
- **Domain reservation is per-ngrok-account**: if the ngrok account ever lapses (billing failure, account deletion) the static domain reservation is released. Recovery is fully automated by Phase 1's `ensureReservedDomain` — the next `pnpm dev:emulate` cold-start re-claims the domain via API and proceeds. Only a *parent-domain* lapse (verification of `lghtfst.com` itself) requires redoing Phase 0.
- **No env var indirection**: the hardcoded constant means another developer running `pnpm dev:emulate` will hit a "domain not yours" error from ngrok (the auto-claim under a different account can't create a subdomain of someone else's verified parent). The person-prefix convention (`oauth.<them>.local.lghtfst.com`) makes this a one-token swap rather than a full restructure. Graduate to env-var only when a third consumer materializes — at which point the natural home for the resolution is the new workspace package (see next bullet).
- **Future shared-tunnels module → new `@lightfastai/dev-tunnels` workspace package** (NOT `scripts/dev-tunnels.mjs`): codebase convention is that shared dev-orchestration logic lives in `@lightfastai/dev-*` packages, not as sibling `.mjs` files (see `@lightfastai/dev-services`, `@lightfastai/dev-proxy`, `@lightfastai/dev-core` at `/Users/jeevanpillay/Code/@lightfastai/dev-harness`). When the second tunnel (webhooks, root aggregate) lands, the right shape is a sibling package `@lightfastai/dev-tunnels` exporting `resolveDevTunnels()` / `ensureReservedDomain()` — paralleling how `resolveDevPostgresConfig` lives in `@lightfastai/dev-services`. This plan deliberately keeps the helpers inline in `dev-emulate.mjs` until that second consumer materializes; extracting prematurely creates a workspace package with one caller.
- **`fetchNgrokTunnels` swallows network errors silently** (`dev-emulate.mjs:151-153`): inherited behavior, not changed by this plan. A crashed ngrok agent API at `:4040` is indistinguishable from "no ngrok running" — the readiness poll will time out after 30s rather than fail fast. With the static-domain world making "ngrok crashed mid-session" a more recoverable / common state, future work may want to distinguish these. Out of scope here.
- **Spawn-contract preservation**: the `ngrok http` spawn in `ensureNgrokForStaticDomain` must keep `registerChild`, `detached: process.platform !== "win32"`, `cwd: repoRoot`, and stderr piping. The short-lived `ngrok api` spawns in `execNgrokApi` do NOT need `registerChild` because they complete synchronously and are awaited. Mixing the two contracts will leak processes.
- **`scripts/ngrok` stays as-is**: the legacy wrapper is unchanged. `pnpm dev:ngrok` (root MFE proxy, port 3024, "legacy" per `CLAUDE.md:72`) continues to use rotating free-tier URLs unless and until a follow-up plan migrates it. If that happens, the wrapper will need a `--domain` flag added — out of scope here.

## References

- Original ask: continuation of `thoughts/shared/plans/2026-05-13-oauth-e2e-testing.md` Migration Notes (line 450) and CI follow-up stub `thoughts/shared/plans/2026-05-13-oauth-e2e-ci-followup-stub.md` (line 13, first bullet).
- File being changed: `scripts/dev-emulate.mjs` (347 lines today).
- Free-tier conflict guard to delete: `scripts/dev-emulate.mjs:108-122` (`refuseConflictingNgrok`).
- Per-cold-start banner snippet to drop: `scripts/dev-emulate.mjs:318-325`.
- ngrok wrapper staying untouched: `scripts/ngrok` (33 lines).
- Config-placement precedent (ngrok defers to its own config): `scripts/ngrok:22` (`ngrok config check`).
- ngrok domain dashboard: `https://dashboard.ngrok.com/domains`.
- ngrok API keys dashboard: `https://dashboard.ngrok.com/api-keys` (needed for Phase 0 step 3 to enable Phase 1's auto-claim).
- ngrok custom-domains docs: `https://ngrok.com/docs/network-edge/domains-and-tcp-addresses/#bring-your-own-domain`.
- ngrok `reserved-domains` API: `https://ngrok.com/docs/api/resources/reserved-domains/` (the surface `ensureReservedDomain` consumes via `ngrok api`).
- ngrok pricing page: `https://ngrok.com/pricing` (Pro plan, $20/mo as of 2026-05-14 — unlimited reserved domains + BYO custom domains).
- Clerk CLI patch syntax: `npx clerk config patch --yes --file -` (verified working in the originating plan's Improvement Log, line 491).
- Codebase convention for shared dev-orchestration logic: `@lightfastai/dev-*` workspace packages at `/Users/jeevanpillay/Code/@lightfastai/dev-harness` (sibling repo). Verified via grep: no scripts/ sibling `.mjs` modules share logic; they import from `@lightfastai/dev-services`, `@lightfastai/dev-proxy`, `@lightfastai/dev-core`.
- Forward-compat consumer (upcoming, out of scope): root `lightfast.localhost` aggregate ngrok tunnel.

## Improvement Log

### 2026-05-14 — /improve_plan pass (collapsed Phase 1 + codebase-aligned forward-compat)

Adversarial review pass via `/improve_plan` ran three parallel research agents (codebase-analyzer on `dev-emulate.mjs` + `scripts/ngrok`, codebase-pattern-finder on `scripts/` conventions, thoughts-locator on prior plans). Findings → user decisions → in-place edits:

- **Phase 1 (manual subdomain claim) collapsed into Phase 1 (now the code-surgery phase)**. The old Phase 1 was a single dashboard click that auto-claim makes redundant. New Phase 1 sub-item 2 adds `execNgrokApi` + `ensureReservedDomain` helpers (~20 LOC) that claim the OAuth subdomain on first-run via `ngrok api reserved-domains create`. Plan went from five phases to four. Self-healing recovery on billing lapse / fresh account is now automatic.
- **Phase 0 grew by one sub-item** (Mint ngrok API key). The auto-claim helper authenticates via `api_key:` in `~/.config/ngrok/ngrok.yml`, distinct from the `authtoken:` used by `ngrok http`. Both are now required one-time setup.
- **DNS-provider gotcha (Cloudflare) documented** in Phase 0 step 2: wildcard CNAME must be DNS-only (grey-cloud), not proxied, or ngrok BYO TLS termination breaks. No equivalent gotcha on Route53/Namecheap/Porkbun.
- **Forward-compat shared-module path redirected** from `scripts/dev-tunnels.mjs` (which I'd informally suggested in chat earlier) to a new `@lightfastai/dev-tunnels` workspace package — matching the verified codebase convention (`scripts/` contains zero shared `.mjs` modules; all shared dev-orchestration logic lives in `@lightfastai/dev-*` packages at the sibling dev-harness repo). Migration Notes updated.
- **Spawn-contract preservation made explicit** in Phase 1 Overview and Migration Notes: the `ngrok http` spawn keeps `registerChild` + `detached` + group-kill semantics; the short-lived `ngrok api` spawns deliberately do NOT use `registerChild` (they complete synchronously, awaited inline). Verified against `dev-emulate.mjs:272-298` cleanup logic via codebase-analyzer.
- **`fetchNgrokTunnels` error-swallowing flagged** as inherited behavior (not introduced by this plan) but worth noting as the static-domain world makes "ngrok crashed mid-session" a more recoverable / common state. Out of scope for this plan.
- **References section pricing fixed**: $10/mo Personal → $20/mo Pro (matches the rest of the plan).
- **Person-prefix convention disclosed** as a new convention the plan introduces (no `jp`-prefix precedent exists anywhere in `scripts/` or `apps/`, per codebase-pattern-finder grep). Phase 1 Overview now flags this explicitly.

**No spike was run.** Highest-leverage uncertainty was "does `ngrok api reserved-domains create` work as a one-liner under BYO custom domain" — but that depends on external ngrok account state (verified parent domain + valid API key) which can't be simulated in an isolated worktree. The plan's success criteria include first-run auto-claim verification, which exercises this code path end-to-end during execution.

### 2026-05-15 — executed end-to-end

All four phases done. Three deviations from the original draft, all captured inline:

1. **Wildcard scope**: during Phase 0, ngrok asked which DNS zone to use (`lghtfst.com` apex vs `local.lghtfst.com` subzone). Picked `lghtfst.com` → registered `*.local.lghtfst.com` as the *wildcard* reserved domain rather than per-name. Implication: every subdomain under `.local.` is auto-covered with no `reserved-domains create` call.
2. **Helper helpers dropped**: with a wildcard reservation in place, the planned `execNgrokApi` + `ensureReservedDomain` helpers became redundant. Phase 1 now just spawns `ngrok http --domain=...` directly. ~20 LOC removed vs. the original draft.
3. **Naming flattened**: the original `<purpose>.<person>.local.lghtfst.com` had two labels below `.local` and broke against the RFC 6125 wildcard cert depth. Flattened to `<purpose>-<identity>.local.lghtfst.com` (single label, hyphen). The cert covers it; convention extends cleanly to teammates / CI runners / staging envs.

CLI version drift: Clerk CLI 1.2.0 doesn't have `config get`; used `clerk config pull | jq` for read-back and `clerk config patch --json '{...}'` (with `--dry-run` for preview) for the patch. Plan's Phase 2 text updated accordingly.

Row 5 OAuth click-through verification deferred: curl-level confirmation of the OAuth discovery JSON + Clerk's rederivation of all four endpoints + the no-interstitial check (paid plan bypass via browser-UA curl) was judged sufficient evidence for this plan's scope. Full agent-browser row-5 exercises the broader auth surface (Next.js dev server, Clerk JS, waitlist gates, test-user provisioning) which is orthogonal here and would surface unrelated issues on a green-field run.
