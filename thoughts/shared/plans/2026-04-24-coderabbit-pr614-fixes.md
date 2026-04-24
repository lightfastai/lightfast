# CodeRabbit PR #614 Follow-Up Fixes — Desktop Clerk Loopback

## Overview

Resolve the 5 remaining actionable CodeRabbit findings on `feat/desktop-clerk-loopback` (PR #614) before the desktop client ships to production: one critical sign-out correctness bug, two major robustness/security gaps, one UX state-machine warning, and one missing auth-boundary test. Four of the nine original findings were already fixed by late commits on this branch and are explicitly out of scope here.

## Current State Analysis

- PR #614 added the desktop OS-browser loopback sign-in flow and the tRPC `Authorization: Bearer` path.
- CodeRabbit's review left 9 inline comments on the PR. Cross-checking each against the current HEAD of `feat/desktop-clerk-loopback`:
  - **Already fixed** (verified `pnpm biome check` is clean on all 6 flagged files): trpc.ts early-return braces; `client-auth-bridge.tsx` import + interface ordering; `cli-auth-client.tsx` JSX attr ordering + block statements + numeric separator; `desktop-auth-client.tsx` block statements.
  - **Still applicable**: findings #9 (critical), #7 / #8 (major), #4 (warning), #1 (minor) — enumerated below.
- The existing vitest suite at `api/app/src/__tests__/resolve-clerk-session.test.ts` covers 5 cases; all pass. Desktop main-process code has no vitest config, so correctness fixes there rely on manual verification + runtime invariants.

### Key Discoveries

- `apps/desktop/src/main/auth-store.ts:67-74` — `clearPersisted()` nulls memory **before** `rmSync`. If `rmSync` throws (permission error / locked file), next `load()` call restores the stale token from the still-present `auth.bin`. Sign-out silently reverts.
- `apps/desktop/src/main/auth-store.ts:50-65, 97-100` — `persist()` swallows encryption/write errors. `setToken()` is `void` and `beginSignIn()` in `auth-flow.ts:95-97` treats any non-null callback token as successful sign-in regardless of whether the token actually reached disk.
- `apps/desktop/src/main/auth-flow.ts:88-99` — `settle(token)` currently calls `setToken(token)` *internally* before resolving. That coupling is what makes the sign-in path ignore persistence failures; any Phase 1 fix must decouple them (settle owns resolution, caller owns persistence).
- `apps/desktop/src/main/auth-flow.ts:103-123` — loopback server reads JWT from `url.searchParams.get("token")`. The web bridge (`apps/app/.../desktop-auth-client.tsx`) reaches the loopback via `window.location.href = url`, so the full JWT lands in the default browser's history, referrer chain, and any URL-logging extensions.
- `apps/app/src/.../_components/client-auth-bridge.tsx:25-49` — the `useEffect` returns early whenever `!(isLoaded && isSignedIn)` is true. Once Clerk finishes loading as signed-out (expired session, sign-out race), the bridge is pinned in the "loading" state indefinitely. The dep array also uses the `props` object, which changes identity on every render.
- `api/app/src/__tests__/resolve-clerk-session.test.ts` — covers Bearer-valid, Bearer-invalid-with-cookie-fallback, cookie-only, and no-auth cases, but **not** the desktop-common unhappy path: expired/invalid Bearer with no cookie session.
- No CORS on the loopback HTTP server today; Phase 2's POST exchange will introduce it narrowly (origin-pinned to the Lightfast API origin).

## Desired End State

- Desktop sign-out is atomic: if `rmSync(auth.bin)` fails, the in-memory token is not cleared and listeners are not notified of a false sign-out.
- Desktop sign-in surfaces storage failures: if `safeStorage.encryptString` or `writeFileSync` fails, `beginSignIn()` resolves as a sign-in failure (not success with an unpersisted token).
- Desktop JWT never appears in the browser URL bar, history, or referrer. The loopback callback is a `POST http://127.0.0.1:<port>/callback` with the JWT in the request body.
- `ClientAuthBridge` deterministically resolves to `"error"` once Clerk is loaded and reports signed-out, instead of staying in `"loading"`.
- `resolveClerkSession` test suite covers the expired-Bearer-without-cookie case.
- All of this is verifiable via: existing `pnpm --filter @api/app vitest run`, `pnpm biome check` on the touched files, and the PR's manual test plan (sign in → token appears in `~/Library/Application Support/Lightfast/auth.bin`; sign out → file deleted; relaunch → remains signed in / signed out respectively).

## What We're NOT Doing

- **CLI auth flow (`cli-auth-client.tsx`)** — has the same JWT-in-URL pattern as desktop. Out of scope here; CodeRabbit didn't flag it on this PR and the CLI ship is behind desktop. Tracked as a follow-up: "port CLI to POST loopback after desktop lands in prod."
- **PKCE code-exchange flow** — considered for #7, rejected as overkill for loopback. POST body transport kills the leak with no new server endpoint.
- **Introducing vitest to `apps/desktop`** — correctness of auth-store changes will be verified manually against the actual Electron binary. Setting up vitest for the main process is a separate workstream.
- **Changing the JWT template / refresh behavior** — session lifetime stays at 24h as documented in the PR body.
- **Any changes to `api/platform`** — all tRPC + auth work in this plan is scoped to `api/app`.
- **Cookie-based web auth paths** — untouched; the bridge changes only affect the desktop / CLI handoff route.

## Implementation Approach

Four phases ordered by blast radius (most critical correctness first, then security, then UX, then coverage). Each phase is independently committable and leaves the branch in a shippable state. Phase 2 is the only phase that touches both desktop main process and web bridge code — everything else is scoped to one surface.

---

## Phase 1: auth-store correctness — sign-out atomicity + persist-failure propagation

### Overview

Fix the critical sign-out bug (#9) and the silent-persist-failure bug (#8) together because both live in the same file and #8's caller-side change (`beginSignIn`) is trivial.

### Changes Required

#### 1. `apps/desktop/src/main/auth-store.ts`

**Change `persist()` and `setToken()` to return a boolean success signal; reorder `clearPersisted()` to delete on disk before clearing memory.**

```ts
function persist(token: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error(
      "[auth-store] safeStorage unavailable; refusing to write plaintext"
    );
    return false;
  }
  try {
    const payload: Persisted = { token, savedAt: Date.now() };
    const buf = safeStorage.encryptString(JSON.stringify(payload));
    writeFileSync(storePath(), buf);
    memory = token;
    return true;
  } catch (err) {
    console.error("[auth-store] failed to persist", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.persist" } });
    return false;
  }
}

function clearPersisted(): boolean {
  try {
    rmSync(storePath(), { force: true });
    memory = null;
    return true;
  } catch (err) {
    console.error("[auth-store] failed to remove", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.clear" } });
    return false;
  }
}

// load() auto-purges malformed / undecryptable files so a rotated macOS
// keychain or a corrupted auth.bin doesn't leave the user unable to sign in.
function load(): string | null {
  if (memory) return memory;
  const path = storePath();
  if (!existsSync(path)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const buf = readFileSync(path);
    const plain = safeStorage.decryptString(buf);
    const parsed = persistedSchema.safeParse(JSON.parse(plain));
    if (!parsed.success) {
      console.error("[auth-store] invalid persisted payload", parsed.error);
      Sentry.captureException(parsed.error, {
        tags: { scope: "auth-store.load.schema" },
      });
      rmSync(path, { force: true });
      return null;
    }
    memory = parsed.data.token;
    return memory;
  } catch (err) {
    console.error("[auth-store] failed to load; purging", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.load" } });
    rmSync(path, { force: true });
    return null;
  }
}

export function setToken(token: string): boolean {
  const ok = persist(token);
  if (ok) {
    emit();
  }
  return ok;
}

export function signOut(): boolean {
  const ok = clearPersisted();
  if (ok) {
    emit();
  }
  return ok;
}
```

Auto-purge is safe: `isEncryptionAvailable()` is checked first, so we never purge during a transient keychain outage. A decrypt-throw, JSON-parse-throw, or schema mismatch all imply the file is cryptographically unreadable with the current key — the only user-respecting move is to remove it and make the user re-authenticate.

Notes:
- `rmSync` with `{ force: true }` treats a missing file as success (ENOENT is suppressed), so sign-out when `auth.bin` never existed still returns `true`. Only genuine IO failures (EPERM, EBUSY) propagate.
- Only emit on success in both paths — a failed persist should NOT flip listeners to `isSignedIn: true` when memory is stale, and a failed clear should NOT flip them to `isSignedIn: false` when the token is still on disk.
- `signOut()`'s return type changes from `void` to `boolean`. Consumers are the IPC handler at `index.ts:218` and the two renderer call sites at `app-shell.tsx:26, 47`; both are updated below.

#### 2. `apps/desktop/src/main/auth-flow.ts`

**Decouple `settle()` from persistence, then let the request handler treat `setToken(...) === false` as a sign-in failure.**

Today `settle(token)` calls `setToken(token)` *internally* before resolving the outer `beginSignIn` promise (auth-flow.ts:88-99). That coupling is the bug — the HTTP response is chosen before persistence runs. Split them:

```ts
// settle now only tears down the server and resolves the outer promise.
// NOTE: the existing code uses a local `timer` (const timer = setTimeout(...)
// at the current auth-flow.ts:101). Keep that name — renaming to
// `timeoutHandle` will produce an undefined identifier.
function settle(token: string | null): void {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  server.close();
  resolve(token);
}

// request handler (GET /callback), replacing the current lines 103-123:
server.on("request", (req, res) => {
  const url = new URL(req.url ?? "/", `http://${LOOPBACK_HOST}:${port}`);
  if (url.pathname !== CALLBACK_PATH) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const token = url.searchParams.get("token");
  const returned = url.searchParams.get("state");
  const valid = Boolean(token) && returned === state;
  if (!valid || !token) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(responsePage("Sign-in failed"));
    settle(null);
    return;
  }
  const persisted = setToken(token);
  res.writeHead(persisted ? 200 : 500, { "Content-Type": "text/html" });
  res.end(responsePage(persisted ? "Signed in to Lightfast" : "Sign-in failed"));
  settle(persisted ? token : null);
});
```

Note: In Phase 2 the response-page rendering moves to the web bridge and the handler becomes POST-only, but the "settle only resolves; caller persists" contract from this phase stays in place.

#### 3. `apps/desktop/src/main/index.ts` + `apps/desktop/src/preload/preload.ts` — propagate the boolean through IPC

The IPC handler at `apps/desktop/src/main/index.ts:217-219` (`ipcMain.handle(IpcChannels.authSignOut, () => { signOutAuth(); })`) currently discards the return value. Change to `return signOutAuth();` so the renderer sees the result.

Type-surface bump — **two** surfaces need to move from `Promise<void>` to `Promise<boolean>` or the renderer call sites will silently resolve as `void`:

- `apps/desktop/src/shared/ipc.ts:106` — the `LightfastBridge` interface declares `signOut: () => Promise<void>`; change to `Promise<boolean>`. The ambient `Window.lightfastBridge` declaration at `apps/desktop/src/renderer/src/main.ts:16-21` references this interface and picks up the change automatically — no separate `.d.ts` edit.
- `apps/desktop/src/preload/preload.ts:36` — the `contextBridge.exposeInMainWorld` side. The body `ipcRenderer.invoke(IpcChannels.authSignOut)` is unchanged; only the inferred return type widens once the interface updates. (There is **no** typed `IpcInvokeMap` in this repo — `IpcChannels` at `shared/ipc.ts:5-26` is a plain string-const object, so there's nothing to update there.)

TypeScript will **not** produce a compile error if only the main-process side updates — the renderer just keeps the old `void` inference. Grep for `auth.signOut` usages before shipping to confirm all call sites see `boolean`.

#### 4. `apps/desktop/src/renderer/src/react/app-shell.tsx` — renderer surfaces failure

Two call sites exist today; they get different treatment because their contexts differ:

- **`app-shell.tsx:47`** (user-clicked "Sign out" button) — await the result; on `false`, `toast.error("Sign out failed — please try again")` and leave the shell mounted. The token is still on disk, so the user is still effectively signed in; unmounting to the auth-gate would momentarily flash it and then revert on next launch — confusing and wrong.

  ```tsx
  <button
    onClick={() => {
      void window.lightfastBridge.auth.signOut().then((ok) => {
        if (!ok) {
          toast.error("Sign out failed — please try again");
        }
      });
    }}
    type="button"
  >
    Sign out
  </button>
  ```

- **`app-shell.tsx:26`** (inside `queryClient.getQueryCache().subscribe`, auto-sign-out on tRPC `UNAUTHORIZED`) — do **not** toast here. `UNAUTHORIZED` re-fires on every subsequent query; a toast would cascade into the user's face on a tight loop if sign-out is failing. Capture to Sentry **once per session** (not per event — see latch below) and let the user notice the continued signed-in state on their own:

  ```ts
  // module scope, outside the effect:
  let signoutFailureReported = false;

  // inside the UNAUTHORIZED branch of the queryCache subscriber:
  void window.lightfastBridge.auth.signOut().then((ok) => {
    if (!ok && !signoutFailureReported) {
      signoutFailureReported = true;
      Sentry.captureException(new Error("auto-sign-out failed"), {
        tags: { scope: "app-shell.auto-sign-out" },
      });
    }
  });
  ```

  Without the latch, every subsequent UNAUTHORIZED query re-runs sign-out, re-fails, and re-reports — Sentry rate-limits the SDK calls but the project's ingest budget still gets drained during an outage. A module-scope boolean is the cheapest suppressor. Reset to `false` on a successful sign-in (add `signoutFailureReported = false` to the `onSignIn` success handler at `app-shell.tsx:38` once the Phase 2 `.then(token => ...)` refactor is in place).

  Import `Sentry` from `@sentry/browser` — the renderer uses `@sentry/browser` already (verified at `apps/desktop/src/renderer/src/main.ts:1`), not `@sentry/electron/renderer`. The `.then((ok) => ...)` form avoids `await` inside the subscriber callback, which is sync.

**Toaster mount**: `sonner` is a dependency (`apps/desktop/package.json:58`) but no `<Toaster />` is mounted in the renderer today. As part of this change, mount `<Toaster />` once at the root of the renderer React tree (`apps/desktop/src/renderer/src/react/app-shell.tsx` or the nearest parent that wraps both signed-in and signed-out shells).

**Import directly from `sonner`, not `@repo/ui`.** `apps/desktop/package.json` does **not** list `@repo/ui` as a dependency (verified), so the `(app)/layout.tsx:3` pattern (`import { Toaster } from "@repo/ui/components/ui/sonner"`) won't resolve. Use:

```tsx
import { Toaster, toast } from "sonner";
```

Both the Toaster mount and the `toast.error(...)` calls above use this import. Without this, the build fails at module resolution.

### Success Criteria

#### Automated Verification:

- [x] `pnpm --filter @lightfast/desktop typecheck` passes.
- [x] `pnpm biome check apps/desktop/src/main/auth-store.ts apps/desktop/src/main/auth-flow.ts apps/desktop/src/main/bootstrap.ts` is clean.
- [x] `pnpm --filter @api/app vitest run` passes (no regressions — these are desktop-only changes, but api/app depends on nothing here).

#### Manual Verification:

- [ ] Sign in → `~/Library/Application\ Support/Lightfast/auth.bin` exists and is non-zero bytes.
- [ ] Sign in → quit desktop (Cmd+Q) → relaunch → **remains signed in**; no auth-gate flash; `AccountCard` renders immediately. Guards against a `load()` regression from the new auto-purge branches (e.g., a stricter schema accidentally purging valid payloads).
- [ ] Sign out → `auth.bin` is removed; `AccountCard` unmounts; relaunch stays on auth-gate.
- [ ] Simulate a write failure: `chmod 400` the `Lightfast` userData directory, click Sign In, complete browser flow. Expect the loopback tab to show "Sign-in failed" and the desktop to remain on the auth-gate — **not** flash signed-in and then flip back.
- [ ] Restore permissions: `chmod 755 ~/Library/Application\ Support/Lightfast` before retrying.
- [ ] Simulate a sign-out failure (user-click path): after a successful sign-in, `chmod 400 ~/Library/Application\ Support/Lightfast/auth.bin`, click the Sign Out button at `app-shell.tsx:47`. Expect a toast ("Sign out failed — please try again"); the shell stays mounted; the token stays on disk. Restore permissions before retrying.
- [ ] Simulate a sign-out failure (UNAUTHORIZED auto path): after a successful sign-in, `chmod 400` the `auth.bin`, then force the tRPC UNAUTHORIZED path (e.g. revoke the session server-side or manually trigger `queryClient.getQueryCache()` with an UNAUTHORIZED error). Expect **no toast**; `Sentry.captureException` fires with `scope: "app-shell.auto-sign-out"`; the shell stays mounted; no toast cascade even if UNAUTHORIZED re-fires on the next query. Restore permissions before retrying.
- [ ] Corrupt auth.bin handling: after a successful sign-in, overwrite the file with random bytes (`head -c 128 /dev/urandom > ~/Library/Application\ Support/Lightfast/auth.bin`), relaunch desktop. Expect auth-gate (not a crash); file should be auto-removed; Sentry should show `auth-store.load` event.
- [ ] Sentry breadcrumb sanity: in the dev Sentry project, confirm that a simulated persist failure surfaces a `auth-store.persist` event within 60s. (Only needed if Sentry DSN is wired in dev; otherwise note as prod-only.)

**Sentry import**: add `import * as Sentry from "@sentry/electron/main";` at the top of `auth-store.ts`. Match the import style already used in `apps/desktop/src/main/sentry.ts`.

**Implementation Note**: After Phase 1 passes automated + manual verification, pause for human confirmation before moving to Phase 2. Phase 2 depends on Phase 1's error-propagation contract.

---

## Phase 2: POST-to-loopback — keep the JWT out of the browser URL

### Overview

Replace the current GET `?token=…` redirect handoff with a POST that carries the JWT in the request body. The loopback server validates the `Origin` header, parses `{ token, state }` from JSON, and settles. The web bridge renders its own "Signed in — close this tab" UI after the POST resolves.

### Changes Required

#### 1. `apps/desktop/src/main/auth-flow.ts` — POST-only loopback

**Replace the single `request` handler with method-aware branching plus CORS preflight.**

```ts
// Reuse the existing getApiOrigin() helper at auth-flow.ts:10-17 — don't
// duplicate. index.ts:45-52 has the same helper (getApiOriginForCsp); a
// future cleanup can consolidate into apps/desktop/src/shared/ but that's
// out of scope for this plan.
const ALLOWED_ORIGIN = getApiOrigin();

