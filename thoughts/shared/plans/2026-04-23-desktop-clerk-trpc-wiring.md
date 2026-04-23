# Desktop Clerk Auth + tRPC Wiring Implementation Plan

## Overview

Wire Clerk authentication and tRPC into `apps/desktop` (Electron Forge app). Single shared router (`@api/app`) serves both web (cookie auth) and desktop (Bearer JWT auth). Desktop signs in via system-browser OAuth → custom-protocol deep-link (`lightfast://auth/callback`) → JWT stored in Electron `safeStorage`. Renderer uses React + `@repo/app-trpc` with a new `DesktopTRPCProvider`.

End-to-end validation: run `pnpm dev:desktop-stack` (new script — boots `dev:full` + the microfrontends proxy in one process) and `pnpm dev:desktop` concurrently. The microfrontends mesh runs on `http://localhost:3024` and fronts `apps/app` at 4107 + `apps/www` at 4101 (platform at 4112 is **not** in the mesh — it's a separate service at `platform.lightfast.ai`). Desktop signs in, calls `account.get` on the real API, renders the authenticated user's profile.

> **Origin note**: both the tRPC route handler's CORS (`apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:13–16`) and the prod `https://lightfast.ai` single-origin shape assume **microfrontends-mesh origin**, not the raw `apps/app` port. Desktop must hit `http://localhost:3024` in dev and `https://lightfast.ai` in prod. Hitting `http://localhost:4107` directly from the Electron renderer would fail CORS.

> **Critical dev-stack note**: `pnpm dev:full` alone does NOT start the 3024 mesh — it only boots apps at 4107/4101/4112. Port 3024 requires the `microfrontends proxy --port 3024` command defined in `apps/app/package.json:13`, which is not in any turbo pipeline today. Phase 6.3 adds a root `dev:desktop-stack` script that runs both concurrently.

## Current State Analysis

### What exists

- **`apps/desktop`** — Electron Forge app with hardened main process. Renderer is vanilla TS (no React, no HTTP client, no state lib).
  - `src/main/protocol.ts:3,26–53` — `lightfast://` protocol already registered via `app.setAsDefaultProtocolClient`; deep-link delivery already wired (`open-url`, `second-instance`, initial argv). `onDeepLink()` callback queues URLs until a handler is registered.
  - `src/main/index.ts:321–329` — current deep-link handler *misroutes* the URL onto `IpcChannels.openExternal` broadcast to every window. This is clearly a placeholder and will be replaced with a dedicated auth-callback channel.
  - `src/main/index.ts:43–76` — CSP. Dev `connect-src`: `'self' ${origin} ${wsOrigin}`. Production: `'self'` only. **Missing** API origin and Clerk frontend API.
  - `src/main/settings-store.ts` — raw JSON I/O into `userData/settings.json`, zod-validated. Pattern to mirror for token storage via `safeStorage`.
  - `src/shared/ipc.ts:5–22` — central `IpcChannels` enum. Add auth channels here.
  - `src/shared/ipc.ts:93–121` — `LightfastBridge` interface exposed via `contextBridge.exposeInMainWorld("lightfastBridge", ...)` in `src/preload/preload.ts:72`.
  - `forge.config.ts:78–83` — `CFBundleURLTypes` already declares the `lightfast` URL scheme on macOS.
  - `tsconfig.json:6` — `jsx: "preserve"`. Needs switch to `"react-jsx"` for React.
  - `vite.renderer.config.ts` — no React plugin, no `import.meta.env` usage, no `vite-env.d.ts`.
  - `src/renderer/index.html` — single `<div id="app">` root. Hash router at `src/renderer/src/router.ts` with `"home" | "settings"` routes.

- **`packages/app-trpc`** — 80% desktop-ready.
  - `src/react.tsx:18–21,79,91–94` — `TRPCReactProvider` already accepts `{ baseUrl, getAuthHeaders }`. Only blockers: `getAuthHeaders` is sync-only, and `credentials: 'include'` is hardcoded on line 98 (harmless cross-origin from Electron, but we'll gate it anyway).
  - `src/client.ts` — transport-agnostic QueryClient. Reusable as-is.
  - `src/server.tsx` — Next.js RSC only (imports `next/headers`). Desktop does not use this.
  - `src/types.ts` — `RouterInputs`/`RouterOutputs` type exports. Reusable.
  - `package.json` — `exports` entries: `./client`, `./server`, `./react`, `./hooks`, `./types`. We will add `./desktop`.

- **`api/app/src/trpc.ts`** — cookie-only today but structurally ready.
  - Line 58 — `createTRPCContext(opts: { headers: Headers })`. Headers-in; caller (`route.ts:46`) passes full request headers.
  - Line 59 — `await auth({ treatPendingAsSignedOut: false })` — the single cookie-coupled call. Replace with a thin resolver that tries Bearer first.
  - `AuthContext` discriminated union (lines 21–37), `publicProcedure`, `userScopedProcedure`, `orgScopedProcedure`, and `verifyOrgMembership` are all transport-agnostic and stay as-is.
  - `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:28` — CORS already allows `authorization` header. Runtime is `nodejs`.

- **`@vendor/clerk/server`** (`vendor/clerk/src/server.ts:49–61`) — already re-exports `verifyToken` from `@clerk/nextjs/server`. `verifyToken(jwt, { secretKey })` is pure (no Next.js request context required). `CLERK_SECRET_KEY` is already in the env schema (`vendor/clerk/src/env.ts:8`).

- **Existing browser→client bridge pattern**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx:1–97` — CLI sign-in page that calls `useAuth().getToken()` and redirects to a local URL with `?token=...&state=...`. We will mirror this pattern for desktop, swapping the localhost port redirect for `lightfast://auth/callback`.

- **Smoke-test procedure**: `api/app/src/router/user/account.ts:29–59` — `account.get` on `userScopedProcedure` returns the signed-in user's Clerk profile. Desktop will call this post-auth.

### Key constraints

- **Clerk session JWTs are short-lived (~60s by default)**. For desktop we use a Clerk **JWT template** (configured in Clerk Dashboard) named `lightfast-desktop` with 1h expiry, embedding `org_id`. Web-side desktop auth page calls `getToken({ template: "lightfast-desktop" })`. On expiry, Phase 7 silently re-issues via a hidden BrowserWindow — Clerk's persisted session cookie (in the `persist:lightfast-auth` partition) is valid for days.
- **Single-instance lock must be active before deep-link delivery**. Already present (`src/main/bootstrap.ts:13`).
- **CSRF protection on the auth callback**: Since we intercept `lightfast://auth/callback` inside our own BrowserWindow (not via OS-level protocol handler for the happy path), third-party apps invoking `lightfast://auth/callback?token=STOLEN_JWT` can never reach us through the sign-in flow. Defense-in-depth: we still generate a cryptographically random `state` per sign-in and reject callbacks that don't match. The OS-level protocol handler (still registered for external deep-links) is now auth-neutral.
- **tRPC v11 `httpBatchStreamLink.headers`** supports both sync and async return values (Promise). Widening the `getAuthHeaders` signature is a zero-risk change.
- **Electron session partitioning**: `session.fromPartition("persist:lightfast-auth")` persists cookies to disk under `userData/Partitions/lightfast-auth`, isolated from the user's default browser. This is why sign-in works inside a BrowserWindow but `shell.openExternal` can never be silent — system Safari/Chrome cookies are unreachable from Electron.

## Desired End State

- Running `pnpm dev:desktop-stack` (mesh + apps at 3024) + `pnpm dev:desktop` concurrently:
  1. Desktop launches, renders a "Sign in with Lightfast" button in the primary window (React).
  2. Clicking the button opens a **visible Electron BrowserWindow** to `http://localhost:3024/desktop/auth?state=...` — bound to the `persist:lightfast-auth` session partition.
  3. BrowserWindow completes Clerk sign-in (cookie path, existing flow), calls `getToken({ template: "lightfast-desktop" })`, redirects to `lightfast://auth/callback?token=...&state=...`.
  4. Main process intercepts via `session.webRequest.onBeforeRequest` before the protocol escapes to the OS.
  5. Main process validates `state`, stores JWT via `safeStorage.encryptString`, closes the BrowserWindow, notifies renderer via IPC.
  6. Renderer flips to "signed in" state, calls tRPC `account.get` with `Authorization: Bearer <jwt>`, renders the profile.
  7. On token expiry (Phase 7), a hidden BrowserWindow in the same partition silently re-issues — user sees nothing.
- Server-side: `/api/trpc` accepts Bearer tokens for desktop clients and existing cookies for web; single `AuthContext` union, identical procedures.
- Web flows (sign-in, sign-up, any existing cookie-based session) are **unchanged**.

### Verification

- `pnpm --filter @api/app typecheck` and `pnpm --filter @repo/app-trpc typecheck` pass.
- `pnpm --filter @lightfast/desktop typecheck` passes.
- `pnpm --filter app test` (Clerk context tests) passes including new Bearer-path unit tests.
- Manual E2E: desktop signs in, `account.get` returns the user's Clerk profile, sign-out clears the token from keychain.

### Key Discoveries

- `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:28` already whitelists `authorization` header in CORS — zero CORS changes needed **as long as the desktop hits `http://localhost:3024` (microfrontends origin, already whitelisted at line 15) or `https://lightfast.ai` (prod)**. Hitting the raw `apps/app` port (4107) would require adding it to `allowedOrigins`; we deliberately avoid this to keep the dev/prod story single-origin.
- `@vendor/clerk/server` already re-exports `verifyToken` (`vendor/clerk/src/server.ts:60`) — no new dep on `@clerk/backend`.
- `apps/desktop/forge.config.ts:78–83` already registers `CFBundleURLTypes` for `lightfast://` — no packager changes.
- `apps/desktop/src/main/protocol.ts` already handles deep-link edge cases (initial argv, macOS `open-url`, `second-instance`).
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx` is the exact template for the desktop auth web page.

## What We're NOT Doing

- **Not introducing React in HUD or secondary windows.** Only the primary window gets React + tRPC this iteration.
- **Not refactoring the hash router.** Settings screen and existing vanilla TS UI stay.
- **Not building an in-app sign-up flow.** The sign-in BrowserWindow loads Clerk's existing web UI — sign-up is handled there without any desktop-side work.
- **Not adding biometric unlock / Touch ID gates.** `safeStorage` (keychain-backed) is the storage layer; no extra UX.
- **Not implementing Clerk webhook handling for session revocation.** If silent refresh fails (Clerk session itself invalidated), desktop clears the token and re-prompts sign-in.
- **Not adding `orgScopedProcedure` usage to desktop this iteration.** Org switching UX lands after the end-to-end Bearer path is proven.
- **Not refactoring `@repo/app-trpc`'s RSC surface.** `server.tsx` stays Next-only.
- **Not changing the observability `@vendor/observability/trpc` middleware's auth extraction** — it reads from `ctx.auth` which is unchanged.
- **Not using `shell.openExternal` for sign-in.** The system browser's cookie jar is unreachable from Electron, so using it would force hourly re-auth. The BrowserWindow flow is confirmed viable by the spike (see Improvement Log) and is a first-class design decision.

## Implementation Approach

Seven discrete, independently-landable phases. Phases 1–3 are safe to merge before any desktop changes exist (web is unaffected). Phase 4 introduces desktop main-process auth + BrowserWindow sign-in + CSP. Phase 5 introduces React in the renderer + 401 handling. Phase 6 closes the dev loop and documents setup. Phase 7 (silent refresh) wires the already-implemented `silentRefresh()` in front of the 401 handler — the spike proved it works; Phase 7 is just the renderer-side hookup.

---

## Phase 1: Server — Bearer token support in `createTRPCContext`

### Overview

Extend `api/app/src/trpc.ts` `createTRPCContext` to accept `Authorization: Bearer <jwt>` in addition to Clerk cookies. Zero changes to `AuthContext`, procedures, or any caller.

### Changes Required

#### 1.1 Add `resolveClerkSession` helper

**File**: `api/app/src/trpc.ts`
**Changes**: Add a private helper above `createTRPCContext` that unifies cookie + Bearer paths. Call it from `createTRPCContext` instead of `auth()`.

```ts
import { auth, verifyToken } from "@vendor/clerk/server";
import { clerkEnvBase } from "@vendor/clerk/env";

type ResolvedSession =
  | { userId: string; orgId: string | null }
  | null;

async function resolveClerkSession(headers: Headers): Promise<ResolvedSession> {
  const authHeader = headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const jwt = match[1];
    try {
      const claims = await verifyToken(jwt, {
        secretKey: clerkEnvBase.CLERK_SECRET_KEY,
      });
      const userId = typeof claims.sub === "string" ? claims.sub : null;
      if (!userId) return null;
      const orgId =
        typeof (claims as { org_id?: unknown }).org_id === "string"
          ? ((claims as { org_id: string }).org_id)
          : null;
      return { userId, orgId };
    } catch {
      // Invalid/expired JWT — fall through to unauthenticated
      return null;
    }
  }

  const cookieSession = await auth({ treatPendingAsSignedOut: false });
  if (!cookieSession.userId) return null;
  return {
    userId: cookieSession.userId,
    orgId: cookieSession.orgId ?? null,
  };
}
```

#### 1.2 Swap the `auth()` call in `createTRPCContext`

**File**: `api/app/src/trpc.ts:58–88`
**Changes**: Replace the body of `createTRPCContext` with a call to `resolveClerkSession(opts.headers)` that feeds the same `AuthContext` union.

```ts
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await resolveClerkSession(opts.headers);

  if (session) {
    if (session.orgId) {
      return {
        auth: {
          type: "clerk-active" as const,
          userId: session.userId,
          orgId: session.orgId,
        },
        db,
        headers: opts.headers,
      };
    }
    return {
      auth: { type: "clerk-pending" as const, userId: session.userId },
      db,
      headers: opts.headers,
    };
  }

  return {
    auth: { type: "unauthenticated" as const },
    db,
    headers: opts.headers,
  };
};
```

#### 1.3 Extend observability middleware `x-trpc-source` handling (optional)

**File**: `api/app/src/trpc.ts:146–159`
**Changes**: None required — `x-trpc-source` values are free-form labels. Existing middleware records whatever the client sends.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app typecheck` passes
- [~] `pnpm --filter @api/app build` — N/A (package has no `build` script; only `test` + `typecheck`)
- [~] `pnpm --filter app check` — filter name is `@lightfast/app`, no `check` script; ran `pnpm --filter @lightfast/app typecheck` (pass) + `pnpm --filter @lightfast/app test` (60 passed)
- [x] New unit test(s) added under `api/app/src/__tests__/resolve-clerk-session.test.ts` covering:
  - valid Bearer JWT with `org_id` → `clerk-active`
  - valid Bearer JWT without `org_id` → `clerk-pending`
  - invalid Bearer JWT → falls through to cookie path
  - no auth headers → `unauthenticated`
