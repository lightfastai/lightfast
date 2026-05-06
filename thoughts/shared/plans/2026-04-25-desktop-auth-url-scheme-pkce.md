---
date: 2026-04-25
owner: jp@jeevanpillay.com
branch: fix/coderabbit-pr614-followup
based_on: thoughts/shared/research/2026-04-25-desktop-signin-agent-browser-workaround.md
status: implemented + live-verified end-to-end
---

# Desktop Sign-In: Custom URL Scheme + PKCE Implementation Plan

## Implementation Status (2026-04-25)

All five phases implemented. Automated + live verification:

- Phase 1 — server endpoints + tests: `pnpm typecheck` ✓, 13 new unit tests ✓. **Live**: real Clerk JWT issued via `lightfast-clerk` skill → POST `/api/desktop/auth/code` returned a code (200) → POST `/api/desktop/auth/exchange` returned the **same JWT** (200) → second POST with same code returned `invalid_code` (400). Real Upstash Redis GETDEL one-shot semantics confirmed.
- Phase 2 — `code-redirect` bridge mode + tests: app suite 88 passed (5 new) ✓. Live UI handshake not exercised (would require Clerk-cookie browser session); contract verified by mocked unit tests.
- Phase 3 — `protocol.ts` + Forge `CFBundleURLTypes` + tests: 12 new tests ✓. **Live**: `app.setAsDefaultProtocolClient("lightfast-dev")` works in real Electron 41; `open lightfast-dev://...` from the terminal was routed by macOS LaunchServices into the running desktop's `app.on('open-url')` handler.
- Phase 4 — `auth-flow.ts` PKCE rewrite + IPC + agent-mode auto-trigger + tests: desktop suite 34 passed; `rg "createServer|loopback|MAX_BODY_BYTES|applyCors|LIGHTFAST_DESKTOP_AUTH_NO_OPEN"` returns zero hits ✓. **Live**: real Electron 41 + `LIGHTFAST_DESKTOP_AGENT_MODE=1` emitted `{"event":"auth_signin_url","url":...}` on stdout (no `shell.openExternal`, no Dia spawn), then a dispatched `lightfast-dev://auth/callback?code=…&state=<correct>` triggered the exchange call and emitted `{"event":"auth_signin_failed","reason":"exchange_failed"}` (expected — no fresh code in Redis).
- Phase 5 — `.agents/skills/lightfast-desktop-signin/SKILL.md` ✓.

### Bugs found and fixed during live verification (out-of-scope-but-blocking)

1. **`apps/app/src/proxy.ts`** — Clerk middleware's `isApiRoute` matcher missed `/api/desktop/(.*)`. Without this, all new routes 307'd to `/sign-in`. Fix: one-line addition matching the existing `/api/cli/(.*)` entry.
2. **`apps/desktop/src/main/windows/factory.ts`** — used `import.meta.url` which Vite 8 + CJS bundling resolves to `undefined`, crashing on Electron boot with `ERR_INVALID_ARG_TYPE` from `fileURLToPath`. Fix: switch to CJS-native `__dirname`. Pre-existing regression from the recent Electron 41 / Vite 8 upgrade — not introduced by this plan, but blocking dev runtime.

### Full UI-driven happy path (verified 2026-04-25)

Drove the complete chained flow with `agent-browser` headed:

1. Bring up dev mesh on `:3024`, start desktop with `LIGHTFAST_DESKTOP_AGENT_MODE=1` and no persisted token.
2. Sign into Clerk via `lightfast-clerk` sign-in playbook (email + OTP `424242`) — cookie session established at `/claude-default-org`.
3. Desktop emitted `{"event":"auth_signin_url","url":"http://localhost:3024/desktop/auth?state=…&code_challenge=…&code_challenge_method=S256&redirect_uri=lightfast-dev%3A%2F%2Fauth%2Fcallback"}`.
4. `agent-browser open <signin URL>` → `ClientAuthBridge` (mode `code-redirect`) read the cookie session, called `/api/desktop/auth/code` with Bearer JWT + PKCE body, got back a code, redirected `window.location.href = lightfast-dev://auth/callback?code=…&state=…`.
5. macOS LaunchServices dispatched the URL into the running Electron app via `app.on('open-url')`.
6. Desktop matched state, called `/api/desktop/auth/exchange` with the verifier, got back the JWT, persisted via Electron `safeStorage` (851 bytes `auth.bin`).
7. Desktop emitted `{"event":"auth_signed_in"}` — terminal success event, ~14 seconds end-to-end.

**Idempotent re-run**: killed and restarted desktop with the persisted token. Emitted only `{"event":"auth_already_signed_in"}` — no signin URL, no `shell.openExternal`, no Dia spawn.

All four event states have now been exercised against real services: `auth_signin_url`, `auth_signed_in`, `auth_already_signed_in`, `auth_signin_failed{reason:"exchange_failed"}` (from the earlier protocol-dispatch smoke test).

### Remaining unverified

- Windows/Linux first-launch URL via `process.argv` (Risk #4) — protocol module unit-tested but not run on a Windows/Linux box.

## Overview

Replace the desktop sign-in's loopback HTTP server with a standard OAuth 2.0 Authorization Code + PKCE flow over a custom URL scheme (`lightfast://` prod, `lightfast-dev://` dev). Brings the desktop in line with VS Code / GitHub Desktop / Linear / Slack, removes ~150 LoC of HTTP server + CORS plumbing, improves end-user UX (sign-in completes inside the user's existing browser session with extensions and saved logins intact), and gives Claude Code (and any other agent harness) a deterministic single-session sign-in flow with no log-grepping and no system-default-browser hand-off.

### Agent automation (Claude Code) end state

1. Desktop is started with `LIGHTFAST_DESKTOP_AGENT_MODE=1`. `shell.openExternal` is *never* called — Dia (or any other system default browser) never opens.
2. On app-ready, desktop checks `getToken()`:
   - If a token is already persisted → emit `{"event":"auth_already_signed_in"}` and stop. Idempotent — agents can safely re-run the flow.
   - Otherwise → auto-call `beginSignIn()` (no renderer click, no CDP attach) and emit `{"event":"auth_signin_url","url":"..."}`.
