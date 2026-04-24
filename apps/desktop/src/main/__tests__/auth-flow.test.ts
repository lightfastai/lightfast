import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellOpenExternalMock = vi.fn<(...args: unknown[]) => Promise<void>>(() =>
  Promise.resolve()
);
const setTokenMock = vi.fn<(token: string) => boolean>(() => true);
const sentryCaptureExceptionMock = vi.fn<(...args: unknown[]) => void>();
const sentryCaptureMessageMock = vi.fn<(...args: unknown[]) => void>();

vi.mock("electron", () => ({
  shell: {
    openExternal: (url: string) => shellOpenExternalMock(url),
  },
}));

vi.mock("@sentry/electron/main", () => ({
  captureException: (error: unknown, options?: unknown) =>
    sentryCaptureExceptionMock(error, options),
  captureMessage: (message: string, options?: unknown) =>
    sentryCaptureMessageMock(message, options),
}));

vi.mock("../auth-store", () => ({
  setToken: (token: string) => setTokenMock(token),
}));

// Imported dynamically inside tests so we can reset modules between cases
// (the `ALLOWED_ORIGIN` constant + `inflight` module-scope state are captured
// at import time).
async function loadAuthFlow(env?: Record<string, string | undefined>) {
  vi.resetModules();
  const prev = { ...process.env };
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
  const mod = await import("../auth-flow");
  return { mod, restore: () => Object.assign(process.env, prev) };
}

interface CallbackInfo {
  origin: string;
  port: number;
  url: string;
}