- [x] `pnpm --filter @api/app test` passes (5 passed)

#### Manual Verification

Automated via the new `lightfast-clerk` skill (`.agents/skills/lightfast-clerk/`):

- [x] `curl -H "Authorization: Bearer <lightfast-desktop-jwt>" http://localhost:3024/api/trpc/account.get?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D` returns **HTTP 200** with the user's full Clerk profile JSON (`id`, `primaryEmailAddress`, `imageUrl`, etc.). Verified via `.agents/skills/lightfast-clerk/command/curl.sh -t lightfast-desktop claude-default account.get`.
- [~] `curl -H "Authorization: Bearer garbage" …` — **does not return a clean UNAUTHORIZED**. Clerk middleware (`proxy.ts:72-80`) intercepts before the tRPC route runs. Three distinct failure shapes observed:
  - `Bearer foo` (non-JWT) → **307** to `/sign-in` (middleware treats as no auth)
  - `Bearer eyJX.eyJX.eyJX` (JWT-shaped, unparseable) → **500** (middleware throws during parse)
  - Valid JWT with truncated signature → **307** to `/sign-in`
  - No `Authorization` header → **307** to `/sign-in`
  
  **Implication for Phase 5**: the renderer's 401 handler (subscribes for `code === "UNAUTHORIZED"`) will not fire on these. Options: (a) expand the handler to treat 307/500 as re-auth signals, or (b) add `/api/trpc/(.*)` to `isApiRoute` in `proxy.ts` so middleware skips auth and the route returns a proper `UNAUTHORIZED`. Flag as Phase 4-5 follow-up; Phase 1 itself is correct.