3. Agent harness parses stdout, runs `AGENT_BROWSER_HEADED=true agent-browser open "$SIGNIN_URL"`. Headed Chrome for Testing is non-negotiable — see "Risks" #1.
4. Clerk completes → bridge dispatches `lightfast-dev://auth/callback?code=…&state=…` then calls `window.close()` → macOS LaunchServices delivers the URL to the running desktop (warm dispatch) → exchange runs → token persisted.
5. Desktop emits `{"event":"auth_signed_in"}` on persist or `{"event":"auth_signin_failed","reason":"..."}` on timeout/exchange error. Agent harness has a deterministic completion signal — no polling auth-store, no log-grep.
6. Timeout configurable via `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS` (default 5 min for humans; agents typically set ~30000 for fast CI feedback).

The full event grammar emitted on stdout (one JSON object per line):

| Event | When | Payload |
| --- | --- | --- |
| `auth_already_signed_in` | App start, token present in store | `{}` |
| `auth_signin_url` | App start, token absent — sign-in begun | `{ url: string }` |
| `auth_signed_in` | Exchange succeeded, token persisted | `{}` |
| `auth_signin_failed` | Timeout / exchange 4xx / state mismatch / persist failed | `{ reason: string }` |

Runbook for the entire flow lives at `.agents/skills/lightfast-desktop-signin/SKILL.md` (Phase 5).

This was validated by spike on 2026-04-25 — see "Improvement Log" for verdict + evidence.

## Current State Analysis

- `apps/desktop/src/main/auth-flow.ts` runs an ephemeral `127.0.0.1:<port>` HTTP server per sign-in. It generates `state`, opens `https://lightfast.ai/desktop/auth?state=…&callback=http://127.0.0.1:<port>/callback`, and accepts a POST body `{token, state}` from the web bridge. ~245 LoC, mostly HTTP plumbing.
- `apps/desktop/src/main/auth-flow.ts:232-234` carries a dev-only `LIGHTFAST_DESKTOP_AUTH_NO_OPEN=1` escape hatch that skips `shell.openExternal` so an agent harness can drive the URL itself. Today's two-session ceremony (CDP into Electron + drive web flow) exists because the agent has to find the URL via log-grep. We keep the no-open semantics under the renamed flag `LIGHTFAST_DESKTOP_AGENT_MODE` and replace log-grep with structured stdout (see Phase 4).
- `apps/desktop/src/main/bootstrap.ts:29` already calls `app.requestSingleInstanceLock()` — single-instance plumbing is in place but unused.
- `apps/desktop/forge.config.ts:67-78` defines `extendInfo` for Info.plist but does not declare `CFBundleURLTypes` or any URL scheme.
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx` already supports two modes (`post`, `redirect`); the `redirect` mode does `window.location.href = url`. New flow needs a third mode that exchanges the JWT for a server-issued code first.
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx` validates the loopback callback (`http://127.0.0.1` or `localhost`, path `/callback`) and POSTs `{token, state}` via the bridge.
- Upstash Redis is available via `@vendor/upstash` (`vendor/upstash/src/index.ts`) — already used elsewhere in the app for short-lived state.
- Clerk JWT template `lightfast-desktop` is the existing token shape persisted by `auth-store.setToken()` (`apps/desktop/src/main/auth-store.ts:110`). Token semantics stay identical — the change is purely how we deliver it.

### Key Discoveries

- Electron's `app.on('open-url')` fires on macOS whether the app is already running or being launched fresh. On Windows/Linux the URL arrives as a process arg via the existing `second-instance` event — minor branching but no new concept.
- `client-auth-bridge.tsx` already returns either a redirect or a POST; adding a third mode is a small extension, not a rewrite. The existing `mode: "redirect"` uses `window.location.href = url`, which is exactly the dispatch a `lightfast://` URL needs.
- Token never needs to live in Redis encrypted-at-our-layer: Upstash provides at-rest encryption and the entry has 30s TTL bound by `EX`. We're not introducing new credential storage primitives.
- `bootstrap.ts:29` already short-circuits second instances. The new `second-instance` listener (Windows/Linux callback delivery) needs to be added in `index.ts` because that's where IPC + windows are wired.
- The desktop has two build flavors today (`isPackaged ? "Lightfast" : "Lightfast Dev"` at `bootstrap.ts:9`). Two URL schemes (`lightfast` / `lightfast-dev`) prevent a dev build from swallowing prod callbacks on the same machine.

## Desired End State

- Loopback HTTP server, `applyCors`, `readJsonBody`, `Origin` check, `MAX_BODY_BYTES`, and ephemeral port binding are all gone from `auth-flow.ts`.
- `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` is renamed to `LIGHTFAST_DESKTOP_AGENT_MODE` (semantics broadened: skip `shell.openExternal` AND emit structured stdout JSON for the signin URL). Existing tests are renamed and adapted, not deleted.
- Desktop registers `lightfast` (packaged) or `lightfast-dev` (unpackaged) as a default protocol client; Info.plist contains `CFBundleURLTypes` for the same.
- Sign-in flow:
  1. Renderer click → IPC `auth-sign-in` → main generates `state` + PKCE `code_verifier`/`code_challenge`.
  2. Main composes `https://<api-origin>/desktop/auth?state=…&code_challenge=…&code_challenge_method=S256&redirect_uri=lightfast(-dev)://auth/callback`.
  3. If `LIGHTFAST_DESKTOP_AGENT_MODE=1`, emit `{"event":"auth_signin_url","url":"<signinUrl>"}` to stdout and skip `shell.openExternal`. Otherwise, call `shell.openExternal(signinUrl)`. (No DOM hook on the renderer — structured stdout is the agent surface.)
  4. Web `/desktop/auth` page: Clerk client component obtains JWT, calls `POST /api/desktop/auth/code` with `{token, state, code_challenge, redirect_uri}`. Server validates, stores `{userId, jwt, state, code_challenge, redirect_uri}` in Redis under random `code` (30s TTL), returns `{code}`. Bridge then `window.location.href = redirect_uri + "?code=…&state=…"`.
  5. Browser dispatches `lightfast(-dev)://` → OS routes to Lightfast.app → `app.on('open-url')` fires (macOS) / `second-instance` fires (Windows/Linux).
  6. Main parses URL, matches `state` to in-flight sign-in, calls `POST /api/desktop/auth/exchange { code, code_verifier }`. Server verifies `SHA256(code_verifier) === code_challenge`, marks code consumed, returns `{token}`.
  7. Main calls `setToken(token)`. `onAuthChanged` fires. Renderer flips to signed-in.