function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
  // Chrome Private Network Access: public origins (https://lightfast.ai)
  // fetching loopback targets require this explicit opt-in or the browser
  // blocks the request. Dev (http://localhost:3024 → 127.0.0.1) is
  // loopback→loopback and unaffected; prod is public→loopback and would
  // silently break without this header.
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  const MAX = 16 * 1024; // JWT payloads are well under 16KB; reject anything larger
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX) {
      // Tear down the socket so a malicious client can't keep streaming
      // bytes we've already committed to rejecting. Without this, the TCP
      // connection remains open until the client closes it — a trivial
      // local-port-hold vector.
      req.destroy();
      throw new Error("payload too large");
    }
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

server.on("request", async (req, res) => {
  try {
    const origin = req.headers.origin ?? "";
    // Reject empty Origin too — legitimate browser requests always set it on
    // cross-origin fetches, and local non-browser clients have no business
    // hitting this loopback (the desktop is the only intended client, and it
    // doesn't go through this path).
    //
    // Note: the 403 response intentionally omits CORS headers. The browser
    // reports this as an opaque CORS failure rather than leaking which
    // origins are allowed — deliberate defense-in-depth, not a bug. If a
    // future debugger sees "CORS error" in DevTools for a malicious origin,
    // that's the expected behavior.
    if (origin !== ALLOWED_ORIGIN) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden origin");
      return;
    }
    const url = new URL(req.url ?? "/", `http://${LOOPBACK_HOST}:${port}`);
    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    if (req.method === "OPTIONS") {
      applyCors(res);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/plain", Allow: "POST" });
      res.end("Method Not Allowed");
      return;
    }

    applyCors(res);
    const body = await readJsonBody(req);
    const parsed = callbackBodySchema.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "bad_request" }));
      settle(null);
      return;
    }
    const { token, state: returned } = parsed.data;
    if (returned !== state) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "state_mismatch" }));
      settle(null);
      return;
    }
    const persisted = setToken(token);
    res.writeHead(persisted ? 204 : 500, {
      "Content-Type": "application/json",
    });
    res.end(persisted ? "" : JSON.stringify({ ok: false, reason: "persist_failed" }));
    settle(persisted ? token : null);
  } catch (error) {
    console.error("[auth-flow] loopback handler error", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
    settle(null);
  }
});
```

And add the schema + import near the top of the file. **Consolidate the `node:http` types into the existing import** — the current file already has `import { createServer, type Server } from "node:http";`, so merge rather than adding a second line (Biome's `lint/style/useImportType` / `noUselessFragments` rules will flag split imports):

```ts
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { z } from "zod";