- [ ] Log into `apps/app` via browser (cookie path) — existing tRPC calls still work (regression check). **Not verified from CLI** — Phase 1 touches `trpc.ts` `createTRPCContext` which is still called with the Clerk cookie when present, and the unit tests cover that cookie-path case (mocked `auth()`). User-level browser regression is out of this phase's scope.

**Implementation Note**: Phase 1 verified. The middleware-level error-shape question is a Phase 4-5 concern documented above; the `resolveClerkSession` helper and the Bearer happy path are green.

---

## Phase 2: `@repo/app-trpc` — async auth headers + desktop provider

### Overview

Two surgical edits to `react.tsx` and one new `desktop.tsx` entry. No changes to `client.ts`, `server.tsx`, or `types.ts`.

### Changes Required

#### 2.1 Widen `getAuthHeaders` to support async + gate `credentials`

**File**: `packages/app-trpc/src/react.tsx`
**Changes**:

- Line 18–21: widen `getAuthHeaders` return type.
- Line 91–94: `headers` callback becomes `async` and awaits the result.
- Line 95–100: make `credentials: 'include'` conditional — omit when the request URL origin differs from the document origin (or always-omit when no document exists).

```ts
// Line 18–21
export interface CreateTRPCReactProviderOptions {
  baseUrl?: string;
  getAuthHeaders?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;
}

// Line 88–100 — updated link config
httpBatchStreamLink({
  transformer: SuperJSON,
  url: `${baseUrl}/api/trpc`,
  headers: async () => ({
    "x-trpc-source": "client",
    ...((await options?.getAuthHeaders?.()) ?? {}),
  }),
  fetch(url, init) {
    const sameOrigin =
      typeof window !== "undefined" &&
      new URL(url.toString(), window.location.origin).origin ===
        window.location.origin;
    return fetch(url, {
      ...init,
      credentials: sameOrigin ? "include" : "omit",
    } as RequestInit);
  },
}),
```

#### 2.2 Add `DesktopTRPCProvider`

**File**: `packages/app-trpc/src/desktop.tsx` (new)
**Changes**: New file — thin wrapper that takes `baseUrl` as a required prop (the shared package stays transport-agnostic and does NOT read Vite env vars directly) and reads the JWT from `window.lightfastBridge.auth.getToken()`. Sets `x-trpc-source: "desktop"` by returning it from `getAuthHeaders`. No `"use client"` directive — Electron has no RSC boundary, so the directive would be dead signal.

```tsx
import type { ReactNode } from "react";
import { TRPCReactProvider } from "./react";

interface DesktopTRPCProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export function DesktopTRPCProvider({ children, baseUrl }: DesktopTRPCProviderProps) {
  return (
    <TRPCReactProvider
      options={{
        baseUrl,
        getAuthHeaders: async () => {
          const token = await window.lightfastBridge.auth?.getToken();
          const headers: Record<string, string> = {
            "x-trpc-source": "desktop",
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          return headers;
        },
      }}
    >
      {children}
    </TRPCReactProvider>
  );
}
```

> **Why no env read in shared package**: coupling `@repo/app-trpc` to `VITE_LIGHTFAST_API_URL` makes the package Vite-specific. Consumers should own env resolution — `apps/desktop` reads `import.meta.env.VITE_LIGHTFAST_API_URL` at its entrypoint and passes the result as a prop. This keeps the package reusable for any bundler.

#### 2.3 Add `./desktop` export

**File**: `packages/app-trpc/package.json`
**Changes**: Add `"./desktop"` entry to `exports`.

```json
"exports": {
  "./client": { "default": "./src/client.ts" },
  "./server": { "default": "./src/server.tsx" },
  "./react":  { "default": "./src/react.tsx" },
  "./desktop": { "default": "./src/desktop.tsx" },
  "./hooks":  { "default": "./src/hooks/use-active-org.ts" },
  "./types":  { "default": "./src/types.ts" }
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-trpc typecheck` passes
- [~] `pnpm --filter @repo/app-trpc build` — no build script exists in `packages/app-trpc/package.json` (only `clean` + `typecheck`); typecheck stands in.
- [x] `apps/app` still typechecks (`pnpm --filter @lightfast/app typecheck`) — async `getAuthHeaders` change is backwards-compatible. (Package name is `@lightfast/app`, not `app`.)

#### Manual Verification

- [ ] `apps/app` in browser still loads and hydrates tRPC queries (regression). _Deferred — best paired with Phase 3/6 mesh testing._
- [x] `import { DesktopTRPCProvider } from "@repo/app-trpc/desktop"` resolves — `./desktop` entry is present in `packages/app-trpc/package.json` exports and TS typecheck passes for any consumer.

---

## Phase 3: Web — shared `ClientAuthBridge` + `/desktop/auth` route

### Overview

The existing `cli-auth-client.tsx` and a new desktop bridge share ~90% of their logic: same `useAuth` flow, same status machine, same Suspense wrapper, same error UI. Rather than duplicate, extract a shared `ClientAuthBridge` component that both CLI and desktop consume. This collapses two sibling components into one and makes the pattern reusable for any future OAuth bridge (e.g., VS Code extension, other CLIs).

### Changes Required

#### 3.1 Extract shared `ClientAuthBridge`

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx` (new)

Generic bridge taking a `buildRedirectUrl` callback and an optional `jwtTemplate`. Contains all the status/UI logic from the current `cli-auth-client.tsx`.

```tsx
"use client";

import { useAuth } from "@vendor/clerk/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

export interface ClientAuthBridgeProps {
  /**
   * Build the redirect URL given the Clerk token.
   * Return null to signal invalid/missing required params — bridge renders error.
   */
  buildRedirectUrl: (args: {
    token: string;
    searchParams: URLSearchParams;
  }) => string | null;

  /** Optional Clerk JWT template. Omit for default session JWT (CLI uses default). */
  jwtTemplate?: string;

  /** Title shown while authenticating/redirecting. */
  title: string;

  /** Body copy under the title. */
  subtitle: string;

  /** Optional loading UI override (defaults to title+subtitle). */
  fallback?: ReactNode;
}

function BridgeContent(props: ClientAuthBridgeProps) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">(
    "loading"
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const token = await getToken(
          props.jwtTemplate ? { template: props.jwtTemplate } : undefined
        );
        if (!token) {
          setStatus("error");
          return;
        }
        const url = props.buildRedirectUrl({ token, searchParams });
        if (!url) {
          setStatus("error");
          return;
        }
        setStatus("redirecting");
        window.location.href = url;
      } catch {
        setStatus("error");
      }
    })();
  }, [isLoaded, isSignedIn, getToken, props, searchParams]);

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <h1 className="font-semibold text-xl">Authentication Failed</h1>
          <p className="mt-2 text-muted-foreground">
            Invalid parameters. Please try again from the Lightfast app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="text-center">
        <h1 className="font-semibold text-xl">
          {status === "redirecting" ? "Opening Lightfast…" : props.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{props.subtitle}</p>
      </div>
    </div>
  );
}

export function ClientAuthBridge(props: ClientAuthBridgeProps) {
  return (
    <Suspense fallback={props.fallback ?? null}>
      <BridgeContent {...props} />
    </Suspense>
  );
}
```

#### 3.2 Refactor `cli-auth-client.tsx` to use the bridge

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx`
**Changes**: Replace the entire file with a thin ~20-line consumer of `ClientAuthBridge`. No functional change to the CLI flow.