- `pnpm --filter @lightfast/desktop typecheck` and `pnpm --filter @lightfast/app typecheck` pass.
- `pnpm --filter @lightfast/desktop test` and `pnpm --filter @lightfast/app test` pass.
- Manual (agent flow):
  ```sh
  # Auto-triggers sign-in on app-ready when no token is persisted; idempotent if already signed in.
  LIGHTFAST_DESKTOP_AGENT_MODE=1 LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS=30000 \
    pnpm --filter @lightfast/desktop dev > /tmp/desktop.log 2>&1 &

  # Read the first lifecycle event (auth_already_signed_in OR auth_signin_url).
  EVENT=$(timeout 30 sh -c "tail -F /tmp/desktop.log | jq -rcM --unbuffered 'select(.event)' | head -1")
  case "$(echo "$EVENT" | jq -r .event)" in
    auth_already_signed_in) echo "Already signed in"; exit 0 ;;
    auth_signin_url)        SIGNIN_URL=$(echo "$EVENT" | jq -r .url) ;;
    *) echo "Unexpected event: $EVENT"; exit 1 ;;
  esac

  AGENT_BROWSER_HEADED=true agent-browser open "$SIGNIN_URL"

  # Block on completion event.
  RESULT=$(timeout 30 sh -c "tail -F /tmp/desktop.log | jq -rcM --unbuffered 'select(.event==\"auth_signed_in\" or .event==\"auth_signin_failed\")' | head -1")
  echo "$RESULT" | jq -e '.event=="auth_signed_in"' > /dev/null
  ```
  Single agent-browser session, no log grep (just JSON-parse), no CDP attach to renderer, Dia never opens. **`AGENT_BROWSER_HEADED=true` is required** — see Risks #1.

## What We're NOT Doing

- **Token rotation / refresh.** The persisted JWT lifetime continues to follow the Clerk template setting. Out of scope.
- **Multi-account switching.** One signed-in user per desktop install. Same as today.
- ~~**Browser-side `window.close()` after redirect.**~~ Folded into Phase 2 — agent runs leave a tab open in CI screenshots otherwise, and the cost is ~3 lines.
- **Removing the `lightfast-desktop` Clerk JWT template.** Token semantics unchanged.
- **Deep-link routing beyond auth callback.** `lightfast://` only handles `/auth/callback` for now; future `lightfast://open/<thing>` routes are a separate plan.
- **Auto-confirming the browser's "Open Lightfast?" prompt.** First-run friction stays; not solvable from our side.
- **Migration from existing installs.** No prod desktop users yet (per `desktop-release.yml disabled` memory). Cut over in one release.

## Implementation Approach

Four phases, ordered by dependency. Phases 1–2 are server-additive (no consumer yet, safe to merge). Phase 3 is desktop-only (URL scheme registration + handler). Phase 4 cuts over and deletes old code. Each phase is independently `typecheck`-clean.

---

## Phase 1: Server — code issue + exchange endpoints

### Overview

Two new API routes plus a tiny Redis-backed code store. Additive; no caller until Phase 4.

### Changes Required

#### 1. `apps/app/src/app/api/desktop/auth/lib/code-store.ts` (NEW)

Thin wrapper around `redis` with TTL and one-shot semantics. Keys: `desktop_auth_code:<code>`. Value: JSON `{userId, jwt, state, codeChallenge, redirectUri}`. TTL 30s. `consume()` does `GETDEL` for atomicity (single-use).

```ts
import { redis } from "@vendor/upstash";
import { randomBytes } from "node:crypto";

const PREFIX = "desktop_auth_code:";
const TTL_SECONDS = 30;

export interface CodeRecord {
  userId: string;
  jwt: string;
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export async function issueCode(record: CodeRecord): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await redis.set(`${PREFIX}${code}`, record, { ex: TTL_SECONDS });
  return code;
}

export async function consumeCode(code: string): Promise<CodeRecord | null> {
  const result = await redis.getdel<CodeRecord>(`${PREFIX}${code}`);
  return result ?? null;
}
```

#### 2. `apps/app/src/app/api/desktop/auth/code/route.ts` (NEW)

Authed via Clerk JWT in `Authorization: Bearer …` (same pattern as `apps/app/src/app/api/cli/login/route.ts`). Body schema: `{state, code_challenge, code_challenge_method: "S256", redirect_uri}`. Validates `redirect_uri` against allowlist (`lightfast://auth/callback`, `lightfast-dev://auth/callback`). Stores record, returns `{code}`.

```ts
// POST /api/desktop/auth/code
// Auth: Clerk JWT (lightfast-desktop template) in Authorization header.
import { z } from "zod";
import { verifyClerkJwt } from "../../../cli/lib/verify-jwt"; // reuse existing
import { issueCode } from "../lib/code-store";

const ALLOWED_REDIRECT_URIS = new Set([
  "lightfast://auth/callback",
  "lightfast-dev://auth/callback",
]);

const bodySchema = z.object({
  state: z.string().min(16).max(256),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().refine((u) => ALLOWED_REDIRECT_URIS.has(u)),
});

export async function POST(req: Request) {
  const session = await verifyClerkJwt(req);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");

  const code = await issueCode({
    userId: session.userId,
    jwt,
    state: parsed.data.state,
    codeChallenge: parsed.data.code_challenge,
    redirectUri: parsed.data.redirect_uri,
  });
  return Response.json({ code });
}
```

Reuse decision: `verify-jwt.ts` was named for CLI but is generic Clerk JWT verification. Either rename to `verify-clerk-jwt.ts` and re-export, or extract to a shared `apps/app/src/lib/auth/verify-clerk-jwt.ts`. Prefer extraction if this lands cleanly — defer the rename to a follow-up if disruptive.

#### 3. `apps/app/src/app/api/desktop/auth/exchange/route.ts` (NEW)

Body schema: `{code, code_verifier}`. Loads + atomically consumes from Redis. Verifies `base64url(SHA256(code_verifier)) === code_challenge`. Returns `{token: jwt}`.

```ts
// POST /api/desktop/auth/exchange
// Auth: none (the code itself proves possession of the in-flight sign-in).
import { createHash } from "node:crypto";
import { z } from "zod";
import { consumeCode } from "../lib/code-store";

const bodySchema = z.object({
  code: z.string().min(32).max(128),
  code_verifier: z.string().min(43).max(128),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const record = await consumeCode(parsed.data.code);
  if (!record) return Response.json({ error: "invalid_code" }, { status: 400 });

  const expected = createHash("sha256").update(parsed.data.code_verifier).digest("base64url");
  if (expected !== record.codeChallenge) {
    return Response.json({ error: "invalid_verifier" }, { status: 400 });
  }
  return Response.json({ token: record.jwt });
}
```

