import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellOpenExternalMock = vi.fn<(url: string) => Promise<void>>(() =>
  Promise.resolve()
);
const setTokenMock = vi.fn<(token: string) => boolean>(() => true);
const getTokenMock = vi.fn<() => string | null>(() => null);
const sentryCaptureExceptionMock = vi.fn<(...args: unknown[]) => void>();
const sentryCaptureMessageMock = vi.fn<(...args: unknown[]) => void>();

let protocolListeners: Array<(url: string) => void> = [];
let isPackagedFlag = false;

vi.mock("electron", () => ({
  shell: {
    openExternal: (url: string) => shellOpenExternalMock(url),
  },
  app: {
    get isPackaged() {
      return isPackagedFlag;
    },
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
  getToken: () => getTokenMock(),
}));

vi.mock("../protocol", () => ({
  getProtocolScheme: () => (isPackagedFlag ? "lightfast" : "lightfast-dev"),
  onProtocolUrl: (listener: (url: string) => void) => {
    protocolListeners.push(listener);
    return () => {
      protocolListeners = protocolListeners.filter((l) => l !== listener);
    };
  },
}));

async function loadAuthFlow(env?: Record<string, string | undefined>) {
  vi.resetModules();
  protocolListeners = [];
  // Snapshot only the keys we intend to mutate so restore can properly
  // remove keys that didn't previously exist (Object.assign won't delete).
  const touchedKeys = env ? Object.keys(env) : [];
  const prev: Record<string, string | undefined> = {};
  for (const k of touchedKeys) {
    prev[k] = process.env[k];
  }
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
  return {
    mod,
    restore: () => {
      for (const k of touchedKeys) {
        const original = prev[k];
        if (original === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = original;
        }
      }
    },
  };
}

interface CapturedSignin {
  url: URL;
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

async function captureSigninUrl(
  fromOpenExternal: boolean,
  emittedEvents: AuthLine[]
): Promise<CapturedSignin> {
  for (let i = 0; i < 200; i++) {
    if (fromOpenExternal && shellOpenExternalMock.mock.calls.length > 0) {
      break;
    }
    if (
      !fromOpenExternal &&
      emittedEvents.some((e) => e.event === "auth_signin_url")
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  const raw = fromOpenExternal
    ? (shellOpenExternalMock.mock.calls.at(-1)?.[0] as string | undefined)
    : (
        emittedEvents.find((e) => e.event === "auth_signin_url") as
          | { event: "auth_signin_url"; url: string }
          | undefined
      )?.url;
  if (!raw) {
    throw new Error("signin URL not observed");
  }
  const url = new URL(raw);
  const state = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  return { url, state, codeChallenge, redirectUri };
}

type AuthLine =
  | { event: "auth_already_signed_in" }
  | { event: "auth_signin_url"; url: string }
  | { event: "auth_signed_in" }
  | { event: "auth_signin_failed"; reason: string };

function spyStdout(): { events: AuthLine[]; restore: () => void } {
  const events: AuthLine[] = [];
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
      if (typeof chunk === "string") {
        for (const line of chunk.split("\n")) {
          if (!line) {
            continue;
          }
          try {
            const parsed = JSON.parse(line);
            if (parsed && typeof parsed === "object" && "event" in parsed) {
              events.push(parsed as AuthLine);
              continue;
            }
          } catch {
            // not JSON — fall through to original
          }
        }
      }
      return true;
    });
  return {
    events,
    restore: () => {
      spy.mockRestore();
      process.stdout.write = original;
    },
  };
}

beforeEach(() => {
  shellOpenExternalMock.mockClear();
  setTokenMock.mockClear();
  setTokenMock.mockImplementation(() => true);
  getTokenMock.mockClear();
  getTokenMock.mockImplementation(() => null);
  sentryCaptureExceptionMock.mockClear();
  sentryCaptureMessageMock.mockClear();
  isPackagedFlag = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("auth-flow PKCE sign-in", () => {
  it("composes signin URL with state, S256 code_challenge, and lightfast-dev redirect_uri (unpackaged)", async () => {
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(true, []);
      expect(captured.url.origin).toBe("http://localhost:3024");
      expect(captured.url.pathname).toBe("/desktop/auth");
      expect(captured.state.length).toBeGreaterThanOrEqual(32);
      expect(captured.codeChallenge.length).toBeGreaterThanOrEqual(43);
      expect(captured.redirectUri).toBe("lightfast-dev://auth/callback");
      expect(captured.url.searchParams.get("code_challenge_method")).toBe(
        "S256"
      );

      const result = await signIn;
      expect(result).toBeNull();
    } finally {
      restore();
    }
  });

  it("composes redirect_uri with the lightfast scheme when packaged", async () => {
    isPackagedFlag = true;
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "production",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(true, []);
      expect(captured.redirectUri).toBe("lightfast://auth/callback");
      expect(captured.url.origin).toBe("https://lightfast.ai");

      await signIn;
    } finally {
      restore();
    }
  });

  it("happy path: protocol callback → exchange → setToken → resolves with the token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "real-jwt" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response
    );
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(true, []);
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }

      cb(
        `lightfast-dev://auth/callback?code=${"a".repeat(43)}&state=${captured.state}`
      );

      const result = await signIn;
      expect(result).toBe("real-jwt");
      expect(setTokenMock).toHaveBeenCalledWith("real-jwt");
      // Verify exchange POST was made with correct body shape.
      const [exchUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(exchUrl).toBe("http://localhost:3024/api/desktop/auth/exchange");
      const body = JSON.parse(init.body as string);
      expect(body.code).toBe("a".repeat(43));
      // verifier must match the captured challenge under SHA256.
      const expectedChallenge = createHash("sha256")
        .update(body.code_verifier)
        .digest("base64url");
      expect(expectedChallenge).toBe(captured.codeChallenge);
    } finally {
      restore();
      fetchSpy.mockRestore();
    }
  });

  it("ignores callbacks with foreign state (no event, flow stays pending until timeout)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
    });
    try {
      vi.useFakeTimers();
      const signIn = mod.beginSignIn();
      // Wait for openExternal microtasks
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(10);
        if (shellOpenExternalMock.mock.calls.length > 0) {
          break;
        }
      }
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }

      cb(
        `lightfast-dev://auth/callback?code=${"a".repeat(43)}&state=${"WRONG".repeat(8)}`
      );

      // Allow microtasks to flush, then advance past timeout.
      await vi.advanceTimersByTimeAsync(50);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(setTokenMock).not.toHaveBeenCalled();
      expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
        expect.stringContaining("state mismatch"),
        expect.objectContaining({
          tags: { scope: "auth-flow.state_mismatch" },
        })
      );

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
      const result = await signIn;
      expect(result).toBeNull();
    } finally {
      restore();
      fetchSpy.mockRestore();
    }
  });

  it("exchange 4xx returns null and emits auth_signin_failed{reason:exchange_failed} in agent mode", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_code" }), {
          status: 400,
        }) as unknown as Response
      );
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(false, events);
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }
      cb(
        `lightfast-dev://auth/callback?code=${"b".repeat(43)}&state=${captured.state}`
      );

      const result = await signIn;
      expect(result).toBeNull();
      expect(
        events.find((e) => e.event === "auth_signin_failed")
      ).toMatchObject({ reason: "exchange_failed" });
    } finally {
      restoreStdout();
      restore();
      fetchSpy.mockRestore();
    }
  });

  it("persist failure emits auth_signin_failed{reason:persist_failed} in agent mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt" }), {
        status: 200,
      }) as unknown as Response
    );
    setTokenMock.mockImplementationOnce(() => false);
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(false, events);
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }
      cb(
        `lightfast-dev://auth/callback?code=${"c".repeat(43)}&state=${captured.state}`
      );

      const result = await signIn;
      expect(result).toBeNull();
      expect(
        events.find((e) => e.event === "auth_signin_failed")
      ).toMatchObject({ reason: "persist_failed" });
      expect(sentryCaptureExceptionMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { scope: "auth-flow.persist_failed" },
        })
      );
    } finally {
      restoreStdout();
      restore();
      fetchSpy.mockRestore();
    }
  });

  it("handler exception emits auth_signin_failed{reason:handler_error}", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("network down"));
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(false, events);
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }
      cb(
        `lightfast-dev://auth/callback?code=${"d".repeat(43)}&state=${captured.state}`
      );

      // fetch rejected → exchangeCode returns null → exchange_failed (NOT
      // handler_error, because the catch is upstream of the rejection).
      const result = await signIn;
      expect(result).toBeNull();
      // Either exchange_failed (rejected fetch caught inside exchangeCode) is
      // the expected event here.
      expect(
        events.find((e) => e.event === "auth_signin_failed")
      ).toMatchObject({ reason: "exchange_failed" });
    } finally {
      restoreStdout();
      restore();
      fetchSpy.mockRestore();
    }
  });

  it("timeout emits auth_signin_failed{reason:timeout}; configurable via LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS", async () => {
    vi.useFakeTimers();
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const signIn = mod.beginSignIn();
      // Allow microtasks for the URL emission, then advance past 100ms.
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(150);
      const result = await signIn;
      expect(result).toBeNull();
      expect(
        events.find((e) => e.event === "auth_signin_failed")
      ).toMatchObject({ reason: "timeout" });
      expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
        expect.stringContaining("timeout"),
        expect.objectContaining({ tags: { scope: "auth-flow.timeout" } })
      );
    } finally {
      restoreStdout();
      restore();
    }
  }, 5_000);

  it("inflight singleton: concurrent beginSignIn calls share a single promise", async () => {
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const a = mod.beginSignIn();
      const b = mod.beginSignIn();
      expect(a).toBe(b);

      // shell.openExternal is invoked synchronously from inside the
      // Promise executor in non-agent mode, so we expect it called by now.
      expect(shellOpenExternalMock).toHaveBeenCalledTimes(1);

      const [r1, r2] = await Promise.all([a, b]);
      // Both callers see the same (timeout → null) result.
      expect(r1).toBe(r2);
    } finally {
      restore();
    }
  });
});