```tsx
"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

export function CLIAuthClient() {
  return (
    <ClientAuthBridge
      title="Authenticating…"
      subtitle="You'll be redirected back to the CLI shortly."
      buildRedirectUrl={({ token, searchParams }) => {
        const port = searchParams.get("port");
        const state = searchParams.get("state");
        if (!port || !state) return null;
        const portNum = Number.parseInt(port, 10);
        if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
          return null;
        }
        return `http://localhost:${portNum}/callback?token=${encodeURIComponent(
          token
        )}&state=${encodeURIComponent(state)}`;
      }}
    />
  );
}
```

#### 3.3 Add `/desktop/auth` route

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/page.tsx` (new)

```tsx
import { DesktopAuthClient } from "./_components/desktop-auth-client";

export default function DesktopAuthPage() {
  return <DesktopAuthClient />;
}
```

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx` (new)

```tsx
"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

export function DesktopAuthClient() {
  return (
    <ClientAuthBridge
      title="Authenticating…"
      subtitle="You'll be redirected back to the desktop app shortly."
      jwtTemplate="lightfast-desktop"
      buildRedirectUrl={({ token, searchParams }) => {
        const state = searchParams.get("state");
        if (!state) return null;
        return `lightfast://auth/callback?token=${encodeURIComponent(
          token
        )}&state=${encodeURIComponent(state)}`;
      }}
    />
  );
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/app typecheck` passes. (Package name is `@lightfast/app`, not `app`.)
- [x] `pnpm --filter @lightfast/app build:dev` passes — Next.js build discovers the new page. Route manifest shows both `ƒ /cli/auth` and `ƒ /desktop/auth`.

#### Manual Verification

- [ ] Visiting `http://localhost:4107/desktop/auth?state=abc123` when already signed in attempts a redirect to `lightfast://auth/callback?...`. _Deferred to Phase 6 end-to-end verification — meaningful only once the desktop app registers the `lightfast://` protocol handler (Phase 4)._

---

## Phase 4: Desktop main process — auth store, BrowserWindow sign-in, IPC, CSP

### Overview

Main process changes: store tokens in `safeStorage`, drive sign-in via an Electron `BrowserWindow` with a persistent partition (confirmed viable by spike, see Improvement Log), expose auth surface on `LightfastBridge`, extend CSP for API + Clerk origins. The custom `lightfast://` protocol handler (`protocol.ts`) is kept as an external-deep-link fallback but is **not** load-bearing for the sign-in happy path — we intercept `lightfast://auth/callback` inside the BrowserWindow via `session.webRequest.onBeforeRequest`, so the callback never escapes to the OS.

> **Why BrowserWindow instead of `shell.openExternal`**: Electron BrowserWindow partitions have their own cookie jar, separate from the user's default browser. Using `shell.openExternal` means Clerk's session cookie lives in Chrome/Safari and is unreachable from Electron — forcing the user to click "Sign in" every time the JWT expires (~1h). Driving sign-in through an in-Electron BrowserWindow (visible on first sign-in, hidden for silent refresh in Phase 7) persists Clerk's session cookie to Electron's userData, enabling seamless JWT refresh for the lifetime of the Clerk session (days). The spike report (179 LOC, zero new deps) is the evidence base.

### Changes Required

#### 4.1 Auth store with `safeStorage`

**File**: `apps/desktop/src/main/auth-store.ts` (new)

Mirrors `settings-store.ts` faithfully: Zod-validated on read, try/catch on write with `console.error`, `safeStorage` encrypts payload at rest.

```ts
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import { z } from "zod";

const persistedSchema = z.object({
  token: z.string().min(1),
  savedAt: z.number().int().positive(),
});
type Persisted = z.infer<typeof persistedSchema>;

export interface AuthSnapshot {
  isSignedIn: boolean;
}

let memory: string | null = null;
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

function storePath(): string {
  return join(app.getPath("userData"), "auth.bin");
}

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
      console.error("auth-store: invalid persisted payload", parsed.error);
      return null;
    }
    memory = parsed.data.token;
    return memory;
  } catch (err) {
    console.error("auth-store: failed to load", err);
    return null;
  }
}

function persist(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error("auth-store: safeStorage unavailable; refusing to write plaintext");
    return;
  }
  try {
    const payload: Persisted = { token, savedAt: Date.now() };
    const buf = safeStorage.encryptString(JSON.stringify(payload));
    writeFileSync(storePath(), buf);
    memory = token;
  } catch (err) {
    console.error("auth-store: failed to persist", err);
  }
}

function clearPersisted(): void {
  memory = null;
  try {
    rmSync(storePath(), { force: true });
  } catch (err) {
    console.error("auth-store: failed to remove", err);
  }
}

function emit(): void {
  const snapshot: AuthSnapshot = { isSignedIn: memory !== null };
  for (const listener of listeners) listener(snapshot);
}

export function getAuthSnapshot(): AuthSnapshot {
  if (memory === null) load();
  return { isSignedIn: memory !== null };
}

export function getToken(): string | null {
  if (memory === null) load();
  return memory;
}

export function setToken(token: string): void {
  persist(token);
  emit();
}

export function signOut(): void {
  clearPersisted();
  emit();
}

export function onAuthChanged(
  listener: (snapshot: AuthSnapshot) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

#### 4.2 BrowserWindow-based sign-in flow

**File**: `apps/desktop/src/main/auth-flow.ts` (new)

Spike-validated pattern (`.claude/worktrees/agent-a99c5cfc/apps/desktop/src/main/auth-flow-spike.ts` is the reference implementation). Opens a `BrowserWindow` bound to the `persist:lightfast-auth` session partition, navigates to `/desktop/auth?state=<hex>`, and intercepts the `lightfast://auth/callback` redirect via BOTH `will-navigate` and `session.webRequest.onBeforeRequest` (dual-channel because programmatic `window.location =` navigations don't always fire `will-navigate` reliably). Exported in two flavors — `beginSignIn()` (visible, first sign-in) and `silentRefresh()` (hidden, used in Phase 7).

```ts
import { randomBytes } from "node:crypto";
import { BrowserWindow, session } from "electron";
import { setToken } from "./auth-store";

const API_ORIGIN =
  process.env.LIGHTFAST_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://lightfast.ai"
    : "http://localhost:3024"); // microfrontends mesh, NOT raw apps/app (4107)

const CALLBACK_SCHEME = "lightfast";
const PARTITION = "persist:lightfast-auth";
const SIGNIN_TIMEOUT_MS = 5 * 60_000; // visible flow — user-paced
const REFRESH_TIMEOUT_MS = 30_000; // hidden flow — must fail fast

interface CallbackResult {
  token: string;
  state: string;
}

function parseCallback(url: string): CallbackResult | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${CALLBACK_SCHEME}:`) return null;
    if (parsed.host !== "auth") return null;
    if (parsed.pathname !== "/callback") return null;
    const token = parsed.searchParams.get("token");
    const state = parsed.searchParams.get("state");
    if (!token || !state) return null;
    return { token, state };
  } catch {
    return null;
  }
}

async function runAuthWindow(options: {
  visible: boolean;
  timeoutMs: number;
}): Promise<string | null> {
  const state = randomBytes(32).toString("hex");
  const partition = session.fromPartition(PARTITION);
  const win = new BrowserWindow({
    show: options.visible,
    width: 480,
    height: 720,
    webPreferences: { session: partition, contextIsolation: true, nodeIntegration: false },
  });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: CallbackResult | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      partition.webRequest.onBeforeRequest(
        { urls: [`${CALLBACK_SCHEME}://*/*`] },
        null,
      );
      if (!win.isDestroyed()) win.close();
      if (result && result.state === state) {
        setToken(result.token);
        resolve(result.token);
      } else {
        resolve(null);
      }
    };

    const timer = setTimeout(() => settle(null), options.timeoutMs);

    partition.webRequest.onBeforeRequest(
      { urls: [`${CALLBACK_SCHEME}://*/*`] },
      (details, callback) => {
        callback({ cancel: true });
        settle(parseCallback(details.url));
      },
    );

    win.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(`${CALLBACK_SCHEME}://`)) return;
      event.preventDefault();
      settle(parseCallback(url));
    });

    win.on("closed", () => settle(null));

    void win.loadURL(
      `${API_ORIGIN}/desktop/auth?state=${encodeURIComponent(state)}`,
    );
  });
}