### Success Criteria

- `pnpm --filter @lightfast/app typecheck` passes.
- Vitest unit tests for both routes (happy path + tampered verifier + expired/missing code + tampered redirect_uri).
- `redis.getdel` exists in `@upstash/redis` v1.x — verify before relying. Fallback: `MULTI: GET + DEL` lua script.

---

## Phase 2: Web bridge — `code-redirect` mode

### Overview

Add a third mode to `client-auth-bridge.tsx` that exchanges the JWT for a code and redirects. Update `desktop-auth-client.tsx` to use it. Keep the existing `post`/`redirect` modes intact for any other consumers.

### Changes Required

#### 1. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx`

Add `mode: "code-redirect"` discriminant. Props: `{buildExchangeRequest: ({searchParams}) => {state, codeChallenge, redirectUri} | null}`. Effect path:
1. Get Clerk token.
2. POST `{token, state, code_challenge, code_challenge_method: "S256", redirect_uri}` to `/api/desktop/auth/code` with `Authorization: Bearer <token>`.
3. On `{code}`: assign `window.location.href = redirectUri + "?code=" + code + "&state=" + state`, then schedule `window.close()` ~250ms later. The setTimeout matters — `window.close()` is allowed only on windows opened by script and even then is best-effort, so we let the navigation actually flush before attempting close. Close failures are silent (browser permissions); this is a polish-not-correctness step.
4. Errors → `setStatus("error")`.

#### 2. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx`

Replace `mode: "post"` with `mode: "code-redirect"`. Validate `redirect_uri` against `lightfast://auth/callback` / `lightfast-dev://auth/callback`. Replace `validateLoopbackCallback` with `validateAppCallback`.

```tsx
"use client";
import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

const ALLOWED_REDIRECT_URIS = new Set([
  "lightfast://auth/callback",
  "lightfast-dev://auth/callback",
]);

export function DesktopAuthClient() {
  return (
    <ClientAuthBridge
      jwtTemplate="lightfast-desktop"
      mode="code-redirect"
      buildExchangeRequest={({ searchParams }) => {
        const state = searchParams.get("state");
        const codeChallenge = searchParams.get("code_challenge");
        const method = searchParams.get("code_challenge_method");
        const redirectUri = searchParams.get("redirect_uri");
        if (!state || !codeChallenge || method !== "S256" || !redirectUri) return null;
        if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) return null;
        return { state, codeChallenge, redirectUri };
      }}
      title="Authenticating…"
      subtitle="Returning you to the Lightfast desktop app…"
    />
  );
}
```

#### 3. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.test.tsx`

Add cases for `code-redirect` mode: success, server 4xx, missing params from `buildExchangeRequest`.

### Success Criteria

- `pnpm --filter @lightfast/app typecheck` passes.
- `pnpm --filter @lightfast/app test` passes including new bridge tests.
- Manual: hitting `/desktop/auth?state=…&code_challenge=…&code_challenge_method=S256&redirect_uri=lightfast-dev://auth/callback` while signed in lands at `lightfast-dev://auth/callback?code=…&state=…` (browser will show "Open in Lightfast?" prompt — expected).

---

## Phase 3: Desktop — URL scheme registration + open-url plumbing

### Overview

Register the protocol, handle inbound URLs, expose a callback hook for `auth-flow.ts` (Phase 4) to consume. No behavior change to sign-in yet — this just makes incoming `lightfast(-dev)://auth/callback?code=…&state=…` reach a no-op handler.

### Changes Required

#### 1. `apps/desktop/forge.config.ts`

Add `CFBundleURLTypes` to `extendInfo` (macOS Info.plist) and `protocols` to packagerConfig (used by Forge for bookkeeping; macOS still uses Info.plist primarily, Windows/Linux derive from Forge defaults).

```ts
const URL_SCHEME = "lightfast"; // packaged builds register "lightfast"; dev runtime registers "lightfast-dev" via app.setAsDefaultProtocolClient

// in packagerConfig.extendInfo:
CFBundleURLTypes: [
  {
    CFBundleURLName: BUNDLE_ID,
    CFBundleURLSchemes: [URL_SCHEME],
  },
],

// in packagerConfig (sibling of extendInfo):
protocols: [{ name: "Lightfast", schemes: [URL_SCHEME] }],
```

Dev builds (unpackaged) won't run through Forge's packager — for those we register the dev scheme via `app.setAsDefaultProtocolClient("lightfast-dev")` at runtime in `index.ts`. Packaged builds also call `app.setAsDefaultProtocolClient("lightfast")` defensively (cheap, idempotent).

#### 2. `apps/desktop/src/main/protocol.ts` (NEW)

```ts
import { app, BrowserWindow } from "electron";

export type ProtocolUrlListener = (url: string) => void;
const listeners = new Set<ProtocolUrlListener>();

export function getProtocolScheme(): "lightfast" | "lightfast-dev" {
  return app.isPackaged ? "lightfast" : "lightfast-dev";
}

export function registerProtocolHandler(getWindows: () => BrowserWindow[]): void {
  const scheme = getProtocolScheme();
  app.setAsDefaultProtocolClient(scheme);

  const dispatch = (rawUrl: string) => {
    if (!rawUrl.startsWith(`${scheme}://`)) return;
    for (const listener of listeners) listener(rawUrl);
    // Surface the running app on inbound URL
    const wins = getWindows();
    const win = wins.find((w) => !w.isDestroyed());
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  };

  // macOS: open-url fires on first launch and on subsequent dispatches.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatch(url);
  });

  // Windows/Linux: URL arrives as argv on second-instance.
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((a) => a.startsWith(`${scheme}://`));
    if (url) dispatch(url);
  });

  // First-launch on Windows/Linux: URL is in process.argv.
  if (process.platform !== "darwin") {
    const url = process.argv.find((a) => a.startsWith(`${scheme}://`));
    if (url) {
      // Defer so listeners can register first.
      app.whenReady().then(() => dispatch(url));
    }
  }
}