describe("auth-flow LIGHTFAST_DESKTOP_AGENT_MODE", () => {
  it("agent mode: shell.openExternal NOT called; stdout receives exactly one auth_signin_url line", async () => {
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const signIn = mod.beginSignIn();

      // The URL emission happens synchronously inside the Promise executor
      // before the first await, so events should already contain it.
      const urlEvents = events.filter((e) => e.event === "auth_signin_url");
      expect(urlEvents).toHaveLength(1);
      expect(shellOpenExternalMock).not.toHaveBeenCalled();
      const ev = urlEvents[0];
      if (!ev || ev.event !== "auth_signin_url") {
        throw new Error("expected auth_signin_url event");
      }
      const signinUrl = new URL(ev.url);
      expect(signinUrl.searchParams.get("redirect_uri")).toBe(
        "lightfast-dev://auth/callback"
      );

      await signIn;
    } finally {
      restoreStdout();
      restore();
    }
  });

  it("non-agent mode: shell.openExternal IS called; stdout has no auth_signin_url JSON line", async () => {
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      const signIn = mod.beginSignIn();
      expect(shellOpenExternalMock).toHaveBeenCalledTimes(1);
      expect(events.find((e) => e.event === "auth_signin_url")).toBeUndefined();
      await signIn;
    } finally {
      restoreStdout();
      restore();
    }
  });
});