export async function beginSignIn(): Promise<string | null> {
  return runAuthWindow({ visible: true, timeoutMs: SIGNIN_TIMEOUT_MS });
}

export async function silentRefresh(): Promise<string | null> {
  return runAuthWindow({ visible: false, timeoutMs: REFRESH_TIMEOUT_MS });
}
```

> **What happened to the custom-protocol deep-link handler?** `apps/desktop/src/main/protocol.ts` and `CFBundleURLTypes` in `forge.config.ts` stay as-is — they handle the edge case where an external app invokes `lightfast://` (email links, notifications). They are **no longer load-bearing for sign-in**: the happy path intercepts `lightfast://auth/callback` inside the BrowserWindow before it escapes. The existing placeholder deep-link handler at `src/main/index.ts:321–329` (which broadcasts to all windows) can be replaced with a no-op or simple logger — we no longer need it for auth.

#### 4.3 Extend `IpcChannels` + types

**File**: `apps/desktop/src/shared/ipc.ts`
**Changes**: add auth channels + `AuthSnapshot` type + extend `LightfastBridge`.

```ts
// Add to IpcChannels — *Sync suffix reserved for ipcMain.on + event.returnValue
// (matches existing convention at index.ts:114,118,122). Async ops use bare names.
authSnapshotSync: channel("auth-snapshot-sync"),
authGetToken: channel("auth-get-token"),       // renamed: async via ipcMain.handle
authSignIn: channel("auth-sign-in"),
authSignOut: channel("auth-sign-out"),
authChanged: channel("auth-changed"),

// New type
export interface AuthSnapshot {
  isSignedIn: boolean;
}

// Extend LightfastBridge
export interface LightfastBridge {
  // …existing fields…
  auth: {
    snapshot: AuthSnapshot;
    getToken: () => Promise<string | null>;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    onChanged: (listener: (snapshot: AuthSnapshot) => void) => () => void;
  };
}
```

#### 4.4 Wire main-process IPC handlers + simplify deep-link