const callbackBodySchema = z.object({
  token: z.string().min(1),
  state: z.string().min(1),
});
```

Delete the `responsePage()` helper and its caller-site HTML responses — the browser tab UI now lives in the web bridge.

#### 2. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx`

**Refactor `ClientAuthBridgeProps` into a discriminated union on `mode` so POST and redirect modes are type-level exclusive.** Two-optional-callbacks with a runtime "exactly one" check is an impossible-state API; the union makes the compiler enforce it.

```ts
interface ClientAuthBridgeBaseProps {
  fallback?: ReactNode;
  jwtTemplate?: string;
  subtitle: string;
  title: string;
}

interface PostCallbackProps {
  mode: "post";
  buildPostCallback: (args: {
    searchParams: URLSearchParams;
  }) => { url: string; state: string } | null;
}

interface RedirectProps {
  mode: "redirect";
  buildRedirectUrl: (args: {
    token: string;
    searchParams: URLSearchParams;
  }) => string | null;
}

export type ClientAuthBridgeProps = ClientAuthBridgeBaseProps &
  (PostCallbackProps | RedirectProps);
```

Inside the effect, branch on `props.mode`. Add **Sentry observation on web-side error paths** — without it, a prod-only CORS / preflight regression (e.g. the ALLOWED_ORIGIN env falls through to `localhost:3024` because `NODE_ENV` isn't `"production"` in a packaged build) shows as a silent "Authentication Failed" to the user with zero Sentry signal. The desktop only sees requests that reach its handler; a browser-rejected preflight never does:

```ts
// Phase 3 also touches this effect — merge the one-shot-latch fix below.
if (props.mode === "post") {
  const built = props.buildPostCallback({ searchParams });
  if (!built) {
    Sentry.captureMessage("auth-bridge: buildPostCallback returned null", {
      level: "warning",
      tags: { scope: "auth-bridge.invalid_callback" },
    });
    setStatus("error");
    return;
  }
  let response: Response;
  try {
    response = await fetch(built.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, state: built.state }),
      // No credentials — loopback doesn't accept cookies.
      credentials: "omit",
    });
  } catch (error) {
    // TypeError from fetch — browser blocked the request (CORS / PNA preflight)
    // or the loopback port is gone. The user sees "Authentication Failed" with
    // no desktop-side signal since the request never reached the handler.
    Sentry.captureException(error, {
      tags: { scope: "auth-bridge.fetch_network_error" },
    });
    setStatus("error");
    return;
  }
  if (!response.ok) {
    Sentry.captureMessage("auth-bridge: loopback POST non-ok", {
      level: "warning",
      tags: {
        scope: "auth-bridge.fetch_non_ok",
        status: String(response.status),
      },
    });
    setStatus("error");
    return;
  }
  setStatus("success");
  return;
}
// props.mode === "redirect" — existing path, unchanged for CLI.
```

**Import style: use named imports from `@sentry/nextjs`, not `import * as Sentry`.** Existing apps/app call sites (`session-activator.tsx:4`, `oauth-button.tsx:6`) use `import { addBreadcrumb, startSpan } from "@sentry/nextjs"`. There is **no** existing `import * as Sentry` in `apps/app/src/**` — matching the named-import convention keeps the bundle tree-shakeable and tooling consistent. Rewrite the bridge snippet above accordingly:

```ts
import { captureException, captureMessage } from "@sentry/nextjs";
// ...
captureMessage("auth-bridge: buildPostCallback returned null", { /* ... */ });
captureException(error, { tags: { scope: "auth-bridge.fetch_network_error" } });
```

Desktop main (`@sentry/electron/main`) and desktop renderer (`@sentry/browser`) both already use `import * as Sentry`; keep those namespace-style to match `sentry.ts:2` and `renderer/src/main.ts:1` respectively. The inconsistency across packages is real but pre-existing — don't try to unify here.

Extend the state union from `"loading" | "redirecting" | "error"` to `"loading" | "redirecting" | "success" | "error"` and render a "Signed in — you can close this tab" panel for `"success"`. This replaces the HTML page the loopback used to serve. The success panel may also attempt `window.close()` for better UX — note this only works if the tab was opened by JavaScript, and our tab was opened via Electron's `shell.openExternal`, so the call is a best-effort no-op in most browsers. Don't rely on it.

#### 3. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx`

**Switch from `buildRedirectUrl` to `buildPostCallback`.** `validateLoopbackCallback` stays as-is (same allow-list, same URL validation).

```tsx
<ClientAuthBridge
  mode="post"
  buildPostCallback={({ searchParams }) => {
    const state = searchParams.get("state");
    const callback = validateLoopbackCallback(searchParams.get("callback"));
    if (!(state && callback)) {
      return null;
    }
    // Strip any query params — POST carries token + state in the body.
    callback.search = "";
    return { url: callback.toString(), state };
  }}
  jwtTemplate="lightfast-desktop"
  subtitle="You'll be redirected back to the Lightfast desktop app shortly."
  title="Authenticating…"
/>
```

#### 4. CLI flow — explicit `mode="redirect"`

`cli-auth-client.tsx` continues to use `buildRedirectUrl`, but must now pass `mode="redirect"` for the union to discriminate. Leave a short comment referencing the follow-up tracking item so a future reader sees the parity gap is intentional, not an oversight.

#### 5. `apps/desktop/src/main/auth-flow.ts` — serialize concurrent `beginSignIn` calls

Today each call spawns a fresh loopback server on a new port, opens a new browser tab, and uses a fresh 256-bit state nonce. Two rapid clicks on "Sign In" produce two of everything — first to complete wins, second times out at 5 min. Confusing, and halfway to a resource leak.

Guard with a module-scope in-flight promise:

```ts
let inflight: Promise<string | null> | null = null;

export async function beginSignIn(): Promise<string | null> {
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      // ... existing beginSignIn body, now wrapped ...
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
```

All concurrent callers receive the same promise; the `finally` clears the slot on settle, timeout, or error so the next sign-in attempt starts fresh.

**Implementation note**: the existing `beginSignIn` body returns a `new Promise<string | null>((resolve) => { /* server setup */ })`. When wrapping inside the async IIFE, `return` that promise so the outer `async` awaits it:

```ts
inflight = (async () => {
  try {
    return await new Promise<string | null>((resolve) => {
      // ... existing server setup, settle() calls resolve() ...
    });
  } finally {
    inflight = null;
  }
})();
```

Without the explicit `return await`, the IIFE resolves immediately with `undefined` and `finally` clears `inflight` before the server ever settles — every concurrent call starts its own flow anyway.

#### 6. Renderer — failure toast + window focus on sign-in

Two small renderer-side behaviors wired to the sign-in promise chain:

1. **Failure toast**: the only caller is `apps/desktop/src/renderer/src/react/app-shell.tsx:38` (`onSignIn={() => void window.lightfastBridge.auth.signIn()}`), fire-and-forget today. Replace the `void` with a `.then`: when `beginSignIn()` resolves `null` (any non-success path — timeout, state mismatch, bad body, 400 response, closed tab), show `toast.error("Sign-in didn't complete — please try again")`. Generic wording covers all null cases; "timed out" would be misleading for e.g. state-mismatch returns. Success (non-null) needs no renderer-side action — the auth-state emit already drives the shell swap.
2. **Window focus on sign-in success**: the auth-state subscriber at `apps/desktop/src/main/index.ts:367-371` (the `onAuthChanged` callback that loops `BrowserWindow.getAllWindows()` and `webContents.send`s the snapshot) should additionally call `win.show()` + `win.focus()` on transitions from signed-out → signed-in. Track the previous `isSignedIn` in a module-scope variable; only fire focus when the flag flips from `false` to `true`. This brings the desktop to the front the moment the bridge POSTs, matching the UX of `gh auth login` / `gcloud auth login` surfacing their terminal.

Gate on **transition only** (false → true). Token refreshes that keep `isSignedIn: true` must not yank focus.

**Initialize `prev` from the actual boot-time auth state, not `false`.** `load()` is called during boot and populates the in-memory token but does **not** fire `emit()`. So:
- If the user boots signed-in, no emit happens — `createWindow()` at `windows/factory.ts` attaches `win.once("ready-to-show", () => win.show())`, so the window will surface itself naturally once Electron is ready. No post-boot focus-yank needed.
- If a token refresh happens later in that session, it emits `true`. If `prev` was initialized to `false` (the JS default), that looks like a `false → true` transition and we'd incorrectly yank focus.

The fix: when the subscriber is wired in `index.ts:367`, read the current snapshot (`Boolean(getSnapshot().isSignedIn)` or however the auth-store exposes it) and seed `prev` with that value. The module-scope state becomes:

```ts
let prev = Boolean(getSnapshot().isSignedIn); // accurate at subscriber-attach time

onAuthChanged((snapshot) => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.authChanged, snapshot);
  }
  const next = Boolean(snapshot.isSignedIn);
  if (!prev && next) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.show();
      win.focus();
    }
  }
  prev = next;
});
```

This way:
- Boot signed-out → first user sign-in → emit(true) → `prev=false, next=true` → focus. ✓
- Boot signed-in + token refresh → emit(true) → `prev=true, next=true` → no focus. ✓
- Sign-out mid-session → emit(false) → `prev=true, next=false` → no focus (gate doesn't match). ✓
- Re-sign-in after sign-out → emit(true) → `prev=false, next=true` → focus. ✓

No separate "skip first emit" sentinel is needed — the bug was in the default value of `prev`, not in the transition detection.

#### 7. Observability — Sentry at auth-flow error sites

Use `Sentry.captureException` for real errors and `Sentry.captureMessage(msg, { level: "warning" })` for anomalies that don't throw. **Do not use `addBreadcrumb` standalone here** — breadcrumbs only attach to a subsequent `captureException` in the same scope, so a timeout that doesn't throw produces zero Sentry events and disappears.

Real failures (`captureException`, with `tags.scope`):

- `startLoopbackServer()` bind failure → `scope: "auth-flow.bind"`
- `setToken(token) === false` after a successful browser POST → `scope: "auth-flow.persist_failed"` — user completed the browser flow but desktop couldn't save
- Outer handler catch (the `try/catch` around the request handler) → `scope: "auth-flow.handler_error"`

Anomalies (`captureMessage` at `level: "warning"`, with `tags.scope`):

- State mismatch in POST handler → `"auth-flow: state mismatch"`, `scope: "auth-flow.state_mismatch"`
- Forbidden origin in POST handler → `"auth-flow: forbidden origin"`, `scope: "auth-flow.forbidden_origin"` — worth tracking as a signal of a misconfigured prod origin or a local probe
- Timeout settle (the 5-minute no-callback path) → `"auth-flow: sign-in timeout"`, `scope: "auth-flow.timeout"`

These are the signals that distinguish "silent prod regression" from "we can see it happened and why". `captureMessage` creates a real Sentry event at warning level so anomaly paths are visible in the dashboard even when nothing throws.

### Residual risk — what fetch-POST does and does not cover

Honest framing of the threat model for future readers:

| Surface | GET redirect (today) | fetch-POST (this phase) | PKCE code exchange (rejected) |
| --- | --- | --- | --- |
| Browser URL bar | JWT visible | Clean | Clean |
| Browser history | JWT persisted | Clean | Clean |
| `Referer` headers to third parties | JWT leaks | Clean | Clean |
| URL-logging browser extensions | JWT captured | Clean | Clean |
| Request-body-capable extensions (`webRequest` + body perms) | JWT captured | JWT captured | Clean |
| DevTools Network tab (open by user) | JWT visible | JWT visible | Clean (opaque code) |
| In-memory fetch request body | N/A | Present briefly | Clean (code not JWT) |

fetch-POST clears every URL-surface leak, which is the bar CodeRabbit #7 asked us to meet. It does **not** make the JWT invisible to a user who already installed a request-body-reading extension, nor to DevTools. PKCE would close those gaps by replacing the JWT with a single-use code that's redeemed for a JWT over a server-to-server exchange — but that requires a new `/api/desktop/auth/exchange` endpoint and a Redis-backed code↔JWT map. Rejected as scope creep for a 24h-bounded localhost handoff. If the threat model ever expands (e.g., longer-lived tokens, shared machines), revisit PKCE.

### Success Criteria

#### Automated Verification:

- [x] `pnpm --filter @lightfast/desktop typecheck` passes.
- [x] `pnpm --filter @lightfast/app typecheck` passes.
- [x] `pnpm biome check apps/desktop/src/main/auth-flow.ts apps/app/src/app/\\(app\\)/\\(user\\)/\\(pending-not-allowed\\)/_components/client-auth-bridge.tsx apps/app/src/app/\\(app\\)/\\(user\\)/\\(pending-not-allowed\\)/desktop/auth/_components/desktop-auth-client.tsx` is clean.
- [x] `pnpm --filter @api/app vitest run` still passes (no behavioral changes to `resolveClerkSession`).

#### Manual Verification:

- [ ] `pnpm dev:desktop-stack` + `pnpm dev:desktop` boot cleanly.
- [ ] Click "Sign in with Lightfast" → default browser opens at `localhost:3024/desktop/auth?state=…&callback=http://127.0.0.1:<port>/callback`. Complete Clerk sign-in.
- [ ] After the bridge flips to "Signed in — close this tab", open browser DevTools → History. Confirm **no entry contains `token=`** in the URL. Only `state` and `callback` should appear.
- [ ] Open DevTools → Network. Confirm the handoff is a `POST http://127.0.0.1:<port>/callback` returning 204, with JWT present only in the request body.
- [ ] Craft a malicious `callback` param (`https://evil.com/callback`) → bridge renders "Authentication Failed"; no POST is fired.
- [ ] Mismatched `state` (mutate in-flight via DevTools) → loopback returns 400 with `state_mismatch`; desktop remains on auth-gate.
- [ ] `NODE_ENV` sanity in packaged builds: `getApiOrigin()` falls through to `http://localhost:3024` when `NODE_ENV !== "production"`. Packaged Electron apps don't always have `NODE_ENV` set in `process.env` (depends on electron-builder / Squirrel config). Add a one-liner `console.log("[auth-flow] ALLOWED_ORIGIN =", ALLOWED_ORIGIN);` at module load, build a signed dev DMG, launch it, and confirm the logged origin matches the expected prod value (`https://lightfast.ai`) — not `http://localhost:3024`. If it falls through to localhost, production sign-in will 403 on origin. This is a **pre-existing** concern (the helper predates this plan) but Phase 2 makes it load-bearing for CORS.
- [ ] Origin check: `curl -X POST -H "Origin: http://evil.com" -H "Content-Type: application/json" -d '{"token":"x","state":"x"}' http://127.0.0.1:<port>/callback` returns 403. (Port is printed in the desktop console log.)
- [ ] Empty-Origin rejection: `curl -X POST -H "Content-Type: application/json" -d '{"token":"x","state":"x"}' http://127.0.0.1:<port>/callback` (no Origin header) also returns 403 — confirms the tightened origin check.
- [ ] PNA header: `curl -i -X OPTIONS -H "Origin: https://lightfast.ai" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Private-Network: true" http://127.0.0.1:<port>/callback` returns `Access-Control-Allow-Private-Network: true` in the response headers.
- [ ] Double-handshake guard (StrictMode): with `apps/app` running in dev (StrictMode on by default in Next.js 15), complete a sign-in. The Network tab should show **exactly one** POST to `http://127.0.0.1:<port>/callback`, not two. Confirms the `didStart` latch bars React's second effect invocation.
- [ ] Concurrent sign-in serialization: click "Sign In" twice in rapid succession (< 500ms apart). Expect **one** browser tab to open (not two), **one** loopback port to be logged, and a clean sign-in on completion. The second IPC call should resolve to the same token as the first.
- [ ] Sign-in timeout UX: click "Sign In", close the browser tab without completing. After ~5 minutes, the desktop should display a toast ("Sign-in didn't complete — please try again") and return to the pre-sign-in state. Sentry should show an `auth-flow.timeout` warning-level event (from `captureMessage`, not a breadcrumb).
- [ ] Window focus on sign-in: from a desktop window that's been command-tab'd away (not focused), complete a sign-in in the browser. The desktop window should auto-`show()` + `focus()` the moment the POST resolves.
- [ ] Window focus does not fire on refresh: while signed in, trigger a token refresh (or simulate an `emit({ isSignedIn: true })` on an already-signed-in state). The desktop window should **not** steal focus. Confirms the focus call is gated on the signed-out→signed-in transition.
- [ ] Regression: sign-in via `apps/app` browser-cookie flow still works (`/sign-in` unchanged).
- [ ] Regression: CLI flow at `/cli/auth` still completes (smoke test — not shipping changes there, just ensuring `ClientAuthBridge` refactor didn't break it).

**Implementation Note**: Pause for human confirmation after Phase 2. The browser-history test is the defining acceptance criterion for #7 — don't proceed to Phase 3 until that has been eyeballed on a real Clerk dev session.

---

## Phase 3: ClientAuthBridge state machine + useEffect dep array

### Overview

Make `ClientAuthBridge` deterministic when Clerk reports signed-out, and stabilize the effect's dep array so it doesn't re-fire on every parent render.

### Changes Required

#### 1. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx`

**Gate the handshake with a `useRef` one-shot latch instead of fighting the dep array.**

Enumerating stable callables in the dep array (`buildPostCallback`, `buildRedirectUrl`, `jwtTemplate`) looks principled but is fragile in practice: both parents (`desktop-auth-client.tsx`, `cli-auth-client.tsx`) pass builders as inline arrow closures, so identity flips on every parent re-render. Today the parents are stateless and rarely re-render, but any future wrapping layout change, React 19 transition, or searchParams mutation would re-fire the effect mid-handshake — and `getToken()` would run again, potentially double-POSTing.

The handshake is *semantically* one-shot (one tab, one token, one POST). Make that explicit with a ref latch and you can cut the dep array to the two values that genuinely drive the state transition:

```ts
const didStart = useRef(false);

useEffect(() => {
  if (!isLoaded || didStart.current) {
    return;
  }
  if (!isSignedIn) {
    setStatus("error");
    didStart.current = true;
    return;
  }
  didStart.current = true;
  void (async () => {
    try {
      const token = await getToken(
        props.jwtTemplate ? { template: props.jwtTemplate } : undefined
      );
      if (!token) {
        setStatus("error");
        return;
      }
      // ... Phase 2's branching on props.mode ...
    } catch {
      setStatus("error");
    }
  })();
}, [isLoaded, isSignedIn]);
```

Notes:
- Latch is set **before** the async work starts, so an exception in the async block still bars re-entry.
- Dep array is `[isLoaded, isSignedIn]` only — no builder/searchParams/jwtTemplate identity concerns. The builder is read off `props` at call time, which is fine because the handshake runs exactly once.
- `isLoaded && !isSignedIn` resolves deterministically to `"error"` instead of idle "loading" (fix for #4).
- React 18/19 StrictMode double-invokes effects in dev; the second invocation sees `didStart.current === true` and bails, which is the correct behavior here (the first run already kicked off the handshake).
- Biome's `lint/correctness/useExhaustiveDependencies` rule will flag the missing deps (`props`, `getToken`, `searchParams`). Disable with a targeted inline comment — note this is the Biome rule path, not ESLint's `react-hooks/exhaustive-deps` (ultracite / biome is the only linter configured; ESLint comments will be ignored): `// biome-ignore lint/correctness/useExhaustiveDependencies: handshake is one-shot, latched by didStart.current — re-firing the effect would double-POST the token.`

### Success Criteria

#### Automated Verification:

- [ ] `pnpm --filter @lightfast/app typecheck` passes.
- [ ] `pnpm biome check apps/app/src/app/\\(app\\)/\\(user\\)/\\(pending-not-allowed\\)/_components/client-auth-bridge.tsx` is clean.

#### Manual Verification:

- [ ] In DevTools, sign out in another tab while `/desktop/auth` is open → the bridge flips from "Authenticating…" to "Authentication Failed" within one tick (not stuck in "loading").
- [ ] Open `/desktop/auth` in an incognito window with no Clerk session → renders "Authentication Failed" deterministically.
- [ ] Normal signed-in flow still works (happy path from Phase 2's manual checks).

---

## Phase 4: Missing `resolveClerkSession` auth-boundary test

### Overview

Add the expired-Bearer-without-cookie test case to `api/app/src/__tests__/resolve-clerk-session.test.ts`. This is the canonical desktop unhappy path (expired 24h JWT, no cookie because the desktop has never been to lightfast.ai) and is currently unverified.

### Changes Required

#### 1. `api/app/src/__tests__/resolve-clerk-session.test.ts`

**Insert after the existing `"falls through to the cookie path when the Bearer JWT is invalid"` test.**

```ts
it("returns null when the Bearer JWT is invalid and no cookie session exists", async () => {
  verifyTokenMock.mockRejectedValueOnce(new Error("jwt expired"));
  authMock.mockResolvedValueOnce({ userId: null, orgId: null });

  const session = await resolveClerkSession(
    new Headers({ authorization: "Bearer expired.jwt" })
  );

  expect(session).toBeNull();
  expect(verifyTokenMock).toHaveBeenCalledTimes(1);
  expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
});
```

Note: The existing `"returns null when neither Bearer nor cookie produce a session"` test covers the no-Authorization-header variant. The new case is specifically about a **present but expired** Bearer token combined with the no-cookie state — which is the steady-state for a desktop whose session lapsed overnight.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm --filter @api/app vitest run src/__tests__/resolve-clerk-session.test.ts` passes with 6 tests.
- [ ] `pnpm --filter @api/app typecheck` passes.
- [ ] `pnpm biome check api/app/src/__tests__/resolve-clerk-session.test.ts` is clean.

#### Manual Verification:

- None needed — pure unit test addition.

---

## Testing Strategy

### Unit Tests

- `resolveClerkSession` — Phase 4 adds the expired-Bearer-without-cookie case. Existing five cases cover Bearer-valid, Bearer-valid-without-org, Bearer-invalid-with-cookie, no-auth, and cookie-only.
- No new unit tests for `auth-store` — Electron main process has no vitest setup. If CI coverage becomes a hard gate, file a follow-up to add a minimal vitest config.

### Integration Tests

- Covered manually per the PR's existing test plan, extended by the phase-specific checks above.

### Manual Testing Steps

Post-Phase 2, the headline verification is:

1. Sign in via desktop → complete Clerk flow in default browser.
2. Open browser history → **no JWT in any URL**. Only `state=…` + `callback=http://127.0.0.1:<port>/callback` should appear.
3. Open Network tab → JWT visible only as POST request body on `http://127.0.0.1:<port>/callback`, response 204.
4. Sign out → `auth.bin` removed; `AccountCard` unmounts.
5. Simulate storage failure (chmod the userData dir) → sign-in attempt ends on "Sign-in failed", not false success.

## Performance Considerations

- One extra round trip on sign-in (browser → loopback POST) vs the current redirect. Both are localhost; the added latency is sub-millisecond.
- No change to cold-start or token-verification hot path (`verifyToken` behavior is untouched in `trpc.ts`).
- `readJsonBody` caps at 16 KB — a sane Clerk JWT is well under that, and the cap protects against a malicious local process POSTing a huge body.

## Migration Notes

- **No data migration needed.** Existing `auth.bin` files from pre-fix builds are forward-compatible; Phase 1's changes only affect how writes and deletes are sequenced, not the on-disk format.
- **Rollback story**: Each phase is a separate commit. If Phase 2 regresses in prod, revert only the Phase 2 commits — Phase 1's correctness fix stands on its own.

## References

- Original PR: https://github.com/lightfastai/lightfast/pull/614
- CodeRabbit review comments (verbatim): captured in conversation history at planning time — 9 total, 5 actionable. Each Phase maps to the CodeRabbit finding #:
  - Phase 1 → findings #9 (critical) + #8 (major)
  - Phase 2 → finding #7 (major)
  - Phase 3 → finding #4 (warning)
  - Phase 4 → finding #1 (minor)
- Architectural backdrop: `thoughts/shared/plans/` plus the PR body's "Four late fixes" section — same security posture (loopback-only, state nonce, safeStorage).
- Similar patterns in the wild: `gh auth login` and `gcloud auth login` both use POST-style handoffs rather than URL-embedded tokens. CLI equivalent is out of scope here; follow-up item.
- Loopback host choice — `127.0.0.1` not `localhost`: RFC 8252 §7.3 (OAuth 2.0 for Native Apps) recommends the IP literal because (a) `localhost` resolution is system-dependent and can land on IPv6/IPv4 unpredictably, (b) `/etc/hosts` can override `localhost`, and (c) Chrome PNA classifies `127.0.0.1` as loopback unambiguously. Matches what `gh`/`gcloud` use and what `auth-flow.ts`'s `LOOPBACK_HOST` already binds to.

## Improvement Log

Changes made during `/improve_plan` review on 2026-04-24. Original plan was solid on structure but had a handful of factual and correctness issues that would have bitten during implementation.

### Critical fixes

- **Corrected the `signOut()` consumer reference.** The original plan named `bootstrap.ts` as the sole consumer; that file (37 lines) does not call `signOut()` at all. The real consumers are `apps/desktop/src/main/index.ts:218` (IPC handler) and `apps/desktop/src/renderer/.../app-shell.tsx:26, 47` (renderer). Phase 1 now propagates the boolean through both layers. Without this fix, the critical sign-out-atomicity fix would have been invisible to the user.
- **Added `Access-Control-Allow-Private-Network: true` to Phase 2's CORS response.** Chrome's PNA spec requires this header when a public origin (`https://lightfast.ai`) fetches a loopback target — missing it silently breaks production sign-in while dev (loopback→loopback) continues to work. Not surfaced in the original plan.
- **Decoupled `settle()` from `setToken()` in Phase 1.** The original snippet assumed settle didn't persist; the actual code (auth-flow.ts:88-99) calls `setToken` internally, so a naive fix would have double-persisted. New snippet refactors settle to resolution-only and moves persistence to the handler, preserving the error-propagation contract Phase 2 depends on.

### High-value improvements

- **`ClientAuthBridgeProps` now a discriminated union on `mode`.** Original plan had two optional builder callbacks with a runtime "exactly one" check. The union makes the impossible state unrepresentable and kills an `"error"` branch. User explicitly chose this option.
- **Phase 3 switched from dep-array enumeration to a `useRef` one-shot latch.** User's own callout: enumerating `props.buildPostCallback`, `props.buildRedirectUrl`, etc. looks principled but both parents pass inline arrows, so identity flips on any parent re-render, risking double POSTs under React 19 transitions or StrictMode. The latch is semantically correct (handshake IS one-shot) and shrinks deps to `[isLoaded, isSignedIn]` only.
- **Added Phase 2 "Residual risk" section.** Explicit tradeoff table showing what fetch-POST closes (URL bar / history / Referer / URL-logging extensions) vs what only PKCE would close (DevTools Network tab / request-body-capable extensions / in-memory body). Documents why PKCE was rejected (new endpoint + Redis code↔JWT map) so future-us doesn't re-litigate.
- **Sign-out failure UX: toast + stay mounted.** Original plan said "log + keep auth-gate visible" — but the auth-gate is only rendered when signed-out, so "keep it visible" is incoherent. Corrected to toast + shell stays mounted (token is still valid on disk; unmounting would flash the auth-gate and revert on next launch).
- **Tightened origin check from `if (origin && origin !== ALLOWED_ORIGIN)` to `if (origin !== ALLOWED_ORIGIN)`** — rejects empty Origin too. Defense-in-depth, cost-free.

### Smaller touch-ups

- Added manual verification steps for the sign-out-failure simulation (Phase 1), PNA preflight response (Phase 2), empty-Origin rejection (Phase 2), and StrictMode double-handshake guard (Phase 2).
- Replaced Phase 4's line-number references with test-name references — survives test reordering.
- Added a References entry explaining the `127.0.0.1` vs `localhost` choice (RFC 8252 §7.3) after the user asked during review.
- Added a Key Discoveries entry documenting the `settle()` / `setToken()` coupling since it's load-bearing for Phase 1.

### Not changed

- Phase 1 stayed on booleans rather than thrown typed errors. Pragmatic; matches CodeRabbit's own suggestion; booleans carry the binary information without introducing a second error channel.
- Phase 4 unchanged — single test case, zero ambiguity.
- CLI flow still on `buildRedirectUrl` (now `mode="redirect"`). Follow-up item to port CLI to POST after desktop lands in prod, as originally planned.

### QoL / hardening round (added 2026-04-24)

After the structural review, a follow-up pass added six items that were tied to the Phase 1/2 surfaces anyway — cheaper to bundle than revisit.

- **`load()` auto-purges unreadable `auth.bin`** (Phase 1 §1). A rotated macOS keychain or file corruption previously left a permanently-unreadable file on disk; users would fail to sign in with no self-healing path. Now purged on decrypt/parse/schema failure, so the next launch starts clean.
- **Preload type-surface bump made explicit** (Phase 1 §3). TypeScript will not error if the renderer-side ambient type stays `Promise<void>` while the main process returns `Promise<boolean>`. The plan now enumerates all three surfaces that need updating (preload, renderer ambient, IpcChannels map).
- **Sentry instrumentation** (Phase 1 §1 + Phase 2 §7). `captureException` at real failure sites (persist, clear, load, bind, persist-after-callback, handler-catch) and `addBreadcrumb` at anomaly sites (state mismatch, forbidden origin, timeout). `apps/desktop/src/main/sentry.ts` is already initialized, so this is a handful of one-liners.
- **Serialize concurrent `beginSignIn`** (Phase 2 §5). Two rapid clicks previously spawned two loopback servers + two browser tabs. Module-scope in-flight promise returns the same handle to concurrent callers; `finally` clears on settle.
- **Sign-in timeout toast** (Phase 2 §6). The 5-minute settler previously resolved `null` with no UI signal; users saw the desktop revert to the pre-sign-in view and assumed their click was lost. Now surfaced as a toast.
- **Window focus on sign-in transition** (Phase 2 §6). After the bridge POSTs and `emit({ isSignedIn: true })` fires, the desktop window auto-`show()`/`focus()`es — but only on signed-out→signed-in *transitions*, not every emit, so token refreshes don't yank focus from whatever the user is doing.

Items 8-12 from the review ("Nice-to-have" and "Explicit scope punts") were deferred: cross-platform test paths, finer-grained bridge error reasons, `Content-Length` fast-reject, 24h JWT refresh, macOS keychain migration. None are shipping blockers; all are worth a follow-up ticket.

### Ground-truth pass (2026-04-24, second review)

Second adversarial pass spawned codebase-analyzer + codebase-pattern-finder to verify every file:line claim in the plan against HEAD. Three findings would have silently broken the implementation; the rest were line-reference corrections.

**Critical (would have silently broken)**

- **Sonner `<Toaster />` not mounted in the desktop renderer.** `apps/desktop/package.json:58` ships sonner but zero call sites + zero Toaster mount exist in `apps/desktop/src/renderer/**`. The plan's Phase 1 §4 (sign-out-failure toast) and Phase 2 §6 (sign-in-failure toast) would have compiled and called `toast()` with no visible effect. Phase 1 §4 now explicitly calls out the Toaster mount step, referencing the `apps/app/src/app/(app)/layout.tsx:3` pattern.
- **`Sentry.addBreadcrumb` for standalone anomalies is invisible.** Phase 2 §7 used `addBreadcrumb` for `state_mismatch`, `forbidden_origin`, `timeout`. Breadcrumbs only attach to a subsequent `captureException` in the same scope — a timeout settle doesn't throw, nothing captures, the breadcrumb vanishes. User confirmed: switch anomaly paths to `Sentry.captureMessage(msg, { level: "warning" })` so they surface as real Sentry events regardless of whether anything throws later. Real errors (bind, persist_failed, handler_error) stay on `captureException`.
- **Plan duplicated the existing `getApiOrigin()` helper.** `apps/desktop/src/main/auth-flow.ts:10-17` already had the exact dev-vs-prod origin helper the plan re-declared as `ALLOWED_ORIGIN`. User confirmed: reuse — Phase 2 §1 now reads `const ALLOWED_ORIGIN = getApiOrigin()`, with a comment noting that `index.ts:45-52` has a twin helper (`getApiOriginForCsp`) worth consolidating in a separate cleanup.

**High-value corrections**

- **Sign-out toast context-split: user-click vs UNAUTHORIZED auto-path.** `app-shell.tsx:26` is inside a `queryClient.getQueryCache().subscribe` callback reacting to every tRPC `UNAUTHORIZED`. If sign-out fails there and we toast, the same error re-fires on the next query and re-toasts — tight-loop spam. User confirmed: toast only on the user-clicked button at `app-shell.tsx:47`; the UNAUTHORIZED auto path gets `Sentry.captureException` with `scope: "app-shell.auto-sign-out"` and no user-visible feedback. Manual-verification step split into two to cover both paths independently.
- **IPC type-surface enumeration was wrong.** Plan listed three surfaces; only two exist. `IpcInvokeMap` doesn't exist in this repo — `apps/desktop/src/shared/ipc.ts:5-26` is a plain string-const object. The renderer ambient declaration isn't a `.d.ts` — it lives at `apps/desktop/src/renderer/src/main.ts:16-21` and references `LightfastBridge` from `shared/ipc.ts:106`, so editing the interface propagates automatically. Corrected to two surfaces: `shared/ipc.ts:106` (interface) + `preload/preload.ts:36` (binding, not `preload.ts` at root).
- **Biome rule name was wrong for Phase 3 suppression.** Plan referenced the ESLint rule name (`react-hooks/exhaustive-deps`). Biome's rule is `lint/correctness/useExhaustiveDependencies`. Plan now specifies the correct `// biome-ignore` comment with the right rule path.
- **Line references corrected.** `onAuthChanged` subscriber is at `index.ts:367-371`, not `~225`. IPC handler is at `index.ts:217-219`. Timeout-toast caller pinned to `apps/desktop/src/renderer/src/react/app-shell.tsx:38` (the sole call site).
- **Timeout toast wording generalized.** Original plan hardcoded "Sign-in timed out". The POST handler also settles `null` on state mismatch, bad body, and forbidden origin — same null return from the renderer's perspective. Changed to "Sign-in didn't complete — please try again" to cover all null-resolution paths honestly.

**Not changed**

- Phase 1 boolean return types, Phase 2 POST+CORS+PNA shape, Phase 3 `didStart` ref latch, Phase 4 expired-Bearer test — all verified against the code and stand.
- `@sentry/electron/main` import confirmed correct (matches `apps/desktop/src/main/sentry.ts:2`).
- Port 3024 dev origin confirmed correct (microfrontends port, not app's 4107).
- Zod is already imported in `auth-store.ts:1` — the new `callbackBodySchema` in `auth-flow.ts` follows existing precedent.

**Follow-up pass on overlooked edges**

- **Window focus gate now has a boot-skip sentinel.** Original gate (`prev false → next true`) correctly rejected token refreshes but accepted the app-boot transition where `load()` rehydrates a persisted token. That's also `false → true`, and firing `show()/focus()` during boot is either redundant (`createWindow()` already shows) or disruptive (yanks focus from a dock-minimized launch). Added a module-scope `hasEmittedOnce` sentinel that's set after the first subscriber call — subsequent transitions pass, the boot transition is skipped.
- **Added a signed-in-relaunch happy-path verification step in Phase 1.** Original manual checks covered sign-in-file-exists and sign-out-file-removed-stays-on-auth-gate, but not sign-in → quit → relaunch → remains signed in. That's the canonical path that catches a `load()` regression from the new auto-purge branches.
- **Flagged the `NODE_ENV` fallthrough in packaged Electron as a verification step.** `getApiOrigin()` falls through to `http://localhost:3024` when `NODE_ENV !== "production"`. Packaged Electron doesn't always set `NODE_ENV` at runtime; if unset in prod, origin check 403s on all real sign-ins. Pre-existing concern (the helper predates this plan), but Phase 2 makes it load-bearing for CORS. Added a verification step to confirm the logged origin matches expected prod value in a signed dev DMG before ship.

**Stage-coverage pass (third review)**

Walked every stage of sign-in and sign-out end-to-end, found three real gaps — the `hasEmittedOnce` sentinel I'd added in the previous pass was itself a bug.

- **Reverted the `hasEmittedOnce` boot-skip sentinel in Phase 2 §6.** It would have suppressed the legitimate first sign-in after a signed-out boot — `load()` does not emit, so the first emit is always a user action, not a boot-rehydrate. The real issue was the initial value of `prev`: defaulting to `false` meant a boot-signed-in token refresh looked like a `false → true` transition and would yank focus. Correct fix: initialize `prev = Boolean(getSnapshot().isSignedIn)` at subscriber-attach time, so the transition detector reflects boot reality. All four transition cases now resolve correctly (see Phase 2 §6).
- **Added web-side Sentry observation to the bridge's error paths (Phase 2 §2).** Without it, a prod-only CORS / preflight regression (e.g. `NODE_ENV` fallthrough, misconfigured `Access-Control-Allow-Private-Network`) shows as a silent "Authentication Failed" on the user's browser tab with zero Sentry signal — the desktop's handler never runs because the browser rejected the preflight. Now: `captureMessage(..., "warning")` for `buildPostCallback` returning null and non-2xx responses (with status code as a tag), `captureException` for fetch `TypeError` (network-level block). Matches the Phase 2 §7 `captureMessage` / `captureException` split on the desktop side.
- **Pinned the UNAUTHORIZED auto-sign-out Sentry wiring as code in Phase 1 §4.** Previous draft described the behavior ("`Sentry.captureException`, no toast") but didn't show the `.then((ok) => { if (!ok) Sentry.captureException(...) })` shape. Now both the user-click and UNAUTHORIZED sites have exact code snippets so an implementer can drop them in verbatim. Also pinned the Sentry import source — renderer uses `@sentry/browser` per `renderer/src/main.ts:32-36`, not `@sentry/electron/renderer`.

**Gaps identified but deferred (noted in code comments, not blocking)**

- **`window.close()` on success panel.** Can't reliably close a tab opened via `shell.openExternal` (browser blocks JS-close on non-JS-opened tabs). Bridge's success panel can attempt it as a best-effort, but must not rely on it. Plan now mentions this in Phase 2 §2.
- **No client-side timeout on `getToken()`.** If Clerk hangs, the bridge shows "Authenticating…" indefinitely until the desktop's 5-minute timer fires. Not shipping-blocking; worth a follow-up ticket with a 30-second bridge-side timeout.
- **Concurrent `auth.signOut` calls.** No serialization — relies on `rmSync` with `force: true` being idempotent on ENOENT. Works but not explicitly documented. If a future change to `clearPersisted()` ever loses the `force: true`, concurrent sign-outs would race. Noted as implementation invariant.

### Bug-focused pass (fourth review, 2026-04-24)

Fourth review ran codebase-analyzer + codebase-pattern-finder against every code snippet in the plan, focused on "does this compile and run correctly against HEAD". Nine bugs would have slowed or broken the implementation; all are now fixed in the plan. Groupings by severity.

**Critical (would have broken the build or spammed Sentry)**

- **`@repo/ui` is not a dependency of `apps/desktop`.** Phase 1 §4 instructed the implementer to `import { Toaster } from "@repo/ui/components/ui/sonner"` in the desktop renderer — that package is not in `apps/desktop/package.json` deps, so module resolution would fail at build time. `sonner` **is** a direct dep (line 58), so switched to `import { Toaster, toast } from "sonner"`. Applies to both the Toaster mount and the `toast.error(...)` call sites.
- **`clearTimeout` identifier name drift.** Phase 1 §2's refactored `settle()` called `clearTimeout(timeoutHandle)`, but the existing auth-flow.ts uses a local `timer` (`const timer = setTimeout(...)` at line 101 per verification). Renamed to `clearTimeout(timer)` and added an inline note so the implementer doesn't get tripped up if they've already started an independent rename.
- **UNAUTHORIZED-path Sentry would cascade without a latch.** Phase 1 §4 correctly removed toasts from the UNAUTHORIZED auto-sign-out subscriber to prevent tight-loop spam, then introduced `Sentry.captureException(...)` in the same subscriber. Every UNAUTHORIZED query while sign-out is failing would fire one Sentry event — the SDK rate-limits but the project's monthly ingest would drain during an outage. Added a module-scope `signoutFailureReported` boolean latch that caps reports at one per session. Reset to `false` on a successful sign-in via the Phase 2 `.then(token => ...)` handler so subsequent outages re-report.

**High (would have caused friction or inconsistency)**

- **apps/app Sentry import style mismatched existing code.** Phase 2 §2 and §7 used `import * as Sentry from "@sentry/nextjs"` with namespace calls. Existing apps/app call sites (`session-activator.tsx:4`, `oauth-button.tsx:6`) use **named** imports (`import { addBreadcrumb, startSpan } from "@sentry/nextjs"`). The plan's hint "grep for `import * as Sentry`" returned zero hits, leaving the implementer guessing. Switched to named imports: `import { captureException, captureMessage } from "@sentry/nextjs"`. Desktop main and renderer stay on namespace style to match their pre-existing imports; the cross-package inconsistency is pre-existing and out of scope to unify.
- **`node:http` import split from existing statement.** Phase 2 §1 added `import type { IncomingMessage, ServerResponse } from "node:http"` as a fresh line, but the existing file already imports from `node:http` (line 2). Biome's style rules auto-merge; leaving split imports would flag on the pre-commit check. Consolidated into a single statement with `createServer`, `type IncomingMessage`, `type Server`, `type ServerResponse`.
- **`createWindow()` rationale claim was false.** Phase 2 §6 justified the boot-signed-in no-focus case by saying "`createWindow()` already shows the window", but `windows/factory.ts:139` actually defers `show()` to `win.once("ready-to-show", () => win.show())`. The prescribed behavior (seeding `prev = Boolean(getSnapshot().isSignedIn)`) is still correct; only the rationale comment was misleading. Reworded to reference `ready-to-show` so a future reader doesn't chase a non-existent `win.show()` call.

**Improvements (tightens the implementation but wouldn't have broken anything)**

- **403 Forbidden origin path omits CORS headers intentionally.** Phase 2 §1's forbidden-origin branch writes 403 before `applyCors(res)` runs, so browsers render this as an opaque "CORS error" rather than confirming which origins are allowed — deliberate defense-in-depth. Added an inline comment in the code snippet so a future debugger doesn't misread the behavior as a missing CORS fix.
- **`readJsonBody` didn't `req.destroy()` on size overflow.** The handler throws when the request body exceeds 16 KB, but the TCP socket remained open until the client closed it — a trivial local-port-hold vector. Added `req.destroy()` before throwing. Cost is zero for legitimate clients (JWTs are <4 KB); closes the socket immediately on any oversized POST.
- **`beginSignIn` IIFE wrapping needed explicit `return await`.** Phase 2 §5's in-flight-promise guard wrapped the existing `beginSignIn` body inside an async IIFE with `try { ... } finally { inflight = null }`, but the snippet didn't show the critical `return await new Promise<...>(...)` inside. Without the explicit `return`, the IIFE resolves with `undefined` and the `finally` clears `inflight` before the server ever settles — every concurrent call starts its own flow anyway, defeating the guard. Plan now shows the full IIFE shape with the required `return await`.

**Not changed by this pass**

- Phase 1 booleans, auto-purge branches, Phase 2 POST+CORS+PNA shape, Phase 3 `didStart` ref latch, Phase 4 expired-Bearer test — all verified against the code and stand.
- Cross-package Sentry import style (namespace in desktop main/renderer, named in apps/app) — documented as pre-existing, not unified.
- Concurrency model for `beginSignIn` inflight guard — correct as structured, just needed the IIFE return shape clarified.