export function onProtocolUrl(listener: ProtocolUrlListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

#### 3. `apps/desktop/src/main/index.ts`

In `app.whenReady().then(...)`, call `registerProtocolHandler(() => BrowserWindow.getAllWindows())` once.

#### 4. `apps/desktop/src/main/__tests__/protocol.test.ts` (NEW)

- `open-url` event with matching scheme calls all registered listeners with the URL.
- `open-url` with a foreign scheme is ignored.
- `second-instance` extracts the URL from argv.
- Multiple listeners all fire.

### Success Criteria

- `pnpm --filter @lightfast/desktop typecheck` passes.
- `pnpm --filter @lightfast/desktop test` passes.
- Manual: in dev, `open lightfast-dev://test` from another terminal logs the URL through a temporary `onProtocolUrl(console.log)` (remove before commit).

---

## Phase 4: Desktop — Sign-in flow cutover

### Overview

Rewrite `auth-flow.ts` around PKCE + URL scheme, deleting the loopback server and CORS plumbing. Rename `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` to `LIGHTFAST_DESKTOP_AGENT_MODE` and broaden it: skip `shell.openExternal` AND emit structured stdout JSON for the signin URL. Adapt the existing `NO_OPEN` test block — do not delete it.

### Changes Required

#### 1. `apps/desktop/src/main/auth-flow.ts` (REWRITE)

```ts
import { createHash, randomBytes } from "node:crypto";
import * as Sentry from "@sentry/electron/main";
import { shell } from "electron";
import { z } from "zod";
import { getToken, setToken } from "./auth-store";
import { getProtocolScheme, onProtocolUrl } from "./protocol";

const DEFAULT_SIGNIN_TIMEOUT_MS = 5 * 60_000;

function getSigninTimeoutMs(): number {
  const raw = process.env.LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS;
  if (!raw) return DEFAULT_SIGNIN_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SIGNIN_TIMEOUT_MS;
}

function isAgentMode(): boolean {
  return process.env.LIGHTFAST_DESKTOP_AGENT_MODE === "1";
}

type AuthEvent =
  | { event: "auth_already_signed_in" }
  | { event: "auth_signin_url"; url: string }
  | { event: "auth_signed_in" }
  | { event: "auth_signin_failed"; reason: string };

function emitAgentEvent(payload: AuthEvent): void {
  if (!isAgentMode()) return;
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getApiOrigin(): string {
  return (
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024")
  );
}

const callbackSchema = z.object({
  code: z.string().min(32).max(128),
  state: z.string().min(16).max(256),
});

const exchangeResponseSchema = z.object({ token: z.string().min(1) });

let inflight: Promise<string | null> | null = null;
let pendingSigninUrl: string | null = null;
const urlListeners = new Set<(url: string | null) => void>();

export function getPendingSigninUrl(): string | null {
  return pendingSigninUrl;
}

export function onPendingSigninUrl(listener: (url: string | null) => void): () => void {
  urlListeners.add(listener);
  return () => urlListeners.delete(listener);
}

function setPendingSigninUrl(url: string | null): void {
  pendingSigninUrl = url;
  for (const listener of urlListeners) listener(url);
}

export function beginSignIn(): Promise<string | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      return await runSignIn();
    } finally {
      inflight = null;
      setPendingSigninUrl(null);
    }
  })();
  return inflight;
}

async function runSignIn(): Promise<string | null> {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const redirectUri = `${getProtocolScheme()}://auth/callback`;

  const apiOrigin = getApiOrigin();
  const signinUrl = new URL("/desktop/auth", apiOrigin);
  signinUrl.searchParams.set("state", state);
  signinUrl.searchParams.set("code_challenge", codeChallenge);
  signinUrl.searchParams.set("code_challenge_method", "S256");
  signinUrl.searchParams.set("redirect_uri", redirectUri);

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(token);
    };
    const timer = setTimeout(() => {
      Sentry.captureMessage("auth-flow: sign-in timeout", {
        level: "warning",
        tags: { scope: "auth-flow.timeout" },
      });
      emitAgentEvent({ event: "auth_signin_failed", reason: "timeout" });
      settle(null);
    }, getSigninTimeoutMs());

    const unsubscribe = onProtocolUrl(async (rawUrl) => {
      try {
        const url = new URL(rawUrl);
        if (url.pathname !== "//auth/callback" && url.host + url.pathname !== "auth/callback") {
          // URL parser oddities for custom schemes — accept either form.
          if (`${url.host}${url.pathname}` !== "auth/callback") return;
        }
        const parsed = callbackSchema.safeParse({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });
        if (!parsed.success) return;
        if (parsed.data.state !== state) {
          Sentry.captureMessage("auth-flow: state mismatch", {
            level: "warning",
            tags: { scope: "auth-flow.state_mismatch" },
          });
          return; // ignore foreign callbacks
        }
        const token = await exchangeCode(apiOrigin, parsed.data.code, codeVerifier);
        if (!token) {
          emitAgentEvent({ event: "auth_signin_failed", reason: "exchange_failed" });
          settle(null);
          return;
        }
        const persisted = setToken(token);
        if (!persisted) {
          Sentry.captureException(new Error("auth-flow: persist failed"), {
            tags: { scope: "auth-flow.persist_failed" },
          });
          emitAgentEvent({ event: "auth_signin_failed", reason: "persist_failed" });
          settle(null);
          return;
        }
        emitAgentEvent({ event: "auth_signed_in" });
        settle(token);
      } catch (error) {
        console.error("[auth-flow] callback handler error", error);
        Sentry.captureException(error, { tags: { scope: "auth-flow.handler_error" } });
        emitAgentEvent({ event: "auth_signin_failed", reason: "handler_error" });
        settle(null);
      }
    });

    setPendingSigninUrl(signinUrl.toString());

    if (isAgentMode()) {
      // Agent harnesses (e.g. Claude Code via agent-browser) parse a single
      // structured line off stdout instead of calling into the system browser.
      // Dia / default browser is never invoked. Pair with AGENT_BROWSER_HEADED=true
      // on the agent side — headless Chromium silently drops custom-scheme
      // navigations (validated 2026-04-25 spike).
      emitAgentEvent({ event: "auth_signin_url", url: signinUrl.toString() });
      return;
    }

    shell.openExternal(signinUrl.toString()).catch((error) => {
      console.error("[auth-flow] shell.openExternal failed", error);
      Sentry.captureException(error, { tags: { scope: "auth-flow.open_external" } });
      settle(null);
    });
  });
}