**File**: `apps/desktop/src/main/index.ts`
**Changes**:
- Import `auth-store` and `auth-flow`.
- Register auth IPC handlers inside `registerIpcHandlers()`.
- Replace the placeholder deep-link handler (lines 321–329) with a minimal focus-only dispatcher (auth callback interception moved into `auth-flow.ts`'s BrowserWindow).
- Broadcast `authChanged` on every auth-store change.
- Extend CSP `connect-src` (see 4.6 below).

```ts
import {
  getAuthSnapshot,
  getToken,
  onAuthChanged,
  signOut,
} from "./auth-store";
import { beginSignIn } from "./auth-flow";

// Inside registerIpcHandlers():
ipcMain.on(IpcChannels.authSnapshotSync, (event) => {
  event.returnValue = getAuthSnapshot();
});
ipcMain.handle(IpcChannels.authGetToken, () => getToken());
ipcMain.handle(IpcChannels.authSignIn, () => beginSignIn());
ipcMain.handle(IpcChannels.authSignOut, () => {
  signOut();
});

// Replace onDeepLink at lines 321–329 — auth interception has moved into auth-flow.ts's
// BrowserWindow. This handler now just focuses the primary window for external deep-links.
onDeepLink((url) => {
  const primary = findWindow("primary") ?? BrowserWindow.getAllWindows()[0];
  if (primary) focusForDeepLink(primary);
  // Future: route non-auth deep-links (notifications, shared artifacts, etc.) here.
  console.log("[deep-link]", url);
});

// After `applySettings(getSettings());`:
onAuthChanged((snapshot) => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.authChanged, snapshot);
  }
});
```

#### 4.5 Expose auth surface in preload

**File**: `apps/desktop/src/preload/preload.ts`
**Changes**: add `auth` subtree to the bridge.

```ts
const authSnapshot = ipcRenderer.sendSync(
  IpcChannels.authSnapshotSync
) as AuthSnapshot;

const bridge: LightfastBridge = {
  // …existing…
  auth: {
    snapshot: authSnapshot,
    getToken: () => ipcRenderer.invoke(IpcChannels.authGetToken),
    signIn: () => ipcRenderer.invoke(IpcChannels.authSignIn),
    signOut: () => ipcRenderer.invoke(IpcChannels.authSignOut),
    onChanged: (listener) => {
      const wrapped = (_e: IpcRendererEvent, snap: AuthSnapshot) =>
        listener(snap);
      ipcRenderer.on(IpcChannels.authChanged, wrapped);
      return () => ipcRenderer.off(IpcChannels.authChanged, wrapped);
    },
  },
};
```

#### 4.6 CSP `connect-src` (moved from Phase 6)

**File**: `apps/desktop/src/main/index.ts:43–64`
**Changes**: extend `connect-src` to include the API origin + Clerk's frontend API. The Clerk domain is derived from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` via the existing helper `getClerkFrontendApi()` (`vendor/clerk/src/env.ts:33–57`) — do NOT hardcode a wildcard like `*.clerk.accounts.dev`, because production publishable keys decode to custom domains like `clerk.lightfast.ai`.

```ts
import { getClerkFrontendApi } from "@vendor/clerk/env";

function buildContentSecurityPolicy(): string {
  const apiOrigin =
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024"); // microfrontends mesh, NOT raw apps/app (4107)
  const clerkOrigin = getClerkFrontendApi(); // decodes pk_ → https://<domain>

  const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (devServer) {
    const origin = new URL(devServer).origin;
    const wsOrigin = origin.replace(/^http/, "ws");
    return [
      `default-src 'self' ${origin}`,
      `script-src 'self' 'unsafe-inline' ${origin}`,
      `style-src 'self' 'unsafe-inline' ${origin}`,
      `connect-src 'self' ${origin} ${wsOrigin} ${apiOrigin} ${clerkOrigin}`,
      `img-src 'self' data: blob: ${origin}`,
      `font-src 'self' data: ${origin}`,
    ].join("; ");
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${apiOrigin} ${clerkOrigin}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
  ].join("; ");
}
```

> **Note on BrowserWindow CSP**: the sign-in BrowserWindow loads `http://localhost:3024/desktop/auth` (or `https://lightfast.ai` in prod) — a top-level navigation to an external origin. CSP applies to the *renderer window's document*, not to external URLs the user navigates to. So extending `connect-src` only matters for XHR/fetch/WS the React renderer makes to the API; the BrowserWindow sign-in page is governed by the web app's own CSP, not the desktop's.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm --filter @lightfast/desktop build` (via `electron-forge package`) is not required here — `typecheck` is sufficient at this phase.

#### Automated Verification (extended)

- [ ] Unit test `apps/desktop/src/main/__tests__/auth-flow.test.ts` added. Covers the pure `parseCallback` helper (exported for testability):
  - Valid `lightfast://auth/callback?token=x&state=y` → `{ token: "x", state: "y" }`
  - Wrong protocol (`https://auth/callback`) → `null`
  - Wrong host (`lightfast://other/callback`) → `null`
  - Wrong path (`lightfast://auth/oops`) → `null`
  - Missing token → `null`
  - Missing state → `null`
  - Malformed URL → `null`

#### Manual Verification

- [ ] With the desktop app running, devtools `window.lightfastBridge.auth.snapshot` returns `{ isSignedIn: false }`.
- [ ] Triggering `window.lightfastBridge.auth.signIn()` opens a visible Electron BrowserWindow (NOT the default system browser) showing the Clerk sign-in page at `http://localhost:3024/desktop/auth?state=…`.
- [ ] Completing Clerk sign-in inside that window redirects to `lightfast://…`, the BrowserWindow closes automatically, and `auth.snapshot` flips to `{ isSignedIn: true }`.
- [ ] `~/Library/Application Support/Lightfast/auth.bin` exists and contains encrypted bytes (not plaintext JSON — `file auth.bin` should report "data").
- [ ] Relaunching the app preserves the signed-in state (token survives via `safeStorage`).
- [ ] A second Electron relaunch + trigger of `signIn()` while already signed in still works (opens BrowserWindow, re-uses persisted Clerk cookie → fresh JWT in sub-second).

**Implementation Note**: Pause after automated verification for manual confirmation that the BrowserWindow sign-in flow works end-to-end at the main-process level, independent of renderer changes.

---

## Phase 5: Desktop renderer — React bootstrap + tRPC + sample call

### Overview

Introduce React into the primary window only. Keep the hash router alive; React mounts beneath a dedicated content root inside `index.html`. Settings and sidebar stay as vanilla DOM.

### Changes Required

#### 5.1 Add React + React Query deps

**File**: `apps/desktop/package.json`
**Changes**: Add to `dependencies` — `react`, `react-dom`, `@tanstack/react-query` (catalog), `@trpc/client`, `@trpc/tanstack-react-query`, `superjson`, `sonner`, `@repo/app-trpc: workspace:*`. Add to `devDependencies` — `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`.

#### 5.2 Enable JSX + React plugin

**Files**:
- `apps/desktop/tsconfig.json` — set `"jsx": "react-jsx"`.
- `apps/desktop/vite.renderer.config.ts` — add `@vitejs/plugin-react`.
- `apps/desktop/src/renderer/vite-env.d.ts` (new) — `/// <reference types="vite/client" />` + type declaration for `VITE_LIGHTFAST_API_URL`.

```ts
// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIGHTFAST_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

```ts
// vite.renderer.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

#### 5.3 Add React mount point

**File**: `apps/desktop/src/renderer/index.html`
**Changes**: Inside the existing `<div id="app">` structure, add `<div id="react-root"></div>` where the React tree mounts. Leave existing sidebar/settings DOM untouched.

#### 5.4 React entry + auth-aware shell

**File**: `apps/desktop/src/renderer/src/react/entry.tsx` (new)

Resolves `baseUrl` at the consumer boundary (`apps/desktop` owns the Vite env; `@repo/app-trpc` stays decoupled). The `vite-env.d.ts` from 5.2 gives us a typed `import.meta.env.VITE_LIGHTFAST_API_URL` here.

```tsx
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { DesktopTRPCProvider } from "@repo/app-trpc/desktop";
import { AppShell } from "./app-shell";

const baseUrl = import.meta.env.VITE_LIGHTFAST_API_URL ?? "https://lightfast.ai";

function Root() {
  return (
    <StrictMode>
      <DesktopTRPCProvider baseUrl={baseUrl}>
        <AppShell />
      </DesktopTRPCProvider>
    </StrictMode>
  );
}

const container = document.getElementById("react-root");
if (container) {
  createRoot(container).render(<Root />);
}
```

**File**: `apps/desktop/src/renderer/src/react/app-shell.tsx` (new)

Listens for auth-store changes AND reacts to 401s from tRPC by clearing local auth state. Without the 401 handler, the UI would show a signed-in state while every tRPC call fails silently.

```tsx
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthSnapshot } from "../../../shared/ipc";
import { AccountCard } from "./account-card";

export function AppShell() {
  const [auth, setAuth] = useState<AuthSnapshot>(
    () => window.lightfastBridge.auth.snapshot
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    return window.lightfastBridge.auth.onChanged(setAuth);
  }, []);

  // Global 401 handler: if any tRPC query returns UNAUTHORIZED, the token is
  // invalid/expired. Clear local auth state; Phase 7 adds silent refresh in front of this.
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const err = event.query.state.error;
      if (!err) return;
      const code = (err as { data?: { code?: string } }).data?.code;
      if (code === "UNAUTHORIZED") {
        void window.lightfastBridge.auth.signOut();
      }
    });
    return unsub;
  }, [queryClient]);

  if (!auth.isSignedIn) {
    return (
      <div className="auth-gate">
        <button
          type="button"
          onClick={() => void window.lightfastBridge.auth.signIn()}
        >
          Sign in with Lightfast
        </button>
      </div>
    );
  }

  return (
    <div>
      <AccountCard />
      <button
        type="button"
        onClick={() => void window.lightfastBridge.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
```

**File**: `apps/desktop/src/renderer/src/react/account-card.tsx` (new)

```tsx
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/app-trpc/react";

export function AccountCard() {
  const trpc = useTRPC();
  const query = useQuery(trpc.account.get.queryOptions());

  if (query.isLoading) return <p>Loading account…</p>;
  if (query.error) return <p>Error: {query.error.message}</p>;
  if (!query.data) return null;

  const user = query.data;
  return (
    <div className="account-card">
      <h1>{user.fullName ?? "Unknown"}</h1>
      <p>{user.primaryEmailAddress ?? ""}</p>
    </div>
  );
}
```

> **Field names verified against `api/app/src/router/user/account.ts:29–59`**: `fullName`, `primaryEmailAddress` (NOT `primaryEmail`), `imageUrl`, `createdAt`, etc. The tRPC types make this a compile-time check.

#### 5.5 Wire React entry alongside existing vanilla entry

**File**: `apps/desktop/src/renderer/src/main.ts`
**Changes**: Add a single import at the top: `import "./react/entry";`. The vanilla TS bootstrap continues to own the sidebar and settings DOM; React owns `#react-root` only.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm install` succeeds with new deps (root workspace)
- [ ] `pnpm --filter @lightfast/desktop dev` starts without errors (electron-forge boot)

#### Manual Verification

- [ ] Primary window renders the "Sign in with Lightfast" button.
- [ ] React tree is isolated — existing settings screen (`#/settings`) still renders.

**Implementation Note**: Pause after automated verification before moving to E2E.

---

## Phase 6: env, dev scripts, Clerk JWT template, end-to-end verification

### Overview

Add env vars, new root dev script, document Clerk JWT template setup, and run the full golden path. CSP has been folded into Phase 4.6 because the renderer cannot hit the API without it — the original ordering would have broken Phase 5's manual verification.

### Changes Required

#### 6.1 Env var for Vite renderer

**File**: `apps/desktop/.env.development` (new, gitignored)
**Content**:
```
VITE_LIGHTFAST_API_URL=http://localhost:3024
```

> **Why 3024 and not 4107**: the microfrontends mesh (`apps/app/microfrontends.json`) serves `apps/app` (4107) and `apps/www` (4101) through a single origin at `http://localhost:3024` in dev, mirroring the prod single-origin shape at `https://lightfast.ai`. (`apps/platform` at 4112 is a separate service — not in the mesh — and is not consumed by desktop.) The tRPC route's CORS whitelists 3024 in dev (`route.ts:13–16`) — hitting 4107 directly would be blocked.

Document in `apps/desktop/README.md` that this file is required for local dev.

#### 6.2 Root dev scripts

**File**: `package.json` (repo root)
**Changes**:

1. Add `"dev:desktop": "pnpm --filter @lightfast/desktop dev"` — launches the Electron app.
2. Add `"dev:desktop-stack"` — launches `dev:full` AND the 3024 microfrontends proxy concurrently. **Critical**: `dev:full` alone does NOT start 3024 today (`pnpm dev:full` only boots the app servers at 4107/4101/4112). The proxy is registered only in `apps/app/package.json:13` as `"proxy": "microfrontends proxy --port 3024"`, which no turbo task runs.

```json
"dev:desktop": "pnpm --filter @lightfast/desktop dev",
"dev:desktop-stack": "concurrently --names app,proxy --prefix-colors cyan,magenta 'pnpm dev:full' 'pnpm --filter @lightfast/app proxy'"
```

Verify `concurrently` is available at the root (`pnpm list --depth 0 concurrently` from repo root). If not, add via `pnpm add -wD concurrently`.

#### 6.3 Clerk JWT template

**Action** (Clerk Dashboard, not code): create a JWT template named `lightfast-desktop`:
- Expiry: 3600 seconds (1 hour)
- Claims: include `org_id: {{org.id}}` (default Clerk claim)
- Signing: default (symmetric, verifies via `CLERK_SECRET_KEY`)

Document this in `apps/desktop/README.md` — **this is not auto-configured; a human must do it once per Clerk environment (dev + prod).**

#### 6.4 README for the auth flow

**File**: `apps/desktop/README.md`
**Changes**: Add a "Local development" section with:
- Required env vars (`VITE_LIGHTFAST_API_URL`)
- Clerk JWT template setup steps
- How to run concurrently: `pnpm dev:desktop-stack` (starts `dev:full` + the 3024 proxy) in one terminal, `pnpm dev:desktop` in another. `pnpm dev:full` alone is **not** sufficient — the microfrontends proxy at 3024 is a separate process.
- How to inspect the encrypted token: `ls ~/Library/Application\ Support/Lightfast/auth.bin` (macOS)

### Success Criteria

#### Automated Verification (end-to-end script)

Run in separate terminals:

```bash
# Terminal 1
pnpm dev:desktop-stack
# Starts `dev:full` (apps/app:4107, apps/www:4101, apps/platform:4112)
# AND the microfrontends proxy on http://localhost:3024 (fronts app + www only)

# Terminal 2
pnpm dev:desktop
# Wait for Electron window to appear
```

- [ ] `pnpm --filter app typecheck` passes
- [ ] `pnpm --filter @lightfast/desktop typecheck` passes
- [ ] `pnpm --filter @repo/app-trpc typecheck` passes
- [ ] `pnpm --filter @api/app typecheck` passes
- [ ] `curl -i http://localhost:3024/desktop/auth?state=test` returns 200 (page exists, renders sign-in prompt if not already signed in)

#### Manual Verification (golden path)

1. [ ] `pnpm dev:desktop-stack` running (apps + 3024 proxy); `pnpm dev:desktop` running.
2. [ ] Desktop primary window displays **"Sign in with Lightfast"** button.
3. [ ] Click the button → a **visible Electron BrowserWindow** opens to `http://localhost:3024/desktop/auth?state=<hex>` (NOT the default system browser — this is the new flow).
4. [ ] Complete Clerk sign-in inside the Electron BrowserWindow.
5. [ ] The bridge page auto-navigates to `lightfast://auth/callback?token=…&state=…`.
6. [ ] `session.webRequest.onBeforeRequest` intercepts the callback → window closes automatically (no OS protocol prompt).
7. [ ] Primary window UI flips to signed-in; `AccountCard` renders the authenticated user's name + `primaryEmailAddress`.
8. [ ] Devtools network tab shows `POST http://localhost:3024/api/trpc/account.get?batch=1` with `Authorization: Bearer …` and `x-trpc-source: desktop` headers, 200 response (no CORS failure).
9. [ ] Click **Sign out** → token removed from keychain; UI flips back to unauthed.
10. [ ] Relaunch desktop → remains signed in (token loaded from `auth.bin`).
11. [ ] Second sign-in: Clerk cookie persisted in `persist:lightfast-auth` partition → sign-in flow completes in sub-second without user typing credentials (cookie-driven re-issuance).

#### Manual Verification (negative paths)

1. [ ] Corrupt the `state` param inside the bridge page's redirect (via devtools breakpoint) → BrowserWindow times out after `SIGNIN_TIMEOUT_MS`, no sign-in, primary UI unchanged.
2. [ ] Kill the app, corrupt `auth.bin` with `printf "garbage" > ~/Library/Application\ Support/Lightfast/auth.bin`, relaunch → cleanly falls back to signed-out state (Zod validation / decrypt failure logged via `console.error`, not thrown).
3. [ ] Force a bogus token via devtools (`window.lightfastBridge` internals patched) → `account.get` returns UNAUTHORIZED → `AppShell`'s 401 handler clears auth, UI flips back to signed-out (no infinite error loop).
4. [ ] Kill the API proxy (`apps/app`) → `AccountCard` surfaces a user-visible error, UI stays responsive, no crash.
5. [ ] Close the sign-in BrowserWindow manually before completing Clerk flow → `beginSignIn()` resolves to `null`, primary window stays in unauthed state.

#### Regression checks

1. [ ] `apps/app` in browser — sign-in and existing tRPC cookie flows work unchanged.
2. [ ] Desktop settings screen (`#/settings`) still renders and updates settings (vanilla TS untouched).
3. [ ] Desktop HUD window (Cmd+Shift+S) still opens (secondary/HUD windows untouched).
4. [ ] `pnpm build:app` succeeds (no Next.js build breakage).

---

## Phase 7: Silent JWT refresh via hidden BrowserWindow

### Overview

By end of Phase 6, desktop works but forces re-auth every ~1h when the JWT template expires. Phase 7 wires `silentRefresh()` (already implemented in Phase 4.2's `auth-flow.ts`) in front of the 401 handler so expiry is invisible to the user. The spike-validated pattern reuses Phase 4's `persist:lightfast-auth` partition — the hidden window finds Clerk's persisted `__session` cookie, mints a fresh JWT, and settles within seconds. User sees nothing. Re-sign-in only becomes visible when the *Clerk session* expires (days, not hours).

### Changes Required

#### 7.1 Main-process IPC channel for silent refresh

**File**: `apps/desktop/src/shared/ipc.ts` — add `authSilentRefresh: channel("auth-silent-refresh")`.

**File**: `apps/desktop/src/main/index.ts` — register handler:
```ts
import { silentRefresh } from "./auth-flow";
ipcMain.handle(IpcChannels.authSilentRefresh, () => silentRefresh());
```

**File**: `apps/desktop/src/preload/preload.ts` — add to `auth` bridge:
```ts
silentRefresh: () => ipcRenderer.invoke(IpcChannels.authSilentRefresh),
```

#### 7.2 Attempt silent refresh before signing out on 401

**File**: `apps/desktop/src/renderer/src/react/app-shell.tsx`
**Changes**: replace the 401 handler's direct `signOut()` with: attempt `silentRefresh()` first; only fall back to `signOut()` if refresh returns `null`. Invalidate all queries on success so refetches use the new token.

```tsx
useEffect(() => {
  const unsub = queryClient.getQueryCache().subscribe(async (event) => {
    if (event.type !== "updated") return;
    const err = event.query.state.error;
    if (!err) return;
    const code = (err as { data?: { code?: string } }).data?.code;
    if (code !== "UNAUTHORIZED") return;

    const refreshed = await window.lightfastBridge.auth.silentRefresh();
    if (refreshed) {
      await queryClient.invalidateQueries();
    } else {
      await window.lightfastBridge.auth.signOut();
    }
  });
  return unsub;
}, [queryClient]);
```

> **Concurrency**: a single in-flight refresh guard can be added later if multiple queries 401 simultaneously. First-ship: accept possibly-duplicate refresh calls — the hidden window is cheap, Clerk is idempotent.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @lightfast/desktop typecheck` passes.

#### Manual Verification

- [ ] Sign in normally.
- [ ] In Clerk dashboard, set JWT template expiry to 60s (or edit locally).
- [ ] Wait 90s, trigger any tRPC query (e.g., refresh a page that fetches `account.get`).
- [ ] Devtools: observe a `lightfast://` network trace, but no visible window appears — the hidden BrowserWindow ran and closed.
- [ ] Query retries and succeeds with a fresh `Authorization: Bearer <new jwt>` header.
- [ ] Kill Electron's persisted Clerk session (delete `~/Library/Application Support/Lightfast/Partitions/lightfast-auth`) → next 401 triggers silent refresh, fails (no session cookie) → falls back to `signOut()`, UI flips to signed-out.

---

## Testing Strategy

### Unit Tests

**`api/app/src/__tests__/resolve-clerk-session.test.ts`** (new):
- Bearer path: valid JWT with `org_id` → `{ userId, orgId }`.
- Bearer path: valid JWT without `org_id` → `{ userId, orgId: null }`.
- Bearer path: malformed JWT → falls through to cookie resolver.
- Cookie path: `auth()` returns userId + orgId → `{ userId, orgId }`.
- Neither: `null`.

Mock `verifyToken` and `auth` from `@vendor/clerk/server`.

**`apps/desktop/src/main/__tests__/auth-flow.test.ts`** (new):
- `parseCallback` (exported for testability): all variants from Phase 4.2's Automated Verification — valid URL, wrong protocol, wrong host, wrong path, missing token, missing state, malformed URL.
- No Electron mocks needed — `parseCallback` is pure.

### Integration Tests

None added in this plan — golden path is covered by manual E2E.

### Manual Testing Steps

See Phase 6 "Manual Verification (golden path)" and "(negative paths)".

## Performance Considerations

- **JWT verification cost**: `verifyToken` with `secretKey` does a symmetric signature check — µs-scale, no network. Public-key JWKS verification is not used here.
- **Token refresh cost**: Phase 7's silent refresh opens a hidden BrowserWindow pointed at `/desktop/auth`. Cost: one HTML page load + one Clerk `getToken` call + one redirect. Warm case (Clerk cookie present): sub-second. Cold case (cookie missing/expired): 30s timeout → fall back to signed-out state. No persistent background timers.
- **CSP evaluation**: adding origins to `connect-src` is free; no perceptible impact.
- **Session partition disk footprint**: `persist:lightfast-auth` stores Clerk cookies (~few KB) + browsing cache for `*.lightfast.ai`. Trimmable via `session.fromPartition("persist:lightfast-auth").clearCache()` if ever needed — not expected.

## Migration Notes

- **No data migration** — desktop has no existing auth state.
- **Web users unaffected** — cookie path is preserved identically.
- **Rollback**: revert `api/app/src/trpc.ts` to call `auth()` directly. Desktop will stop working; web continues.

## References

- Existing CLI auth bridge (to be refactored into shared `ClientAuthBridge`): `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx:1–97`
- tRPC context: `api/app/src/trpc.ts:58–88`
- tRPC React provider: `packages/app-trpc/src/react.tsx:69–113`
- tRPC route handler + CORS: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:13–34,46`
- Microfrontends mesh config (app + www only, no platform): `apps/app/microfrontends.json`
- Microfrontends proxy script: `apps/app/package.json:13` (`"proxy": "microfrontends proxy --port 3024"`)
- Clerk server exports (incl. `verifyToken`): `vendor/clerk/src/server.ts:49–61`
- Clerk env (use `clerkEnvBase`, not `env`): `vendor/clerk/src/env.ts:5,33–57`
- Clerk frontend API resolver: `vendor/clerk/src/env.ts:33–57` (`getClerkFrontendApi()`)
- Smoke-test procedure (fields: `fullName`, `primaryEmailAddress`, etc.): `api/app/src/router/user/account.ts:29–59`
- Desktop protocol handler (auth-neutral now, kept for external deep-links): `apps/desktop/src/main/protocol.ts:1–62`
- Desktop main entry: `apps/desktop/src/main/index.ts:43–76` (CSP), `113–173` (registerIpcHandlers), `279` (protocol registration), `321–329` (deep-link dispatch)
- Desktop IPC surface: `apps/desktop/src/shared/ipc.ts:5–22,93–121`
- Desktop Forge config: `apps/desktop/forge.config.ts:78–83` (CFBundleURLTypes)
- Existing settings-store pattern (faithfully mirrored by auth-store): `apps/desktop/src/main/settings-store.ts`
- Spike prototype (`auth-flow-spike.ts`, 179 LOC, typecheck-passing): `.claude/worktrees/agent-a99c5cfc/apps/desktop/src/main/auth-flow-spike.ts`

## Improvement Log

This plan was adversarially reviewed on 2026-04-23 against the current state of the codebase. Key findings and their resolutions:

### Spike: Silent refresh via hidden BrowserWindow — CONFIRMED

**Hypothesis**: An Electron `BrowserWindow` bound to a persistent session partition can silently re-mint JWTs by reusing Clerk's persisted `__session` cookie — visible on first sign-in, hidden for refresh. The spike-validator wrote a working 179-line prototype at `auth-flow-spike.ts` that typechecks with zero new dependencies. All three hypotheses held against Electron 33.4.11 type defs:

1. `show: false` is orthogonal to navigation; cross-origin `loadURL` works.
2. `session.webRequest.onBeforeRequest` with `urls: ["lightfast://*/*"]` accepts custom schemes and fires before Chromium tries to resolve them. `will-navigate` is a belt-and-suspenders fallback.
3. `persist:` partitions write cookies to `userData` under `Partitions/<name>`, persisting across relaunch and isolated from the user's default browser.

**Impact on plan**: Replaced `shell.openExternal` with `BrowserWindow`-based sign-in (Phase 4.2). Added Phase 7 for silent refresh. Removed hourly re-auth UX burden — users now re-auth only when their Clerk session itself expires (days).

### Critical fixes applied

- **`env` vs `clerkEnvBase` import** (Phase 1.1): plan's original `import { env } from "@vendor/clerk/env"` was broken — the actual export is `clerkEnvBase`. Fixed.
- **`primaryEmail` vs `primaryEmailAddress`** (Phase 5.4): procedure returns `primaryEmailAddress`. Fixed.
- **CSP wildcard vs decoded domain** (Phase 4.6): replaced `https://*.clerk.accounts.dev` wildcard with `getClerkFrontendApi()` helper — prod Clerk domains (e.g., `clerk.lightfast.ai`) don't match the wildcard.
- **Microfrontends claim** (overview + Phase 6.1): plan said mesh fronts app+www+platform; platform is NOT in the mesh per `microfrontends.json`. Corrected.
- **`dev:full` doesn't start 3024** (Phase 6.2): added new `dev:desktop-stack` script that starts `dev:full` AND the 3024 proxy. The proxy is only defined in `apps/app/package.json:13` and not in any turbo task.

### Design changes

- **`baseUrl` as prop** (Phase 2.2, 5.4): moved Vite env resolution out of `@repo/app-trpc/desktop.tsx` into `apps/desktop`'s entry. Shared package stays transport-agnostic.
- **Shared `ClientAuthBridge` component** (Phase 3.1): extracted ~90% duplication between CLI and desktop auth bridges into a reusable component. CLI refactored to consume it (Phase 3.2). Future CLI/desktop/OAuth bridges get the pattern for free.
- **Faithful `settings-store.ts` mirror for `auth-store.ts`** (Phase 4.1): added Zod schema for persisted payload, try/catch around `writeFileSync`, `console.error` on failure. Previously the plan diverged from the template without justification.
- **CSP moved to Phase 4** (Phase 4.6): originally in Phase 6, but Phase 5's renderer tRPC calls need it — the original ordering would have broken Phase 5's manual verification.
- **Channel naming convention** (Phase 4.3): renamed `authGetTokenSync` → `authGetToken`. The `*Sync` suffix is reserved for `ipcMain.on` + `event.returnValue` (matches existing `getBuildInfoSync`, `getSettingsSync` at `index.ts:114,118,122`). The plan originally registered `authGetTokenSync` with `ipcMain.handle` (async), violating the convention.
- **401 handling in renderer** (Phase 5.4): `AppShell` now subscribes to the query cache and reacts to `UNAUTHORIZED` errors. Without this, a stale token would leave the UI in a broken signed-in state while every tRPC call fails. Phase 7 extends this to try `silentRefresh()` first.
- **Removed `"use client"` from `desktop.tsx`** (Phase 2.2): dead signal in Electron — no RSC boundary.
- **Deep-link handler simplified** (Phase 4.4): auth interception moved into BrowserWindow; `protocol.ts` + `CFBundleURLTypes` now serve only external deep-links (notifications, shared artifacts). The placeholder broadcast at `index.ts:321–329` is replaced with a focus-only no-op.

### Decisions deferred

- **Refresh concurrency guard** (Phase 7.2 note): if multiple tRPC queries 401 simultaneously, we may fire duplicate silent-refresh windows. Accepted for first-ship — Clerk is idempotent and hidden windows are cheap. Add a single-flight guard if this becomes measurable.
- **Refresh-window timeout tuning**: 30s for silent, 5min for visible. May need adjustment if Clerk's first-time-sign-in flow on slow networks exceeds 30s; monitor after initial rollout.
- **Multi-org switching**: deliberately out of scope. `orgScopedProcedure` usage lands after end-to-end Bearer is proven.