async function startFlowAndCaptureCallback(
  mod: typeof import("../auth-flow")
): Promise<{ callback: CallbackInfo; signIn: Promise<string | null> }> {
  const signIn = mod.beginSignIn();

  // Wait for shell.openExternal to be called so we can extract the callback URL.
  for (let i = 0; i < 200; i++) {
    if (shellOpenExternalMock.mock.calls.length > 0) {
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  const lastCall = shellOpenExternalMock.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("shell.openExternal was not called");
  }
  const signInUrl = new URL(lastCall[0] as string);
  const callbackRaw = signInUrl.searchParams.get("callback");
  if (!callbackRaw) {
    throw new Error("no callback param");
  }
  const callback = new URL(callbackRaw);
  return {
    callback: {
      url: callback.toString(),
      port: Number(callback.port),
      origin: `http://127.0.0.1:${callback.port}`,
    },
    signIn,
  };
}

function extractState(): string | null {
  const lastCall = shellOpenExternalMock.mock.calls.at(-1);
  if (!lastCall) {
    return null;
  }
  return new URL(lastCall[0] as string).searchParams.get("state");
}

// Send a settling POST to end a flow that was left hanging by early-return
// paths (403/404/405 all skip settle()). Uses state-mismatch to force the
// server into a terminal state so the awaited signIn promise resolves to null.
async function forceSettle(origin: string): Promise<void> {
  try {
    await fetch(`${origin}/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3024",
      },
      body: JSON.stringify({ token: "settle", state: "mismatch" }),
    });
  } catch {
    // ignore — server may have already closed
  }
}

describe("auth-flow loopback server", () => {
  beforeEach(() => {
    shellOpenExternalMock.mockClear();
    setTokenMock.mockClear();
    sentryCaptureExceptionMock.mockClear();
    sentryCaptureMessageMock.mockClear();
    setTokenMock.mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ALLOWED_ORIGIN resolution", () => {
    it("falls back to http://localhost:3024 when NODE_ENV!=production and LIGHTFAST_API_URL unset", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "x", state: "y" }),
        });
        // Origin check passes (not 403), so we land in state_mismatch.
        expect(res.status).toBe(400);
        await signIn;
      } finally {
        restore();
      }
    });

    it("uses https://lightfast.ai when NODE_ENV=production", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "production",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "x", state: "y" }),
        });
        expect(res.status).toBe(403); // wrong origin for prod
        // Settle with a matching-origin state-mismatch to close the flow.
        await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://lightfast.ai",
          },
          body: JSON.stringify({ token: "x", state: "bad" }),
        });
        await signIn;
      } finally {
        restore();
      }
    });

    it("honors LIGHTFAST_API_URL override", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: "https://staging.lightfast.ai",
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://staging.lightfast.ai",
          },
          body: JSON.stringify({ token: "x", state: "y" }),
        });
        // Correct origin → passes origin check, fails state mismatch
        expect(res.status).toBe(400);
        await signIn;
      } finally {
        restore();
      }
    });
  });

  describe("request handler", () => {
    it("returns 403 when Origin header is foreign", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://evil.com",
          },
          body: JSON.stringify({ token: "x", state: "x" }),
        });
        expect(res.status).toBe(403);
        expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
          expect.stringContaining("forbidden origin"),
          expect.objectContaining({
            level: "warning",
            tags: { scope: "auth-flow.forbidden_origin" },
          })
        );
        await forceSettle(callback.origin);
        await signIn;
      } finally {
        restore();
      }
    });

    it("returns 403 when Origin header is missing entirely", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "x", state: "x" }),
        });
        expect(res.status).toBe(403);
        await forceSettle(callback.origin);
        await signIn;
      } finally {
        restore();
      }
    });

    it("returns 404 for unknown path with allowed origin", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/does-not-exist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "x", state: "x" }),
        });
        expect(res.status).toBe(404);
        await forceSettle(callback.origin);
        await signIn;
      } finally {
        restore();
      }
    });

    it("handles OPTIONS preflight with CORS + PNA headers", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:3024",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Private-Network": "true",
          },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get("access-control-allow-origin")).toBe(
          "http://localhost:3024"
        );
        expect(res.headers.get("access-control-allow-methods")).toBe(
          "POST, OPTIONS"
        );
        expect(res.headers.get("access-control-allow-headers")).toBe(
          "content-type"
        );
        expect(res.headers.get("access-control-allow-private-network")).toBe(
          "true"
        );
        expect(res.headers.get("vary")).toBe("Origin");
        // OPTIONS does NOT settle the flow — connection still open.
        // Settle it with a forbidden-origin POST so the server closes.
        await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        // Server requires a real settle — send a state-mismatch POST.
        await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "x", state: "bad" }),
        });
        await signIn;
      } finally {
        restore();
      }
    });

    it("returns 405 for GET requests from the allowed origin", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "GET",
          headers: { Origin: "http://localhost:3024" },
        });
        expect(res.status).toBe(405);
        expect(res.headers.get("allow")).toBe("POST");
        // Close the flow.
        await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "x", state: "bad" }),
        });
        await signIn;
      } finally {
        restore();
      }
    });

    it("returns 400 bad_request when body fails schema", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "", state: "" }),
        });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json).toEqual({ ok: false, reason: "bad_request" });
        const result = await signIn;
        expect(result).toBeNull();
      } finally {
        restore();
      }
    });

    it("returns 400 state_mismatch when state doesn't match", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "jwt-token", state: "wrong-state" }),
        });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json).toEqual({ ok: false, reason: "state_mismatch" });
        expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
          expect.stringContaining("state mismatch"),
          expect.objectContaining({
            level: "warning",
            tags: { scope: "auth-flow.state_mismatch" },
          })
        );
        expect(setTokenMock).not.toHaveBeenCalled();
        const result = await signIn;
        expect(result).toBeNull();
      } finally {
        restore();
      }
    });

    it("accepts a valid POST, persists the token, and resolves with the JWT", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const state = extractState();
        if (!state) {
          throw new Error("no state");
        }
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "real-jwt-token", state }),
        });
        expect(res.status).toBe(204);
        expect(setTokenMock).toHaveBeenCalledWith("real-jwt-token");
        const result = await signIn;
        expect(result).toBe("real-jwt-token");
      } finally {
        restore();
      }
    });

    it("returns 500 and captures Sentry when setToken fails to persist", async () => {
      setTokenMock.mockImplementationOnce(() => false);
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const state = extractState();
        if (!state) {
          throw new Error("no state");
        }
        const res = await fetch(`${callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "jwt", state }),
        });
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json).toEqual({ ok: false, reason: "persist_failed" });
        expect(sentryCaptureExceptionMock).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            tags: { scope: "auth-flow.persist_failed" },
          })
        );
        const result = await signIn;
        expect(result).toBeNull();
      } finally {
        restore();
      }
    });

    it("rejects bodies larger than MAX_BODY_BYTES (16 KiB)", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const { callback, signIn } = await startFlowAndCaptureCallback(mod);
        const huge = "a".repeat(32 * 1024);
        // Server destroys the socket mid-stream — the fetch either rejects
        // or returns a 500. Both are acceptable; what matters is we don't
        // happily accept 32 KiB of token.
        try {
          const res = await fetch(`${callback.origin}/callback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://localhost:3024",
            },
            body: JSON.stringify({ token: huge, state: "any" }),
          });
          expect(res.status).toBeGreaterThanOrEqual(400);
        } catch {
          // Socket destruction → fetch rejects. Acceptable.
        }
        expect(setTokenMock).not.toHaveBeenCalled();
        const result = await signIn;
        expect(result).toBeNull();
      } finally {
        restore();
      }
    });
  });

  describe("concurrency", () => {
    it("serializes concurrent beginSignIn calls — second caller gets the same promise", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const first = mod.beginSignIn();
        const second = mod.beginSignIn();
        expect(first).toBe(second);

        // Only one call to openExternal was queued
        for (let i = 0; i < 100; i++) {
          if (shellOpenExternalMock.mock.calls.length > 0) {
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(shellOpenExternalMock).toHaveBeenCalledTimes(1);

        // Settle — both callers should see the same result.
        const state = extractState();
        const firstCall = shellOpenExternalMock.mock.calls[0];
        if (!firstCall) {
          throw new Error("no openExternal call");
        }
        const callbackUrl = new URL(firstCall[0] as string).searchParams.get(
          "callback"
        );
        if (!(state && callbackUrl)) {
          throw new Error("missing params");
        }
        await fetch(callbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "shared-token", state }),
        });
        const [r1, r2] = await Promise.all([first, second]);
        expect(r1).toBe("shared-token");
        expect(r2).toBe("shared-token");
      } finally {
        restore();
      }
    });

    it("clears inflight after settle so the next sign-in starts a fresh flow", async () => {
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        // First flow — let it fail via state mismatch.
        const first = await startFlowAndCaptureCallback(mod);
        await fetch(`${first.callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "a", state: "bad" }),
        });
        await first.signIn;
        shellOpenExternalMock.mockClear();

        // Second flow — should open a new browser tab.
        const second = await startFlowAndCaptureCallback(mod);
        expect(shellOpenExternalMock).toHaveBeenCalledTimes(1);
        expect(second.callback.port).not.toBe(first.callback.port);

        // Close it.
        await fetch(`${second.callback.origin}/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3024",
          },
          body: JSON.stringify({ token: "b", state: "bad" }),
        });
        await second.signIn;
      } finally {
        restore();
      }
    });
  });

  describe("timeout", () => {
    it("resolves null and fires auth-flow.timeout Sentry message after 5 minutes", async () => {
      vi.useFakeTimers();
      const { mod, restore } = await loadAuthFlow({
        NODE_ENV: "test",
        LIGHTFAST_API_URL: undefined,
      });
      try {
        const signIn = mod.beginSignIn();
        // Advance microtasks so the server binds
        await vi.advanceTimersByTimeAsync(100);
        // Advance past the 5-minute timeout
        await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
        const result = await signIn;
        expect(result).toBeNull();
        expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
          expect.stringContaining("timeout"),
          expect.objectContaining({
            level: "warning",
            tags: { scope: "auth-flow.timeout" },
          })
        );
      } finally {
        vi.useRealTimers();
        restore();
      }
    }, 10_000);
  });
});