// Called from index.ts on app-ready. Idempotent — only fires when AGENT_MODE=1.
// If a token is already persisted, emits auth_already_signed_in and exits.
// Otherwise auto-begins sign-in so an agent harness doesn't need to drive
// renderer IPC over CDP.
export function maybeAutoBeginSignIn(): void {
  if (!isAgentMode()) return;
  if (getToken()) {
    emitAgentEvent({ event: "auth_already_signed_in" });
    return;
  }
  // Fire-and-forget: events are emitted from inside beginSignIn / its handlers.
  void beginSignIn();
}

async function exchangeCode(
  apiOrigin: string,
  code: string,
  codeVerifier: string
): Promise<string | null> {
  try {
    const response = await fetch(`${apiOrigin}/api/desktop/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    });
    if (!response.ok) {
      Sentry.captureMessage("auth-flow: exchange non-ok", {
        level: "warning",
        tags: { scope: "auth-flow.exchange_non_ok", status: String(response.status) },
      });
      return null;
    }
    const json = exchangeResponseSchema.safeParse(await response.json());
    return json.success ? json.data.token : null;
  } catch (error) {
    Sentry.captureException(error, { tags: { scope: "auth-flow.exchange_network" } });
    return null;
  }
}
```

Note on URL parsing: Node's `URL` parses custom-scheme URLs inconsistently across platforms (`lightfast://auth/callback` may surface `host=auth, pathname=/callback` on one and `host="", pathname=//auth/callback` on another). The defensive double-check above handles both. Worth pinning down with platform tests.

#### 2. `apps/desktop/src/main/index.ts`

Add IPC channel that returns the pending signin URL (renderer can subscribe for in-app status), and call `maybeAutoBeginSignIn()` once the app is ready and the renderer has been registered:

```ts
import { maybeAutoBeginSignIn, getPendingSigninUrl, onPendingSigninUrl } from "./auth-flow";

ipcMain.handle(IpcChannels.authPendingSigninUrl, () => getPendingSigninUrl());
onPendingSigninUrl((url) => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.authPendingSigninUrlChanged, url);
  }
});

// Agent-mode auto-trigger. No-op outside agent mode. Idempotent — emits
// auth_already_signed_in if a token is already persisted.
maybeAutoBeginSignIn();
```

#### 3. `apps/desktop/src/shared/ipc.ts`

Add `authPendingSigninUrl` and `authPendingSigninUrlChanged` channels. Extend `LightfastBridge.auth` with `pendingSigninUrl` getter + `onPendingSigninUrlChanged` subscriber.

#### 4. `apps/desktop/src/preload/preload.ts`

Wire the new channels into the bridge.

#### 5. ~~Renderer dev hook~~ — DROPPED

Initial draft proposed a hidden `<span data-testid="lightfast-signin-url">` in the renderer, read by agent-browser via DOM. **Removed**: the structured stdout line in `auth-flow.ts` already gives the agent a stable, low-coupling surface — no DOM, no CDP attach to the renderer, no Vite tree-shaking concerns. (See Improvement Log.)

#### 6. `apps/desktop/src/main/__tests__/auth-flow.test.ts` (REWRITE)

Drop loopback HTTP tests. **Adapt** (do not delete) the `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` test block — rename to `LIGHTFAST_DESKTOP_AGENT_MODE` and broaden coverage. Add:

- `beginSignIn` composes signin URL with state + S256 code_challenge + redirect_uri.
- Inbound `lightfast(-dev)://auth/callback?code=…&state=<correct>` triggers exchange POST with the verifier matching the challenge, persists token, emits `auth_signed_in`.
- State mismatch is ignored (no event emitted; the in-flight sign-in stays pending — same as today).
- Exchange 4xx returns `null` and emits `auth_signin_failed` with `reason: "exchange_failed"`.
- Persist failure emits `auth_signin_failed` with `reason: "persist_failed"`.
- Handler exception emits `auth_signin_failed` with `reason: "handler_error"`.
- Timeout: `auth_signin_failed` with `reason: "timeout"`. Configurable via `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS` — assert a 100ms override fires within ~150ms.
- `inflight` prevents double-flight.
- Agent mode: `shell.openExternal` is NOT called; stdout receives exactly one `{"event":"auth_signin_url","url":"..."}` line.
- Non-agent mode: `shell.openExternal` IS called; stdout receives no JSON line.
- `maybeAutoBeginSignIn`:
  - Outside AGENT_MODE → no-op (no events, `beginSignIn` not called).
  - AGENT_MODE + token already in store → emits `auth_already_signed_in` exactly once and does NOT call `beginSignIn`.
  - AGENT_MODE + no token → calls `beginSignIn` (event sequence then matches the auto-trigger flow above).
- Event-grammar property: every `auth_signin_url` is followed by exactly one terminal event (`auth_signed_in` OR `auth_signin_failed`) per in-flight sign-in.

Test infrastructure: mock `protocol.onProtocolUrl` to invoke handlers directly; mock `fetch` for the exchange endpoint; mock `shell.openExternal`; spy on `process.stdout.write` with a JSON-line parser helper. For the auto-trigger tests, mock `getToken()` from `./auth-store`.

### Success Criteria

- `pnpm --filter @lightfast/desktop typecheck` passes.
- `pnpm --filter @lightfast/desktop test` passes (rewritten suite).
- `rg "createServer|loopback|MAX_BODY_BYTES|applyCors" apps/desktop/src/` returns zero hits. (Note: `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` is renamed, not removed — `LIGHTFAST_DESKTOP_AGENT_MODE` should appear.)
- Manual (real-user path): `pnpm dev:full` + `pnpm --filter @lightfast/desktop dev`, click "Sign in" in renderer, complete Clerk in Dia/system browser, `lightfast-dev://` redirects, desktop receives, renderer flips to signed-in.
- Manual (agent path): see Phase 4 / "Desired End State". Must use `LIGHTFAST_DESKTOP_AGENT_MODE=1` and `AGENT_BROWSER_HEADED=true`. Verify with `pgrep -l Dia` before/after that no Dia process was spawned.

---

---

## Phase 5: Agent runbook — `lightfast-desktop-signin` skill

### Overview

A short SKILL.md that documents the agent flow so future Claude Code sessions don't have to re-derive it. Mirrors the existing `.agents/skills/lightfast-clerk/SKILL.md` shape.

### Changes Required

#### 1. `.agents/skills/lightfast-desktop-signin/SKILL.md` (NEW)

Document:
- **When to use**: agent needs the desktop app signed in (e.g., to drive tRPC procedures that require an authed desktop session, run E2E flows, or test signed-in renderer surfaces).
- **Preconditions**: dev mesh up on `:3024`, no `pk_live_*` Clerk keys, agent-browser installed and `AGENT_BROWSER_HEADED=true` in the environment, desktop app must already be running before the redirect fires (cold-launch via OS dispatch unreliable in dev).
- **Env vars**:
  - `LIGHTFAST_DESKTOP_AGENT_MODE=1` — required. Skips `shell.openExternal`, emits stdout events.
  - `AGENT_BROWSER_HEADED=true` — required. Headless silently drops `lightfast-dev://` navigations.
  - `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS=30000` — recommended for CI/agent runs.
- **Stdout event grammar** (one JSON object per line): `auth_already_signed_in`, `auth_signin_url`, `auth_signed_in`, `auth_signin_failed{reason}`. Reproduced verbatim from the table in this plan's "Agent automation end state".
- **The full script** (lifted from "Desired End State"). Wrap as a copy-paste snippet.
- **Hygiene**: `agent-browser close --all` between runs to drop stale Clerk session cookies if a fresh sign-in is needed; otherwise the daemon profile retains them and the second run will short-circuit through Clerk silently.
- **Failure modes**:
  - `auth_signin_failed{reason:"timeout"}` → did the agent forget `AGENT_BROWSER_HEADED=true`? The most common cause.
  - `auth_signin_failed{reason:"exchange_failed"}` → check Redis is reachable from the API; the code may have expired (30s TTL).
  - No event at all within 30s → desktop didn't start in agent mode, OR the renderer isn't ready and you're on a build that requires renderer attach. Check stdout for the bootstrap line.
- **Refusal conditions** (mirror lightfast-clerk): refuse against non-localhost `LIGHTFAST_API_URL` or `pk_live_*` Clerk keys.

### Success Criteria

- `.agents/skills/lightfast-desktop-signin/SKILL.md` exists and is discoverable by Claude Code's skill index.
- A fresh Claude Code session, given only the prompt "sign the desktop app in for me", finds the skill, runs the documented flow, and lands at `auth_signed_in` without re-deriving any of the env vars or event grammar.

---

## Risks & Open Questions

1. **agent-browser headless mode silently drops custom-scheme navigations** (validated by 2026-04-25 spike — see Improvement Log). When `agent-browser open <signin-url>` runs in default (headless) mode, the page completes Clerk and redirects to `lightfast-dev://...`, but Chrome for Testing's headless mode discards the navigation with no prompt, no error, and no fallback browser hand-off — the desktop's `app.on('open-url')` never fires and the agent has no signal that anything went wrong. **Mitigation**: every doc, test, and example must mandate `AGENT_BROWSER_HEADED=true`. Headed mode dispatches cleanly with no dialog. This must be loud in the README, the `LIGHTFAST_DESKTOP_AGENT_MODE` flag's stdout banner ("requires AGENT_BROWSER_HEADED=true"), and any agent skill that drives the flow.
2. **Cold-launch via OS dispatch is unreliable in dev (unpackaged)** (also from spike). Unpackaged Electron's `app.setAsDefaultProtocolClient` registers against `com.github.electron`, not Lightfast's bundle id, so LaunchServices relaunches bare Electron without our entrypoint. **Precondition**: the desktop app must already be running before the agent triggers the redirect. Acceptable — the loopback flow has the same precondition today. Document explicitly in Phase 4 manual test. Packaged builds register correctly because Forge writes the right `CFBundleURLTypes` and bundle id.
3. **`URL` parsing of custom schemes is platform-quirky.** Defensive double-check in `auth-flow.ts`; needs a smoke test on all three platforms before declaring done. Worst-case fallback: hand-parse with a regex (`^lightfast(-dev)?://([^?]+)\?(.*)$`).
4. **First-launch URL on Windows/Linux** arrives in `process.argv`, but `app.whenReady()` may resolve before `onProtocolUrl` listeners are registered. The `protocol.ts` deferral above handles this; verify with manual test before shipping.
5. **`redis.getdel` availability.** `@upstash/redis` v1.34+ has it. Check before relying; pinned version in `package.json` should be upgraded if older.
6. **Clerk JWT in Redis briefly.** ~30s TTL, Upstash at-rest encryption, TLS in transit. Acceptable for a single-vendor desktop. Document in `apps/app/src/app/api/desktop/auth/lib/code-store.ts` header comment.
7. **`verify-jwt.ts` location.** Currently under `apps/app/src/app/api/cli/lib/`. Phase 1 imports it from there; recommend extracting to `apps/app/src/lib/auth/verify-clerk-jwt.ts` as a small follow-up (out-of-scope for this plan to keep diff focused).
8. **Browser "Open Lightfast?" prompt on first dispatch per profile** — unavoidable for real users in real browsers. *Not* an issue in agent-browser headed mode (spike confirmed no prompt rendered). Document in user-facing release notes.
9. **Multiple in-flight desktop sign-ins on the same machine** (rare) — current `inflight` singleton keeps one at a time, same as today. URL scheme dispatch goes to whichever app instance has single-instance-lock; this matches today's loopback ordering.

## Implementation Order Summary

| Phase | Files added | Files changed | Files deleted | Lines net |
|---|---|---|---|---|
| 1 | 3 (code-store + 2 routes) | 0 | 0 | +120 |
| 2 | 0 | 3 (bridge + desktop-auth-client + tests) | 0 | +60 |
| 3 | 2 (protocol.ts + tests) | 2 (forge.config.ts + index.ts) | 0 | +90 |
| 4 | 0 | 4 (auth-flow.ts + ipc.ts + index.ts + tests) | 0 | **−160** (loopback gone, agent-mode events + auto-trigger added) |
| 5 | 1 (SKILL.md) | 0 | 0 | +60 (docs) |
| **Total** | **6** | **9** | **0** | **~+170 LoC (incl. docs), much simpler architecture** |

Each phase ships as its own PR; Phase 4 is the breaking cutover; Phase 5 can land in parallel with or after Phase 4.

---

## Improvement Log

### 2026-04-25 — Adversarial review + spike

**User-stated end state**: (1) Dia browser must never open during automated sign-in; (2) Claude Code must be able to log in smoothly via `agent-browser`.

**Findings against original draft**:

1. **Critical — plan kept `shell.openExternal` and deleted the only escape hatch.** The original draft removed `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` outright. With `shell.openExternal` still firing on every `beginSignIn`, Dia would still open in dev — directly contradicting end-state #1.
2. **Critical — "single agent-browser session" claim was unvalidated.** The plan assumed agent-browser's Chromium would dispatch `lightfast-dev://...` to the OS handler. Headless Chromium has historically been hostile to external schemes. Claim spiked (see below).
3. **High — renderer DOM hook was the wrong agent surface.** Putting the signin URL in a hidden `<span data-testid>` would have re-introduced a CDP-attach-to-Electron step. Replaced with a single structured stdout JSON line emitted from the main process — agent reads stdout, no DOM, no CDP.
4. **High — `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` deserves to live.** Renamed to `LIGHTFAST_DESKTOP_AGENT_MODE` (clearer intent) and broadened: skip `shell.openExternal` AND emit stdout JSON. Existing tests adapted, not deleted.

**Spike (2026-04-25, isolated worktree)**: built a 60-LoC Electron handler registering `lightfast-spike://` + an HTML trigger page that fires `window.location.href = "lightfast-spike://..."`. Drove with agent-browser in default and headed modes, anchor click and JS-driven navigation, cold start (handler not running) and warm start (handler running).

| Scenario | Result |
| --- | --- |
| `open lightfast-spike://...` from terminal (sanity) | PASS — handler received URL |
| agent-browser default (headless) → JS navigation | **FAIL silently** — no prompt, no error, no Dia hand-off, no event |
| agent-browser default (headless) → `<a>` click | **FAIL silently** |
| `AGENT_BROWSER_HEADED=true` agent-browser → JS navigation | **PASS** — handler received URL, no prompt rendered |
| `AGENT_BROWSER_HEADED=true` agent-browser → `<a>` click | **PASS** — handler received URL |
| Cold start (unpackaged Electron, handler not running) | **FAIL** — LaunchServices relaunched bare Electron without our entrypoint |
| Dia process state across all runs | **Unchanged** — Chromium did not hand off to system browser as a fallback |

**Verdict**: PARTIAL — the plan's automation story is viable, but only under two preconditions:

- `AGENT_BROWSER_HEADED=true` is mandatory. Headless silently drops the navigation with zero diagnostic signal — a hellish debugging surface if undocumented.
- The desktop must already be running before the redirect fires. Cold-launch routing is unreliable in dev (unpackaged); packaged builds resolve this for prod.

Both preconditions match how the loopback flow already operates today (desktop must be running; agent-browser is already used in headed mode for E1 in the research doc), so neither is a regression — just non-obvious.

**Edits made to the plan**:

- Overview: added an "Agent automation (Claude Code) end state" subsection with explicit single-session flow.
- Current State Analysis: kept the `LIGHTFAST_DESKTOP_AUTH_NO_OPEN` note but framed it as "renamed to `LIGHTFAST_DESKTOP_AGENT_MODE`, not deleted".
- Desired End State: replaced "delete the flag" with "rename and broaden". Replaced single-line manual test with the explicit script (env vars + `pgrep -l Dia` check).
- Phase 4 / Implementation: added `isAgentMode()` helper, added the structured stdout `process.stdout.write` block before `shell.openExternal`, dropped the renderer DOM hook entirely.
- Phase 4 / Tests: adapted (rather than deleted) the `NO_OPEN` test block; added agent-mode and non-agent-mode assertions about stdout vs `shell.openExternal`.
- Risks: promoted "headless silently drops" and "cold-launch unreliable" to risks #1 and #2. Updated the "Open Lightfast?" prompt risk to note the spike confirmed no prompt in agent-browser headed mode.
- Success Criteria: split into "real-user path" and "agent path" with explicit `LIGHTFAST_DESKTOP_AGENT_MODE=1` + `AGENT_BROWSER_HEADED=true` + `pgrep -l Dia` verification.

**Spike worktree**: cleaned up after evidence was captured. (Was at `.claude/worktrees/agent-aaf6279eee3a26e2c`, branch `worktree-agent-aaf6279eee3a26e2c` — both removed.)

### 2026-04-25 — Quality-of-life pass

After the spike confirmed the architecture, did a second pass focused on Claude Code's day-to-day ergonomics. Added:

1. **`maybeAutoBeginSignIn()` on app-ready in agent mode.** Removes the only remaining ceremony — no more "click the renderer's Sign in button via CDP". Single command in (`pnpm desktop dev` with the right env), single URL out on stdout.
2. **Symmetric stdout event grammar.** `auth_already_signed_in` / `auth_signin_url` / `auth_signed_in` / `auth_signin_failed{reason}`. One JSON object per line, parseable with `jq`. Replaces "tail logs and hope state flips" with a deterministic completion signal. Failure paths name the reason (`timeout`, `exchange_failed`, `persist_failed`, `handler_error`) so triage doesn't need source dives.
3. **Idempotent `auth_already_signed_in` short-circuit.** Re-running the flow on an authed install is a no-op event, not a redundant sign-in.
4. **Configurable `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS`.** Default unchanged at 5 min; agent harnesses set ~30 s for fast CI feedback. Test asserts a 100 ms override fires within ~150 ms.
5. **`window.close()` after redirect** (Phase 2). Lifted out of "What We're NOT Doing" — the cost is ~3 lines and CI screenshot artifacts are noticeably cleaner. Best-effort by browser policy; non-blocking.
6. **Phase 5 — `.agents/skills/lightfast-desktop-signin/SKILL.md` runbook.** Mirrors the existing `lightfast-clerk` skill. Documents the env-var contract, the JSON event grammar, the `AGENT_BROWSER_HEADED=true` precondition (with an explicit failure-mode call-out — "did you forget HEADED?" is the #1 cause of `timeout`), and `agent-browser close --all` daemon hygiene. Discoverability so future Claude Code sessions don't re-derive any of this.

Net effect on the agent flow: the manual test in the original draft was four lines, two of which were vague (`grep -oE` for the URL, "trigger sign-in via existing IPC" with no concrete recipe). The current manual test is a self-contained shell snippet with a strict event grammar that any agent harness can execute and assert against. The plan now actually delivers on the user's two stated end-states: (1) Dia is never opened, (2) Claude Code can log in smoothly with a single command.