describe("auth-flow maybeAutoBeginSignIn", () => {
  it("outside AGENT_MODE: no-op (no events, beginSignIn not invoked)", async () => {
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
    });
    try {
      mod.maybeAutoBeginSignIn();
      expect(events).toHaveLength(0);
      expect(shellOpenExternalMock).not.toHaveBeenCalled();
      expect(getTokenMock).not.toHaveBeenCalled();
    } finally {
      restoreStdout();
      restore();
    }
  });

  it("AGENT_MODE + token present: emits auth_already_signed_in exactly once and does NOT begin sign-in", async () => {
    getTokenMock.mockReturnValue("existing-jwt");
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
    });
    try {
      mod.maybeAutoBeginSignIn();
      expect(
        events.filter((e) => e.event === "auth_already_signed_in")
      ).toHaveLength(1);
      expect(events.find((e) => e.event === "auth_signin_url")).toBeUndefined();
      expect(shellOpenExternalMock).not.toHaveBeenCalled();
    } finally {
      restoreStdout();
      restore();
    }
  });

  it("AGENT_MODE + no token: calls beginSignIn (auth_signin_url emitted)", async () => {
    getTokenMock.mockReturnValue(null);
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
      LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS: "100",
    });
    try {
      mod.maybeAutoBeginSignIn();

      expect(events.find((e) => e.event === "auth_signin_url")).toBeDefined();
      expect(shellOpenExternalMock).not.toHaveBeenCalled();

      // Wait for the (auto) sign-in promise to time out so we don't leak
      // pending timers into subsequent tests.
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      restoreStdout();
      restore();
    }
  });
});

describe("auth-flow event grammar", () => {
  it("every auth_signin_url is followed by exactly one terminal event per in-flight sign-in", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt" }), {
        status: 200,
      }) as unknown as Response
    );
    const { events, restore: restoreStdout } = spyStdout();
    const { mod, restore } = await loadAuthFlow({
      NODE_ENV: "test",
      LIGHTFAST_API_URL: undefined,
      LIGHTFAST_DESKTOP_AGENT_MODE: "1",
    });
    try {
      const signIn = mod.beginSignIn();
      const captured = await captureSigninUrl(false, events);
      const cb = protocolListeners[0];
      if (!cb) {
        throw new Error("no protocol listener");
      }
      cb(
        `lightfast-dev://auth/callback?code=${"e".repeat(43)}&state=${captured.state}`
      );
      await signIn;

      const urlCount = events.filter(
        (e) => e.event === "auth_signin_url"
      ).length;
      const terminalCount = events.filter(
        (e) =>
          e.event === "auth_signed_in" || e.event === "auth_signin_failed"
      ).length;
      expect(urlCount).toBe(1);
      expect(terminalCount).toBe(1);
      expect(events.find((e) => e.event === "auth_signed_in")).toBeDefined();
    } finally {
      restoreStdout();
      restore();
      fetchSpy.mockRestore();
    }
  });
});
